import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculatePortfolioReturn,
  calculatePortfolioVariance,
  calculatePortfolioStdDev,
  calculateSharpe,
  calculateVaR,
  calculateDiversificationRatio,
  normalizeWeights,
  calculatePortfolioStats,
  interpolateGlidePath,
  getGlidePathAllocations,
  buildYearlyWeights,
} from './portfolio'
import {
  ASSET_CLASSES,
  CORRELATION_MATRIX,
  ALLOCATION_TEMPLATES,
} from '@/lib/data/historicalReturns'

const defaultReturns = ASSET_CLASSES.map((a) => a.expectedReturn)
const defaultStdDevs = ASSET_CLASSES.map((a) => a.stdDev)

describe('calculatePortfolioReturn', () => {
  it('computes SUMPRODUCT of known weights and returns', () => {
    // Simple 2-asset case: 60% at 10%, 40% at 5% → 8%
    expect(calculatePortfolioReturn([0.6, 0.4], [0.10, 0.05])).toBeCloseTo(0.08, 10)
  })

  it('returns 0 for all-zero weights', () => {
    expect(calculatePortfolioReturn([0, 0, 0], [0.10, 0.05, 0.03])).toBe(0)
  })

  it('computes Balanced template return', () => {
    const weights = ALLOCATION_TEMPLATES.balanced
    const expected = weights.reduce((sum, w, i) => sum + w * defaultReturns[i], 0)
    expect(calculatePortfolioReturn(weights, defaultReturns)).toBeCloseTo(expected, 10)
  })

  it('computes Aggressive template return (higher than Conservative)', () => {
    const aggReturn = calculatePortfolioReturn(ALLOCATION_TEMPLATES.aggressive, defaultReturns)
    const conReturn = calculatePortfolioReturn(ALLOCATION_TEMPLATES.conservative, defaultReturns)
    expect(aggReturn).toBeGreaterThan(conReturn)
  })
})

describe('calculatePortfolioVariance', () => {
  it('computes known 2-asset case', () => {
    // 2 assets: w=[0.6, 0.4], σ=[0.15, 0.05], ρ=0.3
    // var = 0.6²×0.15² + 0.4²×0.05² + 2×0.6×0.4×0.15×0.05×0.3
    // = 0.36×0.0225 + 0.16×0.0025 + 2×0.6×0.4×0.15×0.05×0.3
    // = 0.0081 + 0.0004 + 0.00108 = 0.00958
    const w = [0.6, 0.4]
    const s = [0.15, 0.05]
    const corr = [[1, 0.3], [0.3, 1]]
    expect(calculatePortfolioVariance(w, s, corr)).toBeCloseTo(0.00958, 5)
  })

  it('returns non-negative for any weights', () => {
    const variance = calculatePortfolioVariance(
      ALLOCATION_TEMPLATES.balanced,
      defaultStdDevs,
      CORRELATION_MATRIX
    )
    expect(variance).toBeGreaterThanOrEqual(0)
  })
})

describe('calculatePortfolioStdDev', () => {
  it('is sqrt of variance for 2-asset case', () => {
    const w = [0.6, 0.4]
    const s = [0.15, 0.05]
    const corr = [[1, 0.3], [0.3, 1]]
    const variance = calculatePortfolioVariance(w, s, corr)
    expect(calculatePortfolioStdDev(w, s, corr)).toBeCloseTo(Math.sqrt(variance), 10)
  })

  it('returns 0 for all-cash portfolio', () => {
    // CPF has 0 stdDev
    const weights = [0, 0, 0, 0, 0, 0, 0, 1] // 100% CPF
    expect(calculatePortfolioStdDev(weights, defaultStdDevs, CORRELATION_MATRIX)).toBe(0)
  })
})

describe('calculateSharpe', () => {
  it('computes basic Sharpe ratio', () => {
    // return 8%, riskFree 2%, stdDev 12% → (0.08-0.02)/0.12 = 0.5
    expect(calculateSharpe(0.08, 0.02, 0.12)).toBeCloseTo(0.5, 10)
  })

  it('returns Infinity for zero stdDev with positive excess return', () => {
    expect(calculateSharpe(0.05, 0.02, 0)).toBe(Infinity)
  })

  it('returns 0 for zero stdDev with zero or negative excess return', () => {
    expect(calculateSharpe(0.02, 0.02, 0)).toBe(0)
    expect(calculateSharpe(0.01, 0.02, 0)).toBe(0)
  })
})

