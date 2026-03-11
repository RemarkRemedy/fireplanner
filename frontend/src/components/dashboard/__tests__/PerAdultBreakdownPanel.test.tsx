import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerAdultBreakdownPanel } from '../PerAdultBreakdownPanel'
import type { AdultBreakdown } from '@/hooks/usePerAdultBreakdown'

// Mock Recharts to avoid rendering issues in test env
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}))

const mockAdult: AdultBreakdown = {
  id: 'adult-1',
  displayName: 'Alice',
  currentAge: 35,
  retirementAge: 55,
  lifeExpectancy: 85,
  annualIncome: 120_000,
  annualExpenses: 48_000,
  liquidNetWorth: 300_000,
  cpfOA: 80_000,
  cpfSA: 40_000,
  cpfMA: 20_000,
  cpfRA: 0,
  cpfTotal: 140_000,
  cpfLifeMonthlyPayout: 800,
  totalNetWorth: 440_000,
  incomeSharePct: 0.6,
  netWorthSharePct: 0.55,
  incomeRows: [],
  cpfRows: [],
}

describe('PerAdultBreakdownPanel', () => {
  it('renders metric card labels', () => {
    render(
      <PerAdultBreakdownPanel
        adult={mockAdult}
        householdTotalIncome={200_000}
        householdTotalNetWorth={800_000}
      />
    )
    expect(screen.getByText('Annual Income')).toBeInTheDocument()
    expect(screen.getByText('CPF Total')).toBeInTheDocument()
    expect(screen.getByText('Total Net Worth')).toBeInTheDocument()
  })

  it('shows age detail rows', () => {
    render(
      <PerAdultBreakdownPanel
        adult={mockAdult}
        householdTotalIncome={200_000}
        householdTotalNetWorth={800_000}
      />
    )
    expect(screen.getByText('35')).toBeInTheDocument() // current age
    expect(screen.getByText('55')).toBeInTheDocument() // retirement age
  })

  it('labels expenses as Personal Expenses (not Annual Expenses)', () => {
    render(
      <PerAdultBreakdownPanel
        adult={mockAdult}
        householdTotalIncome={200_000}
        householdTotalNetWorth={800_000}
      />
    )
    expect(screen.getByText('Personal Expenses')).toBeInTheDocument()
    expect(screen.queryByText('Annual Expenses')).not.toBeInTheDocument()
  })

  it('does not render income chart when incomeRows is empty', () => {
    const { queryByText } = render(
      <PerAdultBreakdownPanel adult={mockAdult} householdTotalIncome={200_000} householdTotalNetWorth={800_000} />
    )
    expect(queryByText('Income Projection')).not.toBeInTheDocument()
  })
})
