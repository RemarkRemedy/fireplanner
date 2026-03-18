import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calculator, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/lib/utils'
import { calculateProgressiveTax, calculateChargeableIncome } from '@/lib/calculations/tax'
import { projectSrsBalance, compareSrsVsRstu } from '@/lib/calculations/srs'
import { SRS_ANNUAL_CAP, SRS_ANNUAL_CAP_FOREIGNER } from '@/lib/data/taxBrackets'

type ResidencyStatus = 'citizen' | 'pr' | 'foreigner'

/** Assumed investment return for SRS balance projection */
const DEFAULT_RETURN = 0.05
/** SRS statutory retirement age for penalty-free withdrawal */
const SRS_RETIREMENT_AGE = 63

interface ValidationErrors {
  income?: string
  age?: string
  contribution?: string
}

function validate(income: number, age: number, contribution: number): ValidationErrors {
  const errors: ValidationErrors = {}
  if (income <= 0) errors.income = 'Annual income must be greater than 0'
  if (age < 18 || age > 62) errors.age = 'Age must be between 18 and 62'
  if (contribution < 0) errors.contribution = 'Contribution cannot be negative'
  return errors
}

export function SrsMiniCalculator() {
  const [annualIncome, setAnnualIncome] = useState(120_000)
  const [age, setAge] = useState(35)
  const [srsContribution, setSrsContribution] = useState(15_300)
  const [residency, setResidency] = useState<ResidencyStatus>('citizen')
  const [hasCalculated, setHasCalculated] = useState(false)
  const [showProjection, setShowProjection] = useState(false)

  const cap = residency === 'foreigner' ? SRS_ANNUAL_CAP_FOREIGNER : SRS_ANNUAL_CAP

  const errors = useMemo(() => validate(annualIncome, age, srsContribution), [annualIncome, age, srsContribution])
  const isValid = Object.keys(errors).length === 0

  const results = useMemo(() => {
    if (!isValid || !hasCalculated) return null

    const effectiveContribution = Math.min(srsContribution, cap)

    // Tax without SRS
    const chargeableWithout = calculateChargeableIncome(annualIncome, 0, 0, 0, residency)
    const taxWithout = calculateProgressiveTax(chargeableWithout)

    // Tax with SRS
    const chargeableWith = calculateChargeableIncome(annualIncome, 0, effectiveContribution, 0, residency)
    const taxWith = calculateProgressiveTax(chargeableWith)

    const annualTaxSaving = taxWithout.taxPayable - taxWith.taxPayable

    // SRS vs RSTU comparison
    const comparison = compareSrsVsRstu({
      currentIncome: annualIncome,
      currentMarginalRate: taxWithout.marginalRate,
      amount: effectiveContribution,
    })

    // Project SRS balance to retirement age 63
    const yearsToRetirement = Math.max(0, SRS_RETIREMENT_AGE - age)
    const projection = projectSrsBalance({
      currentBalance: 0,
      annualContribution: effectiveContribution,
      investmentReturn: DEFAULT_RETURN,
      years: yearsToRetirement,
      contributionCap: cap,
    })
    const balanceAt63 = projection.length > 0 ? projection[projection.length - 1].balance : 0
    const totalContributions = effectiveContribution * yearsToRetirement
    const totalGrowth = balanceAt63 - totalContributions
    const lifetimeTaxSavings = annualTaxSaving * yearsToRetirement

    return {
      effectiveContribution,
      annualTaxSaving,
      marginalRate: taxWithout.marginalRate,
      taxWithout: taxWithout.taxPayable,
      taxWith: taxWith.taxPayable,
      balanceAt63,
      totalContributions,
      totalGrowth,
      lifetimeTaxSavings,
      yearsToRetirement,
      projection,
      comparison,
    }
  }, [annualIncome, age, srsContribution, residency, cap, isValid, hasCalculated])

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          SRS Tax Savings Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CurrencyInput
            label="Annual Income"
            value={annualIncome}
            onChange={setAnnualIncome}
            error={errors.income}
            tooltip="Your total annual employment income before deductions"
          />
          <NumberInput
            label="Current Age"
            value={age}
            onChange={setAge}
            integer
            min={18}
            max={62}
            error={errors.age}
          />
          <CurrencyInput
            label="SRS Contribution"
            value={srsContribution}
            onChange={setSrsContribution}
            error={errors.contribution}
            tooltip={`Annual SRS contribution (cap: ${formatCurrency(cap, 0)} for ${residency === 'foreigner' ? 'foreigners' : 'citizens/PRs'})`}
          />
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Residency</Label>
            <Select value={residency} onValueChange={(v) => setResidency(v as ResidencyStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="citizen">Singapore Citizen</SelectItem>
                <SelectItem value="pr">Permanent Resident</SelectItem>
                <SelectItem value="foreigner">Foreigner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {srsContribution > cap && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Contribution capped at {formatCurrency(cap, 0)} for {residency === 'foreigner' ? 'foreigners' : 'citizens/PRs'}.
          </p>
        )}

        <Button onClick={() => { if (isValid) setHasCalculated(true) }} disabled={!isValid} className="w-full sm:w-auto">
          <Calculator className="h-4 w-4 mr-2" />
          Calculate Tax Savings
        </Button>

        {/* Results */}
        {results && (
          <div className="space-y-6 pt-4 border-t">
            {/* Annual tax savings */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                Annual Tax Impact
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Tax without SRS</p>
                  <p className="font-semibold">{formatCurrency(results.taxWithout, 0)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Tax with SRS</p>
                  <p className="font-semibold">{formatCurrency(results.taxWith, 0)}</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground">Annual tax saved</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(results.annualTaxSaving, 0)}
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Your marginal rate</p>
                  <p className="font-semibold">{(results.marginalRate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Balance at 63 */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                Projected SRS Balance at Age 63 (assuming {(DEFAULT_RETURN * 100).toFixed(0)}% annual return)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground">Balance at 63</p>
                  <p className="text-lg font-bold">{formatCurrency(results.balanceAt63, 0)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total contributed</p>
                  <p className="font-semibold">{formatCurrency(results.totalContributions, 0)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Investment growth</p>
                  <p className="font-semibold text-green-700 dark:text-green-400">+{formatCurrency(results.totalGrowth, 0)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Lifetime tax savings</p>
                  <p className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(results.lifetimeTaxSavings, 0)}</p>
                </div>
              </div>
            </div>

            {/* SRS vs RSTU */}
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">SRS vs CPF SA Top-Up (RSTU)</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">SRS net tax benefit</p>
                  <p className="font-semibold">{formatCurrency(results.comparison.srsNetBenefit, 0)}/yr</p>
                </div>
                <div>
                  <p className="text-muted-foreground">RSTU net tax benefit</p>
                  <p className="font-semibold">{formatCurrency(results.comparison.rstuNetBenefit, 0)}/yr</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{results.comparison.recommendation}</p>
            </div>

            {/* Projection table (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowProjection(!showProjection)}
                className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline cursor-pointer"
              >
                {showProjection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showProjection ? 'Hide' : 'Show'} year-by-year projection ({results.yearsToRetirement} years)
              </button>

              {showProjection && (
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-2 font-medium">Year</th>
                        <th className="text-right py-2 px-2 font-medium">Contribution</th>
                        <th className="text-right py-2 px-2 font-medium">Growth</th>
                        <th className="text-right py-2 pl-2 font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.projection.map((row) => (
                        <tr key={row.year} className="border-b last:border-b-0">
                          <td className="py-1.5 pr-2 tabular-nums">{row.year}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-green-600 dark:text-green-400">+{formatCurrency(row.contribution, 0)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-blue-600 dark:text-blue-400">+{formatCurrency(row.growth, 0)}</td>
                          <td className="py-1.5 pl-2 text-right tabular-nums font-medium">{formatCurrency(row.balance, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="flex gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                This assumes a simplified tax calculation (no personal reliefs or CPF deductions).
                SRS withdrawals after 63 are taxed at 50% of the amount at prevailing rates.
                For a full tax-aware projection, use the{' '}
                <Link to="/inputs#section-income" className="text-primary hover:underline">full planner</Link>.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
