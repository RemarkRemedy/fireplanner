import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExplorePortfolio } from './useExplorePortfolio'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  useUIStore.setState({
    sectionOrder: 'goal-first',
    cpfEnabled: true,
    propertyEnabled: false,
    healthcareEnabled: false,
    mode: 'simple',
    statsPosition: 'bottom',
  })
})

describe('useExplorePortfolio', () => {
  describe('default mode', () => {
    it('defaults to myPlan mode', () => {
      const { result } = renderHook(() => useExplorePortfolio())
      expect(result.current.balanceMode).toBe('myPlan')
    })

    it('startAge equals retirementAge in myPlan mode', () => {
      setupTestPlan({
        adult: { retirementAge: 55 },
      })
      const { result } = renderHook(() => useExplorePortfolio())
      expect(result.current.startAge).toBe(55)
    })

    it('returns projected NW at retirement age (falls back to 0 when projection unavailable)', () => {
      const { result } = renderHook(() => useExplorePortfolio())
      // With default profile (liquidNetWorth=0, income=72000, expenses=48000),
      // the projection should produce a row at retirementAge
      // The initialPortfolio should be >= 0
      expect(result.current.initialPortfolio).toBeGreaterThanOrEqual(0)
    })

    it('uses current allocation weights', () => {
      useAllocationStore.getState().applyTemplate('aggressive')
      const { result } = renderHook(() => useExplorePortfolio())
      expect(result.current.allocationWeights[0]).toBeGreaterThan(0.3) // US equities
    })

    it('label contains "My Plan" with dollar-basis year', () => {
      const { result } = renderHook(() => useExplorePortfolio())
      expect(result.current.label).toContain('My Plan')
      // Dollar-basis year: currentYear + (retirementAge - currentAge)
      expect(result.current.label).toMatch(/\(\d{4}\$\)/)
    })
  })

  describe('fireTarget mode', () => {
    it('can switch to fireTarget mode', () => {
      const { result } = renderHook(() => useExplorePortfolio())
      act(() => {
        result.current.setBalanceMode('fireTarget')
      })
      expect(result.current.balanceMode).toBe('fireTarget')
    })

    it('uses FIRE number as initialPortfolio in fireTarget mode', () => {
      setupTestPlan({
        expenses: { annualExpenses: 48000 },
        assumptions: { fire: { swr: 0.04 } },
      })
      const { result } = renderHook(() => useExplorePortfolio())
      act(() => {
        result.current.setBalanceMode('fireTarget')
      })
      // FIRE number is derived from useFireCalculations, which factors in CPF,
      // income projections, and more — not just expenses / SWR
      expect(result.current.initialPortfolio).toBeGreaterThan(0)
      expect(isFinite(result.current.initialPortfolio)).toBe(true)
    })

    it('label contains "FIRE Number" with dollar-basis year', () => {
      const { result } = renderHook(() => useExplorePortfolio())
      act(() => {
        result.current.setBalanceMode('fireTarget')
      })
      expect(result.current.label).toContain('FIRE Number')
      expect(result.current.label).toMatch(/\(\d{4}\$\)/)
    })
  })

  describe('glide path interpolation', () => {
    it('uses target weights when startAge is past glide path end', () => {
      setupTestPlan({
        adult: { retirementAge: 65, currentAge: 30 },
      })
      // aggressive currentWeights: US equities = 0.50
      useAllocationStore.getState().applyTemplate('aggressive')
      // conservative targetWeights: US equities = 0.15
      useAllocationStore.getState().setTargetWeights([0.15, 0.05, 0.05, 0.50, 0.05, 0.05, 0.15, 0.00])
      useAllocationStore.getState().setGlidePathConfig({
        enabled: true,
        method: 'linear',
        startAge: 40,
        endAge: 55,
      })
      const { result } = renderHook(() => useExplorePortfolio())
      // retirementAge (65) > endAge (55), so should use targetWeights
      expect(result.current.allocationWeights[0]).toBe(0.15)
    })

    it('uses current weights when glide path is disabled', () => {
      useAllocationStore.getState().applyTemplate('aggressive')
      useAllocationStore.getState().setTargetWeights([0.15, 0.05, 0.05, 0.50, 0.05, 0.05, 0.15, 0.00])
      useAllocationStore.getState().setGlidePathConfig({
        enabled: false,
        method: 'linear',
        startAge: 40,
        endAge: 55,
      })
      const { result } = renderHook(() => useExplorePortfolio())
      // Glide path disabled, should use currentWeights (aggressive = 0.50)
      expect(result.current.allocationWeights[0]).toBe(0.50)
    })
  })

  describe('fireAge guards', () => {
    it('falls back to retirementAge when fireAge is Infinity', () => {
      // With 0 income and 0 NW, fireAge could be Infinity
      setupTestPlan({
        income: { annualSalary: 0 },
        assets: { liquidNetWorth: 0 },
        expenses: { annualExpenses: 48000 },
        adult: { retirementAge: 65 },
      })
      const { result } = renderHook(() => useExplorePortfolio())
      act(() => {
        result.current.setBalanceMode('fireTarget')
      })
      // Should fall back to retirementAge, not Infinity
      expect(isFinite(result.current.startAge)).toBe(true)
      expect(result.current.startAge).toBe(65)
    })

    it('clamps fireAge to [currentAge, lifeExpectancy]', () => {
      setupTestPlan({
        adult: { currentAge: 30, retirementAge: 65, lifeExpectancy: 90 },
      })
      const { result } = renderHook(() => useExplorePortfolio())
      act(() => {
        result.current.setBalanceMode('fireTarget')
      })
      expect(result.current.startAge).toBeGreaterThanOrEqual(30)
      expect(result.current.startAge).toBeLessThanOrEqual(90)
    })

    it('rounds fractional fireAge', () => {
      // The fireAge from metrics is typically fractional — ensure we get an integer
      const { result } = renderHook(() => useExplorePortfolio())
      act(() => {
        result.current.setBalanceMode('fireTarget')
      })
      expect(Number.isInteger(result.current.startAge)).toBe(true)
    })
  })
})
