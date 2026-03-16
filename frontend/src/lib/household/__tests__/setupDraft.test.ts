import { describe, it, expect, beforeEach } from 'vitest'
import {
  splitCpfByAge,
  applySetupDraft,
  hydrateSetupFromPlan,
  type SetupDraft,
} from '../setupDraft'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshIndividualDraft(overrides: Partial<SetupDraft> = {}): SetupDraft {
  return {
    currentAge: 30,
    retirementAge: 55,
    annualIncome: 72_000,
    incomeType: 'gross',
    annualExpenses: 36_000,
    liquidNetWorth: 100_000,
    residency: 'citizen',
    cpfKnown: false,
    ownsProperty: 'no',
    healthcareEnabled: false,
    isRedo: false,
    ...overrides,
  }
}

function freshCoupleDraft(overrides: Partial<SetupDraft> = {}): SetupDraft {
  return freshIndividualDraft({
    partner: {
      name: 'Jane',
      currentAge: 28,
      retirementAge: 60,
      annualIncome: 60_000,
      incomeType: 'gross',
      annualExpenses: 24_000,
      liquidNetWorth: 50_000,
      residency: 'citizen',
      cpfKnown: false,
    },
    jointMonthlyExpenses: 3_000,
    ...overrides,
  })
}

function getPlan() {
  return useHouseholdPlanStore.getState().plan
}

function getSelf() {
  return getPlan().adults.find((a) => a.owner === 'self')!
}

function getPartner() {
  return getPlan().adults.find((a) => a.owner === 'partner')
}

// ---------------------------------------------------------------------------
// splitCpfByAge
// ---------------------------------------------------------------------------

