import { useMemo } from 'react'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useProjection } from '@/hooks/useProjection'
import { computeGuardrailStatus, type GuardrailStatus } from '@/lib/calculations/guardrailStatus'

/**
 * Derived hook: computes guardrail status only when the guardrails
 * withdrawal strategy is selected. Returns null otherwise.
 *
 * Uses the projection's first retirement-year row for portfolio value
 * and withdrawal amount (NOT stale liquidNetWorth from profile store).
 */
export function useGuardrailStatus(): GuardrailStatus | null {
  const selectedStrategy = useSimulationStore((s) => s.selectedStrategy)
  const strategyParams = useSimulationStore((s) => s.strategyParams)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const { rows } = useProjection()

  return useMemo(() => {
    if (selectedStrategy !== 'guardrails') return null
    if (!rows || rows.length === 0) return null

    // Find the first retirement row with a positive portfolio
    const retirementRow = rows.find((r) => r.isRetired && r.liquidNW > 0)
    if (!retirementRow) return null

    // Use the withdrawal amount from the first retirement year
    // savingsOrWithdrawal is negative during retirement (withdrawal)
    const annualWithdrawal = Math.abs(retirementRow.savingsOrWithdrawal)
    if (annualWithdrawal <= 0) return null

    const params = strategyParams.guardrails
    return computeGuardrailStatus({
      portfolioValue: retirementRow.liquidNW,
      annualWithdrawal,
      initialRate: params.initialRate ?? 0.05,
      ceilingTrigger: params.ceilingTrigger ?? 1.20,
      floorTrigger: params.floorTrigger ?? 0.80,
      adjustmentSize: params.adjustmentSize ?? 0.10,
    })
  }, [selectedStrategy, strategyParams, rows, retirementAge])
}
