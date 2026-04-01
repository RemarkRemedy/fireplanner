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
import { useChartColors } from '@/lib/chartTheme'
import type { IlpProjectedPolicyAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { formatIlpCurrency } from './formatters'
import { buildExitReinvestmentBenchmark, buildExitReinvestmentPath } from './exitReinvestmentBenchmark'

interface ExitReinvestmentBenchmarkSectionProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

type BenchmarkRateKey = '4' | '7'

export function ExitReinvestmentBenchmarkSection({
  policy,
  analysis,
}: ExitReinvestmentBenchmarkSectionProps) {
  const colors = useChartColors()
  const [rateKey, setRateKey] = useState<BenchmarkRateKey>('4')

  const benchmark = useMemo(
    () => buildExitReinvestmentBenchmark(policy, analysis),
    [policy, analysis],
  )

  const defaultExitYear = useMemo(() => {
    const firstPenaltyFree = benchmark.options.find((option) => option.exitYear > 0 && option.isPenaltyFree)
    return String(firstPenaltyFree?.exitYear ?? analysis.npvAnalysis.bestExitYear)
  }, [analysis.npvAnalysis.bestExitYear, benchmark.options])

  const [selectedExitYear, setSelectedExitYear] = useState(defaultExitYear)

  const annualReturn = rateKey === '4' ? 0.04 : 0.07
  const selectedOption = benchmark.options.find((option) => String(option.exitYear) === selectedExitYear) ?? benchmark.options[0]

  const selectedHorizonValue = rateKey === '4'
    ? (selectedOption?.horizonValueAt4 ?? 0)
    : (selectedOption?.horizonValueAt7 ?? 0)

  const horizonBarData = benchmark.options.map((option) => ({
    exitYear: option.exitYear,
    policyYear: option.policyYear,
    label: `Year ${option.policyYear}`,
    horizonValue: rateKey === '4' ? option.horizonValueAt4 : option.horizonValueAt7,
  }))

  const pathData = selectedOption
    ? buildExitReinvestmentPath(analysis, selectedOption.exitYear, selectedOption.netExitValue, annualReturn)
    : []

  const horizonValueDomain = useMemo<[number, number]>(() => {
    const values = [
      benchmark.holdValueAtHorizon,
      ...horizonBarData.map((entry) => entry.horizonValue),
      ...pathData.flatMap((entry) => [entry.holdIlpValue, entry.selectedPathValue]),
    ]
    const maxValue = Math.max(...values, 0)
    const roundedMax = Math.ceil((maxValue * 1.08) / 1000) * 1000
    return [0, Math.max(roundedMax, 1000)]
  }, [benchmark.holdValueAtHorizon, horizonBarData, pathData])

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle>If you exit and invest outside instead</CardTitle>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Pick an exit year, take the net surrender value at that point, and assume the remaining planned contributions are invested outside the ILP instead. The charts below show the resulting value at year {benchmark.horizonYear}.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Outside return assumption</div>
              <Tabs value={rateKey} onValueChange={(value) => setRateKey(value as BenchmarkRateKey)}>
                <TabsList>
                  <TabsTrigger value="4">4% nominal</TabsTrigger>
                  <TabsTrigger value="7">7% nominal</TabsTrigger>
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
                      Year {option.policyYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected exit</div>
            <div className="mt-1 text-lg font-semibold">Year {selectedOption?.policyYear ?? 'n/a'}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Net exit value {formatIlpCurrency(selectedOption?.netExitValue ?? 0, policy.currency)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Outside by year {benchmark.horizonYear}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatIlpCurrency(selectedHorizonValue, policy.currency)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              With the {rateKey}% nominal assumption and remaining planned contributions invested outside.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Keep ILP to year {benchmark.horizonYear}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatIlpCurrency(benchmark.holdValueAtHorizon, policy.currency)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Difference {formatIlpCurrency(selectedHorizonValue - benchmark.holdValueAtHorizon, policy.currency)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Path after the selected exit year</h3>
            <p className="text-sm text-muted-foreground">
              The purple line keeps the ILP all the way to year {benchmark.horizonYear}. The teal line follows the selected strategy: stay in the ILP until the chosen exit year, then move outside and invest the rest at {rateKey}% nominal.
            </p>
          </div>
          <div className="h-72 rounded-lg border border-border/60 p-4" role="img" aria-label="Line chart showing ILP hold value and selected exit-and-invest-outside path">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pathData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
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
                    name === 'selectedPathValue' ? 'Exit and invest outside' : 'Keep ILP',
                  ]}
                />
                <Line type="monotone" dataKey="holdIlpValue" stroke={colors.primary} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="selectedPathValue" stroke={colors.success} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Horizon value for every exit option</h3>
            <p className="text-sm text-muted-foreground">
              Each bar shows what the portfolio could be worth by year {benchmark.horizonYear} if you exited in that year and invested outside at {rateKey}% nominal. Click a bar to inspect that path above.
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
      </CardContent>
    </Card>
  )
}
