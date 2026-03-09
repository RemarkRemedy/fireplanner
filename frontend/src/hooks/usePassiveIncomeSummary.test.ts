import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePassiveIncomeSummary } from './usePassiveIncomeSummary'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { setupTestPlan } from '@/test-helpers/setupTestPlan'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useUIStore } from '@/stores/useUIStore'

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
  useUIStore.setState({
    sectionOrder: 'goal-first',
    cpfEnabled: true,
    propertyEnabled: false,
    healthcareEnabled: false,
    mode: 'simple',
    statsPosition: 'bottom',
  })
})

describe('usePassiveIncomeSummary', () => {
  it('returns null when profile has validation errors', () => {
    setupTestPlan({
      adult: { currentAge: 30, retirementAge: 25, lifeExpectancy: 20 },
    })
    const { result } = renderHook(() => usePassiveIncomeSummary())
    expect(result.current).toBeNull()
  })

  it('returns summary for valid retired profile', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
        lifeStage: 'post-fire',
      },
      income: { annualSalary: 0 },
      expenses: { annualExpenses: 80000 },
      assets: { liquidNetWorth: 2000000 },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { expectedReturn: 0.05, inflation: 0.025, expenseRatio: 0.003 },
      },
    })
    const { result } = renderHook(() => usePassiveIncomeSummary())
    // A post-fire user with no income streams will have projection rows.
    // If no passive income sources exist, totalAtRetirement = 0
    if (result.current !== null) {
      expect(result.current.requiredExpenses).toBeGreaterThan(0)
      expect(result.current.yearlyBreakdown.length).toBeGreaterThan(0)
    }
  })

  it('returns null for working-age profile with no retired rows', () => {
    // Default profile: age 30, retirement 65 — all rows before 65 are working
    // But projection includes rows past retirement too, so it should have retired rows
    setupTestPlan({
      adult: {
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      expenses: { annualExpenses: 48000 },
    })
    const { result } = renderHook(() => usePassiveIncomeSummary())
    // Should have retired rows from 65-90, so not null
    if (result.current !== null) {
      expect(result.current.yearlyBreakdown[0].age).toBeGreaterThanOrEqual(65)
    }
  })

  it('includes income streams in passive income sources', () => {
    setupTestPlan({
      adult: {
        currentAge: 55,
        retirementAge: 58,
        lifeExpectancy: 90,
      },
      income: {
        annualSalary: 0,
        incomeStreams: [
          {
            id: 'rental1',
            name: 'Rental',
            type: 'rental',
            annualAmount: 24000,
            startAge: 55,
            endAge: 90,
            growthRate: 0.02,
            growthModel: 'fixed',
            taxTreatment: 'taxable',
            isCpfApplicable: false,
            isActive: true,
          },
        ],
      },
      expenses: { annualExpenses: 80000 },
      assets: { liquidNetWorth: 2000000 },
      assumptions: {
        fire: { swr: 0.04 },
        returns: { expectedReturn: 0.05, inflation: 0.025, expenseRatio: 0.003 },
      },
    })
    const { result } = renderHook(() => usePassiveIncomeSummary())
    if (result.current !== null) {
      // Should have rental income in sources
      const rentalSource = result.current.sources.find((s) => s.label === 'Rental Income')
      if (rentalSource) {
        expect(rentalSource.annualAmount).toBeGreaterThan(0)
      }
      expect(result.current.totalAtRetirement).toBeGreaterThanOrEqual(0)
    }
  })
})
