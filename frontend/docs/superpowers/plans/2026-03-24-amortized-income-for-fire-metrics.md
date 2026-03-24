# Life Event Income Amortization for FIRE Metrics (Option B) — v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When life events are enabled, amortize their income impact across all working years instead of using the current-age snapshot, so temporary career breaks don't catastrophically distort the steady-state FIRE formula.

**Architecture:** Run the income projection twice (with and without life events), compute the average annual income loss, and subtract it from the current-age income. This matches the pattern already proven in `useDisruptionImpact.ts:264-290`. Zero behavior change for users without life events.

**Tech Stack:** TypeScript, Vitest

---

## Changes from v1 (4-agent deep review)

| # | Finding | Fix |
|---|---------|-----|
| B1 | `buildFullProjectionParams` receives pre-computed `incomeProjection`, cannot generate base projection internally | Extended `FullProjectionContext` with optional `baseIncomeProjection`, callers generate it |
| B2 | `proofScenario.ts` has its own `buildScenarioProjectionParams`, not "same as Task 4" | Separate Task 6 with explicit guidance for `proofScenario` |
| B3 | Age-override mismatch: callers use `{ ...profile, ...adultAges }` for income params | `computeBaseProjection` takes the already-age-overridden `IncomeProjectionParams`, so ages match automatically |
| W1 | Missing `computePerAdultFireAge.ts` as 7th location | Added to affected locations table and Task 4 |
| W2 | `joint-couple` and `pr-residency-transition` fixtures also have `lifeEventsEnabled: true` | Updated Task 7 to expect 3 fixture changes |
| W3 | Sequence-risk and MC parity snapshots may break | Added to Task 7 scope |
| W4 | Inverted dependency only partially resolved | Documented as known limitation (out of scope) |
| W5 | `useHealthCheckInputs.ts` excluded but not documented | Added exclusion rationale |
| W6 | Plan misidentified `buildFullProjectionParams` consumers | Fixed descriptions |
| W7 | Missing null guard on `baseProjection[0]` | Added optional chaining |
| S1 | Duplicate double-projection logic across call sites | Added `computeBaseProjection` shared helper in Task 1 |
| S2 | Missing edge case tests | Added to Task 2 |
| S3 | Performance: skip base projection when no events | Built into `computeBaseProjection` |
| S4 | Post-retirement income also affected | Documented as known limitation |

---

## Background

