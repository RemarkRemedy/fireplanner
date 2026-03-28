import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { ArrowLeft, Users } from 'lucide-react'
import { grossUpFromTakeHome, netDownFromGross } from '@/lib/calculations/grossUp'
import type { GoalCalcBasics, SalaryBasis } from '@/lib/calculations/goal-calculator'

interface BasicsFormProps {
  initial: GoalCalcBasics | null
  onComplete: (basics: GoalCalcBasics) => void
  onBack: () => void
}

/** Inline pill toggle for Net / Gross salary basis. */
function SalaryBasisPill({
  value,
  onChange,
}: {
  value: SalaryBasis
  onChange: (v: SalaryBasis) => void
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5 bg-muted/50">
      {(['net', 'gross'] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            value === opt
              ? 'bg-background shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange(opt)}
        >
          {opt === 'net' ? 'Net' : 'Gross'}
        </button>
      ))}
    </div>
  )
}

export function BasicsForm({ initial, onComplete, onBack }: BasicsFormProps) {
  const [age, setAge] = useState(initial?.age ?? 25)
  const [monthlyIncome, setMonthlyIncome] = useState(initial?.monthlyIncome ?? 3500)
  const [grossIncome, setGrossIncome] = useState(
    initial?.grossIncome ?? grossUpFromTakeHome(initial?.monthlyIncome ?? 3500, initial?.age ?? 25),
  )
  const [salaryBasis, setSalaryBasis] = useState<SalaryBasis>(initial?.salaryBasis ?? 'net')
  const [monthlyExpenses, setMonthlyExpenses] = useState(initial?.monthlyExpenses ?? 2000)
  const [existingSavings, setExistingSavings] = useState(initial?.existingSavings ?? 0)

  // Couple mode state — preserved across toggle on/off
  const [coupleMode, setCoupleMode] = useState(initial?.coupleMode ?? false)
  const [partnerAge, setPartnerAge] = useState(initial?.partnerAge ?? 25)
  const [partnerMonthlyIncome, setPartnerMonthlyIncome] = useState(
    initial?.partnerMonthlyIncome ?? 3500,
  )
  const [partnerGrossIncome, setPartnerGrossIncome] = useState(
    initial?.partnerGrossIncome ??
      grossUpFromTakeHome(initial?.partnerMonthlyIncome ?? 3500, initial?.partnerAge ?? 25),
  )
  const [partnerSalaryBasis, setPartnerSalaryBasis] = useState<SalaryBasis>(
    initial?.partnerSalaryBasis ?? 'net',
  )

  // ----- Primary salary basis change handlers -----

  const handleBasisChange = useCallback(
    (newBasis: SalaryBasis) => {
      setSalaryBasis(newBasis)
      if (newBasis === 'gross') {
        // Switching to gross: derive gross from current net
        setGrossIncome(grossUpFromTakeHome(monthlyIncome, age))
      } else {
        // Switching to net: derive net from current gross
        setMonthlyIncome(netDownFromGross(grossIncome, age))
      }
    },
    [monthlyIncome, grossIncome, age],
  )

  const handleSalaryChange = useCallback(
    (value: number) => {
      if (salaryBasis === 'net') {
        setMonthlyIncome(value)
        setGrossIncome(grossUpFromTakeHome(value, age))
      } else {
        setGrossIncome(value)
        setMonthlyIncome(netDownFromGross(value, age))
      }
    },
    [salaryBasis, age],
  )

  const handleAgeChange = useCallback(
    (newAge: number) => {
      setAge(newAge)
      // Re-derive the paired salary value with the new age
      if (salaryBasis === 'net') {
        setGrossIncome(grossUpFromTakeHome(monthlyIncome, newAge))
      } else {
        setMonthlyIncome(netDownFromGross(grossIncome, newAge))
      }
    },
    [salaryBasis, monthlyIncome, grossIncome],
  )

  // ----- Partner salary basis change handlers -----

  const handlePartnerBasisChange = useCallback(
    (newBasis: SalaryBasis) => {
      setPartnerSalaryBasis(newBasis)
      if (newBasis === 'gross') {
        setPartnerGrossIncome(grossUpFromTakeHome(partnerMonthlyIncome, partnerAge))
      } else {
        setPartnerMonthlyIncome(netDownFromGross(partnerGrossIncome, partnerAge))
      }
    },
    [partnerMonthlyIncome, partnerGrossIncome, partnerAge],
  )

  const handlePartnerSalaryChange = useCallback(
    (value: number) => {
      if (partnerSalaryBasis === 'net') {
        setPartnerMonthlyIncome(value)
        setPartnerGrossIncome(grossUpFromTakeHome(value, partnerAge))
      } else {
        setPartnerGrossIncome(value)
        setPartnerMonthlyIncome(netDownFromGross(value, partnerAge))
      }
    },
    [partnerSalaryBasis, partnerAge],
  )

  const handlePartnerAgeChange = useCallback(
    (newAge: number) => {
      setPartnerAge(newAge)
      if (partnerSalaryBasis === 'net') {
        setPartnerGrossIncome(grossUpFromTakeHome(partnerMonthlyIncome, newAge))
      } else {
        setPartnerMonthlyIncome(netDownFromGross(partnerGrossIncome, newAge))
      }
    },
    [partnerSalaryBasis, partnerMonthlyIncome, partnerGrossIncome],
  )

  // ----- Validation -----

  const activeSalary = salaryBasis === 'net' ? monthlyIncome : grossIncome
  const ageError = age < 18 || age > 70 ? 'Must be between 18 and 70' : undefined
  const incomeError = activeSalary <= 0 ? 'Must be greater than 0' : undefined

  // For couple mode, compare against combined income (net basis)
  const totalNetIncome = coupleMode ? monthlyIncome + partnerMonthlyIncome : monthlyIncome
  const expensesError =
    monthlyExpenses <= 0
      ? 'Must be greater than 0'
      : monthlyExpenses >= totalNetIncome
        ? `Must be less than your ${coupleMode ? 'combined ' : ''}income`
        : undefined

  const partnerAgeError =
    coupleMode && (partnerAge < 18 || partnerAge > 70)
      ? 'Must be between 18 and 70'
      : undefined
  const partnerActiveIncome =
    partnerSalaryBasis === 'net' ? partnerMonthlyIncome : partnerGrossIncome
  const partnerIncomeError =
    coupleMode && partnerActiveIncome <= 0 ? 'Must be greater than 0' : undefined

  const canSubmit =
    !ageError &&
    !incomeError &&
    !expensesError &&
    age >= 18 &&
    (!coupleMode || (!partnerAgeError && !partnerIncomeError))

  // ----- Submit -----

  const handleSubmit = () => {
    const basics: GoalCalcBasics = {
      age,
      monthlyIncome,
      monthlyExpenses,
      existingSavings,
      grossIncome,
      salaryBasis,
    }

    if (coupleMode) {
      basics.coupleMode = true
      basics.partnerAge = partnerAge
      basics.partnerMonthlyIncome = partnerMonthlyIncome
      basics.partnerGrossIncome = partnerGrossIncome
      basics.partnerSalaryBasis = partnerSalaryBasis
    }

    onComplete(basics)
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Your basics</CardTitle>
          <p className="text-sm text-muted-foreground">
            To calculate your plan, we need a few details.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <NumberInput
            label="Your age"
            value={age}
            onChange={handleAgeChange}
            integer
            min={18}
            max={70}
            error={ageError}
          />

          {/* Salary with net/gross pill toggle */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                {salaryBasis === 'net'
                  ? 'Monthly take-home pay (after CPF)'
                  : 'Monthly gross salary (before CPF)'}
              </Label>
              <SalaryBasisPill value={salaryBasis} onChange={handleBasisChange} />
            </div>
            <CurrencyInput
              label=""
              value={salaryBasis === 'net' ? monthlyIncome : grossIncome}
              onChange={handleSalaryChange}
              error={incomeError}
            />
          </div>

          {/* Couple mode toggle */}
          <div className="flex items-center gap-3 pt-2">
            <Switch
              id="couple-mode"
              checked={coupleMode}
              onCheckedChange={setCoupleMode}
            />
            <Label htmlFor="couple-mode" className="text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              Planning with a partner?
            </Label>
          </div>

          {/* Partner fields (visible when couple mode on) */}
          {coupleMode && (
            <div className="space-y-4 rounded-md border p-4 bg-muted/20">
              <p className="text-sm font-medium">Partner details</p>

              <NumberInput
                label="Partner's age"
                value={partnerAge}
                onChange={handlePartnerAgeChange}
                integer
                min={18}
                max={70}
                error={partnerAgeError}
              />

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    {partnerSalaryBasis === 'net'
                      ? "Partner's monthly take-home pay"
                      : "Partner's monthly gross salary"}
                  </Label>
                  <SalaryBasisPill
                    value={partnerSalaryBasis}
                    onChange={handlePartnerBasisChange}
                  />
                </div>
                <CurrencyInput
                  label=""
                  value={
                    partnerSalaryBasis === 'net'
                      ? partnerMonthlyIncome
                      : partnerGrossIncome
                  }
                  onChange={handlePartnerSalaryChange}
                  error={partnerIncomeError}
                />
              </div>
            </div>
          )}

          <CurrencyInput
            label={coupleMode ? 'Combined monthly expenses' : 'Monthly expenses'}
            value={monthlyExpenses}
            onChange={setMonthlyExpenses}
            error={expensesError}
            tooltip={coupleMode ? 'Enter your total household spending' : undefined}
          />
          <CurrencyInput
            label="Existing savings and investments"
            value={existingSavings}
            onChange={setExistingSavings}
          />

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Calculate
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
