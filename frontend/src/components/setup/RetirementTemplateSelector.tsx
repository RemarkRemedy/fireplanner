import { useState } from 'react'
import { NumberInput } from '@/components/shared/NumberInput'
import { cn, formatCurrency } from '@/lib/utils'
import { RETIREMENT_TEMPLATES, EXPENSE_CATEGORY_KEYS } from '@/lib/data/retirementTemplates'
import { computeWeightedRetirementRatio } from '@/lib/calculations/expenses'

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Housing / Rent',
  food: 'Food & Groceries',
  transport: 'Transport',
  utilities: 'Utilities',
  entertainment: 'Entertainment',
  travel: 'Travel',
  other: 'Other',
}

interface RetirementTemplateSelectorProps {
  breakdown: Record<string, number>
  templateId: string
  multipliers: Record<string, number>
  ownsProperty: boolean
  onChange: (field: string, value: unknown) => void
}

export function RetirementTemplateSelector({
  breakdown,
  templateId,
  multipliers,
  ownsProperty,
  onChange,
}: RetirementTemplateSelectorProps) {
  const [showCustomize, setShowCustomize] = useState(templateId === 'custom')

  const handleTemplateSelect = (id: string) => {
    const template = RETIREMENT_TEMPLATES.find((t) => t.id === id)
    if (!template) return
    onChange('templateId', id)
    onChange('multipliers', template.multipliers)
  }

  const handleMultiplierChange = (category: string, value: number) => {
    onChange('multipliers', { ...multipliers, [category]: value })
    onChange('templateId', 'custom')
  }

  // Categories that have a positive amount (skip rent if property is owned)
  const activeCategories = EXPENSE_CATEGORY_KEYS.filter((key) => {
    if (key === 'rent' && ownsProperty) return false
    return (breakdown[key] ?? 0) > 0
  })

  const totalMonthly = Object.values(breakdown).reduce(
    (sum, v) => sum + Math.max(0, v),
    0,
  )
  const ratio = computeWeightedRetirementRatio(breakdown, multipliers)
  const retirementMonthly = Math.round(totalMonthly * ratio)

  return (
    <div className="flex flex-col gap-4">
      {/* Template cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {RETIREMENT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => handleTemplateSelect(template.id)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              templateId === template.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-primary/50',
            )}
          >
            <p className="text-sm font-medium">{template.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {template.description}
            </p>
          </button>
        ))}
      </div>

      {/* Customize toggle */}
      <button
        type="button"
        onClick={() => setShowCustomize(!showCustomize)}
        className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {showCustomize ? 'Hide per-category editor' : 'Customize per category'}
      </button>

      {/* Per-category multiplier editor */}
      {showCustomize && activeCategories.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Category</span>
            <span className="w-20 text-right">Current</span>
            <span className="w-20 text-center">Multiplier</span>
            <span className="w-20 text-right">Retirement</span>
          </div>
          {activeCategories.map((key) => {
            const amount = breakdown[key] ?? 0
            const mult = multipliers[key] ?? 1.0
            const retAmount = Math.round(amount * Math.min(5.0, Math.max(0, mult)))
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-1 py-1"
              >
                <span className="text-sm">
                  {CATEGORY_LABELS[key] ?? key}
                </span>
                <span className="w-20 text-right text-sm text-muted-foreground">
                  {formatCurrency(amount)}
                </span>
                <div className="w-20">
                  <NumberInput
                    value={mult}
                    onChange={(v) => handleMultiplierChange(key, v)}
                    min={0}
                    max={5}
                    step={0.1}
                  />
                </div>
                <span className="w-20 text-right text-sm font-medium">
                  {formatCurrency(retAmount)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {totalMonthly > 0 && (
        <p className="text-sm text-muted-foreground">
          Estimated retirement spending:{' '}
          <span className="font-medium text-foreground">
            ~{formatCurrency(retirementMonthly)}/mo
          </span>{' '}
          ({Math.round(ratio * 100)}% of current)
        </p>
      )}
    </div>
  )
}
