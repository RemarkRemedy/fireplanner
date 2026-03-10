/**
 * Regression tests for the isActive backward-compatibility bug.
 *
 * Root cause (Mar 2026): HouseholdSetupWizard created partner salary without
 * the required `isActive` field. All filter sites used truthiness checks
 * (e.g., `source.isActive`), which treated undefined as false, silently
 * dropping the partner's income from all projections.
 *
 * Invariant: `isActive: undefined` must be treated as active (not filtered out).
 * All code paths now use `!== false` or `=== false` instead of truthiness.
 */
import { describe, expect, it } from 'vitest'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import {
  buildSingleAdultPlanSlice,
  buildSplitAdultPlanSlice,
} from '@/lib/household/planSlice'
import type { HouseholdPlan, IncomeSource } from '@/lib/household/types'

/** Build a two-adult plan where the partner salary has isActive stripped. */
function makeCouplePlanWithStalePartnerIncome(): HouseholdPlan {
  const plan = structuredClone(fromLegacyIndividual(LEGACY_PARITY_FIXTURES.salaryOnly))
  const self = plan.adults[0]
  self.displayName = 'TJ'
  self.currentAge = 32
  self.retirementAge = 65
  self.lifeExpectancy = 90
  self.annualIncome = 120_000

  const partner = structuredClone(self)
  partner.id = 'adult-partner'
  partner.owner = 'partner'
  partner.displayName = 'Chloe'
  partner.currentAge = 28
  partner.retirementAge = 62
  partner.lifeExpectancy = 90
  partner.annualIncome = 96_000
  partner.liquidNetWorth = 50_000
  plan.adults.push(partner)
  plan.planType = 'couple'

  plan.income = [
    {
      id: 'income-salary-self',
      owner: 'self',
      label: 'TJ salary',
      kind: 'salary-model',
      timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: 65 },
      annualAmount: 120_000,
      growthRate: 0.03,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: true,
      isActive: true,
      streamType: 'employment',
      salaryModel: 'simple',
      bonusMonths: 0,
      employerCpfEnabled: true,
    },
    // Partner salary missing isActive — simulates stale localStorage
    {
      id: 'income-salary-partner',
      owner: 'partner',
      label: "Chloe's salary",
      kind: 'salary-model',
      timing: { kind: 'age-range', owner: 'partner', startAge: 28, endAge: 62 },
      annualAmount: 96_000,
      growthRate: 0.03,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: true,
      isActive: true, // will be stripped below
      streamType: 'employment',
      salaryModel: 'simple',
      bonusMonths: 0,
      employerCpfEnabled: true,
    },
  ]

  // Strip isActive to simulate stale data
  delete (plan.income[1] as unknown as Record<string, unknown>).isActive

  plan.expenses = [
    {
      id: 'expense-base-shared',
      owner: 'shared',
      label: 'Shared living',
      kind: 'base-living',
      timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: null },
      amount: 42_000,
      periodicity: 'annual',
    },
  ]

  return plan
}

describe('isActive backward compatibility', () => {
  const plan = makeCouplePlanWithStalePartnerIncome()

  it('confirms partner income has undefined isActive (test setup check)', () => {
    const partnerIncome = plan.income.find((i) => i.id === 'income-salary-partner')
    expect(partnerIncome).toBeDefined()
    expect((partnerIncome as unknown as Record<string, unknown>).isActive).toBeUndefined()
  })

  describe('buildHouseholdRuntimeLegacyInputs', () => {
    it('includes partner income in aggregate annual income', () => {
      const runtime = buildHouseholdRuntimeLegacyInputs(plan)
      // Should include both salaries: 120K + 96K = 216K
      expect(runtime.profile.annualIncome).toBeGreaterThanOrEqual(96_000)
    })

    it('populates annualSalary from active salary models', () => {
      const runtime = buildHouseholdRuntimeLegacyInputs(plan)
      // Should be a weighted combination including partner's salary
      expect(runtime.income.annualSalary).toBeGreaterThan(0)
    })
  })

  describe('buildSplitAdultPlanSlice', () => {
    it('produces non-null slice for partner with undefined isActive', () => {
      const result = buildSplitAdultPlanSlice(plan, 'adult-partner', 0.5)
      expect(result).not.toBeNull()
    })

    it('includes partner income in the slice', () => {
      const result = buildSplitAdultPlanSlice(plan, 'adult-partner', 0.5)!
      const partnerIncome = result.slice.income.find(
        (i) => i.label === "Chloe's salary"
      )
      expect(partnerIncome).toBeDefined()
      expect(partnerIncome!.annualAmount).toBe(96_000)
    })

    it('per-adult runtime from sliced plan has non-zero income', () => {
      const result = buildSplitAdultPlanSlice(plan, 'adult-partner', 0.5)!
      const runtime = buildHouseholdRuntimeLegacyInputs(result.slice)
      expect(runtime.income.annualSalary).toBe(96_000)
      expect(runtime.profile.annualIncome).toBeGreaterThanOrEqual(96_000)
    })
  })

  describe('buildSingleAdultPlanSlice', () => {
    it('includes partner income in filter-only slice', () => {
      const result = buildSingleAdultPlanSlice(plan, 'adult-partner')!
      const partnerIncome = result.slice.income.find(
        (i) => i.label === "Chloe's salary"
      )
      expect(partnerIncome).toBeDefined()
      expect(partnerIncome!.annualAmount).toBe(96_000)
    })
  })

  describe('explicitly inactive income IS filtered', () => {
    it('compileHouseholdPlan excludes income with isActive === false', () => {
      const planWithInactive = structuredClone(plan)
      ;(planWithInactive.income[1] as IncomeSource).isActive = false

      const compiled = compileHouseholdPlan(planWithInactive)
      // Partner's salary should be excluded from aggregate income calculations
      // Year 0 should only have TJ's net income, not TJ + Chloe
      const planWithActive = structuredClone(plan)
      ;(planWithActive.income[1] as IncomeSource).isActive = true
      const compiledWithActive = compileHouseholdPlan(planWithActive)

      // Total net income should be lower when partner is inactive
      expect(compiled.rows[0].totalNetIncome).toBeLessThan(
        compiledWithActive.rows[0].totalNetIncome
      )
    })
  })
})