describe('splitCpfByAge', () => {
  it('splits correctly for age 30 (under-35 bracket: 60/20/20)', () => {
    const result = splitCpfByAge(100_000, 30)
    expect(result).toEqual({ oa: 60_000, sa: 20_000, ma: 20_000, ra: 0 })
  })

  it('splits correctly for age 40 (35-45 bracket: 55/25/20)', () => {
    const result = splitCpfByAge(100_000, 40)
    expect(result).toEqual({ oa: 55_000, sa: 25_000, ma: 20_000, ra: 0 })
  })

  it('splits correctly for age 48 (45-50 bracket: 50/25/25)', () => {
    const result = splitCpfByAge(100_000, 48)
    expect(result).toEqual({ oa: 50_000, sa: 25_000, ma: 25_000, ra: 0 })
  })

  it('splits correctly for age 52 (50-55 bracket: 40/30/30)', () => {
    const result = splitCpfByAge(100_000, 52)
    expect(result).toEqual({ oa: 40_000, sa: 30_000, ma: 30_000, ra: 0 })
  })

  it('splits correctly for age 60 (55+ bracket: 10/10/0 + 80% RA)', () => {
    const result = splitCpfByAge(100_000, 60)
    expect(result).toEqual({ oa: 10_000, sa: 10_000, ma: 0, ra: 80_000 })
  })

  it('returns zeroes for zero total', () => {
    const result = splitCpfByAge(0, 30)
    expect(result).toEqual({ oa: 0, sa: 0, ma: 0, ra: 0 })
  })

  it('sum of components equals input for non-round total (age 30, 99999)', () => {
    const result = splitCpfByAge(99_999, 30)
    // Each component is Math.round(total * fraction); sum may differ by at most 2 due to rounding
    const sum = result.oa + result.sa + result.ma + result.ra
    // Verify sum is within 2 of the input (acceptable rounding tolerance)
    expect(Math.abs(sum - 99_999)).toBeLessThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// applySetupDraft — fresh individual
// ---------------------------------------------------------------------------

describe('applySetupDraft — fresh individual', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('creates valid plan with correct age, income, expenses, net worth, residency', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')

    const self = getSelf()
    expect(self.currentAge).toBe(30)
    expect(self.retirementAge).toBe(55)
    expect(self.annualIncome).toBe(72_000)
    expect(self.annualExpenses).toBe(36_000)
    expect(self.liquidNetWorth).toBe(100_000)
    expect(self.residencyStatus).toBe('citizen')
  })

  it('sets income entry from annual income', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')

    const salary = getPlan().income.find(
      (e) => e.kind === 'salary-model' && e.owner === 'self',
    )
    expect(salary).toBeDefined()
    expect(salary!.annualAmount).toBe(72_000)
  })

  it('sets income timing to match age range', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')

    const salary = getPlan().income.find(
      (e) => e.kind === 'salary-model' && e.owner === 'self',
    )
    expect(salary!.timing).toEqual({
      kind: 'age-range',
      owner: 'self',
      startAge: 30,
      endAge: 55,
    })
  })

  it('sets expense entry from annual expenses', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')

    const expense = getPlan().expenses.find(
      (e) => e.kind === 'base-living' && e.owner === 'self',
    )
    expect(expense).toBeDefined()
    expect(expense!.amount).toBe(36_000)
  })

  it('sets asset entry from liquid net worth', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')

    const asset = getPlan().assets.find(
      (e) => e.kind === 'liquid-net-worth' && e.owner === 'self',
    )
    expect(asset).toBeDefined()
    expect(asset!.amount).toBe(100_000)
  })

  it('sets CPF balances when cpfKnown is true', () => {
    applySetupDraft(
      freshIndividualDraft({ cpfKnown: true, cpfTotal: 100_000 }),
      'individual',
    )

    const self = getSelf()
    expect(self.cpf.balances).toEqual({ oa: 60_000, sa: 20_000, ma: 20_000, ra: 0 })
  })

  it('does not set CPF balances when cpfKnown is false', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')

    const self = getSelf()
    // CPF balances should remain at defaults (zeroes from the default plan)
    const total = self.cpf.balances.oa + self.cpf.balances.sa + self.cpf.balances.ma + self.cpf.balances.ra
    expect(total).toBe(0)
  })

  it('sets property data when ownsProperty is "owns"', () => {
    applySetupDraft(
      freshIndividualDraft({
        ownsProperty: 'owns',
        propertyType: 'hdb',
        propertyValue: 500_000,
        mortgageBalance: 200_000,
      }),
      'individual',
    )

    const property = getPlan().properties.find((p) => p.owner === 'self')
    expect(property).toBeDefined()
    expect(property!.ownsProperty).toBe(true)
    expect(property!.existingPropertyValue).toBe(500_000)
    expect(property!.existingMortgageBalance).toBe(200_000)
    expect(property!.propertyType).toBe('hdb')
  })

  it('sets property data when ownsProperty is "planning"', () => {
    applySetupDraft(
      freshIndividualDraft({
        ownsProperty: 'planning',
        propertyType: 'condo',
        purchasePrice: 1_200_000,
        purchaseYearsFromNow: 2,
      }),
      'individual',
    )

    const property = getPlan().properties.find((p) => p.owner === 'self')
    expect(property).toBeDefined()
    expect(property!.ownsProperty).toBe(false)
    expect(property!.purchasePrice).toBe(1_200_000)
    expect(property!.purchaseYearsFromNow).toBe(2)
  })

  it('does not add property when ownsProperty is "no"', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')

    const properties = getPlan().properties.filter((p) => p.owner === 'self')
    expect(properties.length).toBe(0)
  })

  it('sets healthcare enabled and ispTier', () => {
    applySetupDraft(
      freshIndividualDraft({ healthcareEnabled: true, ispTier: 'enhanced' }),
      'individual',
    )

    const self = getSelf()
    expect(self.healthcare.enabled).toBe(true)
    expect(self.healthcare.ispTier).toBe('enhanced')
  })

  it('converts take-home income to gross using heuristic', () => {
    applySetupDraft(
      freshIndividualDraft({ annualIncome: 60_000, incomeType: 'take-home' }),
      'individual',
    )

    const self = getSelf()
    // gross ~ 60000 / 0.85 = 70588
    expect(self.annualIncome).toBe(Math.round(60_000 / 0.85))
  })

  it('sets lifeStage and retirementPhase', () => {
    applySetupDraft(
      freshIndividualDraft({ lifeStage: 'post-fire', retirementPhase: '65-plus' }),
      'individual',
    )

    const self = getSelf()
    expect(self.lifeStage).toBe('post-fire')
    expect(self.cpf.retirementPhase).toBe('65-plus')
  })

  it('adds dependents', () => {
    applySetupDraft(
      freshIndividualDraft({
        dependents: [
          { name: 'Kid', age: 5, relationship: 'child' },
        ],
      }),
      'individual',
    )

    const deps = getPlan().dependents
    expect(deps.length).toBe(1)
    expect(deps[0].label).toBe('Kid')
    expect(deps[0].currentAge).toBe(5)
    expect(deps[0].relationship).toBe('child')
  })
})

