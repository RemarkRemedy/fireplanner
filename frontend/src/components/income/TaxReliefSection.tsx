import { useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { formatCurrency } from '@/lib/utils'
import {
  computeTotalReliefs,
  getDefaultBreakdown,
  earnedIncomeReliefForAge,
  RELIEF_AMOUNTS,
  type ReliefBreakdown,
  type NsmanStatus,
  type ParentReliefType,
} from '@/lib/data/taxBrackets'
import { calculateCpfContribution } from '@/lib/calculations/cpf'
import { calculateSrsDeduction } from '@/lib/calculations/tax'
import { RSTU_TAX_RELIEF_CAP } from '@/lib/data/cpfRates'

const NSMAN_OPTIONS: { value: NsmanStatus; label: string; amount: string }[] = [
  { value: 'none', label: 'Not applicable', amount: '$0' },
  { value: 'noDuty', label: 'No duties performed', amount: '$1,500' },
  { value: 'performedDuty', label: 'Performed duties', amount: '$3,000' },
]

const PARENT_OPTIONS: { value: ParentReliefType; label: string; amount: string }[] = [
  { value: 'none', label: 'Not applicable', amount: '$0' },
  { value: 'liveWith', label: 'Living with parent', amount: '$9,000' },
  { value: 'notLiveWith', label: 'Not living with parent', amount: '$5,500' },
]

export function TaxReliefSection() {
  const income = useIncomeStore()
  const currentAge = useProfileStore((s) => s.currentAge)
  const residencyStatus = useProfileStore((s) => s.residencyStatus)
  const prMonths = useProfileStore((s) => s.prMonths)
  const srsAnnualContribution = useProfileStore((s) => s.srsAnnualContribution)
  const cpfTopUpSA = useProfileStore((s) => s.cpfTopUpSA)
  const breakdown = income.reliefBreakdown
  const isDetailed = breakdown !== null

  // Auto-compute CPF employee contribution from current salary + bonus + age
  const cpfEmployee = useMemo(() => {
    const annualBonus = income.annualSalary * (income.bonusMonths ?? 0) / 12
    const cpf = calculateCpfContribution(income.annualSalary, currentAge, annualBonus, residencyStatus, prMonths)
    return cpf.employee
  }, [income.annualSalary, income.bonusMonths, currentAge, residencyStatus, prMonths])

  // Auto-compute SRS deduction (capped per residency)
  const srsDeduction = useMemo(
    () => calculateSrsDeduction(srsAnnualContribution, residencyStatus),
    [srsAnnualContribution, residencyStatus]
  )

  // Auto-compute RSTU deduction (capped at $8,000, only applies with active salary)
  const rstuDeduction = useMemo(
    () => income.annualSalary > 0 ? Math.min(cpfTopUpSA ?? 0, RSTU_TAX_RELIEF_CAP) : 0,
    [cpfTopUpSA, income.annualSalary]
  )

  const toggleMode = useCallback((detailed: boolean) => {
    if (detailed) {
      // Switch to Detailed: create default breakdown, keep it close to current personalReliefs
      const bd = getDefaultBreakdown(currentAge)
      // Set otherReliefs to make total match current personalReliefs
      const baseTotal = computeTotalReliefs(bd, currentAge)
      const diff = Math.max(0, income.personalReliefs - baseTotal)
      income.setReliefBreakdown({ ...bd, otherReliefs: diff })
    } else {
      // Switch to Simple: keep current personalReliefs, clear breakdown
      income.setReliefBreakdown(null)
    }
  }, [currentAge, income])

  const updateBreakdown = useCallback(<K extends keyof ReliefBreakdown>(
    key: K,
    value: ReliefBreakdown[K],
  ) => {
    if (!breakdown) return
    income.setReliefBreakdown({ ...breakdown, [key]: value })
  }, [breakdown, income])

  const earnedIncome = useMemo(() => earnedIncomeReliefForAge(currentAge), [currentAge])

  const computedTotal = useMemo(() => {
    if (!breakdown) return income.personalReliefs
    return computeTotalReliefs(breakdown, currentAge)
  }, [breakdown, currentAge, income.personalReliefs])

  const isOverCap = computedTotal >= RELIEF_AMOUNTS.reliefCap

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          Personal Tax Reliefs
          <InfoTooltip text="Annual personal tax reliefs reduce your chargeable income. Use Simple mode for a single number, or Detailed mode for a breakdown of individual IRAS reliefs (YA 2025)." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => toggleMode(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              !isDetailed
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => toggleMode(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isDetailed
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Detailed
          </button>
        </div>

        {!isDetailed ? (
          /* Simple Mode */
          <div className="max-w-sm">
            <CurrencyInput
              label="Personal Reliefs"
              value={income.personalReliefs}
              onChange={(v) => income.setField('personalReliefs', v)}
              error={income.validationErrors.personalReliefs}
              tooltip="Annual personal tax reliefs (earned income, NSman, spouse, children, parents, etc.). Do NOT include CPF or SRS here — those are deducted automatically below."
            />
          </div>
        ) : (
          /* Detailed Mode */
          <div className="space-y-4">
            {/* Earned Income Relief */}
            <div className="space-y-1">
              <Label className="text-sm flex items-center gap-1">
                Earned Income Relief
                <InfoTooltip text="Automatically determined by age. Under 55: $1,000. Age 55-59: $6,000. Age 60+: $8,000." source="IRAS" sourceUrl="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs/earned-income-relief" />
              </Label>
              <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-muted text-sm font-medium">
                {formatCurrency(earnedIncome)}
                <span className="ml-2 text-xs text-muted-foreground">
                  (age {currentAge < 55 ? '<55' : currentAge < 60 ? '55-59' : '60+'})
                </span>
              </div>
            </div>

            {/* NSman Relief */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm flex items-center gap-1">
                  NSman Relief
                  <InfoTooltip text="For operationally ready NSmen. No duties: $1,500. Performed duties: $3,000." />
                </Label>
                <Select
                  value={breakdown.nsmanStatus}
                  onValueChange={(v) => updateBreakdown('nsmanStatus', v as NsmanStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NSMAN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} ({opt.amount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {breakdown.nsmanStatus !== 'none' && (
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={breakdown.nsmanKAH}
                      onChange={(e) => updateBreakdown('nsmanKAH', e.target.checked)}
                    />
                    Key Appointment Holder (+$2,000)
                  </label>
                </div>
              )}
            </div>

            {/* Spouse Relief */}
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={breakdown.spouseRelief}
                  onChange={(e) => updateBreakdown('spouseRelief', e.target.checked)}
                />
                Spouse Relief ($2,000)
                <InfoTooltip text="Available if your spouse's income is below $4,000 in the previous year." />
              </label>
            </div>

            {/* Child Relief */}
            <div className="space-y-1">
              <Label className="text-sm flex items-center gap-1">
                Qualifying Child Relief (QCR)
                <InfoTooltip text="$4,000 per qualifying child (unmarried, under 16, or in full-time education)." />
              </Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateBreakdown('nChildren', Math.max(0, breakdown.nChildren - 1))}
                  className="w-8 h-8 rounded-md border flex items-center justify-center text-lg hover:bg-muted transition-colors"
                  disabled={breakdown.nChildren === 0}
                >
                  -
                </button>
                <span className="text-sm font-medium w-16 text-center">
                  {breakdown.nChildren} child{breakdown.nChildren !== 1 ? 'ren' : ''}
                </span>
                <button
                  onClick={() => updateBreakdown('nChildren', Math.min(10, breakdown.nChildren + 1))}
                  className="w-8 h-8 rounded-md border flex items-center justify-center text-lg hover:bg-muted transition-colors"
                >
                  +
                </button>
                {breakdown.nChildren > 0 && (
                  <span className="text-sm text-muted-foreground">
                    = {formatCurrency(breakdown.nChildren * RELIEF_AMOUNTS.childPerChild)}
                  </span>
                )}
              </div>
            </div>

            {/* Parent Relief */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm flex items-center gap-1">
                  Parent Relief
                  <InfoTooltip text="For supporting parents/grandparents (age 55+ or handicapped). Living with: $9,000. Not living with: $5,500." />
                </Label>
                <Select
                  value={breakdown.parentReliefType}
                  onValueChange={(v) => updateBreakdown('parentReliefType', v as ParentReliefType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARENT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} ({opt.amount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {breakdown.parentReliefType !== 'none' && (
                <div className="space-y-1">
                  <Label className="text-sm">Number of Parents</Label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateBreakdown('nParents', Math.max(0, breakdown.nParents - 1))}
                      className="w-8 h-8 rounded-md border flex items-center justify-center text-lg hover:bg-muted transition-colors"
                      disabled={breakdown.nParents === 0}
                    >
                      -
                    </button>
                    <span className="text-sm font-medium w-8 text-center">{breakdown.nParents}</span>
                    <button
                      onClick={() => updateBreakdown('nParents', Math.min(4, breakdown.nParents + 1))}
                      className="w-8 h-8 rounded-md border flex items-center justify-center text-lg hover:bg-muted transition-colors"
                    >
                      +
                    </button>
                    {breakdown.nParents > 0 && (
                      <span className="text-sm text-muted-foreground">
                        = {formatCurrency(breakdown.nParents * RELIEF_AMOUNTS.parent[breakdown.parentReliefType])}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Other Reliefs */}
            <div className="max-w-sm">
              <CurrencyInput
                label="Other Reliefs"
                value={breakdown.otherReliefs}
                onChange={(v) => updateBreakdown('otherReliefs', v)}
                tooltip="Catch-all for WMCR, course fees, life insurance, CPF top-up relief, and other IRAS reliefs not listed above."
              />
            </div>

            {/* Computed Total — Personal Reliefs */}
            <div className={`p-3 rounded-md text-sm ${isOverCap ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Personal Reliefs:</span>
                <span className="font-semibold text-base">{formatCurrency(computedTotal)}</span>
              </div>
              {isOverCap && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Capped at {formatCurrency(RELIEF_AMOUNTS.reliefCap)} (<a href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs" target="_blank" rel="noopener noreferrer" className="underline">IRAS personal relief cap</a>)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Auto-calculated deductions: CPF Relief + SRS — always visible in both modes */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Auto-calculated deductions</p>

          {/* CPF Relief (Employee) */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              CPF Relief (Employee)
              <InfoTooltip text="Employee CPF contribution is automatically deducted from your taxable income. Computed from your salary and age, subject to the OW ceiling ($8,000/month from 2026) and annual salary ceiling ($102,000). Do not include this in Personal Reliefs above." source="IRAS" sourceUrl="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs/central-provident-fund(cpf)-relief-for-employees" />
            </span>
            <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(cpfEmployee)}</span>
          </div>

          {/* SRS Deduction */}
          {srsDeduction > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                SRS Deduction
                <InfoTooltip text={`SRS contributions are tax-deductible up to ${residencyStatus === 'foreigner' ? '$35,700' : '$15,300'}/year. Set your annual SRS contribution in the FIRE Profile section. Do not include this in Personal Reliefs above.`} source="IRAS" sourceUrl="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/special-tax-schemes/srs-contributions" />
              </span>
              <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(srsDeduction)}</span>
            </div>
          )}

          {/* RSTU Deduction (SA Top-Up) */}
          {rstuDeduction > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                RSTU Relief (SA Top-Up)
                <InfoTooltip text="Cash top-up to SA (or RA if 55+) qualifies for tax relief up to $8,000/year. Set your annual SA top-up in the CPF section. Do not include this in Personal Reliefs above." source="IRAS" sourceUrl="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs/central-provident-fund-(cpf)-cash-top-up-relief" />
              </span>
              <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(rstuDeduction)}</span>
            </div>
          )}

          {/* Grand Total */}
          <div className="flex items-center justify-between text-sm pt-2 border-t border-dashed">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              Total Tax Deductions
              <InfoTooltip text="Sum of personal reliefs, CPF employee contribution, SRS deduction, and RSTU relief — all subtracted from gross income to arrive at chargeable income." />
            </span>
            <span className="font-bold text-base">{formatCurrency(computedTotal + cpfEmployee + srsDeduction + rstuDeduction)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
