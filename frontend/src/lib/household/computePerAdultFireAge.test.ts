import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HouseholdPlan } from '@/lib/household/types'
import type { AllocationState, SimulationState, ProfileState, IncomeState, PropertyState } from '@/lib/types'

// Mock all pipeline dependencies
vi.mock('@/lib/household/planSlice', () => ({
  buildSplitAdultPlanSlice: vi.fn(),
}))
vi.mock('@/lib/household/runtimeLegacyInputs', () => ({
  buildHouseholdRuntimeLegacyInputs: vi.fn(),
}))
vi.mock('@/lib/calculations/projectionParams', () => ({
  buildProjectionParams: vi.fn(),
  buildFullProjectionParams: vi.fn(),
}))
vi.mock('@/lib/calculations/income', () => ({
  generateIncomeProjection: vi.fn(),
}))

import { computePerAdultFireAge } from '@/lib/household/computePerAdultFireAge'
import { buildSplitAdultPlanSlice } from '@/lib/household/planSlice'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { buildProjectionParams, buildFullProjectionParams } from '@/lib/calculations/projectionParams'
import { generateIncomeProjection } from '@/lib/calculations/income'

const mockPlan = { adults: [{ id: 'a1' }] } as unknown as HouseholdPlan
const mockAllocation = {
  currentWeights: [0.6, 0.4],
  targetWeights: [0.6, 0.4],
  returnOverrides: [],
  glidePathConfig: { enabled: false },
  validationErrors: {},
} as unknown as Pick<AllocationState, 'currentWeights' | 'targetWeights' | 'returnOverrides' | 'glidePathConfig' | 'validationErrors'>
const mockSimulation = {
  selectedStrategy: 'constant-dollar',
  strategyParams: {},
  withdrawalBasis: 'expenses',
} as unknown as Pick<SimulationState, 'selectedStrategy' | 'strategyParams' | 'withdrawalBasis'>

describe('computePerAdultFireAge', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns null when buildSplitAdultPlanSlice returns null', () => {
    vi.mocked(buildSplitAdultPlanSlice).mockReturnValue(null)

    const result = computePerAdultFireAge(mockPlan, 'missing-adult', mockAllocation, mockSimulation)

    expect(result).toBeNull()
    expect(buildSplitAdultPlanSlice).toHaveBeenCalledWith(mockPlan, 'missing-adult', 0.5)
    // Pipeline should not continue
    expect(buildHouseholdRuntimeLegacyInputs).not.toHaveBeenCalled()
  })

  it('returns null when buildProjectionParams returns null (validation errors)', () => {
    const mockSlice = { id: 'slice' } as unknown as HouseholdPlan
    const mockAges = { currentAge: 30, retirementAge: 55, lifeExpectancy: 85 }
    const mockProfile = { currentAge: 30 } as unknown as ProfileState
    const mockIncome = {} as unknown as IncomeState
    const mockProperty = {} as unknown as PropertyState

    vi.mocked(buildSplitAdultPlanSlice).mockReturnValue({
      slice: mockSlice,
      adultAges: mockAges,
    })
    vi.mocked(buildHouseholdRuntimeLegacyInputs).mockReturnValue({
      profile: mockProfile,
      income: mockIncome,
      property: mockProperty,
    })
    vi.mocked(buildProjectionParams).mockReturnValue(null)

    const result = computePerAdultFireAge(mockPlan, 'a1', mockAllocation, mockSimulation)

    expect(result).toBeNull()
    expect(buildProjectionParams).toHaveBeenCalledWith(
      { ...mockProfile, ...mockAges },
      mockIncome,
      mockProperty,
    )
    expect(generateIncomeProjection).not.toHaveBeenCalled()
  })

  it('returns fireAge when full pipeline succeeds', () => {
    const mockSlice = { id: 'slice' } as unknown as HouseholdPlan
    const mockAges = { currentAge: 30, retirementAge: 55, lifeExpectancy: 85 }
    const mockProfile = { currentAge: 30 } as unknown as ProfileState
    const mockIncome = {} as unknown as IncomeState
    const mockProperty = {} as unknown as PropertyState
    const mockIncomeParams = { currentAge: 30 } as unknown as ReturnType<typeof buildProjectionParams>
    const mockProjectionRows = [{ age: 30 }] as unknown as ReturnType<typeof generateIncomeProjection>
    const mockFireMetrics = { fireAge: 48, fireNumber: 1200000 } as unknown as Record<string, unknown>

    vi.mocked(buildSplitAdultPlanSlice).mockReturnValue({
      slice: mockSlice,
      adultAges: mockAges,
    })
    vi.mocked(buildHouseholdRuntimeLegacyInputs).mockReturnValue({
      profile: mockProfile,
      income: mockIncome,
      property: mockProperty,
    })
    vi.mocked(buildProjectionParams).mockReturnValue(mockIncomeParams)
    vi.mocked(generateIncomeProjection).mockReturnValue(mockProjectionRows)
    vi.mocked(buildFullProjectionParams).mockReturnValue({
      params: {},
      fireMetrics: mockFireMetrics,
    } as unknown as ReturnType<typeof buildFullProjectionParams>)

    const result = computePerAdultFireAge(mockPlan, 'a1', mockAllocation, mockSimulation)

    expect(result).toBe(48)
    expect(buildSplitAdultPlanSlice).toHaveBeenCalledWith(mockPlan, 'a1', 0.5)
    expect(buildHouseholdRuntimeLegacyInputs).toHaveBeenCalledWith(mockSlice)
    expect(generateIncomeProjection).toHaveBeenCalledWith(mockIncomeParams)
    expect(buildFullProjectionParams).toHaveBeenCalledWith({
      profile: mockProfile,
      income: mockIncome,
      property: mockProperty,
      allocation: mockAllocation,
      simulation: mockSimulation,
      ages: mockAges,
      incomeProjection: mockProjectionRows,
    })
  })
})
