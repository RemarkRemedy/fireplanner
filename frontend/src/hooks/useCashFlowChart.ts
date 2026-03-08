import { useMemo } from 'react'
import type { ProjectionRow } from '@/lib/types'
import { useHouseholdRuntimeInputs } from '@/hooks/useHouseholdRuntimeInputs'
import { useProjection } from '@/hooks/useProjection'

// ============================================================
// Cash Flow Chart Types
// ============================================================

export type CashFlowPhase = 'all' | 'accumulation' | 'decumulation'

export interface CashFlowRow {
  age: number
  isRetired: boolean
  // Income (positive values)
  salary: number
  rental: number
  investment: number
  business: number
  government: number          // CPF LIFE + govt benefits
  srsWithdrawal: number
  portfolioWithdrawal: number // post-retirement only
  // Outflows (negative values)
  tax: number                 // -sgTax
  cpf: number                 // -cpfEmployee
  living: number              // -baseInflatedExpenses
  parentSupport: number       // -parentSupportExpense
  healthcare: number          // -healthcareCashOutlay
  mortgage: number            // -mortgageCashPayment
  rent: number                // -downsizingRentExpense
  // Net
  netCashFlow: number
}

export interface CashFlowChartData {
  rows: CashFlowRow[]
  visibleSeries: string[]     // only series with non-zero data
  retirementAge: number
}

// ============================================================
// All possible series names
// ============================================================

const INCOME_SERIES = [
  'salary', 'rental', 'investment', 'business',
  'government', 'srsWithdrawal', 'portfolioWithdrawal',
] as const

const OUTFLOW_SERIES = [
  'tax', 'cpf', 'living', 'parentSupport',
  'healthcare', 'mortgage', 'rent',
] as const

const ALL_SERIES = [...INCOME_SERIES, ...OUTFLOW_SERIES]

// ============================================================
// Mapping function: ProjectionRow -> CashFlowRow
// ============================================================

function mapProjectionRow(row: ProjectionRow): CashFlowRow {
  // Income (positive values)
  const salary = row.salary
  const rental = row.rentalIncome
  const investment = row.investmentIncome
  const business = row.businessIncome
  const government = row.governmentIncome
  const srsWithdrawal = row.srsWithdrawal
  const portfolioWithdrawal = row.isRetired ? row.withdrawalAmount : 0

  // Outflows (negative values)
  const tax = -row.sgTax
  const cpf = -row.cpfEmployee
  // Living expenses = annualExpenses minus parentSupport and healthcare (which are separate)
  const living = -(row.annualExpenses - row.parentSupportExpense - row.healthcareCashOutlay)
  const parentSupport = -row.parentSupportExpense
  const healthcare = -row.healthcareCashOutlay
  const mortgage = 0 // Mortgage is embedded in savingsOrWithdrawal, not separate on ProjectionRow
  const rent = 0     // Rent (downsizing) is embedded in annualExpenses, not separate on ProjectionRow

  // Net = sum of all income + outflows
  const totalIncome = salary + rental + investment + business + government + srsWithdrawal + portfolioWithdrawal
  const totalOutflow = tax + cpf + living + parentSupport + healthcare + mortgage + rent
  const netCashFlow = totalIncome + totalOutflow

  return {
    age: row.age,
    isRetired: row.isRetired,
    salary,
    rental,
    investment,
    business,
    government,
    srsWithdrawal,
    portfolioWithdrawal,
    tax,
    cpf,
    living,
    parentSupport,
    healthcare,
    mortgage,
    rent,
    netCashFlow,
  }
}

// ============================================================
// Hook: useCashFlowChart
// ============================================================

export function useCashFlowChart(phase: CashFlowPhase): CashFlowChartData | null {
  const { rows: projectionRows } = useProjection()
  const { profile } = useHouseholdRuntimeInputs()
  const retirementAge = profile.retirementAge

  return useMemo(() => {
    if (!projectionRows || projectionRows.length === 0) return null

    // Map all projection rows to cash flow rows
    const allRows = projectionRows.map(mapProjectionRow)

    // Filter by phase
    let filteredRows: CashFlowRow[]
    switch (phase) {
      case 'accumulation':
        filteredRows = allRows.filter((r) => !r.isRetired)
        break
      case 'decumulation':
        filteredRows = allRows.filter((r) => r.isRetired)
        break
      default:
        filteredRows = allRows
    }

    if (filteredRows.length === 0) return null

    // Determine visible series: only include series that have non-zero data in at least one row
    const visibleSeries = ALL_SERIES.filter((series) =>
      filteredRows.some((row) => Math.abs(row[series]) > 0.01)
    )

    return {
      rows: filteredRows,
      visibleSeries,
      retirementAge,
    }
  }, [projectionRows, phase, retirementAge])
}
