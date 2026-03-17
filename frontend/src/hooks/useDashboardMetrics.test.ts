import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardMetrics } from './useDashboardMetrics'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  usePropertyStore.getState().reset()
})

describe('useDashboardMetrics', () => {
  it('computes non-null metrics with valid profile', () => {
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.fireNumber).not.toBeNull()
    expect(result.current.fireNumber).toBeGreaterThan(0)
  })

  it('returns all null when profile has errors', () => {
    useProfileStore.getState().setField('currentAge', 15)
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.fireNumber).toBeNull()
    expect(result.current.progress).toBeNull()
    expect(result.current.yearsToFire).toBeNull()
  })

  it('progress percentage matches NW / FIRE number', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      liquidNetWorth: 500000,
      cpfOA: 200000,
      cpfSA: 100000,
      cpfMA: 50000,
      annualExpenses: 48000,
      swr: 0.04,
      fireNumberBasis: 'today',
      fireType: 'regular',
      retirementSpendingAdjustment: 1.0,
      usePortfolioReturn: false,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.progress).not.toBeNull()
    // NW = 850K, FIRE = 48000/0.04 = 1.2M → progress ~71%
    expect(result.current.progress!).toBeCloseTo(0.708, 1)
  })

  it('totalNetWorth includes liquid + CPF balances', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      liquidNetWorth: 500000,
      cpfOA: 100000,
      cpfSA: 50000,
      cpfMA: 30000,
      validationErrors: {},
    })
    const { result } = renderHook(() => useDashboardMetrics())
    expect(result.current.totalNetWorth).toBe(680000)
  })

  it('totalNetWorth includes cpfRA', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      liquidNetWorth: 500000,
      cpfOA: 100000,
      cpfSA: 0,
      cpfMA: 30000,
      cpfRA: 200000,
      validationErrors: {},
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