describe('calculateVaR', () => {
  it('computes VaR at 95% confidence', () => {
    // return 7%, stdDev 15% → 0.07 - 1.645 × 0.15 = 0.07 - 0.24675 = -0.17675
    expect(calculateVaR(0.07, 0.15, 0.95)).toBeCloseTo(-0.17675, 4)
  })

  it('computes VaR at 99% confidence', () => {
    // return 7%, stdDev 15% → 0.07 - 2.326 × 0.15 = 0.07 - 0.3489 = -0.2789
    expect(calculateVaR(0.07, 0.15, 0.99)).toBeCloseTo(-0.2789, 4)
  })

  it('VaR99 is more negative than VaR95', () => {
    const var95 = calculateVaR(0.07, 0.15, 0.95)
    const var99 = calculateVaR(0.07, 0.15, 0.99)
    expect(var99).toBeLessThan(var95)
  })
})

describe('calculateDiversificationRatio', () => {
  it('returns ~1.0 for perfectly correlated assets', () => {
    // Two perfectly correlated assets: portfolio stdDev = weighted avg of stdDevs
    const w = [0.6, 0.4]
    const s = [0.15, 0.10]
    const corr = [[1, 1], [1, 1]]
    const pStd = calculatePortfolioStdDev(w, s, corr)
    expect(calculateDiversificationRatio(w, s, pStd)).toBeCloseTo(1.0, 5)
  })

  it('returns >1.0 for imperfectly correlated assets', () => {
    const w = [0.6, 0.4]
    const s = [0.15, 0.10]
    const corr = [[1, 0.3], [0.3, 1]]
    const pStd = calculatePortfolioStdDev(w, s, corr)
    expect(calculateDiversificationRatio(w, s, pStd)).toBeGreaterThan(1.0)
  })

  it('returns 1.0 for single-asset portfolio', () => {
    const w = [1, 0]
    const s = [0.15, 0.10]
    const corr = [[1, 0.3], [0.3, 1]]
    const pStd = calculatePortfolioStdDev(w, s, corr)
    expect(calculateDiversificationRatio(w, s, pStd)).toBeCloseTo(1.0, 5)
  })
})

describe('normalizeWeights', () => {
  it('keeps already-normalized weights unchanged', () => {
    const w = [0.3, 0.3, 0.4]
    const result = normalizeWeights(w)
    result.forEach((v, i) => expect(v).toBeCloseTo(w[i], 10))
  })

  it('normalizes off-by-small-amount', () => {
    const w = [0.3, 0.3, 0.401]
    const result = normalizeWeights(w)
    const sum = result.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 10)
  })

  it('handles all-zero weights (equal distribution)', () => {
    const w = [0, 0, 0, 0]
    const result = normalizeWeights(w)
    result.forEach((v) => expect(v).toBeCloseTo(0.25, 10))
  })
})

describe('calculatePortfolioStats', () => {
  it('computes full stats for Balanced template', () => {
    const stats = calculatePortfolioStats({
      weights: ALLOCATION_TEMPLATES.balanced,
      returns: defaultReturns,
      stdDevs: defaultStdDevs,
      correlations: CORRELATION_MATRIX,
      inflation: 0.025,
      expenseRatio: 0.003,
    })

    expect(stats.expectedReturn).toBeGreaterThan(0.04)
    expect(stats.expectedReturn).toBeLessThan(0.12)
    expect(stats.realReturn).toBeCloseTo(stats.expectedReturn - 0.025, 10)
    expect(stats.netReturn).toBeCloseTo(stats.realReturn - 0.003, 10)
    expect(stats.stdDev).toBeGreaterThan(0)
    expect(stats.sharpe).toBeGreaterThan(0)
    expect(stats.var95).toBeLessThan(stats.expectedReturn)
    expect(stats.var99).toBeLessThan(stats.var95)
    expect(stats.diversificationRatio).toBeGreaterThanOrEqual(1.0)
  })

  it('Aggressive has higher return and stdDev than Conservative', () => {
    const agg = calculatePortfolioStats({
      weights: ALLOCATION_TEMPLATES.aggressive,
      returns: defaultReturns,
      stdDevs: defaultStdDevs,
      correlations: CORRELATION_MATRIX,
      inflation: 0.025,
      expenseRatio: 0.003,
    })
    const con = calculatePortfolioStats({
      weights: ALLOCATION_TEMPLATES.conservative,
      returns: defaultReturns,
      stdDevs: defaultStdDevs,
      correlations: CORRELATION_MATRIX,
      inflation: 0.025,
      expenseRatio: 0.003,
    })

    expect(agg.expectedReturn).toBeGreaterThan(con.expectedReturn)
    expect(agg.stdDev).toBeGreaterThan(con.stdDev)
  })

  it('uses custom riskFreeRate when provided', () => {
    const stats = calculatePortfolioStats({
      weights: ALLOCATION_TEMPLATES.balanced,
      returns: defaultReturns,
      stdDevs: defaultStdDevs,
      correlations: CORRELATION_MATRIX,
      inflation: 0.025,
      expenseRatio: 0.003,
      riskFreeRate: 0.03,
    })
    // Sharpe computed with riskFreeRate of 0.03 instead of default 0.02
    const expectedSharpe = (stats.netReturn - (0.03 - 0.025)) / stats.stdDev
    expect(stats.sharpe).toBeCloseTo(expectedSharpe, 10)
  })
})

