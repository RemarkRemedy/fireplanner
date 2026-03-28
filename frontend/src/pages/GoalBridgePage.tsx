import { useState, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { applySetupDraft } from '@/lib/household/setupDraft'
import type { SetupDraft } from '@/lib/household/setupDraft'
import { mapGoalToHouseholdGoalItem } from '@/lib/calculations/goal-calculator'
import type { GoalCalcBasics, GoalCalcGoal } from '@/lib/calculations/goal-calculator'
import type { GoalItem, TimingRule } from '@/lib/household/types'
import { grossUpFromTakeHome } from '@/lib/calculations/grossUp'
import {
  MORTGAGE_RATES,
  LOAN_TENURE_YEARS,
  getHdbPriceRange,
} from '@/lib/data/goal-defaults'

// ============================================================
// Read goal calculator state from localStorage
// ============================================================

interface GoalCalcState {
  step: string
  activeTileId: string | null
  goals: GoalCalcGoal[]
  basics: GoalCalcBasics | null
}

function readGoalCalcState(): GoalCalcState | null {
  try {
    const raw = localStorage.getItem('goal-calc-state')
    if (!raw) return null
    const parsed = JSON.parse(raw) as GoalCalcState
    if (!parsed.basics || !Array.isArray(parsed.goals)) return null
    return parsed
  } catch {
    return null
  }
}

// ============================================================
// Residency selector
// ============================================================

type Residency = 'citizen' | 'pr' | 'foreigner'

const RESIDENCY_OPTIONS: { value: Residency; label: string; description: string }[] = [
  { value: 'citizen', label: 'Citizen', description: 'Full CPF contributions' },
  { value: 'pr', label: 'PR', description: 'CPF after 1st/2nd year' },
  { value: 'foreigner', label: 'Foreigner', description: 'No CPF' },
]

// ============================================================
// Page component
// ============================================================

export function GoalBridgePage() {
  usePageMeta({
    title: 'Complete Your Profile',
    description: 'Two quick questions to build your full financial projection.',
    path: '/goal-calculator/bridge',
  })

  const navigate = useNavigate()
  const setUIField = useUIStore((s) => s.setField)
  const addGoal = useHouseholdPlanStore((s) => s.addGoal)

  const [retirementAge, setRetirementAge] = useState(62)
  const [residency, setResidency] = useState<Residency>('citizen')
  const [partnerRetirementAge, setPartnerRetirementAge] = useState(62)
  const [transferring, setTransferring] = useState(false)

  const calcState = useMemo(() => readGoalCalcState(), [])
  const basics = calcState?.basics ?? null
  const goals = useMemo(() => calcState?.goals ?? [], [calcState])
  const isCoupleMode = !!basics?.partnerAge

  const handleContinue = useCallback(() => {
    if (transferring || !basics) return
    setTransferring(true)

    // Derive gross income
    const grossIncome = basics.grossIncome
      ?? grossUpFromTakeHome(basics.monthlyIncome, basics.age)
    const partnerGross = isCoupleMode
      ? (basics.partnerGrossIncome ?? grossUpFromTakeHome(basics.partnerMonthlyIncome ?? 0, basics.partnerAge!))
      : 0

    // Separate property goals from non-property goals.
    // The FIRST property goal becomes a native PropertyPlan (full CPF OA housing
    // deductions, mortgage, equity modeled by the projection engine).
    // Additional property goals and non-property goals become GoalItems.
    const propertyGoals = goals.filter((g) => g.category === 'housing' && g.smartInputs)
    const nonPropertyGoals = goals.filter((g) => g.category !== 'housing' || !g.smartInputs)
    const primaryPropertyGoal = propertyGoals[0] ?? null
    const extraPropertyGoals = propertyGoals.slice(1)

    // Derive property details for the draft
    let ownsProperty: 'planning' | 'no' = 'no'
    let purchasePrice: number | undefined
    let purchaseYearsFromNow: number | undefined
    let propertyType: 'hdb' | 'condo' | 'landed' | undefined
    let mortgageRate: number | undefined
    let mortgageTerm: number | undefined
    let ltv: number | undefined

    if (primaryPropertyGoal?.smartInputs) {
      ownsProperty = 'planning'
      const si = primaryPropertyGoal.smartInputs
      purchaseYearsFromNow = Math.max(0, primaryPropertyGoal.targetAge - basics.age)

      switch (si.kind) {
        case 'hdb':
          propertyType = 'hdb'
          purchasePrice = si.priceOverride ?? getHdbPriceRange(si.flatType, si.tenure).midpoint
          mortgageRate = si.loanType === 'hdb-loan' ? MORTGAGE_RATES.hdb : MORTGAGE_RATES.bank
          mortgageTerm = si.loanType === 'hdb-loan' ? LOAN_TENURE_YEARS.hdb : LOAN_TENURE_YEARS.bank
          ltv = si.loanType === 'hdb-loan' ? 0.90 : 0.75
          break
        case 'condo':
          propertyType = 'condo'
          purchasePrice = si.price
          mortgageRate = MORTGAGE_RATES.bank
          mortgageTerm = LOAN_TENURE_YEARS.bank
          ltv = 0.75
          break
        case 'landed':
          propertyType = 'landed'
          purchasePrice = si.price
          mortgageRate = MORTGAGE_RATES.bank
          mortgageTerm = LOAN_TENURE_YEARS.bank
          ltv = 0.75
          break
        case 'ec':
          propertyType = 'condo' // EC treated as condo in planner
          purchasePrice = si.price
          mortgageRate = MORTGAGE_RATES.bank
          mortgageTerm = LOAN_TENURE_YEARS.bank
          ltv = 0.75
          break
      }
    }

    // Build a SetupDraft from calculator basics + bridge fields + property
    const draft: SetupDraft = {
      currentAge: basics.age,
      retirementAge,
      annualIncome: grossIncome * 12,
      incomeType: 'gross',
      annualExpenses: basics.monthlyExpenses * 12,
      liquidNetWorth: basics.existingSavings,
      cashSavings: 0,
      residency,
      cpfKnown: false,
      ownsProperty,
      ...(ownsProperty === 'planning' ? {
        purchasePrice,
        purchaseYearsFromNow,
        propertyType,
      } : {}),
      healthcareEnabled: false,
      isRedo: false,
      ...(isCoupleMode && basics.partnerAge != null ? {
        partner: {
          name: 'Partner',
          currentAge: basics.partnerAge,
          retirementAge: partnerRetirementAge,
          annualIncome: partnerGross * 12,
          incomeType: 'gross' as const,
          annualExpenses: 0,
          liquidNetWorth: 0,
          residency,
          cpfKnown: false,
        },
      } : {}),
    }

    // Apply the draft — initializes plan, creates adults, income/expense/asset
    // entries, AND creates PropertyPlan + auto down payment goal for the primary
    // property. This uses the planner's native property engine which handles
    // CPF OA housing deductions, mortgage, and equity natively.
    const planType = isCoupleMode ? 'couple' : 'individual'
    applySetupDraft(draft, planType)

    // Override mortgage rate/term/LTV if we have specific values from the calculator
    // (applySetupDraft uses defaults which may differ from what the user configured)
    if (ownsProperty === 'planning' && (mortgageRate != null || ltv != null)) {
      const plan = useHouseholdPlanStore.getState().plan
      const prop = plan.properties.find((p) => p.owner === 'self')
      if (prop) {
        useHouseholdPlanStore.getState().updateProperty(prop.id, {
          ...(mortgageRate != null ? { mortgageRate } : {}),
          ...(mortgageTerm != null ? { mortgageTerm } : {}),
          ...(ltv != null ? { ltv } : {}),
        })

        // Update auto-created down payment goal to match the actual LTV
        if (ltv != null && purchasePrice != null) {
          const dpGoal = useHouseholdPlanStore.getState().plan.goals.find(
            (g) => g.label === 'Property Down Payment' && g.owner === 'self'
          )
          if (dpGoal) {
            useHouseholdPlanStore.getState().updateGoal(dpGoal.id, {
              amount: Math.round(purchasePrice * (1 - ltv)),
            })
          }
        }
      }
    }

    // Add BSD, legal fees, and renovation as a separate goal.
    // The auto-created "Property Down Payment" only covers purchasePrice * (1 - LTV).
    // The calculator's breakdown also includes BSD, legal, and renovation which are
    // real cash outflows the user needs to save for.
    if (primaryPropertyGoal && purchasePrice != null) {
      const breakdown = primaryPropertyGoal.breakdown
      const downPaymentItem = breakdown.items.find((i) => i.label.startsWith('Down payment'))
      const downPaymentAmount = downPaymentItem?.amount ?? 0
      const feesAndReno = breakdown.total - downPaymentAmount
      if (feesAndReno > 0) {
        const targetAge = primaryPropertyGoal.targetAge
        const timing: TimingRule = { kind: 'single-age', owner: 'self', age: targetAge }
        const feesGoal: GoalItem = {
          id: crypto.randomUUID(),
          owner: 'self',
          label: `${primaryPropertyGoal.label} (BSD, legal, renovation)`,
          kind: 'financial-goal',
          timing,
          amount: feesAndReno,
          amountSaved: 0,
          durationYears: 1,
          priority: 'important',
          inflationAdjusted: true,
          category: 'housing',
        }
        addGoal(feesGoal)
      }
    }

    // Transfer non-property goals as regular GoalItems
    for (const goal of nonPropertyGoals) {
      addGoal(mapGoalToHouseholdGoalItem(goal))
    }

    // Extra property goals (2nd+ properties) as GoalItems since the planner
    // currently supports only one PropertyPlan. TODO: multi-property support.
    for (const goal of extraPropertyGoals) {
      addGoal(mapGoalToHouseholdGoalItem(goal))
    }

    // Mark setup as complete so the planner doesn't redirect to setup
    setUIField('setupCompleted', true)
    setUIField('setupPopulatedSections', ['section-income', 'section-expenses', 'section-net-worth'])
    setUIField('cpfEnabled', residency !== 'foreigner')

    // Signal projection page that setup just completed
    sessionStorage.setItem('fireplanner-setup-just-completed', '1')

    // Clear goal calculator state to prevent duplicate transfer
    localStorage.removeItem('goal-calc-state')
    localStorage.removeItem('goal-calc-slider-overrides')

    // Navigate to projection (mobile gets wrapped view)
    const isMobile = window.innerWidth < 768
    navigate(isMobile ? '/wrapped' : '/projection')
  }, [transferring, basics, goals, isCoupleMode, retirementAge, residency, partnerRetirementAge, addGoal, setUIField, navigate])

  const setupCompleted = useUIStore((s) => s.setupCompleted)

  // No calculator state — either transfer already happened (Back button)
  // or user navigated here directly without using the calculator
  if (!basics) {
    // If setup was already completed, the transfer happened — go to projection
    if (setupCompleted) {
      navigate('/projection', { replace: true })
      return null
    }
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link to="/goal-calculator" className="font-bold text-lg">SG FIRE Planner</Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 text-center space-y-4">
          <p className="text-muted-foreground">No goal calculator data found.</p>
          <Button onClick={() => navigate('/goal-calculator')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Calculator
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header matching goal calculator */}
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/goal-calculator" className="font-bold text-lg">SG FIRE Planner</Link>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to results
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="space-y-6">
          {/* Heading */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Almost there</h2>
            <p className="text-sm text-muted-foreground">
              Two quick questions to build your full year-by-year projection.
            </p>
          </div>

          {/* Retirement age */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">When do you want to stop working?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={Math.max(basics.age + 1, 45)}
                  max={75}
                  value={retirementAge}
                  onChange={(e) => setRetirementAge(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-2xl font-bold tabular-nums w-12 text-right">
                  {retirementAge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Age {retirementAge} is {retirementAge - basics.age} years from now.
                You can always change this later.
              </p>
            </CardContent>
          </Card>

          {/* Partner retirement age (couple mode only) */}
          {isCoupleMode && basics.partnerAge != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">When does your partner want to stop working?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={Math.max(basics.partnerAge + 1, 45)}
                    max={75}
                    value={partnerRetirementAge}
                    onChange={(e) => setPartnerRetirementAge(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-2xl font-bold tabular-nums w-12 text-right">
                    {partnerRetirementAge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Age {partnerRetirementAge} is {partnerRetirementAge - basics.partnerAge} years from now.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Residency status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your residency status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {RESIDENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setResidency(opt.value)}
                    className={`rounded-lg border-2 p-3 text-center transition-colors ${
                      residency === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary of what's being transferred */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-1 text-sm">
            <p className="font-medium">What we already know from your goals:</p>
            <ul className="text-muted-foreground space-y-0.5">
              <li>Age {basics.age}, income ${basics.monthlyIncome.toLocaleString()}/mo{isCoupleMode ? ` + partner $${(basics.partnerMonthlyIncome ?? 0).toLocaleString()}/mo` : ''}</li>
              <li>Expenses ${basics.monthlyExpenses.toLocaleString()}/mo, savings ${basics.existingSavings.toLocaleString()}</li>
              <li>{goals.length} goal{goals.length !== 1 ? 's' : ''}: {goals.map((g) => g.label).join(', ')}</li>
            </ul>
          </div>

          {/* CTA */}
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleContinue}
            disabled={transferring}
          >
            {transferring ? 'Building your projection...' : 'See My Projection'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  )
}
