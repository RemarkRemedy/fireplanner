import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PercentileBands } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

interface WithdrawalDistributionChartProps {
  bands: PercentileBands
}

export function WithdrawalDistributionChart({ bands }: WithdrawalDistributionChartProps) {
  const isMobile = useIsMobile()

  if (bands.ages.length === 0) {
    return null
  }

  const data = bands.ages.map((age, index) => ({
    age,
    p10: bands.p10[index],
    p50: bands.p50[index],
    p90: bands.p90[index],
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawal Distribution (p10 / p50 / p90)</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="h-56 md:h-64 lg:h-[300px]"
          role="img"
          aria-label="Line chart showing withdrawal distribution percentiles over age"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="age" />
              <YAxis tickFormatter={(value: number) => formatCurrency(value)} width={90} />
              <Tooltip
                trigger={isMobile ? 'click' : undefined}
                formatter={(value: number, name: string) => [formatCurrency(value), name.toUpperCase()]}
                labelFormatter={(label: number) => `Age ${label}`}
              />
              <Line type="monotone" dataKey="p10" name="p10" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="p50" name="p50" stroke="#16a34a" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="p90" name="p90" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
