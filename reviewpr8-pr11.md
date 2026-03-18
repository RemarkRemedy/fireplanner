# Consolidated Deep Review: PRs 8a-11

**30 agents completed** (18 Claude agents + 6 Codex + 6 Gemini). Findings deduplicated by root cause.

**Review date:** 2026-03-08
**Branch:** `codex/pr-11-household-import-review`
**Commits reviewed:** `3ed7a60..a8ac885` (15 commits across 6 PRs)

## PR Scope

- **PR-8a** (3 commits): CPF adapter + editor shell + save indicator -- 7 files
- **PR-8b** (2 commits): People/income/spending editors -- 6 files
- **PR-8c** (2 commits): Assets/property/assumptions editors -- 4 files
- **PR-9** (2 commits): Analysis overview/breakdown UI -- 7 files
- **PR-10** (2 commits): Scenario lab -- 3 files
- **PR-11** (2 commits): Import/review flow -- 7 files

---

## CRITICAL (13 unique findings)

### C1. Multi-year duration ghost field (PR-8b)

**File:** `SpendingGoalsSection.tsx:621-732`
**Found by:** Codex, Gemini

`durationYears` is updated but `timing.endAge` is never expanded. The compiler schedules withdrawals/goals from the timing window (`startAge` to `endAge`), not from `durationYears`. Result: a 4-year goal still fires for one year, but only `amount / 4` is deducted; multi-year retirement withdrawals also collapse to a single year.

### C2. Missing object spreads in `updateAssumptions` (PR-8c)

**File:** `AssumptionsSection.tsx:117-248`
**Found by:** Gemini

Multiple calls to `updateAssumptions` for the `fire` and `returns` sub-objects are missing object spreads. Updating `fireType` (line 117) or `usePortfolioReturn` (line 150) will wipe out `swr`, `expectedReturn`, `inflation`, etc., because they are not spread into the update object. This is inconsistent with the correct spread used for `retirementMitigation` (line 273).

### C3. Solo import planType bug (PR-11)

**File:** `fromExpenseImport.ts:508`
**Found by:** All 5 agents

```typescript
plan.planType = hasPartner ? (hasDependents ? 'household' : 'couple') : 'household'
```

`'individual'` is unreachable. A solo import (no partner, no dependents) gets `planType='household'`, triggering multi-adult UI. No test covers this branch.

**Fix:**
```typescript
plan.planType = hasPartner
  ? (hasDependents ? 'household' : 'couple')
  : (hasDependents ? 'household' : 'individual')
```

### C4. Partner removal orphans data (PR-8b)

**File:** `PeopleSection.tsx:156`
**Found by:** Codex, Gemini, Code Reviewer

`removeAdult` cleans entries by `owner` but not by `timing.owner`. Any `shared` or `self` row still anchored to `partner` survives in an invalid state and will validate/compile incorrectly.

### C5. Income streams show all adults (PR-8b)

**File:** `IncomeSection.tsx:528-533`
**Found by:** Code Reviewer, Code Architect

The Income Streams card filters by `kind === 'income-stream'` only, not by owner. In a couple plan, the partner's streams appear in the self tab and vice versa, without any filtering. The adjacent `selectedAdultStreams` memo correctly filters by `timing.owner`, but that memo is only used for the "Affected income streams" cross-reference inside life events, not for the main stream list.

### C6. Property costs for unowned properties (PR-9)

**File:** `HouseholdBreakdownPanel.tsx:68-86`
**Found by:** Codex, Gemini, Code Reviewer

`existingMonthlyPayment * 12` counted for every property regardless of `ownsProperty` flag. Future purchases and paid-off mortgages inflate "Costs today".

**Fix:** Gate on `property.ownsProperty`:
```typescript
if (!property || property.owner !== owner || !property.ownsProperty) return sum
```

### C7. Full `useProfileStore()` subscription (PR-8a)

**File:** `useCompanionPlannerBridge.ts:129`
**Found by:** Code Architect

Full-store subscription causes the hook to re-render on every profile field change, not just the 4 fields subsequently destructured from it. The four fields read (`annualIncome`, `annualExpenses`, `inflation`, `expenseRatio`) must each become individual selector calls.

### C8. Four full-store subscriptions in `useSectionCompletion` (PR-8a/8c)

**File:** `useSectionCompletion.ts:350-353`
**Found by:** 4 agents

```typescript
const profile = useProfileStore()
const income = useIncomeStore()
const allocation = useAllocationStore()
const property = usePropertyStore()
```

