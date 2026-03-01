import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WithdrawalBasisToggle } from '@/components/shared/WithdrawalBasisToggle'
import { InterpretationCallout } from '@/components/shared/InterpretationCallout'
import { formatCurrency, cn } from '@/lib/utils'
import type { PercentileBands } from '@/lib/types'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import { useSectionNudge } from '@/hooks/useSectionNudge'
import { SectionNudge } from '@/components/shared/SectionNudge'
import { useUIStore } from '@/stores/useUIStore'
import { usePageMeta } from '@/hooks/usePageMeta'

// Monte Carlo imports
import { SimulationControls } from '@/components/simulation/SimulationControls'
import { ResultsSummary } from '@/components/simulation/ResultsSummary'
import { SpendingMetricsPanel } from '@/components/simulation/SpendingMetricsPanel'
import { PortfolioHistogram } from '@/components/simulation/PortfolioHistogram'
import { FanChart } from '@/components/simulation/FanChart'
import { FailureDistributionChart } from '@/components/simulation/FailureDistributionChart'
import { useMonteCarloQuery } from '@/hooks/useMonteCarloQuery'
import { MCProjectionTable } from '@/components/simulation/MCProjectionTable'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSimulationStore } from '@/stores/useSimulationStore'

// Backtest imports
import { BacktestControls } from '@/components/backtest/BacktestControls'
import { SummaryPanel } from '@/components/backtest/SummaryPanel'
import { ResultsTable } from '@/components/backtest/ResultsTable'
import { SwrHeatmap } from '@/components/backtest/SwrHeatmap'
import { BacktestDrillDown } from '@/components/backtest/BacktestDrillDown'
import { useBacktestQuery } from '@/hooks/useBacktestQuery'

// Sequence Risk imports
import { CrisisComparisonChart } from '@/components/sequenceRisk/CrisisComparisonChart'
import { MitigationPanel } from '@/components/sequenceRisk/MitigationPanel'
import { useSequenceRiskQuery } from '@/hooks/useSequenceRiskQuery'
import { CRISIS_SCENARIOS } from '@/lib/data/crisisScenarios'
import { formatPercent } from '@/lib/utils'
import type { CrisisScenario } from '@/lib/types'
import { trackEvent } from '@/lib/analytics'
import { PostSimulationCapture } from '@/components/email/PostSimulationCapture'
import { ContextualEmailNudge } from '@/components/email/ContextualEmailNudge'
import { ActiveLifeEventsBar } from '@/components/stressTest/ActiveLifeEventsBar'
import { useIncomeStore } from '@/stores/useIncomeStore'

function TabIntro({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground">{children}</p>
  )
}

interface MonteCarloTabProps {
  isAdvanced: boolean
  mutate: () => void
  data: import('@/lib/types').MonteCarloResult | undefined
  isPending: boolean
  error: Error | null
  canRun: boolean
  validationErrors: Record<string, string>
  isStale: boolean
}

function MonteCarloTab({
  isAdvanced, mutate, data, isPending, error, canRun, validationErrors, isStale,
}: MonteCarloTabProps) {
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const selectedStrategy = useSimulationStore((s) => s.selectedStrategy)

  const mcInterpretation = data ? (() => {
    const rate = data.success_rate
    if (rate >= 0.95) return { level: 'success' as const, message: 'Excellent — your plan has a very high probability of lasting through retirement.' }
    if (rate >= 0.80) return { level: 'warning' as const, message: 'Good — your plan is likely to succeed, but consider a small buffer (lower spending or more savings).' }
    return { level: 'danger' as const, message: 'Needs attention — there\'s a meaningful risk of running out. Consider reducing withdrawal rate or extending your savings period.' }
  })() : null

  return (
    <div className="space-y-6">
      <TabIntro>
        Runs 10,000 random market scenarios to estimate the probability your portfolio lasts through retirement. A success rate above 90% is generally considered safe.
      </TabIntro>

      <SimulationControls
        onRun={mutate}
        isPending={isPending}
        canRun={canRun}
        validationErrors={validationErrors}
      />

      {isPending && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Running simulation...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-medium">
            Simulation failed: {error.message}
          </p>
        </div>
      )}

      {data && isStale && (
        <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Results may be outdated — your inputs have changed since the last run.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => mutate()} disabled={isPending}>
            Re-run
          </Button>
        </div>
      )}

      {data && (
        <>
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
              Simulations use historical data and statistical models. Past performance does not guarantee
              future results. All projections assume the inputs and assumptions you've provided.
            </AlertDescription>
          </Alert>
          {mcInterpretation && (
            <InterpretationCallout level={mcInterpretation.level} message={mcInterpretation.message} />
          )}
          <ResultsSummary result={data} />
          {data.spending_metrics && (
            <SpendingMetricsPanel metrics={data.spending_metrics} nSimulations={data.n_simulations} strategy={selectedStrategy} />
          )}
          <FanChart bands={data.percentile_bands} retirementAge={retirementAge} />
          {isAdvanced && data.histogram_snapshots && data.histogram_snapshots.length > 0 && (
            <PortfolioHistogram snapshots={data.histogram_snapshots} />
          )}
          {isAdvanced && (
            <FailureDistributionChart
              distribution={data.failure_distribution}
              nSimulations={data.n_simulations}
            />
          )}
          {isAdvanced && data.withdrawal_bands && (
            <WithdrawalSchedule bands={data.withdrawal_bands} strategy={selectedStrategy} />
          )}
        </>
      )}
    </div>
  )
}

