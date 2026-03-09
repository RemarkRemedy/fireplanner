import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, HeartPulse, Landmark, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { DEFAULT_PROFILE } from '@/stores/useProfileStore'
import { createId } from '@/lib/household/ids'
import { deriveHouseholdSectionToggles } from '@/lib/household/sectionVisibility'
import { grossUpFromTakeHome, netDownFromGross } from '@/lib/calculations/grossUp'
import { calculateFireNumber, calculateYearsToFire, projectNetWorthPath } from '@/lib/calculations/fire'
import { formatCurrency } from '@/lib/utils'
import type {
  Dependent,
  HouseholdPlanType,
  PlanningAdult,
} from '@/lib/household/types'
import type { SectionOrderKey } from '@/lib/household/sectionOrder'
import { trackEvent } from '@/lib/analytics'
import { MonthlyIncomeInput, MonthlyExpenseInput, NetWorthInput } from '@/components/shared/FinancialInputCards'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { QuickProjectionChart } from '@/components/shared/QuickProjectionChart'
import { PeopleRosterEditor, type SetupDependentDraft } from './PeopleRosterEditor'

interface HouseholdSetupWizardProps {
  planType: Exclude<HouseholdPlanType, 'individual'>
  pathway: SectionOrderKey
}

/** Per-person financial draft state */
interface PersonFinanceDraft {
  incomeType: 'take-home' | 'gross'
  monthlyIncome: number
  hasBonusAws: boolean
  bonusMonths: number
  monthlyExpenses: number
  netWorth: number
}

/** Computed FIRE metrics for one person */
interface PersonFireMetrics {
  totalExpenses: number
  annualSavings: number
  fireNumber: number
  yearsToFire: number
  fireYear: number
  savingsRate: number
  progress: number
  projection: { age: number; balance: number; phase: 'accumulation' | 'decumulation' }[]
  fireReachable: boolean
}

// Real return used for quick estimates (same as StartPage)
const NET_REAL_RETURN = DEFAULT_PROFILE.expectedReturn - DEFAULT_PROFILE.inflation - DEFAULT_PROFILE.expenseRatio

function createDefaultFinanceDraft(): PersonFinanceDraft {
  return {
    incomeType: 'take-home',
    monthlyIncome: 4000,
    hasBonusAws: false,
    bonusMonths: 1,
    monthlyExpenses: 0,
    netWorth: 0,
  }
}

/** All wizard fields that can be hydrated from an existing plan */
interface WizardSnapshot {
  selfName: string
  selfAge: number
  selfRetirementAge: number
  selfFinance: PersonFinanceDraft
  partnerName: string
  partnerAge: number
  partnerRetirementAge: number
  partnerFinance: PersonFinanceDraft
  jointMonthlyExpenses: number
  cpfEnabled: boolean
  propertyEnabled: boolean
  healthcareEnabled: boolean
}

/** Extract finance draft from a plan's income/expense/asset entries for a given owner */
function extractFinanceDraft(
  owner: 'self' | 'partner',
  adult: PlanningAdult,
  income: readonly { owner: string; kind: string; annualAmount: number; bonusMonths?: number }[],
  expenses: readonly { owner: string; kind: string; amount: number }[],
  assets: readonly { owner: string; kind: string; amount: number }[],
): PersonFinanceDraft {
  const salary = income.find((e) => e.kind === 'salary-model' && e.owner === owner)
  const bonusMonths = salary?.bonusMonths ?? 0
  const grossMonthly = salary ? Math.round(salary.annualAmount / (12 + bonusMonths)) : 0
  const expense = expenses.find((e) => e.kind === 'base-living' && e.owner === owner)
  const asset = assets.find((e) => e.kind === 'liquid-net-worth' && e.owner === owner)

  return {
    incomeType: 'gross',
    monthlyIncome: grossMonthly,
    hasBonusAws: bonusMonths > 0,
    bonusMonths: bonusMonths > 0 ? bonusMonths : 1,
    monthlyExpenses: expense ? Math.round(expense.amount / 12) : 0,
    netWorth: asset?.amount ?? adult.liquidNetWorth,
  }
}

