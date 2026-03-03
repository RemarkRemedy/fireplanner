/**
 * Sequence risk stress testing engine.
 * TypeScript port of backend/app/core/sequence_risk.py (349 lines).
 *
 * Applies historical crisis return sequences to the first N years of retirement,
 * then runs Monte Carlo for the remainder.
 *
 * Reuses MC internals from monteCarlo.ts:
 *   - generateReturnsParametric
 *   - computeWithdrawalsForYear
 *   - resolveInitialRate
 *
 * Formulas from FIRE_PLANNER_MASTER_PLAN_v2.md Section 6.
 */

import { SeededRNG } from '@/lib/math/random.ts'
import { choleskyDecomposition, buildCovarianceMatrix } from '@/lib/math/linalg.ts'
import { percentile } from '@/lib/math/stats.ts'
import {
  generateReturnsParametric,
  generateAssetReturnsParametric,
  computeWithdrawalsForYear,
  resolveInitialRate,
} from './monteCarlo.ts'
import type { PercentileBands, MitigationImpact, RetirementMitigationConfig } from '@/lib/types.ts'

// ============================================================
// Types
// ============================================================

export interface SequenceRiskEngineParams {
  initialPortfolio: number
  allocationWeights: number[]
  expectedReturns: number[]
  stdDevs: number[]
  correlationMatrix: number[][]
  retirementAge: number
  lifeExpectancy: number
  withdrawalStrategy: string
  strategyParams: Record<string, number>
  nSimulations: number
  seed?: number
  expenseRatio: number
  inflation: number
  postRetirementIncome: number[]
  oneTimeWithdrawals?: { year: number; amount: number }[]
  portfolioInjections?: { year: number; amount: number }[]
  retirementMitigation?: RetirementMitigationConfig
  annualExpensesAtRetirement?: number
  withdrawalBasis: 'expenses' | 'rate'
  yearlyWeights?: number[][]           // per-year allocation weights for glide path (nYears × 8)
  crisis: {
    id: string
    name: string
    equityReturnSequence: number[]
    durationYears: number
  }
}

export interface SequenceRiskEngineResult {
  normal_success_rate: number
  crisis_success_rate: number
  success_degradation: number
  normal_percentile_bands: PercentileBands
  crisis_percentile_bands: PercentileBands
  mitigations: MitigationImpact[]
}

interface SingleScenarioResult {
  success_rate: number
  percentile_bands: PercentileBands
}

// ============================================================
// Single Scenario Runner (maps to _run_single_scenario in Python)
// ============================================================

/**
 * Run a simplified MC simulation (decumulation only) with optional crisis
 * return overrides for the first N years.
 *
 * @param rng - Child RNG for this scenario
 * @param nSims - Number of simulation paths
 * @param initialPortfolio - Starting portfolio value
 * @param weights - 8-element allocation weights
 * @param expectedReturns - 8-element expected annual returns
 * @param stdDevs - 8-element standard deviations
 * @param correlationMatrix - 8×8 correlation matrix
 * @param precomputedL - Pre-computed Cholesky factor (pass to avoid recomputation)
 * @param nYearsDecum - Number of decumulation years
 * @param retirementAge - Age at retirement (for ages array in bands)
 * @param strategy - Withdrawal strategy name
 * @param strategyParams - Strategy-specific parameters
 * @param inflation - Annual inflation rate
 * @param expenseRatio - Annual portfolio expense ratio
 * @param postRetirementIncome - Per-year supplemental income array
 * @param crisisReturns - Optional sequence of portfolio returns overriding early years
 */
