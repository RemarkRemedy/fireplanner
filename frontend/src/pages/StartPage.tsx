import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import {
  HOUSEHOLD_PLAN_STORAGE_KEY,
  useHouseholdPlanStore,
} from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { calculateFireNumber, calculateYearsToFire, projectNetWorthPath } from '@/lib/calculations/fire'
import { Target, TrendingUp, CheckCircle, Clock, CalendarClock, Landmark, ArrowRight, Building, Heart, Info } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { QuickProjectionChart } from '@/components/shared/QuickProjectionChart'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { Label } from '@/components/ui/label'
import type { RetirementPhase } from '@/lib/types'
import { trackEvent } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import { DEFAULT_PROFILE } from '@/stores/useProfileStore'
import { LandingEmailSection } from '@/components/email/LandingEmailSection'
import { grossUpFromTakeHome, netDownFromGross, getCpfEmployeeRateLabel, isAboveOwCeiling } from '@/lib/calculations/grossUp'
import { Checkbox } from '@/components/ui/checkbox'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import type { HouseholdPlanType } from '@/lib/household/types'
import { PlanTypeSelector } from '@/components/household/PlanTypeSelector'
import { HouseholdSetupWizard } from '@/components/household/HouseholdSetupWizard'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'

type ActivePathway = 'goal-first' | 'story-first' | 'already-fire' | null

const PATHWAY_TITLES: Record<NonNullable<ActivePathway>, string> = {
  'goal-first': 'Set your targets',
  'story-first': 'Tell us about your finances',
  'already-fire': 'Your current situation',
}

const PHASE_CARDS: { phase: RetirementPhase; label: string; description: string; icon: typeof Clock }[] = [
  {
    phase: 'before-55',
    label: 'Before 55',
    description: 'Central Provident Fund (CPF) still accumulating. No CPF LIFE yet — you\'ll need your portfolio to bridge the gap.',
    icon: Clock,
  },
  {
    phase: '55-to-64',
    label: '55 to 64',
    description: 'Retirement sum locked in. CPF LIFE plan chosen, waiting for payouts to begin.',
    icon: CalendarClock,
  },
  {
    phase: '65-plus',
    label: '65 and above',
    description: 'CPF LIFE payouts active. Enter your known monthly amount directly.',
    icon: Landmark,
  },
]

