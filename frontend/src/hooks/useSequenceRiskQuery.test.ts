import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { buildSequenceRiskWorkerParams, useSequenceRiskQuery } from './useSequenceRiskQuery'
import type { CrisisScenario } from '@/lib/types'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useNormalizedAnalysisStore } from '@/stores/useNormalizedAnalysisStore'
import { useAnalysisPortfolio } from './useAnalysisPortfolio'
import { useNormalizedLegacyAnalysisContext } from './useIncomeProjection'

const { mockRunSequenceRiskWorker } = vi.hoisted(() => ({
  mockRunSequenceRiskWorker: vi.fn(async () => ({
    normal_success_rate: 0.86,
    crisis_success_rate: 0.73,
    success_degradation: 0.13,
    normal_percentile_bands: { p10: [], p25: [], p50: [], p75: [], p90: [] },
    crisis_percentile_bands: { p10: [], p25: [], p50: [], p75: [], p90: [] },
    mitigations: [],
    computation_time_ms: 3,
  })),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/lib/simulation/workerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/simulation/workerClient')>()
  return {
    ...actual,
    runSequenceRiskWorker: mockRunSequenceRiskWorker,
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

const CRISIS: CrisisScenario = {
  id: 'test-crisis',
  name: 'Test Crisis',
  region: 'US',
  startYear: 2000,
  peakDrawdown: -0.4,
  durationYears: 3,
  recoveryYears: 5,
  equityReturnSequence: [-0.3, -0.15, 0.05],
  description: 'Synthetic crisis for stale detection tests',
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useNormalizedAnalysisStore.getState().clearEntries()
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  useWithdrawalStore.getState().reset()
  usePropertyStore.getState().reset()
  useSimulationStore.getState().reset()
})

function buildWorkerInput(overrides?: {
  retirementOffset?: number
  postRetirementIncomeByYear?: number[]
}) {
  const allocation = useAllocationStore.getState()
  const analysisPortfolio = {
    retirementPortfolio: 700_000,
    allocationWeights: allocation.currentWeights,
  } as ReturnType<typeof useAnalysisPortfolio>
  const normalized = {
    householdRetirementYearOffset: overrides?.retirementOffset ?? 2,
    retirementAge: 65,
    currentAge: 63,
    lifeExpectancy: 90,
    entry: {
      selectors: {
        backtest: {
          postRetirementIncomeByYear: overrides?.postRetirementIncomeByYear,
          portfolioAdjustments: [],
        },
      },
    },
  } as unknown as ReturnType<typeof useNormalizedLegacyAnalysisContext>

  return {
    allocation,
    analysisPortfolio,
    crisis: CRISIS,
    normalized,
    profile: {
      ...useProfileStore.getState(),
      currentAge: 63,
      retirementAge: 65,
      lifeExpectancy: 90,
      annualExpenses: 48_000,
    },
    simulation: useSimulationStore.getState(),
    withdrawal: useWithdrawalStore.getState(),
  }
}

describe('useSequenceRiskQuery stale detection', () => {
  it('marks completed results stale after a semantic planner-input change', async () => {
    const { result } = renderHook(() => useSequenceRiskQuery(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate(CRISIS)
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.isStale).toBe(false)

    act(() => {
      useAllocationStore.getState().setReturnOverride(0, 0.09)
    })

    await waitFor(() => expect(result.current.isStale).toBe(true))
  })

  it('keeps completed results fresh when proof-only UI fields change', async () => {
    const { result } = renderHook(() => useSequenceRiskQuery(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate(CRISIS)
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.isStale).toBe(false)

    act(() => {
      useSimulationStore.getState().setField('proofChartType', 'individual_cycles')
      useSimulationStore.getState().setField('proofSelectedYear', 4)
    })

    await waitFor(() => expect(result.current.isStale).toBe(false))
  })

  it('runs with valid defaults and routes through the worker path', async () => {
    const { result } = renderHook(() => useSequenceRiskQuery(), { wrapper: createWrapper() })

    expect(result.current.canRun).toBe(true)
    expect(result.current.isStale).toBe(false)

    act(() => {
      result.current.mutate(CRISIS)
    })

    await waitFor(() => expect(mockRunSequenceRiskWorker).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.data?.success_degradation).toBe(0.13))
  })
})

describe('buildSequenceRiskWorkerParams', () => {
  it('returns an empty post-retirement income array when the selector data is missing', () => {
    const params = buildSequenceRiskWorkerParams(buildWorkerInput())
    expect(params.postRetirementIncome).toEqual([])
  })

  it('keeps the first retirement-year supplemental income in the worker params', () => {
    const params = buildSequenceRiskWorkerParams(buildWorkerInput({
      retirementOffset: 2,
      postRetirementIncomeByYear: [4_000, 5_000, 6_000, 7_000, 8_000],
    }))

    expect(params.postRetirementIncome).toEqual([6_000, 7_000, 8_000])
  })
})
