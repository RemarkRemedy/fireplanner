import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { CompanionPlannerBridgeState } from '@/hooks/useCompanionPlannerBridge'

interface CompanionResultsSummaryProps {
  companion: CompanionPlannerBridgeState
}

export function CompanionResultsSummary({ companion }: CompanionResultsSummaryProps) {
  const activeRow = companion.scenarioComparisons.find(
    (row) => row.id === companion.activeScenarioId,
  )

  if (!activeRow || activeRow.needsRerun || activeRow.p_success == null) {
    return null
  }

  const successPct = activeRow.p_success * 100

  return (
    <Card className="companion-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Results: {activeRow.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MetricCell
            label="Success Rate"
            value={formatPercent(activeRow.p_success, 1)}
            accent={successPct >= 80 ? 'good' : successPct >= 50 ? 'neutral' : 'bad'}
          />
          <MetricCell
            label="FIRE Age (MC)"
            value={activeRow.fireAge != null ? String(activeRow.fireAge) : '\u2014'}
          />
          {companion.deterministicFireAge != null && (
            <MetricCell
              label="FIRE Age (est.)"
              value={String(companion.deterministicFireAge)}
              subtitle="Deterministic"
            />
          )}
          <MetricCell
            label="WR Critical"
            value={formatWRBand(activeRow.wr_critical_10, activeRow.WR_critical_50, activeRow.wr_critical_90)}
            subtitle={activeRow.wr_critical_10 != null ? 'p10 / p50 / p90' : undefined}
          />
          {activeRow.portfolio_at_fire != null && (
            <MetricCell
              label="Portfolio at FIRE"
              value={formatCurrency(activeRow.portfolio_at_fire)}
            />
          )}
          <MetricCell
            label="Horizon"
            value={companion.scenarioComparisons.length > 0
              ? `${companion.retirementAgeMax - (activeRow.fireAge ?? companion.retirementAgeMin)}+ yrs`
              : '\u2014'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

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

function formatWRBand(p10: number | null, p50: number | null, p90: number | null): string {
  if (p50 == null) return '\u2014'
  if (p10 != null && p90 != null) {
    return `${formatPercent(p10, 1)} / ${formatPercent(p50, 1)} / ${formatPercent(p90, 1)}`
  }
  return formatPercent(p50, 1)
}
