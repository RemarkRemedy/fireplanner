import { describe, it, expect, beforeEach } from 'vitest'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { applySnapshotToStores } from './companionBridge'
import type { PlannerSnapshotResponse } from './types'

function makeFullSnapshot(overrides: Partial<PlannerSnapshotResponse> = {}): PlannerSnapshotResponse {
  return {
    schemaVersion: 1,
    avgMonthlyIncome: 6000,
    avgMonthlyExpense: 4000,
    avgMonthlySavings: 2000,
    investableAssets: 150_000,
    profile: {
      currentAge: 32,
      retirementAgeTarget: 55,
      lifeExpectancy: 85,
      inflationPct: 2.5,
      expectedReturnPct: 7.0,
      expenseRatioPct: 0.3,
      swrPct: 4.0,
      cpfOA: 50_000,
      cpfSA: 30_000,
      cpfMA: 20_000,
    },
    ...overrides,
  }
}

function getHouseholdProfile() {
  const plan = useHouseholdPlanStore.getState().plan
  return buildHouseholdRuntimeLegacyInputs(plan).profile
}

function getHouseholdIncome() {
  const plan = useHouseholdPlanStore.getState().plan
  return buildHouseholdRuntimeLegacyInputs(plan).income
}

function getSelfAdult() {
  return useHouseholdPlanStore.getState().plan.adults.find((a) => a.owner === 'self')!
}

