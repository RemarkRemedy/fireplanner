# Amortized Income Follow-ups: 4 Remaining Limitations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the 4 known limitations left after the Option B amortization shipped: multi-adult joint mode, post-retirement income distortion, inverted dependency cleanup, and nominal approximation documentation.

**Architecture:** Each limitation is an independent task with no cross-dependencies. They can be executed in any order or in parallel.

**Tech Stack:** TypeScript, Vitest

---

## Scope

4 independent tasks, ordered by impact:

| Task | Limitation | Effort | Impact |
|------|-----------|--------|--------|
| T1 | Multi-adult joint mode gets legacy behavior | Medium | High |
| T2 | Post-retirement income distortion | Low | Medium |
| T3 | Inverted dependency cleanup | Low | Low |
| T4 | Document nominal approximation as known limitation | Trivial | Low |

No cross-dependencies. Each task produces a standalone commit.

---

### Task 1: Multi-adult joint base projection

**Problem:** `useProjection.ts` computes `baseIncomeProjection` from single-adult `buildProjectionParams`, which is wrong for multi-adult joint mode. The merged income projection comes from `mergePerAdultProjections(compiledPlan.incomeByAdultId)`, but there's no corresponding merged base projection.

**Solution:** Have `compileHouseholdPlan` also compute per-adult base projections (with life events disabled), store them alongside `incomeByAdultId` as `baseIncomeByAdultId`, then merge them in `useIncomeProjection` the same way the primary projections are merged.

**Files:**
- Modify: `lib/household/compileHouseholdPlan.ts` (add `baseIncomeByAdultId` to `CompiledHouseholdPlan`)
- Modify: `hooks/useIncomeProjection.ts` (merge base projections in multi-adult path, expose in return type)
- Modify: `hooks/useProjection.ts` (use merged base projection instead of single-adult approximation)
- Create: `lib/calculations/effectiveIncome.test.ts` (add integration test for multi-adult path, or add to existing test)

- [ ] **Step 1: Read `compileHouseholdPlan.ts` lines 187-197 and 920-937**

Understand the `CompiledHouseholdPlan` interface and where `adultProjectionsById` is built. The per-adult projections are generated at line 927 via `buildAdultIncomeProjection`, which calls `generateIncomeProjection` with `lifeEventsEnabled: adult.lifeEventsEnabled` (line 480).

- [ ] **Step 2: Add `baseIncomeByAdultId` to `CompiledHouseholdPlan` interface**

In `compileHouseholdPlan.ts`, find the `CompiledHouseholdPlan` interface (around line 187-200). Add:
```typescript
baseIncomeByAdultId: Record<string, IncomeProjectionRow[]>
```

- [ ] **Step 3: Compute per-adult base projections**

After `adultProjectionsById` is built (line 937), add a parallel computation:
```typescript
const baseProjectionsByAdultId = Object.fromEntries(
  normalized.adultOrder.map((adultId) => {
    const adult = normalized.adultsById[adultId]
    if (!adult.lifeEventsEnabled || adult.lifeEvents.length === 0) {
      return [adultId, adultProjectionsById[adultId]]
    }
    // Pass fresh warning arrays — base projection is internal, its warnings should not surface to users
    return [
      adultId,
      buildAdultIncomeProjection(
        { ...adult, lifeEventsEnabled: false },
        normalized,
        resolvedTiming,
        [],
        new Set<string>(),
        primaryProperty,
      ),
    ]
  })
) as Record<string, IncomeProjectionRow[]>
```

Note: `buildAdultIncomeProjection` reads `adult.lifeEventsEnabled` and `adult.lifeEvents` (lines 479-480). Spreading `{ ...adult, lifeEventsEnabled: false }` disables life events for the base projection. When no life events are active, reuse the primary projection to avoid wasted computation. Fresh `[]` and `new Set()` are passed for warnings/seenWarnings because the base projection is an internal computation artifact — its warnings should not surface to users.

Pass `baseIncomeByAdultId: baseProjectionsByAdultId` in the return object (around line 1393).

- [ ] **Step 4: Expose base projection from `useIncomeProjection`**