function runSingleScenario(
  rng: SeededRNG,
  nSims: number,
  initialPortfolio: number,
  weights: number[],
  expectedReturns: number[],
  stdDevs: number[],
  correlationMatrix: number[][],
  precomputedL: number[][],
  nYearsDecum: number,
  retirementAge: number,
  strategy: string,
  strategyParams: Record<string, number>,
  inflation: number,
  expenseRatio: number,
  postRetirementIncome: number[],
  crisisReturns: number[] | null,
  oneTimeWithdrawals?: { year: number; amount: number }[],
  annualExpensesAtRetirement?: number,
  portfolioInjections?: { year: number; amount: number }[],
  withdrawalBasis: 'expenses' | 'rate' = 'expenses',
  yearlyWeights?: number[][],
): SingleScenarioResult {
  const nCrisis = crisisReturns !== null ? crisisReturns.length : 0

  // When glide path is active, generate per-asset returns and compute portfolio returns per year.
  // Otherwise, use the existing single-weight-vector approach.
  let allReturns: number[][]

  if (yearlyWeights) {
    const assetReturns = generateAssetReturnsParametric(
      rng, nSims, nYearsDecum, expectedReturns, stdDevs, correlationMatrix, precomputedL,
    )
    // Convert per-asset returns to per-year portfolio returns using yearly weights
    allReturns = Array.from({ length: nSims }, (_, s) =>
      Array.from({ length: nYearsDecum }, (_, y) => {
        const w = yearlyWeights[y] ?? yearlyWeights[yearlyWeights.length - 1]
        let ret = 0
        for (let a = 0; a < w.length; a++) ret += assetReturns[s][y][a] * w[a]
        return ret
      })
    )
  } else {
    allReturns = generateReturnsParametric(
      rng, nSims, nYearsDecum, weights, expectedReturns, stdDevs, correlationMatrix, precomputedL,
    )
  }

  // Override early years with crisis returns (applied uniformly to all sims)
  if (crisisReturns !== null && nCrisis > 0) {
    const applyYears = Math.min(nCrisis, nYearsDecum)
    for (let y = 0; y < applyYears; y++) {
      for (let s = 0; s < nSims; s++) {
        allReturns[s][y] = crisisReturns[y]
      }
    }
  }

  // Simulation state
  const balances: number[][] = Array.from({ length: nSims }, () => {
    const arr = new Array(nYearsDecum + 1).fill(0)
    arr[0] = initialPortfolio
    return arr
  })

  const failed: boolean[] = new Array(nSims).fill(false)
  const failureYear: number[] = new Array(nSims).fill(nYearsDecum)
  const prevWithdrawals: number[] = new Array(nSims).fill(0)
  // Track previous balance for sensible_withdrawals gain calculation
  const prevBalances: number[] = new Array(nSims).fill(initialPortfolio)

  const swr = resolveInitialRate(strategyParams)
  const expenses = annualExpensesAtRetirement ?? 0
  // Use user's actual retirement expenses when available and withdrawalBasis is 'expenses';
  // fall back to portfolio × SWR rate when no expenses are specified, or when the user
  // has explicitly chosen rate-driven withdrawal (withdrawalBasis === 'rate').
  const initialWithdrawalAmount = expenses > 0 && withdrawalBasis !== 'rate'
    ? expenses
    : initialPortfolio * swr

  for (let t = 0; t < nYearsDecum; t++) {
    // Apply portfolio injections (e.g. downsizing equity) at this year
    if (portfolioInjections) {
      for (const inj of portfolioInjections) {
        if (inj.year === t) {
          for (let s = 0; s < nSims; s++) {
            balances[s][t] += inj.amount
          }
        }
      }
    }

    for (let s = 0; s < nSims; s++) {
      const prevYearReturn = t > 0 ? allReturns[s][t - 1] : undefined

      // Previous year gains for sensible_withdrawals
      const prevYearGains = t > 0
        ? balances[s][t] - prevBalances[s] + prevWithdrawals[s]
        : 0

      const withdrawal = computeWithdrawalsForYear(
        strategy,
        balances[s][t],
        t,
        nYearsDecum,
        initialWithdrawalAmount,
        prevWithdrawals[s],
        inflation,
        strategyParams,
        prevYearReturn,
        prevYearGains,
      )

      // Add one-time withdrawals for this year offset
      const oneTime = (oneTimeWithdrawals ?? [])
        .filter(w => w.year === t)
        .reduce((sum, w) => sum + w.amount, 0)

      const income = t < postRetirementIncome.length ? postRetirementIncome[t] : 0.0
      let netWithdrawal = Math.max(0, (withdrawal + oneTime) - income)
      // Don't withdraw more than the portfolio
      netWithdrawal = Math.min(netWithdrawal, balances[s][t])

      prevWithdrawals[s] = withdrawal
      prevBalances[s] = balances[s][t]

      balances[s][t + 1] =
        (balances[s][t] - netWithdrawal) * (1 + allReturns[s][t] - expenseRatio)

      if (balances[s][t + 1] <= 0 && !failed[s]) {
        failed[s] = true
        failureYear[s] = t
      }
      // Clamp to 0
      if (balances[s][t + 1] < 0) {
        balances[s][t + 1] = 0
      }
    }
  }

  // Compute percentile bands across simulations at each time point
  const nPoints = nYearsDecum + 1
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
    ages.push(retirementAge + y)

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

  const nFailed = failed.filter(Boolean).length
  const successRate = 1 - nFailed / nSims

  return {
    success_rate: successRate,
    percentile_bands: { years, ages, p5, p10, p25, p50, p75, p90, p95 },
  }
}

