import { beforeEach, describe, expect, it } from 'vitest'
import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'
import {
  buildLegacyMonteCarloEngineParams,
  buildMonteCarloEngineParams,
} from '@/lib/simulation/monteCarloParams'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { DEFAULT_INCOME } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useNormalizedAnalysisStore } from '@/stores/useNormalizedAnalysisStore'
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

function expectDeepClose(actual: unknown, expected: unknown, path = 'root') {
  if (typeof actual === 'number' && typeof expected === 'number') {
    expect(Math.abs(actual - expected), path).toBeLessThanOrEqual(1e-9)
    return
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    expect(actual.length, `${path}.length`).toBe(expected.length)
    actual.forEach((entry, index) => {
      expectDeepClose(entry, expected[index], `${path}[${index}]`)
    })
    return
  }

  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const actualRecord = actual as Record<string, unknown>
    const expectedRecord = expected as Record<string, unknown>
    expect(Object.keys(actualRecord).sort(), `${path}.keys`).toEqual(
      Object.keys(expectedRecord).sort()
    )

    for (const key of Object.keys(actualRecord)) {
      expectDeepClose(actualRecord[key], expectedRecord[key], `${path}.${key}`)
    }
    return
  }

  expect(actual, path).toEqual(expected)
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
    const legacySurface = buildMonteCarloParitySurface(
      buildLegacyMonteCarloEngineParams(input)
    )

    expectDeepClose(normalizedSurface, legacySurface)
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
