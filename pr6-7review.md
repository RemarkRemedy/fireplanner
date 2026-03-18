# Deep Code Review: PR-6 + PR-7 — Consolidated Findings

## Methodology
5 parallel review agents analyzed 24 changed files across both PRs:
- **Agent 1** (Code Architect): Architecture, conventions, file organization
- **Agent 2** (Code Reviewer): Correctness, types, null safety, race conditions
- **Agent 3** (Plan Compliance): CLAUDE.md rule violations
- **Agent 4** (Codex): Bugs, logic errors, data integrity
- **Agent 5** (Gemini): Cross-file interactions, subtle logic flaws, edge cases

---

## CRITICAL (5 findings)

### C1. Data Loss Risk: Legacy stores override existing household plan on bootstrap
**File:** `frontend/src/lib/storeRegistry.ts:331-350`
**Agents:** Codex, Gemini (high confidence)

`buildPortableStoresFromStoreValues` checks for legacy authoring stores *first*. If stale `fireplanner-profile` / `fireplanner-income` / `fireplanner-property` keys remain in localStorage alongside a valid `fireplanner-household-plan-v1`, the legacy snapshot takes priority and **overwrites the real household plan** with a reconstructed single-adult plan. This affects `bootstrapPortabilityStores()` (runs on every page load), `buildPortabilityEnvelope()` (used by export/share/scenario save), and `resolvePortabilityData()`.

**Impact:** A user who transitions from individual to couple/household planning but still has stale legacy keys will silently lose their household plan on next page load.

**Fix:** Check for `HOUSEHOLD_PLAN_STORAGE_KEY` first; only fall back to legacy reconstruction when no household plan exists.

---

### C2. Import applies invalid data then immediately reloads
**File:** `frontend/src/lib/exportImport.ts:78,86-87`
**Agents:** Code Reviewer, Codex

`applyResolvedPortabilityData(resolved)` writes to localStorage at line 78 *before* checking validation errors. Then `window.location.reload()` fires at line 87 regardless of validation results. The user's existing valid data is overwritten with potentially invalid imported data, and the warning toast from `Sidebar.tsx` is never visible because the page reloads immediately.

**Fix:** Gate the apply+reload on `Object.keys(result.validationErrors).length === 0`, or at minimum skip the reload when errors exist so the toast is visible.

---

### C3. Store-to-store import: `useUIStore` imports from `useProfileStore`
**File:** `frontend/src/stores/useUIStore.ts:5`
**Agents:** Code Architect, Plan Compliance, Code Reviewer

```ts
import { DEFAULT_HEALTHCARE_CONFIG } from '@/stores/useProfileStore'
```

CLAUDE.md explicitly prohibits store-to-store imports. `DEFAULT_HEALTHCARE_CONFIG` is a constant that should live in `lib/data/` or `lib/types.ts`. This creates a module dependency between two store files and a potential circular import risk.

---

