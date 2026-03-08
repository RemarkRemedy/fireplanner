import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SaveIndicator } from '@/components/layout/SaveIndicator'
import { useHouseholdCpfAdapter } from '@/components/household/adapters/useHouseholdCpfAdapter'
import { InputsPage } from '@/pages/InputsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useUIStore } from '@/stores/useUIStore'
import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'
import { useSectionCompletion } from '@/hooks/useSectionCompletion'

vi.mock('@/lib/household/featureFlag', () => ({
  HOUSEHOLD_PLANNER_V1_FLAG_KEY: 'fireplanner-feature-householdPlannerV1',
  isHouseholdPlannerV1Enabled: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

vi.mock('@/hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: vi.fn(() => ({ fireNumber: 1 })),
}))

vi.mock('@/hooks/useExpenseTrackerDwell', () => ({
  useExpenseTrackerDwell: vi.fn(),
}))

vi.mock('@/hooks/useExpenseTracker', () => ({
  useExpenseTracker: vi.fn(() => ({ isEligible: false })),
}))

vi.mock('@/components/dashboard/StatusPanel', () => ({
  StatusPanel: () => <div>Status panel</div>,
}))

vi.mock('@/components/dashboard/WhatIfPanel', () => ({
  WhatIfPanel: () => <div>What-if panel</div>,
}))

vi.mock('@/components/dashboard/TimeCostPanel', () => ({
  TimeCostPanel: () => <div>Time cost panel</div>,
}))

vi.mock('@/components/dashboard/OneMoreYearPanel', () => ({
  OneMoreYearPanel: () => <div>One more year panel</div>,
}))

vi.mock('@/components/dashboard/CashFlowPanel', () => ({
  CashFlowPanel: () => <div>Cash flow panel</div>,
}))

vi.mock('@/components/dashboard/RiskDashboard', () => ({
  RiskDashboard: () => <div>Risk dashboard</div>,
}))

vi.mock('@/components/dashboard/EmptyDashboardState', () => ({
  EmptyDashboardState: () => <div>Empty dashboard</div>,
}))

vi.mock('@/components/dashboard/StrategyCard', () => ({
  StrategyCard: () => <div>Strategy card</div>,
}))

vi.mock('@/components/dashboard/PassiveIncomePanel', () => ({
  PassiveIncomePanel: () => <div>Passive income panel</div>,
}))

vi.mock('@/components/dashboard/TrajectoryPanel', () => ({
  TrajectoryPanel: () => <div>Trajectory panel</div>,
}))

vi.mock('@/components/email/ExpenseTrackerCard', () => ({
  ExpenseTrackerCard: () => <div>Expense tracker card</div>,
}))

const mockIsHouseholdPlannerV1Enabled = vi.mocked(isHouseholdPlannerV1Enabled)

function resetUiStore() {
  useUIStore.setState({
    sectionOrder: 'goal-first',
    statsPosition: 'bottom',
    cpfEnabled: true,
    propertyEnabled: false,
    healthcareEnabled: false,
    mode: 'simple',
    sectionOverrides: {},
    dismissedNudges: [],
    helpPanelOpen: true,
    dollarBasis: 'nominal',
    lastSeenChangelogDate: null,
    lastSeenDataVintage: null,
    showNewPurchase: false,
    collapsedSections: [],
    quickModeActive: false,
    contextualNudgeActive: false,
  })
}

function makeCouplePlan(options?: {
  includePartnerIncome?: boolean
  planType?: 'couple' | 'household'
}) {
  const plan = structuredClone(useHouseholdPlanStore.getState().plan)
  const self = structuredClone(plan.adults[0]!)
  const partner = structuredClone(self)

  self.id = 'adult-self'
  self.displayName = 'Taylor'
  self.cpf.balances.oa = 18_000
  self.cpf.balances.sa = 9_000
  self.cpf.balances.ma = 7_500
  self.cpf.oaWithdrawals = [
    { id: 'self-oa-1', label: 'Self OA bridge', amount: 12_000, age: 55 },
  ]

  partner.id = 'adult-partner'
  partner.owner = 'partner'
  partner.displayName = 'Pat'
  partner.currentAge = 32
  partner.retirementAge = 64
  partner.lifeExpectancy = 92
  partner.annualIncome = 68_000
  partner.cpf.balances.oa = 21_000
  partner.cpf.balances.sa = 11_000
  partner.cpf.balances.ma = 8_500
  partner.cpf.cpfisEnabled = true
  partner.cpf.cpfisOaReturn = 0.06
  partner.cpf.lifeStartAge = 67
  partner.cpf.oaWithdrawals = [
    { id: 'partner-oa-1', label: 'Partner OA bridge', amount: 9_000, age: 57 },
  ]

  plan.planType = options?.planType ?? 'couple'
  plan.adults = [self, partner]
  if (plan.properties[0]) {
    plan.properties[0] = {
      ...structuredClone(plan.properties[0]),
      ownsProperty: false,
      propertyCount: 0,
      purchasePrice: 0,
      existingPropertyValue: 0,
      existingMortgageBalance: 0,
      existingMonthlyPayment: 0,
      mortgageCpfMonthly: 0,
    }
  }
  plan.income[0] = {
    ...structuredClone(plan.income[0]!),
    id: 'income-salary-self',
    owner: 'self',
    label: 'Self salary',
    annualAmount: 95_000,
    timing: {
      kind: 'age-range',
      owner: 'self',
      startAge: self.currentAge,
      endAge: self.retirementAge,
    },
  }

  if (options?.includePartnerIncome) {
    plan.income.push({
      ...structuredClone(plan.income[0]!),
      id: 'income-salary-partner',
      owner: 'partner',
      label: 'Partner salary',
      annualAmount: 68_000,
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: partner.currentAge,
        endAge: partner.retirementAge,
      },
    })
  }

  return plan
}

