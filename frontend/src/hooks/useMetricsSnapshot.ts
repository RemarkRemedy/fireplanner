import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import type { MetricsSnapshot } from '@/lib/calculations/metricsSnapshot'

export function useMetricsSnapshot(): MetricsSnapshot {
  const dashMetrics = useDashboardMetrics()
  const { metrics: fireMetrics } = useFireCalculations()
  const { profile } = useHouseholdRuntimeInputs()

  const fireNumber = dashMetrics.showProjectionNumber
    ? (dashMetrics.projectionFireNumber ?? dashMetrics.fireNumber)
    : dashMetrics.fireNumber

  return {
    fireAge: dashMetrics.fireAge,
    fireNumber,
    drivers: fireMetrics ? {
      annualIncome: profile.annualIncome,
      annualExpenses: fireMetrics.expensesBreakdown.effectiveExpenses,
      annualSavings: fireMetrics.annualSavings,
      savingsRate: fireMetrics.savingsRate,
      totalNetWorth: fireMetrics.totalNetWorth,
      swr: profile.swr,
      monthlyDebtPayments: ((profile.annualNonMortgageDebtPayment ?? 0) / 12) + (profile.existingMonthlyPayment ?? 0),
    } : undefined,
  }
}
