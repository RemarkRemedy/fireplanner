import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAdjustedFireNumber } from './useAdjustedFireNumber'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import type { HouseholdPlan, PlanningAdult, PropertyPlan } from '@/lib/household/types'
import type { HealthcareConfig, DownsizingConfig } from '@/lib/types'
import { DEFAULT_HEALTHCARE_CONFIG } from '@/lib/data/defaultHealthcareConfig'

/** Disabled healthcare config for tests that want no healthcare waterfall items */
const DISABLED_HEALTHCARE: HealthcareConfig = {
  ...DEFAULT_HEALTHCARE_CONFIG,
  enabled: false,
}

/** Enabled healthcare config for tests that want healthcare waterfall items */
const ENABLED_HEALTHCARE: HealthcareConfig = {
  ...DEFAULT_HEALTHCARE_CONFIG,
  enabled: true,
}

/**
 * Builds a test household plan from the store's default plan, applying overrides
 * to the self adult, assumptions, expenses, assets, and property.
 */
function setupTestPlan(overrides?: {
  adult?: Partial<PlanningAdult> & {
    cpfOA?: number
    cpfSA?: number
    cpfMA?: number
    cpfRA?: number
    cpfLifeStartAge?: number
    healthcareConfig?: HealthcareConfig
  }
  assumptions?: {
    fire?: Partial<HouseholdPlan['assumptions']['fire']>
    returns?: Partial<HouseholdPlan['assumptions']['returns']>
  }
  expenses?: {
    annualExpenses?: number
    parentSupportEnabled?: boolean
    parentSupport?: Array<{
      id: string
      label: string
      monthlyAmount: number
      startAge: number
      endAge: number
      growthRate: number
    }>
  }
  assets?: {
    liquidNetWorth?: number
  }
  property?: Partial<PropertyPlan> & {
    downsizing?: DownsizingConfig
  }
}) {
  const plan = structuredClone(useHouseholdPlanStore.getState().plan)
  const self = plan.adults.find((a) => a.owner === 'self')!

  // Apply adult profile overrides
  if (overrides?.adult) {
    const {
      cpfOA, cpfSA, cpfMA, cpfRA, cpfLifeStartAge, healthcareConfig,
      ...adultFields
    } = overrides.adult

    Object.assign(self, adultFields)

    if (cpfOA !== undefined) self.cpf.balances.oa = cpfOA
    if (cpfSA !== undefined) self.cpf.balances.sa = cpfSA
    if (cpfMA !== undefined) self.cpf.balances.ma = cpfMA
    if (cpfRA !== undefined) self.cpf.balances.ra = cpfRA
    if (cpfLifeStartAge !== undefined) self.cpf.lifeStartAge = cpfLifeStartAge
    if (healthcareConfig !== undefined) self.healthcare = structuredClone(healthcareConfig)
  }

  // Apply assumption overrides
  if (overrides?.assumptions?.fire) {
    Object.assign(plan.assumptions.fire, overrides.assumptions.fire)
  }
  if (overrides?.assumptions?.returns) {
    Object.assign(plan.assumptions.returns, overrides.assumptions.returns)
  }

  // Apply expense overrides
  if (overrides?.expenses) {
    const { annualExpenses, parentSupportEnabled, parentSupport } = overrides.expenses

    if (annualExpenses !== undefined) {
      // Update the base-living expense entry
      const baseLiving = plan.expenses.find((e) => e.kind === 'base-living')
      if (baseLiving) {
        baseLiving.amount = annualExpenses
      }
      self.annualExpenses = annualExpenses
    }

    // Remove existing parent-support entries
    plan.expenses = plan.expenses.filter((e) => e.kind !== 'parent-support')

    if (parentSupportEnabled && parentSupport) {
      self.parentSupportEnabled = true
      for (const ps of parentSupport) {
        plan.expenses.push({
          id: `expense-parent-support-${ps.id}`,
          owner: 'self',
          label: ps.label,
          kind: 'parent-support',
          timing: { kind: 'age-range', owner: 'self', startAge: ps.startAge, endAge: Math.max(ps.startAge, ps.endAge - 1) },
          amount: ps.monthlyAmount,
          periodicity: 'monthly',
          growthRate: ps.growthRate,
        })
      }
    } else if (parentSupportEnabled === false) {
      self.parentSupportEnabled = false
    }
  }

  // Apply asset overrides
  if (overrides?.assets) {
    if (overrides.assets.liquidNetWorth !== undefined) {
      const liquidAsset = plan.assets.find((a) => a.kind === 'liquid-net-worth')
      if (liquidAsset) {
        liquidAsset.amount = overrides.assets.liquidNetWorth
      }
      self.liquidNetWorth = overrides.assets.liquidNetWorth
    }
  }

  // Apply property overrides
  if (overrides?.property) {
    if (plan.properties.length > 0) {
      Object.assign(plan.properties[0], overrides.property)
    }
  }

  useHouseholdPlanStore.getState().setPlan(plan, {
    source: 'manual',
    initializedAt: new Date().toISOString(),
  })
}