### C4. `isRecord()` in `scenarios.ts` doesn't exclude arrays
**File:** `frontend/src/lib/scenarios.ts:42-44`
**Agents:** Code Architect, Code Reviewer, Plan Compliance

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' // Arrays pass!
}
```

The `storeRegistry.ts` version correctly has `&& !Array.isArray(value)`. This divergence means malformed localStorage data (an array where a record is expected) could pass `isScenarioSnapshot` validation, potentially causing downstream failures.

---

### C5. Partner adult inherits template income without reset
**File:** `frontend/src/components/household/HouseholdSetupWizard.tsx:29-49`
**Agent:** Codex

`buildPartnerAdult` clones the template adult and resets `annualExpenses` and `liquidNetWorth` to 0, but **never clears `annualIncome`**. The partner inherits the primary adult's default income (e.g., $72,000) before the user enters any partner salary, immediately skewing household-derived calculations.

---

## WARNING (8 findings)

### W1. Stale `selfAdult` reference used to build partner
**File:** `frontend/src/components/household/HouseholdSetupWizard.tsx:81-101`
**Agents:** Code Reviewer, Gemini, Code Architect

`selfAdult` is captured at line 82, then `updateAdult()` runs at line 85 modifying the self adult in the store. The `buildPartnerAdult(selfAdult, ...)` call at line 101 uses the pre-update snapshot. The partner's `taxProfile.reliefBasisAge` and `healthcare.oopReferenceAge` are derived from the stale template age, not the user's actual age.

---

### W2. Full-store subscriptions in `StartPage.tsx`
**File:** `frontend/src/pages/StartPage.tsx:56-57`
**Agents:** Code Architect, Plan Compliance, Code Reviewer

```ts
const profileStore = useProfileStore()
const incomeStore = useIncomeStore()
```

CLAUDE.md requires selector functions. Since this file is touched in PR-7, it should be migrated now. The `incomeStore` is only used for `.setField()` calls and should use `useIncomeStore.getState()` inside handlers instead.

---

### W3. Store key lists duplicated in 3 files
**Files:** `storeRegistry.ts:30-50`, `migrationDetector.ts:7-21`, `companionBootstrap.ts:7-16`
**Agents:** Code Architect, Plan Compliance, Code Reviewer

Both `migrationDetector.ts` and `companionBootstrap.ts` cannot import from `storeRegistry.ts` (would trigger store creation). But without a shared `lib/storeKeys.ts` constants file, adding a new store requires updating 3 files manually. Easy to forget one.

---

### W4. Duplicated `createId` function
**Files:** `HouseholdSetupWizard.tsx:21-27`, `useHouseholdPlanStore.ts:101-107`
**Agents:** Code Architect, Plan Compliance, Code Reviewer

Byte-for-byte identical implementations. Should be extracted to `lib/household/ids.ts` per CLAUDE.md (pure functions in `lib/`).

---

### W5. `loadScenario` doesn't pass `rehydrate: true` to registry
**File:** `frontend/src/lib/scenarios.ts:143-159`
**Agents:** Code Architect, Code Reviewer, Gemini

`applyResolvedPortabilityData(resolved)` is called without `{ rehydrate: true }`. The scenario load path relies entirely on the caller-supplied `rehydrate()` callback from `ScenarioManager`. If `loadScenario` is ever called without the callback (it's optional), stores are written to localStorage but not rehydrated: the UI stays stale until page reload.

---

### W6. `PlannerRouteShell` effect fires on every plan change
**File:** `frontend/src/router.tsx:47-56`
**Agents:** Code Architect, Gemini

The `plan` selector returns the whole `HouseholdPlan` object, which is cloned via `structuredClone` on every store update. This triggers `ensureHouseholdDataVisible(plan)` on every keystroke. While idempotent, it causes unnecessary render cycles. Should use a derived selector computing the three boolean flags directly.

---

### W7. Dependent age shows `0` in UI but stores `null`
**File:** `frontend/src/components/household/PeopleRosterEditor.tsx:176`
**Agents:** Codex, Code Architect

```tsx
value={dependent.currentAge === '' ? 0 : dependent.currentAge}
```

An untouched dependent shows "0" (newborn), but `HouseholdSetupWizard.tsx:111` stores `null` for the empty state. The UI displays "newborn"; the stored plan says "unknown age." Semantic mismatch.

---

### W8. CPF toggle in wizard is ineffective for citizens/PRs
**File:** `HouseholdSetupWizard.tsx:118` + `useUIStore.ts:45-57,132-139`
**Agent:** Codex

The wizard lets users toggle CPF off (line 118), but `ensureHouseholdDataVisible` (called at line 123) immediately forces `cpfEnabled` back on because `hasCpfPlanningData` returns `true` for any non-foreigner adult (they have `residencyStatus !== 'foreigner'` by default). The CPF switch is cosmetically present but functionally dead for the common case.

---

## INFO (5 findings)

### I1. `shareUrl.ts` double-resolves portability data
`decodeStoresFromUrl` calls `resolvePortabilityData` internally, then `applyStoreData` calls it again on the result. Harmless but redundant.

### I2. `storeRegistry.ts` v1 and v2 envelope handling is identical
Lines 453-459 treat both versions identically. The actual v1 to v2 conversion happens downstream in `buildPortableStoresFromStoreValues`. The separate branches are dead code: could be collapsed.

### I3. `featureFlag.ts` reads localStorage on every render
`isHouseholdPlannerV1Enabled()` is called from Sidebar, router, and StartPage on every render. Fine for correctness, but a future optimization candidate.

### I4. `exportExcel.ts` reads stores directly in a `lib/` function
Lines 41-43 and 307-309 call `.getState()` on stores inside a `lib/` file. Pre-existing pattern preserved by PR-6.

### I5. `ScenarioManager.tsx` uses raw `<input>` instead of shadcn `<Input>`
Line 101-110 uses a raw `<input type="text">` instead of the themed `@/components/ui/input` component, inconsistent with `PeopleRosterEditor`.

---

## Summary

| Severity | Count | Top Issues |
|----------|-------|------------|
| **CRITICAL** | 5 | Legacy data priority inversion (data loss), import applies invalid data, store-to-store import, `isRecord` array bug, partner income not reset |
| **WARNING** | 8 | Stale state in wizard, full-store subscriptions, duplicated code/keys, scenario rehydration gap, effect performance, UI/storage age mismatch, dead CPF toggle |
| **INFO** | 5 | Double-resolve, dead code branches, localStorage reads, store access patterns, UI component consistency |
