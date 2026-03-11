import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { DashboardPage } from '../DashboardPage'

vi.mock('@/lib/household/featureFlag', () => ({
  isHouseholdPlannerV1Enabled: vi.fn(() => true),
}))

// Mock useDashboardMetrics - return non-empty metrics so isEmpty=false
vi.mock('@/hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: () => ({
    fireNumber: 1_000_000,
    progress: 0.5,
    yearsToFire: 15,
    fireAge: 45,
    coastFireNumber: 500_000,
    baristaFireIncome: 24_000,
    savingsRate: 0.4,
    totalNetWorth: 500_000,
    portfolioDepletedAge: null,
    lifeExpectancy: 85,
    projectionFireNumber: null,
    deviationPct: null,
    showProjectionNumber: false,
    deviationFactors: [],
  }),
}))

vi.mock('@/hooks/useExpenseTracker', () => ({
  useExpenseTracker: () => ({ isEligible: false }),
}))

vi.mock('@/hooks/useExpenseTrackerDwell', () => ({
  useExpenseTrackerDwell: () => ({}),
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: () => ({}),
}))

vi.mock('@/hooks/useSectionCompletion', () => ({
  useSectionCompletion: () => ({
    sections: new Proxy({}, { get: () => ({ isComplete: true }) }),
  }),
}))

// Mock all child panel components so they don't pull in their own hook dependencies.
vi.mock('@/components/dashboard/StatusPanel', () => ({
  StatusPanel: () => <div data-testid="status-panel" />,
}))
vi.mock('@/components/dashboard/TrajectoryPanel', () => ({
  TrajectoryPanel: () => <div data-testid="trajectory-panel" />,
}))
vi.mock('@/components/dashboard/WhatIfPanel', () => ({
  WhatIfPanel: () => <div data-testid="what-if-panel" />,
}))
vi.mock('@/components/dashboard/TimeCostPanel', () => ({
  TimeCostPanel: () => <div data-testid="time-cost-panel" />,
}))
vi.mock('@/components/dashboard/OneMoreYearPanel', () => ({
  OneMoreYearPanel: () => <div data-testid="one-more-year-panel" />,
}))
vi.mock('@/components/dashboard/CashFlowPanel', () => ({
  CashFlowPanel: () => <div data-testid="cash-flow-panel" />,
}))
vi.mock('@/components/dashboard/RiskDashboard', () => ({
  RiskDashboard: () => <div data-testid="risk-dashboard" />,
}))
vi.mock('@/components/dashboard/EmptyDashboardState', () => ({
  EmptyDashboardState: () => <div data-testid="empty-state" />,
}))
vi.mock('@/components/dashboard/StrategyCard', () => ({
  StrategyCard: () => <div data-testid="strategy-card" />,
}))
vi.mock('@/components/dashboard/PassiveIncomePanel', () => ({
  PassiveIncomePanel: () => <div data-testid="passive-income-panel" />,
}))
vi.mock('@/components/email/ExpenseTrackerCard', () => ({
  ExpenseTrackerCard: () => <div data-testid="expense-tracker-card" />,
}))
vi.mock('@/components/dashboard/PerAdultBreakdownPanel', () => ({
  PerAdultBreakdownPanel: () => <div data-testid="per-adult-breakdown-panel" />,
}))

beforeEach(() => {
  useHouseholdPlanStore.getState().reset()
})

afterEach(() => {
  vi.resetAllMocks()
})

function addPartnerAdult() {
  const self = useHouseholdPlanStore.getState().plan.adults[0]
  useHouseholdPlanStore.getState().addAdult({
    ...structuredClone(self),
    id: 'adult-partner',
    owner: 'partner',
    displayName: 'Pat',
    currentAge: 33,
    retirementAge: 60,
    lifeExpectancy: 92,
    annualIncome: 84_000,
    annualExpenses: 0,
    liquidNetWorth: 55_000,
  })
}

function renderDashboard() {
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>)
}

describe('DashboardPage per-adult tabs', () => {
  it('shows no tabs for individual plans', () => {
    useHouseholdPlanStore.getState().initializeManualPlan('individual')
    renderDashboard()
    expect(screen.queryByRole('tab', { name: 'Joint' })).not.toBeInTheDocument()
  })

  it('shows Joint + adult tabs for couple plans', () => {
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    addPartnerAdult()
    renderDashboard()
    expect(screen.getByRole('tab', { name: 'Joint' })).toBeInTheDocument()
  })

  it('clicking adult tab shows per-adult breakdown', async () => {
    const user = userEvent.setup()
    useHouseholdPlanStore.getState().initializeManualPlan('couple')
    addPartnerAdult()
    renderDashboard()

    // Assert there are exactly 3 tabs: Joint + 2 adults.
    const allTabs = screen.getAllByRole('tab')
    expect(allTabs).toHaveLength(3)

    // Click the self adult's tab ('You')
    const adultTab = screen.getByRole('tab', { name: 'You' })
    await user.click(adultTab)

    expect(screen.getByTestId('per-adult-heading')).toBeInTheDocument()
  })
})
