/**
 * StressTestPage orchestration tests for companion mode.
 *
 * Tests the page-level integration of:
 * - MC result → action impact analysis trigger
 * - 15-second timeout guardrail with partial/zero results
 * - Abort on rerun (new MC run aborts in-flight analysis)
 * - Error display when analysis fails
 * - Cleanup on unmount (abort controllers cleaned up)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StressTestPage } from './StressTestPage'
import { ExpenseTrackerProvider } from '@/components/email/ExpenseTrackerProvider'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useUIStore } from '@/stores/useUIStore'
import type { MonteCarloResult } from '@/lib/types'
import type { ActionImpactRunnerOutput } from '@/lib/companion/actionImpacts'
import * as incomeProjectionHooks from '@/hooks/useIncomeProjection'

// ── Module mocks ─────────────────────────────────────────

vi.mock('@/lib/companion/isCompanionMode', () => ({
  isCompanionMode: vi.fn(() => true),
  getCompanionToken: vi.fn(() => 'test-token'),
  getCompanionBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

vi.mock('@/lib/companion/companionClient', () => ({
  fetchPlannerSnapshot: vi.fn(),
  postPlannerResults: vi.fn(),
}))

vi.mock('@/lib/simulation/workerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/simulation/workerClient')>()
  return { ...actual, runMonteCarloWorker: vi.fn() }
})

vi.mock('@/lib/companion/actionImpacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/companion/actionImpacts')>()
  return { ...actual, runActionImpactAnalysis: vi.fn() }
})

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

import { fetchPlannerSnapshot, postPlannerResults } from '@/lib/companion/companionClient'
import { runMonteCarloWorker } from '@/lib/simulation/workerClient'
import { runActionImpactAnalysis } from '@/lib/companion/actionImpacts'

const mockFetchSnapshot = vi.mocked(fetchPlannerSnapshot)
const mockPostResults = vi.mocked(postPlannerResults)
const mockRunMC = vi.mocked(runMonteCarloWorker)
const mockRunActionImpacts = vi.mocked(runActionImpactAnalysis)

// ── Fixtures ─────────────────────────────────────────────

const SAMPLE_MC_RESULT: MonteCarloResult = {
  success_rate: 0.91,
  percentile_bands: {
    years: [0], ages: [65],
    p5: [1], p10: [1], p25: [1], p50: [1], p75: [1], p90: [1], p95: [1],
  },
  terminal_stats: {
    median: 100_000, mean: 120_000, worst: 5_000,
    best: 400_000, p5: 10_000, p95: 300_000,
  },
  safe_swr: {
    confidence_95: 0.03, confidence_90: 0.035,
    confidence_85: 0.04, confidence_50: 0.047,
  },
  failure_distribution: {
    buckets: ['0-5'], counts: [100], total_failures: 100,
    counts_5y: [0, 0],
  },
  withdrawal_bands: {
    years: [0], ages: [65],
    p5: [20_000], p10: [25_000], p25: [30_000], p50: [40_000],
    p75: [50_000], p90: [60_000], p95: [65_000],
  },
  n_simulations: 10_000,
  computation_time_ms: 42,
  cached: false,
}

function makeActionImpactOutput(
  partial?: Partial<ActionImpactRunnerOutput>,
): ActionImpactRunnerOutput {
  return {
    impacts: [{
      lever: {
        id: 'expenses_down_10pct',
        label: 'Cut expenses by 10%',
        shortLabel: '-10% expenses',
        description: 'Reduce annual expenses by 10%',
        applicableTo: 'all',
      },
      metrics: { p_success: 0.95, fail_prob_0_5y: 0.001, fail_prob_6_10y: 0.002 },
      delta_p_success: 0.04,
      delta_fail_prob_0_5y: -0.002,
      delta_fail_prob_6_10y: -0.001,
      rationale: '-10% expenses improves success by 4.0pp.',
    }],
    baseMetrics: { p_success: 0.91, fail_prob_0_5y: 0.003, fail_prob_6_10y: 0.003 },
    completedLevers: 3,
    totalLevers: 3,
    ...partial,
  }
}

function createMockNormalizedContext(overrides?: Partial<ReturnType<typeof incomeProjectionHooks.useNormalizedLegacyAnalysisContext>>) {
  return {
    cacheKey: 'legacy:1:1:1::00000000',
    householdRevision: 'legacy:1:1:1',
    scenarioOverrideHash: '00000000',
    referenceAdultId: 'adult-self',
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    firstRetirementYearOffset: 35,
    householdRetirementYearOffset: 35,
    compiledPlan: {
      assumptions: {
        returns: {
          inflation: 0.025,
        },
      },
    },
    entry: {
      selectors: {
        deterministic: { rows: [], milestones: [] },
        projection: {
          annualSavingsByYear: [],
          postRetirementIncomeByYear: [],
          retirementExpenseBaseByYear: [],
          householdWithdrawalNeedByYear: [],
          portfolioAdjustments: [],
        },
        monteCarlo: {
          annualSavingsByYear: [],
          postRetirementIncomeByYear: [],
          householdWithdrawalNeedByYear: [],
          portfolioAdjustments: [],
        },
        backtest: {
          postRetirementIncomeByYear: [],
          retirementExpenseBaseByYear: [],
          householdWithdrawalNeedByYear: [],
          portfolioAdjustments: [],
        },
        cpf: { cpfByAdultId: {} },
        healthcare: { healthcareByAdultId: {} },
        companion: {
          milestones: [],
          annualSavingsByYear: [],
          postRetirementIncomeByYear: [],
          householdWithdrawalNeedByYear: [],
        },
      },
    },
    ...overrides,
  } as ReturnType<typeof incomeProjectionHooks.useNormalizedLegacyAnalysisContext>
}

// ── Helpers ──────────────────────────────────────────────

function resetAllStores() {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  usePropertyStore.getState().reset()
  useUIStore.setState({ mode: 'simple' })
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/stress-test']}>
        <ExpenseTrackerProvider>
          <StressTestPage />
        </ExpenseTrackerProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Get the companion Run Simulation button (first of potentially multiple) */
