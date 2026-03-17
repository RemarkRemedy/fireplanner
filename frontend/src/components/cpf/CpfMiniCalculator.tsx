import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calculator, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/lib/utils'
import {
  estimateCpfBalancesFromAge,
  projectCpfBalances,
  performAge55Transfer,
  calculateBrsFrsErs,
  estimateCpfLifePayout,
} from '@/lib/calculations/cpf'
import type { CpfLifePlan, ResidencyStatus } from '@/lib/types'

/** Assumed career start age for CPF balance estimation */
const DEFAULT_CAREER_START_AGE = 22
/** Assumed annual salary growth rate for projections */
const ASSUMED_SALARY_GROWTH = 0.03
/** Assumed inflation rate for deflating nominal values to today's dollars */
const ASSUMED_INFLATION = 0.025

interface ValidationErrors {
  age?: string
  salary?: string
  expenses?: string
}

function validate(age: number, salary: number, expenses: number): ValidationErrors {
  const errors: ValidationErrors = {}
  if (age < 25 || age > 54) errors.age = 'Age must be between 25 and 54'
  if (salary <= 0) errors.salary = 'Monthly salary must be greater than 0'
  if (expenses < 0) errors.expenses = 'Monthly expenses cannot be negative'
  return errors
}

export function CpfMiniCalculator() {
  const [age, setAge] = useState(30)
  const [monthlySalary, setMonthlySalary] = useState(6000)
  const [monthlyExpenses, setMonthlyExpenses] = useState(3000)
  const [cpfLifePlan, setCpfLifePlan] = useState<CpfLifePlan>('standard')
  const [residencyStatus, setResidencyStatus] = useState<ResidencyStatus>('citizen')
  const [hasCalculated, setHasCalculated] = useState(false)

  const errors = useMemo(() => validate(age, monthlySalary, monthlyExpenses), [age, monthlySalary, monthlyExpenses])
  const isValid = Object.keys(errors).length === 0

  const results = useMemo(() => {
    if (!isValid || !hasCalculated) return null

    const annualSalary = monthlySalary * 12

    // Step 1: Estimate current CPF balances
    const balances = estimateCpfBalancesFromAge(age, annualSalary, DEFAULT_CAREER_START_AGE, ASSUMED_SALARY_GROWTH, residencyStatus)

    // Step 2: Project balances to age 55
    const projections = projectCpfBalances(
      age, 55, balances.oa, balances.sa, balances.ma,
      annualSalary, ASSUMED_SALARY_GROWTH, residencyStatus,
    )
    const lastRow = projections[projections.length - 1]
    if (!lastRow) return null

    // Step 3: Calculate retirement sums
    const { brs, frs, ers } = calculateBrsFrsErs(age)

    // Step 4: Perform age 55 transfer (SA + OA -> RA, targeting FRS)
    const { newOA, newRA } = performAge55Transfer(lastRow.oaBalance, lastRow.saBalance, frs)

    // Step 5: Estimate CPF LIFE payout (nominal, based on RA at 55)
    const annualPayoutNominal = estimateCpfLifePayout(newRA, cpfLifePlan)
    // Deflate to today's dollars: payout starts at 65, so discount by (65 - currentAge) years of inflation
    const yearsToPayoutStart = 65 - age
    const annualPayout = annualPayoutNominal / Math.pow(1 + ASSUMED_INFLATION, yearsToPayoutStart)
    const monthlyPayout = annualPayout / 12

    // Step 6: Gap analysis (all in today's dollars)
    const monthlyGap = monthlyExpenses - monthlyPayout
    const retirementYears = 25 // age 65-90
    const totalGap = monthlyGap > 0 ? monthlyGap * 12 * retirementYears : 0

    return {
      estimatedOA: balances.oa,
      estimatedSA: balances.sa,
      estimatedMA: balances.ma,
      projectedOAAt55: lastRow.oaBalance,
      projectedSAAt55: lastRow.saBalance,
      projectedMAAt55: lastRow.maBalance,
      projectedTotalAt55: lastRow.totalBalance,
      brs,
      frs,
      ers,
      newOA,
      newRA,
      monthlyPayout,
      annualPayout,
      monthlyGap,
      totalGap,
      retirementYears,
    }
  }, [age, monthlySalary, monthlyExpenses, cpfLifePlan, residencyStatus, isValid, hasCalculated])

  function handleCalculate() {
    if (isValid) setHasCalculated(true)
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Quick CPF Retirement Estimate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumberInput
            label="Current Age"
            value={age}
            onChange={setAge}
            integer
            min={25}
            max={54}
            error={errors.age}
          />
          <CurrencyInput
            label="Monthly Salary"
            value={monthlySalary}
            onChange={setMonthlySalary}
            error={errors.salary}
            tooltip="Your gross monthly salary before CPF deductions"
          />
          <CurrencyInput
            label="Monthly Expenses"
            value={monthlyExpenses}
            onChange={setMonthlyExpenses}
            error={errors.expenses}
            tooltip="Your estimated monthly retirement expenses in today's dollars"
          />
          <div className="flex flex-col gap-1">
            <Label className="text-sm">CPF LIFE Plan</Label>
            <Select value={cpfLifePlan} onValueChange={(v) => setCpfLifePlan(v as CpfLifePlan)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic (higher bequest)</SelectItem>
                <SelectItem value="standard">Standard (higher payout)</SelectItem>
                <SelectItem value="escalating">Escalating (inflation hedge)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Residency Status</Label>
            <Select value={residencyStatus} onValueChange={(v) => setResidencyStatus(v as ResidencyStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="citizen">Singapore Citizen</SelectItem>
                <SelectItem value="pr">Permanent Resident</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleCalculate} disabled={!isValid} className="w-full sm:w-auto">
          <Calculator className="h-4 w-4 mr-2" />
          Estimate CPF Retirement
        </Button>

        {/* Results */}
        {results && (
          <div className="space-y-6 pt-4 border-t">
            {/* Retirement Sums */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                Projected Retirement Sums at Age 55
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">BRS</p>
                  <p className="font-semibold">{formatCurrency(results.brs, 0)}</p>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground">FRS (default)</p>
                  <p className="font-semibold">{formatCurrency(results.frs, 0)}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">ERS</p>
                  <p className="font-semibold">{formatCurrency(results.ers, 0)}</p>
                </div>
              </div>
            </div>

            {/* Projected Balances */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                Estimated CPF Balances at Age 55
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">OA (after transfer)</p>
                  <p className="font-semibold">{formatCurrency(results.newOA, 0)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">RA (for CPF LIFE)</p>
                  <p className="font-semibold">{formatCurrency(results.newRA, 0)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">MA</p>
                  <p className="font-semibold">{formatCurrency(results.projectedMAAt55, 0)}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground">Total at 55</p>
                  <p className="font-semibold">{formatCurrency(results.projectedTotalAt55, 0)}</p>
                </div>
              </div>
            </div>

            {/* CPF LIFE Payout */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                Estimated CPF LIFE Monthly Payout (from age 65)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground">Monthly Payout</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(results.monthlyPayout, 0)}/mo
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Your Monthly Expenses</p>
                  <p className="font-semibold">{formatCurrency(monthlyExpenses, 0)}/mo</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  results.monthlyGap > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                    : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                }`}>
                  <p className="text-xs text-muted-foreground">
                    {results.monthlyGap > 0 ? 'Monthly Gap' : 'Monthly Surplus'}
                  </p>
                  <p className={`font-semibold ${
                    results.monthlyGap > 0
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-green-700 dark:text-green-400'
                  }`}>
                    {results.monthlyGap > 0
                      ? `${formatCurrency(results.monthlyGap, 0)}/mo`
                      : `${formatCurrency(Math.abs(results.monthlyGap), 0)}/mo`
                    }
                  </p>
                </div>
              </div>

              {results.monthlyGap > 0 && (
                <p className="text-sm text-muted-foreground mt-3">
                  Over {results.retirementYears} years (age 65 to 90), you would need approximately{' '}
                  <span className="font-semibold text-foreground">{formatCurrency(results.totalGap, 0)}</span>{' '}
                  from your investment portfolio to cover the gap (in today's dollars, assuming 2.5% inflation).
                </p>
              )}
            </div>

            {/* Disclaimer */}
            <div className="flex gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                This is a rough estimate assuming 3% salary growth and 2.5% inflation.
                For a precise projection, enter your actual CPF balances in the{' '}
                <Link to="/inputs#section-cpf" className="text-primary hover:underline">full planner</Link>.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
