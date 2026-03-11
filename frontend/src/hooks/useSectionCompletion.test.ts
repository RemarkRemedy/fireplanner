import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSectionCompletion } from './useSectionCompletion'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
})

describe('useSectionCompletion', () => {
  it('returns 10 sections', () => {
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.totalSections).toBe(11)
    expect(Object.keys(result.current.sections)).toHaveLength(11)
  })

  it('default state: personal and fire-settings at "default" status', () => {
    const { result } = renderHook(() => useSectionCompletion())
    const { sections } = result.current
    // Default plan: age 30, retirement 65, life 90 — all defaults
    expect(sections['section-personal'].status).toBe('default')
    expect(sections['section-fire-settings'].status).toBe('default')
    // Income is 'customized' because the default household plan includes
    // an active salary-model income source (72K), satisfying hasIncomeCoverage
    expect(sections['section-income'].status).toBe('customized')
  })

  it('changing age from default marks personal as customized', () => {
    setupTestPlan({
      adult: { currentAge: 35 },
    })
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-personal'].status).toBe('customized')
    expect(result.current.sections['section-personal'].isComplete).toBe(true)
  })

  it('changing SWR marks FIRE settings as customized', () => {
    setupTestPlan({
      assumptions: { fire: { swr: 0.035 } },
    })
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-fire-settings'].status).toBe('customized')
  })

  it('setting net worth marks net-worth as customized', () => {
    setupTestPlan({
      assets: { liquidNetWorth: 500000 },
    })
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-net-worth'].status).toBe('customized')
  })

  it('validation errors mark section as error', () => {
    // Set cross-field violations: retirementAge <= currentAge triggers household validation errors
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 20 },
    })
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-personal'].status).toBe('error')
    expect(result.current.sections['section-personal'].errorCount).toBeGreaterThan(0)
    expect(result.current.hasAnyErrors).toBe(true)
  })

  it('completedCount increments as sections are customized', () => {
    const { result: r1 } = renderHook(() => useSectionCompletion())
    const initialCount = r1.current.completedCount

    setupTestPlan({
      adult: { currentAge: 40 },         // Personal
      assumptions: { fire: { swr: 0.035 } },  // FIRE settings
      assets: { liquidNetWorth: 100000 }, // NW
    })

    const { result: r2 } = renderHook(() => useSectionCompletion())
    expect(r2.current.completedCount).toBeGreaterThan(initialCount)
  })

  it('allocation section reflects template change', () => {
    // Default is balanced — changing to aggressive marks it as customized
    useAllocationStore.getState().applyTemplate('aggressive')
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-allocation'].status).toBe('customized')
  })

  it('property section reflects owning property', () => {
    setupTestPlan({
      property: { ownsProperty: true },
    })
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-property'].status).toBe('customized')
  })

  it('hasAnyErrors is false when all inputs valid', () => {
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.hasAnyErrors).toBe(false)
  })
})
