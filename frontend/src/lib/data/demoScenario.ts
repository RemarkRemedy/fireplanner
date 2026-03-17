/**
 * Demo scenario data for the "Explore a demo" button on the quick estimate page.
 * Represents a typical 32-year-old SG citizen with HDB property.
 */

import type { SetupDraft } from '@/lib/household/setupDraft'
import type { HouseholdPlanType } from '@/lib/household/types'

export const DEMO_SCENARIO_DRAFT: SetupDraft = {
  currentAge: 32,
  retirementAge: 55,
  annualIncome: 84_000,
  incomeType: 'gross',
  annualExpenses: 42_000,
  liquidNetWorth: 80_000,
  residency: 'citizen',
  cpfKnown: true,
  cpfBreakdown: { oa: 25_000, sa: 15_000, ma: 5_000, ra: 0 },
  ownsProperty: 'owns',
  propertyType: 'hdb',
  propertyValue: 500_000,
  mortgageBalance: 200_000,
  healthcareEnabled: true,
  isRedo: false,
}

export const DEMO_PLAN_TYPE: HouseholdPlanType = 'individual'
