import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type VisibilityState,
} from '@tanstack/react-table'
import type { MonteCarloResult } from '@/lib/types'
import { generateProjection } from '@/lib/calculations/projection'
import { useProjection } from '@/hooks/useProjection'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import {
  buildProjectionColumns,
  COLUMN_GROUPS,
  GROUP_COLUMNS,
  DEFAULT_COLUMN_IDS,
  type ColumnGroup,
} from '@/components/shared/projectionColumns'
import { ASSET_CLASSES } from '@/lib/data/historicalReturns'

// ── Percentile options ──────────────────────────────────────────────
const PERCENTILE_OPTIONS = [
  { value: 10, label: 'Pessimistic (p10)' },
  { value: 25, label: 'Cautious (p25)' },
  { value: 50, label: 'Median (p50)' },
  { value: 75, label: 'Optimistic (p75)' },
  { value: 90, label: 'Best Case (p90)' },
] as const

// ── Props ───────────────────────────────────────────────────────────
interface MCProjectionTableProps {
  result: MonteCarloResult
  isStale?: boolean
}

export function MCProjectionTable({ result, isStale }: MCProjectionTableProps) {
  const [selectedPercentile, setSelectedPercentile] = useState(50)
  const [activeGroups, setActiveGroups] = useState<Set<ColumnGroup>>(new Set())

  const { params: projectionParams } = useProjection()

  // ── Resolve the selected representative path ────────────────────
  const selectedPath = useMemo(() => {
    if (!result.representative_paths) return null
    return result.representative_paths.find((p) => p.percentile === selectedPercentile) ?? null
  }, [result.representative_paths, selectedPercentile])

  // ── Compute timeline offset ─────────────────────────────────────
  // MC in fireTarget mode starts at retirementAge, not currentAge.
  // The offset tells generateProjection() which year to start applying
  // the MC-sourced returns.
  const offset = useMemo(() => {
    if (!projectionParams) return 0
    const mcStartAge = result.representative_paths_start_age ?? projectionParams.currentAge
    return mcStartAge - projectionParams.currentAge
  }, [result.representative_paths_start_age, projectionParams])

  // ── Replay projection with MC returns ───────────────────────────
  const projectionResult = useMemo(() => {
    if (!projectionParams || !selectedPath) return null
    return generateProjection({
      ...projectionParams,
      yearlyReturns: selectedPath.yearlyReturns,
      yearlyReturnsOffset: offset,
    })
  }, [projectionParams, selectedPath, offset])

  const rows = projectionResult?.rows ?? null
  const retirementAge = projectionParams?.retirementAge ?? 65

  // ── Detect which columns have data (hide empty ones) ────────────
  const hasMortgageCash = rows?.some((r) => r.mortgageCashPayment > 0) ?? false
  const hasRa = rows?.some((r) => r.cpfRA > 0) ?? false
  const hasOaHousing = rows?.some((r) => r.cpfOaHousingDeduction > 0) ?? false
  const hasOaShortfall = rows?.some((r) => r.cpfOaShortfall > 0) ?? false
  const hasBequest = rows?.some((r) => r.cpfBequest > 0) ?? false
  const hasCpfLife = rows?.some((r) => r.cpfLifePayout > 0) ?? false
  const hasMilestone = rows?.some((r) => r.cpfMilestone !== null) ?? false
  const hasPropertyValue = rows?.some((r) => r.propertyValue > 0) ?? false
  const hasMortgageBalance = rows?.some((r) => r.mortgageBalance > 0) ?? false
  const hasPropertyEquity = rows?.some((r) => r.propertyEquity > 0) ?? false
  const hasLifeEvents = rows?.some((r) => r.activeLifeEvents.length > 0) ?? false
  const hasLockedUnlock = rows?.some((r) => r.lockedAssetUnlock > 0) ?? false
  const hasHealthcareBreakdown = rows?.some((r) => r.healthcareCashOutlay > 0) ?? false

  // Detect which asset classes have any non-zero weight across all rows
  const nonZeroAssets = useMemo(() => {
    if (!rows) return new Set<number>()
    const active = new Set<number>()
    for (const row of rows) {
      for (let i = 0; i < row.allocationWeights.length; i++) {
        if (row.allocationWeights[i] > 0) active.add(i)
      }
    }
    return active
  }, [rows])

  // ── Column group toggles ────────────────────────────────────────
  const toggleGroup = (group: ColumnGroup) => {
    setActiveGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  // ── Column visibility ───────────────────────────────────────────
  const columnVisibility = useMemo((): VisibilityState => {
    const vis: VisibilityState = {}
    for (const [group, cols] of Object.entries(GROUP_COLUMNS)) {
      const visible = activeGroups.has(group as ColumnGroup)
      for (const col of cols) {
        vis[col] = vis[col] || visible
      }
    }
    if (!hasLockedUnlock) vis['lockedAssetUnlock'] = false
    if (!hasHealthcareBreakdown) {
      vis['mediShieldLifePremium'] = false
      vis['ispAdditionalPremium'] = false
      vis['careShieldLifePremium'] = false
      vis['oopExpense'] = false
      vis['mediSaveDeductible'] = false
    }
    if (!hasRa) vis['cpfRA'] = false
    if (!hasOaHousing) vis['cpfOaHousingDeduction'] = false
    if (!hasOaShortfall) vis['cpfOaShortfall'] = false
    if (!hasBequest) vis['cpfBequest'] = false
    if (!hasCpfLife) vis['cpfLifePayout'] = false
    if (!hasMilestone) vis['cpfMilestone'] = false
    if (!hasMortgageCash) vis['mortgageCashPayment'] = false
    if (!hasPropertyValue) vis['propertyValue'] = false
    if (!hasMortgageBalance) vis['mortgageBalance'] = false
    if (!hasPropertyEquity && !hasPropertyValue) vis['propertyEquity'] = false
    if (!hasPropertyEquity && !hasPropertyValue) vis['totalNWIncProperty'] = false
    if (!hasLifeEvents) vis['activeLifeEvents'] = false
    // Auto-hide asset breakdown columns for assets with zero weight across all rows
    for (let i = 0; i < ASSET_CLASSES.length; i++) {
      if (!nonZeroAssets.has(i)) {
        vis[`asset_${ASSET_CLASSES[i].key}Value`] = false
        vis[`asset_${ASSET_CLASSES[i].key}Pct`] = false
      }
    }
    return vis
  }, [
    activeGroups, hasLockedUnlock, hasHealthcareBreakdown, hasRa,
    hasOaHousing, hasOaShortfall, hasBequest, hasCpfLife, hasMilestone,
    hasMortgageCash, hasPropertyValue, hasMortgageBalance, hasPropertyEquity,
    hasLifeEvents, nonZeroAssets,
  ])

  // Set of first-column IDs for each active group — uses first *visible* column
  const groupStartColumns = useMemo(() => {
    const s = new Set<string>()
    for (const g of activeGroups) {
      const cols = GROUP_COLUMNS[g]
      const firstVisible = cols.find((col) => columnVisibility[col] !== false)
      if (firstVisible) s.add(firstVisible)
    }
    return s
  }, [activeGroups, columnVisibility])

  const defaultVisibleCount = useMemo(() => {
    return DEFAULT_COLUMN_IDS.filter((id) => columnVisibility[id] !== false).length
  }, [columnVisibility])

  const groupVisibleCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [group, cols] of Object.entries(GROUP_COLUMNS)) {
      counts[group] = cols.filter((col) => columnVisibility[col] !== false).length
    }
    return counts
  }, [columnVisibility])

  // ── Build columns & table ───────────────────────────────────────
  const columns = useMemo(
    () => buildProjectionColumns(retirementAge, hasMortgageCash),
    [retirementAge, hasMortgageCash],
  )

  const table = useReactTable({
    data: rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
  })

  // ── Empty states ────────────────────────────────────────────────
  if (!result.representative_paths || result.representative_paths.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No representative paths available. Re-run Monte Carlo to generate projection data.
        </CardContent>
      </Card>
    )
  }

  if (!projectionParams) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Fix upstream validation errors before the projection table can be shown.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stale warning */}
      {isStale && (
        <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          Inputs have changed since this simulation was run. Re-run Monte Carlo for updated results.
        </div>
      )}

      {/* Header: percentile selector + retirement balance */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">Scenario:</span>
          <Select
            value={String(selectedPercentile)}
            onValueChange={(v) => setSelectedPercentile(Number(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERCENTILE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPath && (
          <div className="text-sm text-muted-foreground">
            Retirement balance:{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(selectedPath.retirementBalance)}
            </span>
          </div>
        )}
      </div>

      {/* Column group toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {COLUMN_GROUPS.map((group) => (
          <Button
            key={group.key}
            variant={activeGroups.has(group.key) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleGroup(group.key)}
          >
            {group.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      {rows && rows.length > 0 ? (
        <div className="border rounded-md overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b z-20">
              {activeGroups.size > 0 && (
                <tr className="border-b bg-muted/30">
                  <th colSpan={defaultVisibleCount} className="border-b" />
                  {COLUMN_GROUPS.filter((g) => activeGroups.has(g.key) && groupVisibleCount[g.key] > 0).map((g) => (
                    <th
                      key={g.key}
                      colSpan={groupVisibleCount[g.key]}
                      className="px-2 py-1 text-center text-xs font-semibold text-primary/80 border-b border-l-2 border-l-border"
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
              )}
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        'px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap',
                        groupStartColumns.has(header.id) && 'border-l-2 border-l-border',
                        header.column.id === 'age' && 'sticky left-0 z-30 bg-background border-r border-border',
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
                const isDepleted = original.liquidNW <= 0

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b hover:bg-muted/50 group',
                      original.isRetired && 'bg-muted/30',
                      isRetirementRow && 'border-t-2 border-t-orange-400',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isAgeCol = cell.column.id === 'age'
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-2 py-1.5 whitespace-nowrap tabular-nums',
                            isDepleted && !isAgeCol && 'text-destructive',
                            groupStartColumns.has(cell.column.id) && 'border-l-2 border-l-border',
                            isAgeCol && 'sticky left-0 z-10 font-medium bg-background border-r border-border group-hover:bg-muted',
                          )}
                        >
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
      ) : (
        <div className="text-center text-sm text-muted-foreground py-8">
          No projection data to display for the selected percentile.
        </div>
      )}
    </div>
  )
}
