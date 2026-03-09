import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useChartColors } from '@/lib/chartTheme'
import { formatCurrency } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

interface ProjectionPoint {
  age: number
  balance: number
  phase: 'accumulation' | 'decumulation'
}

interface QuickProjectionChartProps {
  data: ProjectionPoint[]
  fireNumber: number
  fireAge: number
  /** X-axis label (default "Age") */
  xLabel?: string
  /** Tooltip label formatter (default: v => `Age ${v}`) */
  tooltipLabelFormatter?: (value: number) => string
}

export function QuickProjectionChart({ data, fireNumber, fireAge, xLabel = 'Age', tooltipLabelFormatter }: QuickProjectionChartProps) {
  const colors = useChartColors()
  const isMobile = useIsMobile()

  // Only show FIRE reference lines when the portfolio actually reaches the FIRE number.
  // In shortfall scenarios (forced early retirement), the FIRE number is never reached
  // and showing it would be misleading (line way above chart scale, age line after depletion).
  const portfolioReachesFire = data.some((pt) => pt.balance >= fireNumber)

  // Split into two series so Recharts colors them independently.
  // The first decumulation point appears in both series so the areas connect seamlessly.
  const chartData = data.map((pt, i) => {
    const isTransition = pt.phase === 'decumulation' && i > 0 && data[i - 1].phase === 'accumulation'
    return {
      age: pt.age,
      accumulation: pt.phase === 'accumulation' || isTransition ? pt.balance : undefined,
      decumulation: pt.phase === 'decumulation' ? pt.balance : undefined,
    }
  })

  return (
    <div className="mt-4 space-y-2">
      <div className="h-48 md:h-56" role="img" aria-label="Net worth projection from current age to life expectancy">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 15 }}>
            <XAxis
              dataKey="age"
              tick={{ fontSize: 11 }}
              label={{ value: xLabel, position: 'insideBottom', offset: -3, fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11 }}
              width={60}
            />
            <Tooltip
              trigger={isMobile ? 'click' : undefined}
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={tooltipLabelFormatter ?? ((age: number) => `Age ${age}`)}
            />
            <Area
              type="monotone"
              dataKey="accumulation"
              name="Growing"
              stroke={colors.primary}
              fill={colors.primary}
              fillOpacity={0.2}
              connectNulls={false}
              isAnimationActive
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="decumulation"
              name="Spending"
              stroke={colors.warning}
              fill={colors.warning}
              fillOpacity={0.2}
              connectNulls={false}
              isAnimationActive
              animationDuration={800}
            />
            {portfolioReachesFire && (
              <ReferenceLine
                y={fireNumber}
                stroke={colors.success}
                strokeDasharray="5 5"
                label={{ value: 'FIRE #', position: 'right', fill: colors.success, fontSize: 11 }}
              />
            )}
            {portfolioReachesFire && (
              <ReferenceLine
                x={fireAge}
                stroke={colors.warning}
                strokeDasharray="3 3"
                label={{ value: 'FIRE', position: 'top', fill: colors.warning, fontSize: 11 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors.primary }} />
          Growing
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors.warning }} />
          Spending
        </span>
        {portfolioReachesFire && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-1 border-t-2 border-dashed" style={{ borderColor: colors.success }} />
            FIRE Number
          </span>
        )}
      </div>
    </div>
  )
}
