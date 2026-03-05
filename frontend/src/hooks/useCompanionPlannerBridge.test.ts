import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { MonteCarloResult } from '@/lib/types'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'
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
      p_success: 0.91,
      horizonYears: 25,
    }))
    expect(payload).toHaveProperty('schemaVersion')
    expect(payload).toHaveProperty('WR_critical_50')
    expect(payload).toHaveProperty('allocationSummary')
    expect(payload).toHaveProperty('fire_age')
    expect(payload).toHaveProperty('portfolio_at_fire')
    expect(payload).toHaveProperty('wr_critical_10')
    expect(payload).toHaveProperty('wr_critical_90')
    expect(Object.keys(payload).sort()).toEqual([
      'WR_critical_50',
      'allocationSummary',
      'fire_age',
      'horizonYears',
      'p_success',
      'portfolio_at_fire',
      'schemaVersion',
      'wr_critical_10',
      'wr_critical_90',
    ])

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
