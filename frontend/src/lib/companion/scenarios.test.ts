import { describe, it, expect } from 'vitest'
import { createCompanionScenarios, resolveScenarioInputs } from './scenarios'
import { MIN_COMPANION_RETIREMENT_AGE } from './utils'

describe('createCompanionScenarios', () => {
  it('returns 5 preset scenarios', () => {
    const scenarios = createCompanionScenarios(65)
    expect(scenarios).toHaveLength(5)
  })

  it('has correct scenario names', () => {
    const scenarios = createCompanionScenarios(65)
    expect(scenarios.map((s) => s.name)).toEqual([
      'Base',
      'Cut $300/mo',
      'Boost Savings $500/mo',
      'Retire 5 years earlier',
      'Conservative spending',
    ])
  })

  it('clamps retire-5-earlier to minimum retirement age', () => {
    const scenarios = createCompanionScenarios(38)
    const retire5 = scenarios.find((s) => s.id === 'retire-5-earlier')
    // 38 - 5 = 33, which is below MIN_COMPANION_RETIREMENT_AGE (35)
    expect(retire5?.overrides.retirementAge).toBe(MIN_COMPANION_RETIREMENT_AGE)
  })
})

describe('resolveScenarioInputs', () => {
  it('returns base values when no overrides', () => {
    const result = resolveScenarioInputs({
      baseAnnualExpenses: 60_000,
      baseRetirementAge: 65,
      overrides: {},
    })
    expect(result.annualExpenses).toBe(60_000)
    expect(result.retirementAge).toBe(65)
  })

  it('applies negative monthly expense delta', () => {
    const result = resolveScenarioInputs({
      baseAnnualExpenses: 60_000,
      baseRetirementAge: 65,
      overrides: { monthlyExpenseDelta: -500 },
    })
    // 60_000 + (-500 * 12) = 60_000 - 6_000 = 54_000
    expect(result.annualExpenses).toBe(54_000)
  })

  it('clamps expenses to zero when delta exceeds base', () => {
    const result = resolveScenarioInputs({
      baseAnnualExpenses: 12_000,
      baseRetirementAge: 65,
      overrides: { monthlyExpenseDelta: -2000 },
    })
    // 12_000 + (-2000 * 12) = -12_000, clamped to 0
    expect(result.annualExpenses).toBe(0)
  })

  it('clamps retirement age to min/max bounds', () => {
    const result = resolveScenarioInputs({
      baseAnnualExpenses: 60_000,
      baseRetirementAge: 65,
      overrides: { retirementAge: 30 },
      minRetirementAge: 40,
      maxRetirementAge: 80,
    })
    expect(result.retirementAge).toBe(40)
  })

  it('uses MIN_COMPANION_RETIREMENT_AGE as default floor', () => {
    const result = resolveScenarioInputs({
      baseAnnualExpenses: 60_000,
      baseRetirementAge: 65,
      overrides: { retirementAge: 30 },
    })
    expect(result.retirementAge).toBe(MIN_COMPANION_RETIREMENT_AGE)
  })
})
