# MC Projection Table Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Projection Table" tab to the Monte Carlo page that shows a full year-by-year projection for a selected percentile scenario (p10/p25/p50/p75/p90).

**Architecture:** The MC engine extracts 5 representative simulation paths after running 10K sims. Each path's return sequence is replayed through the existing `generateProjection()` function with a new `yearlyReturns` override, producing a complete `ProjectionRow[]` identical in format to the deterministic Projection page.

**Tech Stack:** TypeScript, React, Vitest, TanStack Table, Zustand, shadcn/ui Tabs

---

## Review Corrections (from Codex review)

This plan addresses 7 issues found during code review:

1. **`data` scoping** — `useMonteCarloQuery()` is called inside `MonteCarloTab` (line 75), not in `StressTestPage`. Fixed: lift the hook to `StressTestPage` and pass props down.
2. **Param source mismatch** — `useProjection()` uses raw store state (`profile.liquidNetWorth`, `profile.currentAge`), but MC uses analysis-mode-adjusted values (`analysisPortfolio.initialPortfolio`, possibly `skipAccumulation`). Fixed: `MCProjectionTable` uses `useProjection()` for base params BUT offsets `yearlyReturns` using `effectiveStartAge` stored with the paths. In `fireTarget` mode (skipAccumulation), pre-retirement years use deterministic returns and post-retirement uses MC returns.
3. **Timeline off-by-one** — Projection loops `i = 0..totalYears` (inclusive, `totalYears+1` iterations), but MC generates `nYearsTotal` returns. The last row (age = lifeExpectancy) falls back to deterministic return. This is acceptable and documented.
4. **Expense ratio** — `portfolioReturns` in MC are **gross** returns (fee subtracted during balance transitions, not baked into returns). Projection subtracts `expenseRatio` once. Correct: single deduction, no double-counting. Comments fixed.
5. **Naming** — Consistently use `representative_paths` (snake_case matching existing `MonteCarloResult` fields like `success_rate`, `percentile_bands`).
6. **SWR optimizer overhead** — Gate path extraction with `extractPaths` flag on `MonteCarloEngineParams`. SWR optimizer doesn't set it.
7. **Flaky test** — Replace "distinct indices" assertion with "p10 retirement balance < p90 retirement balance" (always true by definition).

---

## Task 1: Add `RepresentativePath` type, `extractPaths` flag, and update MC engine

**Files:**
- Modify: `frontend/src/lib/types.ts` (near line 658)
- Modify: `frontend/src/lib/simulation/monteCarlo.ts` (add flag to params, extract paths)
- Modify: `frontend/src/lib/simulation/monteCarlo.test.ts`

**Step 1: Write the failing test**

File: `frontend/src/lib/simulation/monteCarlo.test.ts`

```typescript
describe('representative paths', () => {
  it('returns 5 representative paths with correct percentiles when extractPaths is true', () => {
    const params = makeDefaultParams({ nSimulations: 500, extractPaths: true })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    expect(result.representative_paths).toBeDefined()
    expect(result.representative_paths).toHaveLength(5)
    const percentiles = result.representative_paths!.map(p => p.percentile)
    expect(percentiles).toEqual([10, 25, 50, 75, 90])
  })

  it('does NOT extract paths when extractPaths is false or omitted', () => {
    const params = makeDefaultParams({ nSimulations: 500 })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    expect(result.representative_paths).toBeUndefined()
  })

  it('each path has yearlyReturns matching total simulation years', () => {
    const params = makeDefaultParams({ nSimulations: 500, extractPaths: true })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    const nYearsTotal = params.lifeExpectancy - params.currentAge // 55
    for (const path of result.representative_paths!) {
      expect(path.yearlyReturns).toHaveLength(nYearsTotal)
      expect(path.simIndex).toBeGreaterThanOrEqual(0)
      expect(path.simIndex).toBeLessThan(500)
    }
  })

  it('p50 path retirement balance approximately matches percentile band p50', () => {
    const params = makeDefaultParams({ nSimulations: 1000, seed: 42, extractPaths: true })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    const retirementYearIndex = params.retirementAge - params.currentAge // 20
    const bandP50AtRetirement = result.percentile_bands.p50[retirementYearIndex]
    const p50Path = result.representative_paths!.find(p => p.percentile === 50)!
    // The representative sim should be close to the percentile value
    // Allow 10% tolerance since we pick the nearest sim, not interpolate
    expect(p50Path.retirementBalance).toBeCloseTo(bandP50AtRetirement, -4)
  })

  it('includes effectiveStartAge for timeline alignment', () => {
    const params = makeDefaultParams({ nSimulations: 500, extractPaths: true })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    expect(result.representative_paths_start_age).toBe(params.currentAge)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/simulation/monteCarlo.test.ts --reporter verbose 2>&1 | tail -20`
