import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import type { IncomeProjectionRow, HouseholdIncomeProjectionRow } from '@/lib/types'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { useUIStore } from '@/stores/useUIStore'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

const columnHelper = createColumnHelper<IncomeProjectionRow>()

interface ProjectionTableProps {
  data: IncomeProjectionRow[] | HouseholdIncomeProjectionRow[]
  retirementAge: number
}

// Type guard to check if this is a household projection
function isHouseholdProjection(data: IncomeProjectionRow[] | HouseholdIncomeProjectionRow[]): data is HouseholdIncomeProjectionRow[] {
  if (data.length === 0) return false
  return 'personData' in data[0]
}

// Convert household projection to single-person format for display
// In household mode, show per-person data based on selected person
function convertToDisplayFormat(
  data: IncomeProjectionRow[] | HouseholdIncomeProjectionRow[],
  selectedPersonId: string | null
): IncomeProjectionRow[] {
  if (!isHouseholdProjection(data)) {
    return data
  }

  // If no person selected or person not found, use first person
  const personId = selectedPersonId || Object.keys(data[0]?.personData || {})[0]
  if (!personId) return []

  // Extract the selected person's data from each row
  return data.map((row) => {
    const personData = row.personData[personId]
    if (!personData) {
      // Fallback if person not found in this row
      const firstPersonData = Object.values(row.personData)[0]
      return firstPersonData || {} as IncomeProjectionRow
    }
    return personData
  })
}

export function ProjectionTable({ data, retirementAge }: ProjectionTableProps) {
  const [expanded, setExpanded] = useState(false)
  const household = useHouseholdStore()
  const selectedPersonId = useUIStore((s) => s.selectedPersonId)
  const isHouseholdMode = household.householdMode && household.persons.length > 0

  // Get the selected person ID for household mode
  const effectivePersonId = isHouseholdMode
    ? (selectedPersonId || household.persons[0]?.profile.id)
    : null

  // Convert household projection to display format (per-person)
  const convertedData = useMemo(
    () => convertToDisplayFormat(data, effectivePersonId),
    [data, effectivePersonId]
  )

  const displayData = useMemo(
    () => expanded ? convertedData : convertedData.slice(0, 5),
    [expanded, convertedData]
  )

  const hasRA = convertedData.some((r) => r.cpfRA > 0)
  const hasCpfis = convertedData.some((r) => r.cpfisOA > 0 || r.cpfisSA > 0)

  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor('age', {
        header: 'Age',
        cell: (info) => info.getValue(),
      }),
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
    ]

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
  }, [hasRA, hasCpfis])

  const table = useReactTable({
    data: displayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Get selected person's name for display
  const selectedPerson = isHouseholdMode
    ? household.persons.find((p) => p.profile.id === effectivePersonId)
    : null

  return (
    <div>
      {isHouseholdMode && selectedPerson && (
        <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-sm">
          <span className="text-blue-700 dark:text-blue-300">
            📊 Showing projection for: <span className="font-semibold">{selectedPerson.profile.name}</span>
          </span>
          <span className="text-blue-600 dark:text-blue-400 ml-2 text-xs">
            (Use the person dropdown above to switch between individuals)
          </span>
        </div>
      )}
      <div className={cn('border rounded-md overflow-auto', expanded && 'max-h-[600px]')}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b z-20">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={cn(
                    "px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap",
                    header.column.id === 'age' && "sticky left-0 z-30 bg-background border-r border-border"
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
                    const isAgeCol = cell.column.id === 'age'
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
      {data.length > 5 && (
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