/** Try to hydrate wizard state from an existing household plan. Returns null if no plan exists. */
function hydrateFromPlan(): WizardSnapshot | null {
  const { plan, provenance } = useHouseholdPlanStore.getState()
  if (!provenance.initializedAt) return null

  const self = plan.adults[0]
  if (!self) return null
  const partner = plan.adults[1]

  const ui = useUIStore.getState()

  const jointExpense = plan.expenses.find((e) => e.owner === 'shared' && e.kind === 'base-living')

  return {
    selfName: self.displayName,
    selfAge: self.currentAge,
    selfRetirementAge: self.retirementAge,
    selfFinance: extractFinanceDraft('self', self, plan.income, plan.expenses, plan.assets),
    partnerName: partner?.displayName ?? '',
    partnerAge: partner?.currentAge ?? 30,
    partnerRetirementAge: partner?.retirementAge ?? 65,
    partnerFinance: partner
      ? extractFinanceDraft('partner', partner, plan.income, plan.expenses, plan.assets)
      : createDefaultFinanceDraft(),
    jointMonthlyExpenses: jointExpense ? Math.round(jointExpense.amount / 12) : 4167,
    cpfEnabled: ui.cpfEnabled,
    propertyEnabled: ui.propertyEnabled,
    healthcareEnabled: ui.healthcareEnabled,
  }
}

function computeGrossMonthly(draft: PersonFinanceDraft, age: number): number {
  return draft.incomeType === 'take-home'
    ? grossUpFromTakeHome(draft.monthlyIncome, age)
    : draft.monthlyIncome
}

function computeAnnualIncome(draft: PersonFinanceDraft, age: number): number {
  const gross = computeGrossMonthly(draft, age)
  const bonusMonths = draft.hasBonusAws ? draft.bonusMonths : 0
  return gross * (12 + bonusMonths)
}

/** Compute FIRE preview metrics for one person, including their share of joint expenses */
function computePersonFireMetrics(
  draft: PersonFinanceDraft,
  age: number,
  retirementAge: number | undefined,
  halfJointAnnualExpenses: number,
  pathway: SectionOrderKey,
): PersonFireMetrics {
  const annualIncome = computeAnnualIncome(draft, age)
  const totalExpenses = draft.monthlyExpenses * 12 + halfJointAnnualExpenses
  const annualSavings = annualIncome - totalExpenses
  const fireNumber = calculateFireNumber(totalExpenses, DEFAULT_PROFILE.swr)
  const yearsToFire = calculateYearsToFire(NET_REAL_RETURN, annualSavings, draft.netWorth, fireNumber)
  const fireYear = Math.ceil(yearsToFire)
  const savingsRate = annualIncome > 0 ? annualSavings / annualIncome : 0
  const progress = fireNumber > 0 ? Math.min(1, draft.netWorth / fireNumber) : 0

  // Goal-first: use user's target. Story-first: cap at 65 if FIRE > 65 (same as StartPage)
  const computedFireAge = age + fireYear
  const effectiveRetirementAge =
    pathway === 'goal-first'
      ? retirementAge
      : computedFireAge > 65
        ? 65
        : undefined

  const rawProjection = projectNetWorthPath({
    currentAge: age,
    annualSavings,
    currentNW: draft.netWorth,
    realReturn: NET_REAL_RETURN,
    annualExpenses: totalExpenses,
    fireNumber,
    retirementAge: effectiveRetirementAge,
  })

  // Convert x-axis from age to years-from-now
  const projection = rawProjection.map((p) => ({ ...p, age: p.age - age }))

  const fireReachable = annualSavings > 0 && isFinite(yearsToFire) && yearsToFire >= 0

  return { totalExpenses, annualSavings, fireNumber, yearsToFire, fireYear, savingsRate, progress, projection, fireReachable }
}

