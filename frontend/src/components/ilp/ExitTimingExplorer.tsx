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
  Rectangle,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { ChartTooltipContent } from './ChartTooltip'
import { IllustrationOnlyChartFrame } from './IllustrationOnlyChartFrame'
import { ILP_VERTICAL_BAR_RADIUS, ILP_VERTICAL_NEGATIVE_BAR_RADIUS } from './chartBarRadii'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface ExitTimingExplorerProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  useReal?: boolean
}

function renderVerticalBarShape(
  props: any,
  radius: [number, number, number, number],
) {
  const normalizedHeight = Math.abs(props.height ?? 0)
  const normalizedY = (props.height ?? 0) < 0 ? (props.y ?? 0) + (props.height ?? 0) : props.y

  return (
    <Rectangle
      {...props}
      y={normalizedY}
      height={normalizedHeight}
      radius={radius}
    />
  )
}

export function ExitTimingExplorer({ policy, analysis, useReal = false }: ExitTimingExplorerProps) {
  const colors = useChartColors()
  const belowContributionColor = 'rgb(100 116 139)'
  const belowContributionMutedColor = 'rgba(100, 116, 139, 0.38)'
  const horizonYear = analysis.projections.mid.rows.at(-1)?.policyYear ?? analysis.npvAnalysis.bestExitYear
  const paidSoFarEstimate = (policy.initialSinglePremium ?? 0) + (policy.monthlyContribution * policy.monthsAlreadyPaid)
  const discountMoney = (value: number, year: number) => useReal ? value / Math.pow(1 + policy.inflationRate, year) : value
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

  const selectExitYear = (exitYear: number | string | null | undefined) => {
    if (exitYear == null) return
    setSelectedExitYear(String(exitYear))
  }

  const selectedOption = useMemo(
    () => exitOptions.find((option) => String(option.exitYear) === selectedExitYear) ?? exitOptions[0],
    [exitOptions, selectedExitYear],
  )

  if (!selectedOption) return null

  const chartData = useMemo(
    () => exitOptions.map((option) => {
      const addedFromNowToExit = analysis.projections.mid.rows
        .filter((row) => row.year <= option.exitYear)
        .reduce((sum, row) => sum + discountMoney(row.annualContribution, row.year), 0)
      let etfAlternativeValue = analysis.summary.currentSurrenderValue * Math.pow(1 + policy.alternativeReturn, option.exitYear)
      for (const row of analysis.projections.mid.rows.filter((row) => row.year <= option.exitYear)) {
        etfAlternativeValue += row.annualContribution * Math.pow(1 + policy.alternativeReturn, option.exitYear - row.year)
      }
      const withdrawableValue = discountMoney(option.netSurrenderValue, option.exitYear)
      const eecCharge = discountMoney(option.eecCharge, option.exitYear)
      const benchmarkValue = discountMoney(etfAlternativeValue, option.exitYear)

      return {
        exitYear: option.exitYear,
        policyYear: option.policyYear,
        label: `Year ${option.policyYear}`,
        netGap: withdrawableValue - addedFromNowToExit,
        addedFromNowToExit,
        netSurrenderValue: withdrawableValue,
        eecCharge,
        etfAlternativeValue: benchmarkValue,
      }
    }),
    [analysis.projections.mid.rows, analysis.summary.currentSurrenderValue, discountMoney, exitOptions, policy.alternativeReturn],
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
  const holdChartPoint = chartData.find((entry) => entry.exitYear === horizonYear) ?? chartData.at(-1) ?? null
  const selectedProjectedChartPoint =
    projectedChartData.find((entry) => String(entry.exitYear) === selectedExitYear) ?? projectedChartData.at(-1) ?? null
  const addedContributionsUntilExit = selectedChartPoint?.addedFromNowToExit ?? 0
  const contributionsAvoidedVsHold = Math.max(0, (holdChartPoint?.addedFromNowToExit ?? 0) - addedContributionsUntilExit)
  const valueVsAddedContributions = (selectedChartPoint?.netSurrenderValue ?? 0) - addedContributionsUntilExit

  const handleComparisonChartClick = (state?: {
    activePayload?: Array<{ payload?: { exitYear?: number } }>
  }) => {
    const exitYear = state?.activePayload?.[0]?.payload?.exitYear
    selectExitYear(exitYear)
  }

  const metricCardClassName = 'rounded-md border border-border/80 bg-background px-4 py-3 shadow-sm'
  const chartPanelClassName = 'rounded-md border border-border/80 bg-background p-4 shadow-sm'

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
          <p className="mt-1 text-xs text-muted-foreground">
            Values shown here are in {useReal ? "today's dollars" : 'nominal dollars'}.
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
            <p className="text-sm font-semibold">Net gap by exit year</p>
            <p className="text-sm text-muted-foreground">
              Positive bars mean the exit value is higher than the additional contributions you would make from now to that year.
            </p>
          </div>
          <IllustrationOnlyChartFrame
            className={chartPanelClassName}
            ariaLabel="Bar chart showing net gap by exit year"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div className="text-sm text-muted-foreground">
                Year{' '}
                <span className="font-semibold text-foreground">
                  {selectedChartPoint != null ? selectedChartPoint.policyYear : 'n/a'}
                </span>{' '}
                is currently selected.
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.success }} />
                  Above added contributions
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: belowContributionColor }} />
                  Below added contributions
                </span>
              </div>
            </div>
            <div className="h-64">
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
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload
                    if (!point) return null
                    return (
                      <ChartTooltipContent
                        active={active}
                        label={point.label}
                        rows={[
                          { label: 'Withdrawable value', value: formatIlpCurrency(point.netSurrenderValue, policy.currency), bold: true },
                          { label: 'Added from now', value: formatIlpCurrency(point.addedFromNowToExit, policy.currency) },
                          { label: 'Net gap', value: formatIlpCurrency(point.netGap, policy.currency), bold: true },
                          { label: 'Early-exit charge', value: formatIlpCurrency(point.eecCharge, policy.currency) },
                        ]}
                      />
                    )
                  }}
                />
                <Bar
                  dataKey="netGap"
                  shape={(props: any) => renderVerticalBarShape(
                    props,
                    props.payload?.netGap >= 0 ? ILP_VERTICAL_BAR_RADIUS : ILP_VERTICAL_NEGATIVE_BAR_RADIUS,
                  )}
                  onClick={(point) => {
                    selectExitYear(point?.exitYear)
                  }}
                >
                  {chartData.map((entry) => {
                    const selected = String(entry.exitYear) === selectedExitYear
                    const positive = entry.netGap >= 0
                    const fill = selected
                      ? (positive ? colors.success : belowContributionColor)
                      : (positive ? 'rgba(34, 197, 94, 0.45)' : belowContributionMutedColor)
                    return (
                      <Cell
                        key={entry.exitYear}
                        fill={fill}
                        className="cursor-pointer"
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </IllustrationOnlyChartFrame>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Withdrawable value vs added from now vs ETF benchmark</p>
            <p className="text-sm text-muted-foreground">
              Compare how much you could withdraw, how much more you would still add from today, and what the same money could look like in a low-cost ETF benchmark.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ETF benchmark uses the current alternative-return assumption of {formatIlpPercent(policy.alternativeReturn)} a year. It is illustrative, not a guarantee.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className={metricCardClassName}>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected exit year</div>
              <div className="mt-1 text-lg font-semibold">
                {selectedChartPoint != null ? `Year ${selectedChartPoint.policyYear}` : 'n/a'}
              </div>
            </div>
            <div className={metricCardClassName}>
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
            <div className={metricCardClassName}>
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
            <div className={metricCardClassName}>
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
          <IllustrationOnlyChartFrame
            className={chartPanelClassName}
            ariaLabel="Line chart showing withdrawable value, added contributions, and ETF benchmark by exit year"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Selected year: {selectedProjectedChartPoint != null ? `Year ${selectedProjectedChartPoint.policyYear}` : 'n/a'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Click a year on the chart to update the cards below.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.success }} />
                  Withdrawable value
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
                  Added from now
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                  ETF benchmark
                </span>
              </div>
            </div>
            <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={projectedChartData}
                margin={{ top: 12, right: 20, bottom: 8, left: 8 }}
                onClick={handleComparisonChartClick}
              >
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
                  cursor={{ stroke: colors.muted, strokeDasharray: '4 4' }}
                  content={({ active, payload, label: tooltipLabel }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0]?.payload
                    const rows = payload
                      .filter((entry) => entry.value != null && Number.isFinite(Number(entry.value)))
                      .map((entry) => ({
                        label: String(entry.name ?? entry.dataKey ?? ''),
                        value: formatIlpCurrency(Number(entry.value), policy.currency),
                        color: String(entry.color),
                      }))
                    return <ChartTooltipContent active={active} label={point?.label ?? tooltipLabel} rows={rows} />
                  }}
                />
                {selectedProjectedChartPoint?.exitYear != null ? (
                  <ReferenceLine x={selectedProjectedChartPoint.label} stroke={colors.muted} strokeDasharray="4 4" />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="netSurrenderValue"
                  name="Withdrawable value"
                  stroke={colors.success}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="addedFromNowToExit"
                  name="Added from now"
                  stroke={colors.primary}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="etfAlternativeValue"
                  name="ETF benchmark"
                  stroke={colors.warning}
                  strokeWidth={3}
                  strokeDasharray="7 5"
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                {selectedProjectedChartPoint?.exitYear != null ? (
                  <ReferenceDot
                    x={selectedProjectedChartPoint.label}
                    y={selectedProjectedChartPoint.netSurrenderValue}
                    r={6}
                    fill={colors.success}
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : null}
                {selectedProjectedChartPoint?.exitYear != null ? (
                  <ReferenceDot
                    x={selectedProjectedChartPoint.label}
                    y={selectedProjectedChartPoint.addedFromNowToExit}
                    r={6}
                    fill={colors.primary}
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : null}
                {selectedProjectedChartPoint?.exitYear != null ? (
                  <ReferenceDot
                    x={selectedProjectedChartPoint.label}
                    y={selectedProjectedChartPoint.etfAlternativeValue}
                    r={6}
                    fill={colors.warning}
                    stroke="white"
                    strokeWidth={2}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
            </div>
          </IllustrationOnlyChartFrame>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border p-4">
            <div className="text-sm text-muted-foreground">Value available at exit</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatIlpCurrency(selectedChartPoint?.netSurrenderValue ?? 0, policy.currency)}
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
              {formatIlpCurrency(selectedChartPoint?.eecCharge ?? 0, policy.currency)}
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
