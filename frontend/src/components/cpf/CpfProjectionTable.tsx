import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table'
import { useCpfProjection, type CpfProjectionRow } from '@/hooks/useCpfProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { InfoTooltip } from '@/components/shared/InfoTooltip'

const columnHelper = createColumnHelper<CpfProjectionRow>()

function currencyCell(value: number): string {
  return formatCurrency(value)
}

function optionalCurrencyCell(value: number): string {
  return value > 0 ? formatCurrency(value) : '-'
}

export function CpfProjectionTable() {
  const { rows, hasErrors } = useCpfProjection()
  const retirementAge = useProfileStore((s) => s.retirementAge)

  const hasHousingDeduction = rows?.some((r) => r.oaHousingDeduction > 0) ?? false
  const hasRA = rows?.some((r) => r.raBalance > 0) ?? false
  const hasBequest = rows?.some((r) => r.bequest > 0) ?? false
  const hasCpfis = rows?.some((r) => r.cpfisOA > 0 || r.cpfisSA > 0) ?? false
  const depletionRow = rows?.find((r) => r.oaShortfall > 0) ?? null
  const mortgageEndAge = rows && depletionRow
    ? ([...rows].reverse().find((r: CpfProjectionRow) => r.oaHousingDeduction > 0 || r.oaShortfall > 0)?.age ?? 0)
    : 0

  const columns = useMemo((): ColumnDef<CpfProjectionRow, number>[] => {
    const cols: ColumnDef<CpfProjectionRow, number>[] = [
      columnHelper.accessor('age', {
        header: 'Age',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('oaBalance', {
        header: 'OA',
        cell: (info) => currencyCell(info.getValue()),
      }),
      columnHelper.accessor('saBalance', {
        header: 'SA',
        cell: (info) => currencyCell(info.getValue()),
      }),
    ]

    if (hasCpfis) {
      cols.push(
        columnHelper.accessor('cpfisOA', {
          header: 'CPFIS-OA',
          cell: (info) => optionalCurrencyCell(info.getValue()),
        }),
        columnHelper.accessor('cpfisSA', {
          header: 'CPFIS-SA',
          cell: (info) => optionalCurrencyCell(info.getValue()),
        }),
        columnHelper.accessor('cpfisReturn', {
          header: 'CPFIS Additional Return',
          cell: (info) => optionalCurrencyCell(info.getValue()),
        }),
      )
    }

    if (hasRA) {
      cols.push(
        columnHelper.accessor('raBalance', {
          header: 'RA',
          cell: (info) => currencyCell(info.getValue()),
        }),
      )
    }

    cols.push(
      columnHelper.accessor('maBalance', {
        header: 'MA',
        cell: (info) => currencyCell(info.getValue()),
      }),
      columnHelper.accessor('totalBalance', {
        header: 'Total',
        cell: (info) => currencyCell(info.getValue()),
      }),
      columnHelper.accessor('annualContribution', {
        header: 'Contribution',
        cell: (info) => optionalCurrencyCell(info.getValue()),
      }),
    )

    if (hasHousingDeduction) {
      cols.push(
        columnHelper.accessor('oaHousingDeduction', {
          header: 'OA Withdrawal',
          cell: (info) => optionalCurrencyCell(info.getValue()),
        }) as ColumnDef<CpfProjectionRow, number>,
      )
      if (depletionRow) {
        cols.push(
          columnHelper.accessor('oaShortfall', {
            header: 'OA Shortfall',
            cell: (info) => {
              const v = info.getValue()
              return v > 0
                ? <span className="text-amber-700 dark:text-amber-300 font-medium">{formatCurrency(v)}</span>
                : '-'
            },
          }) as ColumnDef<CpfProjectionRow, number>,
        )
      }
    }

    cols.push(
      columnHelper.accessor('annualInterest', {
        header: 'Interest',
        cell: (info) => optionalCurrencyCell(info.getValue()),
      }),
      columnHelper.accessor('cpfLifePayout', {
        header: 'CPF LIFE',
        cell: (info) => optionalCurrencyCell(info.getValue()),
      }),
    )

    if (hasBequest) {
      cols.push(
        columnHelper.accessor('bequest', {
          header: 'Bequest',
          cell: (info) => optionalCurrencyCell(info.getValue()),
        }),
      )
    }

    return cols
  }, [hasHousingDeduction, hasRA, hasBequest, hasCpfis, depletionRow])

  const table = useReactTable({
    data: rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (hasErrors || !rows) {
    return (
      <p className="text-sm text-muted-foreground">
        Some inputs need fixing. Check the highlighted fields above to see the CPF projection table.
      </p>
    )
  }

  return (
    <>
    {depletionRow && (
      <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-sm">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          CPF Ordinary Account (OA) projected to be depleted at age {depletionRow.age}
        </p>
        <p className="text-amber-700 dark:text-amber-300 mt-1">
          From age {depletionRow.age} to {mortgageEndAge}, the remaining mortgage payments
          of {formatCurrency(depletionRow.oaShortfall)}/yr must come from your liquid portfolio.
        </p>
      </div>
    )}
    <div className="border rounded-md overflow-auto max-h-[400px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background border-b z-20">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    "px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap",
                    header.column.id === 'age' && "sticky left-0 z-30 bg-background border-r border-border"
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const original = row.original
            const isRetirementRow = original.age === retirementAge
            const isMilestone = original.milestone !== null

            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b hover:bg-muted/50 group',
                  isRetirementRow && 'border-t-2 border-t-orange-400',
                  original.oaShortfall > 0 && 'bg-amber-50 dark:bg-amber-900/10',
                  original.milestone === 'frs' && 'bg-green-50 dark:bg-green-900/10',
                  original.milestone === 'brs' && 'bg-green-50/50 dark:bg-green-900/5',
                  original.milestone === 'ers' && 'bg-green-100 dark:bg-green-900/20',
                  original.milestone === 'cpfLifeStart' && 'bg-blue-50 dark:bg-blue-900/10',
                  original.milestone === 'raCreated' && 'bg-purple-50 dark:bg-purple-900/10',
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const isAgeCol = cell.column.id === 'age'
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-2 py-1.5 whitespace-nowrap tabular-nums",
                        isAgeCol && "sticky left-0 z-10 font-medium bg-background border-r border-border group-hover:bg-muted"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
                {isMilestone && (
                  <td className="px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      {original.milestone === 'brs' && 'Basic Retirement Sum reached'}
                      {original.milestone === 'frs' && 'Full Retirement Sum reached'}
                      {original.milestone === 'ers' && 'Enhanced Retirement Sum reached'}
                      {original.milestone === 'cpfLifeStart' && 'CPF LIFE starts'}
                      {original.milestone === 'raCreated' && 'Retirement Account created'}
                      {original.milestoneFormula && (
                        <InfoTooltip text={original.milestoneFormula} />
                      )}
                    </span>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
