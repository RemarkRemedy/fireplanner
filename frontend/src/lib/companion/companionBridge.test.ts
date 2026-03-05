import { describe, it, expect, beforeEach } from 'vitest'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
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

describe('applySnapshotToStores', () => {
  beforeEach(() => {
    // Reset stores to defaults before each test
    const profileDefaults = useProfileStore.getInitialState()
    useProfileStore.setState(profileDefaults)
    const incomeDefaults = useIncomeStore.getInitialState()
    useIncomeStore.setState(incomeDefaults)
  })

  it('maps full snapshot to stores', () => {
    const snapshot = makeFullSnapshot()
    applySnapshotToStores(snapshot)

    const profile = useProfileStore.getState()
    const income = useIncomeStore.getState()

    // Income: both stores set
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
    const defaults = useProfileStore.getState()
    const defaultAge = defaults.currentAge
    const defaultRetirementAge = defaults.retirementAge

    // Snapshot with no profile object
    const snapshot: PlannerSnapshotResponse = {
      schemaVersion: 1,
      avgMonthlyIncome: 5000,
    }
    applySnapshotToStores(snapshot)

    const profile = useProfileStore.getState()
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

    const profile = useProfileStore.getState()
    expect(profile.currentAge).toBe(40)
    expect(profile.annualExpenses).toBe(42_000) // 3500 * 12
    // Income not set — should retain default
    const defaults = useProfileStore.getInitialState()
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

    const profile = useProfileStore.getState()
    const income = useIncomeStore.getState()
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

    const profile = useProfileStore.getState()
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

    const profile = useProfileStore.getState()
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

    const profile = useProfileStore.getState()
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

    const profile = useProfileStore.getState()
    // expense = max(0, 1000 - 5000) = 0
    expect(profile.annualExpenses).toBe(0)
  })

  it('ignores non-finite values (NaN, Infinity)', () => {
    const defaults = useProfileStore.getState()
    const defaultIncome = defaults.annualIncome

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

    const profile = useProfileStore.getState()
    // Non-finite values should be ignored, keeping defaults
    expect(profile.annualIncome).toBe(defaultIncome)
    expect(profile.currentAge).toBe(defaults.currentAge)
    expect(profile.inflation).toBe(defaults.inflation)
  })
})
