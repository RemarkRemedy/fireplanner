import type { ExpenseAdjustment } from '@/lib/types'

/**
 * Get the effective annual expenses at a given age, applying all active adjustments.
 * Adjustments are active for [startAge, endAge) — endAge is exclusive.
 * null endAge is resolved to lifeExpectancy (ongoing adjustment).
 * Result is floored at 0.
 */
export function getEffectiveExpenses(
  age: number,
  base: number,
  adjustments: ExpenseAdjustment[],
  lifeExpectancy: number
): number {
  let total = base
  for (const adj of adjustments) {
    const end = adj.endAge ?? lifeExpectancy
    if (age >= adj.startAge && age < end) {
      total += adj.amount
    }
  }
  return Math.max(0, total)
}

/**
 * Get annual expenses at retirement in nominal (future) dollars.
 * Applies expense adjustments at retirementAge, then inflates forward.
 */
export function getExpensesAtRetirement(
  retirementAge: number,
  currentAge: number,
  annualExpenses: number,
  expenseAdjustments: ExpenseAdjustment[],
  lifeExpectancy: number,
  inflation: number
): number {
  const base = getEffectiveExpenses(retirementAge, annualExpenses, expenseAdjustments, lifeExpectancy)
  return base * Math.pow(1 + inflation, Math.max(0, retirementAge - currentAge))
}

export interface ExpensePhase {
  fromAge: number
  toAge: number
  amount: number
}

/**
 * Compute expense phases: contiguous age ranges with the same effective expense.
 * Collects all transition ages from adjustments, sorts them, then evaluates
 * getEffectiveExpenses at each phase to produce a preview.
 */
export function computeExpensePhases(
  base: number,
  adjustments: ExpenseAdjustment[],
  startAge: number,
  endAge: number,
  lifeExpectancy: number
): ExpensePhase[] {
  // Collect all transition ages within the requested range
  const transitionAges = new Set<number>()
  transitionAges.add(startAge)
  transitionAges.add(endAge)

  for (const adj of adjustments) {
    const adjEnd = adj.endAge ?? lifeExpectancy
    if (adj.startAge > startAge && adj.startAge < endAge) {
      transitionAges.add(adj.startAge)
    }
    if (adjEnd > startAge && adjEnd < endAge) {
      transitionAges.add(adjEnd)
    }
  }

  const sorted = Array.from(transitionAges).sort((a, b) => a - b)

  const phases: ExpensePhase[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const fromAge = sorted[i]
    const toAge = sorted[i + 1]
    const amount = getEffectiveExpenses(fromAge, base, adjustments, lifeExpectancy)
    phases.push({ fromAge, toAge, amount })
  }

  // Merge consecutive phases with the same amount
  const merged: ExpensePhase[] = []
  for (const phase of phases) {
    const last = merged[merged.length - 1]
    if (last && last.amount === phase.amount && last.toAge === phase.fromAge) {
      last.toAge = phase.toAge
    } else {
      merged.push({ ...phase })
    }
  }

  return merged
}
