import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardMetrics } from './useDashboardMetrics'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
})

describe('useDashboardMetrics', () => {
  it('computes non-null metrics with valid profile', () => {
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.fireNumber).not.toBeNull()
    expect(result.current.fireNumber).toBeGreaterThan(0)
  })

  it('returns all null when profile has errors', () => {
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 20 },
    })
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.fireNumber).toBeNull()
    expect(result.current.progress).toBeNull()
    expect(result.current.yearsToFire).toBeNull()
  })

  it('progress percentage matches NW / FIRE number', () => {
    setupTestPlan({
      adult: {
        cpfOA: 200000,
        cpfSA: 100000,
        cpfMA: 50000,
        parentSupportEnabled: false,
        healthcareConfig: { enabled: false, ispTier: 'none', mediSaveTopUpAnnual: 0, lifeExpectancy: 90 },
      },
      expenses: {
        annualExpenses: 48000,
        retirementSpendingAdjustment: 1.0,
        parentSupportEnabled: false,
        parentSupport: [],
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
        returns: { usePortfolioReturn: false },
      },
      assets: { liquidNetWorth: 500000 },
    })
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.progress).not.toBeNull()
    // NW = 850K, FIRE = 48000/0.04 = 1.2M → progress ~71%
    expect(result.current.progress!).toBeCloseTo(0.708, 1)
  })

  it('totalNetWorth includes liquid + CPF balances', () => {
    setupTestPlan({
      assets: { liquidNetWorth: 500000 },
      adult: {
        cpfOA: 100000,
        cpfSA: 50000,
        cpfMA: 30000,
      },
    })
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.totalNetWorth).toBe(680000)
  })

  it('totalNetWorth includes cpfRA', () => {
    setupTestPlan({
      assets: { liquidNetWorth: 500000 },
      adult: {
        cpfOA: 100000,
        cpfSA: 0,
        cpfMA: 30000,
        cpfRA: 200000,
      },
    })
    const { result } = renderHook(() => useDashboardMetrics())
    // 500K + 100K + 0 + 30K + 200K = 830K
    expect(result.current.totalNetWorth).toBe(830000)
  })

  it('savingsRate is computed', () => {
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.savingsRate).not.toBeNull()
    // Default: income 72000, expenses 48000 → savings rate ~33%
    expect(result.current.savingsRate!).toBeGreaterThan(0)
  })
})
