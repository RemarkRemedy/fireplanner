import { useCallback, useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useProfileStore } from '@/stores/useProfileStore'
import { useProjection } from '@/hooks/useProjection'
import { formatCurrency } from '@/lib/utils'
import type { RetirementWithdrawal } from '@/lib/types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function RetirementWithdrawalsPanel() {
  const entries = useProfileStore((s) => s.retirementWithdrawals)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const lifeExpectancy = useProfileStore((s) => s.lifeExpectancy)
  const addEntry = useProfileStore((s) => s.addRetirementWithdrawal)
  const removeEntry = useProfileStore((s) => s.removeRetirementWithdrawal)
  const updateEntry = useProfileStore((s) => s.updateRetirementWithdrawal)
  const { rows } = useProjection()

  // Detect underfunded withdrawal years using engine-computed shortfall field
  const { underfundedAges, totalShortfall } = useMemo(() => {
    if (!rows || entries.length === 0) return { underfundedAges: [] as number[], totalShortfall: 0 }
    const ages: number[] = []
    let shortfall = 0
    for (const row of rows) {
      if (row.retirementWithdrawalShortfall > 0) {
        ages.push(row.age)
        shortfall += row.retirementWithdrawalShortfall
      }
    }
    return { underfundedAges: ages, totalShortfall: shortfall }
  }, [rows, entries.length])

  const handleAdd = useCallback(() => {
    const entry: RetirementWithdrawal = {
      id: generateId(),
      label: entries.length === 0 ? 'Home Renovation' : `Withdrawal ${entries.length + 1}`,
      amount: 50000,
      age: retirementAge + 5,
      durationYears: 1,
      inflationAdjusted: true,
    }
    addEntry(entry)
  }, [entries.length, retirementAge, addEntry])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          One-Time Retirement Withdrawals
          <InfoTooltip text="Plan for large one-off expenses during retirement such as home renovations, car purchases, medical procedures, or gifting. These are deducted from your portfolio at the specified age." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No one-time withdrawals planned. Add expected large expenses during retirement.
          </p>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={entry.label}
                onChange={(e) => updateEntry(entry.id, { label: e.target.value })}
                className="text-sm font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1 w-48"
              />
              <button
                onClick={() => removeEntry(entry.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                aria-label={`Remove ${entry.label}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <CurrencyInput
                label="Amount"
                value={entry.amount}
                onChange={(v) => updateEntry(entry.id, { amount: v })}
                tooltip="The annual withdrawal amount from your portfolio"
              />
              <NumberInput
                label="Start Age"
                value={entry.age}
                onChange={(v) => updateEntry(entry.id, { age: v })}
                min={retirementAge}
                max={lifeExpectancy}
                tooltip="Your age when this withdrawal starts"
              />
              <NumberInput
                label="Duration (years)"
                value={entry.durationYears ?? 1}
                onChange={(v) => updateEntry(entry.id, { durationYears: Math.max(1, v) })}
                min={1}
                max={Math.max(1, lifeExpectancy - entry.age)}
                tooltip="Number of years this withdrawal repeats. 1 = one-time expense."
              />
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  Inflation-adjusted
                  <InfoTooltip text="If on, the amount is in today's dollars and will be adjusted for inflation at withdrawal time." />
                </Label>
                <label className="flex items-center gap-2 text-sm h-10">
                  <input
                    type="checkbox"
                    checked={entry.inflationAdjusted}
                    onChange={(e) => updateEntry(entry.id, { inflationAdjusted: e.target.checked })}
                  />
                  <span className="text-muted-foreground text-xs">
                    {entry.inflationAdjusted ? "Today's dollars" : 'Future dollars'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        ))}

        {underfundedAges.length > 0 && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm font-medium text-destructive">
              Withdrawals exceed available funds
            </p>
            <p className="text-xs text-destructive/80 mt-1">
              At age{underfundedAges.length > 1 ? 's' : ''}{' '}
              {underfundedAges.length <= 5
                ? underfundedAges.join(', ')
                : `${underfundedAges[0]}–${underfundedAges[underfundedAges.length - 1]}`
              }, your portfolio cannot fully fund these withdrawals.
              The shortfall of {formatCurrency(totalShortfall)} is not financed.
            </p>
          </div>
        )}

        <button
          onClick={handleAdd}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="h-4 w-4" /> Add withdrawal
        </button>
      </CardContent>
    </Card>
  )
}
