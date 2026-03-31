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
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface ExitTimingExplorerProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function ExitTimingExplorer({ policy, analysis }: ExitTimingExplorerProps) {
  const colors = useChartColors()
  const horizonYear = analysis.projections.mid.rows.at(-1)?.policyYear ?? analysis.npvAnalysis.bestExitYear
  const paidSoFarEstimate = (policy.initialSinglePremium ?? 0) + (policy.monthlyContribution * policy.monthsAlreadyPaid)
  const exitOptions = useMemo(
    () => [
      {
        exitYear: 0,
        policyYear: 0,
        eecRate: analysis.npvAnalysis.surrenderNow.eecRate,
        eecCharge: analysis.npvAnalysis.surrenderNow.eecCharge,
        pvEec: analysis.npvAnalysis.surrenderNow.eecCharge,
        npvGrossFees: 0,
        npvBonuses: 0,
        totalNpvFees: analysis.npvAnalysis.surrenderNow.npvFees,
        netSurrenderValue: analysis.npvAnalysis.surrenderNow.netSurrenderValue,
        totalContributions: paidSoFarEstimate,
      },
      ...analysis.npvAnalysis.futureExitOptions,
    ],
    [analysis.npvAnalysis.futureExitOptions, analysis.npvAnalysis.surrenderNow, paidSoFarEstimate],
  )
  const [selectedExitYear, setSelectedExitYear] = useState(String(analysis.npvAnalysis.bestExitYear))

  const selectedOption = useMemo(
    () => exitOptions.find((option) => String(option.exitYear) === selectedExitYear) ?? exitOptions[0],
    [exitOptions, selectedExitYear],
  )

  if (!selectedOption) return null

  const addedContributionsUntilExit = Math.max(0, selectedOption.totalContributions - paidSoFarEstimate)
  const contributionsAvoidedVsHold = Math.max(
    0,
    analysis.npvAnalysis.holdToMip.totalContributions - selectedOption.totalContributions,
  )
  const valueVsAddedContributions = selectedOption.netSurrenderValue - addedContributionsUntilExit

  const chartData = useMemo(
    () => exitOptions.map((option) => {
      const addedFromNowToExit = Math.max(0, option.totalContributions - paidSoFarEstimate)
      let etfAlternativeValue = analysis.summary.currentSurrenderValue * Math.pow(1 + policy.alternativeReturn, option.exitYear)
      for (const row of analysis.projections.mid.rows.filter((row) => row.year <= option.exitYear)) {
        etfAlternativeValue += row.annualContribution * Math.pow(1 + policy.alternativeReturn, option.exitYear - row.year)
      }

      return {
        exitYear: option.exitYear,
        policyYear: option.policyYear,
        label: `Year ${option.policyYear}`,
        netGap: option.netSurrenderValue - addedFromNowToExit,
        addedFromNowToExit,
        netSurrenderValue: option.netSurrenderValue,
        eecCharge: option.eecCharge,
        etfAlternativeValue,
      }
    }),
    [analysis.projections.mid.rows, analysis.summary.currentSurrenderValue, exitOptions, paidSoFarEstimate, policy.alternativeReturn],
  )

  const projectedChartData = useMemo(
    () => chartData.filter((entry) => entry.exitYear > 0),
    [chartData],
  )

  const projectedValueDomain = useMemo<[number, number]>(() => {
    const values = projectedChartData.flatMap((entry) => [
      entry.netSurrenderValue,
      entry.addedFromNowToExit,
      entry.etfAlternativeValue,
    ])
    if (values.length === 0) {
      return [0, 1000]
    }

    const maxValue = Math.max(...values)
    const roundedMax = Math.ceil((maxValue * 1.08) / 1000) * 1000
    return [0, Math.max(roundedMax, 1000)]
  }, [projectedChartData])

  const selectedChartPoint = chartData.find((entry) => String(entry.exitYear) === selectedExitYear) ?? chartData[0]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Exit Timing Calculator</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a projected exit year to compare how much you could take out against how much more you would pay in before that point.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Includes year 0 if you want to compare against stopping before any further premiums are paid.
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
          <div>
            <h3 className="text-sm font-semibold">Net gap by exit year</h3>
            <p className="text-sm text-muted-foreground">
              Positive bars mean the exit value is higher than the additional contributions you would make from now to that year.
            </p>
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
                    return `${point.label} · Withdrawable ${formatIlpCurrency(point.netSurrenderValue, policy.currency)} · Added ${formatIlpCurrency(point.addedFromNowToExit, policy.currency)} · Exit charge ${formatIlpCurrency(point.eecCharge, policy.currency)}`
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

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Withdrawable value vs added from now</h3>
            <p className="text-sm text-muted-foreground">
              Compare how much you could withdraw at each exit year against how much more you would still add from today to reach that point.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected exit year</div>
              <div className="mt-1 text-lg font-semibold">
                {selectedChartPoint != null ? `Year ${selectedChartPoint.policyYear}` : 'n/a'}
              </div>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.success }} />
                Withdrawable value
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {selectedChartPoint != null
                  ? formatIlpCurrency(selectedChartPoint.netSurrenderValue, policy.currency)
                  : 'n/a'}
              </div>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
                Added from now
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {selectedChartPoint != null
                  ? formatIlpCurrency(selectedChartPoint.addedFromNowToExit, policy.currency)
                  : 'n/a'}
              </div>
            </div>
          </div>
          <div className="h-72 rounded-md border border-border/80 bg-white/70 p-3 dark:bg-muted/10" role="img" aria-label="Line chart showing withdrawable value and added contributions by exit year">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectedChartData} margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/70" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  width={92}
                  tickLine={false}
                  axisLine={false}
                  domain={projectedValueDomain}
                  tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const numericValue = typeof value === 'number' ? value : Number(value)
                    if (!Number.isFinite(numericValue)) return ['n/a', name]
                    return [formatIlpCurrency(numericValue, policy.currency), name]
                  }}
                  labelFormatter={(_label, payload) => {
                    const point = payload?.[0]?.payload
                    if (!point) return ''
                    return `${point.label} · Withdrawable ${formatIlpCurrency(point.netSurrenderValue, policy.currency)} · Added ${formatIlpCurrency(point.addedFromNowToExit, policy.currency)}`
                  }}
                />
                {selectedChartPoint?.exitYear != null && selectedChartPoint.exitYear > 0 ? (
                  <ReferenceLine x={selectedChartPoint.label} stroke={colors.muted} strokeDasharray="4 4" />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="netSurrenderValue"
                  name="Withdrawable value"
                  stroke={colors.success}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="addedFromNowToExit"
                  name="Added from now"
                  stroke={colors.primary}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                {selectedChartPoint?.exitYear != null && selectedChartPoint.exitYear > 0 ? (
                  <ReferenceDot
                    x={selectedChartPoint.label}
                    y={selectedChartPoint.netSurrenderValue}
                    r={5}
                    fill={colors.success}
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : null}
                {selectedChartPoint?.exitYear != null && selectedChartPoint.exitYear > 0 ? (
                  <ReferenceDot
                    x={selectedChartPoint.label}
                    y={selectedChartPoint.addedFromNowToExit}
                    r={5}
                    fill={colors.primary}
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">If the same money went into a low-cost ETF instead</h3>
            <p className="text-sm text-muted-foreground">
              This benchmark uses the current alternative-return assumption of {formatIlpPercent(policy.alternativeReturn)} a year. It is an illustrative comparison, not a guarantee.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected exit year</div>
              <div className="mt-1 text-lg font-semibold">
                {selectedChartPoint != null ? `Year ${selectedChartPoint.policyYear}` : 'n/a'}
              </div>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.success }} />
                Withdrawable value
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {selectedChartPoint != null
                  ? formatIlpCurrency(selectedChartPoint.netSurrenderValue, policy.currency)
                  : 'n/a'}
              </div>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                ETF benchmark
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {selectedChartPoint != null
                  ? formatIlpCurrency(selectedChartPoint.etfAlternativeValue, policy.currency)
                  : 'n/a'}
              </div>
            </div>
          </div>
          <div className="h-72 rounded-md border border-border/80 bg-white/70 p-3 dark:bg-muted/10" role="img" aria-label="Line chart showing withdrawable value and ETF benchmark by exit year">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectedChartData} margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/70" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  width={92}
                  tickLine={false}
                  axisLine={false}
                  domain={projectedValueDomain}
                  tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const numericValue = typeof value === 'number' ? value : Number(value)
                    if (!Number.isFinite(numericValue)) return ['n/a', name]
                    return [formatIlpCurrency(numericValue, policy.currency), name]
                  }}
                  labelFormatter={(_label, payload) => {
                    const point = payload?.[0]?.payload
                    if (!point) return ''
                    return `${point.label} · Withdrawable ${formatIlpCurrency(point.netSurrenderValue, policy.currency)} · ETF benchmark ${formatIlpCurrency(point.etfAlternativeValue, policy.currency)}`
                  }}
                />
                {selectedChartPoint?.exitYear != null && selectedChartPoint.exitYear > 0 ? (
                  <ReferenceLine x={selectedChartPoint.label} stroke={colors.muted} strokeDasharray="4 4" />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="netSurrenderValue"
                  name="Withdrawable value"
                  stroke={colors.success}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="etfAlternativeValue"
                  name="ETF benchmark"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                {selectedChartPoint?.exitYear != null && selectedChartPoint.exitYear > 0 ? (
                  <ReferenceDot
                    x={selectedChartPoint.label}
                    y={selectedChartPoint.netSurrenderValue}
                    r={5}
                    fill={colors.success}
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : null}
                {selectedChartPoint?.exitYear != null && selectedChartPoint.exitYear > 0 ? (
                  <ReferenceDot
                    x={selectedChartPoint.label}
                    y={selectedChartPoint.etfAlternativeValue}
                    r={5}
                    fill="#f59e0b"
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : null}
              </LineChart>
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
