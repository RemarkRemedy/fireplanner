import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { ArrowLeft } from 'lucide-react'
import type { GoalCalcBasics } from '@/lib/calculations/goal-calculator'

interface BasicsFormProps {
  initial: GoalCalcBasics | null
  onComplete: (basics: GoalCalcBasics) => void
  onBack: () => void
}

export function BasicsForm({ initial, onComplete, onBack }: BasicsFormProps) {
  const [age, setAge] = useState(initial?.age ?? 25)
  const [monthlyIncome, setMonthlyIncome] = useState(initial?.monthlyIncome ?? 3500)
  const [monthlyExpenses, setMonthlyExpenses] = useState(initial?.monthlyExpenses ?? 2000)
  const [existingSavings, setExistingSavings] = useState(initial?.existingSavings ?? 0)

  const ageError = age < 18 || age > 70 ? 'Must be between 18 and 70' : undefined
  const incomeError = monthlyIncome <= 0 ? 'Must be greater than 0' : undefined
  const expensesError =
    monthlyExpenses <= 0
      ? 'Must be greater than 0'
      : monthlyExpenses >= monthlyIncome
        ? 'Must be less than your income'
        : undefined

  const canSubmit = !ageError && !incomeError && !expensesError && age >= 18

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
            onChange={setAge}
            integer
            min={18}
            max={70}
            error={ageError}
          />
          <CurrencyInput
            label="Monthly take-home pay (after CPF)"
            value={monthlyIncome}
            onChange={setMonthlyIncome}
            error={incomeError}
          />
          <CurrencyInput
            label="Monthly expenses"
            value={monthlyExpenses}
            onChange={setMonthlyExpenses}
            error={expensesError}
          />
          <CurrencyInput
            label="Existing savings and investments"
            value={existingSavings}
            onChange={setExistingSavings}
          />

          <Button
            className="w-full"
            onClick={() => onComplete({ age, monthlyIncome, monthlyExpenses, existingSavings })}
            disabled={!canSubmit}
          >
            Calculate
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