function WithdrawalSchedule({ bands, strategy }: { bands: PercentileBands; strategy: string }) {
  const [expanded, setExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [realDollars, setRealDollars] = useState(false)
  const currentAge = useProfileStore((s) => s.currentAge)
  const inflation = useProfileStore((s) => s.inflation)
  const isConstantDollar = strategy === 'constant_dollar'

  const rows = useMemo(() => {
    return bands.ages.map((age, i) => {
      const deflator = realDollars ? Math.pow(1 + inflation, age - currentAge) : 1
      return {
        age,
        p10: bands.p10[i] / deflator,
        p25: bands.p25[i] / deflator,
        p50: bands.p50[i] / deflator,
        p75: bands.p75[i] / deflator,
        p90: bands.p90[i] / deflator,
      }
    })
  }, [bands, realDollars, inflation, currentAge])

  const displayRows = showAll ? rows : rows.filter((_, i) => i % 5 === 0 || i === rows.length - 1)

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="flex items-center gap-2 text-base">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Annual Withdrawal Schedule
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            Net amount withdrawn from the portfolio each year (after post-retirement income offset), across {bands.ages.length > 0 ? '10,000' : ''} simulated market paths.
          </p>
          {isConstantDollar && (
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
              Constant Dollar withdraws the same inflation-adjusted amount each year regardless of portfolio performance, so percentiles are identical for surviving simulations. Try a variable strategy (VPW, Guardrails) to see how withdrawals adapt to market conditions.
            </p>
          )}
          <div className="flex items-center gap-2 mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={realDollars}
                onChange={(e) => setRealDollars(e.target.checked)}
              />
              Show in today's dollars (adjusted for {(inflation * 100).toFixed(1)}% inflation)
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Age</th>
                  <th className="text-right py-2 px-3 font-medium text-red-600">p10</th>
                  <th className="text-right py-2 px-3 font-medium text-yellow-600">p25</th>
                  <th className="text-right py-2 px-3 font-medium">p50 (Median)</th>
                  <th className="text-right py-2 px-3 font-medium text-green-600">p75</th>
                  <th className="text-right py-2 px-3 font-medium text-green-600">p90</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={row.age} className="border-b border-muted/50">
                    <td className="py-1.5 pr-4 font-medium">{row.age}</td>
                    <td className="py-1.5 px-3 text-right text-red-600">{formatCurrency(row.p10)}</td>
                    <td className="py-1.5 px-3 text-right text-yellow-600">{formatCurrency(row.p25)}</td>
                    <td className="py-1.5 px-3 text-right font-medium">{formatCurrency(row.p50)}</td>
                    <td className="py-1.5 px-3 text-right text-green-600">{formatCurrency(row.p75)}</td>
                    <td className="py-1.5 px-3 text-right text-green-600">{formatCurrency(row.p90)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > displayRows.length && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show every 5th year' : `Show all ${rows.length} years`}
            </Button>
          )}
          {showAll && rows.length === displayRows.length && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll(false)}>
              Show every 5th year
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function BacktestTab() {
  const {
    baseData, heatmapData, heatmapStale, runHeatmap,
    isPending, isHeatmapPending, error, canRun, validationErrors, config, setConfig,
  } = useBacktestQuery()
  const [drillDownCell, setDrillDownCell] = useState<{ swr: number; duration: number; successRate: number } | null>(null)
  const setSimField = useSimulationStore((s) => s.setField)

  // Persist last backtest success rate
  useEffect(() => {
    if (baseData) setSimField('lastBacktestSuccessRate', baseData.summary.success_rate)
  }, [baseData, setSimField])

  const btInterpretation = baseData ? (() => {
    const rate = baseData.summary.success_rate
    const failed = baseData.summary.failed_periods
    const total = baseData.summary.total_periods
    const worst = baseData.summary.worst_start_year
    if (rate >= 1.0) return { level: 'success' as const, message: 'Your plan would have survived every historical period since 1928.' }
    if (rate >= 0.90) return { level: 'warning' as const, message: `Your plan failed in ${failed} out of ${total} historical periods. The worst starting year was ${worst}.` }
    return { level: 'danger' as const, message: `Your plan shows significant historical vulnerability (${failed} failures out of ${total} periods). Consider reducing your withdrawal rate.` }
  })() : null

  return (
    <div className="space-y-6">
      <TabIntro>
        Tests your plan against every historical period since 1928. Unlike Monte Carlo (which generates random scenarios), this uses actual market history. Results update automatically as you change parameters.
      </TabIntro>

      {Object.keys(validationErrors).length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-medium">
            Fix validation errors before running backtest.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <Link to="/inputs#section-personal" className="text-sm text-destructive hover:underline font-medium">
              Personal Details &rarr;
            </Link>
            <Link to="/inputs#section-expenses" className="text-sm text-destructive hover:underline font-medium">
              Expenses &rarr;
            </Link>
            <Link to="/inputs#section-allocation" className="text-sm text-destructive hover:underline font-medium">
              Allocation &rarr;
            </Link>
          </div>
        </div>
      )}

      <BacktestControls
        config={config}
        setConfig={setConfig}
        isPending={isPending}
        canRun={canRun}
        validationErrors={validationErrors}
        onRunHeatmap={runHeatmap}
        isHeatmapPending={isHeatmapPending}
        heatmapStale={heatmapStale}
      />

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error.message}</p>
        </div>
      )}

      {heatmapStale && heatmapData && (
        <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Heatmap may be outdated — parameters have changed since it was generated.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={runHeatmap} disabled={isHeatmapPending}>
            Regenerate
          </Button>
        </div>
      )}

      {baseData && (
        <>
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
              Simulations use historical data and statistical models. Past performance does not guarantee
              future results. All projections assume the inputs and assumptions you've provided.
            </AlertDescription>
          </Alert>
          {btInterpretation && (
            <InterpretationCallout level={btInterpretation.level} message={btInterpretation.message} />
          )}
          <SummaryPanel summary={baseData.summary} computationTimeMs={baseData.computation_time_ms} />
          {heatmapData && (
            <SwrHeatmap
              data={heatmapData}
              onCellClick={(swr, duration, successRate) =>
                setDrillDownCell({ swr, duration, successRate })
              }
            />
          )}
          <ResultsTable results={baseData.results} />
        </>
      )}

      {drillDownCell && (
        <BacktestDrillDown
          swr={drillDownCell.swr}
          duration={drillDownCell.duration}
          successRate={drillDownCell.successRate}
          open={true}
          onClose={() => setDrillDownCell(null)}
          dataset={config.dataset}
          blendRatio={config.blendRatio}
        />
      )}
    </div>
  )
}

