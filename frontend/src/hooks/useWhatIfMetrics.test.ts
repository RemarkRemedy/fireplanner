import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWhatIfMetrics } from './useWhatIfMetrics'
import { useFireCalculations } from './useFireCalculations'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
})

describe('useWhatIfMetrics', () => {
  it('returns hasData: false when profile has errors', () => {
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 20 },
    })
    const { result } = renderHook(() => useWhatIfMetrics({}))
    expect(result.current.hasData).toBe(false)
    expect(result.current.baseMetrics).toBeNull()
  })

  it('no overrides: deltas are null', () => {
    const { result } = renderHook(() => useWhatIfMetrics({}))
    expect(result.current.hasData).toBe(true)
    expect(result.current.baseMetrics).not.toBeNull()
    expect(result.current.deltas).toBeNull()
  })

  it('increase expenses: FIRE number increases', () => {
    const { result: base } = renderHook(() => useWhatIfMetrics({}))
    const baseFireNumber = base.current.baseMetrics!.fireNumber

    const { result: overridden } = renderHook(() =>
      useWhatIfMetrics({ annualExpenses: 60000 })
    )
    expect(overridden.current.overrideMetrics!.fireNumber).toBeGreaterThan(baseFireNumber)
    expect(overridden.current.deltas!.fireNumber).toBeGreaterThan(0)
  })

  it('decrease SWR: higher FIRE number', () => {
    const { result } = renderHook(() => useWhatIfMetrics({ swr: 0.03 }))
    expect(result.current.deltas).not.toBeNull()
    expect(result.current.deltas!.fireNumber).toBeGreaterThan(0)
  })

  it('increase expected return: fewer years to FIRE', () => {
    const { result } = renderHook(() => useWhatIfMetrics({ expectedReturn: 0.12 }))
    expect(result.current.deltas).not.toBeNull()
    // Higher return should decrease years (negative delta)
    if (isFinite(result.current.deltas!.yearsToFire)) {
      expect(result.current.deltas!.yearsToFire).toBeLessThan(0)
    }
  })

  it('delay retirement age: more accumulation time', () => {
    const { result } = renderHook(() => useWhatIfMetrics({ retirementAge: 70 }))
    expect(result.current.deltas).not.toBeNull()
    // More time to accumulate → larger portfolio at retirement
    expect(result.current.deltas!.portfolioAtRetirement).toBeGreaterThan(0)
  })

  it('increase income: fewer years to FIRE', () => {
    const { result } = renderHook(() => useWhatIfMetrics({ annualIncome: 120000 }))
    expect(result.current.deltas).not.toBeNull()
    if (isFinite(result.current.deltas!.yearsToFire)) {
      expect(result.current.deltas!.yearsToFire).toBeLessThan(0)
    }
  })

  it('increase liquidNetWorth: fewer years to FIRE', () => {
    const { result } = renderHook(() => useWhatIfMetrics({ liquidNetWorth: 500000 }))
    expect(result.current.deltas).not.toBeNull()
    if (isFinite(result.current.deltas!.yearsToFire)) {
      expect(result.current.deltas!.yearsToFire).toBeLessThan(0)
    }
  })

  it('property equity is included in base inputs but does not affect extracted metrics', () => {
    // Property equity flows through getBaseInputs into calculateAllFireMetrics
    // but the 4 metrics extracted by computeMetrics (fireNumber, yearsToFire,
    // fireAge, portfolioAtRetirement) do not depend on property equity.
    // This test verifies the branch is exercised without error.
    setupTestPlan({
      property: {
        ownsProperty: true,
        existingPropertyValue: 1500000,
        existingMortgageBalance: 800000,
      },
    })
    const { result } = renderHook(() => useWhatIfMetrics({}))
    expect(result.current.hasData).toBe(true)
    expect(result.current.baseMetrics).not.toBeNull()
    expect(result.current.baseMetrics!.fireNumber).toBeGreaterThan(0)
  })

  it('matches useFireCalculations for base FIRE metrics with cash reserve and locked assets enabled', () => {
    setupTestPlan({
      income: { annualSalary: 96000 },
      expenses: { annualExpenses: 48000 },
      assumptions: {
        cashReserve: { enabled: true, mode: 'months', months: 6 },
      },
      assets: {
        lockedAssets: [
          {
            id: 'bond-ladder',
            name: 'Bond Ladder',
            amount: 80000,
            unlockAge: 60,
            growthRate: 0.02,
          },
        ],
      },
    })

    const { result: fire } = renderHook(() => useFireCalculations())
    const { result: whatIf } = renderHook(() => useWhatIfMetrics({}))

    expect(fire.current.metrics).not.toBeNull()
    expect(whatIf.current.baseMetrics).not.toBeNull()
    expect(whatIf.current.baseMetrics!.fireNumber).toBeCloseTo(fire.current.metrics!.fireNumber, 6)
    expect(whatIf.current.baseMetrics!.yearsToFire).toBeCloseTo(fire.current.metrics!.yearsToFire, 6)
    expect(whatIf.current.baseMetrics!.fireAge).toBeCloseTo(fire.current.metrics!.fireAge, 6)
  })

  it('usePortfolioReturn changes base metrics via expected return', () => {
    // Manual return of 10%
    setupTestPlan({
      assumptions: {
        returns: { usePortfolioReturn: false, expectedReturn: 0.10 },
      },
    })
    useAllocationStore.setState({ ...useAllocationStore.getState(), validationErrors: {} })
    const { result: manual, unmount } = renderHook(() => useWhatIfMetrics({}))
    expect(manual.current.hasData).toBe(true)
    const manualYears = manual.current.baseMetrics!.yearsToFire
    unmount()

    // Portfolio return (~4.85% from balanced allocation) instead of 10%
    setupTestPlan({
      assumptions: {
        returns: { usePortfolioReturn: true, expectedReturn: 0.10 },
      },
    })
    const { result: portfolio } = renderHook(() => useWhatIfMetrics({}))
    expect(portfolio.current.hasData).toBe(true)
    const portfolioYears = portfolio.current.baseMetrics!.yearsToFire

    // Higher return (10%) reaches FIRE faster than lower return (~4.85%)
    expect(manualYears).toBeLessThan(portfolioYears)
  })

  it('NaN delta when base yearsToFire is Infinity (unreachable FIRE)', () => {
    // Set expenses much higher than income so FIRE is unreachable
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
      income: { annualSalary: 30000 },
      expenses: { annualExpenses: 80000 },
      assets: { liquidNetWorth: 0 },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
    })

    // Override to a slightly different expense to trigger delta computation
    const { result } = renderHook(() => useWhatIfMetrics({ annualExpenses: 85000 }))
    expect(result.current.hasData).toBe(true)
    expect(result.current.deltas).not.toBeNull()
    // Both base and override have expenses > income, so yearsToFire is Infinity
    // The delta should be NaN
    expect(result.current.deltas!.yearsToFire).toBeNaN()
    // fireNumber delta should still be numeric (just a different amount)
    expect(isFinite(result.current.deltas!.fireNumber)).toBe(true)
  })

  it('NaN fireAge delta when base fireAge is Infinity', () => {
    // Same setup: unreachable FIRE
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
      income: { annualSalary: 30000 },
      expenses: { annualExpenses: 80000 },
      assets: { liquidNetWorth: 0 },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
    })

    const { result } = renderHook(() => useWhatIfMetrics({ annualExpenses: 90000 }))
    expect(result.current.hasData).toBe(true)
    expect(result.current.deltas).not.toBeNull()
    // fireAge delta should also be NaN when FIRE is unreachable
    expect(result.current.deltas!.fireAge).toBeNaN()
  })
})
