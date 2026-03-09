import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardCharts } from './useDashboardCharts'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useUIStore } from '@/stores/useUIStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
  useUIStore.setState({
    sectionOrder: 'goal-first',
    cpfEnabled: true,
    propertyEnabled: false,
    healthcareEnabled: false,
    mode: 'simple',
    statsPosition: 'bottom',
  })
})

describe('useDashboardCharts', () => {
  it('returns accumulation data from current age to life expectancy', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
      assets: { liquidNetWorth: 100000 },
      expenses: { annualExpenses: 48000 },
      income: { annualSalary: 72000 },
      assumptions: {
        returns: { expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
    })
    const { result } = renderHook(() => useDashboardCharts())
    expect(result.current.accumulationData.length).toBe(61) // 30 to 90 inclusive
    expect(result.current.accumulationData[0].age).toBe(30)
    expect(result.current.accumulationData[60].age).toBe(90)
  })

  it('returns fire number line matching FIRE number', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
      income: { annualSalary: 72000 },
      expenses: { annualExpenses: 48000 },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
      },
    })
    const { result } = renderHook(() => useDashboardCharts())
    // FIRE number = annualExpenses / swr = 48000 / 0.04 = 1,200,000
    expect(result.current.fireNumberLine).toBe(1200000)
  })

  it('returns empty data when profile has validation errors', () => {
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 20 },
    })
    const { result } = renderHook(() => useDashboardCharts())
    expect(result.current.accumulationData).toEqual([])
    expect(result.current.fireNumberLine).toBeNull()
  })

  it('accumulation data starts with current NW including CPF', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
        cpfOA: 50000,
        cpfSA: 30000,
        cpfMA: 20000,
      },
      assets: { liquidNetWorth: 100000 },
    })
    const { result } = renderHook(() => useDashboardCharts())
    // First data point should be liquidNW + cpfOA + cpfSA + cpfMA + cpfRA = 200000
    expect(result.current.accumulationData[0].value).toBe(200000)
  })

  it('accumulation data includes cpfRA in starting NW', () => {
    setupTestPlan({
      adult: {
        currentAge: 56,
        retirementAge: 58,
        lifeExpectancy: 90,
        cpfOA: 50000,
        cpfSA: 0,
        cpfMA: 20000,
        cpfRA: 200000,
      },
      assets: { liquidNetWorth: 100000 },
    })
    const { result } = renderHook(() => useDashboardCharts())
    // First data point: 100K + 50K + 0 + 20K + 200K = 370K
    expect(result.current.accumulationData[0].value).toBe(370000)
  })

  it('values grow during accumulation phase', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 90,
      },
      assets: { liquidNetWorth: 100000 },
      income: { annualSalary: 72000 },
      expenses: { annualExpenses: 48000 },
      assumptions: {
        returns: { expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
    })
    const { result } = renderHook(() => useDashboardCharts())
    const data = result.current.accumulationData
    // During accumulation (before retirement), values should grow
    const age30 = data.find((d) => d.age === 30)!
    const age40 = data.find((d) => d.age === 40)!
    expect(age40.value).toBeGreaterThan(age30.value)
  })
})
