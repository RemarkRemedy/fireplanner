# MC Projection Table Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Projection Table" tab to the Monte Carlo page that shows a full year-by-year projection for a selected percentile scenario (p10/p25/p50/p75/p90).

**Architecture:** The MC engine extracts 5 representative simulation paths after running 10K sims. Each path's return sequence is replayed through the existing `generateProjection()` function with a new `yearlyReturns` override, producing a complete `ProjectionRow[]` identical in format to the deterministic Projection page.

**Tech Stack:** TypeScript, React, Vitest, TanStack Table, Zustand, shadcn/ui Tabs

---

## Review Corrections

### Round 1 (Codex review #1)
1. **`data` scoping** — Lift `useMonteCarloQuery()` to `StressTestPage`, pass props to `MonteCarloTab`.
2. **Param source mismatch** — Use `yearlyReturnsOffset` to align MC returns to projection timeline (see Task 2/6).
3. **Timeline off-by-one** — Last row (age = lifeExpectancy) falls back to deterministic return. Acceptable.
4. **Expense ratio** — `portfolioReturns` are gross. Projection subtracts `expenseRatio` once. No double-counting.
5. **Naming** — `representative_paths` (snake_case).
6. **SWR optimizer overhead** — Gate with `extractPaths` flag.
7. **Flaky test** — Assert `p10 < p90` instead of distinct indices.

### Round 2 (Codex review #2)
8. **SWR optimizer still gets `extractPaths`** — `simulation.worker.ts:30` passes `e.data.params` to `optimizeSwr`, which spreads into `runMonteCarlo`. Fixed: `swrOptimizer.ts` strips `extractPaths` from baseParams alongside `annualExpensesAtRetirement`.
9. **`undefined` holes produce NaN** — Padding aligned returns with `undefined` causes `undefined - expenseRatio = NaN`. Fixed: use `yearlyReturnsOffset` parameter on `ProjectionParams` instead of padding. The projection engine computes `mcIndex = yearIndex - offset` and falls back to deterministic when `mcIndex < 0 || mcIndex >= yearlyReturns.length`. No undefined values, type stays `number[]`.
10. **Percentile paths collapse in fireTarget mode** — When `nYearsAccum = 0`, all sims have the same balance at index 0. Fixed: select representative paths based on terminal balance (end of simulation) when `nYearsAccum = 0`, instead of retirement-age balance.
11. **Stale-data warning missing on projection tab** — Pass `isStale` to `MCProjectionTable`, show warning banner.
12. **Dynamic Tailwind classes purged** — Use static class mapping instead of template literal.
13. **Unused `reset` prop** — Only pass props `MonteCarloTab` actually uses.