Expected: FAIL — `representative_paths` is undefined, `extractPaths` not in type

**Step 3: Add types**

In `frontend/src/lib/types.ts`, add after `MonteCarloResult` (around line 670):

```typescript
export interface RepresentativePath {
  percentile: number
  simIndex: number
  yearlyReturns: number[]   // gross portfolio returns per year (subtract expenseRatio when replaying)
  retirementBalance: number
}
```

Add to `MonteCarloResult` interface:

```typescript
export interface MonteCarloResult {
  // ...existing fields...
  representative_paths?: RepresentativePath[]
  representative_paths_start_age?: number  // the currentAge used by MC (may differ from profile.currentAge in fireTarget mode)
}
```

In `frontend/src/lib/simulation/monteCarlo.ts`, add to `MonteCarloEngineParams`:

```typescript
export interface MonteCarloEngineParams {
  // ...existing fields...
  extractPaths?: boolean  // when true, extract representative paths for projection replay
}
```

**Step 4: Implement path extraction in `monteCarlo.ts`**

After the percentile bands computation (around line 543, after the `for (let y = 0; ...` loop), add:

```typescript
// ---- Extract representative paths (gated to avoid overhead in SWR optimizer) ----
let representativePaths: RepresentativePath[] | undefined
if (params.extractPaths) {
  const TARGET_PERCENTILES = [10, 25, 50, 75, 90]
  representativePaths = []

  // Collect retirement-age balances once
  const retYearIdx = nYearsAccum  // index into balances array at retirement
  const retCol: number[] = new Array(nSims)
  for (let s = 0; s < nSims; s++) {
    retCol[s] = balances[s][retYearIdx]
  }

  for (const pct of TARGET_PERCENTILES) {
    const targetVal = percentile(retCol, pct)

    // Find the sim whose retirement balance is closest to the target percentile
    let bestSim = 0
    let bestDist = Math.abs(retCol[0] - targetVal)
    for (let s = 1; s < nSims; s++) {
      const dist = Math.abs(retCol[s] - targetVal)
      if (dist < bestDist) {
        bestDist = dist
        bestSim = s
      }
    }

    representativePaths.push({
      percentile: pct,
      simIndex: bestSim,
      yearlyReturns: portfolioReturns[bestSim].slice(0, nYearsTotal),
      retirementBalance: balances[bestSim][retYearIdx],
    })
  }
}
```

Update the return object (around line 662):

```typescript
return {
  success_rate: successRate,
  percentile_bands: percentileBands,
  terminal_stats: terminalStats,
  failure_distribution: failureDistribution,
  withdrawal_bands: withdrawalBands,
  spending_metrics: spendingMetrics,
  histogram_snapshots: histogramSnapshots,
  representative_paths: representativePaths,
  representative_paths_start_age: params.extractPaths ? currentAge : undefined,
}
```

Also update `MonteCarloEngineResult` (the `Omit` type near line 53) — since `representative_paths` and `representative_paths_start_age` are optional on `MonteCarloResult`, and the engine returns them conditionally, ensure the `Omit` type doesn't strip them. Check if these new fields need explicit inclusion.

**Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/simulation/monteCarlo.test.ts --reporter verbose 2>&1 | tail -20`
Expected: PASS

**Step 6: Commit**

```
feat(simulation): extract representative paths from MC engine

