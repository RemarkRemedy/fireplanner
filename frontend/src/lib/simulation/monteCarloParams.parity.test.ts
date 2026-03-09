import { beforeEach, describe, expect, it } from 'vitest'
import type { MonteCarloEngineParams } from '@/lib/simulation/monteCarlo'
import {
  buildLegacyMonteCarloEngineParams,
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
  })
})
