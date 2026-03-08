import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { createId } from '@/lib/household/ids'
import {
  ensureAgeRangeTiming,
  getSelectedAdult,
  ownerLabel,
  syncTimingDuration,
} from '@/lib/household/editorUtils'
import type {
  AdultOwner,
  EntryOwner,
  ExpenseItem,
  GoalItem,
} from '@/lib/household/types'
import type { GoalCategory, HealthcareConfig, IspTierOption, OopCurveVariant, OopModel } from '@/lib/types'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

const OWNER_OPTIONS: EntryOwner[] = ['self', 'partner', 'shared']
const ADULT_OWNER_OPTIONS: AdultOwner[] = ['self', 'partner']

function createExpense(
  kind: ExpenseItem['kind'],
  owner: EntryOwner,
  timingOwner: AdultOwner,
  startAge: number,
  retirementAge: number,
  lifeExpectancy: number,
): ExpenseItem {
  switch (kind) {
    case 'expense-adjustment':
      return {
        id: createId('expense-adjustment'),
        owner,
        label: 'Expense adjustment',
        kind,
        timing: {
          kind: 'age-range',
          owner: timingOwner,
          startAge: startAge + 5,
          endAge: startAge + 10,
        },
        amount: 6_000,
        periodicity: 'annual',
        growthRate: 0,
      }
    case 'parent-support':
      return {
        id: createId('expense-parent-support'),
        owner,
        label: 'Parent support',
        kind,
        timing: {
          kind: 'age-range',
          owner: timingOwner,
          startAge: startAge + 5,
          endAge: startAge + 20,
        },
        amount: 800,
        periodicity: 'monthly',
        growthRate: 0.03,
      }
    case 'retirement-withdrawal':
      return {
        id: createId('expense-retirement-withdrawal'),
        owner,
        label: 'Retirement withdrawal',
        kind,
        timing: {
          kind: 'age-range',
          owner: timingOwner,
          startAge: retirementAge + 5,
          endAge: retirementAge + 5,
        },
        amount: 30_000,
        periodicity: 'annual',
        durationYears: 1,
        inflationAdjusted: true,
      }
    case 'base-living':
    default:
      return {
        id: createId('expense-base-living'),
        owner,
        label: owner === 'shared' ? 'Shared living costs' : `${ownerLabel(timingOwner)} living costs`,
        kind: 'base-living',
        timing: {
          kind: 'age-range',
          owner: timingOwner,
          startAge,
          endAge: lifeExpectancy,
        },
        amount: 3_000,
        periodicity: 'monthly',
        growthRate: 0.02,
      }
  }
}

function createGoal(owner: EntryOwner, timingOwner: AdultOwner, startAge: number): GoalItem {
  return {
    id: createId('goal'),
    owner,
    label: 'Household goal',
    kind: 'financial-goal',
    timing: {
      kind: 'age-range',
      owner: timingOwner,
      startAge: startAge + 5,
      endAge: startAge + 5,
    },
    amount: 50_000,
    durationYears: 1,
    priority: 'important',
    inflationAdjusted: true,
    category: 'other',
  }
}

function getEntityErrors(
  validationErrors: Record<string, Record<string, string>>,
  entityKind: 'expense' | 'goal',
  entityId: string,
): Record<string, string> {
  return validationErrors[`${entityKind}:${entityId}`] ?? {}
}

function updateExpenseList(
  expenseId: string,
  updates: Partial<ExpenseItem>,
) {
  useHouseholdPlanStore.getState().updateExpense(expenseId, updates)
}

function updateGoalList(
  goalId: string,
  updates: Partial<GoalItem>,
) {
  useHouseholdPlanStore.getState().updateGoal(goalId, updates)
}

interface SpendingGoalsSectionProps {
  selectedAdultId: string | null
}