function SequenceRiskTab() {
  const [selectedCrisis, setSelectedCrisis] = useState<CrisisScenario>(CRISIS_SCENARIOS[0])
  const { mutate, data, isPending, error, canRun, validationErrors, isStale } = useSequenceRiskQuery()

  const errorMessages = Object.values(validationErrors)
  const disabledReason = !canRun
    ? errorMessages[0] ?? 'Fix validation errors to run stress test'
    : undefined

  const srInterpretation = data ? (() => {
    const degradation = data.success_degradation
    if (degradation < 0.05) return { level: 'success' as const, message: 'Your plan is resilient to early retirement crises.' }
    if (degradation <= 0.15) return { level: 'warning' as const, message: `A crisis at retirement could reduce your success rate by ${formatPercent(degradation, 1)}. Consider the mitigation strategies below.` }
    return { level: 'danger' as const, message: `Your plan is highly sensitive to sequence risk (${formatPercent(degradation, 1)} degradation). The mitigation strategies below can help.` }
  })() : null

  return (
    <div className="space-y-6">
      <TabIntro>
        Tests what happens if a major market crash occurs right as you retire — the worst possible timing. Shows how mitigation strategies can protect you.
      </TabIntro>

      {Object.keys(validationErrors).length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-medium">
            Fix validation errors before running stress tests.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <Link to="/inputs#section-personal" className="text-sm text-destructive hover:underline font-medium">
              Personal Details &rarr;
            </Link>
            <Link to="/inputs#section-expenses" className="text-sm text-destructive hover:underline font-medium">
              Expenses &rarr;
            </Link>
            <Link to="/inputs#section-allocation" className="text-sm text-destructive hover:underline font-medium">
              Allocation &rarr;
            </Link>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Crisis Scenario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {CRISIS_SCENARIOS.map((crisis) => (
              <button
                key={crisis.id}
                onClick={() => setSelectedCrisis(crisis)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selectedCrisis.id === crisis.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{crisis.name}</span>
                  <Badge variant="outline" className="text-xs">{crisis.region}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {crisis.startYear} | {formatPercent(crisis.peakDrawdown, 0)} drawdown | {crisis.recoveryYears}yr recovery
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium">{selectedCrisis.name} ({selectedCrisis.startYear})</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedCrisis.description}</p>
          </div>

          <WithdrawalBasisToggle />

          <div className="flex items-center gap-3">
            <Button
              onClick={() => { trackEvent('simulation_run', { type: 'sequence-risk', crisis: selectedCrisis.id }); mutate(selectedCrisis) }}
              disabled={!canRun || isPending}
              className="min-w-[180px]"
            >
              {isPending ? 'Running Stress Test...' : 'Run Stress Test'}
            </Button>
            {disabledReason && (
              <span className="text-sm text-muted-foreground">{disabledReason}</span>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error.message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {data && isStale && (
        <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Results may be outdated — your inputs have changed since the last run.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => mutate(selectedCrisis)} disabled={isPending}>
            Re-run
          </Button>
        </div>
      )}

      {data && (
        <>
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
              Simulations use historical data and statistical models. Past performance does not guarantee
              future results. All projections assume the inputs and assumptions you've provided.
            </AlertDescription>
          </Alert>
          {srInterpretation && (
            <InterpretationCallout level={srInterpretation.level} message={srInterpretation.message} />
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 md:pt-6 text-center">
                <p className="text-sm text-muted-foreground">Normal Success Rate</p>
                <p className="text-3xl font-bold text-green-600">{formatPercent(data.normal_success_rate, 1)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 md:pt-6 text-center">
                <p className="text-sm text-muted-foreground">Crisis Success Rate</p>
                <p className={`text-3xl font-bold ${data.crisis_success_rate >= 0.8 ? 'text-green-600' : data.crisis_success_rate >= 0.6 ? 'text-yellow-600' : 'text-destructive'}`}>
                  {formatPercent(data.crisis_success_rate, 1)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 md:pt-6 text-center">
                <p className="text-sm text-muted-foreground">Success Degradation</p>
                <p className="text-3xl font-bold text-destructive">
                  -{formatPercent(data.success_degradation, 1)}
                </p>
              </CardContent>
            </Card>
          </div>

          <CrisisComparisonChart
            normalBands={data.normal_percentile_bands}
            crisisBands={data.crisis_percentile_bands}
          />

          <MitigationPanel
            mitigations={data.mitigations}
            baseNormalRate={data.normal_success_rate}
            baseCrisisRate={data.crisis_success_rate}
          />
        </>
      )}
    </div>
  )
}

export function StressTestPage() {
  usePageMeta({ title: 'Stress Test — SG FIRE Planner', description: 'Monte Carlo simulation, historical backtesting, and sequence risk analysis for your Singapore retirement plan.', path: '/stress-test' })
  const stressMode = useEffectiveMode('section-stress-test')
  const stressNudge = useSectionNudge('section-stress-test')
  const setSectionMode = useUIStore((s) => s.setSectionMode)
  const isStressAdvanced = stressMode === 'advanced'
  const mc = useMonteCarloQuery()
  const setSimField = useSimulationStore((s) => s.setField)
  const lifeEventCount = useIncomeStore((s) => s.lifeEvents.length)

  // Persist last MC success rate (lifted from MonteCarloTab so it updates even when tab is inactive)
  useEffect(() => {
    if (mc.data) setSimField('lastMCSuccessRate', mc.data.success_rate)
  }, [mc.data, setSimField])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Stress Test</h1>
            <p className="text-muted-foreground text-sm">
              Test your retirement plan against market uncertainty using Monte Carlo simulation, historical backtesting, and crisis scenario analysis.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 shrink-0 mt-1">
            <button
              onClick={() => setSectionMode('section-stress-test', 'simple')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                stressMode === 'simple'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Simple
            </button>
            <button
              onClick={() => setSectionMode('section-stress-test', 'advanced')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                stressMode === 'advanced'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Advanced
            </button>
          </div>
        </div>
      </div>
      {stressNudge && (
        <SectionNudge
          nudgeId={stressNudge.id}
          sectionId={stressNudge.sectionId}
          message={stressNudge.message}
          actionLabel={stressNudge.actionLabel}
        />
      )}

      {isStressAdvanced ? (
        <ActiveLifeEventsBar />
      ) : lifeEventCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {lifeEventCount} life event{lifeEventCount !== 1 ? 's' : ''} active (switch to Advanced mode to manage)
        </p>
      ) : null}

      <Tabs defaultValue="monte-carlo" onValueChange={(tab) => trackEvent('stress_test_tab_changed', { tab })}>
        {(() => {
          // Static Tailwind class mapping — dynamic template literals get purged
          const hasResults = !!mc.data
          const tabCount = 1 + (hasResults ? 1 : 0) + (isStressAdvanced ? 2 : 0)
          const gridColsClass: Record<number, string> = {
            1: 'grid-cols-1',
            2: 'grid-cols-2',
            3: 'grid-cols-3',
            4: 'grid-cols-4',
          }
          return (
            <TabsList className={`grid w-full ${gridColsClass[tabCount] ?? 'grid-cols-1'}`}>
              <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
              {hasResults && <TabsTrigger value="mc-projection">Projection Table</TabsTrigger>}
              {isStressAdvanced && <TabsTrigger value="backtest">Historical Backtest</TabsTrigger>}
              {isStressAdvanced && <TabsTrigger value="sequence-risk">Sequence Risk</TabsTrigger>}
            </TabsList>
          )
        })()}

        <TabsContent value="monte-carlo">
          <MonteCarloTab
            isAdvanced={isStressAdvanced}
            mutate={mc.mutate}
            data={mc.data}
            isPending={mc.isPending}
            error={mc.error}
            canRun={mc.canRun}
            validationErrors={mc.validationErrors}
            isStale={mc.isStale}
          />
        </TabsContent>

        {mc.data && (
          <TabsContent value="mc-projection">
            <MCProjectionTable result={mc.data!} isStale={mc.isStale} />
          </TabsContent>
        )}

        {isStressAdvanced && (
          <TabsContent value="backtest">
            <BacktestTab />
          </TabsContent>
        )}

        {isStressAdvanced && (
          <TabsContent value="sequence-risk">
            <SequenceRiskTab />
          </TabsContent>
        )}

      </Tabs>

      <ContextualEmailNudge
        pageId="stress-test"
        message="Finding this useful? We're building section-by-section tips and guides for stress testing."
        hidden={!!mc.data}
      />

      {mc.data && <PostSimulationCapture />}

      <p className="text-xs text-muted-foreground mt-4">
        Want to explore withdrawal strategies in isolation?{' '}
        <Link to="/withdrawal" className="text-primary hover:underline">
          Withdrawal Strategies &rarr;
        </Link>
      </p>
    </div>
  )
}
