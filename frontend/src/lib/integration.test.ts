/**
 * Integration test journeys — end-to-end flows across stores, hooks, and calculations.
 * These verify that the full pipeline works correctly for representative user scenarios.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { useUIStore } from '@/stores/useUIStore'
import { useFireCalculations } from '@/hooks/useFireCalculations'
import { useIncomeProjection } from '@/hooks/useIncomeProjection'
import { usePortfolioStats } from '@/hooks/usePortfolioStats'
import { useCpfProjection } from '@/hooks/useCpfProjection'
import { saveScenario, loadScenario, listScenarios, deleteScenario } from '@/lib/scenarios'
import { encodeStoresForUrl, decodeStoresFromUrl, applyStoreData } from '@/lib/shareUrl'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  usePropertyStore.getState().reset()
  useHouseholdStore.getState().reset()
  useUIStore.setState({
    sectionOrder: 'goal-first',
    cpfEnabled: true,
    propertyEnabled: false,
    healthcareEnabled: false,
    mode: 'simple',
    statsPosition: 'bottom',
  })
  localStorage.removeItem('fireplanner-scenarios')
})

describe('Journey: Fresh Graduate (age 25, $48K income, $30K expenses)', () => {
  beforeEach(() => {
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
      lifeStage: 'pre-fire',
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    useIncomeStore.setState({
      ...useIncomeStore.getState(),
      annualSalary: 48000,
      salaryModel: 'simple',
      salaryGrowthRate: 0.03,
      validationErrors: {},
    })
    useAllocationStore.getState().applyTemplate('aggressive')
  })

  it('FIRE number = $857,143', () => {
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics!.fireNumber).toBeCloseTo(857143, -1)
  })

  it('progress = 5.8%', () => {
    const { result } = renderHook(() => useFireCalculations())
    // 50000 / 857143 = 5.83%
    expect(result.current.metrics!.progress).toBeCloseTo(0.058, 2)
  })

  it('years to FIRE is positive and finite', () => {
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics!.yearsToFire).toBeGreaterThan(0)
    expect(result.current.metrics!.yearsToFire).toBeLessThan(40)
  })

  it('income projection spans 65 years (25-90)', () => {
    const { result } = renderHook(() => useIncomeProjection())
    const projection = result.current.projection!
    expect(projection[0].age).toBe(25)
    expect(projection[projection.length - 1].age).toBe(90)
    expect(projection.length).toBe(66)
  })

  it('CPF contributions appear in working years', () => {
    const { result } = renderHook(() => useIncomeProjection())
    const { projection, isHousehold } = result.current
    expect(projection).not.toBeNull()
    expect(isHousehold).toBe(false)
    const singleProjection = projection as import('@/lib/types').IncomeProjectionRow[]
    const first = singleProjection[0]
    expect(first.cpfEmployee).toBeGreaterThan(0)
    expect(first.cpfEmployer).toBeGreaterThan(0)
  })

  it('portfolio stats reflect aggressive allocation', () => {
    const { result } = renderHook(() => usePortfolioStats())
    expect(result.current.currentStats).not.toBeNull()
    // Aggressive allocation should have higher return
    expect(result.current.currentStats!.expectedReturn).toBeGreaterThan(0.06)
  })

  it('all hooks return no errors', () => {
    const { result: fire } = renderHook(() => useFireCalculations())
    const { result: income } = renderHook(() => useIncomeProjection())
    const { result: portfolio } = renderHook(() => usePortfolioStats())
    expect(fire.current.hasErrors).toBe(false)
    expect(income.current.hasErrors).toBe(false)
    expect(portfolio.current.hasErrors).toBe(false)
  })
})

describe('Journey: Mid-Career Professional (age 35, $180K, CPF + property)', () => {
  beforeEach(() => {
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
      lifeStage: 'pre-fire',
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    useIncomeStore.setState({
      ...useIncomeStore.getState(),
      annualSalary: 180000,
      salaryModel: 'simple',
      salaryGrowthRate: 0.03,
      validationErrors: {},
    })
    useAllocationStore.getState().applyTemplate('balanced')
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
    })
  })

  it('FIRE number = $2,400,000', () => {
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics!.fireNumber).toBe(2400000)
  })

  it('progress includes CPF', () => {
    const { result } = renderHook(() => useFireCalculations())
    // NW = $800K liquid + $300K CPF = $1.1M
    // Progress = 1.1M / 2.4M ≈ 45.8%
    expect(result.current.metrics!.progress).toBeCloseTo(0.458, 1)
  })

  it('CPF projection shows growing balances', () => {
    const { result } = renderHook(() => useCpfProjection())
    expect(result.current.rows).not.toBeNull()
    const rows = result.current.rows!
    // Balances should grow over time
    const firstBalance = rows[0].totalBalance
    const tenthBalance = rows[10]?.totalBalance ?? 0
    expect(tenthBalance).toBeGreaterThan(firstBalance)
  })

  it('property equity is included in totalNWIncProperty', () => {
    const { result } = renderHook(() => useFireCalculations())
    const metrics = result.current.metrics!
    // totalNWIncProperty = liquid + CPF + property equity
    // = 800K + 300K + 700K = 1.8M
    expect(metrics.totalNWIncProperty).toBeCloseTo(1800000, -3)
    // Regular progress only uses liquid + CPF (no property)
    expect(metrics.progress).toBeCloseTo(0.458, 1)
  })

  it('income projection first year has correct salary', () => {
    const { result } = renderHook(() => useIncomeProjection())
    const { projection, isHousehold } = result.current
    expect(projection).not.toBeNull()
    expect(isHousehold).toBe(false)
    const singleProjection = projection as import('@/lib/types').IncomeProjectionRow[]
    const firstRow = singleProjection[0]
    expect(firstRow.salary).toBeGreaterThanOrEqual(180000)
  })
})

describe('Journey: Pre-Retiree (age 55, $2M, already FIRE)', () => {
  beforeEach(() => {
    useProfileStore.setState({
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
      retirementSpendingAdjustment: 1.0,
      usePortfolioReturn: false,
      expectedReturn: 0.05,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      lifeStage: 'post-fire',
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    useAllocationStore.getState().applyTemplate('conservative')
  })

  it('FIRE number = $2,000,000 — already reached', () => {
    const { result } = renderHook(() => useFireCalculations())
    expect(result.current.metrics!.fireNumber).toBe(2000000)
    expect(result.current.metrics!.progress).toBeGreaterThanOrEqual(1.0)
    expect(result.current.metrics!.yearsToFire).toBe(0)
  })

  it('conservative portfolio has lower return than balanced', () => {
    // Capture conservative return (template already set in beforeEach)
    const { result: conservativeResult, unmount } = renderHook(() => usePortfolioStats())
    const conservativeReturn = conservativeResult.current.currentStats!.expectedReturn
    unmount()

    // Switch to balanced and render a fresh hook
    useAllocationStore.getState().applyTemplate('balanced')
    const { result: balancedResult } = renderHook(() => usePortfolioStats())
    const balancedReturn = balancedResult.current.currentStats!.expectedReturn

    expect(conservativeReturn).toBeLessThan(balancedReturn)
  })

  it('projection spans remaining life (55-90)', () => {
    const { result } = renderHook(() => useIncomeProjection())
    const projection = result.current.projection!
    expect(projection[0].age).toBe(55)
    expect(projection[projection.length - 1].age).toBe(90)
  })
})

describe('Journey: Scenario Comparison', () => {
  beforeEach(() => {
    // Set up some profile data in localStorage so scenarios have data to capture
    localStorage.setItem('fireplanner-profile', JSON.stringify({
      state: { currentAge: 30, liquidNetWorth: 100000 },
      version: 7,
    }))
  })

  it('save → list → load → delete round-trip', () => {
    // Save 3 scenarios
    const id1 = saveScenario('Aggressive')
    const id2 = saveScenario('Balanced')
    saveScenario('Conservative')

    // List should show 3
    let list = listScenarios()
    expect(list.length).toBe(3)
    expect(list.map((s) => s.name)).toEqual(['Aggressive', 'Balanced', 'Conservative'])

    // Load scenario 2
    const loaded = loadScenario(id2, () => {})
    expect(loaded).toBe(true)

    // Delete scenario 1
    const deleted = deleteScenario(id1)
    expect(deleted).toBe(true)

    // List should now have 2
    list = listScenarios()
    expect(list.length).toBe(2)
    expect(list.map((s) => s.name)).toEqual(['Balanced', 'Conservative'])
  })

  it('max 5 scenarios enforced', () => {
    for (let i = 0; i < 5; i++) {
      saveScenario(`Scenario ${i}`)
    }
    expect(listScenarios().length).toBe(5)
    expect(() => saveScenario('Overflow')).toThrow(/Maximum 5/)
  })

  it('loading non-existent scenario returns false', () => {
    expect(loadScenario('nonexistent', () => {})).toBe(false)
  })

  it('deleting non-existent scenario returns false', () => {
    expect(deleteScenario('nonexistent')).toBe(false)
  })
})

describe('Journey: Share Plan via URL', () => {
  beforeEach(() => {
    localStorage.setItem('fireplanner-profile', JSON.stringify({
      state: { currentAge: 35, annualExpenses: 60000 },
      version: 7,
    }))
    localStorage.setItem('fireplanner-income', JSON.stringify({
      state: { annualSalary: 120000 },
      version: 4,
    }))
  })

  it('encode → decode round-trip preserves data', () => {
    const encoded = encodeStoresForUrl()
    expect(encoded.length).toBeGreaterThan(0)

    const decoded = decodeStoresFromUrl(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!['fireplanner-profile']).toBeDefined()
    expect(decoded!['fireplanner-income']).toBeDefined()
  })

  it('decode invalid string returns null', () => {
    expect(decodeStoresFromUrl('')).toBeNull()
    expect(decodeStoresFromUrl('not-valid-data-12345')).toBeNull()
  })

  it('applyStoreData writes to localStorage', () => {
    const stores = {
      'fireplanner-profile': { state: { currentAge: 45 }, version: 7 },
    }
    applyStoreData(stores)
    const stored = JSON.parse(localStorage.getItem('fireplanner-profile')!)
    expect(stored.state.currentAge).toBe(45)
  })

  it('ignores non-store keys in data', () => {
    const stores = {
      'fireplanner-profile': { state: { currentAge: 45 }, version: 7 },
      'random-key': { foo: 'bar' },
    }
    applyStoreData(stores)
    expect(localStorage.getItem('random-key')).toBeNull()
  })
})

describe('Journey: Cross-store validation propagation', () => {
  it('invalid profile blocks all downstream hooks', () => {
    useProfileStore.getState().setField('currentAge', 15) // Invalid

    const { result: fire } = renderHook(() => useFireCalculations())
    const { result: income } = renderHook(() => useIncomeProjection())
    const { result: portfolio } = renderHook(() => usePortfolioStats())
    const { result: cpf } = renderHook(() => useCpfProjection())

    expect(fire.current.hasErrors).toBe(true)
    expect(fire.current.metrics).toBeNull()
    expect(income.current.hasErrors).toBe(true)
    expect(income.current.projection).toBeNull()
    expect(portfolio.current.hasErrors).toBe(true)
    expect(portfolio.current.currentStats).toBeNull()
    expect(cpf.current.hasErrors).toBe(true)
    expect(cpf.current.rows).toBeNull()
  })

  it('income validation errors block FIRE calculations', () => {
    useIncomeStore.getState().setField('annualSalary', -1) // Invalid
    const { result } = renderHook(() => useFireCalculations())
    // Income validation errors should propagate
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.metrics).toBeNull()
  })

  it('allocation errors do not block FIRE calculations (fallback to manual return)', () => {
    // Force allocation error by setting invalid weights
    useAllocationStore.setState({
      ...useAllocationStore.getState(),
      validationErrors: { weights: 'Must sum to 100%' },
    })
    useProfileStore.getState().setField('usePortfolioReturn', true)
    const { result } = renderHook(() => useFireCalculations())
    // Falls back to profile.expectedReturn
    expect(result.current.metrics).not.toBeNull()
  })
})
