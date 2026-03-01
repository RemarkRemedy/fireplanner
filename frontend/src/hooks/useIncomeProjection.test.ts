import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIncomeProjection, buildProjectionParams } from './useIncomeProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

beforeEach(() => {
  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  usePropertyStore.getState().reset()
})

describe('buildProjectionParams', () => {
  it('returns params when both stores have no errors', () => {
    const profile = useProfileStore.getState()
    const income = useIncomeStore.getState()
    const property = usePropertyStore.getState()
    const params = buildProjectionParams(profile, income, property)
    expect(params).not.toBeNull()
    expect(params!.currentAge).toBe(profile.currentAge)
    expect(params!.salaryModel).toBe(income.salaryModel)
  })

  it('returns null when profile has validation errors', () => {
    useProfileStore.getState().setField('currentAge', 15) // triggers error
    const profile = useProfileStore.getState()
    const income = useIncomeStore.getState()
    const property = usePropertyStore.getState()
    expect(buildProjectionParams(profile, income, property)).toBeNull()
  })

  it('returns null when income has validation errors', () => {
    useIncomeStore.getState().setField('annualSalary', -1) // triggers error
    const profile = useProfileStore.getState()
    const income = useIncomeStore.getState()
    const property = usePropertyStore.getState()
    expect(buildProjectionParams(profile, income, property)).toBeNull()
  })

  it('maps all CPF fields from profile', () => {
    const profile = useProfileStore.getState()
    const income = useIncomeStore.getState()
    const property = usePropertyStore.getState()
    const params = buildProjectionParams(profile, income, property)!
    expect(params.initialCpfOA).toBe(profile.cpfOA)
    expect(params.initialCpfSA).toBe(profile.cpfSA)
    expect(params.initialCpfMA).toBe(profile.cpfMA)
    expect(params.initialCpfRA).toBe(profile.cpfRA)
    expect(params.cpfLifeStartAge).toBe(profile.cpfLifeStartAge)
    expect(params.cpfLifePlan).toBe(profile.cpfLifePlan)
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
    const profile = useProfileStore.getState()
    expect(projection[0].age).toBe(profile.currentAge)
    expect(projection[projection.length - 1].age).toBe(profile.lifeExpectancy)
    expect(projection.length).toBe(profile.lifeExpectancy - profile.currentAge + 1)
  })

  it('returns null projection on profile validation error', () => {
    useProfileStore.getState().setField('currentAge', 15)
    const { result } = renderHook(() => useIncomeProjection())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.projection).toBeNull()
    expect(result.current.summary).toBeNull()
  })

  it('returns null projection on income validation error', () => {
    useIncomeStore.getState().setField('annualSalary', -1)
    const { result } = renderHook(() => useIncomeProjection())
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.projection).toBeNull()
  })

  it('includes cross-store errors (income stream endAge > lifeExpectancy)', () => {
    useIncomeStore.getState().addIncomeStream({
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
    const profile = useProfileStore.getState()
    // Find a post-retirement row
    const postRetRow = projection.find(r => r.age > profile.retirementAge)
    if (postRetRow) {
      expect(postRetRow.salary).toBe(0)
    }
  })
})
