import {
  Baby,
  Car,
  GraduationCap,
  Heart,
  Home,
  PaintBucket,
  Plane,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
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
import { GOAL_TEMPLATES } from '@/lib/data/goalTemplates'
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
  PlanningAdult,
} from '@/lib/household/types'
import type { GoalCategory, HealthcareConfig, IspTierOption, OopCurveVariant, OopModel } from '@/lib/types'
import { calculateHealthcareCostAtAge, generateHealthcareProjection } from '@/lib/calculations/healthcare'
import { formatCurrency } from '@/lib/utils'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const OWNER_OPTIONS: EntryOwner[] = ['self', 'partner', 'shared']
const ADULT_OWNER_OPTIONS: AdultOwner[] = ['self', 'partner']

const OOP_PRESETS = [
  { label: 'Bottom-Up Estimate', amount: 1170, description: 'GP + dental + optical + medications' },
  { label: 'World Bank (Nominal)', amount: 1335, description: 'World Bank out-of-pocket per capita 2023' },
  { label: 'SingStat HES 2023', amount: 1896, description: 'SingStat Household Expenditure Survey' },
  { label: 'World Bank (PPP)', amount: 2200, description: 'World Bank PPP-adjusted 2023' },
] as const

/** Sample ages for the cost preview table */
const PREVIEW_AGES = [40, 50, 60, 70, 80, 90] as const

const CATEGORY_ICONS: Record<GoalCategory, React.ReactNode> = {
  wedding: <Heart className="h-4 w-4" />,
  education: <GraduationCap className="h-4 w-4" />,
  housing: <Home className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
  travel: <Plane className="h-4 w-4" />,
  renovation: <PaintBucket className="h-4 w-4" />,
  medical: <Plus className="h-4 w-4" />,
  family: <Baby className="h-4 w-4" />,
  other: <Target className="h-4 w-4" />,
}

const PRIORITY_COLORS: Record<string, string> = {
  essential: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  important: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'nice-to-have': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function createExpense(
  kind: ExpenseItem['kind'],
  owner: EntryOwner,
  timingOwner: AdultOwner,
  startAge: number,
  retirementAge: number,
  lifeExpectancy: number,
  adults?: ReadonlyArray<Pick<PlanningAdult, 'owner' | 'displayName'>>,
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
        growthModel: 'inflation-linked',
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
        growthModel: 'fixed',
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
        label: owner === 'shared' ? 'Shared living costs' : `${ownerLabel(timingOwner, adults)} living costs`,
        kind: 'base-living',
        timing: {
          kind: 'age-range',
          owner: timingOwner,
          startAge,
          endAge: lifeExpectancy,
        },
        amount: 3_000,
        periodicity: 'monthly',
        growthModel: 'inflation-linked',
      }
  }
}

