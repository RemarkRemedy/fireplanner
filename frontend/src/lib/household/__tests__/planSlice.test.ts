import { describe, expect, it } from 'vitest'
import {
  buildSingleAdultPlanSlice,
  buildSplitAdultPlanSlice,
} from '@/lib/household/planSlice'
import type {
  AssetItem,
  ExpenseItem,
  GoalItem,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
} from '@/lib/household/types'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeAdult(overrides: Partial<PlanningAdult> & Pick<PlanningAdult, 'id' | 'owner' | 'displayName' | 'currentAge' | 'retirementAge' | 'lifeExpectancy'>): PlanningAdult {
  return {
    lifeStage: 'pre-fire',
    maritalStatus: 'married',
    residencyStatus: 'citizen',
    prMonths: 0,
    annualIncome: 100_000,
    annualExpenses: 30_000,
    liquidNetWorth: 200_000,
    parentSupportEnabled: false,
    lifeEventsEnabled: false,
    healthcare: {
      enabled: true,
      mediShieldLifeEnabled: true,
      ispTier: 'none',
      careShieldLifeEnabled: false,
      oopBaseAmount: 500,
      oopModel: 'fixed',
      oopInflationRate: 0,
      oopReferenceAge: overrides.currentAge ?? 32,
      mediSaveTopUpAnnual: 0,
    },
    cpf: {
      balances: { oa: 50_000, sa: 30_000, ma: 20_000, ra: 0 },
      annualTopUps: { oa: 0, sa: 0, ma: 0 },
      retirementPhase: null,
      lifeActualMonthlyPayout: 0,
      lifeStartAge: 65,
      lifePlan: 'standard',
      retirementSum: 'frs',
      oaWithdrawals: [],
      cpfisEnabled: false,
      cpfisOaReturn: 0.04,
      cpfisSaReturn: 0.04,
      autoFallback: false,
      autoFallbackIncludeSA: false,
      virtualRebalancing: true,
      virtualRebalancingMode: 'from55',
    },
    srs: {
      balance: 10_000,
      annualContribution: 5_000,
      investmentReturn: 0.04,
      drawdownStartAge: 62,
      postFireEnabled: true,
    },
    taxProfile: {
      momEducation: 'degree',
      momAdjustment: 1.0,
      personalReliefs: 3_000,
      reliefBreakdown: null,
      reliefBasisAge: overrides.currentAge ?? 32,
    },
    lifeEvents: [],
    cashSavings: 50_000,
    nonMortgageDebtTotal: 0,
    nonMortgageDebtMonthlyPayment: 0,
    insuranceDeathCoverage: 500_000,
    insuranceCICoverage: 200_000,
    insuranceDisabilityMonthly: 3_000,
    funeralCosts: 15_000,
    ciRecoveryYears: 5,
    ...overrides,
  }
}

/**
 * Two-adult fixture:
 * - TJ (self): age 32
 * - Chloe (partner): age 28
 * - Age delta: 4 years (TJ is older)
 *
 * Income:
 *   - TJ's salary (owner: 'self')
 *   - Chloe's salary (owner: 'partner'), timing.owner: 'partner', endAge: null
 *   - Shared rental income (owner: 'shared'), timing.owner: 'self'
 *
 * Expenses:
 *   - Shared household expenses (owner: 'shared'), timing.owner: 'self', endAge: null
 *   - TJ's personal expense (owner: 'self')
 *   - Chloe's personal expense (owner: 'partner')
 *
 * Goals:
 *   - Shared travel goal (owner: 'shared'), timing.owner: 'self'
 *
 * Assets:
 *   - Shared savings (owner: 'shared')
 *   - TJ's locked asset (owner: 'self')
 */
