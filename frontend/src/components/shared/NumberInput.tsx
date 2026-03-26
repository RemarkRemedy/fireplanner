import { useState, useCallback, useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { cn } from '@/lib/utils'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  /** If true, parse as integer. Default: false (float). */
  integer?: boolean
  /** If true, display with commas on blur, strip on focus. Uses type="text" + inputMode="numeric". */
  formatWithCommas?: boolean
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
  id?: string
  label?: string
  tooltip?: string
  error?: string
  suffix?: string
}

/**
 * Number input with a local string buffer to prevent leading-zero
 * and cursor-jump issues. The raw string is kept in local state while
 * focused; the parsed number is pushed to the store on every valid
 * keystroke. On blur, the display is normalised back to the store value.
 */
export function NumberInput({
  value,
  onChange,
  integer = false,
  formatWithCommas = false,
  min,
  max,
  step,
  className,
  disabled,
  id,
  label,
  tooltip,
  error,
  suffix,
}: NumberInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const effectiveInteger = integer || formatWithCommas
  const format = useCallback((v: number) => {
    if (formatWithCommas) return Math.round(v).toLocaleString('en-SG')
    return effectiveInteger ? String(Math.round(v)) : String(v)
  }, [formatWithCommas, effectiveInteger])

  const [localValue, setLocalValue] = useState(() => format(value))
  const [prevValue, setPrevValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const errorId = `${inputId}-error`

  // Sync from props when NOT focused (handles resets, rehydration, external changes)
  if (value !== prevValue) {
    setPrevValue(value)
    if (!isFocused) {
      setLocalValue(format(value))
      setTouched(false)
    }
  }

  const clamp = useCallback((v: number) => {
    let clamped = v
    if (min !== undefined && clamped < min) clamped = min
    if (max !== undefined && clamped > max) clamped = max
    return clamped
  }, [min, max])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      setLocalValue(raw)

      const stripped = formatWithCommas ? raw.replace(/,/g, '') : raw
      const parsed = effectiveInteger ? parseInt(stripped, 10) : parseFloat(stripped)
      if (!isNaN(parsed)) {
        onChange(clamp(parsed))
      }
    },
    [onChange, effectiveInteger, formatWithCommas, clamp]
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    if (formatWithCommas) {
      setLocalValue((prev) => prev.replace(/,/g, ''))
    }
  }, [formatWithCommas])

  const handleBlur = useCallback(() => {
    setTouched(true)
    setIsFocused(false)
    const stripped = formatWithCommas ? localValue.replace(/,/g, '') : localValue
    const parsed = effectiveInteger ? parseInt(stripped, 10) : parseFloat(stripped)
    if (isNaN(parsed) || stripped.trim() === '') {
      setLocalValue(format(value))
    } else {
      const clamped = clamp(parsed)
      if (clamped !== parsed) {
        onChange(clamped)
      }
      setLocalValue(format(clamped))
    }
  }, [localValue, value, effectiveInteger, formatWithCommas, format, clamp, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur()
      }
    },
    []
  )

  const inputControl = (
    <Input
      id={inputId}
      type={formatWithCommas ? 'text' : 'number'}
      inputMode="numeric"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      min={formatWithCommas ? undefined : min}
      max={formatWithCommas ? undefined : max}
      step={formatWithCommas ? undefined : step}
      className={cn(
        'border-blue-300',
        suffix && 'pr-12',
        touched && error && 'border-destructive',
        className,
      )}
      disabled={disabled}
      aria-describedby={touched && error ? errorId : undefined}
    />
  )

  const input = suffix ? (
    <div className="relative">
      {inputControl}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  ) : inputControl

  if (!label) return input

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId} className="text-sm flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </Label>
      <div>{input}</div>
      {touched && error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
