import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { IlpComparisonRow, IlpPolicyAnalysis } from '@/lib/calculations/ilp'
import { formatIlpCurrency, formatIlpNumber, formatIlpPercent } from './formatters'

interface ComparisonTableProps {
  analyses: IlpPolicyAnalysis[]
  comparison: IlpComparisonRow[]
}

function findBestValue(row: IlpComparisonRow): number | null {
  if (row.lowerIsBetter == null || row.unit === 'text') return null

  const numericValues = Object.values(row.values).filter((value): value is number => typeof value === 'number')
  if (numericValues.length === 0) return null
  return row.lowerIsBetter ? Math.min(...numericValues) : Math.max(...numericValues)
}

export function ComparisonTable({ analyses, comparison }: ComparisonTableProps) {
  if (comparison.length === 0) return null

  const mixedCurrencies = new Set(analyses.map((analysis) => analysis.currency)).size > 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy Comparison</CardTitle>
        {mixedCurrencies && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Mixed currencies detected. Currency-denominated rows are shown for reference only and do not highlight a best value.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Metric</th>
                {analyses.map((analysis) => (
                  <th key={analysis.policyId} className="px-3 py-2 text-right font-medium text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{analysis.policyName}</span>
                      <span className="text-xs font-normal">{analysis.insurer || 'Insurer not set'}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => {
                const bestValue = findBestValue(row)
                return (
                  <tr key={row.metric} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{row.metric}</td>
                    {analyses.map((analysis) => {
                      const rawValue = row.values[analysis.policyId]
                      const display = row.unit === 'currency' && typeof rawValue === 'number'
                        ? formatIlpCurrency(rawValue, analysis.currency)
                        : row.unit === 'percent' && typeof rawValue === 'number'
                          ? formatIlpPercent(rawValue)
                          : row.unit === 'years' && typeof rawValue === 'number'
                            ? `${formatIlpNumber(rawValue)} yr`
                            : String(rawValue ?? 'N/A')
                      const highlight = bestValue != null && rawValue === bestValue

                      return (
                        <td
                          key={`${row.metric}-${analysis.policyId}`}
                          className={cn(
                            'px-3 py-2 text-right tabular-nums',
                            highlight && 'font-semibold text-emerald-700 dark:text-emerald-400',
                          )}
                        >
                          {display}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
