import { beforeEach, describe, expect, it } from 'vitest'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import type {
  AssetItem,
  Dependent,
  ExpenseItem,
  GoalItem,
  IncomeSource,
  PlanningAdult,
  PropertyPlan,
} from '@/lib/household/types'
import {
  HOUSEHOLD_PLAN_STORAGE_KEY,
  useHouseholdPlanStore,
} from '../useHouseholdPlanStore'

function resetStore() {
  useHouseholdPlanStore.persist.clearStorage()
  localStorage.removeItem(HOUSEHOLD_PLAN_STORAGE_KEY)
  useHouseholdPlanStore.getState().initializeManualPlan()
}

function makePartnerAdult(self: PlanningAdult): PlanningAdult {
  return {
    ...structuredClone(self),
    id: 'adult-partner',
    owner: 'partner',
    displayName: 'Pat',
    currentAge: 33,
    retirementAge: 60,
    lifeExpectancy: 92,
    annualIncome: 84_000,
    annualExpenses: 0,
    liquidNetWorth: 55_000,
    lifeEvents: [],
    taxProfile: {
      ...structuredClone(self.taxProfile),
      reliefBasisAge: 33,
    },
  }
}

function makeDependent(): Dependent {
  return {
    id: 'dependent-child',
    owner: 'shared',
    label: 'Child',
    relationship: 'child',
    currentAge: 5,
    timing: {
      kind: 'age-range',
      owner: 'self',
      startAge: 30,
      endAge: 47,
    },
    annualCost: 12_000,
  }
}

function makeIncome(): IncomeSource {
  return {
    id: 'income-partner-rental',
    owner: 'partner',
    label: 'Partner rental income',
    kind: 'income-stream',
    timing: {
      kind: 'age-range',
      owner: 'partner',
      startAge: 33,
      endAge: 60,
    },
    annualAmount: 18_000,
    growthRate: 0.01,
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: false,
    isActive: true,
    streamType: 'rental',
  }
}

function makeExpense(): ExpenseItem {
  return {
    id: 'expense-shared-travel',
    owner: 'shared',
    label: 'Shared travel budget',
    kind: 'expense-adjustment',
    timing: {
      kind: 'age-range',
      owner: 'self',
      startAge: 35,
      endAge: 45,
    },
    amount: 6_000,
    periodicity: 'annual',
  }
}

function makeAsset(): AssetItem {
  return {
    id: 'asset-espp-partner',
    owner: 'partner',
    label: 'Partner ESPP',
    kind: 'locked-asset',
    amount: 22_000,
    unlockAge: 38,
    growthRate: 0.04,
  }
}

function makeGoal(): GoalItem {
  return {
    id: 'goal-family-trip',
    owner: 'shared',
    label: 'Family trip',
    kind: 'financial-goal',
    timing: {
      kind: 'single-age',
      owner: 'self',
      age: 42,
    },
    amount: 9_500,
    durationYears: 1,
    priority: 'important',
    inflationAdjusted: true,
    category: 'travel',
  }
}

function makeProperty(): PropertyPlan {
  return {
    id: 'property-investment',
    owner: 'partner',
    label: 'Investment property',
    propertyType: 'condo',
    purchasePrice: 900_000,
    leaseYears: 99,
    appreciationRate: 0.02,
    rentalYield: 0.03,
    mortgageRate: 0.035,
    mortgageTerm: 25,
    ltv: 0.75,
    residencyForAbsd: 'citizen',
    propertyCount: 1,
    ownsProperty: true,
    existingPropertyValue: 950_000,
    existingMortgageBalance: 400_000,
    existingMonthlyPayment: 2_400,
    existingMortgageRate: 0.035,
    existingMortgageRemainingYears: 22,
    mortgageCpfMonthly: 0,
    ownershipPercent: 1,
    existingAppreciationRate: 0.02,
    existingLeaseYears: 94,
    existingApplyBalaDecay: false,
    downsizing: {
      scenario: 'none',
      sellAge: 65,
      expectedSalePrice: 1_200_000,
      newPropertyCost: 750_000,
      newMortgageRate: 0.035,
      newMortgageTerm: 20,
      newLtv: 0.75,
      monthlyRent: 2_500,
      rentGrowthRate: 0.03,
    },
    hdbFlatType: '4-room',
    hdbMonetizationStrategy: 'none',
    hdbLbsRetainedLease: 30,
    hdbSublettingRooms: 0,
    hdbSublettingRate: 0,
    hdbCpfUsedForHousing: 0,
    purchaseYearsFromNow: 0,
  }
}