/** Build the combined household projection by summing both adults' balances at each year */
function buildCombinedProjection(
  selfMetrics: PersonFireMetrics,
  partnerMetrics: PersonFireMetrics,
  combinedFireNumber: number,
): PersonFireMetrics['projection'] {
  const maxYear = Math.max(selfMetrics.projection.length, partnerMetrics.projection.length)
  const combined: PersonFireMetrics['projection'] = []
  let switched = false

  // Track last known balance so when one projection ends (death at life expectancy),
  // the surviving spouse inherits instead of the balance dropping to zero.
  const selfLastBal = selfMetrics.projection[selfMetrics.projection.length - 1]?.balance ?? 0
  const partnerLastBal = partnerMetrics.projection[partnerMetrics.projection.length - 1]?.balance ?? 0

  for (let year = 0; year < maxYear; year++) {
    const selfBal = selfMetrics.projection[year]?.balance ?? selfLastBal
    const partnerBal = partnerMetrics.projection[year]?.balance ?? partnerLastBal
    const total = selfBal + partnerBal
    if (!switched && total >= combinedFireNumber) switched = true
    combined.push({
      age: year, // years-from-now
      balance: total,
      phase: switched ? 'decumulation' : 'accumulation',
    })
  }

  return combined
}

function buildPartnerAdult(
  template: PlanningAdult,
  name: string,
  age: number,
  retirementAge: number,
  annualIncome: number,
  annualExpenses: number,
  liquidNetWorth: number,
): PlanningAdult {
  return {
    ...structuredClone(template),
    id: createId('adult-partner'),
    owner: 'partner',
    displayName: name || 'Partner',
    currentAge: age,
    retirementAge,
    annualIncome,
    annualExpenses,
    liquidNetWorth,
    lifeEvents: [],
    taxProfile: {
      ...structuredClone(template.taxProfile),
      reliefBasisAge: age,
    },
    healthcare: {
      ...structuredClone(template.healthcare),
      oopReferenceAge: age,
    },
  }
}

function buildDependentDraft(index: number): SetupDependentDraft {
  return {
    id: createId('dependent'),
    label: `Dependent ${index + 1}`,
    relationship: 'child',
    currentAge: 0,
  }
}

/** Compact FIRE preview metrics row */
function MetricsRow({ fireNumber, savingsRate, progress }: {
  fireNumber: number
  savingsRate: number
  progress: number
}) {
  const pct = (progress * 100).toFixed(1)
  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-sm text-center">
        <div>
          <span className="text-muted-foreground text-xs">FIRE Number</span>
          <div className="font-semibold">{formatCurrency(fireNumber)}</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Savings Rate</span>
          <div className="font-semibold">{(savingsRate * 100).toFixed(1)}%</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Progress</span>
          <div className="font-semibold">{pct}%</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden flex-1">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{pct}%</span>
      </div>
    </>
  )
}

/** Per-person FIRE preview card with metrics + chart */
function PersonPreview({ label, metrics, desiredRetirementAge }: {
  label: string
  metrics: PersonFireMetrics
  desiredRetirementAge?: number
}) {
  const alreadyFire = metrics.yearsToFire === 0
  const hasShortfall = desiredRetirementAge != null && (metrics.fireYear + (desiredRetirementAge - desiredRetirementAge)) > 0 && !metrics.fireReachable

  return (
    <div className="space-y-2">
      <div className="text-center space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        {!metrics.fireReachable ? (
          <div className="text-sm text-amber-600 dark:text-amber-400">Spending exceeds income</div>
        ) : alreadyFire ? (
          <div className="text-sm font-semibold">Already FI!</div>
        ) : (
          <div className="text-sm">
            FIRE in <span className="font-semibold">{metrics.fireYear} years</span>
          </div>
        )}
      </div>
      <MetricsRow fireNumber={metrics.fireNumber} savingsRate={metrics.savingsRate} progress={metrics.progress} />
      {metrics.fireReachable && (
        <QuickProjectionChart
          data={metrics.projection}
          fireNumber={metrics.fireNumber}
          fireAge={metrics.fireYear}
          xLabel="Years from now"
          tooltipLabelFormatter={(v) => `Year ${v}`}
        />
      )}
    </div>
  )
}

