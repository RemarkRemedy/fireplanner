import { describe, expect, it } from 'vitest'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import type {
  HouseholdPlan,
  PlanningAdult,
} from '@/lib/household/types'
import {
  applyHouseholdScenarioOverrides,
  buildBuiltInHouseholdScenarios,
  compileHouseholdScenario,
  createCustomHouseholdScenario,
  summarizeHouseholdScenario,
} from '@/lib/household/scenarios'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'

function makePartnerAdult(self: PlanningAdult): PlanningAdult {
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
    healthcare: {
      ...structuredClone(self.healthcare),
      enabled: false,
      oopBaseAmount: 0,
      oopInflationRate: 0,
      oopReferenceAge: 33,
    },
    taxProfile: {
      ...structuredClone(self.taxProfile),
      reliefBasisAge: 33,
    },
    lifeEvents: [],
  }
}

function makeHouseholdPlan(): HouseholdPlan {
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
  self.lifeEventsEnabled = false
  self.lifeEvents = []
  self.taxProfile = {
    ...self.taxProfile,
    reliefBasisAge: 34,
  }

  plan.id = 'household-scenarios-test'
  plan.planType = 'couple'
  plan.adults = [self, makePartnerAdult(self)]
  plan.dependents = [
    {
      id: 'dependent-maya',
      owner: 'shared',
      label: 'Maya',
      relationship: 'child',
      currentAge: 8,
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 52,
      },
      annualCost: 9_000,
    },
  ]
  plan.income = [
    {
      id: 'income-self-salary',
      owner: 'self',
      label: 'Taylor salary',
      kind: 'salary-model',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 60,
      },
      annualAmount: 120_000,
      growthRate: 0.03,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: true,
      isActive: true,
      streamType: 'employment',
      salaryModel: 'simple',
      bonusMonths: 2,
      employerCpfEnabled: true,
      realisticPhases: [],
      promotionJumps: [],
    },
    {
      id: 'income-partner-salary',
      owner: 'partner',
      label: 'Jordan salary',
      kind: 'salary-model',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 58,
      },
      annualAmount: 84_000,
      growthRate: 0.02,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: true,
      isActive: true,
      streamType: 'employment',
      salaryModel: 'simple',
      bonusMonths: 1,
      employerCpfEnabled: true,
      realisticPhases: [],
      promotionJumps: [],
    },
    {
      id: 'income-shared-consulting',
      owner: 'shared',
      label: 'Shared consulting',
      kind: 'income-stream',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 45,
      },
      annualAmount: 18_000,
      growthRate: 0,
      growthModel: 'none',
      taxTreatment: 'taxable',
      isCpfApplicable: false,
      isActive: true,
      streamType: 'business',
    },
  ]
  plan.expenses = [
    {
      id: 'expense-shared-living',
      owner: 'shared',
      label: 'Household living',
      kind: 'base-living',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 90,
      },
      amount: 4_800,
      periodicity: 'monthly',
      growthRate: 0.025,
      inflationAdjusted: true,
      retirementSpendingAdjustment: 0.8,
    },
    {
      id: 'expense-self-hobby',
      owner: 'self',
      label: 'Cycling budget',
      kind: 'expense-adjustment',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 50,
      },
      amount: 250,
      periodicity: 'monthly',
      growthRate: 0,
      inflationAdjusted: false,
    },
    {
      id: 'expense-partner-support',
      owner: 'partner',
      label: 'Jordan family support',
      kind: 'parent-support',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 55,
      },
      amount: 300,
      periodicity: 'monthly',
      growthRate: 0,
      inflationAdjusted: false,
    },
  ]
  plan.assets = [
    {
      id: 'asset-self-cash',
      owner: 'self',
      label: 'Cash reserve',
      kind: 'liquid-net-worth',
      amount: 150_000,
    },
    {
      id: 'asset-shared-study-fund',
      owner: 'shared',
      label: 'Study fund',
      kind: 'locked-asset',
      amount: 40_000,
      unlockAge: 52,
      growthRate: 0.02,
    },
  ]
  plan.goals = [
    {
      id: 'goal-university',
      owner: 'shared',
      label: 'University fund',
      kind: 'financial-goal',
      timing: {
        kind: 'single-age',
        owner: 'self',
        age: 52,
      },
      amount: 50_000,
      durationYears: 1,
      priority: 'important',
      inflationAdjusted: true,
      category: 'education',
    },
  ]
  plan.properties = []

  return plan
}

