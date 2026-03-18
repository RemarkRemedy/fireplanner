import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACTUARIAL_GOLDEN_SCENARIOS,
  assertGoldenScenarioMatches,
  validateGoldenScenarioContract,
} from '@/test-helpers/actuarialGoldens'

describe('actuarial golden fixtures', () => {
  it('keeps every approved fixture structurally valid', () => {
    for (const scenario of ACTUARIAL_GOLDEN_SCENARIOS) {
      expect(() => validateGoldenScenarioContract(scenario)).not.toThrow()
    }
  })

  describe.each(ACTUARIAL_GOLDEN_SCENARIOS)('$id', (scenario) => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('matches approved projection, FIRE, Monte Carlo, backtest, and sequence-risk outputs', () => {
      assertGoldenScenarioMatches(scenario)
    }, 20_000)
  })
})
