# Batch 2 Final Report: PR-8a + PR-8b + PR-8c

## PR-8a: Household CPF Adapter and Editor Shell

### CRITICAL (2)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| C1 | **Rules of Hooks violation** — `useCallback`/`useMemo` called after conditional `return null`. Six hooks execute after early return at line 260, violating React's hook ordering invariant. Will crash when `selectedAdult` transitions null→non-null. ESLint confirms 6 `react-hooks/rules-of-hooks` errors. | `useHouseholdCpfAdapter.ts:260-399` | Code Reviewer (100%), Code Architect, Plan Compliance |
| C2 | **Two tests fail** — (a) test asserts "Household editor note" text that doesn't exist in any component (stale assertion); (b) `legacyAuthoringImports.test.ts` fails because `useCompanionPlannerBridge.ts` still imports legacy stores | `HouseholdCpfAdapter.test.tsx:263`, `useCompanionPlannerBridge.ts:4-6` | Code Reviewer (97%), Plan Compliance |

### WARNING (5)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| W1 | **Duplicate CPF validation snapshot** — identical 30+ field `PlanningAdult → ProfileState` mapping in both `useHouseholdCpfAdapter` and `useSectionCompletion`. Violates "no duplicate param construction" rule. | `useHouseholdCpfAdapter.ts:110-197`, `useSectionCompletion.ts:111-188` | Code Architect, Plan Compliance |
| W2 | **Hook in wrong directory** — `useHouseholdCpfAdapter` is a React hook living in `components/household/adapters/` instead of `hooks/`. Pure helpers should be in `lib/`. | `useHouseholdCpfAdapter.ts` | Code Architect |
| W3 | **Companion bridge reads legacy stores** — builds scenario inputs from `profile`/`income`/`property` stores while simulation now uses household runtime inputs. Editing household forms changes simulation without updating companion. | `useCompanionPlannerBridge.ts:124` | Codex |
| W4 | **Section completion unreliable for new plans** — seeded legacy rows make untouched plans appear "meaningfully configured", making progress bar and dashboard nudges misleading. | `useSectionCompletion.ts:74,90,219` | Codex |
| W5 | **`compileHouseholdPlan` in `useMemo`** — full plan compilation (income, healthcare, CPF projections) runs on every plan change including unrelated fields like display name changes. | `useHouseholdCpfAdapter.ts:216` | Plan Compliance |

### MEDIUM (4)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| M1 | **Wrong CPF constant** — `SA_INTEREST_RATE` used for RA growth factor; should be `RA_INTEREST_RATE` (same value today, but semantically distinct and may diverge) | `CpfSection.tsx:104` | Code Reviewer (82%) |
| M2 | **CPF LIFE payout rate labels hardcoded** — `~5.4%`, `~6.3%`, `~4.8%` appear 6 times in component instead of `lib/data/cpfRates.ts` | `CpfSection.tsx:90-94,217-219,547-549` | Code Architect |
| M3 | **Healthcare errorCount hardcoded to 0** — `useSectionCompletion` always reports zero healthcare errors | `useSectionCompletion.ts:314` | Codex |
| M4 | **Tests mutate wrong stores** — `useSectionCompletion.test.ts` mutates legacy stores the hook no longer reads | `useSectionCompletion.test.ts:35-88` | Code Reviewer (83%), Plan Compliance |

---

## PR-8b: Household People, Income, and Spending Editors

### CRITICAL (3)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| C1 | **Partner clone copies all financial data** — `structuredClone(referenceAdult)` only overrides a few fields, copying liquid net worth, CPF balances, SRS state, healthcare config — immediately doubles household assets | `PeopleSection.tsx:26` | Codex |
| C2 | **Partner toggle doesn't update `planType`** — adding a second adult via toggle leaves `planType` as `'individual'`. Other screens branch on `planType`, treating the plan incorrectly. | `PeopleSection.tsx:134,141` | Codex |
| C3 | **`removeAdult` deletes private entries with no migration path** — all income/expense/goal/asset/property entries owned by the removed adult are deleted permanently. Only the `owner: 'shared'` timing-reanchor path is tested. | `useHouseholdPlanStore.ts:293` | Code Reviewer |

