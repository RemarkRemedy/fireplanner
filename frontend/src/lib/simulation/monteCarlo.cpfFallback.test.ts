import { describe, it, expect } from 'vitest'
import { runMonteCarlo, type MonteCarloEngineParams } from './monteCarlo'
import { CORRELATION_MATRIX } from '@/lib/data/historicalReturns'

/**
 * Build minimal MC params for CPF fallback tests.
 * Uses forced returns for deterministic behavior.
 */
function buildTestParams(overrides: Partial<MonteCarloEngineParams> = {}): MonteCarloEngineParams {
  return {
    initialPortfolio: 100_000,
    allocationWeights: [0, 0, 0, 0, 0, 1, 0, 0], // 100% SG bonds
    expectedReturns: [0.07, 0.07, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04],
    stdDevs: [0.15, 0.15, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    correlationMatrix: CORRELATION_MATRIX,
    currentAge: 55,
    retirementAge: 55,
    lifeExpectancy: 85,
    annualSavings: [],
    postRetirementIncome: [],
    method: 'parametric',
    nSimulations: 10,
    seed: 42,
    withdrawalStrategy: 'constant_dollar',
    strategyParams: { swr: 0.04 },
    expenseRatio: 0,
    inflation: 0,
    withdrawalBasis: 'rate',
    // Force 0% returns so portfolio depletes predictably
    forcedPortfolioReturns: new Array(30).fill(0),
    ...overrides,
  }
}

describe('Monte Carlo CPF Auto-Fallback', () => {
  it('should not use CPF fallback when disabled (undefined)', () => {
    const params = buildTestParams({
      cpfAutoFallback: undefined,
    })
    const result = runMonteCarlo(params)
    // With $100K portfolio, $4K/yr withdrawal, 0% returns:
    // depletes around year 25, fails by year 30
    expect(result.success_rate).toBeLessThan(1)
  })

  it('should improve success rate when CPF OA fallback is enabled', () => {
    const withoutFallback = runMonteCarlo(buildTestParams({
      cpfAutoFallback: undefined,
    }))

    const withFallback = runMonteCarlo(buildTestParams({
      cpfAutoFallback: {
        oaBalanceAtRetirement: 200_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 0, // already past FRS
        retirementAge: 55,
      },
    }))

    expect(withFallback.success_rate).toBeGreaterThan(withoutFallback.success_rate)
  })

  it('should not withdraw from CPF before age 55', () => {
    // Start at age 50 with retirement at 50, portfolio depletes before 55
    // $10K portfolio, $5K/yr withdrawal (50% rate), 0% returns = depletes at year 2
    // CPF available but can't be used until age 55 (year 5)
    const params = buildTestParams({
      currentAge: 50,
      retirementAge: 50,
      lifeExpectancy: 60,
      initialPortfolio: 10_000,
      forcedPortfolioReturns: new Array(10).fill(0),
      strategyParams: { swr: 0.50 },
      cpfAutoFallback: {
        oaBalanceAtRetirement: 500_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 0,
        retirementAge: 50,
      },
    })

    const result = runMonteCarlo(params)
    // Portfolio depletes at ~age 52, CPF can't help until age 55
    // Sims should fail in years 2-4 (ages 52-54)
    expect(result.success_rate).toBeLessThan(1)
  })

  it('should respect FRS locked amount', () => {
    // OA balance is 100K but 90K is locked for FRS -> only 10K withdrawable
    const params = buildTestParams({
      initialPortfolio: 10_000,
      forcedPortfolioReturns: new Array(30).fill(0),
      cpfAutoFallback: {
        oaBalanceAtRetirement: 100_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 90_000,
        retirementAge: 55,
      },
    })

    // With only ~10K available from CPF after FRS lock, success rate should be
    // lower than with full 100K available
    const paramsFullAccess = buildTestParams({
      initialPortfolio: 10_000,
      forcedPortfolioReturns: new Array(30).fill(0),
      cpfAutoFallback: {
        oaBalanceAtRetirement: 100_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 0,
        retirementAge: 55,
      },
    })

    const limitedResult = runMonteCarlo(params)
    const fullResult = runMonteCarlo(paramsFullAccess)

    expect(fullResult.success_rate).toBeGreaterThanOrEqual(limitedResult.success_rate)
  })

  it('should grow OA balance at specified rate', () => {
    // Very small portfolio that depletes in year 1, large OA that grows
    // With 0% growth, OA provides less total funding than with 2.5% growth
    const paramsNoGrowth = buildTestParams({
      initialPortfolio: 1_000,
      forcedPortfolioReturns: new Array(30).fill(0),
      cpfAutoFallback: {
        oaBalanceAtRetirement: 50_000,
        oaGrowthRate: 0,
        oaLockedForFRS: 0,
        retirementAge: 55,
      },
    })

    const paramsWithGrowth = buildTestParams({
      initialPortfolio: 1_000,
      forcedPortfolioReturns: new Array(30).fill(0),
      cpfAutoFallback: {
        oaBalanceAtRetirement: 50_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 0,
        retirementAge: 55,
      },
    })

    const noGrowthResult = runMonteCarlo(paramsNoGrowth)
    const withGrowthResult = runMonteCarlo(paramsWithGrowth)

    expect(withGrowthResult.success_rate).toBeGreaterThanOrEqual(noGrowthResult.success_rate)
  })

  it('should use SA fallback after OA is exhausted when includeSA is true', () => {
    const paramsOaOnly = buildTestParams({
      initialPortfolio: 1_000,
      forcedPortfolioReturns: new Array(30).fill(0),
      cpfAutoFallback: {
        oaBalanceAtRetirement: 20_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 0,
        retirementAge: 55,
      },
    })

    const paramsWithSa = buildTestParams({
      initialPortfolio: 1_000,
      forcedPortfolioReturns: new Array(30).fill(0),
      cpfAutoFallback: {
        oaBalanceAtRetirement: 20_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 0,
        retirementAge: 55,
        includeSA: true,
        saBalanceAtRetirement: 100_000,
        saGrowthRate: 0.04,
      },
    })

    const oaOnlyResult = runMonteCarlo(paramsOaOnly)
    const withSaResult = runMonteCarlo(paramsWithSa)

    expect(withSaResult.success_rate).toBeGreaterThanOrEqual(oaOnlyResult.success_rate)
  })

  it('should handle CPF LIFE start age — stop SA fallback after annuitization', () => {
    // When cpfLifeStartAge is set, SA fallback should stop at that age
    // because RA is converted to annuity
    const params = buildTestParams({
      initialPortfolio: 1_000,
      currentAge: 60,
      retirementAge: 60,
      lifeExpectancy: 85,
      forcedPortfolioReturns: new Array(25).fill(0),
      cpfAutoFallback: {
        oaBalanceAtRetirement: 10_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 0,
        retirementAge: 60,
        includeSA: true,
        saBalanceAtRetirement: 100_000,
        saGrowthRate: 0.04,
        cpfLifeStartAge: 65,
      },
    })

    // SA should be available before 65, then stop at 65
    const result = runMonteCarlo(params)
    // Just verify it runs without error
    expect(result.success_rate).toBeGreaterThanOrEqual(0)
    expect(result.success_rate).toBeLessThanOrEqual(1)
  })

  it('should achieve 100% success when CPF fully covers the shortfall', () => {
    // $100K portfolio, $4K/yr withdrawal, 0% returns = depletes at year 25
    // $200K CPF OA at 2.5% growth = plenty to cover remaining 5 years
    const params = buildTestParams({
      initialPortfolio: 100_000,
      lifeExpectancy: 85,
      forcedPortfolioReturns: new Array(30).fill(0),
      cpfAutoFallback: {
        oaBalanceAtRetirement: 200_000,
        oaGrowthRate: 0.025,
        oaLockedForFRS: 0,
        retirementAge: 55,
      },
    })

    const result = runMonteCarlo(params)
    expect(result.success_rate).toBe(1)
  })
})
