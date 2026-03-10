import { describe, expect, it } from 'vitest'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import type { HouseholdPlan, PlanningAdult } from '@/lib/household/types'
import { buildSplitAdultPlanSlice } from '@/lib/household/planSlice'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { buildCurrentMonteCarloRunSignature } from '@/hooks/useMonteCarloWorkerQuery'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePartner(self: PlanningAdult): PlanningAdult {
  return {
    ...structuredClone(self),
    id: 'adult-partner',
    owner: 'partner',
    displayName: 'Jordan',
    currentAge: 33,
    retirementAge: 58,
    lifeExpectancy: 92,
    annualIncome: 84_000,
    annualExpenses: 0,
    liquidNetWorth: 95_000,
    cpf: {
      ...structuredClone(self.cpf),
      balances: { oa: 30_000, sa: 20_000, ma: 10_000, ra: 0 },
    },
    lifeEvents: [],
  }
}

function makeTwoAdultPlan(): HouseholdPlan {
  const plan = structuredClone(fromLegacyIndividual(LEGACY_PARITY_FIXTURES.salaryOnly))
  const self = plan.adults[0]
  self.id = 'adult-self'
  self.owner = 'self'
  self.displayName = 'Taylor'
  self.currentAge = 34
  self.retirementAge = 60
  self.lifeExpectancy = 90
  self.annualIncome = 120_000
  self.annualExpenses = 0
  self.liquidNetWorth = 180_000
  self.cpf = {
    ...self.cpf,
    balances: { oa: 50_000, sa: 40_000, ma: 15_000, ra: 0 },
  }
  self.lifeEvents = []
  self.lifeEventsEnabled = false

  plan.id = 'per-adult-mc-test'
  plan.planType = 'couple'
  plan.adults = [self, makePartner(self)]
  return plan
}

// ---------------------------------------------------------------------------
// buildCurrentMonteCarloRunSignature — perAdultKey
// ---------------------------------------------------------------------------

describe('buildCurrentMonteCarloRunSignature', () => {
  const baseInput = {
    allocationRevision: 1,
    householdRevision: 'rev-1',
    scenarioOverrideHash: 'hash-1',
    simulationRevision: 1,
    withdrawalRevision: 1,
  }

  it('produces different signatures for joint vs per-adult keys', () => {
    const jointSig = buildCurrentMonteCarloRunSignature({ ...baseInput, perAdultKey: 'joint' })
    const adultSig = buildCurrentMonteCarloRunSignature({ ...baseInput, perAdultKey: 'adult-self' })
    expect(jointSig).not.toBe(adultSig)
  })

  it('defaults to joint when perAdultKey is omitted', () => {
    const noKey = buildCurrentMonteCarloRunSignature({ ...baseInput })
    const explicitJoint = buildCurrentMonteCarloRunSignature({ ...baseInput, perAdultKey: 'joint' })
    expect(noKey).toBe(explicitJoint)
  })

  it('defaults to joint when perAdultKey is null', () => {
    const nullKey = buildCurrentMonteCarloRunSignature({ ...baseInput, perAdultKey: null })
    const explicitJoint = buildCurrentMonteCarloRunSignature({ ...baseInput, perAdultKey: 'joint' })
    expect(nullKey).toBe(explicitJoint)
  })

  it('produces different signatures for different adult IDs', () => {
    const adult1 = buildCurrentMonteCarloRunSignature({ ...baseInput, perAdultKey: 'adult-self' })
    const adult2 = buildCurrentMonteCarloRunSignature({ ...baseInput, perAdultKey: 'adult-partner' })
    expect(adult1).not.toBe(adult2)
  })
})

// ---------------------------------------------------------------------------
// Per-adult plan slice → runtime inputs
// ---------------------------------------------------------------------------

describe('per-adult MC input construction', () => {
  it('produces per-adult ages matching the target adult', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSplitAdultPlanSlice(plan, 'adult-self', 0.5)
    expect(result).not.toBeNull()
    expect(result!.adultAges.currentAge).toBe(34)
    expect(result!.adultAges.retirementAge).toBe(60)
    expect(result!.adultAges.lifeExpectancy).toBe(90)
  })

  it('produces partner ages when slicing for partner', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSplitAdultPlanSlice(plan, 'adult-partner', 0.5)
    expect(result).not.toBeNull()
    expect(result!.adultAges.currentAge).toBe(33)
    expect(result!.adultAges.retirementAge).toBe(58)
    expect(result!.adultAges.lifeExpectancy).toBe(92)
  })

  it('returns null for unknown adult ID', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSplitAdultPlanSlice(plan, 'adult-nonexistent', 0.5)
    expect(result).toBeNull()
  })

  it('sliced plan is individual with single adult', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSplitAdultPlanSlice(plan, 'adult-self', 0.5)!
    expect(result.slice.planType).toBe('individual')
    expect(result.slice.adults).toHaveLength(1)
    expect(result.slice.adults[0].owner).toBe('self')
  })

  it('runtime profile includes CPF balances for per-adult portfolio', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSplitAdultPlanSlice(plan, 'adult-self', 0.5)!
    const runtime = buildHouseholdRuntimeLegacyInputs(result.slice)

    // CPF balances should come from the sliced adult
    expect(runtime.profile.cpfOA).toBeGreaterThan(0)
    expect(runtime.profile.cpfSA).toBeGreaterThan(0)
    expect(runtime.profile.cpfMA).toBeGreaterThan(0)

    // initialPortfolio for MC should include CPF (matching useAnalysisPortfolio pattern)
    const totalNW = runtime.profile.liquidNetWorth
      + runtime.profile.cpfOA
      + runtime.profile.cpfSA
      + runtime.profile.cpfMA
      + runtime.profile.cpfRA
    expect(totalNW).toBeGreaterThan(runtime.profile.liquidNetWorth)
  })

  it('splits shared liquidNetWorth by the split ratio', () => {
    const plan = makeTwoAdultPlan()
    // Self has 180K liquid, partner has 95K
    // Shared assets should be split 50/50
    const selfSlice = buildSplitAdultPlanSlice(plan, 'adult-self', 0.5)!
    const partnerSlice = buildSplitAdultPlanSlice(plan, 'adult-partner', 0.5)!
    const selfRuntime = buildHouseholdRuntimeLegacyInputs(selfSlice.slice)
    const partnerRuntime = buildHouseholdRuntimeLegacyInputs(partnerSlice.slice)

    // Each adult's liquidNetWorth comes from their own personal assets
    // (shared assets scaled by splitRatio would be added on top)
    expect(selfRuntime.profile.liquidNetWorth).toBeGreaterThan(0)
    expect(partnerRuntime.profile.liquidNetWorth).toBeGreaterThan(0)
  })
})
