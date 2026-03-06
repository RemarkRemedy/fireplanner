import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAdjustedFireNumber } from './useAdjustedFireNumber'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useSimulationStore } from '@/stores/useSimulationStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  usePropertyStore.getState().reset()
  useSimulationStore.getState().reset()
})

describe('useAdjustedFireNumber', () => {
  it('returns simpleFireNumber with valid defaults', () => {
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.simpleFireNumber).not.toBeNull()
    expect(result.current.simpleFireNumber).toBeGreaterThan(0)
  })

  it('returns null projectionFireNumber when profile has errors', () => {
    useProfileStore.getState().setField('currentAge', 15)
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.simpleFireNumber).toBeNull()
    expect(result.current.projectionFireNumber).toBeNull()
    expect(result.current.showProjectionNumber).toBe(false)
  })

  it('returns null projectionFireNumber when no retired rows exist', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 90,
      lifeExpectancy: 90,
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.simpleFireNumber).not.toBeNull()
    expect(result.current.projectionFireNumber).toBeNull()
    expect(result.current.showProjectionNumber).toBe(false)
  })

  it('computes projectionFireNumber when retired rows exist', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 90,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      swr: 0.04,
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.projectionFireNumber).not.toBeNull()
    expect(result.current.projectionFireNumber).toBeGreaterThan(0)
    expect(result.current.deviationPct).not.toBeNull()
  })

  it('showProjectionNumber is false when deviation < 5%', () => {
    // Use today-dollar basis and no CPF LIFE (cpfLifeStartAge beyond lifeExpectancy)
    // to ensure the projection's inflation normalization round-trips cleanly,
    // producing near-zero deviation when there are no special cash flows.
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 65,
      lifeExpectancy: 90,
      annualExpenses: 48000,
      liquidNetWorth: 0,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      cpfRA: 0,
      cpfLifeStartAge: 100, // beyond lifeExpectancy — no CPF LIFE payout in projection
      swr: 0.04,
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.deviationPct).not.toBeNull()
    expect(Math.abs(result.current.deviationPct!)).toBeLessThan(0.05)
    expect(result.current.showProjectionNumber).toBe(false)
  })

  it('detects mortgage cash payments as deviation factor', () => {
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 0,
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
      validationErrors: {},
    })
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 90,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      cpfRA: 0,
      cpfLifeStartAge: 100,
      swr: 0.04,
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // $3K/mo all-cash mortgage creates significant deviation from simple FIRE number
    expect(result.current.deviationFactors).toContain('mortgage cash payments')
  })

  it('deviationFactors is empty array when no special cash flows', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 90,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      swr: 0.04,
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.deviationFactors).toEqual([])
  })

  it('both fire numbers are in the same dollar basis', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 45,
      retirementAge: 55,
      lifeExpectancy: 90,
      annualExpenses: 80000,
      liquidNetWorth: 1500000,
      swr: 0.04,
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const simple = result.current.simpleFireNumber!
    const proj = result.current.projectionFireNumber!
    expect(result.current.deviationPct).not.toBeNull()
    // If normalization works, deviation should be much less than the raw
    // inflation gap (10 years at 2.5% = ~28%). Tight bound confirms same basis.
    expect(Math.abs(result.current.deviationPct!)).toBeLessThan(0.10)
    expect(simple).toBeGreaterThan(0)
    expect(proj).toBeGreaterThan(0)
  })
})

