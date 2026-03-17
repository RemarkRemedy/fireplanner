import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ProjectionRow, ProjectionSummary } from '@/lib/types'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { useUIStore } from '@/stores/useUIStore'

vi.mock('@/hooks/useProjection', () => ({
  useProjection: vi.fn(),
}))

vi.mock('@/hooks/useIncomeProjection', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    useNormalizedLegacyAnalysisContext: vi.fn(),
  }
})

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/hooks/useEffectiveMode', () => ({
  useEffectiveMode: () => 'simple',
}))

vi.mock('@/hooks/useExpenseTracker', () => ({
  useExpenseTracker: () => ({ isEligible: false }),
}))

vi.mock('@/hooks/useExpenseTrackerDwell', () => ({
  useExpenseTrackerDwell: () => undefined,
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: () => undefined,
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/components/projection/NWChartView', () => ({
  NWChartView: ({ retirementAge }: { retirementAge: number }) => (
    <div data-testid="nw-chart">chart-age:{retirementAge}</div>
  ),
}))

vi.mock('@/components/withdrawal/StrategyParamsSection', () => ({
  StrategyParamCard: ({ strategy }: { strategy: string }) => (
    <div data-testid="strategy-param">{strategy}</div>
  ),
}))

vi.mock('@/components/shared/WithdrawalBasisToggle', () => ({
  WithdrawalBasisToggle: () => <div>basis-toggle</div>,
}))

vi.mock('@/components/email/ExpenseTrackerCard', () => ({
  ExpenseTrackerCard: () => <div>expense-tracker-card</div>,
}))

vi.mock('@/components/shared/projectionColumns', () => ({
  buildProjectionColumns: () => [
    { accessorKey: 'age', header: 'Age' },
    { accessorKey: 'totalIncome', header: 'Income' },
    { accessorKey: 'liquidNW', header: 'Liquid NW' },
  ],
  COLUMN_GROUPS: [],
  GROUP_COLUMNS: {},
  DEFAULT_COLUMN_IDS: ['age', 'totalIncome', 'liquidNW'],
}))

import { useProjection } from '@/hooks/useProjection'
import { useNormalizedLegacyAnalysisContext } from '@/hooks/useIncomeProjection'
import { ProjectionPage } from './ProjectionPage'

const mockUseProjection = vi.mocked(useProjection)
const mockUseNormalizedLegacyAnalysisContext = vi.mocked(useNormalizedLegacyAnalysisContext)

const ROW: ProjectionRow = {
  age: 58,
  year: 28,
  isRetired: false,
  totalIncome: 120_000,
  annualExpenses: 48_000,
  savingsOrWithdrawal: 72_000,
  portfolioReturnDollar: 12_000,
  portfolioReturnPct: 0.06,
  liquidNW: 350_000,
  cpfTotal: 40_000,
  totalNW: 390_000,
  fireProgress: 0.55,
  salary: 120_000,
  rentalIncome: 0,
  investmentIncome: 0,
  businessIncome: 0,
  governmentIncome: 0,
  srsWithdrawal: 0,
  totalGross: 120_000,
  sgTax: 0,
  cpfEmployee: 0,
  cpfEmployer: 0,
  totalNet: 120_000,
  cpfOA: 0,
  cpfSA: 0,
  cpfMA: 0,
  cpfRA: 0,
  cpfInterest: 0,
  cpfOaHousingDeduction: 0,
  cpfOaShortfall: 0,
  cpfOaWithdrawal: 0,
  cpfAutoOaWithdrawal: 0,
  cpfAutoSaWithdrawal: 0,
  cpfCountedAsBonds: 0,
  cpfisOA: 0,
  cpfisSA: 0,
  cpfisReturn: 0,
  cpfLifePayout: 0,
  cpfBequest: 0,
  cpfMilestone: null,
  withdrawalAmount: 0,
  maxPermittedWithdrawal: 0,
  withdrawalExcess: 0,
  propertyValue: 0,
  mortgageBalance: 0,
  propertyEquity: 0,
  totalNWIncProperty: 390_000,
  baseInflatedExpenses: 48_000,
  parentSupportExpense: 0,
  healthcareCashOutlay: 0,
  mortgageCashPayment: 0,
  downsizingRentExpense: 0,
  goalExpense: 0,
  goalShortfall: 0,
  retirementWithdrawalExpense: 0,
  retirementWithdrawalShortfall: 0,
  srsBalance: 0,
  srsContribution: 0,
  srsTaxableWithdrawal: 0,
  lockedAssetUnlock: 0,
  mediShieldLifePremium: 0,
  ispAdditionalPremium: 0,
  careShieldLifePremium: 0,
  oopExpense: 0,
  mediSaveDeductible: 0,
  cumulativeSavings: 72_000,
  activeLifeEvents: [],
  allocationWeights: [0.6, 0.2, 0.2, 0, 0, 0, 0, 0],
  targetAllocationWeights: [0.6, 0.2, 0.2, 0, 0, 0, 0, 0],
  assetValues: [210_000, 70_000, 70_000, 0, 0, 0, 0, 0],
  assetTargetValues: [210_000, 70_000, 70_000, 0, 0, 0, 0, 0],
} as ProjectionRow

const SUMMARY = {
  fireAchievedAge: 58,
  peakTotalNW: 900_000,
  peakTotalNWAge: 70,
  terminalLiquidNW: 500_000,
  terminalTotalNW: 620_000,
  portfolioDepletedAge: null,
} as ProjectionSummary

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projection']}>
      <ProjectionPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useSimulationStore.getState().reset()
  useUIStore.getState().setField('dollarBasis', 'nominal')

  mockUseProjection.mockReturnValue({
    fireMetrics: null,
    rows: [ROW],
    summary: SUMMARY,
    params: null,
    hasErrors: false,
    errors: {},
  })

  mockUseNormalizedLegacyAnalysisContext.mockReturnValue({
    cacheKey: 'legacy:1:1:1::00000000',
    householdRevision: 'legacy:1:1:1',
    scenarioOverrideHash: '00000000',
    referenceAdultId: 'adult-self',
    currentAge: 37,
    retirementAge: 58,
    lifeExpectancy: 92,
    firstRetirementYearOffset: 21,
    householdRetirementYearOffset: 21,
    compiledPlan: {
      assumptions: {
        returns: {
          inflation: 0.021,
        },
      },
    },
    entry: {
      selectors: {},
    },
  } as ReturnType<typeof useNormalizedLegacyAnalysisContext>)
})

describe('ProjectionPage', () => {
  it('renders a normalized-input smoke view and forwards the normalized retirement age to the chart', () => {
    renderPage()

    expect(screen.getByText('Year-by-Year Projection')).toBeInTheDocument()
    expect(screen.getByTestId('nw-chart')).toHaveTextContent('chart-age:58')
    expect(screen.getByTestId('strategy-param')).toHaveTextContent('constant_dollar')
    expect(screen.getByText(/reach financial independence at age 58/i)).toBeInTheDocument()
  })
})
