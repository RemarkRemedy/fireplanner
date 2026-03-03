/**
 * Monte Carlo simulation engine for retirement planning.
 * TypeScript port of backend/app/core/monte_carlo.py.
 *
 * Supports 3 methods: parametric (Cholesky), historical bootstrap, fat-tail (Student-t df=5).
 * Two-phase simulation: accumulation + decumulation.
 *
 * Formulas from FIRE_PLANNER_MASTER_PLAN_v2.md Section 6.
 */

import { SeededRNG } from '@/lib/math/random.ts'
import { choleskyDecomposition, buildCovarianceMatrix, dot } from '@/lib/math/linalg.ts'
import { percentile, studentTQuantile } from '@/lib/math/stats.ts'
import {
  computeWithdrawal,
} from '@/lib/calculations/withdrawal.ts'
import {
  HISTORICAL_RETURNS,
  ASSET_KEY_TO_COLUMN,
  type HistoricalReturnRow,
} from '@/lib/data/historicalReturnsFull.ts'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns.ts'
import type { MonteCarloResult, PercentileBands, TerminalStats, FailureDistribution, SpendingMetrics, HistogramBucket, HistogramSnapshot, RetirementMitigationConfig, RepresentativePath } from '@/lib/types.ts'

// ============================================================
// Types
// ============================================================

export interface MonteCarloEngineParams {
  initialPortfolio: number
  allocationWeights: number[]       // 8 weights summing to 1
  expectedReturns: number[]         // 8 nominal returns
  stdDevs: number[]                 // 8 standard deviations
  correlationMatrix: number[][]     // 8x8
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  annualSavings: number[]           // one per accumulation year
  postRetirementIncome: number[]    // one per decumulation year
  method: 'parametric' | 'bootstrap' | 'fat_tail'
  nSimulations: number
  seed?: number
  withdrawalStrategy: string
  strategyParams: Record<string, number>
  expenseRatio: number
  inflation: number
  portfolioAdjustments?: { year: number; amount: number }[]  // sparse one-time equity injections
  retirementMitigation?: RetirementMitigationConfig
  annualExpensesAtRetirement?: number  // needed to compute bucket target
  withdrawalBasis: 'expenses' | 'rate'
  extractPaths?: boolean  // when true, extract representative paths for projection replay
  deterministicAccumulation?: boolean  // when true, use expected return during accumulation (all sims get identical pre-retirement path)
  yearlyWeights?: number[][]  // per-year allocation weights for glide path (nTotalYears × 8, covering accum + decum)
}

export type MonteCarloEngineResult = Omit<
  MonteCarloResult,
  'safe_swr' | 'n_simulations' | 'computation_time_ms' | 'cached'
>

// ============================================================
// Helpers
// ============================================================

/**
 * Resolve the effective initial withdrawal rate from strategy params.
 * Checks swr, initialRate/initial_rate, targetRate/target_rate in priority order.
 */
export function resolveInitialRate(
  strategyParams: Record<string, number>,
  defaultRate: number = 0.04,
): number {
  return (
    strategyParams.swr
    ?? strategyParams.initialRate
    ?? strategyParams.initial_rate
    ?? strategyParams.targetRate
    ?? strategyParams.target_rate
    ?? defaultRate
  )
}

// ============================================================
// Return Generation Methods
// ============================================================

/**
 * Generate portfolio returns via Cholesky decomposition of multivariate normal.
 * Returns a 2D array [nSims][nYears] of portfolio-level returns.
 *
 * Exported for reuse by sequence risk engine (Task 5).
 */
