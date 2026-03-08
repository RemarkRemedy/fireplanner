import { beforeEach, describe, expect, it } from 'vitest'
import {
  getOrCreateLegacyNormalizedAnalysisEntry,
  toMonteCarloAnalysisInputs,
} from '@/stores/useNormalizedAnalysisStore'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import {
  buildLegacyHouseholdRevision,
  buildNormalizedAnalysisCacheKey,
  stableScenarioOverrideHash,
  useNormalizedAnalysisStore,
} from '@/stores/useNormalizedAnalysisStore'
import { DEFAULT_PROFILE } from '@/stores/useProfileStore'
import { DEFAULT_INCOME } from '@/stores/useIncomeStore'
import { DEFAULT_PROPERTY } from '@/stores/usePropertyStore'

function buildRevisionedSnapshotState<TState extends Record<string, unknown>>(
  defaults: TState,
  snapshot: Partial<TState>,
  revisionKey: string,
  revision: number
) {
  return {
    ...defaults,
    ...snapshot,
    validationErrors: {},
    [revisionKey]: revision,
  }
}

describe('toAnalysisInputs', () => {
  beforeEach(() => {
    useNormalizedAnalysisStore.getState().clearEntries()
  })

  it('caches legacy compiled entries by revision tuple and canonical override hash', () => {
    const snapshot = LEGACY_PARITY_FIXTURES.goalsAndLifeEvents
    const entry = getOrCreateLegacyNormalizedAnalysisEntry({
      profile: buildRevisionedSnapshotState(
        DEFAULT_PROFILE,
        snapshot.profile,
        'profileRevision',
        4
      ),
      income: buildRevisionedSnapshotState(
        DEFAULT_INCOME,
        snapshot.income,
        'incomeRevision',
        7
      ),
      property: buildRevisionedSnapshotState(
        DEFAULT_PROPERTY,
        snapshot.property,
        'propertyRevision',
        11
      ),
      scenarioOverrides: {
        retirementAge: 55,
        annualExpenses: 50_000,
      },
    })

    expect(entry.cacheKey).toBe(buildNormalizedAnalysisCacheKey({
      householdRevision: buildLegacyHouseholdRevision({
        profileRevision: 4,
        incomeRevision: 7,
        propertyRevision: 11,
      }),
      scenarioOverrideHash: stableScenarioOverrideHash({
        annualExpenses: 50_000,
        retirementAge: 55,
      }),
    }))
    expect(entry.selectors.monteCarlo?.annualSavingsByYear.length).toBeGreaterThan(0)

    const reusedEntry = getOrCreateLegacyNormalizedAnalysisEntry({
      profile: buildRevisionedSnapshotState(
        DEFAULT_PROFILE,
        snapshot.profile,
        'profileRevision',
        4
      ),
      income: buildRevisionedSnapshotState(
        DEFAULT_INCOME,
        snapshot.income,
        'incomeRevision',
        7
      ),
      property: buildRevisionedSnapshotState(
        DEFAULT_PROPERTY,
        snapshot.property,
        'propertyRevision',
        11
      ),
      scenarioOverrides: {
        annualExpenses: 50_000,
        retirementAge: 55,
      },
    })

    expect(reusedEntry.cacheKey).toBe(entry.cacheKey)
    expect(Object.keys(useNormalizedAnalysisStore.getState().entries)).toHaveLength(1)
  })

  it('derives monte carlo analysis inputs from normalized selector fragments', () => {
    const snapshot = LEGACY_PARITY_FIXTURES.propertyAndCpf
    const inputs = toMonteCarloAnalysisInputs({
      profile: buildRevisionedSnapshotState(
        DEFAULT_PROFILE,
        snapshot.profile,
        'profileRevision',
        1
      ),
      income: buildRevisionedSnapshotState(
        DEFAULT_INCOME,
        snapshot.income,
        'incomeRevision',
        1
      ),
      property: buildRevisionedSnapshotState(
        DEFAULT_PROPERTY,
        snapshot.property,
        'propertyRevision',
        1
      ),
    })

    expect(inputs.currentAge).toBe(snapshot.profile.currentAge)
    expect(inputs.retirementAge).toBe(snapshot.profile.retirementAge)
    expect(inputs.lifeExpectancy).toBe(snapshot.profile.lifeExpectancy)
    expect(inputs.annualSavings).toHaveLength(
      snapshot.profile.retirementAge - snapshot.profile.currentAge + 1
    )
    expect(inputs.postRetirementIncome.length).toBeGreaterThan(0)
    expect(inputs.annualExpensesAtRetirement).toBeGreaterThan(0)
    expect(inputs.portfolioAdjustments.some((adjustment) => adjustment.amount !== 0)).toBe(true)
  })
})
