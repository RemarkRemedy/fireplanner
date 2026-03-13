import { beforeEach, describe, it } from 'vitest'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { APPROVED_GOLDEN_OUTPUTS } from '@/test-helpers/approvedActuarialGoldenOutputs'
import { APPROVED_SEQUENCE_RISK_PARAM_PARITY_OUTPUTS } from '@/test-helpers/approvedSequenceRiskParamParityOutputs'
import {
  ACTUARIAL_GOLDEN_SCENARIO_DEFINITIONS,
  buildGoldenScenarioActual,
  buildGoldenSequenceRiskParamSurface,
} from '@/test-helpers/actuarialGoldens'
import { expectSemanticClose } from '@/test-helpers/semanticCompare'

describe('normalized analysis parity surfaces', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it.each(ACTUARIAL_GOLDEN_SCENARIO_DEFINITIONS)(
    'keeps reduced deterministic and sequence-risk param surfaces stable for $id',
    (scenario) => {
      const actual = buildGoldenScenarioActual({ inputs: scenario.inputs })
      const approved = APPROVED_GOLDEN_OUTPUTS[scenario.id]
      const retirementAge = LEGACY_PARITY_FIXTURES[scenario.inputs.fixtureKey].profile.retirementAge

      expectSemanticClose(
        {
          analysis: actual.analysis,
          fire: actual.fire,
          projection: {
            summary: actual.projection.summary,
            retirementRowAge: actual.projection.rows.find((row) => row.age === retirementAge)?.age ?? null,
          },
        },
        {
          analysis: approved.analysis,
          fire: approved.fire,
          projection: {
            summary: approved.projection.summary,
            retirementRowAge: retirementAge,
          },
        },
      )

      expectSemanticClose(
        buildGoldenSequenceRiskParamSurface({ inputs: scenario.inputs }),
        APPROVED_SEQUENCE_RISK_PARAM_PARITY_OUTPUTS[scenario.id],
      )
    },
  )
})
