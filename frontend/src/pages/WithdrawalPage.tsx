import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { X, AlertTriangle, Info } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { StrategyParamsSection } from '@/components/withdrawal/StrategyParamsSection'
import { ComparisonTable } from '@/components/withdrawal/ComparisonTable'
import { WithdrawalChart } from '@/components/withdrawal/WithdrawalChart'
import { PortfolioComparisonChart } from '@/components/withdrawal/PortfolioComparisonChart'
import { StrategyGuideDialog } from '@/components/withdrawal/StrategyGuideDialog'
import { SimulationControls } from '@/components/simulation/SimulationControls'
import { ResultsSummary } from '@/components/simulation/ResultsSummary'
import { FanChart } from '@/components/simulation/FanChart'
import { FailureDistributionChart } from '@/components/simulation/FailureDistributionChart'
import { SpendingMetricsPanel } from '@/components/simulation/SpendingMetricsPanel'
import { InterpretationCallout } from '@/components/shared/InterpretationCallout'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { useWithdrawalComparison } from '@/hooks/useWithdrawalComparison'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import { useUIStore } from '@/stores/useUIStore'
import { useExplorePortfolio } from '@/hooks/useExplorePortfolio'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { cn } from '@/lib/utils'
import type { WithdrawalStrategyType, MonteCarloResult } from '@/lib/types'
import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'
import { runMonteCarloWorker, flattenStrategyParams } from '@/lib/simulation/workerClient'
import { CORRELATION_MATRIX } from '@/lib/data/historicalReturns'
import { getEffectiveReturns, getEffectiveStdDevs } from '@/lib/calculations/portfolio'
import { getEffectiveExpenses } from '@/lib/calculations/expenses'
import { trackEvent } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import { stableRunOverrideHash } from '@/stores/useNormalizedAnalysisStore'

const WITHDRAWAL_MC_SIGNATURE_VERSION = 'withdrawal-mc-v1'

function buildWithdrawalMonteCarloRunSignature(input: {
  allocationRevision: number
  explore: {
    allocationWeights: number[]
    balanceMode: string
    initialPortfolio: number
    startAge: number
  }
  householdRevision: string
  scenarioOverrideHash: string
  simulationRevision: number
}): string {
  return [
    WITHDRAWAL_MC_SIGNATURE_VERSION,
    input.householdRevision,
    input.scenarioOverrideHash,
    `a${input.allocationRevision}`,
    `s${input.simulationRevision}`,
    stableRunOverrideHash(input.explore),
  ].join(':')
}