describe('applySnapshotToStores', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('maps full snapshot to stores', () => {
    const snapshot = makeFullSnapshot()
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    const income = getHouseholdIncome()

    // Income: both profile and income reflect the snapshot
    expect(profile.annualIncome).toBe(72_000) // 6000 * 12
    expect(income.annualSalary).toBe(72_000)

    // Expenses
    expect(profile.annualExpenses).toBe(48_000) // 4000 * 12

    // Net worth
    expect(profile.liquidNetWorth).toBe(150_000)

    // Profile fields
    expect(profile.currentAge).toBe(32)
    expect(profile.retirementAge).toBe(55)
    expect(profile.lifeExpectancy).toBe(85)

    // Unit conversion: percentages → decimals
    expect(profile.inflation).toBeCloseTo(0.025)
    expect(profile.expectedReturn).toBeCloseTo(0.07)
    expect(profile.expenseRatio).toBeCloseTo(0.003)
    expect(profile.swr).toBeCloseTo(0.04)

    // CPF balances
    expect(profile.cpfOA).toBe(50_000)
    expect(profile.cpfSA).toBe(30_000)
    expect(profile.cpfMA).toBe(20_000)
  })

  it('keeps defaults for nil/missing fields', () => {
    const defaults = getHouseholdProfile()
    const defaultAge = defaults.currentAge
    const defaultRetirementAge = defaults.retirementAge

    // Snapshot with no profile object
    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      avgMonthlyIncome: 5000,
    }
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    expect(profile.currentAge).toBe(defaultAge)
    expect(profile.retirementAge).toBe(defaultRetirementAge)
    expect(profile.annualIncome).toBe(60_000) // 5000 * 12 — income was set
  })

  it('handles partial snapshot (nil profile fields)', () => {
    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      avgMonthlyExpense: 3500,
      profile: {
        currentAge: 40,
        // All other profile fields undefined
      },
    }
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    expect(profile.currentAge).toBe(40)
    expect(profile.annualExpenses).toBe(42_000) // 3500 * 12
    // Inflation not set — should retain default
    const defaults = buildHouseholdRuntimeLegacyInputs(
      useHouseholdPlanStore.getInitialState().plan
    ).profile
    expect(profile.inflation).toBe(defaults.inflation)
  })

  it('handles zero-income edge case', () => {
    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      avgMonthlyIncome: 0,
      avgMonthlyExpense: 0,
      investableAssets: 0,
    }
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    const income = getHouseholdIncome()
    expect(profile.annualIncome).toBe(0)
    expect(income.annualSalary).toBe(0)
    expect(profile.annualExpenses).toBe(0)
    expect(profile.liquidNetWorth).toBe(0)
  })

  it('converts percentages to decimals correctly (2.5% → 0.025)', () => {
    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      profile: {
        inflationPct: 2.5,
        expectedReturnPct: 10.0,
        expenseRatioPct: 0.5,
        swrPct: 3.5,
      },
    }
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    expect(profile.inflation).toBeCloseTo(0.025)
    expect(profile.expectedReturn).toBeCloseTo(0.10)
    expect(profile.expenseRatio).toBeCloseTo(0.005)
    expect(profile.swr).toBeCloseTo(0.035)
  })

  it('derives income from expense + savings when income is nil', () => {
    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      // avgMonthlyIncome is undefined
      avgMonthlyExpense: 4000,
      avgMonthlySavings: 2000,
    }
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    // income = expense + savings = 4000 + 2000 = 6000
    expect(profile.annualIncome).toBe(72_000)
  })

  it('derives expense from income - savings when expense is nil', () => {
    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      avgMonthlyIncome: 8000,
      // avgMonthlyExpense is undefined
      avgMonthlySavings: 3000,
    }
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    // expense = income - savings = 8000 - 3000 = 5000
    expect(profile.annualExpenses).toBe(60_000)
  })

  it('clamps negative derived expense to zero', () => {
    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      avgMonthlyIncome: 1000,
      avgMonthlySavings: 5000, // savings > income
    }
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    // expense = max(0, 1000 - 5000) = 0
    expect(profile.annualExpenses).toBe(0)
  })

  it('ignores non-finite values (NaN, Infinity)', () => {
    // Capture legacy defaults that fromExpenseImport falls back to
    // when non-finite values are supplied
    const legacyDefaults = buildHouseholdRuntimeLegacyInputs(
      useHouseholdPlanStore.getInitialState().plan
    ).profile

    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      avgMonthlyIncome: NaN,
      investableAssets: Infinity,
      profile: {
        currentAge: NaN,
        inflationPct: -Infinity,
      },
    }
    applySnapshotToStores(snapshot)

    const profile = getHouseholdProfile()
    // Non-finite income resolves to 0 (no valid income data in snapshot)
    expect(profile.annualIncome).toBe(0)
    // Non-finite age and inflation fall back to legacy defaults
    expect(profile.currentAge).toBe(legacyDefaults.currentAge)
    expect(profile.inflation).toBe(legacyDefaults.inflation)
  })

  it('seeds an imported household plan that remains locally editable', () => {
    const review = applySnapshotToStores(makeFullSnapshot({
      monthKey: '2026-03',
      futureField: 'keep-for-review',
      expenseImport: {
        members: [
          { role: 'self', name: 'Alex', currentAge: 41 },
          { role: 'partner', name: 'Jamie', currentAge: 39, annualIncome: 36_000, annualExpense: 12_000, investableAssets: 50_000 },
          { role: 'dependent', name: 'Mia', age: 8, relationship: 'child', annualCost: 8_000 },
        ],
        unsupportedFields: ['debts.creditCard'],
      },
    }))

    const household = useHouseholdPlanStore.getState()
    const partner = household.plan.adults.find((adult) => adult.owner === 'partner')
    const selfSalary = household.plan.income.find((income) => income.kind === 'salary-model' && income.owner === 'self')
    const baseExpense = household.plan.expenses.find((expense) => expense.kind === 'base-living')

    expect(household.provenance.source).toBe('json-import')
    expect(household.plan.planType).toBe('household')
    expect(household.plan.adults).toHaveLength(2)
    expect(household.plan.dependents).toHaveLength(1)
    expect(selfSalary?.annualAmount).toBe(36_000)
    expect(baseExpense?.owner).toBe('shared')
    expect(baseExpense?.amount).toBe(28_000)
    expect(review.detectedMembers.map((member) => member.label)).toEqual(['Alex', 'Jamie', 'Mia'])
    expect(review.unsupportedFields).toEqual(['debts.creditCard', 'snapshot.futureField'])
    expect(review.localEditabilityNote).toContain('local Fireplanner copies')

    expect(partner).toBeDefined()
    useHouseholdPlanStore.getState().updateAdult(partner!.id, { retirementAge: 61 })
    expect(
      useHouseholdPlanStore.getState().plan.adults.find((adult) => adult.owner === 'partner')?.retirementAge,
    ).toBe(61)
  })
})
