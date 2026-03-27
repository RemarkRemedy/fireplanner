import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  REAL_RETURN,
  FIRE_MULTIPLIER,
  computeSmartGoalCost,
  computeMonthlySavingsNeeded,
  computeGoalFeasibility,
  computeMultiGoalStacking,
  computeRetirementImpact,
  mapGoalToHouseholdGoalItem,
} from './goal-calculator'
import type {
  GoalCalcGoal,
  GoalCalcBasics,
  SmartGoalInputs,
} from './goal-calculator'

// ============================================================
// computeSmartGoalCost
// ============================================================

describe('computeSmartGoalCost', () => {
  it('HDB 4-room resale has down payment + BSD + legal + reno items', () => {
    const inputs: SmartGoalInputs = {
      kind: 'hdb',
      flatType: '4-room',
      tenure: 'resale',
      loanType: 'hdb-loan',
    }
    const result = computeSmartGoalCost(inputs)

    const labels = result.items.map((i) => i.label)
    expect(labels).toContain('Down payment')
    expect(labels).toContain('BSD')
    expect(labels).toContain('Legal fees')
    expect(labels).toContain('Renovation')

    // All items should have positive amounts
    for (const item of result.items) {
      expect(item.amount).toBeGreaterThan(0)
    }

    // Total should equal sum of items
    const sum = result.items.reduce((acc, i) => acc + i.amount, 0)
    expect(result.total).toBeCloseTo(sum, 0)
  })

  it('condo has ABSD $0 line item', () => {
    const inputs: SmartGoalInputs = {
      kind: 'condo',
      price: 1_500_000,
    }
    const result = computeSmartGoalCost(inputs)

    const absdItem = result.items.find((i) => i.label === 'ABSD (first property)')
    expect(absdItem).toBeDefined()
    expect(absdItem!.amount).toBe(0)

    const labels = result.items.map((i) => i.label)
    expect(labels).toContain('Down payment (25%)')
    expect(labels).toContain('BSD')
    expect(labels).toContain('Legal fees')
    expect(labels).toContain('Renovation')
  })

  it('landed has ABSD $0 line item and landed-specific costs', () => {
    const inputs: SmartGoalInputs = {
      kind: 'landed',
      price: 5_000_000,
    }
    const result = computeSmartGoalCost(inputs)

    const absdItem = result.items.find((i) => i.label === 'ABSD (first property)')
    expect(absdItem).toBeDefined()
    expect(absdItem!.amount).toBe(0)

    // Landed renovation estimate is higher than condo
    const renoItem = result.items.find((i) => i.label === 'Renovation')
    expect(renoItem).toBeDefined()
    expect(renoItem!.amount).toBe(100_000) // landed renovation estimate
  })

  it('car has COE + OMV + ARF items', () => {
    const inputs: SmartGoalInputs = {
      kind: 'car',
      coeCategory: 'A',
      condition: 'new',
      priceRange: 40_000,
    }
    const result = computeSmartGoalCost(inputs)

    const labels = result.items.map((i) => i.label)
    expect(labels).toContain('COE')
    expect(labels).toContain('OMV')
    expect(labels).toContain('ARF')

    expect(result.total).toBeGreaterThan(0)

    // Total should equal sum of items
    const sum = result.items.reduce((acc, i) => acc + i.amount, 0)
    expect(result.total).toBeCloseTo(sum, 0)
  })

  it('used car has COE = 0', () => {
    const inputs: SmartGoalInputs = {
      kind: 'car',
      coeCategory: 'B',
      condition: 'used',
      priceRange: 30_000,
    }
    const result = computeSmartGoalCost(inputs)

    const coeItem = result.items.find((i) => i.label === 'COE')
    expect(coeItem).toBeDefined()
    expect(coeItem!.amount).toBe(0)
  })
})

// ============================================================
// computeMonthlySavingsNeeded
// ============================================================

