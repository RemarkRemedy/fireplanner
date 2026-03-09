import { describe, expect, it } from 'vitest'
import type { PlannerSnapshotResponse } from '@/lib/companion/types'
import { fromExpenseImport } from '@/lib/household/fromExpenseImport'

function makeSnapshot(
  overrides: Partial<PlannerSnapshotResponse> = {},
): PlannerSnapshotResponse {
  return {
    schemaVersion: 1,
    avgMonthlyIncome: 8_000,
    avgMonthlyExpense: 4_500,
    avgMonthlySavings: 3_500,
    investableAssets: 200_000,
    ...overrides,
  }
}

describe('fromExpenseImport', () => {
  it('maps solo imports to an individual household plan', () => {
    const imported = fromExpenseImport(makeSnapshot({
      expenseImport: {
        members: [
          { role: 'self', name: 'Alex', currentAge: 41 },
        ],
      },
    }))

    expect(imported.plan.planType).toBe('individual')
    expect(imported.review.detectedMembers.map((member) => member.role)).toEqual(['self'])
  })

  it('normalizes member roles case-insensitively and ignores malformed rows for fallback role ordering', () => {
    const imported = fromExpenseImport(makeSnapshot({
      expenseImport: {
        members: [
          null,
          { role: 'SELF', name: 'Alex', currentAge: 41 },
          { name: 'Jamie', currentAge: 39 },
          { name: 'Mia', relationship: 'CHILD', age: 8, annualCost: 9_000 },
        ],
      },
    }))

    expect(imported.review.detectedMembers.map((member) => ({
      label: member.label,
      role: member.role,
    }))).toEqual([
      { label: 'Alex', role: 'self' },
      { label: 'Jamie', role: 'partner' },
      { label: 'Mia', role: 'dependent' },
    ])
  })

  it('does not subtract dependent income from the primary-adult residual (dependents are not income entities)', () => {
    const imported = fromExpenseImport(makeSnapshot({
      avgMonthlyIncome: 10_000,
      expenseImport: {
        members: [
          { role: 'self', name: 'Alex', currentAge: 41 },
          { role: 'dependent', name: 'Mia', relationship: 'child', age: 17, annualIncome: 12_000, annualCost: 4_000 },
        ],
      },
    }))

    const selfAdult = imported.plan.adults.find((adult) => adult.owner === 'self')
    const selfSalary = imported.plan.income.find((income) => income.owner === 'self' && income.kind === 'salary-model')

    expect(imported.plan.planType).toBe('household')
    // Dependent income is not subtracted: 10_000 * 12 = 120_000 (full household total)
    expect(selfAdult?.annualIncome).toBe(120_000)
    expect(selfSalary?.annualAmount).toBe(120_000)
  })

  it('converts monthly-only dependent costs to annual amounts', () => {
    const imported = fromExpenseImport(makeSnapshot({
      expenseImport: {
        members: [
          { role: 'self', name: 'Alex', currentAge: 41 },
          { role: 'dependent', name: 'Sam', relationship: 'child', age: 5, monthlyExpense: 500 },
        ],
      },
    }))

    const dependent = imported.plan.dependents.find((d) => d.label === 'Sam')
    // Monthly -> annual: 500 * 12 = 6_000
    expect(dependent?.annualCost).toBe(6_000)
  })
})
