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

  it('car shows down payment (40%) as the savings goal', () => {
    const inputs: SmartGoalInputs = {
      kind: 'car',
      coeCategory: 'A',
      condition: 'new',
      priceRange: 40_000,
    }
    const result = computeSmartGoalCost(inputs)

    const labels = result.items.map((i) => i.label)
    expect(labels).toContain('Down payment (40%)')
    expect(labels.some((l) => l.includes('Estimated total price'))).toBe(true)

    // Total is the down payment only (40% of full price), not the full car cost
    const dpItem = result.items.find((i) => i.label === 'Down payment (40%)')!
    const totalItem = result.items.find((i) => i.label.includes('Estimated total price'))!
    expect(dpItem.amount).toBeCloseTo(totalItem.amount * 0.40, 0)
    expect(result.total).toBe(dpItem.amount)
  })

  it('used car down payment is 40% of price (COE already included)', () => {
    const inputs: SmartGoalInputs = {
      kind: 'car',
      coeCategory: 'B',
      condition: 'used',
      priceRange: 30_000,
    }
    const result = computeSmartGoalCost(inputs)

    const dpItem = result.items.find((i) => i.label === 'Down payment (40%)')!
    expect(dpItem).toBeDefined()
    expect(result.total).toBe(dpItem.amount)
  })

  it('EC has down payment + BSD + legal + reno, no ABSD', () => {
    const inputs: SmartGoalInputs = {
      kind: 'ec',
      price: 1_500_000,
      flatType: '4-room',
    }
    const result = computeSmartGoalCost(inputs)

    const labels = result.items.map((i) => i.label)
    expect(labels).toContain('Down payment (25%)')
    expect(labels).toContain('BSD')
    expect(labels).toContain('Legal fees')
    expect(labels).toContain('Renovation')

    // EC should NOT have ABSD line item (unlike condo)
    const absdItem = result.items.find((i) => i.label === 'ABSD (first property)')
    expect(absdItem).toBeUndefined()

    // All items should have positive amounts
    for (const item of result.items) {
      expect(item.amount).toBeGreaterThan(0)
    }

    // Total should equal sum of items
    const sum = result.items.reduce((acc, i) => acc + i.amount, 0)
    expect(result.total).toBeCloseTo(sum, 0)
    expect(result.total).toBeGreaterThan(0)
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

          // Simulate monthly PMT accumulation
          const r = REAL_RETURN
          const monthlyRate = Math.pow(1 + r, 1 / 12) - 1
          const totalMonths = years * 12
          let accumulated: number
          if (Math.abs(monthlyRate) < 1e-10) {
            accumulated = savings + monthly * totalMonths
          } else {
            // FV of existing savings + FV of monthly annuity
            const fvSavings = savings * Math.pow(1 + r, years)
            const fvAnnuity = monthly * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate)
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
    // basics: age 30, income 8000, expenses 3000 → capacity = 5000/mo
    const expensiveBasics: GoalCalcBasics = {
      age: 30,
      monthlyIncome: 8000,
      monthlyExpenses: 3000,
      existingSavings: 10_000,
    }

    const goals = [
      makeGoal({
        id: 'g1',
        targetAge: 33, // 3 years — gets $10K savings, ~$3722/mo
        totalCostToday: 150_000,
        breakdown: { items: [{ label: 'A', amount: 150_000 }], total: 150_000 },
        monthlySavingsNeeded: 999,
      }),
      makeGoal({
        id: 'g2',
        targetAge: 34, // 4 years — gets $0 savings, ~$3948/mo
        totalCostToday: 200_000,
        breakdown: { items: [{ label: 'B', amount: 200_000 }], total: 200_000 },
        monthlySavingsNeeded: 999,
      }),
    ]

    const result = computeMultiGoalStacking(goals, expensiveBasics)

    // First goal takes ~$3722 of $5000 capacity — feasible
    expect(result[0].stackedFeasibility.level).not.toBe('red')
    expect(result[0].allocatedSavings).toBe(10_000)

    // Second goal needs ~$3948 but only ~$1278 remains — infeasible
    expect(result[1].stackedFeasibility.level).toBe('red')
    expect(result[1].stackedFeasibility.feasible).toBe(false)
    expect(result[1].allocatedSavings).toBe(0)
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

  it('multi-goal stacking depletes lump-sum savings across goals', () => {
    // basics.existingSavings = 50_000, basics.age = 30
    // Wedding at age 28 is past — but let's use age 33 and 35 to be valid
    const wedding = makeGoal({
      id: 'wedding',
      label: 'Wedding',
      category: 'wedding',
      targetAge: 33, // 3 years away — gets savings first (earlier targetAge)
      totalCostToday: 50_000,
      breakdown: { items: [{ label: 'Wedding', amount: 50_000 }], total: 50_000 },
      monthlySavingsNeeded: 999, // pre-stacking value (will be recomputed)
    })
    const hdb = makeGoal({
      id: 'hdb',
      label: 'HDB',
      category: 'housing',
      targetAge: 35, // 5 years away — gets remaining savings
      totalCostToday: 90_000,
      breakdown: { items: [{ label: 'HDB costs', amount: 90_000 }], total: 90_000 },
      monthlySavingsNeeded: 999, // pre-stacking value (will be recomputed)
    })

    const result = computeMultiGoalStacking([hdb, wedding], basics)

    // Wedding (earlier targetAge) should get the full $50K
    expect(result[0].goal.id).toBe('wedding')
    expect(result[0].allocatedSavings).toBe(50_000)
    // Wedding's $50K fully covered by savings → monthly should be 0
    expect(result[0].adjustedMonthlySavings).toBe(0)

    // HDB (later targetAge) should get $0 savings
    expect(result[1].goal.id).toBe('hdb')
    expect(result[1].allocatedSavings).toBe(0)
    // HDB needs full $90K from monthly savings — higher than if it had $50K
    const hdbMonthlyWithNoSavings = computeMonthlySavingsNeeded(90_000, 0, 5)
    expect(result[1].adjustedMonthlySavings).toBeCloseTo(hdbMonthlyWithNoSavings, 2)
    expect(result[1].adjustedMonthlySavings).toBeGreaterThan(0)
  })

  it('single goal uses full savings (no regression)', () => {
    const goal = makeGoal({
      id: 'g1',
      targetAge: 35,
      totalCostToday: 100_000,
      breakdown: { items: [{ label: 'Cost', amount: 100_000 }], total: 100_000 },
      monthlySavingsNeeded: 999, // will be recomputed
    })

    const result = computeMultiGoalStacking([goal], basics)

    // Single goal should get the full $50K savings
    expect(result[0].allocatedSavings).toBe(50_000)
    // Recomputed monthly should match direct computation
    const expected = computeMonthlySavingsNeeded(100_000, 50_000, 5)
    expect(result[0].adjustedMonthlySavings).toBeCloseTo(expected, 2)
  })

  it('savings depleted across 3 goals', () => {
    const basicsSmall: GoalCalcBasics = {
      age: 30,
      monthlyIncome: 8000,
      monthlyExpenses: 3000,
      existingSavings: 30_000,
    }

    const g1 = makeGoal({
      id: 'g1',
      targetAge: 32, // earliest — gets savings first
      totalCostToday: 20_000,
      breakdown: { items: [{ label: 'A', amount: 20_000 }], total: 20_000 },
      monthlySavingsNeeded: 999,
    })
    const g2 = makeGoal({
      id: 'g2',
      targetAge: 34,
      totalCostToday: 40_000,
      breakdown: { items: [{ label: 'B', amount: 40_000 }], total: 40_000 },
      monthlySavingsNeeded: 999,
    })
    const g3 = makeGoal({
      id: 'g3',
      targetAge: 36,
      totalCostToday: 60_000,
      breakdown: { items: [{ label: 'C', amount: 60_000 }], total: 60_000 },
      monthlySavingsNeeded: 999,
    })

    const result = computeMultiGoalStacking([g3, g1, g2], basicsSmall)

    // g1 (age 32) gets up to $20K (capped by goal cost)
    expect(result[0].goal.id).toBe('g1')
    expect(result[0].allocatedSavings).toBe(20_000)

    // g2 (age 34) gets remaining $10K
    expect(result[1].goal.id).toBe('g2')
    expect(result[1].allocatedSavings).toBe(10_000)

    // g3 (age 36) gets $0
    expect(result[2].goal.id).toBe('g3')
    expect(result[2].allocatedSavings).toBe(0)
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