All without selectors, causing InputsPage + DashboardPage to re-render on every keystroke across any store field. In household mode, three of these stores are not even used (dead code subscriptions).

### C9. Full `useAllocationStore()` subscription (PR-8c)

**File:** `AssumptionsSection.tsx:38`
**Found by:** 4 agents

```typescript
const allocation = useAllocationStore()
```

Full-store subscription on the allocation store. Any change to allocation weights or return overrides re-renders the entire `AssumptionsSection`.

### C10. `getState()` bypassing React reactivity (PR-8b)

**File:** `SpendingGoalsSection.tsx:170-177`
**Found by:** Code Architect, Gemini

```typescript
function updateExpenseList(expenseId: string, updates: Partial<ExpenseItem>) {
  useHouseholdPlanStore.getState().updateExpense(expenseId, updates)
}
```

Module-level functions bypass Zustand's subscription mechanism. The store action is called but React never schedules a re-render for the component that owns the rendered list. Users will edit an expense label or amount and see the field revert until some other state change triggers a re-render.

### C11. Retirement age scenarios don't extend income (PR-10)

**File:** `scenarios.ts:220-327`
**Found by:** Codex

The built-ins and custom builder only overwrite `adult.retirementAge`, not the primary salary timing window's `endAge`. The compiler uses the salary `endAge` as the effective retirement age for income projection. Result: "retires later" can move milestones and spending adjustments without extending earned income, so scenario deltas can be materially wrong.

### C12. Income residual doesn't subtract dependent income (PR-11)

**File:** `fromExpenseImport.ts:377`
**Found by:** Gemini

`residualAnnualIncome` only subtracts `partnerAnnualIncome` from the total. If an imported dependent (e.g., a working parent) has `annualIncome` defined in their member record, it is not subtracted from the total, resulting in that income being double-counted on the primary adult (`self`).

### C13. `disableLocalStoragePersistence` never re-enabled (PR-11)

**File:** `companionBridge.ts:40`
**Found by:** Gemini

`disableLocalStoragePersistence` globally mutates Zustand stores to use a no-op storage. This is called during the snapshot import but is never re-enabled. Even though the `LOCAL_EDITABILITY_NOTE` tells users they can "keep planning here," any edits they make will be lost on page refresh because `localStorage` remains disabled for the remainder of the session.

---

## WARNING (22 unique findings)

### W1. `createId` duplicated 7 times (All PRs)

**Files:** `PeopleSection.tsx:24`, `IncomeSection.tsx:44`, `SpendingGoalsSection.tsx:26`, `AssetsPropertySection.tsx:29`, `HouseholdSetupWizard.tsx:21`, `fromExpenseImport.ts:73`, `useHouseholdPlanStore.ts:101`
**Found by:** 4 agents

Identical `createId(prefix)` function (crypto.randomUUID with Date.now fallback) duplicated across 7 files. Pure function belongs in `lib/household/utils.ts`.

### W2. `ownerLabel`, `getSelectedAdult`, `ensureAgeRangeTiming` duplicated (PR-8b/8c)

**Files:** `IncomeSection.tsx`, `PeopleSection.tsx`, `SpendingGoalsSection.tsx`, `AssetsPropertySection.tsx`
**Found by:** 3 agents

Three pure helper functions copy-pasted across 3-4 component files. `ensureAgeRangeTiming` has slight signature variation between files. All should be extracted to a shared `lib/household/editorUtils.ts`.

### W3. Raw `<Input type="number">` for dependent fields (PR-8b)

**File:** `PeopleSection.tsx:471-496`
**Found by:** 4 agents

Dependent "Current Age" and "Annual Cost" use raw `<Input type="number">` instead of `<NumberInput>` and `<CurrencyInput>`. CLAUDE.md mandates shared input wrappers for cursor-jump prevention, comma formatting, and validation error display.

### W4. Raw `<Input type="number">` in Scenario Lab (PR-10)

**File:** `ScenarioLab.tsx:198-235`
**Found by:** 4 agents

Four custom scenario fields (expected return, retirement ages, expense delta) use raw `<Input type="number">` instead of `<NumberInput>`/`<PercentInput>`.

### W5. `clampRetirementAge` allows equality (PR-10)

**File:** `scenarios.ts:74-76`
**Found by:** 4 agents

```typescript
return Math.max(adult.currentAge, Math.min(adult.lifeExpectancy - 1, Math.round(retirementAge)))
```

Lower bound is `adult.currentAge`, allowing `retirementAge === currentAge`. Project validation requires `retirementAge > currentAge`.

**Fix:** `Math.max(adult.currentAge + 1, ...)`