describe('waterfall items', () => {
  /** Reusable baseline: near-retirement, minimal config, produces retired rows */
  function setupBaseline() {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 55,
      retirementAge: 58,
      lifeExpectancy: 90,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      swr: 0.04,
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      cpfRA: 0,
      cpfLifeStartAge: 100,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
  }

  it('waterfallItems always contains at least Expenses', () => {
    setupBaseline()
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.waterfallItems.length).toBeGreaterThanOrEqual(1)
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
    expect(result.current.waterfallItems[0].type).toBe('add')
    expect(result.current.waterfallItems[0].amount).toBeGreaterThan(0)
  })

  it('healthcare item appears when enabled', () => {
    setupBaseline()
    useProfileStore.setState({
      ...useProfileStore.getState(),
      healthcareConfig: {
        ...useProfileStore.getState().healthcareConfig,
        enabled: true,
      },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const healthcareItem = result.current.waterfallItems.find((i) => i.label === 'Healthcare')
    expect(healthcareItem).toBeDefined()
    expect(healthcareItem!.type).toBe('add')
    expect(healthcareItem!.amount).toBeGreaterThan(0)
  })

  it('parent support item appears when enabled', () => {
    setupBaseline()
    useProfileStore.setState({
      ...useProfileStore.getState(),
      parentSupportEnabled: true,
      parentSupport: [{ id: 'p1', label: 'Parent 1', monthlyAmount: 500, startAge: 55, endAge: 80, growthRate: 0.02 }],
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const parentItem = result.current.waterfallItems.find((i) => i.label === 'Parent support')
    expect(parentItem).toBeDefined()
    expect(parentItem!.type).toBe('add')
    expect(parentItem!.amount).toBeGreaterThan(0)
  })

  it('zero-value items are excluded', () => {
    setupBaseline()
    const { result } = renderHook(() => useAdjustedFireNumber())
    // With no healthcare, parent support, mortgage, CPF LIFE, or rental income,
    // only Expenses should be present
    expect(result.current.waterfallItems).toHaveLength(1)
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
  })

  it('mortgage item appears when property has mortgage', () => {
    setupBaseline()
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 0,
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const mortgageItem = result.current.waterfallItems.find((i) => i.label === 'Mortgage (cash)')
    expect(mortgageItem).toBeDefined()
    expect(mortgageItem!.type).toBe('add')
    expect(mortgageItem!.amount).toBeGreaterThan(0)
  })

  it('cpfOaMortgageCoverPct is correct when property exists with CPF portion', () => {
    setupBaseline()
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 2640, // 88% covered by CPF
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.cpfOaMortgageCoverPct).not.toBeNull()
    expect(result.current.cpfOaMortgageCoverPct).toBeCloseTo(0.88, 1)
  })

  it('cpfOaMortgageCoverPct is null when no property', () => {
    setupBaseline()
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.cpfOaMortgageCoverPct).toBeNull()
  })

  it('cpfOaMortgageCoverPct is null when existingMonthlyPayment is 0 (NaN guard)', () => {
    setupBaseline()
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 0,
      existingMonthlyPayment: 0,
      mortgageCpfMonthly: 0,
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 0,
      ownershipPercent: 1,
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.cpfOaMortgageCoverPct).toBeNull()
  })

  it('netAnnualNeed equals sum of add minus subtract items', () => {
    setupBaseline()
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 0,
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const expectedNet = result.current.waterfallItems.reduce(
      (sum, item) => sum + (item.type === 'add' ? item.amount : -item.amount),
      0,
    )
    expect(result.current.netAnnualNeed).toBeCloseTo(expectedNet, 2)
  })

  it('Lean FIRE uses plain "Expenses" label in projection path (projection does not apply FIRE multiplier)', () => {
    setupBaseline()
    useProfileStore.setState({
      ...useProfileStore.getState(),
      fireType: 'lean',
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // Projection path: label is "Expenses" because projection.ts doesn't apply FIRE_TYPE_MULTIPLIERS
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
  })

  it('Fat FIRE uses plain "Expenses" label in projection path', () => {
    setupBaseline()
    useProfileStore.setState({
      ...useProfileStore.getState(),
      fireType: 'fat',
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
  })

  it('Lean FIRE fallback path uses "Expenses (60%)" label', () => {
    // retirementAge === lifeExpectancy means no retired rows → fallback path
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 90,
      lifeExpectancy: 90,
      annualExpenses: 60000,
      liquidNetWorth: 0,
      swr: 0.04,
      fireNumberBasis: 'today',
      fireType: 'lean',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.waterfallItems[0].label).toBe('Expenses (60%)')
  })

  it('Fat FIRE fallback path uses "Expenses (150%)" label', () => {
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 90,
      lifeExpectancy: 90,
      annualExpenses: 60000,
      liquidNetWorth: 0,
      swr: 0.04,
      fireNumberBasis: 'today',
      fireType: 'fat',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.waterfallItems[0].label).toBe('Expenses (150%)')
  })

  it('CPF LIFE appears as subtract item when cpfLifeStartAge is within range', () => {
    // Use currentAge: 56 (past 55) so performAge55Transfer doesn't overwrite cpfRA.
    // Set cpfLifeStartAge: 56 so the annuity is captured at the projection start.
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 56,
      retirementAge: 58,
      lifeExpectancy: 90,
      annualExpenses: 80000,
      liquidNetWorth: 2000000,
      swr: 0.04,
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      cpfOA: 0,
      cpfSA: 0,
      cpfMA: 0,
      cpfRA: 100000,
      cpfLifeStartAge: 56,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const cpfItem = result.current.waterfallItems.find((i) => i.label === 'CPF LIFE')
    expect(cpfItem).toBeDefined()
    expect(cpfItem!.type).toBe('subtract')
    expect(cpfItem!.amount).toBeGreaterThan(0)
  })

  it('cpfOaMortgageCoverPct is clamped at 1.0 when CPF exceeds payment', () => {
    setupBaseline()
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 5000, // CPF > monthly payment
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.cpfOaMortgageCoverPct).not.toBeNull()
    expect(result.current.cpfOaMortgageCoverPct).toBe(1)
  })

  it('netAnnualNeed / swr approximates projectionFireNumber for simple case', () => {
    // With no special cash flows (no mortgage, CPF LIFE, rental), the projection-
    // derived FIRE number should closely match netAnnualNeed / swr. This is the
    // core invariant: the waterfall correctly decomposes the projection number.
    setupBaseline()
    const { result } = renderHook(() => useAdjustedFireNumber())
    const { netAnnualNeed, projectionFireNumber } = result.current
    expect(netAnnualNeed).not.toBeNull()
    expect(projectionFireNumber).not.toBeNull()
    const swr = useProfileStore.getState().swr
    const impliedNumber = netAnnualNeed! / swr
    // Allow 5% tolerance for rounding in normalization
    expect(Math.abs(impliedNumber - projectionFireNumber!) / projectionFireNumber!).toBeLessThan(0.05)
  })

  it('fallback path produces waterfall items when no retired rows', () => {
    // retirementAge === lifeExpectancy means no retired rows in projection
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 90,
      lifeExpectancy: 90,
      annualExpenses: 60000,
      liquidNetWorth: 0,
      swr: 0.04,
      fireNumberBasis: 'today',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // Should still have waterfall items from the formula-side fallback
    expect(result.current.waterfallItems.length).toBeGreaterThanOrEqual(1)
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
    expect(result.current.netAnnualNeed).not.toBeNull()
    // projectionFireNumber should be null (no retired rows)
    expect(result.current.projectionFireNumber).toBeNull()
  })

  it('fallback waterfall items match fireNumber on retirement basis', () => {
    // Bug 1 regression test: on non-today basis, fallback items must be inflation-
    // adjusted to match the FIRE number's dollar basis.
    useProfileStore.setState({
      ...useProfileStore.getState(),
      currentAge: 30,
      retirementAge: 90,
      lifeExpectancy: 90,
      annualExpenses: 60000,
      liquidNetWorth: 0,
      swr: 0.04,
      fireNumberBasis: 'retirement',
      usePortfolioReturn: false,
      expectedReturn: 0.07,
      inflation: 0.025,
      expenseRatio: 0.003,
      parentSupportEnabled: false,
      parentSupport: [],
      healthcareConfig: { ...useProfileStore.getState().healthcareConfig, enabled: false },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const { waterfallItems, netAnnualNeed, simpleFireNumber } = result.current
    expect(waterfallItems.length).toBeGreaterThanOrEqual(1)
    expect(netAnnualNeed).not.toBeNull()
    expect(simpleFireNumber).not.toBeNull()
    // netAnnualNeed / swr should equal simpleFireNumber (both in retirement basis)
    const swr = useProfileStore.getState().swr
    expect(netAnnualNeed! / swr).toBeCloseTo(simpleFireNumber!, -2)
  })

  it('cpfOaMortgageCoverPct is 1.0 when CPF equals monthly payment', () => {
    // When CPF covers 100% of the monthly payment, cpfOaMortgageCoverPct should be 1.0.
    // Note: the projection engine may still show a mortgageCashPayment > 0 because it
    // computes the CPF/cash split independently from the store-level ratio.
    setupBaseline()
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 3000, // 100% covered by CPF
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // Coverage should be exactly 1.0 (not > 1.0)
    expect(result.current.cpfOaMortgageCoverPct).toBe(1)
  })

  it('downsizing rent item appears when downsizing is configured', () => {
    setupBaseline()
    usePropertyStore.setState({
      ...usePropertyStore.getState(),
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 0,
      existingMonthlyPayment: 0,
      mortgageCpfMonthly: 0,
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 0,
      ownershipPercent: 1,
      downsizing: {
        scenario: 'sell-and-rent',
        sellAge: 57,
        expectedSalePrice: 1500000,
        newPropertyCost: 0,
        newMortgageRate: 0.035,
        newMortgageTerm: 20,
        newLtv: 0.75,
        monthlyRent: 2500,
        rentGrowthRate: 0.03,
      },
      validationErrors: {},
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const rentItem = result.current.waterfallItems.find((i) => i.label === 'Rent (downsized)')
    expect(rentItem).toBeDefined()
    expect(rentItem!.type).toBe('add')
    expect(rentItem!.amount).toBeGreaterThan(0)
  })
})
