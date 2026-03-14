import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { MEDISAVE_BHS } from '@/lib/data/healthcarePremiums'

interface CpfSplit {
  oa: number
  sa: number
  ma: number
  ra: number
}

interface CpfSetupInputProps {
  age: number
  showRA: boolean
  mode: 'estimate' | 'know'
  onModeChange: (mode: 'estimate' | 'know') => void
  estimate: { total: number; split: CpfSplit }
  mortgage: { used: boolean; amount: number }
  onMortgageChange: (m: { used: boolean; amount: number }) => void
  manual: { entryMode: 'total' | 'breakdown'; total: number } & CpfSplit
  onManualChange: (updates: Partial<CpfSetupInputProps['manual']>) => void
}

function formatCompact(n: number): string {
  if (n >= 1000) {
    return `$${Math.round(n / 1000).toLocaleString()}K`
  }
  return `$${n.toLocaleString()}`
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5 bg-muted/50">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            value === opt.value
              ? 'bg-background shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function CpfSetupInput({
  showRA,
  mode,
  onModeChange,
  estimate,
  mortgage,
  onMortgageChange,
  manual,
  onManualChange,
}: CpfSetupInputProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <PillToggle
          options={[
            { label: 'Estimate for me', value: 'estimate' as const },
            { label: 'I know my balances', value: 'know' as const },
          ]}
          value={mode}
          onChange={onModeChange}
        />
      </div>

      {mode === 'estimate' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Based on your age and income, we estimate:
            </p>
            <p className="text-2xl font-semibold">
              ~${estimate.total.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              OA ~{formatCompact(estimate.split.oa)} · SA ~
              {formatCompact(estimate.split.sa)} · MA ~
              {formatCompact(estimate.split.ma)}
              {showRA && (
                <> · RA ~{formatCompact(estimate.split.ra)}</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="cpf-mortgage-used"
              checked={mortgage.used}
              onCheckedChange={(checked) =>
                onMortgageChange({
                  used: checked === true,
                  amount: mortgage.amount,
                })
              }
            />
            <Label htmlFor="cpf-mortgage-used" className="text-sm cursor-pointer">
              I've used CPF OA for my mortgage
            </Label>
          </div>

          {mortgage.used && (
            <CurrencyInput
              label="How much OA was used?"
              value={mortgage.amount}
              onChange={(v) => onMortgageChange({ used: true, amount: v })}
            />
          )}

          <p className="text-xs text-muted-foreground">
            This is a rough estimate. You can enter exact balances on the CPF
            details page after setup.
          </p>
        </div>
      )}

      {mode === 'know' && (
        <div className="flex flex-col gap-3">
          <div>
            <PillToggle
              options={[
                { label: 'Total', value: 'total' as const },
                { label: 'By account', value: 'breakdown' as const },
              ]}
              value={manual.entryMode}
            onChange={(v) => onManualChange({ entryMode: v })}
          />
          </div>

          {manual.entryMode === 'total' && (
            <div className="flex flex-col gap-2">
              <CurrencyInput
                label="Total CPF balance"
                value={manual.total}
                onChange={(v) => onManualChange({ total: v })}
              />
              <p className="text-xs text-muted-foreground">
                We'll split it by age-based heuristics.
              </p>
            </div>
          )}

          {manual.entryMode === 'breakdown' && (
            <div className="flex flex-col gap-3">
              <CurrencyInput
                label="Ordinary Account (OA)"
                value={manual.oa}
                onChange={(v) => onManualChange({ oa: v })}
                tooltip="Used for housing, education, and investment. Earns 2.5% interest."
              />
              <CurrencyInput
                label="Special Account (SA)"
                value={manual.sa}
                onChange={(v) => onManualChange({ sa: v })}
                tooltip="For retirement. Earns 4% interest."
              />
              <CurrencyInput
                label="MediSave Account (MA)"
                value={manual.ma}
                onChange={(v) => onManualChange({ ma: v })}
                tooltip={`For healthcare. Capped at BHS ($${MEDISAVE_BHS.toLocaleString()} in 2026).`}
                error={
                  manual.ma > MEDISAVE_BHS
                    ? `MediSave cannot exceed the BHS of $${MEDISAVE_BHS.toLocaleString()}`
                    : undefined
                }
              />
              {showRA && (
                <CurrencyInput
                  label="Retirement Account (RA)"
                  value={manual.ra}
                  onChange={(v) => onManualChange({ ra: v })}
                  tooltip="Created at age 55."
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