// ============================================================
// Mitigation Runner (maps to _run_mitigation in Python)
// ============================================================

interface RunMitigationParams {
  rng: SeededRNG
  nSims: number
  initialPortfolio: number
  weights: number[]
  expectedReturns: number[]
  stdDevs: number[]
  correlationMatrix: number[][]
  precomputedL: number[][]
  nYearsDecum: number
  retirementAge: number
  strategy: string
  strategyParams: Record<string, number>
  inflation: number
  expenseRatio: number
  postRetirementIncome: number[]
  crisisReturns: number[]
  oneTimeWithdrawals?: { year: number; amount: number }[]
  portfolioInjections?: { year: number; amount: number }[]
  annualExpensesAtRetirement?: number
  withdrawalBasis: 'expenses' | 'rate'
  mitigationName: string
  mitigationDesc: string
  baselineCrisisRate: number
  modifiedWeights?: number[]
  modifiedStrategyParams?: Record<string, number>
  modifiedPostRetirementIncome?: number[]
  modifiedInitialPortfolio?: number
  yearlyWeights?: number[][]
}

function runMitigation(p: RunMitigationParams): MitigationImpact {
  const effWeights = p.modifiedWeights ?? p.weights
  const effParams = p.modifiedStrategyParams ?? p.strategyParams
  const effPortfolio = p.modifiedInitialPortfolio ?? p.initialPortfolio
  const effIncome = p.modifiedPostRetirementIncome ?? p.postRetirementIncome
  // When a mitigation modifies weights (e.g., bond tent), glide path yearlyWeights
  // are not applicable — the mitigation replaces the entire allocation strategy.
  // Only pass yearlyWeights when no modifiedWeights override is present.
  const effYearlyWeights = p.modifiedWeights ? undefined : p.yearlyWeights

  // Normal run (no crisis) for this mitigation
  const normalResult = runSingleScenario(
    new SeededRNG(p.rng.nextInt(2 ** 32)),
    p.nSims,
    effPortfolio,
    effWeights,
    p.expectedReturns,
    p.stdDevs,
    p.correlationMatrix,
    p.precomputedL,
    p.nYearsDecum,
    p.retirementAge,
    p.strategy,
    effParams,
    p.inflation,
    p.expenseRatio,
    effIncome,
    null,
    p.oneTimeWithdrawals,
    p.annualExpensesAtRetirement,
    p.portfolioInjections,
    p.withdrawalBasis,
    effYearlyWeights,
  )

  // Crisis run for this mitigation
  const crisisResult = runSingleScenario(
    new SeededRNG(p.rng.nextInt(2 ** 32)),
    p.nSims,
    effPortfolio,
    effWeights,
    p.expectedReturns,
    p.stdDevs,
    p.correlationMatrix,
    p.precomputedL,
    p.nYearsDecum,
    p.retirementAge,
    p.strategy,
    effParams,
    p.inflation,
    p.expenseRatio,
    effIncome,
    p.crisisReturns,
    p.oneTimeWithdrawals,
    p.annualExpensesAtRetirement,
    p.portfolioInjections,
    p.withdrawalBasis,
    effYearlyWeights,
  )

  return {
    strategy: p.mitigationName,
    description: p.mitigationDesc,
    normal_success_rate: normalResult.success_rate,
    crisis_success_rate: crisisResult.success_rate,
    success_improvement: crisisResult.success_rate - p.baselineCrisisRate,
  }
}

// ============================================================
// Main Entry Point
// ============================================================