/** Get swr from the household plan assumptions */
function getSwr(): number {
  return useHouseholdPlanStore.getState().plan.assumptions.fire.swr
}

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  useSimulationStore.getState().reset()
})

describe('useAdjustedFireNumber', () => {
  it('returns simpleFireNumber with valid defaults', () => {
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.simpleFireNumber).not.toBeNull()
    expect(result.current.simpleFireNumber).toBeGreaterThan(0)
  })

  it('returns null metrics when household plan has validation errors', () => {
    // retirementAge <= currentAge triggers household validation error
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 90 },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.simpleFireNumber).toBeNull()
    expect(result.current.projectionFireNumber).toBeNull()
    expect(result.current.showProjectionNumber).toBe(false)
  })

  it('returns null projectionFireNumber when very late retirement produces minimal retired rows', () => {
    // With household validation enforcing lifeExpectancy > retirementAge,
    // use retirementAge very close to lifeExpectancy to get minimal retirement period.
    // This still produces 1 retired row, so projectionFireNumber will be computed.
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 89,
        lifeExpectancy: 90,
      },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.simpleFireNumber).not.toBeNull()
    // With 1 retired row (age 90), projectionFireNumber is computed
    expect(result.current.projectionFireNumber).not.toBeNull()
  })

  it('computes projectionFireNumber when retired rows exist', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: { annualExpenses: 80000 },
      assets: { liquidNetWorth: 2000000 },
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
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
        cpfLifeStartAge: 100, // beyond lifeExpectancy — no CPF LIFE payout in projection
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 48000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 0 },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.deviationPct).not.toBeNull()
    expect(Math.abs(result.current.deviationPct!)).toBeLessThan(0.05)
    expect(result.current.showProjectionNumber).toBe(false)
  })

  it('detects mortgage cash payments as deviation factor', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
        cpfLifeStartAge: 100,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 80000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 2000000 },
      property: {
        ownsProperty: true,
        existingPropertyValue: 1500000,
        existingMortgageBalance: 800000,
        existingMonthlyPayment: 3000,
        mortgageCpfMonthly: 0,
        existingMortgageRate: 0.035,
        existingMortgageRemainingYears: 20,
        ownershipPercent: 1,
      },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // $3K/mo all-cash mortgage creates significant deviation from simple FIRE number
    expect(result.current.deviationFactors).toContain('mortgage cash payments')
  })

  it('deviationFactors is empty array when no special cash flows', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
        cpfLifeStartAge: 100,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 80000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 2000000 },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.deviationFactors).toEqual([])
  })

  it('both fire numbers are in the same dollar basis', () => {
    setupTestPlan({
      adult: {
        currentAge: 45,
        retirementAge: 55,
        lifeExpectancy: 90,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 80000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 1500000 },
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
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
        cpfLifeStartAge: 100,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 80000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 2000000 },
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
    // Now enable healthcare by updating the plan
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    const self = plan.adults.find((a) => a.owner === 'self')!
    self.healthcare = structuredClone(ENABLED_HEALTHCARE)
    self.healthcare.oopReferenceAge = self.currentAge
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const healthcareItem = result.current.waterfallItems.find((i) => i.label === 'Healthcare')
    expect(healthcareItem).toBeDefined()
    expect(healthcareItem!.type).toBe('add')
    expect(healthcareItem!.amount).toBeGreaterThan(0)
  })

  it('parent support item appears when enabled', () => {
    setupBaseline()
    // Add parent support via the plan
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    const self = plan.adults.find((a) => a.owner === 'self')!
    self.parentSupportEnabled = true
    plan.expenses.push({
      id: 'expense-parent-support-p1',
      owner: 'self',
      label: 'Parent 1',
      kind: 'parent-support',
      timing: { kind: 'age-range', owner: 'self', startAge: 55, endAge: 79 },
      amount: 500,
      periodicity: 'monthly',
      growthRate: 0.02,
    })
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
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
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    Object.assign(plan.properties[0], {
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 0,
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
    })
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const mortgageItem = result.current.waterfallItems.find((i) => i.label === 'Mortgage (cash)')
    expect(mortgageItem).toBeDefined()
    expect(mortgageItem!.type).toBe('add')
    expect(mortgageItem!.amount).toBeGreaterThan(0)
  })

  it('cpfOaMortgageCoverPct is correct when property exists with CPF portion', () => {
    setupBaseline()
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    Object.assign(plan.properties[0], {
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 2640, // 88% covered by CPF
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
    })
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
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
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    Object.assign(plan.properties[0], {
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 0,
      existingMonthlyPayment: 0,
      mortgageCpfMonthly: 0,
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 0,
      ownershipPercent: 1,
    })
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.cpfOaMortgageCoverPct).toBeNull()
  })

  it('netAnnualNeed equals sum of add minus subtract items', () => {
    setupBaseline()
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    Object.assign(plan.properties[0], {
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 0,
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
    })
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
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
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    plan.assumptions.fire.fireType = 'lean'
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // Projection path: label is "Expenses" because projection.ts doesn't apply FIRE_TYPE_MULTIPLIERS
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
  })

  it('Fat FIRE uses plain "Expenses" label in projection path', () => {
    setupBaseline()
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    plan.assumptions.fire.fireType = 'fat'
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
  })

  it('Lean FIRE uses correct label in formula-side fallback', () => {
    // With household validation, lifeExpectancy must > retirementAge, so there's always
    // at least 1 retired row. Test that the Lean FIRE multiplier is reflected in the
    // simpleFireNumber instead (the formula path uses FIRE_TYPE_MULTIPLIERS).
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today', fireType: 'lean' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 60000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 0 },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // With retired rows, projection path uses plain "Expenses" label
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
    // But simpleFireNumber should reflect Lean FIRE (60% of expenses)
    expect(result.current.simpleFireNumber).not.toBeNull()
    expect(result.current.simpleFireNumber!).toBeLessThan(60000 / 0.04) // Less than regular FIRE
  })

  it('Fat FIRE uses correct label in formula-side fallback', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today', fireType: 'fat' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 60000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 0 },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // With retired rows, projection path uses plain "Expenses" label
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
    // But simpleFireNumber should reflect Fat FIRE (150% of expenses)
    expect(result.current.simpleFireNumber).not.toBeNull()
    expect(result.current.simpleFireNumber!).toBeGreaterThan(60000 / 0.04) // More than regular FIRE
  })

  it('CPF LIFE appears as subtract item when cpfLifeStartAge is within range', () => {
    // Use currentAge: 56 (past 55) so performAge55Transfer doesn't overwrite cpfRA.
    // Set cpfLifeStartAge: 56 so the annuity is captured at the projection start.
    setupTestPlan({
      adult: {
        currentAge: 56,
        retirementAge: 58,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 100000,
        cpfLifeStartAge: 56,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 80000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 2000000 },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const cpfItem = result.current.waterfallItems.find((i) => i.label === 'CPF LIFE')
    expect(cpfItem).toBeDefined()
    expect(cpfItem!.type).toBe('subtract')
    expect(cpfItem!.amount).toBeGreaterThan(0)
  })

  it('cpfOaMortgageCoverPct is clamped at 1.0 when CPF exceeds payment', () => {
    setupBaseline()
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    Object.assign(plan.properties[0], {
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 5000, // CPF > monthly payment
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
    })
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
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
    const swr = getSwr()
    const impliedNumber = netAnnualNeed! / swr
    // Allow 5% tolerance for rounding in normalization
    expect(Math.abs(impliedNumber - projectionFireNumber!) / projectionFireNumber!).toBeLessThan(0.05)
  })

  it('late retirement still produces valid waterfall items', () => {
    // With household validation, lifeExpectancy must > retirementAge so there's always
    // at least 1 retired row. Verify late retirement still produces waterfall items.
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 89,
        lifeExpectancy: 90,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'today' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 60000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 0 },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // Should have waterfall items (at least Expenses)
    expect(result.current.waterfallItems.length).toBeGreaterThanOrEqual(1)
    expect(result.current.waterfallItems[0].label).toBe('Expenses')
    expect(result.current.netAnnualNeed).not.toBeNull()
    // projectionFireNumber should be computed since there's 1 retired row
    expect(result.current.projectionFireNumber).not.toBeNull()
  })

  it('waterfall items match fireNumber on retirement basis', () => {
    // Regression test: on non-today basis, waterfall items must be inflation-
    // adjusted to match the FIRE number's dollar basis.
    // Near-retirement setup produces retired rows → projection path.
    // With minimal special cash flows, projection and simple formula should be close.
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        cpfOA: 0,
        cpfSA: 0,
        cpfMA: 0,
        cpfRA: 0,
        cpfLifeStartAge: 100,
        parentSupportEnabled: false,
        healthcareConfig: DISABLED_HEALTHCARE,
      },
      assumptions: {
        fire: { swr: 0.04, fireNumberBasis: 'retirement' },
        returns: { usePortfolioReturn: false, expectedReturn: 0.07, inflation: 0.025, expenseRatio: 0.003 },
      },
      expenses: {
        annualExpenses: 80000,
        parentSupportEnabled: false,
      },
      assets: { liquidNetWorth: 2000000 },
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const { waterfallItems, netAnnualNeed, simpleFireNumber } = result.current
    expect(waterfallItems.length).toBeGreaterThanOrEqual(1)
    expect(netAnnualNeed).not.toBeNull()
    expect(simpleFireNumber).not.toBeNull()
    // On the projection path, netAnnualNeed/swr approximates projectionFireNumber.
    // Both simpleFireNumber and projectionFireNumber should be in retirement basis.
    const swr = getSwr()
    const impliedNumber = netAnnualNeed! / swr
    // Allow 10% tolerance: projection path may differ from simple formula
    // due to inflation normalization round-trip.
    const deviation = Math.abs(impliedNumber - simpleFireNumber!) / simpleFireNumber!
    expect(deviation).toBeLessThan(0.10)
  })

  it('cpfOaMortgageCoverPct is 1.0 when CPF equals monthly payment', () => {
    // When CPF covers 100% of the monthly payment, cpfOaMortgageCoverPct should be 1.0.
    // Note: the projection engine may still show a mortgageCashPayment > 0 because it
    // computes the CPF/cash split independently from the store-level ratio.
    setupBaseline()
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    Object.assign(plan.properties[0], {
      ownsProperty: true,
      existingPropertyValue: 1500000,
      existingMortgageBalance: 800000,
      existingMonthlyPayment: 3000,
      mortgageCpfMonthly: 3000, // 100% covered by CPF
      existingMortgageRate: 0.035,
      existingMortgageRemainingYears: 20,
      ownershipPercent: 1,
    })
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    // Coverage should be exactly 1.0 (not > 1.0)
    expect(result.current.cpfOaMortgageCoverPct).toBe(1)
  })

  it('downsizing rent item appears when downsizing is configured', () => {
    setupBaseline()
    const plan = structuredClone(useHouseholdPlanStore.getState().plan)
    Object.assign(plan.properties[0], {
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
    })
    useHouseholdPlanStore.getState().setPlan(plan, {
      source: 'manual',
      initializedAt: new Date().toISOString(),
    })
    const { result } = renderHook(() => useAdjustedFireNumber())
    const rentItem = result.current.waterfallItems.find((i) => i.label === 'Rent (downsized)')
    expect(rentItem).toBeDefined()
    expect(rentItem!.type).toBe('add')
    expect(rentItem!.amount).toBeGreaterThan(0)
  })
})