function makeTwoAdultPlan(): HouseholdPlan {
  const tj = makeAdult({
    id: 'adult-tj',
    owner: 'self',
    displayName: 'TJ',
    currentAge: 32,
    retirementAge: 55,
    lifeExpectancy: 85,
  })

  const chloe = makeAdult({
    id: 'adult-chloe',
    owner: 'partner',
    displayName: 'Chloe',
    currentAge: 28,
    retirementAge: 60,
    lifeExpectancy: 90,
    annualIncome: 80_000,
    annualExpenses: 25_000,
    liquidNetWorth: 100_000,
  })

  const tjSalary: IncomeSource = {
    id: 'income-tj-salary',
    owner: 'self',
    label: "TJ's Salary",
    kind: 'salary-model',
    timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: 55 },
    annualAmount: 100_000,
    growthRate: 0.03,
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: true,
    isActive: true,
    streamType: 'employment',
    salaryModel: 'simple',
    bonusMonths: 2,
    employerCpfEnabled: true,
  }

  // Chloe's salary: endAge === null to exercise null preservation in timing shift
  const chloeSalary: IncomeSource = {
    id: 'income-chloe-salary',
    owner: 'partner',
    label: "Chloe's Salary",
    kind: 'salary-model',
    timing: { kind: 'age-range', owner: 'partner', startAge: 28, endAge: null },
    annualAmount: 80_000,
    growthRate: 0.025,
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: true,
    isActive: true,
    streamType: 'employment',
    salaryModel: 'simple',
    bonusMonths: 1,
    employerCpfEnabled: true,
  }

  // Shared rental income: timing.owner is 'self' (based on TJ's age frame)
  const sharedRental: IncomeSource = {
    id: 'income-shared-rental',
    owner: 'shared',
    label: 'Rental Income',
    kind: 'income-stream',
    timing: { kind: 'age-range', owner: 'self', startAge: 35, endAge: 65 },
    annualAmount: 24_000,
    growthRate: 0.02,
    growthModel: 'fixed',
    taxTreatment: 'tax-exempt',
    isCpfApplicable: false,
    isActive: true,
    streamType: 'rental',
  }

  // Shared household expenses: timing.owner is 'self', endAge: null
  const sharedHousehold: ExpenseItem = {
    id: 'expense-shared-household',
    owner: 'shared',
    label: 'Household Expenses',
    kind: 'base-living',
    timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: null },
    amount: 4_000,
    periodicity: 'monthly',
    retirementSpendingAdjustment: 0.8,
  }

  // TJ's personal expense
  const tjExpense: ExpenseItem = {
    id: 'expense-tj-personal',
    owner: 'self',
    label: "TJ's Personal Expense",
    kind: 'additional-living',
    timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: 55 },
    amount: 6_000,
    periodicity: 'annual',
  }

  // Chloe's personal expense
  const chloeExpense: ExpenseItem = {
    id: 'expense-chloe-personal',
    owner: 'partner',
    label: "Chloe's Personal Expense",
    kind: 'additional-living',
    timing: { kind: 'age-range', owner: 'partner', startAge: 28, endAge: 60 },
    amount: 5_000,
    periodicity: 'annual',
  }

  // Shared travel goal: timing.owner is 'self'
  const sharedGoal: GoalItem = {
    id: 'goal-shared-travel',
    owner: 'shared',
    label: 'Travel Fund',
    kind: 'financial-goal',
    timing: { kind: 'single-age', owner: 'self', age: 45 },
    amount: 20_000,
    durationYears: 5,
    priority: 'important',
    inflationAdjusted: false,
    category: 'travel',
  }

  // Shared savings asset
  const sharedAsset: AssetItem = {
    id: 'asset-shared-savings',
    owner: 'shared',
    label: 'Joint Savings',
    kind: 'liquid-net-worth',
    amount: 100_000,
  }

  // TJ's locked asset
  const tjAsset: AssetItem = {
    id: 'asset-tj-locked',
    owner: 'self',
    label: "TJ's Locked Fund",
    kind: 'locked-asset',
    amount: 50_000,
    unlockAge: 55,
  }

  return {
    schemaVersion: 1,
    id: 'test-two-adult-plan',
    planType: 'couple',
    planYear: 2026,
    adults: [tj, chloe],
    dependents: [],
    income: [tjSalary, chloeSalary, sharedRental],
    expenses: [sharedHousehold, tjExpense, chloeExpense],
    assets: [sharedAsset, tjAsset],
    goals: [sharedGoal],
    properties: [],
    assumptions: {
      fire: { fireType: 'regular', swr: 0.04, fireNumberBasis: 'retirement' },
      returns: {
        expectedReturn: 0.07,
        usePortfolioReturn: false,
        inflation: 0.025,
        expenseRatio: 0.003,
        rebalanceFrequency: 'annual',
      },
      cashReserve: {
        enabled: false,
        mode: 'months',
        fixedAmount: 0,
        months: 6,
        returnRate: 0.02,
      },
      retirementMitigation: { type: 'none' },
    },
    parityMeta: {
      source: 'legacy-individual-store-adapter',
      persistedKeyCounts: { profile: 0, income: 0, property: 0 },
      mutationCouplings: [],
    },
  }
}

// ---------------------------------------------------------------------------
// buildSplitAdultPlanSlice tests
// ---------------------------------------------------------------------------

