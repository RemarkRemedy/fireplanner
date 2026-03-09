import { useCallback, useEffect, useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/shared/InfoTooltip'

interface NullableNumberInputProps {
  value: number | null
  onChange: (value: number | null) => void
  integer?: boolean
  min?: number
  max?: number
  step?: number
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  label?: string
  tooltip?: string
  error?: string
}

export function NullableNumberInput({
  value,
  onChange,
  integer = false,
  min,
  max,
  step,
  placeholder,
  className,
  disabled,
  id,
  label,
  tooltip,
  error,
}: NullableNumberInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [localValue, setLocalValue] = useState(value === null ? '' : String(value))
  const [isFocused, setIsFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const errorId = `${inputId}-error`

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value === null ? '' : String(value))
      setTouched(false)
    }
  }, [isFocused, value])

  const clamp = useCallback((nextValue: number) => {
    let clamped = nextValue
    if (min !== undefined && clamped < min) clamped = min
    if (max !== undefined && clamped > max) clamped = max
    return clamped
  }, [max, min])

  /** W51: Only emit null on genuinely empty input. For intermediate typing states, keep previous value. */
  const parseValue = useCallback((rawValue: string): number | null => {
    if (rawValue.trim() === '') {
      return null
    }

    const parsed = integer ? parseInt(rawValue, 10) : parseFloat(rawValue)
    if (Number.isNaN(parsed)) {
      return value // keep previous value during intermediate typing (e.g., "-", ".", "1e")
    }

    return clamp(parsed)
  }, [clamp, integer, value])

  const input = (
    <Input
      id={inputId}
      type="number"
      inputMode="numeric"
      value={localValue}
      onChange={(event) => {
        const nextValue = event.target.value
        setLocalValue(nextValue)
        onChange(parseValue(nextValue))
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setTouched(true)
        setIsFocused(false)
        const nextValue = parseValue(localValue)
        onChange(nextValue)
        setLocalValue(nextValue === null ? '' : String(nextValue))
      }}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      aria-describedby={touched && error ? errorId : undefined}
    />
  )

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