### W6. Local `formatPercent` shadows shared utility (PR-10)

**File:** `ScenarioLab.tsx:25-27`
**Found by:** 3 agents

Local `formatPercent` defined instead of importing from `@/lib/utils`. Hardcodes 1 decimal place vs the canonical 2-decimal default.

### W7. Hardcoded `errorCount: 0` for household CPF (PR-8a)

**File:** `useSectionCompletion.ts:320`
**Found by:** Codex, Gemini, Code Reviewer

Household CPF section always reports zero validation errors. CPF validation errors from the adapter are invisible in section completion status, dashboard prompts, and the progress bar.

### W8. CPF rate comparison uses wrong defaults (PR-8a)

**File:** `useSectionCompletion.ts:221`
**Found by:** Gemini

`cpfCustomized` compares `cpfisOaReturn` and `cpfisSaReturn` against `0.04` and `0.05`. If the store defaults are the standard rates (2.5% / 4%), this comparison will always be true, causing the CPF section to show as "customized" even on a blank plan.

### W9. `syncAdultLiquidNetWorths` ignores shared assets (PR-8c)

**File:** `AssetsPropertySection.tsx:112-134`
**Found by:** Codex, Gemini, Code Architect

```typescript
.filter((asset) => asset.kind === 'liquid-net-worth' && asset.owner === adult.owner)
```

Assets marked `'shared'` are excluded from both adults' `liquidNetWorth`. Shared liquid balances vanish from the portfolio math.

### W10. Locked asset conversion doesn't persist `unlockAge` (PR-8c)

**File:** `AssetsPropertySection.tsx:229-279`
**Found by:** Codex

Changing an existing liquid row to `locked-asset` only updates `kind`. The UI shows fallback values (`45`, `0%`), but they are not persisted. The compiler skips locked assets with no `unlockAge`.

### W11. Base living cost defaults to end at retirement (PR-8b)

**File:** `SpendingGoalsSection.tsx:118`
**Found by:** Gemini

`createExpense` default for `base-living` sets `endAge: retirementAge`. This deviates from the legacy planner's behavior where base expenses continue through life (adjusted by the retirement multiplier). Without manual intervention, a household plan will show zero expenses post-retirement.

### W12. Companion action impacts stored per-page, not per-scenario (PR-9)

**File:** `StressTestPage.tsx:628-984`
**Found by:** Codex

If the user runs scenario A, then switches to previously-run scenario B, the headline metrics swap to B via `activeRow`, but `actionImpacts` and the stress-comparison payload still belong to the last run. The page shows recommendations for the wrong scenario.

### W13. Timeout path sets partial results + error, but error hides results (PR-9)

**File:** `StressTestPage.tsx:797`
**Found by:** Codex

The timeout path sets both partial `actionImpacts` and an error string, but the summary renders the error branch instead of the returned rows whenever `error` is non-null. The UI can say "Showing 1/3 results" while hiding those results entirely.

### W14. No null guard on `adultsById`/`dependentsById` lookups (PR-9)

**File:** `HouseholdOverviewBar.tsx:100-112`
**Found by:** Code Reviewer (x2)

`compiledPlan.adultsById[adultId]` accessed without null guard. If the compiled plan has inconsistent state, `adult.displayName` throws a runtime exception. `HouseholdMilestoneTimeline.tsx` has a guard (`if (!adult)`), but `HouseholdOverviewBar` does not.

### W15. Case-sensitive role matching in import (PR-11)

**File:** `fromExpenseImport.ts:123-143`
**Found by:** Codex

Member parsing only auto-classifies dependents when the normalized relationship is lowercase `child` or `parent`. Case variants like `Child` / `Partner` fall through to positional inference.

### W16. Fallback role inference uses raw array index (PR-11)

**File:** `fromExpenseImport.ts:169`
**Found by:** Codex

Fallback role inference uses the raw array index before invalid rows are filtered out. If an earlier row is `null` or malformed, the first valid adult can arrive with `index === 1` and be inferred as `partner` instead of `self`.

### W17. `companionMode` memoized with empty deps (PR-11)

**File:** `useCompanionPlannerBridge.ts:114`
**Found by:** Gemini

`companionMode` is memoized with an empty dependency array `[]`. If a user navigates from a companion URL (`?companion=1`) to a standard URL within the same SPA session, the hook will remain in companion mode until a full page reload.

### W18. No dedicated unit tests for `fromExpenseImport` (PR-11)

**Found by:** 3 agents

