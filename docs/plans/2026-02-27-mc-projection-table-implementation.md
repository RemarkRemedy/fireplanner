# MC Projection Table Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Projection Table" tab to the Monte Carlo page that shows a full year-by-year projection for a selected percentile scenario (p10/p25/p50/p75/p90).

**Architecture:** The MC engine extracts 5 representative simulation paths after running 10K sims. Each path's return sequence is replayed through the existing `generateProjection()` function with a new `yearlyReturns` override, producing a complete `ProjectionRow[]` identical in format to the deterministic Projection page.

**Tech Stack:** TypeScript, React, Vitest, TanStack Table, Zustand, shadcn/ui Tabs

---

## Task 1: Add `RepresentativePath` type and update `MonteCarloResult`

**Files:**
- Modify: `frontend/src/lib/types.ts` (near line 658)

**Step 1: Write the failing test**

File: `frontend/src/lib/simulation/monteCarlo.test.ts`

```typescript
describe('representative paths', () => {
  it('returns 5 representative paths with correct percentiles', () => {
    const params = makeDefaultParams({ nSimulations: 500 })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    expect(result.representative_paths).toBeDefined()
    expect(result.representative_paths).toHaveLength(5)
    const percentiles = result.representative_paths!.map(p => p.percentile)
    expect(percentiles).toEqual([10, 25, 50, 75, 90])
  })

  it('each path has yearlyReturns matching total simulation years', () => {
    const params = makeDefaultParams({ nSimulations: 500 })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    const nYearsTotal = params.lifeExpectancy - params.currentAge // 55
    for (const path of result.representative_paths!) {
      expect(path.yearlyReturns).toHaveLength(nYearsTotal)
      expect(path.simIndex).toBeGreaterThanOrEqual(0)
      expect(path.simIndex).toBeLessThan(500)
    }
  })

  it('p50 path retirement balance approximately matches percentile band p50', () => {
    const params = makeDefaultParams({ nSimulations: 1000, seed: 42 })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    const retirementYearIndex = params.retirementAge - params.currentAge // 20
    const bandP50AtRetirement = result.percentile_bands.p50[retirementYearIndex]
    const p50Path = result.representative_paths!.find(p => p.percentile === 50)!
    // The representative sim should be close to the percentile value
    // Allow 10% tolerance since we pick the nearest sim, not interpolate
    expect(p50Path.retirementBalance).toBeCloseTo(bandP50AtRetirement, -4)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/simulation/monteCarlo.test.ts --reporter verbose 2>&1 | tail -20`
Expected: FAIL — `representative_paths` is undefined

**Step 3: Add types to `types.ts`**

Add after `MonteCarloResult` (around line 670):

```typescript
export interface RepresentativePath {
  percentile: number
  simIndex: number
  yearlyReturns: number[]
  retirementBalance: number
}
```

Add to `MonteCarloResult` interface:

```typescript
export interface MonteCarloResult {
  // ...existing fields...
  representative_paths?: RepresentativePath[]
}
```

**Step 4: Implement in `monteCarlo.ts`**

After the percentile bands computation (around line 543, after the `for (let y = 0; ...` loop), add representative path extraction:

```typescript
// ---- Extract representative paths ----
const TARGET_PERCENTILES = [10, 25, 50, 75, 90]
const representativePaths: RepresentativePath[] = []

for (const pct of TARGET_PERCENTILES) {
  // Get the percentile value of balances at retirement age
  const retYearIdx = nYearsAccum  // index into balances array
  const col: number[] = new Array(nSims)
  for (let s = 0; s < nSims; s++) {
    col[s] = balances[s][retYearIdx]
  }
  const targetVal = percentile(col, pct)

  // Find the sim whose retirement balance is closest
  let bestSim = 0
  let bestDist = Math.abs(col[0] - targetVal)
  for (let s = 1; s < nSims; s++) {
    const dist = Math.abs(col[s] - targetVal)
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
```

Add `representative_paths: representativePaths` to the return object at line ~662.

**Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/simulation/monteCarlo.test.ts --reporter verbose 2>&1 | tail -20`
Expected: PASS

**Step 6: Commit**

```
feat(simulation): extract representative paths from MC engine

After running 10K simulations, identify the 5 sims closest to
p10/p25/p50/p75/p90 at retirement age and return their yearly
portfolio return sequences. These enable post-hoc reconstruction
of full projection tables for each percentile scenario.
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
  yearlyReturns?: number[]  // MC-sourced portfolio returns per year, indexed by (age - currentAge)
}
```

**Step 4: Implement the override in the projection loop**

In `generateProjection()`, find the return rate computation block (around lines 351-356):

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
  // MC-sourced return for this specific year — expense ratio already factored
  // in by the MC engine, but we apply it here to match the deterministic path format
  returnRate = yearlyReturns[yearIndex] - expenseRatio
} else if (usePortfolioReturn && assetReturns.length === weights.length) {
  returnRate = calculatePortfolioReturn(weights, assetReturns) - expenseRatio
} else {
  returnRate = expectedReturn - expenseRatio
}
```

Also destructure `yearlyReturns` from params at the top of the function where other params are destructured (around line 222):

```typescript
const {
  // ...existing destructuring...
  withdrawalBasis,
  yearlyReturns,
} = params
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
engine uses those MC-sourced returns instead of the deterministic
expected return. All other calculations (income, CPF, tax, expenses)
remain identical, enabling full ProjectionRow reconstruction from
a representative MC simulation path.
```

---

## Task 3: Extract shared projection table columns

**Files:**
- Create: `frontend/src/components/shared/projectionColumns.tsx`
- Modify: `frontend/src/pages/ProjectionPage.tsx`

**Step 1: Extract column definitions**

Create `frontend/src/components/shared/projectionColumns.tsx` containing the shared column definitions, helper functions, and group constants currently in `ProjectionPage.tsx`:

```typescript
import {
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table'
import type { ProjectionRow } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/utils'

const columnHelper = createColumnHelper<ProjectionRow>()

export type ColumnGroup = 'expensesBreakdown' | 'incomeBreakdown' | 'taxCpf' | 'cpfBalances' | 'portfolio' | 'property'

export const COLUMN_GROUPS: { key: ColumnGroup; label: string }[] = [
  { key: 'expensesBreakdown', label: 'Expenses Breakdown' },
  { key: 'incomeBreakdown', label: 'Income Breakdown' },
  { key: 'taxCpf', label: 'Tax & CPF' },
  { key: 'cpfBalances', label: 'CPF Balances' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'property', label: 'Property & Events' },
]

export const GROUP_COLUMNS: Record<ColumnGroup, string[]> = {
  // Copy exact values from ProjectionPage.tsx lines 61-68
}

export const DEFAULT_COLUMN_IDS = ['age', 'totalIncome', 'annualExpenses', 'mortgageCashPayment', 'savingsOrWithdrawal', 'portfolioReturnDollar', 'liquidNW', 'cpfTotal', 'totalNW', 'fireProgress']

function currencyCell(value: number): string {
  return formatCurrency(value)
}

function optionalCurrencyCell(value: number): string {
  return value > 0 ? formatCurrency(value) : '-'
}

// Export the full column definition builder
// Takes retirementAge and hasMortgage as params since some columns conditionally hide
export function buildProjectionColumns(
  retirementAge: number,
  hasMortgage: boolean,
): ColumnDef<ProjectionRow, number | string>[] {
  // Copy the full column array from ProjectionPage.tsx useMemo (lines 312-530+)
  // Return the array directly
}
```

**Step 2: Update ProjectionPage.tsx to import from shared module**

Replace the local column definitions in `ProjectionPage.tsx` with imports:

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

## Task 4: Build the `MCProjectionTable` component

**Files:**
- Create: `frontend/src/components/simulation/MCProjectionTable.tsx`

**Step 1: Create the component**

