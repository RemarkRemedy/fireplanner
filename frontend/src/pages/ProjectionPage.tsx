import { useState, useMemo, useEffect, useCallback } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type VisibilityState,
} from '@tanstack/react-table'
import type { WithdrawalStrategyType } from '@/lib/types'
import { useProjection } from '@/hooks/useProjection'
import { useProfileStore } from '@/stores/useProfileStore'
import { useSimulationStore } from '@/stores/useSimulationStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { NWChartView } from '@/components/projection/NWChartView'
import { TableIcon, BarChart3, Maximize2 } from 'lucide-react'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import { useUIStore } from '@/stores/useUIStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StrategyParamCard } from '@/components/withdrawal/StrategyParamsSection'
import { WithdrawalBasisToggle } from '@/components/shared/WithdrawalBasisToggle'
import { getStrategyLabel } from '@/hooks/useWithdrawalComparison'
import { trackEvent } from '@/lib/analytics'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  buildProjectionColumns,
  type ColumnGroup,
  COLUMN_GROUPS,
  GROUP_COLUMNS,
  DEFAULT_COLUMN_IDS,
} from '@/components/shared/projectionColumns'

const STRATEGY_SHORT_LABELS: Record<WithdrawalStrategyType, string> = {
  constant_dollar: '4% Rule',
  vpw: 'VPW',
  guardrails: 'Guardrails',
  vanguard_dynamic: 'Vanguard Dynamic',
  cape_based: 'CAPE-Based',
  floor_ceiling: 'Floor & Ceiling',
  percent_of_portfolio: '% of Portfolio',
  one_over_n: '1/N',
  sensible_withdrawals: 'Sensible',
  ninety_five_percent: '95% Rule',
  endowment: 'Endowment',
  hebeler_autopilot: 'Hebeler',
}

