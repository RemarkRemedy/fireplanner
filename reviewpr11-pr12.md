# Batch 4 Final Report: PR-11 + PR-12

## PR-11: Household Import and Review Flow

### CRITICAL (4)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| C1 | **Partner base-living expense ends at `retirementAge` instead of `lifeExpectancy`** — `createBaseExpense` sets `endAge: retirementAge` (line 367), meaning the partner's essential living costs disappear at retirement. Combined with `retirementSpendingAdjustment: 0` (line 372), post-retirement expenses are zeroed entirely. This produces a household plan where one adult has no living costs after retirement, dramatically understating the FIRE number. | `fromExpenseImport.ts:367,372` | Code Architect, Code Reviewer, Plan Compliance, Codex, Gemini |
| C2 | **`annualCost` fallback reuses `monthlyExpense` — double-counting risk** — When `annualCost` is missing (line 196), the code falls back to `monthlyExpense` but labels it `annualCost`. If the downstream code treats this as an annual value and multiplies by 12 again, the expense is double-counted. The variable naming obscures the magnitude mismatch. | `fromExpenseImport.ts:196` | Code Architect, Code Reviewer, Codex |
| C3 | **Dependent income subtracted from total but never re-added to plan** — Lines 492-495 subtract dependent income streams from the total income figure, but these streams are never added back as entries in the household plan's income array. The income simply vanishes, understating household income. Silent residual clamping via `Math.max(0, ...)` at lines 495-497 masks negative values that would otherwise signal the bug. | `fromExpenseImport.ts:492-497` | Code Architect, Code Reviewer, Gemini |
| C4 | **12 existing tests broken by companion bridge refactoring** — The companion bridge changes in PR-11 break 12 pre-existing tests that relied on the old import/snapshot API surface. These are not new test failures from PR-12's migration — they are test regressions introduced in this PR's own changes. | `useCompanionPlannerBridge.test.ts` | Code Reviewer, Plan Compliance |

### WARNING (4)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| W1 | **`disableLocalStoragePersistence` omits legacy stores** — Only disables persistence for 5 stores but does not cover `useProfileStore`, `useIncomeStore`, `usePropertyStore`, all of which use `persist()` middleware. In companion mode, any code paths that still write to legacy stores would persist companion session data to localStorage, corrupting the user's local plan on return. | `companionBridge.ts:25-31` | Code Architect, Code Reviewer, Plan Compliance, Codex |
| W2 | **Hardcoded `growthRate: 0.03` in expense conversion** — The 3% growth rate is embedded directly in the import function instead of sourced from `lib/data/` or user configuration. Violates the "no hardcoded Singapore-specific values" rule. | `fromExpenseImport.ts:334` | Code Architect, Code Reviewer |
| W3 | **Zod schemas use `.passthrough()`** — `CompanionSnapshotSchema` and related schemas use `.passthrough()`, allowing arbitrary unvalidated fields through. Malformed companion data could silently propagate into the store. | `companion/types.ts` | Code Architect, Plan Compliance |
| W4 | **`fromExpenseImport` is 614 lines with no unit tests** — The most complex data transformation in the import pipeline has zero dedicated test coverage. All the critical bugs above (C1-C3) would be caught by basic round-trip tests. | `fromExpenseImport.ts` | Code Reviewer, Gemini |

### MEDIUM (4)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| M1 | **React key collision in `renderItems`** — Uses string value as key (line 29), which collides when two items have the same display text. Causes React reconciliation bugs (wrong items updated/deleted). | `ImportedPlanReview.tsx:29` | Code Architect, Code Reviewer |
| M2 | **Raw `member.owner` displayed without label mapping** — Line 62 renders the internal owner identifier (e.g., `'self'`, `'partner'`) directly in the UI instead of mapping through `ownerLabel()` or `displayName`. Shows "Primary adult" for self role. | `ImportedPlanReview.tsx:62` | Code Architect, Codex |
| M3 | **`companionBridge.ts` imports 4 Zustand stores in a `lib/` file** — Violates the architecture rule that `lib/` files should be pure functions with no store imports. Cross-store reads should happen in hooks/components, not in lib. | `companionBridge.ts` | Code Architect |
| M4 | **`source` field typed as literal `'expense-import'`** — Only one import source is supported but the type system doesn't accommodate future sources. Minor but creates friction for extending the companion import system. | `companion/types.ts` | Plan Compliance |

---

## PR-12: Retire Legacy Authoring Store Runtime Reads

