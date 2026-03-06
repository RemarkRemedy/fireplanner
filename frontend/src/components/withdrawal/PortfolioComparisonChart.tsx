import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { DeterministicComparisonResult } from '@/lib/calculations/withdrawal'
import type { WithdrawalStrategyType } from '@/lib/types'
import { getStrategyLabel } from '@/hooks/useWithdrawalComparison'
import { formatCurrency } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { WITHDRAWAL_STRATEGY_COLORS } from '@/lib/chartTheme'

interface PortfolioComparisonChartProps {
  results: DeterministicComparisonResult
}

export function PortfolioComparisonChart({ results }: PortfolioComparisonChartProps) {
  const isMobile = useIsMobile()
  const strategies = Object.keys(results.yearResults) as WithdrawalStrategyType[]
  if (strategies.length === 0) return null

  const firstStrategy = strategies[0]
  const years = results.yearResults[firstStrategy]
  const data = years.map((yr, i) => {
    const row: Record<string, number> = { age: yr.age }
    for (const s of strategies) {
      row[s] = results.yearResults[s][i]?.portfolio ?? 0
    }
    return row
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Balance Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 md:h-72 lg:h-[350px]" role="img" aria-label="Line chart comparing portfolio balance across withdrawal strategies">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottom', offset: -5 }} />
            <YAxis tickFormatter={(v: number) => formatCurrency(v)} width={90} />
            <Tooltip trigger={isMobile ? 'click' : undefined} formatter={(value: number) => formatCurrency(value)} />
            <Legend formatter={(value: string) => getStrategyLabel(value as WithdrawalStrategyType)} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" label="Ran out" />
            {strategies.map((s) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={WITHDRAWAL_STRATEGY_COLORS[s] ?? '#666'}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
