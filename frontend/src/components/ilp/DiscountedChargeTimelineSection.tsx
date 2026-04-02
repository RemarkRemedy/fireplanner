import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import { useChartColors } from '@/lib/chartTheme'
import { IllustrationOnlyChartFrame } from './IllustrationOnlyChartFrame'
import { formatIlpCurrency } from './formatters'
import { buildDiscountedChargeTimeline } from './discountedChargeTimeline'

interface DiscountedChargeTimelineSectionProps {
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
}

export function DiscountedChargeTimelineSection({
  policy,
  analysis,
}: DiscountedChargeTimelineSectionProps) {
  const colors = useChartColors()
  const [excludeFundFees, setExcludeFundFees] = useState(false)
  const [tableExpanded, setTableExpanded] = useState(false)
  const timeline = useMemo(
    () => buildDiscountedChargeTimeline(policy, analysis, { includeFundFees: !excludeFundFees }),
    [policy, analysis, excludeFundFees],
  )
  const detailText = excludeFundFees ? 'excluding fund fees (OCF)' : 'including fund fees (OCF)'
  const previewRowCount = 5
  const visibleTimeline = tableExpanded ? timeline : timeline.slice(0, previewRowCount)
  const hiddenRowCount = Math.max(0, timeline.length - previewRowCount)

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle>Total Out-of-Pocket Fees by Exit Year</CardTitle>
        <p className="text-sm text-muted-foreground">
          For each possible exit year, this shows the total out-of-pocket fees you would have paid by then in today&apos;s dollars, {detailText}, after factoring in bonus offsets, any inception charges, and the surrender charge still applying at that exit point.
        </p>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            id="exclude-discounted-fund-fees"
            checked={excludeFundFees}
            onCheckedChange={(value) => setExcludeFundFees(value === true)}
          />
          <label htmlFor="exclude-discounted-fund-fees" className="cursor-pointer">
            Exclude fund fees (OCF) from this view
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <IllustrationOnlyChartFrame
          className="h-80"
          ariaLabel="Line chart showing total out-of-pocket ILP fees by exit year"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="exitYear"
                tickLine={false}
                axisLine={false}
                label={{ value: 'Exit year', position: 'insideBottom', offset: -4 }}
              />
              <YAxis
                width={90}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatIlpCurrency(value, policy.currency)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0]?.payload
                  if (!point) return null
                  const rows = [
                    { label: 'Total', value: formatIlpCurrency(point.totalDiscountedCharges, policy.currency), bold: true },
                    { label: 'Policy charges', value: formatIlpCurrency(point.discountedPolicyCharges, policy.currency) },
                    ...(!excludeFundFees ? [{ label: 'Fund charges', value: formatIlpCurrency(point.discountedFundCharges, policy.currency) }] : []),
                    { label: 'Bonuses offset', value: `-${formatIlpCurrency(point.discountedBonuses, policy.currency)}` },
                    { label: 'Initial charges', value: formatIlpCurrency(point.discountedInceptionCharges, policy.currency) },
                    { label: 'Early-exit charge', value: formatIlpCurrency(point.discountedEec, policy.currency) },
                  ]
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                      <div className="mb-1.5 font-medium">Exit in Year {label}</div>
                      <div className="space-y-0.5">
                        {rows.map((row) => (
                          <div key={row.label} className={`flex justify-between gap-4 ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>
                            <span>{row.label}</span>
                            <span className="tabular-nums">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="totalDiscountedCharges"
                stroke={colors.primary}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </IllustrationOnlyChartFrame>

        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Exit Year</th>
                <th className="px-3 py-2 text-right font-medium">Cumu. policy</th>
                {!excludeFundFees && <th className="px-3 py-2 text-right font-medium">Cumu. fund</th>}
                <th className="px-3 py-2 text-right font-medium">Cumu. bonus offset</th>
                <th className="px-3 py-2 text-right font-medium">Initial</th>
                <th className="px-3 py-2 text-right font-medium">EEC at exit</th>
                <th className="px-3 py-2 text-right font-medium">Total to exit</th>
              </tr>
            </thead>
            <tbody>
              {visibleTimeline.map((point) => (
                <tr key={point.exitYear} className="border-t border-border/60">
                  <td className="px-3 py-2">{point.exitYear}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatIlpCurrency(point.discountedPolicyCharges, policy.currency)}</td>
                  {!excludeFundFees && (
                    <td className="px-3 py-2 text-right tabular-nums">{formatIlpCurrency(point.discountedFundCharges, policy.currency)}</td>
                  )}
                  <td className="px-3 py-2 text-right tabular-nums">-{formatIlpCurrency(point.discountedBonuses, policy.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatIlpCurrency(point.discountedInceptionCharges, policy.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatIlpCurrency(point.discountedEec, policy.currency)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatIlpCurrency(point.totalDiscountedCharges, policy.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hiddenRowCount > 0 && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTableExpanded((current) => !current)}
            >
              {tableExpanded ? 'Show fewer rows' : `Show ${hiddenRowCount} more exit years`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