export function HouseholdSetupWizard({ planType, pathway }: HouseholdSetupWizardProps) {
  const navigate = useNavigate()
  const setUIField = useUIStore((state) => state.setField)
  const ensureHouseholdDataVisible = useUIStore((state) => state.ensureHouseholdDataVisible)

  // Hydrate from existing plan if available (so navigating back preserves values)
  const [snapshot] = useState(() => hydrateFromPlan())

  // Demographics
  const [selfName, setSelfName] = useState(snapshot?.selfName ?? 'You')
  const [selfAge, setSelfAge] = useState(snapshot?.selfAge ?? 30)
  const [partnerEnabled, setPartnerEnabled] = useState(planType === 'couple')
  const [partnerName, setPartnerName] = useState(snapshot?.partnerName ?? '')
  const [partnerAge, setPartnerAge] = useState(snapshot?.partnerAge ?? 30)
  const [dependents, setDependents] = useState<SetupDependentDraft[]>([])

  // Per-person financials
  const [selfFinance, setSelfFinance] = useState<PersonFinanceDraft>(snapshot?.selfFinance ?? createDefaultFinanceDraft)
  const [partnerFinance, setPartnerFinance] = useState<PersonFinanceDraft>(snapshot?.partnerFinance ?? createDefaultFinanceDraft)

  // Retirement ages (goal-first pathway)
  const [selfRetirementAge, setSelfRetirementAge] = useState(snapshot?.selfRetirementAge ?? 65)
  const [partnerRetirementAge, setPartnerRetirementAge] = useState(snapshot?.partnerRetirementAge ?? 65)

  // Joint expenses
  const [jointMonthlyExpenses, setJointMonthlyExpenses] = useState(snapshot?.jointMonthlyExpenses ?? 4167)

  // Section toggles
  const [cpfEnabled, setCpfEnabled] = useState(snapshot?.cpfEnabled ?? true)
  const [propertyEnabled, setPropertyEnabled] = useState(snapshot?.propertyEnabled ?? false)
  const [healthcareEnabled, setHealthcareEnabled] = useState(snapshot?.healthcareEnabled ?? false)

  const canCreatePlan = planType === 'couple' ? partnerName.trim().length > 0 : true
  const hasPartner = planType === 'couple' || partnerEnabled

  // Derived annual values
  const selfGrossMonthly = computeGrossMonthly(selfFinance, selfAge)
  const selfAnnualIncome = computeAnnualIncome(selfFinance, selfAge)
  const selfAnnualExpenses = selfFinance.monthlyExpenses * 12

  const partnerGrossMonthly = computeGrossMonthly(partnerFinance, partnerAge)
  const partnerAnnualIncome = computeAnnualIncome(partnerFinance, partnerAge)
  const partnerAnnualExpenses = partnerFinance.monthlyExpenses * 12

  const jointAnnualExpenses = jointMonthlyExpenses * 12

  // FIRE preview metrics (each person gets 50% of joint expenses)
  const halfJointAnnual = jointAnnualExpenses / 2

  const selfEffectiveRetirement = pathway === 'goal-first'
    ? Math.max(selfAge + 1, selfRetirementAge)
    : undefined
  const partnerEffectiveRetirement = pathway === 'goal-first'
    ? Math.max(partnerAge + 1, partnerRetirementAge)
    : undefined

  const selfMetrics = computePersonFireMetrics(
    selfFinance, selfAge, selfEffectiveRetirement, halfJointAnnual, pathway,
  )
  const partnerMetrics = hasPartner
    ? computePersonFireMetrics(partnerFinance, partnerAge, partnerEffectiveRetirement, halfJointAnnual, pathway)
    : null

  // Combined household metrics: sum both adults' expenses + full joint, sum both net worths
  const combinedTotalExpenses = selfMetrics.totalExpenses + (partnerMetrics?.totalExpenses ?? 0)
  const combinedFireNumber = calculateFireNumber(combinedTotalExpenses, DEFAULT_PROFILE.swr)
  const combinedSavings = selfMetrics.annualSavings + (partnerMetrics?.annualSavings ?? 0)
  const combinedIncome = selfAnnualIncome + (hasPartner ? partnerAnnualIncome : 0)
  const combinedNW = selfFinance.netWorth + (hasPartner ? partnerFinance.netWorth : 0)
  const combinedSavingsRate = combinedIncome > 0 ? combinedSavings / combinedIncome : 0
  const combinedProgress = combinedFireNumber > 0 ? Math.min(1, combinedNW / combinedFireNumber) : 0
  const combinedYearsToFire = calculateYearsToFire(NET_REAL_RETURN, combinedSavings, combinedNW, combinedFireNumber)
  const combinedFireYear = Math.ceil(combinedYearsToFire)
  const combinedFireReachable = combinedSavings > 0 && isFinite(combinedYearsToFire) && combinedYearsToFire >= 0

  const combinedProjection = hasPartner && partnerMetrics
    ? buildCombinedProjection(selfMetrics, partnerMetrics, combinedFireNumber)
    : selfMetrics.projection // Single-adult household: combined = self

  const showCharts = selfAnnualIncome > 0

  const handleSelfIncomeTypeChange = (newType: 'take-home' | 'gross') => {
    if (newType === selfFinance.incomeType) return
    const converted = newType === 'gross'
      ? Math.round(selfGrossMonthly)
      : Math.round(netDownFromGross(selfFinance.monthlyIncome, selfAge))
    setSelfFinance((prev) => ({ ...prev, incomeType: newType, monthlyIncome: converted }))
  }

  const handlePartnerIncomeTypeChange = (newType: 'take-home' | 'gross') => {
    if (newType === partnerFinance.incomeType) return
    const converted = newType === 'gross'
      ? Math.round(partnerGrossMonthly)
      : Math.round(netDownFromGross(partnerFinance.monthlyIncome, partnerAge))
    setPartnerFinance((prev) => ({ ...prev, incomeType: newType, monthlyIncome: converted }))
  }

  const handleCreatePlan = () => {
    const householdStore = useHouseholdPlanStore.getState()
    householdStore.initializeManualPlan(planType)

    const selfAdult = useHouseholdPlanStore.getState().plan.adults[0]
    if (!selfAdult) return

    const effectiveSelfRetirement = Math.max(selfAge + 1, selfRetirementAge)

    // Update self adult with demographics + financials
    useHouseholdPlanStore.getState().updateAdult(selfAdult.id, {
      displayName: selfName.trim() || 'You',
      currentAge: selfAge,
      retirementAge: effectiveSelfRetirement,
      annualIncome: selfAnnualIncome,
      annualExpenses: selfAnnualExpenses,
      liquidNetWorth: selfFinance.netWorth,
      lifeStage: selfAge >= 65 ? 'post-fire' : selfAdult.lifeStage,
      taxProfile: {
        ...structuredClone(selfAdult.taxProfile),
        reliefBasisAge: selfAge,
      },
      healthcare: {
        ...structuredClone(selfAdult.healthcare),
        oopReferenceAge: selfAge,
      },
    })

    // Update self's seeded salary-model income entry
    const currentPlan = useHouseholdPlanStore.getState().plan
    const selfSalary = currentPlan.income.find((entry) => (
      entry.kind === 'salary-model' && entry.owner === 'self' && entry.timing.kind === 'age-range'
    ))
    if (selfSalary?.timing.kind === 'age-range') {
      useHouseholdPlanStore.getState().updateIncome(selfSalary.id, {
        annualAmount: selfAnnualIncome,
        timing: {
          ...selfSalary.timing,
          startAge: selfAge,
          endAge: effectiveSelfRetirement,
        },
      })
    }

    // Update self's seeded base-living expense entry (personal expenses only)
    const selfExpense = currentPlan.expenses.find((entry) => (
      entry.kind === 'base-living' && entry.owner === 'self' && entry.timing.kind === 'age-range'
    ))
    if (selfExpense?.timing.kind === 'age-range') {
      useHouseholdPlanStore.getState().updateExpense(selfExpense.id, {
        amount: selfAnnualExpenses,
        timing: {
          ...selfExpense.timing,
          startAge: selfAge,
          endAge: null,
        },
      })
    }

    // Update self's seeded liquid-net-worth asset entry
    const selfAsset = currentPlan.assets.find((entry) => (
      entry.kind === 'liquid-net-worth' && entry.owner === 'self'
    ))
    if (selfAsset) {
      useHouseholdPlanStore.getState().updateAsset(selfAsset.id, {
        amount: selfFinance.netWorth,
      })
    }

    // Add partner if enabled
    if (hasPartner) {
      const effectivePartnerRetirement = Math.max(partnerAge + 1, partnerRetirementAge)

      useHouseholdPlanStore.getState().addAdult(
        buildPartnerAdult(selfAdult, partnerName.trim(), partnerAge, effectivePartnerRetirement, partnerAnnualIncome, partnerAnnualExpenses, partnerFinance.netWorth),
      )

      // Add partner salary-model income entry
      useHouseholdPlanStore.getState().addIncome({
        id: createId('income-salary-partner'),
        owner: 'partner',
        label: `${partnerName.trim() || 'Partner'}'s salary`,
        kind: 'salary-model',
        timing: {
          kind: 'age-range',
          owner: 'partner',
          startAge: partnerAge,
          endAge: effectivePartnerRetirement,
        },
        annualAmount: partnerAnnualIncome,
        growthRate: 0.03,
        salaryModel: 'simple',
        bonusMonths: partnerFinance.hasBonusAws ? partnerFinance.bonusMonths : 0,
        employerCpfEnabled: true,
      })

      // Add partner base-living expense entry (personal expenses)
      if (partnerAnnualExpenses > 0) {
        useHouseholdPlanStore.getState().addExpense({
          id: createId('expense-partner-living'),
          owner: 'partner',
          label: `${partnerName.trim() || 'Partner'}'s personal expenses`,
          kind: 'base-living',
          timing: {
            kind: 'age-range',
            owner: 'partner',
            startAge: partnerAge,
            endAge: null,
          },
          amount: partnerAnnualExpenses,
          periodicity: 'annual',
        })
      }

      // Add partner liquid-net-worth asset entry
      if (partnerFinance.netWorth > 0) {
        useHouseholdPlanStore.getState().addAsset({
          id: createId('asset-partner-liquid'),
          owner: 'partner',
          label: `${partnerName.trim() || 'Partner'}'s cash & investments`,
          kind: 'liquid-net-worth',
          amount: partnerFinance.netWorth,
        })
      }
    }

    // Add shared joint expenses entry
    if (jointAnnualExpenses > 0) {
      useHouseholdPlanStore.getState().addExpense({
        id: createId('expense-joint-living'),
        owner: 'shared',
        label: 'Additional joint expenses',
        kind: 'base-living',
        timing: {
          kind: 'age-range',
          owner: 'self',
          startAge: selfAge,
          endAge: null,
        },
        amount: jointAnnualExpenses,
        periodicity: 'annual',
      })
    }

    // Add dependents
    dependents.forEach((dependent) => {
      const entry: Dependent = {
        id: dependent.id,
        owner: 'shared',
        label: dependent.label.trim() || 'Dependent',
        relationship: dependent.relationship,
        currentAge: dependent.currentAge,
        timing: null,
        annualCost: 0,
      }
      useHouseholdPlanStore.getState().addDependent(entry)
    })

    setUIField('sectionOrder', pathway)
    setUIField('cpfEnabled', cpfEnabled)
    setUIField('propertyEnabled', propertyEnabled)
    setUIField('healthcareEnabled', healthcareEnabled)

    const plan = useHouseholdPlanStore.getState().plan
    ensureHouseholdDataVisible(deriveHouseholdSectionToggles(plan))

    trackEvent('onboarding_continue', {
      pathway,
      planType,
      partnerIncluded: hasPartner,
      dependents: dependents.length,
    })
    navigate('/inputs')
  }

  const selfLabel = hasPartner ? (selfName.trim() || 'You') : 'Your'

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">
            {planType === 'couple' ? 'Couple setup' : 'Household setup'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PeopleRosterEditor
            planType={planType}
            selfName={selfName}
            selfAge={selfAge}
            onSelfNameChange={setSelfName}
            onSelfAgeChange={setSelfAge}
            partnerEnabled={partnerEnabled}
            onPartnerEnabledChange={setPartnerEnabled}
            partnerName={partnerName}
            partnerAge={partnerAge}
            onPartnerNameChange={setPartnerName}
            onPartnerAgeChange={setPartnerAge}
            dependents={dependents}
            onAddDependent={() => setDependents((current) => [...current, buildDependentDraft(current.length)])}
            onUpdateDependent={(id, updates) =>
              setDependents((current) => current.map((dependent) => (
                dependent.id === id ? { ...dependent, ...updates } : dependent
              )))
            }
            onRemoveDependent={(id) =>
              setDependents((current) => current.filter((dependent) => dependent.id !== id))
            }
          />

          {/* Self's financial details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{selfLabel}{hasPartner ? "'s" : ''} finances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-4">
                {pathway === 'goal-first' && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Desired Retirement Age</Label>
                    <NumberInput
                      integer
                      min={selfAge + 1}
                      max={100}
                      value={selfRetirementAge}
                      onChange={setSelfRetirementAge}
                      className="border-blue-300"
                    />
                    {selfRetirementAge <= selfAge && (
                      <p className="text-xs text-destructive">Must be after current age</p>
                    )}
                  </div>
                )}
                <MonthlyIncomeInput
                  incomeType={selfFinance.incomeType}
                  onIncomeTypeChange={handleSelfIncomeTypeChange}
                  monthlyIncome={selfFinance.monthlyIncome}
                  onMonthlyIncomeChange={(v) => setSelfFinance((prev) => ({ ...prev, monthlyIncome: v }))}
                  hasBonusAws={selfFinance.hasBonusAws}
                  onHasBonusAwsChange={(v) => setSelfFinance((prev) => ({ ...prev, hasBonusAws: v }))}
                  bonusMonths={selfFinance.bonusMonths}
                  onBonusMonthsChange={(v) => setSelfFinance((prev) => ({ ...prev, bonusMonths: v }))}
                  grossMonthly={selfGrossMonthly}
                  annualIncome={selfAnnualIncome}
                  age={selfAge}
                  idSuffix="-self"
                />
                <MonthlyExpenseInput
                  monthlyExpenses={selfFinance.monthlyExpenses}
                  onMonthlyExpensesChange={(v) => setSelfFinance((prev) => ({ ...prev, monthlyExpenses: v }))}
                  annualExpenses={selfAnnualExpenses}
                  label="Personal Expenses"
                  tooltip="Personal monthly spending (not shared). Excludes healthcare and mortgage."
                />
                <NetWorthInput
                  value={selfFinance.netWorth}
                  onChange={(v) => setSelfFinance((prev) => ({ ...prev, netWorth: v }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Partner's financial details */}
          {hasPartner && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{partnerName.trim() || 'Partner'}'s finances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-4">
                  {pathway === 'goal-first' && (
                    <div className="flex flex-col gap-1">
                      <Label className="text-sm">Desired Retirement Age</Label>
                      <NumberInput
                        integer
                        min={partnerAge + 1}
                        max={100}
                        value={partnerRetirementAge}
                        onChange={setPartnerRetirementAge}
                        className="border-blue-300"
                      />
                      {partnerRetirementAge <= partnerAge && (
                        <p className="text-xs text-destructive">Must be after current age</p>
                      )}
                    </div>
                  )}
                  <MonthlyIncomeInput
                    incomeType={partnerFinance.incomeType}
                    onIncomeTypeChange={handlePartnerIncomeTypeChange}
                    monthlyIncome={partnerFinance.monthlyIncome}
                    onMonthlyIncomeChange={(v) => setPartnerFinance((prev) => ({ ...prev, monthlyIncome: v }))}
                    hasBonusAws={partnerFinance.hasBonusAws}
                    onHasBonusAwsChange={(v) => setPartnerFinance((prev) => ({ ...prev, hasBonusAws: v }))}
                    bonusMonths={partnerFinance.bonusMonths}
                    onBonusMonthsChange={(v) => setPartnerFinance((prev) => ({ ...prev, bonusMonths: v }))}
                    grossMonthly={partnerGrossMonthly}
                    annualIncome={partnerAnnualIncome}
                    age={partnerAge}
                    idSuffix="-partner"
                  />
                  <MonthlyExpenseInput
                    monthlyExpenses={partnerFinance.monthlyExpenses}
                    onMonthlyExpensesChange={(v) => setPartnerFinance((prev) => ({ ...prev, monthlyExpenses: v }))}
                    annualExpenses={partnerAnnualExpenses}
                    label="Personal Expenses"
                    tooltip="Personal monthly spending (not shared). Excludes healthcare and mortgage."
                  />
                  <NetWorthInput
                    value={partnerFinance.netWorth}
                    onChange={(v) => setPartnerFinance((prev) => ({ ...prev, netWorth: v }))}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional joint expenses */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Additional joint expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs">
                <CurrencyInput
                  label="Monthly Joint Expenses"
                  value={jointMonthlyExpenses}
                  onChange={setJointMonthlyExpenses}
                  tooltip="Shared household costs on top of each person's personal expenses: rent/mortgage, utilities, groceries, transport, insurance. Excludes healthcare."
                />
                {jointMonthlyExpenses > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    (~${jointAnnualExpenses.toLocaleString('en-SG', { maximumFractionDigits: 0 })}/year)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* FIRE preview charts */}
          {showCharts && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quick FIRE estimate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Per-person previews */}
                <div className={hasPartner ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''}>
                  <PersonPreview
                    label={hasPartner ? (selfName.trim() || 'You') : 'Your projection'}
                    metrics={selfMetrics}
                    desiredRetirementAge={pathway === 'goal-first' ? selfRetirementAge : undefined}
                  />
                  {hasPartner && partnerMetrics && (
                    <PersonPreview
                      label={partnerName.trim() || 'Partner'}
                      metrics={partnerMetrics}
                      desiredRetirementAge={pathway === 'goal-first' ? partnerRetirementAge : undefined}
                    />
                  )}
                </div>

                {/* Combined household chart */}
                {hasPartner && (
                  <div className="border-t pt-4 space-y-2">
                    <div className="text-center space-y-0.5">
                      <div className="text-sm font-medium">Combined household</div>
                      {!combinedFireReachable ? (
                        <div className="text-sm text-amber-600 dark:text-amber-400">Household spending exceeds income</div>
                      ) : (
                        <div className="text-sm">
                          Household FIRE in <span className="font-semibold">{combinedFireYear} years</span>
                        </div>
                      )}
                    </div>
                    <MetricsRow fireNumber={combinedFireNumber} savingsRate={combinedSavingsRate} progress={combinedProgress} />
                    {combinedFireReachable && (
                      <QuickProjectionChart
                        data={combinedProjection}
                        fireNumber={combinedFireNumber}
                        fireAge={combinedFireYear}
                        xLabel="Years from now"
                        tooltipLabelFormatter={(v) => `Year ${v}`}
                      />
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Quick estimate in today's dollars (3.6% Safe Withdrawal Rate, 7% return, 2.5% inflation).
                  Each person's chart includes 50% of joint expenses. Assumes joint costs split evenly; detailed plan will model survivor spending after one partner passes. Your detailed plan will adjust for inflation, CPF, and portfolio allocation.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Section toggles */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="font-medium">What should be visible next?</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">CPF section</div>
                      <div className="text-xs text-muted-foreground">
                        Keep CPF planning available for the household.
                      </div>
                    </div>
                  </div>
                  <Switch checked={cpfEnabled} onCheckedChange={setCpfEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HeartPulse className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Healthcare section</div>
                      <div className="text-xs text-muted-foreground">
                        Show MediShield, ISP, and out-of-pocket planning.
                      </div>
                    </div>
                  </div>
                  <Switch checked={healthcareEnabled} onCheckedChange={setHealthcareEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Property section</div>
                      <div className="text-xs text-muted-foreground">
                        Keep mortgage, HDB, and downsizing controls available.
                      </div>
                    </div>
                  </div>
                  <Switch checked={propertyEnabled} onCheckedChange={setPropertyEnabled} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="button" onClick={handleCreatePlan} disabled={!canCreatePlan}>
              Create plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
