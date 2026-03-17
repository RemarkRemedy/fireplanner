import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardCharts } from './useDashboardCharts'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useUIStore } from '@/stores/useUIStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
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
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      liquidNetWorth: 100000,
      annualExpenses: 48000,
      annualIncome: 72000,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      validationErrors: {},
    })
    const { result } = renderHook(() => useDashboardCharts())
    expect(result.current.accumulationData.length).toBe(61) // 30 to 90 inclusive
    expect(result.current.accumulationData[0].age).toBe(30)
    expect(result.current.accumulationData[60].age).toBe(90)
  })

  it('returns fire number line matching FIRE number', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualIncome: 72000,
      annualExpenses: 48000,
      swr: 0.04,
      fireNumberBasis: 'today',
      fireType: 'regular',
      validationErrors: {},
    })
    const { result } = renderHook(() => useDashboardCharts())
    // FIRE number = annualExpenses / swr = 48000 / 0.04 = 1,200,000
    expect(result.current.fireNumberLine).toBe(1200000)
  })

  it('returns empty data when profile has validation errors', () => {
    useProfileStore.getState().setField('currentAge', 15) // invalid
    const { result } = renderHook(() => useDashboardCharts())
    expect(result.current.accumulationData).toEqual([])
    expect(result.current.fireNumberLine).toBeNull()
  })

  it('accumulation data starts with current NW including CPF', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      liquidNetWorth: 100000,
      cpfOA: 50000,
      cpfSA: 30000,
      cpfMA: 20000,
      validationErrors: {},
    })
    const { result } = renderHook(() => useDashboardCharts())
    // First data point should be liquidNW + cpfOA + cpfSA + cpfMA + cpfRA = 200000
    expect(result.current.accumulationData[0].value).toBe(200000)
  })

  it('accumulation data includes cpfRA in starting NW', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 56,
      retirementAge: 58,
      lifeExpectancy: 90,
      liquidNetWorth: 100000,
      cpfOA: 50000,
      cpfSA: 0,
      cpfMA: 20000,
      cpfRA: 200000,
      validationErrors: {},
    })
    const { result } = renderHook(() => useDashboardCharts())
    // First data point: 100K + 50K + 0 + 20K + 200K = 370K
    expect(result.current.accumulationData[0].value).toBe(370000)
  })

  it('values grow during accumulation phase', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 55,
      lifeExpectancy: 90,
      liquidNetWorth: 100000,
      annualIncome: 72000,
      annualExpenses: 48000,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      validationErrors: {},
    })
    const { result } = renderHook(() => useDashboardCharts())
    const data = result.current.accumulationData
    // During accumulation (before retirement), values should grow
    const age30 = data.find((d) => d.age === 30)!
    const age40 = data.find((d) => d.age === 40)!
    expect(age40.value).toBeGreaterThan(age30.value)
  })
})