// ---------------------------------------------------------------------------
// applySetupDraft — couple plan
// ---------------------------------------------------------------------------

describe('applySetupDraft — couple plan', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('creates partner adult with correct data', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')

    const partner = getPartner()
    expect(partner).toBeDefined()
    expect(partner!.displayName).toBe('Jane')
    expect(partner!.currentAge).toBe(28)
    expect(partner!.retirementAge).toBe(60)
    expect(partner!.annualIncome).toBe(60_000)
    expect(partner!.annualExpenses).toBe(24_000)
    expect(partner!.liquidNetWorth).toBe(50_000)
    expect(partner!.residencyStatus).toBe('citizen')
  })

  it('creates partner salary-model income entry', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')

    const partnerSalary = getPlan().income.find(
      (e) => e.kind === 'salary-model' && e.owner === 'partner',
    )
    expect(partnerSalary).toBeDefined()
    expect(partnerSalary!.annualAmount).toBe(60_000)
  })

  it('creates partner base-living expense entry', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')

    const partnerExpense = getPlan().expenses.find(
      (e) => e.kind === 'base-living' && e.owner === 'partner',
    )
    expect(partnerExpense).toBeDefined()
    expect(partnerExpense!.amount).toBe(24_000)
  })

  it('creates partner liquid-net-worth asset entry', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')

    const partnerAsset = getPlan().assets.find(
      (e) => e.kind === 'liquid-net-worth' && e.owner === 'partner',
    )
    expect(partnerAsset).toBeDefined()
    expect(partnerAsset!.amount).toBe(50_000)
  })

  it('creates shared joint expense entry', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')

    const joint = getPlan().expenses.find(
      (e) => e.owner === 'shared' && e.kind === 'base-living',
    )
    expect(joint).toBeDefined()
    expect(joint!.amount).toBe(36_000) // 3000 * 12
  })

  it('sets partner CPF when cpfKnown is true', () => {
    const draft = freshCoupleDraft()
    draft.partner!.cpfKnown = true
    draft.partner!.cpfTotal = 80_000
    applySetupDraft(draft, 'couple')

    const partner = getPartner()!
    // Age 28 → under-35 bracket: 60/20/20
    expect(partner.cpf.balances).toEqual({ oa: 48_000, sa: 16_000, ma: 16_000, ra: 0 })
  })

  it('updates partner salary timing when partner age changes on redo', () => {
    // Fresh couple setup
    applySetupDraft(freshCoupleDraft(), 'couple')

    // Redo with different partner age and retirement age
    applySetupDraft(
      freshCoupleDraft({
        partner: {
          name: 'Jane',
          currentAge: 32,
          retirementAge: 62,
          annualIncome: 60_000,
          incomeType: 'gross',
          annualExpenses: 24_000,
          liquidNetWorth: 50_000,
          residency: 'citizen',
          cpfKnown: false,
        },
        isRedo: true,
      }),
      'couple',
    )

    const partnerSalary = getPlan().income.find(
      (e) => e.kind === 'salary-model' && e.owner === 'partner',
    )
    expect(partnerSalary).toBeDefined()
    expect(partnerSalary!.timing.kind).toBe('age-range')
    if (partnerSalary!.timing.kind === 'age-range') {
      expect(partnerSalary!.timing.startAge).toBe(32)
      expect(partnerSalary!.timing.endAge).toBe(62)
    }
  })
})

