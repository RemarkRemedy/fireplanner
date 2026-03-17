import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { NullableNumberInput } from '@/components/shared/NullableNumberInput'
import { useProfileStore } from '@/stores/useProfileStore'
import type { ExpenseFlexibility, RetirementExpenseItem } from '@/lib/types'

const FLEXIBILITY_OPTIONS: { value: ExpenseFlexibility; label: string }[] = [
  { value: 'essential', label: 'Essential' },
  { value: 'fixed-term', label: 'Fixed-term' },
  { value: 'flexible', label: 'Flexible' },
]

const DEFAULT_SWR_BY_FLEXIBILITY: Record<ExpenseFlexibility, number> = {
  essential: 0.0325,
  'fixed-term': 0.04,
  flexible: 0.05,
}

function makeDefaultItem(): RetirementExpenseItem {
  return {
    id: crypto.randomUUID(),
    label: '',
    annualAmount: 0,
    flexibility: 'essential',
    swr: DEFAULT_SWR_BY_FLEXIBILITY.essential,
  }
}

/**
 * Input component for itemising retirement expenses with per-item SWR.
 * Each item has: label, annual amount, flexibility category, SWR override, optional end age.
 */
export function ExpenseItemiser() {
  const items = useProfileStore((s) => s.retirementExpenseItems)
  const addItem = useProfileStore((s) => s.addRetirementExpenseItem)
  const removeItem = useProfileStore((s) => s.removeRetirementExpenseItem)
  const updateItem = useProfileStore((s) => s.updateRetirementExpenseItem)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Retirement Expense Breakdown
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Itemise your retirement spending to assign different withdrawal rates per category.
          Essential expenses get a conservative SWR; flexible spending can tolerate a higher rate.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No items yet. Add your first expense category below.
          </p>
        )}

        {items.map((item) => (
          <ExpenseItemRow
            key={item.id}
            item={item}
            onUpdate={(updates) => updateItem(item.id, updates)}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => addItem(makeDefaultItem())}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Expense
        </Button>
      </CardContent>
    </Card>
  )
}

function ExpenseItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: RetirementExpenseItem
  onUpdate: (updates: Partial<Omit<RetirementExpenseItem, 'id'>>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Label</Label>
          <Input
            value={item.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g. Housing, Food, Transport"
            className="border-blue-300"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="mt-5 text-muted-foreground hover:text-destructive"
          aria-label="Remove expense item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CurrencyInput
          label="Annual Amount"
          value={item.annualAmount}
          onChange={(value) => onUpdate({ annualAmount: value })}
          tooltip="Annual cost in today's dollars (real terms)"
        />

        <div className="flex flex-col gap-1">
          <Label className="text-sm">Flexibility</Label>
          <Select
            value={item.flexibility}
            onValueChange={(value: ExpenseFlexibility) => {
              onUpdate({
                flexibility: value,
                swr: DEFAULT_SWR_BY_FLEXIBILITY[value],
              })
            }}
          >
            <SelectTrigger className="border-blue-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FLEXIBILITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PercentInput
          label="SWR"
          value={item.swr}
          onChange={(value) => onUpdate({ swr: value })}
          tooltip="Safe withdrawal rate for this expense. Lower = more conservative."
        />

        <NullableNumberInput
          label="End Age"
          value={item.endAge ?? null}
          onChange={(value) => onUpdate({ endAge: value ?? undefined })}
          tooltip="Leave blank for lifetime. Set an age to make this a fixed-term expense."
          placeholder="Lifetime"
        />
      </div>
    </div>
  )
}
