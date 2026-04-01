import { useState, useId } from 'react'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/shared/NumberInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  currency?: 'SGD' | 'USD'
  error?: string
  tooltip?: string
  className?: string
  disabled?: boolean
}

export function CurrencyInput({
  label,
  value,
  onChange,
  currency = 'SGD',
  error,
  tooltip,
  className,
  disabled,
}: CurrencyInputProps) {
  const inputId = useId()
  const [touched, setTouched] = useState(false)
  const errorId = `${inputId}-error`
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={inputId} className="flex items-start gap-1 text-sm leading-snug">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </Label>
      <div className="relative" onBlur={() => setTouched(true)}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          {currency === 'USD' ? 'US$' : 'S$'}
        </span>
        <NumberInput
          id={inputId}
          value={value}
          onChange={onChange}
          integer
          formatWithCommas
          className={cn(
            'pl-7 border-blue-300',
            touched && error && 'border-destructive'
          )}
          disabled={disabled}
        />
      </div>
      {touched && error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
