import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SliderTab } from './SliderTab'
import type { SliderConfig } from './SliderTab'
import type { GoalCalcBasics, GoalCalcGoal } from '@/lib/calculations/goal-calculator'

export interface SliderOverrides {
  monthlyIncome?: number
  monthlyExpenses?: number
  existingSavings?: number
  expectedReturn?: number
  goalOverrides?: Record<string, { targetAge?: number; totalCostToday?: number }>
}

interface WhatIfSlidersProps {
  basics: GoalCalcBasics
  goals: GoalCalcGoal[]
  overrides: SliderOverrides
  onChange: (overrides: SliderOverrides) => void
  onReset: () => void
}

export function WhatIfSliders({ basics, goals, overrides, onChange, onReset }: WhatIfSlidersProps) {
  const income = overrides.monthlyIncome ?? basics.monthlyIncome
  const expenses = overrides.monthlyExpenses ?? basics.monthlyExpenses
  const savings = overrides.existingSavings ?? basics.existingSavings

  const incomeSliders: SliderConfig[] = [
    {
      key: 'monthlyIncome',
      label: 'Monthly income',
      value: income,
      originalValue: basics.monthlyIncome,
      min: 0,
      max: basics.monthlyIncome * 3,
      step: 100,
      type: 'currency',
      onChange: (value) => onChange({ ...overrides, monthlyIncome: value }),
    },
    {
      key: 'monthlyExpenses',
      label: 'Monthly expenses',
      value: expenses,
      originalValue: basics.monthlyExpenses,
      min: 0,
      max: basics.monthlyIncome * 2,
      step: 100,
      type: 'currency',
      onChange: (value) => onChange({ ...overrides, monthlyExpenses: value }),
    },
    {
      key: 'existingSavings',
      label: 'Existing savings',
      value: savings,
      originalValue: basics.existingSavings,
      min: 0,
      max: basics.existingSavings * 5 || 500000,
      step: 1000,
      type: 'currency',
      onChange: (value) => onChange({ ...overrides, existingSavings: value }),
    },
  ]

  const goalSliders: SliderConfig[] = goals.flatMap((goal) => {
    const goalOverride = overrides.goalOverrides?.[goal.id]
    const targetAge = goalOverride?.targetAge ?? goal.targetAge
    const totalCost = goalOverride?.totalCostToday ?? goal.totalCostToday

    return [
      {
        key: `${goal.id}-targetAge`,
        label: `${goal.label} — target age`,
        value: targetAge,
        originalValue: goal.targetAge,
        min: basics.age + 1,
        max: 70,
        step: 1,
        type: 'number' as const,
        onChange: (value: number) =>
          onChange({
            ...overrides,
            goalOverrides: {
              ...overrides.goalOverrides,
              [goal.id]: { ...goalOverride, targetAge: value },
            },
          }),
      },
      {
        key: `${goal.id}-totalCost`,
        label: `${goal.label} — budget`,
        value: totalCost,
        originalValue: goal.totalCostToday,
        min: 10000,
        max: goal.totalCostToday * 3,
        step: 5000,
        type: 'currency' as const,
        onChange: (value: number) =>
          onChange({
            ...overrides,
            goalOverrides: {
              ...overrides.goalOverrides,
              [goal.id]: { ...goalOverride, totalCostToday: value },
            },
          }),
      },
    ]
  })

  const assumptionSliders: SliderConfig[] = [
    {
      key: 'expectedReturn',
      label: 'Expected annual return',
      value: overrides.expectedReturn ?? 0.05,
      originalValue: 0.05,
      min: 0.02,
      max: 0.08,
      step: 0.005,
      type: 'percent',
      onChange: (value) => onChange({ ...overrides, expectedReturn: value }),
    },
  ]

  return (
    <Tabs defaultValue="income">
      <TabsList className="w-full">
        <TabsTrigger value="income" className="flex-1">Income &amp; Savings</TabsTrigger>
        <TabsTrigger value="goals" className="flex-1">Goals</TabsTrigger>
        <TabsTrigger value="assumptions" className="flex-1">Assumptions</TabsTrigger>
      </TabsList>

      <TabsContent value="income" className="mt-4">
        <SliderTab sliders={incomeSliders} onReset={onReset} />
      </TabsContent>

      <TabsContent value="goals" className="mt-4">
        <div className="max-h-[300px] overflow-y-auto pr-1">
          <SliderTab sliders={goalSliders} onReset={onReset} />
        </div>
      </TabsContent>

      <TabsContent value="assumptions" className="mt-4">
        <SliderTab sliders={assumptionSliders} onReset={onReset} />
      </TabsContent>
    </Tabs>
  )
}
