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
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3 min-h-[44px]">
        <div className="flex-1 min-h-[44px] flex items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleRangeChange}
            className="w-full accent-primary h-2"
            aria-label={label}
          />
        </div>
        <div className="w-32 shrink-0">
          {type === 'currency' && (
            <CurrencyInput
              label=""
              value={value}
              onChange={onChange}
            />
          )}
          {type === 'number' && (
            <NumberInput
              value={value}
              onChange={onChange}
              integer
            />
          )}
          {type === 'percent' && (
            <PercentInput
              value={value}
              onChange={onChange}
              step={step * 100}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function SliderTab({ sliders, onReset }: SliderTabProps) {
  return (
    <div className="space-y-5">
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
