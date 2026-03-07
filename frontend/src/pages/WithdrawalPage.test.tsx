import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProfileStore } from '@/stores/useProfileStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'

vi.mock('@/hooks/useExplorePortfolio', () => ({
  useExplorePortfolio: vi.fn(),
}))

vi.mock('@/hooks/useWithdrawalComparison', () => ({
  useWithdrawalComparison: vi.fn(),
}))

vi.mock('@/hooks/useIncomeProjection', () => ({
  useNormalizedLegacyAnalysisContext: vi.fn(),
}))

vi.mock('@/lib/simulation/workerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/simulation/workerClient')>()
  return {
    ...actual,
    runMonteCarloWorker: vi.fn(),
  }
})

vi.mock('@/hooks/useEffectiveMode', () => ({
  useEffectiveMode: () => 'simple',
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: () => undefined,
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/components/withdrawal/StrategyParamsSection', () => ({
  StrategyParamsSection: () => <div>strategy-params</div>,
}))

vi.mock('@/components/withdrawal/ComparisonTable', () => ({
  ComparisonTable: () => <div>comparison-table</div>,
}))

vi.mock('@/components/withdrawal/WithdrawalChart', () => ({
  WithdrawalChart: () => <div>withdrawal-chart</div>,
}))

vi.mock('@/components/withdrawal/PortfolioComparisonChart', () => ({
  PortfolioComparisonChart: () => <div>portfolio-chart</div>,
}))

vi.mock('@/components/withdrawal/StrategyGuideDialog', () => ({
  StrategyGuideDialog: () => null,
}))

vi.mock('@/components/simulation/SimulationControls', () => ({
  SimulationControls: ({
    canRun,
    onRun,
  }: {
    canRun: boolean
    onRun: () => void
  }) => (
    <button disabled={!canRun} onClick={onRun}>
      Run Simulation
    </button>
  ),
}))

vi.mock('@/components/simulation/ResultsSummary', () => ({
  ResultsSummary: () => <div>results-summary</div>,
}))

vi.mock('@/components/simulation/FanChart', () => ({
  FanChart: () => <div>fan-chart</div>,
}))

vi.mock('@/components/simulation/FailureDistributionChart', () => ({
  FailureDistributionChart: () => <div>failure-distribution</div>,
}))

vi.mock('@/components/simulation/SpendingMetricsPanel', () => ({
  SpendingMetricsPanel: () => <div>spending-metrics</div>,
}))

vi.mock('@/components/shared/InterpretationCallout', () => ({
  InterpretationCallout: () => <div>interpretation</div>,
}))

import { useExplorePortfolio } from '@/hooks/useExplorePortfolio'
import { useWithdrawalComparison } from '@/hooks/useWithdrawalComparison'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { runMonteCarloWorker } from '@/lib/simulation/workerClient'
import { WithdrawalPage } from './WithdrawalPage'

const mockUseExplorePortfolio = vi.mocked(useExplorePortfolio)
const mockUseWithdrawalComparison = vi.mocked(useWithdrawalComparison)
const mockUseNormalizedLegacyAnalysisContext = vi.mocked(useNormalizedLegacyAnalysisContext)
const mockRunMonteCarloWorker = vi.mocked(runMonteCarloWorker)

const SAMPLE_MC_RESULT = {
  success_rate: 0.91,
  percentile_bands: {
    years: [0],
    ages: [62],
    p5: [100_000],
    p10: [110_000],
    p25: [120_000],
    p50: [130_000],
    p75: [140_000],
    p90: [150_000],
    p95: [160_000],
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
    counts_5y: [0, 0] as [number, number],
  },
  withdrawal_bands: {
    years: [0],
    ages: [62],
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/withdrawal']}>
        <WithdrawalPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useProfileStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  useWithdrawalStore.getState().reset()

  useProfileStore.getState().setField('currentAge', 40)
  useProfileStore.getState().setField('lifeExpectancy', 80)
  useProfileStore.getState().setField('annualExpenses', 48_000)
  useProfileStore.getState().setField('inflation', 0.02)
  useProfileStore.getState().setField('expenseRatio', 0.003)

  mockRunMonteCarloWorker.mockReset()
  mockUseExplorePortfolio.mockReturnValue({
    balanceMode: 'myPlan',
    setBalanceMode: vi.fn(),
    initialPortfolio: 500_000,
    allocationWeights: [0.5, 0.2, 0.1, 0.2, 0, 0, 0, 0],
    startAge: 62,
    label: 'My Plan: $500,000 at age 62',
  })
  mockUseWithdrawalComparison.mockReturnValue({
    results: {
      yearResults: [],
      summaries: [],
    },
    hasErrors: false,
    errors: {},
  } as unknown as ReturnType<typeof useWithdrawalComparison>)
  mockUseNormalizedLegacyAnalysisContext.mockReturnValue({
    cacheKey: 'legacy:1:1:1::00000000',
    householdRevision: 'legacy:1:1:1',
    scenarioOverrideHash: '00000000',
    referenceAdultId: 'adult-self',
    currentAge: 35,
    retirementAge: 62,
    lifeExpectancy: 92,
    firstRetirementYearOffset: 27,
    householdRetirementYearOffset: 27,
    compiledPlan: {
      assumptions: {
        returns: {
          inflation: 0.02,
        },
      },
    },
    entry: {
      selectors: {},
    },
  } as ReturnType<typeof useNormalizedLegacyAnalysisContext>)
  mockRunMonteCarloWorker.mockResolvedValue(SAMPLE_MC_RESULT)
})

describe('WithdrawalPage', () => {
  it('runs the withdrawal MC smoke flow with normalized timing inputs', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: /MC Simulation/i }))
    await user.click(screen.getByRole('button', { name: /Run Simulation/i }))

    await waitFor(() => {
      expect(mockRunMonteCarloWorker).toHaveBeenCalledTimes(1)
    })

    const params = mockRunMonteCarloWorker.mock.calls[0]?.[0]
    expect(params?.lifeExpectancy).toBe(92)
    expect(params?.currentAge).toBe(62)
    expect(params?.retirementAge).toBe(62)
    expect(params?.annualExpensesAtRetirement).toBeCloseTo(48_000 * Math.pow(1.02, 27), 6)
  })
})