After running 10K simulations, when extractPaths flag is set,
identify the 5 sims closest to p10/p25/p50/p75/p90 at retirement
age and return their yearly portfolio return sequences. Gated
behind a flag to avoid overhead in SWR optimizer binary search.
```

---

## Task 2: Add `yearlyReturns` override to `generateProjection()`

**Files:**
- Modify: `frontend/src/lib/calculations/projection.ts` (lines 45-96, 351-356)
- Test: `frontend/src/lib/calculations/projection.test.ts`

**Step 1: Write the failing test**

File: `frontend/src/lib/calculations/projection.test.ts`

Find the existing test file and add a new describe block. The test needs a valid `ProjectionParams` with `yearlyReturns`:

```typescript
describe('yearlyReturns override', () => {
  it('uses provided yearly returns instead of expected return', () => {
    // Build minimal valid params (reuse an existing test helper if available)
    const baseResult = generateProjection(validParams)

    // Create a return sequence that's dramatically different (all 20%)
    const nYears = validParams.lifeExpectancy - validParams.currentAge
    const highReturns = Array(nYears).fill(0.20)

    const overrideResult = generateProjection({
      ...validParams,
      yearlyReturns: highReturns,
    })

    // With 20% annual returns, the portfolio should be much larger
    const baseRetirement = baseResult.rows.find(r => r.age === validParams.retirementAge)!
    const overrideRetirement = overrideResult.rows.find(r => r.age === validParams.retirementAge)!
    expect(overrideRetirement.liquidNW).toBeGreaterThan(baseRetirement.liquidNW)
  })

  it('deterministic columns remain identical regardless of yearlyReturns', () => {
    const nYears = validParams.lifeExpectancy - validParams.currentAge
    const result1 = generateProjection({ ...validParams, yearlyReturns: Array(nYears).fill(0.05) })
    const result2 = generateProjection({ ...validParams, yearlyReturns: Array(nYears).fill(0.15) })

    // Income, CPF contributions, tax should be identical
    for (let i = 0; i < result1.rows.length; i++) {
      expect(result1.rows[i].salary).toBe(result2.rows[i].salary)
      expect(result1.rows[i].cpfEmployee).toBe(result2.rows[i].cpfEmployee)
      expect(result1.rows[i].sgTax).toBe(result2.rows[i].sgTax)
    }
  })

  it('falls back to deterministic return when yearlyReturns is shorter than timeline', () => {
    // Projection has totalYears+1 iterations but MC only provides totalYears returns.
    // The last year (age = lifeExpectancy) should fall back gracefully.
    const nYears = validParams.lifeExpectancy - validParams.currentAge
    const shortReturns = Array(nYears).fill(0.10)  // exactly nYears, one short of totalYears+1
    const result = generateProjection({ ...validParams, yearlyReturns: shortReturns })
    // Should not throw, should produce valid rows
    expect(result.rows).toHaveLength(nYears + 1)
  })
})
```

Note: You'll need to look at the existing test file for `projection.test.ts` to find or construct `validParams`. Adapt the test to use whatever param-building helpers exist.

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/calculations/projection.test.ts -t "yearlyReturns" --reporter verbose 2>&1 | tail -20`
Expected: FAIL — `yearlyReturns` not recognized / no effect

**Step 3: Add `yearlyReturns` to `ProjectionParams`**

In `frontend/src/lib/calculations/projection.ts`, add to the interface (after line 95):

```typescript
export interface ProjectionParams {
  // ...existing fields...
  withdrawalBasis: 'expenses' | 'rate'
  yearlyReturns?: number[]  // MC-sourced GROSS portfolio returns per year, indexed by (age - currentAge).
                             // These are gross returns (before expense ratio). The projection engine
                             // subtracts expenseRatio when applying them, same as it does for deterministic returns.
}
```

**Step 4: Implement the override in the projection loop**

In `generateProjection()`, destructure `yearlyReturns` at the top (around line 222 where other params are destructured):

```typescript
const {
  // ...existing destructuring...
  withdrawalBasis,
  yearlyReturns,
} = params
```