```tsx
import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type VisibilityState,
} from '@tanstack/react-table'
import type { MonteCarloResult, ProjectionRow, RepresentativePath } from '@/lib/types'
import { generateProjection, type ProjectionParams } from '@/lib/calculations/projection'
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

  // Generate full projection using MC returns
  const rows = useMemo(() => {
    if (!selectedPath || !projectionParams) return null
    const { rows } = generateProjection({
      ...projectionParams,
      yearlyReturns: selectedPath.yearlyReturns,
    })
    return rows
  }, [selectedPath, projectionParams])

  // Column visibility (same logic as ProjectionPage)
  const columnVisibility = useMemo((): VisibilityState => {
    const vis: VisibilityState = {}
    // Start with all columns hidden
    for (const group of COLUMN_GROUPS) {
      for (const colId of GROUP_COLUMNS[group.key]) {
        vis[colId] = expandedGroups.has(group.key)
      }
    }
    // Default columns always visible
    for (const id of DEFAULT_COLUMN_IDS) {
      vis[id] = true
    }
    // Hide mortgage if no mortgage data
    if (rows && rows.every(r => r.mortgageCashPayment === 0)) {
      vis['mortgageCashPayment'] = false
    }
    return vis
  }, [expandedGroups, rows])

  // Build columns (reuse shared module)
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

New component renders a full year-by-year projection table for
a selected MC percentile scenario. Reuses shared column definitions
and the existing generateProjection() engine with yearlyReturns
override for instant reconstruction.
```

---

## Task 5: Wire MCProjectionTable into StressTestPage

**Files:**
- Modify: `frontend/src/pages/StressTestPage.tsx` (lines 600-622)

**Step 1: Add the new tab**

Import the component:

```typescript
import { MCProjectionTable } from '@/components/simulation/MCProjectionTable'
```

Find the MonteCarloTab reference to get the MC result data. Look at how `data` flows from `useMonteCarloQuery()` (line 75) to `MonteCarloTab`. The `data` is `MonteCarloResult | undefined`.

Update the Tabs section (around line 600):

```tsx
<Tabs defaultValue="monte-carlo" onValueChange={(tab) => trackEvent('stress_test_tab_changed', { tab })}>
  <TabsList className={`grid w-full ${isStressAdvanced ? (data ? 'grid-cols-4' : 'grid-cols-3') : (data ? 'grid-cols-2' : 'grid-cols-1')}`}>
    <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
    {data && <TabsTrigger value="mc-projection">Projection Table</TabsTrigger>}
    {isStressAdvanced && <TabsTrigger value="backtest">Historical Backtest</TabsTrigger>}
    {isStressAdvanced && <TabsTrigger value="sequence-risk">Sequence Risk</TabsTrigger>}
  </TabsList>

  <TabsContent value="monte-carlo">
    <MonteCarloTab isAdvanced={isStressAdvanced} />
  </TabsContent>

  {data && (
    <TabsContent value="mc-projection">
      <MCProjectionTable result={data} />
    </TabsContent>
  )}

  {isStressAdvanced && (
    <TabsContent value="backtest">
      <BacktestTab />
    </TabsContent>
  )}

  {isStressAdvanced && (
    <TabsContent value="sequence-risk">
      <SequenceRiskTab />
    </TabsContent>
  )}
</Tabs>
```

