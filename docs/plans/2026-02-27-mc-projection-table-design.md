# MC Projection Table Design

**Date:** 2026-02-27
**Status:** Proposed

## Problem

The Projection page shows a deterministic year-by-year table using a single expected return. This gives users false precision: one path, one outcome. The Monte Carlo simulation page already computes 10K paths with varying market returns, but only displays aggregate statistics (success rate, percentile bands, terminal distribution). Users have no way to see a detailed year-by-year projection under different market scenarios.

## Solution

Add a **Projection Table** tab to the Monte Carlo page that appears after simulation completes. The table has the same format as the existing Projection page (all 53 `ProjectionRow` fields), but is driven by a representative MC simulation path. A percentile selector lets users switch between scenarios: Pessimistic (p10), Cautious (p25), Median (p50), Optimistic (p75), Best Case (p90).

## Architecture: Post-Hoc Reconstruction

The MC engine varies only market returns. Income, expenses, CPF, tax, healthcare are all deterministic. Rather than tracking all 53 fields across 10K simulations, we:

1. **During MC:** identify 5 representative simulations (those closest to p10/p25/p50/p75/p90 portfolio balance at retirement age)
2. **Extract:** their year-by-year portfolio return sequences (~40 numbers each, ~200 total)
3. **Return:** these as a new `representativePaths` field on `MonteCarloResult`
4. **On UI selection:** re-run `generateProjection()` with the selected return sequence instead of the deterministic expected return

This produces a complete, internally-consistent `ProjectionRow[]` for each percentile, with zero approximation.

### Why retirement-age balance for percentile matching?

The retirement-age portfolio balance is the single most decision-relevant number: it determines how much you have to fund your entire retirement. Matching at this point ensures the "median scenario" shows the median retirement starting point, which is what users care about most.

## Changes Required

### 1. MC Engine (`lib/simulation/monteCarlo.ts`)

**New return type field:**

```typescript
// Add to MonteCarloEngineResult (and MonteCarloResult in types.ts)
representativePaths: {
  percentile: number       // 10, 25, 50, 75, 90
  simIndex: number         // which of the 10K sims this was
  yearlyReturns: number[]  // portfolio return per year (accumulation + decumulation)
}[]
```

**Logic (after simulation loop, before computing stats):**

```
For each target percentile [10, 25, 50, 75, 90]:
  1. Compute the percentile value of balances[*][retirementAge - currentAge]
  2. Find the sim index whose balance at that year is closest
  3. Extract portfolioReturns[simIndex][0..totalYears-1]
  4. Push to representativePaths array
```

Memory overhead: 5 paths x ~40 years = ~200 floats. Negligible.

### 2. Projection Engine (`lib/calculations/projection.ts`)

**Add optional field to `ProjectionParams`:**

```typescript
yearlyReturns?: number[]  // MC-sourced returns, indexed by (age - currentAge)
```

**Modify return rate computation (line ~351):**

```typescript
// Current:
if (usePortfolioReturn && assetReturns.length === weights.length) {
  returnRate = calculatePortfolioReturn(weights, assetReturns) - expenseRatio
} else {
  returnRate = expectedReturn - expenseRatio
}

// New:
if (yearlyReturns && yearlyReturns[yearIndex] !== undefined) {
  returnRate = yearlyReturns[yearIndex] - expenseRatio
} else if (usePortfolioReturn && assetReturns.length === weights.length) {
  returnRate = calculatePortfolioReturn(weights, assetReturns) - expenseRatio
} else {
  returnRate = expectedReturn - expenseRatio
}
```

When `yearlyReturns` is provided, it takes priority. This is the MC return for that year. The expense ratio deduction still applies (same as the MC engine does).

### 3. Worker Communication

**`simulation.worker.ts`:** No change needed. The `representativePaths` are already part of the return payload.

**`workerClient.ts`:** No change needed. The paths flow through the existing message channel.

### 4. Types (`lib/types.ts`)

Add `representativePaths` to `MonteCarloResult`:

```typescript
export interface RepresentativePath {
  percentile: number
  simIndex: number
  yearlyReturns: number[]
}

export interface MonteCarloResult {
  // ...existing fields...
  representative_paths: RepresentativePath[]
}
```

### 5. UI: MC Projection Table Tab

**New component: `components/simulation/MCProjectionTable.tsx`**

- Receives `MonteCarloResult` and `ProjectionParams` (from the existing `useProjection` hook or constructed from stores)
- Percentile selector dropdown (5 options)
- On selection change, calls `generateProjection({ ...projectionParams, yearlyReturns: selectedPath.yearlyReturns })`
- Renders the resulting `ProjectionRow[]` using the same table column definitions as `ProjectionPage`
- Computation is instant (<10ms, single deterministic pass on main thread)

**Placement:** New tab on `StressTestPage.tsx`:

```tsx
<TabsTrigger value="projection">Projection Table</TabsTrigger>
<TabsContent value="projection">
  <MCProjectionTable result={mcResult} />
</TabsContent>
```

The tab is only visible after MC simulation completes (when `mcResult` is available).

### 6. Shared Table Columns

Extract the column definitions from `ProjectionPage.tsx` into a shared module (e.g., `components/shared/projectionColumns.ts`) so both the Projection page and the MC Projection Table use identical columns. This avoids duplication and ensures consistency.

## Data Flow Summary

```
User clicks "Run" on MC page
  → Worker runs 10K simulations
  → Engine identifies 5 representative sims (p10/p25/p50/p75/p90 at retirement age)
  → Extracts their return sequences
  → Returns MonteCarloResult with representative_paths field
  → UI shows "Projection Table" tab

User selects percentile (e.g., "Median p50")
  → Component calls generateProjection() with that path's yearlyReturns
  → Gets back ProjectionRow[] with all 53 fields
  → Renders in table (same format as Projection page)
```

## What Could Break

1. **Percentile mismatch:** The representative sim's retirement-age balance might not perfectly match the percentile. This is cosmetic: we're showing a real simulation path, not an interpolated one. The label "Median (p50)" is approximate by nature.
2. **Return sequence length:** Must match `lifeExpectancy - currentAge`. The MC engine already generates returns for this exact span.
3. **Column extraction:** Moving columns out of `ProjectionPage.tsx` could break imports. Low risk with TypeScript catching missing references.

## Out of Scope

- Fan chart visualization (future enhancement)
- Individual sim path rendering
- Property hybrid MC overlay
- Replacing the deterministic Projection page

## Testing

- **Unit test:** `monteCarlo.test.ts` - verify `representativePaths` are returned with correct percentiles and array lengths
- **Unit test:** `projection.test.ts` - verify `yearlyReturns` override produces different results from deterministic path
- **Integration test:** Run MC, extract p50 path, feed to projection engine, verify the retirement-age portfolio balance approximately matches the MC p50 band value