export function ProjectionPage() {
  usePageMeta({ title: 'Projection — SG FIRE Planner', description: 'Year-by-year financial projection with net worth trajectory, CPF balances, and retirement milestones.', path: '/projection' })
  const { rows, summary, hasErrors } = useProjection()
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const currentAge = useProfileStore((s) => s.currentAge)
  const inflation = useProfileStore((s) => s.inflation)
  const srsBalance = useProfileStore((s) => s.srsBalance)
  const srsAnnualContribution = useProfileStore((s) => s.srsAnnualContribution)
  const hasSrs = srsBalance > 0 || srsAnnualContribution > 0
  const activeStrategy = useSimulationStore((s) => s.selectedStrategy)
  const setSimField = useSimulationStore((s) => s.setField)

  const dollarBasis = useUIStore((s) => s.dollarBasis)
  const setUIField = useUIStore((s) => s.setField)

  // Detect which CPF detail columns have data (hide empty ones to reduce clutter)
  const hasOaHousing = rows?.some((r) => r.cpfOaHousingDeduction > 0) ?? false
  const hasOaShortfall = rows?.some((r) => r.cpfOaShortfall > 0) ?? false
  const hasRa = rows?.some((r) => r.cpfRA > 0) ?? false
  const hasBequest = rows?.some((r) => r.cpfBequest > 0) ?? false
  const hasCpfLife = rows?.some((r) => r.cpfLifePayout > 0) ?? false
  const hasMilestone = rows?.some((r) => r.cpfMilestone !== null) ?? false
  const hasMortgageCash = rows?.some((r) => r.mortgageCashPayment > 0) ?? false
  const hasPropertyValue = rows?.some((r) => r.propertyValue > 0) ?? false
  const hasMortgageBalance = rows?.some((r) => r.mortgageBalance > 0) ?? false
  const hasPropertyEquity = rows?.some((r) => r.propertyEquity > 0) ?? false
  const hasLifeEvents = rows?.some((r) => r.activeLifeEvents.length > 0) ?? false
  const hasLockedUnlock = rows?.some((r) => r.lockedAssetUnlock > 0) ?? false
  const hasHealthcareBreakdown = rows?.some((r) => r.healthcareCashOutlay > 0) ?? false

  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [activeGroups, setActiveGroups] = useState<Set<ColumnGroup>>(new Set())

  const mode = useEffectiveMode('section-projection')
  const setSectionMode = useUIStore((s) => s.setSectionMode)

  // Deflate a nominal value to today's dollars: value / (1 + inflation)^year
  const deflate = useCallback(
    (value: number, year: number) =>
      dollarBasis === 'real' ? value / Math.pow(1 + inflation, year) : value,
    [dollarBasis, inflation],
  )

  // Pre-deflate all monetary fields so table, chart, and summary use consistent values
  const displayRows = useMemo(() => {
    if (!rows || dollarBasis === 'nominal') return rows
    return rows.map((row) => {
      const d = (v: number) => deflate(v, row.year)
      return {
        ...row,
        totalIncome: d(row.totalIncome),
        annualExpenses: d(row.annualExpenses),
        savingsOrWithdrawal: d(row.savingsOrWithdrawal),
        portfolioReturnDollar: d(row.portfolioReturnDollar),
        liquidNW: d(row.liquidNW),
        cpfTotal: d(row.cpfTotal),
        totalNW: d(row.totalNW),
        salary: d(row.salary),
        rentalIncome: d(row.rentalIncome),
        investmentIncome: d(row.investmentIncome),
        businessIncome: d(row.businessIncome),
        governmentIncome: d(row.governmentIncome),
        srsWithdrawal: d(row.srsWithdrawal),
        totalGross: d(row.totalGross),
        sgTax: d(row.sgTax),
        cpfEmployee: d(row.cpfEmployee),
        cpfEmployer: d(row.cpfEmployer),
        totalNet: d(row.totalNet),
        cpfOA: d(row.cpfOA),
        cpfSA: d(row.cpfSA),
        cpfMA: d(row.cpfMA),
        cpfRA: d(row.cpfRA),
        cpfInterest: d(row.cpfInterest),
        cpfOaHousingDeduction: d(row.cpfOaHousingDeduction),
        cpfOaShortfall: d(row.cpfOaShortfall),
        cpfLifePayout: d(row.cpfLifePayout),
        cpfBequest: d(row.cpfBequest),
        withdrawalAmount: d(row.withdrawalAmount),
        maxPermittedWithdrawal: d(row.maxPermittedWithdrawal),
        withdrawalExcess: d(row.withdrawalExcess),
        propertyValue: d(row.propertyValue),
        mortgageBalance: d(row.mortgageBalance),
        propertyEquity: d(row.propertyEquity),
        totalNWIncProperty: d(row.totalNWIncProperty),
        baseInflatedExpenses: d(row.baseInflatedExpenses),
        parentSupportExpense: d(row.parentSupportExpense),
        healthcareCashOutlay: d(row.healthcareCashOutlay),
        mortgageCashPayment: d(row.mortgageCashPayment),
        downsizingRentExpense: d(row.downsizingRentExpense),
        goalExpense: d(row.goalExpense),
        goalShortfall: d(row.goalShortfall),
        retirementWithdrawalExpense: d(row.retirementWithdrawalExpense),
        retirementWithdrawalShortfall: d(row.retirementWithdrawalShortfall),
        srsBalance: d(row.srsBalance),
        srsContribution: d(row.srsContribution),
        srsTaxableWithdrawal: d(row.srsTaxableWithdrawal),
        lockedAssetUnlock: d(row.lockedAssetUnlock),
        mediShieldLifePremium: d(row.mediShieldLifePremium),
        ispAdditionalPremium: d(row.ispAdditionalPremium),
        careShieldLifePremium: d(row.careShieldLifePremium),
        oopExpense: d(row.oopExpense),
        mediSaveDeductible: d(row.mediSaveDeductible),
        cumulativeSavings: d(row.cumulativeSavings),
      }
    })
  }, [rows, dollarBasis, deflate])

  const displaySummary = useMemo(() => {
    if (!summary || dollarBasis === 'nominal') return summary
    const yearOf = (age: number) => age - currentAge
    return {
      ...summary,
      peakTotalNW: deflate(summary.peakTotalNW, yearOf(summary.peakTotalNWAge)),
      terminalLiquidNW: deflate(summary.terminalLiquidNW, rows ? rows.length - 1 : 0),
      terminalTotalNW: deflate(summary.terminalTotalNW, rows ? rows.length - 1 : 0),
    }
  }, [summary, dollarBasis, deflate, currentAge, rows])

  // Compute goal shortfall stats from (already-deflated) display rows
  const goalShortfallInfo = useMemo(() => {
    if (!displayRows) return null
    const shortfallRows = displayRows.filter((r) => r.goalShortfall > 0)
    if (shortfallRows.length === 0) return null
    const totalShortfall = shortfallRows.reduce((sum, r) => sum + r.goalShortfall, 0)
    const affectedAges = shortfallRows.map((r) => r.age)
    return { totalShortfall, affectedAges }
  }, [displayRows])

  // Compute retirement withdrawal shortfall stats from (already-deflated) display rows
  const retirementWithdrawalShortfallInfo = useMemo(() => {
    if (!displayRows) return null
    const shortfallRows = displayRows.filter((r) => r.retirementWithdrawalShortfall > 0)
    if (shortfallRows.length === 0) return null
    const totalShortfall = shortfallRows.reduce((sum, r) => sum + r.retirementWithdrawalShortfall, 0)
    const affectedAges = shortfallRows.map((r) => r.age)
    return { totalShortfall, affectedAges }
  }, [displayRows])

  useEffect(() => {
    if (mode === 'advanced') {
      setActiveGroups(new Set(['expensesBreakdown', 'incomeBreakdown', 'taxCpf', 'cpfBalances', 'portfolio', 'property']))
    } else {
      setActiveGroups(new Set())
    }
  }, [mode])

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

  // Set of first-column IDs for each active group — used to draw vertical dividers
  const groupStartColumns = useMemo(() => {
    const s = new Set<string>()
    for (const g of activeGroups) {
      const cols = GROUP_COLUMNS[g]
      if (cols.length > 0) s.add(cols[0])
    }
    return s
  }, [activeGroups])

  const isMobile = useMediaQuery('(max-width: 767px)')
  const [expanded, setExpanded] = useState(false)

  const columnVisibility = useMemo((): VisibilityState => {
    const vis: VisibilityState = {}
    for (const [group, cols] of Object.entries(GROUP_COLUMNS)) {
      const visible = activeGroups.has(group as ColumnGroup)
      for (const col of cols) {
        // OR semantics: show column if ANY containing group is active
        vis[col] = vis[col] || visible
      }
    }
    // Hide SRS columns when user has no SRS balance or contributions
    if (!hasSrs) {
      vis['srsWithdrawal'] = false
      vis['srsBalance'] = false
      vis['srsContribution'] = false
      vis['srsTaxableWithdrawal'] = false
    }
    if (!hasLockedUnlock) vis['lockedAssetUnlock'] = false
    if (!hasHealthcareBreakdown) {
      vis['mediShieldLifePremium'] = false
      vis['ispAdditionalPremium'] = false
      vis['careShieldLifePremium'] = false
      vis['oopExpense'] = false
      vis['mediSaveDeductible'] = false
    }
    // Hide CPF detail columns when no relevant data exists
    if (!hasRa) vis['cpfRA'] = false
    if (!hasOaHousing) vis['cpfOaHousingDeduction'] = false
    if (!hasOaShortfall) vis['cpfOaShortfall'] = false
    if (!hasBequest) vis['cpfBequest'] = false
    if (!hasCpfLife) vis['cpfLifePayout'] = false
    if (!hasMilestone) vis['cpfMilestone'] = false
    // Hide mortgage(cash) default column when no mortgage data exists
    if (!hasMortgageCash) vis['mortgageCashPayment'] = false
    // Hide property columns when no property data exists
    if (!hasPropertyValue) vis['propertyValue'] = false
    if (!hasMortgageBalance) vis['mortgageBalance'] = false
    if (!hasPropertyEquity && !hasPropertyValue) vis['propertyEquity'] = false
    if (!hasPropertyEquity && !hasPropertyValue) vis['totalNWIncProperty'] = false
    if (!hasLifeEvents) vis['activeLifeEvents'] = false
    // Hide less-essential default columns on mobile to reduce horizontal scroll
    if (isMobile) {
      vis['portfolioReturnDollar'] = vis['portfolioReturnDollar'] || false
      vis['cpfTotal'] = vis['cpfTotal'] || false
      vis['fireProgress'] = vis['fireProgress'] || false
    }
    return vis
  }, [activeGroups, isMobile, hasSrs, hasMortgageCash, hasRa, hasOaHousing, hasOaShortfall, hasBequest, hasCpfLife, hasMilestone, hasPropertyEquity, hasLifeEvents, hasLockedUnlock, hasHealthcareBreakdown])

  const defaultVisibleCount = useMemo(() => {
    return DEFAULT_COLUMN_IDS.filter(id => columnVisibility[id] !== false).length
  }, [columnVisibility])

  // Visible column count per group — accounts for individually hidden columns (e.g. SRS)
  const groupVisibleCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [group, cols] of Object.entries(GROUP_COLUMNS)) {
      counts[group] = cols.filter((col) => columnVisibility[col] !== false).length
    }
    return counts
  }, [columnVisibility])

  const columns = useMemo(
    () => buildProjectionColumns(retirementAge, hasMortgageCash),
    [retirementAge, hasMortgageCash],
  )

  const table = useReactTable({
    data: displayRows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
  })

  // Identify special rows
  const fireAchievedAge = displaySummary?.fireAchievedAge ?? null

  const renderTable = (containerClass: string) => (
    <div className={cn('border rounded-md overflow-auto', containerClass)}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background border-b z-20">
          {activeGroups.size > 0 && (
            <tr className="border-b bg-muted/30">
              <th colSpan={defaultVisibleCount} className="border-b" />
              {COLUMN_GROUPS.filter(g => activeGroups.has(g.key)).map(g => (
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
            const isFireRow = original.age === fireAchievedAge
            const isDepleted = original.liquidNW <= 0

            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b hover:bg-muted/50 group',
                  original.isRetired && 'bg-muted/30',
                  isRetirementRow && 'border-t-2 border-t-orange-400',
                  isFireRow && 'bg-green-50 dark:bg-green-900/10',
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
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Year-by-Year Projection</h1>
            <p className="text-muted-foreground text-sm">
              Deterministic trajectory showing income, portfolio growth, and FIRE progress.
              Verify your inputs produce sensible numbers before running Monte Carlo analysis.
              {' '}
              <span className="font-medium">
                {dollarBasis === 'real'
                  ? "All values in today's dollars — expenses appear flat because inflation is factored out."
                  : 'All values in future (nominal) dollars — expenses grow at your inflation rate.'}
              </span>
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 shrink-0 mt-1">
            <button
              onClick={() => setSectionMode('section-projection', 'simple')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                mode === 'simple'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Simple
            </button>
            <button
              onClick={() => setSectionMode('section-projection', 'advanced')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                mode === 'advanced'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Advanced
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium whitespace-nowrap">Withdrawal Strategy:</span>
            <Select
              value={activeStrategy}
              onValueChange={(v) => setSimField('selectedStrategy', v as WithdrawalStrategyType)}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STRATEGY_SHORT_LABELS) as WithdrawalStrategyType[]).map((key) => (
                  <SelectItem key={key} value={key}>{getStrategyLabel(key)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <WithdrawalBasisToggle />
          </div>
          <StrategyParamCard strategy={activeStrategy} />
        </div>
      </div>

      {hasErrors && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-medium">
            Fix upstream validation errors before the projection can be computed.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <Link to="/inputs#section-personal" className="text-sm text-destructive hover:underline font-medium">
              Fix in Personal Details &rarr;
            </Link>
            <Link to="/inputs#section-income" className="text-sm text-destructive hover:underline font-medium">
              Fix in Income &rarr;
            </Link>
            <Link to="/inputs#section-allocation" className="text-sm text-destructive hover:underline font-medium">
              Fix in Allocation &rarr;
            </Link>
          </div>
        </div>
      )}

      {displaySummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                FIRE Achieved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {displaySummary.fireAchievedAge !== null ? `Age ${displaySummary.fireAchievedAge}` : 'Not reached'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Peak Total NW
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(displaySummary.peakTotalNW)}</p>
              <p className="text-xs text-muted-foreground">at age {displaySummary.peakTotalNWAge}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Terminal NW
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(displaySummary.terminalTotalNW)}</p>
              <p className="text-xs text-muted-foreground">
                Liquid: {formatCurrency(displaySummary.terminalLiquidNW)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Portfolio Depleted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn(
                'text-2xl font-bold',
                displaySummary.portfolioDepletedAge !== null && 'text-destructive',
              )}>
                {displaySummary.portfolioDepletedAge !== null ? `Age ${displaySummary.portfolioDepletedAge}` : 'Never'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {displaySummary && (() => {
        const { fireAchievedAge, peakTotalNW, peakTotalNWAge, portfolioDepletedAge, terminalTotalNW } = displaySummary
        const depleted = portfolioDepletedAge !== null

        let narrative: string
        if (fireAchievedAge !== null && !depleted) {
          narrative = `At your current savings rate, you reach financial independence at age ${fireAchievedAge}. Your portfolio peaks at ${formatCurrency(peakTotalNW)} at age ${peakTotalNWAge} and ends at ${formatCurrency(terminalTotalNW)}.`
        } else if (fireAchievedAge !== null && depleted) {
          narrative = `You reach financial independence at age ${fireAchievedAge}, but your portfolio depletes at age ${portfolioDepletedAge}. Consider reducing spending or adjusting your withdrawal strategy.`
        } else if (!depleted) {
          narrative = `Your portfolio does not reach the FIRE target within the projection period, but never depletes. It peaks at ${formatCurrency(peakTotalNW)} at age ${peakTotalNWAge}.`
        } else {
          narrative = `Your portfolio does not reach the FIRE target and depletes at age ${portfolioDepletedAge}. Consider increasing savings or extending your working years.`
        }

        return (
          <p className={cn(
            'text-sm rounded-md p-3 border',
            depleted
              ? 'text-destructive bg-destructive/5 border-destructive/20'
              : 'text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          )}>
            {narrative}
          </p>
        )
      })()}

      {goalShortfallInfo && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">{formatCurrency(goalShortfallInfo.totalShortfall)}</span>
            {' '}of your financial goals could not be funded.
            Affected age{goalShortfallInfo.affectedAges.length > 1 ? 's' : ''}: {goalShortfallInfo.affectedAges.join(', ')}.
            Consider reducing goal amounts, delaying goals, or increasing savings.
          </div>
        </div>
      )}

      {retirementWithdrawalShortfallInfo && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">{formatCurrency(retirementWithdrawalShortfallInfo.totalShortfall)}</span>
            {' '}of your retirement withdrawals could not be funded.
            Affected age{retirementWithdrawalShortfallInfo.affectedAges.length > 1 ? 's' : ''}: {retirementWithdrawalShortfallInfo.affectedAges.join(', ')}.
            Consider reducing withdrawal amounts or increasing retirement savings.
          </div>
        </div>
      )}

      {displayRows && displayRows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" /> Chart
              </button>
            </div>
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => { setUIField('dollarBasis', 'real'); trackEvent('dollar_basis_changed', { basis: 'real' }) }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  dollarBasis === 'real'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Show values in today's purchasing power"
              >
                Real $
              </button>
              <button
                onClick={() => { setUIField('dollarBasis', 'nominal'); trackEvent('dollar_basis_changed', { basis: 'nominal' }) }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  dollarBasis === 'nominal'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Show actual future dollar amounts"
              >
                Nominal $
              </button>
            </div>
            {viewMode === 'table' && (
              <button
                onClick={() => setExpanded(true)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Expand table"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
            {viewMode === 'table' && COLUMN_GROUPS.map((group) => (
              <Button
                key={group.key}
                variant={activeGroups.has(group.key) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleGroup(group.key)}
              >
                {group.label}
              </Button>
            ))}
            {viewMode === 'table' && mode === 'simple' && (
              <span className="hidden sm:inline text-xs text-muted-foreground">
                Toggle columns or switch to Advanced for all
              </span>
            )}
          </div>

          {viewMode === 'chart' ? (
            <NWChartView rows={displayRows} retirementAge={retirementAge} />
          ) : (
          <>
          <p className="text-xs text-muted-foreground md:hidden">Tap toggles to show more columns</p>
          {renderTable('max-h-[70vh]')}
          </>
          )}
        </>
      )}

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] h-[95vh] max-h-[95vh] flex flex-col p-4">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-bold">Year-by-Year Projection</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 shrink-0 pb-2">
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
          {renderTable('flex-1 min-h-0')}
        </DialogContent>
      </Dialog>
    </div>
  )
}
