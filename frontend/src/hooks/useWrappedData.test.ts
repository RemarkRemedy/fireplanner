import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWrappedData } from './useWrappedData'
import { DEFAULT_ANNUAL_EXPENSES } from '@/lib/data/setupDefaults'

// --- Mocks for upstream hooks ---

const mockDashMetrics = {
  fireNumber: 1_000_000,
  progress: 0.5,
  yearsToFire: 15,
  fireAge: 45,
  coastFireNumber: 500_000,
  baristaFireIncome: 24_000,
  savingsRate: 0.4,
  totalNetWorth: 500_000,
  portfolioDepletedAge: null as number | null,
  lifeExpectancy: 85 as number | null,
  projectionFireNumber: null,
  deviationPct: null,
  showProjectionNumber: false,
  deviationFactors: [],
  blendedFireNumber: null,
}

const mockAccumulationData = [
  { age: 30, value: 200_000 },
  { age: 40, value: 600_000 },
  { age: 50, value: 1_200_000 },
  { age: 60, value: 900_000 },
]

const mockFireMetrics = {
  fireNumber: 1_000_000,
  progress: 0.5,
  yearsToFire: 15,
  fireAge: 45,
  savingsRate: 0.4,
  annualSavings: 30_000,
  coastFireNumber: 500_000,
  baristaFireIncome: 24_000,
  propertyEquity: 300_000,
}

const mockProfile = {
  currentAge: 30,
  retirementAge: 55,
  lifeExpectancy: 85,
  liquidNetWorth: 100_000,
  cpfOA: 30_000,
  cpfSA: 20_000,
  cpfMA: 10_000,
  cpfRA: 0,
  annualExpenses: DEFAULT_ANNUAL_EXPENSES,
  annualIncome: 72_000,
  expectedReturn: 0.07,
  inflation: 0.025,
  expenseRatio: 0.003,
  swr: 0.04,
}

vi.mock('@/hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: () => mockDashMetrics,
}))

vi.mock('@/hooks/useDashboardCharts', () => ({
  useDashboardCharts: () => ({
    accumulationData: mockAccumulationData,
    fireNumberLine: 1_000_000,
  }),
}))

vi.mock('@/hooks/useFireCalculations', () => ({
  useFireCalculations: () => ({
    metrics: mockFireMetrics,
    hasErrors: false,
  }),
}))

vi.mock('@/hooks/useHouseholdRuntimeInputs', () => ({
  useHouseholdRuntimeInputs: () => ({
    profile: mockProfile,
  }),
}))

function resetMocks() {
  Object.assign(mockDashMetrics, {
    fireNumber: 1_000_000,
    progress: 0.5,
    yearsToFire: 15,
    fireAge: 45,
    coastFireNumber: 500_000,
    baristaFireIncome: 24_000,
    savingsRate: 0.4,
    totalNetWorth: 500_000,
    portfolioDepletedAge: null,
    lifeExpectancy: 85,
    projectionFireNumber: null,
    deviationPct: null,
    showProjectionNumber: false,
    deviationFactors: [],
    blendedFireNumber: null,
  })
  Object.assign(mockFireMetrics, {
    fireNumber: 1_000_000,
    progress: 0.5,
    yearsToFire: 15,
    fireAge: 45,
    savingsRate: 0.4,
    annualSavings: 30_000,
    coastFireNumber: 500_000,
    baristaFireIncome: 24_000,
    propertyEquity: 300_000,
  })
  Object.assign(mockProfile, {
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 85,
    liquidNetWorth: 100_000,
    cpfOA: 30_000,
    cpfSA: 20_000,
    cpfMA: 10_000,
    cpfRA: 0,
    annualExpenses: DEFAULT_ANNUAL_EXPENSES,
    annualIncome: 72_000,
    expectedReturn: 0.07,
    inflation: 0.025,
    expenseRatio: 0.003,
    swr: 0.04,
  })
  mockAccumulationData.length = 0
  mockAccumulationData.push(
    { age: 30, value: 200_000 },
    { age: 40, value: 600_000 },
    { age: 50, value: 1_200_000 },
    { age: 60, value: 900_000 },
  )
}

beforeEach(() => {
  resetMocks()
})