// ---------------------------------------------------------------------------
// applySetupDraft — redo path
// ---------------------------------------------------------------------------

describe('applySetupDraft — redo path', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
    // First, apply a fresh draft to set up the plan
    applySetupDraft(freshIndividualDraft(), 'individual')
  })

  it('preserves non-setup fields (goals, allocation) on redo', () => {
    // Add a goal to the existing plan
    useHouseholdPlanStore.getState().addGoal({
      id: 'goal-test-1',
      owner: 'self',
      label: 'Buy a car',
      kind: 'financial-goal',
      timing: { kind: 'single-age', owner: 'self', age: 35 },
      amount: 50_000,
      durationYears: 1,
      priority: 'nice-to-have',
      inflationAdjusted: true,
      category: 'vehicle',
    })

    // Modify assumptions
    useHouseholdPlanStore.getState().updateAssumptions({
      fire: { swr: 0.035 },
    })

    const goalsBefore = getPlan().goals.length
    const swrBefore = getPlan().assumptions.fire.swr

    // Now do a redo
    applySetupDraft(
      freshIndividualDraft({ currentAge: 32, annualIncome: 80_000, isRedo: true }),
      'individual',
    )

    // Goals should still be there
    expect(getPlan().goals.length).toBe(goalsBefore)
    expect(getPlan().goals[0].label).toBe('Buy a car')
    // Assumptions should be preserved
    expect(getPlan().assumptions.fire.swr).toBe(swrBefore)
    // But setup fields should be updated
    expect(getSelf().currentAge).toBe(32)
    expect(getSelf().annualIncome).toBe(80_000)
  })

  it('updates salary amount on redo without reinitializing plan', () => {
    const revisionBefore = useHouseholdPlanStore.getState().householdPlanRevision

    applySetupDraft(
      freshIndividualDraft({ annualIncome: 90_000, isRedo: true }),
      'individual',
    )

    const salary = getPlan().income.find(
      (e) => e.kind === 'salary-model' && e.owner === 'self',
    )
    expect(salary!.annualAmount).toBe(90_000)

    // Should have incremented revision (from updates) but not from a full re-init
    expect(useHouseholdPlanStore.getState().householdPlanRevision).toBeGreaterThan(revisionBefore)
  })

  it('updates expense amount on redo', () => {
    applySetupDraft(
      freshIndividualDraft({ annualExpenses: 48_000, isRedo: true }),
      'individual',
    )

    const expense = getPlan().expenses.find(
      (e) => e.kind === 'base-living' && e.owner === 'self',
    )
    expect(expense!.amount).toBe(48_000)
  })

  it('updates dependents on redo with different dependents', () => {
    // First apply with one dependent
    applySetupDraft(
      freshIndividualDraft({
        dependents: [{ name: 'Alice', age: 5, relationship: 'child' }],
      }),
      'individual',
    )
    expect(getPlan().dependents.length).toBe(1)
    expect(getPlan().dependents[0].label).toBe('Alice')

    // Redo with different dependents
    applySetupDraft(
      freshIndividualDraft({
        dependents: [
          { name: 'Bob', age: 8, relationship: 'child' },
          { name: 'Carol', age: 3, relationship: 'child' },
        ],
        isRedo: true,
      }),
      'individual',
    )

    const deps = getPlan().dependents
    expect(deps.length).toBe(2)
    expect(deps.map((d) => d.label)).toContain('Bob')
    expect(deps.map((d) => d.label)).toContain('Carol')
    expect(deps.map((d) => d.label)).not.toContain('Alice')
  })
})

