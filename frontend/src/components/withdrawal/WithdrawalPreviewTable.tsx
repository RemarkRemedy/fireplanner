import { useMemo, useState } from 'react'
import type { DeterministicComparisonResult } from '@/lib/calculations/withdrawal'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface WithdrawalPreviewTableProps {
  results: DeterministicComparisonResult
  activeStrategy: string
  annualExpenses: number
  retirementSpendingAdjustment: number
  inflation: number
  currentAge: number
}

export function WithdrawalPreviewTable({
  results,
  activeStrategy,
  annualExpenses,
  retirementSpendingAdjustment,
  inflation,
  currentAge,
}: WithdrawalPreviewTableProps) {
  const [expanded, setExpanded] = useState(false)

  const yearData = results.yearResults[activeStrategy]
  const baseExpenses = annualExpenses * retirementSpendingAdjustment

  const rows = useMemo(() => {
    if (!yearData || yearData.length === 0) return []
    return yearData.map((yr) => ({
      age: yr.age,
      expenses: baseExpenses * (1 + inflation) ** (yr.age - currentAge),
      strategyWithdrawal: yr.strategyWithdrawal,
      portfolio: yr.portfolio,
      depleted: yr.portfolio <= 0 && yr.year > 0,
    }))
  }, [yearData, baseExpenses, inflation, currentAge])

  if (rows.length === 0) return null

  const displayRows = expanded ? rows : rows.slice(0, 5)
  const firstDepletedIndex = rows.findIndex((r) => r.depleted)

  return (
    <div>
      <div className={cn('border rounded-md overflow-auto', expanded && 'max-h-[600px]')}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Age</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Projected Expenses</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Withdrawal</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Shortfall</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Projected Portfolio</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={row.age}
                className={cn(
                  'border-b hover:bg-muted/50',
                  row.depleted && 'bg-red-50 dark:bg-red-900/20',
                  i === firstDepletedIndex && 'border-t-2 border-t-red-400',
                )}
              >
                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{row.age}</td>
                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{formatCurrency(row.expenses)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{formatCurrency(row.strategyWithdrawal)}</td>
                <td className={cn(
                  'px-2 py-1.5 whitespace-nowrap tabular-nums',
                  row.strategyWithdrawal - row.expenses >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {formatCurrency(row.strategyWithdrawal - row.expenses)}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{formatCurrency(row.portfolio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm text-primary hover:underline"
        >
          {expanded ? 'Show less' : `Show all ${rows.length} rows`}
        </button>
      )}
    </div>
  )
}