beforeEach(() => {
  resetStore()
})

describe('useHouseholdPlanStore', () => {
  it('holds a complete household plan in one persisted store object and supports CRUD across collections', () => {
    const initialRevision = useHouseholdPlanStore.getState().householdPlanRevision
    const self = useHouseholdPlanStore.getState().plan.adults[0]

    useHouseholdPlanStore.getState().setPlanType('couple')
    useHouseholdPlanStore.getState().addAdult(makePartnerAdult(self))
    useHouseholdPlanStore.getState().addDependent(makeDependent())
    useHouseholdPlanStore.getState().addIncome(makeIncome())
    useHouseholdPlanStore.getState().addExpense(makeExpense())
    useHouseholdPlanStore.getState().addAsset(makeAsset())
    useHouseholdPlanStore.getState().addGoal(makeGoal())
    useHouseholdPlanStore.getState().addProperty(makeProperty())
    useHouseholdPlanStore.getState().updateAssumptions({
      returns: { inflation: 0.03 },
      cashReserve: { months: 9 },
    })

    const state = useHouseholdPlanStore.getState()

    expect(useHouseholdPlanStore.persist.getOptions().name).toBe(HOUSEHOLD_PLAN_STORAGE_KEY)
    // planType auto-derived: 2 adults + 1 dependent = household
    expect(state.plan.planType).toBe('household')
    expect(state.plan.adults).toHaveLength(2)
    expect(state.plan.dependents).toHaveLength(1)
    expect(state.plan.income.some((entry) => entry.id === 'income-partner-rental')).toBe(true)
    expect(state.plan.expenses.some((entry) => entry.id === 'expense-shared-travel')).toBe(true)
    expect(state.plan.assets.some((entry) => entry.id === 'asset-espp-partner')).toBe(true)
    expect(state.plan.goals.some((entry) => entry.id === 'goal-family-trip')).toBe(true)
    expect(state.plan.properties.some((entry) => entry.id === 'property-investment')).toBe(true)
    expect(state.plan.assumptions.returns.inflation).toBe(0.03)
    expect(state.plan.assumptions.cashReserve.months).toBe(9)
    expect(state.householdPlanRevision).toBeGreaterThan(initialRevision)
    expect(state.hasValidationErrors).toBe(false)
  })

  it('scopes validation errors to household entities instead of flat legacy fields', () => {
    const self = useHouseholdPlanStore.getState().plan.adults[0]

    useHouseholdPlanStore.getState().updateAdult(self.id, {
      retirementAge: self.currentAge,
    })
    useHouseholdPlanStore.getState().addIncome({
      ...makeIncome(),
      id: 'income-orphan-partner',
      owner: 'partner',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 60,
      },
    })

    const state = useHouseholdPlanStore.getState()

    expect(state.hasValidationErrors).toBe(true)
    expect(state.validationErrors['adult:adult-self']?.retirementAge).toContain('Retirement age')
    expect(state.validationErrors['income:income-orphan-partner']?.owner).toContain('Owner')
    expect(state.validationErrors.retirementAge).toBeUndefined()
  })

  it('hydrates a legacy individual snapshot into a valid one-adult household store state', () => {
    useHouseholdPlanStore.getState().initializeFromLegacy(LEGACY_PARITY_FIXTURES.salaryOnly)

    const state = useHouseholdPlanStore.getState()

    expect(state.provenance.source).toBe('legacy-individual')
    expect(state.plan.planType).toBe('individual')
    expect(state.plan.adults).toHaveLength(1)
    expect(state.plan.adults[0]?.displayName).toBe('Primary adult')
    expect(state.plan.income[0]?.annualAmount).toBe(98_000)
    expect(state.plan.properties[0]?.id).toBe('property-primary')
    expect(state.validationErrors).toEqual({})
    expect(state.hasValidationErrors).toBe(false)
  })

  it('reanchors shared timeline entries when removing an adult owner', () => {
    const self = useHouseholdPlanStore.getState().plan.adults[0]
    const partner = makePartnerAdult(self)

    useHouseholdPlanStore.getState().setPlanType('couple')
    useHouseholdPlanStore.getState().addAdult(partner)
    useHouseholdPlanStore.getState().addDependent({
      ...makeDependent(),
      id: 'dependent-shared-partner-timing',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 45,
      },
    })
    useHouseholdPlanStore.getState().addIncome({
      ...makeIncome(),
      id: 'income-shared-partner-timing',
      owner: 'shared',
    })
    useHouseholdPlanStore.getState().addExpense({
      ...makeExpense(),
      id: 'expense-shared-partner-timing',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 35,
        endAge: 45,
      },
    })
    useHouseholdPlanStore.getState().addGoal({
      ...makeGoal(),
      id: 'goal-shared-partner-timing',
      timing: {
        kind: 'single-age',
        owner: 'partner',
        age: 42,
      },
    })

    useHouseholdPlanStore.getState().removeAdult(partner.id)

    const state = useHouseholdPlanStore.getState()

    expect(state.plan.adults).toHaveLength(1)
    expect(state.plan.dependents[0]?.timing?.owner).toBe('self')
    expect(state.plan.income[0]?.timing.owner).toBe('self')
    expect(state.plan.expenses[0]?.timing.owner).toBe('self')
    expect(state.plan.goals[0]?.timing.owner).toBe('self')
  })

  it('preserves nested CPF fields when partial adult updates are applied', () => {
    const self = useHouseholdPlanStore.getState().plan.adults[0]
    const originalCpf = structuredClone(self.cpf)

    useHouseholdPlanStore.getState().updateAdult(self.id, {
      cpf: {
        balances: {
          oa: originalCpf.balances.oa + 5_000,
        },
      },
    } as Partial<PlanningAdult>)

    const updatedAdult = useHouseholdPlanStore.getState().plan.adults[0]

    expect(updatedAdult?.cpf.balances.oa).toBe(originalCpf.balances.oa + 5_000)
    expect(updatedAdult?.cpf.balances.sa).toBe(originalCpf.balances.sa)
    expect(updatedAdult?.cpf.lifePlan).toBe(originalCpf.lifePlan)
    expect(updatedAdult?.cpf.retirementSum).toBe(originalCpf.retirementSum)
  })

  it('allows negative legacy expense adjustments after household hydration', () => {
    useHouseholdPlanStore.getState().initializeFromLegacy(LEGACY_PARITY_FIXTURES.goalsAndLifeEvents)

    const state = useHouseholdPlanStore.getState()
    const adjustment = state.plan.expenses.find((expense) => expense.id === 'expense-adjustment-downsized-commuting')

    expect(adjustment?.amount).toBe(-1_800)
    expect(state.validationErrors['expense:expense-adjustment-downsized-commuting']?.amount).toBeUndefined()
    expect(state.hasValidationErrors).toBe(false)
  })

  it('allows already-retired adults when a retirement phase is present', () => {
    const self = useHouseholdPlanStore.getState().plan.adults[0]

    useHouseholdPlanStore.getState().updateAdult(self.id, {
      currentAge: 67,
      retirementAge: 65,
      cpf: {
        ...self.cpf,
        retirementPhase: '65-plus',
      },
    })

    const state = useHouseholdPlanStore.getState()

    expect(state.validationErrors['adult:adult-self']?.retirementAge).toBeUndefined()
    expect(state.hasValidationErrors).toBe(false)
  })

  it('keeps the mandatory self adult when removeAdult is called with self', () => {
    const initialRevision = useHouseholdPlanStore.getState().householdPlanRevision
    const selfId = useHouseholdPlanStore.getState().plan.adults[0]!.id

    useHouseholdPlanStore.getState().removeAdult(selfId)

    const state = useHouseholdPlanStore.getState()

    expect(state.plan.adults).toHaveLength(1)
    expect(state.plan.adults[0]?.owner).toBe('self')
    expect(state.householdPlanRevision).toBe(initialRevision)
  })
})
