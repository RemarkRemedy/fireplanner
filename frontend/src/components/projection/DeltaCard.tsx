import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DeltaBadge } from '@/components/shared/DeltaBadge'
import type { DeltaSummary } from '@/lib/calculations/metricsSnapshot'

interface DeltaCardProps {
  summary: DeltaSummary
  onDismiss: () => void
  showMcNote?: boolean
}

function formatMetricValue(metric: string, value: number): string {
  if (metric === 'FIRE number') {
    return `$${value.toLocaleString()}`
  }
  return String(value)
}

export function DeltaCard({ summary, onDismiss, showMcNote }: DeltaCardProps) {
  if (!summary.isSignificant) {
    return (
      <Card
        role="status"
        aria-live="polite"
        className="border-muted bg-muted/30"
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{summary.label}</span>
              {' '}No significant change to your FIRE plan.
            </p>
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      role="status"
      aria-live="polite"
      className="border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{summary.label}</p>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1.5">
          {summary.deltas.map((delta) => {
            const isFireAge = delta.metric === 'FIRE age'
            const isFireNumber = delta.metric === 'FIRE number'
            const diff = delta.after - delta.before
            return (
              <div key={delta.metric} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{delta.metric}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">
                    {formatMetricValue(delta.metric, delta.before)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-foreground">
                    {formatMetricValue(delta.metric, delta.after)}
                  </span>
                  <DeltaBadge
                    value={diff}
                    format={(v) => isFireAge
                      ? `${Math.abs(v)} yr${Math.abs(v) !== 1 ? 's' : ''}`
                      : `$${Math.abs(v).toLocaleString()}`
                    }
                    invert={isFireAge || isFireNumber}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {summary.explanation && (
          <p className="text-xs text-muted-foreground">{summary.explanation}</p>
        )}

        {showMcNote && (
          <p className="text-xs text-muted-foreground italic">
            Re-run Monte Carlo to see updated success rate.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
