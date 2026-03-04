import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { percentile, percentiles, studentTQuantile } from './stats'

describe('percentile', () => {
  // numpy.percentile with method='linear' (default)
  // Reference values verified against numpy 2.x

  it('returns min and max for p=0 and p=100', () => {
    const data = [10, 20, 30, 40, 50]
    expect(percentile(data, 0)).toBe(10)
    expect(percentile(data, 100)).toBe(50)
  })

  it('computes median (p=50) for odd-length array', () => {
    const data = [10, 20, 30, 40, 50]
    expect(percentile(data, 50)).toBe(30)
  })

  it('computes median (p=50) for even-length array', () => {
    const data = [10, 20, 30, 40]
    expect(percentile(data, 50)).toBe(25)
  })

  it('matches numpy for p=25 on [15, 20, 35, 40, 50]', () => {
    // numpy.percentile([15, 20, 35, 40, 50], 25) = 20.0
    const data = [15, 20, 35, 40, 50]
    expect(percentile(data, 25)).toBeCloseTo(20.0, 10)
  })

  it('matches numpy for p=75 on [15, 20, 35, 40, 50]', () => {
    // numpy.percentile([15, 20, 35, 40, 50], 75) = 40.0
    const data = [15, 20, 35, 40, 50]
    expect(percentile(data, 75)).toBeCloseTo(40.0, 10)
  })

  it('matches numpy for p=10 on range 1-10', () => {
    // numpy.percentile([1,2,3,4,5,6,7,8,9,10], 10) = 1.9
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(data, 10)).toBeCloseTo(1.9, 10)
  })

  it('matches numpy for p=90 on range 1-10', () => {
    // numpy.percentile([1,2,3,4,5,6,7,8,9,10], 90) = 9.1
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(data, 90)).toBeCloseTo(9.1, 10)
  })

  it('works with unsorted input', () => {
    const data = [50, 10, 40, 20, 30]
    expect(percentile(data, 50)).toBe(30)
  })

  it('works with single-element array', () => {
    expect(percentile([42], 0)).toBe(42)
    expect(percentile([42], 50)).toBe(42)
    expect(percentile([42], 100)).toBe(42)
  })

  it('works with two-element array', () => {
    // numpy.percentile([10, 20], 25) = 12.5
    const data = [10, 20]
    expect(percentile(data, 25)).toBeCloseTo(12.5, 10)
  })

  it('does not mutate input array', () => {
    const data = [50, 10, 30, 20, 40]
    const copy = [...data]
    percentile(data, 50)
    expect(data).toEqual(copy)
  })

  it('handles duplicate values', () => {
    // numpy.percentile([5, 5, 5, 5], 50) = 5.0
    const data = [5, 5, 5, 5]
    expect(percentile(data, 50)).toBe(5)
  })

  it('matches numpy for fractional percentiles', () => {
    // numpy.percentile([1,2,3,4,5,6,7,8,9,10], 33) = 3.97
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(data, 33)).toBeCloseTo(3.97, 10)
  })

  it('property: monotonically non-decreasing with p', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1000, max: 1000, noNaN: true }), { minLength: 2, maxLength: 50 }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (data, p1, p2) => {
          const lower = Math.min(p1, p2)
          const higher = Math.max(p1, p2)
          return percentile(data, higher) >= percentile(data, lower) - 1e-10
        },
      ),
    )
  })

  it('property: result is bounded by min and max of data', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1000, max: 1000, noNaN: true }), { minLength: 1, maxLength: 50 }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (data, p) => {
          const result = percentile(data, p)
          const min = Math.min(...data)
          const max = Math.max(...data)
          return result >= min - 1e-10 && result <= max + 1e-10
        },
      ),
    )
  })
})

describe('percentiles', () => {
  it('matches repeated percentile() calls for common band targets', () => {
    const data = [10, 20, 30, 40, 50, 60, 70]
    const targets = [5, 10, 25, 50, 75, 90, 95] as const

    const batch = percentiles(data, targets)
    const individual = targets.map((target) => percentile(data, target))

    expect(batch).toEqual(individual)
  })

  it('does not mutate input array', () => {
    const data = [50, 10, 30, 20, 40]
    const copy = [...data]

    percentiles(data, [10, 50, 90])
    expect(data).toEqual(copy)
  })
})

describe('studentTQuantile', () => {
  // Reference values from scipy.stats.t.ppf
  // Approximation should be accurate to within ~1% for common df and p values

  it('returns 0 for p=0.5 (median of symmetric distribution)', () => {
    expect(studentTQuantile(0.5, 5)).toBeCloseTo(0, 2)
    expect(studentTQuantile(0.5, 30)).toBeCloseTo(0, 2)
    expect(studentTQuantile(0.5, 100)).toBeCloseTo(0, 2)
  })

  it('approximates scipy for p=0.95, df=5', () => {
    // scipy.stats.t.ppf(0.95, 5) ≈ 2.0150
    expect(studentTQuantile(0.95, 5)).toBeCloseTo(2.015, 1)
  })

  it('approximates scipy for p=0.975, df=5', () => {
    // scipy.stats.t.ppf(0.975, 5) ≈ 2.5706
    expect(studentTQuantile(0.975, 5)).toBeCloseTo(2.571, 1)
  })

  it('approximates scipy for p=0.05, df=5 (left tail)', () => {
    // scipy.stats.t.ppf(0.05, 5) ≈ -2.0150
    expect(studentTQuantile(0.05, 5)).toBeCloseTo(-2.015, 1)
  })

  it('approximates scipy for p=0.95, df=10', () => {
    // scipy.stats.t.ppf(0.95, 10) ≈ 1.8125
    expect(studentTQuantile(0.95, 10)).toBeCloseTo(1.812, 1)
  })

  it('approximates scipy for p=0.99, df=5', () => {
    // scipy.stats.t.ppf(0.99, 5) ≈ 3.3649
    expect(studentTQuantile(0.99, 5)).toBeCloseTo(3.365, 0)
  })

  it('converges to normal quantile for large df', () => {
    // For df=1000, t distribution ≈ normal
    // scipy.stats.norm.ppf(0.975) ≈ 1.96
    expect(studentTQuantile(0.975, 1000)).toBeCloseTo(1.96, 1)
  })

  it('is antisymmetric: Q(p) = -Q(1-p)', () => {
    const df = 5
    for (const p of [0.01, 0.05, 0.10, 0.25]) {
      const lower = studentTQuantile(p, df)
      const upper = studentTQuantile(1 - p, df)
      expect(lower).toBeCloseTo(-upper, 2)
    }
  })

  it('is monotonically increasing in p', () => {
    const df = 5
    const ps = [0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99]
    for (let i = 1; i < ps.length; i++) {
      expect(studentTQuantile(ps[i], df)).toBeGreaterThan(
        studentTQuantile(ps[i - 1], df)
      )
    }
  })
})