function getRunButton() {
  return screen.getAllByRole('button', { name: /Run Simulation/i })[0]
}

/** Wait for the companion Run Simulation button to appear */
async function waitForRunButton() {
  await waitFor(() => {
    expect(getRunButton()).toBeInTheDocument()
  })
}

// ── Setup ────────────────────────────────────────────────

beforeEach(() => {
  resetAllStores()
  mockFetchSnapshot.mockReset()
  mockPostResults.mockReset()
  mockRunMC.mockReset()
  mockRunActionImpacts.mockReset()

  // Companion bootstrap: return minimal snapshot
  mockFetchSnapshot.mockResolvedValue({ schemaVersion: 1 })
  mockPostResults.mockResolvedValue()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ────────────────────────────────────────────────

describe('StressTestPage companion orchestration', () => {
  it('uses normalized retirement context when building companion action impact overrides', async () => {
    const normalizedSpy = vi
      .spyOn(incomeProjectionHooks, 'useNormalizedLegacyAnalysisContext')
      .mockReturnValue(createMockNormalizedContext({
        currentAge: 65,
        retirementAge: 65,
        firstRetirementYearOffset: 0,
        householdRetirementYearOffset: 0,
      }))

    mockRunMC.mockResolvedValue(SAMPLE_MC_RESULT)
    mockRunActionImpacts.mockResolvedValue(makeActionImpactOutput())

    const user = userEvent.setup()
    renderPage()

    await waitForRunButton()
    await user.click(getRunButton())

    await waitFor(() => {
      expect(mockRunActionImpacts).toHaveBeenCalled()
    })

    expect(mockRunActionImpacts.mock.calls[0]?.[0].profileOverrides?.retirementAge).toBe(66)

    normalizedSpy.mockRestore()
  })

  it('calls runActionImpactAnalysis after MC completes and shows results', async () => {
    // MC resolves immediately
    mockRunMC.mockResolvedValue(SAMPLE_MC_RESULT)

    // Action impacts resolve with a result
    mockRunActionImpacts.mockResolvedValue(makeActionImpactOutput())

    const user = userEvent.setup()
    renderPage()

    // Wait for companion bootstrap
    await waitForRunButton()

    // Click the Run button
    await user.click(getRunButton())

    // Wait for action impact analysis to be called (triggered by useEffect after MC completes)
    await waitFor(() => {
      expect(mockRunActionImpacts).toHaveBeenCalled()
    })

    // Verify the impact results appear in the DOM
    await waitFor(() => {
      expect(screen.getByText('What could improve your plan?')).toBeInTheDocument()
      expect(screen.getByText('Cut expenses by 10%')).toBeInTheDocument()
    })
  })

  it('shows timeout message with partial results after 15 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockRunMC.mockResolvedValue(SAMPLE_MC_RESULT)

    // Action impacts: wait for abort signal (simulating long-running analysis)
    mockRunActionImpacts.mockImplementation(async (input) => {
      await new Promise<void>((resolve) => {
        if (input.signal?.aborted) {
          resolve()
          return
        }
        input.signal?.addEventListener('abort', () => resolve())
      })
      // Return partial results after being aborted by timeout
      return makeActionImpactOutput({
        completedLevers: 1,
        totalLevers: 3,
      })
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    await waitForRunButton()

    await user.click(getRunButton())

    // Wait for MC to complete and action impact to start
    await waitFor(() => {
      expect(mockRunActionImpacts).toHaveBeenCalled()
    })

    // Advance past the 15-second timeout
    await act(async () => {
      vi.advanceTimersByTime(16_000)
    })

    await waitFor(() => {
      expect(screen.getByText(/Analysis timed out\. Showing 1\/3 results\./)).toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('shows full timeout message when zero levers complete', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockRunMC.mockResolvedValue(SAMPLE_MC_RESULT)

    // Action impacts: wait for abort, return zero results
    mockRunActionImpacts.mockImplementation(async (input) => {
      await new Promise<void>((resolve) => {
        if (input.signal?.aborted) {
          resolve()
          return
        }
        input.signal?.addEventListener('abort', () => resolve())
      })
      return makeActionImpactOutput({
        impacts: [],
        completedLevers: 0,
        totalLevers: 3,
      })
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    await waitForRunButton()

    await user.click(getRunButton())

    await waitFor(() => {
      expect(mockRunActionImpacts).toHaveBeenCalled()
    })

    await act(async () => {
      vi.advanceTimersByTime(16_000)
    })

    await waitFor(() => {
      expect(screen.getByText(/Analysis timed out after 15 seconds\. Please try again\./)).toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('aborts first analysis when Run is clicked again', async () => {
    let firstSignal: AbortSignal | undefined
    let resolveFirst: (() => void) | undefined

    mockRunMC.mockResolvedValue(SAMPLE_MC_RESULT)

    // First call: capture signal and hang
    mockRunActionImpacts.mockImplementationOnce(async (input) => {
      firstSignal = input.signal
      await new Promise<void>((resolve) => {
        resolveFirst = resolve
        input.signal?.addEventListener('abort', () => resolve())
      })
      return makeActionImpactOutput({ impacts: [], completedLevers: 0, totalLevers: 3 })
    })

    // Second call: resolve immediately
    mockRunActionImpacts.mockImplementationOnce(async () => {
      return makeActionImpactOutput()
    })

    const user = userEvent.setup()
    renderPage()

    await waitForRunButton()

    // First run
    await user.click(getRunButton())

    await waitFor(() => {
      expect(mockRunActionImpacts).toHaveBeenCalledTimes(1)
    })

    // Second run — should abort the first
    await user.click(getRunButton())

    await waitFor(() => {
      expect(firstSignal?.aborted).toBe(true)
    })

    // Resolve the first to prevent hanging
    resolveFirst?.()
  })

  it('shows error message when runActionImpactAnalysis rejects', async () => {
    mockRunMC.mockResolvedValue(SAMPLE_MC_RESULT)

    // Action impacts: reject with an error
    mockRunActionImpacts.mockRejectedValue(new Error('Worker crashed'))

    const user = userEvent.setup()
    renderPage()

    await waitForRunButton()

    await user.click(getRunButton())

    await waitFor(() => {
      expect(screen.getByText(/Action impact analysis failed/)).toBeInTheDocument()
    })
  })

  it('aborts action impact analysis on unmount', async () => {
    let capturedSignal: AbortSignal | undefined

    mockRunMC.mockResolvedValue(SAMPLE_MC_RESULT)

    // Capture the signal and hang until abort
    mockRunActionImpacts.mockImplementation(async (input) => {
      capturedSignal = input.signal
      await new Promise<void>((resolve) => {
        input.signal?.addEventListener('abort', () => resolve())
      })
      return makeActionImpactOutput({ impacts: [], completedLevers: 0, totalLevers: 3 })
    })

    const user = userEvent.setup()
    const { unmount } = renderPage()

    await waitForRunButton()

    await user.click(getRunButton())

    await waitFor(() => {
      expect(mockRunActionImpacts).toHaveBeenCalled()
    })

    // Unmount should abort the in-flight analysis
    unmount()

    expect(capturedSignal?.aborted).toBe(true)
  })
})