The function is 150+ lines with multiple code paths but is only tested indirectly through integration tests. A dedicated `__tests__/fromExpenseImport.test.ts` would cover: solo import, partner-only, dependent-only, missing fields, negative residuals, case-sensitive roles.

### W19. `createPartnerAdult` clones self's income data (PR-8b)

**File:** `PeopleSection.tsx:45`
**Found by:** Gemini

`structuredClone(referenceAdult)` clones Taylor's `annualIncome` into the partner's adult object, but no corresponding `salary-model` is created in `plan.income`. The partner appears to have Taylor's income in the UI but the projection engine sees no income model.

### W20. SG-specific property defaults hardcoded in component (PR-8c)

**File:** `AssetsPropertySection.tsx:67-111`
**Found by:** Code Architect

`createProperty()` encodes SG-specific defaults (LTV 0.75, HDB lease 99yr, purchase price 850K) directly in the component file. CLAUDE.md requires these values in `lib/data/`.

### W21. `updateCpf` callbacks not memoized (PR-8a)

**File:** `useHouseholdCpfAdapter.ts:264`
**Found by:** Code Architect, Code Reviewer

`updateCpf` and all returned callback functions are recreated on every render. The `CpfSectionModel` returned by the hook has new object identity on every render, defeating any `React.memo` wrapping on `CpfSectionBody`.

### W22. Hardcoded "two years" label but clamp may produce less (PR-10)

**File:** `scenarios.ts:224,238`
**Found by:** Codex, Gemini

The descriptions say "Delay... by two years" but `clampRetirementAge` will limit this if the adult is within 1 year of `lifeExpectancy`. Users may see "two year" label while the math only moves by 0-1 years.

---

## INFO (12 notable items)

| # | PR | Issue |
|---|-----|-------|
| I1 | 9 | `DeltaDisplay` in `CompanionResultsSummary.tsx:251-264` duplicates shared `DeltaBadge` component |
| I2 | 9 | `HouseholdBreakdownPanel.tsx:26-95` has 10 pure functions colocated in `.tsx` -- should move to `lib/household/` |
| I3 | 9 | `ownerLabel()` called twice per milestone render in `HouseholdMilestoneTimeline.tsx:103-105` |
| I4 | 10 | `endTimingImmediately` produces past-dated timing window `[currentAge-1, currentAge-1]` -- fragile implicit contract with timing resolver |
| I5 | 10 | Missing tests for single-adult plan, already-retired adult, null custom scenario return path |
| I6 | 8a | Developer-facing PR references ("PR8A adapter seam") in user-visible UI text (`InputsPage.tsx:826`) |
| I7 | 11 | `ImportedPlanReview.tsx:41` uses `toLocaleString()` without locale argument |
| I8 | 8c | `cashReserve` mode toggles fire even when section is disabled -- state changes but nothing is visible |
| I9 | 8c | Shared property defaults to `ownershipPercent: 1` (100%) for a `'shared'` owner -- misleading for couples |
| I10 | 9 | Per-owner "Costs today" uses `annualizeExpense(expense.amount)` but household-level "Costs today" uses compiler's `retirementExpenseBase` -- values won't reconcile for plans with growth rates |
| I11 | 8b | `upsertSalaryModel` in `IncomeSection.tsx:205-230` captures stale `salaryModel` from render closure -- risk on rapid edits |
| I12 | All | Plan compliance is strong across all 6 PRs -- file scope matches plan exactly, all acceptance criteria met |

---

## Cross-PR Pattern Summary

| Pattern | Occurrences | Impact |
|---------|------------|--------|
| Full-store Zustand subscriptions | 6 locations across 4 files | Performance: unnecessary re-renders on every keystroke |
| Duplicated utility functions | 5 functions x 3-7 copies each | Maintenance: divergence risk, violates `lib/` convention |
| Raw `<Input type="number">` | 6 fields across 2 files | UX: missing cursor-jump prevention, formatting, validation display |
| Missing null guards on map lookups | 3 locations | Stability: runtime crash on inconsistent compiled plan state |

---

## Recommended Fix Priority

1. **C1-C3** (highest impact bugs): duration ghost field, assumptions wipe, solo planType
2. **C4-C6** (data integrity): partner removal orphans, stream cross-exposure, property cost inflation
3. **C7-C10** (performance/reactivity): full-store subscriptions, getState() bypass
4. **C11-C13** (scenario/import correctness): income extension, residual double-count, persistence lockout
5. **W1-W2** (code quality): extract shared utilities to reduce 30+ lines of duplication
6. **W3-W6** (convention compliance): shared input wrappers, formatPercent, clamp fix
