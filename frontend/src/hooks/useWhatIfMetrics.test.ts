import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWhatIfMetrics } from './useWhatIfMetrics'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  usePropertyStore.getState().reset()
})

describe('useWhatIfMetrics', () => {
  it('returns hasData: false when profile has errors', () => {
    useProfileStore.getState().setField('currentAge', 15)
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
    // Use a profile where FIRE is not yet achieved so return increase matters
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 90,
      annualIncome: 72000,
      annualExpenses: 48000,
      liquidNetWorth: 0,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      srsAnnualContribution: 0,
      swr: 0.04,
      usePortfolioReturn: false,
      expectedReturn: 0.05,
      inflation: 0.025,
      expenseRatio: 0.003,
      validationErrors: {},
    })
    useIncomeStore.setState({
      ...useIncomeStore.getState(),
      annualSalary: 72000,
    })
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
    // Use a profile where FIRE is not yet achieved so income increase matters
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 90,
      annualIncome: 72000,
      annualExpenses: 48000,
      liquidNetWorth: 0,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      srsAnnualContribution: 0,
      swr: 0.04,
      validationErrors: {},
    })
    const { result } = renderHook(() => useWhatIfMetrics({ annualIncome: 250000 }))
    expect(result.current.deltas).not.toBeNull()
    if (isFinite(result.current.deltas!.yearsToFire)) {
      expect(result.current.deltas!.yearsToFire).toBeLessThan(0)
    }
  })

  it('increase liquidNetWorth: fewer years to FIRE', () => {
    // Use a profile where FIRE is not yet achieved so net worth increase matters
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 90,
      annualIncome: 72000,
      annualExpenses: 48000,
      liquidNetWorth: 50000,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      srsAnnualContribution: 0,
      swr: 0.04,
      validationErrors: {},
    })
    const { result } = renderHook(() => useWhatIfMetrics({ liquidNetWorth: 800000 }))
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
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
    })
    const { result } = renderHook(() => useWhatIfMetrics({}))
    expect(result.current.hasData).toBe(true)
    expect(result.current.baseMetrics).not.toBeNull()
    expect(result.current.baseMetrics!.fireNumber).toBeGreaterThan(0)
  })

  it('usePortfolioReturn changes base metrics via expected return', () => {
    // Use a profile where FIRE is not yet achieved so return differences matter
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 90,
      annualIncome: 72000,
      annualExpenses: 48000,
      liquidNetWorth: 0,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      srsAnnualContribution: 0,
      swr: 0.04,
      usePortfolioReturn: false,
      expectedReturn: 0.10,
      validationErrors: {},
    })
    useAllocationStore.setState({ ...useAllocationStore.getState(), validationErrors: {} })
    const { result: manual, unmount } = renderHook(() => useWhatIfMetrics({}))
    expect(manual.current.hasData).toBe(true)
    const manualYears = manual.current.baseMetrics!.yearsToFire
    unmount()

    // Portfolio return (~4.85% from balanced allocation) instead of 10%
    useProfileStore.setState({ ...useProfileStore.getState(), usePortfolioReturn: true })
    const { result: portfolio } = renderHook(() => useWhatIfMetrics({}))
    expect(portfolio.current.hasData).toBe(true)
    const portfolioYears = portfolio.current.baseMetrics!.yearsToFire

    // Higher return (10%) reaches FIRE faster than lower return (~4.85%)
    expect(manualYears).toBeLessThan(portfolioYears)
  })

  it('NaN delta when base yearsToFire is Infinity (unreachable FIRE)', () => {
    // Set expenses much higher than income so FIRE is unreachable
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualIncome: 30000,
      annualExpenses: 80000, // Expenses > income, can never save enough
      liquidNetWorth: 0,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      srsAnnualContribution: 0,
      swr: 0.04,
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      validationErrors: {},
    })
    // Also set income store salary to match low income
    useIncomeStore.setState({
      ...useIncomeStore.getState(),
      annualSalary: 30000,
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
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualIncome: 30000,
      annualExpenses: 80000,
      liquidNetWorth: 0,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      srsAnnualContribution: 0,
      swr: 0.04,
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      validationErrors: {},
    })
    // Also set income store salary to match low income
    useIncomeStore.setState({
      ...useIncomeStore.getState(),
      annualSalary: 30000,
    })

    const { result } = renderHook(() => useWhatIfMetrics({ annualExpenses: 90000 }))
    expect(result.current.hasData).toBe(true)
    expect(result.current.deltas).not.toBeNull()
    // fireAge delta should also be NaN when FIRE is unreachable
    expect(result.current.deltas!.fireAge).toBeNaN()
  })
})
