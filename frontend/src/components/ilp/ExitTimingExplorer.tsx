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
  ReferenceLine,
  ReferenceDot,
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

function solveAnnualizedReturn(cashflows: number[]): number | null {
  if (cashflows.length < 2) return null

  const hasNegative = cashflows.some((value) => value < 0)
  const hasPositive = cashflows.some((value) => value > 0)
  if (!hasNegative || !hasPositive) return null

  const npv = (rate: number) => cashflows.reduce(
    (sum, value, index) => sum + (value / Math.pow(1 + rate, index)),
    0,
  )

  let low = -0.9999
  let high = 1
  let npvLow = npv(low)
  let npvHigh = npv(high)

  let expansionGuard = 0
  while (npvLow * npvHigh > 0 && expansionGuard < 16) {
    high *= 2
    npvHigh = npv(high)
    expansionGuard += 1
  }

  if (npvLow * npvHigh > 0) {
    return null
  }

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const mid = (low + high) / 2
    const npvMid = npv(mid)
    if (Math.abs(npvMid) < 1e-8) {
      return mid
    }
    if (npvLow * npvMid <= 0) {
      high = mid
      npvHigh = npvMid
    } else {
      low = mid
      npvLow = npvMid
    }
  }

  return (low + high) / 2
}

export function ExitTimingExplorer({ policy, analysis }: ExitTimingExplorerProps) {
  const colors = useChartColors()
  const horizonYear = analysis.projections.mid.rows.at(-1)?.policyYear ?? analysis.npvAnalysis.bestExitYear
  const paidSoFarEstimate = (policy.initialSinglePremium ?? 0) + (policy.monthlyContribution * policy.monthsAlreadyPaid)
  const currentGrossValue = analysis.summary.currentSurrenderValue + analysis.summary.cancelNowPenalty
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
      const matchingRow = option.exitYear > 0
        ? analysis.projections.mid.rows.find((row) => row.year === option.exitYear)
        : null
      const annualContributions = analysis.projections.mid.rows
        .filter((row) => row.year <= option.exitYear)
        .map((row) => -row.annualContribution)
      const grossCashflows = [-currentGrossValue, ...annualContributions]
      const netCashflows = [-analysis.summary.currentSurrenderValue, ...annualContributions]
      if (option.exitYear > 0 && matchingRow) {
        grossCashflows[grossCashflows.length - 1] += matchingRow.combinedValue
        netCashflows[netCashflows.length - 1] += option.netSurrenderValue
      } else {
        grossCashflows[0] += currentGrossValue
        netCashflows[0] += analysis.summary.currentSurrenderValue
      }
      const grossAnnualizedReturn = option.exitYear > 0 ? solveAnnualizedReturn(grossCashflows) : 0
      const netAnnualizedReturn = option.exitYear > 0 ? solveAnnualizedReturn(netCashflows) : 0
      return {
        exitYear: option.exitYear,
        policyYear: option.policyYear,
        label: `Year ${option.policyYear}`,
        netGap: option.netSurrenderValue - addedFromNowToExit,
        addedFromNowToExit,
        netSurrenderValue: option.netSurrenderValue,
        eecCharge: option.eecCharge,
        grossExitValue: matchingRow?.combinedValue ?? currentGrossValue,
        grossAnnualizedReturn: grossAnnualizedReturn ?? null,
        netAnnualizedReturn: netAnnualizedReturn ?? null,
      }
    }),
    [analysis.projections.mid.rows, analysis.summary.currentSurrenderValue, currentGrossValue, exitOptions, paidSoFarEstimate],
  )
  const selectedReturnPoint = chartData.find((entry) => String(entry.exitYear) === selectedExitYear) ?? chartData[0]
  const returnChartData = useMemo(
    () => chartData.filter((entry) => entry.exitYear > 0),
    [chartData],
  )
  const returnValues = returnChartData.flatMap((entry) => [
    entry.grossAnnualizedReturn,
    entry.netAnnualizedReturn,
  ]).filter((value): value is number => value != null && Number.isFinite(value))
  const returnDomain = useMemo<[number, number]>(() => {
    if (returnValues.length === 0) {
      return [-0.1, 0.1]
    }
    const minValue = Math.min(...returnValues)
    const maxValue = Math.max(...returnValues)
    const padding = 0.03
    const rawMin = Math.min(minValue - padding, -0.02)
    const rawMax = Math.max(maxValue + padding, 0.02)
    const roundedMin = Math.floor(rawMin / 0.05) * 0.05
    const roundedMax = Math.ceil(rawMax / 0.05) * 0.05
    return [roundedMin, roundedMax]
  }, [returnValues])
  const selectedReturnLabel = selectedReturnPoint?.exitYear != null && selectedReturnPoint.exitYear > 0
    ? `Year ${selectedReturnPoint.policyYear}`
    : 'Year 0'

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

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Annualized return by exit year</h3>
            <p className="text-sm text-muted-foreground">
              Gross is before the exit charge. Net is after the exit charge. Both are annualized from your current position to each projected exit year.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected exit year</div>
              <div className="mt-1 text-lg font-semibold">{selectedReturnLabel}</div>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
                Gross annualized return
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {selectedReturnPoint?.grossAnnualizedReturn != null
                  ? `${formatIlpPercent(selectedReturnPoint.grossAnnualizedReturn)} p.a.`
                  : 'n/a'}
              </div>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.success }} />
                Net annualized return
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {selectedReturnPoint?.netAnnualizedReturn != null
                  ? `${formatIlpPercent(selectedReturnPoint.netAnnualizedReturn)} p.a.`
                  : 'n/a'}
              </div>
            </div>
          </div>
          <div className="h-72 rounded-md border border-border/80 bg-white/70 p-3 dark:bg-muted/10" role="img" aria-label="Line chart showing gross and net annualized return by exit year">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={returnChartData} margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
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
                  domain={returnDomain}
                  tickFormatter={(value: number) => formatIlpPercent(value)}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const numericValue = typeof value === 'number' ? value : Number(value)
                    if (!Number.isFinite(numericValue)) return ['n/a', name]
                    return [`${formatIlpPercent(numericValue)} p.a.`, name]
                  }}
                  labelFormatter={(_label, payload) => {
                    const point = payload?.[0]?.payload
                    if (!point) return ''
                    return `${point.label} · Gross exit value ${formatIlpCurrency(point.grossExitValue, policy.currency)} · Net value ${formatIlpCurrency(point.netSurrenderValue, policy.currency)}`
                  }}
                />
                <ReferenceLine y={0} stroke={colors.muted} strokeWidth={1.5} />
                {selectedReturnPoint?.exitYear != null && selectedReturnPoint.exitYear > 0 ? (
                  <ReferenceLine x={selectedReturnPoint.label} stroke={colors.muted} strokeDasharray="4 4" />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="grossAnnualizedReturn"
                  name="Gross annualized return"
                  stroke={colors.primary}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="netAnnualizedReturn"
                  name="Net annualized return"
                  stroke={colors.success}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                {selectedReturnPoint?.grossAnnualizedReturn != null ? (
                  <ReferenceDot
                    x={selectedReturnPoint.label}
                    y={selectedReturnPoint.grossAnnualizedReturn}
                    r={5}
                    fill={colors.primary}
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : null}
                {selectedReturnPoint?.netAnnualizedReturn != null ? (
                  <ReferenceDot
                    x={selectedReturnPoint.label}
                    y={selectedReturnPoint.netAnnualizedReturn}
                    r={5}
                    fill={colors.success}
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
