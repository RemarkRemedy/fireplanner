import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildMonteCarloEngineParams,
} from '@/lib/simulation/monteCarloParams'
import { APPROVED_MONTE_CARLO_PARAM_PARITY_OUTPUTS } from '@/test-helpers/approvedMonteCarloParamParityOutputs'
import { expectSemanticClose } from '@/test-helpers/semanticCompare'
import {
  buildMonteCarloParityInput,
  buildMonteCarloParitySurface,
  MONTE_CARLO_PARAM_PARITY_FIXTURES,
} from '@/test-helpers/monteCarloParamParity'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useNormalizedAnalysisStore } from '@/stores/useNormalizedAnalysisStore'
import { useSimulationStore } from '@/stores/useSimulationStore'

describe('normalized monte carlo parity snapshots', () => {
  beforeEach(() => {
    localStorage.clear()
    useNormalizedAnalysisStore.getState().clearEntries()
    useAllocationStore.getState().reset()
    useSimulationStore.getState().reset()
  })

  it.each(MONTE_CARLO_PARAM_PARITY_FIXTURES)('matches approved Monte Carlo params for %s', (fixtureId, snapshot) => {
    const input = buildMonteCarloParityInput(snapshot)
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

    expectSemanticClose(
      normalizedSurface,
      APPROVED_MONTE_CARLO_PARAM_PARITY_OUTPUTS[fixtureId],
    )
    // When cacheOps is provided, the normalized analysis store gets populated
    // with computed inputs. The activeCacheKey reflects the current computation.
    const storeState = useNormalizedAnalysisStore.getState()
    expect(storeState.activeCacheKey).toEqual(expect.any(String))
    expect(Object.keys(storeState.entries).length).toBeGreaterThanOrEqual(1)
  })

  it('applies explicit normalized monte carlo inputs without hybrid mixing', () => {
    const input = buildMonteCarloParityInput(MONTE_CARLO_PARAM_PARITY_FIXTURES[0][1])
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
