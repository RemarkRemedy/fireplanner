import { describe, it, expect } from 'vitest'
import { computeCpfAutoFallback, type CpfAutoFallbackInput } from './cpfAutoWithdrawal'
import { FRS_BASE, BRS_GROWTH_RATE, RETIREMENT_SUM_BASE_YEAR } from '@/lib/data/cpfRates'

describe('computeCpfAutoFallback', () => {
  const baseInput: CpfAutoFallbackInput = {
    shortfall: 50000,
    cpfOA: 200000,
    cpfSA: 100000,
    cpfRA: 250000,
    cpfisOA: 0,
    cpfisSA: 0,
    age: 60,
    currentYear: 2031,
    includeSA: true,
  }

  it('withdraws from OA to cover shortfall', () => {
    const result = computeCpfAutoFallback(baseInput)
    expect(result.oaWithdrawal).toBe(50000)
    expect(result.saWithdrawal).toBe(0)
    expect(result.totalWithdrawal).toBe(50000)
  })

  it('caps OA withdrawal at available OA balance', () => {
    // Set cpfRA well above FRS so raGap=0 and OA is fully withdrawable
    const result = computeCpfAutoFallback({ ...baseInput, cpfOA: 30000, cpfRA: 500000 })
    expect(result.oaWithdrawal).toBe(30000)
    expect(result.saWithdrawal).toBe(20000)
    expect(result.totalWithdrawal).toBe(50000)
  })

  it('respects FRS retention — cannot withdraw OA if RA below FRS', () => {
    const frs = FRS_BASE * Math.pow(1 + BRS_GROWTH_RATE, Math.max(0, 55 - 60) + Math.max(0, 2031 - RETIREMENT_SUM_BASE_YEAR))
    const result = computeCpfAutoFallback({
      ...baseInput,
      cpfRA: 100000,
      cpfOA: 200000,
    })
    const raGap = Math.max(0, frs - 100000)
    const expectedOA = Math.min(50000, Math.max(0, 200000 - raGap))
    expect(result.oaWithdrawal).toBe(expectedOA)
  })

  it('skips SA when includeSA is false', () => {
    // Set cpfRA well above FRS so raGap=0 and OA is fully withdrawable
    const result = computeCpfAutoFallback({
      ...baseInput,
      cpfOA: 10000,
      cpfRA: 500000,
      shortfall: 50000,
      includeSA: false,
    })
    expect(result.oaWithdrawal).toBe(10000)
    expect(result.saWithdrawal).toBe(0)
    expect(result.totalWithdrawal).toBe(10000)
  })

  it('returns zero when no shortfall', () => {
    const result = computeCpfAutoFallback({ ...baseInput, shortfall: 0 })
    expect(result.oaWithdrawal).toBe(0)
    expect(result.saWithdrawal).toBe(0)
    expect(result.totalWithdrawal).toBe(0)
  })

  it('excludes CPFIS-invested amounts from withdrawable OA', () => {
    const result = computeCpfAutoFallback({
      ...baseInput,
      cpfOA: 200000,
      cpfisOA: 150000,
      shortfall: 80000,
    })
    expect(result.oaWithdrawal).toBeLessThanOrEqual(50000)
  })

  it('does not withdraw more than the shortfall', () => {
    const result = computeCpfAutoFallback({
      ...baseInput,
      cpfOA: 500000,
      shortfall: 10000,
    })
    expect(result.totalWithdrawal).toBe(10000)
  })

  it('handles age < 55 by returning zero', () => {
    const result = computeCpfAutoFallback({ ...baseInput, age: 50 })
    expect(result.totalWithdrawal).toBe(0)
  })
})