describe('interpolateGlidePath', () => {
  const current = [0.6, 0.4]
  const target = [0.3, 0.7]

  it('returns current weights at progress=0', () => {
    const result = interpolateGlidePath(current, target, 0, 'linear')
    expect(result[0]).toBeCloseTo(0.6, 10)
    expect(result[1]).toBeCloseTo(0.4, 10)
  })

  it('returns target weights at progress=1', () => {
    const result = interpolateGlidePath(current, target, 1, 'linear')
    expect(result[0]).toBeCloseTo(0.3, 10)
    expect(result[1]).toBeCloseTo(0.7, 10)
  })

  it('linear midpoint is average', () => {
    const result = interpolateGlidePath(current, target, 0.5, 'linear')
    expect(result[0]).toBeCloseTo(0.45, 10)
    expect(result[1]).toBeCloseTo(0.55, 10)
  })

  it('slowStart (quadratic): progress 0.5 → t²=0.25', () => {
    const result = interpolateGlidePath(current, target, 0.5, 'slowStart')
    // t=0.25: 0.6 + (0.3-0.6)*0.25 = 0.6 - 0.075 = 0.525
    expect(result[0]).toBeCloseTo(0.525, 10)
    expect(result[1]).toBeCloseTo(0.475, 10)
  })

  it('fastStart (sqrt): progress 0.5 → sqrt(0.5)≈0.707', () => {
    const result = interpolateGlidePath(current, target, 0.5, 'fastStart')
    const t = Math.sqrt(0.5)
    expect(result[0]).toBeCloseTo(0.6 + (0.3 - 0.6) * t, 5)
    expect(result[1]).toBeCloseTo(0.4 + (0.7 - 0.4) * t, 5)
  })

  it('clamps progress to [0, 1]', () => {
    const below = interpolateGlidePath(current, target, -0.5, 'linear')
    expect(below[0]).toBeCloseTo(0.6, 10)
    const above = interpolateGlidePath(current, target, 1.5, 'linear')
    expect(above[0]).toBeCloseTo(0.3, 10)
  })
})

describe('getGlidePathAllocations', () => {
  const current = [0.6, 0.2, 0.2, 0, 0, 0, 0, 0]
  const target = [0.3, 0.1, 0.1, 0.5, 0, 0, 0, 0]

  it('returns empty array when glide path disabled', () => {
    const result = getGlidePathAllocations(
      { enabled: false, method: 'linear', startAge: 55, endAge: 65 },
      current, target
    )
    expect(result).toEqual([])
  })

  it('generates correct number of years', () => {
    const result = getGlidePathAllocations(
      { enabled: true, method: 'linear', startAge: 55, endAge: 65 },
      current, target
    )
    // 55 to 65 inclusive = 11 entries
    expect(result).toHaveLength(11)
    expect(result[0].age).toBe(55)
    expect(result[10].age).toBe(65)
  })

  it('first year matches current weights, last year matches target', () => {
    const result = getGlidePathAllocations(
      { enabled: true, method: 'linear', startAge: 55, endAge: 65 },
      current, target
    )
    result[0].weights.forEach((w, i) => expect(w).toBeCloseTo(current[i], 5))
    result[10].weights.forEach((w, i) => expect(w).toBeCloseTo(target[i], 5))
  })

  it('returns empty array for invalid duration', () => {
    const result = getGlidePathAllocations(
      { enabled: true, method: 'linear', startAge: 65, endAge: 55 },
      current, target
    )
    expect(result).toEqual([])
  })
})

