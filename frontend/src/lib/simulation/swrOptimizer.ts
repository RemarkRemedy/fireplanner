/**
 * SWR optimizer: binary search for maximum safe withdrawal rate
 * at a given target confidence level.
 *
 * TypeScript port of backend/app/core/swr_optimizer.py.
 *
 * Wraps the Monte Carlo engine in a binary search loop to find the highest
 * SWR that still meets the caller's target success rate.
 */

import { runMonteCarlo, type MonteCarloEngineParams } from './monteCarlo'

// BaseParams excludes nSimulations and seed because optimizeSwr controls those.
export type SwrBaseParams = Omit<MonteCarloEngineParams, 'nSimulations' | 'seed'>

export interface OptimizeSwrOptions {
  /** Number of MC simulations per iteration (default: 2000; use 500 for speed in tests). */
  nSims?: number
  /** Fixed RNG seed for determinism (default: 12345, matching Python port). */
  seed?: number
  /** Tolerance for convergence — stop when high - low < tolerance (default: 0.001). */
  tolerance?: number
  /** Maximum binary search iterations (default: 15). */
  maxIterations?: number
  /** Lower bound of SWR search range (default: 0.02). */
  swrMin?: number
  /** Upper bound of SWR search range (default: 0.08). */
  swrMax?: number
}

/**
 * Find the maximum safe withdrawal rate at a given confidence level via binary search.
 *
 * @param targetSuccess - Required success rate (e.g. 0.90 for 90%).
 * @param baseParams    - MC engine params (without nSimulations / seed).
 * @param options       - Optional overrides for nSims, seed, tolerance, bounds, etc.
 * @returns The optimal SWR rounded to 3 decimal places.
 */
export function optimizeSwr(
  targetSuccess: number,
  baseParams: SwrBaseParams,
  options: OptimizeSwrOptions = {},
): number {
  const {
    nSims = 2000,
    seed = 12345,
    tolerance = 0.001,
    maxIterations = 15,
    swrMin = 0.02,
    swrMax = 0.08,
  } = options

  let low = swrMin
  let high = swrMax

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2

    // Inject the candidate SWR into strategy-specific param name
    const sp = { ...baseParams.strategyParams }
    const strategy = baseParams.withdrawalStrategy

    if (strategy === 'constant_dollar') {
      sp['swr'] = mid
    } else if (strategy === 'vanguard_dynamic') {
      sp['swr'] = mid
    } else if (strategy === 'guardrails') {
      sp['initialRate'] = mid
    } else if (strategy === 'floor_ceiling') {
      sp['targetRate'] = mid
    } else if (strategy === 'cape_based') {
      sp['baseRate'] = mid
    } else {
      // vpw and any unknown strategy fall through to swr
      sp['swr'] = mid
    }

    // Strip annualExpensesAtRetirement so the optimizer can vary withdrawal
    // rate via strategyParams. If expenses were passed through, every
    // iteration would compute the same fixed withdrawal regardless of SWR.
    // Also strip extractPaths to avoid ~45x redundant path extractions during binary search.
    const { annualExpensesAtRetirement: _, extractPaths: __, ...restBaseParams } = baseParams
    const params: MonteCarloEngineParams = {
      ...restBaseParams,
      strategyParams: sp,
      nSimulations: nSims,
      seed,
    }

    const result = runMonteCarlo(params)
    const successRate = result.success_rate

    if (successRate >= targetSuccess) {
      // Current rate is safe enough — try higher
      low = mid
    } else {
      // Too aggressive — tighten upper bound
      high = mid
    }

    if (high - low < tolerance) {
      break
    }
  }

  return parseFloat(((low + high) / 2).toFixed(3))
}