The steady-state FIRE formula uses a single `annualIncome` value. Currently this is `projection[0].totalGross` (income at the user's current age). If a life event is active at the current age, the formula treats that reduced income as permanent.

### Why Option B (not Option A)

A 4-agent deep review rejected Option A (average all working years) for three reasons:
1. **Dollar-basis violation:** Projection rows are nominal (inflated). Averaging nominal values across 25 years overstates real income. The FIRE formula works in real terms.
2. **Blast radius:** ALL golden fixtures have salary growth. Option A would break every fixture, not just the life-events one.
3. **Wrong variable:** The engine uses `annualSavings`, not `annualIncome`. Averaging income alone ignores savings pauses and expense variations.

Option B only changes results for users with `lifeEventsEnabled === true`. Both projections (with and without events) are in the same nominal frame, so the difference (loss) is basis-consistent.

### Nominal amortization note

Codex flagged that averaging nominal losses across years with different inflation levels is not perfectly basis-consistent (a $50K loss in year 20 is fewer real dollars than in year 1). This is a valid theoretical concern, but the existing `useDisruptionImpact.ts:288` uses the identical formula and has been shipping without issue. The distortion only matters when disruptions cluster at high-inflation future years. Deflating each year's loss to real terms would add complexity disproportionate to the accuracy gain for a steady-state approximation. Documented as a known limitation.

### Affected locations (7 + 2 excluded)

| Location | What it feeds | Pattern | Task |
|----------|--------------|---------|------|
| `resolveEffectiveIncome()` in `hooks/useWhatIfMetrics.ts` | FIRE dashboard, What-If (via `getBaseInputs`) | Central function | T2-T3 |
| `buildFullProjectionParams()` in `lib/calculations/projectionParams.ts` | Projection, per-adult FIRE age | Calls `resolveEffectiveIncome` via `FullProjectionContext` | T4 |
| `useProjection.ts` | Main projection hook | Caller of `buildFullProjectionParams` | T4 |
| `ProjectionPage.tsx` | Per-adult projection view | Caller of `buildFullProjectionParams` | T4 |
| `computePerAdultFireAge.ts` | Per-adult FIRE age | Caller of `buildFullProjectionParams` | T4 |
| `useOneMoreYear()` | One More Year panel | Inline `projection[0].totalGross` | T5 |
| `TimeCostPanel` | Time cost analysis | Inline `projection[0].totalGross` | T5 |
| `useCompanionPlannerBridge` | Companion mode payload | Inline `projection[0].totalGross` | T5 |
| `proofScenario` | Proof workspace | Inline in `buildScenarioProjectionParams` | T6 |

**Excluded locations (intentionally NOT changed):**
- `useHealthCheckInputs.ts` (lines 43, 149): Uses `row0.totalGross` for savings ratio, debt-to-income, and insurance gap calculations. Health check should reflect actual current-year income (what you're earning NOW), not amortized income. During a career break, health check *should* show reduced savings ratios as a factual statement about the user's current financial health.
- `useTaxOptimization.ts` (line 36): Uses `row0.totalGross` for tax optimization suggestions. Tax optimization must use actual current-year income since tax brackets apply to the current year, not an amortized average.

**Indirectly affected (via `getBaseInputs`):**
- `useFireCalculations.ts`: Calls `getBaseInputs` -> `resolveEffectiveIncome`. Benefits automatically from Task 3 changes. Verify dashboard FIRE number changes in testing.

### Dependency graph

```
Task 1 (move + helper) → Task 2 (amortization logic)
                            ↓
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
          Task 3        Task 4        Task 5
       (getBaseInputs) (FullCtx +    (inline
                        callers)     snapshots)
              ↓             ↓             ↓
              └─────────────┤             │
                            ↓             │
                        Task 6            │
                      (proofScenario)     │
                            ↓             │
                            └──────┬──────┘
                                   ↓
                               Task 7
                           (golden fixtures)
```

Tasks 3, 4, 5 can run in parallel after Task 2. Task 6 depends on Task 2. Task 7 runs last.

---

### Task 1: Move `resolveEffectiveIncome` to `lib/` + add `computeBaseProjection` helper

**Files:**
- Create: `lib/calculations/effectiveIncome.ts`
- Create: `lib/calculations/effectiveIncome.test.ts`
- Modify: `hooks/useWhatIfMetrics.ts` (remove function, re-export from new location)
- Modify: `lib/calculations/projectionParams.ts` (update import to point at `lib/`)

The function is a pure function (no React hooks) but currently lives in `hooks/useWhatIfMetrics.ts` and is imported by `lib/calculations/projectionParams.ts` (line 20). This is an inverted dependency. Move it to `lib/` first.

**Note on partial resolution:** `projectionParams.ts` also imports `buildBaseInputsFromEffectiveIncome` and `computeMetricSnapshot` from `hooks/useWhatIfMetrics.ts` (lines 18-19). Moving those too is a larger refactor outside this plan's scope. Only `resolveEffectiveIncome` moves now.

- [ ] **Step 1: Create `lib/calculations/effectiveIncome.ts`**

Read `hooks/useWhatIfMetrics.ts` (lines 56-63) to get the current function signature. Read `lib/calculations/income.ts` to get `generateIncomeProjection` signature and `IncomeProjectionParams` type. Create the new file with:

1. The existing `resolveEffectiveIncome` implementation (unchanged for now, signature and behavior identical)
2. A new `computeBaseProjection` helper that centralizes the double-projection logic:
   - Takes `IncomeProjectionParams` (already age-overridden by the caller)
   - Returns `null` if `!params.lifeEventsEnabled` OR `params.lifeEvents.length === 0` (performance optimization: skip when no events)
   - Otherwise returns `generateIncomeProjection({ ...params, lifeEventsEnabled: false })`

- [ ] **Step 2: Write tests in `lib/calculations/effectiveIncome.test.ts`**

Test `resolveEffectiveIncome` current behavior (4 tests):
1. Returns `profile.annualIncome` when projection is null
2. Returns `profile.annualIncome` when projection is empty
3. Returns row-0 income when no base projection provided
4. Returns row-0 snapshot (current behavior, pre-amortization)

Test `computeBaseProjection` (3 tests):
1. Returns `null` when `lifeEventsEnabled` is false
2. Returns `null` when `lifeEventsEnabled` is true but `lifeEvents` is empty
3. Returns a projection when life events are present and enabled

- [ ] **Step 3: Update imports**

In `hooks/useWhatIfMetrics.ts`, replace the function definition (lines 56-63) with a re-export:
```typescript
export { resolveEffectiveIncome } from '@/lib/calculations/effectiveIncome'
```

In `lib/calculations/projectionParams.ts`, change the import at line 20 from `@/hooks/useWhatIfMetrics` to `@/lib/calculations/effectiveIncome`.

- [ ] **Step 4: Run type-check and tests**

Run: `cd frontend && npm run type-check && npx vitest run src/lib/calculations/effectiveIncome.test.ts --reporter=verbose`
Expected: Type-check passes, tests pass (current behavior preserved).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/effectiveIncome.ts src/lib/calculations/effectiveIncome.test.ts src/hooks/useWhatIfMetrics.ts src/lib/calculations/projectionParams.ts
git commit -m "refactor: move resolveEffectiveIncome to lib/calculations, add computeBaseProjection helper"
```

---

### Task 2: Implement Option B amortization in `resolveEffectiveIncome`

**Files:**
- Modify: `lib/calculations/effectiveIncome.ts`
- Modify: `lib/calculations/effectiveIncome.test.ts`

The function signature adds an optional `baseProjection` parameter. When provided, it computes the amortized loss. When absent, it falls back to current behavior (backward compatible).

- [ ] **Step 1: Update the function signature and implementation**

Read `lib/calculations/effectiveIncome.ts` (created in Task 1). Update `resolveEffectiveIncome` to accept a third optional parameter `baseProjection?: IncomeProjectionRow[] | null`.

Implementation logic:
1. If `!projection || projection.length === 0`: return `profile.annualIncome` (unchanged)
2. Capture `row0Income = projection[0].totalGross`
3. If `!baseProjection || baseProjection.length === 0`: return `row0Income` (legacy path)
4. Filter working years: `workingWith = projection.filter(r => !r.isRetired)`, same for `workingWithout` from `baseProjection`
5. If either working array is empty: return `row0Income`
6. Compute `totalWith` and `totalWithout` as sum of `totalGross` for working years
7. `avgAnnualLoss = (totalWithout - totalWith) / workingWithout.length`
8. `baseRow0 = baseProjection[0]?.totalGross ?? row0Income` (null guard)
9. Return `Math.max(0, baseRow0 - avgAnnualLoss)`

- [ ] **Step 2: Update and add tests**

Update the existing pre-amortization test to expect legacy behavior (no base projection).

Add new tests:
1. **Amortizes loss when baseProjection provided:** Career break at current age (rows 0-1 at $50K, rows 2-4 at $100K). Without events all at $100K. Expected: total loss = 100K, over 5 years = 20K/yr, effective = 100K - 20K = 80K.
2. **No impact when events don't reduce income:** Both projections identical. Expected: returns base row-0.
3. **Legacy path when baseProjection absent:** Returns `projection[0].totalGross`.
4. **Clamps to zero:** All working rows at $0 with events, $100K without. Expected: 0.
5. **Handles income increase from events:** Negative `avgAnnualLoss` (e.g., promotion modeled as life event). Expected: effective > baseRow0 (no upward clamp).
6. **Handles `incomeImpact > 1`:** Life event that more than doubles income in some years. Expected: negative loss, higher effective income.
7. **Handles zero working years in base projection:** All rows retired. Expected: falls back to `row0Income`.
8. **Null guard on baseProjection[0]:** Empty base with non-empty assertion should use `row0Income` fallback.

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/lib/calculations/effectiveIncome.test.ts --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/calculations/effectiveIncome.ts src/lib/calculations/effectiveIncome.test.ts
git commit -m "fix: amortize life event income loss in resolveEffectiveIncome (Option B)"
```

---

### Task 3: Wire base projection into `getBaseInputs`

**Files:**
- Modify: `hooks/useWhatIfMetrics.ts` (`getBaseInputs` function, lines 125-172)

`getBaseInputs` already generates the projection via `buildProjectionParams` + `generateIncomeProjection` (lines 136-144). It needs to also generate a base projection and pass it to `resolveEffectiveIncome`.

- [ ] **Step 1: Add import**

Import `computeBaseProjection` from `@/lib/calculations/effectiveIncome` (alongside the existing `resolveEffectiveIncome` re-export).

- [ ] **Step 2: Generate base projection after the existing projection (line 144)**

After the existing projection generation, add:
```typescript
const baseProjection = projectionParams ? computeBaseProjection(projectionParams) : null
```

Note: `projectionParams` here is already age-overridden (lines 137-141 spread `{ ...profile, currentAge, retirementAge, lifeExpectancy }`), so the base projection automatically uses the correct ages. This resolves the age-override mismatch concern.

- [ ] **Step 3: Pass baseProjection to resolveEffectiveIncome (line 168)**

Change:
```typescript
resolveEffectiveIncome(profile, projection),
```
To:
```typescript
resolveEffectiveIncome(profile, projection, baseProjection),
```

- [ ] **Step 4: Run type-check and full tests**

Run: `cd frontend && npm run type-check && npm run test -- --run 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWhatIfMetrics.ts
git commit -m "fix: wire base projection into getBaseInputs for amortized effective income"
```

---

### Task 4: Extend `FullProjectionContext` + wire `buildFullProjectionParams` callers

**Files:**
- Modify: `lib/calculations/projectionParams.ts` (interface + function)
- Modify: `hooks/useProjection.ts` (caller)
- Modify: `pages/ProjectionPage.tsx` (per-adult caller, ~line 311-328)
- Modify: `lib/household/computePerAdultFireAge.ts` (caller)

**Important context:** `buildFullProjectionParams` does NOT generate projections. It receives `incomeProjection` as a pre-computed field in `FullProjectionContext` (line 156). The base projection must be generated by each caller and passed through the context.

- [ ] **Step 1: Extend `FullProjectionContext` in `projectionParams.ts` (line 149-160)**

Add an optional field after `incomeProjection`:
```typescript
/** Base income projection without life events, for amortization. */
baseIncomeProjection?: IncomeProjectionRow[]
```

- [ ] **Step 2: Update `buildFullProjectionParams` to use it (line 196)**

Change:
```typescript
const effectiveIncome = resolveEffectiveIncome(profile, incomeProjection)
```
To:
```typescript
const effectiveIncome = resolveEffectiveIncome(profile, incomeProjection, ctx.baseIncomeProjection)
```

- [ ] **Step 3: Wire `useProjection.ts` (line 37-57)**

This hook gets `incomeProjection` from `useIncomeProjection()`. It also has `profile`, `income`, `property` from `buildHouseholdRuntimeLegacyInputs` (line 33-36) and `normalized` ages (line 32).

Add: import `computeBaseProjection` and `buildProjectionParams`. Before the `buildFullProjectionParams` call (line 44), compute:
```typescript
const incomeParams = buildProjectionParams(
  { ...profile, currentAge: normalized.currentAge, retirementAge: normalized.retirementAge, lifeExpectancy: normalized.lifeExpectancy },
  income,
  property,
)
const baseIncomeProjection = incomeParams ? computeBaseProjection(incomeParams) : undefined
```

Pass `baseIncomeProjection` in the `buildFullProjectionParams` call.

**Multi-adult limitation:** For multi-adult joint mode, `incomeProjection` is a merged projection from `mergePerAdultProjections`. Computing a merged base projection would require re-running the per-adult compilation without life events, which is a deeper change. For now, `buildProjectionParams` returns the single-adult params, and multi-adult joint mode will not pass a base projection (getting the legacy behavior). Per-adult FIRE ages (via `computePerAdultFireAge`) DO get amortization since each adult is computed separately.

- [ ] **Step 4: Wire `ProjectionPage.tsx` per-adult view (~line 311-328)**

This page already builds `incomeParams` (line 311-315) and `incomeProjection` (line 317). After generating `incomeProjection`, add:
```typescript
const baseIncomeProjection = computeBaseProjection(incomeParams) ?? undefined
```
Pass `baseIncomeProjection` in the `buildFullProjectionParams` call at line 320.

- [ ] **Step 5: Wire `computePerAdultFireAge.ts` (lines 33-50)**

This function already builds `incomeParams` (line 33-37) and `incomeProjection` (line 40). After generating `incomeProjection`, add:
```typescript
const baseIncomeProjection = computeBaseProjection(incomeParams) ?? undefined
```
Pass `baseIncomeProjection` in the `buildFullProjectionParams` call at line 42.

Note: `incomeParams` here uses `{ ...profile, ...adultAges }` (line 34), so the base projection automatically uses the correct per-adult ages.

- [ ] **Step 6: Test files that call `buildFullProjectionParams`**

Check these files: `runtimeLegacyInputs.seam.test.ts`, `downsizing-ownership.test.ts`, `computePerAdultFireAge.test.ts`. Since `baseIncomeProjection` is optional in `FullProjectionContext`, existing test calls that don't provide it will use the legacy path. No test file changes needed unless they fail.

- [ ] **Step 7: Run type-check and full tests**

Run: `cd frontend && npm run type-check && npm run test -- --run 2>&1 | tail -20`

- [ ] **Step 8: Commit**

```bash
git add src/lib/calculations/projectionParams.ts src/hooks/useProjection.ts src/pages/ProjectionPage.tsx src/lib/household/computePerAdultFireAge.ts
git commit -m "fix: wire base projection through FullProjectionContext and all callers"
```

---

### Task 5: Fix inline snapshots in `useOneMoreYear`, `TimeCostPanel`, `useCompanionPlannerBridge`

**Files:**
- Modify: `hooks/useOneMoreYear.ts` (lines 50-55)
- Modify: `components/dashboard/TimeCostPanel.tsx` (lines 31-36)
- Modify: `hooks/useCompanionPlannerBridge.ts` (lines 181-187)

All three have the same inline pattern: build `projectionParams`, generate projection, use `projection[0].totalGross`. Replace with `resolveEffectiveIncome` + `computeBaseProjection`.

- [ ] **Step 1: Read all three files** to find exact code to change.

- [ ] **Step 2: Update `useOneMoreYear.ts` (lines 50-55)**

Current code (read to verify exact lines):
```typescript
let effectiveIncome = profile.annualIncome
const projectionParams = buildProjectionParams(profile, income, property)
if (projectionParams) {
  const projection = generateIncomeProjection(projectionParams)
  if (projection.length > 0) effectiveIncome = projection[0].totalGross
}
```

Replace with:
```typescript
import { resolveEffectiveIncome, computeBaseProjection } from '@/lib/calculations/effectiveIncome'

let effectiveIncome = profile.annualIncome
const projectionParams = buildProjectionParams(profile, income, property)
if (projectionParams) {
  const projection = generateIncomeProjection(projectionParams)
  const baseProjection = computeBaseProjection(projectionParams)
  effectiveIncome = resolveEffectiveIncome(profile, projection, baseProjection)
}
```

- [ ] **Step 3: Update `TimeCostPanel.tsx` (lines 31-36)** — same pattern as Step 2.

- [ ] **Step 4: Update `useCompanionPlannerBridge.ts` (lines 181-187)**

Current code:
```typescript
const effectiveAnnualIncome = useMemo(() => {
  const projectionParams = buildProjectionParams(profile, income, property)
  if (!projectionParams) return annualIncome
  const projection = generateIncomeProjection(projectionParams)
  return projection[0]?.totalGross ?? annualIncome
}, [annualIncome, income, profile, property])
```

Replace with:
```typescript
import { resolveEffectiveIncome, computeBaseProjection } from '@/lib/calculations/effectiveIncome'

const effectiveAnnualIncome = useMemo(() => {
  const projectionParams = buildProjectionParams(profile, income, property)
  if (!projectionParams) return annualIncome
  const projection = generateIncomeProjection(projectionParams)
  const baseProjection = computeBaseProjection(projectionParams)
  return resolveEffectiveIncome({ annualIncome }, projection, baseProjection)
}, [annualIncome, income, profile, property])
```

Note: `useCompanionPlannerBridge` uses effective income for the companion app payload, not directly for FIRE metrics. Amortizing here ensures consistency between the planner and companion views.

- [ ] **Step 5: Run type-check**

Run: `cd frontend && npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useOneMoreYear.ts src/components/dashboard/TimeCostPanel.tsx src/hooks/useCompanionPlannerBridge.ts
git commit -m "fix: use amortized income in useOneMoreYear, TimeCostPanel, and companion bridge"
```

---

### Task 6: Fix `proofScenario.ts` inline snapshot

**Files:**
- Modify: `lib/simulation/proofScenario.ts` (line 227, inside `buildScenarioProjectionParams`)

**Important: This is NOT the same pattern as Task 5.** `proofScenario.ts` is a pure function that operates on deserialized store snapshots. It has its own `buildScenarioProjectionParams` function (line 207) which builds `IncomeProjectionParams` via `buildProjectionParams` (line 209), generates the projection (line 212), and uses `incomeProjection[0]?.totalGross` inline (line 227) to feed `calculateAllFireMetrics` directly.

- [ ] **Step 1: Read `lib/simulation/proofScenario.ts`** lines 207-264 to understand the full function.

- [ ] **Step 2: Add imports**

Import `resolveEffectiveIncome` and `computeBaseProjection` from `@/lib/calculations/effectiveIncome`.

- [ ] **Step 3: Update `buildScenarioProjectionParams` (after line 212)**

After the existing `incomeProjection` generation (line 212), add:
```typescript
const baseProjection = computeBaseProjection(incomeParams)
```

`incomeParams` is the `IncomeProjectionParams` built at line 209 via `buildProjectionParams(profile, income, property)`. This already has the correct ages from the deserialized profile.

- [ ] **Step 4: Replace the inline snapshot (line 227)**

Change:
```typescript
const effectiveIncome = incomeProjection[0]?.totalGross ?? profile.annualIncome
```
To:
```typescript
const effectiveIncome = resolveEffectiveIncome(profile, incomeProjection, baseProjection)
```

- [ ] **Step 5: Run type-check**

Run: `cd frontend && npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add src/lib/simulation/proofScenario.ts
git commit -m "fix: use amortized income in proof scenario"
```

---

### Task 7: Update golden and parity test fixtures

**Files (potentially):**
- Modify: `test-helpers/approvedActuarialGoldenOutputs.ts`
- Modify: `test-helpers/approvedMonteCarloParamParityOutputs.ts`
- Modify: `test-helpers/approvedSequenceRiskParamParityOutputs.ts`

Three fixtures have `lifeEventsEnabled: true` and may produce different outputs:
1. `goals-and-life-events` (income `lifeEventsEnabled: true` in `legacyParityFixtures.ts:268`)
2. `pr-residency-transition` (income `lifeEventsEnabled: true` in `legacyParityFixtures.ts:346`)
3. `joint-couple` (adult `lifeEventsEnabled: true` in `legacyParityFixtures.ts:466`)

Fixtures with `lifeEventsEnabled: false` (`salary-only`, `property-and-cpf`) should be unchanged.

- [ ] **Step 1: Run actuarial golden tests**

Run: `cd frontend && npx vitest run src/lib/__goldens__/actuarialGolden.test.ts --reporter=verbose 2>&1`

Note which fixtures fail. Expected: `goals-and-life-events` likely fails (strongest life event impact). `pr-residency-transition` may or may not fail depending on whether its life events affect income at the current age. `joint-couple` may fail if the partner's life events affect income.

- [ ] **Step 2: Run MC parity tests**

Run: `cd frontend && npx vitest run src/lib/simulation/monteCarloParams.parity.test.ts --reporter=verbose 2>&1`

The `goals-and-life-events` fixture feeds through `buildFullProjectionParams` which now uses amortized income, changing `fireNumber` in the MC params.

- [ ] **Step 3: Run sequence-risk parity tests**

Run: `cd frontend && npx vitest run --reporter=verbose 2>&1 | grep -A2 'sequenceRisk\|parity'`

Check if sequence-risk outputs changed for life-event fixtures.

- [ ] **Step 4: Update failing approved outputs**

For each failing fixture, capture the new output and update the approved values. The new values should show less dramatic FIRE metric changes (amortized loss instead of permanent snapshot).

**Do NOT update fixtures blindly.** For each changed value, verify that the direction of change makes sense:
- FIRE age should decrease (amortized income > disrupted snapshot)
- FIRE number should be unchanged (based on expenses, not income)
- Years to FIRE should decrease
- MC effective income in params should be higher than the disrupted snapshot

- [ ] **Step 5: If `salary-only` or `property-and-cpf` fail, investigate**

These have `lifeEventsEnabled: false`. Any failure indicates an unintended regression. `computeBaseProjection` should return `null` for these, and `resolveEffectiveIncome` should use the legacy path.

- [ ] **Step 6: Run full test suite**

Run: `cd frontend && npm run test -- --run 2>&1 | grep -E '(Test Files|Tests )'`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/test-helpers/approvedActuarialGoldenOutputs.ts src/test-helpers/approvedMonteCarloParamParityOutputs.ts src/test-helpers/approvedSequenceRiskParamParityOutputs.ts
git commit -m "test: update golden and parity fixtures for life event income amortization"
```

---

## What Could Break

1. **FIRE metrics change for users with life events** -- The primary fix. Career break impact is correctly amortized.
2. **Golden tests `goals-and-life-events`, `pr-residency-transition`, `joint-couple`** -- Will need new approved values (Task 7).
3. **MC and sequence-risk parity snapshots for life-event fixtures** -- `buildFullProjectionParams` feeds MC/SR with different effective income when events are active.
4. **Performance** -- Double projection when life events are enabled. Acceptable: `generateIncomeProjection` is fast (~55-80 rows, pure array computation) and `computeBaseProjection` skips entirely when `!lifeEventsEnabled || lifeEvents.length === 0`.

## What Should NOT Break

- Users without life events: zero change (`computeBaseProjection` returns `null`)
- Users with life events disabled: zero change (toggle off = no amortization)
- The year-by-year projection engine: unaffected
- Golden fixtures `salary-only` and `property-and-cpf`: unchanged
- Post-retirement income resolution: unaffected (known limitation, not fixed here)
- Export/import: no schema changes
- Dollar basis: both projections are in the same nominal frame, the difference cancels
- Multi-adult joint projection: gets legacy behavior (base projection not yet supported for merged projections)
- Health check and tax optimization: intentionally excluded, use current-year income

## Known Limitations (follow-ups)

1. **Nominal amortization approximation:** Averaging nominal losses across years with different inflation levels slightly overstates late-career disruptions. Acceptable for a steady-state metric; would need NPV-discounting for perfect accuracy.
2. **Multi-adult joint mode:** `useProjection` in multi-adult joint mode does not pass a base projection because the merged projection comes from `mergePerAdultProjections`. Per-adult FIRE ages DO get amortization (via `computePerAdultFireAge`).
3. **Inverted dependency partially resolved:** `projectionParams.ts` still imports `buildBaseInputsFromEffectiveIncome` and `computeMetricSnapshot` from `hooks/useWhatIfMetrics.ts`. Only `resolveEffectiveIncome` was moved to `lib/` in this plan.
4. **Post-retirement income:** Life events affecting retirement-phase income (e.g., reduced rental income) also distort `postRetirementIncome` extracted from the first retired row. Not addressed in this plan.