describe('buildYearlyWeights', () => {
  const current = [0.6, 0.2, 0.1, 0.1, 0, 0, 0, 0]
  const target = [0.3, 0.1, 0.1, 0.5, 0, 0, 0, 0]
  const config = { enabled: true, method: 'linear' as const, startAge: 60, endAge: 70 }

  it('returns correct number of year vectors', () => {
    const result = buildYearlyWeights(30, 40, current, target, config)
    expect(result).toHaveLength(30)
  })

  it('before startAge: uses currentWeights', () => {
    const result = buildYearlyWeights(30, 40, current, target, config)
    // Age 40-59 (indices 0-19) should be currentWeights
    for (let i = 0; i < 20; i++) {
      result[i].forEach((w, j) => expect(w).toBeCloseTo(current[j], 5))
    }
  })

  it('at and after endAge: uses targetWeights', () => {
    const result = buildYearlyWeights(40, 40, current, target, config)
    // Age 70+ (indices 30+) should be targetWeights
    for (let i = 30; i < 40; i++) {
      result[i].forEach((w, j) => expect(w).toBeCloseTo(target[j], 5))
    }
  })

  it('linear interpolation at midpoint', () => {
    const result = buildYearlyWeights(30, 40, current, target, config)
    // Age 65 = index 25, progress = 5/10 = 0.5
    const mid = result[25]
    mid.forEach((w, i) => {
      expect(w).toBeCloseTo(current[i] + (target[i] - current[i]) * 0.5, 5)
    })
  })

  it('slowStart interpolation curves slower at start', () => {
    const slowConfig = { ...config, method: 'slowStart' as const }
    const result = buildYearlyWeights(30, 40, current, target, slowConfig)
    // At progress=0.5, slowStart gives t^2=0.25 (closer to current than linear 0.5)
    const mid = result[25] // age 65
    expect(mid[0]).toBeCloseTo(current[0] + (target[0] - current[0]) * 0.25, 5)
  })

  it('fastStart interpolation curves faster at start', () => {
    const fastConfig = { ...config, method: 'fastStart' as const }
    const result = buildYearlyWeights(30, 40, current, target, fastConfig)
    // At progress=0.5, fastStart gives sqrt(0.5)≈0.707 (closer to target than linear 0.5)
    const mid = result[25] // age 65
    const expected = current[0] + (target[0] - current[0]) * Math.sqrt(0.5)
    expect(mid[0]).toBeCloseTo(expected, 5)
  })

  it('weights sum to ~1.0 at all years', () => {
    const result = buildYearlyWeights(40, 40, current, target, config)
    for (const weights of result) {
      const sum = weights.reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1.0, 5)
    }
  })

  it('handles zero-duration glide path (startAge === endAge)', () => {
    const zeroConfig = { ...config, startAge: 60, endAge: 60 }
    const result = buildYearlyWeights(30, 40, current, target, zeroConfig)
    // All ages < 60 get currentWeights, age >= 60 gets targetWeights
    for (let i = 0; i < 20; i++) {
      result[i].forEach((w, j) => expect(w).toBeCloseTo(current[j], 5))
    }
    for (let i = 20; i < 30; i++) {
      result[i].forEach((w, j) => expect(w).toBeCloseTo(target[j], 5))
    }
  })

  it('returns defensive copies (not reference to input arrays)', () => {
    const result = buildYearlyWeights(5, 55, current, target, config)
    // Mutating result should not affect input
    result[0][0] = 999
    expect(current[0]).toBe(0.6)
  })
})

// Property-based tests
describe('property-based tests', () => {
  // Generate valid weights that sum to 1.0
  const weightsArb = fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { minLength: 8, maxLength: 8 })
    .map((arr) => {
      const sum = arr.reduce((a, b) => a + b, 0)
      if (sum === 0) return arr.map(() => 1 / 8)
      return arr.map((w) => w / sum)
    })

  it('portfolio return is within [min, max] of individual returns', () => {
    fc.assert(
      fc.property(weightsArb, (weights) => {
        const ret = calculatePortfolioReturn(weights, defaultReturns)
        const minRet = Math.min(...defaultReturns)
        const maxRet = Math.max(...defaultReturns)
        return ret >= minRet - 1e-10 && ret <= maxRet + 1e-10
      })
    )
  })

  it('portfolio stdDev is non-negative', () => {
    fc.assert(
      fc.property(weightsArb, (weights) => {
        const std = calculatePortfolioStdDev(weights, defaultStdDevs, CORRELATION_MATRIX)
        return std >= -1e-10
      })
    )
  })

  it('normalized weights always sum to 1.0', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 100, noNaN: true }), { minLength: 1, maxLength: 8 }),
        (weights) => {
          const normalized = normalizeWeights(weights)
          const sum = normalized.reduce((a, b) => a + b, 0)
          return Math.abs(sum - 1.0) < 1e-10
        }
      )
    )
  })
})
