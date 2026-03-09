import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMonteCarloQuery } from './useMonteCarloQuery'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useNormalizedAnalysisStore } from '@/stores/useNormalizedAnalysisStore'

const { mockRunMonteCarloWorker } = vi.hoisted(() => ({
  mockRunMonteCarloWorker: vi.fn(async () => ({
    success_rate: 0.91,
    percentile_bands: { p10: [], p25: [], p50: [], p75: [], p90: [] },
    terminal_stats: {
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      mean: 0,
    },
    safe_swr: null,
    failure_distribution: { ages: [], rates: [] },
    n_simulations: 128,
    computation_time_ms: 2,
    cached: false,
  })),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/lib/simulation/workerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/simulation/workerClient')>()
  return {
    ...actual,
    runMonteCarloWorker: mockRunMonteCarloWorker,
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useNormalizedAnalysisStore.getState().clearEntries()
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  useWithdrawalStore.getState().reset()
})

describe('useMonteCarloQuery stale detection', () => {
  it('marks completed results stale after a semantic planner-input change', async () => {
    const { result } = renderHook(() => useMonteCarloQuery(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.isStale).toBe(false)

    act(() => {
      setupTestPlan({ expenses: { annualExpenses: 60_000 } })
    })

    await waitFor(() => expect(result.current.isStale).toBe(true))
  })

  it('keeps completed results fresh when proof-only UI fields change', async () => {
    const { result } = renderHook(() => useMonteCarloQuery(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ annualExpenses: 54_000 })
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.isStale).toBe(false)

    act(() => {
      useSimulationStore.getState().setField('proofChartType', 'time_series')
      useSimulationStore.getState().setField('proofShowOutliers', true)
    })

    await waitFor(() => expect(result.current.isStale).toBe(false))
  })

  it('runs with valid defaults and routes through the worker path', async () => {
    const { result } = renderHook(() => useMonteCarloQuery(), { wrapper: createWrapper() })

    expect(result.current.canRun).toBe(true)
    expect(result.current.isStale).toBe(false)

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(mockRunMonteCarloWorker).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.data?.success_rate).toBe(0.91))
  })
})