export function SpendingGoalsSection({ selectedAdultId }: SpendingGoalsSectionProps) {
  const plan = useHouseholdPlanStore((state) => state.plan)
  const validationErrors = useHouseholdPlanStore((state) => state.validationErrors)
  const updateAdult = useHouseholdPlanStore((state) => state.updateAdult)
  const addExpense = useHouseholdPlanStore((state) => state.addExpense)
  const removeExpense = useHouseholdPlanStore((state) => state.removeExpense)
  const addGoal = useHouseholdPlanStore((state) => state.addGoal)
  const removeGoal = useHouseholdPlanStore((state) => state.removeGoal)

  const selectedAdult = getSelectedAdult(plan, selectedAdultId)
  const adults = plan.adults
  const availableOwnerOptions: EntryOwner[] = adults.length > 1 ? OWNER_OPTIONS : ['self']
  const availableAdultOwners: AdultOwner[] = ADULT_OWNER_OPTIONS.filter((owner) => adults.some((adult) => adult.owner === owner))

  if (!selectedAdult) {
    return null
  }

  const baseExpenses = plan.expenses.filter((expense) => expense.kind === 'base-living' || expense.kind === 'expense-adjustment')
  const parentSupportExpenses = plan.expenses.filter((expense) => expense.kind === 'parent-support')
  const retirementWithdrawals = plan.expenses.filter((expense) => expense.kind === 'retirement-withdrawal')

  const updateSelectedAdultHealthcare = (updates: Partial<HealthcareConfig>) => {
    updateAdult(selectedAdult.id, {
      healthcare: {
        ...selectedAdult.healthcare,
        ...updates,
      },
    })
  }

  return (
    <div className="space-y-6">
      <Card id="household-spending">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Spending Items
              <InfoTooltip text="Explicit owner plus timing anchor keeps household cashflow compilation deterministic. Use shared for household-wide costs and self or partner for private costs." />
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addExpense(createExpense('base-living', 'shared', selectedAdult.owner, selectedAdult.currentAge, selectedAdult.retirementAge, selectedAdult.lifeExpectancy))}>
                Add living cost
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addExpense(createExpense('expense-adjustment', selectedAdult.owner, selectedAdult.owner, selectedAdult.currentAge, selectedAdult.retirementAge, selectedAdult.lifeExpectancy))}>
                Add adjustment
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {baseExpenses.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Add shared or private living costs to model the household spending base.
            </div>
          ) : (
            baseExpenses.map((expense) => {
              const expenseErrors = getEntityErrors(validationErrors, 'expense', expense.id)
              const timing = ensureAgeRangeTiming(
                expense.timing,
                selectedAdult.owner,
                selectedAdult.currentAge,
              )

              return (
                <div key={expense.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      value={expense.label}
                      onChange={(event) => updateExpenseList(expense.id, { label: event.target.value })}
                      className="max-w-sm"
                    />
                    <Button type="button" variant="ghost" onClick={() => removeExpense(expense.id)}>
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Kind</Label>
                      <Select
                        value={expense.kind}
                        onValueChange={(value) => updateExpenseList(expense.id, { kind: value as ExpenseItem['kind'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="base-living">Base living</SelectItem>
                          <SelectItem value="expense-adjustment">Expense adjustment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Owner</Label>
                      <Select
                        value={expense.owner}
                        onValueChange={(value) => updateExpenseList(expense.id, { owner: value as EntryOwner })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOwnerOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option === 'shared' ? 'Shared' : ownerLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Timing Anchor</Label>
                      <Select
                        value={timing.owner}
                        onValueChange={(value) => updateExpenseList(expense.id, {
                          timing: { ...timing, owner: value as AdultOwner },
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAdultOwners.map((option) => (
                            <SelectItem key={option} value={option}>
                              {ownerLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Periodicity</Label>
                      <Select
                        value={expense.periodicity}
                        onValueChange={(value) => updateExpenseList(expense.id, {
                          periodicity: value as ExpenseItem['periodicity'],
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="one-off">One-off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <CurrencyInput
                      label="Amount"
                      value={expense.amount}
                      onChange={(value) => updateExpenseList(expense.id, { amount: value })}
                      error={expenseErrors.amount}
                    />
                    <PercentInput
                      label="Growth rate"
                      value={expense.growthRate ?? 0}
                      onChange={(value) => updateExpenseList(expense.id, { growthRate: value })}
                    />
                    <NumberInput
                      label="Start age"
                      integer
                      min={0}
                      max={120}
                      value={timing.startAge}
                      onChange={(value) => updateExpenseList(expense.id, {
                        timing: { ...timing, startAge: value },
                      })}
                    />
                    <NumberInput
                      label="End age"
                      integer
                      min={timing.startAge}
                      max={120}
                      value={timing.endAge ?? timing.startAge}
                      onChange={(value) => updateExpenseList(expense.id, {
                        timing: { ...timing, endAge: value },
                      })}
                    />
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Parent Support</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addExpense(createExpense('parent-support', selectedAdult.owner, selectedAdult.owner, selectedAdult.currentAge, selectedAdult.retirementAge, selectedAdult.lifeExpectancy))}>
              Add parent support
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {parentSupportExpenses.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Add explicit parent-support rows so the household plan can show who carries that obligation.
            </div>
          ) : (
            parentSupportExpenses.map((expense) => {
              const timing = ensureAgeRangeTiming(
                expense.timing,
                selectedAdult.owner,
                selectedAdult.currentAge,
              )

              return (
                <div key={expense.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      value={expense.label}
                      onChange={(event) => updateExpenseList(expense.id, { label: event.target.value })}
                      className="max-w-sm"
                    />
                    <Button type="button" variant="ghost" onClick={() => removeExpense(expense.id)}>
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Owner</Label>
                      <Select
                        value={expense.owner}
                        onValueChange={(value) => updateExpenseList(expense.id, { owner: value as EntryOwner })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOwnerOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option === 'shared' ? 'Shared' : ownerLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <CurrencyInput
                      label="Amount"
                      value={expense.amount}
                      onChange={(value) => updateExpenseList(expense.id, { amount: value })}
                    />
                    <PercentInput
                      label="Growth rate"
                      value={expense.growthRate ?? 0}
                      onChange={(value) => updateExpenseList(expense.id, { growthRate: value })}
                    />
                    <NumberInput
                      label="Start age"
                      integer
                      min={0}
                      max={120}
                      value={timing.startAge}
                      onChange={(value) => updateExpenseList(expense.id, {
                        timing: { ...timing, startAge: value },
                      })}
                    />
                    <NumberInput
                      label="End age"
                      integer
                      min={timing.startAge}
                      max={120}
                      value={timing.endAge ?? timing.startAge}
                      onChange={(value) => updateExpenseList(expense.id, {
                        timing: { ...timing, endAge: value },
                      })}
                    />
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card id="household-healthcare">
        <CardHeader>
          <CardTitle className="text-lg">{selectedAdult.displayName}'s Healthcare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">Enable healthcare planning</div>
              <div className="text-sm text-muted-foreground">
                Use this to model ISP choices, out-of-pocket spending, and MediSave top-ups for the selected adult.
              </div>
            </div>
            <Switch
              checked={selectedAdult.healthcare.enabled}
              onCheckedChange={(checked) => updateSelectedAdultHealthcare({ enabled: checked })}
            />
          </div>

          {selectedAdult.healthcare.enabled && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <Label>ISP tier</Label>
                <Select
                  value={selectedAdult.healthcare.ispTier}
                  onValueChange={(value) => updateSelectedAdultHealthcare({ ispTier: value as IspTierOption })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="enhanced">Enhanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Out-of-pocket model</Label>
                <Select
                  value={selectedAdult.healthcare.oopModel}
                  onValueChange={(value) => updateSelectedAdultHealthcare({ oopModel: value as OopModel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="age-curve">Age curve</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>OOP curve</Label>
                <Select
                  value={selectedAdult.healthcare.oopCurveVariant ?? 'study-backed'}
                  onValueChange={(value) => updateSelectedAdultHealthcare({ oopCurveVariant: value as OopCurveVariant })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="study-backed">Study-backed</SelectItem>
                    <SelectItem value="conservative">Conservative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CurrencyInput
                label="OOP base amount"
                value={selectedAdult.healthcare.oopBaseAmount}
                onChange={(value) => updateSelectedAdultHealthcare({ oopBaseAmount: value })}
              />
              <PercentInput
                label="OOP inflation"
                value={selectedAdult.healthcare.oopInflationRate}
                onChange={(value) => updateSelectedAdultHealthcare({ oopInflationRate: value })}
              />
              <CurrencyInput
                label="MediSave top-up"
                value={selectedAdult.healthcare.mediSaveTopUpAnnual}
                onChange={(value) => updateSelectedAdultHealthcare({ mediSaveTopUpAnnual: value })}
              />
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">MediShield Life</span>
                <Switch
                  checked={selectedAdult.healthcare.mediShieldLifeEnabled}
                  onCheckedChange={(checked) => updateSelectedAdultHealthcare({ mediShieldLifeEnabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">CareShield LIFE</span>
                <Switch
                  checked={selectedAdult.healthcare.careShieldLifeEnabled}
                  onCheckedChange={(checked) => updateSelectedAdultHealthcare({ careShieldLifeEnabled: checked })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Retirement Withdrawals</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addExpense(createExpense('retirement-withdrawal', selectedAdult.owner, selectedAdult.owner, selectedAdult.currentAge, selectedAdult.retirementAge, selectedAdult.lifeExpectancy))}>
              Add withdrawal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {retirementWithdrawals.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Add one-off retirement spending events that should hit a specific adult or the shared household pool.
            </div>
          ) : (
            retirementWithdrawals.map((expense) => {
              const timing = ensureAgeRangeTiming(
                expense.timing,
                selectedAdult.owner,
                selectedAdult.retirementAge,
              )
              const timedWithdrawal = syncTimingDuration(
                timing,
                { durationYears: expense.durationYears ?? 1 },
                selectedAdult.lifeExpectancy,
              )

              return (
                <div key={expense.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      value={expense.label}
                      onChange={(event) => updateExpenseList(expense.id, { label: event.target.value })}
                      className="max-w-sm"
                    />
                    <Button type="button" variant="ghost" onClick={() => removeExpense(expense.id)}>
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Owner</Label>
                      <Select
                        value={expense.owner}
                        onValueChange={(value) => updateExpenseList(expense.id, { owner: value as EntryOwner })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOwnerOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option === 'shared' ? 'Shared' : ownerLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <CurrencyInput
                      label="Amount"
                      value={expense.amount}
                      onChange={(value) => updateExpenseList(expense.id, { amount: value })}
                    />
                    <NumberInput
                      label="Start age"
                      integer
                      min={selectedAdult.retirementAge}
                      max={selectedAdult.lifeExpectancy}
                      value={timing.startAge}
                      onChange={(value) => updateExpenseList(
                        expense.id,
                        syncTimingDuration(
                          timing,
                          { startAge: value, durationYears: expense.durationYears ?? 1 },
                          selectedAdult.lifeExpectancy,
                        ),
                      )}
                    />
                    <NumberInput
                      label="Duration (years)"
                      integer
                      min={1}
                      max={Math.max(1, selectedAdult.lifeExpectancy - timing.startAge + 1)}
                      value={timedWithdrawal.durationYears}
                      onChange={(value) => updateExpenseList(
                        expense.id,
                        syncTimingDuration(
                          timing,
                          { durationYears: value },
                          selectedAdult.lifeExpectancy,
                        ),
                      )}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={expense.inflationAdjusted ?? true}
                      onCheckedChange={(checked) => updateExpenseList(expense.id, { inflationAdjusted: checked === true })}
                    />
                    Inflation-adjusted
                  </label>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card id="household-goals">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Goals</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addGoal(createGoal('shared', selectedAdult.owner, selectedAdult.currentAge))}>
              Add goal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.goals.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Add ownership-scoped goals so the household plan can separate shared goals from member-specific milestones.
            </div>
          ) : (
            plan.goals.map((goal) => {
              const goalErrors = getEntityErrors(validationErrors, 'goal', goal.id)
              const timing = ensureAgeRangeTiming(
                goal.timing,
                selectedAdult.owner,
                selectedAdult.currentAge + 5,
              )
              const timedGoal = syncTimingDuration(
                timing,
                { durationYears: goal.durationYears },
                selectedAdult.lifeExpectancy,
              )

              return (
                <div key={goal.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      value={goal.label}
                      onChange={(event) => updateGoalList(goal.id, { label: event.target.value })}
                      className="max-w-sm"
                    />
                    <Button type="button" variant="ghost" onClick={() => removeGoal(goal.id)}>
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Owner</Label>
                      <Select
                        value={goal.owner}
                        onValueChange={(value) => updateGoalList(goal.id, { owner: value as EntryOwner })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOwnerOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option === 'shared' ? 'Shared' : ownerLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Timing Anchor</Label>
                      <Select
                        value={timing.owner}
                        onValueChange={(value) => updateGoalList(goal.id, {
                          timing: { ...timing, owner: value as AdultOwner },
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAdultOwners.map((option) => (
                            <SelectItem key={option} value={option}>
                              {ownerLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <CurrencyInput
                      label="Amount"
                      value={goal.amount}
                      onChange={(value) => updateGoalList(goal.id, { amount: value })}
                      error={goalErrors.amount}
                    />
                    <NumberInput
                      label="Target age"
                      integer
                      min={selectedAdult.currentAge + 1}
                      max={selectedAdult.lifeExpectancy}
                      value={timing.startAge}
                      onChange={(value) => updateGoalList(
                        goal.id,
                        syncTimingDuration(
                          timing,
                          { startAge: value, durationYears: goal.durationYears },
                          selectedAdult.lifeExpectancy,
                        ),
                      )}
                    />
                    <NumberInput
                      label="Duration (years)"
                      integer
                      min={1}
                      max={Math.max(1, selectedAdult.lifeExpectancy - timing.startAge + 1)}
                      value={timedGoal.durationYears}
                      onChange={(value) => updateGoalList(
                        goal.id,
                        syncTimingDuration(
                          timing,
                          { durationYears: value },
                          selectedAdult.lifeExpectancy,
                        ),
                      )}
                    />
                    <div className="space-y-1">
                      <Label>Priority</Label>
                      <Select
                        value={goal.priority}
                        onValueChange={(value) => updateGoalList(goal.id, { priority: value as GoalItem['priority'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="essential">Essential</SelectItem>
                          <SelectItem value="important">Important</SelectItem>
                          <SelectItem value="nice-to-have">Nice-to-have</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select
                        value={goal.category}
                        onValueChange={(value) => updateGoalList(goal.id, { category: value as GoalCategory })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wedding">Wedding</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="housing">Housing</SelectItem>
                          <SelectItem value="vehicle">Vehicle</SelectItem>
                          <SelectItem value="travel">Travel</SelectItem>
                          <SelectItem value="renovation">Renovation</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="family">Family</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={goal.inflationAdjusted}
                      onCheckedChange={(checked) => updateGoalList(goal.id, { inflationAdjusted: checked === true })}
                    />
                    Inflation-adjusted
                  </label>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