export function generateReturnsParametric(
  rng: SeededRNG,
  nSims: number,
  nYears: number,
  weights: number[],
  expectedReturns: number[],
  stdDevs: number[],
  correlationMatrix: number[][],
  precomputedL?: number[][],
): number[][] {
  const nAssets = weights.length
  const L = precomputedL ?? choleskyDecomposition(buildCovarianceMatrix(stdDevs, correlationMatrix))

  // Transpose L to get L^T
  const LT: number[][] = Array.from({ length: nAssets }, (_, i) =>
    Array.from({ length: nAssets }, (_, j) => L[j][i])
  )

  const portfolioReturns: number[][] = Array.from({ length: nSims }, () =>
    new Array(nYears)
  )

  for (let s = 0; s < nSims; s++) {
    for (let y = 0; y < nYears; y++) {
      // Generate standard normal vector Z of length nAssets
      const Z = rng.nextGaussianArray(nAssets)

      // Correlated returns: assetReturns = Z * L^T + expectedReturns
      // Then portfolio return = dot(assetReturns, weights)
      let portReturn = 0
      for (let a = 0; a < nAssets; a++) {
        // assetReturn[a] = sum(Z[k] * LT[k][a]) + expectedReturns[a]
        let assetReturn = expectedReturns[a]
        for (let k = 0; k < nAssets; k++) {
          assetReturn += Z[k] * LT[k][a]
        }
        portReturn += assetReturn * weights[a]
      }
      portfolioReturns[s][y] = portReturn
    }
  }

  return portfolioReturns
}

/**
 * Generate per-asset correlated returns via Cholesky decomposition.
 * Returns a 3D array [nSims][nYears][nAssets] of per-asset returns.
 * Used by engines with glide path support that need to apply per-year weights.
 */
export function generateAssetReturnsParametric(
  rng: SeededRNG,
  nSims: number,
  nYears: number,
  expectedReturns: number[],
  stdDevs: number[],
  correlationMatrix: number[][],
  precomputedL?: number[][],
): number[][][] {
  const nAssets = expectedReturns.length
  const L = precomputedL ?? choleskyDecomposition(buildCovarianceMatrix(stdDevs, correlationMatrix))

  // Transpose L to get L^T
  const LT: number[][] = Array.from({ length: nAssets }, (_, i) =>
    Array.from({ length: nAssets }, (_, j) => L[j][i])
  )

  const assetReturns: number[][][] = Array.from({ length: nSims }, () =>
    Array.from({ length: nYears }, () => new Array(nAssets))
  )

  for (let s = 0; s < nSims; s++) {
    for (let y = 0; y < nYears; y++) {
      const Z = rng.nextGaussianArray(nAssets)
      for (let a = 0; a < nAssets; a++) {
        let ret = expectedReturns[a]
        for (let k = 0; k < nAssets; k++) {
          ret += Z[k] * LT[k][a]
        }
        assetReturns[s][y][a] = ret
      }
    }
  }

  return assetReturns
}

/**
 * Generate portfolio returns by bootstrap sampling from historical data.
 * Falls back to parametric if insufficient historical data.
 */
function generateReturnsBootstrap(
  rng: SeededRNG,
  nSims: number,
  nYears: number,
  weights: number[],
  expectedReturns: number[],
  stdDevs: number[],
  correlationMatrix: number[][],
): number[][] {
  // Build the historical returns matrix: rows of [asset1, asset2, ...] for complete rows
  const assetKeys = ASSET_CLASSES.map((ac) => ac.key)
  const columnNames = assetKeys.map((key) => ASSET_KEY_TO_COLUMN[key])

  // Filter to rows where all 8 asset classes have data (non-null)
  const completeRows: number[][] = []
  for (const row of HISTORICAL_RETURNS) {
    const vals: number[] = []
    let allPresent = true
    for (const col of columnNames) {
      const v = row[col as keyof HistoricalReturnRow]
      if (v === null || v === undefined || typeof v !== 'number') {
        allPresent = false
        break
      }
      vals.push(v)
    }
    if (allPresent) {
      completeRows.push(vals)
    }
  }

  if (completeRows.length === 0) {
    // Fallback to parametric
    return generateReturnsParametric(
      rng, nSims, nYears, weights, expectedReturns, stdDevs, correlationMatrix,
    )
  }

  const nHistorical = completeRows.length
  const portfolioReturns: number[][] = Array.from({ length: nSims }, () =>
    new Array(nYears)
  )

  for (let s = 0; s < nSims; s++) {
    for (let y = 0; y < nYears; y++) {
      const idx = rng.nextInt(nHistorical)
      const assetReturns = completeRows[idx]
      portfolioReturns[s][y] = dot(assetReturns, weights)
    }
  }

  return portfolioReturns
}