Find the return rate computation block (around lines 351-356):

```typescript
// Current code:
let returnRate: number
if (usePortfolioReturn && assetReturns.length === weights.length) {
  returnRate = calculatePortfolioReturn(weights, assetReturns) - expenseRatio
} else {
  returnRate = expectedReturn - expenseRatio
}
```

Replace with:

```typescript
let returnRate: number
const yearIndex = age - currentAge
if (yearlyReturns && yearIndex < yearlyReturns.length) {
  // MC-sourced gross return for this year. Subtract expense ratio here,
  // matching the deterministic path where expenseRatio is also subtracted.
  // This is NOT double-counting: MC portfolioReturns are gross, and the MC
  // engine applies expenseRatio in its own balance transition (line 385),
  // but we're replaying through the projection engine which applies it here.
  returnRate = yearlyReturns[yearIndex] - expenseRatio
} else if (usePortfolioReturn && assetReturns.length === weights.length) {
  returnRate = calculatePortfolioReturn(weights, assetReturns) - expenseRatio
} else {
  returnRate = expectedReturn - expenseRatio
}
```

**Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/calculations/projection.test.ts -t "yearlyReturns" --reporter verbose 2>&1 | tail -20`
Expected: PASS

**Step 6: Run full test suite to check for regressions**

Run: `cd frontend && npx vitest run --reporter verbose 2>&1 | tail -30`
Expected: All existing tests still pass (the optional field doesn't affect existing callers)

**Step 7: Commit**

```
feat(projection): support yearlyReturns override for MC-driven projections

When yearlyReturns is provided in ProjectionParams, the projection
engine uses those MC-sourced gross returns instead of the deterministic
expected return. Expense ratio is subtracted once (not double-counted).
All other calculations (income, CPF, tax, expenses) remain identical.
```

---

## Task 3: Extract shared projection table columns

**Files:**
- Create: `frontend/src/components/shared/projectionColumns.tsx`
- Modify: `frontend/src/pages/ProjectionPage.tsx`

**Step 1: Extract column definitions**

Create `frontend/src/components/shared/projectionColumns.tsx` containing the shared column definitions, helper functions, and group constants currently in `ProjectionPage.tsx`.

Extract from `ProjectionPage.tsx`:
- `columnHelper` (line 48)
- `ColumnGroup` type (line 50)
- `COLUMN_GROUPS` (lines 52-59)
- `GROUP_COLUMNS` (lines 61-68)
- `DEFAULT_COLUMN_IDS` (line 70)
- `currencyCell` (lines 72-74)
- `optionalCurrencyCell` (lines 76-78)
- The full column array from the `useMemo` (lines 312-530+)

Wrap the column array in a function:

```typescript
export function buildProjectionColumns(
  retirementAge: number,
  hasMortgage: boolean,
): ColumnDef<ProjectionRow, number | string>[] {
  return [
    // Copy the full column array from ProjectionPage.tsx useMemo
  ]
}
```

**Step 2: Update ProjectionPage.tsx to import from shared module**

Replace local definitions with imports:

```typescript
import {
  buildProjectionColumns,
  COLUMN_GROUPS,
  GROUP_COLUMNS,
  DEFAULT_COLUMN_IDS,
  type ColumnGroup,
} from '@/components/shared/projectionColumns'
```

Remove the local `columnHelper`, `currencyCell`, `optionalCurrencyCell`, `COLUMN_GROUPS`, `GROUP_COLUMNS`, `DEFAULT_COLUMN_IDS`, and the column `useMemo` from ProjectionPage. Replace the `columns` memo with:

```typescript
const columns = useMemo(
  () => buildProjectionColumns(retirementAge, hasMortgage),
  [retirementAge, hasMortgage]
)
```

**Step 3: Verify ProjectionPage still works**

Run: `cd frontend && npx vitest run --reporter verbose 2>&1 | tail -20`
Run: `cd frontend && npm run type-check`
Expected: All pass, zero type errors

**Step 4: Commit**

```
refactor: extract projection table columns into shared module