// ---------------------------------------------------------------------------
// hydrateSetupFromPlan
// ---------------------------------------------------------------------------

describe('hydrateSetupFromPlan', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('returns isRedo: true', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')
    const hydrated = hydrateSetupFromPlan(getPlan())
    expect(hydrated.isRedo).toBe(true)
  })

  it('extracts correct self fields', () => {
    applySetupDraft(
      freshIndividualDraft({ residency: 'pr', healthcareEnabled: true }),
      'individual',
    )
    const hydrated = hydrateSetupFromPlan(getPlan())
    expect(hydrated.currentAge).toBe(30)
    expect(hydrated.retirementAge).toBe(55)
    expect(hydrated.annualIncome).toBe(72_000)
    expect(hydrated.annualExpenses).toBe(36_000)
    expect(hydrated.liquidNetWorth).toBe(100_000)
    expect(hydrated.residency).toBe('pr')
    expect(hydrated.healthcareEnabled).toBe(true)
  })

  it('extracts CPF total when balances are non-zero', () => {
    applySetupDraft(
      freshIndividualDraft({ cpfKnown: true, cpfTotal: 100_000 }),
      'individual',
    )
    const hydrated = hydrateSetupFromPlan(getPlan())
    expect(hydrated.cpfKnown).toBe(true)
    expect(hydrated.cpfTotal).toBe(100_000)
  })

  it('extracts property when present', () => {
    applySetupDraft(
      freshIndividualDraft({
        ownsProperty: 'owns',
        propertyType: 'hdb',
        propertyValue: 500_000,
        mortgageBalance: 200_000,
      }),
      'individual',
    )
    const hydrated = hydrateSetupFromPlan(getPlan())
    expect(hydrated.ownsProperty).toBe('owns')
    expect(hydrated.propertyType).toBe('hdb')
    expect(hydrated.propertyValue).toBe(500_000)
    expect(hydrated.mortgageBalance).toBe(200_000)
  })

  it('extracts partner data from couple plan', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')
    const hydrated = hydrateSetupFromPlan(getPlan())
    expect(hydrated.partner).toBeDefined()
    expect(hydrated.partner!.name).toBe('Jane')
    expect(hydrated.partner!.currentAge).toBe(28)
    expect(hydrated.partner!.annualIncome).toBe(60_000)
  })

  it('extracts joint monthly expenses', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')
    const hydrated = hydrateSetupFromPlan(getPlan())
    expect(hydrated.jointMonthlyExpenses).toBe(3_000)
  })

  it('extracts dependents from plan', () => {
    applySetupDraft(
      freshCoupleDraft({
        dependents: [
          { name: 'Child A', age: 5, relationship: 'child' },
          { name: 'Parent B', age: 70, relationship: 'parent' },
        ],
      }),
      'couple',
    )
    const hydrated = hydrateSetupFromPlan(getPlan())
    expect(hydrated.dependents).toHaveLength(2)
    expect(hydrated.dependents![0]).toEqual({ name: 'Child A', age: 5, relationship: 'child' })
    expect(hydrated.dependents![1]).toEqual({ name: 'Parent B', age: 70, relationship: 'parent' })
  })

  it('redo with existing dependents preserves them if user does not change them', () => {
    // Initial setup with dependents
    applySetupDraft(
      freshCoupleDraft({
        dependents: [
          { name: 'Child A', age: 5, relationship: 'child' },
        ],
      }),
      'couple',
    )
    expect(getPlan().dependents).toHaveLength(1)

    // Hydrate and re-apply (simulates redo without changing dependents)
    const hydrated = hydrateSetupFromPlan(getPlan())
    expect(hydrated.dependents).toHaveLength(1)
    applySetupDraft(hydrated, 'couple')

    // Dependents should still be there
    expect(getPlan().dependents).toHaveLength(1)
    expect(getPlan().dependents[0].label).toBe('Child A')
  })
})

