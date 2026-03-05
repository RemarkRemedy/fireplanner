import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { StressScenarioComparisonRow } from '@/lib/simulation/stressScenarios'

interface StressScenarioComparisonTableProps {
  rows: StressScenarioComparisonRow[]
  isPending?: boolean
  error?: string | null
}

export function StressScenarioComparisonTable({
  rows,
  isPending = false,
  error = null,
}: StressScenarioComparisonTableProps) {
  if (rows.length === 0 && !isPending && !error) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending && (
          <p className="text-xs text-muted-foreground">
            Running selected stress scenarios...
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive">
            {error}
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Scenario</th>
                  <th className="py-2 text-right">Success Rate</th>
                  <th className="py-2 text-right">Median Terminal Wealth</th>
                  <th className="py-2 text-right">Failure Age</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.scenarioId} className="border-b border-muted/50">
                    <td className="py-2 font-medium">{row.label}</td>
                    <td className="py-2 text-right">{formatPercent(row.successRate, 1)}</td>
                    <td className="py-2 text-right">{formatCurrency(row.medianTerminalWealth)}</td>
                    <td className="py-2 text-right">{row.failureAge ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
