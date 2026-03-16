import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { Label } from '@/components/ui/label'
import { getCpfEmployeeRateLabel, isAboveOwCeiling } from '@/lib/calculations/grossUp'

export interface MonthlyIncomeInputProps {
  incomeType: 'take-home' | 'gross'
  onIncomeTypeChange: (type: 'take-home' | 'gross') => void
  monthlyIncome: number
  onMonthlyIncomeChange: (value: number) => void
  hasBonusAws: boolean
  onHasBonusAwsChange: (checked: boolean) => void
  bonusMonths: number
  onBonusMonthsChange: (value: number) => void
  grossMonthly: number
  annualIncome: number
  age: number
  /** Optional unique ID suffix for checkbox, needed when multiple instances exist on the same page */
  idSuffix?: string
}

export function MonthlyIncomeInput({
  incomeType,
  onIncomeTypeChange,
  monthlyIncome,
  onMonthlyIncomeChange,
  hasBonusAws,
  onHasBonusAwsChange,
  bonusMonths,
  onBonusMonthsChange,
  grossMonthly,
  annualIncome,
  age,
  idSuffix = '',
}: MonthlyIncomeInputProps) {
  const checkboxId = `bonus-aws${idSuffix}`
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm flex items-center gap-1">
        Monthly Income
        <InfoTooltip text="Your monthly salary. Toggle between take-home (after employee CPF) and gross (before employee CPF, excludes employer's CPF) inside the input." />
      </Label>

      {/* Dollar input with sliding take-home/gross toggle as prefix */}
      <div className="relative">
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 flex rounded-full bg-muted border border-border/50 p-px text-[10px] leading-tight">
          <div
            className="absolute top-px bottom-px rounded-full bg-primary transition-all duration-200 ease-in-out"
            style={{
              left: incomeType === 'take-home' ? '1px' : 'var(--slider-left)',
              width: incomeType === 'take-home' ? 'var(--take-home-w)' : 'var(--gross-w)',
            }}
          />
          <button
            type="button"
            ref={(el) => {
              if (el) el.parentElement?.style.setProperty('--take-home-w', `${el.offsetWidth}px`)
            }}
            onClick={() => onIncomeTypeChange('take-home')}
            className={`relative z-10 px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors duration-200 ${
              incomeType === 'take-home' ? 'text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Take-home
          </button>
          <button
            type="button"
            ref={(el) => {
              if (el) {
                const parent = el.parentElement!
                parent.style.setProperty('--gross-w', `${el.offsetWidth}px`)
                parent.style.setProperty('--slider-left', `${el.offsetLeft}px`)
              }
            }}
            onClick={() => onIncomeTypeChange('gross')}
            className={`relative z-10 px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors duration-200 ${
              incomeType === 'gross' ? 'text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Gross
          </button>
        </div>
        <span className="absolute left-[7.4rem] top-1/2 -translate-y-1/2 text-muted-foreground text-sm z-10">$</span>
        <NumberInput
          value={monthlyIncome}
          onChange={onMonthlyIncomeChange}
          integer
          formatWithCommas
          className="pl-[8.5rem] border-blue-300"
        />
      </div>

      {/* Bonus / AWS checkbox */}
      <div className="flex items-center gap-2 mt-1">
        <Checkbox
          id={checkboxId}
          checked={hasBonusAws}
          onCheckedChange={(checked) => onHasBonusAwsChange(checked === true)}
        />
        <label htmlFor={checkboxId} className="text-xs text-muted-foreground cursor-pointer">
          I receive a yearly bonus (13th month / AWS)
        </label>
        {hasBonusAws && (
          <div className="flex items-center gap-1">
            <NumberInput
              value={bonusMonths}
              onChange={onBonusMonthsChange}
              min={0}
              max={6}
              step={0.1}
              className="w-16 h-7 text-xs border-blue-300"
            />
            <span className="text-xs text-muted-foreground">extra month(s)</span>
          </div>
        )}
      </div>

      {/* Transparency line */}
      <div className="text-xs text-muted-foreground mt-1">
        {incomeType === 'take-home' && monthlyIncome > 0 ? (
          <>
            <div>
              Estimated gross: ~${grossMonthly.toLocaleString('en-SG', { maximumFractionDigits: 0 })}/mo
              {' '}(~${annualIncome.toLocaleString('en-SG', { maximumFractionDigits: 0 })}/year)
            </div>
            <div className="text-muted-foreground/70">
              Based on {getCpfEmployeeRateLabel(age)} employee CPF
              {isAboveOwCeiling(monthlyIncome, age) ? ' (capped at $8,000/mo ceiling)' : ''}
            </div>
          </>
        ) : monthlyIncome > 0 ? (
          <div>(~${annualIncome.toLocaleString('en-SG', { maximumFractionDigits: 0 })}/year)</div>
        ) : null}
      </div>
    </div>
  )
}

export interface MonthlyExpenseInputProps {
  monthlyExpenses: number
  onMonthlyExpensesChange: (value: number) => void
  annualExpenses: number
  /** Optional custom label override */
  label?: string
  /** Optional custom tooltip override */
  tooltip?: string
}

export function MonthlyExpenseInput({
  monthlyExpenses,
  onMonthlyExpensesChange,
  annualExpenses,
  label = 'Monthly Expenses',
  tooltip = 'Excludes healthcare insurance and mortgage. Those are modelled separately in their own sections.',
}: MonthlyExpenseInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <CurrencyInput
        label={label}
        value={monthlyExpenses}
        onChange={onMonthlyExpensesChange}
        tooltip={tooltip}
      />
      {monthlyExpenses > 0 && (
        <div className="text-xs text-muted-foreground">
          (~${annualExpenses.toLocaleString('en-SG', { maximumFractionDigits: 0 })}/year)
        </div>
      )}
    </div>
  )
}

export interface NetWorthInputProps {
  value: number
  onChange: (value: number) => void
}

export function NetWorthInput({ value, onChange }: NetWorthInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <CurrencyInput
        label="Cash & Investments"
        value={value}
        onChange={onChange}
        tooltip="Cash, savings, stocks, bonds, and other investments, excluding CPF and property"
      />
      <div className="text-xs text-muted-foreground">
        Savings, stocks, bonds. Not CPF or property
      </div>
    </div>
  )
}
