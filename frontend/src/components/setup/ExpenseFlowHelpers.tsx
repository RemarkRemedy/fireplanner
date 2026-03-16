import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { FLOW_FIELD_TO_CATEGORY, CATEGORY_TO_FLOW_FIELD } from '@/lib/data/retirementTemplates'
import { EXPENSE_CATEGORY_BENCHMARKS } from '@/lib/data/expenseBenchmarks'
import { formatCurrency } from '@/lib/utils'
import type { ExpenseCategoryKey } from '@/lib/data/retirementTemplates'

/** Extract canonical category breakdown from nudge flow field values */
export function extractBreakdown(values: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [flowField, catKey] of Object.entries(FLOW_FIELD_TO_CATEGORY)) {
    const val = values[flowField]
    if (typeof val === 'number' && val >= 0) result[catKey] = val
  }
  return result
}

export function ExpenseGapBanner({ values }: { values: Record<string, unknown> }) {
  const baseExpense = useHouseholdPlanStore((s) =>
    s.plan.expenses.find((e) => e.kind === 'base-living' && e.timing.owner === 'self')
  )
  if (!baseExpense || baseExpense.amount <= 0) return null

  const storedMonthly = baseExpense.amount / 12
  const categoryFields = Object.keys(FLOW_FIELD_TO_CATEGORY)
  const breakdownTotal = categoryFields.reduce((sum, f) => {
    const val = values[f]
    return sum + (typeof val === 'number' && val > 0 ? val : 0)
  }, 0)

  if (breakdownTotal <= 0) return null

  const gap = Math.abs(breakdownTotal - storedMonthly) / storedMonthly
  if (gap <= 0.1) return null

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
      Your breakdown totals {formatCurrency(breakdownTotal)}/mo. Your plan currently uses {formatCurrency(Math.round(storedMonthly))}/mo. Saving will update your plan to use the new total.
    </div>
  )
}

export function ExpenseRunningTotal({ values }: { values: Record<string, unknown> }) {
  const categoryFields = Object.keys(FLOW_FIELD_TO_CATEGORY)
  const total = categoryFields.reduce((sum, f) => {
    const val = values[f]
    return sum + (typeof val === 'number' && val > 0 ? val : 0)
  }, 0)

  if (total <= 0) return null

  return (
    <p className="text-sm font-medium">
      Total: {formatCurrency(total)}/mo ({formatCurrency(total * 12)}/yr)
    </p>
  )
}

export function ExpenseBenchmarkHints({ values, ownsProperty }: { values: Record<string, unknown>; ownsProperty: boolean }) {
  return (
    <div className="space-y-1">
      {Object.entries(EXPENSE_CATEGORY_BENCHMARKS).map(([key, bench]) => {
        const flowField = CATEGORY_TO_FLOW_FIELD[key as ExpenseCategoryKey]
        const val = values[flowField]
        if (typeof val === 'number' && val > 0) return null
        if (key === 'rent' && ownsProperty) return null
        return (
          <p key={key} className="text-xs text-muted-foreground pl-1">
            {bench.label}: typical range {bench.range}
          </p>
        )
      })}
    </div>
  )
}