Read `hooks/useIncomeProjection.ts`. The multi-adult path (lines 254-266) calls `mergePerAdultProjections(compiledPlan.incomeByAdultId)`. After this, add a parallel merge for base projections:

```typescript
const baseProjection = compiledPlan.baseIncomeByAdultId
  ? mergePerAdultProjections({
      perAdultProjections: compiledPlan.baseIncomeByAdultId,
      adultOrder: compiledPlan.adultOrder,
      referenceCurrentAge: normalized.currentAge,
      referenceRetirementYearOffset: normalized.householdRetirementYearOffset,
      annualExpenses: profile.annualExpenses,
      inflation: profile.inflation,
      lockedAssets: profile.lockedAssets,
      expenseAdjustments: profile.expenseAdjustments,
    })
  : null
```

Update the `IncomeProjectionResult` interface to include `baseIncomeProjection: IncomeProjectionRow[] | null`. Use this field name (not `baseProjection`) to match the downstream `FullProjectionContext.baseIncomeProjection` field and avoid naming confusion.

For the single-adult path (lines 267-283), compute the base projection **inside the existing `useMemo` block** right after `projectionParams` is computed (around line 278). `projectionParams` is scoped to that `useMemo` closure and is not accessible outside it. Add:
```typescript
const baseIncomeProjection = projectionParams ? computeBaseProjection(projectionParams) ?? null : null
```
Import `computeBaseProjection` from `@/lib/calculations/effectiveIncome`.

Return `baseProjection` alongside `projection` in both paths.

- [ ] **Step 5: Update `useProjection.ts` to use the hook's base projection**

Read `hooks/useProjection.ts`. Currently it computes its own `baseIncomeProjection` via `buildProjectionParams` (lines 46-52). Replace this with the base projection from `useIncomeProjection`:

```typescript
const { projection: incomeProjection, baseIncomeProjection, hasErrors, errors } = useIncomeProjection()
```

Remove the manual `buildProjectionParams` + `computeBaseProjection` calls (lines 46-52). Pass `baseIncomeProjection ?? undefined` in the `buildFullProjectionParams` call.

Remove the now-unused imports of `buildProjectionParams` and `computeBaseProjection` from `useProjection.ts`.

- [ ] **Step 6: Run type-check and tests**

Run: `cd frontend && npm run type-check && npm run test -- --run 2>&1 | tail -20`

- [ ] **Step 7: Commit**

```bash
git add src/lib/household/compileHouseholdPlan.ts src/hooks/useIncomeProjection.ts src/hooks/useProjection.ts
git commit -m "fix: compute merged base projection for multi-adult joint amortization"
```

---

### Task 2: Amortize post-retirement income distortion

**Problem:** `buildFullProjectionParams` in `projectionParams.ts` (lines 200-215) extracts `postRetirementIncome` from the first retired row of the with-events projection. If life events reduce post-retirement income (e.g., reduced rental income after a life event), this value is distorted the same way pre-retirement income was before Option B.

**Solution:** When `baseIncomeProjection` is available, also extract post-retirement income from the base projection and amortize the difference, matching the same pattern used for working-year income.

**Files:**
- Modify: `lib/calculations/effectiveIncome.ts` (add `resolveEffectivePostRetirementIncome`)
- Modify: `lib/calculations/effectiveIncome.test.ts` (add tests)
- Modify: `lib/calculations/projectionParams.ts` (use new function)
- Modify: `hooks/useWhatIfMetrics.ts` (use new function in `getBaseInputs`)

- [ ] **Step 1: Add `resolveEffectivePostRetirementIncome` to `effectiveIncome.ts`**

Read `projectionParams.ts` lines 200-215 to understand the current inline extraction logic. Create a pure function that encapsulates it:

