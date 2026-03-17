import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useProfileStore } from '@/stores/useProfileStore'
import { useUIStore } from '@/stores/useUIStore'
import { calculateItemFireNumber, calculateBlendedSwr } from '@/lib/calculations/expenseSwr'
import { formatCurrency } from '@/lib/utils'
import { Link } from 'react-router-dom'

/**
 * Dashboard panel showing per-expense SWR breakdown.
 * Only renders when the user has at least one retirement expense item.
 */
export function ExpenseSwrPanel() {
  const items = useProfileStore((s) => s.retirementExpenseItems)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const lifeExpectancy = useProfileStore((s) => s.lifeExpectancy)
  const expectedReturn = useProfileStore((s) => s.expectedReturn)
  const inflation = useProfileStore((s) => s.inflation)
  const expenseRatio = useProfileStore((s) => s.expenseRatio)
  const useBlended = useUIStore((s) => s.useBlendedFireNumber)
  const setField = useUIStore((s) => s.setField)

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Per-Expense FIRE Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No retirement expenses itemised yet.{' '}
            <Link
              to="/inputs#section-fire-settings"
              className="text-primary hover:underline"
            >
              Add expense items
            </Link>{' '}
            to see a per-category FIRE breakdown.
          </p>
        </CardContent>
      </Card>
    )
  }

  const netRealReturn = expectedReturn - inflation - expenseRatio
  const blendedSwr = calculateBlendedSwr(items, retirementAge, lifeExpectancy, netRealReturn)
  const totalExpenses = items.reduce((sum, item) => sum + Math.max(0, item.annualAmount), 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Per-Expense FIRE Target
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="blended-toggle" className="text-xs text-muted-foreground">
              Use as primary
            </Label>
            <Switch
              id="blended-toggle"
              checked={useBlended}
              onCheckedChange={(checked) => setField('useBlendedFireNumber', checked)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Summary row */}
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Total Annual Expenses</span>
            <span className="font-semibold">{formatCurrency(totalExpenses)}/yr</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Blended SWR</span>
            <span className="font-semibold">{(blendedSwr * 100).toFixed(2)}%</span>
          </div>

          {/* Per-item breakdown */}
          <div className="border-t pt-3 space-y-2">
            {items.map((item) => {
              const itemFire = calculateItemFireNumber(item, retirementAge, lifeExpectancy, netRealReturn)
              return (
                <div key={item.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(item.swr * 100).toFixed(1)}%{item.endAge != null ? `, to ${item.endAge}` : ''})
                    </span>
                  </div>
                  <span className="font-medium tabular-nums">{formatCurrency(itemFire)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