describe('useWrappedData', () => {
  it('returns all expected fields', () => {
    const { result } = renderHook(() => useWrappedData())
    const data = result.current

    expect(data).toHaveProperty('ready')
    expect(data).toHaveProperty('intro')
    expect(data).toHaveProperty('netWorth')
    expect(data).toHaveProperty('fireNumber')
    expect(data).toHaveProperty('progress')
    expect(data).toHaveProperty('milestone')
    expect(data).toHaveProperty('trajectory')
    expect(data).toHaveProperty('peak')
    expect(data).toHaveProperty('summary')
    expect(data).toHaveProperty('cards')
    expect(data).toHaveProperty('refinementHints')
  })

  it('totalNW fallback includes liquid + cpf + property (C3 fix)', () => {
    mockDashMetrics.totalNetWorth = null as unknown as number
    mockProfile.liquidNetWorth = 100_000
    mockProfile.cpfOA = 30_000
    mockProfile.cpfSA = 20_000
    mockProfile.cpfMA = 10_000
    mockProfile.cpfRA = 0
    mockFireMetrics.propertyEquity = 300_000

    const { result } = renderHook(() => useWrappedData())
    // liquid(100K) + cpf(60K) + property(300K) = 460K
    expect(result.current.netWorth.total).toBe(460_000)
  })

  it('hasCustomExpenses uses DEFAULT_ANNUAL_EXPENSES constant, not hardcoded value', () => {
    // When expenses equal the constant, hasCustomExpenses should be false
    mockProfile.annualExpenses = DEFAULT_ANNUAL_EXPENSES
    const { result: defaultResult } = renderHook(() => useWrappedData())
    expect(defaultResult.current.refinementHints.hasCustomExpenses).toBe(false)

    // When expenses differ from the constant, hasCustomExpenses should be true
    mockProfile.annualExpenses = DEFAULT_ANNUAL_EXPENSES + 1
    const { result: customResult } = renderHook(() => useWrappedData())
    expect(customResult.current.refinementHints.hasCustomExpenses).toBe(true)
  })

  it('trajectory.hasFireAge is true when dashMetrics.fireAge is present', () => {
    mockDashMetrics.fireAge = 45
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.trajectory.hasFireAge).toBe(true)
  })

  it('trajectory.hasFireAge is false when dashMetrics.fireAge is null', () => {
    mockDashMetrics.fireAge = null as unknown as number
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.trajectory.hasFireAge).toBe(false)
  })

  it('trajectory.retirementAge uses fireAge when available', () => {
    mockDashMetrics.fireAge = 42
    mockProfile.retirementAge = 55
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.trajectory.retirementAge).toBe(42)
  })

  it('trajectory.retirementAge falls back to profile.retirementAge when fireAge is null', () => {
    mockDashMetrics.fireAge = null as unknown as number
    mockProfile.retirementAge = 55
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.trajectory.retirementAge).toBe(55)
  })

  it('peak value derived from accumulationData (C4 fix)', () => {
    // accumulationData has peak at age 50 with value 1,200,000
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.peak.value).toBe(1_200_000)
    expect(result.current.peak.age).toBe(50)
  })

  it('peak defaults to totalNW when accumulationData is empty', () => {
    mockAccumulationData.length = 0
    mockDashMetrics.totalNetWorth = 500_000
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.peak.value).toBe(500_000)
    expect(result.current.peak.age).toBe(30) // currentAge
  })

  it('depleted is false when lifeExpectancy is null (W9 fix)', () => {
    mockDashMetrics.portfolioDepletedAge = 70
    mockDashMetrics.lifeExpectancy = null
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.summary.depleted).toBe(false)
  })

  it('depleted is true when portfolioDepletedAge < lifeExpectancy', () => {
    mockDashMetrics.portfolioDepletedAge = 70
    mockDashMetrics.lifeExpectancy = 85
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.summary.depleted).toBe(true)
  })

  it('depleted is false when portfolioDepletedAge is null', () => {
    mockDashMetrics.portfolioDepletedAge = null
    mockDashMetrics.lifeExpectancy = 85
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.summary.depleted).toBe(false)
  })

  it('cards array has 8 items from buildCardSequence()', () => {
    const { result } = renderHook(() => useWrappedData())
    expect(result.current.cards).toHaveLength(8)
    const keys = result.current.cards.map((c) => c.key)
    expect(keys).toEqual([
      'intro', 'netWorth', 'fireNumber', 'progress',
      'milestone', 'trajectory', 'peak', 'summary',
    ])
  })

  it('refinement hints detect non-default values correctly', () => {
    mockProfile.annualExpenses = 60_000 // != DEFAULT_ANNUAL_EXPENSES
    mockProfile.annualIncome = 120_000 // > 0
    mockProfile.cpfOA = 50_000 // cpf > 0
    mockFireMetrics.propertyEquity = 500_000 // property > 0

    const { result } = renderHook(() => useWrappedData())
    const hints = result.current.refinementHints
    expect(hints.hasCustomExpenses).toBe(true)
    expect(hints.hasCustomIncome).toBe(true)
    expect(hints.hasCpfData).toBe(true)
    expect(hints.hasProperty).toBe(true)
  })

  it('refinement hints detect default values correctly', () => {
    mockProfile.annualExpenses = DEFAULT_ANNUAL_EXPENSES
    mockProfile.annualIncome = 0
    mockProfile.cpfOA = 0
    mockProfile.cpfSA = 0
    mockProfile.cpfMA = 0
    mockProfile.cpfRA = 0
    mockFireMetrics.propertyEquity = 0

    const { result } = renderHook(() => useWrappedData())
    const hints = result.current.refinementHints
    expect(hints.hasCustomExpenses).toBe(false)
    expect(hints.hasCustomIncome).toBe(false)
    expect(hints.hasCpfData).toBe(false)
    expect(hints.hasProperty).toBe(false)
  })
})
