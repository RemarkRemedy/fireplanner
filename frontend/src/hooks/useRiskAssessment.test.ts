import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRiskAssessment } from './useRiskAssessment'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
})

describe('useRiskAssessment', () => {
  it('returns 6 risk dimensions', () => {
    const { result } = renderHook(() => useRiskAssessment())
    expect(result.current).toHaveLength(6)
    const ids = result.current.map((d) => d.id)
    expect(ids).toContain('sequence')
    expect(ids).toContain('inflation')
    expect(ids).toContain('longevity')
    expect(ids).toContain('currency')
    expect(ids).toContain('healthcare')
    expect(ids).toContain('concentration')
  })

  it('high concentration risk with 100% US equities', () => {
    useAllocationStore.getState().setCurrentWeights([1, 0, 0, 0, 0, 0, 0, 0])
    const { result } = renderHook(() => useRiskAssessment())
    const concentration = result.current.find((d) => d.id === 'concentration')
    expect(concentration!.level).toBe('high')
  })

  it('high longevity risk with 60-year retirement duration', () => {
    setupTestPlan({
      adult: {
        retirementAge: 35,
        lifeExpectancy: 95, // 60 year duration
      },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const longevity = result.current.find((d) => d.id === 'longevity')
    expect(longevity!.level).toBe('high')
  })

  it('low inflation risk with inflation < 2%', () => {
    setupTestPlan({
      assumptions: { returns: { inflation: 0.015 } },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const inflation = result.current.find((d) => d.id === 'inflation')
    expect(inflation!.level).toBe('low')
  })

  it('high inflation risk with inflation >= 4%', () => {
    setupTestPlan({
      assumptions: { returns: { inflation: 0.05 } },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const inflation = result.current.find((d) => d.id === 'inflation')
    expect(inflation!.level).toBe('high')
  })

  it('high sequence risk with equity > 70% and duration > 25', () => {
    // Set aggressive allocation: 80% equity
    useAllocationStore.getState().setCurrentWeights([0.40, 0.20, 0.20, 0.10, 0.05, 0.05, 0, 0])
    setupTestPlan({
      adult: {
        retirementAge: 55,
        lifeExpectancy: 90, // 35 year duration
      },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const sequence = result.current.find((d) => d.id === 'sequence')
    expect(sequence!.level).toBe('high')
  })

  it('low sequence risk with low equity allocation', () => {
    // Conservative: 20% equity
    useAllocationStore.getState().setCurrentWeights([0.10, 0.05, 0.05, 0.50, 0.05, 0.05, 0.15, 0.05])
    const { result } = renderHook(() => useRiskAssessment())
    const sequence = result.current.find((d) => d.id === 'sequence')
    expect(sequence!.level).toBe('low')
  })

  it('high currency risk when US equities > 50%', () => {
    useAllocationStore.getState().setCurrentWeights([0.60, 0, 0, 0.30, 0, 0, 0.10, 0])
    const { result } = renderHook(() => useRiskAssessment())
    const currency = result.current.find((d) => d.id === 'currency')
    expect(currency!.level).toBe('high')
  })

  it('healthcare risk low when normalized healthcare slot has no cash outlay (no healthcare config)', () => {
    // With the normalized household architecture, healthcare risk is determined
    // by the compiled healthcare slot's averageRetirementCashOutlay. When
    // healthcare is not explicitly enabled, the slot produces $0 cash outlay,
    // resulting in 'low' risk regardless of cpfMA balance.
    setupTestPlan({
      adult: { cpfMA: 20000 },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const healthcare = result.current.find((d) => d.id === 'healthcare')
    expect(healthcare!.level).toBe('low')
  })

  it('healthcare risk low when cpfMA >= $100K (no healthcare config)', () => {
    setupTestPlan({
      adult: { cpfMA: 150000 },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const healthcare = result.current.find((d) => d.id === 'healthcare')
    expect(healthcare!.level).toBe('low')
  })

  it('healthcare risk uses projection when healthcare config enabled', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        healthcareConfig: {
          enabled: true,
          mediShieldLifeEnabled: true,
          ispTier: 'none',
          careShieldLifeEnabled: true,
          oopBaseAmount: 5000,
          oopModel: 'age-curve',
          oopInflationRate: 0.05,
          oopReferenceAge: 55,
          mediSaveTopUpAnnual: 0,
        },
      },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const healthcare = result.current.find((d) => d.id === 'healthcare')
    // With healthcare config enabled, uses generateHealthcareProjection
    expect(healthcare).toBeDefined()
    expect(['low', 'medium', 'high']).toContain(healthcare!.level)
    // Description should contain $ amount from projection
    expect(healthcare!.description).toMatch(/\$/)
  })

  it('healthcare risk high with enabled config and high OOP base', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        healthcareConfig: {
          enabled: true,
          mediShieldLifeEnabled: true,
          ispTier: 'none',
          careShieldLifeEnabled: false,
          oopBaseAmount: 15000,
          oopModel: 'age-curve',
          oopInflationRate: 0.05,
          oopReferenceAge: 55,
          mediSaveTopUpAnnual: 0,
        },
      },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const healthcare = result.current.find((d) => d.id === 'healthcare')
    // High OOP base ($15K) + medical inflation -> high risk
    expect(healthcare!.level).toBe('high')
  })

  it('healthcare risk medium with moderate OOP base (enabled config)', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        healthcareConfig: {
          enabled: true,
          mediShieldLifeEnabled: true,
          ispTier: 'none',
          careShieldLifeEnabled: false,
          oopBaseAmount: 5000,
          oopModel: 'flat' as 'age-curve',
          oopInflationRate: 0.02,
          oopReferenceAge: 55,
          mediSaveTopUpAnnual: 0,
        },
      },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const healthcare = result.current.find((d) => d.id === 'healthcare')
    // Moderate OOP base ($5K) with low inflation should produce medium risk
    // (avgAnnualCash between $5K and $10K)
    expect(healthcare!.level).toBe('medium')
    expect(healthcare!.recommendation).toMatch(/moderate/i)
  })

  it('healthcare risk low with small OOP base and MediSave top-up (enabled config)', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        healthcareConfig: {
          enabled: true,
          mediShieldLifeEnabled: true,
          ispTier: 'none',
          careShieldLifeEnabled: false,
          oopBaseAmount: 1000,
          oopModel: 'flat' as 'age-curve',
          oopInflationRate: 0.02,
          oopReferenceAge: 55,
          mediSaveTopUpAnnual: 500,
        },
      },
    })
    const { result } = renderHook(() => useRiskAssessment())
    const healthcare = result.current.find((d) => d.id === 'healthcare')
    // Small OOP base ($1K) with MediSave top-ups should produce low risk
    // (avgAnnualCash <= $5K)
    expect(healthcare!.level).toBe('low')
    expect(healthcare!.recommendation).toMatch(/well covered/i)
  })
})
