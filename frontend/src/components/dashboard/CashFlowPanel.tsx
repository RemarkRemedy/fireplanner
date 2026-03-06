import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useCashFlowChart, type CashFlowPhase, type CashFlowRow } from '@/hooks/useCashFlowChart'
import { ChartSkeleton } from '@/components/shared/ChartSkeleton'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

// ============================================================
// Series configuration
// ============================================================

interface SeriesConfig {
  key: keyof CashFlowRow
  label: string
  color: string
  group: 'income' | 'outflow'
}

const SERIES_CONFIG: SeriesConfig[] = [
  // Income (positive, stackId="income" — stacks upward from zero)
  { key: 'salary', label: 'Salary', color: '#2563eb', group: 'income' },
  { key: 'rental', label: 'Rental', color: '#0ea5e9', group: 'income' },
  { key: 'investment', label: 'Investment', color: '#8b5cf6', group: 'income' },
  { key: 'business', label: 'Business', color: '#06b6d4', group: 'income' },
  { key: 'government', label: 'Government / CPF LIFE', color: '#10b981', group: 'income' },
  { key: 'srsWithdrawal', label: 'SRS (Supplementary Retirement) Withdrawal', color: '#818cf8', group: 'income' },
  { key: 'portfolioWithdrawal', label: 'Portfolio Withdrawal', color: '#60a5fa', group: 'income' },
  // Outflows (negative, stackId="outflow" — stacks downward from zero)
  { key: 'tax', label: 'Tax', color: '#f59e0b', group: 'outflow' },
  { key: 'cpf', label: 'CPF Contribution', color: '#fbbf24', group: 'outflow' },
  { key: 'living', label: 'Living Expenses', color: '#f87171', group: 'outflow' },
  { key: 'parentSupport', label: 'Parent Support', color: '#fb923c', group: 'outflow' },
  { key: 'healthcare', label: 'Healthcare', color: '#fb7185', group: 'outflow' },
  { key: 'mortgage', label: 'Mortgage', color: '#fca5a5', group: 'outflow' },
  { key: 'rent', label: 'Rent', color: '#fdba74', group: 'outflow' },
]

// ============================================================
// Custom Tooltip
// ============================================================

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
  dataKey: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: number
}

function CashFlowTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  // Exclude the net cash flow overlay line from income/outflow breakdown
  const series = payload.filter((p) => p.dataKey !== 'netCashFlow')
  const income = series.filter((p) => p.value > 0)
  const outflows = series.filter((p) => p.value < 0)
  const netCashFlow = series.reduce((sum, p) => sum + p.value, 0)

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-medium mb-2">Age {label}</p>

      {income.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Income</p>
          {income.map((item) => (
            <div key={item.dataKey} className="flex justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </span>
              <span className="font-medium tabular-nums text-green-600">
                +{formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {outflows.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Outflows</p>
          {outflows.map((item) => (
            <div key={item.dataKey} className="flex justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </span>
              <span className="font-medium tabular-nums text-red-600">
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-1.5 flex justify-between font-medium">
        <span>Net Cash Flow</span>
        <span className={cn(
          'tabular-nums',
          netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
        </span>
      </div>
    </div>
  )
}

// ============================================================
// Phase Toggle
// ============================================================

const PHASE_OPTIONS: { value: CashFlowPhase; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'accumulation', label: 'Pre-Retirement' },
  { value: 'decumulation', label: 'Retirement' },
]

// ============================================================
// CashFlowPanel Component
// ============================================================

export function CashFlowPanel() {
  const [phase, setPhase] = useState<CashFlowPhase>('all')
  const data = useCashFlowChart(phase)
  const isMobile = useIsMobile()

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton className="h-56 md:h-72 lg:h-[350px]" />
        </CardContent>
      </Card>
    )
  }

  const { rows, visibleSeries, retirementAge } = data

  // Filter series configs to only include visible ones
  const activeSeries = SERIES_CONFIG.filter((s) => visibleSeries.includes(s.key))

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Cash Flow</CardTitle>
          <div className="flex gap-1">
            {PHASE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={phase === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPhase(opt.value)}
                className="text-xs px-2.5"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="h-56 md:h-72 lg:h-[350px]"
          role="img"
          aria-label="Stacked area chart showing income and outflow cash flows over time"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="age"
                label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v)}
                width={90}
              />
              <Tooltip trigger={isMobile ? 'click' : undefined} content={<CashFlowTooltip />} />

              {/* Zero line */}
              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />

              {/* Retirement line (only in 'all' mode) */}
              {phase === 'all' && (
                <ReferenceLine
                  x={retirementAge}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{ value: 'Retire', position: 'top', fill: '#f59e0b' }}
                />
              )}

              {/* Income series stack upward from zero, outflow series stack downward */}
              {activeSeries.map((series) => (
                <Area
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stackId={series.group}
                  stroke={series.color}
                  fill={series.color}
                  fillOpacity={0.6}
                  isAnimationActive
                  animationDuration={800}
                />
              ))}

              {/* Net cash flow line overlay */}
              <Line
                type="monotone"
                dataKey="netCashFlow"
                name="Net Cash Flow"
                stroke="#334155"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