export function StartPage() {
  usePageMeta({ title: 'SG FIRE Planner — Singapore Retirement Calculator', description: 'Free Singapore FIRE calculator with CPF, tax, Monte Carlo simulation, and 12 withdrawal strategies for retirement planning.', path: '/' })
  const { profile } = useHouseholdRuntimeInputs()
  const setUIField = useUIStore((s) => s.setField)
  const cpfEnabled = useUIStore((s) => s.cpfEnabled)
  const propertyEnabled = useUIStore((s) => s.propertyEnabled)
  const healthcareEnabled = useUIStore((s) => s.healthcareEnabled)
  const navigate = useNavigate()
  const [activePathway, setActivePathway] = useState<ActivePathway>(null)
  const [selectedPlanType, setSelectedPlanType] = useState<HouseholdPlanType>('individual')
  const [householdPlannerEnabled] = useState(() => isHouseholdPlannerV1Enabled())

  // Check if returning user (has saved profile in localStorage)
  const [isReturningUser] = useState(() => {
    try {
      return localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY) !== null
        || localStorage.getItem('fireplanner-profile') !== null
    } catch {
      return false
    }
  })

  // Local draft state for inline forms
  const [draftAge, setDraftAge] = useState(profile.currentAge)
  const [draftRetirementAge, setDraftRetirementAge] = useState(profile.retirementAge)
  const [draftNetWorth, setDraftNetWorth] = useState(profile.liquidNetWorth)

  // Monthly income state
  const [incomeType, setIncomeType] = useState<'take-home' | 'gross'>('take-home')
  const [draftMonthlyIncome, setDraftMonthlyIncome] = useState(
    () => Math.round(netDownFromGross(profile.annualIncome / 12, profile.currentAge))
  )
  const [hasBonusAws, setHasBonusAws] = useState(false)
  const [bonusMonths, setBonusMonths] = useState(1)

  // Monthly expenses state
  const [draftMonthlyExpenses, setDraftMonthlyExpenses] = useState(
    () => Math.round(profile.annualExpenses / 12)
  )

  // Derived annual values — used by FIRE calcs and store writes
  const grossMonthly = incomeType === 'take-home'
    ? grossUpFromTakeHome(draftMonthlyIncome, draftAge)
    : draftMonthlyIncome
  const draftBonusMonths = hasBonusAws ? bonusMonths : 0
  const draftIncome = grossMonthly * (12 + draftBonusMonths)
  const draftExpenses = draftMonthlyExpenses * 12

  // Convert the displayed value when switching modes so annual income stays stable
  const handleIncomeTypeChange = (newType: 'take-home' | 'gross') => {
    if (newType === incomeType) return
    if (newType === 'gross') {
      // Switching to gross: show the gross equivalent of the current take-home
      setDraftMonthlyIncome(Math.round(grossMonthly))
    } else {
      // Switching to take-home: show the take-home equivalent of the current gross
      setDraftMonthlyIncome(Math.round(netDownFromGross(draftMonthlyIncome, draftAge)))
    }
    setIncomeType(newType)
  }
  const activePlanType: HouseholdPlanType = selectedPlanType

  // Reset pathway when switching plan type so user makes a fresh choice
  useEffect(() => {
    setActivePathway(null)
  }, [activePlanType])

  // Compute preliminary FIRE metrics from draft values using canonical profile defaults
  const draftFireNumber = calculateFireNumber(draftExpenses, DEFAULT_PROFILE.swr)
  const draftNetRealReturn = DEFAULT_PROFILE.expectedReturn - DEFAULT_PROFILE.inflation - DEFAULT_PROFILE.expenseRatio
  const draftAnnualSavings = draftIncome - draftExpenses
  const draftYearsToFire = calculateYearsToFire(
    draftNetRealReturn,
    draftAnnualSavings,
    draftNetWorth,
    draftFireNumber
  )
  const draftFireAge = draftAge + Math.ceil(draftYearsToFire)
  const draftSavingsRate = draftIncome > 0 ? draftAnnualSavings / draftIncome : 0
  const draftProgress = draftFireNumber > 0 ? Math.min(1, draftNetWorth / draftFireNumber) : 0

  // Determine the effective retirement age for the projection:
  // - Goal-first: use the user's desired retirement age
  // - Story-first: use 65 (default SG retirement benchmark) if FIRE age > 65
  const effectiveRetirementAge =
    activePathway === 'goal-first'
      ? draftRetirementAge
      : draftFireAge > 65
        ? 65
        : undefined

  // Year-by-year projection for the chart
  const draftProjection = projectNetWorthPath({
    currentAge: draftAge,
    annualSavings: draftAnnualSavings,
    currentNW: draftNetWorth,
    realReturn: draftNetRealReturn,
    annualExpenses: draftExpenses,
    fireNumber: draftFireNumber,
    retirementAge: effectiveRetirementAge,
  })

  // Show results when inputs are filled and valid
  const showResults = draftAge >= 18 && draftIncome > 0 && draftExpenses > 0 && draftFireNumber > 0
  const fireReachable = showResults && draftAnnualSavings > 0 && isFinite(draftYearsToFire) && draftYearsToFire >= 0

  const handlePathwayClick = (pathway: ActivePathway) => {
    if (activePathway === pathway) {
      // Toggle off if clicking the same one
      setActivePathway(null)
      return
    }
    setActivePathway(pathway)
    if (pathway) trackEvent('onboarding_pathway_selected', { pathway })
    // Reset drafts to current store values
    setDraftAge(profile.currentAge)
    setDraftRetirementAge(profile.retirementAge)
    setDraftNetWorth(profile.liquidNetWorth)
    setIncomeType('take-home')
    setDraftMonthlyIncome(Math.round(netDownFromGross(profile.annualIncome / 12, profile.currentAge)))
    setDraftMonthlyExpenses(Math.round(profile.annualExpenses / 12))
    setHasBonusAws(false)
    setBonusMonths(1)
  }

  const applyIndividualDraft = (
    nextRetirementAge: number,
    lifeStage: 'pre-fire' | 'post-fire',
    retirementPhase: RetirementPhase | null = null,
  ) => {
    const householdStore = useHouseholdPlanStore.getState()
    householdStore.initializeManualPlan('individual')

    const nextPlan = useHouseholdPlanStore.getState().plan
    const selfAdult = nextPlan.adults.find((adult) => adult.owner === 'self')
    if (!selfAdult) {
      return
    }

    householdStore.updateAdult(selfAdult.id, {
      currentAge: draftAge,
      retirementAge: nextRetirementAge,
      annualIncome: draftIncome,
      annualExpenses: draftExpenses,
      liquidNetWorth: draftNetWorth,
      lifeStage,
      cpf: {
        ...selfAdult.cpf,
        retirementPhase,
      },
    })

    const refreshedPlan = useHouseholdPlanStore.getState().plan
    const salaryModel = refreshedPlan.income.find((entry) => (
      entry.kind === 'salary-model'
      && entry.owner === 'self'
      && entry.timing.owner === 'self'
      && entry.timing.kind === 'age-range'
    ))
    if (salaryModel?.timing.kind === 'age-range') {
      householdStore.updateIncome(salaryModel.id, {
        annualAmount: draftIncome,
        timing: {
          ...salaryModel.timing,
          startAge: draftAge,
          endAge: nextRetirementAge,
        },
      })
    }

    const baseExpense = refreshedPlan.expenses.find((expense) => (
      expense.kind === 'base-living'
      && expense.owner === 'self'
      && expense.timing.kind === 'age-range'
      && expense.timing.owner === 'self'
    ))
    if (baseExpense?.timing.kind === 'age-range') {
      householdStore.updateExpense(baseExpense.id, {
        amount: draftExpenses,
        timing: {
          ...baseExpense.timing,
          startAge: draftAge,
          endAge: null,
        },
      })
    }
  }

  const handleGoalFirstContinue = () => {
    applyIndividualDraft(draftRetirementAge, 'pre-fire')
    setUIField('sectionOrder', 'goal-first')
    trackEvent('onboarding_continue', { pathway: 'goal-first' })
    navigate('/inputs')
  }

  const handleStoryFirstContinue = () => {
    applyIndividualDraft(profile.retirementAge, 'pre-fire')
    setUIField('sectionOrder', 'story-first')
    trackEvent('onboarding_continue', { pathway: 'story-first' })
    navigate('/inputs')
  }

  const handleAlreadyFirePhase = (phase: RetirementPhase) => {
    applyIndividualDraft(draftAge, 'post-fire', phase)
    setUIField('sectionOrder', 'already-fire')
    trackEvent('onboarding_continue', { pathway: 'already-fire', phase })
    navigate('/inputs')
  }

  const pathwayCards: { key: ActivePathway & string; label: string; description: string; icon: typeof Target }[] = [
    {
      key: 'goal-first',
      label: 'I know when I want to retire',
      description: 'Set your FIRE targets first, then fill in your financial details to see if you\'re on track.',
      icon: Target,
    },
    {
      key: 'story-first',
      label: 'Show me what\'s possible',
      description: 'Enter your financial situation and see what retirement age the numbers support.',
      icon: TrendingUp,
    },
    {
      key: 'already-fire',
      label: 'I already have enough',
      description: 'You\'ve reached or are close to FIRE. Focus on making your money last — withdrawal strategies, allocation, and spending.',
      icon: CheckCircle,
    },
  ]

  const goalFirstValid = draftAge >= 18 && draftAge <= 100
    && draftRetirementAge > draftAge && draftRetirementAge <= 100

  const storyFirstValid = draftAge >= 18 && draftAge <= 100
    && draftIncome >= 0

  const alreadyFireValid = draftAge >= 18 && draftAge <= 100

  // Shared section toggles — rendered inline within each pathway's form card
  const sectionToggles = (
    <div className="space-y-4 pt-4 border-t">
      <div className="text-sm font-medium">What should we include?</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">CPF Integration</div>
            <p className="text-xs text-muted-foreground">Central Provident Fund (CPF) balances, contributions, and LIFE payouts</p>
          </div>
        </div>
        <Switch
          checked={cpfEnabled}
          onCheckedChange={(v) => { setUIField('cpfEnabled', v); trackEvent('feature_toggle', { feature: 'cpf', enabled: v }) }}
        />
      </div>
      {cpfEnabled && (
        <div className="flex items-center justify-between ml-4 pl-4 border-l-2 border-muted-foreground/20">
          <div className="flex items-center gap-3">
            <Heart className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Healthcare Planning</div>
              <p className="text-xs text-muted-foreground">MediShield, CareShield, and out-of-pocket estimates</p>
            </div>
          </div>
          <Switch
            checked={healthcareEnabled}
            onCheckedChange={(v) => { setUIField('healthcareEnabled', v); trackEvent('feature_toggle', { feature: 'healthcare', enabled: v }) }}
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Property Analysis</div>
            <p className="text-xs text-muted-foreground">Existing property, mortgage tracking, and purchase analysis</p>
          </div>
        </div>
        <Switch
          checked={propertyEnabled}
          onCheckedChange={(v) => { setUIField('propertyEnabled', v); trackEvent('feature_toggle', { feature: 'property', enabled: v }) }}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="py-8">
        <h1 className="text-3xl font-bold">Singapore FIRE Planner</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Plan your path to Financial Independence with Singapore-specific calculations.
        </p>
      </div>

      {/* Returning user guidance */}
      {isReturningUser && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p>
              Want to switch your path or mode? Go ahead — your existing inputs are safe.
              To see your results, head to the{' '}
              <Link to="/dashboard" className="font-medium underline hover:no-underline">
                Dashboard
              </Link>.
            </p>
          </div>
        </div>
      )}

      {householdPlannerEnabled && (
        <PlanTypeSelector value={activePlanType} onChange={setSelectedPlanType} />
      )}

      {/* Pathway cards — shown for all plan types */}
      <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-4">
        {pathwayCards.map(({ key, label, description, icon: Icon }, index) => (
          <button
            key={key}
            onClick={() => handlePathwayClick(key as ActivePathway)}
            className="text-left h-full opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <Card className={`h-full transition-all duration-200 cursor-pointer ${
              activePathway === key
                ? 'bg-primary/5 ring-2 ring-primary/20 border-primary shadow-md'
                : activePathway !== null
                  ? 'opacity-75 hover:opacity-100 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5'
                  : 'hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5'
            }`}>
              <CardContent className="py-6 md:py-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{label}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Household setup wizard — shown after pathway selection for couple/household */}
      {activePlanType !== 'individual' && activePathway && householdPlannerEnabled && (
        <HouseholdSetupWizard planType={activePlanType} pathway={activePathway} />
      )}

      {/* Goal-first inline form */}
      {activePlanType === 'individual' && activePathway === 'goal-first' && (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">{PATHWAY_TITLES['goal-first']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-sm">Current Age</Label>
                <NumberInput
                  integer
                  min={18}
                  max={100}
                  value={draftAge}
                  onChange={setDraftAge}
                  className="border-blue-300"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-sm">Desired Retirement Age</Label>
                <NumberInput
                  integer
                  min={draftAge + 1}
                  max={100}
                  value={draftRetirementAge}
                  onChange={setDraftRetirementAge}
                  className="border-blue-300"
                />
                {draftRetirementAge <= draftAge && (
                  <p className="text-xs text-destructive">Must be after current age</p>
                )}
              </div>
              <MonthlyIncomeInput
                incomeType={incomeType}
                onIncomeTypeChange={handleIncomeTypeChange}
                monthlyIncome={draftMonthlyIncome}
                onMonthlyIncomeChange={setDraftMonthlyIncome}
                hasBonusAws={hasBonusAws}
                onHasBonusAwsChange={setHasBonusAws}
                bonusMonths={bonusMonths}
                onBonusMonthsChange={setBonusMonths}
                grossMonthly={grossMonthly}
                annualIncome={draftIncome}
                age={draftAge}
              />
              <MonthlyExpenseInput
                monthlyExpenses={draftMonthlyExpenses}
                onMonthlyExpensesChange={setDraftMonthlyExpenses}
                annualExpenses={draftExpenses}
              />
              <NetWorthInput value={draftNetWorth} onChange={setDraftNetWorth} />
            </div>
            {showResults && <QuickResults fireNumber={draftFireNumber} yearsToFire={draftYearsToFire} fireAge={draftFireAge} savingsRate={draftSavingsRate} progress={draftProgress} projection={draftProjection} desiredRetirementAge={draftRetirementAge} fireReachable={fireReachable} />}
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={handleGoalFirstContinue}
                disabled={!goalFirstValid}
              >
                Build my full plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Includes CPF, property, Monte Carlo stress testing, and 12 withdrawal strategies</p>
            </div>
            {sectionToggles}
          </CardContent>
        </Card>
      )}

      {/* Story-first inline form */}
      {activePlanType === 'individual' && activePathway === 'story-first' && (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">{PATHWAY_TITLES['story-first']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-sm">Current Age</Label>
                <NumberInput
                  integer
                  min={18}
                  max={100}
                  value={draftAge}
                  onChange={setDraftAge}
                  className="border-blue-300"
                />
              </div>
              <MonthlyIncomeInput
                incomeType={incomeType}
                onIncomeTypeChange={handleIncomeTypeChange}
                monthlyIncome={draftMonthlyIncome}
                onMonthlyIncomeChange={setDraftMonthlyIncome}
                hasBonusAws={hasBonusAws}
                onHasBonusAwsChange={setHasBonusAws}
                bonusMonths={bonusMonths}
                onBonusMonthsChange={setBonusMonths}
                grossMonthly={grossMonthly}
                annualIncome={draftIncome}
                age={draftAge}
              />
              <MonthlyExpenseInput
                monthlyExpenses={draftMonthlyExpenses}
                onMonthlyExpensesChange={setDraftMonthlyExpenses}
                annualExpenses={draftExpenses}
              />
              <NetWorthInput value={draftNetWorth} onChange={setDraftNetWorth} />
            </div>
            {showResults && <QuickResults fireNumber={draftFireNumber} yearsToFire={draftYearsToFire} fireAge={draftFireAge} savingsRate={draftSavingsRate} progress={draftProgress} projection={draftProjection} desiredRetirementAge={draftFireAge > 65 ? 65 : undefined} fireReachable={fireReachable} />}
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={handleStoryFirstContinue}
                disabled={!storyFirstValid}
              >
                Build my full plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Includes CPF, property, Monte Carlo stress testing, and 12 withdrawal strategies</p>
            </div>
            {sectionToggles}
          </CardContent>
        </Card>
      )}

      {/* Already FIRE: age + net worth, then phase cards */}
      {activePlanType === 'individual' && activePathway === 'already-fire' && (
        <div className="space-y-4">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">{PATHWAY_TITLES['already-fire']}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Current Age</Label>
                  <NumberInput
                    integer
                    min={18}
                    max={100}
                    value={draftAge}
                    onChange={setDraftAge}
                    className="border-blue-300"
                  />
                </div>
                <MonthlyIncomeInput
                  incomeType={incomeType}
                  onIncomeTypeChange={handleIncomeTypeChange}
                  monthlyIncome={draftMonthlyIncome}
                  onMonthlyIncomeChange={setDraftMonthlyIncome}
                  hasBonusAws={hasBonusAws}
                  onHasBonusAwsChange={setHasBonusAws}
                  bonusMonths={bonusMonths}
                  onBonusMonthsChange={setBonusMonths}
                  grossMonthly={grossMonthly}
                  annualIncome={draftIncome}
                  age={draftAge}
                />
                <MonthlyExpenseInput
                  monthlyExpenses={draftMonthlyExpenses}
                  onMonthlyExpensesChange={setDraftMonthlyExpenses}
                  annualExpenses={draftExpenses}
                />
                <NetWorthInput value={draftNetWorth} onChange={setDraftNetWorth} />
              </div>
              {sectionToggles}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">What's your CPF stage?</h2>
              <p className="text-sm text-muted-foreground">
                This determines which CPF inputs are relevant for you.
              </p>
            </div>
            <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-4">
              {PHASE_CARDS.map(({ phase, label, description, icon: Icon }, index) => (
                <button
                  key={phase}
                  onClick={() => handleAlreadyFirePhase(phase)}
                  disabled={!alreadyFireValid}
                  className="text-left h-full disabled:opacity-50 disabled:cursor-not-allowed opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Card className="h-full hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                    <CardContent className="py-6 md:py-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">{label}</div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isReturningUser && <LandingEmailSection />}

      {/* Continue links for returning users */}
      {isReturningUser && (
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/inputs">
              Continue inputs
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/dashboard">
              View Dashboard
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function MonthlyIncomeInput({
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
}: {
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
}) {
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
          id="bonus-aws"
          checked={hasBonusAws}
          onCheckedChange={(checked) => onHasBonusAwsChange(checked === true)}
        />
        <label htmlFor="bonus-aws" className="text-xs text-muted-foreground cursor-pointer">
          I receive bonus / AWS
        </label>
        {hasBonusAws && (
          <div className="flex items-center gap-1">
            <NumberInput
              value={bonusMonths}
              onChange={onBonusMonthsChange}
              min={0}
              max={6}
              step={0.1}
              className="w-14 h-7 text-xs border-blue-300"
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

function MonthlyExpenseInput({
  monthlyExpenses,
  onMonthlyExpensesChange,
  annualExpenses,
}: {
  monthlyExpenses: number
  onMonthlyExpensesChange: (value: number) => void
  annualExpenses: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <CurrencyInput
        label="Monthly Expenses"
        value={monthlyExpenses}
        onChange={onMonthlyExpensesChange}
        tooltip="Excludes healthcare insurance and mortgage — those are modelled separately in their own sections."
      />
      {monthlyExpenses > 0 && (
        <div className="text-xs text-muted-foreground">
          (~${annualExpenses.toLocaleString('en-SG', { maximumFractionDigits: 0 })}/year)
        </div>
      )}
    </div>
  )
}

function QuickResults({
  fireNumber,
  yearsToFire,
  fireAge,
  savingsRate,
  progress,
  projection,
  desiredRetirementAge,
  fireReachable,
}: {
  fireNumber: number
  yearsToFire: number
  fireAge: number
  savingsRate: number
  progress: number
  projection: { age: number; balance: number; phase: 'accumulation' | 'decumulation' }[]
  desiredRetirementAge?: number
  fireReachable: boolean
}) {
  const pct = (progress * 100).toFixed(1)

  // Detect portfolio depletion before life expectancy
  const lifeExpectancy = projection.length > 0 ? projection[projection.length - 1].age : 90
  const depletionEntry = projection.find(
    (p) => p.phase === 'decumulation' && p.balance <= 0
  )
  const depletionAge = depletionEntry?.age ?? null
  const depletesBeforeDeath = depletionAge !== null && depletionAge < lifeExpectancy
  const shortfallYears = depletesBeforeDeath ? lifeExpectancy - depletionAge : 0

  // Determine messaging scenario
  const alreadyFire = yearsToFire === 0
  const hasShortfall = desiredRetirementAge != null && fireAge > desiredRetirementAge

  return (
    <div className="col-span-full mt-4 p-4 rounded-lg border bg-muted/30 space-y-3">
      {/* Hero messaging */}
      <div className="text-center space-y-1">
        {!fireReachable ? (
          <>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              You're spending more than you earn
            </div>
            <div className="text-sm text-muted-foreground">
              The full planner can model paths to close the gap.
            </div>
          </>
        ) : alreadyFire ? (
          <>
            <div className="text-2xl font-bold">
              You've already reached Financial Independence!
            </div>
            <div className="text-sm text-muted-foreground">
              Your savings exceed your FIRE number — focus on making it last
            </div>
          </>
        ) : hasShortfall ? (
          <>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              Retiring at {desiredRetirementAge} would leave a shortfall
            </div>
            <div className="text-sm text-muted-foreground">
              At your current pace, financial independence is at age {fireAge}.
              {depletesBeforeDeath
                ? ` If you stop working at ${desiredRetirementAge}, your portfolio runs out by age ${depletionAge}.`
                : ` You'd need to save more, earn more, or spend less to close the gap.`}
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">
              {desiredRetirementAge != null && fireAge < desiredRetirementAge
                ? `You're on track — FIRE by age ${fireAge}`
                : `You could retire at Age ${fireAge}`}
            </div>
            <div className="text-sm text-muted-foreground">
              {desiredRetirementAge != null && fireAge < desiredRetirementAge
                ? `That's ${desiredRetirementAge - fireAge} years ahead of your target retirement at ${desiredRetirementAge}`
                : `That's ${Math.ceil(yearsToFire)} years from now`}
            </div>
          </>
        )}
      </div>

      {/* Depletion warning — shown for non-shortfall cases too (e.g. story-first with age > 65) */}
      {fireReachable && depletesBeforeDeath && !hasShortfall && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span className="font-medium">Portfolio runs out at age {depletionAge}</span> — that's {shortfallYears} {shortfallYears === 1 ? 'year' : 'years'} short of your life expectancy ({lifeExpectancy}).
          Consider reducing expenses, saving more, or working a few extra years.
        </div>
      )}

      {/* Supporting metrics row */}
      <div className="grid grid-cols-3 gap-2 text-sm text-center">
        <div>
          <span className="text-muted-foreground text-xs">FIRE Number</span>
          <div className="font-semibold">
            ${fireNumber.toLocaleString('en-SG', { maximumFractionDigits: 0 })}
          </div>
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

      {/* Progress bar with percentage at end */}
      <div className="flex items-center gap-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden flex-1">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{pct}%</span>
      </div>

      {/* Net worth projection chart — only shown when FIRE is reachable */}
      {fireReachable && (
        <QuickProjectionChart data={projection} fireNumber={fireNumber} fireAge={fireAge} />
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground">
        Quick estimate in today's dollars (3.6% Safe Withdrawal Rate, 7% return, 2.5% inflation).
        Your detailed plan will adjust for inflation, CPF, and portfolio allocation.
      </p>
    </div>
  )
}

function NetWorthInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <CurrencyInput
        label="Cash & Investments"
        value={value}
        onChange={onChange}
        tooltip="Cash, savings, stocks, bonds, and other investments — excluding CPF and property"
      />
      <div className="text-xs text-muted-foreground">
        Savings, stocks, bonds — not CPF or property
      </div>
    </div>
  )
}