function createGoal(
  owner: EntryOwner,
  timingOwner: AdultOwner,
  startAge: number,
  template?: { label: string; amount: number; duration: number; category: GoalCategory },
): GoalItem {
  return {
    id: createId('goal'),
    owner,
    label: template?.label ?? 'Household goal',
    kind: 'financial-goal',
    timing: {
      kind: 'age-range',
      owner: timingOwner,
      startAge: startAge + 5,
      endAge: startAge + 5,
    },
    amount: template?.amount ?? 50_000,
    durationYears: template?.duration ?? 1,
    priority: 'important',
    inflationAdjusted: true,
    category: template?.category ?? 'other',
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

/** Extracted healthcare details sub-component with presets, preview table, and chart */
function HealthcareDetails({ adult, onUpdate }: {
  adult: PlanningAdult
  onUpdate: (updates: Partial<HealthcareConfig>) => void
}) {
  const hc = adult.healthcare
  const inflationRate = hc.oopInflationRate ?? 0.03

  // Cost preview at sample ages
  const previewRows = useMemo(() =>
    PREVIEW_AGES.map((age) => {
      const cost = calculateHealthcareCostAtAge(hc, age)
      const premiums = cost.mediShieldLifePremium + cost.ispAdditionalPremium + cost.careShieldLifePremium
      // Today's dollars: deflate by medical inflation from reference age
      const refAge = hc.oopReferenceAge ?? 30
      const deflator = Math.pow(1 + inflationRate, Math.max(0, age - refAge))
      const todaysDollars = deflator > 0 ? cost.cashOutlay / deflator : cost.cashOutlay
      return { age, premiums, oop: cost.oopExpense, total: cost.totalCost, cashOutlay: cost.cashOutlay, todaysDollars }
    }),
    [hc, inflationRate],
  )

  // Retirement summary
  const retCost = useMemo(
    () => calculateHealthcareCostAtAge(hc, adult.retirementAge),
    [hc, adult.retirementAge],
  )

  // Chart data: full projection from current age to life expectancy
  const chartData = useMemo(() => {
    const proj = generateHealthcareProjection(hc, adult.currentAge, adult.lifeExpectancy)
    return proj.rows.map((row) => ({
      age: row.age,
      premiums: row.mediShieldLifePremium + row.ispAdditionalPremium + row.careShieldLifePremium,
      oop: row.oopExpense,
      mediSave: row.mediSaveDeductible,
    }))
  }, [hc, adult.currentAge, adult.lifeExpectancy])

  return (
    <div className="space-y-4">
      {/* MediShield Life & CareShield LIFE */}
      {(() => {
        const birthYear = new Date().getFullYear() - adult.currentAge
        const canOptOut = birthYear < 1980
        return (
          <>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                <span className="text-sm font-medium">MediShield Life</span>
                {canOptOut ? (
                  <Switch
                    checked={hc.mediShieldLifeEnabled}
                    onCheckedChange={(checked) => onUpdate({ mediShieldLifeEnabled: checked })}
                  />
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Included</span>
                )}
                <InfoTooltip text="Mandatory national health insurance for all Singapore residents. Premiums are fully MediSave-deductible." />
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                <span className="text-sm font-medium">CareShield LIFE</span>
                {canOptOut ? (
                  <Switch
                    checked={hc.careShieldLifeEnabled}
                    onCheckedChange={(checked) => onUpdate({ careShieldLifeEnabled: checked })}
                  />
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Included</span>
                )}
                <InfoTooltip text="Mandatory long-term disability insurance. Premiums paid ages 30-67, fully MediSave-deductible." />
              </div>
            </div>
            {canOptOut && (
              <p className="text-xs text-muted-foreground">
                Born before 1980 — you may opt out of these schemes if you have ElderShield or are otherwise exempt.
              </p>
            )}
          </>
        )
      })()}

      {/* ISP Tier — segmented buttons */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label>Integrated Shield Plan (ISP) Tier</Label>
          <InfoTooltip text="Optional upgrade to MediShield Life. Higher tiers cover private wards but have higher premiums." />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['none', 'basic', 'standard', 'enhanced'] as const).map((tier) => {
            const labels: Record<string, [string, string]> = {
              none: ['None', 'MediShield Life only'],
              basic: ['Basic', 'B2/C ward coverage'],
              standard: ['Standard', 'B1 ward coverage'],
              enhanced: ['Enhanced', 'A ward / private hospital'],
            }
            const [label, desc] = labels[tier]
            const isSelected = hc.ispTier === tier
            return (
              <button
                key={tier}
                type="button"
                className={`rounded-md border p-2 text-left text-sm transition-colors ${isSelected ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}
                onClick={() => onUpdate({ ispTier: tier as IspTierOption })}
              >
                <div>{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Out-of-Pocket Model */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label>Out-of-Pocket Model</Label>
          <InfoTooltip text="Age-Dependent uses a research-backed curve that increases with age. Fixed uses a constant annual amount adjusted for inflation." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['age-curve', 'fixed'] as const).map((model) => {
            const labels: Record<string, [string, string]> = {
              'age-curve': ['Age-Dependent (Recommended)', 'Increases with age based on research'],
              fixed: ['Fixed Annual Amount', 'Constant amount adjusted for inflation'],
            }
            const [label, desc] = labels[model]
            const isSelected = hc.oopModel === model
            return (
              <button
                key={model}
                type="button"
                className={`rounded-md border p-2 text-left text-sm transition-colors ${isSelected ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}
                onClick={() => onUpdate({ oopModel: model as OopModel })}
              >
                <div>{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* OOP Presets */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label>Out-of-Pocket Presets</Label>
          <InfoTooltip text="Pre-filled base amounts from official sources. Click one to set the OOP base amount." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {OOP_PRESETS.map((preset) => {
            const isSelected = hc.oopBaseAmount === preset.amount
            return (
              <button
                key={preset.label}
                type="button"
                className={`rounded-md border p-2 text-left text-sm transition-colors ${isSelected ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}
                onClick={() => onUpdate({ oopBaseAmount: preset.amount })}
              >
                <div className="font-medium">{preset.label}</div>
                <div className="text-xs text-muted-foreground">${preset.amount.toLocaleString()}/yr — {preset.description}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Age Multiplier Curve (only for age-curve model) */}
      {hc.oopModel === 'age-curve' && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Label>Age Multiplier Curve</Label>
            <InfoTooltip text="Study-Backed accounts for Singapore elderly subsidies. Conservative assumes higher costs (private care, no subsidies)." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['study-backed', 'conservative'] as const).map((variant) => {
              const labels: Record<string, [string, string]> = {
                'study-backed': ['Study-Backed (Recommended)', 'Accounts for SG elderly subsidies'],
                conservative: ['Conservative', 'Private care / higher costs'],
              }
              const [label, desc] = labels[variant]
              const isSelected = (hc.oopCurveVariant ?? 'study-backed') === variant
              return (
                <button
                  key={variant}
                  type="button"
                  className={`rounded-md border p-2 text-left text-sm transition-colors ${isSelected ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}
                  onClick={() => onUpdate({ oopCurveVariant: variant as OopCurveVariant })}
                >
                  <div>{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* OOP Base Amount + Medical Inflation */}
      <div className="grid gap-4 md:grid-cols-2">
        <CurrencyInput
          label="Out-of-Pocket Base Amount (at age 30)"
          tooltip="Annual out-of-pocket healthcare spending at age 30 in today's dollars. The age curve multiplies this by an age factor."
          value={hc.oopBaseAmount}
          onChange={(value) => onUpdate({ oopBaseAmount: value })}
        />
        <PercentInput
          label="Medical Inflation Rate"
          tooltip="Annual rate at which healthcare costs increase above general inflation. Singapore averages 3-5%."
          value={hc.oopInflationRate}
          onChange={(value) => onUpdate({ oopInflationRate: value })}
        />
      </div>

      <p className="text-xs text-muted-foreground italic">
        Use these estimates as a starting point for your plan. Actual costs vary by individual health, lifestyle, and care choices. Review and adjust the inputs above to match your situation.
      </p>

      {/* MediSave Top-Up */}
      <CurrencyInput
        label="Annual MediSave Top-Up"
        tooltip="Voluntary annual top-up to your MediSave Account. Helps offset premium deductions and extends MediSave runway."
        value={hc.mediSaveTopUpAnnual}
        onChange={(value) => onUpdate({ mediSaveTopUpAnnual: value })}
      />

      {/* Cost Preview by Age */}
      <div className="space-y-2">
        <Label>Cost Preview by Age</Label>
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Age</th>
                <th className="px-3 py-2 text-right font-medium">Premiums</th>
                <th className="px-3 py-2 text-right font-medium">Out-of-Pocket</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium text-primary">Cash Outlay</th>
                <th className="px-3 py-2 text-right font-medium">
                  Today's dollars
                  <InfoTooltip text={`Removes ${(inflationRate * 100).toFixed(1)}% medical inflation from out-of-pocket costs to show costs in current purchasing power.`} />
                </th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.age} className="border-b last:border-0">
                  <td className="px-3 py-1.5 font-medium">{row.age}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.premiums)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.oop)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.total)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-primary font-medium">{formatCurrency(row.cashOutlay)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.todaysDollars)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Cash outlay = total cost minus MediSave-deductible portion. Premiums are from CPF Board / MOH data (2025). Today's dollars removes {(inflationRate * 100).toFixed(1)}% medical inflation from out-of-pocket costs to show costs in current purchasing power.
        </p>
      </div>

      {/* Retirement summary */}
      <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
        At retirement (age {adult.retirementAge}): <strong>{formatCurrency(retCost.cashOutlay)}/yr cash outlay</strong> out of {formatCurrency(retCost.totalCost)}/yr total
      </div>

      {/* Healthcare Cost Composition Chart */}
      {chartData.length > 0 && (
        <div className="space-y-2">
          <Label>Healthcare Cost Composition</Label>
          <div className="rounded-md border p-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="age" tick={{ fontSize: 11 }} label={{ value: 'Age', position: 'insideBottom', offset: -2, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'premiums' ? 'Premiums' : name === 'oop' ? 'Out-of-Pocket' : 'MediSave Deductible']}
                  labelFormatter={(label: number) => `Age ${label}`}
                />
                <Area type="monotone" dataKey="premiums" stackId="1" fill="#93c5fd" stroke="#3b82f6" name="premiums" />
                <Area type="monotone" dataKey="oop" stackId="1" fill="#fdba74" stroke="#f97316" name="oop" />
                <Line type="monotone" dataKey="mediSave" stroke="#22c55e" strokeDasharray="5 5" dot={false} name="mediSave" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            Stacked: premiums + out-of-pocket. Dashed green line: MediSave-deductible portion. Gap above green = cash outlay.
          </p>
        </div>
      )}
    </div>
  )
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

  /** Resolve the adult whose ages should bound a timing-anchored row. */
  const getTimingAdult = (timingOwner: AdultOwner) =>
    adults.find((adult) => adult.owner === timingOwner) ?? selectedAdult

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
              <InfoTooltip text="Explicit owner plus age basis keeps household cashflow compilation deterministic. Use shared for household-wide costs and self or partner for private costs." />
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addExpense(createExpense('base-living', 'shared', selectedAdult.owner, selectedAdult.currentAge, selectedAdult.retirementAge, selectedAdult.lifeExpectancy, adults))}>
                Add living cost
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addExpense(createExpense('expense-adjustment', selectedAdult.owner, selectedAdult.owner, selectedAdult.currentAge, selectedAdult.retirementAge, selectedAdult.lifeExpectancy, adults))}>
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
                              {option === 'shared' ? 'Shared' : ownerLabel(option, adults)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Age based on</Label>
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
                              {ownerLabel(option, adults)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Periodicity</Label>
                      <Select
                        value={expense.periodicity}
                        onValueChange={(value) => {
                          const updates: Partial<ExpenseItem> = { periodicity: value as ExpenseItem['periodicity'] }
                          if (value === 'one-off') {
                            updates.timing = { ...timing, endAge: timing.startAge }
                            updates.growthModel = 'none'
                            updates.growthRate = 0
                          }
                          updateExpenseList(expense.id, updates)
                        }}
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
                    {expense.periodicity !== 'one-off' && (
                      <div className="space-y-1">
                        <Label>Growth</Label>
                        <Select
                          value={expense.growthModel ?? 'fixed'}
                          onValueChange={(value) => {
                            const updates: Partial<ExpenseItem> = { growthModel: value as ExpenseItem['growthModel'] }
                            if (value === 'none') updates.growthRate = 0
                            updateExpenseList(expense.id, updates)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inflation-linked">Inflation-linked</SelectItem>
                            <SelectItem value="fixed">Fixed rate</SelectItem>
                            <SelectItem value="none">No growth</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {expense.periodicity !== 'one-off' && (expense.growthModel ?? 'fixed') === 'fixed' && (
                      <PercentInput
                        label="Growth rate"
                        value={expense.growthRate ?? 0}
                        onChange={(value) => updateExpenseList(expense.id, { growthRate: value })}
                      />
                    )}
                    {expense.periodicity === 'one-off' ? (
                      <NumberInput
                        label="At age"
                        integer
                        min={0}
                        max={120}
                        value={timing.startAge}
                        onChange={(value) => updateExpenseList(expense.id, {
                          timing: { ...timing, startAge: value, endAge: value },
                        })}
                      />
                    ) : (
                      <>
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
                      </>
                    )}
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
            <Button type="button" variant="outline" size="sm" onClick={() => addExpense(createExpense('parent-support', selectedAdult.owner, selectedAdult.owner, selectedAdult.currentAge, selectedAdult.retirementAge, selectedAdult.lifeExpectancy, adults))}>
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
                              {option === 'shared' ? 'Shared' : ownerLabel(option, adults)}
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
                    <div className="space-y-1">
                      <Label>Growth</Label>
                      <Select
                        value={expense.growthModel ?? 'fixed'}
                        onValueChange={(value) => {
                          const updates: Partial<ExpenseItem> = { growthModel: value as ExpenseItem['growthModel'] }
                          if (value === 'none') updates.growthRate = 0
                          updateExpenseList(expense.id, updates)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inflation-linked">Inflation-linked</SelectItem>
                          <SelectItem value="fixed">Fixed rate</SelectItem>
                          <SelectItem value="none">No growth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(expense.growthModel ?? 'fixed') === 'fixed' && (
                      <PercentInput
                        label="Growth rate"
                        value={expense.growthRate ?? 0}
                        onChange={(value) => updateExpenseList(expense.id, { growthRate: value })}
                      />
                    )}
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
            <HealthcareDetails
              adult={selectedAdult}
              onUpdate={updateSelectedAdultHealthcare}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Retirement Withdrawals</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addExpense(createExpense('retirement-withdrawal', selectedAdult.owner, selectedAdult.owner, selectedAdult.currentAge, selectedAdult.retirementAge, selectedAdult.lifeExpectancy, adults))}>
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
              const timingAdult = getTimingAdult(timing.owner)
              const timedWithdrawal = syncTimingDuration(
                timing,
                { durationYears: expense.durationYears ?? 1 },
                timingAdult.lifeExpectancy,
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
                              {option === 'shared' ? 'Shared' : ownerLabel(option, adults)}
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
                      min={timingAdult.retirementAge}
                      max={timingAdult.lifeExpectancy}
                      value={timing.startAge}
                      onChange={(value) => updateExpenseList(
                        expense.id,
                        syncTimingDuration(
                          timing,
                          { startAge: value, durationYears: expense.durationYears ?? 1 },
                          timingAdult.lifeExpectancy,
                        ),
                      )}
                    />
                    <NumberInput
                      label="Duration (years)"
                      integer
                      min={1}
                      max={Math.max(1, timingAdult.lifeExpectancy - timing.startAge + 1)}
                      value={timedWithdrawal.durationYears}
                      onChange={(value) => updateExpenseList(
                        expense.id,
                        syncTimingDuration(
                          timing,
                          { durationYears: value },
                          timingAdult.lifeExpectancy,
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
            <CardTitle className="text-lg flex items-center gap-2">
              Financial Goals
              <InfoTooltip text="Plan for major life expenses like weddings, education, or home purchases. Pre-retirement goals reduce your annual savings. Post-retirement goals are deducted from your portfolio." />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Quick add from templates:</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_TEMPLATES.map((template) => (
                <button
                  key={template.category}
                  type="button"
                  onClick={() => addGoal(createGoal(
                    'shared',
                    selectedAdult.owner,
                    selectedAdult.currentAge,
                    { label: template.label, amount: template.defaultAmount, duration: template.defaultDuration, category: template.category },
                  ))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
                  title={template.description}
                >
                  {CATEGORY_ICONS[template.category]}
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          {plan.goals.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No financial goals planned. Add milestone expenses that could impact your savings timeline.
            </p>
          )}

          {plan.goals.map((goal) => {
            const goalErrors = getEntityErrors(validationErrors, 'goal', goal.id)
            const timing = ensureAgeRangeTiming(
              goal.timing,
              selectedAdult.owner,
              selectedAdult.currentAge + 5,
            )
            const goalTimingAdult = getTimingAdult(timing.owner)
            const timedGoal = syncTimingDuration(
              timing,
              { durationYears: goal.durationYears },
              goalTimingAdult.lifeExpectancy,
            )

            return (
              <div key={goal.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {CATEGORY_ICONS[goal.category]}
                    </span>
                    <input
                      type="text"
                      value={goal.label}
                      onChange={(event) => updateGoalList(goal.id, { label: event.target.value })}
                      className="text-sm font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1 w-48"
                    />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${PRIORITY_COLORS[goal.priority] ?? ''}`}>
                      {goal.priority}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGoal(goal.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    aria-label={`Remove ${goal.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {adults.length > 1 && (
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
                              {option === 'shared' ? 'Shared' : ownerLabel(option, adults)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {adults.length > 1 && (
                    <div className="space-y-1">
                      <Label>Age based on</Label>
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
                              {ownerLabel(option, adults)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <CurrencyInput
                    label="Amount"
                    value={goal.amount}
                    onChange={(value) => updateGoalList(goal.id, { amount: value })}
                    error={goalErrors.amount}
                    tooltip="Total cost of this goal (in today's dollars if inflation-adjusted)"
                  />
                  <NumberInput
                    label="Target age"
                    integer
                    min={goalTimingAdult.currentAge + 1}
                    max={goalTimingAdult.lifeExpectancy}
                    value={timing.startAge}
                    onChange={(value) => updateGoalList(
                      goal.id,
                      syncTimingDuration(
                        timing,
                        { startAge: value, durationYears: goal.durationYears },
                        goalTimingAdult.lifeExpectancy,
                      ),
                    )}
                    tooltip="Your age when this expense occurs"
                  />
                  <NumberInput
                    label="Duration (years)"
                    integer
                    min={1}
                    max={Math.max(1, goalTimingAdult.lifeExpectancy - timing.startAge + 1)}
                    value={timedGoal.durationYears}
                    onChange={(value) => updateGoalList(
                      goal.id,
                      syncTimingDuration(
                        timing,
                        { durationYears: value },
                        goalTimingAdult.lifeExpectancy,
                      ),
                    )}
                    tooltip="Set to 1 for a one-time expense. Set to more for multi-year costs (e.g., 4 years of university tuition)."
                  />
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

                <div className="flex flex-wrap items-center gap-4">
                  <div className="space-y-1">
                    <Label>Priority</Label>
                    <Select
                      value={goal.priority}
                      onValueChange={(value) => updateGoalList(goal.id, { priority: value as GoalItem['priority'] })}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="essential">Essential</SelectItem>
                        <SelectItem value="important">Important</SelectItem>
                        <SelectItem value="nice-to-have">Nice-to-have</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm pt-5">
                    <Checkbox
                      checked={goal.inflationAdjusted}
                      onCheckedChange={(checked) => updateGoalList(goal.id, { inflationAdjusted: checked === true })}
                    />
                    {goal.inflationAdjusted ? "Today's dollars" : 'Nominal (fixed)'}
                  </label>
                </div>
              </div>
            )
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addGoal(createGoal('shared', selectedAdult.owner, selectedAdult.currentAge))}
            className="text-primary"
          >
            <Target className="h-4 w-4 mr-1.5" />
            Add custom goal
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
