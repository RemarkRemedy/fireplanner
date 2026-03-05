import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { formatPercent } from '@/lib/utils'
import type { StressScenarioComparisonRow } from '@/lib/simulation/stressScenarios'

interface CompanionStressComparisonProps {
  rows: StressScenarioComparisonRow[]
  isPending: boolean
  error: string | null
}

export function CompanionStressComparison({ rows, isPending, error }: CompanionStressComparisonProps) {
  const baseRow = rows.find((r) => r.scenarioId === 'base')
  const stressRows = rows.filter((r) => r.scenarioId !== 'base')

  if (stressRows.length === 0 && !isPending && !error) return null

  return (
    <Card className="companion-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Stress Test Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending && <p className="text-xs text-muted-foreground">Running stress tests...</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {stressRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Scenario</th>
                  <th className="py-2 text-right">P(success)</th>
                  <th className="py-2 text-right">Delta</th>
                  <th className="py-2 text-right">Drawdown</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {stressRows.map((row) => {
                  const delta = baseRow ? row.successRate - baseRow.successRate : null
                  // Thresholds aligned with CompanionResultsSummary (90/70 split)
                  const statusAccent = row.successRate >= 0.90 ? 'good'
                    : row.successRate >= 0.70 ? 'neutral' : 'bad'
                  const statusLabel = row.successRate >= 0.90 ? 'Survives'
                    : row.successRate >= 0.70 ? 'At risk' : 'Fails'
                  return (
                    <tr key={row.scenarioId} className="border-b border-muted/50">
                      <td className="py-2 font-medium">{row.label}</td>
                      <td className="py-2 text-right tabular-nums">{formatPercent(row.successRate, 1)}</td>
                      <td className="py-2 text-right">
                        {delta != null && <DeltaBadge value={delta} format={(v) => formatPercent(Math.abs(v), 1)} />}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {row.worstYearDrawdown != null ? formatPercent(row.worstYearDrawdown, 1) : '\u2014'}
                      </td>
                      <td className="py-2 text-right">
                        <SurvivalBadge accent={statusAccent} label={statusLabel} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Matches color pattern from CompanionResultsSummary MetricCell
function SurvivalBadge({ accent, label }: { accent: 'good' | 'neutral' | 'bad'; label: string }) {
  const cls = accent === 'good' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : accent === 'bad' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
}