export function WithdrawalPage() {
  usePageMeta({ title: '12 Retirement Withdrawal Strategies Compared — Singapore FIRE Planner', description: 'Compare the 4% rule, VPW, Guyton-Klinger guardrails, CAPE-based, Vanguard Dynamic, and 7 more withdrawal strategies side by side with your actual numbers.', path: '/withdrawal' })
  const { profile } = useHouseholdRuntimeInputs()
  // Normalized context for household-aware ages and revision tracking
  const normalized = useNormalizedLegacyAnalysisContext()
  // Allocation selectors
  const allocationValidationErrors = useAllocationStore((s) => s.validationErrors)
  const allocationReturnOverrides = useAllocationStore((s) => s.returnOverrides)
  const allocationStdDevOverrides = useAllocationStore((s) => s.stdDevOverrides)
  const allocationRevision = useAllocationStore((s) => s.allocationRevision)
  // Simulation selectors
  const simulationValidationErrors = useSimulationStore((s) => s.validationErrors)
  const simulationMcMethod = useSimulationStore((s) => s.mcMethod)
  const simulationNSimulations = useSimulationStore((s) => s.nSimulations)
  const simulationSelectedStrategy = useSimulationStore((s) => s.selectedStrategy)
  const simulationStrategyParams = useSimulationStore((s) => s.strategyParams)
  const simulationWithdrawalBasis = useSimulationStore((s) => s.withdrawalBasis)
  const simulationRevision = useSimulationStore((s) => s.simulationRevision)
  const selectedStrategies = useWithdrawalStore((s) => s.selectedStrategies)
  const toggleStrategy = useWithdrawalStore((s) => s.toggleStrategy)

  const mode = useEffectiveMode('section-withdrawal')
  const setSectionMode = useUIStore((s) => s.setSectionMode)

  const [guideOpen, setGuideOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [activeTab, setActiveTab] = useState('strategy-comparison')

  // Explore portfolio hook for balance toggle
  const explore = useExplorePortfolio()

  // Auto-migrate away from disabled fireTarget mode
  useEffect(() => {
    if (explore.balanceMode === 'fireTarget') {
      explore.setBalanceMode('myPlan')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Wire the explore balance into the deterministic comparison
  const { results, hasErrors, errors } = useWithdrawalComparison({
    initialPortfolioOverride: explore.initialPortfolio,
  })

  const activeSet = useMemo(() => new Set<string>(selectedStrategies), [selectedStrategies])

  // ---------- MC Simulation Tab ----------

  // Validation gating
  const profileErrors = profile.validationErrors
  const mcValidationErrors = { ...profileErrors, ...allocationValidationErrors, ...simulationValidationErrors }
  const canRunExplore = explore.initialPortfolio > 0
    && explore.startAge < normalized.lifeExpectancy
    && explore.startAge >= normalized.currentAge
    && Object.keys(mcValidationErrors).length === 0

  // Stale detection
  const [lastRunSig, setLastRunSig] = useState<string | null>(null)
  const currentSig = useMemo(() => buildWithdrawalMonteCarloRunSignature({
    allocationRevision,
    explore: {
      allocationWeights: explore.allocationWeights,
      balanceMode: explore.balanceMode,
      initialPortfolio: explore.initialPortfolio,
      startAge: explore.startAge,
    },
    householdRevision: normalized.householdRevision,
    scenarioOverrideHash: normalized.scenarioOverrideHash,
    simulationRevision,
  }), [
    allocationRevision,
    explore.allocationWeights,
    explore.balanceMode,
    explore.initialPortfolio,
    explore.startAge,
    normalized.householdRevision,
    normalized.scenarioOverrideHash,
    simulationRevision,
  ])

  const buildMCParams = (): MonteCarloEngineParams => {
    const nDecumYears = Math.max(0, normalized.lifeExpectancy - explore.startAge)
    const yearsFromCurrent = Math.max(0, explore.startAge - normalized.currentAge)
    const annualExpensesAtRetirement = getEffectiveExpenses(
      explore.startAge, profile.annualExpenses, profile.expenseAdjustments, normalized.lifeExpectancy,
    ) * Math.pow(1 + profile.inflation, yearsFromCurrent)

    return {
      initialPortfolio: explore.initialPortfolio,
      allocationWeights: explore.allocationWeights,
      expectedReturns: getEffectiveReturns(allocationReturnOverrides),
      stdDevs: getEffectiveStdDevs(allocationStdDevOverrides),
      correlationMatrix: CORRELATION_MATRIX,
      currentAge: explore.startAge,
      retirementAge: explore.startAge,       // forces pure decumulation (nYearsAccum = 0)
      lifeExpectancy: normalized.lifeExpectancy,
      annualSavings: [],
      postRetirementIncome: Array(nDecumYears).fill(0),
      method: simulationMcMethod,
      nSimulations: simulationNSimulations,
      withdrawalStrategy: simulationSelectedStrategy,
      strategyParams: flattenStrategyParams(simulationSelectedStrategy, simulationStrategyParams),
      expenseRatio: profile.expenseRatio,
      inflation: profile.inflation,
      annualExpensesAtRetirement,
      withdrawalBasis: simulationWithdrawalBasis,
      extractPaths: true,
    }
  }

  const mcMutation = useMutation({
    onSuccess: (data: MonteCarloResult) => {
      trackEvent('simulation_completed', { type: 'explore-mc', success_rate: data.success_rate })
    },
    onError: (err: Error) => {
      trackEvent('simulation_failed', { type: 'explore-mc', error: err.message })
    },
    mutationFn: async () => {
      setLastRunSig(currentSig)
      return runMonteCarloWorker(buildMCParams())
    },
  })

  const mcIsStale = mcMutation.data !== undefined && lastRunSig !== currentSig

  // MC interpretation
  const mcInterpretation = mcMutation.data ? (() => {
    const rate = mcMutation.data.success_rate
    if (rate >= 0.95) return { level: 'success' as const, message: 'Excellent -- your withdrawal strategy has a very high probability of lasting through retirement.' }
    if (rate >= 0.80) return { level: 'warning' as const, message: 'Good -- your strategy is likely to succeed, but consider a small buffer (lower spending or different strategy).' }
    return { level: 'danger' as const, message: 'Needs attention -- there is a meaningful risk of running out. Consider reducing your withdrawal rate or switching strategies.' }
  })() : null

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Withdrawal Strategies</h1>
          <p className="text-sm text-muted-foreground">
            Compare how different withdrawal strategies affect your retirement income and portfolio longevity.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 shrink-0 mt-1">
          <button
            onClick={() => { setSectionMode('section-withdrawal', 'simple'); trackEvent('section_mode_changed', { section: 'withdrawal', mode: 'simple' }) }}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-all',
              mode === 'simple'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Simple
          </button>
          <button
            onClick={() => { setSectionMode('section-withdrawal', 'advanced'); trackEvent('section_mode_changed', { section: 'withdrawal', mode: 'advanced' }) }}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-all',
              mode === 'advanced'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Advanced
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Educational banner */}
        {!bannerDismissed && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 flex items-start justify-between gap-2">
            <p>
              Compare withdrawal strategies to understand how they behave under different market conditions.
              This uses a simplified model with retirement withdrawals only (no new savings). For a full stress test of your plan including accumulation, go to{' '}
              <Link to="/stress-test" className="font-medium underline">Stress Test</Link>
            </p>
            <button
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 text-blue-600 hover:text-blue-800 dark:text-blue-400"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Balance toggle — applies to both tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            <button
              onClick={() => explore.setBalanceMode('myPlan')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                explore.balanceMode === 'myPlan'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              My Plan
            </button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    disabled
                    className="rounded-md px-3 py-1.5 text-sm font-medium cursor-not-allowed opacity-40 text-muted-foreground"
                  >
                    FIRE Number
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Temporarily disabled — calculation uses incorrect retirement horizon. Fix in progress.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            {explore.label}
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); trackEvent('stress_test_tab_changed', { tab, source: 'withdrawal' }) }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="strategy-comparison">Strategy Comparison</TabsTrigger>
            <TabsTrigger value="mc-simulation">MC Simulation</TabsTrigger>
          </TabsList>

          {/* Strategy Comparison Tab */}
          <TabsContent value="strategy-comparison">
            <div className="space-y-6">
              <StrategyParamsSection onGuideOpen={() => { setGuideOpen(true); trackEvent('strategy_guide_opened', { context: 'withdrawal' }) }} />

              {hasErrors && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive font-medium">
                    Fix validation errors before comparison results can be computed.
                  </p>
                  <ul className="text-xs text-destructive mt-1 list-disc list-inside">
                    {Object.entries(errors).map(([key, msg]) => (
                      <li key={key}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results && (
                <>
                  <ComparisonTable results={results} />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <WithdrawalChart results={results} />
                    <PortfolioComparisonChart results={results} />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* MC Simulation Tab */}
          <TabsContent value="mc-simulation">
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Run 10,000 random market scenarios using your selected withdrawal strategy to estimate the probability
                your portfolio lasts through retirement. This uses retirement withdrawals only (no new savings or income streams).
              </p>

              <SimulationControls
                onRun={() => mcMutation.mutate()}
                isPending={mcMutation.isPending}
                canRun={canRunExplore}
                validationErrors={canRunExplore ? {} : mcValidationErrors}
              />

              {mcMutation.isPending && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Running simulation...
                </div>
              )}

              {mcMutation.error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive font-medium">
                    Simulation failed: {mcMutation.error.message}
                  </p>
                </div>
              )}

              {mcMutation.data && mcIsStale && (
                <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Results may be outdated -- your inputs have changed since the last run.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => mcMutation.mutate()} disabled={mcMutation.isPending}>
                    Re-run
                  </Button>
                </div>
              )}

              {mcMutation.data && (
                <>
                  <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      Simulations use historical data and statistical models. Past performance does not guarantee
                      future results. All projections assume the inputs and assumptions you have provided.
                    </AlertDescription>
                  </Alert>
                  {mcInterpretation && (
                    <InterpretationCallout level={mcInterpretation.level} message={mcInterpretation.message} />
                  )}
                  <ResultsSummary result={mcMutation.data} />
                  {mcMutation.data.spending_metrics && (
                    <SpendingMetricsPanel
                      metrics={mcMutation.data.spending_metrics}
                      nSimulations={mcMutation.data.n_simulations}
                      strategy={simulationSelectedStrategy}
                    />
                  )}
                  <FanChart bands={mcMutation.data.percentile_bands} retirementAge={explore.startAge} />
                  {mode === 'advanced' && (
                    <FailureDistributionChart
                      distribution={mcMutation.data.failure_distribution}
                      nSimulations={mcMutation.data.n_simulations}
                    />
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <StrategyGuideDialog
        open={guideOpen}
        onOpenChange={setGuideOpen}
        mode={mode}
        activeStrategies={activeSet}
        actionLabel="Add to comparison"
        description="Learn about each strategy's approach, strengths, and trade-offs. Click 'Add to comparison' to include it in your analysis."
        onSelect={(strategy: WithdrawalStrategyType) => {
          toggleStrategy(strategy)
        }}
      />
    </>
  )
}