/**
 * Run sequence risk stress testing.
 *
 * Applies a historical crisis return sequence to the first N years of retirement,
 * then runs parametric Monte Carlo for the remainder. Returns normal vs crisis
 * success rates, percentile bands, and 3 mitigation strategy comparisons.
 *
 * Output uses snake_case keys matching SequenceRiskResult from types.ts.
 */
export function runSequenceRisk(params: SequenceRiskEngineParams): SequenceRiskEngineResult {
  const {
    initialPortfolio,
    allocationWeights: weights,
    expectedReturns,
    stdDevs,
    correlationMatrix,
    retirementAge,
    lifeExpectancy,
    withdrawalStrategy: strategy,
    strategyParams,
    nSimulations: nSims,
    seed,
    expenseRatio,
    inflation,
    postRetirementIncome,
    oneTimeWithdrawals,
    portfolioInjections,
    annualExpensesAtRetirement,
    withdrawalBasis,
    yearlyWeights,
    crisis,
  } = params

  const masterRng = new SeededRNG(seed ?? 42)
  const nYearsDecum = Math.max(1, lifeExpectancy - retirementAge)
  const crisisReturns = crisis.equityReturnSequence

  // Pre-compute Cholesky factor once — reused across all scenario runs
  const covMatrix = buildCovarianceMatrix(stdDevs, correlationMatrix)
  const L = choleskyDecomposition(covMatrix)

  // --- Normal scenario (no crisis) ---
  const normalResult = runSingleScenario(
    new SeededRNG(masterRng.nextInt(2 ** 32)),
    nSims,
    initialPortfolio,
    weights,
    expectedReturns,
    stdDevs,
    correlationMatrix,
    L,
    nYearsDecum,
    retirementAge,
    strategy,
    strategyParams,
    inflation,
    expenseRatio,
    postRetirementIncome,
    null,
    oneTimeWithdrawals,
    annualExpensesAtRetirement,
    portfolioInjections,
    withdrawalBasis,
    yearlyWeights,
  )

  // --- Crisis scenario ---
  const crisisResult = runSingleScenario(
    new SeededRNG(masterRng.nextInt(2 ** 32)),
    nSims,
    initialPortfolio,
    weights,
    expectedReturns,
    stdDevs,
    correlationMatrix,
    L,
    nYearsDecum,
    retirementAge,
    strategy,
    strategyParams,
    inflation,
    expenseRatio,
    postRetirementIncome,
    crisisReturns.length > 0 ? crisisReturns : null,
    oneTimeWithdrawals,
    annualExpensesAtRetirement,
    portfolioInjections,
    withdrawalBasis,
    yearlyWeights,
  )

  const baselineCrisisRate = crisisResult.success_rate

  // ============================================================
  // Mitigation 1: Conservative Allocation (Bond Tent)
  // Shift 20% from equities (indices 0,1,2) to bonds (index 3),
  // proportional to each equity's current weight.
  // ============================================================
  const bondTentWeights = [...weights]
  const equityTotal = bondTentWeights[0] + bondTentWeights[1] + bondTentWeights[2]
  const shift = Math.min(0.20, equityTotal)
  if (equityTotal > 0) {
    for (const i of [0, 1, 2] as const) {
      const reduction = shift * (bondTentWeights[i] / equityTotal)
      bondTentWeights[i] -= reduction
    }
    bondTentWeights[3] += shift
  }

  const mitigationConservativeAlloc = runMitigation({
    rng: new SeededRNG(masterRng.nextInt(2 ** 32)),
    nSims,
    initialPortfolio,
    weights,
    expectedReturns,
    stdDevs,
    correlationMatrix,
    precomputedL: L,
    nYearsDecum,
    retirementAge,
    strategy,
    strategyParams,
    inflation,
    expenseRatio,
    postRetirementIncome,
    crisisReturns,
    oneTimeWithdrawals,
    portfolioInjections,
    annualExpensesAtRetirement,
    withdrawalBasis,
    mitigationName: 'Conservative Allocation',
    mitigationDesc:
      'Shift 20% from equities to bonds throughout retirement to reduce volatility exposure.',
    baselineCrisisRate,
    modifiedWeights: bondTentWeights,
    yearlyWeights,
  })

  // ============================================================
  // Mitigation 2: Cash Buffer (2 Years)
  // Hold 2 years of expenses outside the invested portfolio.
  // Reduce invested portfolio by that amount (floored at 50% of original),
  // and add back cash buffer spread over the first 2 decumulation years.
  // ============================================================
  const expensesAtRetirement = annualExpensesAtRetirement ?? 0
  const annualExpenseEst = expensesAtRetirement > 0
    ? expensesAtRetirement
    : initialPortfolio * resolveInitialRate(strategyParams)
  const cashBuffer = annualExpenseEst * 2
  const reducedPortfolio = Math.max(
    initialPortfolio - cashBuffer,
    initialPortfolio * 0.5,
  )

  // Add buffer equally across the first min(2, nYearsDecum) years
  const bufferYears = Math.min(2, nYearsDecum)
  const cashBufferPerYear = cashBuffer / bufferYears

  // Build modified post-retirement income: add cash buffer to years 0 and 1
  const modifiedIncome: number[] = []
  for (let i = 0; i < nYearsDecum; i++) {
    const base = i < postRetirementIncome.length ? postRetirementIncome[i] : 0
    const buffer = i < bufferYears ? cashBufferPerYear : 0
    modifiedIncome.push(base + buffer)
  }

  const mitigationCashBuffer = runMitigation({
    rng: new SeededRNG(masterRng.nextInt(2 ** 32)),
    nSims,
    initialPortfolio,
    weights,
    expectedReturns,
    stdDevs,
    correlationMatrix,
    precomputedL: L,
    nYearsDecum,
    retirementAge,
    strategy,
    strategyParams,
    inflation,
    expenseRatio,
    postRetirementIncome,
    crisisReturns,
    oneTimeWithdrawals,
    portfolioInjections,
    annualExpensesAtRetirement,
    withdrawalBasis,
    mitigationName: 'Cash Buffer (2 Years)',
    mitigationDesc:
      'Hold 2 years of expenses in cash outside the portfolio, drawing from buffer in early crisis years.',
    baselineCrisisRate,
    modifiedInitialPortfolio: reducedPortfolio,
    modifiedPostRetirementIncome: modifiedIncome,
    yearlyWeights,
  })

  // ============================================================
  // Mitigation 3: Flexible Spending (-15%)
  // Reduce SWR / initial rate / target rate by 15%.
  // Uses camelCase keys (TS convention) with fallback to snake_case.
  // ============================================================
  const flexibleParams: Record<string, number> = { ...strategyParams }
  if ('swr' in flexibleParams) flexibleParams.swr *= 0.85
  if ('initialRate' in flexibleParams) flexibleParams.initialRate *= 0.85
  if ('initial_rate' in flexibleParams) flexibleParams.initial_rate *= 0.85
  if ('targetRate' in flexibleParams) flexibleParams.targetRate *= 0.85
  if ('target_rate' in flexibleParams) flexibleParams.target_rate *= 0.85

  const mitigationFlexibleSpending = runMitigation({
    rng: new SeededRNG(masterRng.nextInt(2 ** 32)),
    nSims,
    initialPortfolio,
    weights,
    expectedReturns,
    stdDevs,
    correlationMatrix,
    precomputedL: L,
    nYearsDecum,
    retirementAge,
    strategy,
    strategyParams,
    inflation,
    expenseRatio,
    postRetirementIncome,
    crisisReturns,
    oneTimeWithdrawals,
    portfolioInjections,
    annualExpensesAtRetirement: annualExpensesAtRetirement
      ? annualExpensesAtRetirement * 0.85
      : undefined,
    withdrawalBasis,
    mitigationName: 'Flexible Spending (-15%)',
    mitigationDesc:
      'Reduce withdrawal rate by 15% to preserve capital during market downturns.',
    baselineCrisisRate,
    modifiedStrategyParams: flexibleParams,
    yearlyWeights,
  })

  return {
    normal_success_rate: normalResult.success_rate,
    crisis_success_rate: crisisResult.success_rate,
    success_degradation: normalResult.success_rate - crisisResult.success_rate,
    normal_percentile_bands: normalResult.percentile_bands,
    crisis_percentile_bands: crisisResult.percentile_bands,
    mitigations: [
      mitigationConservativeAlloc,
      mitigationCashBuffer,
      mitigationFlexibleSpending,
    ],
  }
}