/**
 * Generate per-asset returns by bootstrap sampling from historical data.
 * Returns a 3D array [nSims][nYears][nAssets] for glide path support.
 * Falls back to parametric asset returns if insufficient historical data.
 */
function generateAssetReturnsBootstrap(
  rng: SeededRNG,
  nSims: number,
  nYears: number,
  expectedReturns: number[],
  stdDevs: number[],
  correlationMatrix: number[][],
): number[][][] {
  const assetKeys = ASSET_CLASSES.map((ac) => ac.key)
  const columnNames = assetKeys.map((key) => ASSET_KEY_TO_COLUMN[key])

  const completeRows: number[][] = []
  for (const row of HISTORICAL_RETURNS) {
    const vals: number[] = []
    let allPresent = true
    for (const col of columnNames) {
      const v = row[col as keyof HistoricalReturnRow]
      if (v === null || v === undefined || typeof v !== 'number') {
        allPresent = false
        break
      }
      vals.push(v)
    }
    if (allPresent) {
      completeRows.push(vals)
    }
  }

  if (completeRows.length === 0) {
    return generateAssetReturnsParametric(
      rng, nSims, nYears, expectedReturns, stdDevs, correlationMatrix,
    )
  }

  const nHistorical = completeRows.length
  const nAssets = assetKeys.length
  const assetReturns: number[][][] = Array.from({ length: nSims }, () =>
    Array.from({ length: nYears }, () => new Array(nAssets))
  )

  for (let s = 0; s < nSims; s++) {
    for (let y = 0; y < nYears; y++) {
      const idx = rng.nextInt(nHistorical)
      for (let a = 0; a < nAssets; a++) {
        assetReturns[s][y][a] = completeRows[idx][a]
      }
    }
  }

  return assetReturns
}

/**
 * Generate portfolio returns using Student-t distribution (df=5) for fat tails.
 * Portfolio-level returns (univariate), not per-asset.
 */
function generateReturnsFatTail(
  rng: SeededRNG,
  nSims: number,
  nYears: number,
  weights: number[],
  expectedReturns: number[],
  stdDevs: number[],
): number[][] {
  // Portfolio-level moments
  const portReturn = dot(weights, expectedReturns)
  // Portfolio variance = w^T * diag(sigma^2) * w (simplified: no correlation in fat-tail)
  let portVar = 0
  for (let i = 0; i < weights.length; i++) {
    portVar += weights[i] * weights[i] * stdDevs[i] * stdDevs[i]
  }
  const portStd = Math.sqrt(portVar)

  // Student-t: variance = df/(df-2), scale to get unit variance
  const df = 5
  const scaleFactor = Math.sqrt(df / (df - 2))

  const portfolioReturns: number[][] = Array.from({ length: nSims }, () =>
    new Array(nYears)
  )

  for (let s = 0; s < nSims; s++) {
    for (let y = 0; y < nYears; y++) {
      // Generate Student-t variate via inverse CDF transform
      const u = rng.next()
      // Clamp u away from 0 and 1 to avoid infinities
      const uClamped = Math.min(Math.max(u, 1e-10), 1 - 1e-10)
      const tVal = studentTQuantile(uClamped, df)
      portfolioReturns[s][y] = portReturn + portStd * tVal / scaleFactor
    }
  }

  return portfolioReturns
}

// ============================================================
// Withdrawal Dispatch
// ============================================================

/**
 * Compute withdrawal amount for a single simulation at a given decumulation year.
 * Thin wrapper around the shared `computeWithdrawal` dispatch.
 *
 * Exported for reuse by sequence risk engine.
 */
