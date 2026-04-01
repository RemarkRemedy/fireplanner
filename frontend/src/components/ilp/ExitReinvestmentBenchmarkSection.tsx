import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PercentInput } from '@/components/shared/PercentInput'
import { useChartColors } from '@/lib/chartTheme'
import type { IlpProjectedPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { formatIlpCurrency, formatIlpPercent } from './formatters'
import {
  buildExitReinvestmentBenchmark,
  buildExitReinvestmentPath,
  buildIlpScenarioAnalyses,
  computeBlendedOcf,
  EXIT_BENCHMARK_RATES,
  type ExitBenchmarkRateKey,
} from './exitReinvestmentBenchmark'

interface ExitReinvestmentBenchmarkSectionProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function ExitReinvestmentBenchmarkSection({
  policy,
  analysis,
}: ExitReinvestmentBenchmarkSectionProps) {
  const colors = useChartColors()
  const [outsideRateKey, setOutsideRateKey] = useState<ExitBenchmarkRateKey>('4')
  const [ilpRateKey, setIlpRateKey] = useState<ExitBenchmarkRateKey>('8')
  const [showAssumptionFees, setShowAssumptionFees] = useState(false)
  const [ilpOcf, setIlpOcf] = useState(() => computeBlendedOcf(policy))
  const [externalTer, setExternalTer] = useState(0)

  const scenarioAnalyses = useMemo(() => buildIlpScenarioAnalyses(policy, ilpOcf), [ilpOcf, policy])
  const scenarioAnalysis = scenarioAnalyses[ilpRateKey] ?? analysis

  const benchmark = useMemo(
    () => buildExitReinvestmentBenchmark(policy, scenarioAnalysis, externalTer),
    [externalTer, policy, scenarioAnalysis],
  )

  const defaultExitYear = useMemo(() => {
    const firstPenaltyFree = benchmark.options.find((option) => option.exitYear > 0 && option.isPenaltyFree)
    return String(firstPenaltyFree?.exitYear ?? analysis.npvAnalysis.bestExitYear)
  }, [benchmark.options, scenarioAnalysis.npvAnalysis.bestExitYear])

  const [selectedExitYear, setSelectedExitYear] = useState(defaultExitYear)

  const outsideNetReturn = Math.max((Number(outsideRateKey) / 100) - externalTer, -0.99)
  const selectedOption = benchmark.options.find((option) => String(option.exitYear) === selectedExitYear) ?? benchmark.options[0]
  const neverEnterOption = benchmark.options.find((option) => option.exitYear === 0) ?? benchmark.options[0]

  const selectedHorizonValue = selectedOption?.horizonValues[outsideRateKey] ?? 0
  const neverEnterHorizonValue = neverEnterOption?.horizonValues[outsideRateKey] ?? 0

  const horizonBarData = benchmark.options.map((option) => ({
    exitYear: option.exitYear,
    policyYear: option.policyYear,
    label: option.exitYear === 0 ? 'Never enter' : `Year ${option.policyYear}`,
    horizonValue: option.horizonValues[outsideRateKey],
  }))

  const pathData = selectedOption
    ? buildExitReinvestmentPath(scenarioAnalysis, selectedOption.exitYear, selectedOption.netExitValue, outsideNetReturn)
    : []

  const exitPathSeries = useMemo(() => {
    const visibleOptions = benchmark.options.filter((option) => option.exitYear === 0 || option.exitYear > 0 || String(option.exitYear) === selectedExitYear)

    return visibleOptions.map((option) => ({
      option,
      dataKey: `exitPath_${option.exitYear}`,
      points: buildExitReinvestmentPath(scenarioAnalysis, option.exitYear, option.netExitValue, outsideNetReturn),
    }))
  }, [benchmark.options, outsideNetReturn, scenarioAnalysis, selectedExitYear])

  const combinedPathData = useMemo(() => {
    const rows = pathData.map((point) => ({
      year: point.year,
      policyYear: point.policyYear,
      holdIlpValue: point.holdIlpValue,
    }))

    for (const series of exitPathSeries) {
      series.points.forEach((point, index) => {
        rows[index] = {
          ...rows[index],
          [series.dataKey]: point.selectedPathValue,
        }
      })
    }

    return rows
  }, [exitPathSeries, pathData])

  const horizonValueDomain = useMemo<[number, number]>(() => {
    const values = [
      benchmark.holdValueAtHorizon,
      ...horizonBarData.map((entry) => entry.horizonValue),
      ...pathData.map((entry) => entry.holdIlpValue),
      ...exitPathSeries.flatMap((series) => series.points.map((point) => point.selectedPathValue)),
    ]
    const maxValue = Math.max(...values, 0)
    const roundedMax = Math.ceil((maxValue * 1.08) / 1000) * 1000
    return [0, Math.max(roundedMax, 1000)]
  }, [benchmark.holdValueAtHorizon, exitPathSeries, horizonBarData, pathData])

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle>If you exit and invest outside instead</CardTitle>
            <p className="max-w-3xl text-sm text-muted-foreground">
              The charts below compare three real choices: never enter the ILP at all, enter first and exit in a chosen year, or keep the ILP all the way to year {benchmark.horizonYear}. The ILP path uses the selected gross-return assumption, and the outside path uses the selected gross benchmark return less any TER you include.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">ILP gross return assumption</div>
              <Tabs value={ilpRateKey} onValueChange={(value) => setIlpRateKey(value as ExitBenchmarkRateKey)}>
                <TabsList aria-label="ILP gross return assumption">
                  {EXIT_BENCHMARK_RATES.map((rate) => (
                    <TabsTrigger key={rate} value={String(rate)}>
                      {rate}%
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Outside return assumption</div>
              <Tabs value={outsideRateKey} onValueChange={(value) => setOutsideRateKey(value as ExitBenchmarkRateKey)}>
                <TabsList aria-label="Outside return assumption">
                  {EXIT_BENCHMARK_RATES.map((rate) => (
                    <TabsTrigger key={rate} value={String(rate)}>
                      {rate}%
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="w-full sm:w-56">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected exit year</div>
              <Select value={selectedExitYear} onValueChange={setSelectedExitYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {benchmark.options.map((option) => (
                    <SelectItem key={option.exitYear} value={String(option.exitYear)}>
                      {option.exitYear === 0 ? 'Never enter ILP' : `Year ${option.policyYear}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              className="self-start text-xs font-medium text-muted-foreground underline underline-offset-4 transition hover:text-foreground sm:self-end"
              onClick={() => setShowAssumptionFees((value) => !value)}
            >
              {showAssumptionFees ? 'Hide assumption fees' : 'Adjust OCF / TER'}
            </button>
          </div>
        </div>

        {showAssumptionFees && (
          <div className="grid gap-4 rounded-lg border border-border/70 bg-muted/10 p-4 md:grid-cols-2">
            <PercentInput
              label="ILP blended OCF"
              value={ilpOcf}
              onChange={setIlpOcf}
              step={0.1}
              tooltip="This scales the policy funds proportionally so the blended ILP fund fee matches your chosen OCF."
            />
            <PercentInput
              label="External TER"
              value={externalTer}
              onChange={setExternalTer}
              step={0.1}
              tooltip="Annual fund fee for the outside portfolio. This is deducted from the selected outside gross return."
            />
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Never enter ILP</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatIlpCurrency(neverEnterHorizonValue, policy.currency)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Invest the same planned contributions outside from the start at {outsideRateKey}% gross, about {formatIlpPercent(outsideNetReturn)} net after TER.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected exit</div>
            <div className="mt-1 text-lg font-semibold">
              {selectedOption?.exitYear === 0 ? 'Never enter' : `Year ${selectedOption?.policyYear ?? 'n/a'}`}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedOption?.exitYear === 0
                ? `Start outside with no ILP lock-in.`
                : `Net exit value ${formatIlpCurrency(selectedOption?.netExitValue ?? 0, policy.currency)} under the ${ilpRateKey}% gross ILP case.`}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Outside by year {benchmark.horizonYear}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatIlpCurrency(selectedHorizonValue, policy.currency)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              With the {outsideRateKey}% gross outside assumption, about {formatIlpPercent(outsideNetReturn)} net after TER.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Keep ILP to year {benchmark.horizonYear}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatIlpCurrency(benchmark.holdValueAtHorizon, policy.currency)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Using the {ilpRateKey}% gross ILP assumption, about {formatIlpPercent((Number(ilpRateKey) / 100) - ilpOcf)} net before other policy effects. Difference {formatIlpCurrency(selectedHorizonValue - benchmark.holdValueAtHorizon, policy.currency)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className=”space-y-8”>
        <div className=”space-y-3”>
          <div>
            <p className=”text-sm font-semibold”>Horizon value for every exit option</p>
            <p className=”text-sm text-muted-foreground”>
              The first bar is the clean “never enter ILP” baseline. The rest show what the portfolio could be worth by year {benchmark.horizonYear} if you entered the ILP under the {ilpRateKey}% gross case, then exited in that year and invested outside at {outsideRateKey}% gross less TER. Click a bar to inspect that path below.
            </p>
          </div>
          <div className="h-80 rounded-lg border border-border/60 p-4" role="img" aria-label="Bar chart showing horizon value for each exit year">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={horizonBarData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  width={90}
                  domain={horizonValueDomain}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)}
                />
                <Tooltip
                  labelFormatter={(_value, payload) => {
                    const point = payload?.[0]?.payload
                    return point ? `Exit in Year ${point.policyYear}` : ''
                  }}
                  formatter={(value: number) => [formatIlpCurrency(value, policy.currency), `Value by year ${benchmark.horizonYear}`]}
                />
                <ReferenceLine
                  y={benchmark.holdValueAtHorizon}
                  stroke={colors.primary}
                  strokeDasharray="6 6"
                  ifOverflow="extendDomain"
                  label={{ value: `Keep ILP ${formatIlpCurrency(benchmark.holdValueAtHorizon, policy.currency)}`, position: 'insideTopRight' }}
                />
                <Bar dataKey="horizonValue" onClick={(point) => setSelectedExitYear(String(point?.exitYear))}>
                  {horizonBarData.map((entry) => (
                    <Cell
                      key={entry.exitYear}
                      fill={String(entry.exitYear) === selectedExitYear ? colors.success : 'rgba(16, 185, 129, 0.4)'}
                      className="cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Path after the selected exit year</p>
            <p className="text-sm text-muted-foreground">
              The purple line keeps the ILP all the way to year {benchmark.horizonYear} under the {ilpRateKey}% gross ILP assumption. One faint line shows the never-enter path, and the other faint lines show exit-and-invest alternatives at {outsideRateKey}% gross outside return less TER. The highlighted teal line is the currently selected path.
            </p>
          </div>
          <div className="h-72 rounded-lg border border-border/60 p-4" role="img" aria-label="Line chart showing ILP hold value and selected exit-and-invest-outside path">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedPathData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="policyYear" tickLine={false} axisLine={false} />
                <YAxis
                  width={90}
                  domain={horizonValueDomain}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)}
                />
                <Tooltip
                  labelFormatter={(value: number) => `Year ${value}`}
                  formatter={(value: number, name: string) => [
                    formatIlpCurrency(value, policy.currency),
                    name === 'holdIlpValue'
                      ? 'Keep ILP'
                      : name === 'exitPath_0'
                        ? 'Never enter ILP'
                        : `Exit in Year ${selectedOption?.policyYear ?? 'n/a'}`,
                  ]}
                />
                <Line type="monotone" dataKey="holdIlpValue" stroke={colors.primary} strokeWidth={3} dot={false} />
                {exitPathSeries.map((series) => {
                  const isSelected = String(series.option.exitYear) === selectedExitYear
                  const isNeverEnter = series.option.exitYear === 0
                  const showInTooltip = isSelected || isNeverEnter
                  return (
                    <Line
                      key={series.dataKey}
                      type="monotone"
                      dataKey={series.dataKey}
                      stroke={isNeverEnter ? colors.warning : colors.success}
                      strokeOpacity={isSelected ? 1 : isNeverEnter ? 0.55 : 0.18}
                      strokeWidth={isSelected ? 3.5 : isNeverEnter ? 2 : 1.5}
                      strokeDasharray={isNeverEnter && !isSelected ? '6 4' : undefined}
                      dot={false}
                      tooltipType={showInTooltip ? undefined : 'none'}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