function setHouseholdPlan(plan = makeCouplePlan()) {
  useHouseholdPlanStore.getState().setPlan(plan, {
    source: 'manual',
    initializedAt: '2026-03-07T00:00:00.000Z',
  })
}

beforeEach(() => {
  localStorage.removeItem('fireplanner-profile')
  localStorage.removeItem('fireplanner-income')
  localStorage.removeItem('fireplanner-property')
  localStorage.removeItem('fireplanner-ui')
  localStorage.removeItem('fireplanner-household-plan-v1')

  useProfileStore.getState().reset()
  useIncomeStore.getState().reset()
  useAllocationStore.getState().reset()
  usePropertyStore.getState().reset()
  useHouseholdPlanStore.getState().reset()
  resetUiStore()
  mockIsHouseholdPlannerV1Enabled.mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Household CPF prototype', () => {
  it('reads and writes CPF fields against the selected household adult', () => {
    setHouseholdPlan(makeCouplePlan({ includePartnerIncome: true }))

    const { result } = renderHook(() => useHouseholdCpfAdapter('adult-partner'))

    expect(result.current?.cpfOA).toBe(21_000)
    expect(result.current?.cpfisEnabled).toBe(true)
    expect(result.current?.projection?.some((row) => row.age === 67)).toBe(true)

    act(() => {
      result.current?.setField('cpfOA', 33_000)
      result.current?.setField('cpfAutoFallback', false)
      result.current?.setField('cpfVirtualRebalancingMode', 'always')
      result.current?.addCpfOaWithdrawal({
        id: 'partner-oa-2',
        label: 'Later bridge',
        amount: 6_000,
        age: 58,
      })
      result.current?.updateCpfOaWithdrawal('partner-oa-2', { amount: 7_500 })
      result.current?.removeCpfOaWithdrawal('partner-oa-1')
    })

    const partner = useHouseholdPlanStore.getState().plan.adults.find((adult) => adult.id === 'adult-partner')
    expect(partner?.cpf.balances.oa).toBe(33_000)
    expect(partner?.cpf.autoFallback).toBe(false)
    expect(partner?.cpf.virtualRebalancingMode).toBe('always')
    expect(partner?.cpf.oaWithdrawals).toEqual([
      { id: 'partner-oa-2', label: 'Later bridge', amount: 7_500, age: 58 },
    ])
  })

  it('renders the household editor shell and adapted CPF section for couple plans', () => {
    setHouseholdPlan(makeCouplePlan())

    render(
      <MemoryRouter initialEntries={['/inputs']}>
        <InputsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Couple Inputs')).toBeInTheDocument()
    expect(screen.getByText('Adapter pattern checkpoint')).toBeInTheDocument()
    expect(screen.getByText('People & Household')).toBeInTheDocument()
    expect(screen.getByText('Current CPF Status')).toBeInTheDocument()
    expect(screen.getAllByText('Household editor note').length).toBeGreaterThan(0)
  })

  it('keeps household CPF callbacks stable across unrelated household rerenders', () => {
    setHouseholdPlan(makeCouplePlan({ includePartnerIncome: true }))

    const { result } = renderHook(() => useHouseholdCpfAdapter('adult-partner'))
    const firstSetField = result.current?.setField
    const firstAddWithdrawal = result.current?.addCpfOaWithdrawal
    const firstRemoveWithdrawal = result.current?.removeCpfOaWithdrawal
    const firstUpdateWithdrawal = result.current?.updateCpfOaWithdrawal

    act(() => {
      useHouseholdPlanStore.getState().updateAdult('adult-self', { displayName: 'Taylor Tan' })
    })

    expect(result.current?.setField).toBe(firstSetField)
    expect(result.current?.addCpfOaWithdrawal).toBe(firstAddWithdrawal)
    expect(result.current?.removeCpfOaWithdrawal).toBe(firstRemoveWithdrawal)
    expect(result.current?.updateCpfOaWithdrawal).toBe(firstUpdateWithdrawal)
  })

  it('surfaces household CPF validation errors in section completion', () => {
    const plan = makeCouplePlan()
    plan.adults[1] = {
      ...plan.adults[1]!,
      cpf: {
        ...plan.adults[1]!.cpf,
        cpfisOaReturn: 0.25,
      },
    }

    localStorage.setItem('fireplanner-feature-householdPlannerV1', '1')
    setHouseholdPlan(plan)

    const { result } = renderHook(() => useSectionCompletion())

    expect(result.current.sections['section-cpf'].status).toBe('error')
    expect(result.current.sections['section-cpf'].errorCount).toBeGreaterThan(0)
  })

  it('shows the save indicator for household plan edits during the mixed-mode window', () => {
    vi.useFakeTimers()
    setHouseholdPlan(makeCouplePlan())

    render(<SaveIndicator />)

    act(() => {
      vi.advanceTimersByTime(1_001)
    })

    act(() => {
      useHouseholdPlanStore.getState().updateAdult('adult-self', { displayName: 'Taylor Tan' })
    })

    expect(screen.getByText('Saved')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2_001)
    })

    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('uses household-aware dashboard prompts when the plan is not fully configured', () => {
    setHouseholdPlan(makeCouplePlan({ includePartnerIncome: false }))

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Income & Work')).toBeInTheDocument()
    expect(screen.getByText('Spending & Goals')).toBeInTheDocument()
    expect(screen.getByText('Assets & Net Worth')).toBeInTheDocument()
    expect(screen.queryByText('Personal Details')).not.toBeInTheDocument()
  })
})
