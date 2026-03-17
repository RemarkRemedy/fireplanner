import { describe, it, expect } from 'vitest'
import { computeGuardrailStatus, type GuardrailStatusInput } from './guardrailStatus'

const BASE_INPUT: GuardrailStatusInput = {
  portfolioValue: 1_000_000,
  annualWithdrawal: 50_000,
  initialRate: 0.05,
  ceilingTrigger: 1.20,
  floorTrigger: 0.80,
  adjustmentSize: 0.10,
}

describe('computeGuardrailStatus', () => {
  it('returns null for zero portfolio', () => {
    expect(computeGuardrailStatus({ ...BASE_INPUT, portfolioValue: 0 })).toBeNull()
  })

  it('returns null for negative portfolio', () => {
    expect(computeGuardrailStatus({ ...BASE_INPUT, portfolioValue: -100 })).toBeNull()
  })

  it('returns null for zero withdrawal', () => {
    expect(computeGuardrailStatus({ ...BASE_INPUT, annualWithdrawal: 0 })).toBeNull()
  })

  it('returns null for zero initialRate', () => {
    expect(computeGuardrailStatus({ ...BASE_INPUT, initialRate: 0 })).toBeNull()
  })

  describe('comfort zone', () => {
    it('detects comfort zone when withdrawal rate is at initialRate', () => {
      // 50k / 1M = 0.05 = initialRate, well within floor (0.04) and ceiling (0.06)
      const result = computeGuardrailStatus(BASE_INPUT)!
      expect(result.zone).toBe('comfort')
      expect(result.currentRate).toBeCloseTo(0.05)
      expect(result.ceilingRate).toBeCloseTo(0.06)
      expect(result.floorRate).toBeCloseTo(0.04)
      expect(result.suggestedMonthlyAdjustment).toBe(0)
      // At midpoint, distanceToEdge should be 1
      expect(result.distanceToEdge).toBeCloseTo(1)
    })

    it('returns distanceToEdge near 0 when close to ceiling', () => {
      // withdrawal rate = 59k / 1M = 0.059, ceiling = 0.06
      const result = computeGuardrailStatus({ ...BASE_INPUT, annualWithdrawal: 59_000 })!
      expect(result.zone).toBe('comfort')
      expect(result.distanceToEdge).toBeCloseTo(0.1, 1)
    })

    it('returns distanceToEdge near 0 when close to floor', () => {
      // withdrawal rate = 41k / 1M = 0.041, floor = 0.04
      const result = computeGuardrailStatus({ ...BASE_INPUT, annualWithdrawal: 41_000 })!
      expect(result.zone).toBe('comfort')
      expect(result.distanceToEdge).toBeCloseTo(0.1, 1)
    })
  })

  describe('cut zone (above ceiling)', () => {
    it('detects cut zone when withdrawal rate exceeds ceiling', () => {
      // 70k / 1M = 0.07 > ceiling of 0.06
      const result = computeGuardrailStatus({ ...BASE_INPUT, annualWithdrawal: 70_000 })!
      expect(result.zone).toBe('cut')
      expect(result.currentRate).toBeCloseTo(0.07)
      // Suggest cutting 10% of 70k/12 = ~583/month
      expect(result.suggestedMonthlyAdjustment).toBeCloseTo(-70_000 * 0.10 / 12)
      expect(result.distanceToEdge).toBeLessThan(0)
    })

    it('works with small portfolio (high withdrawal rate)', () => {
      const result = computeGuardrailStatus({
        ...BASE_INPUT,
        portfolioValue: 500_000,
        annualWithdrawal: 50_000,
      })!
      // 50k / 500k = 0.10 > ceiling of 0.06
      expect(result.zone).toBe('cut')
      expect(result.currentRate).toBeCloseTo(0.10)
    })
  })

  describe('raise zone (below floor)', () => {
    it('detects raise zone when withdrawal rate is below floor', () => {
      // 30k / 1M = 0.03 < floor of 0.04
      const result = computeGuardrailStatus({ ...BASE_INPUT, annualWithdrawal: 30_000 })!
      expect(result.zone).toBe('raise')
      expect(result.currentRate).toBeCloseTo(0.03)
      // Suggest raising 10% of 30k/12 = 250/month
      expect(result.suggestedMonthlyAdjustment).toBeCloseTo(30_000 * 0.10 / 12)
      expect(result.distanceToEdge).toBeLessThan(0)
    })

    it('works with large portfolio (low withdrawal rate)', () => {
      const result = computeGuardrailStatus({
        ...BASE_INPUT,
        portfolioValue: 2_000_000,
        annualWithdrawal: 50_000,
      })!
      // 50k / 2M = 0.025 < floor of 0.04
      expect(result.zone).toBe('raise')
      expect(result.currentRate).toBeCloseTo(0.025)
    })
  })

  describe('boundary cases', () => {
    it('exactly at ceiling rate is comfort (not cut)', () => {
      // 60k / 1M = 0.06 = ceiling
      const result = computeGuardrailStatus({ ...BASE_INPUT, annualWithdrawal: 60_000 })!
      // currentRate === ceilingRate, not strictly >, so comfort
      expect(result.zone).toBe('comfort')
    })

    it('exactly at floor rate may trigger raise due to floating point', () => {
      // 40k / 1M = 0.04, but 0.05 * 0.80 = 0.04000000000000001 (floating point)
      // So currentRate (0.04) < floorRate (0.04000000000000001) -> 'raise'
      // This matches withdrawal.ts guardrails() behavior
      const result = computeGuardrailStatus({ ...BASE_INPUT, annualWithdrawal: 40_000 })!
      expect(result.zone).toBe('raise')
    })
  })

  describe('output shape', () => {
    it('includes all expected fields', () => {
      const result = computeGuardrailStatus(BASE_INPUT)!
      expect(result).toHaveProperty('zone')
      expect(result).toHaveProperty('currentRate')
      expect(result).toHaveProperty('ceilingRate')
      expect(result).toHaveProperty('floorRate')
      expect(result).toHaveProperty('distanceToEdge')
      expect(result).toHaveProperty('suggestedMonthlyAdjustment')
      expect(result).toHaveProperty('adjustmentSize')
    })

    it('passes through adjustmentSize', () => {
      const result = computeGuardrailStatus({ ...BASE_INPUT, adjustmentSize: 0.15 })!
      expect(result.adjustmentSize).toBe(0.15)
    })
  })
})
