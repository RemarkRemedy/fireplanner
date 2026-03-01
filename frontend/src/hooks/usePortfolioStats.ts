import { useMemo } from 'react'
import type { PortfolioStats } from '@/lib/types'
import { calculatePortfolioStats, getGlidePathAllocations, getEffectiveReturns, getEffectiveStdDevs } from '@/lib/calculations/portfolio'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { validateAllocationCrossStoreRules } from '@/lib/validation/rules'
import { CORRELATION_MATRIX } from '@/lib/data/historicalReturns'

interface PortfolioStatsResult {
  currentStats: PortfolioStats | null
  targetStats: PortfolioStats | null
  glidePathAllocations: { age: number; weights: number[] }[]
  hasErrors: boolean
  errors: Record<string, string>
}

/**
 * Derived hook: reads profile + allocation stores, checks validation,
 * computes portfolio stats for current and target allocations.
 * When glide path is enabled, generates year-by-year allocation schedule.
 */
export function usePortfolioStats(): PortfolioStatsResult {
  const profile = useProfileStore()
  const allocation = useAllocationStore()

  return useMemo(() => {
    const profileErrors = profile.validationErrors
    const allocationErrors = allocation.validationErrors
    const crossErrors = validateAllocationCrossStoreRules(
      { currentAge: profile.currentAge, lifeExpectancy: profile.lifeExpectancy },
      { glidePathConfig: allocation.glidePathConfig, targetWeights: allocation.targetWeights }
    )
    const allErrors = { ...profileErrors, ...allocationErrors, ...crossErrors }

    if (Object.keys(allErrors).length > 0) {
      return {
        currentStats: null,
        targetStats: null,
        glidePathAllocations: [],
        hasErrors: true,
        errors: allErrors,
      }
    }

    // Effective returns and stdDevs (use overrides where set)
    const effectiveReturns = getEffectiveReturns(allocation.returnOverrides)
    const effectiveStdDevs = getEffectiveStdDevs(allocation.stdDevOverrides)

    const statsParams = {
      returns: effectiveReturns,
      stdDevs: effectiveStdDevs,
      correlations: CORRELATION_MATRIX,
      inflation: profile.inflation,
      expenseRatio: profile.expenseRatio,
    }

    const currentStats = calculatePortfolioStats({
      weights: allocation.currentWeights,
      ...statsParams,
    })

    const targetStats = calculatePortfolioStats({
      weights: allocation.targetWeights,
      ...statsParams,
    })

    const glidePathAllocations = allocation.glidePathConfig.enabled
      ? getGlidePathAllocations(
          allocation.glidePathConfig,
          allocation.currentWeights,
          allocation.targetWeights
        )
      : []

    return {
      currentStats,
      targetStats,
      glidePathAllocations,
      hasErrors: false,
      errors: {},
    }
  }, [
    profile.currentAge,
    profile.lifeExpectancy,
    profile.inflation,
    profile.expenseRatio,
    profile.validationErrors,
    allocation.currentWeights,
    allocation.targetWeights,
    allocation.returnOverrides,
    allocation.stdDevOverrides,
    allocation.glidePathConfig,
    allocation.validationErrors,
  ])
}
