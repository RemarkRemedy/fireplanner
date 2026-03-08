import { beforeEach, describe, expect, it } from 'vitest'
import { buildBacktestWorkerParams } from './useBacktestQuery'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useWithdrawalStore } from '@/stores/useWithdrawalStore'
import { useAnalysisPortfolio } from './useAnalysisPortfolio'
import { useNormalizedLegacyAnalysisContext } from './useIncomeProjection'

function buildTestInput(overrides?: {
  retirementOffset?: number
  postRetirementIncomeByYear?: number[]
}) {
  const allocation = useAllocationStore.getState()
  const profile = {
    ...useProfileStore.getState(),
    currentAge: 63,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualExpenses: 48_000,
  }
  const simulation = useSimulationStore.getState()
  const withdrawal = useWithdrawalStore.getState()
  const analysisPortfolio = {
    retirementPortfolio: 750_000,
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
    analysisPortfolio,
    allocation,
    config: {
      swr: 0.04,
      retirementDuration: 3,
      dataset: 'us_only' as const,
      blendRatio: 0.7,
      withdrawalStrategy: 'constant_dollar' as const,
      heatmapConfig: {
        swrMin: 0.01,
        swrMax: 0.06,
        swrStep: 0.005,
        durationMin: 15,
        durationMax: 45,
        durationStep: 5,
      },
    },
    normalized,
    profile,
    simulation,
    withdrawal,
  }
}

beforeEach(() => {
  useProfileStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  useWithdrawalStore.getState().reset()
})

describe('buildBacktestWorkerParams', () => {
  it('returns an empty post-retirement income array when the selector data is missing', () => {
    const params = buildBacktestWorkerParams(buildTestInput())
    expect(params.postRetirementIncome).toBeUndefined()
  })

  it('keeps the first retirement-year supplemental income in the worker params', () => {
    const params = buildBacktestWorkerParams(buildTestInput({
      retirementOffset: 2,
      postRetirementIncomeByYear: [5_000, 6_000, 7_000, 8_000, 9_000],
    }))

    expect(params.postRetirementIncome).toEqual([7_000, 8_000, 9_000])
  })
})
