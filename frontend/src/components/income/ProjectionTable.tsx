import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import type { IncomeProjectionRow } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

const columnHelper = createColumnHelper<IncomeProjectionRow>()

interface JointAdultInfo {
  name: string
  currentAge: number
}

interface ProjectionTableProps {
  data: IncomeProjectionRow[]
  retirementAge: number
  /** When set, shows Year/Adult1 Age/Adult2 Age columns instead of single Age column */
  jointAdults?: JointAdultInfo[]
}

export function ProjectionTable({ data, retirementAge, jointAdults }: ProjectionTableProps) {
  const [expanded, setExpanded] = useState(false)
  const displayData = useMemo(
    () => expanded ? data : data.slice(0, 2),
    [expanded, data]
  )

  const hasRA = data.some((r) => r.cpfRA > 0)
  const hasCpfis = data.some((r) => r.cpfisOA > 0 || r.cpfisSA > 0)

  const isJoint = jointAdults && jointAdults.length >= 2
  const referenceAge = data[0]?.age ?? 0

  const columns = useMemo(() => {
    const cols = isJoint
      ? [
          columnHelper.accessor('year', {
            header: 'Year',
            cell: (info) => info.row.index,
          }),
          columnHelper.display({
            id: 'adult1Age',
            header: jointAdults[0].name,
            cell: (info) => jointAdults[0].currentAge + info.row.index,
          }),
          columnHelper.display({
            id: 'adult2Age',
            header: jointAdults[1].name,
            cell: (info) => jointAdults[1].currentAge + info.row.index,
          }),
        ]
      : [
          columnHelper.accessor('age', {
            header: 'Age',
            cell: (info) => info.getValue(),
          }),
        ]

    cols.push(
      columnHelper.accessor('salary', {
        header: 'Salary',
        cell: (info) => formatCurrency(info.getValue()),
      }),
      columnHelper.accessor('rentalIncome', {
        header: 'Rental',
        cell: (info) => {
          const v = info.getValue()
          return v > 0 ? formatCurrency(v) : '-'
        },
      }),
      columnHelper.accessor('investmentIncome', {
        header: 'Invest.',
        cell: (info) => {
          const v = info.getValue()
          return v > 0 ? formatCurrency(v) : '-'
        },
      }),
      columnHelper.accessor('totalGross', {
        header: 'Gross',
        cell: (info) => formatCurrency(info.getValue()),
      }),
      columnHelper.accessor('sgTax', {
        header: 'SG Tax',
        cell: (info) => formatCurrency(info.getValue()),
      }),
      columnHelper.accessor('cpfEmployee', {
        header: 'CPF (Emp)',
        cell: (info) => formatCurrency(info.getValue()),
      }),
      columnHelper.accessor('totalNet', {
        header: 'Net',
        cell: (info) => formatCurrency(info.getValue()),
      }),
      columnHelper.accessor('annualSavings', {
        header: 'Savings',
        cell: (info) => formatCurrency(info.getValue()),
      }),
      columnHelper.accessor('cumulativeSavings', {
        header: 'Cumul.',
        cell: (info) => formatCurrency(info.getValue()),
      }),
      columnHelper.accessor('cpfOA', {
        header: 'CPF OA',
        cell: (info) => formatCurrency(info.getValue()),
      }),
      columnHelper.accessor('cpfSA', {
        header: 'CPF SA',
        cell: (info) => formatCurrency(info.getValue()),
      }),
    )

    if (hasCpfis) {
      cols.push(
        columnHelper.accessor('cpfisOA', {
          header: 'CPFIS-OA',
          cell: (info) => {
            const v = info.getValue()
            return v > 0 ? formatCurrency(v) : '-'
          },
        }),
        columnHelper.accessor('cpfisSA', {
          header: 'CPFIS-SA',
          cell: (info) => {
            const v = info.getValue()
            return v > 0 ? formatCurrency(v) : '-'
          },
        }),
        columnHelper.accessor('cpfisReturn', {
          header: 'CPFIS Add. Return',
          cell: (info) => {
            const v = info.getValue()
            return v > 0 ? formatCurrency(v) : '-'
          },
        }),
      )
    }

    if (hasRA) {
      cols.push(
        columnHelper.accessor('cpfRA', {
          header: 'CPF RA',
          cell: (info) => formatCurrency(info.getValue()),
        }),
      )
    }

    cols.push(
      columnHelper.accessor('cpfMA', {
        header: 'CPF MA',
        cell: (info) => formatCurrency(info.getValue()),
      }),
    )

    return cols
  }, [hasRA, hasCpfis, isJoint, jointAdults])

  const table = useReactTable({
    data: displayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <div className={cn('border rounded-md overflow-auto', expanded && 'max-h-[600px]')}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b z-20">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={cn(
                    "px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap",
                    (header.column.id === 'age' || header.column.id === 'year') && "sticky left-0 z-30 bg-background border-r border-border"
                  )}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isRetirementRow = row.original.age === retirementAge
              const hasEvents = row.original.activeLifeEvents.length > 0

              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b hover:bg-muted/50 group',
                    row.original.isRetired && 'bg-muted/30',
                    isRetirementRow && 'border-t-2 border-t-orange-400',
                    hasEvents && 'bg-yellow-50 dark:bg-yellow-900/10'
                  )}
                  title={hasEvents ? `Active: ${row.original.activeLifeEvents.join(', ')}` : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isAgeCol = cell.column.id === 'age' || cell.column.id === 'year'
                    return (
                      <td key={cell.id} className={cn(
                        "px-2 py-1.5 whitespace-nowrap tabular-nums",
                        isAgeCol && "sticky left-0 z-10 font-medium bg-background border-r border-border group-hover:bg-muted"
                      )}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {data.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm text-primary hover:underline"
        >
          {expanded ? 'Show less' : `Show all ${data.length} rows`}
        </button>
      )}
    </div>
  )
}