Move column definitions, group constants, and formatting helpers
from ProjectionPage into components/shared/projectionColumns.tsx
so the new MC Projection Table can reuse them without duplication.
```

---

## Task 4: Lift `useMonteCarloQuery()` to `StressTestPage` and pass to `MonteCarloTab`

**Files:**
- Modify: `frontend/src/pages/StressTestPage.tsx`

This is the critical fix for Codex issue #1. Currently `useMonteCarloQuery()` is called inside `MonteCarloTab` (line 75), but the projection table tab needs access to `data` from the parent `StressTestPage`.

**Step 1: Lift the hook**

Move `useMonteCarloQuery()` from `MonteCarloTab` to `StressTestPage`:

```typescript
export function StressTestPage() {
  // ...existing code...
  const { mutate, data: mcData, isPending, error, canRun, validationErrors, isStale, reset } = useMonteCarloQuery()

  return (
    // ...
    <MonteCarloTab
      isAdvanced={isStressAdvanced}
      mutate={mutate}
      data={mcData}
      isPending={isPending}
      error={error}
      canRun={canRun}
      validationErrors={validationErrors}
      isStale={isStale}
      reset={reset}
    />
    // ...
  )
}
```

Update `MonteCarloTab` to accept props instead of calling the hook:

```typescript
interface MonteCarloTabProps {
  isAdvanced: boolean
  mutate: () => void
  data: MonteCarloResult | undefined
  isPending: boolean
  error: Error | null
  canRun: boolean
  validationErrors: Record<string, string>
  isStale: boolean
  reset: () => void
}

function MonteCarloTab({
  isAdvanced,
  mutate, data, isPending, error, canRun, validationErrors, isStale, reset,
}: MonteCarloTabProps) {
  // Remove: const { mutate, data, isPending, error, canRun, validationErrors, isStale } = useMonteCarloQuery()
  // Keep everything else the same
```

**Step 2: Verify types compile and existing MC functionality works**

Run: `cd frontend && npm run type-check`
Run: `cd frontend && npm run dev -- --port 5173` and verify MC simulation still works

**Step 3: Commit**

```
refactor: lift useMonteCarloQuery to StressTestPage

Move the MC query hook from MonteCarloTab to its parent so the
MC result data is accessible for the upcoming projection table tab.
MonteCarloTab now receives data via props instead of calling the
hook directly.
```

---

## Task 5: Set `extractPaths: true` in `useMonteCarloQuery`

**Files:**
- Modify: `frontend/src/hooks/useMonteCarloQuery.ts` (line ~378)

**Step 1: Add the flag**

In `useMonteCarloQuery.ts`, find where `MonteCarloEngineParams` is constructed (around line 355):

```typescript
const params: MonteCarloEngineParams = {
  // ...existing fields...
  withdrawalBasis: simulation.withdrawalBasis,
  extractPaths: true,  // Enable representative path extraction for projection table
}
```

**Step 2: Verify worker passes it through**

Read `simulation.worker.ts` and `workerClient.ts` to confirm:
1. The worker passes the full params object to `runMonteCarlo()` (not cherry-picking fields)
2. The result is returned as-is via `postMessage` (not filtering fields)

The structured clone algorithm handles plain objects/arrays, so `representative_paths` will serialize correctly.

**Step 3: Commit**

```
feat: enable representative path extraction in MC query hook
```

---

## Task 6: Build the `MCProjectionTable` component

**Files:**
- Create: `frontend/src/components/simulation/MCProjectionTable.tsx`

**IMPORTANT: Param source mismatch fix (Codex issue #2)**

The MC engine may run with different params than `useProjection()` provides:
- In `fireTarget` analysis mode: MC starts at `retirementAge` with `fireNumber` as portfolio, skipping accumulation
- In `myPlan` mode: MC starts at `currentAge` with `liquidNetWorth + CPF`, running accumulation

`useProjection()` always starts at `currentAge` with `liquidNetWorth`. This is correct for the projection replay because we WANT the full timeline. The `yearlyReturns` array from MC may be shorter than the projection timeline (in `fireTarget` mode). We handle this with `representative_paths_start_age`:

- If MC started at `retirementAge` (fireTarget), the yearlyReturns only cover post-retirement years
- We offset the returns: `yearlyReturns` index 0 corresponds to `representative_paths_start_age`, not necessarily `currentAge`
- Pre-retirement years fall back to the deterministic return (which is fine: the user chose to skip accumulation analysis)

**Step 1: Create the component**

```tsx
import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type VisibilityState,
} from '@tanstack/react-table'
import type { MonteCarloResult, ProjectionRow } from '@/lib/types'
import { generateProjection } from '@/lib/calculations/projection'
import { useProjection } from '@/hooks/useProjection'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import {
  buildProjectionColumns,
  COLUMN_GROUPS,
  GROUP_COLUMNS,
  DEFAULT_COLUMN_IDS,
  type ColumnGroup,
} from '@/components/shared/projectionColumns'

