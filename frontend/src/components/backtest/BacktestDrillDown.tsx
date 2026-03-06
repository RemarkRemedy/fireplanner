import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { runBacktestWorker, runDetailedWindowWorker, flattenStrategyParams } from '@/lib/simulation/workerClient'
import type { BacktestResult, PerYearResult } from '@/lib/types'
import type { DetailedWindowResult, BacktestEngineParams } from '@/lib/simulation/backtest'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAnalysisPortfolio } from '@/hooks/useAnalysisPortfolio'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface BacktestDrillDownProps {
  swr: number
  duration: number
  successRate: number
  open: boolean
  onClose: () => void
  dataset: 'us_only' | 'sg_only' | 'blended'
  blendRatio: number
}

interface TrajectoryData {
  label: string
  startYear: number
  detail: DetailedWindowResult
  color: string
}

export function BacktestDrillDown({
  swr,
  duration,
  successRate,
  open,
  onClose,
  dataset,
  blendRatio,
}: BacktestDrillDownProps) {
  const isMobile = useIsMobile()
  const profile = useProfileStore()
  const withdrawal = useWithdrawalStore()
  const analysisPortfolio = useAnalysisPortfolio()

  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [trajectories, setTrajectories] = useState<TrajectoryData[]>([])
  const [isPending, setIsPending] = useState(false)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)

  const strategy = withdrawal.selectedStrategies[0] ?? 'constant_dollar'

  const buildParams = useCallback((): BacktestEngineParams => ({
    initialPortfolio: analysisPortfolio.retirementPortfolio,
    allocationWeights: analysisPortfolio.allocationWeights,
    swr,
    retirementDuration: duration,
    dataset,
    blendRatio,
    expenseRatio: profile.expenseRatio,
    withdrawalStrategy: strategy,
    strategyParams: flattenStrategyParams(strategy, withdrawal.strategyParams),
    inflation: profile.inflation,
    // Drill-down is opened from heatmap cells which are always rate-driven
    // (generateHeatmap forces annualExpensesAtRetirement to undefined).
    // Force 'rate' here so trajectories match the heatmap cell's success rate.
    withdrawalBasis: 'rate',
    annualExpensesAtRetirement: getEffectiveExpenses(
      profile.retirementAge, profile.annualExpenses,
      profile.expenseAdjustments, profile.lifeExpectancy,
    ) * Math.pow(1 + profile.inflation, Math.max(0, profile.retirementAge - profile.currentAge)),
    retirementMitigation: profile.retirementMitigation,
  }), [analysisPortfolio, swr, duration, dataset, blendRatio, profile, strategy, withdrawal.strategyParams])

  // Load backtest data + worst trajectory on open
  useEffect(() => {
    if (!open) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Batched state reset for async loading
    setIsPending(true)
    setTrajectories([])
    setSelectedRow(null)

    const params = buildParams()

    runBacktestWorker(params, false).then(async (result) => {
      setBacktestResult(result)

      // Load worst-case trajectory
      if (result.results.length > 0) {
        const worst = result.results.reduce((a, b) =>
          a.ending_balance < b.ending_balance ? a : b,
        )
        const detail = await runDetailedWindowWorker(params, worst.start_year)
        setTrajectories([{
          label: `Worst (${worst.start_year})`,
          startYear: worst.start_year,
          detail,
          color: '#ef4444',
        }])
      }

      setIsPending(false)
    }).catch(() => setIsPending(false))
  }, [open, buildParams])

  const loadTrajectory = async (label: string, result: PerYearResult, color: string) => {
    // Don't reload if already loaded
    if (trajectories.some(t => t.startYear === result.start_year && t.label === label)) return

    const params = buildParams()
    const detail = await runDetailedWindowWorker(params, result.start_year)
    setTrajectories(prev => [...prev, {
      label,
      startYear: result.start_year,
      detail,
      color,
    }])
  }

  const loadNamedTrajectory = async (type: 'median' | 'best') => {
    if (!backtestResult) return
    const sorted = [...backtestResult.results].sort((a, b) => a.ending_balance - b.ending_balance)
    if (type === 'median') {
      const median = sorted[Math.floor(sorted.length / 2)]
      await loadTrajectory(`Median (${median.start_year})`, median, '#3b82f6')
    } else {
      const best = sorted[sorted.length - 1]
      await loadTrajectory(`Best (${best.start_year})`, best, '#22c55e')
    }
  }

  const loadRowTrajectory = async (result: PerYearResult) => {
    setSelectedRow(result.start_year)
    await loadTrajectory(`${result.start_year}`, result, '#8b5cf6')
  }

  // Build chart data from trajectories
  const chartData = trajectories.length > 0
    ? trajectories[0].detail.years.map((year, i) => {
        const row: Record<string, number | string> = { year }
        for (const t of trajectories) {
          if (i < t.detail.yearlyBalances.length) {
            row[t.label] = t.detail.yearlyBalances[i]
          }
        }
        return row
      })
    : []

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            SWR {formatPercent(swr, 1)} x {duration} years
          </SheetTitle>
          <SheetDescription>
            Success rate: {formatPercent(successRate, 1)} — {backtestResult?.summary.total_periods ?? '...'} tested historical periods
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Summary stats */}
          {backtestResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Success Rate"
                value={formatPercent(backtestResult.summary.success_rate, 1)}
                color={backtestResult.summary.success_rate >= 0.95 ? 'text-green-600' : backtestResult.summary.success_rate >= 0.8 ? 'text-yellow-600' : 'text-destructive'}
              />
              <StatCard
                label="Median Ending"
                value={formatCurrency(backtestResult.summary.median_ending_balance)}
              />
              <StatCard
                label="Worst Start"
                value={String(backtestResult.summary.worst_start_year)}
                color="text-destructive"
              />
              <StatCard
                label="Avg Withdrawn"
                value={formatCurrency(backtestResult.summary.average_total_withdrawn)}
              />
            </div>
          )}

          {/* Portfolio Trajectory Chart */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Portfolio Trajectory</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadNamedTrajectory('median')}
                    disabled={trajectories.some(t => t.label.startsWith('Median'))}
                  >
                    Show Median
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadNamedTrajectory('best')}
                    disabled={trajectories.some(t => t.label.startsWith('Best'))}
                  >
                    Show Best
                  </Button>
                </div>
              </div>

              {isPending && (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                  Loading...
                </div>
              )}

              {!isPending && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip
                      trigger={isMobile ? 'click' : undefined}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    {trajectories.map((t) => (
                      <Area
                        key={t.label}
                        type="monotone"
                        dataKey={t.label}
                        stroke={t.color}
                        fill={t.color}
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Rolling Windows Table */}
          {backtestResult && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-3">
                  Tested Historical Periods ({backtestResult.results.length})
                </p>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="text-left py-2 pr-2 font-medium">Start</th>
                        <th className="text-center py-2 px-2 font-medium">Status</th>
                        <th className="text-right py-2 px-2 font-medium">Ending Balance</th>
                        <th className="text-right py-2 px-2 font-medium">Total Withdrawn</th>
                        <th className="text-right py-2 pl-2 font-medium">Min Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtestResult.results.map((r) => (
                        <tr
                          key={r.start_year}
                          className={`border-b border-muted/50 cursor-pointer transition-colors hover:bg-muted/30 ${
                            selectedRow === r.start_year ? 'bg-primary/10' : ''
                          }`}
                          onClick={() => loadRowTrajectory(r)}
                        >
                          <td className="py-1.5 pr-2 font-medium">{r.start_year}</td>
                          <td className="py-1.5 px-2 text-center">
                            <Badge variant={r.survived ? 'default' : 'destructive'} className="text-xs">
                              {r.survived ? 'Passed' : 'Failed'}
                            </Badge>
                          </td>
                          <td className="py-1.5 px-2 text-right">{formatCurrency(r.ending_balance)}</td>
                          <td className="py-1.5 px-2 text-right">{formatCurrency(r.total_withdrawn)}</td>
                          <td className="py-1.5 pl-2 text-right">{formatCurrency(r.min_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color ?? ''}`}>{value}</p>
    </div>
  )
}
