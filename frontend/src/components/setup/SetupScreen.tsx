import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import type { NudgeField, NudgeFlowScreen } from '@/lib/data/nudgeFlows'
import {
  validateSetupField,
  type SetupFieldContext,
} from '@/lib/validation/setupFieldValidation'

interface SetupScreenProps {
  screen: NudgeFlowScreen
  values: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  onNext: () => void
  onBack?: () => void
  currentStep: number
  totalSteps: number
  submitLabel?: string
  /** Custom content rendered between fields and buttons */
  children?: React.ReactNode
}

interface FieldRendererProps {
  field: NudgeField
  values: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  error?: string | null
}

function FieldRenderer({ field, values, onChange, error }: FieldRendererProps) {
  const labelId = useId()
  const currentValue = values[field.name]

  if (field.type === 'currency') {
    return (
      <CurrencyInput
        label={field.label}
        tooltip={field.tooltip}
        value={typeof currentValue === 'number' ? currentValue : 0}
        onChange={(v) => onChange(field.name, v)}
        error={error ?? undefined}
      />
    )
  }

  if (field.type === 'number') {
    return (
      <NumberInput
        label={field.label}
        tooltip={field.tooltip}
        value={typeof currentValue === 'number' ? currentValue : 0}
        onChange={(v) => onChange(field.name, v)}
        integer
        error={error ?? undefined}
      />
    )
  }

  if (field.type === 'percent') {
    return (
      <PercentInput
        label={field.label}
        tooltip={field.tooltip}
        value={typeof currentValue === 'number' ? currentValue : 0}
        onChange={(v) => onChange(field.name, v)}
        error={error ?? undefined}
      />
    )
  }

  if (field.type === 'toggle') {
    return (
      <div className="flex items-center gap-3">
        <Switch
          id={labelId}
          checked={typeof currentValue === 'boolean' ? currentValue : false}
          onCheckedChange={(v) => onChange(field.name, v)}
        />
        <Label htmlFor={labelId} className="text-sm cursor-pointer">
          {field.label}
        </Label>
        {field.tooltip && <InfoTooltip text={field.tooltip} />}
      </div>
    )
  }

  if (field.type === 'pill' && field.options) {
    return (
      <div className="flex flex-col gap-1">
        {field.label && (
          <Label className="text-sm">{field.label}</Label>
        )}
        <div className="inline-flex rounded-lg border p-0.5 bg-muted/50">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                currentValue === opt.value
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onChange(field.name, opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center">
          <Label htmlFor={labelId} className="text-sm">
            {field.label}
          </Label>
          {field.tooltip && <InfoTooltip text={field.tooltip} />}
        </div>
        <Select
          value={typeof currentValue === 'string' ? currentValue : ''}
          onValueChange={(v) => onChange(field.name, v)}
        >
          <SelectTrigger id={labelId}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // 'text' fallback
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={labelId} className="text-sm">
        {field.label}
      </Label>
      <input
        id={labelId}
        type="text"
        value={typeof currentValue === 'string' ? currentValue : ''}
        onChange={(e) => onChange(field.name, e.target.value)}
        className="flex h-10 w-full rounded-md border border-blue-300 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}

/** Check if a field should be visible based on showWhen condition */
function isFieldVisible(
  showWhen: NudgeField['showWhen'],
  values: Record<string, unknown>
): boolean {
  if (!showWhen) return true
  const depVal = values[showWhen.field]
  if (showWhen.greaterThanOrEqual !== undefined) {
    return typeof depVal === 'number' && depVal >= showWhen.greaterThanOrEqual
  }
  return depVal === showWhen.equals
}

export function SetupScreen({
  screen,
  values,
  onChange,
  onNext,
  onBack,
  currentStep,
  totalSteps,
  submitLabel = 'Continue',
  children,
}: SetupScreenProps) {
  const [requiredErrors, setRequiredErrors] = useState<Set<string>>(new Set())

  // Build cross-field context for validation
  const validationContext: SetupFieldContext = useMemo(
    () => ({
      currentAge: typeof values.currentAge === 'number' ? values.currentAge : undefined,
      retirementAge: typeof values.retirementAge === 'number' ? values.retirementAge : undefined,
      propertyValue: typeof values.propertyValue === 'number' ? values.propertyValue : undefined,
    }),
    [values.currentAge, values.retirementAge, values.propertyValue],
  )

  // Compute validation errors for all visible fields on this screen
  const fieldErrors = useMemo(() => {
    const errors: Record<string, string | null> = {}
    for (const field of screen.fields) {
      // Skip hidden fields
      if (field.showWhen && !isFieldVisible(field.showWhen, values)) continue
      }
      const key = field.validationKey ?? field.name
      const val = values[field.name]
      // Only validate numeric/currency/percent fields that have a value set
      if (val === undefined || val === null || val === '') continue
      errors[field.name] = validateSetupField(key, val, validationContext)
    }
    return errors
  }, [screen.fields, values, validationContext])

  const hasValidationErrors = Object.values(fieldErrors).some((e) => e != null)

  return (
    <form
      aria-label={screen.title}
      onSubmit={(e) => {
        e.preventDefault()
        // Validate required fields before advancing
        const missing = screen.fields.filter((f) => {
          if (!f.required) return false
          // Skip hidden fields
          if (f.showWhen && !isFieldVisible(f.showWhen, values)) return false
          }
          const val = values[f.name]
          return val === undefined || val === null || val === ''
        })
        if (missing.length > 0) {
          setRequiredErrors(new Set(missing.map((f) => f.name)))
          return
        }
        // Block if any field has a validation error
        if (hasValidationErrors) return
        setRequiredErrors(new Set())
        onNext()
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {currentStep} of {totalSteps}
          </span>
        </div>
        <progress
          aria-label="Setup progress"
          value={currentStep}
          max={totalSteps}
          aria-valuenow={currentStep}
          aria-valuemax={totalSteps}
          className="w-full h-1.5 rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
        />
      </div>

      <h2 className="text-xl font-semibold">{screen.title}</h2>

      <div className="flex flex-col gap-4">
        {screen.fields.map((field) => {
          // Field-level conditional visibility
          if (field.showWhen && !isFieldVisible(field.showWhen, values)) return null
          }
          const validationError = fieldErrors[field.name] ?? null
          return (
          <div key={field.name}>
            <FieldRenderer
              field={field}
              values={values}
              error={validationError}
              onChange={(name, value) => {
                setRequiredErrors((prev) => {
                  if (!prev.has(name)) return prev
                  const next = new Set(prev)
                  next.delete(name)
                  return next
                })
                onChange(name, value)
              }}
            />
            {field.helperText && !validationError && (
              <p className="mt-1 text-xs text-muted-foreground">{field.helperText}</p>
            )}
            {validationError && !['currency', 'number', 'percent'].includes(field.type) && (
              <p className="mt-1 text-xs text-destructive">{validationError}</p>
            )}
            {requiredErrors.has(field.name) && !validationError && (
              <p className="mt-1 text-xs text-destructive">This field is required</p>
            )}
          </div>
          )
        })}
      </div>

      {children}

      <div className="flex items-center gap-3 pt-2">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        <Button
          type="submit"
          className={onBack ? 'flex-1' : 'w-full'}
          disabled={hasValidationErrors}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function shouldSkipScreen(
  screen: { skipWhen?: { field: string; equals?: string | boolean; notEquals?: string | boolean } },
  values: Record<string, unknown>,
): boolean {
  if (!screen.skipWhen) return false
  const actual = values[screen.skipWhen.field]
  if (screen.skipWhen.notEquals !== undefined) {
    return actual !== screen.skipWhen.notEquals
  }
  return actual === screen.skipWhen.equals
}
