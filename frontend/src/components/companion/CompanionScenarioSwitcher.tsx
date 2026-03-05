import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NumberInput } from '@/components/shared/NumberInput'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import type { CompanionPlannerBridgeState, CompanionScenarioComparison } from '@/hooks/useCompanionPlannerBridge'

interface CompanionScenarioSwitcherProps {
  companion: CompanionPlannerBridgeState
  isSimulationPending: boolean
  simulationProgress: { progress: number; message: string } | null
  onRunScenario: () => void
}

export function CompanionScenarioSwitcher({
  companion,
  isSimulationPending,
  simulationProgress,
  onRunScenario,
}: CompanionScenarioSwitcherProps) {
  const hasSelectedScenario = !!companion.activeScenario
  const hasLoadedSnapshot = companion.bootstrapStatus === 'loaded'

  return (
    <section className="companion-shell rounded-xl border companion-border companion-bg p-4 md:p-5 space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base md:text-lg font-semibold companion-heading">
            Planner &middot; Local-only &middot; Connected
          </h2>
          <Badge variant="outline" className="companion-chip text-xs">
            Companion Mode
          </Badge>
        </div>

        {companion.bootstrapStatus === 'loading' && (
          <Alert className="companion-alert">
            <AlertDescription className="text-sm">
              Loading your Expense snapshot...
            </AlertDescription>
          </Alert>
        )}
        {hasLoadedSnapshot && (
          <Alert className="companion-alert companion-alert-success">
            <AlertDescription className="text-sm">
              Loaded from your Expense data (last 180 days). You can override anything.
            </AlertDescription>
          </Alert>
        )}
        {companion.bootstrapStatus === 'error' && (
          <Alert className="border-destructive/40 bg-destructive/10">
            <AlertDescription className="text-sm text-destructive">
              Could not load snapshot from phone. {companion.bootstrapError}
            </AlertDescription>
          </Alert>
        )}

        <Alert className="companion-alert">
          <AlertDescription className="flex items-center justify-between gap-3 text-sm">
            <div className="space-y-0.5">
              <div>
                {companion.saveStatus === 'saving' && 'Saving...'}
                {companion.saveStatus === 'saved' && 'Saved to phone'}
                {companion.saveStatus === 'error' && `Save failed: ${companion.saveError ?? 'Unknown error.'}`}
                {companion.saveStatus === 'idle' && 'Ready to save after simulation run.'}
              </div>
              <button
                type="button"
                onClick={companion.retrySave}
                className="text-xs text-primary hover:underline"
                disabled={companion.saveStatus === 'saving' || !companion.canSaveResults}
              >
                Save results to phone
              </button>
              {!companion.canSaveResults && (
                <div className="text-[11px] text-muted-foreground">
                  Run simulation to refresh results before saving.
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {isSimulationPending && (
          <div className="rounded-md border companion-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{simulationProgress?.message ?? 'Running simulation...'}</span>
              <span>{Math.round((simulationProgress?.progress ?? 0.1) * 100)}%</span>
            </div>
            <Progress value={Math.round((simulationProgress?.progress ?? 0.1) * 100)} className="h-2" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="companion-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Scenarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {companion.scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => companion.selectScenario(scenario.id)}
                className={cn(
                  'w-full text-left rounded-lg border px-3 py-2 transition-colors',
                  companion.activeScenarioId === scenario.id
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-border bg-card hover:bg-accent/50',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{scenario.name}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="companion-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {hasSelectedScenario ? companion.activeScenario?.name : 'Scenario Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NumberInput
              label="Spending Delta (monthly)"
              value={companion.activeScenarioMonthlyExpenseDelta}
              onChange={companion.setActiveScenarioMonthlyExpenseDelta}
              integer
              step={100}
            />

            <NumberInput
              label="Retirement Age"
              value={companion.activeScenarioRetirementAge ?? companion.retirementAgeMin}
              onChange={companion.setActiveScenarioRetirementAge}
              integer
              min={companion.retirementAgeMin}
              max={companion.retirementAgeMax}
              disabled={!hasSelectedScenario}
            />

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Effective annual expenses: {companion.activeScenarioAnnualExpenses != null
                ? formatCurrency(companion.activeScenarioAnnualExpenses)
                : '\u2014'}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="companion-primary"
                onClick={onRunScenario}
                disabled={!hasSelectedScenario || isSimulationPending}
              >
                {isSimulationPending ? 'Running Simulation...' : 'Run Simulation'}
              </Button>
              <Button
                variant="outline"
                onClick={companion.duplicateActiveScenario}
                disabled={!hasSelectedScenario}
              >
                Duplicate Scenario
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <CompanionComparisonTable
        comparisons={companion.scenarioComparisons}
        deterministicFireAge={companion.deterministicFireAge}
      />
    </section>
  )
}

// --- Comparison table with delta vs base ---

function CompanionComparisonTable({
  comparisons,
  deterministicFireAge,
}: {
  comparisons: CompanionScenarioComparison[]
  deterministicFireAge: number | null
}) {
  const base = comparisons.find((row) => row.id === 'base') ?? null

  const formatMaybePercent = (value: number | null) => {
    if (value == null) return '\u2014'
    return formatPercent(value, 1)
  }

  const formatDeltaPercent = (v: number) => formatPercent(Math.abs(v), 1)
  const formatDeltaYears = (v: number) => `${Math.abs(v)}y`

  return (
    <Card className="companion-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Scenario Comparison</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Scenario</th>
              <th className="py-2 text-right">P(success)</th>
              <th className="py-2 text-right">FIRE age</th>
              <th className="py-2 text-right">Safe WR</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((row) => {
              const isBase = row.id === 'base'
              const pDelta = !isBase && base?.p_success != null && row.p_success != null
                ? row.p_success - base.p_success
                : null
              const ageDelta = !isBase && base?.projected_fire_age_p50 != null && row.projected_fire_age_p50 != null
                ? Math.round(row.projected_fire_age_p50) - Math.round(base.projected_fire_age_p50)
                : null
              const wrDelta = !isBase && base?.wr_safe_50 != null && row.wr_safe_50 != null
                ? row.wr_safe_50 - base.wr_safe_50
                : null

              return (
                <tr key={row.id} className={cn(
                  'border-b border-muted/50',
                  isBase && 'bg-muted/20',
                )}>
                  <td className="py-2">
                    <span className="font-medium">{row.name}</span>
                    {row.needsRerun && (
                      <span className="ml-2 text-[10px] text-muted-foreground uppercase tracking-wide">needs rerun</span>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {formatMaybePercent(row.p_success)}
                    {pDelta != null && <DeltaBadge value={pDelta} format={formatDeltaPercent} />}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {row.projected_fire_age_p50 ?? '\u2014'}
                    {ageDelta != null && <DeltaBadge value={ageDelta} format={formatDeltaYears} invert />}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {formatMaybePercent(row.wr_safe_50)}
                    {wrDelta != null && <DeltaBadge value={wrDelta} format={formatDeltaPercent} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {deterministicFireAge != null && (
          <div className="mt-2 text-xs text-muted-foreground">
            Base plan FIRE age (deterministic): <span className="font-medium">{deterministicFireAge}</span>
            <span className="ml-1">(from Expense app, before scenario adjustments)</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
