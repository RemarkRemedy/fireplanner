import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const [expanded, setExpanded] = useState(false)
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
  const comparisonBlockClass = dark ? 'mx-auto w-full max-w-xl' : 'w-full'
  const comparisonRowClass = dark
    ? 'rounded-md border border-white/10 bg-white/5 px-4 py-3'
    : 'rounded-md border border-border/60 bg-background/70 px-4 py-3'

  const renderChart = (expanded = false) => (
    <div className={expanded ? 'h-[65vh] min-h-[32rem] w-full' : `${comparisonBlockClass} h-56`}>
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
            wrapperStyle={{ fontSize: 11, color: legendColor }}
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
  )

  const renderComparisonRows = (expanded = false) => {
    if (expanded && !dark) {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.label} className={`${comparisonRowClass} h-full`}>
              <div className="font-medium leading-tight" style={{ color: tier.color }}>{tier.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatIlpPercent(tier.drag)} p.a. fee drag
              </div>
              <div className="mt-4 text-right text-2xl font-semibold tabular-nums leading-none" style={{ color: tier.color }}>
                {formatIlpCurrency(tier.finalValue, currency)}
              </div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className={`${comparisonBlockClass} space-y-2 text-left`}>
        {tiers.map((tier) => (
          <div key={tier.label} className={`${comparisonRowClass} grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 text-sm`}>
            <div className="min-w-0">
              <div className="font-medium leading-tight" style={{ color: tier.color }}>{tier.label}</div>
              <div className={`text-xs ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
                {formatIlpPercent(tier.drag)} p.a. fee drag
              </div>
            </div>
            <div className="shrink-0 pt-0.5 text-right tabular-nums text-base font-semibold leading-tight" style={{ color: tier.color }}>
              {formatIlpCurrency(tier.finalValue, currency)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderContent = (expanded = false) => (
    <div className={expanded ? 'mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-5' : 'space-y-4'}>
      {dark && !expanded && (
        <p className="text-xs text-white/60">
          What your portfolio could be worth after {horizonYears} years at 7% gross return ({basisLabel}). {contributionLabel}
        </p>
      )}

      {expanded && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            What your portfolio could be worth after {horizonYears} years at 7% gross return ({basisLabel}). {contributionLabel}
          </p>
          {renderComparisonRows(true)}
        </div>
      )}

      {!expanded && renderComparisonRows()}
      <div className={expanded ? 'rounded-lg border border-border/60 bg-background/70 p-4' : ''}>
        {renderChart(expanded)}
      </div>
    </div>
  )

  if (dark) return renderContent()

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                Returns compound, but fees compound too.
              </p>
              <p className="text-xs text-muted-foreground">
                What your portfolio could be worth after {horizonYears} years at 7% gross return ({basisLabel}). {contributionLabel}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded(true)}
              aria-label="Expand compound effect chart"
            >
              <Maximize2 className="h-4 w-4" />
              Expand
            </Button>
          </div>
          <div className="space-y-4">
            {renderComparisonRows()}
            {renderChart()}
          </div>
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[95vh] max-h-[95vh] max-w-[95vw] flex-col p-4">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-bold">Compound Effect</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 overflow-auto px-2 pb-2">
            {renderContent(true)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
