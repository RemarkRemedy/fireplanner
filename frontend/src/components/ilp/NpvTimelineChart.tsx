import { Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useChartColors } from '@/lib/chartTheme'
import type { IlpPolicyAnalysis } from '@/lib/calculations/ilp'
import { formatIlpCurrency } from './formatters'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface NpvTimelineChartProps {
  analyses: IlpPolicyAnalysis[]
}

export function NpvTimelineChart({ analyses }: NpvTimelineChartProps) {
  const colors = useChartColors()

  if (analyses.length === 0) return null

  const uniqueExitYears = Array.from(new Set(
    analyses.flatMap((analysis) => analysis.npvAnalysis.futureExitOptions.map((option) => option.exitYear)),
  )).sort((left, right) => left - right)

  const data = uniqueExitYears.map((exitYear) => {
    const row: Record<string, number> = { exitYear }
    analyses.forEach((analysis) => {
      const option = analysis.npvAnalysis.futureExitOptions.find((entry) => entry.exitYear === exitYear)
      if (option) {
        row[analysis.policyId] = option.totalNpvFees
      }
    })
    return row
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>NPV of Fee Drag by Exit Year</CardTitle>
        <p className="text-sm text-muted-foreground">
          Lower lines indicate less discounted fee drag. Best-exit markers are chosen from pre-MIP rows only.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80" role="img" aria-label="Line chart showing net present value of fee drag by exit year">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="exitYear" label={{ value: 'Exit year', position: 'insideBottom', offset: -4 }} />
              <YAxis
                width={100}
                tickFormatter={(value: number) => {
                  const firstCurrency = analyses[0]?.currency ?? 'SGD'
                  return formatIlpCurrency(value, firstCurrency)
                }}
              />
              <Tooltip
                formatter={(value: number, name: string, item) => {
                  const analysis = analyses.find((entry) => entry.policyId === name)
                  const option = analysis?.npvAnalysis.futureExitOptions.find((entry) => entry.exitYear === item.payload.exitYear)
                  const currency = analysis?.currency ?? 'SGD'
                  return [
                    option
                      ? `${formatIlpCurrency(value, currency)} | Gross ${formatIlpCurrency(option.npvGrossFees, currency)} | Bonuses ${formatIlpCurrency(option.npvBonuses, currency)} | PV EEC ${formatIlpCurrency(option.pvEec, currency)}`
                      : formatIlpCurrency(value, currency),
                    analysis?.policyName ?? name,
                  ]
                }}
              />
              <Legend formatter={(value: string) => analyses.find((analysis) => analysis.policyId === value)?.policyName ?? value} />
              {analyses.length === 1 && (
                <ReferenceLine
                  y={analyses[0].npvAnalysis.surrenderNow.npvFees}
                  stroke={colors.muted}
                  strokeDasharray="4 4"
                  label={{ value: 'Surrender now', position: 'insideTopRight', fontSize: 11 }}
                />
              )}
              {analyses.map((analysis, index) => {
                const bestOption = analysis.npvAnalysis.futureExitOptions.find((option) => option.exitYear === analysis.npvAnalysis.bestExitYear)
                return (
                  <Fragment key={analysis.policyId}>
                    <Line
                      type="monotone"
                      dataKey={analysis.policyId}
                      stroke={colors.strategy[index % colors.strategy.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                    {bestOption && (
                      <ReferenceDot
                        x={bestOption.exitYear}
                        y={bestOption.totalNpvFees}
                        fill={colors.strategy[index % colors.strategy.length]}
                        r={5}
                        stroke="none"
                      />
                    )}
                  </Fragment>
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
