import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'

export interface SliderConfig {
  key: string
  label: string
  value: number
  originalValue: number
  min: number
  max: number
  step: number
  type: 'currency' | 'number' | 'percent'
  onChange: (value: number) => void
}

interface SliderTabProps {
  sliders: SliderConfig[]
  onReset: () => void
}

function SliderRow({ config }: { config: SliderConfig }) {
  const { label, value, min, max, step, type, onChange } = config

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-medium w-28 shrink-0">{label}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleRangeChange}
        className="flex-1 accent-primary h-1.5"
        aria-label={label}
      />
      <div className="w-28 shrink-0">
        {type === 'currency' && (
          <CurrencyInput label="" value={value} onChange={onChange} />
        )}
        {type === 'number' && (
          <NumberInput value={value} onChange={onChange} integer />
        )}
        {type === 'percent' && (
          <PercentInput value={value} onChange={onChange} step={step * 100} />
        )}
      </div>
    </div>
  )
}

export function SliderTab({ sliders, onReset }: SliderTabProps) {
  return (
    <div className="space-y-3">
      {sliders.map((config) => (
        <SliderRow key={config.key} config={config} />
      ))}
      <div className="pt-1">
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Reset to original
        </button>
      </div>
    </div>
  )
}
