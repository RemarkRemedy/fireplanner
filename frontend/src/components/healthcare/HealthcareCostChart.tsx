import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { useProfileStore } from '@/stores/useProfileStore'
import { formatCurrency } from '@/lib/utils'
import { generateHealthcareProjection } from '@/lib/calculations/healthcare'
import { useIsMobile } from '@/hooks/useIsMobile'

interface ChartDataPoint {
  age: number
  mediShieldLife: number
  isp: number
  careShieldLife: number
  oop: number
  mediSaveCoverage: number
}

export function HealthcareCostChart() {
  const isMobile = useIsMobile()
  const config = useProfileStore((s) => s.healthcareConfig)
  const currentAge = useProfileStore((s) => s.currentAge)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const lifeExpectancy = useProfileStore((s) => s.lifeExpectancy)

  const chartData = useMemo(() => {
    if (!config.enabled) return []

    const projection = generateHealthcareProjection(config, currentAge, lifeExpectancy)
    return projection.rows.map((row): ChartDataPoint => ({
      age: row.age,
      mediShieldLife: row.mediShieldLifePremium,
      isp: row.ispAdditionalPremium,
      careShieldLife: row.careShieldLifePremium,
      oop: row.oopExpense,
      mediSaveCoverage: row.mediSaveDeductible,
    }))
  }, [config, currentAge, lifeExpectancy])

  if (chartData.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Healthcare Cost Composition
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 md:h-72" role="img" aria-label="Stacked area chart showing healthcare cost breakdown by age">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="age"
                label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v)}
                width={80}
              />
              <Tooltip
                trigger={isMobile ? 'click' : undefined}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name,
                ]}
              />
              <Area
                type="monotone"
                dataKey="mediShieldLife"
                name="MediShield Life"
                stackId="cost"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="isp"
                name="Shield Plan Additional"
                stackId="cost"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="careShieldLife"
                name="CareShield LIFE"
                stackId="cost"
                stroke="#06b6d4"
                fill="#06b6d4"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="oop"
                name="Out-of-Pocket"
                stackId="cost"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="mediSaveCoverage"
                name="MediSave Coverage"
                stackId=""
                stroke="#16a34a"
                fill="none"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
              <ReferenceLine
                x={retirementAge}
                stroke="#ea580c"
                strokeDasharray="3 3"
                label={{ value: 'Retire', position: 'top', fill: '#ea580c' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Stacked: premiums + out-of-pocket. Dashed green line: MediSave-deductible portion. Gap above green = cash outlay.
        </p>
      </CardContent>
    </Card>
  )
}