describe('computeMonthlySavingsNeeded', () => {
  it('returns 0 when existing savings cover the goal', () => {
    const result = computeMonthlySavingsNeeded(100_000, 200_000, 10)
    expect(result).toBe(0)
  })

  it('returns positive for realistic goal', () => {
    const result = computeMonthlySavingsNeeded(500_000, 50_000, 15)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(500_000 / 12) // less than paying it all in one year
  })

  it('1-year horizon gives a reasonable result', () => {
    const result = computeMonthlySavingsNeeded(120_000, 0, 1)
    expect(result).toBeGreaterThan(0)
    // Should be close to 10K/month (120K / 12)
    expect(result).toBeLessThan(12_000)
  })

  it('returns Infinity for zero horizon', () => {
    expect(computeMonthlySavingsNeeded(100_000, 0, 0)).toBe(Infinity)
  })

  it('returns Infinity for negative horizon', () => {
    expect(computeMonthlySavingsNeeded(100_000, 0, -5)).toBe(Infinity)
  })

  it('property test: PMT accumulates to goal amount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10_000, max: 2_000_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 1, max: 40 }),
        (goalAmount, savings, years) => {
          const monthly = computeMonthlySavingsNeeded(goalAmount, savings, years)
          if (monthly === 0) {
            // Savings already cover the goal via growth
            const fvSavings = savings * Math.pow(1 + REAL_RETURN, years)
            expect(fvSavings).toBeGreaterThanOrEqual(goalAmount)
            return
          }

          // Simulate annual PMT accumulation
          const annualPmt = monthly * 12
          const r = REAL_RETURN
          let accumulated: number
          if (Math.abs(r) < 1e-10) {
            accumulated = savings + annualPmt * years
          } else {
            // FV of existing savings + FV of annuity
            const fvSavings = savings * Math.pow(1 + r, years)
            const fvAnnuity = annualPmt * ((Math.pow(1 + r, years) - 1) / r)
            accumulated = fvSavings + fvAnnuity
          }

          // Allow 1% tolerance for rounding
          expect(accumulated).toBeGreaterThanOrEqual(goalAmount * 0.99)
          expect(accumulated).toBeLessThanOrEqual(goalAmount * 1.01)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ============================================================
// computeGoalFeasibility
// ============================================================

describe('computeGoalFeasibility', () => {
  it('green when needed is well within capacity', () => {
    const result = computeGoalFeasibility(500, 2000)
    expect(result.level).toBe('green')
    expect(result.feasible).toBe(true)
    expect(result.shortfall).toBe(0)
  })

  it('amber when ratio > 0.8 but still feasible', () => {
    const result = computeGoalFeasibility(900, 1000)
    expect(result.level).toBe('amber')
    expect(result.feasible).toBe(true)
    expect(result.shortfall).toBe(0)
  })

  it('red when needed exceeds available', () => {
    const result = computeGoalFeasibility(1500, 1000)
    expect(result.level).toBe('red')
    expect(result.feasible).toBe(false)
    expect(result.shortfall).toBe(500)
  })

  it('red when available is 0', () => {
    const result = computeGoalFeasibility(500, 0)
    expect(result.level).toBe('red')
    expect(result.feasible).toBe(false)
    expect(result.shortfall).toBe(500)
  })

  it('red when available is negative', () => {
    const result = computeGoalFeasibility(500, -100)
    expect(result.level).toBe('red')
    expect(result.feasible).toBe(false)
    expect(result.shortfall).toBe(500)
  })

  it('green when needed is exactly 0', () => {
    const result = computeGoalFeasibility(0, 1000)
    expect(result.level).toBe('green')
    expect(result.feasible).toBe(true)
    expect(result.shortfall).toBe(0)
  })
})

// ============================================================
// computeMultiGoalStacking
// ============================================================

describe('computeMultiGoalStacking', () => {
  const basics: GoalCalcBasics = {
    age: 30,
    monthlyIncome: 8000,
    monthlyExpenses: 3000,
    existingSavings: 50_000,
  }

  function makeGoal(overrides: Partial<GoalCalcGoal>): GoalCalcGoal {
    return {
      id: 'g1',
      category: 'housing',
      label: 'Test Goal',
      targetAge: 35,
      totalCostToday: 100_000,
      breakdown: { items: [], total: 100_000 },
      monthlySavingsNeeded: 1000,
      feasible: true,
      shortfallPerMonth: 0,
      ...overrides,
    }
  }

  it('sorts by targetAge ascending', () => {
    const goals = [
      makeGoal({ id: 'g2', targetAge: 40, monthlySavingsNeeded: 500 }),
      makeGoal({ id: 'g1', targetAge: 35, monthlySavingsNeeded: 1000 }),
      makeGoal({ id: 'g3', targetAge: 38, monthlySavingsNeeded: 800 }),
    ]

    const result = computeMultiGoalStacking(goals, basics)
    expect(result.map((r) => r.goal.id)).toEqual(['g1', 'g3', 'g2'])
  })

  it('flags later goals infeasible when capacity exhausted', () => {
    const goals = [
      makeGoal({ id: 'g1', targetAge: 35, monthlySavingsNeeded: 4000 }),
      makeGoal({ id: 'g2', targetAge: 40, monthlySavingsNeeded: 2000 }),
    ]

    const result = computeMultiGoalStacking(goals, basics)

    // First goal takes 4000 of 5000 available
    expect(result[0].stackedFeasibility.level).not.toBe('red')
    expect(result[0].remainingCapacity).toBe(1000)

    // Second goal needs 2000 but only 1000 remains
    expect(result[1].stackedFeasibility.level).toBe('red')
    expect(result[1].stackedFeasibility.feasible).toBe(false)
  })

  it('all goals feasible when total fits in budget', () => {
    const goals = [
      makeGoal({ id: 'g1', targetAge: 35, monthlySavingsNeeded: 1000 }),
      makeGoal({ id: 'g2', targetAge: 40, monthlySavingsNeeded: 1000 }),
    ]

    const result = computeMultiGoalStacking(goals, basics)
    for (const r of result) {
      expect(r.stackedFeasibility.feasible).toBe(true)
    }
  })
})

// ============================================================
// computeRetirementImpact
// ============================================================

describe('computeRetirementImpact', () => {
  const basics: GoalCalcBasics = {
    age: 30,
    monthlyIncome: 8000,
    monthlyExpenses: 3000,
    existingSavings: 100_000,
  }

  it('positive delta for realistic scenario', () => {
    const result = computeRetirementImpact(basics, 2000, 0)
    expect(result.deltaYears).toBeGreaterThan(0)
    expect(result.yearsWithGoals).toBeGreaterThan(result.yearsWithoutGoals)
  })

  it('fullyCommitted when all savings consumed', () => {
    // If monthly savings allocated to goals equals or exceeds income - expenses
    const result = computeRetirementImpact(basics, 5000, 0)
    expect(result.fullyCommitted).toBe(true)
  })

  it('adjustedPortfolioBase deducts allocated savings', () => {
    const result = computeRetirementImpact(basics, 1000, 30_000)
    expect(result.adjustedPortfolioBase).toBe(70_000)
  })

  it('adjustedPortfolioBase floors at 0', () => {
    const result = computeRetirementImpact(basics, 1000, 200_000)
    expect(result.adjustedPortfolioBase).toBe(0)
  })

  it('zero goal savings means no delta', () => {
    const result = computeRetirementImpact(basics, 0, 0)
    expect(result.deltaYears).toBeCloseTo(0, 1)
  })
})

// ============================================================
// mapGoalToHouseholdGoalItem
// ============================================================

describe('mapGoalToHouseholdGoalItem', () => {
  it('all GoalItem fields set correctly', () => {
    const goal: GoalCalcGoal = {
      id: 'goal-abc',
      category: 'housing',
      label: 'My HDB',
      targetAge: 35,
      totalCostToday: 150_000,
      breakdown: { items: [], total: 150_000 },
      monthlySavingsNeeded: 2000,
      feasible: true,
      shortfallPerMonth: 0,
    }

    const item = mapGoalToHouseholdGoalItem(goal)

    expect(item.id).toBe('goal-abc')
    expect(item.owner).toBe('self')
    expect(item.label).toBe('My HDB')
    expect(item.kind).toBe('financial-goal')
    expect(item.timing).toEqual({ kind: 'single-age', owner: 'self', age: 35 })
    expect(item.amount).toBe(150_000)
    expect(item.amountSaved).toBe(0)
    expect(item.durationYears).toBe(1)
    expect(item.priority).toBe('important')
    expect(item.inflationAdjusted).toBe(true)
    expect(item.category).toBe('housing')
  })
})

// ============================================================
// Constants
// ============================================================

describe('constants', () => {
  it('REAL_RETURN is 3.6%', () => {
    expect(REAL_RETURN).toBe(0.036)
  })

  it('FIRE_MULTIPLIER is 28', () => {
    expect(FIRE_MULTIPLIER).toBe(28)
  })
})