```typescript
/**
 * Resolve post-retirement passive income, optionally amortizing life event impact.
 * Extracts passive income (government, rental, investment, business, SRS withdrawal)
 * from the first retired row and deflates to today's dollars.
 *
 * When baseProjection is provided, averages the post-retirement income from both
 * projections to smooth life event distortions.
 */
export function resolveEffectivePostRetirementIncome(
  projection: IncomeProjectionRow[],
  baseProjection: IncomeProjectionRow[] | null | undefined,
  currentAge: number,
  inflation: number,
): number | undefined {
  const extractPassive = (rows: IncomeProjectionRow[]): number | undefined => {
    const firstRetired = rows.find((r) => r.isRetired)
    if (!firstRetired) return undefined
    const passiveNominal = firstRetired.governmentIncome
      + firstRetired.rentalIncome
      + firstRetired.investmentIncome
      + firstRetired.businessIncome
      + firstRetired.srsWithdrawal
    const yearsToRetired = firstRetired.age - currentAge
    return yearsToRetired > 0 && inflation > 0
      ? passiveNominal / Math.pow(1 + inflation, yearsToRetired)
      : passiveNominal
  }

  const withEvents = extractPassive(projection)
  if (withEvents === undefined) return undefined

  if (!baseProjection || baseProjection.length === 0) return withEvents

  const withoutEvents = extractPassive(baseProjection)
  if (withoutEvents === undefined) return withEvents

  // Use the baseline (without events) as the reference, matching the
  // amortization pattern in resolveEffectiveIncome: the base value is
  // the undisrupted reality, and events can only reduce it.
  // For post-retirement income, life events may reduce passive income
  // (e.g., rental loss), so we take the higher of the two values.
  // Unlike working-year amortization, post-retirement has no "spread
  // across years" since it's a single steady-state value.
  return Math.max(withEvents, withoutEvents)
}
```

- [ ] **Step 2: Write tests**

Test cases:
1. Returns `undefined` when no retired rows exist
2. Returns deflated passive income when no base projection
3. Returns the higher of with/without events when base projection provided (undisrupted baseline)
4. Handles zero inflation (no deflation)
5. Returns with-events value when it equals without-events (no distortion)

- [ ] **Step 3: Update `projectionParams.ts` (lines 200-215)**

Import `resolveEffectivePostRetirementIncome` from `@/lib/calculations/effectiveIncome`.

Replace the inline extraction block with:
```typescript
const postRetirementIncome = resolveEffectivePostRetirementIncome(
  incomeProjection,
  ctx.baseIncomeProjection,
  ages.currentAge,
  profile.inflation,
)
```

- [ ] **Step 4: Update `getBaseInputs` in `useWhatIfMetrics.ts` (lines 140-155)**

Apply the same replacement pattern. The inline block at lines 140-155 extracts `postRetirementIncome`. Replace with:
```typescript
const postRetirementIncome = resolveEffectivePostRetirementIncome(
  projection ?? [],
  baseProjection,
  currentAge,
  profile.inflation,
)
```

- [ ] **Step 5: Run type-check and tests**