// ---------------------------------------------------------------------------
// Redo clearing logic (C5 fixes)
// ---------------------------------------------------------------------------

describe('applySetupDraft — redo clearing', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('zeros CPF balances on redo when cpfKnown=false and not foreigner', () => {
    // First apply with known CPF
    applySetupDraft(
      freshIndividualDraft({ cpfKnown: true, cpfTotal: 100_000 }),
      'individual',
    )
    const selfBefore = getSelf()
    expect(selfBefore.cpf.balances.oa).toBeGreaterThan(0)

    // Redo with cpfKnown=false
    applySetupDraft(
      freshIndividualDraft({ cpfKnown: false, residency: 'citizen', isRedo: true }),
      'individual',
    )

    const selfAfter = getSelf()
    expect(selfAfter.cpf.balances).toEqual({ oa: 0, sa: 0, ma: 0, ra: 0 })
  })

  it('does NOT zero CPF balances on redo for foreigners', () => {
    // First apply with known CPF as citizen
    applySetupDraft(
      freshIndividualDraft({ cpfKnown: true, cpfTotal: 100_000 }),
      'individual',
    )

    // Redo as foreigner with cpfKnown=false — should not touch CPF
    applySetupDraft(
      freshIndividualDraft({ cpfKnown: false, residency: 'foreigner', isRedo: true }),
      'individual',
    )

    const selfAfter = getSelf()
    // Foreigner path skips CPF zeroing, so balances from initial apply remain
    const total = selfAfter.cpf.balances.oa + selfAfter.cpf.balances.sa + selfAfter.cpf.balances.ma + selfAfter.cpf.balances.ra
    expect(total).toBe(100_000)
  })

  it('removes shared expense on redo when jointMonthlyExpenses is 0', () => {
    // First apply as couple with joint expenses
    applySetupDraft(freshCoupleDraft({ jointMonthlyExpenses: 3_000 }), 'couple')
    const jointBefore = getPlan().expenses.find(
      (e) => e.owner === 'shared' && e.kind === 'base-living',
    )
    expect(jointBefore).toBeDefined()

    // Redo with zero joint expenses
    applySetupDraft(
      freshCoupleDraft({ jointMonthlyExpenses: 0, isRedo: true }),
      'couple',
    )

    const jointAfter = getPlan().expenses.find(
      (e) => e.owner === 'shared' && e.kind === 'base-living',
    )
    expect(jointAfter).toBeUndefined()
  })

  it('removes all dependents on redo when dependents array is empty', () => {
    // First apply with dependents
    applySetupDraft(
      freshIndividualDraft({
        dependents: [
          { name: 'Alice', age: 5, relationship: 'child' },
          { name: 'Bob', age: 8, relationship: 'child' },
        ],
      }),
      'individual',
    )
    expect(getPlan().dependents.length).toBe(2)

    // Redo with empty dependents
    applySetupDraft(
      freshIndividualDraft({ dependents: [], isRedo: true }),
      'individual',
    )

    expect(getPlan().dependents.length).toBe(0)
  })

  it('removes all dependents on redo when dependents is undefined', () => {
    // First apply with dependents
    applySetupDraft(
      freshIndividualDraft({
        dependents: [{ name: 'Charlie', age: 3, relationship: 'child' }],
      }),
      'individual',
    )
    expect(getPlan().dependents.length).toBe(1)

    // Redo without dependents field
    applySetupDraft(
      freshIndividualDraft({ isRedo: true }),
      'individual',
    )

    expect(getPlan().dependents.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildPropertyEntry downsizing shape (C3 fix)
// ---------------------------------------------------------------------------

describe('buildPropertyEntry — downsizing config', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('produces a valid DownsizingConfig shape with correct field names', () => {
    applySetupDraft(
      freshIndividualDraft({
        ownsProperty: 'owns',
        propertyType: 'condo',
        propertyValue: 1_000_000,
        mortgageBalance: 500_000,
      }),
      'individual',
    )

    const property = getPlan().properties.find((p) => p.owner === 'self')
    expect(property).toBeDefined()
    const ds = property!.downsizing

    // Verify correct DownsizingConfig fields exist
    expect(ds.scenario).toBe('none')
    expect(typeof ds.sellAge).toBe('number')
    expect(typeof ds.expectedSalePrice).toBe('number')
    expect(typeof ds.newPropertyCost).toBe('number')
    expect(typeof ds.newMortgageRate).toBe('number')
    expect(typeof ds.newMortgageTerm).toBe('number')
    expect(typeof ds.newLtv).toBe('number')
    expect(typeof ds.monthlyRent).toBe('number')
    expect(typeof ds.rentGrowthRate).toBe('number')

    // Verify old incorrect fields are NOT present
    expect('enabled' in ds).toBe(false)
    expect('downsizeAge' in ds).toBe(false)
    expect('newPropertyValue' in ds).toBe(false)
    expect('newLeaseYears' in ds).toBe(false)
    expect('transactionCosts' in ds).toBe(false)
    expect('reinvestPercent' in ds).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Round-trip test
// ---------------------------------------------------------------------------

describe('round-trip: apply → hydrate → re-apply', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('produces equivalent core fields after round-trip', () => {
    const original = freshIndividualDraft({
      cpfKnown: true,
      cpfTotal: 100_000,
      healthcareEnabled: true,
      ispTier: 'basic',
      ownsProperty: 'owns',
      propertyType: 'hdb',
      propertyValue: 500_000,
      mortgageBalance: 200_000,
    })

    // Apply original draft
    applySetupDraft(original, 'individual')

    // Hydrate back
    const hydrated = hydrateSetupFromPlan(getPlan())

    // Re-apply with redo (already set by hydrate)
    applySetupDraft(hydrated, 'individual')

    // Verify core fields match
    const self = getSelf()
    expect(self.currentAge).toBe(original.currentAge)
    expect(self.retirementAge).toBe(original.retirementAge)
    expect(self.annualIncome).toBe(original.annualIncome)
    expect(self.annualExpenses).toBe(original.annualExpenses)
    expect(self.liquidNetWorth).toBe(original.liquidNetWorth)
    expect(self.residencyStatus).toBe(original.residency)
    expect(self.healthcare.enabled).toBe(original.healthcareEnabled)
    expect(self.healthcare.ispTier).toBe(original.ispTier)

    // Property should still be correct
    const property = getPlan().properties.find((p) => p.owner === 'self')
    expect(property).toBeDefined()
    expect(property!.ownsProperty).toBe(true)
    expect(property!.existingPropertyValue).toBe(500_000)
  })
})

// ---------------------------------------------------------------------------
// Regression: applySetupDraft must produce plans that pass projection validation
// ---------------------------------------------------------------------------

describe('applySetupDraft — projection validation regression', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('individual fresh draft → hasValidationErrors === false', () => {
    applySetupDraft(freshIndividualDraft(), 'individual')
    const state = useHouseholdPlanStore.getState()
    expect(state.hasValidationErrors).toBe(false)
    expect(Object.keys(state.validationErrors)).toHaveLength(0)
  })

  it('couple fresh draft → hasValidationErrors === false', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')
    const state = useHouseholdPlanStore.getState()
    expect(state.hasValidationErrors).toBe(false)
    expect(Object.keys(state.validationErrors)).toHaveLength(0)
  })

  it('couple draft → partner ciRecoveryYears is a valid default (1-10)', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')
    const partner = getPartner()!
    expect(partner.ciRecoveryYears).toBeGreaterThanOrEqual(1)
    expect(partner.ciRecoveryYears).toBeLessThanOrEqual(10)
  })

  it('couple draft → partner funeralCosts uses canonical default', () => {
    applySetupDraft(freshCoupleDraft(), 'couple')
    const partner = getPartner()!
    // Should use the same default as fromLegacyIndividual (15_000)
    expect(partner.funeralCosts).toBe(15_000)
  })
})