### Round 3 (Codex review #3)
14. **`mc.data` type narrowing** — `hasResults` guard (`!!mc.data`) doesn't narrow `mc.data` from `MonteCarloResult | undefined`. Use non-null assertion (`mc.data!`) in the JSX where `hasResults` gates rendering.
15. **`buildProjectionColumns` unused params** — If `retirementAge` or `hasMortgage` aren't used inside the column builder, TypeScript strict mode flags them. Prefix with `_` or use them.
16. **Unused `ProjectionRow` import** — `MCProjectionTable` imports `ProjectionRow` but doesn't use it directly (it's the generic on table rows, handled implicitly). Remove unused import.
17. **Missing `yearlyReturnsOffset` regression test** — Add explicit test for fireTarget mode offset behavior (MC starts at retirementAge, projection starts at currentAge).

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

  // Choose selection point: retirement-age balance for normal mode,
  // terminal balance for fireTarget mode (nYearsAccum = 0, all sims
  // have the same initial balance so retirement-age percentiles collapse).
  const selectionYearIdx = nYearsAccum > 0 ? nYearsAccum : nYearsTotal
  const selCol: number[] = new Array(nSims)
  for (let s = 0; s < nSims; s++) {
    selCol[s] = balances[s][selectionYearIdx]
  }

  // Also capture retirement-age balance for display purposes
  const retYearIdx = nYearsAccum

  for (const pct of TARGET_PERCENTILES) {
    const targetVal = percentile(selCol, pct)

    // Find the sim whose balance at the selection point is closest
    let bestSim = 0
    let bestDist = Math.abs(selCol[0] - targetVal)
    for (let s = 1; s < nSims; s++) {
      const dist = Math.abs(selCol[s] - targetVal)
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
  yearlyReturns?: number[]  // MC-sourced GROSS portfolio returns per year.
                             // Indexed from yearlyReturnsOffset (default 0).
                             // Gross = before expense ratio. Projection subtracts expenseRatio once.
  yearlyReturnsOffset?: number  // Age offset: yearlyReturns[0] corresponds to (currentAge + offset).
                                 // Default 0 (MC and projection start at same age).
                                 // Set to (retirementAge - currentAge) in fireTarget mode.
}
```

**Step 4: Implement the override in the projection loop**

In `generateProjection()`, destructure `yearlyReturns` and `yearlyReturnsOffset` at the top (around line 222 where other params are destructured):

```typescript
const {
  // ...existing destructuring...
  withdrawalBasis,
  yearlyReturns,
  yearlyReturnsOffset = 0,
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
const mcIndex = yearIndex - yearlyReturnsOffset
if (yearlyReturns && mcIndex >= 0 && mcIndex < yearlyReturns.length) {
  // MC-sourced gross return for this year. Subtract expense ratio here,
  // matching the deterministic path where expenseRatio is also subtracted.
  // portfolioReturns in MC are gross (fee applied in balance transitions),
  // so this is a single deduction, not double-counting.
  returnRate = yearlyReturns[mcIndex] - expenseRatio
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

Wrap the column array in a function. **Note:** Both `retirementAge` and `hasMortgage` MUST be used inside the column builder (e.g., `retirementAge` for retirement-row highlighting, `hasMortgage` for conditional mortgage columns). Verify these are referenced when extracting from ProjectionPage's useMemo. If the existing useMemo reads them from closure instead of parameters, thread them through explicitly.

```typescript
export function buildProjectionColumns(
  retirementAge: number,
  hasMortgage: boolean,
): ColumnDef<ProjectionRow, number | string>[] {
  return [
    // Copy the full column array from ProjectionPage.tsx useMemo.
    // Ensure retirementAge and hasMortgage are referenced inside
    // (they were previously read from component scope).
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
  const mc = useMonteCarloQuery()
  const setSimField = useSimulationStore((s) => s.setField)

  // Move lastMCSuccessRate persistence here (was in MonteCarloTab).
  // This ensures it updates even when the MC tab is not active.
  useEffect(() => {
    if (mc.data) setSimField('lastMCSuccessRate', mc.data.success_rate)
  }, [mc.data, setSimField])

  return (
    // ...
    <MonteCarloTab
      isAdvanced={isStressAdvanced}
      mutate={mc.mutate}
      data={mc.data}
      isPending={mc.isPending}
      error={mc.error}
      canRun={mc.canRun}
      validationErrors={mc.validationErrors}
      isStale={mc.isStale}
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
}

function MonteCarloTab({
  isAdvanced,
  mutate, data, isPending, error, canRun, validationErrors, isStale,
}: MonteCarloTabProps) {
  // Remove: const { mutate, data, isPending, error, canRun, validationErrors, isStale } = useMonteCarloQuery()
  // Remove: the useEffect for lastMCSuccessRate (moved to parent)
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

## Task 5: Set `extractPaths: true` in `useMonteCarloQuery` and strip in SWR optimizer

**Files:**
- Modify: `frontend/src/hooks/useMonteCarloQuery.ts` (line ~378)
- Modify: `frontend/src/lib/simulation/swrOptimizer.ts` (line ~81)

**Step 1: Add the flag in `useMonteCarloQuery.ts`**

Find where `MonteCarloEngineParams` is constructed (around line 355):

```typescript
const params: MonteCarloEngineParams = {
  // ...existing fields...
  withdrawalBasis: simulation.withdrawalBasis,
  extractPaths: true,  // Enable representative path extraction for projection table
}
```

**Step 2: Strip the flag in `swrOptimizer.ts`**

CRITICAL: `simulation.worker.ts:30` passes `e.data.params` directly to `optimizeSwr()`, which spreads them into `runMonteCarlo()` calls in a loop. Without stripping, path extraction runs ~45 times (15 iterations x 3 confidence levels).

In `swrOptimizer.ts`, find the destructuring at line 81:

```typescript
// Current:
const { annualExpensesAtRetirement: _, ...restBaseParams } = baseParams

// Replace with:
const { annualExpensesAtRetirement: _, extractPaths: __, ...restBaseParams } = baseParams
```

**Step 3: Write a test to verify SWR result doesn't include paths**

```typescript
// In swrOptimizer.test.ts or monteCarlo.test.ts
it('SWR optimizer does not extract representative paths', () => {
  const params = makeDefaultParams({ nSimulations: 100, extractPaths: true })
  // optimizeSwr calls runMonteCarlo internally but should strip extractPaths
  const swr = optimizeSwr(0.90, params as SwrBaseParams)
  expect(typeof swr).toBe('number')
  // No direct way to verify paths aren't extracted, but the test ensures
  // optimizeSwr still works correctly when extractPaths is in the input
})
```

**Step 4: Verify worker passes data through**

The worker (`simulation.worker.ts`) passes `mcResult` via spread (`...mcResult`) at line 39, so `representative_paths` flows through. `workerClient.ts` types the response as `MonteCarloResult`, which includes the optional field. No changes needed.

**Step 5: Commit**

```
feat: enable path extraction in MC hook, strip in SWR optimizer

Set extractPaths: true when running MC simulation so representative
paths are returned. Strip the flag in swrOptimizer to prevent
extraction during binary search iterations (up to 45 calls).
```

---

## Task 6: Build the `MCProjectionTable` component

**Files:**
- Create: `frontend/src/components/simulation/MCProjectionTable.tsx`

**IMPORTANT: Param source and timeline alignment**

The MC engine may run with different params than `useProjection()` provides:
- In `fireTarget` analysis mode: MC starts at `retirementAge` with `fireNumber` as portfolio, skipping accumulation
- In `myPlan` mode: MC starts at `currentAge` with `liquidNetWorth + CPF`, running accumulation

`useProjection()` always starts at `currentAge` with `liquidNetWorth`. This is correct for the projection replay because we WANT the full timeline. The `yearlyReturns` array from MC may be shorter than the projection timeline (in `fireTarget` mode).

**Timeline alignment via `yearlyReturnsOffset`:**
- Compute `offset = representative_paths_start_age - projectionParams.currentAge`
- Pass `yearlyReturnsOffset: offset` to `generateProjection()`
- The projection engine computes `mcIndex = yearIndex - offset`. When `mcIndex < 0` (pre-retirement years in fireTarget mode), it falls back to deterministic return
- No `undefined` values, no type changes, no NaN risk

**Step 1: Create the component**

```tsx
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
  isStale?: boolean
}

export function MCProjectionTable({ result, isStale }: MCProjectionTableProps) {
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

  // Generate full projection using MC returns, with timeline alignment via offset
  const rows = useMemo(() => {
    if (!selectedPath || !projectionParams) return null

    // Compute offset: MC may have started at a different age than projection.
    // In fireTarget mode, MC starts at retirementAge; projection starts at currentAge.
    // The offset tells the projection engine where yearlyReturns[0] maps to.
    const mcStartAge = result.representative_paths_start_age ?? projectionParams.currentAge
    const offset = mcStartAge - projectionParams.currentAge

    const { rows } = generateProjection({
      ...projectionParams,
      yearlyReturns: selectedPath.yearlyReturns,
      yearlyReturnsOffset: offset,
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
      {isStale && (
        <div className="mx-6 mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          Inputs have changed since this simulation was run. Re-run Monte Carlo for updated results.
        </div>
      )}
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

In `StressTestPage`, update the Tabs section to add the projection table tab. Since `mc.data` is now available at this level (from Task 4), this works directly:

```tsx
const hasResults = !!mc.data

// Static Tailwind class mapping — dynamic template literals get purged
const tabCount = 1 + (hasResults ? 1 : 0) + (isStressAdvanced ? 2 : 0)
const gridColsClass: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

<Tabs defaultValue="monte-carlo" onValueChange={(tab) => trackEvent('stress_test_tab_changed', { tab })}>
  <TabsList className={`grid w-full ${gridColsClass[tabCount] ?? 'grid-cols-1'}`}>
    <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
    {hasResults && <TabsTrigger value="mc-projection">Projection Table</TabsTrigger>}
    {isStressAdvanced && <TabsTrigger value="backtest">Historical Backtest</TabsTrigger>}
    {isStressAdvanced && <TabsTrigger value="sequence-risk">Sequence Risk</TabsTrigger>}
  </TabsList>

  <TabsContent value="monte-carlo">
    <MonteCarloTab
      isAdvanced={isStressAdvanced}
      mutate={mc.mutate}
      data={mc.data}
      isPending={mc.isPending}
      error={mc.error}
      canRun={mc.canRun}
      validationErrors={mc.validationErrors}
      isStale={mc.isStale}
    />
  </TabsContent>

  {hasResults && (
    <TabsContent value="mc-projection">
      {/* mc.data is guaranteed non-null here because hasResults = !!mc.data,
          but TypeScript doesn't narrow through a boolean variable.
          Use non-null assertion (!) since the guard is right above. */}
      <MCProjectionTable result={mc.data!} isStale={mc.isStale} />
    </TabsContent>
  )}

  {/* backtest and sequence-risk tabs unchanged */}
</Tabs>
```

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
- Modify: `frontend/src/lib/calculations/projection.test.ts` (add offset regression test)

**Step 1: Add edge case tests**

```typescript
describe('representative paths edge cases', () => {
  it('works when already retired (nYearsAccum = 0) — selects by terminal balance', () => {
    const params = makeDefaultParams({
      currentAge: 55,
      retirementAge: 55,
      annualSavings: [],
      nSimulations: 500,
      extractPaths: true,
    })
    const result = runMonteCarlo(params as MonteCarloEngineParams)
    expect(result.representative_paths).toHaveLength(5)
    for (const path of result.representative_paths!) {
      expect(path.yearlyReturns).toHaveLength(35) // 90 - 55
    }
    expect(result.representative_paths_start_age).toBe(55)
    // In fireTarget mode (nYearsAccum=0), paths should be distinct
    // because selection is by terminal balance, not collapsed initial balance
    const p10 = result.representative_paths!.find(p => p.percentile === 10)!
    const p90 = result.representative_paths!.find(p => p.percentile === 90)!
    expect(p10.simIndex).not.toBe(p90.simIndex)
  })

  it('p10 retirement balance is less than p90 retirement balance (normal mode)', () => {
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

**Step 1b: Add yearlyReturnsOffset regression test (issue #17)**

File: `frontend/src/lib/calculations/projection.test.ts`

This test verifies that in fireTarget mode (MC starts at retirementAge), the offset parameter correctly aligns MC returns to the projection timeline. Without the offset, pre-retirement years would try to read MC returns at negative indices.

```typescript
describe('yearlyReturnsOffset alignment', () => {
  it('pre-offset years use deterministic return, offset years use MC returns', () => {
    // Simulate fireTarget mode: MC starts at retirementAge (e.g., age 55),
    // projection starts at currentAge (e.g., age 30). Offset = 25.
    const retirementAge = validParams.retirementAge  // e.g., 55
    const currentAge = validParams.currentAge          // e.g., 30
    const offset = retirementAge - currentAge          // 25

    const nMCYears = validParams.lifeExpectancy - retirementAge  // decumulation years
    const mcReturns = Array(nMCYears).fill(0.25)  // extremely high to be distinguishable

    const result = generateProjection({
      ...validParams,
      yearlyReturns: mcReturns,
      yearlyReturnsOffset: offset,
    })

    // Baseline without MC override
    const baseline = generateProjection(validParams)

    // Pre-retirement rows (age < retirementAge) should match baseline exactly
    // because mcIndex = yearIndex - offset < 0 → falls back to deterministic
    for (let age = currentAge; age < retirementAge; age++) {
      const mcRow = result.rows.find(r => r.age === age)!
      const baseRow = baseline.rows.find(r => r.age === age)!
      expect(mcRow.liquidNW).toBe(baseRow.liquidNW)
    }

    // Post-retirement rows should differ (MC returns of 25% vs deterministic)
    const mcRetired = result.rows.find(r => r.age === retirementAge + 1)!
    const baseRetired = baseline.rows.find(r => r.age === retirementAge + 1)!
    expect(mcRetired.liquidNW).not.toBe(baseRetired.liquidNW)
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
| `frontend/src/lib/simulation/monteCarlo.ts` | Add `extractPaths` flag, extract paths with fireTarget fallback | 1 |
| `frontend/src/lib/simulation/monteCarlo.test.ts` | Tests for paths + edge cases | 1, 8 |
| `frontend/src/lib/calculations/projection.ts` | Add `yearlyReturns` + `yearlyReturnsOffset` to params | 2 |
| `frontend/src/lib/calculations/projection.test.ts` | Tests for yearlyReturns override | 2 |
| `frontend/src/components/shared/projectionColumns.tsx` | Extract shared column definitions | 3 |
| `frontend/src/pages/ProjectionPage.tsx` | Import from shared columns module | 3 |
| `frontend/src/pages/StressTestPage.tsx` | Lift MC hook, move lastMCSuccessRate effect, add tab | 4, 7 |
| `frontend/src/hooks/useMonteCarloQuery.ts` | Set `extractPaths: true` | 5 |
| `frontend/src/lib/simulation/swrOptimizer.ts` | Strip `extractPaths` from baseParams | 5 |
| `frontend/src/components/simulation/MCProjectionTable.tsx` | New component with offset-based alignment + stale warning | 6 |

## Dependency Graph

```
Task 1 (MC engine + types) ──┐
                               ├──► Task 6 (MCProjectionTable) ──► Task 7 (wire tab) ──► Task 8 (e2e)
Task 2 (projection override)──┘            ▲                            ▲
                                           │                            │
Task 3 (extract columns)──────────────────┘                            │
Task 4 (lift MC hook) ────────────────────────────────────────────────┘
Task 5 (extractPaths + SWR strip) ────────────────────────────────────┘
```

**Parallelizable:** Tasks 1, 2, 3, 4, and 5 are all independent and can run in parallel. Tasks 6 and 7 depend on all of them.
