import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Button } from '@/components/ui/button'
import {
  Building2, Building, Home, Car, Heart, Plane, GraduationCap, Briefcase, Target, Landmark,
  ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Building, Home, Car, Heart, Plane, GraduationCap, Briefcase, Target, Landmark,
}
import type { DeflatedRow } from '@/lib/calculations/goal-calc-adapter'

export interface GoalMarker {
  age: number
  label: string
  icon: string
  cost: number
}

interface WealthCurveChartProps {
  data: DeflatedRow[]
  goalMarkers: GoalMarker[]
  freedomAge: number | null
  fireNumber: number | null
  currentAge: number
  onContinueToPlanner?: () => void
}

// ============================================================
// Helpers
// ============================================================

function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

// ============================================================
// Custom SVG labels
// ============================================================

interface GoalLabelProps {
  viewBox?: { x?: number; y?: number; width?: number; height?: number }
  icon: string
  cost: number
  label: string
}

function GoalLabel({ viewBox, icon, cost, label }: GoalLabelProps) {
  const x = viewBox?.x ?? 0
  const y = viewBox?.y ?? 0
  const Icon = ICON_MAP[icon]
  return (
    <g>
      {Icon && (
        <foreignObject
          x={x - 10}
          y={y - 38}
          width={20}
          height={20}
          style={{ overflow: 'visible' }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'center' }}
            aria-label={label}
          >
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </foreignObject>
      )}
      <text
        x={x}
        y={y - 14}
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

// ============================================================
// Tooltips
// ============================================================

const SERIES_LABELS: Record<string, string> = {
  liquidNW: 'Cash & Investments',
  cpfTotal: 'CPF',
  propertyEquity: 'Property Equity',
  totalNW: 'Total Net Worth',
}

const SERIES_COLORS: Record<string, string> = {
  liquidNW: '#3b82f6',
  cpfTotal: '#22c55e',
  propertyEquity: '#f59e0b',
  totalNW: '#3b82f6',
}

function SimpleTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null
  const age = label as number
  const total = (payload[0]?.value as number) ?? 0
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">Age {age}</p>
      <p className="text-blue-600">Net worth: {formatCompactCurrency(total)}</p>
    </div>
  )
}

function DetailedTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null
  const age = label as number
  let total = 0
  const items = payload
    .filter((p) => typeof p.value === 'number' && (p.value as number) > 0)
    .map((p) => {
      const val = p.value as number
      total += val
      return { key: p.dataKey as string, value: val }
    })

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold mb-1">Age {age}</p>
      {items.map((item) => (
        <p key={item.key} style={{ color: SERIES_COLORS[item.key] }}>
          {SERIES_LABELS[item.key] ?? item.key}: {formatCompactCurrency(item.value)}
        </p>
      ))}
      <p className="font-medium border-t pt-1 mt-1">
        Total: {formatCompactCurrency(total)}
      </p>
    </div>
  )
}

// ============================================================
// Main chart component
// ============================================================

export function WealthCurveChart({
  data,
  goalMarkers,
  freedomAge,
  fireNumber,
  currentAge,
  onContinueToPlanner,
}: WealthCurveChartProps) {
  const isMobile = useIsMobile()
  const [showDetailed, setShowDetailed] = useState(false)

  const maxAge = Math.max(65, (freedomAge ?? 65) + 5)
  const xDomain: [number, number] = [currentAge, maxAge]

  const chartData = data.map((d) => ({
    age: d.age,
    liquidNW: Math.max(0, d.liquidNW),
    cpfTotal: Math.max(0, d.cpfTotal),
    propertyEquity: Math.max(0, d.propertyEquity),
    totalNW: Math.max(0, d.liquidNW + d.cpfTotal + d.propertyEquity),
  }))

  const hasCpf = chartData.some((d) => d.cpfTotal > 0)
  const hasProperty = chartData.some((d) => d.propertyEquity > 0)

  return (
    <div className="space-y-3">
      {/* Chart */}
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
              content={showDetailed ? <DetailedTooltip /> : <SimpleTooltip />}
            />

            {/* Goal drop lines (always shown) */}
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

            {/* Freedom Age line (always shown) */}
            {freedomAge !== null && (
              <ReferenceLine
                x={freedomAge}
                stroke="#22c55e"
                strokeDasharray="4 4"
                label={<FreedomLabel age={freedomAge} />}
              />
            )}

            {/* === Detailed mode extras === */}

            {/* FIRE target line */}
            {showDetailed && fireNumber != null && fireNumber > 0 && (
              <ReferenceLine
                y={fireNumber}
                stroke="#a855f7"
                strokeDasharray="6 3"
                label={{
                  value: `FIRE: ${formatCompactCurrency(fireNumber)}`,
                  position: 'left',
                  fontSize: 10,
                  fill: '#a855f7',
                }}
              />
            )}

            {/* CPF milestones */}
            {showDetailed && currentAge < 55 && (
              <ReferenceLine
                x={55}
                stroke="#94a3b8"
                strokeDasharray="2 4"
                label={{
                  value: '55: CPF RA',
                  position: 'top',
                  fontSize: 9,
                  fill: '#94a3b8',
                }}
              />
            )}
            {showDetailed && currentAge < 65 && (
              <ReferenceLine
                x={65}
                stroke="#94a3b8"
                strokeDasharray="2 4"
                label={{
                  value: '65: CPF LIFE',
                  position: 'top',
                  fontSize: 9,
                  fill: '#94a3b8',
                }}
              />
            )}

            {/* === Chart areas === */}
            {/* Clean mode: single blue area for total NW */}
            {!showDetailed && (
              <Area
                type="monotone"
                dataKey="totalNW"
                fill="#3b82f6"
                fillOpacity={0.15}
                stroke="#3b82f6"
                strokeWidth={2}
                name="totalNW"
                legendType="none"
              />
            )}

            {/* Detailed mode: stacked areas */}
            {showDetailed && (
              <Area
                type="monotone"
                dataKey="liquidNW"
                stackId="wealth"
                fill="hsl(210, 80%, 60%)"
                stroke="hsl(210, 80%, 50%)"
                fillOpacity={0.6}
                name="liquidNW"
              />
            )}
            {showDetailed && hasCpf && (
              <Area
                type="monotone"
                dataKey="cpfTotal"
                stackId="wealth"
                fill="hsl(150, 60%, 50%)"
                stroke="hsl(150, 60%, 40%)"
                fillOpacity={0.6}
                name="cpfTotal"
              />
            )}
            {showDetailed && hasProperty && (
              <Area
                type="monotone"
                dataKey="propertyEquity"
                stackId="wealth"
                fill="hsl(35, 80%, 55%)"
                stroke="hsl(35, 80%, 45%)"
                fillOpacity={0.6}
                name="propertyEquity"
              />
            )}
            {showDetailed && (
              <Legend
                formatter={(value: string) => SERIES_LABELS[value] ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Toggle + CTA */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowDetailed(!showDetailed)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDetailed ? (
            <>
              <ChevronUp className="h-3 w-3" /> Simple view
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> See full breakdown (CPF, property, FIRE target)
            </>
          )}
        </button>

        {showDetailed && onContinueToPlanner && (
          <Button
            variant="link"
            size="sm"
            className="text-xs gap-1 p-0 h-auto"
            onClick={onContinueToPlanner}
          >
            Get Monte Carlo, tax planning, and more
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