### CRITICAL (5)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| C1 | **`useCompanionPlannerBridge` not migrated off legacy stores** — The file still imports `useProfileStore`, `useIncomeStore`, `usePropertyStore` at lines 4-6. Reads `profileRevision`/`incomeRevision`/`propertyRevision` at lines 124-126. Snapshots full store via `getState()` at lines 140-142. The working tree has unstaged changes that revert the committed migration, creating dual-sourcing between household and legacy stores. The enforcement test (`legacyAuthoringImports.test.ts`) explicitly fails on this file. | `useCompanionPlannerBridge.ts:4-6,124-126,140-142` | All 5 PR-12 agents |
| C2 | **114 new test failures** — Tests were not updated to reflect the data source migration from legacy stores to household runtime inputs. Verified by running `npm run test`. The enforcement test `legacyAuthoringImports.test.ts` also fails because `useCompanionPlannerBridge.ts` is not in the allowlist. | `multiple test files` | Plan Compliance (verified), Code Reviewer, Codex |
| C3 | **Hardcoded `retirementSum: 213000` replaces dynamic FRS calculation** — Line 70 of `useProjection.ts` replaced the dynamic `getRetirementSumAmount(currentAge)` call with a hardcoded value. The previous code correctly computed Full Retirement Sum based on the user's current age with 3.5% annual BRS/FRS growth. The hardcoded value only applies to one age cohort, producing incorrect LBS proceeds estimates for all other ages. Error grows larger for younger users. | `useProjection.ts:70` | Code Architect, Code Reviewer, Codex |
| C4 | **Missing `prMonths` parameter breaks PR CPF contribution modeling** — The migration dropped `prMonths` from the inline `generateIncomeProjection` call in `useIncomeProjection.ts`. While optional (won't crash), this silently breaks graduated CPF contribution rate modeling for Permanent Residents. Singapore PRs have reduced CPF rates during first two years; without `prMonths`, the projection applies full citizen rates immediately, overstating CPF contributions and understating take-home pay. | `useIncomeProjection.ts` | Code Architect, Code Reviewer, Gemini |
| C5 | **Income stream `endAge` off-by-one between fast path and aggregate path** — The aggregate path in `runtimeLegacyInputs.ts` adds +1 to income stream `endAge` at line 440, but the fast path in `toLegacyIndividual.ts:63` does not. This means the same income stream renders differently depending on which code path executes, creating a 1-year discrepancy in income projection cutoff. | `runtimeLegacyInputs.ts:440`, `toLegacyIndividual.ts:63` | Code Architect, Code Reviewer |

### WARNING (5)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| W1 | **Missing `srsPostFireEnabled` in useMemo dependency array** — `useIncomeProjection.ts` reads `profile.srsPostFireEnabled` inside a `useMemo` but omits it from the dependency array (lines 381-430). Changes to SRS post-FIRE toggle won't trigger recalculation until another dependency changes. | `useIncomeProjection.ts:381-430` | Code Reviewer, Plan Compliance |
| W2 | **Redundant `buildHouseholdRuntimeLegacyInputs` calls — N deep clones per render** — Four hooks (`useFireCalculations`, `useIncomeProjection`, `useProjection`, `useAnalysisPortfolio`) each independently call `buildHouseholdRuntimeLegacyInputs` with their own `useMemo`, causing redundant deep clones. On pages where multiple hooks are active (StressTestPage), this is 4+ complete `structuredClone` operations per render. `useHouseholdRuntimeInputs` hook exists and should be used instead. | `useFireCalculations.ts`, `useIncomeProjection.ts`, `useProjection.ts`, `useAnalysisPortfolio.ts` | Code Architect, Codex, Gemini |
| W3 | **Full-store subscription in `useFireCalculations`** — Line 28 uses `useAllocationStore()` without a selector, subscribing to all allocation store changes. Violates the Zustand selector convention documented in CLAUDE.md. | `useFireCalculations.ts:28` | Code Reviewer, Plan Compliance |
| W4 | **`useDashboardMetrics` uses `profile.lifeExpectancy` instead of normalized** — Reads directly from the profile store while other hooks in the same render tree use `normalized.lifeExpectancy` from `useNormalizedLegacyAnalysisContext`. Creates potential inconsistency in age/timing calculations on the dashboard. | `useDashboardMetrics.ts` | Code Architect |
| W5 | **`annualExpenses` fallback in `runtimeLegacyInputs.ts` may use nominal retirement-year dollars** — Line 354's fallback calculation may produce a value in retirement-year nominal dollars when the consuming hooks expect today's-dollar basis. Potential dollar basis mismatch. | `runtimeLegacyInputs.ts:354` | Code Architect, Gemini |

### MEDIUM (4)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| M1 | **`Math.min(...plan.adults.map(...))` returns `Infinity` on empty array** — Lines 372-374 and 393 compute retirement/life expectancy ages across adults using `Math.min/max` spread. If the adults array is empty, `Math.min()` returns `Infinity` and `Math.max()` returns `-Infinity`, silently corrupting downstream calculations. | `runtimeLegacyInputs.ts:372-374,393` | Code Architect, Code Reviewer |
| M2 | **Manual spread override in `buildProjectionParams` call** — `useFireCalculations.ts` lines 44-49 manually spread overrides into `buildProjectionParams` instead of using the canonical hook pattern. Violates the "no duplicate parameter construction" rule. | `useFireCalculations.ts:44-49` | Plan Compliance |
| M3 | **`disableLocalStoragePersistence` incomplete coverage** — Same finding as PR-11 W1, but additionally relevant for PR-12 because the migration to household stores makes legacy store persistence even more dangerous — stale data persists but is never refreshed. | `companionBridge.ts:25-31` | Code Reviewer, Codex |
| M4 | **`companionBridge.ts` uses `as any` with eslint-disable** — Should use correct `PersistStorage<unknown>` type instead of casting. Repeated from Batch 1 finding, still unfixed. | `companionBridge.ts:40,46` | Gemini |

---

## Cross-PR Findings

### Recurring Issues Across Batches

| Finding | First Seen | Still Present |
|---------|-----------|---------------|
| `useCompanionPlannerBridge` imports legacy stores | Batch 1 (PR-6 C3) | Yes — PR-12 was supposed to fix this but working tree reverts the migration |
| `disableLocalStoragePersistence` omits legacy stores | Batch 1 (PR-6 M4) | Yes — unfixed across 4 PRs |
| `companionBridge.ts` uses `as any` | Batch 1 (PR-6 M6) | Yes — unfixed |
| `legacyAuthoringImports.test.ts` fails | Batch 2 (PR-8a C2) | Yes — enforcement test still failing |

### Agent Agreement Matrix

High-confidence findings are those flagged by 3+ agents independently:

| Finding | Agent Count | Confidence |
|---------|------------|------------|
| useCompanionPlannerBridge incomplete migration | 5/5 PR-12 agents | Unanimous |
| Partner expense endAge = retirementAge | 5/5 PR-11 agents | Unanimous |
| disableLocalStoragePersistence incomplete | 4/5 PR-11 agents | Very High |
| Hardcoded 213000 FRS value | 3/5 PR-12 agents | High |
| Missing prMonths parameter | 3/5 PR-12 agents | High |
| 114 test failures | 3/5 PR-12 agents | High |
| annualCost double-counting risk | 3/5 PR-11 agents | High |
| Dependent income subtracted not re-added | 3/5 PR-11 agents | High |
| Redundant buildHouseholdRuntimeLegacyInputs | 3/5 PR-12 agents | High |
| endAge off-by-one fast vs aggregate path | 2/5 PR-12 agents | Moderate |

---

## Summary Statistics

| Metric | PR-11 | PR-12 | Total |
|--------|-------|-------|-------|
| Critical | 4 | 5 | 9 |
| Warning | 4 | 5 | 9 |
| Medium | 4 | 4 | 8 |
| Low | 0 | 0 | 0 |
| **Total** | **12** | **14** | **26** |

### Recommended Fix Priority

**Immediate (blocks merge):**
1. Fix `useCompanionPlannerBridge` — complete the legacy store migration (PR-12 C1)
2. Fix 114 test failures — update tests for new data sources (PR-12 C2)
3. Fix `retirementSum` hardcode — restore dynamic `getRetirementSumAmount(currentAge)` (PR-12 C3)
4. Fix `prMonths` parameter — restore in inline `generateIncomeProjection` call (PR-12 C4)
5. Fix `createBaseExpense` — use `lifeExpectancy` not `retirementAge` for endAge, fix `retirementSpendingAdjustment` (PR-11 C1)
6. Fix `annualCost` fallback — ensure correct magnitude when monthly→annual conversion needed (PR-11 C2)
7. Fix dependent income — re-add subtracted income streams to plan (PR-11 C3)
8. Fix 12 broken companion bridge tests (PR-11 C4)

**Before ship (high impact):**
9. Fix `endAge` off-by-one between fast/aggregate paths (PR-12 C5)
10. Add `srsPostFireEnabled` to useMemo deps (PR-12 W1)
11. Consolidate `buildHouseholdRuntimeLegacyInputs` calls to use `useHouseholdRuntimeInputs` (PR-12 W2)
12. Extend `disableLocalStoragePersistence` to cover legacy stores (PR-11 W1 / PR-12 M3)
13. Add unit tests for `fromExpenseImport.ts` (PR-11 W4)

**Nice to have:**
14. Fix React key collision in ImportedPlanReview (PR-11 M1)
15. Replace raw `member.owner` with display name (PR-11 M2)
16. Fix full-store subscription in useFireCalculations (PR-12 W3)
17. Guard against empty adults array in Math.min/max (PR-12 M1)
