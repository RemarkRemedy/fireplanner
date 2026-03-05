import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProofCycle } from '@/lib/types'
import { percentile } from '@/lib/math/stats'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface ProofSummaryProps {
  cycles: ProofCycle[]
}

interface MetricSummary {
  average: number
  median: number
  highest: number
  lowest: number
}

function summarize(values: number[]): MetricSummary {
  if (values.length === 0) {
    return { average: 0, median: 0, highest: 0, lowest: 0 }
  }
  return {
    average: values.reduce((sum, v) => sum + v, 0) / values.length,
    median: percentile(values, 50),
    highest: Math.max(...values),
    lowest: Math.min(...values),
  }
}

function metricRows(label: string, metric: MetricSummary) {
  return [
    { label: 'Average', value: metric.average },
    { label: 'Median', value: metric.median },
    { label: 'Highest', value: metric.highest },
    { label: 'Lowest', value: metric.lowest },
  ].map((row) => ({ ...row, key: `${label}-${row.label}` }))
}

export function ProofSummary({ cycles }: ProofSummaryProps) {
  const endingPortfolio = cycles.map((c) => c.endingPortfolio)
  const spending = cycles.map((c) => c.meanSpending)
  const incomeTax = cycles.map((c) => c.rows.reduce((sum, row) => sum + row.sgTax, 0))

  const endingStats = summarize(endingPortfolio)
  const spendingStats = summarize(spending)
  const taxStats = summarize(incomeTax)

  const successRate = cycles.length === 0
    ? 0
    : cycles.filter((c) => c.endingPortfolio > 0).length / cycles.length

  const rows = metricRows('ending', endingStats)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistics Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          <div className="rounded-lg border p-4 flex flex-col items-center justify-center gap-2">
            <div className="text-sm text-muted-foreground">Success Rate</div>
            <div className="h-24 w-24 rounded-full border-[10px] border-green-500 flex items-center justify-center font-semibold">
              {formatPercent(successRate, 2)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-md overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Metric</th>
                  <th className="text-left p-2">Ending Portfolio</th>
                  <th className="text-left p-2">Spending</th>
                  <th className="text-left p-2">Total Taxes Paid</th>
                  <th className="text-left p-2">Income Taxes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const taxValue = [taxStats.average, taxStats.median, taxStats.highest, taxStats.lowest][i]
                  const spendingValue = [spendingStats.average, spendingStats.median, spendingStats.highest, spendingStats.lowest][i]
                  return (
                    <tr key={row.key} className="border-t">
                      <td className="p-2 font-medium">{row.label}</td>
                      <td className="p-2">{formatCurrency(row.value)}</td>
                      <td className="p-2">{formatCurrency(spendingValue)}</td>
                      <td className="p-2">{formatCurrency(taxValue)}</td>
                      <td className="p-2">{formatCurrency(taxValue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