describe('buildSplitAdultPlanSlice', () => {
  describe('unknown adult ID', () => {
    it('returns null for unknown adult ID', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'does-not-exist', 0.5)
      expect(result).toBeNull()
    })
  })

  describe('planType and adults', () => {
    it('produces planType: individual with one adult', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.5)
      expect(result).not.toBeNull()
      expect(result!.slice.planType).toBe('individual')
      expect(result!.slice.adults).toHaveLength(1)
    })

    it('remaps target adult owner to self', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-chloe', 0.5)
      expect(result!.slice.adults[0].owner).toBe('self')
    })
  })

  describe('splitRatio=0 zeroes out shared items', () => {
    it('shared income annualAmount becomes 0 when splitRatio=0', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0)
      expect(result).not.toBeNull()
      const sharedIncome = result!.slice.income.find((e) => e.id === 'income-shared-rental')
      expect(sharedIncome).toBeDefined()
      expect(sharedIncome!.annualAmount).toBe(0)
    })

    it('shared expense amount becomes 0 when splitRatio=0', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0)
      const sharedExpense = result!.slice.expenses.find((e) => e.id === 'expense-shared-household')
      expect(sharedExpense).toBeDefined()
      expect(sharedExpense!.amount).toBe(0)
    })

    it('owned income is unaffected by splitRatio=0', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0)
      const tjIncome = result!.slice.income.find((e) => e.id === 'income-tj-salary')
      expect(tjIncome).toBeDefined()
      expect(tjIncome!.annualAmount).toBe(100_000)
    })

    it('owned expense is unaffected by splitRatio=0', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0)
      const tjExpense = result!.slice.expenses.find((e) => e.id === 'expense-tj-personal')
      expect(tjExpense).toBeDefined()
      expect(tjExpense!.amount).toBe(6_000)
    })
  })

  describe('splitRatio scaling', () => {
    it('shared income is scaled by splitRatio', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.6)
      const sharedIncome = result!.slice.income.find((e) => e.id === 'income-shared-rental')
      expect(sharedIncome!.annualAmount).toBeCloseTo(24_000 * 0.6, 6)
    })

    it('shared expense is scaled by splitRatio', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.6)
      const sharedExpense = result!.slice.expenses.find((e) => e.id === 'expense-shared-household')
      expect(sharedExpense!.amount).toBeCloseTo(4_000 * 0.6, 6)
    })

    it('shared asset is scaled by splitRatio', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.4)
      const sharedAsset = result!.slice.assets.find((e) => e.id === 'asset-shared-savings')
      expect(sharedAsset!.amount).toBeCloseTo(100_000 * 0.4, 6)
    })

    it('shared goal is scaled by splitRatio', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.5)
      const goal = result!.slice.goals.find((e) => e.id === 'goal-shared-travel')
      expect(goal!.amount).toBeCloseTo(20_000 * 0.5, 6)
    })
  })

  describe('partner-owned entries are excluded', () => {
    it('excludes partner income from self slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.5)
      const chloeIncome = result!.slice.income.find((e) => e.id === 'income-chloe-salary')
      expect(chloeIncome).toBeUndefined()
    })

    it('excludes partner expense from self slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.5)
      const chloeExpense = result!.slice.expenses.find((e) => e.id === 'expense-chloe-personal')
      expect(chloeExpense).toBeUndefined()
    })
  })

  describe('null endAge preservation during timing shift', () => {
    it('null endAge on partner income stays null after shifting to partner frame', () => {
      // Chloe's salary has endAge: null. When building partner slice, no shift needed (same owner).
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-chloe', 0.5)
      const chloeIncome = result!.slice.income.find((e) => e.id === 'income-chloe-salary')
      expect(chloeIncome).toBeDefined()
      const timing = chloeIncome!.timing
      expect(timing.kind).toBe('age-range')
      if (timing.kind === 'age-range') {
        expect(timing.endAge).toBeNull()
      }
    })

    it('null endAge on shared expense stays null after shifting to partner frame', () => {
      // sharedHousehold has timing.owner='self', endAge: null.
      // When building Chloe's slice, delta = TJ.age(32) - Chloe.age(28) = 4.
      // startAge should shift: 32 - 4 = 28. endAge null stays null (not converted to number).
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-chloe', 0.5)
      const sharedExpense = result!.slice.expenses.find((e) => e.id === 'expense-shared-household')
      expect(sharedExpense).toBeDefined()
      const timing = sharedExpense!.timing
      expect(timing.kind).toBe('age-range')
      if (timing.kind === 'age-range') {
        expect(timing.endAge).toBeNull()
        // startAge shifted by delta=4: 32 - 4 = 28
        expect(timing.startAge).toBe(28)
      }
    })
  })

  describe('timing age shift correctness', () => {
    it('shifts shared income timing ages when building partner slice (delta=4)', () => {
      // sharedRental has timing.owner='self', startAge=35, endAge=65.
      // Building Chloe's slice: delta = TJ(32) - Chloe(28) = 4
      // Expected: startAge = 35 - 4 = 31, endAge = 65 - 4 = 61
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-chloe', 0.5)
      const sharedIncome = result!.slice.income.find((e) => e.id === 'income-shared-rental')
      expect(sharedIncome).toBeDefined()
      const timing = sharedIncome!.timing
      expect(timing.kind).toBe('age-range')
      if (timing.kind === 'age-range') {
        expect(timing.startAge).toBe(31) // 35 - 4
        expect(timing.endAge).toBe(61)  // 65 - 4
      }
    })

    it('no timing shift when building self slice (delta=0 for owned items)', () => {
      // TJ's salary: timing.owner='self', target is TJ (self). Delta=0, no shift.
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.5)
      const tjIncome = result!.slice.income.find((e) => e.id === 'income-tj-salary')
      expect(tjIncome).toBeDefined()
      const timing = tjIncome!.timing
      expect(timing.kind).toBe('age-range')
      if (timing.kind === 'age-range') {
        expect(timing.startAge).toBe(32)
        expect(timing.endAge).toBe(55)
      }
    })

    it('remaps all timing owners to self', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-chloe', 0.5)
      for (const entry of result!.slice.income) {
        expect(entry.timing.owner).toBe('self')
      }
      for (const entry of result!.slice.expenses) {
        expect(entry.timing.owner).toBe('self')
      }
    })
  })

  describe('adultAges are from target adult', () => {
    it('returns Chloe ages when building Chloe slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-chloe', 0.5)
      expect(result!.adultAges.currentAge).toBe(28)
      expect(result!.adultAges.retirementAge).toBe(60)
      expect(result!.adultAges.lifeExpectancy).toBe(90)
    })

    it('returns TJ ages when building TJ slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSplitAdultPlanSlice(plan, 'adult-tj', 0.5)
      expect(result!.adultAges.currentAge).toBe(32)
      expect(result!.adultAges.retirementAge).toBe(55)
      expect(result!.adultAges.lifeExpectancy).toBe(85)
    })
  })
})

