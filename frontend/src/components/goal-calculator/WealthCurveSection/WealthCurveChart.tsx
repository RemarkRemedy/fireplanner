import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { useIsMobile } from '@/hooks/useIsMobile'

export interface GoalMarker {
  age: number
  label: string
  icon: string
  cost: number
}

interface WealthCurveChartProps {
  data: { age: number; netWorth: number }[]
  goalMarkers: GoalMarker[]
  freedomAge: number | null
  currentAge: number
}

interface ChartDataPoint {
  age: number
  netWorth: number
  positiveNW: number
  negativeNW: number
}

function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

interface GoalLabelProps {
  viewBox?: { x?: number; y?: number; width?: number; height?: number }
  icon: string
  cost: number
  label: string
}

function GoalLabel({ viewBox, icon, cost, label }: GoalLabelProps) {
  const x = viewBox?.x ?? 0
  const y = viewBox?.y ?? 0
  return (
    <g>
      <text
        x={x}
        y={y - 28}
        textAnchor="middle"
        fontSize={14}
        dominantBaseline="middle"
        role="img"
        aria-label={label}
      >
        {icon}
      </text>
      <text
        x={x}
        y={y - 12}
        textAnchor="middle"
        fontSize={9}
        fill="#ef4444"
        fontWeight={500}
      >
        {formatCompactCurrency(cost)}
      </text>
    </g>
  )
}

interface FreedomLabelProps {
  viewBox?: { x?: number; y?: number; width?: number; height?: number }
  age: number
}

function FreedomLabel({ viewBox, age }: FreedomLabelProps) {
  const x = viewBox?.x ?? 0
  const y = viewBox?.y ?? 0
  return (
    <text
      x={x + 4}
      y={y + 14}
      fontSize={10}
      fill="#22c55e"
      fontWeight={600}
    >
      Freedom: {age}
    </text>
  )
}

function WealthTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null

  const age = label as number
  const positiveEntry = payload.find((p) => p.dataKey === 'positiveNW')
  const negativeEntry = payload.find((p) => p.dataKey === 'negativeNW')
  const netWorth =
    (positiveEntry?.value as number | undefined) ??
    (negativeEntry?.value as number | undefined) ??
    0

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold mb-1">Age {age}</p>
      <p className={netWorth >= 0 ? 'text-blue-600' : 'text-red-500'}>
        Net worth: {formatCompactCurrency(netWorth)}
      </p>
    </div>
  )
}

export function WealthCurveChart({
  data,
  goalMarkers,
  freedomAge,
  currentAge,
}: WealthCurveChartProps) {
  const isMobile = useIsMobile()

  const maxAge = Math.max(65, (freedomAge ?? 65) + 5)
  const xDomain: [number, number] = [currentAge, maxAge]

  const chartData: ChartDataPoint[] = data.map((d) => ({
    age: d.age,
    netWorth: d.netWorth,
    positiveNW: d.netWorth >= 0 ? d.netWorth : 0,
    negativeNW: d.netWorth < 0 ? d.netWorth : 0,
  }))

  const hasNegative = chartData.some((d) => d.negativeNW < 0)

  return (
    <div
      className="border rounded-md p-4"
      role="img"
      aria-label="Wealth curve projection chart"
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 40, right: 16, left: 8, bottom: 20 }}
        >
          <defs>
            <linearGradient id="wealthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

          <XAxis
            dataKey="age"
            type="number"
            domain={xDomain}
            tick={{ fontSize: 12 }}
            label={{
              value: 'Age',
              position: 'insideBottom',
              offset: -5,
              fontSize: 12,
            }}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            tick={{ fontSize: 11 }}
            width={isMobile ? 52 : 64}
          />

          <Tooltip
            trigger={isMobile ? 'click' : undefined}
            content={<WealthTooltip />}
          />

          {/* Goal drop lines */}
          {goalMarkers.map((marker) => (
            <ReferenceLine
              key={`goal-${marker.age}-${marker.label}`}
              x={marker.age}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={
                <GoalLabel
                  icon={marker.icon}
                  cost={marker.cost}
                  label={marker.label}
                />
              }
            />
          ))}

          {/* Freedom Age line */}
          {freedomAge !== null && (
            <ReferenceLine
              x={freedomAge}
              stroke="#22c55e"
              strokeDasharray="4 4"
              label={<FreedomLabel age={freedomAge} />}
            />
          )}

          {/* Positive net worth area (blue) */}
          <Area
            type="monotone"
            dataKey="positiveNW"
            fill="url(#wealthGradient)"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Net worth"
            legendType="none"
          />

          {/* Negative net worth area (red, below zero) */}
          {hasNegative && (
            <Area
              type="monotone"
              dataKey="negativeNW"
              fill="url(#negativeGradient)"
              stroke="#ef4444"
              strokeWidth={2}
              name="Net worth (negative)"
              legendType="none"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
