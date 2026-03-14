import { describe, expect, it, beforeEach } from 'vitest'
import {
  useHouseholdPlanStore,
  HOUSEHOLD_PLAN_STORAGE_KEY,
  HOUSEHOLD_PLAN_STORAGE_VERSION,
} from '@/stores/useHouseholdPlanStore'
import type { PlanningAdult } from '@/lib/household/types'

// NOTE: Zustand getState()/setState() are synchronous and don't trigger
// React re-renders — no act() wrapping needed for direct store calls.

/** Build a couple plan by initializing + adding a partner via addAdult. */
function setupCouplePlan(): { selfId: string; partnerId: string } {
  useHouseholdPlanStore.getState().initializeManualPlan('couple')
  const plan = useHouseholdPlanStore.getState().plan!
  const selfAdult = plan.adults[0]

  // initializeManualPlan('couple') does NOT create a partner adult.
  // Build a full PlanningAdult with owner: 'partner'.
  const partner: PlanningAdult = {
    ...structuredClone(selfAdult),
    id: 'test-partner',
    owner: 'partner',
    displayName: 'Partner',
    currentAge: 28,
    retirementAge: 60,
    lifeExpectancy: 90,
    maritalStatus: 'married',
    annualIncome: 60_000,
    annualExpenses: 20_000,
    liquidNetWorth: 80_000,
  }
  useHouseholdPlanStore.getState().addAdult(partner)

  return { selfId: selfAdult.id, partnerId: 'test-partner' }
}

describe('useHouseholdPlanStore — complex helpers', () => {
  beforeEach(() => {
    localStorage.clear()
    useHouseholdPlanStore.getState().reset()
  })

  describe('removeAdult', () => {
    // NOTE: existing tests in useHouseholdPlanStore.test.ts cover basic
    // removeAdult behavior. These tests focus on CASCADE and REANCHOR
    // logic that is not covered there.

    it('cannot remove the self adult', () => {
      const { selfId } = setupCouplePlan()

      useHouseholdPlanStore.getState().removeAdult(selfId)

      // Self adult should still be there
      const after = useHouseholdPlanStore.getState().plan!
      expect(after.adults.find((a) => a.owner === 'self')).toBeDefined()
    })

    it('removes partner adult and cascades to owned entries', () => {
      const { partnerId } = setupCouplePlan()

      // Add partner-owned income
      useHouseholdPlanStore.getState().addIncome({
        id: 'partner-income',
        owner: 'partner',
        label: 'Partner Salary',
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'partner', startAge: 28, endAge: 55 },
        annualAmount: 60_000,
        growthRate: 0.03,
        growthModel: 'fixed',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
        streamType: 'employment',
        salaryModel: 'simple',
        bonusMonths: 2,
        employerCpfEnabled: true,
      })

      // Remove partner
      useHouseholdPlanStore.getState().removeAdult(partnerId)

      const after = useHouseholdPlanStore.getState().plan!
      // Partner should be gone
      expect(after.adults.find((a) => a.owner === 'partner')).toBeUndefined()
      // Partner-owned income should be cascaded away
      expect(after.income.find((i) => i.id === 'partner-income')).toBeUndefined()
      // Plan type should revert to individual
      expect(after.planType).toBe('individual')
    })

    it('reanchors shared timing from removed partner to self', () => {
      const { partnerId } = setupCouplePlan()

      // Add shared expense with partner timing
      useHouseholdPlanStore.getState().addExpense({
        id: 'shared-exp',
        owner: 'shared',
        label: 'Childcare',
        kind: 'expense-adjustment',
        timing: { kind: 'age-range', owner: 'partner', startAge: 30, endAge: 36 },
        amount: 12_000,
        periodicity: 'annual',
      })

      // Remove partner
      useHouseholdPlanStore.getState().removeAdult(partnerId)

      const after = useHouseholdPlanStore.getState().plan!
      const reanchoredExpense = after.expenses.find((e) => e.id === 'shared-exp')
      // Shared expense should still exist (not removed — it's shared, not partner-owned)
      expect(reanchoredExpense).toBeDefined()
      // Its timing owner should be reanchored from 'partner' to 'self'
      expect(reanchoredExpense!.timing?.owner).toBe('self')
    })
  })

  describe('year-drift migration', () => {
    it('bumps currentAge by year drift when plan was saved in a prior year', async () => {
      // First, create a valid plan so we have the correct shape
      useHouseholdPlanStore.getState().initializeManualPlan('individual')
      const plan = structuredClone(useHouseholdPlanStore.getState().plan!)

      // Simulate a plan saved in 2025 with currentAge=30
      plan.planYear = 2025
      plan.adults[0].currentAge = 30
      plan.adults[0].retirementAge = 55
      plan.adults[0].lifeExpectancy = 85

      // Clear localStorage and write the 2025 plan in zustand persist format.
      // Do NOT call reset() after this — reset() persists a fresh plan back to
      // localStorage, overwriting what we just wrote.
      localStorage.clear()
      const serialized = JSON.stringify({
        state: {
          plan,
          provenance: { source: 'manual', initializedAt: '2025-01-01T00:00:00.000Z' },
        },
        version: HOUSEHOLD_PLAN_STORAGE_VERSION,
      })
      localStorage.setItem(HOUSEHOLD_PLAN_STORAGE_KEY, serialized)

      // Rehydrate — the persist.merge callback should apply year drift
      await useHouseholdPlanStore.persist.rehydrate()

      const rehydrated = useHouseholdPlanStore.getState().plan!
      const nowYear = new Date().getFullYear()
      const expectedDrift = nowYear - 2025

      // currentAge should be bumped by drift
      expect(rehydrated.adults[0].currentAge).toBe(30 + expectedDrift)
      // retirementAge should NOT be bumped (it's a target, not current)
      expect(rehydrated.adults[0].retirementAge).toBe(55)
      // lifeExpectancy should NOT be bumped
      expect(rehydrated.adults[0].lifeExpectancy).toBe(85)
      // planYear should be updated to current year
      expect(rehydrated.planYear).toBe(nowYear)
    })
  })
})
