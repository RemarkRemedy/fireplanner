import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'

export function useMetricsSnapshot(): MetricsSnapshot {
  const metrics = useDashboardMetrics()
  const fireNumber = metrics.showProjectionNumber
    ? (metrics.projectionFireNumber ?? metrics.fireNumber)
    : metrics.fireNumber
  return { fireAge: metrics.fireAge, fireNumber }
}
