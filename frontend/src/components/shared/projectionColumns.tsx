import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import type { ProjectionRow } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'

// ── Column helper ────────────────────────────────────────────────────
export const columnHelper = createColumnHelper<ProjectionRow>()

// ── Column group types & constants ───────────────────────────────────
export type ColumnGroup =
  | 'expensesBreakdown'
  | 'incomeBreakdown'
  | 'taxCpf'
  | 'cpfBalances'
  | 'portfolio'
  | 'portfolioBreakdown'
  | 'property'

export const COLUMN_GROUPS: { key: ColumnGroup; label: string }[] = [
  { key: 'expensesBreakdown', label: 'Expenses Breakdown' },
  { key: 'incomeBreakdown', label: 'Income Breakdown' },
  { key: 'taxCpf', label: 'Tax & CPF' },
  { key: 'cpfBalances', label: 'CPF Balances' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'portfolioBreakdown', label: 'Asset Breakdown' },
  { key: 'property', label: 'Property & Events' },
]

/** Short labels for asset class column headers (compact for table display) */
const ASSET_SHORT_LABELS: Record<string, string> = {
  usEquities: 'US Eq',
  sgEquities: 'SG Eq',
  intlEquities: 'Intl Eq',
  bonds: 'Bonds',
  reits: 'REITs',
  gold: 'Gold',
  cash: 'Cash',
  cpf: 'CPF',
}

export const GROUP_COLUMNS: Record<ColumnGroup, string[]> = {
  expensesBreakdown: [
    'baseInflatedExpenses', 'parentSupportExpense', 'healthcareCashOutlay',
    'downsizingRentExpense', 'goalExpense', 'retirementWithdrawalExpense',
    'mediShieldLifePremium', 'ispAdditionalPremium', 'careShieldLifePremium',
    'oopExpense', 'mediSaveDeductible',
  ],
  incomeBreakdown: [
    'salary', 'rentalIncome', 'investmentIncome', 'businessIncome',
    'governmentIncome', 'srsWithdrawal', 'srsBalance', 'srsContribution',
    'srsTaxableWithdrawal', 'lockedAssetUnlock', 'totalGross',
  ],
  taxCpf: ['sgTax', 'cpfEmployee', 'cpfEmployer', 'totalNet'],
  cpfBalances: [
    'cpfOA', 'cpfSA', 'cpfMA', 'cpfRA', 'cpfInterest',
    'cpfOaHousingDeduction', 'cpfOaShortfall', 'cpfLifePayout',
    'cpfBequest', 'cpfMilestone',
    'cpfAutoOaWithdrawal', 'cpfAutoSaWithdrawal', 'cpfCountedAsBonds',
  ],
  portfolio: [
    'portfolioReturnPct', 'withdrawalAmount', 'maxPermittedWithdrawal',
    'withdrawalExcess', 'cumulativeSavings',
  ],
  portfolioBreakdown: ASSET_CLASSES.flatMap((ac) => [
    `asset_${ac.key}Value`, `asset_${ac.key}Pct`, `asset_${ac.key}TgtPct`,
  ]),
  property: [
    'propertyValue', 'mortgageBalance', 'propertyEquity',
    'totalNWIncProperty', 'activeLifeEvents',
  ],
}

export const DEFAULT_COLUMN_IDS = [
  'age', 'totalIncome', 'annualExpenses', 'mortgageCashPayment',
  'savingsOrWithdrawal', 'portfolioReturnDollar', 'liquidNW',
  'cpfTotal', 'totalNW', 'fireProgress',
]

// ── Formatting helpers ───────────────────────────────────────────────
export function currencyCell(value: number): string {
  return formatCurrency(value)
}

export function optionalCurrencyCell(value: number): string {
  return value > 0 ? formatCurrency(value) : '-'
}

// ── Column builder ───────────────────────────────────────────────────
/**
 * Build the full column definitions for a year-by-year projection table.
 *
 * @param retirementAge  - Attached as `meta` on the age column so row
 *   renderers can highlight the retirement boundary without prop drilling.
 * @param hasMortgage    - Attached as `meta` on the mortgage(cash) column
 *   so consumers can pre-hide it without needing separate visibility logic.
 */
