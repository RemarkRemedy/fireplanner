import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePerAdultBreakdown } from './usePerAdultBreakdown'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'

// Declare vi.mock at module scope BEFORE imports take effect (hoisted by Vitest).
vi.mock('@/lib/household/featureFlag', () => ({
  isHouseholdPlannerV1Enabled: vi.fn(),
}))

const mockFlag = vi.mocked(isHouseholdPlannerV1Enabled)

function addPartnerAdult() {
  const self = useHouseholdPlanStore.getState().plan.adults[0]
  useHouseholdPlanStore.getState().addAdult({
    ...structuredClone(self),
    id: 'adult-partner',
    owner: 'partner',
    displayName: 'Pat',
    currentAge: 33,
    retirementAge: 60,
    lifeExpectancy: 92,
    annualIncome: 84_000,
    annualExpenses: 0,
    liquidNetWorth: 55_000,
  })
}

beforeEach(() => {
  mockFlag.mockReturnValue(true) // default: flag on
  useHouseholdPlanStore.getState().reset()
})

afterEach(() => {
  vi.resetAllMocks() // prevent flag state leaking between tests
})

describe('usePerAdultBreakdown', () => {
  it('returns null for individual plans', () => {
    useHouseholdPlanStore.getState().initializeManualPlan('individual')
    const { result } = renderHook(() => usePerAdultBreakdown())
    expect(result.current).toBeNull()
  })

  it('returns null when feature flag is off', () => {
    mockFlag.mockReturnValue(false)
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    addPartnerAdult()
    const { result } = renderHook(() => usePerAdultBreakdown())
    expect(result.current).toBeNull()
  })

  it('returns per-adult breakdown for couple plans', () => {
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    addPartnerAdult()
    const { result } = renderHook(() => usePerAdultBreakdown())
    expect(result.current).not.toBeNull()
    expect(result.current!.adults).toHaveLength(2)
  })

  it('each adult has required fields', () => {
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    addPartnerAdult()
    const { result } = renderHook(() => usePerAdultBreakdown())
    const adult = result.current!.adults[0]
    expect(adult).toHaveProperty('id')
    expect(adult).toHaveProperty('displayName')
    expect(adult).toHaveProperty('currentAge')
    expect(adult).toHaveProperty('retirementAge')
    expect(adult).toHaveProperty('annualIncome')
    expect(adult).toHaveProperty('cpfTotal')
    expect(adult).toHaveProperty('liquidNetWorth')
    expect(adult).toHaveProperty('totalNetWorth')
    expect(adult).toHaveProperty('incomeSharePct')
    expect(adult).toHaveProperty('incomeRows')
    expect(adult).toHaveProperty('cpfRows')
  })

  it('income share percentages sum to 1 for couple', () => {
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    addPartnerAdult()
    const { result } = renderHook(() => usePerAdultBreakdown())
    const total = result.current!.adults.reduce((s, a) => s + a.incomeSharePct, 0)
    expect(total).toBeCloseTo(1, 5)
  })
})
