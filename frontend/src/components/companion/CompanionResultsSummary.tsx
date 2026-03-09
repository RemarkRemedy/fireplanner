import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import { formatWRBand } from '@/components/companion/companionResultsSummaryUtils'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { CompanionPlannerBridgeState } from '@/hooks/useCompanionPlannerBridge'
import type { ActionImpactResult } from '@/lib/companion/actionImpacts'

interface CompanionResultsSummaryProps {
  companion: CompanionPlannerBridgeState
  actionImpacts?: ActionImpactResult[] | null
  actionImpactsPending?: boolean
  actionImpactsProgress?: { completed: number; total: number } | null
  actionImpactsError?: string | null
  householdContext?: {
    label: string
    coverage: string
  } | null
}

export function CompanionResultsSummary({
  companion,
  actionImpacts,
  actionImpactsPending,
  actionImpactsProgress,
  actionImpactsError,
  householdContext,
}: CompanionResultsSummaryProps) {
  const activeRow = companion.scenarioComparisons.find(
    (row) => row.id === companion.activeScenarioId,
  )

  if (!activeRow || activeRow.needsRerun || activeRow.p_success == null) {
    return null
  }

  const successPct = activeRow.p_success * 100

  return (
    <div className="space-y-3">
      <Card className="companion-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {householdContext ? `${householdContext.label} results: ${activeRow.name}` : `Results: ${activeRow.name}`}
          </CardTitle>
          {householdContext ? (
            <p className="text-xs text-muted-foreground">
              {householdContext.coverage}. This top-line answer stays household-level for the active scenario.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetricCell
              label="Success Rate"
              value={formatPercent(activeRow.p_success, 1)}
              accent={successPct >= 90 ? 'good' : successPct >= 70 ? 'neutral' : 'bad'}
            />
            <MetricCell
              label="FIRE Age (MC)"
              value={activeRow.projected_fire_age_p50 != null ? String(activeRow.projected_fire_age_p50) : '\u2014'}
            />
            {companion.deterministicFireAge != null && (
              <MetricCell
                label="FIRE Age (est.)"
                value={String(companion.deterministicFireAge)}
                subtitle="Deterministic"
              />
            )}
            <MetricCell
              label="Safe WR"
              value={formatWRBand(activeRow.wr_safe_95, activeRow.wr_safe_50, activeRow.wr_safe_85)}
              subtitle={activeRow.wr_safe_95 != null && activeRow.wr_safe_85 != null ? '95% / 50% / 85%' : undefined}
            />
            {activeRow.portfolio_at_fire_p50 != null && (
              <MetricCell
                label="Portfolio at FIRE"
                value={formatCurrency(activeRow.portfolio_at_fire_p50)}
              />
            )}
            <MetricCell
              label="Horizon"
              value={activeRow.projected_fire_age_p50 != null
                ? `${companion.retirementAgeMax + 1 - activeRow.projected_fire_age_p50}+ yrs`
                : '\u2014'}
            />
          </div>
        </CardContent>
      </Card>

      <RetireeDrawdownGuard
        snapshotWithdrawalRate={companion.snapshotWithdrawalRate}
        wrSafe90={activeRow.wr_safe_90}
      />

      <ActionImpactsSection
        impacts={actionImpacts}
        isPending={actionImpactsPending}
        progress={actionImpactsProgress}
        error={actionImpactsError}
      />
    </div>
  )
}

// ── Retiree drawdown guard ────────────────────────────────

function RetireeDrawdownGuard({
  snapshotWithdrawalRate,
  wrSafe90,
}: {
  snapshotWithdrawalRate: number | null
  wrSafe90: number | null
}) {
  if (snapshotWithdrawalRate == null || wrSafe90 == null) return null

  const isSustainable = snapshotWithdrawalRate <= wrSafe90

  return (
    <Card className="companion-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Drawdown Sustainability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Current rate:</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatPercent(snapshotWithdrawalRate, 2)}
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Safe rate (90% conf.):</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatPercent(wrSafe90, 2)}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {isSustainable ? (
              <div className="text-green-600 dark:text-green-400">
                <div className="text-lg font-bold">Pass</div>
                <div className="text-[10px]">Within safe range</div>
              </div>
            ) : (
              <div className="text-amber-600 dark:text-amber-400">
                <div className="text-lg font-bold">Caution</div>
                <div className="text-[10px]">Exceeds safe rate</div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
          Compared against the active scenario's 90% confidence safe withdrawal rate.
          This is a sustainability check, not a spending target.
        </div>
      </CardContent>
    </Card>
  )
}

// ── Action impacts display ────────────────────────────────

function ActionImpactsSection({
  impacts,
  isPending,
  progress,
  error,
}: {
  impacts?: ActionImpactResult[] | null
  isPending?: boolean
  progress?: { completed: number; total: number } | null
  error?: string | null
}) {
  if (!impacts && !isPending && !error) return null

  const top3 = impacts?.slice(0, 3) ?? []

  return (
    <Card className="companion-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          What could improve your plan?
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending && (
          <div className="text-sm text-muted-foreground">
            Analyzing actions{progress ? ` (${progress.completed}/${progress.total})` : ''}...
          </div>
        )}
        {!isPending && error && (
          <div className="text-sm text-amber-600 dark:text-amber-400">
            {error}
          </div>
        )}
        {!isPending && top3.length > 0 && (
          <div className="space-y-3">
            {top3.map((impact, idx) => (
              <ActionImpactRow key={impact.lever.id} impact={impact} rank={idx + 1} />
            ))}
          </div>
        )}
        {!isPending && impacts && impacts.length > 3 && (
          <div className="mt-3 pt-3 border-t border-muted/50">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Other actions</div>
            {impacts.slice(3).map((impact) => (
              <div key={impact.lever.id} className="flex items-center justify-between py-1 text-xs text-muted-foreground">
                <span>{impact.lever.shortLabel}</span>
                <ImpactDeltaBadge value={impact.delta_p_success} />
              </div>
            ))}
          </div>
        )}
        {!isPending && impacts && impacts.length === 0 && !error && (
          <div className="text-sm text-muted-foreground">
            No applicable actions for your current lifecycle stage.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActionImpactRow({ impact, rank }: { impact: ActionImpactResult; rank: number }) {
  const deltaP = impact.delta_p_success

  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
            <span className="text-sm font-medium">{impact.lever.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{impact.rationale}</div>
        </div>
        <div className="text-right shrink-0">
          <ImpactDeltaBadge value={deltaP} />
          {impact.delta_fail_prob_0_5y < -0.005 && (
            <div className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
              {formatPercent(Math.abs(impact.delta_fail_prob_0_5y), 1)} less early risk
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ImpactDeltaBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.001) {
    return <span className="text-xs text-muted-foreground">~0pp</span>
  }

  return (
    <DeltaBadge value={value} format={(delta) => `${(delta * 100).toFixed(1)}pp`} />
  )
}

// ── Metric helpers ────────────────────────────────────────

function MetricCell({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string
  value: string
  subtitle?: string
  accent?: 'good' | 'neutral' | 'bad'
}) {
  const accentClass = accent === 'good'
    ? 'text-green-600 dark:text-green-400'
    : accent === 'bad'
      ? 'text-red-600 dark:text-red-400'
      : ''

  return (
    <div className="space-y-0.5">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${accentClass}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground">{subtitle}</div>}
    </div>
  )
}
