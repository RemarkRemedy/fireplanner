/**
 * Reusable quick FIRE estimate calculator form.
 *
 * Two modes:
 * - `compact`: Just inputs + result (no card, no health check, no demo). For embedding in StartPage.
 * - Full (default): Card-wrapped with health check, demo button, CTA. For RetirementCalculatorPage.
 */

import { createElement, useState, useMemo, useCallback, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { QuickProjectionChart } from '@/components/shared/QuickProjectionChart'
import {
  computeQuickEstimate,
  buildHealthInputs,
  parseUrlParams,
  buildSearchParams,
  type QuickEstimateInputs,
} from '@/lib/calculations/quickEstimate'
import { computeHealthRatios, type HealthRatioResult } from '@/lib/calculations/healthCheck'
import { QUICK_ESTIMATE_DEFAULTS } from '@/lib/data/quickEstimateDefaults'
import { DEMO_SCENARIO_DRAFT, DEMO_PLAN_TYPE } from '@/lib/data/demoScenario'
import { applySetupDraft } from '@/lib/household/setupDraft'
import { saveScenario } from '@/lib/scenarios'
import { HOUSEHOLD_PLAN_STORAGE_KEY } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { trackEvent } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import type { SectionId } from '@/lib/household/sectionOrder'
import type { HouseholdPlanType } from '@/lib/household/types'
import { PlanTypeSelector } from '@/components/household/PlanTypeSelector'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'
import { toast } from 'sonner'
import {
  ArrowRight,
  ChevronDown,
  Flame,
  HeartPulse,
  Play,
  Sparkles,
} from 'lucide-react'

// All setup sections for demo mode
const ALL_SECTIONS: SectionId[] = [
  'section-personal',
  'section-fire-settings',
  'section-income',
  'section-expenses',
  'section-net-worth',
  'section-cpf',
  'section-healthcare',
  'section-property',
  'section-allocation',
]

// Health ratio IDs to display in quick check (4 reliable ones)
const QUICK_HEALTH_RATIO_IDS = ['emergency-fund', 'savings-ratio', 'debt-to-asset', 'solvency']

function trafficLightColor(status: string | null): string {
  switch (status) {
    case 'green': return 'text-emerald-600 dark:text-emerald-400'
    case 'amber': return 'text-amber-600 dark:text-amber-400'
    case 'red': return 'text-red-600 dark:text-red-400'
    default: return 'text-muted-foreground'
  }
}

function trafficLightBg(status: string | null): string {
  switch (status) {
    case 'green': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
    case 'amber': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    case 'red': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    default: return 'bg-muted/50 border-border'
  }
}

function trafficLightDot(status: string | null): string {
  switch (status) {
    case 'green': return 'bg-emerald-500'
    case 'amber': return 'bg-amber-500'
    case 'red': return 'bg-red-500'
    default: return 'bg-muted-foreground/40'
  }
}

interface QuickEstimateFormProps {
  /** Compact mode: no card wrapper, no health check, no demo, no CTA. */
  compact?: boolean
  /** Sync inputs to URL search params. Only used in full mode. */
  syncUrlParams?: boolean
}

export function QuickEstimateForm({ compact = false, syncUrlParams = false }: QuickEstimateFormProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const setUIField = useUIStore((s) => s.setField)
  const [selectedPlanType, setSelectedPlanType] = useState<HouseholdPlanType>('individual')
  const [householdPlannerEnabled] = useState(() => isHouseholdPlannerV1Enabled())

  // ── Parse URL params on mount (full mode only) ───────────────────────────
  const urlParams = useMemo(
    () => syncUrlParams ? parseUrlParams(searchParams) : {},
    [syncUrlParams, searchParams],
  )

  const [monthlyIncome, setMonthlyIncome] = useState(urlParams.income ?? 0)
  const [monthlyExpenses, setMonthlyExpenses] = useState(urlParams.expenses ?? 0)
  const [currentSavings, setCurrentSavings] = useState(urlParams.savings ?? 0)
  const [currentAge, setCurrentAge] = useState(urlParams.age ?? QUICK_ESTIMATE_DEFAULTS.defaultAge)
  const [expectedReturn, setExpectedReturn] = useState(
    urlParams.return != null ? urlParams.return / 100 : QUICK_ESTIMATE_DEFAULTS.nominalReturn,
  )
  const [swr, setSwr] = useState(
    urlParams.swr != null ? urlParams.swr / 100 : QUICK_ESTIMATE_DEFAULTS.swr,
  )

  // Stage 2 inputs
  const [showHealth, setShowHealth] = useState(false)
  const [cashSavings, setCashSavings] = useState(0)
  const [outstandingDebt, setOutstandingDebt] = useState(0)

  // ── Sync inputs to URL params ────────────────────────────────────────────
  const inputs: QuickEstimateInputs = useMemo(() => ({
    monthlyIncome,
    monthlyExpenses,
    currentSavings,
    currentAge,
    expectedReturn,
    swr,
  }), [monthlyIncome, monthlyExpenses, currentSavings, currentAge, expectedReturn, swr])

  useEffect(() => {
    if (!syncUrlParams) return
    const params = buildSearchParams(inputs)
    const newStr = params.toString()
    const oldStr = searchParams.toString()
    if (newStr !== oldStr) {
      setSearchParams(params, { replace: true })
    }
  }, [syncUrlParams, inputs, searchParams, setSearchParams])

  // ── Compute results ──────────────────────────────────────────────────────
  const result = useMemo(() => computeQuickEstimate(inputs), [inputs])
  const hasInput = monthlyIncome > 0

  // Track first computation
  const [tracked, setTracked] = useState(false)
  useEffect(() => {
    if (hasInput && result.status !== 'no-income' && !tracked) {
      trackEvent('quick_estimate_computed', { status: result.status })
      setTracked(true)
    }
  }, [hasInput, result.status, tracked])

  // ── Stage 2: Health score (full mode only) ─────────────────────────────
  const healthResult = useMemo(() => {
    if (compact || !showHealth) return null
    const healthInputs = buildHealthInputs(inputs, { cashSavings, outstandingDebt })
    return computeHealthRatios(healthInputs)
  }, [compact, showHealth, inputs, cashSavings, outstandingDebt])

  const quickHealthRatios = useMemo(() => {
    if (!healthResult) return []
    return healthResult.ratios.filter((r) => QUICK_HEALTH_RATIO_IDS.includes(r.id))
  }, [healthResult])

  const handleShowHealth = useCallback(() => {
    setShowHealth(true)
    trackEvent('quick_health_score_viewed')
  }, [])

  // ── Stage 3: Demo mode (full mode only) ───────────────────────────────
  const hasExistingData = useMemo(() => {
    try {
      return localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY) !== null
    } catch {
      return false
    }
  }, [])

  const loadDemo = useCallback(() => {
    if (hasExistingData) {
      try { saveScenario('Auto-save before demo') } catch { /* max scenarios reached, continue */ }
    }
    applySetupDraft(DEMO_SCENARIO_DRAFT, DEMO_PLAN_TYPE)
    setUIField('setupCompleted', true)
    setUIField('setupPopulatedSections', ALL_SECTIONS)
    trackEvent('demo_loaded')
    navigate('/projection')
    setTimeout(() => {
      toast('Viewing demo data', {
        description: createElement('span', null,
          createElement(Link, { to: '/setup', className: 'underline font-medium', onClick: () => toast.dismiss() }, 'Start your own plan'),
          ' or ',
          createElement(Link, { to: '/retirement-calculator', className: 'underline font-medium', onClick: () => toast.dismiss() }, 'back to calculator'),
        ),
        duration: 15000,
      })
    }, 500)
  }, [hasExistingData, setUIField, navigate])

  const DemoButton = useCallback(({ variant = 'outline' as const, size = 'default' as const }: { variant?: 'outline' | 'ghost'; size?: 'default' | 'sm' }) => {
    if (hasExistingData) {
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant={variant} size={size}>
              <Play className="mr-2 h-4 w-4" />
              Explore a demo
            </Button>
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
      )
    }
    return (
      <Button variant={variant} size={size} onClick={loadDemo}>
        <Play className="mr-2 h-4 w-4" />
        Explore a demo
      </Button>
    )
  }, [hasExistingData, loadDemo])

  // ── Inputs + Results (shared between compact and full) ────────────────
  const inputsAndResults = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Monthly take-home pay"
          value={monthlyIncome}
          onChange={setMonthlyIncome}
          tooltip="Your net monthly salary after tax and CPF deductions"
        />
        <CurrencyInput
          label="Monthly expenses"
          value={monthlyExpenses}
          onChange={setMonthlyExpenses}
          tooltip="Total monthly spending including rent, food, transport"
        />
        <CurrencyInput
          label="Current savings / net worth"
          value={currentSavings}
          onChange={setCurrentSavings}
          tooltip="Total liquid assets: cash, investments, brokerage. Exclude CPF and property."
        />
        <NumberInput
          label="Current age"
          value={currentAge}
          onChange={setCurrentAge}
          integer
          min={18}
          max={80}
        />
      </div>

      {!compact && (
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            Advanced assumptions
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PercentInput
              label="Expected return"
              value={expectedReturn}
              onChange={setExpectedReturn}
              tooltip="Nominal annual return before inflation (default 5%)"
            />
            <PercentInput
              label="Withdrawal rate (SWR)"
              value={swr}
              onChange={setSwr}
              tooltip="Safe withdrawal rate in retirement (default 3.5%)"
            />
          </div>
        </details>
      )}

      {hasInput && (
        <div className={`space-y-4 ${compact ? '' : 'border-t pt-6'}`}>
          {result.status === 'ok' && (
            <>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">You can retire in</p>
                <p className={compact ? 'text-3xl font-bold tracking-tight' : 'text-4xl font-bold tracking-tight'}>
                  <AnimatedNumber
                    value={Math.round(result.yearsToFire)}
                    format={(n) => `${Math.round(n)} years`}
                  />
                </p>
                <p className="text-lg text-muted-foreground">
                  at age{' '}
                  <AnimatedNumber
                    value={Math.round(result.fireAge)}
                    format={(n) => String(Math.round(n))}
                    className="font-semibold text-foreground"
                  />
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="text-muted-foreground">FIRE Number</p>
                  <p className="font-semibold">
                    <AnimatedNumber value={result.fireNumber} format={(n) => formatCurrency(n)} />
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Savings Rate</p>
                  <p className="font-semibold">
                    <AnimatedNumber
                      value={result.savingsRate * 100}
                      format={(n) => `${n.toFixed(1)}%`}
                    />
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Annual Savings</p>
                  <p className="font-semibold">
                    <AnimatedNumber value={result.annualSavings} format={(n) => formatCurrency(n)} />
                  </p>
                </div>
              </div>
            </>
          )}

          {result.status === 'negative-savings' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 text-center">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                You're spending more than you earn.
              </p>
              {!compact && (
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Reduce expenses or increase income to start saving toward FIRE.
                </p>
              )}
            </div>
          )}

          {result.status === 'already-fire' && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 p-4 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                You've already reached FIRE!
              </p>
              {!compact && (
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  Your savings ({formatCurrency(currentSavings)}) exceed your FIRE number ({formatCurrency(result.fireNumber)}).
                </p>
              )}
            </div>
          )}

          {result.status === 'unreachable' && (
            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-4 text-center">
              <p className="font-medium text-red-800 dark:text-red-200">
                At this rate, FIRE is 100+ years away.
              </p>
              {!compact && (
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Try increasing your savings rate or expected return.
                </p>
              )}
            </div>
          )}

          {(result.status === 'ok' || result.status === 'already-fire') && (
            <QuickProjectionChart
              data={result.trajectory}
              fireNumber={result.fireNumber}
              fireAge={Math.round(result.fireAge)}
            />
          )}
        </div>
      )}

      {/* Compact CTA — make them doubt the quick number */}
      {compact && hasInput && result.status === 'ok' && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium">
            This estimate is missing key factors that could shift your FIRE age by years:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              CPF contributions you're not counting
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              Property equity and mortgage impact
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              Healthcare costs that grow with age
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              Market crashes that can deplete savings faster
            </li>
          </ul>
          <Button asChild className="w-full">
            <Link to="/setup">
              Get your real FIRE age
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )

  // ── Compact mode: just inputs and results, no wrapping ────────────────
  if (compact) {
    return inputsAndResults
  }

  // ── Full mode: card-wrapped with health check, demo, CTA ──────────────
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Flame className="h-5 w-5 text-orange-500" />
            Your FIRE Estimate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inputsAndResults}
        </CardContent>
      </Card>

      {/* Stage 2: Health Score CTA + Content */}
      {hasInput && result.status !== 'no-income' && !showHealth && (
        <div className="flex justify-center">
          <Button variant="outline" size="lg" onClick={handleShowHealth}>
            <HeartPulse className="mr-2 h-4 w-4" />
            Check your financial health
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {showHealth && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <HeartPulse className="h-5 w-5 text-rose-500" />
              Quick Health Check
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CurrencyInput
                label="Of that, how much is in cash?"
                value={cashSavings}
                onChange={setCashSavings}
                tooltip="Bank accounts and savings not invested in the market"
              />
              <CurrencyInput
                label="Outstanding debt total"
                value={outstandingDebt}
                onChange={setOutstandingDebt}
                tooltip="Credit cards, personal loans, student loans. Exclude mortgage."
              />
            </div>

            <p className="text-xs text-muted-foreground italic">
              Based on limited data. For a complete analysis with 8 ratios,{' '}
              <Link to="/setup" className="underline hover:text-foreground">use the full planner</Link>.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {quickHealthRatios.map((ratio) => (
                <HealthRatioCard key={ratio.id} ratio={ratio} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTA to full planner */}
      {hasInput && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="flex-1 space-y-1">
                <p className="font-semibold">Want CPF, property, and SG-specific calculations?</p>
                <p className="text-sm text-muted-foreground">
                  The full planner adds CPF projections, property analysis, Monte Carlo simulation,
                  12 withdrawal strategies, and more.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 sm:items-end">
                {householdPlannerEnabled && (
                  <PlanTypeSelector value={selectedPlanType} onChange={setSelectedPlanType} />
                )}
                <Button asChild>
                  <Link to={`/setup?planType=${selectedPlanType}`}>
                    Get a personalized plan
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom demo button */}
      <div className="flex justify-center gap-3 pb-8">
        <DemoButton variant="ghost" size="sm" />
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            Full planner
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ── Health Ratio Card ──────────────────────────────────────────────────────

function HealthRatioCard({ ratio }: { ratio: HealthRatioResult }) {
  const isNull = ratio.value === null
  return (
    <div className={`rounded-lg border p-3 ${trafficLightBg(ratio.status)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{ratio.meta.label}</p>
          {isNull ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Need more data</p>
          ) : (
            <p className={`mt-0.5 text-lg font-semibold ${trafficLightColor(ratio.status)}`}>
              {ratio.displayValue}
            </p>
          )}
        </div>
        <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${trafficLightDot(ratio.status)}`} />
      </div>
      {ratio.message && (
        <p className="mt-1 text-xs text-muted-foreground">{ratio.message}</p>
      )}
    </div>
  )
}
