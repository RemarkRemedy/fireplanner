import { useState, useMemo } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useProjection } from '@/hooks/useProjection'
import { formatCurrency } from '@/lib/utils'
import { interpolateGlidePath } from '@/lib/calculations/portfolio'

export type ExploreBalanceMode = 'myPlan' | 'fireTarget'

interface ExplorePortfolioResult {
  balanceMode: ExploreBalanceMode
  setBalanceMode: (mode: ExploreBalanceMode) => void
  initialPortfolio: number
  allocationWeights: number[]
  startAge: number
  label: string
}

/**
 * Local state hook for the Explore page's starting-balance toggle.
 * NOT persisted — resets to 'myPlan' on page load.
 *
 * - myPlan: deterministically projected NW at retirementAge, starts MC at retirementAge
 * - fireTarget: FIRE number at fireAge, starts MC at fireAge
 */
export function useExplorePortfolio(): ExplorePortfolioResult {
  const [balanceMode, setBalanceMode] = useState<ExploreBalanceMode>('myPlan')
  const profile = useProfileStore()
  const allocation = useAllocationStore()
  const { metrics } = useFireCalculations()
  const { rows } = useProjection()

  return useMemo(() => {
    const currentYear = new Date().getFullYear()

    if (balanceMode === 'fireTarget') {
      const fireNumber = metrics?.fireNumber ?? 0
      const rawFireAge = metrics?.fireAge ?? profile.retirementAge
      const fireAge = isFinite(rawFireAge)
        ? Math.min(profile.lifeExpectancy, Math.max(profile.currentAge, Math.round(rawFireAge)))
        : profile.retirementAge

      const dollarYear = currentYear + (fireAge - profile.currentAge)
      const weights = getWeightsAtStartAge(
        fireAge, allocation.glidePathConfig, allocation.currentWeights, allocation.targetWeights,
      )

      return {
        balanceMode,
        setBalanceMode,
        initialPortfolio: fireNumber,
        allocationWeights: weights,
        startAge: fireAge,
        label: `FIRE Target: ${formatCurrency(fireNumber)} at age ${fireAge} (${dollarYear}$)`,
      }
    }

    // myPlan: projected NW at retirement age
    const retirementRow = rows?.find(r => r.age === profile.retirementAge)
    const projectedNW = retirementRow?.liquidNW ?? 0
    const dollarYear = currentYear + (profile.retirementAge - profile.currentAge)
    const weights = getWeightsAtStartAge(
      profile.retirementAge, allocation.glidePathConfig, allocation.currentWeights, allocation.targetWeights,
    )

    return {
      balanceMode,
      setBalanceMode,
      initialPortfolio: projectedNW,
      allocationWeights: weights,
      startAge: profile.retirementAge,
      label: `My Plan: ${formatCurrency(projectedNW)} at age ${profile.retirementAge} (${dollarYear}$)`,
    }
  }, [
    balanceMode, setBalanceMode, profile.retirementAge, profile.currentAge, profile.lifeExpectancy,
    allocation.currentWeights, allocation.targetWeights, allocation.glidePathConfig, metrics, rows,
  ])
}

/**
 * Get allocation weights at the Explore page's start age, respecting glide path.
 * If glide path is enabled and startAge falls within range, interpolate.
 * If startAge is past the end age, use target weights.
 * Otherwise return current weights.
 */
function getWeightsAtStartAge(
  startAge: number,
  glidePathConfig: { enabled: boolean; startAge: number; endAge: number; method: 'linear' | 'slowStart' | 'fastStart' },
  currentWeights: number[],
  targetWeights: number[],
): number[] {
  if (!glidePathConfig.enabled) return currentWeights

  const { startAge: gpStart, endAge: gpEnd, method } = glidePathConfig
  if (startAge < gpStart) return currentWeights
  if (startAge >= gpEnd) return targetWeights

  const duration = gpEnd - gpStart
  if (duration <= 0) return currentWeights

  const progress = (startAge - gpStart) / duration
  return interpolateGlidePath(currentWeights, targetWeights, progress, method)
}