export function computeWithdrawalsForYear(
  strategy: string,
  portfolio: number,
  year: number,
  nYearsDecum: number,
  initialWithdrawal: number,
  prevWithdrawal: number,
  inflation: number,
  strategyParams: Record<string, number>,
  prevYearReturn: number | undefined,
  prevYearGains?: number,
): number {
  return computeWithdrawal(strategy, {
    portfolio,
    year,
    remainingYears: nYearsDecum - year,
    initialWithdrawal,
    prevWithdrawal,
    inflation,
    strategyParams,
    prevYearReturn,
    prevYearGains,
  })
}

// ============================================================
// Main Simulation
// ============================================================

/**
 * Run Monte Carlo retirement simulation.
 *
 * Two-phase simulation: accumulation (savings phase) and decumulation (withdrawal phase).
 * Returns success_rate, percentile_bands, terminal_stats, and failure_distribution
 * with snake_case keys matching the MonteCarloResult type.
 *
 * Exported for reuse by the web worker (Task 6) and sequence risk engine (Task 5).
 */
export function runMonteCarlo(params: MonteCarloEngineParams): MonteCarloEngineResult {
  const {
    initialPortfolio,
    allocationWeights: weights,
    expectedReturns,
    stdDevs,
    correlationMatrix,
    currentAge,
    retirementAge,
    lifeExpectancy,
    annualSavings,
    postRetirementIncome,
    method,
    nSimulations: nSims,
    seed,
    withdrawalStrategy: strategy,
    strategyParams,
    expenseRatio,
    inflation,
  } = params

  const retirementMitigation = params.retirementMitigation ?? { type: 'none' as const }
  const annualExpensesAtRetirement = params.annualExpensesAtRetirement ?? 0
  const deterministicAccumulation = params.deterministicAccumulation ?? false

  // Weighted-average expected portfolio return (used when deterministicAccumulation is true)
  // When yearlyWeights (glide path) is present, per-year expected returns are pre-computed below
  // after nYearsTotal is known.
  const expectedPortfolioReturn = deterministicAccumulation
    ? weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0)
    : 0  // unused when stochastic

  const rng = new SeededRNG(seed ?? 42)

  const nYearsAccum = Math.max(0, retirementAge - currentAge)
  const nYearsDecum = Math.max(1, lifeExpectancy - retirementAge)
  const nYearsTotal = nYearsAccum + nYearsDecum

  // Build dense adjustments array from sparse portfolio adjustments
  const adjustments = new Array(nYearsTotal).fill(0)
  for (const adj of params.portfolioAdjustments ?? []) {
    if (adj.year >= 0 && adj.year < nYearsTotal) {
      adjustments[adj.year] += adj.amount
    }
  }

  // Generate portfolio returns: [nSims][nYearsTotal]
  // When yearlyWeights is present (glide path) and method supports per-asset returns,
  // generate per-asset returns first then apply per-year weights.
  // Fat-tail is univariate (portfolio-level) and cannot support glide path — uses fixed weights.
  const yw = params.yearlyWeights
  let portfolioReturns: number[][]

  if (yw && method !== 'fat_tail') {
    // Glide path: generate per-asset returns and apply per-year weights
    let assetReturns: number[][][]
    switch (method) {
      case 'parametric':
        assetReturns = generateAssetReturnsParametric(
          rng, nSims, nYearsTotal, expectedReturns, stdDevs, correlationMatrix,
        )
        break
      case 'bootstrap':
        assetReturns = generateAssetReturnsBootstrap(
          rng, nSims, nYearsTotal, expectedReturns, stdDevs, correlationMatrix,
        )
        break
      default:
        throw new Error(`Unknown method: ${method}`)
    }

    portfolioReturns = Array.from({ length: nSims }, (_, s) =>
      Array.from({ length: nYearsTotal }, (_, t) => {
        const w = t < yw.length ? yw[t] : yw[yw.length - 1]
        return dot(assetReturns[s][t], w)
      })
    )
  } else {
    // No glide path (or fat-tail): use fixed weights
    switch (method) {
      case 'parametric':
        portfolioReturns = generateReturnsParametric(
          rng, nSims, nYearsTotal, weights, expectedReturns, stdDevs, correlationMatrix,
        )
        break
      case 'bootstrap':
        portfolioReturns = generateReturnsBootstrap(
          rng, nSims, nYearsTotal, weights, expectedReturns, stdDevs, correlationMatrix,
        )
        break
      case 'fat_tail':
        portfolioReturns = generateReturnsFatTail(
          rng, nSims, nYearsTotal, weights, expectedReturns, stdDevs,
        )
        break
      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }

  // Per-year expected returns for deterministic accumulation with glide path
  const yearlyExpectedReturns: number[] | null = (deterministicAccumulation && yw)
    ? Array.from({ length: nYearsTotal }, (_, t) => {
        const w = t < yw.length ? yw[t] : yw[yw.length - 1]
        return w.reduce((sum, wt, i) => sum + wt * expectedReturns[i], 0)
      })
    : null

  // Simulate paths: balances[sim][year] — (nYearsTotal + 1) entries per sim
  const balances: number[][] = Array.from({ length: nSims }, () => {
    const arr = new Array(nYearsTotal + 1).fill(0)
    arr[0] = initialPortfolio
    return arr
  })

  const failed: boolean[] = new Array(nSims).fill(false)
  const failureYear: number[] = new Array(nSims).fill(nYearsTotal)
  const prevWithdrawals: number[] = new Array(nSims).fill(0)
  // Track previous balance for sensible_withdrawals gain calculation
  const prevBalances: number[] = new Array(nSims).fill(initialPortfolio)

  const swr = resolveInitialRate(strategyParams)
  let initialWithdrawalAmount = 0

  // Withdrawal tracking for percentile bands (reuse buffer each year)
  const withdrawalCol: number[] = new Array(nSims).fill(0)
  // Per-sim withdrawal history for spending metrics (~3MB for 10K sims x 30-40 years)
  const allNetWithdrawals: number[][] = Array.from({ length: nSims }, () => [])
  const wb_years: number[] = []
  const wb_ages: number[] = []
  const wb_p5: number[] = []
  const wb_p10: number[] = []
  const wb_p25: number[] = []
  const wb_p50: number[] = []
  const wb_p75: number[] = []
  const wb_p90: number[] = []
  const wb_p95: number[] = []

  // Retirement cash bucket state (one scalar per sim)
  const cashBuckets = new Float64Array(nSims)      // current bucket balance
  const cashBucketTargets = new Float64Array(nSims) // target bucket size

  for (let t = 0; t < nYearsTotal; t++) {
    if (t < nYearsAccum) {
      // ACCUMULATION: add savings, grow portfolio
      const savings = t < annualSavings.length ? annualSavings[t] : 0
      for (let s = 0; s < nSims; s++) {
        const adjustedBalance = balances[s][t] + adjustments[t]
        const returnRate = deterministicAccumulation
          ? (yearlyExpectedReturns ? yearlyExpectedReturns[t] : expectedPortfolioReturn)
          : portfolioReturns[s][t]
        balances[s][t + 1] =
          adjustedBalance * (1 + returnRate - expenseRatio) + savings
      }
    } else {
      // DECUMULATION: subtract withdrawals
      const decumYear = t - nYearsAccum

      if (decumYear === 0) {
        // Use user's actual retirement expenses when available and withdrawalBasis is 'expenses';
        // fall back to portfolio × SWR rate when no expenses are specified OR when the user
        // has explicitly chosen rate-driven withdrawal (withdrawalBasis === 'rate').
        // This matches the deterministic comparison logic in withdrawal.ts.
        if (annualExpensesAtRetirement > 0 && params.withdrawalBasis !== 'rate') {
          initialWithdrawalAmount = annualExpensesAtRetirement
        } else {
          const retirementBalances = balances.map((b) => b[t])
          const medianBalance = percentile(retirementBalances, 50)
          initialWithdrawalAmount = medianBalance * swr
        }
      }

      // Initialize retirement cash bucket
      if (decumYear === 0 && retirementMitigation.type === 'cash_bucket') {
        const bucketTarget = (annualExpensesAtRetirement / 12) * retirementMitigation.targetMonths
        for (let s = 0; s < nSims; s++) {
          const available = Math.min(bucketTarget, balances[s][t])
          cashBuckets[s] = available
          balances[s][t] -= available
          cashBucketTargets[s] = bucketTarget
        }
      }

      for (let s = 0; s < nSims; s++) {
        const currentBalance = balances[s][t] + adjustments[t]

        // Previous year return for Guyton-Klinger PMR
        const prevYearReturn = decumYear > 0
          ? portfolioReturns[s][t - 1]
          : undefined

        // Previous year gains for sensible_withdrawals
        const prevYearGains = decumYear > 0
          ? currentBalance - prevBalances[s] + prevWithdrawals[s]
          : 0

        const withdrawal = computeWithdrawalsForYear(
          strategy,
          currentBalance,
          decumYear,
          nYearsDecum,
          initialWithdrawalAmount,
          prevWithdrawals[s],
          inflation,
          strategyParams,
          prevYearReturn,
          prevYearGains,
        )

        // Subtract post-retirement income
        const income = decumYear < postRetirementIncome.length
          ? postRetirementIncome[decumYear]
          : 0
        let netWithdrawal = Math.max(0, withdrawal - income)

        // Don't withdraw more than total available liquidity
        const totalLiquidity = retirementMitigation.type === 'cash_bucket'
          ? currentBalance + cashBuckets[s]
          : currentBalance
        netWithdrawal = Math.min(netWithdrawal, totalLiquidity)

        prevWithdrawals[s] = withdrawal
        prevBalances[s] = currentBalance

        // Track net withdrawal (what actually leaves the portfolio)
        withdrawalCol[s] = netWithdrawal
        allNetWithdrawals[s].push(netWithdrawal)

        if (retirementMitigation.type === 'cash_bucket' && cashBuckets[s] > 0) {
          // Draw withdrawal from cash bucket first
          const fromBucket = Math.min(netWithdrawal, cashBuckets[s])
          const fromPortfolio = netWithdrawal - fromBucket
          cashBuckets[s] = (cashBuckets[s] - fromBucket) * (1 + retirementMitigation.cashReturn)

          balances[s][t + 1] =
            (currentBalance - fromPortfolio) * (1 + portfolioReturns[s][t] - expenseRatio)

          // Refill bucket in positive-return years
          if (portfolioReturns[s][t] > 0 && balances[s][t + 1] > 0) {
            const shortfall = Math.max(0, cashBucketTargets[s] - cashBuckets[s])
            const refillCap = balances[s][t + 1] * 0.10
            const refill = Math.min(shortfall, refillCap)
            cashBuckets[s] += refill
            balances[s][t + 1] -= refill
          }
        } else {
          // Default: withdraw directly from portfolio (existing behavior)
          balances[s][t + 1] =
            (currentBalance - netWithdrawal) * (1 + portfolioReturns[s][t] - expenseRatio)
        }

        // Check for failure
        if (balances[s][t + 1] <= 0 && !failed[s]) {
          failed[s] = true
          failureYear[s] = decumYear
        }
        // Clamp to 0
        if (balances[s][t + 1] < 0) {
          balances[s][t + 1] = 0
        }
      }

      // Record withdrawal percentiles for this decumulation year
      wb_years.push(decumYear)
      wb_ages.push(retirementAge + decumYear)
      wb_p5.push(percentile(withdrawalCol, 5))
      wb_p10.push(percentile(withdrawalCol, 10))
      wb_p25.push(percentile(withdrawalCol, 25))
      wb_p50.push(percentile(withdrawalCol, 50))
      wb_p75.push(percentile(withdrawalCol, 75))
      wb_p90.push(percentile(withdrawalCol, 90))
      wb_p95.push(percentile(withdrawalCol, 95))
    }
  }

  // ---- Compute outputs ----

  // Success rate
  const nFailed = failed.filter(Boolean).length
  const successRate = 1 - nFailed / nSims

  // Percentile bands — compute percentile across simulations at each time point
  const nPoints = nYearsTotal + 1
  const years: number[] = []
  const ages: number[] = []
  const p5: number[] = []
  const p10: number[] = []
  const p25: number[] = []
  const p50: number[] = []
  const p75: number[] = []
  const p90: number[] = []
  const p95: number[] = []

  for (let y = 0; y < nPoints; y++) {
    years.push(y)
    ages.push(currentAge + y)

    // Collect all sim balances at this year
    const col: number[] = new Array(nSims)
    for (let s = 0; s < nSims; s++) {
      col[s] = balances[s][y]
    }

    p5.push(percentile(col, 5))
    p10.push(percentile(col, 10))
    p25.push(percentile(col, 25))
    p50.push(percentile(col, 50))
    p75.push(percentile(col, 75))
    p90.push(percentile(col, 90))
    p95.push(percentile(col, 95))
  }

  const percentileBands: PercentileBands = {
    years, ages, p5, p10, p25, p50, p75, p90, p95,
  }

  // Terminal stats
  const terminals: number[] = new Array(nSims)
  for (let s = 0; s < nSims; s++) {
    terminals[s] = balances[s][nYearsTotal]
  }
  const sortedTerminals = [...terminals].sort((a, b) => a - b)

  const terminalStats: TerminalStats = {
    median: percentile(terminals, 50),
    mean: terminals.reduce((a, b) => a + b, 0) / nSims,
    worst: sortedTerminals[0],
    best: sortedTerminals[nSims - 1],
    p5: percentile(terminals, 5),
    p95: percentile(terminals, 95),
  }

  // Failure distribution by decade of retirement
  const failedYears: number[] = []
  for (let s = 0; s < nSims; s++) {
    if (failed[s]) {
      failedYears.push(failureYear[s])
    }
  }

  const decades: [number, number][] = [[0, 10], [10, 20], [20, 30], [30, 40], [40, 50]]
  const bucketLabels: string[] = []
  const bucketCounts: number[] = []
  for (const [start, end] of decades) {
    if (start >= nYearsDecum) break
    const label = `Year ${start + 1}-${Math.min(end, nYearsDecum)}`
    let count = 0
    for (const fy of failedYears) {
      if (fy >= start && fy < end) count++
    }
    bucketLabels.push(label)
    bucketCounts.push(count)
  }

  const failureDistribution: FailureDistribution = {
    buckets: bucketLabels,
    counts: bucketCounts,
    total_failures: failedYears.length,
  }

  const withdrawalBands: PercentileBands = {
    years: wb_years, ages: wb_ages,
    p5: wb_p5, p10: wb_p10, p25: wb_p25, p50: wb_p50,
    p75: wb_p75, p90: wb_p90, p95: wb_p95,
  }

  // ---- Spending metrics ----
  let volatileCount = 0
  let smallSpendCount = 0
  let largeEndCount = 0
  let smallEndCount = 0

  for (let s = 0; s < nSims; s++) {
    const ws = allNetWithdrawals[s]
    // Volatile: any year with >25% YoY change
    for (let y = 1; y < ws.length; y++) {
      if (ws[y - 1] > 0 && Math.abs(ws[y] - ws[y - 1]) / ws[y - 1] > 0.25) {
        volatileCount++
        break
      }
    }
    // Small spending: any year < 50% of first year
    const firstW = ws[0] || 0
    if (firstW > 0 && ws.some(w => w < firstW * 0.5)) smallSpendCount++
    // Large end portfolio: > 200% initial
    if (terminals[s] > initialPortfolio * 2) largeEndCount++
    // Small end portfolio: nonzero but < 50% initial
    if (terminals[s] > 0 && terminals[s] < initialPortfolio * 0.5) smallEndCount++
  }

  const spendingMetrics: SpendingMetrics = {
    volatileSpending: volatileCount / nSims,
    smallSpending: smallSpendCount / nSims,
    largeEndPortfolio: largeEndCount / nSims,
    smallEndPortfolio: smallEndCount / nSims,
  }

  // ---- Histogram snapshots ----
  function computeHistogramBuckets(values: number[], nBuckets = 20): HistogramBucket[] {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const step = (max - min) / nBuckets || 1
    const buckets: HistogramBucket[] = Array.from({ length: nBuckets }, (_, i) => ({
      min: min + i * step,
      max: min + (i + 1) * step,
      count: 0,
    }))
    for (const v of values) {
      const idx = Math.min(Math.floor((v - min) / step), nBuckets - 1)
      buckets[idx].count++
    }
    return buckets
  }

  const snapshotYears = [nYearsAccum, nYearsAccum + 10, nYearsAccum + 20, nYearsTotal]
    .filter(y => y >= 0 && y <= nYearsTotal)
    .filter((v, i, a) => a.indexOf(v) === i) // deduplicate

  const histogramSnapshots: HistogramSnapshot[] = snapshotYears.map(y => {
    const col = new Array(nSims)
    for (let s = 0; s < nSims; s++) col[s] = balances[s][y]
    return {
      age: currentAge + y,
      year: y,
      buckets: computeHistogramBuckets(col),
      nBuckets: 20,
    }
  })

  // ---- Extract representative paths (gated to avoid overhead in SWR optimizer) ----
  let representativePaths: RepresentativePath[] | undefined
  if (params.extractPaths) {
    const TARGET_PERCENTILES = [10, 25, 50, 75, 90]
    representativePaths = []

    // Choose selection point: retirement-age balance for normal mode,
    // terminal balance for fireTarget mode (nYearsAccum = 0, all sims
    // have the same initial balance so retirement-age percentiles collapse).
    // When deterministicAccumulation is true, all sims have identical retirement-age
    // balances, so selecting by retirement balance would collapse all percentiles to
    // the same sim. Use terminal wealth instead to get meaningful post-retirement spread.
    const selectionYearIdx = (nYearsAccum > 0 && !deterministicAccumulation)
      ? nYearsAccum
      : nYearsTotal
    const selCol: number[] = new Array(nSims)
    for (let s = 0; s < nSims; s++) {
      selCol[s] = balances[s][selectionYearIdx]
    }

    // Also capture retirement-age balance for display purposes
    const retYearIdx = nYearsAccum

    for (const pct of TARGET_PERCENTILES) {
      const targetVal = percentile(selCol, pct)

      // Find the sim whose balance at the selection point is closest
      let bestSim = 0
      let bestDist = Math.abs(selCol[0] - targetVal)
      for (let s = 1; s < nSims; s++) {
        const dist = Math.abs(selCol[s] - targetVal)
        if (dist < bestDist) {
          bestDist = dist
          bestSim = s
        }
      }

      const returns = portfolioReturns[bestSim].slice(0, nYearsTotal)
      // When deterministic accumulation was used, the actual balance computation
      // used expectedPortfolioReturn during pre-retirement years, not the random
      // per-sim returns. Override yearlyReturns to match so projection table replay
      // produces identical balances to the MC engine.
      if (deterministicAccumulation) {
        for (let t = 0; t < nYearsAccum; t++) {
          returns[t] = expectedPortfolioReturn
        }
      }
      representativePaths.push({
        percentile: pct,
        simIndex: bestSim,
        yearlyReturns: returns,
        retirementBalance: balances[bestSim][retYearIdx],
      })
    }
  }

  return {
    success_rate: successRate,
    percentile_bands: percentileBands,
    terminal_stats: terminalStats,
    failure_distribution: failureDistribution,
    withdrawal_bands: withdrawalBands,
    spending_metrics: spendingMetrics,
    histogram_snapshots: histogramSnapshots,
    representative_paths: representativePaths,
    representative_paths_start_age: params.extractPaths ? currentAge : undefined,
  }
}
