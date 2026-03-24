# Life Event Income Amortization for FIRE Metrics (Option B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When life events are enabled, amortize their income impact across all working years instead of using the current-age snapshot, so temporary career breaks don't catastrophically distort the steady-state FIRE formula.

**Architecture:** Run the income projection twice (with and without life events), compute the average annual income loss, and subtract it from the current-age income. This matches the pattern already proven in `useDisruptionImpact.ts:264-290`. Zero behavior change for users without life events.

**Tech Stack:** TypeScript, Vitest

---

## Background

The steady-state FIRE formula uses a single `annualIncome` value. Currently this is `projection[0].totalGross` (income at the user's current age). If a life event is active at the current age, the formula treats that reduced income as permanent.

### Why Option B (not Option A)

A 4-agent deep review rejected Option A (average all working years) for three reasons:
1. **Dollar-basis violation:** Projection rows are nominal (inflated). Averaging nominal values across 25 years overstates real income. The FIRE formula works in real terms.
2. **Blast radius:** ALL golden fixtures have salary growth. Option A would break every fixture, not just the life-events one.
3. **Wrong variable:** The engine uses `annualSavings`, not `annualIncome`. Averaging income alone ignores savings pauses and expense variations.

Option B only changes results for users with `lifeEventsEnabled === true`. Both projections (with and without events) are in the same nominal frame, so the difference (loss) is basis-consistent. No signature changes. Only the `goals-and-life-events` golden fixture needs updating.

### Affected locations (6 total)

| Location | What it feeds | Pattern |
|----------|--------------|---------|
| `resolveEffectiveIncome()` | FIRE dashboard, What-If | Central function (2 callers) |
| `buildFullProjectionParams()` | MC, backtest, per-adult FIRE age | Calls `resolveEffectiveIncome` |
| `useOneMoreYear()` | One More Year panel | Inline `projection[0].totalGross` |
| `TimeCostPanel` | Time cost analysis | Inline `projection[0].totalGross` |
| `useCompanionPlannerBridge` | Companion mode | Inline `projection[0].totalGross` |
| `proofScenario` | Proof workspace | Inline `projection[0].totalGross` |

The central function fix (Task 2) covers the first 2. Tasks 3-6 cover the 4 inline copies.

---

### Task 1: Move `resolveEffectiveIncome` to `lib/` and add tests

**Files:**
- Create: `lib/calculations/effectiveIncome.ts`
- Create: `lib/calculations/effectiveIncome.test.ts`
- Modify: `hooks/useWhatIfMetrics.ts` (remove function, re-export from new location)
- Modify: `lib/calculations/projectionParams.ts` (update import)

The function is a pure function (no React hooks) but currently lives in `hooks/useWhatIfMetrics.ts` and is imported by `lib/calculations/projectionParams.ts`. This is an inverted dependency. Move it to `lib/` first.

- [ ] **Step 1: Create `lib/calculations/effectiveIncome.ts`**

Read `hooks/useWhatIfMetrics.ts` to get the current function signature and `IncomeProjectionRow` type import. Create the new file with the existing implementation (unchanged for now):

```typescript
import type { IncomeProjectionRow, ProfileState } from '@/lib/types'

/**
 * Resolve the effective annual income for the steady-state FIRE formula.
 * When life events are enabled, amortizes their impact across all working years
 * instead of using the current-age snapshot.
 */
export function resolveEffectiveIncome(
  profile: Pick<ProfileState, 'annualIncome'>,
  projection: IncomeProjectionRow[] | null | undefined,
): number {
  return projection && projection.length > 0
    ? projection[0].totalGross
    : profile.annualIncome
}
```

- [ ] **Step 2: Write failing tests in `lib/calculations/effectiveIncome.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { resolveEffectiveIncome } from './effectiveIncome'
import type { IncomeProjectionRow } from '@/lib/types'

// Helper to create minimal projection rows
const row = (totalGross: number, isRetired = false) =>
  ({ totalGross, isRetired } as IncomeProjectionRow)

describe('resolveEffectiveIncome', () => {
  it('returns profile.annualIncome when projection is null', () => {
    expect(resolveEffectiveIncome({ annualIncome: 100_000 }, null)).toBe(100_000)
  })

  it('returns profile.annualIncome when projection is empty', () => {
    expect(resolveEffectiveIncome({ annualIncome: 100_000 }, [])).toBe(100_000)
  })

  it('returns row-0 income when no life events reduce current-age income', () => {
    const projection = [row(100_000), row(100_000), row(100_000), row(0, true)]
    expect(resolveEffectiveIncome({ annualIncome: 100_000 }, projection)).toBe(100_000)
  })

  it('amortizes life event loss instead of using disrupted row-0 snapshot', () => {
    // Career break at current age: rows 0-1 at $50K, rows 2-4 at $100K
    // Without events, all rows would be $100K
    // Average loss = (100K-50K)*2 / 5 = $20K/yr
    // Effective = row0_without_events - avgLoss = 100K - 20K = 80K
    // But with Option B, we need the base projection (without events) to compute this.
    // This test will be updated in Task 2 when the implementation changes.
    const projection = [row(50_000), row(50_000), row(100_000), row(100_000), row(100_000), row(0, true)]
    // Current behavior: returns 50_000 (row 0 snapshot)
    // After fix: should return something > 50_000
    expect(resolveEffectiveIncome({ annualIncome: 100_000 }, projection)).toBe(50_000)
  })
})
```

- [ ] **Step 3: Update imports**

In `hooks/useWhatIfMetrics.ts`, replace the function with a re-export:
```typescript
export { resolveEffectiveIncome } from '@/lib/calculations/effectiveIncome'
```

In `lib/calculations/projectionParams.ts`, update the import to point directly at `lib/`:
```typescript
import { resolveEffectiveIncome } from '@/lib/calculations/effectiveIncome'
```

- [ ] **Step 4: Run type-check and tests**

Run: `cd frontend && npm run type-check && npx vitest run src/lib/calculations/effectiveIncome.test.ts --reporter=verbose`
Expected: Type-check passes, tests pass (current behavior preserved).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/effectiveIncome.ts src/lib/calculations/effectiveIncome.test.ts src/hooks/useWhatIfMetrics.ts src/lib/calculations/projectionParams.ts
git commit -m "refactor: move resolveEffectiveIncome to lib/calculations (fix inverted dependency)"
```

---

### Task 2: Implement Option B amortization in `resolveEffectiveIncome`

**Files:**
- Modify: `lib/calculations/effectiveIncome.ts`
- Modify: `lib/calculations/effectiveIncome.test.ts`

The new function signature adds an optional `baseProjection` parameter — the projection without life events. When provided, it computes the amortized loss. When absent, it falls back to current behavior.

- [ ] **Step 1: Update the function**

```typescript
import type { IncomeProjectionRow, ProfileState } from '@/lib/types'

/**
 * Resolve the effective annual income for the steady-state FIRE formula.
 *
 * When `baseProjection` is provided (projection WITHOUT life events),
 * computes the average annual income loss from life events and subtracts
 * it from the base row-0 income. This amortizes temporary disruptions
 * across the full working period instead of treating a current-age
 * career break as permanent.
 *
 * When `baseProjection` is absent, returns row-0 totalGross (legacy behavior).
 */
export function resolveEffectiveIncome(
  profile: Pick<ProfileState, 'annualIncome'>,
  projection: IncomeProjectionRow[] | null | undefined,
  baseProjection?: IncomeProjectionRow[] | null,
): number {
  if (!projection || projection.length === 0) return profile.annualIncome

  const row0Income = projection[0].totalGross

  // If no base projection provided, use legacy row-0 snapshot
  if (!baseProjection || baseProjection.length === 0) return row0Income

  // Compare working-year income totals to derive average annual loss
  const workingWith = projection.filter(r => !r.isRetired)
  const workingWithout = baseProjection.filter(r => !r.isRetired)

  if (workingWith.length === 0 || workingWithout.length === 0) return row0Income

  const totalWith = workingWith.reduce((s, r) => s + r.totalGross, 0)
  const totalWithout = workingWithout.reduce((s, r) => s + r.totalGross, 0)
  const avgAnnualLoss = (totalWithout - totalWith) / workingWithout.length

  // Use the base (undisrupted) row-0 income minus the amortized loss
  const baseRow0 = baseProjection[0].totalGross
  return Math.max(0, baseRow0 - avgAnnualLoss)
}
```

- [ ] **Step 2: Update tests**

```typescript
  it('amortizes life event loss when baseProjection is provided', () => {
    // With events: rows 0-1 at $50K (career break), rows 2-4 at $100K
    const withEvents = [row(50_000), row(50_000), row(100_000), row(100_000), row(100_000), row(0, true)]
    // Without events: all rows at $100K
    const withoutEvents = [row(100_000), row(100_000), row(100_000), row(100_000), row(100_000), row(0, true)]

    const result = resolveEffectiveIncome({ annualIncome: 100_000 }, withEvents, withoutEvents)
    // Total loss = (500K - 400K) = 100K over 5 years = 20K/yr avg loss
    // Effective = 100K (base row 0) - 20K = 80K
    expect(result).toBeCloseTo(80_000, 0)
  })

  it('returns base row-0 income when life events have no income impact', () => {
    // Events that only add expenses (no income reduction)
    const withEvents = [row(100_000), row(100_000), row(100_000), row(0, true)]
    const withoutEvents = [row(100_000), row(100_000), row(100_000), row(0, true)]

    const result = resolveEffectiveIncome({ annualIncome: 100_000 }, withEvents, withoutEvents)
    expect(result).toBe(100_000)
  })

  it('returns row-0 snapshot when baseProjection is not provided (legacy)', () => {
    const projection = [row(50_000), row(100_000), row(0, true)]
    expect(resolveEffectiveIncome({ annualIncome: 100_000 }, projection)).toBe(50_000)
  })

  it('clamps to zero when loss exceeds base income', () => {
    const withEvents = [row(0), row(0), row(0), row(0, true)]
    const withoutEvents = [row(100_000), row(100_000), row(100_000), row(0, true)]
    expect(resolveEffectiveIncome({ annualIncome: 100_000 }, withEvents, withoutEvents)).toBe(0)
  })
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/lib/calculations/effectiveIncome.test.ts --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/calculations/effectiveIncome.ts src/lib/calculations/effectiveIncome.test.ts
git commit -m "fix: amortize life event income loss in resolveEffectiveIncome (Option B)"
```

---

### Task 3: Wire base projection into `getBaseInputs` and `buildFullProjectionParams`

**Files:**
- Modify: `hooks/useWhatIfMetrics.ts` (`getBaseInputs` function, ~line 125-172)
- Modify: `lib/calculations/projectionParams.ts` (`buildFullProjectionParams`, ~line 169-220)

Both call sites already generate the projection. They need to also generate a base projection (without life events) and pass it to `resolveEffectiveIncome`.

- [ ] **Step 1: Update `getBaseInputs` in `useWhatIfMetrics.ts`**

After generating the projection (line 142-144), generate a second projection with life events disabled if events are enabled:

```typescript
const projection = projectionParams
  ? generateIncomeProjection(projectionParams)
  : null

// Generate base projection (without life events) for amortization
const baseProjection = projectionParams && projectionParams.lifeEventsEnabled
  ? generateIncomeProjection({ ...projectionParams, lifeEventsEnabled: false })
  : null
```

Then pass `baseProjection` to `resolveEffectiveIncome`:
```typescript
resolveEffectiveIncome(profile, projection, baseProjection),
```

- [ ] **Step 2: Update `buildFullProjectionParams` in `projectionParams.ts`**

Same pattern: after generating `incomeProjection`, generate a base version:

```typescript
const baseProjection = incomeParams.lifeEventsEnabled
  ? generateIncomeProjection({ ...incomeParams, lifeEventsEnabled: false })
  : null

const effectiveIncome = resolveEffectiveIncome(profile, incomeProjection, baseProjection)
```

Read the file first to find exact insertion points.

- [ ] **Step 3: Run type-check and tests**

Run: `cd frontend && npm run type-check && npm run test -- --run 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWhatIfMetrics.ts src/lib/calculations/projectionParams.ts
git commit -m "fix: wire base projection into resolveEffectiveIncome call sites"
```

---

### Task 4: Fix inline snapshots in `useOneMoreYear` and `TimeCostPanel`

**Files:**
- Modify: `hooks/useOneMoreYear.ts` (line 51-56)
- Modify: `components/dashboard/TimeCostPanel.tsx` (line 35-36)

Both have inline `projection[0].totalGross` patterns. Replace with `resolveEffectiveIncome` calls, generating a base projection when life events are enabled.

- [ ] **Step 1: Read both files** to find exact code to change.

- [ ] **Step 2: Update `useOneMoreYear.ts`**

Replace the inline pattern with:
```typescript
import { resolveEffectiveIncome } from '@/lib/calculations/effectiveIncome'

// ... inside the hook:
let effectiveIncome = profile.annualIncome
const projectionParams = buildProjectionParams(profile, income, property)
if (projectionParams) {
  const projection = generateIncomeProjection(projectionParams)
  const baseProjection = projectionParams.lifeEventsEnabled
    ? generateIncomeProjection({ ...projectionParams, lifeEventsEnabled: false })
    : null
  effectiveIncome = resolveEffectiveIncome(profile, projection, baseProjection)
}
```

- [ ] **Step 3: Update `TimeCostPanel.tsx`** with the same pattern.

- [ ] **Step 4: Run type-check**

Run: `cd frontend && npm run type-check`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOneMoreYear.ts src/components/dashboard/TimeCostPanel.tsx
git commit -m "fix: use amortized income in useOneMoreYear and TimeCostPanel"
```

---

### Task 5: Fix inline snapshots in `useCompanionPlannerBridge` and `proofScenario`

**Files:**
- Modify: `hooks/useCompanionPlannerBridge.ts` (~line 181)
- Modify: `lib/simulation/proofScenario.ts` (~line 227)

- [ ] **Step 1: Read both files** to find the `projection[0].totalGross` pattern.

- [ ] **Step 2: Apply the same pattern** — import `resolveEffectiveIncome`, generate base projection when events are enabled, pass both.

- [ ] **Step 3: Run type-check**

Run: `cd frontend && npm run type-check`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCompanionPlannerBridge.ts src/lib/simulation/proofScenario.ts
git commit -m "fix: use amortized income in companion bridge and proof scenario"
```

---

### Task 6: Update golden test fixtures

**Files:**
- Modify: `test-helpers/actuarialGoldens.ts` (if needed)

- [ ] **Step 1: Run golden tests**

Run: `cd frontend && npx vitest run src/lib/__goldens__/actuarialGolden.test.ts --reporter=verbose 2>&1`

Only `goals-and-life-events` should fail (it has life events enabled). All other fixtures should pass unchanged (Option B doesn't affect users without life events).

- [ ] **Step 2: If `goals-and-life-events` fails, update its approved values**

Capture the new output and update the fixture. The new values should show a less dramatic FIRE age impact (amortized loss instead of permanent snapshot).

- [ ] **Step 3: If any OTHER fixture fails, investigate**

This would indicate an unintended regression. The base projection generation should only trigger when `lifeEventsEnabled === true`.

- [ ] **Step 4: Run full test suite**

Run: `cd frontend && npm run test -- --run 2>&1 | grep -E '(Test Files|Tests )'`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/test-helpers/actuarialGoldens.ts
git commit -m "test: update golden fixtures for life event income amortization"
```

---

## What Could Break

1. **FIRE metrics change for users with life events** — The primary fix. Career break impact is correctly amortized.
2. **Golden test `goals-and-life-events`** — Will need new approved values (Task 6).
3. **MC/backtest inputs for users with life events** — `buildFullProjectionParams` feeds MC with different effective income when events are active.
4. **Performance** — Double projection when life events are enabled. This is acceptable: `generateIncomeProjection` is fast (pure array computation) and only runs when the user has life events.

## What Should NOT Break

- Users without life events: zero change (base projection is not generated)
- Users with life events disabled: zero change (toggle off = no amortization)
- The year-by-year projection engine: unaffected
- All golden fixtures except `goals-and-life-events`: unchanged
- Post-retirement income resolution: unaffected
- Export/import: no schema changes
- Dollar basis: both projections are in the same nominal frame, the difference cancels
