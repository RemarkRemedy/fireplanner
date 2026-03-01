import type { PortfolioStats, GlidePathConfig, GlidePathMethod } from '@/lib/types'
import { ASSET_CLASSES, RISK_FREE_RATE } from '@/lib/data/historicalReturns'

/** Get effective returns per asset class, applying user overrides where set */
export function getEffectiveReturns(returnOverrides: (number | null)[]): number[] {
  return ASSET_CLASSES.map((ac, i) => returnOverrides[i] ?? ac.expectedReturn)
}

/** Get effective std devs per asset class, applying user overrides where set */
export function getEffectiveStdDevs(stdDevOverrides: (number | null)[]): number[] {
  return ASSET_CLASSES.map((ac, i) => stdDevOverrides[i] ?? ac.stdDev)
}

/**
 * Portfolio expected return: SUMPRODUCT of weights and returns.
 * portfolioReturn = Σ wᵢ × rᵢ
 */
export function calculatePortfolioReturn(
  weights: number[],
  returns: number[]
): number {
  let sum = 0
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i] * returns[i]
  }
  return sum
}

/**
 * Markowitz portfolio variance: w'Σw
 * portfolioVariance = Σᵢ Σⱼ wᵢ × wⱼ × σᵢ × σⱼ × ρᵢⱼ
 */
export function calculatePortfolioVariance(
  weights: number[],
  stdDevs: number[],
  correlations: number[][]
): number {
  let variance = 0
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] * stdDevs[i] * stdDevs[j] * correlations[i][j]
    }
  }
  return Math.max(0, variance)
}

/**
 * Portfolio standard deviation: sqrt(variance)
 */
export function calculatePortfolioStdDev(
  weights: number[],
  stdDevs: number[],
  correlations: number[][]
): number {
  return Math.sqrt(calculatePortfolioVariance(weights, stdDevs, correlations))
}

/**
 * Sharpe ratio: (portfolio net return - risk-free rate) / portfolio std dev
 * Returns Infinity if stdDev is 0 and excess return > 0.
 */
export function calculateSharpe(
  portfolioReturn: number,
  riskFreeRate: number,
  stdDev: number
): number {
  if (stdDev === 0) {
    return portfolioReturn > riskFreeRate ? Infinity : 0
  }
  return (portfolioReturn - riskFreeRate) / stdDev
}

/**
 * Value at Risk: the maximum expected loss at a given confidence level.
 * VaR = -(return - z × stdDev)
 * Using normal distribution z-scores: 95% → 1.645, 99% → 2.326
 */
export function calculateVaR(
  portfolioReturn: number,
  stdDev: number,
  confidence: number
): number {
  const zScores: Record<number, number> = { 0.95: 1.645, 0.99: 2.326 }
  const z = zScores[confidence] ?? 1.645
  return portfolioReturn - z * stdDev
}

/**
 * Diversification ratio: weighted average of individual stdDevs / portfolio stdDev
 * Ratio > 1 indicates diversification benefit.
 * Perfect correlation → ratio ≈ 1.0
 */
export function calculateDiversificationRatio(
  weights: number[],
  stdDevs: number[],
  portfolioStdDev: number
): number {
  if (portfolioStdDev === 0) return 1
  let weightedStdDev = 0
  for (let i = 0; i < weights.length; i++) {
    weightedStdDev += weights[i] * stdDevs[i]
  }
  return weightedStdDev / portfolioStdDev
}

/**
 * Normalize weights to sum to exactly 1.0.
 * Distributes rounding error proportionally.
 */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum === 0) return weights.map(() => 1 / weights.length)
  return weights.map((w) => w / sum)
}

/**
 * Main entry point: compute all portfolio statistics for a given set of weights.
 */
export function calculatePortfolioStats(params: {
  weights: number[]
  returns: number[]
  stdDevs: number[]
  correlations: number[][]
  inflation: number
  expenseRatio: number
  riskFreeRate?: number
}): PortfolioStats {
  const { weights, returns, stdDevs, correlations, inflation, expenseRatio } = params
  const riskFreeRate = params.riskFreeRate ?? RISK_FREE_RATE

  const expectedReturn = calculatePortfolioReturn(weights, returns)
  const realReturn = expectedReturn - inflation
  const netReturn = realReturn - expenseRatio
  const stdDev = calculatePortfolioStdDev(weights, stdDevs, correlations)
  const sharpe = calculateSharpe(netReturn, riskFreeRate - inflation, stdDev)
  const var95 = calculateVaR(expectedReturn, stdDev, 0.95)
  const var99 = calculateVaR(expectedReturn, stdDev, 0.99)
  const diversificationRatio = calculateDiversificationRatio(weights, stdDevs, stdDev)

  return {
    expectedReturn,
    realReturn,
    netReturn,
    stdDev,
    sharpe,
    var95,
    var99,
    diversificationRatio,
  }
}

/**
 * Interpolate between current and target weights using a glide path method.
 * progress: 0 = 100% current, 1 = 100% target
 */
export function interpolateGlidePath(
  currentWeights: number[],
  targetWeights: number[],
  progress: number,
  method: GlidePathMethod
): number[] {
  const t = Math.max(0, Math.min(1, progress))
  let adjustedT: number

  switch (method) {
    case 'linear':
      adjustedT = t
      break
    case 'slowStart':
      adjustedT = t * t // quadratic: slow at start, fast at end
      break
    case 'fastStart':
      adjustedT = Math.sqrt(t) // sqrt: fast at start, slow at end
      break
  }

  return currentWeights.map((cw, i) => cw + (targetWeights[i] - cw) * adjustedT)
}

/**
 * Generate year-by-year allocations along a glide path.
 * Returns an array of { age, weights } for each year from startAge to endAge.
 */
export function getGlidePathAllocations(
  config: GlidePathConfig,
  currentWeights: number[],
  targetWeights: number[]
): { age: number; weights: number[] }[] {
  if (!config.enabled) return []

  const results: { age: number; weights: number[] }[] = []
  const duration = config.endAge - config.startAge
  if (duration <= 0) return []

  for (let age = config.startAge; age <= config.endAge; age++) {
    const progress = (age - config.startAge) / duration
    const weights = interpolateGlidePath(currentWeights, targetWeights, progress, config.method)
    results.push({ age, weights })
  }

  return results
}
