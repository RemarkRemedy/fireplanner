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
import type { ProjectionRow } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

interface NWChartViewProps {
  rows: ProjectionRow[]
  retirementAge: number
}

interface ChartDataPoint {
  age: number
  liquidNW: number
  cpfTotal: number
  cpfBequest: number
  propertyEquity: number
}

export function NWChartView({ rows, retirementAge }: NWChartViewProps) {
  const isMobile = useIsMobile()
  const data: ChartDataPoint[] = rows.map((row) => ({
    age: row.age,
    liquidNW: Math.max(0, row.liquidNW),
    cpfTotal: Math.max(0, row.cpfTotal),
    cpfBequest: Math.max(0, row.cpfBequest),
    propertyEquity: Math.max(0, row.totalNW - row.liquidNW - row.cpfTotal),
  }))

  return (
    <div className="border rounded-md p-4" role="img" aria-label="Net worth projection chart">
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12 }}
            label={{ value: 'Age', position: 'insideBottom', offset: -5, fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v: number) =>
              v >= 1_000_000 || v <= -1_000_000
                ? `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`
                : `$${(v / 1000).toFixed(0)}k`
            }
            tick={{ fontSize: 12 }}
            width={70}
          />
          <Tooltip
            trigger={isMobile ? 'click' : undefined}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === 'liquidNW'
                ? 'Liquid NW'
                : name === 'cpfTotal'
                  ? 'CPF'
                  : name === 'cpfBequest'
                    ? 'CPF LIFE Bequest'
                    : 'Property Equity',
            ]}
            labelFormatter={(age: number) => `Age ${age}`}
          />
          <ReferenceLine
            x={retirementAge}
            stroke="hsl(var(--destructive))"
            strokeDasharray="4 4"
            label={{ value: 'Retire', position: 'top', fontSize: 11 }}
          />
          <Area
            type="linear"
            dataKey="liquidNW"
            stackId="1"
            fill="hsl(210, 80%, 60%)"
            stroke="hsl(210, 80%, 50%)"
            fillOpacity={0.6}
            name="liquidNW"
          />
          <Area
            type="linear"
            dataKey="cpfTotal"
            stackId="1"
            fill="hsl(150, 60%, 50%)"
            stroke="hsl(150, 60%, 40%)"
            fillOpacity={0.6}
            name="cpfTotal"
          />
          <Area
            type="linear"
            dataKey="cpfBequest"
            stackId="1"
            fill="hsl(150, 40%, 72%)"
            stroke="hsl(150, 40%, 60%)"
            fillOpacity={0.5}
            name="cpfBequest"
          />
          <Area
            type="linear"
            dataKey="propertyEquity"
            stackId="1"
            fill="hsl(35, 80%, 55%)"
            stroke="hsl(35, 80%, 45%)"
            fillOpacity={0.6}
            name="propertyEquity"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(210, 80%, 60%)' }} /> Liquid NW</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(150, 60%, 50%)' }} /> CPF</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(150, 40%, 72%)' }} /> CPF LIFE Bequest</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(35, 80%, 55%)' }} /> Property Equity</span>
      </div>
    </div>
  )
}
