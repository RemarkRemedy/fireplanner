import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { useChartColors } from '@/lib/chartTheme'
import { IllustrationOnlyChartFrame } from './IllustrationOnlyChartFrame'
import { ILP_HORIZONTAL_BAR_RADIUS } from './chartBarRadii'
import { formatIlpCurrency } from './formatters'

interface FeeWaterfallChartProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function FeeWaterfallChart({ policy, analysis }: FeeWaterfallChartProps) {
  const colors = useChartColors()
  const data = [
    { label: 'Premiums to horizon', value: analysis.summary.totalPremiumsPaid, fill: colors.primary },
    { label: 'Gross fees', value: analysis.summary.totalFeesCharged, fill: colors.danger },
    { label: 'Bonus credits', value: analysis.summary.totalBonusesReceived, fill: colors.success },
    { label: 'Projected value at horizon end', value: analysis.npvAnalysis.holdToMip.finalValue, fill: colors.warning },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Drag Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">
          Premiums, gross fees, bonus credits, and projected value at the analysis horizon. Projected value also reflects fund returns, so this is a scale comparison rather than a balancing equation.
        </p>
      </CardHeader>
      <CardContent>
        <IllustrationOnlyChartFrame
          className="h-72"
          ariaLabel="Bar chart comparing premiums, fees, bonuses, and projected value at the analysis horizon"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)}
              />
              <YAxis type="category" dataKey="label" width={160} />
              <Tooltip
                formatter={(value: number) => formatIlpCurrency(value, policy.currency)}
              />
              <Bar dataKey="value" radius={ILP_HORIZONTAL_BAR_RADIUS}>
                {data.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </IllustrationOnlyChartFrame>
      </CardContent>
    </Card>
  )
}
