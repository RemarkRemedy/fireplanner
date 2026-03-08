import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useProjection } from './useProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
  usePropertyStore.getState().reset()
})

describe('useProjection', () => {
  it('produces non-null result with valid defaults', () => {
    const { result } = renderHook(() => useProjection())
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.rows).not.toBeNull()
    expect(result.current.summary).not.toBeNull()
    expect(result.current.params).not.toBeNull()
  })

  it('returns null when income has validation errors', () => {
    useIncomeStore.getState().setField('annualSalary', -1)
    const { result } = renderHook(() => useProjection())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.rows).toBeNull()
    expect(result.current.params).toBeNull()
  })

  it('returns null when profile has validation errors', () => {
    useProfileStore.getState().setField('currentAge', 15)
    const { result } = renderHook(() => useProjection())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.rows).toBeNull()
  })

  it('params reflect profile store fields correctly', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 35,
      retirementAge: 60,
      lifeExpectancy: 85,
      liquidNetWorth: 500000,
      swr: 0.035,
      inflation: 0.03,
      expenseRatio: 0.005,
      annualExpenses: 60000,
      retirementSpendingAdjustment: 0.8,
      usePortfolioReturn: false,
      expectedReturn: 0.06,
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.currentAge).toBe(35)
    expect(p.retirementAge).toBe(60)
    expect(p.lifeExpectancy).toBe(85)
    expect(p.initialLiquidNW).toBe(500000)
    expect(p.swr).toBe(0.035)
    expect(p.inflation).toBe(0.03)
    expect(p.expenseRatio).toBe(0.005)
    expect(p.annualExpenses).toBe(60000)
    expect(p.retirementSpendingAdjustment).toBe(0.8)
  })

  it('uses portfolio return when usePortfolioReturn is true and allocation valid', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      usePortfolioReturn: true,
      expectedReturn: 0.10,
      validationErrors: {},
    })
    useAllocationStore.setState({
      ...useAllocationStore.getState(),
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.usePortfolioReturn).toBe(true)
    // Portfolio return from balanced allocation weights != 0.10 manual
    expect(p.expectedReturn).not.toBe(0.10)
  })

  it('falls back to manual return when allocation has errors', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      usePortfolioReturn: true,
      expectedReturn: 0.10,
      validationErrors: {},
    })
    useAllocationStore.setState({
      ...useAllocationStore.getState(),
      validationErrors: { weights: 'Must sum to 1.0' },
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.usePortfolioReturn).toBe(false)
    expect(p.expectedReturn).toBe(0.10)
  })

  it('applies return overrides to asset returns', () => {
    const overrides = Array(8).fill(null) as (number | null)[]
    overrides[0] = 0.15
    useAllocationStore.setState({
      ...useAllocationStore.getState(),
      returnOverrides: overrides,
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.assetReturns[0]).toBe(0.15)
    expect(p.assetReturns[1]).not.toBe(0.15)
  })

  it('property fields are zero when ownsProperty is false', () => {
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: false,
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.propertyEquity).toBe(0)
    expect(p.annualMortgagePayment).toBe(0)
    expect(p.annualRentalIncome).toBe(0)
    expect(p.existingPropertyValue).toBe(0)
  })

  it('property equity computed correctly with ownership percent', () => {
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1000000,
      existingMortgageBalance: 400000,
      ownershipPercent: 0.5,
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    // equity = max(0, 1000000 - 400000) * 0.5 = 300000
    expect(p.propertyEquity).toBe(300000)
    // existingPropertyValue = 1000000 * 0.5 = 500000
    expect(p.existingPropertyValue).toBe(500000)
  })

  it('mortgage payment excludes CPF portion', () => {
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 1000,
      ownershipPercent: 1,
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    // Cash portion = (3000 - 1000) * 12 * 1 = 24000
    expect(p.annualMortgagePayment).toBe(24000)
  })

  it('HDB subletting produces rental income', () => {
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      propertyType: 'hdb',
      hdbMonetizationStrategy: 'sublet',
      hdbSublettingRooms: 2,
      hdbSublettingRate: 800,
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    // 2 rooms * 800/month * 12 = 19200
    expect(p.annualRentalIncome).toBe(19200)
  })

  it('LBS proceeds add to initialLiquidNW', () => {
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      propertyType: 'hdb',
      hdbMonetizationStrategy: 'lbs',
      existingPropertyValue: 500000,
      existingLeaseYears: 60,
      hdbLbsRetainedLease: 30,
    })
    useProfileStore.setState({
      ...useProfileStore.getState(),
      liquidNetWorth: 100000,
      // Set cpfRA high enough that the RA shortfall is smaller than total LBS
      // proceeds, so some proceeds remain as cash. With FRS projected to ~$486K
      // at age 30, setting cpfRA to $450K leaves only ~$36K shortfall, well
      // below the ~$123K LBS proceeds.
      cpfRA: 450000,
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    // LBS proceeds should be added to base liquidNetWorth of 100000
    expect(p.initialLiquidNW).toBeGreaterThan(100000)
  })

  it('downsizing included when scenario is not none', () => {
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      downsizing: {
        scenario: 'sell-and-downsize',
        sellAge: 65,
        expectedSalePrice: 1500000,
        newPropertyCost: 800000,
        newMortgageRate: 0.035,
        newMortgageTerm: 20,
        newLtv: 0.75,
        monthlyRent: 2500,
        rentGrowthRate: 0.03,
      },
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.downsizing).not.toBeNull()
    expect(p.downsizing!.scenario).toBe('sell-and-downsize')
  })

  it('downsizing is null when scenario is none', () => {
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      downsizing: {
        scenario: 'none',
        sellAge: 65,
        expectedSalePrice: 1500000,
        newPropertyCost: 800000,
        newMortgageRate: 0.035,
        newMortgageTerm: 20,
        newLtv: 0.75,
        monthlyRent: 2500,
        rentGrowthRate: 0.03,
      },
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.downsizing).toBeNull()
  })

  it('healthcare config passed when enabled', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      healthcareConfig: {
        enabled: true,
        mediShieldLifeEnabled: true,
        ispTier: 'none',
        careShieldLifeEnabled: true,
        oopBaseAmount: 1200,
        oopModel: 'age-curve' as const,
        oopInflationRate: 0.03,
        oopReferenceAge: 30,
        oopCurveVariant: 'study-backed' as const,
        mediSaveTopUpAnnual: 0,
      },
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.healthcareConfig).not.toBeNull()
    expect(p.healthcareConfig!.enabled).toBe(true)
  })

  it('healthcare config is null when disabled', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      healthcareConfig: {
        ...useProfileStore.getState().healthcareConfig,
        enabled: false,
      },
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.healthcareConfig).toBeNull()
  })

  it('financial goals and retirement withdrawals passed through', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      financialGoals: [
        {
          id: 'g1',
          label: 'House',
          targetAge: 35,
          amount: 300000,
          durationYears: 1,
          priority: 'essential',
          inflationAdjusted: true,
          category: 'housing',
        },
      ],
      retirementWithdrawals: [
        {
          id: 'w1',
          label: 'Reno',
          amount: 50000,
          age: 65,
          durationYears: 1,
          inflationAdjusted: false,
        },
      ],
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.financialGoals).toHaveLength(1)
    expect(p.financialGoals![0].label).toBe('House')
    expect(p.retirementWithdrawals).toHaveLength(1)
    expect(p.retirementWithdrawals![0].label).toBe('Reno')
  })

  it('expense adjustments passed through', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      expenseAdjustments: [
        { id: 'ea1', label: 'Kids school', amount: 20000, startAge: 35, endAge: 50 },
      ],
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.expenseAdjustments).toHaveLength(1)
    expect(p.expenseAdjustments![0].label).toBe('Kids school')
  })

  it('withdrawal strategy from simulation store', () => {
    useSimulationStore.setState({
      ...useSimulationStore.getState(),
      selectedStrategy: 'vpw',
    })
    const { result } = renderHook(() => useProjection())
    const p = result.current.params!
    expect(p.withdrawalStrategy).toBe('vpw')
  })

  it('generates correct number of rows (lifeExpectancy - currentAge)', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 90,
      validationErrors: {},
    })
    const { result } = renderHook(() => useProjection())
    // Rows include age 30 through 90 inclusive = lifeExpectancy - currentAge + 1
    expect(result.current.rows).toHaveLength(61)
    expect(result.current.rows![0].age).toBe(30)
    expect(result.current.rows![60].age).toBe(90)
  })
})
