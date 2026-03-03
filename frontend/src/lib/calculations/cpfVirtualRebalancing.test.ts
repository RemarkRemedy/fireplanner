import { describe, it, expect } from 'vitest'
import { computeVirtualRebalancing, type VirtualRebalancingInput } from './cpfVirtualRebalancing'

describe('computeVirtualRebalancing', () => {
  // 8 asset classes: US Eq, SG Eq, Intl Eq, Bonds, REITs, Gold, Cash, CPF
  const baseWeights = [0.30, 0.10, 0.20, 0.20, 0.05, 0.05, 0.05, 0.05]

  const baseInput: VirtualRebalancingInput = {
    weights: baseWeights,
    liquidNW: 800000,
    cpfOA: 200000,
    cpfSA: 100000,
    cpfRA: 500000,  // well above FRS, so full OA/SA available
    cpfisOA: 0,
    cpfisSA: 0,
    age: 60,
    currentYear: 2031,
    mode: 'from55',
    includeSA: true,
  }

  it('adjusts weights when CPF is counted as bonds', () => {
    const result = computeVirtualRebalancing(baseInput)
    expect(result.adjustedWeights.length).toBe(8)
    // Bond+Cash+CPF weights should be reduced
    const originalBondCash = 0.20 + 0.05 + 0.05
    const adjustedBondCash = result.adjustedWeights[3] + result.adjustedWeights[6] + result.adjustedWeights[7]
    expect(adjustedBondCash).toBeLessThan(originalBondCash)
    // Equity weights should be increased
    const originalEquity = 0.30 + 0.10 + 0.20
    const adjustedEquity = result.adjustedWeights[0] + result.adjustedWeights[1] + result.adjustedWeights[2]
    expect(adjustedEquity).toBeGreaterThan(originalEquity)
    // Total should still sum to 1.0
    const total = result.adjustedWeights.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1.0, 10)
    // cpfCountedAsBonds should be 300K
    expect(result.cpfCountedAsBonds).toBe(300000)
  })

  it('returns original weights when mode is from55 and age < 55', () => {
    const result = computeVirtualRebalancing({ ...baseInput, age: 50, mode: 'from55' })
    expect(result.adjustedWeights).toEqual(baseWeights)
    expect(result.cpfCountedAsBonds).toBe(0)
  })

  it('adjusts weights when mode is always even before 55', () => {
    const result = computeVirtualRebalancing({ ...baseInput, age: 45, mode: 'always' })
    expect(result.cpfCountedAsBonds).toBeGreaterThan(0)
    const total = result.adjustedWeights.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1.0, 10)
  })

  it('excludes CPFIS-invested amounts', () => {
    const result = computeVirtualRebalancing({
      ...baseInput,
      cpfisOA: 150000, // 150K of 200K OA is invested
    })
    // Only 50K OA uninvested + 100K SA = 150K as bonds (not 300K)
    expect(result.cpfCountedAsBonds).toBe(150000)
  })

  it('returns original weights when liquidNW is 0', () => {
    const result = computeVirtualRebalancing({ ...baseInput, liquidNW: 0 })
    expect(result.adjustedWeights).toEqual(baseWeights)
  })

  it('handles CPF covering more than full bond target', () => {
    const result = computeVirtualRebalancing({
      ...baseInput,
      cpfOA: 400000,
      cpfSA: 100000,
      liquidNW: 500000,
    })
    // Bond+Cash+CPF in liquid should be near 0
    const adjustedBondCash = result.adjustedWeights[3] + result.adjustedWeights[6] + result.adjustedWeights[7]
    expect(adjustedBondCash).toBeCloseTo(0, 5)
    const total = result.adjustedWeights.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1.0, 10)
  })

  it('does not modify weights when no uninvested CPF', () => {
    const result = computeVirtualRebalancing({
      ...baseInput,
      cpfOA: 200000,
      cpfisOA: 200000,
      cpfSA: 100000,
      cpfisSA: 100000,
    })
    expect(result.adjustedWeights).toEqual(baseWeights)
    expect(result.cpfCountedAsBonds).toBe(0)
  })
})