describe('household scenarios', () => {
  it('builds built-in scenarios that change compiled household comparisons', () => {
    const plan = makeHouseholdPlan()
    const baseSummary = summarizeHouseholdScenario(compileHouseholdPlan(plan))
    const scenarios = buildBuiltInHouseholdScenarios(plan)
    const byId = Object.fromEntries(
      scenarios.map((scenario) => [scenario.id, compileHouseholdScenario(plan, scenario)]),
    )

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'self-retires-later',
      'partner-retires-later',
      'shared-expenses-down',
      'one-income-stops',
      'dependent-costs-end',
      'de-risk-allocation',
    ])

    expect(byId['self-retires-later'].plan.adults.find((adult) => adult.owner === 'self')?.retirementAge).toBe(62)
    expect(byId['partner-retires-later'].plan.adults.find((adult) => adult.owner === 'partner')?.retirementAge).toBe(60)
    expect(byId['shared-expenses-down'].summary.currentAnnualSavings).toBeGreaterThan(baseSummary.currentAnnualSavings)
    expect(byId['one-income-stops'].summary.currentAnnualSavings).toBeLessThan(baseSummary.currentAnnualSavings)
    expect(byId['dependent-costs-end'].summary.activeDependents).toBeLessThan(baseSummary.activeDependents)
    expect(byId['de-risk-allocation'].plan.assumptions.returns.expectedReturn).toBeLessThan(plan.assumptions.returns.expectedReturn)
    expect(byId['de-risk-allocation'].plan.assumptions.returns.usePortfolioReturn).toBe(false)
  })

  it('applies nested custom overrides without mutating the base household plan', () => {
    const plan = makeHouseholdPlan()
    const originalPlan = structuredClone(plan)

    const nextPlan = applyHouseholdScenarioOverrides(plan, {
      adults: {
        'adult-self': { retirementAge: 63 },
      },
      income: {
        'income-partner-salary': { isActive: false },
      },
      expenses: {
        'expense-shared-living': { amount: 4_200 },
      },
      dependents: {
        'dependent-maya': {
          timing: {
            kind: 'age-range',
            owner: 'self',
            startAge: 33,
            endAge: 33,
          },
        },
      },
      assumptions: {
        returns: {
          expectedReturn: 0.045,
          usePortfolioReturn: false,
        },
      },
    })

    expect(nextPlan).not.toBe(plan)
    expect(nextPlan.adults[0]?.retirementAge).toBe(63)
    expect(nextPlan.income.find((income) => income.id === 'income-partner-salary')?.isActive).toBe(false)
    expect(nextPlan.expenses.find((expense) => expense.id === 'expense-shared-living')?.amount).toBe(4_200)
    expect(nextPlan.dependents[0]?.timing).toEqual({
      kind: 'age-range',
      owner: 'self',
      startAge: 33,
      endAge: 33,
    })
    expect(nextPlan.assumptions.returns.expectedReturn).toBe(0.045)
    expect(nextPlan.assumptions.returns.usePortfolioReturn).toBe(false)

    expect(plan).toEqual(originalPlan)
  })

  it('creates and compiles a custom scenario override bundle', () => {
    const plan = makeHouseholdPlan()
    const scenario = createCustomHouseholdScenario(plan, {
      label: 'Custom family reset',
      selfRetirementAge: 61,
      sharedExpenseChangePct: -12,
      stopIncomeSourceId: 'income-shared-consulting',
      endDependentId: 'dependent-maya',
      expectedReturnPct: 4.8,
    })

    expect(scenario).not.toBeNull()

    const compiled = compileHouseholdScenario(plan, scenario!)

    expect(compiled.label).toBe('Custom family reset')
    expect(compiled.plan.adults.find((adult) => adult.owner === 'self')?.retirementAge).toBe(61)
    expect(compiled.plan.income.find((income) => income.id === 'income-shared-consulting')?.isActive).toBe(false)
    expect(compiled.plan.assumptions.returns.expectedReturn).toBeCloseTo(0.048)
    expect(compiled.summary.activeDependents).toBe(0)
    expect(compiled.summary.currentAnnualSavings).toBeGreaterThan(0)
  })
})
