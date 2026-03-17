/**
 * Integration tests for the guided setup flow.
 *
 * These tests verify that the OUTPUT of each function satisfies the INPUT
 * requirements of the next function in the chain:
 *   applySetupDraft -> applyFlowValues -> validateHouseholdPlan -> compileHouseholdPlan -> buildHouseholdRuntimeLegacyInputs
 *
 * The ciRecoveryYears: 0 bug on the partner adult (causing "Fix input errors" on
 * the projection page) would have been caught by a single test here.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { applySetupDraft, hydrateSetupFromPlan, type SetupDraft } from '../setupDraft'
import { applyFlowValues } from '../applyFlowValues'
import { compileHouseholdPlan } from '../compileHouseholdPlan'
import { buildHouseholdRuntimeLegacyInputs } from '../runtimeLegacyInputs'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INDIVIDUAL_DRAFT: SetupDraft = {
  currentAge: 30,
  retirementAge: 55,
  annualIncome: 72_000,
  incomeType: 'gross',
  annualExpenses: 36_000,
  liquidNetWorth: 100_000,
  residency: 'citizen',
  cpfKnown: true,
  cpfTotal: 100_000,
  ownsProperty: 'owns',
  propertyType: 'hdb',
  propertyValue: 500_000,
  mortgageBalance: 200_000,
  healthcareEnabled: true,
  ispTier: 'enhanced',
  isRedo: false,
}

const COUPLE_DRAFT: SetupDraft = {
  ...INDIVIDUAL_DRAFT,
  partner: {
    name: 'Jane',
    currentAge: 28,
    retirementAge: 60,
    annualIncome: 60_000,
    incomeType: 'gross',
    annualExpenses: 24_000,
    liquidNetWorth: 50_000,
    residency: 'citizen',
    cpfKnown: true,
    cpfTotal: 80_000,
  },
  jointMonthlyExpenses: 3_000,
}

function getPlan() {
  return useHouseholdPlanStore.getState().plan
}

function getStoreState() {
  return useHouseholdPlanStore.getState()
}

function setupIndividual() {
  useHouseholdPlanStore.getState().initializeManualPlan('individual')
  applySetupDraft(INDIVIDUAL_DRAFT, 'individual')
}

function setupCouple() {
  useHouseholdPlanStore.getState().initializeManualPlan('couple')
  applySetupDraft(COUPLE_DRAFT, 'couple')
}

// ==========================================================================
// Category 1: applyFlowValues -> valid plan (9 tests)
// ==========================================================================

describe('Category 1: applyFlowValues -> valid plan', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
    setupIndividual()
  })

  it('Test 1: cpf flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('cpf', {
      cpfOA: 50_000,
      cpfSA: 30_000,
      cpfMA: 20_000,
      cpfRA: 0,
      hasCpfis: false,
      hasCpfTopUps: false,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 2: property flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('property', {
      propertyType: 'hdb',
      propertyValue: 800_000,
      hasMortgage: true,
      mortgageOutstanding: 300_000,
      monthlyMortgagePayment: 1_500,
      mortgageRatePercent: 0.035,
      mortgageEndYear: 2045,
      planToDownsize: false,
      hasRentalIncome: false,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 3: expenses flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('expenses', {
      housingExpenses: 1_500,
      foodExpenses: 800,
      transportExpenses: 300,
      utilitiesExpenses: 200,
      entertainmentExpenses: 200,
      travelExpenses: 100,
      otherExpenses: 100,
      retirementSpendingRatio: 0.8,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 4: healthcare flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('healthcare', {
      ispTier: 'enhanced',
      careShieldEnrolled: true,
      mediSaveBalance: 40_000,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 5: salary flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('salary', {
      salaryModel: 'realistic',
      annualBonusMonths: 2,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 6: srs flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('srs', {
      contributeToSrs: true,
      srsBalance: 15_000,
      annualSrsContribution: 15_300,
      srsWithdrawalStartAge: 62,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 7: goals flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('goals', {
      goalName: 'Wedding',
      goalCategory: 'wedding',
      goalTargetYear: 2028,
      goalTargetAmount: 50_000,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 8: allocation flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('allocation', {
      allocationTemplate: 'aggressive',
    })

    expect(result).toBe(true)
    // allocation flow writes to useAllocationStore, not useHouseholdPlanStore
    // but the household plan should still be valid after the flow
    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 9: protection flow -> hasValidationErrors === false', () => {
    const result = applyFlowValues('protection', {
      emergencyFundBalance: 30_000,
      hasOutstandingDebt: false,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)
  })
})

// ==========================================================================
// Category 2: Setup -> runtimeLegacyInputs -> projection (4 tests)
// ==========================================================================

describe('Category 2: Setup -> runtimeLegacyInputs -> projection', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('Test 10: Individual draft -> buildHouseholdRuntimeLegacyInputs produces profile with correct fields', () => {
    setupIndividual()
    const plan = getPlan()
    const compiled = compileHouseholdPlan(plan)
    const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    expect(runtime.profile.currentAge).toBe(30)
    expect(runtime.profile.retirementAge).toBe(55)
    // Income should match the draft gross amount
    expect(runtime.income.annualSalary).toBe(72_000)
  })

  it('Test 11: Couple draft -> buildHouseholdRuntimeLegacyInputs produces aggregated profile', () => {
    setupCouple()
    const plan = getPlan()
    const compiled = compileHouseholdPlan(plan)
    const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    // For couple plans, the runtime profile should reflect combined values
    // The reference adult is 'self' (age 30)
    expect(runtime.profile.currentAge).toBe(30)
    // Combined income should include both adults
    expect(runtime.income.annualSalary).toBeGreaterThanOrEqual(72_000)
    // Combined liquid net worth should include both adults
    expect(runtime.profile.liquidNetWorth).toBeGreaterThanOrEqual(100_000)
  })

  it('Test 12: Individual draft -> compileHouseholdPlan returns yearCount > 0', () => {
    setupIndividual()
    const plan = getPlan()
    const compiled = compileHouseholdPlan(plan)

    expect(compiled.yearCount).toBeGreaterThan(0)
    expect(compiled.rows.length).toBe(compiled.yearCount)
  })

  it("Test 13: Couple draft -> compileHouseholdPlan doesn't throw for both adults", () => {
    setupCouple()
    const plan = getPlan()

    expect(() => compileHouseholdPlan(plan)).not.toThrow()

    const compiled = compileHouseholdPlan(plan)
    expect(compiled.yearCount).toBeGreaterThan(0)

    // Both adults should have income projections
    const adultIds = Object.keys(compiled.incomeByAdultId)
    expect(adultIds.length).toBe(2)
  })
})

// ==========================================================================
// Category 3: Couple partner edge cases (9 tests)
// ==========================================================================

describe('Category 3: Couple partner edge cases', () => {
  beforeEach(() => {
    useHouseholdPlanStore.getState().reset()
  })

  it('Test 14: Self age 30, partner age 55 -> valid plan', () => {
    const draft: SetupDraft = {
      ...INDIVIDUAL_DRAFT,
      partner: {
        name: 'Senior Partner',
        currentAge: 55,
        retirementAge: 62,
        annualIncome: 120_000,
        incomeType: 'gross',
        annualExpenses: 36_000,
        liquidNetWorth: 500_000,
        residency: 'citizen',
        cpfKnown: true,
        cpfTotal: 300_000,
      },
    }
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    applySetupDraft(draft, 'couple')

    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 15: Self age 30, partner age 55 -> partner RA balance allowed (age >= 55)', () => {
    const draft: SetupDraft = {
      ...INDIVIDUAL_DRAFT,
      partner: {
        name: 'Senior Partner',
        currentAge: 55,
        retirementAge: 62,
        annualIncome: 120_000,
        incomeType: 'gross',
        annualExpenses: 36_000,
        liquidNetWorth: 500_000,
        residency: 'citizen',
        cpfKnown: true,
        cpfTotal: 300_000,
      },
    }
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    applySetupDraft(draft, 'couple')

    const partner = getPlan().adults.find((a) => a.owner === 'partner')!
    // Age 55+ uses the 55+ bracket with RA allocation (80%)
    expect(partner.cpf.balances.ra).toBeGreaterThan(0)
  })

  it('Test 16: Partner inherits lifeExpectancy > partner retirementAge', () => {
    const draft: SetupDraft = {
      ...INDIVIDUAL_DRAFT,
      partner: {
        name: 'Young Partner',
        currentAge: 25,
        retirementAge: 55,
        annualIncome: 48_000,
        incomeType: 'gross',
        annualExpenses: 24_000,
        liquidNetWorth: 30_000,
        residency: 'citizen',
        cpfKnown: false,
      },
    }
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    applySetupDraft(draft, 'couple')

    const partner = getPlan().adults.find((a) => a.owner === 'partner')!
    expect(partner.lifeExpectancy).toBeGreaterThan(partner.retirementAge)
  })

  it('Test 17: Take-home income conversion -> income entry has grossed-up amount', () => {
    const takeHome = 60_000
    const draft: SetupDraft = {
      ...INDIVIDUAL_DRAFT,
      partner: {
        name: 'Take-Home Partner',
        currentAge: 30,
        retirementAge: 60,
        annualIncome: takeHome,
        incomeType: 'take-home',
        annualExpenses: 24_000,
        liquidNetWorth: 50_000,
        residency: 'citizen',
        cpfKnown: false,
      },
    }
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    applySetupDraft(draft, 'couple')

    const partner = getPlan().adults.find((a) => a.owner === 'partner')!
    const expectedGross = Math.round(takeHome / 0.85)
    expect(partner.annualIncome).toBe(expectedGross)

    // Salary income entry should also use gross
    const partnerSalary = getPlan().income.find(
      (e) => e.kind === 'salary-model' && e.owner === 'partner',
    )
    expect(partnerSalary).toBeDefined()
    expect(partnerSalary!.annualAmount).toBe(expectedGross)
  })

  it('Test 18: hydrateSetupFromPlan -> applySetupDraft (redo) produces valid plan', () => {
    setupIndividual()
    const hydrated = hydrateSetupFromPlan(getPlan())

    // hydrated.isRedo should be true
    expect(hydrated.isRedo).toBe(true)

    // Re-apply as redo
    applySetupDraft(hydrated, 'individual')

    expect(getStoreState().hasValidationErrors).toBe(false)
  })

  it('Test 19: hydrateSetupFromPlan round-trip for couple plan -> valid plan', () => {
    setupCouple()
    const hydrated = hydrateSetupFromPlan(getPlan())

    expect(hydrated.partner).toBeDefined()
    expect(hydrated.isRedo).toBe(true)

    // Re-apply as redo
    applySetupDraft(hydrated, 'couple')

    expect(getStoreState().hasValidationErrors).toBe(false)

    // Verify partner still exists and has valid data
    const partner = getPlan().adults.find((a) => a.owner === 'partner')
    expect(partner).toBeDefined()
    expect(partner!.currentAge).toBe(28)
    expect(partner!.retirementAge).toBe(60)
  })

  it('Test 20: Couple + toggle hasCpfTopUps=false -> valid plan', () => {
    setupCouple()

    // Apply CPF flow with top-ups toggled off
    const result = applyFlowValues('cpf', {
      cpfOA: 60_000,
      cpfSA: 20_000,
      cpfMA: 20_000,
      cpfRA: 0,
      hasCpfTopUps: false,
      hasCpfis: false,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)

    // Verify top-ups were zeroed
    const self = getPlan().adults.find((a) => a.owner === 'self')!
    expect(self.cpf.annualTopUps.sa).toBe(0)
    expect(self.cpf.annualTopUps.ma).toBe(0)
  })

  it('Test 21: Couple + toggle planToDownsize=false -> valid plan', () => {
    setupCouple()

    // Apply property flow with downsizing toggled off
    const result = applyFlowValues('property', {
      propertyType: 'hdb',
      propertyValue: 500_000,
      hasMortgage: true,
      mortgageOutstanding: 200_000,
      monthlyMortgagePayment: 1_200,
      mortgageRatePercent: 0.025,
      mortgageEndYear: 2040,
      planToDownsize: false,
      hasRentalIncome: false,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)

    // Verify downsizing was reset
    const property = getPlan().properties[0]
    expect(property.downsizing.scenario).toBe('none')
  })

  it('Test 22: Couple + toggle hasOutstandingDebt=false -> valid plan', () => {
    setupCouple()

    // Apply protection flow with debt toggled off
    const result = applyFlowValues('protection', {
      emergencyFundBalance: 50_000,
      hasOutstandingDebt: false,
    })

    expect(result).toBe(true)
    expect(getStoreState().hasValidationErrors).toBe(false)

    // Verify debt was zeroed
    const self = getPlan().adults.find((a) => a.owner === 'self')!
    expect(self.nonMortgageDebtTotal).toBe(0)
    expect(self.nonMortgageDebtMonthlyPayment).toBe(0)
  })
})
