import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import { HouseholdOverviewBar } from '@/components/household/HouseholdOverviewBar'
import { HouseholdMilestoneTimeline } from '@/components/household/HouseholdMilestoneTimeline'
import { HouseholdBreakdownPanel } from '@/components/household/HouseholdBreakdownPanel'
import {
  HOUSEHOLD_PLAN_STORAGE_KEY,
  useHouseholdPlanStore,
} from '@/stores/useHouseholdPlanStore'

function resetHouseholdStore() {
  useHouseholdPlanStore.persist.clearStorage()
  localStorage.removeItem(HOUSEHOLD_PLAN_STORAGE_KEY)
  useHouseholdPlanStore.getState().reset()
}

function makeCompiledPlan() {
  const plan = structuredClone(useHouseholdPlanStore.getState().plan)
  const self = structuredClone(plan.adults[0]!)

  self.id = 'adult-self'
  self.owner = 'self'
  self.displayName = 'Taylor'
  self.currentAge = 34
  self.retirementAge = 60
  self.lifeExpectancy = 90
  self.annualIncome = 120_000
  self.annualExpenses = 0
  self.liquidNetWorth = 180_000
  self.lifeEventsEnabled = false
  self.lifeEvents = []
  self.healthcare = {
    ...self.healthcare,
    enabled: true,
    oopBaseAmount: 1_200,
    oopModel: 'fixed',
    oopInflationRate: 0,
    oopReferenceAge: 34,
  }

  const partner = structuredClone(self)
  partner.id = 'adult-partner'
  partner.owner = 'partner'
  partner.displayName = 'Jordan'
  partner.currentAge = 33
  partner.retirementAge = 58
  partner.lifeExpectancy = 92
  partner.annualIncome = 84_000
  partner.liquidNetWorth = 95_000
  partner.taxProfile = {
    ...partner.taxProfile,
    reliefBasisAge: 33,
  }
  partner.healthcare = {
    ...partner.healthcare,
    enabled: false,
    oopBaseAmount: 0,
  }

  plan.id = 'household-analysis-test'
  plan.planType = 'couple'
  plan.adults = [self, partner]
  plan.dependents = [
    {
      id: 'dependent-maya',
      owner: 'shared',
      label: 'Maya',
      relationship: 'child',
      currentAge: 8,
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 52,
      },
      annualCost: 9_000,
    },
  ]
  plan.income = [
    {
      id: 'income-self-salary',
      owner: 'self',
      label: 'Taylor salary',
      kind: 'salary-model',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 60,
      },
      annualAmount: 120_000,
      growthRate: 0.03,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: true,
      isActive: true,
      streamType: 'employment',
      salaryModel: 'simple',
      bonusMonths: 2,
      employerCpfEnabled: true,
      realisticPhases: [],
      promotionJumps: [],
    },
    {
      id: 'income-partner-salary',
      owner: 'partner',
      label: 'Jordan salary',
      kind: 'salary-model',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 58,
      },
      annualAmount: 84_000,
      growthRate: 0.02,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: true,
      isActive: true,
      streamType: 'employment',
      salaryModel: 'simple',
      bonusMonths: 1,
      employerCpfEnabled: true,
      realisticPhases: [],
      promotionJumps: [],
    },
    {
      id: 'income-shared-rent',
      owner: 'shared',
      label: 'Shared consulting',
      kind: 'income-stream',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 45,
      },
      annualAmount: 18_000,
      growthRate: 0,
      growthModel: 'none',
      taxTreatment: 'taxable',
      isCpfApplicable: false,
      isActive: true,
      streamType: 'business',
    },
  ]
  plan.expenses = [
    {
      id: 'expense-shared-living',
      owner: 'shared',
      label: 'Household living',
      kind: 'base-living',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 90,
      },
      amount: 4_800,
      periodicity: 'monthly',
      growthRate: 0.025,
      inflationAdjusted: true,
      retirementSpendingAdjustment: 0.8,
    },
    {
      id: 'expense-self-hobby',
      owner: 'self',
      label: 'Cycling budget',
      kind: 'expense-adjustment',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 34,
        endAge: 50,
      },
      amount: 250,
      periodicity: 'monthly',
      growthRate: 0,
      inflationAdjusted: false,
    },
    {
      id: 'expense-partner-family',
      owner: 'partner',
      label: 'Jordan family support',
      kind: 'parent-support',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 55,
      },
      amount: 300,
      periodicity: 'monthly',
      growthRate: 0,
      inflationAdjusted: false,
    },
  ]
  plan.assets = [
    {
      id: 'asset-self-cash',
      owner: 'self',
      label: 'Cash reserve',
      kind: 'liquid-net-worth',
      amount: 150_000,
    },
    {
      id: 'asset-shared-study-fund',
      owner: 'shared',
      label: 'Study fund',
      kind: 'locked-asset',
      amount: 40_000,
      unlockAge: 52,
      growthRate: 0.02,
    },
  ]
  plan.goals = [
    {
      id: 'goal-university',
      owner: 'shared',
      label: 'University fund',
      kind: 'financial-goal',
      timing: {
        kind: 'single-age',
        owner: 'self',
        age: 52,
      },
      amount: 50_000,
      durationYears: 1,
      priority: 'important',
      inflationAdjusted: true,
      category: 'education',
    },
  ]
  plan.properties = []

  return compileHouseholdPlan(plan)
}

beforeEach(() => {
  resetHouseholdStore()
})

describe('Household analysis presentation', () => {
  it('renders household coverage, milestones, and owner-scoped breakdowns', async () => {
    const user = userEvent.setup()
    const compiledPlan = makeCompiledPlan()

    render(
      <div className="space-y-4">
        <HouseholdOverviewBar compiledPlan={compiledPlan} />
        <HouseholdMilestoneTimeline compiledPlan={compiledPlan} />
        <HouseholdBreakdownPanel compiledPlan={compiledPlan} />
      </div>,
    )

    expect(screen.getByText('Who this analysis covers')).toBeInTheDocument()
    expect(screen.getByText('Taylor • age 34')).toBeInTheDocument()
    expect(screen.getByText('Jordan • age 33')).toBeInTheDocument()
    expect(screen.getByText('Maya • age 8')).toBeInTheDocument()

    expect(screen.getByText('Timeline highlights')).toBeInTheDocument()
    expect(screen.getByText('Maya support ends')).toBeInTheDocument()
    expect(screen.getByText('University fund')).toBeInTheDocument()
    expect(screen.getByText('Study fund unlocks')).toBeInTheDocument()

    expect(screen.getByText('Why this result looks the way it does')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Shared/i }))

    expect(screen.getByText('Household living')).toBeInTheDocument()
    expect(screen.getByText('Shared consulting')).toBeInTheDocument()
    expect(screen.getByText('Study fund')).toBeInTheDocument()
  })
})
