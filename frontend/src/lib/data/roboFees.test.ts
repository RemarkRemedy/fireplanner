import { describe, it, expect } from 'vitest'
import { ROBO_FEES, getFeeRate, type PlatformFees } from './roboFees'

describe('ROBO_FEES', () => {
  it('contains 6 platforms', () => {
    expect(ROBO_FEES).toHaveLength(6)
  })

  it('every platform has at least one fee tier', () => {
    for (const platform of ROBO_FEES) {
      expect(platform.tiers.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('tiers are sorted ascending by minAmount', () => {
    for (const platform of ROBO_FEES) {
      for (let i = 1; i < platform.tiers.length; i++) {
        expect(platform.tiers[i].minAmount).toBeGreaterThan(platform.tiers[i - 1].minAmount)
      }
    }
  })

  it('SGFirePlanner has zero fees', () => {
    const sgfp = ROBO_FEES.find((p) => p.id === 'sgfireplanner')
    expect(sgfp).toBeDefined()
    expect(sgfp!.tiers[0].rate).toBe(0)
    expect(sgfp!.estimatedTer).toBe(0)
  })
})

describe('getFeeRate', () => {
  it('returns rate + estimatedTer for single-tier platform', () => {
    const endowus = ROBO_FEES.find((p) => p.id === 'endowus')!
    expect(getFeeRate(endowus, 100_000)).toBeCloseTo(0.004 + 0.003)
  })

  it('selects correct tier for multi-tier platform (StashAway)', () => {
    const stashaway = ROBO_FEES.find((p) => p.id === 'stashaway')!
    // Under $25K: 0.80% + 0.20% TER
    expect(getFeeRate(stashaway, 10_000)).toBeCloseTo(0.008 + 0.002)
    // At $50K boundary: 0.40% + 0.20% TER
    expect(getFeeRate(stashaway, 50_000)).toBeCloseTo(0.004 + 0.002)
    // At $500K boundary: 0.20% + 0.20% TER
    expect(getFeeRate(stashaway, 500_000)).toBeCloseTo(0.002 + 0.002)
  })

  it('selects correct tier for Syfe at boundary values', () => {
    const syfe = ROBO_FEES.find((p) => p.id === 'syfe')!
    // Below $50K: Blue tier 0.65%
    expect(getFeeRate(syfe, 49_999)).toBeCloseTo(0.0065 + 0.0015)
    // At $50K: Black tier 0.55%
    expect(getFeeRate(syfe, 50_000)).toBeCloseTo(0.0055 + 0.0015)
    // At $250K: Gold tier 0.45%
    expect(getFeeRate(syfe, 250_000)).toBeCloseTo(0.0045 + 0.0015)
  })

  it('returns zero total fee for SGFirePlanner', () => {
    const sgfp = ROBO_FEES.find((p) => p.id === 'sgfireplanner')!
    expect(getFeeRate(sgfp, 500_000)).toBe(0)
  })

  it('returns only estimatedTer for DIY (IBKR)', () => {
    const diy = ROBO_FEES.find((p) => p.id === 'diy-ibkr')!
    expect(getFeeRate(diy, 1_000_000)).toBe(0.0012)
  })

  it('returns estimatedTer when tiers array is empty', () => {
    const emptyTierPlatform: PlatformFees = {
      id: 'test',
      name: 'Test',
      tiers: [],
      estimatedTer: 0.005,
      supportsSrs: false,
      supportsCpfIs: false,
      sourceUrl: '',
    }
    expect(getFeeRate(emptyTierPlatform, 100_000)).toBe(0.005)
  })
})
