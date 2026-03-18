import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useUIStore } from '@/stores/useUIStore'
import { HOUSEHOLD_PLAN_STORAGE_KEY, useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { Target, TrendingUp, CheckCircle, ArrowRight, Info, RotateCcw, Play } from 'lucide-react'
import { clearFireplannerData } from '@/components/shared/DemoBadge'
import type { HouseholdPlanType } from '@/lib/household/types'
import { PlanTypeSelector } from '@/components/household/PlanTypeSelector'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'
import { trackEvent } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import { LandingEmailSection } from '@/components/email/LandingEmailSection'
import { QuickEstimateForm } from '@/components/shared/QuickEstimateForm'
import { loadDemoData } from '@/lib/demo'
import { usePlanCompleteness } from '@/hooks/usePlanCompleteness'

type ActivePathway = 'goal-first' | 'story-first' | 'already-fire' | null

const PATHWAY_CARDS: { key: NonNullable<ActivePathway>; label: string; description: string; icon: typeof Target }[] = [
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
    description: 'You\'ve reached or are close to FIRE. Focus on making your money last: withdrawal strategies, allocation, and spending.',
    icon: CheckCircle,
  },
]

export function StartPage() {
  usePageMeta({
    title: 'SG FIRE Planner | Singapore Retirement Calculator',
    description: 'Free Singapore FIRE calculator with CPF, tax, Monte Carlo simulation, and 12 withdrawal strategies for retirement planning.',
    path: '/',
  })

  const navigate = useNavigate()
  const setUIField = useUIStore((s) => s.setField)
  const setupCompleted = useUIStore((s) => s.setupCompleted)
  const existingPlanType = useHouseholdPlanStore((s) => s.plan.planType)

  const [selectedPlanType, setSelectedPlanType] = useState<HouseholdPlanType>(
    setupCompleted ? existingPlanType : 'individual'
  )
  const [householdPlannerEnabled] = useState(() => isHouseholdPlannerV1Enabled())
  const [calculatorHasResult, setCalculatorHasResult] = useState(false)

  // Demo loading logic
  const hasExistingData = useMemo(() => {
    try { return localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY) !== null } catch { return false }
  }, [])

  const loadDemo = useCallback(() => {
    loadDemoData({
      hasExistingData,
      setSetupCompleted: (v) => setUIField('setupCompleted', v),
      setPopulatedSections: (s) => setUIField('setupPopulatedSections', s),
      navigate,
    })
  }, [hasExistingData, setUIField, navigate])

  // Check if returning user (has saved profile in localStorage)
  const [isReturningUser] = useState(() => {
    try {
      return localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY) !== null
        || localStorage.getItem('fireplanner-profile') !== null
    } catch {
      return false
    }
  })

  const handlePathwayClick = (pathway: NonNullable<ActivePathway>) => {
    setUIField('sectionOrder', pathway)
    trackEvent('onboarding_pathway_selected', { pathway })
    navigate(`/setup?planType=${selectedPlanType}`)
  }

  const handleRedoSetup = () => {
    navigate(`/setup?planType=${selectedPlanType}&redo=true`)
  }

  // Returning user who has completed setup: adaptive welcome back
  if (setupCompleted && isReturningUser) {
    return <ReturningUserView handleRedoSetup={handleRedoSetup} />
  }

  return (
    <div className="space-y-8">
      <div className="py-8">
        <h1 className="text-3xl font-bold">Singapore FIRE Planner</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Plan your path to Financial Independence with Singapore-specific calculations.
        </p>
        <p className="mt-2 text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Set up in under 3 minutes.</span>
          {!isReturningUser && (
            hasExistingData ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center">
                    <Play className="mr-1 h-3 w-3" />
                    Or explore a demo first
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Load demo data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace your current plan with demo data. Your existing plan will be
                      auto-saved as a scenario you can restore later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={loadDemo}>Load demo</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <button onClick={loadDemo} className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center">
                <Play className="mr-1 h-3 w-3" />
                Or explore a demo first
              </button>
            )
          )}
        </p>
      </div>

      {/* Returning user guidance */}
      {isReturningUser && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p>
              Want to switch your path or mode? Go ahead, your existing inputs are safe.
              To see your results, head to the{' '}
              <Link to="/dashboard" className="font-medium underline hover:no-underline">
                Dashboard
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Quick estimate for new users */}
      {!isReturningUser && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-medium text-muted-foreground">Quick estimate (10 seconds)</p>
            </CardHeader>
            <CardContent>
              <QuickEstimateForm compact onHasResult={setCalculatorHasResult} />
            </CardContent>
          </Card>
        </>
      )}

      {householdPlannerEnabled && !calculatorHasResult && (
        <PlanTypeSelector value={selectedPlanType} onChange={setSelectedPlanType} />
      )}

      {/* Pathway cards — hidden when calculator has results (CTA takes over) */}
      <div className={`grid grid-cols-1 @2xl:grid-cols-3 gap-4 ${calculatorHasResult && !isReturningUser ? 'hidden' : ''}`}>
        {PATHWAY_CARDS.map(({ key, label, description, icon: Icon }, index) => (
          <button
            key={key}
            onClick={() => handlePathwayClick(key)}
            className="text-left h-full opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <Card className="h-full transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5">
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

// ── Returning User View ──────────────────────────────────────────────────────

function ReturningUserView({ handleRedoSetup }: { handleRedoSetup: () => void }) {
  const completeness = usePlanCompleteness()

  // Count sections that need attention (not-added or using-defaults)
  const needsAttentionCount = completeness.filter(
    (r) => r.status === 'not-added' || r.status === 'using-defaults'
  ).length
  // Count completed sections (provided, provided-basic, or not-applicable)
  const refinedCount = completeness.filter(
    (r) => r.status === 'provided' || r.status === 'provided-basic' || r.status === 'not-applicable'
  ).length
  const totalCount = completeness.length
  const allRefined = needsAttentionCount === 0
  const progressPercent = totalCount > 0 ? Math.round((refinedCount / totalCount) * 100) : 100

  // Adaptive CTA: guide user to their highest-value next step
  const primaryCta = useMemo(() => {
    // Stage A: most sections still need attention — show them their projection first
    if (needsAttentionCount > totalCount / 2) {
      return { label: 'View your projection', to: '/projection' }
    }
    // Stage B: some sections refined but gaps remain — surface health check
    if (!allRefined) {
      return { label: 'Check your financial health', to: '/health-check' }
    }
    // Stage C: everything refined — dashboard is home base
    return { label: 'Continue to Dashboard', to: '/dashboard' }
  }, [needsAttentionCount, totalCount, allRefined])

  return (
    <div className="space-y-8">
      <div className="py-8">
        <h1 className="text-3xl font-bold">Singapore FIRE Planner</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Welcome back. Your plan is ready.
        </p>
      </div>

      {/* Adaptive primary CTA */}
      <div className="flex justify-center">
        <Button size="lg" asChild>
          <Link to={primaryCta.to}>
            {primaryCta.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Progress bar — hidden when 100% */}
      {!allRefined && (
        <div className="mx-auto max-w-md space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Plan completeness: {refinedCount}/{totalCount} sections refined</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Plan completeness">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tier 1: Plan actions */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/health-check">Health Check</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/projection">View projection</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard">Dashboard</Link>
        </Button>
      </div>

      {/* Tier 2: Reset actions */}
      <div className="flex justify-center gap-3 text-xs text-muted-foreground">
        <button
          onClick={handleRedoSetup}
          className="hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          Redo setup
        </button>
        <span className="text-border">·</span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="text-destructive/70 hover:text-destructive transition-colors">
              Start fresh (reset all data)
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your current plan and all saved inputs.
                Saved scenarios will be preserved. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  clearFireplannerData()
                  window.location.href = '/'
                }}
              >
                Delete everything and start fresh
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <LandingEmailSection />
    </div>
  )
}