const PERCENTILE_OPTIONS = [
  { value: '10', label: 'Pessimistic (p10)' },
  { value: '25', label: 'Cautious (p25)' },
  { value: '50', label: 'Median (p50)' },
  { value: '75', label: 'Optimistic (p75)' },
  { value: '90', label: 'Best Case (p90)' },
]

interface MCProjectionTableProps {
  result: MonteCarloResult
}

export function MCProjectionTable({ result }: MCProjectionTableProps) {
  const [selectedPercentile, setSelectedPercentile] = useState('50')
  const { params: projectionParams } = useProjection()
  const [expandedGroups, setExpandedGroups] = useState<Set<ColumnGroup>>(new Set())

  // Find the selected representative path
  const selectedPath = useMemo(() => {
    if (!result.representative_paths) return null
    return result.representative_paths.find(
      p => p.percentile === Number(selectedPercentile)
    ) ?? null
  }, [result.representative_paths, selectedPercentile])

  // Generate full projection using MC returns, with timeline alignment
  const rows = useMemo(() => {
    if (!selectedPath || !projectionParams) return null

    // Align MC returns to projection timeline.
    // MC may have started at a different age (fireTarget mode starts at retirementAge).
    // Projection always starts at currentAge.
    const mcStartAge = result.representative_paths_start_age ?? projectionParams.currentAge
    const projStartAge = projectionParams.currentAge
    const totalYears = projectionParams.lifeExpectancy - projStartAge

    let alignedReturns: number[]
    if (mcStartAge === projStartAge) {
      // Common case: MC and projection share the same timeline
      alignedReturns = selectedPath.yearlyReturns
    } else {
      // fireTarget mode: MC returns only cover post-retirement.
      // Pad pre-retirement years with undefined (will fall back to deterministic).
      const offset = mcStartAge - projStartAge
      alignedReturns = new Array(totalYears).fill(undefined)
      for (let i = 0; i < selectedPath.yearlyReturns.length; i++) {
        const projIndex = offset + i
        if (projIndex >= 0 && projIndex < totalYears) {
          alignedReturns[projIndex] = selectedPath.yearlyReturns[i]
        }
      }
    }

    const { rows } = generateProjection({
      ...projectionParams,
      yearlyReturns: alignedReturns,
    })
    return rows
  }, [selectedPath, projectionParams, result.representative_paths_start_age])

  // Column visibility (same logic as ProjectionPage)
  const columnVisibility = useMemo((): VisibilityState => {
    const vis: VisibilityState = {}
    for (const group of COLUMN_GROUPS) {
      for (const colId of GROUP_COLUMNS[group.key]) {
        vis[colId] = expandedGroups.has(group.key)
      }
    }
    for (const id of DEFAULT_COLUMN_IDS) {
      vis[id] = true
    }
    if (rows && rows.every(r => r.mortgageCashPayment === 0)) {
      vis['mortgageCashPayment'] = false
    }
    return vis
  }, [expandedGroups, rows])

  const retirementAge = projectionParams?.retirementAge ?? 55
  const hasMortgage = rows ? rows.some(r => r.mortgageCashPayment > 0) : false
  const columns = useMemo(
    () => buildProjectionColumns(retirementAge, hasMortgage),
    [retirementAge, hasMortgage]
  )

  const table = useReactTable({
    data: rows ?? [],
    columns,
    state: { columnVisibility },
    getCoreRowModel: getCoreRowModel(),
  })

  if (!result.representative_paths || result.representative_paths.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No representative paths available. Run the simulation again.
        </CardContent>
      </Card>
    )
  }

  if (!projectionParams) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Projection parameters unavailable. Check input validation.
        </CardContent>
      </Card>
    )
  }

  const toggleGroup = (group: ColumnGroup) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-lg">
            Projection Table
            {selectedPath && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Retirement portfolio: {formatCurrency(selectedPath.retirementBalance)}
              </span>
            )}
          </CardTitle>
          <Select value={selectedPercentile} onValueChange={setSelectedPercentile}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERCENTILE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Column group toggles */}
        <div className="flex flex-wrap gap-2 mt-2">
          {COLUMN_GROUPS.map(group => (
            <Button
              key={group.key}
              variant={expandedGroups.has(group.key) ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleGroup(group.key)}
            >
              {group.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows && rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className={cn(
                        'px-2 py-1.5 text-right font-medium whitespace-nowrap',
                        header.id === 'age' && 'text-left sticky left-0 bg-background z-10'
                      )}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b hover:bg-muted/50',
                    row.original.isRetired && 'bg-blue-50/50 dark:bg-blue-950/20'
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-2 py-1 text-right whitespace-nowrap',
                        cell.column.id === 'age' && 'text-left sticky left-0 bg-background z-10'
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Select a percentile to view the projection.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Verify types compile**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

**Step 3: Commit**

```
feat(ui): add MCProjectionTable component

Renders a full year-by-year projection table for a selected MC
percentile scenario. Handles timeline alignment between MC and
projection engines (including fireTarget analysis mode). Reuses
shared column definitions from projectionColumns module.
```

---

## Task 7: Wire MCProjectionTable into StressTestPage tabs

**Files:**
- Modify: `frontend/src/pages/StressTestPage.tsx`

**Step 1: Add the tab (uses lifted `mcData` from Task 4)**

Import the component:

```typescript
import { MCProjectionTable } from '@/components/simulation/MCProjectionTable'
```

In `StressTestPage`, update the Tabs section to add the projection table tab. Since `mcData` is now available at this level (from Task 4), this works directly:

```tsx
const hasResults = !!mcData

<Tabs defaultValue="monte-carlo" onValueChange={(tab) => trackEvent('stress_test_tab_changed', { tab })}>
  <TabsList className={`grid w-full grid-cols-${
    (hasResults ? 1 : 0) + 1 + (isStressAdvanced ? 2 : 0)
  }`}>
    <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
    {hasResults && <TabsTrigger value="mc-projection">Projection Table</TabsTrigger>}
    {isStressAdvanced && <TabsTrigger value="backtest">Historical Backtest</TabsTrigger>}
    {isStressAdvanced && <TabsTrigger value="sequence-risk">Sequence Risk</TabsTrigger>}
  </TabsList>

  <TabsContent value="monte-carlo">
    <MonteCarloTab
      isAdvanced={isStressAdvanced}
      mutate={mutate}
      data={mcData}
      isPending={isPending}
      error={error}
      canRun={canRun}
      validationErrors={validationErrors}
      isStale={isStale}
      reset={reset}
    />
  </TabsContent>

  {hasResults && (
    <TabsContent value="mc-projection">
      <MCProjectionTable result={mcData} />
    </TabsContent>
  )}

  {/* backtest and sequence-risk tabs unchanged */}
</Tabs>
```

Note: The dynamic `grid-cols-N` may need a safelist in Tailwind config or use explicit class mapping instead of template literal.

**Step 2: Verify types compile and manual test**

Run: `cd frontend && npm run type-check`
Run: `cd frontend && npm run dev -- --port 5173`

1. Navigate to Stress Test page
2. Run MC simulation
3. Verify "Projection Table" tab appears
4. Click it — should show table with median (p50) selected
5. Switch percentiles — portfolio columns change, income stays same
6. Toggle column groups — expand/collapse works

**Step 3: Commit**

```
feat(ui): wire MC projection table tab into StressTestPage

After MC simulation completes, a new "Projection Table" tab
appears. Users can select a percentile to see the full year-by-year
projection under that market scenario.
```

---

## Task 8: End-to-end verification and edge cases

**Files:**
- Modify: `frontend/src/lib/simulation/monteCarlo.test.ts` (add edge case tests)

**Step 1: Add edge case tests**

```typescript
describe('representative paths edge cases', () => {
  it('works when already retired (nYearsAccum = 0)', () => {
    const params = makeDefaultParams({
      currentAge: 55,
      retirementAge: 55,
      annualSavings: [],
      nSimulations: 100,
      extractPaths: true,
    })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    expect(result.representative_paths).toHaveLength(5)
    for (const path of result.representative_paths!) {
      expect(path.yearlyReturns).toHaveLength(35) // 90 - 55
    }
    expect(result.representative_paths_start_age).toBe(55)
  })

  it('p10 retirement balance is less than p90 retirement balance', () => {
    const params = makeDefaultParams({ nSimulations: 1000, seed: 42, extractPaths: true })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    const p10 = result.representative_paths!.find(p => p.percentile === 10)!
    const p90 = result.representative_paths!.find(p => p.percentile === 90)!
    expect(p10.retirementBalance).toBeLessThan(p90.retirementBalance)
  })

  it('returns undefined paths when extractPaths is not set', () => {
    const params = makeDefaultParams({ nSimulations: 100 })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    expect(result.representative_paths).toBeUndefined()
    expect(result.representative_paths_start_age).toBeUndefined()
  })
})
```

**Step 2: Run full test suite**

Run: `cd frontend && npx vitest run --reporter verbose 2>&1 | tail -30`
Expected: All tests pass

**Step 3: Run type-check and lint**

Run: `cd frontend && npm run type-check && npm run lint`
Expected: Zero errors

**Step 4: Commit**

```
test: add edge case tests for MC representative paths

Cover already-retired scenario, percentile ordering invariant,
and extractPaths flag gating.
```

---

## Summary: File Change Map

| File | Action | Task |
|------|--------|------|
| `frontend/src/lib/types.ts` | Add `RepresentativePath`, update `MonteCarloResult` | 1 |
| `frontend/src/lib/simulation/monteCarlo.ts` | Add `extractPaths` flag, extract paths | 1 |
| `frontend/src/lib/simulation/monteCarlo.test.ts` | Tests for paths + edge cases | 1, 8 |
| `frontend/src/lib/calculations/projection.ts` | Add `yearlyReturns` to params + override logic | 2 |
| `frontend/src/lib/calculations/projection.test.ts` | Tests for yearlyReturns override | 2 |
| `frontend/src/components/shared/projectionColumns.tsx` | Extract shared column definitions | 3 |
| `frontend/src/pages/ProjectionPage.tsx` | Import from shared columns module | 3 |
| `frontend/src/pages/StressTestPage.tsx` | Lift MC hook, add projection tab | 4, 7 |
| `frontend/src/hooks/useMonteCarloQuery.ts` | Set `extractPaths: true` | 5 |
| `frontend/src/components/simulation/MCProjectionTable.tsx` | New component with timeline alignment | 6 |

## Dependency Graph

```
Task 1 (MC engine + types) ──┐
                               ├──► Task 6 (MCProjectionTable) ──► Task 7 (wire tab) ──► Task 8 (e2e)
Task 2 (projection override)──┘            ▲                            ▲
                                           │                            │
Task 3 (extract columns)──────────────────┘                            │
Task 4 (lift MC hook) ────────────────────────────────────────────────┘
Task 5 (set extractPaths) ────────────────────────────────────────────┘
```

**Parallelizable:** Tasks 1, 2, 3, 4, and 5 are all independent and can run in parallel. Tasks 6 and 7 depend on all of them.