### WARNING (2)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| W1 | **`removeAdult` doesn't recompute `liquidNetWorth`** — only `AssetsPropertySection` calls `syncAdultLiquidNetWorths`, so removing a partner leaves shared liquid assets misallocated until user touches assets screen | `useHouseholdPlanStore.ts:292` | Codex |
| W2 | **`syncTimingDuration` corrupts ongoing entries** — treats `endAge: null` (ongoing) as 1-year duration. First user interaction writes `endAge = startAge`, silently converting ongoing to fixed-duration. | `editorUtils.ts:60` | Code Reviewer |

### MEDIUM (4)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| M1 | **Module-level `getState()` in SpendingGoalsSection** — `updateExpenseList`/`updateGoalList` bypass selector pattern used by all other editors | `SpendingGoalsSection.tsx:137-148` | Code Architect, Code Reviewer, Plan Compliance |
| M2 | **`NullableNumberInput` duplicates `NumberInput`** — uses inferior `useEffect` sync pattern instead of render-time sync; missing `formatWithCommas` support | `NullableNumberInput.tsx:44-49` | Code Architect |
| M3 | **Goal age bounds use wrong adult** — timing owner is editable but numeric limits use `selectedAdult` instead of the row's actual timing owner | `SpendingGoalsSection.tsx:603,733` | Codex |
| M4 | **Income-timing sync belongs in store** — `syncAdultIncomeTiming` in `PeopleSection` only fires through `updateAdultProfile`; other callers of `updateAdult` silently skip sync | `PeopleSection.tsx:102-117` | Code Architect |

---

## PR-8c: Household Assets, Property, and Assumptions Editors

### CRITICAL (1)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| C1 | **`syncAdultLiquidNetWorths` type-unsafe and reads stale state** — (a) parameter typed `Record<string, unknown>` bypassing `Partial<PlanningAdult>` type checking; (b) reads `adultCount` from render closure while reading assets from `getState()`, creating asymmetric state reads; (c) should be moved into store actions for atomicity | `AssetsPropertySection.tsx:41-60,85-89` | Code Reviewer (90%+88%), Code Architect, Plan Compliance |

### WARNING (3)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| W1 | **Hardcoded Singapore regulatory values** — LTV `0.75` (MAS ceiling), `leaseYears: 99`, `mortgageRate: 0.03`, `hdbSublettingRate: 900` all hardcoded instead of sourced from `lib/data/` | `assetPropertyDefaults.ts:68-105` | Code Reviewer (85%), Code Architect, Plan Compliance |
| W2 | **Property defaults diverge from legacy without documentation** — `existingApplyBalaDecay: false` vs legacy `true`, `propertyType: 'hdb'` vs `'condo'`, multiple price/rate differences with no comment explaining rationale | `assetPropertyDefaults.ts:62-106` | Plan Compliance |
| W3 | **Inline magic numbers for retirement cash bucket** — `targetMonths: 24` and `cashReturn: 0.02` hardcoded in toggle handler; same values appear in 3+ test files | `AssumptionsSection.tsx:405-410` | Code Architect |

### MEDIUM (3)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| M1 | **Default `ownershipPercent: 0.5` undercounts** — shared property defaults to 50% ownership, which scales housing cash flows by half via `compileHouseholdPlan` until user notices | `assetPropertyDefaults.ts:84` | Codex |
| M2 | **Glide path uses `\|\|` instead of `??`** — `glidePathConfig.startAge \|\| default` will replace a falsy `0` with the computed default | `AssumptionsSection.tsx:49` | Code Reviewer (81%) |
| M3 | **`getEntityErrors` uses structural type** — `Record<string, Record<string, string>>` instead of importing named `HouseholdValidationErrors` type | `AssetsPropertySection.tsx:33-39` | Code Architect, Code Reviewer |

---

`★ Insight ─────────────────────────────────────`
The most impactful finding in Batch 2 is the **Rules of Hooks violation** in `useHouseholdCpfAdapter` — it was caught by all three Claude agents independently at 100% confidence, confirming it's a genuine runtime crash path. Codex uniquely caught the **partner clone doubling assets** and **planType not updating** bugs that relate to cross-component state consistency, which the architecture-focused agents missed because they reviewed files individually rather than tracing data flows.
`─────────────────────────────────────────────────`

**Batch 2 totals: PR-8a has 11 findings (2C, 5W, 4M). PR-8b has 9 findings (3C, 2W, 4M). PR-8c has 7 findings (1C, 3W, 3M).**

Ready to launch **Batch 3 (PR-9, PR-10)** on your go-ahead.