Run: `cd frontend && npm run type-check && npx vitest run src/lib/calculations/effectiveIncome.test.ts --reporter=verbose`

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/effectiveIncome.ts src/lib/calculations/effectiveIncome.test.ts src/lib/calculations/projectionParams.ts src/hooks/useWhatIfMetrics.ts
git commit -m "fix: amortize post-retirement income distortion from life events"
```

---

### Task 3: Move `buildBaseInputsFromEffectiveIncome` and `computeMetricSnapshot` to `lib/`

**Problem:** `lib/calculations/projectionParams.ts` imports `buildBaseInputsFromEffectiveIncome` and `computeMetricSnapshot` from `hooks/useWhatIfMetrics.ts` (lines 18-19). This is an inverted dependency (`lib/` importing from `hooks/`). `resolveEffectiveIncome` was already moved in the Option B work, but these two remained.

**Solution:** Move both functions to `lib/calculations/fireInputs.ts` (new file). Update all importers. Re-export from `useWhatIfMetrics.ts` for backward compatibility.

**Files:**
- Create: `lib/calculations/fireInputs.ts`
- Modify: `hooks/useWhatIfMetrics.ts` (remove function definitions, re-export)
- Modify: `lib/calculations/projectionParams.ts` (update import)
- Modify: `hooks/useFireCalculations.ts` (update import)

- [ ] **Step 1: Read `useWhatIfMetrics.ts` lines 58-116 and 170-188**

Copy the exact function bodies of `buildBaseInputsFromEffectiveIncome` and `computeMetricSnapshot`. Note all their imports.

- [ ] **Step 2: Create `lib/calculations/fireInputs.ts`**

Move both functions here with all their required imports (`calculateAllFireMetrics`, `projectPortfolioAtRetirement`, `computeCashReserveOffset`, `calculatePortfolioReturn`, `getEffectiveReturns`, `getEffectiveExpenses`, types). Keep the `WhatIfBaseInputs` type alias too.

- [ ] **Step 3: Update `useWhatIfMetrics.ts`**

Remove the function bodies. Add re-exports:
```typescript
export { buildBaseInputsFromEffectiveIncome, computeMetricSnapshot, type WhatIfBaseInputs } from '@/lib/calculations/fireInputs'
```

Import both functions locally for use within the file (same pattern as `resolveEffectiveIncome`).

- [ ] **Step 4: Update `projectionParams.ts` import (lines 18-19)**

Change:
```typescript
import { buildBaseInputsFromEffectiveIncome, computeMetricSnapshot } from '@/hooks/useWhatIfMetrics'
```
To:
```typescript
import { buildBaseInputsFromEffectiveIncome, computeMetricSnapshot } from '@/lib/calculations/fireInputs'
```

- [ ] **Step 5: Update `useFireCalculations.ts` import**

Read the file. It imports `{ computeMetricSnapshot, getBaseInputs }` from `@/hooks/useWhatIfMetrics` on the same line. Since only `computeMetricSnapshot` is moving (not `getBaseInputs`), split into two imports:
```typescript
import { computeMetricSnapshot } from '@/lib/calculations/fireInputs'
import { getBaseInputs } from '@/hooks/useWhatIfMetrics'
```

- [ ] **Step 6: Run type-check and tests**

Run: `cd frontend && npm run type-check && npm run test -- --run 2>&1 | tail -5`

- [ ] **Step 7: Commit**

```bash
git add src/lib/calculations/fireInputs.ts src/hooks/useWhatIfMetrics.ts src/lib/calculations/projectionParams.ts src/hooks/useFireCalculations.ts
git commit -m "refactor: move buildBaseInputsFromEffectiveIncome and computeMetricSnapshot to lib/"
```

---

### Task 4: Document nominal amortization as known limitation

**Problem:** The amortization formula averages nominal losses across years with different inflation levels. A $50K loss in year 20 is fewer real dollars than in year 1. This approximation is acceptable (matches `useDisruptionImpact.ts`) but undocumented.

**Solution:** Add a JSDoc note on `resolveEffectiveIncome` and a section in the plan file. No code change.

**Files:**
- Modify: `lib/calculations/effectiveIncome.ts` (update JSDoc)

- [ ] **Step 1: Update JSDoc on `resolveEffectiveIncome`**

Read `lib/calculations/effectiveIncome.ts`. Add to the existing JSDoc (after the `@param` lines):

```typescript
 * **Known approximation:** The average loss is computed in nominal terms.
 * Disruptions later in the career have higher nominal amounts (due to inflation
 * and salary growth), so they are slightly overweighted in the average. For a
 * more precise result, each year's loss would need to be deflated to real terms
 * before averaging. The current approximation matches the pattern in
 * `useDisruptionImpact.ts` (search for `baseWorking.length` to find the
 * equivalent formula) and is acceptable for a steady-state metric.
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/calculations/effectiveIncome.ts
git commit -m "docs: document nominal amortization approximation in resolveEffectiveIncome"
```

---

## What Could Break

| Task | Risk | Mitigation |
|------|------|------------|
| T1 (multi-adult) | Joint FIRE metrics change for couple plans with life events | Only `joint-couple` golden fixture affected. Update in same commit. |
| T2 (post-retirement) | FIRE metrics change when post-retirement income is affected by life events | Verify direction: less distortion = better accuracy. Update goldens. |
| T3 (move functions) | Import breakage | Re-exports from original location preserve backward compatibility. |
| T4 (docs) | None | JSDoc only, no behavior change. |

## What Should NOT Break

- Single-adult plans: T1 changes multi-adult path only.
- Users without life events: All changes gate on `lifeEventsEnabled`.
- Health check and tax optimization: Still intentionally excluded.
- Existing test files: Re-exports maintain backward compatibility (T3).
