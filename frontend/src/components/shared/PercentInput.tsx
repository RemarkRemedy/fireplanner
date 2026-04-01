import { useState, useCallback, useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { cn } from '@/lib/utils'

interface PercentInputProps {
  label?: string
  /** Stored as decimal (e.g. 0.04 for 4%) */
  value: number
  onChange: (value: number) => void
  error?: string
  tooltip?: string
  className?: string
  step?: number
  disabled?: boolean
}

function toDisplay(decimal: number): string {
  return parseFloat((decimal * 100).toPrecision(12)).toFixed(1)
}

export function PercentInput({
  label,
  value,
  onChange,
  error,
  tooltip,
  className,
  step = 0.1,
  disabled,
}: PercentInputProps) {
  const inputId = useId()
  const [localValue, setLocalValue] = useState(() => toDisplay(value))
  const [prevValue, setPrevValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const errorId = `${inputId}-error`

  // Sync from props during render when NOT focused (handles resets, rehydration, external changes)
  if (value !== prevValue) {
    setPrevValue(value)
    if (!isFocused) {
      setLocalValue(toDisplay(value))
      setTouched(false)
    }
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      setLocalValue(raw)

      const pct = parseFloat(raw)
      if (!isNaN(pct)) {
        onChange(pct / 100)
      }
    },
    [onChange]
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setTouched(true)
    setIsFocused(false)
    const pct = parseFloat(localValue)
    if (isNaN(pct) || localValue.trim() === '') {
      // Revert to current store value
      setLocalValue(toDisplay(value))
    } else {
      // Reformat to canonical display
      setLocalValue(toDisplay(pct / 100))
    }
  }, [localValue, value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur()
      }
    },
    []
  )

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <Label htmlFor={inputId} className="flex min-h-[4.5rem] items-start gap-1 text-sm leading-snug">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </Label>
      )}
      <div className="relative">
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          step={step}
          className={cn(
            'pr-7 border-blue-300',
            touched && error && 'border-destructive'
          )}
          disabled={disabled}
          aria-describedby={touched && error ? errorId : undefined}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          %
        </span>
      </div>
      {touched && error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
