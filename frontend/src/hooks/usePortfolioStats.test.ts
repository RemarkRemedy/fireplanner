import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePortfolioStats } from './usePortfolioStats'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
})

describe('usePortfolioStats', () => {
  it('returns stats with valid defaults', () => {
    const { result } = renderHook(() => usePortfolioStats())
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.currentStats).not.toBeNull()
    expect(result.current.targetStats).not.toBeNull()
  })

  it('currentStats has positive expected return and stdDev', () => {
    const { result } = renderHook(() => usePortfolioStats())
    const stats = result.current.currentStats!
    expect(stats.expectedReturn).toBeGreaterThan(0)
    expect(stats.stdDev).toBeGreaterThan(0)
    expect(stats.sharpe).toBeGreaterThan(0)
  })

  it('conservative allocation has lower return and volatility than aggressive', () => {
    // Set conservative allocation (more bonds)
    useAllocationStore.getState().applyTemplate('conservative')
    const { result: conservative } = renderHook(() => usePortfolioStats())
    const conservativeReturn = conservative.current.currentStats!.expectedReturn
    const conservativeStdDev = conservative.current.currentStats!.stdDev

    // Set aggressive allocation (more equities)
    useAllocationStore.getState().applyTemplate('aggressive')
    const { result: aggressive } = renderHook(() => usePortfolioStats())
    const aggressiveReturn = aggressive.current.currentStats!.expectedReturn
    const aggressiveStdDev = aggressive.current.currentStats!.stdDev

    expect(aggressiveReturn).toBeGreaterThan(conservativeReturn)
    expect(aggressiveStdDev).toBeGreaterThan(conservativeStdDev)
  })

  it('returns null stats when there are validation errors', () => {
    // usePortfolioStats checks profile.validationErrors (always empty from
    // runtimeLegacyInputs), allocation.validationErrors, and cross-store rules.
    // Trigger errors via allocation cross-store validation (glide path with
    // startAge >= endAge).
    useAllocationStore.setState({
      ...useAllocationStore.getState(),
      glidePathConfig: {
        enabled: true,
        method: 'linear',
        startAge: 60,
        endAge: 50, // startAge >= endAge triggers cross-store error
      },
    })
    const { result } = renderHook(() => usePortfolioStats())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.currentStats).toBeNull()
    expect(result.current.targetStats).toBeNull()
    expect(result.current.glidePathAllocations).toEqual([])
  })

  it('return overrides are applied to stats', () => {
    const { result: baseline } = renderHook(() => usePortfolioStats())
    const baseReturn = baseline.current.currentStats!.expectedReturn

    // Override first asset (US equities) to have much higher return
    useAllocationStore.setState({
      ...useAllocationStore.getState(),
      returnOverrides: [0.20, null, null, null, null, null, null, null],
    })
    const { result: overridden } = renderHook(() => usePortfolioStats())
    const overriddenReturn = overridden.current.currentStats!.expectedReturn

    expect(overriddenReturn).toBeGreaterThan(baseReturn)
  })

  it('glide path disabled returns empty allocations array', () => {
    const { result } = renderHook(() => usePortfolioStats())
    expect(result.current.glidePathAllocations).toEqual([])
  })

  it('glide path enabled returns year-by-year allocations', () => {
    const store = useAllocationStore.getState()
    useAllocationStore.setState({
      ...store,
      glidePathConfig: {
        ...store.glidePathConfig,
        enabled: true,
        method: 'linear',
        startAge: 30,
        endAge: 55,
      },
      targetWeights: [0.2, 0, 0.1, 0.5, 0, 0.05, 0.15, 0],
    })
    const { result } = renderHook(() => usePortfolioStats())
    expect(result.current.glidePathAllocations.length).toBeGreaterThan(0)
    // First allocation should be near current weights, last near target
    const allocs = result.current.glidePathAllocations
    expect(allocs[0]).toHaveProperty('age')
    expect(allocs[0]).toHaveProperty('weights')
    expect(allocs[0].weights.length).toBe(8)
  })

  it('Sharpe ratio is positive for balanced portfolio', () => {
    useAllocationStore.getState().applyTemplate('balanced')
    const { result } = renderHook(() => usePortfolioStats())
    expect(result.current.currentStats!.sharpe).toBeGreaterThan(0)
  })
})
