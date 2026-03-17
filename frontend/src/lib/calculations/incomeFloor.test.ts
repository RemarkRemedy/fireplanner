import { describe, expect, it } from 'vitest'
import {
  guaranteedIncomeAtAge,
  buildGuaranteedIncomeArray,
} from './incomeFloor'
import type { IncomeSource } from '@/lib/household/types'

function makeGuaranteedStream(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'g1',
    owner: 'self',
    label: 'Private Annuity',
    kind: 'income-stream',
    timing: {
      kind: 'age-range',
      owner: 'self',
      startAge: 65,
      endAge: 90,
    },
    annualAmount: 24_000,
    growthRate: 0,
    growthModel: 'none',
    taxTreatment: 'tax-exempt',
    isCpfApplicable: false,
    isActive: true,
    streamType: 'investment',
    guaranteed: true,
    ...overrides,
  }
}

describe('guaranteedIncomeAtAge', () => {
  it('returns 0 before stream start age', () => {
    const streams = [makeGuaranteedStream()]
    expect(guaranteedIncomeAtAge(streams, 60, 35, 0.03)).toBe(0)
  })

  it('returns annual amount at start age with no growth', () => {
    const streams = [makeGuaranteedStream()]
    expect(guaranteedIncomeAtAge(streams, 65, 35, 0.03)).toBe(24_000)
  })

  it('returns 0 after end age (endAge is exclusive upper bound)', () => {
    const streams = [makeGuaranteedStream()]
    // endAge=90 means active at age 89, inactive at 90
    expect(guaranteedIncomeAtAge(streams, 90, 35, 0.03)).toBe(0)
  })

  it('returns amount at the last active age (endAge - 1)', () => {
    const streams = [makeGuaranteedStream()]
    expect(guaranteedIncomeAtAge(streams, 89, 35, 0.03)).toBe(24_000)
  })

  it('applies fixed growth model', () => {
    const streams = [makeGuaranteedStream({ growthRate: 0.02, growthModel: 'fixed' })]
    // At age 67, 2 years active: 24000 * (1.02)^2
    const expected = 24_000 * Math.pow(1.02, 2)
    expect(guaranteedIncomeAtAge(streams, 67, 35, 0.03)).toBeCloseTo(expected, 2)
  })

  it('applies inflation-linked growth model', () => {
    const streams = [makeGuaranteedStream({ growthModel: 'inflation-linked' })]
    // At age 67, 2 years active: 24000 * (1.03)^2
    const expected = 24_000 * Math.pow(1.03, 2)
    expect(guaranteedIncomeAtAge(streams, 67, 35, 0.03)).toBeCloseTo(expected, 2)
  })

  it('sums multiple guaranteed streams', () => {
    const streams = [
      makeGuaranteedStream({ id: 'g1', annualAmount: 24_000 }),
      makeGuaranteedStream({
        id: 'g2',
        label: 'Pension',
        annualAmount: 12_000,
        timing: { kind: 'age-range', owner: 'self', startAge: 60, endAge: 85 },
      }),
    ]
    // At age 65: both active => 24000 + 12000
    expect(guaranteedIncomeAtAge(streams, 65, 35, 0)).toBe(36_000)
    // At age 86: only g1 active => 24000
    expect(guaranteedIncomeAtAge(streams, 86, 35, 0)).toBe(24_000)
  })

  it('excludes inactive streams', () => {
    const streams = [makeGuaranteedStream({ isActive: false })]
    expect(guaranteedIncomeAtAge(streams, 70, 35, 0)).toBe(0)
  })

  it('excludes non-guaranteed streams', () => {
    const streams = [makeGuaranteedStream({ guaranteed: false })]
    expect(guaranteedIncomeAtAge(streams, 70, 35, 0)).toBe(0)
  })

  it('handles null endAge (ongoing stream)', () => {
    const streams = [makeGuaranteedStream({
      timing: { kind: 'age-range', owner: 'self', startAge: 65, endAge: null },
    })]
    expect(guaranteedIncomeAtAge(streams, 100, 35, 0)).toBe(24_000)
  })
})

describe('buildGuaranteedIncomeArray', () => {
  it('returns correct length array from retirement to life expectancy', () => {
    const streams = [makeGuaranteedStream()]
    const result = buildGuaranteedIncomeArray(streams, 65, 35, 90, 0)
    // From retirement age 65 to life expectancy 90 = 26 years (65..90 inclusive)
    expect(result).toHaveLength(26)
  })

  it('has zeroes before stream starts relative to retirement', () => {
    const streams = [makeGuaranteedStream({
      timing: { kind: 'age-range', owner: 'self', startAge: 70, endAge: 90 },
    })]
    const result = buildGuaranteedIncomeArray(streams, 65, 35, 90, 0)
    // Years 0-4 (ages 65-69) should be 0
    expect(result[0]).toBe(0)
    expect(result[4]).toBe(0)
    // Year 5 (age 70) should have income
    expect(result[5]).toBe(24_000)
  })

  it('correctly indexes by retirement year offset', () => {
    const streams = [makeGuaranteedStream()]
    const result = buildGuaranteedIncomeArray(streams, 65, 35, 90, 0)
    // Index 0 = age 65 (retirement), should have 24000
    expect(result[0]).toBe(24_000)
    // Index 24 = age 89 (last active year), should have 24000
    expect(result[24]).toBe(24_000)
    // Index 25 = age 90 (endAge, exclusive), should be 0
    expect(result[25]).toBe(0)
  })

  it('applies inflation over time', () => {
    const streams = [makeGuaranteedStream({ growthModel: 'inflation-linked' })]
    const result = buildGuaranteedIncomeArray(streams, 65, 35, 90, 0.03)
    // Index 0 = age 65, 0 years active from stream start: 24000
    expect(result[0]).toBeCloseTo(24_000, 2)
    // Index 5 = age 70, 5 years active: 24000 * 1.03^5
    expect(result[5]).toBeCloseTo(24_000 * Math.pow(1.03, 5), 2)
  })

  it('returns empty array when retirementAge > lifeExpectancy', () => {
    const streams = [makeGuaranteedStream()]
    const result = buildGuaranteedIncomeArray(streams, 95, 35, 90, 0)
    expect(result).toHaveLength(0)
  })

  it('returns all-zero array when no guaranteed streams', () => {
    const result = buildGuaranteedIncomeArray([], 65, 35, 90, 0)
    expect(result).toHaveLength(26)
    expect(result.every((v) => v === 0)).toBe(true)
  })
})
