import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { DeterministicComparisonResult } from '@/lib/calculations/withdrawal'
import type { WithdrawalStrategyType } from '@/lib/types'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { getStrategyLabel } from '@/hooks/useWithdrawalComparison'
import { formatCurrency } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

const STRATEGY_COLORS: Record<string, string> = {
  constant_dollar: '#2563eb',
  vpw: '#16a34a',
  guardrails: '#ea580c',
  vanguard_dynamic: '#9333ea',
  cape_based: '#dc2626',
  floor_ceiling: '#0891b2',
  percent_of_portfolio: '#d97706',
  one_over_n: '#059669',
  sensible_withdrawals: '#7c3aed',
  ninety_five_percent: '#be185d',
  endowment: '#0d9488',
  hebeler_autopilot: '#6366f1',
}

interface WithdrawalChartProps {
  results: DeterministicComparisonResult
}

export function WithdrawalChart({ results }: WithdrawalChartProps) {
  const isMobile = useIsMobile()
  const household = useHouseholdStore()
  const profile = useProfileStore()
  const isHouseholdMode = household.householdMode && household.persons.length > 0

  const strategies = Object.keys(results.yearResults) as WithdrawalStrategyType[]
  if (strategies.length === 0) return null

  // Build chart data: one row per year with withdrawal for each strategy
  const firstStrategy = strategies[0]
  const years = results.yearResults[firstStrategy]

  const data = useMemo(() => {
    if (!isHouseholdMode) {
      return years.map((yr, i) => {
        const row: Record<string, number> = { age: yr.age }
        for (const s of strategies) {
          row[s] = results.yearResults[s][i]?.withdrawal ?? 0
        }
        return row
      })
    }

    // In household mode, show calendar years
    const currentYear = new Date().getFullYear()
    const yearsToRetirement = Math.max(0, profile.retirementAge - profile.currentAge)

    return years.map((yr, i) => {
      const row: Record<string, number> = {
        age: yr.age,
        displayYear: currentYear + yearsToRetirement + i,
      }
      for (const s of strategies) {
        row[s] = results.yearResults[s][i]?.withdrawal ?? 0
      }
      return row
    })
  }, [years, strategies, results, isHouseholdMode, profile])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Annual Withdrawal by Strategy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 md:h-72 lg:h-[350px]" role="img" aria-label="Line chart comparing annual withdrawal amounts across strategies">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={isHouseholdMode ? 'displayYear' : 'age'}
              label={{ value: isHouseholdMode ? 'Year' : 'Age', position: 'insideBottom', offset: -5 }}
            />
            <YAxis tickFormatter={(v: number) => formatCurrency(v)} width={90} />
            <Tooltip trigger={isMobile ? 'click' : undefined} formatter={(value: number) => formatCurrency(value)} />
            <Legend formatter={(value: string) => getStrategyLabel(value as WithdrawalStrategyType)} />
            {strategies.map((s) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={STRATEGY_COLORS[s] ?? '#666'}
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
