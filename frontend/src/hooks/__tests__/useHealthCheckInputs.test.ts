import { describe, expect, it, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import type { HouseholdPlan, PlanningAdult, PropertyPlan } from '@/lib/household/types'
import type { DownsizingConfig } from '@/lib/types'

// ---------------------------------------------------------------------------
// Mock control: useNormalizedLegacyAnalysisContext
// ---------------------------------------------------------------------------
// We mock the module so we can inject "no projection" scenarios for fallback tests.
// The mock defaults to returning empty incomeByAdultId (fallback path).
// Tests that want real projection data call `mockNormalizedContext.mockImplementation(...)`.

const mockNormalizedContext = vi.fn()

vi.mock('@/hooks/useIncomeProjection', () => ({
  useNormalizedLegacyAnalysisContext: (...args: unknown[]) => mockNormalizedContext(...args),
}))

// Import AFTER the mock is declared (vi.mock is hoisted, but the import
// of useHealthCheckInputs will see the mock).
import { useHealthCheckInputs } from '@/hooks/useHealthCheckInputs'

// For tests that need the real compiled plan, we run compileHouseholdPlan manually.
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBasePlan(): HouseholdPlan {
  const plan = structuredClone(fromLegacyIndividual(LEGACY_PARITY_FIXTURES.salaryOnly))
  const self = plan.adults[0]
  self.id = 'adult-self'
  self.owner = 'self'
  self.displayName = 'Primary'
  self.currentAge = 35
  self.retirementAge = 60
  self.lifeExpectancy = 90
  self.annualIncome = 120_000
  self.annualExpenses = 36_000
  self.liquidNetWorth = 200_000
  self.cashSavings = 50_000
  self.nonMortgageDebtTotal = 10_000
  self.nonMortgageDebtMonthlyPayment = 500
  self.insuranceDeathCoverage = 500_000
  self.insuranceCICoverage = 200_000
  self.insuranceDisabilityMonthly = 3_000
  self.funeralCosts = 15_000
  self.ciRecoveryYears = 5
  self.cpf = {
    ...self.cpf,
    balances: { oa: 50_000, sa: 30_000, ma: 20_000, ra: 10_000 },
    lifeActualMonthlyPayout: 1_200,
  }
  plan.id = 'health-check-test'
  plan.planType = 'individual'
  plan.adults = [self]
  plan.properties = []
  plan.dependents = []
  plan.goals = []
  return plan
}

function makePartner(base: PlanningAdult): PlanningAdult {
  return {
    ...structuredClone(base),
    id: 'adult-partner',
    owner: 'partner',
    displayName: 'Partner',
    currentAge: 33,
    retirementAge: 58,
    lifeExpectancy: 90,
    annualIncome: 84_000,
    annualExpenses: 0,
    liquidNetWorth: 100_000,
    cashSavings: 30_000,
    cpf: {
      ...structuredClone(base.cpf),
      balances: { oa: 25_000, sa: 15_000, ma: 10_000, ra: 0 },
      lifeActualMonthlyPayout: 800,
    },
  }
}

const NO_DOWNSIZING: DownsizingConfig = {
  scenario: 'none',
  targetAge: 65,
  targetPropertyType: 'condo',
  targetPurchasePrice: 0,
  targetLeaseYears: 99,
  renovationCosts: 0,
  targetAppreciationRate: 0.02,
  targetRentalYield: 0,
  reinvestPercent: 0.8,
}

function makeProperty(overrides: Partial<PropertyPlan> = {}): PropertyPlan {
  return {
    id: 'property-1',
    owner: 'shared',
    label: 'Home',
    propertyType: 'condo',
    purchasePrice: 1_000_000,
    leaseYears: 99,
    appreciationRate: 0.02,
    rentalYield: 0,
    mortgageRate: 0.035,
    mortgageTerm: 25,
    ltv: 0.75,
    purchaseYearsFromNow: 0,
    residencyForAbsd: 'citizen',
    propertyCount: 1,
    ownsProperty: true,
    existingPropertyValue: 1_200_000,
    existingMortgageBalance: 600_000,
    existingMonthlyPayment: 3_000,
    existingMortgageRate: 0.035,
    existingMortgageRemainingYears: 20,
    mortgageCpfMonthly: 0,
    ownershipPercent: 0.5,
    existingAppreciationRate: 0.02,
    existingLeaseYears: 90,
    existingApplyBalaDecay: false,
    downsizing: NO_DOWNSIZING,
    hdbFlatType: '4-room',
    hdbMonetizationStrategy: 'none',
    hdbLbsRetainedLease: 30,
    hdbSublettingRooms: 1,
    hdbSublettingRate: 800,
    hdbCpfUsedForHousing: 0,
    ...overrides,
  }
}

function seedPlan(plan: HouseholdPlan): void {
  act(() => {
    useHouseholdPlanStore.getState().setPlan(plan)
  })
}

/** Configure the mock to return no projection data (empty incomeByAdultId). */
function mockNoProjection(): void {
  mockNormalizedContext.mockReturnValue({
    compiledPlan: { incomeByAdultId: {} },
  })
}

/** Configure the mock to return a real compiled plan from the current store state. */
function mockWithRealProjection(plan: HouseholdPlan): void {
  const compiled = compileHouseholdPlan(plan)
  mockNormalizedContext.mockReturnValue({
    compiledPlan: compiled,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHealthCheckInputs', () => {
  beforeEach(() => {
    localStorage.clear()
    act(() => {
      useHouseholdPlanStore.getState().reset()
      useAllocationStore.getState().reset()
    })
    mockNormalizedContext.mockReset()
  })

  // =========================================================================
  // PATH 1: Fallback (no projection data)
  // =========================================================================
  describe('fallback path (no projection data)', () => {
    beforeEach(() => {
      mockNoProjection()
    })

    it('uses annualIncome / 12 as grossMonthlyIncome when projection is unavailable', () => {
      const plan = makeBasePlan()
      plan.adults[0].annualIncome = 120_000
      seedPlan(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.ratioInputs.grossMonthlyIncome).toBe(10_000)
    })

    it('uses 80% heuristic for netMonthlyIncome when projection is unavailable', () => {
      const plan = makeBasePlan()
      plan.adults[0].annualIncome = 120_000
      seedPlan(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      // 120_000 * 0.8 / 12 = 8_000
      expect(result.current!.ratioInputs.netMonthlyIncome).toBe(8_000)
    })

    it('sets isReady to false when no projection row is available', () => {
      const plan = makeBasePlan()
      seedPlan(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.isReady).toBe(false)
    })

    it('uses annualIncome directly for insuranceInputs when no projection', () => {
      const plan = makeBasePlan()
      plan.adults[0].annualIncome = 120_000
      seedPlan(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.insuranceInputs.annualIncome).toBe(120_000)
    })

    it('builds flat partner income array when no projection data', () => {
      const plan = makeBasePlan()
      const partner = makePartner(plan.adults[0])
      partner.annualIncome = 84_000
      partner.currentAge = 33
      partner.retirementAge = 58
      plan.adults.push(partner)
      plan.planType = 'couple'
      seedPlan(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      const r = result.current!

      const expectedYears = 58 - 33 // 25
      expect(r.insuranceInputs.partnerProjectedAnnualIncome).not.toBeNull()
      expect(r.insuranceInputs.partnerProjectedAnnualIncome!).toHaveLength(expectedYears)
      expect(r.insuranceInputs.partnerProjectedAnnualIncome!.every((v) => v === 84_000)).toBe(true)
    })
  })

  // =========================================================================
  // PATH 2-4 and basic assertions: with real compiled projection
  // =========================================================================
  describe('with real projection data', () => {
    // ----- Basic field mapping -----

    it('computes CPF total as OA + SA + MA + RA', () => {
      const plan = makeBasePlan()
      plan.adults[0].cpf.balances = { oa: 50_000, sa: 30_000, ma: 20_000, ra: 10_000 }
      seedPlan(plan)
      mockWithRealProjection(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.insuranceInputs.cpfTotal).toBe(110_000)
    })

    it('computes investedAssets as max(0, liquidNW - cashSavings)', () => {
      const plan = makeBasePlan()
      plan.adults[0].liquidNetWorth = 200_000
      plan.adults[0].cashSavings = 50_000
      seedPlan(plan)
      mockWithRealProjection(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.ratioInputs.investedAssets).toBe(150_000)
    })

    it('clamps investedAssets to zero when cashSavings > liquidNW', () => {
      const plan = makeBasePlan()
      plan.adults[0].liquidNetWorth = 30_000
      plan.adults[0].cashSavings = 50_000
      seedPlan(plan)
      mockWithRealProjection(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.ratioInputs.investedAssets).toBe(0)
    })

    it('computes monthlyExpenses from store annualExpenses / 12', () => {
      const plan = makeBasePlan()
      plan.adults[0].annualExpenses = 36_000
      seedPlan(plan)
      mockWithRealProjection(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.ratioInputs.monthlyExpenses).toBe(3_000)
    })

    it('defaults to first adult when no adultId specified', () => {
      const plan = makeBasePlan()
      plan.adults[0].displayName = 'Primary'
      seedPlan(plan)
      mockWithRealProjection(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.adultName).toBe('Primary')
      expect(result.current!.adultId).toBe('adult-self')
    })

    it('returns null for non-existent adultId', () => {
      const plan = makeBasePlan()
      seedPlan(plan)
      mockWithRealProjection(plan)

      const { result } = renderHook(() => useHealthCheckInputs('non-existent-id'))
      expect(result.current).toBeNull()
    })

    it('sets isReady to true when projection data is available', () => {
      const plan = makeBasePlan()
      seedPlan(plan)
      mockWithRealProjection(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      expect(result.current!.isReady).toBe(true)
    })

    it('uses projection totalGross for grossMonthlyIncome and insuranceInputs.annualIncome', () => {
      const plan = makeBasePlan()
      plan.adults[0].annualIncome = 120_000
      seedPlan(plan)
      mockWithRealProjection(plan)

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      const r = result.current!

      // With real projection, grossMonthlyIncome = row0.totalGross / 12
      // totalGross includes salary + bonuses so it should be > 0
      expect(r.ratioInputs.grossMonthlyIncome).toBeGreaterThan(0)
      expect(r.insuranceInputs.annualIncome).toBeGreaterThan(0)
      expect(r.isReady).toBe(true)
    })

    // ----- PATH 2: Property ownership scaling -----

    describe('property ownership scaling', () => {
      it('uses fraction=1.0 for single-adult plan regardless of ownershipPercent', () => {
        const plan = makeBasePlan()
        plan.properties = [makeProperty({
          existingPropertyValue: 1_000_000,
          existingMortgageBalance: 400_000,
          existingMonthlyPayment: 2_000,
          ownershipPercent: 0.5, // should be ignored for single adult
        })]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        const r = result.current!

        // Single adult: fraction = 1.0, not ownershipPercent
        expect(r.insuranceInputs.mortgageBalance).toBe(400_000)
        expect(r.ratioInputs.totalMonthlyDebtPayments).toBe(2_000 + plan.adults[0].nonMortgageDebtMonthlyPayment)
      })

      it('scales property values by ownershipPercent for couple plan', () => {
        const plan = makeBasePlan()
        const partner = makePartner(plan.adults[0])
        plan.adults.push(partner)
        plan.planType = 'couple'
        plan.properties = [makeProperty({
          owner: 'shared',
          existingPropertyValue: 1_000_000,
          existingMortgageBalance: 400_000,
          existingMonthlyPayment: 2_000,
          ownershipPercent: 0.6,
        })]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs('adult-self'))
        expect(result.current).not.toBeNull()
        const r = result.current!

        // Couple: scale by ownershipPercent = 0.6
        expect(r.insuranceInputs.mortgageBalance).toBe(240_000)
        expect(r.ratioInputs.totalMonthlyDebtPayments).toBe(1_200 + plan.adults[0].nonMortgageDebtMonthlyPayment)
      })
    })

    // ----- PATH 3: Discount rate branching -----

    describe('discount rate', () => {
      it('uses expectedReturn - inflation - expenseRatio when usePortfolioReturn is false', () => {
        const plan = makeBasePlan()
        plan.assumptions.returns.usePortfolioReturn = false
        plan.assumptions.returns.expectedReturn = 0.07
        plan.assumptions.returns.inflation = 0.025
        plan.assumptions.returns.expenseRatio = 0.003
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        // 0.07 - 0.025 - 0.003 = 0.042
        expect(result.current!.insuranceInputs.discountRate).toBeCloseTo(0.042, 3)
      })

      it('uses calculatePortfolioReturn when usePortfolioReturn is true', () => {
        const plan = makeBasePlan()
        plan.assumptions.returns.usePortfolioReturn = true
        plan.assumptions.returns.inflation = 0.025
        plan.assumptions.returns.expenseRatio = 0.003
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()

        const discountRate = result.current!.insuranceInputs.discountRate
        // With balanced allocation, portfolio return differs from default 0.07
        // Verify it's a reasonable positive number
        expect(discountRate).toBeGreaterThan(0)
        expect(discountRate).toBeLessThan(0.1)
      })
    })

    // ----- PATH 4: Partner income array with projection -----

    describe('partner income with projection', () => {
      it('maps partner income from projection rows when available', () => {
        const plan = makeBasePlan()
        const partner = makePartner(plan.adults[0])
        plan.adults.push(partner)
        plan.planType = 'couple'
        // Add an income source for the partner so the compiler generates
        // non-zero projection rows (annualIncome on PlanningAdult is a
        // summary field; the compiler projects from IncomeSource entries).
        plan.income.push({
          id: 'inc-partner',
          owner: 'partner',
          label: 'Partner salary',
          kind: 'salary-model',
          timing: { kind: 'age-range', owner: 'partner', startAge: 33, endAge: null },
          annualAmount: 84_000,
          growthRate: 0.03,
          growthModel: 'nominal',
          taxTreatment: 'taxable',
          isCpfApplicable: true,
          isActive: true,
          streamType: 'employment',
          salaryModel: 'simple',
          bonusMonths: 0,
          employerCpfEnabled: true,
        })
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs('adult-self'))
        expect(result.current).not.toBeNull()
        const r = result.current!

        expect(r.insuranceInputs.hasPartner).toBe(true)
        expect(r.insuranceInputs.partnerProjectedAnnualIncome).not.toBeNull()
        expect(r.insuranceInputs.partnerProjectedAnnualIncome!.length).toBeGreaterThan(0)
        // Partner has salary income source so first row's totalGross > 0
        expect(r.insuranceInputs.partnerProjectedAnnualIncome![0]).toBeGreaterThan(0)
      })

      it('provides partner metadata fields', () => {
        const plan = makeBasePlan()
        const partner = makePartner(plan.adults[0])
        plan.adults.push(partner)
        plan.planType = 'couple'
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs('adult-self'))
        expect(result.current).not.toBeNull()
        const r = result.current!

        expect(r.insuranceInputs.hasPartner).toBe(true)
        expect(r.insuranceInputs.partnerRetirementAge).toBe(58)
        expect(r.insuranceInputs.partnerCurrentAge).toBe(33)
        expect(r.insuranceInputs.partnerLifeExpectancy).toBe(90)
        expect(r.insuranceInputs.partnerCpfLifeMonthlyPayout).toBe(800)
      })

      it('sets hasPartner false and partner fields null for single adult', () => {
        const plan = makeBasePlan()
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        const r = result.current!

        expect(r.insuranceInputs.hasPartner).toBe(false)
        expect(r.insuranceInputs.partnerProjectedAnnualIncome).toBeNull()
        expect(r.insuranceInputs.partnerRetirementAge).toBeNull()
        expect(r.insuranceInputs.partnerCurrentAge).toBeNull()
        expect(r.insuranceInputs.partnerLifeExpectancy).toBeNull()
        expect(r.insuranceInputs.partnerCpfLifeMonthlyPayout).toBeNull()
      })
    })

    // ----- Dependent and goal mapping -----

    describe('dependents and goals', () => {
      it('maps child dependents with currentAge and annualCost', () => {
        const plan = makeBasePlan()
        plan.dependents = [{
          id: 'dep-1',
          owner: 'shared',
          label: 'Child 1',
          relationship: 'child',
          currentAge: 5,
          timing: null,
          annualCost: 12_000,
        }]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        expect(result.current!.insuranceInputs.dependentChildren).toHaveLength(1)
        expect(result.current!.insuranceInputs.dependentChildren[0]).toEqual({
          currentAge: 5,
          annualCost: 12_000,
        })
      })

      it('filters out children with null currentAge', () => {
        const plan = makeBasePlan()
        plan.dependents = [{
          id: 'dep-1',
          owner: 'shared',
          label: 'Child',
          relationship: 'child',
          currentAge: null,
          timing: null,
          annualCost: 12_000,
        }]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        expect(result.current!.insuranceInputs.dependentChildren).toHaveLength(0)
      })

      it('maps parent dependents with remaining years', () => {
        const plan = makeBasePlan()
        plan.dependents = [{
          id: 'dep-2',
          owner: 'shared',
          label: 'Parent',
          relationship: 'parent',
          currentAge: 70,
          timing: null,
          annualCost: 6_000,
        }]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        const r = result.current!

        // CAPITAL_NEEDS_DEFAULTS.parentLifeExpectancy = 85
        expect(r.insuranceInputs.dependentParents).toHaveLength(1)
        expect(r.insuranceInputs.dependentParents[0]).toEqual({
          annualSupport: 6_000,
          remainingYears: 15, // 85 - 70
        })
      })

      it('maps education goals with timing', () => {
        const plan = makeBasePlan()
        plan.goals = [{
          id: 'goal-1',
          owner: 'self',
          label: 'University',
          kind: 'financial-goal',
          timing: { kind: 'single-age', owner: 'self', age: 45 },
          amount: 100_000,
          durationYears: 4,
          priority: 'essential',
          inflationAdjusted: true,
          category: 'education',
        }]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        const r = result.current!

        expect(r.insuranceInputs.educationGoals).toHaveLength(1)
        expect(r.insuranceInputs.educationGoals[0]).toEqual({
          amount: 100_000,
          yearsFromNow: 10, // 45 - 35
          inflationAdjusted: true,
        })
      })

      it('handles age-range timing for education goals', () => {
        const plan = makeBasePlan()
        plan.goals = [{
          id: 'goal-2',
          owner: 'self',
          label: 'Education',
          kind: 'financial-goal',
          timing: { kind: 'age-range', owner: 'self', startAge: 50, endAge: 54 },
          amount: 80_000,
          durationYears: 4,
          priority: 'essential',
          inflationAdjusted: false,
          category: 'education',
        }]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        const r = result.current!

        expect(r.insuranceInputs.educationGoals).toHaveLength(1)
        // age-range uses startAge as target age
        expect(r.insuranceInputs.educationGoals[0]).toEqual({
          amount: 80_000,
          yearsFromNow: 15, // 50 - 35
          inflationAdjusted: false,
        })
      })

      it('filters out non-education goals', () => {
        const plan = makeBasePlan()
        plan.goals = [{
          id: 'goal-1',
          owner: 'self',
          label: 'Travel',
          kind: 'financial-goal',
          timing: { kind: 'single-age', owner: 'self', age: 40 },
          amount: 20_000,
          durationYears: 1,
          priority: 'nice-to-have',
          inflationAdjusted: false,
          category: 'travel',
        }]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        expect(result.current!.insuranceInputs.educationGoals).toHaveLength(0)
      })
    })

    // ----- Debt totals -----

    describe('debt totals', () => {
      it('computes totalDebt as mortgageFraction + nonMortgageDebtTotal', () => {
        const plan = makeBasePlan()
        plan.adults[0].nonMortgageDebtTotal = 15_000
        plan.properties = [makeProperty({ existingMortgageBalance: 300_000 })]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        // Single adult: 300_000 + 15_000 = 315_000
        expect(result.current!.ratioInputs.totalDebt).toBe(315_000)
      })

      it('computes totalMonthlyDebtPayments as mortgage payment + non-mortgage', () => {
        const plan = makeBasePlan()
        plan.adults[0].nonMortgageDebtMonthlyPayment = 500
        plan.properties = [makeProperty({ existingMonthlyPayment: 2_500 })]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        expect(result.current!.ratioInputs.totalMonthlyDebtPayments).toBe(3_000)
      })
    })

    // ----- Net worth calculation -----

    describe('net worth', () => {
      it('computes netWorth as totalAssets - totalDebt', () => {
        const plan = makeBasePlan()
        plan.adults[0].liquidNetWorth = 200_000
        plan.adults[0].cpf.balances = { oa: 50_000, sa: 30_000, ma: 20_000, ra: 10_000 }
        plan.adults[0].nonMortgageDebtTotal = 5_000
        plan.properties = [makeProperty({
          existingPropertyValue: 800_000,
          existingMortgageBalance: 300_000,
        })]
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        const r = result.current!

        // cpfTotal = 110k, totalAssets = 200k + 110k + 800k = 1_110_000
        // totalDebt = 300k + 5k = 305_000
        expect(r.ratioInputs.totalAssets).toBe(1_110_000)
        expect(r.ratioInputs.totalDebt).toBe(305_000)
        expect(r.ratioInputs.netWorth).toBe(805_000)
      })
    })

    // ----- Insurance-specific fields -----

    describe('insurance fields', () => {
      it('passes through insurance coverage values', () => {
        const plan = makeBasePlan()
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        const ins = result.current!.insuranceInputs

        expect(ins.insuranceDeathCoverage).toBe(500_000)
        expect(ins.insuranceCICoverage).toBe(200_000)
        expect(ins.insuranceDisabilityMonthly).toBe(3_000)
        expect(ins.funeralCosts).toBe(15_000)
        expect(ins.ciRecoveryYears).toBe(5)
      })

      it('rounds ciRecoveryYears to integer', () => {
        const plan = makeBasePlan()
        plan.adults[0].ciRecoveryYears = 4.7
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        expect(result.current!.insuranceInputs.ciRecoveryYears).toBe(5)
      })

      it('passes inflation from plan assumptions', () => {
        const plan = makeBasePlan()
        plan.assumptions.returns.inflation = 0.03
        seedPlan(plan)
        mockWithRealProjection(plan)

        const { result } = renderHook(() => useHealthCheckInputs())
        expect(result.current).not.toBeNull()
        expect(result.current!.insuranceInputs.inflationRate).toBe(0.03)
      })
    })
  })
})
