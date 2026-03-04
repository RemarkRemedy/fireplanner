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

import { fetchPlannerSnapshot, postPlannerResults } from '@/lib/companion/companionClient'

const mockFetchPlannerSnapshot = vi.mocked(fetchPlannerSnapshot)
const mockPostPlannerResults = vi.mocked(postPlannerResults)

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
  },
  failure_distribution: {
    buckets: ['0-5'],
    counts: [100],
    total_failures: 100,
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

  window.sessionStorage.clear()
  window.history.pushState({}, '', '/')
})

describe('useCompanionPlannerBridge', () => {
  it('loads companion snapshot and fills planner inputs when companion=1', async () => {
    window.history.pushState({}, '', '/planner?token=abc123&companion=1')
    mockFetchPlannerSnapshot.mockResolvedValue({
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

    expect(mockFetchPlannerSnapshot).toHaveBeenCalledWith('abc123')
    expect(useProfileStore.getState().annualIncome).toBe(60_000)
    expect(useIncomeStore.getState().annualSalary).toBe(60_000)
    expect(useProfileStore.getState().annualExpenses).toBe(38_400)
    expect(useProfileStore.getState().liquidNetWorth).toBe(250_000)
    expect(useUIStore.getState().mode).toBe('advanced')
  })

  it('posts companion results with required payload keys after simulation completes', async () => {
    window.history.pushState({}, '', '/planner?token=xyz789&companion=1')
    mockFetchPlannerSnapshot.mockResolvedValue({
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

    const [token, payload] = mockPostPlannerResults.mock.calls[0]
    expect(token).toBe('xyz789')
    expect(payload).toEqual(expect.objectContaining({
      p_success: 0.91,
      horizonYears: 25,
    }))
    expect(payload).toHaveProperty('WR_critical_50')
    expect(payload).toHaveProperty('allocationSummary')
    expect(payload).toHaveProperty('fireAge')
    expect(payload).toHaveProperty('portfolioAtFire')
    expect(payload).toHaveProperty('wrCritical10')
    expect(payload).toHaveProperty('wrCritical90')
    expect(Object.keys(payload).sort()).toEqual([
      'WR_critical_50',
      'allocationSummary',
      'fireAge',
      'horizonYears',
      'p_success',
      'portfolioAtFire',
      'wrCritical10',
      'wrCritical90',
    ])

    await waitFor(() => {
      expect(result.current.saveStatus).toBe('saved')
    })

    const baseComparison = result.current.scenarioComparisons.find((row) => row.id === 'base')
    expect(baseComparison?.p_success).toBe(0.91)
  })

  it('keeps token across navigation after initial companion bootstrap', async () => {
    window.history.pushState({}, '', '/planner?token=persist123&companion=1')
    mockFetchPlannerSnapshot.mockResolvedValue({})

    const first = renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(first.result.current.bootstrapStatus).toBe('loaded')
    })

    first.unmount()

    window.history.pushState({}, '', '/stress-test')
    const second = renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(second.result.current.isCompanionMode).toBe(true)
    })

    expect(mockFetchPlannerSnapshot).toHaveBeenNthCalledWith(1, 'persist123')
    expect(mockFetchPlannerSnapshot).toHaveBeenNthCalledWith(2, 'persist123')
  })

  it('does not post results when Monte Carlo data is stale', async () => {
    window.history.pushState({}, '', '/planner?token=stale001&companion=1')
    mockFetchPlannerSnapshot.mockResolvedValue({})
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
    window.history.pushState({}, '', '/planner?token=saveguard001&companion=1')
    mockFetchPlannerSnapshot.mockResolvedValue({})
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

  it('prefers query token over conflicting hash token and removes token from URL', async () => {
    window.history.pushState({}, '', '/planner?token=query-token&companion=1#ct=hash-token')
    mockFetchPlannerSnapshot.mockResolvedValue({})

    renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(mockFetchPlannerSnapshot).toHaveBeenCalledWith('query-token')
    })

    const currentUrl = new URL(window.location.href)
    expect(currentUrl.searchParams.get('token')).toBeNull()
    const hashParams = new URLSearchParams(currentUrl.hash.startsWith('#') ? currentUrl.hash.slice(1) : currentUrl.hash)
    expect(hashParams.get('ct')).toBeNull()
  })

  it('prefers hash token over stale session token when query token is absent', async () => {
    window.sessionStorage.setItem('fireplanner-companion-token', 'stale-session-token')
    window.history.pushState({}, '', '/planner?companion=1#ct=fresh-hash-token')
    mockFetchPlannerSnapshot.mockResolvedValue({})

    renderHook(() =>
      useCompanionPlannerBridge({ result: undefined, isResultStale: false })
    )

    await waitFor(() => {
      expect(mockFetchPlannerSnapshot).toHaveBeenCalledWith('fresh-hash-token')
    })

    expect(window.sessionStorage.getItem('fireplanner-companion-token')).toBe('fresh-hash-token')
  })

  it('creates companion presets and supports duplicate + knob edits', async () => {
    window.history.pushState({}, '', '/planner?token=scn001&companion=1')
    mockFetchPlannerSnapshot.mockResolvedValue({
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
      'Buy HDB earlier',
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
    window.history.pushState({}, '', '/planner?token=base001&companion=1')
    mockFetchPlannerSnapshot.mockResolvedValue({
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
