import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MonteCarloResult } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/utils'

function successColor(rate: number): string {
  if (rate >= 0.9) return 'text-green-600'
  if (rate >= 0.7) return 'text-yellow-600'
  return 'text-red-600'
}

interface ResultsSummaryProps {
  result: MonteCarloResult
}

export function ResultsSummary({ result }: ResultsSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Success Rate + Key Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Success Gauge */}
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className={`text-3xl font-bold ${successColor(result.success_rate)}`}>
                {formatPercent(result.success_rate, 1)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Success Rate</div>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xl font-semibold">
                {formatCurrency(result.terminal_stats.median)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Typical Final Balance</div>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xl font-semibold">
                {formatCurrency(result.terminal_stats.p5)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Poor outcome (5th)</div>
            </div>

            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xl font-semibold">
                {formatCurrency(result.terminal_stats.p95)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Great outcome (95th)</div>
            </div>
          </div>

          {/* Terminal Stats Table */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Average Final Balance" value={formatCurrency(result.terminal_stats.mean)} />
            <Stat label="Worst Case" value={formatCurrency(result.terminal_stats.worst)} />
            <Stat label="Best Case" value={formatCurrency(result.terminal_stats.best)} />
            <Stat
              label="Computation Time"
              value={`${result.computation_time_ms.toFixed(0)}ms${result.cached ? ' (cached)' : ''}`}
            />
          </div>

          {/* Safe SWR */}
          {result.safe_swr && (
            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Safe Withdrawal Rate</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat label="95% Confidence" value={formatPercent(result.safe_swr.confidence_95)} />
                <Stat label="90% Confidence" value={formatPercent(result.safe_swr.confidence_90)} />
                <Stat label="85% Confidence" value={formatPercent(result.safe_swr.confidence_85)} />
              </div>
            </div>
          )}

          {/* Failure Summary */}
          {result.failure_distribution.total_failures > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-medium mb-2">
                When portfolios ran out ({result.failure_distribution.total_failures} of {result.n_simulations} scenarios)
              </h4>
              <div className="flex gap-2">
                {result.failure_distribution.buckets.map((bucket, i) => (
                  <div key={bucket} className="text-xs text-center">
                    <div className="font-mono">{result.failure_distribution.counts[i]}</div>
                    <div className="text-muted-foreground">{bucket}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
