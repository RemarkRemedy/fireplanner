import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProfileStore } from '@/stores/useProfileStore'
import { formatCurrency } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

const PRIORITY_FILL: Record<string, string> = {
  essential: '#3b82f6',    // blue
  important: '#f59e0b',    // amber
  'nice-to-have': '#9ca3af', // gray
}

interface ChartDataPoint {
  age: number
  amount: number
  label: string
  priority: string
  category: string
}

export function GoalTimelineChart() {
  const isMobile = useIsMobile()
  const goals = useProfileStore((s) => s.financialGoals)
  const retirementAge = useProfileStore((s) => s.retirementAge)

  const data = useMemo(() => {
    if (goals.length === 0) return []

    // Aggregate goal amounts by age (a goal spanning multiple years creates multiple bars)
    const byAge = new Map<number, ChartDataPoint>()

    for (const goal of goals) {
      for (let y = 0; y < goal.durationYears; y++) {
        const age = goal.targetAge + y
        const yearlyAmount = goal.amount / goal.durationYears
        const existing = byAge.get(age)
        if (existing) {
          existing.amount += yearlyAmount
          existing.label = `${existing.label}, ${goal.label}`
        } else {
          byAge.set(age, {
            age,
            amount: yearlyAmount,
            label: goal.label,
            priority: goal.priority,
            category: goal.category,
          })
        }
      }
    }

    return Array.from(byAge.values()).sort((a, b) => a.age - b.age)
  }, [goals])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Goal Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 md:h-56" role="img" aria-label="Bar chart showing financial goals by age">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="age"
                label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v)}
                width={80}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                trigger={isMobile ? 'click' : undefined}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const row = payload[0]?.payload as ChartDataPoint | undefined
                  if (!row) return null
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="font-medium">Age {row.age}</p>
                      <p>{row.label}</p>
                      <p className="font-mono">{formatCurrency(row.amount)}/yr</p>
                      <p className="text-muted-foreground capitalize">{row.priority}</p>
                    </div>
                  )
                }}
              />
              <ReferenceLine
                x={retirementAge}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: 'Retirement', position: 'top', fontSize: 11, fill: '#ef4444' }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={PRIORITY_FILL[entry.priority] ?? PRIORITY_FILL['nice-to-have']} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: PRIORITY_FILL.essential }} /> Essential
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: PRIORITY_FILL.important }} /> Important
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: PRIORITY_FILL['nice-to-have'] }} /> Nice-to-have
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
