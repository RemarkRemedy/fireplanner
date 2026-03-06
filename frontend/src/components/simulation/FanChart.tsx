import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PercentileBands } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

interface FanChartProps {
  bands: PercentileBands
  retirementAge: number
}

export function FanChart({ bands, retirementAge }: FanChartProps) {
  const isMobile = useIsMobile()
  const data = bands.years.map((_, i) => ({
    age: bands.ages[i],
    p5: bands.p5[i],
    p10: bands.p10[i],
    p25: bands.p25[i],
    p50: bands.p50[i],
    p75: bands.p75[i],
    p90: bands.p90[i],
    p95: bands.p95[i],
    // Stacked areas need the difference between bands
    band_5_10: bands.p10[i] - bands.p5[i],
    band_10_25: bands.p25[i] - bands.p10[i],
    band_25_50: bands.p50[i] - bands.p25[i],
    band_50_75: bands.p75[i] - bands.p50[i],
    band_75_90: bands.p90[i] - bands.p75[i],
    band_90_95: bands.p95[i] - bands.p90[i],
  }))

  // Sample data points for readability (every 5 years)
  const sampled = data.filter((_, i) => i % 5 === 0 || i === data.length - 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Balance Fan Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 md:h-80 lg:h-[400px]" role="img" aria-label="Fan chart showing portfolio balance percentile bands over time">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampled} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="age"
              label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v)}
              width={90}
            />
            <Tooltip
              trigger={isMobile ? 'click' : undefined}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const row = payload[0]?.payload as Record<string, number> | undefined
                if (!row) return null
                const age = label as number
                const percentiles = [
                  { key: 'p95', label: 'Great outcome (95th)' },
                  { key: 'p90', label: 'Good outcome (90th)' },
                  { key: 'p75', label: 'Upper range (75th)' },
                  { key: 'p50', label: 'Typical (50th)' },
                  { key: 'p25', label: 'Lower range (25th)' },
                  { key: 'p10', label: 'Poor outcome (10th)' },
                  { key: 'p5', label: 'Worst case (5th)' },
                ]
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                    <p className="font-medium mb-1">
                      Age {age}{age === retirementAge ? ' (Retirement)' : ''}
                    </p>
                    {percentiles.map(({ key, label: pLabel }) => (
                      <div key={key} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{pLabel}</span>
                        <span className="font-mono">{formatCurrency(row[key])}</span>
                      </div>
                    ))}
                  </div>
                )
              }}
            />

            {/* Stacked area bands from p5 up */}
            <Area type="monotone" dataKey="p5" stackId="1" fill="#dcfce7" stroke="none" fillOpacity={0.6} />
            <Area type="monotone" dataKey="band_5_10" stackId="1" fill="#bbf7d0" stroke="none" fillOpacity={0.5} />
            <Area type="monotone" dataKey="band_10_25" stackId="1" fill="#86efac" stroke="none" fillOpacity={0.4} />
            <Area type="monotone" dataKey="band_25_50" stackId="1" fill="#4ade80" stroke="none" fillOpacity={0.4} />
            <Area type="monotone" dataKey="band_50_75" stackId="1" fill="#86efac" stroke="none" fillOpacity={0.4} />
            <Area type="monotone" dataKey="band_75_90" stackId="1" fill="#bbf7d0" stroke="none" fillOpacity={0.5} />
            <Area type="monotone" dataKey="band_90_95" stackId="1" fill="#dcfce7" stroke="none" fillOpacity={0.6} />

            {/* Median line */}
            <Line type="monotone" dataKey="p50" stroke="#16a34a" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-green-400" /> Typical (50th)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-green-200" /> Middle 50%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-green-100" /> Full range (5th-95th)
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