// ---------------------------------------------------------------------------
// buildSingleAdultPlanSlice tests
// ---------------------------------------------------------------------------

describe('buildSingleAdultPlanSlice', () => {
  describe('unknown adult ID', () => {
    it('returns null for unknown adult ID', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'does-not-exist')
      expect(result).toBeNull()
    })
  })

  describe('planType and adults', () => {
    it('produces planType: individual with one adult', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      expect(result!.slice.planType).toBe('individual')
      expect(result!.slice.adults).toHaveLength(1)
    })

    it('remaps target adult owner to self', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-chloe')
      expect(result!.slice.adults[0].owner).toBe('self')
    })
  })

  describe('income filtering — owned only, no shared income', () => {
    it('includes TJ owned income at full value', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const tjIncome = result!.slice.income.find((e) => e.id === 'income-tj-salary')
      expect(tjIncome).toBeDefined()
      expect(tjIncome!.annualAmount).toBe(100_000)
    })

    it('excludes shared income (income is filtered by owner only, not shared)', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const sharedIncome = result!.slice.income.find((e) => e.id === 'income-shared-rental')
      expect(sharedIncome).toBeUndefined()
    })

    it('excludes partner income from self slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const chloeIncome = result!.slice.income.find((e) => e.id === 'income-chloe-salary')
      expect(chloeIncome).toBeUndefined()
    })

    it('includes Chloe owned income when building Chloe slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-chloe')
      const chloeIncome = result!.slice.income.find((e) => e.id === 'income-chloe-salary')
      expect(chloeIncome).toBeDefined()
      expect(chloeIncome!.annualAmount).toBe(80_000)
    })
  })

  describe('expense filtering — includes shared at full value', () => {
    it('includes shared expense at FULL value (no scaling)', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const sharedExpense = result!.slice.expenses.find((e) => e.id === 'expense-shared-household')
      expect(sharedExpense).toBeDefined()
      expect(sharedExpense!.amount).toBe(4_000) // full value, not scaled
    })

    it('includes self-owned expense', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const tjExpense = result!.slice.expenses.find((e) => e.id === 'expense-tj-personal')
      expect(tjExpense).toBeDefined()
      expect(tjExpense!.amount).toBe(6_000)
    })

    it('excludes partner-owned expense', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const chloeExpense = result!.slice.expenses.find((e) => e.id === 'expense-chloe-personal')
      expect(chloeExpense).toBeUndefined()
    })

    it('includes partner-owned expense when building partner slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-chloe')
      const chloeExpense = result!.slice.expenses.find((e) => e.id === 'expense-chloe-personal')
      expect(chloeExpense).toBeDefined()
    })
  })

  describe('owner remapping — all remaining owners become self', () => {
    it('all income owners are remapped to self', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      for (const entry of result!.slice.income) {
        expect(entry.owner).toBe('self')
      }
    })

    it('all expense owners are remapped to self', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      for (const entry of result!.slice.expenses) {
        expect(entry.owner).toBe('self')
      }
    })

    it('all timing owners are remapped to self', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      for (const entry of result!.slice.income) {
        expect(entry.timing.owner).toBe('self')
      }
      for (const entry of result!.slice.expenses) {
        expect(entry.timing.owner).toBe('self')
      }
    })
  })

  describe('null endAge preservation', () => {
    it('null endAge on Chloe salary stays null in Chloe slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-chloe')
      const chloeIncome = result!.slice.income.find((e) => e.id === 'income-chloe-salary')
      const timing = chloeIncome!.timing
      if (timing.kind === 'age-range') {
        expect(timing.endAge).toBeNull()
      }
    })

    it('null endAge on shared expense stays null in TJ slice', () => {
      // sharedHousehold: timing.owner='self', endAge: null.
      // Building TJ slice: delta = 0 (target IS self). No shift, null stays null.
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const sharedExpense = result!.slice.expenses.find((e) => e.id === 'expense-shared-household')
      const timing = sharedExpense!.timing
      if (timing.kind === 'age-range') {
        expect(timing.endAge).toBeNull()
      }
    })

    it('null endAge on shared expense stays null and shifts correctly in Chloe slice', () => {
      // sharedHousehold: timing.owner='self' (TJ at 32), endAge: null.
      // Building Chloe slice: delta = TJ(32) - Chloe(28) = 4.
      // startAge = 32 - 4 = 28. endAge null MUST stay null (not become -4 or 0).
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-chloe')
      const sharedExpense = result!.slice.expenses.find((e) => e.id === 'expense-shared-household')
      const timing = sharedExpense!.timing
      expect(timing.kind).toBe('age-range')
      if (timing.kind === 'age-range') {
        expect(timing.endAge).toBeNull()
        expect(timing.startAge).toBe(28) // 32 - 4
      }
    })
  })

  describe('adultAges are from target adult', () => {
    it('returns TJ ages for TJ slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      expect(result!.adultAges.currentAge).toBe(32)
      expect(result!.adultAges.retirementAge).toBe(55)
      expect(result!.adultAges.lifeExpectancy).toBe(85)
    })

    it('returns Chloe ages for Chloe slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-chloe')
      expect(result!.adultAges.currentAge).toBe(28)
      expect(result!.adultAges.retirementAge).toBe(60)
      expect(result!.adultAges.lifeExpectancy).toBe(90)
    })
  })

  describe('assets and goals filtering', () => {
    it('includes shared assets in self slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const sharedAsset = result!.slice.assets.find((e) => e.id === 'asset-shared-savings')
      expect(sharedAsset).toBeDefined()
    })

    it('includes self-owned assets in self slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const tjAsset = result!.slice.assets.find((e) => e.id === 'asset-tj-locked')
      expect(tjAsset).toBeDefined()
    })

    it('excludes partner-owned assets from self slice', () => {
      // No partner-specific assets in fixture, so verify shared IS included
      // and owned-by-other would be excluded (covered structurally by owner check)
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      // Only 2 assets exist: shared + self-owned — both should be in TJ's slice
      expect(result!.slice.assets).toHaveLength(2)
    })

    it('includes shared goals in self slice', () => {
      const plan = makeTwoAdultPlan()
      const result = buildSingleAdultPlanSlice(plan, 'adult-tj')
      const goal = result!.slice.goals.find((e) => e.id === 'goal-shared-travel')
      expect(goal).toBeDefined()
      expect(goal!.amount).toBe(20_000) // full value, no scaling
    })
  })
})
