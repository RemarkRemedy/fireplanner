import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { MonteCarloResult } from '@/lib/types'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { HOUSEHOLD_PLAN_STORAGE_KEY } from '@/stores/useHouseholdPlanStore'
import { resolveDeterministicExpectedReturn } from '@/lib/analysis/deterministicAssumptions'
import { buildPlannerResultsPayload } from '@/lib/companion/resultsPayload'
import { useCompanionPlannerBridge } from './useCompanionPlannerBridge'

vi.mock('@/lib/companion/companionClient', () => ({
  fetchPlannerSnapshot: vi.fn(),
  postPlannerResults: vi.fn(),
}))

vi.mock('@/lib/companion/isCompanionMode', () => ({
  isCompanionMode: vi.fn(() => false),
  getCompanionToken: vi.fn(() => null),
  getCompanionBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

import { fetchPlannerSnapshot, postPlannerResults } from '@/lib/companion/companionClient'
import {
  isCompanionMode,
  getCompanionToken,
  getCompanionBaseUrl,
} from '@/lib/companion/isCompanionMode'

const mockFetchPlannerSnapshot = vi.mocked(fetchPlannerSnapshot)
const mockPostPlannerResults = vi.mocked(postPlannerResults)
const mockIsCompanionMode = vi.mocked(isCompanionMode)
const mockGetCompanionToken = vi.mocked(getCompanionToken)
const mockGetCompanionBaseUrl = vi.mocked(getCompanionBaseUrl)

function enableCompanionMode(token: string = 'test-token', baseUrl: string = 'http://localhost:3000') {
  mockIsCompanionMode.mockReturnValue(true)
  mockGetCompanionToken.mockReturnValue(token)
  mockGetCompanionBaseUrl.mockReturnValue(baseUrl)
}

const SAMPLE_RESULT: MonteCarloResult = {
  success_rate: 0.91,
  percentile_bands: {
    years: [0],
    ages: [65],
    p5: [1],
    p10: [1],
    p25: [1],
    p50: [1],
    p75: [1],
    p90: [1],
    p95: [1],
  },
  terminal_stats: {
    median: 100_000,
    mean: 120_000,
    worst: 5_000,
    best: 400_000,
    p5: 10_000,
    p95: 300_000,
  },
  safe_swr: {
    confidence_95: 0.03,
    confidence_90: 0.035,
    confidence_85: 0.04,
    confidence_50: 0.047,
  },
  failure_distribution: {
    buckets: ['0-5'],
    counts: [100],
    total_failures: 100,
    counts_5y: [0, 0],
  },
  withdrawal_bands: {
    years: [0],
    ages: [65],
    p5: [20_000],
    p10: [25_000],
    p25: [30_000],
    p50: [40_000],
    p75: [50_000],
    p90: [60_000],
    p95: [65_000],
  },
  n_simulations: 10_000,
  computation_time_ms: 42,
  cached: false,
}

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  useHouseholdPlanStore.persist.clearStorage()
  localStorage.removeItem(HOUSEHOLD_PLAN_STORAGE_KEY)
  useHouseholdPlanStore.getState().reset()
  useUIStore.getState().setField('mode', 'simple')

  mockFetchPlannerSnapshot.mockReset()
  mockPostPlannerResults.mockReset()
  mockIsCompanionMode.mockReturnValue(false)
  mockGetCompanionToken.mockReturnValue(null)
  mockGetCompanionBaseUrl.mockReturnValue('http://localhost:3000')
})

describe('useCompanionPlannerBridge', () => {
  it('loads companion snapshot and fills planner inputs when companion=1', async () => {
    enableCompanionMode('abc123')
    mockFetchPlannerSnapshot.mockResolvedValue({
      schemaVersion: 1,
      avgMonthlyIncome: 5000,
      avgMonthlyExpense: 3200,
      avgMonthlySavings: 1800,
      investableAssets: 250_000,
      structuralMode: 'advanced',
    })

    const { result } = renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    expect(mockFetchPlannerSnapshot).toHaveBeenCalledWith('http://localhost:3000', 'abc123')
    expect(useProfileStore.getState().annualIncome).toBe(60_000)
    expect(useIncomeStore.getState().annualSalary).toBe(60_000)
    expect(useProfileStore.getState().annualExpenses).toBe(38_400)
    expect(useProfileStore.getState().liquidNetWorth).toBe(250_000)
    expect(useUIStore.getState().mode).toBe('advanced')
  })

  it('exposes imported household review metadata after bootstrap', async () => {
    enableCompanionMode('import-review')
    mockFetchPlannerSnapshot.mockResolvedValue({
      schemaVersion: 1,
      monthKey: '2026-03',
      avgMonthlyIncome: 7_000,
      avgMonthlyExpense: 4_500,
      investableAssets: 220_000,
      futureField: 'top-level-extra',
      expenseImport: {
        members: [
          { role: 'self', name: 'Alex', currentAge: 41 },
          { role: 'partner', name: 'Jamie', currentAge: 39 },
          { role: 'dependent', name: 'Mia', age: 8, relationship: 'child', annualCost: 9_000 },
        ],
        unsupportedFields: ['debts.loan'],
      },
    })

    const { result } = renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    expect(result.current.importedPlanReview?.detectedMembers.map((member) => member.label)).toEqual([
      'Alex',
      'Jamie',
      'Mia',
    ])
    expect(result.current.importedPlanReview?.unsupportedFields).toEqual([
      'debts.loan',
      'snapshot.futureField',
    ])
    expect(result.current.importedPlanReview?.localEditabilityNote).toContain('local Fireplanner copies')
    expect(useHouseholdPlanStore.getState().plan.planType).toBe('household')

    const partnerId = useHouseholdPlanStore.getState().plan.adults.find((adult) => adult.owner === 'partner')?.id
    expect(partnerId).toBeTruthy()
    useHouseholdPlanStore.getState().updateAdult(partnerId!, { annualIncome: 42_000 })
    expect(
      useHouseholdPlanStore.getState().plan.adults.find((adult) => adult.owner === 'partner')?.annualIncome,
    ).toBe(42_000)
    await waitFor(() => {
      expect(localStorage.getItem(HOUSEHOLD_PLAN_STORAGE_KEY)).not.toBeNull()
    })
  })

  it('reacts when companion mode becomes enabled after the hook has already mounted', async () => {
    mockFetchPlannerSnapshot.mockResolvedValue({ schemaVersion: 1 })

    const { result, rerender } = renderHook(
      ({ mc, stale }) => useCompanionPlannerBridge({ result: mc, isResultStale: stale }),
      { initialProps: { mc: undefined as MonteCarloResult | undefined, stale: false } },
    )

    expect(result.current.isCompanionMode).toBe(false)

    enableCompanionMode('flip001')
    rerender({ mc: undefined, stale: false })

    await waitFor(() => {
      expect(result.current.isCompanionMode).toBe(true)
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    expect(mockFetchPlannerSnapshot).toHaveBeenCalledWith('http://localhost:3000', 'flip001')
  })

  it('posts companion results with required payload keys after simulation completes', async () => {
    enableCompanionMode('xyz789')
    mockFetchPlannerSnapshot.mockResolvedValue({
      schemaVersion: 1,
      avgMonthlyIncome: 4000,
      avgMonthlyExpense: 2600,
      investableAssets: 150_000,
    })
    mockPostPlannerResults.mockResolvedValue()

    const { result, rerender } = renderHook(
      ({ mc, stale }) => useCompanionPlannerBridge({ result: mc, isResultStale: stale }),
      { initialProps: { mc: undefined as MonteCarloResult | undefined, stale: false } }
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    act(() => {
      result.current.prepareSimulationRun()
    })
    rerender({ mc: SAMPLE_RESULT, stale: false })

    await waitFor(() => {
      expect(mockPostPlannerResults).toHaveBeenCalledTimes(1)
    })

    const [baseUrl, token, payload] = mockPostPlannerResults.mock.calls[0]
    expect(baseUrl).toBe('http://localhost:3000')
    expect(token).toBe('xyz789')
    expect(payload).toEqual(expect.objectContaining({
      p_success: expect.any(Number),
      horizon_years: expect.any(Number),
      schema_version: 2,
    }))
    expect(payload).toHaveProperty('wr_safe_50')
    expect(payload).toHaveProperty('wr_safe_95')
    expect(payload).toHaveProperty('wr_safe_90')
    expect(payload).toHaveProperty('wr_safe_85')
    expect(payload).toHaveProperty('allocation_summary')
    expect(payload).toHaveProperty('projected_fire_age_p50')
    expect(payload).toHaveProperty('portfolio_at_fire_p50')
    expect(payload).toHaveProperty('terminal_p5')
    expect(payload).toHaveProperty('terminal_p50')
    expect(payload).toHaveProperty('terminal_p95')
    expect(payload).toHaveProperty('computed_at_utc')
    expect(payload).toHaveProperty('scenario_id')
    expect(payload).toHaveProperty('input_signature')

    const profile = useProfileStore.getState()
    const allocation = useAllocationStore.getState()
    const simulation = useSimulationStore.getState()
    const scenarioRetirementAge = result.current.activeScenarioRetirementAge ?? profile.retirementAge
    const scenarioAnnualExpenses = result.current.activeScenarioAnnualExpenses ?? profile.annualExpenses
    const initialPortfolio = profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA
    const expectedPayload = buildPlannerResultsPayload({
      result: SAMPLE_RESULT,
      initialPortfolio,
      currentAge: profile.currentAge,
      annualIncome: profile.annualIncome,
      annualExpenses: scenarioAnnualExpenses,
      computedAtUtc: payload?.computed_at_utc,
      expectedReturn: resolveDeterministicExpectedReturn(profile, allocation, {
        retirementAge: scenarioRetirementAge,
      }),
      inflation: profile.inflation,
      expenseRatio: profile.expenseRatio,
      lifeExpectancy: profile.lifeExpectancy,
      retirementAge: scenarioRetirementAge,
      allocationWeights: allocation.currentWeights,
      selectedStrategy: simulation.selectedStrategy,
      strategyParams: simulation.strategyParams,
      mcMethod: simulation.mcMethod,
      scenarioId: result.current.activeScenarioId ?? undefined,
      scenarioName: result.current.activeScenario?.name,
    })
    expect(payload).toEqual({
      ...expectedPayload,
      input_signature: JSON.stringify({
        annualExpenses: scenarioAnnualExpenses,
        retirementAge: scenarioRetirementAge,
      }),
    })

    await waitFor(() => {
      expect(result.current.saveStatus).toBe('saved')
    })

    const baseComparison = result.current.scenarioComparisons.find((row) => row.id === 'base')
    expect(baseComparison?.p_success).toBe(0.91)
  })

  it('keeps token across navigation after initial companion bootstrap', async () => {
    enableCompanionMode('persist123')
    mockFetchPlannerSnapshot.mockResolvedValue({ schemaVersion: 1 })

    const first = renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(first.result.current.bootstrapStatus).toBe('loaded')
    })

    first.unmount()

    const second = renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(second.result.current.isCompanionMode).toBe(true)
    })

    expect(mockFetchPlannerSnapshot).toHaveBeenNthCalledWith(1, 'http://localhost:3000', 'persist123')
    expect(mockFetchPlannerSnapshot).toHaveBeenNthCalledWith(2, 'http://localhost:3000', 'persist123')
  })

  it('does not post results when Monte Carlo data is stale', async () => {
    enableCompanionMode('stale001')
    mockFetchPlannerSnapshot.mockResolvedValue({ schemaVersion: 1 })
    mockPostPlannerResults.mockResolvedValue()

    const { result, rerender } = renderHook(
      ({ mc, stale }) => useCompanionPlannerBridge({ result: mc, isResultStale: stale }),
      { initialProps: { mc: undefined as MonteCarloResult | undefined, stale: false } }
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    rerender({ mc: SAMPLE_RESULT, stale: true })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockPostPlannerResults).not.toHaveBeenCalled()
    expect(result.current.saveStatus).toBe('idle')
  })

  it('uses the active scenario retirement age for glide-path required_savings_rate', async () => {
    enableCompanionMode('glide001')
    mockFetchPlannerSnapshot.mockResolvedValue({ schemaVersion: 1 })
    mockPostPlannerResults.mockResolvedValue()

    useProfileStore.getState().setField('currentAge', 45)
    useProfileStore.getState().setField('retirementAge', 65)
    useProfileStore.getState().setField('lifeExpectancy', 90)
    useProfileStore.getState().setField('annualIncome', 120_000)
    useProfileStore.getState().setField('annualExpenses', 48_000)
    useProfileStore.getState().setField('liquidNetWorth', 200_000)
    useProfileStore.getState().setField('inflation', 0.02)
    useProfileStore.getState().setField('expenseRatio', 0.001)
    useProfileStore.getState().setField('usePortfolioReturn', true)
    useIncomeStore.getState().setField('annualSalary', 120_000)

    useAllocationStore.getState().setCurrentWeights([1, 0, 0, 0, 0, 0, 0, 0])
    useAllocationStore.getState().setTargetWeights([0, 0, 0, 1, 0, 0, 0, 0])
    useAllocationStore.getState().setReturnOverride(0, 0.1)
    useAllocationStore.getState().setReturnOverride(3, 0.02)
    useAllocationStore.getState().setGlidePathConfig({
      enabled: true,
      method: 'linear',
      startAge: 55,
      endAge: 65,
    })

    const { result, rerender } = renderHook(
      ({ mc, stale }) => useCompanionPlannerBridge({ result: mc, isResultStale: stale }),
      { initialProps: { mc: undefined as MonteCarloResult | undefined, stale: false } }
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    act(() => {
      result.current.selectScenario('retire-5-earlier')
    })

    await waitFor(() => {
      expect(result.current.activeScenarioId).toBe('retire-5-earlier')
      expect(result.current.activeScenarioRetirementAge).toBe(60)
    })

    act(() => {
      result.current.prepareSimulationRun()
    })
    rerender({ mc: SAMPLE_RESULT, stale: false })

    await waitFor(() => {
      expect(mockPostPlannerResults).toHaveBeenCalledTimes(1)
    })

    const payload = mockPostPlannerResults.mock.calls[0]?.[2]
    const profile = useProfileStore.getState()
    const allocation = useAllocationStore.getState()
    const simulation = useSimulationStore.getState()
    const scenarioRetirementAge = result.current.activeScenarioRetirementAge ?? profile.retirementAge
    const scenarioAnnualExpenses = result.current.activeScenarioAnnualExpenses ?? profile.annualExpenses
    const initialPortfolio = profile.liquidNetWorth + profile.cpfOA + profile.cpfSA + profile.cpfMA + profile.cpfRA

    const scenarioExpectedReturn = resolveDeterministicExpectedReturn(profile, allocation, {
      retirementAge: scenarioRetirementAge,
    })
    const baseExpectedReturn = resolveDeterministicExpectedReturn(profile, allocation)

    expect(scenarioExpectedReturn).not.toBe(baseExpectedReturn)
    // Linear glide 55→65 at age 60: progress=0.5, weights=[0.5,0,0,0.5,…]
    // Expected return = 0.5*0.10 + 0.5*0.02 = 0.06
    expect(scenarioExpectedReturn).toBeCloseTo(0.06)
    // Base at age 65 >= endAge: all target weights (bonds), return = 0.02
    expect(baseExpectedReturn).toBeCloseTo(0.02)

    // Note: hook uses effectiveAnnualIncome from generateIncomeProjection,
    // which equals annualIncome here (simple salary model, no career phases)
    const buildPayloadInput = {
      result: SAMPLE_RESULT,
      initialPortfolio,
      currentAge: profile.currentAge,
      annualIncome: profile.annualIncome,
      annualExpenses: scenarioAnnualExpenses,
      inflation: profile.inflation,
      expenseRatio: profile.expenseRatio,
      lifeExpectancy: profile.lifeExpectancy,
      retirementAge: scenarioRetirementAge,
      allocationWeights: allocation.currentWeights,
      selectedStrategy: simulation.selectedStrategy,
      strategyParams: simulation.strategyParams,
      mcMethod: simulation.mcMethod,
      scenarioId: 'retire-5-earlier',
      scenarioName: 'Retire 5 years earlier',
    }

    const scenarioPayload = buildPlannerResultsPayload({
      ...buildPayloadInput,
      expectedReturn: scenarioExpectedReturn,
    })
    const basePayload = buildPlannerResultsPayload({
      ...buildPayloadInput,
      expectedReturn: baseExpectedReturn,
    })

    expect(payload?.required_savings_rate).toBe(scenarioPayload.required_savings_rate)
    expect(payload?.required_savings_rate).not.toBe(basePayload.required_savings_rate)
  })

  it('blocks manual save when active scenario needs rerun', async () => {
    enableCompanionMode('saveguard001')
    mockFetchPlannerSnapshot.mockResolvedValue({ schemaVersion: 1 })
    mockPostPlannerResults.mockResolvedValue()

    const { result, rerender } = renderHook(
      ({ mc, stale }) => useCompanionPlannerBridge({ result: mc, isResultStale: stale }),
      { initialProps: { mc: undefined as MonteCarloResult | undefined, stale: false } }
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    act(() => {
      result.current.prepareSimulationRun()
    })
    rerender({ mc: SAMPLE_RESULT, stale: false })

    await waitFor(() => {
      expect(mockPostPlannerResults).toHaveBeenCalledTimes(1)
      expect(result.current.canSaveResults).toBe(true)
    })

    act(() => {
      result.current.selectScenario('cut-300')
    })

    await waitFor(() => {
      expect(result.current.canSaveResults).toBe(false)
    })

    act(() => {
      result.current.retrySave()
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockPostPlannerResults).toHaveBeenCalledTimes(1)
  })

  it('marks saved scenario results stale when allocation revisions change', async () => {
    enableCompanionMode('stale-revisions')
    mockFetchPlannerSnapshot.mockResolvedValue({ schemaVersion: 1 })
    mockPostPlannerResults.mockResolvedValue()

    const { result, rerender } = renderHook(
      ({ mc, stale }) => useCompanionPlannerBridge({ result: mc, isResultStale: stale }),
      { initialProps: { mc: undefined as MonteCarloResult | undefined, stale: false } }
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    act(() => {
      result.current.prepareSimulationRun()
    })
    rerender({ mc: SAMPLE_RESULT, stale: false })

    await waitFor(() => {
      expect(mockPostPlannerResults).toHaveBeenCalledTimes(1)
      expect(result.current.activeScenarioNeedsRerun).toBe(false)
      expect(result.current.canSaveResults).toBe(true)
    })

    act(() => {
      useAllocationStore.getState().setCurrentWeights([0.2, 0.2, 0.1, 0.2, 0.1, 0, 0.2, 0])
    })

    await waitFor(() => {
      expect(result.current.activeScenarioNeedsRerun).toBe(true)
      expect(result.current.canSaveResults).toBe(false)
    })
  })

  it('creates companion presets and supports duplicate + knob edits', async () => {
    enableCompanionMode('scn001')
    mockFetchPlannerSnapshot.mockResolvedValue({
      schemaVersion: 1,
      avgMonthlyIncome: 4000,
      avgMonthlyExpense: 2600,
      investableAssets: 150_000,
    })

    const { result } = renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    expect(result.current.scenarios.map((item) => item.name)).toEqual([
      'Base',
      'Cut $300/mo',
      'Boost Savings $500/mo',
      'Retire 5 years earlier',
      'Conservative spending',
    ])

    act(() => {
      result.current.selectScenario('cut-300')
    })
    expect(result.current.activeRunOverrides?.annualExpenses).toBe(27_600)

    act(() => {
      result.current.duplicateActiveScenario()
    })
    expect(result.current.scenarios.length).toBe(6)

    act(() => {
      result.current.setActiveScenarioMonthlyExpenseDelta(-700)
      result.current.setActiveScenarioRetirementAge(58)
    })

    expect(result.current.activeRunOverrides?.annualExpenses).toBe(22_800)
    expect(result.current.activeRunOverrides?.retirementAge).toBe(58)
    const activeRow = result.current.scenarioComparisons.find((item) => item.id === result.current.activeScenarioId)
    expect(activeRow?.needsRerun).toBe(true)
  })

  describe('snapshotWithdrawalRate', () => {
    it('computes withdrawal rate from snapshot annualWithdrawal / investableAssets', async () => {
      enableCompanionMode('wr-normal')
      mockFetchPlannerSnapshot.mockResolvedValue({
        schemaVersion: 1,
        annualWithdrawal: 20_000,
        investableAssets: 500_000,
      })

      const { result } = renderHook(() =>
        useCompanionPlannerBridge({ result: undefined, isResultStale: false })
      )

      await waitFor(() => {
        expect(result.current.bootstrapStatus).toBe('loaded')
      })

      expect(result.current.snapshotWithdrawalRate).toBeCloseTo(0.04)
    })

    it('clamps withdrawal rate to 1.0 when annualWithdrawal exceeds investableAssets', async () => {
      enableCompanionMode('wr-clamp')
      mockFetchPlannerSnapshot.mockResolvedValue({
        schemaVersion: 1,
        annualWithdrawal: 600_000,
        investableAssets: 500_000,
      })

      const { result } = renderHook(() =>
        useCompanionPlannerBridge({ result: undefined, isResultStale: false })
      )

      await waitFor(() => {
        expect(result.current.bootstrapStatus).toBe('loaded')
      })

      expect(result.current.snapshotWithdrawalRate).toBe(1.0)
    })

    it('returns null when annualWithdrawal is missing from snapshot', async () => {
      enableCompanionMode('wr-missing')
      mockFetchPlannerSnapshot.mockResolvedValue({
        schemaVersion: 1,
        investableAssets: 500_000,
      })

      const { result } = renderHook(() =>
        useCompanionPlannerBridge({ result: undefined, isResultStale: false })
      )

      await waitFor(() => {
        expect(result.current.bootstrapStatus).toBe('loaded')
      })

      expect(result.current.snapshotWithdrawalRate).toBeNull()
    })

    it('returns null when investableAssets is zero', async () => {
      enableCompanionMode('wr-zero')
      mockFetchPlannerSnapshot.mockResolvedValue({
        schemaVersion: 1,
        annualWithdrawal: 20_000,
        investableAssets: 0,
      })

      const { result } = renderHook(() =>
        useCompanionPlannerBridge({ result: undefined, isResultStale: false })
      )

      await waitFor(() => {
        expect(result.current.bootstrapStatus).toBe('loaded')
      })

      expect(result.current.snapshotWithdrawalRate).toBeNull()
    })
  })

  it('uses latest base inputs when resolving active scenario overrides', async () => {
    enableCompanionMode('base001')
    mockFetchPlannerSnapshot.mockResolvedValue({
      schemaVersion: 1,
      avgMonthlyIncome: 4000,
      avgMonthlyExpense: 2600,
      investableAssets: 150_000,
    })

    const { result } = renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(result.current.bootstrapStatus).toBe('loaded')
    })

    expect(result.current.activeRunOverrides?.annualExpenses).toBe(31_200)
    expect(result.current.activeRunOverrides?.retirementAge).toBe(65)

    act(() => {
      useProfileStore.getState().setField('annualExpenses', 40_000)
      useProfileStore.getState().setField('retirementAge', 67)
    })

    await waitFor(() => {
      expect(result.current.activeRunOverrides?.annualExpenses).toBe(40_000)
      expect(result.current.activeRunOverrides?.retirementAge).toBe(67)
    })
  })
})
