import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { DEFAULT_INCOME } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { buildCacheOpsFromStore } from '@/stores/useNormalizedAnalysisStore'
import { DEFAULT_PROFILE } from '@/stores/useProfileStore'
import { DEFAULT_PROPERTY } from '@/stores/usePropertyStore'
import { useSimulationStore } from '@/stores/useSimulationStore'

export function buildMonteCarloParitySurface(params: MonteCarloEngineParams) {
  return {
    currentAge: params.currentAge,
    retirementAge: params.retirementAge,
    lifeExpectancy: params.lifeExpectancy,
    initialPortfolio: params.initialPortfolio,
    allocationWeights: params.allocationWeights,
    expectedReturns: params.expectedReturns,
    stdDevs: params.stdDevs,
    annualSavings: params.annualSavings,
    postRetirementIncome: params.postRetirementIncome,
    annualExpensesAtRetirement: params.annualExpensesAtRetirement,
    withdrawalBasis: params.withdrawalBasis,
    deterministicAccumulation: params.deterministicAccumulation,
    ...(params.portfolioAdjustments ? { portfolioAdjustments: params.portfolioAdjustments } : {}),
    ...(params.yearlyWeights ? { yearlyWeights: params.yearlyWeights } : {}),
  }
}

export function buildMonteCarloParityInput(
  snapshot: (typeof LEGACY_PARITY_FIXTURES)[keyof typeof LEGACY_PARITY_FIXTURES]
) {
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()

  return {
    profile: {
      ...DEFAULT_PROFILE,
      ...snapshot.profile,
      validationErrors: {},
      profileRevision: 1,
    },
    income: {
      ...DEFAULT_INCOME,
      ...snapshot.income,
      validationErrors: {},
      incomeRevision: 1,
    },
    allocation: useAllocationStore.getState(),
    simulation: useSimulationStore.getState(),
    property: {
      ...DEFAULT_PROPERTY,
      ...snapshot.property,
      validationErrors: {},
      propertyRevision: 1,
    },
    cacheOps: buildCacheOpsFromStore(),
  }
}

export const MONTE_CARLO_PARAM_PARITY_FIXTURES = [
  ['salary-only', LEGACY_PARITY_FIXTURES.salaryOnly],
  ['property-and-CPF', LEGACY_PARITY_FIXTURES.propertyAndCpf],
  ['goals-and-life-events', LEGACY_PARITY_FIXTURES.goalsAndLifeEvents],
  ['pr-residency-transition', LEGACY_PARITY_FIXTURES.prResidencyTransition],
] as const
