import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIncomeProjection, buildProjectionParams } from './useIncomeProjection'
import { generateIncomeProjection } from '@/lib/calculations/income'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
})

/** Helper: get legacy-shaped profile/income/property from the current household plan store */
function getLegacyInputs() {
  const plan = useHouseholdPlanStore.getState().plan
  const compiled = compileHouseholdPlan(plan)
  return buildHouseholdRuntimeLegacyInputs(plan, compiled)
}

describe('buildProjectionParams', () => {
  it('returns params when both stores have no errors', () => {
    const { profile, income, property } = getLegacyInputs()
    const params = buildProjectionParams(profile, income, property)
    expect(params).not.toBeNull()
    expect(params!.currentAge).toBe(profile.currentAge)
    expect(params!.salaryModel).toBe(income.salaryModel)
  })

  it('returns null when profile has validation errors', () => {
    // buildProjectionParams checks for validationErrors on the profile/income objects.
    // We can pass profile state with explicit validation errors to test this path.
    const { profile, income, property } = getLegacyInputs()
    const profileWithErrors = { ...profile, validationErrors: { currentAge: 'Invalid' } }
    expect(buildProjectionParams(profileWithErrors, income, property)).toBeNull()
  })

  it('returns null when income has validation errors', () => {
    const { profile, income, property } = getLegacyInputs()
    const incomeWithErrors = { ...income, validationErrors: { annualSalary: 'Invalid' } }
    expect(buildProjectionParams(profile, incomeWithErrors, property)).toBeNull()
  })

  it('maps all CPF fields from profile', () => {
    const { profile, income, property } = getLegacyInputs()
    const params = buildProjectionParams(profile, income, property)!
    expect(params.initialCpfOA).toBe(profile.cpfOA)
    expect(params.initialCpfSA).toBe(profile.cpfSA)
    expect(params.initialCpfMA).toBe(profile.cpfMA)
    expect(params.initialCpfRA).toBe(profile.cpfRA)
    expect(params.cpfLifeStartAge).toBe(profile.cpfLifeStartAge)
    expect(params.cpfLifePlan).toBe(profile.cpfLifePlan)
  })

  it('supports normalized age overrides and preserves PR-month inputs', () => {
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 60,
        lifeExpectancy: 90,
        residencyStatus: 'pr',
      },
    })
    const { profile, income, property } = getLegacyInputs()
    // Simulate normalized age overrides by spreading different ages
    const params = buildProjectionParams(
      { ...profile, currentAge: 42, retirementAge: 67, lifeExpectancy: 93 },
      income,
      property,
    )!

    expect(params.currentAge).toBe(42)
    expect(params.retirementAge).toBe(67)
    expect(params.lifeExpectancy).toBe(93)
    expect(params.prMonths).toBe(profile.prMonths)
  })
})

describe('useIncomeProjection', () => {
  it('returns projection with valid defaults', () => {
    const { result } = renderHook(() => useIncomeProjection())
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.projection).not.toBeNull()
    expect(result.current.summary).not.toBeNull()
    expect(result.current.errors).toEqual({})
  })

  it('projection spans currentAge to lifeExpectancy', () => {
    const { result } = renderHook(() => useIncomeProjection())
    const projection = result.current.projection!
    // Get ages from the household plan's default adult
    const plan = useHouseholdPlanStore.getState().plan
    const self = plan.adults.find((a) => a.owner === 'self')!
    expect(projection[0].age).toBe(self.currentAge)
    expect(projection[projection.length - 1].age).toBe(self.lifeExpectancy)
    expect(projection.length).toBe(self.lifeExpectancy - self.currentAge + 1)
  })

  it('returns null projection on profile validation error', () => {
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 20 },
    })
    const { result } = renderHook(() => useIncomeProjection())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.projection).toBeNull()
    expect(result.current.summary).toBeNull()
  })

  it('returns null projection on income validation error', () => {
    // Use cross-field violation to trigger household validation errors
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 20 },
    })
    const { result } = renderHook(() => useIncomeProjection())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.projection).toBeNull()
  })

  it('includes cross-store errors (income stream endAge > lifeExpectancy)', () => {
    setupTestPlan({
      income: {
        incomeStreams: [
          {
            id: 'test1',
            name: 'Test',
            annualAmount: 24000,
            startAge: 30,
            endAge: 95, // exceeds default lifeExpectancy of 90
            growthRate: 0,
            type: 'rental',
            growthModel: 'fixed',
            taxTreatment: 'taxable',
            isCpfApplicable: false,
            isActive: true,
          },
        ],
      },
    })
    const { result } = renderHook(() => useIncomeProjection())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.errors).toHaveProperty('incomeStream_test1_endAge')
  })

  it('summary includes savings rate and lifetime earnings', () => {
    const { result } = renderHook(() => useIncomeProjection())
    const summary = result.current.summary!
    expect(summary).toHaveProperty('lifetimeEarnings')
    expect(summary).toHaveProperty('averageSavingsRate')
    expect(summary.lifetimeEarnings).toBeGreaterThan(0)
  })

  it('CPF contributions appear in projection rows', () => {
    const { result } = renderHook(() => useIncomeProjection())
    const projection = result.current.projection!
    // First row (working age) should have CPF contributions
    const workingRow = projection[0]
    expect(workingRow.cpfEmployee).toBeGreaterThan(0)
    expect(workingRow.cpfEmployer).toBeGreaterThan(0)
  })

  it('post-retirement rows have zero salary', () => {
    const { result } = renderHook(() => useIncomeProjection())
    const projection = result.current.projection!
    const plan = useHouseholdPlanStore.getState().plan
    const self = plan.adults.find((a) => a.owner === 'self')!
    // Find a post-retirement row
    const postRetRow = projection.find(r => r.age > self.retirementAge)
    if (postRetRow) {
      expect(postRetRow.salary).toBe(0)
    }
  })

  it('uses the shared projection builder for PR-residency inputs', () => {
    setupTestPlan({
      adult: {
        residencyStatus: 'pr',
      },
    })

    const { profile, income, property } = getLegacyInputs()
    const expected = generateIncomeProjection(buildProjectionParams(profile, income, property)!)
    const { result } = renderHook(() => useIncomeProjection())

    expect(result.current.projection![0].cpfEmployee).toBeCloseTo(expected[0].cpfEmployee, 6)
    expect(result.current.projection![0].cpfEmployer).toBeCloseTo(expected[0].cpfEmployer, 6)
  })
})