Note: The `data` variable comes from `useMonteCarloQuery()` on line 75. Verify it's in scope at the Tabs rendering location. If it's not directly accessible (e.g., it's inside `MonteCarloTab`), you may need to lift it up. Check the component structure carefully.

**Step 2: Verify types compile**

Run: `cd frontend && npm run type-check`

**Step 3: Manual verification**

Run: `cd frontend && npm run dev -- --port 5173`

1. Navigate to the Stress Test / Monte Carlo page
2. Run a MC simulation
3. Verify the "Projection Table" tab appears after simulation completes
4. Click the tab — should show a year-by-year table with median (p50) selected
5. Switch percentiles — table values should change (portfolio columns differ, income stays the same)
6. Toggle column groups — should expand/collapse like the Projection page

**Step 4: Commit**

```
feat(ui): wire MC projection table tab into StressTestPage

After running a Monte Carlo simulation, a new "Projection Table"
tab appears alongside existing results. Users can select a
percentile scenario to view the full year-by-year projection.
```

---

## Task 6: Pass `representative_paths` through the worker boundary

**Files:**
- Check: `frontend/src/lib/simulation/simulation.worker.ts`
- Check: `frontend/src/lib/simulation/workerClient.ts`

The worker serializes the return value of `runMonteCarlo()` via `postMessage`. Since `representative_paths` is a plain array of objects with number arrays, it should serialize automatically via the structured clone algorithm. However, verify this explicitly.

**Step 1: Check worker return path**

Read `simulation.worker.ts` and verify that the MC result object is passed through without field filtering. If the worker manually constructs the response (cherry-picking fields), you'll need to add `representative_paths`.

**Step 2: Check workerClient deserialization**

Read `workerClient.ts` and verify the result type matches. If it casts to `MonteCarloResult`, the new field should come through since it's optional.

**Step 3: If changes needed, implement them**

If the worker filters fields, add `representative_paths` to the pass-through.

**Step 4: Integration test**

Run the full app, trigger MC simulation, and verify `result.representative_paths` is populated in the browser console:

```javascript
// In browser devtools after MC completes:
// The MCProjectionTable component will log if paths are missing
```

**Step 5: Commit (if changes were needed)**

```
fix(worker): pass representative_paths through worker boundary
```

---

## Task 7: End-to-end verification and edge cases

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
    })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    expect(result.representative_paths).toHaveLength(5)
    // When already retired, retirement balance = initial portfolio for all
    for (const path of result.representative_paths!) {
      expect(path.yearlyReturns).toHaveLength(35) // 90 - 55
    }
  })

  it('paths have distinct sim indices for different percentiles', () => {
    const params = makeDefaultParams({ nSimulations: 1000, seed: 42 })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    const indices = result.representative_paths!.map(p => p.simIndex)
    // p10 and p90 should be different sims (very unlikely to be the same)
    expect(indices[0]).not.toBe(indices[4])
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

Cover already-retired scenario and distinct sim index verification.
```

---

## Summary: File Change Map

| File | Action | Task |
|------|--------|------|
| `frontend/src/lib/types.ts` | Add `RepresentativePath`, update `MonteCarloResult` | 1 |
| `frontend/src/lib/simulation/monteCarlo.ts` | Extract representative paths after simulation | 1 |
| `frontend/src/lib/simulation/monteCarlo.test.ts` | Add tests for representative paths | 1, 7 |
| `frontend/src/lib/calculations/projection.ts` | Add `yearlyReturns` to params + override logic | 2 |
| `frontend/src/lib/calculations/projection.test.ts` | Add tests for yearlyReturns override | 2 |
| `frontend/src/components/shared/projectionColumns.tsx` | Extract shared column definitions | 3 |
| `frontend/src/pages/ProjectionPage.tsx` | Import from shared columns module | 3 |
| `frontend/src/components/simulation/MCProjectionTable.tsx` | New component | 4 |
| `frontend/src/pages/StressTestPage.tsx` | Add projection table tab | 5 |
| `frontend/src/lib/simulation/simulation.worker.ts` | Verify pass-through (may need change) | 6 |
| `frontend/src/lib/simulation/workerClient.ts` | Verify type compatibility | 6 |

## Dependency Graph

```
Task 1 (MC engine) ──┐
                      ├──► Task 4 (MCProjectionTable) ──► Task 5 (wire into page) ──► Task 7 (e2e)
Task 2 (projection)──┘                                          ▲
                                                                 │
Task 3 (extract columns)────────────────────────────────────────┘
Task 6 (worker check) ─────────────────────────────────────────┘
```

**Parallelizable:** Tasks 1, 2, and 3 are independent and can run in parallel. Task 6 can run in parallel with Task 4.
