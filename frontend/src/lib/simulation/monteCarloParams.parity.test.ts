import { beforeEach, describe, expect, it } from 'vitest'
import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'
import {
  buildMonteCarloEngineParams,
} from '@/lib/simulation/monteCarloParams'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { DEFAULT_INCOME } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { buildCacheOpsFromStore, useNormalizedAnalysisStore } from '@/stores/useNormalizedAnalysisStore'
import { DEFAULT_PROFILE } from '@/stores/useProfileStore'
import { DEFAULT_PROPERTY } from '@/stores/usePropertyStore'
import { useSimulationStore } from '@/stores/useSimulationStore'

function buildMonteCarloParitySurface(params: MonteCarloEngineParams) {
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
    portfolioAdjustments: params.portfolioAdjustments,
    withdrawalBasis: params.withdrawalBasis,
    deterministicAccumulation: params.deterministicAccumulation,
    yearlyWeights: params.yearlyWeights,
  }
}

function buildParityInput(snapshot: (typeof LEGACY_PARITY_FIXTURES)[keyof typeof LEGACY_PARITY_FIXTURES]) {
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

describe('normalized monte carlo parity snapshots', () => {
  beforeEach(() => {
    localStorage.clear()
    useNormalizedAnalysisStore.getState().clearEntries()
    useAllocationStore.getState().reset()
    useSimulationStore.getState().reset()
  })

  it.each([
    ['salary-only', LEGACY_PARITY_FIXTURES.salaryOnly],
    ['property-and-CPF', LEGACY_PARITY_FIXTURES.propertyAndCpf],
    ['goals-and-life-events', LEGACY_PARITY_FIXTURES.goalsAndLifeEvents],
    ['pr-residency-transition', LEGACY_PARITY_FIXTURES.prResidencyTransition],
  ])('matches legacy Monte Carlo params for %s', (_, snapshot) => {
    const input = buildParityInput(snapshot)
    const normalizedSurface = buildMonteCarloParitySurface(
      buildMonteCarloEngineParams(input)
    )

    // Structural sanity checks on the normalized output
    expect(normalizedSurface.annualSavings.length).toBe(
      normalizedSurface.retirementAge - normalizedSurface.currentAge
    )
    expect(normalizedSurface.currentAge).toBeGreaterThanOrEqual(18)
    expect(normalizedSurface.retirementAge).toBeGreaterThan(normalizedSurface.currentAge)
    expect(normalizedSurface.lifeExpectancy).toBeGreaterThan(normalizedSurface.retirementAge)

    expect(normalizedSurface).toMatchSnapshot()
    expect(useNormalizedAnalysisStore.getState().activeCacheKey).toBeNull()
    expect(Object.keys(useNormalizedAnalysisStore.getState().entries)).toHaveLength(0)
  })

  it('applies explicit normalized monte carlo inputs without hybrid mixing', () => {
    const input = buildParityInput(LEGACY_PARITY_FIXTURES.salaryOnly)
    const normalizedAnalysisInputs = {
      cacheKey: 'legacy:1:1:1::override',
      householdRevision: 'legacy:1:1:1',
      scenarioOverrideHash: 'override',
      currentAge: 41,
      retirementAge: 54,
      lifeExpectancy: 93,
      annualSavings: [11_000, 12_500],
      postRetirementIncome: [4_200, 4_500, 4_900],
      annualExpensesAtRetirement: 63_000,
      portfolioAdjustments: [{ year: 3, amount: -9_500 }],
    }

    const params = buildMonteCarloEngineParams({
      ...input,
      normalizedAnalysisInputs,
    })

    expect(params.currentAge).toBe(normalizedAnalysisInputs.currentAge)
    expect(params.retirementAge).toBe(normalizedAnalysisInputs.retirementAge)
    expect(params.lifeExpectancy).toBe(normalizedAnalysisInputs.lifeExpectancy)
    expect(params.annualSavings).toEqual(normalizedAnalysisInputs.annualSavings)
    expect(params.postRetirementIncome).toEqual(normalizedAnalysisInputs.postRetirementIncome)
    expect(params.annualExpensesAtRetirement).toBe(
      normalizedAnalysisInputs.annualExpensesAtRetirement
    )
    expect(params.portfolioAdjustments).toEqual(
      normalizedAnalysisInputs.portfolioAdjustments
    )
  })
})
