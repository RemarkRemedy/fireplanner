import {
  Area,
  AreaChart,
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/useIsMobile'
import { percentile } from '@/lib/math/stats'
import type { ProofChartType, ProofCycle, ProofMetricType, ProofProvenance } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface ProofChartProps {
  cycles: ProofCycle[]
  metricType: ProofMetricType
  chartType: ProofChartType
  showOutliers: boolean
  selectedCycleIndex: number
  onSelectedCycleChange: (index: number) => void
}

interface AggregatedPoint {
  index: number
  age: number
  year: number
  min: number
  max: number
  mean: number
  median: number
  p10: number
  p90: number
  spendingMean: number
  returnsMeanPct: number
  actualCount: number
  proxyCount: number
  mixedCount: number
}

function aggregate(cycles: ProofCycle[], metricType: ProofMetricType): AggregatedPoint[] {
  if (cycles.length === 0) return []

  const horizon = Math.min(...cycles.map((c) => c.rows.length))
  const out: AggregatedPoint[] = []

  for (let i = 0; i < horizon; i++) {
    const values = cycles.map((c) => {
      const row = c.rows[i]
      return metricType === 'portfolio' ? row.liquidNW : row.annualExpenses
    })

    const spending = cycles.map((c) => c.rows[i].annualExpenses)
    const returnsPct = cycles.map((c) => c.rows[i].portfolioReturnPct * 100)

    let actualCount = 0
    let proxyCount = 0
    let mixedCount = 0
    for (const cycle of cycles) {
      const prov: ProofProvenance = cycle.provenance[i] ?? 'actual'
      if (prov === 'actual') actualCount++
      if (prov === 'proxy') proxyCount++
      if (prov === 'mixed') mixedCount++
    }

    out.push({
      index: i,
      age: cycles[0].rows[i].age,
      year: cycles[0].rows[i].year,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      median: percentile(values, 50),
      p10: percentile(values, 10),
      p90: percentile(values, 90),
      spendingMean: spending.reduce((sum, v) => sum + v, 0) / spending.length,
      returnsMeanPct: returnsPct.reduce((sum, v) => sum + v, 0) / returnsPct.length,
      actualCount,
      proxyCount,
      mixedCount,
    })
  }

  return out
}

function formatValue(metricType: ProofMetricType, value: number): string {
  return metricType === 'portfolio' ? formatCurrency(value) : formatCurrency(value)
}

export function ProofChart({
  cycles,
  metricType,
  chartType,
  showOutliers,
  selectedCycleIndex,
  onSelectedCycleChange,
}: ProofChartProps) {
  const isMobile = useIsMobile()

  const aggregated = aggregate(cycles, metricType)
  const selectedCycle = cycles[Math.max(0, Math.min(selectedCycleIndex, cycles.length - 1))] ?? null

  const displayedCycles = (() => {
    if (cycles.length <= 40) return cycles
    const step = Math.ceil(cycles.length / 40)
    return cycles.filter((_, i) => i % step === 0 || i === cycles.length - 1)
  })()

  const timeSeriesData = aggregated.map((point) => {
    const row: Record<string, number | string> = {
      age: point.age,
      year: point.year,
      actualCount: point.actualCount,
      proxyCount: point.proxyCount,
      mixedCount: point.mixedCount,
    }
    for (const cycle of displayedCycles) {
      const cycleRow = cycle.rows[point.index]
      row[cycle.id] = metricType === 'portfolio' ? cycleRow.liquidNW : cycleRow.annualExpenses
    }
    return row
  })

  const individualData = selectedCycle
    ? selectedCycle.rows.map((row, i) => ({
        age: row.age,
        year: row.year,
        value: metricType === 'portfolio' ? row.liquidNW : row.annualExpenses,
        provenance: selectedCycle.provenance[i] ?? 'actual',
      }))
    : []

  if (cycles.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground text-center">
          No cycles available for this view.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {chartType === 'minmaxmean' && `${metricType === 'portfolio' ? 'Portfolio' : 'Spending'} Min/Max/Mean`}
          {chartType === 'time_series' && `${metricType === 'portfolio' ? 'Portfolio' : 'Spending'} Over Time`}
          {chartType === 'individual_cycles' && `${metricType === 'portfolio' ? 'Portfolio' : 'Spending'} - Individual Cycle`}
          {chartType === 'spending_vs_returns' && 'Average Spending vs Returns'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {chartType === 'individual_cycles' && selectedCycle && (
          <div className="max-w-sm">
            <Select value={String(Math.max(0, Math.min(selectedCycleIndex, cycles.length - 1)))} onValueChange={(v) => onSelectedCycleChange(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((cycle, i) => (
                  <SelectItem key={cycle.id} value={String(i)}>
                    {cycle.startYear ? `${cycle.label} (Data Start: ${cycle.startYear})` : cycle.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="h-72 md:h-96" role="img" aria-label="Proof chart">
          {chartType === 'minmaxmean' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggregated}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="age" />
                <YAxis tickFormatter={(v: number) => formatValue(metricType, v)} width={100} />
                <Tooltip
                  trigger={isMobile ? 'click' : undefined}
                  formatter={(value: number, name: string) => {
                    if (name === 'returnsMeanPct') return [`${value.toFixed(2)}%`, 'Avg Return']
                    return [formatValue(metricType, value), name]
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const row = payload[0]?.payload as AggregatedPoint | undefined
                    if (!row) return null
                    return (
                      <div className="rounded border bg-background p-2 text-xs shadow">
                        <div className="font-medium mb-1">Age {label}</div>
                        <div className="flex justify-between gap-4"><span>Mean</span><span>{formatValue(metricType, row.mean)}</span></div>
                        <div className="flex justify-between gap-4"><span>Median</span><span>{formatValue(metricType, row.median)}</span></div>
                        <div className="flex justify-between gap-4"><span>p10</span><span>{formatValue(metricType, row.p10)}</span></div>
                        <div className="flex justify-between gap-4"><span>p90</span><span>{formatValue(metricType, row.p90)}</span></div>
                        {showOutliers && (
                          <>
                            <div className="flex justify-between gap-4"><span>Min</span><span>{formatValue(metricType, row.min)}</span></div>
                            <div className="flex justify-between gap-4"><span>Max</span><span>{formatValue(metricType, row.max)}</span></div>
                          </>
                        )}
                        <div className="mt-1 pt-1 border-t text-muted-foreground">
                          Provenance: A {row.actualCount} / P {row.proxyCount} / M {row.mixedCount}
                        </div>
                      </div>
                    )
                  }}
                />
                <Area type="monotone" dataKey={showOutliers ? 'max' : 'p90'} stroke="none" fill="#86efac" fillOpacity={0.35} />
                <Area type="monotone" dataKey={showOutliers ? 'min' : 'p10'} stroke="none" fill="#ffffff" fillOpacity={1} />
                <Line type="monotone" dataKey="mean" stroke="#14b8a6" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="median" stroke="#1d4ed8" dot={false} strokeWidth={2} />
                {showOutliers && (
                  <>
                    <Line type="monotone" dataKey="min" stroke="#ef4444" dot={false} strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="max" stroke="#22c55e" dot={false} strokeDasharray="4 3" />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}

          {chartType === 'time_series' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="age" />
                <YAxis tickFormatter={(v: number) => formatValue(metricType, v)} width={100} />
                <Tooltip
                  trigger={isMobile ? 'click' : undefined}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const row = payload[0]?.payload as AggregatedPoint | undefined
                    if (!row) return null
                    return (
                      <div className="rounded border bg-background p-2 text-xs shadow">
                        <div className="font-medium mb-1">Age {label}</div>
                        {payload.slice(0, 8).map((p) => (
                          <div key={String(p.dataKey)} className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{p.name}</span>
                            <span>{formatValue(metricType, Number(p.value ?? 0))}</span>
                          </div>
                        ))}
                        <div className="mt-1 pt-1 border-t text-muted-foreground">
                          Provenance: A {row.actualCount} / P {row.proxyCount} / M {row.mixedCount}
                        </div>
                      </div>
                    )
                  }}
                />
                {displayedCycles.map((cycle) => (
                  <Line
                    key={cycle.id}
                    type="monotone"
                    dataKey={cycle.id}
                    name={cycle.startYear ? `${cycle.label} (${cycle.startYear})` : cycle.label}
                    stroke="#3b82f6"
                    strokeOpacity={0.35}
                    strokeWidth={1.2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}

          {chartType === 'individual_cycles' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={individualData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="age" />
                <YAxis tickFormatter={(v: number) => formatValue(metricType, v)} width={100} />
                <Tooltip
                  trigger={isMobile ? 'click' : undefined}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const row = payload[0]?.payload as { value: number; provenance: ProofProvenance } | undefined
                    if (!row) return null
                    return (
                      <div className="rounded border bg-background p-2 text-xs shadow">
                        <div className="font-medium">Age {label}</div>
                        <div className="flex justify-between gap-4">
                          <span>{metricType === 'portfolio' ? 'Portfolio' : 'Spending'}</span>
                          <span>{formatValue(metricType, row.value)}</span>
                        </div>
                        <div className="text-muted-foreground mt-1">Provenance: {row.provenance}</div>
                      </div>
                    )
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {chartType === 'spending_vs_returns' && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggregated}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="age" />
                <YAxis yAxisId="left" tickFormatter={(v: number) => `$${v.toFixed(0)}k`} width={80} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={70} />
                <Tooltip
                  trigger={isMobile ? 'click' : undefined}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const row = payload[0]?.payload as AggregatedPoint | undefined
                    if (!row) return null
                    return (
                      <div className="rounded border bg-background p-2 text-xs shadow">
                        <div className="font-medium mb-1">Age {label}</div>
                        <div className="flex justify-between gap-4">
                          <span>Avg Spending</span>
                          <span>{formatCurrency(row.spendingMean)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Avg Return</span>
                          <span>{formatPercent(row.returnsMeanPct / 100, 2)}</span>
                        </div>
                        <div className="mt-1 pt-1 border-t text-muted-foreground">
                          Provenance: A {row.actualCount} / P {row.proxyCount} / M {row.mixedCount}
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey={(d: AggregatedPoint) => d.spendingMean / 1000} name="Avg Spending" fill="#2dd4bf" />
                <Bar yAxisId="right" dataKey="returnsMeanPct" name="Avg Return" fill="#fda4af" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
