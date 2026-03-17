import { createElement, useCallback, useMemo, useState } from 'react'
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
import { Target, TrendingUp, CheckCircle, ArrowRight, Info, RotateCcw, Calculator, Play } from 'lucide-react'
import type { HouseholdPlanType } from '@/lib/household/types'
import { PlanTypeSelector } from '@/components/household/PlanTypeSelector'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'
import { trackEvent } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import { LandingEmailSection } from '@/components/email/LandingEmailSection'
import { QuickEstimateForm } from '@/components/shared/QuickEstimateForm'
import { DEMO_SCENARIO_DRAFT, DEMO_PLAN_TYPE } from '@/lib/data/demoScenario'
import { setDemoActive, clearDemoActive } from '@/components/shared/DemoBadge'
import { applySetupDraft } from '@/lib/household/setupDraft'
import { saveScenario } from '@/lib/scenarios'
import type { SectionId } from '@/lib/household/sectionOrder'
import { toast } from 'sonner'

const ALL_DEMO_SECTIONS: SectionId[] = [
  'section-personal', 'section-fire-settings', 'section-income',
  'section-expenses', 'section-net-worth', 'section-cpf',
  'section-healthcare', 'section-property', 'section-allocation',
]

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
    if (hasExistingData) {
      try { saveScenario('Auto-save before demo') } catch { /* max scenarios */ }
    }
    applySetupDraft(DEMO_SCENARIO_DRAFT, DEMO_PLAN_TYPE)
    setUIField('setupCompleted', true)
    setUIField('setupPopulatedSections', ALL_DEMO_SECTIONS)
    trackEvent('demo_loaded')
    setDemoActive()
    navigate('/projection')
    setTimeout(() => {
      toast('You are viewing demo data', {
        description: createElement('div', { className: 'flex flex-col gap-2 mt-1' },
          createElement('p', { className: 'text-sm' }, 'This is sample data. Start your own plan when ready.'),
          createElement('button', { className: 'inline-flex items-center rounded-md bg-white border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50', onClick: () => { toast.dismiss(); clearDemoActive(); const s = localStorage.getItem('fireplanner-scenarios'); localStorage.clear(); if (s) localStorage.setItem('fireplanner-scenarios', s); window.location.href = '/setup' } }, 'Start your own plan'),
        ),
        duration: Infinity,
        style: { backgroundColor: '#f59e0b', color: '#451a03', border: '1px solid #d97706' },
      })
    }, 500)
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

  // Returning user who has completed setup: show continue/redo options
  if (setupCompleted && isReturningUser) {
    return (
      <div className="space-y-8">
        <div className="py-8">
          <h1 className="text-3xl font-bold">Singapore FIRE Planner</h1>
          <p className="text-muted-foreground mt-2 text-base">
            Welcome back. Your plan is ready.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <Button size="lg" asChild>
            <Link to="/dashboard">
              Continue to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRedoSetup}>
            <RotateCcw className="mr-2 h-3 w-3" />
            Redo setup
          </Button>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/inputs">Edit inputs</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projection">View projection</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/retirement-calculator">
                <Calculator className="mr-1 h-3 w-3" />
                Quick estimate
              </Link>
            </Button>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Start fresh (reset all data)
              </Button>
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
                    const scenarios = localStorage.getItem('fireplanner-scenarios')
                    localStorage.clear()
                    if (scenarios) localStorage.setItem('fireplanner-scenarios', scenarios)
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
