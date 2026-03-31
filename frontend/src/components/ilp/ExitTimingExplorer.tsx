import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useChartColors } from '@/lib/chartTheme'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { formatIlpCurrency } from './formatters'

interface ExitTimingExplorerProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function ExitTimingExplorer({ policy, analysis }: ExitTimingExplorerProps) {
  const colors = useChartColors()
  const exitOptions = analysis.npvAnalysis.futureExitOptions
  const horizonYear = analysis.projections.mid.rows.at(-1)?.policyYear ?? analysis.npvAnalysis.bestExitYear
  const [selectedExitYear, setSelectedExitYear] = useState(String(analysis.npvAnalysis.bestExitYear))

  const selectedOption = useMemo(
    () => exitOptions.find((option) => String(option.exitYear) === selectedExitYear) ?? exitOptions[0],
    [exitOptions, selectedExitYear],
  )

  if (!selectedOption) return null

  const paidSoFarEstimate = (policy.initialSinglePremium ?? 0) + (policy.monthlyContribution * policy.monthsAlreadyPaid)
  const addedContributionsUntilExit = Math.max(0, selectedOption.totalContributions - paidSoFarEstimate)
  const contributionsAvoidedVsHold = Math.max(
    0,
    analysis.npvAnalysis.holdToMip.totalContributions - selectedOption.totalContributions,
  )
  const valueVsAddedContributions = selectedOption.netSurrenderValue - addedContributionsUntilExit
  const chartData = useMemo(
    () => exitOptions.map((option) => {
      const addedFromNowToExit = Math.max(0, option.totalContributions - paidSoFarEstimate)
      return {
        exitYear: option.exitYear,
        policyYear: option.policyYear,
        label: `Year ${option.policyYear}`,
        netGap: option.netSurrenderValue - addedFromNowToExit,
        addedFromNowToExit,
        netSurrenderValue: option.netSurrenderValue,
        eecCharge: option.eecCharge,
      }
    }),
    [exitOptions, paidSoFarEstimate],
  )

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Exit Timing Calculator</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a projected exit year to compare how much you could take out against how much more you would pay in before that point.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Exit year</div>
          <Select value={selectedExitYear} onValueChange={setSelectedExitYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exitOptions.map((option) => (
                <SelectItem key={option.exitYear} value={String(option.exitYear)}>
                  Year {option.policyYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Net gap by exit year</h3>
              <p className="text-sm text-muted-foreground">
                Positive bars mean the exit value is higher than the additional contributions you would make from now to that year.
              </p>
            </div>
          </div>
          <div className="h-72 rounded-md border border-border/80 bg-white/70 p-3 dark:bg-muted/10" role="img" aria-label="Bar chart showing net gap by exit year">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  width={88}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)}
                />
                <ReferenceLine y={0} stroke={colors.muted} strokeWidth={1.5} />
                <Tooltip
                  formatter={(value: number, _name, item) => [
                    formatIlpCurrency(value, policy.currency),
                    item.payload.netGap >= 0 ? 'Net value above added contributions' : 'Net value below added contributions',
                  ]}
                  labelFormatter={(_label, payload) => {
                    const point = payload?.[0]?.payload
                    if (!point) return ''
                    return `${point.label} · Value ${formatIlpCurrency(point.netSurrenderValue, policy.currency)} · Added ${formatIlpCurrency(point.addedFromNowToExit, policy.currency)} · Exit charge ${formatIlpCurrency(point.eecCharge, policy.currency)}`
                  }}
                />
                <Bar
                  dataKey="netGap"
                  radius={[6, 6, 0, 0]}
                  onClick={(point) => {
                    if (point?.exitYear != null) setSelectedExitYear(String(point.exitYear))
                  }}
                >
                  {chartData.map((entry) => {
                    const selected = String(entry.exitYear) === selectedExitYear
                    const positive = entry.netGap >= 0
                    const fill = selected
                      ? (positive ? colors.success : colors.danger)
                      : (positive ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)')
                    return <Cell key={entry.exitYear} fill={fill} className="cursor-pointer" />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Value available at exit</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(selectedOption.netSurrenderValue, policy.currency)}
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Added from now to exit</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(addedContributionsUntilExit, policy.currency)}
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Early-exit charge</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(selectedOption.eecCharge, policy.currency)}
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Contributions avoided vs year {horizonYear}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(contributionsAvoidedVsHold, policy.currency)}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
          {valueVsAddedContributions >= 0 ? (
            <p>
              If you exit in year {selectedOption.policyYear}, the value available is{' '}
              {formatIlpCurrency(valueVsAddedContributions, policy.currency)} more than the additional contributions you would make from here to that point.
            </p>
          ) : (
            <p>
              If you exit in year {selectedOption.policyYear}, the value available is{' '}
              {formatIlpCurrency(Math.abs(valueVsAddedContributions), policy.currency)} less than the additional contributions you would make from here to that point.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
