import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSectionCompletion } from './useSectionCompletion'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

beforeEach(() => {
  localStorage.removeItem('fireplanner-feature-householdPlannerV1')
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  usePropertyStore.getState().reset()
  useHouseholdPlanStore.getState().reset()
})

describe('useSectionCompletion', () => {
  it('returns 10 sections', () => {
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.totalSections).toBe(10)
    expect(Object.keys(result.current.sections)).toHaveLength(10)
  })

  it('default state: sections at "default" status (not customized)', () => {
    const { result } = renderHook(() => useSectionCompletion())
    const { sections } = result.current
    // Default profile: age 30, retirement 65, life 90 — all defaults
    expect(sections['section-personal'].status).toBe('default')
    expect(sections['section-fire-settings'].status).toBe('default')
    expect(sections['section-income'].status).toBe('default')
  })

  it('changing age from default marks personal as customized', () => {
    useProfileStore.getState().setField('currentAge', 35)
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-personal'].status).toBe('customized')
    expect(result.current.sections['section-personal'].isComplete).toBe(true)
  })

  it('changing SWR marks FIRE settings as customized', () => {
    useProfileStore.getState().setField('swr', 0.035)
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-fire-settings'].status).toBe('customized')
  })

  it('setting net worth marks net-worth as customized', () => {
    useProfileStore.getState().setField('liquidNetWorth', 500000)
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-net-worth'].status).toBe('customized')
  })

  it('validation errors mark section as error', () => {
    useProfileStore.getState().setField('currentAge', 15) // Invalid, too young
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-personal'].status).toBe('error')
    expect(result.current.sections['section-personal'].errorCount).toBeGreaterThan(0)
    expect(result.current.hasAnyErrors).toBe(true)
  })

  it('completedCount increments as sections are customized', () => {
    const { result: r1 } = renderHook(() => useSectionCompletion())
    const initialCount = r1.current.completedCount

    useProfileStore.getState().setField('currentAge', 40) // Personal
    useProfileStore.getState().setField('swr', 0.035)     // FIRE settings
    useProfileStore.getState().setField('liquidNetWorth', 100000) // NW

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
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
    })
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.sections['section-property'].status).toBe('customized')
  })

  it('hasAnyErrors is false when all inputs valid', () => {
    const { result } = renderHook(() => useSectionCompletion())
    expect(result.current.hasAnyErrors).toBe(false)
  })
})
