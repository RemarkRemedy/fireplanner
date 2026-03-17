import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGuardrailStatus } from '@/hooks/useGuardrailStatus'
import { formatCurrency } from '@/lib/utils'
import type { GuardrailZone } from '@/lib/calculations/guardrailStatus'

const ZONE_CONFIG: Record<GuardrailZone, {
  label: string
  description: string
  color: string
  bgColor: string
  barColor: string
}> = {
  comfort: {
    label: 'Comfort Zone',
    description: "You're within your guardrails. No spending adjustment needed.",
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    barColor: 'bg-green-500',
  },
  raise: {
    label: 'Below Floor',
    description: 'Your withdrawal rate is low. You could increase spending.',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    barColor: 'bg-blue-500',
  },
  cut: {
    label: 'Above Ceiling',
    description: 'Your withdrawal rate is high. Time to cut spending.',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    barColor: 'bg-red-500',
  },
}

/**
 * Visual gauge panel showing where the user sits relative to their
 * Guyton-Klinger guardrails. Only renders when guardrails strategy is selected.
 */
export function GuardrailDashboard() {
  const status = useGuardrailStatus()

  if (!status) return null

  const config = ZONE_CONFIG[status.zone]

  // Gauge positions: map rates to percentages on the bar
  // The bar spans from 0 to max(ceilingRate * 1.5, currentRate * 1.2) for visual room
  const maxRate = Math.max(status.ceilingRate * 1.5, status.currentRate * 1.2)
  const toPercent = (rate: number) => Math.min(100, Math.max(0, (rate / maxRate) * 100))

  const floorPct = toPercent(status.floorRate)
  const ceilingPct = toPercent(status.ceilingRate)
  const currentPct = toPercent(status.currentRate)

  return (
    <Card data-testid="guardrail-dashboard">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Guardrail Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Zone indicator */}
        <div className={`rounded-md border p-3 ${config.bgColor}`}>
          <p className={`font-semibold ${config.color}`}>{config.label}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
          {status.suggestedMonthlyAdjustment !== 0 && (
            <p className={`text-sm font-medium mt-1 ${config.color}`}>
              {status.suggestedMonthlyAdjustment > 0
                ? `You could increase spending by ${formatCurrency(status.suggestedMonthlyAdjustment)}/month`
                : `Consider cutting ${formatCurrency(Math.abs(status.suggestedMonthlyAdjustment))}/month`}
            </p>
          )}
        </div>

        {/* Visual gauge */}
        <div className="space-y-2">
          <div className="relative h-6 bg-muted rounded-full overflow-hidden">
            {/* Floor-to-ceiling comfort zone band */}
            <div
              className="absolute top-0 bottom-0 bg-green-200 dark:bg-green-800/40"
              style={{ left: `${floorPct}%`, width: `${ceilingPct - floorPct}%` }}
            />
            {/* Floor marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500"
              style={{ left: `${floorPct}%` }}
            />
            {/* Ceiling marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500"
              style={{ left: `${ceilingPct}%` }}
            />
            {/* Current rate indicator */}
            <div
              className={`absolute top-0.5 bottom-0.5 w-3 rounded-full ${config.barColor} border-2 border-white dark:border-gray-900`}
              style={{ left: `calc(${currentPct}% - 6px)` }}
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Floor: {(status.floorRate * 100).toFixed(1)}%</span>
            <span className={`font-medium ${config.color}`}>
              Current: {(status.currentRate * 100).toFixed(1)}%
            </span>
            <span>Ceiling: {(status.ceilingRate * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Rate details */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="text-muted-foreground">Floor Rate</p>
            <p className="font-medium text-blue-600 dark:text-blue-400">
              {(status.floorRate * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Your Rate</p>
            <p className={`font-semibold ${config.color}`}>
              {(status.currentRate * 100).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Ceiling Rate</p>
            <p className="font-medium text-red-600 dark:text-red-400">
              {(status.ceilingRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
