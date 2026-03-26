import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import type { FeeImpactTier } from '@/hooks/useFeeImpact'
import { formatIlpCurrency, formatIlpPercent } from './formatters'

interface FeeImpactChartProps {
  tiers: FeeImpactTier[]
  timeSeries: Array<Record<string, number>>
  tierDefs: Array<{ label: string; key: string; drag: number; color: string }>
  horizonYears: number
  currency: 'SGD' | 'USD'
  monthlyContribution: number
  initialSinglePremium?: number
  useReal: boolean
  /** Dark background variant for the Wrapped story cards. */
  dark?: boolean
}

export function FeeImpactChart({
  tiers,
  timeSeries,
  tierDefs,
  horizonYears,
  currency,
  monthlyContribution,
  initialSinglePremium,
  useReal,
  dark,
}: FeeImpactChartProps) {
  if (tiers.length === 0) return null

  const basisLabel = useReal ? "in today's dollars" : 'nominal'
  const isp = initialSinglePremium ?? 0
  const contributionLabel = monthlyContribution > 0
    ? `Based on ${formatIlpCurrency(monthlyContribution, currency)}/mo contribution.`
    : `Based on ${formatIlpCurrency(isp, currency)} single premium.`

  const gridStroke = dark ? 'rgba(255,255,255,0.1)' : undefined
  const tickFill = dark ? 'rgba(255,255,255,0.5)' : undefined
  const axisStroke = dark ? 'rgba(255,255,255,0.2)' : undefined
  const tooltipStyle = dark
    ? { background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white' }
    : undefined
  const legendColor = dark ? 'rgba(255,255,255,0.7)' : undefined

  const content = (
    <div className="space-y-4">
      {!dark && (
        <div>
          <p className="text-sm font-semibold">
            Returns compound, but fees compound too.
          </p>
          <p className="text-xs text-muted-foreground">
            What your portfolio could be worth after {horizonYears} years at 7% gross return ({basisLabel}). {contributionLabel}
          </p>
        </div>
      )}
      {dark && (
        <p className="text-xs text-white/60">
          What your portfolio could be worth after {horizonYears} years at 7% gross return ({basisLabel}). {contributionLabel}
        </p>
      )}

      <div className="space-y-2">
        {tiers.map((tier) => (
          <div key={tier.label} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div style={{ color: tier.color }}>{tier.label}</div>
              <div className={`text-xs ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
                {formatIlpPercent(tier.drag)} p.a. fee drag
              </div>
            </div>
            <div className="shrink-0 tabular-nums font-medium" style={{ color: tier.color }}>
              {formatIlpCurrency(tier.finalValue, currency)}
            </div>
          </div>
        ))}
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeries} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} className={dark ? '' : 'stroke-muted'} />
            <XAxis
              dataKey="year"
              label={{ value: 'Year', position: 'insideBottom', offset: -3, className: dark ? '' : 'fill-muted-foreground text-[10px]', fill: tickFill }}
              tick={{ fontSize: 10, fill: tickFill }}
              stroke={axisStroke}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
              tick={{ fontSize: 10, fill: tickFill }}
              stroke={axisStroke}
              width={40}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                const tier = tierDefs.find((t) => t.key === name)
                return [formatIlpCurrency(value, currency), tier?.label ?? name]
              }}
              labelFormatter={(label: number) => `Year ${label}`}
            />
            <Legend
              formatter={(value: string) => {
                const tier = tierDefs.find((t) => t.key === value)
                return tier ? `${tier.label} (${formatIlpPercent(tier.drag)})` : value
              }}
              wrapperStyle={{ fontSize: 10, color: legendColor }}
            />
            {tierDefs.map((tier) => (
              <Line
                key={tier.key}
                type="monotone"
                dataKey={tier.key}
                stroke={tier.color}
                strokeWidth={tier.key === 'thisProduct' ? 2.5 : 1.5}
                strokeDasharray={tier.key === 'thisProduct' ? undefined : '4 3'}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  if (dark) return content

  return (
    <Card>
      <CardContent className="p-6">
        {content}
      </CardContent>
    </Card>
  )
}
