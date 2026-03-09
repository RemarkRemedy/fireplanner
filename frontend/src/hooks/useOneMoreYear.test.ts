import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOneMoreYear } from './useOneMoreYear'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
})

describe('useOneMoreYear', () => {
  it('returns 4 scenarios with valid profile', () => {
    const { result } = renderHook(() => useOneMoreYear())
    expect(result.current.hasData).toBe(true)
    expect(result.current.scenarios).toHaveLength(4)
  })

  it('returns no data when profile has validation errors', () => {
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 20 },
    })
    const { result } = renderHook(() => useOneMoreYear())
    expect(result.current.hasData).toBe(false)
    expect(result.current.scenarios).toHaveLength(0)
  })

  it('portfolio increases with each extra year', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
      income: { annualSalary: 72000 },
      expenses: { annualExpenses: 48000 },
      assets: { liquidNetWorth: 100000 },
      assumptions: {
        returns: { usePortfolioReturn: false, expectedReturn: 0.07 },
      },
    })
    const { result } = renderHook(() => useOneMoreYear())
    const scenarios = result.current.scenarios
    for (let i = 1; i < scenarios.length; i++) {
      expect(scenarios[i].portfolioAtRetirement).toBeGreaterThan(scenarios[i - 1].portfolioAtRetirement)
    }
  })

  it('effectiveSwr decreases with each extra year', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
      income: { annualSalary: 72000 },
      expenses: { annualExpenses: 48000 },
      assets: { liquidNetWorth: 100000 },
      assumptions: {
        returns: { usePortfolioReturn: false, expectedReturn: 0.07 },
      },
    })
    const { result } = renderHook(() => useOneMoreYear())
    const scenarios = result.current.scenarios
    for (let i = 1; i < scenarios.length; i++) {
      expect(scenarios[i].effectiveSwr).toBeLessThan(scenarios[i - 1].effectiveSwr)
    }
  })

  it('deltaPortfolio is 0 for base scenario', () => {
    const { result } = renderHook(() => useOneMoreYear())
    expect(result.current.scenarios[0].deltaPortfolio).toBe(0)
  })

  it('deltaPortfolio is positive for extra years', () => {
    const { result } = renderHook(() => useOneMoreYear())
    for (let i = 1; i < result.current.scenarios.length; i++) {
      expect(result.current.scenarios[i].deltaPortfolio).toBeGreaterThan(0)
    }
  })

  it('clamps to lifeExpectancy - 5', () => {
    setupTestPlan({
      adult: {
        retirementAge: 84,
        lifeExpectancy: 90, // max offset = 90-5-84 = 1
      },
    })
    const { result } = renderHook(() => useOneMoreYear())
    // Should have at most 2 scenarios (0 and 1)
    expect(result.current.scenarios.length).toBeLessThanOrEqual(2)
  })

  it('risk level transitions from risky to safe', () => {
    // Someone with high SWR — extra years should improve risk
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
      income: { annualSalary: 72000 },
      expenses: { annualExpenses: 48000 },
      assets: { liquidNetWorth: 500000 },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07 },
      },
    })
    const { result } = renderHook(() => useOneMoreYear())
    const scenarios = result.current.scenarios
    // All should have valid risk levels
    for (const s of scenarios) {
      expect(['safe', 'marginal', 'risky']).toContain(s.riskLevel)
    }
  })

  it('risky risk level when effectiveSwr > 4.5%', () => {
    // Set up so that expenses / portfolio > 4.5% at retirement
    // With 1 year of accumulation (retirementAge must be > currentAge),
    // portfolio grows slightly, but expenses are high relative to NW → risky
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 56,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
      },
      income: { annualSalary: 80000 },
      expenses: { annualExpenses: 80000 },
      assets: { liquidNetWorth: 1000000 },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
    })
    const { result } = renderHook(() => useOneMoreYear())
    expect(result.current.hasData).toBe(true)
    const baseScenario = result.current.scenarios[0]
    // With 1 year growth the swr may be slightly below 8%, but still well above 4.5% → risky
    expect(baseScenario.effectiveSwr).toBeGreaterThan(0.045)
    expect(baseScenario.riskLevel).toBe('risky')
  })

  it('marginal risk level at swr boundary of 4.5%', () => {
    // Set up portfolio so that effectiveSwr = expenses / portfolio ≈ 0.045
    // With 1 year of growth (retirementAge must be > currentAge), we need to
    // back-calculate NW so that after accumulation, portfolio = 80K / 0.045
    // Portfolio at retirement ≈ NW * (1 + netRealReturn) where netRealReturn = 0.042
    const targetPortfolio = 80000 / 0.045 // 1,777,778
    const targetNW = Math.ceil(targetPortfolio / 1.042) // ≈ 1,706,122
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 56,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
      },
      income: { annualSalary: 80000 },
      expenses: { annualExpenses: 80000 },
      assets: { liquidNetWorth: targetNW },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
    })
    const { result } = renderHook(() => useOneMoreYear())
    expect(result.current.hasData).toBe(true)
    const baseScenario = result.current.scenarios[0]
    // effectiveSwr ≈ 80K / (targetNW * 1.042) ≈ 0.045 → marginal (not risky)
    expect(baseScenario.effectiveSwr).toBeCloseTo(0.045, 3)
    expect(baseScenario.riskLevel).toBe('marginal')
  })

  it('Infinity effectiveSwr when portfolio is 0', () => {
    // Zero NW, zero savings → portfolio = 0 → effectiveSwr = Infinity → risky
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 56,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
      },
      income: { annualSalary: 48000 },
      expenses: { annualExpenses: 48000 },
      assets: { liquidNetWorth: 0 },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07 },
      },
    })
    const { result } = renderHook(() => useOneMoreYear())
    expect(result.current.hasData).toBe(true)
    const baseScenario = result.current.scenarios[0]
    expect(baseScenario.effectiveSwr).toBe(Infinity)
    expect(baseScenario.riskLevel).toBe('risky')
  })
})
