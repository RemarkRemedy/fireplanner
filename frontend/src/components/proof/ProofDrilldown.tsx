import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import type { ProofCycle, ProofProvenance } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'

interface ProofDrilldownProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycles: ProofCycle[]
  selectedCycleIndex: number
  selectedYearIndex: number
  onSelectedCycleChange: (index: number) => void
  onSelectedYearChange: (index: number) => void
}

const PIE_COLORS = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#eab308', '#ec4899', '#22d3ee', '#94a3b8']

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function ProofDrilldown({
  open,
  onOpenChange,
  cycles,
  selectedCycleIndex,
  selectedYearIndex,
  onSelectedCycleChange,
  onSelectedYearChange,
}: ProofDrilldownProps) {
  const cycleCount = cycles.length
  const cycleIndex = clamp(selectedCycleIndex, 0, Math.max(0, cycleCount - 1))
  const cycle = cycles[cycleIndex]

  const yearCount = cycle?.rows.length ?? 0
  const yearIndex = clamp(selectedYearIndex, 0, Math.max(0, yearCount - 1))
  const row = cycle?.rows[yearIndex]
  const prev = yearIndex > 0 ? cycle?.rows[yearIndex - 1] : row
  const provenance: ProofProvenance = cycle?.provenance[yearIndex] ?? 'actual'

  const allocationData = row
    ? row.allocationWeights
        .map((weight, i) => ({
          name: ASSET_CLASSES[i]?.label ?? `Asset ${i + 1}`,
          value: weight,
        }))
        .filter((d) => d.value > 0)
    : []

  const accountRows = row
    ? [
        {
          account: 'Liquid Portfolio',
          start: prev?.liquidNW ?? row.liquidNW,
          end: row.liquidNW,
        },
        {
          account: 'CPF',
          start: prev?.cpfTotal ?? row.cpfTotal,
          end: row.cpfTotal,
        },
        {
          account: 'Property Equity',
          start: prev?.propertyEquity ?? row.propertyEquity,
          end: row.propertyEquity,
        },
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Year-by-Year Drilldown</DialogTitle>
        </DialogHeader>

        {!cycle || !row ? (
          <div className="text-sm text-muted-foreground">No cycle data available.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-center">
              A cycle is one full historical/representative path; simulation year is the selected point inside that path.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="text-sm font-medium">
                    Select Cycle {cycle.startYear ? `(Data Start: ${cycle.startYear})` : '(Monte Carlo Path)'}
                  </div>
                  <Slider
                    value={[cycleIndex + 1]}
                    min={1}
                    max={Math.max(1, cycleCount)}
                    step={1}
                    onValueChange={(value) => onSelectedCycleChange((value[0] ?? 1) - 1)}
                  />
                  <div className="text-xs text-muted-foreground">
                    Cycle {cycleIndex + 1} of {cycleCount}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="text-sm font-medium">
                    Select Simulation Year ({yearIndex + 1}) - Age {row.age}
                  </div>
                  <Slider
                    value={[yearIndex + 1]}
                    min={1}
                    max={Math.max(1, yearCount)}
                    step={1}
                    onValueChange={(value) => onSelectedYearChange((value[0] ?? 1) - 1)}
                  />
                  <div className="text-xs text-muted-foreground">
                    Calendar year {row.year} • Provenance: {provenance}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Account Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Account</th>
                          <th className="text-right py-2">Start</th>
                          <th className="text-right py-2">End</th>
                          <th className="text-right py-2">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountRows.map((acc) => (
                          <tr key={acc.account} className="border-b last:border-0">
                            <td className="py-1.5">{acc.account}</td>
                            <td className="py-1.5 text-right">{formatCurrency(acc.start)}</td>
                            <td className="py-1.5 text-right">{formatCurrency(acc.end)}</td>
                            <td className="py-1.5 text-right">{formatCurrency(acc.end - acc.start)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 text-sm space-y-1">
                    <div><span className="text-muted-foreground">Income tax paid:</span> {formatCurrency(row.sgTax)}</div>
                    <div><span className="text-muted-foreground">Portfolio return:</span> {formatPercent(row.portfolioReturnPct, 2)}</div>
                    {row.activeLifeEvents.length > 0 ? (
                      <div>
                        <span className="text-muted-foreground">Active events:</span> {row.activeLifeEvents.join(', ')}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">No life events in this year.</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Allocation for Year {row.year}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    {allocationData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={allocationData}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={90}
                            innerRadius={52}
                            label={({ value }) => `${(value * 100).toFixed(1)}%`}
                          >
                            {allocationData.map((entry, index) => (
                              <Cell key={`alloc-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => `${(value * 100).toFixed(2)}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        No allocation data for this year.
                      </div>
                    )}
                  </div>

                  {row.sgTax > 0 ? (
                    <p className="text-sm">Tax event: Income tax paid {formatCurrency(row.sgTax)}.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tax events for this year.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button variant="destructive" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