export function buildProjectionColumns(
  retirementAge: number,
  hasMortgage: boolean,
): ColumnDef<ProjectionRow, number | string>[] {
  return [
    // ── Default columns (always visible) ─────────────────────────────
    columnHelper.accessor('age', {
      header: 'Age',
      meta: { retirementAge },
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('totalIncome', {
      header: 'Net Income',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('annualExpenses', {
      header: 'Daily Expenses',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('mortgageCashPayment', {
      id: 'mortgageCashPayment',
      header: 'Mortgage(Cash)',
      meta: { hasMortgage },
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('savingsOrWithdrawal', {
      header: 'Savings/Draw',
      cell: (info) => {
        const v = info.getValue()
        const formatted = formatCurrency(Math.abs(v))
        return v >= 0 ? formatted : `(${formatted})`
      },
    }),
    columnHelper.accessor('portfolioReturnDollar', {
      header: 'Return ($)',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('liquidNW', {
      header: 'Liquid NW',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfTotal', {
      header: 'CPF Total',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('totalNW', {
      header: 'Total NW',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('fireProgress', {
      header: 'FIRE %',
      cell: (info) => formatPercent(info.getValue(), 1),
    }),

    // ── Expanded: Expenses Breakdown ─────────────────────────────────
    columnHelper.accessor('baseInflatedExpenses', {
      id: 'baseInflatedExpenses',
      header: 'Base Living',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('parentSupportExpense', {
      id: 'parentSupportExpense',
      header: 'Parent Supp.',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('healthcareCashOutlay', {
      id: 'healthcareCashOutlay',
      header: 'Healthcare',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('downsizingRentExpense', {
      id: 'downsizingRentExpense',
      header: 'Rent (DS)',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('goalExpense', {
      id: 'goalExpense',
      header: 'Goals',
      cell: (info) => {
        const v = info.getValue()
        if (v <= 0) return '-'
        const shortfall = info.row.original.goalShortfall
        if (shortfall > 0) {
          return (
            <span className="text-destructive" title={`${formatCurrency(shortfall)} unfunded`}>
              {formatCurrency(v)} *
            </span>
          )
        }
        return formatCurrency(v)
      },
    }),
    columnHelper.accessor('retirementWithdrawalExpense', {
      id: 'retirementWithdrawalExpense',
      header: 'Ret. Wdl.',
      cell: (info) => {
        const v = info.getValue()
        if (v <= 0) return '-'
        const shortfall = info.row.original.retirementWithdrawalShortfall
        if (shortfall > 0) {
          return (
            <span className="text-destructive" title={`${formatCurrency(shortfall)} unfunded`}>
              {formatCurrency(v)} *
            </span>
          )
        }
        return formatCurrency(v)
      },
    }),
    columnHelper.accessor('mediShieldLifePremium', {
      id: 'mediShieldLifePremium',
      header: 'MediShield Life',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('ispAdditionalPremium', {
      id: 'ispAdditionalPremium',
      header: 'Shield Plan',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('careShieldLifePremium', {
      id: 'careShieldLifePremium',
      header: 'CareShield Life',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('oopExpense', {
      id: 'oopExpense',
      header: 'OOP',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('mediSaveDeductible', {
      id: 'mediSaveDeductible',
      header: 'MediSave Used',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),

    // ── Expanded: Income Breakdown ───────────────────────────────────
    columnHelper.accessor('salary', {
      id: 'salary',
      header: 'Salary',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('rentalIncome', {
      id: 'rentalIncome',
      header: 'Rental',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('investmentIncome', {
      id: 'investmentIncome',
      header: 'Invest.',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('businessIncome', {
      id: 'businessIncome',
      header: 'Business',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('governmentIncome', {
      id: 'governmentIncome',
      header: 'Govt.',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('srsWithdrawal', {
      id: 'srsWithdrawal',
      header: 'SRS',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('srsBalance', {
      id: 'srsBalance',
      header: 'SRS Bal.',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('srsContribution', {
      id: 'srsContribution',
      header: 'SRS Contrib.',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('srsTaxableWithdrawal', {
      id: 'srsTaxableWithdrawal',
      header: 'SRS Taxable',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('lockedAssetUnlock', {
      id: 'lockedAssetUnlock',
      header: 'Asset Unlock',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('totalGross', {
      id: 'totalGross',
      header: 'Gross',
      cell: (info) => currencyCell(info.getValue()),
    }),

    // ── Expanded: Tax & CPF Deductions ───────────────────────────────
    columnHelper.accessor('sgTax', {
      id: 'sgTax',
      header: 'SG Tax',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfEmployee', {
      id: 'cpfEmployee',
      header: 'CPF (Emp)',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfEmployer', {
      id: 'cpfEmployer',
      header: 'CPF (Er)',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('totalNet', {
      id: 'totalNet',
      header: 'Net Income',
      cell: (info) => currencyCell(info.getValue()),
    }),

    // ── Expanded: CPF Balances ───────────────────────────────────────
    columnHelper.accessor('cpfOA', {
      id: 'cpfOA',
      header: 'CPF OA',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfSA', {
      id: 'cpfSA',
      header: 'CPF SA',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfMA', {
      id: 'cpfMA',
      header: 'CPF MA',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfRA', {
      id: 'cpfRA',
      header: 'CPF RA',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfInterest', {
      id: 'cpfInterest',
      header: 'CPF Interest',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfOaHousingDeduction', {
      id: 'cpfOaHousingDeduction',
      header: 'Mortgage(CPF)',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfOaShortfall', {
      id: 'cpfOaShortfall',
      header: 'OA Shortfall',
      cell: (info) => {
        const v = info.getValue() as number
        return v > 0 ? formatCurrency(v) : '-'
      },
    }),
    columnHelper.accessor('cpfLifePayout', {
      id: 'cpfLifePayout',
      header: 'CPF LIFE',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfBequest', {
      id: 'cpfBequest',
      header: 'Bequest',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfMilestone', {
      id: 'cpfMilestone',
      header: 'Milestone',
      cell: (info) => {
        const v = info.getValue()
        if (!v) return '-'
        const labels: Record<string, string> = {
          brs: 'BRS reached',
          frs: 'FRS reached',
          ers: 'ERS reached',
          cpfLifeStart: 'CPF LIFE starts',
          raCreated: 'RA created',
        }
        return labels[v as string] ?? '-'
      },
    }) as ColumnDef<ProjectionRow, number | string>,
    columnHelper.accessor('cpfAutoOaWithdrawal', {
      id: 'cpfAutoOaWithdrawal',
      header: 'Auto OA W/D',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfAutoSaWithdrawal', {
      id: 'cpfAutoSaWithdrawal',
      header: 'Auto SA W/D',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('cpfCountedAsBonds', {
      id: 'cpfCountedAsBonds',
      header: 'CPF as Bonds',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),

    // ── Expanded: Portfolio ───────────────────────────────────────────
    columnHelper.accessor('portfolioReturnPct', {
      id: 'portfolioReturnPct',
      header: 'Return %',
      cell: (info) => formatPercent(info.getValue(), 2),
    }),
    columnHelper.accessor('withdrawalAmount', {
      id: 'withdrawalAmount',
      header: 'Actual Draw',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('maxPermittedWithdrawal', {
      id: 'maxPermittedWithdrawal',
      header: 'Max Withdrawal',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('withdrawalExcess', {
      id: 'withdrawalExcess',
      header: 'Excess',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('cumulativeSavings', {
      id: 'cumulativeSavings',
      header: 'Cumul. Savings',
      cell: (info) => currencyCell(info.getValue()),
    }),

    // ── Expanded: Asset Breakdown ──────────────────────────────────
    // 16 columns: value ($) and weight (%) for each of the 8 asset classes.
    // Values are computed at the display layer: liquidNW * allocationWeights[i].
    // allocationWeights are dimensionless ratios — NOT deflated in displayRows.
    // So deflatedLiquidNW * weight = correct real-dollar value automatically.
    ...ASSET_CLASSES.flatMap((ac, i) => [
      columnHelper.accessor(
        (row) => row.allocationWeights[i] > 0 ? row.liquidNW * row.allocationWeights[i] : 0,
        {
          id: `asset_${ac.key}Value`,
          header: `${ASSET_SHORT_LABELS[ac.key]} ($)`,
          cell: (info) => info.getValue() > 0 ? currencyCell(info.getValue()) : '-',
        },
      ),
      columnHelper.accessor(
        (row) => row.allocationWeights[i] * 100,
        {
          id: `asset_${ac.key}Pct`,
          header: `${ASSET_SHORT_LABELS[ac.key]} (%)`,
          cell: (info) => {
            const v = info.getValue()
            if (v <= 0) return '-'
            const isRebalanced = info.row.original.cpfCountedAsBonds > 0
            if (isRebalanced) {
              return (
                <span title="Effective allocation after CPF virtual rebalancing">
                  {v.toFixed(1)}%*
                </span>
              )
            }
            return `${v.toFixed(1)}%`
          },
        },
      ),
      columnHelper.accessor(
        (row) => row.targetAllocationWeights[i] * 100,
        {
          id: `asset_${ac.key}TgtPct`,
          header: `${ASSET_SHORT_LABELS[ac.key]} (Tgt%)`,
          cell: (info) => {
            const v = info.getValue()
            return v > 0 ? `${v.toFixed(1)}%` : '-'
          },
        },
      ),
    ]) as ColumnDef<ProjectionRow, number | string>[],

    // ── Property & Events ────────────────────────────────────────────
    columnHelper.accessor('propertyValue', {
      id: 'propertyValue',
      header: 'Property Value',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('mortgageBalance', {
      id: 'mortgageBalance',
      header: 'Mortgage Bal.',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('propertyEquity', {
      id: 'propertyEquity',
      header: 'Property Equity',
      cell: (info) => optionalCurrencyCell(info.getValue()),
    }),
    columnHelper.accessor('totalNWIncProperty', {
      id: 'totalNWIncProperty',
      header: 'NW inc. Property',
      cell: (info) => currencyCell(info.getValue()),
    }),
    columnHelper.accessor('activeLifeEvents', {
      id: 'activeLifeEvents',
      header: 'Life Events',
      cell: (info) => {
        const v = info.getValue() as string[]
        if (!v || v.length === 0) return '-'
        return v.join(', ')
      },
    }) as ColumnDef<ProjectionRow, number | string>,
  ] as ColumnDef<ProjectionRow, number | string>[]
}
