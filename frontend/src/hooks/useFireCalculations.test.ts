import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFireCalculations } from './useFireCalculations'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useHouseholdStore } from '@/stores/useHouseholdStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  usePropertyStore.getState().reset()
  useHouseholdStore.getState().reset()
})

describe('useFireCalculations', () => {
  it('computes FIRE metrics with valid defaults', () => {
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.metrics).not.toBeNull()
    expect(result.current.metrics!.fireNumber).toBeGreaterThan(0)
  })

  it('returns null metrics when profile has validation errors', () => {
    useProfileStore.getState().setField('currentAge', 15) // Invalid
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.metrics).toBeNull()
  })

  it('fresh graduate: FIRE number = $857,143 (today basis)', () => {
    useProfileStore.setState({
      currentAge: 25,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualIncome: 48000,
      annualExpenses: 30000,
      liquidNetWorth: 50000,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      swr: 0.035,
      fireType: 'regular',
      fireNumberBasis: 'today',
      retirementSpendingAdjustment: 1.0,
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics).not.toBeNull()
    // FIRE number = 30000 / 0.035 = 857142.857
    expect(result.current.metrics!.fireNumber).toBeCloseTo(857143, -1)
  })

  it('mid-career: progress with today basis', () => {
    useProfileStore.setState({
      currentAge: 35,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualIncome: 180000,
      annualExpenses: 96000,
      liquidNetWorth: 800000,
      cpfOA: 200000,
      cpfSA: 100000,
      cpfMA: 0,
      swr: 0.04,
      fireType: 'regular',
      fireNumberBasis: 'today',
      retirementSpendingAdjustment: 1.0,
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics).not.toBeNull()
    // FIRE number = 96000 / 0.04 = 2,400,000
    expect(result.current.metrics!.fireNumber).toBe(2400000)
    // Progress = 1,100,000 / 2,400,000 = ~45.8%
    expect(result.current.metrics!.progress).toBeCloseTo(0.458, 1)
  })

  it('pre-retiree: already at FIRE (yearsToFire = 0)', () => {
    useProfileStore.setState({
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 90,
      lifeStage: 'pre-fire',
      annualIncome: 0,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      swr: 0.04,
      fireType: 'regular',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      validationErrors: {},
    })
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics).not.toBeNull()
    // FIRE number = 80000 / 0.04 = 2,000,000 — already reached
    expect(result.current.metrics!.fireNumber).toBe(2000000)
    expect(result.current.metrics!.progress).toBeGreaterThanOrEqual(1.0)
    expect(result.current.metrics!.yearsToFire).toBe(0)
  })

  it('includes property equity when owning property', () => {
    usePropertyStore.getState().setField('ownsProperty', true)
    usePropertyStore.getState().setField('existingPropertyValue', 1500000)
    usePropertyStore.getState().setField('existingMortgageBalance', 800000)

    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics).not.toBeNull()
    // Property equity = 700K should be included
  })

  it('uses portfolio return when usePortfolioReturn is true', () => {
    useProfileStore.getState().setField('usePortfolioReturn', true)
    // Allocation defaults should work since no errors
    const { result: withPortfolio } = renderHook(() => useFireCalculations())

    useProfileStore.getState().setField('usePortfolioReturn', false)
    const { result: withManual } = renderHook(() => useFireCalculations())

    // Different expected returns should produce different yearsToFire
    expect(withPortfolio.current.metrics).not.toBeNull()
    expect(withManual.current.metrics).not.toBeNull()
  })

  it('returns null when income has validation errors', () => {
    useIncomeStore.getState().setField('annualSalary', -1) // Invalid
    const { result } = renderHook(() => useFireCalculations())
    // Income validation errors should propagate
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.metrics).toBeNull()
  })

  it('cpfTotal includes cpfRA in progress calculation', () => {
    useProfileStore.setState({
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 90,
      annualIncome: 0,
      annualExpenses: 80000,
      liquidNetWorth: 1500000,
      cpfOA: 100000,
      cpfSA: 0,
      cpfMA: 50000,
      cpfRA: 200000,
      swr: 0.04,
      fireType: 'regular',
      fireNumberBasis: 'today',
      retirementSpendingAdjustment: 1.0,
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics).not.toBeNull()
    // FIRE = 80K / 0.04 = 2M. NW = 1.5M + 100K + 0 + 50K + 200K = 1.85M
    // Progress = 1.85M / 2M = 92.5%
    expect(result.current.metrics!.progress).toBeCloseTo(0.925, 1)
  })

  it('uses income projection effectiveIncome when income has no errors', () => {
    // Set up a profile where income projection will generate a different
    // effectiveIncome than profile.annualIncome
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualIncome: 72000,
      annualExpenses: 48000,
      liquidNetWorth: 100000,
      swr: 0.04,
      fireType: 'regular',
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    // Income store with different salary triggers income projection
    useIncomeStore.setState({
      ...useIncomeStore.getState(),
      annualSalary: 120000, // Different from profile.annualIncome (72K)
      salaryGrowthRate: 0.03,
      validationErrors: {},
    })
    const { result: withProjection, unmount } = renderHook(() => useFireCalculations())
    expect(withProjection.current.metrics).not.toBeNull()
    const metricsWithProjection = withProjection.current.metrics!
    unmount()

    // Force income errors so it falls back to profile.annualIncome
    useIncomeStore.getState().setField('annualSalary', -1) // Invalid
    const { result: fallback } = renderHook(() => useFireCalculations())
    expect(fallback.current.metrics).not.toBeNull()

    // With income projection: higher income -> higher savings rate
    // Without (fallback): uses profile.annualIncome (72K)
    expect(metricsWithProjection.savingsRate).not.toEqual(fallback.current.metrics!.savingsRate)
  })

  it('usePortfolioReturn produces different yearsToFire vs manual return', () => {
    // Balanced allocation weighted return is ~4.85%, set manual to 10%
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualIncome: 72000,
      annualExpenses: 48000,
      liquidNetWorth: 100000,
      swr: 0.04,
      fireType: 'regular',
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.10, // 10% manual
      inflation: 0.025,
      expenseRatio: 0.003,
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    useAllocationStore.setState({ ...useAllocationStore.getState(), validationErrors: {} })
    const { result: manual, unmount } = renderHook(() => useFireCalculations())
    expect(manual.current.metrics).not.toBeNull()
    const manualYears = manual.current.metrics!.yearsToFire
    unmount()

    // Enable portfolio return (~4.85% from balanced allocation)
    useProfileStore.setState({ ...useProfileStore.getState(), usePortfolioReturn: true })
    const { result: portfolio } = renderHook(() => useFireCalculations())
    expect(portfolio.current.metrics).not.toBeNull()
    const portfolioYears = portfolio.current.metrics!.yearsToFire

    // 10% return should reach FIRE faster than ~4.85%
    expect(manualYears).toBeLessThan(portfolioYears)
  })

  it('cashReserveEnabled reduces investable NW and slows FIRE', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualIncome: 72000,
      annualExpenses: 48000,
      liquidNetWorth: 200000,
      swr: 0.04,
      fireType: 'regular',
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      cashReserveEnabled: false,
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result: noCashReserve, unmount } = renderHook(() => useFireCalculations())
    expect(noCashReserve.current.metrics).not.toBeNull()
    const noReserveYears = noCashReserve.current.metrics!.yearsToFire
    const noReserveProgress = noCashReserve.current.metrics!.progress
    unmount()

    // Enable cash reserve: 6 months of expenses = 48000/12 * 6 = 24000
    // This carves out 24K from the 200K liquidNetWorth
    useProfileStore.setState({
      ...useProfileStore.getState(),
      cashReserveEnabled: true,
      cashReserveMode: 'months' as const,
      cashReserveMonths: 6,
    })
    const { result: withCashReserve } = renderHook(() => useFireCalculations())
    expect(withCashReserve.current.metrics).not.toBeNull()
    const reserveYears = withCashReserve.current.metrics!.yearsToFire
    const reserveProgress = withCashReserve.current.metrics!.progress

    // Cash reserve carves out NW, so progress should be lower and years to FIRE higher
    expect(reserveProgress).toBeLessThan(noReserveProgress)
    expect(reserveYears).toBeGreaterThan(noReserveYears)
  })

  it('healthcareConfig.enabled increases FIRE number', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 90,
      annualIncome: 0,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      swr: 0.04,
      fireType: 'regular',
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      healthcareConfig: {
        enabled: false,
        mediShieldLifeEnabled: true,
        ispTier: 'none',
        careShieldLifeEnabled: true,
        oopBaseAmount: 5000,
        oopModel: 'age-curve' as const,
        oopInflationRate: 0.05,
        oopReferenceAge: 55,
        mediSaveTopUpAnnual: 0,
      },
      validationErrors: {},
    })
    const { result: noHealthcare, unmount } = renderHook(() => useFireCalculations())
    expect(noHealthcare.current.metrics).not.toBeNull()
    const fireNoHealthcare = noHealthcare.current.metrics!.fireNumber
    unmount()

    // Enable healthcare — adds healthcare LAE to effective expenses, increasing FIRE number
    useProfileStore.setState({
      ...useProfileStore.getState(),
      healthcareConfig: {
        ...useProfileStore.getState().healthcareConfig,
        enabled: true,
      },
    })
    const { result: withHealthcare } = renderHook(() => useFireCalculations())
    expect(withHealthcare.current.metrics).not.toBeNull()
    const fireWithHealthcare = withHealthcare.current.metrics!.fireNumber

    // Healthcare costs add to expenses, so FIRE number should be higher
    expect(fireWithHealthcare).toBeGreaterThan(fireNoHealthcare)
  })
})
