# Household / Couples Mode: Design Document

**Date:** 2026-02-28
**Status:** Draft — not yet implementing
**Author:** TJ (maintainer), synthesized from PR #1 review + codebase exploration

---

## 1. Background

### Why Household Mode?

Singapore taxes individuals, not households. Each person has their own:
- Progressive income tax brackets (0% on first $20K up to 24% above $1M)
- CPF accounts (OA, SA, MA, RA) with age-based contribution rates
- SRS account with per-person $15,300/yr deduction cap
- Tax reliefs (earned income, NSman, parent, CPF)

A couple earning $80K + $120K pays significantly less tax than a single person earning $200K, and their CPF contributions, LIFE payouts, and retirement timelines differ. Modeling a household as one person produces wrong FIRE numbers.

### What Users Asked For

> "Does this tool support couples planning? My wife and I have different retirement ages and very different incomes." — [r/singaporefi comment](https://www.reddit.com/r/singaporefi/comments/1rcdnl3/comment/o6y56kv/)

### Scope

- **In scope:** 2-person household (covers ~95% of use cases: married couples, partners planning together)
- **Out of scope:** 3+ person households, dependents with their own income, multi-generational planning
- **Toggle:** Users opt in via a "Household Mode" toggle. Single-person mode remains the default with zero UI changes for solo users.

---

## 2. PR #1 Post-Mortem

[PR #1](https://github.com/RemarkRemedy/fireplanner/pull/1) by ZY-Ang added household mode across 45 files (+2,635 / -466 lines). While it demonstrated working UI switching and export/import support, it has architectural issues that prevent merging.

### What PR #1 Got Right
- Calendar-year display instead of ages when two people have different ages
- Per-person context switching for input sections (PersonSelector component)
- Export/import includes household data
- Blue info banners clarifying "Showing projection for: [Person Name]"

### What PR #1 Got Wrong

| Issue | Description |
|-------|-------------|
| **Monolithic household store** | Created a single `useHouseholdStore` that duplicated profile + income fields for each person, violating the project's "one store per domain" pattern. Every new field added to `useProfileStore` would also need adding to the household store. |
| **No simulation integration** | Monte Carlo, backtest, and sequence risk were not updated. A household with two earners retiring at different ages needs joint simulation — the PR only updated the dashboard display layer. |
| **Staggered retirement unmodeled** | When Person A retires at 55 and Person B at 65, the household transitions through 3 phases: both working, one retired + one working, both retired. The projection engine needs to handle these phases. PR #1 shows the earlier retirement age but doesn't model the income changes. |
| **Shared expenses ambiguity** | Expenses are listed as "shared at the household level" but there's no mechanism for expenses that differ between phases (e.g., when both work vs. when one retires). |
| **No calculation-layer changes** | `lib/calculations/income.ts`, `lib/calculations/projection.ts`, `lib/calculations/fire.ts` were not modified. The PR only patched UI components to read from the household store. |

### Cherry-Pickable Components
These pieces from PR #1 are well-implemented and could be extracted:
- `PersonSelector.tsx` — tab UI for switching between Person 1 / Person 2
- `PersonIndicator.tsx` — blue banner showing active person context
- Calendar-year axis logic in chart components

---

## 3. Architecture: Store Factory Pattern

### Design Principle

> **Per-person stores, thin coordinator, shared hooks.**

Instead of creating a monolithic household store, we create per-person *instances* of the existing stores using a factory function. A thin `useHouseholdStore` coordinates which person is active and holds household-level shared state (shared expenses, combined net worth targets).

### Store Classification

| Store | Per-Person? | Rationale |
|-------|-------------|-----------|
| `useProfileStore` | Yes | Age, CPF, SRS, healthcare differ per person |
| `useIncomeStore` | Yes | Salary, career phases, tax reliefs differ per person |
| `useAllocationStore` | Shared | Portfolio allocation is typically joint (one brokerage account) |
| `useSimulationStore` | Shared | MC params (method, strategy, n_simulations) are plan-level |
| `useWithdrawalStore` | Shared | Withdrawal strategy applies to joint portfolio |
| `usePropertyStore` | Shared | Property is jointly owned (ownershipPercent already exists) |
| `useUIStore` | Shared | UI preferences are per-device, not per-person |

### Why Factory, Not Duplication

The existing stores have complex contracts:
- `useProfileStore` is at version 20 with 20 migration steps
- Each store has `extractData`, `computeValidationErrors`, `partialize`, `onRehydrateStorage`
- Adding a new field requires updating `DATA_KEYS`, defaults, migration, and validation

A factory pattern lets us reuse 100% of the existing store logic:

```typescript
// Conceptual — actual implementation may differ
function createPersonStore(personId: string) {
  return {
    profile: createProfileStore(`fireplanner-profile-${personId}`),
    income: createIncomeStore(`fireplanner-income-${personId}`),
  }
}
```

The existing singleton stores (`useProfileStore`, `useIncomeStore`) become the Person 1 stores. Person 2 gets new instances with different localStorage keys. This means:
- Zero migration for existing users (Person 1 data is already in `fireplanner-profile`)
- All existing validation, defaults, and migration logic is reused
- New features added to `useProfileStore` automatically work for both persons

### Store Factory Implementation

Each per-person store needs its own:
- `persist` key (e.g., `fireplanner-profile-p2`)
- Store instance (separate Zustand atom)
- Same `version`, `migrate`, `partialize`, `onRehydrateStorage` as the original

The factory extracts the store creation logic into a reusable function:

```typescript
// lib/stores/createProfileStore.ts
export function createProfileStore(persistKey: string) {
  return create<ProfileState & ProfileActions>()(
    persist(
      (set) => ({
        ...DEFAULT_PROFILE,
        validationErrors: computeValidationErrors(DEFAULT_PROFILE),
        setField: (field, value) => set((state) => { /* same as current */ }),
        // ... all other actions unchanged
      }),
      {
        name: persistKey,       // <-- only this changes
        version: 20,            // same version
        migrate: /* same */,
        partialize: /* same */,
        onRehydrateStorage: /* same */,
      }
    )
  )
}

// Backward-compatible singleton for Person 1 (and solo mode)
export const useProfileStore = createProfileStore('fireplanner-profile')
```

### Household Coordinator Store

```typescript
// stores/useHouseholdStore.ts
interface HouseholdPerson {
  id: string           // 'p1' | 'p2'
  name: string         // User-provided name (default: "Person 1")
}

interface HouseholdState {
  enabled: boolean
  persons: [HouseholdPerson, HouseholdPerson]
  activePersonId: string   // which person's inputs are shown

  // Shared household expenses (replaces per-person annualExpenses in household mode)
  sharedAnnualExpenses: number
  sharedExpenseAdjustments: ExpenseAdjustment[]
  sharedParentSupport: ParentSupport[]
  sharedFinancialGoals: FinancialGoal[]
}
```

**Key rule:** When `household.enabled === false`, every component reads from the existing singleton stores as before. The household store is inert. When enabled, components use `useActiveProfile()` / `useActiveIncome()` hooks that resolve to the correct person's store instance.

### Active Person Resolution

```typescript
// hooks/useActiveStores.ts
export function useActiveProfile(): ProfileState & ProfileActions {
  const household = useHouseholdStore()
  if (!household.enabled) return useProfileStore()
  return household.activePersonId === 'p1'
    ? useProfileStoreP1()
    : useProfileStoreP2()
}
```

React's rules of hooks require stable call order, so the actual implementation uses conditional reads from pre-created store instances (not conditional hook calls). The pattern above is conceptual — the real implementation will use a `personStores` map created at module scope.

---

## 4. Key Design Decisions

### D1: Per-Person Expenses vs. Shared Expenses

**Decision:** Shared expenses at the household level, per-person income/CPF/tax.

**Rationale:** In Singapore, couples typically share living expenses (rent/mortgage, groceries, utilities) but file taxes individually. The `annualExpenses` field in ProfileStore represents household spending. In household mode, this field moves to `HouseholdState.sharedAnnualExpenses`. Each person's profile retains their own CPF, SRS, and healthcare config.

**Migration:** When household mode is first enabled, `sharedAnnualExpenses` is initialized from Person 1's `annualExpenses`. Users can then adjust.

### D2: Monte Carlo Simulation Strategy

**Decision:** Single joint MC simulation using `max(retirementAge_p1, retirementAge_p2)` as the retirement age, with combined accumulation-phase savings and phased transition modeling.

**Rationale:** Running two separate MC simulations and merging results is statistically incorrect — the same market scenario must affect both persons' portfolios simultaneously. A joint simulation:
1. Accumulates from both incomes pre-retirement
2. Handles the "one retired, one working" transition phase
3. Withdraws from joint portfolio post-retirement
4. Uses `max(lifeExpectancy_p1, lifeExpectancy_p2)` as simulation end

**Accumulation-phase savings array:**
```
For year i (calendar year):
  person1_age = p1.currentAge + i
  person2_age = p2.currentAge + i

  p1_savings = (person1_age < p1.retirementAge) ? p1.annualSavings[i] : 0
  p2_savings = (person2_age < p2.retirementAge) ? p2.annualSavings[i] : 0

  combined_savings[i] = p1_savings + p2_savings
```

The existing `annualSavings: number[]` param in `MonteCarloParams` already supports year-varying savings. The challenge is building this array from two income projections aligned to calendar years.

### D3: Calendar Year Alignment

**Decision:** All projections use calendar year as the primary axis when household mode is enabled. Age is a derived display value per person.

**Rationale:** Person 1 (age 30) and Person 2 (age 35) experience the same market conditions in the same calendar year. Aligning on calendar year is the only way to correctly model joint portfolio returns and combined savings.

**Implementation:**
```
Calendar year 0 = current year (2026)
Person 1 age in year Y = p1.currentAge + Y
Person 2 age in year Y = p2.currentAge + Y
Simulation length = max(p1.lifeExpectancy, p2.lifeExpectancy) - min(p1.currentAge, p2.currentAge)
```

### D4: FIRE Number Calculation

**Decision:** Household FIRE number = `sharedAnnualExpenses / swr`, same formula as solo mode but using shared expenses.

**Nuance:** Per-person CPF LIFE payouts and SRS drawdowns reduce the required withdrawal from the joint liquid portfolio. The effective withdrawal need is:
```
withdrawal_need[year] = shared_expenses[year]
  - p1_cpfLife[year] - p2_cpfLife[year]
  - p1_srs[year] - p2_srs[year]
  - p1_rentalIncome[year] - p2_rentalIncome[year]
```

### D5: Property Handling

**Decision:** Property remains a shared store. The existing `ownershipPercent` field (0.01-1.0) already models co-ownership. In household mode, CPF OA housing deductions are split between persons based on their respective contribution ratios.

### D6: Backward Compatibility

**Decision:** Zero data migration for existing users. Enabling household mode creates Person 2 with defaults. Disabling it returns to reading Person 1's data.

**localStorage layout:**
```
// Solo mode (existing, unchanged)
fireplanner-profile      → Person 1 profile
fireplanner-income       → Person 1 income

// Household mode (adds these keys)
fireplanner-profile-p2   → Person 2 profile
fireplanner-income-p2    → Person 2 income
fireplanner-household    → Household coordinator state
```

---

## 5. New Types

```typescript
// lib/types.ts additions

export interface HouseholdPerson {
  id: 'p1' | 'p2'
  name: string
}

export interface HouseholdState {
  enabled: boolean
  persons: [HouseholdPerson, HouseholdPerson]
  activePersonId: 'p1' | 'p2'
  sharedAnnualExpenses: number
  sharedRetirementSpendingAdjustment: number
  sharedExpenseAdjustments: ExpenseAdjustment[]
  sharedParentSupport: ParentSupport[]
  sharedFinancialGoals: FinancialGoal[]
  sharedRetirementWithdrawals: RetirementWithdrawal[]
  validationErrors: ValidationErrors
}

// Extended income projection row for household combined view
export interface HouseholdIncomeRow {
  calendarYear: number
  p1Age: number
  p2Age: number
  p1Salary: number
  p2Salary: number
  p1CpfTotal: number
  p2CpfTotal: number
  p1Tax: number
  p2Tax: number
  p1TotalNet: number
  p2TotalNet: number
  combinedNet: number
  sharedExpenses: number
  combinedSavings: number
  p1IsRetired: boolean
  p2IsRetired: boolean
}

// Household FIRE metrics
export interface HouseholdFireMetrics {
  householdFireNumber: number
  yearsToHouseholdFire: number
  householdFireAge: { p1: number; p2: number } | null
  combinedLiquidNW: number
  combinedTotalNW: number
  p1CpfTotal: number
  p2CpfTotal: number
  householdProgress: number
  earlierRetirementAge: { person: 'p1' | 'p2'; age: number }
  laterRetirementAge: { person: 'p1' | 'p2'; age: number }
}
```

---

## 6. Implementation Phases

### Phase 1: Store Factory Refactor (Foundation)

**Goal:** Extract store creation into factory functions without changing behavior.

**Files to modify:**
- `stores/useProfileStore.ts` → extract `createProfileStore(persistKey)`, export singleton as before
- `stores/useIncomeStore.ts` → extract `createIncomeStore(persistKey)`, export singleton as before

**Files to create:**
- `stores/useHouseholdStore.ts` — coordinator with `enabled: false` default
- `stores/personStores.ts` — module-scope map: `{ p1: { profile, income }, p2: { profile, income } }`
- `hooks/useActiveStores.ts` — `useActiveProfile()`, `useActiveIncome()` resolution hooks

**Validation:**
- All existing tests pass unchanged
- Solo mode behavior is identical (factory creates same store, just via a function)
- `npm run type-check` clean

**Estimated scope:** 3-4 files modified, 3 files created

### Phase 2: Household Store + Persistence

**Goal:** Create the household coordinator store and update persistence layer.

**Files to modify:**
- `lib/storeRegistry.ts` — add `fireplanner-household`, `fireplanner-profile-p2`, `fireplanner-income-p2`
- `lib/scenarios.ts` — add new store keys to `storeKeys` array
- `lib/shareUrl.ts` — add new store keys to `STORE_KEYS` array
- `lib/exportImport.ts` — add new store keys to `STORE_KEYS` array

**Files to create:**
- `stores/useHouseholdStore.ts` (created in Phase 1, populated here)

**Key concern:** All four persistence files (`storeRegistry`, `scenarios`, `shareUrl`, `exportImport`) hardcode `STORE_KEYS`. Refactor to a single source of truth:

```typescript
// lib/storeKeys.ts
export const SOLO_STORE_KEYS = [
  'fireplanner-profile',
  'fireplanner-income',
  'fireplanner-allocation',
  'fireplanner-simulation',
  'fireplanner-withdrawal',
  'fireplanner-property',
] as const

export const HOUSEHOLD_STORE_KEYS = [
  ...SOLO_STORE_KEYS,
  'fireplanner-household',
  'fireplanner-profile-p2',
  'fireplanner-income-p2',
] as const

export function getActiveStoreKeys(householdEnabled: boolean) {
  return householdEnabled ? HOUSEHOLD_STORE_KEYS : SOLO_STORE_KEYS
}
```

**Validation:**
- Export/import round-trips with household data
- Solo mode export files are unchanged (backward compatible)
- Scenario save/load includes household data when enabled

### Phase 3: Calculation Layer — Income + FIRE

**Goal:** Produce per-person income projections and a combined household FIRE calculation.

**Files to modify:**
- `hooks/useIncomeProjection.ts` — create `useHouseholdIncomeProjection()` that runs two income projections aligned by calendar year
- `hooks/useFireCalculations.ts` — create `useHouseholdFireCalculations()` that uses shared expenses and combined net worth

**Files to create:**
- `lib/calculations/household.ts` — pure functions for combining two income projections, computing household FIRE number, building calendar-year-aligned arrays
- `lib/calculations/household.test.ts` — test combining two projections with staggered retirement

**Key logic:**
```typescript
export function combineIncomeProjections(
  p1Projection: IncomeProjectionRow[],
  p2Projection: IncomeProjectionRow[],
  p1CurrentAge: number,
  p2CurrentAge: number,
): HouseholdIncomeRow[] {
  // Align by calendar year
  // Handle different start/end ages
  // Sum savings only when person is pre-retirement
}
```

**Validation:**
- Unit tests with concrete scenarios:
  - Same age, same income (should match 2x single person)
  - 5-year age gap, one retires earlier
  - One person has no income (homemaker)
- Household FIRE number = shared expenses / SWR

### Phase 4: Simulation Layer — Joint Monte Carlo

**Goal:** Run MC simulation with joint accumulation and phased retirement.

**Files to modify:**
- `hooks/useMonteCarloQuery.ts` — build combined `annualSavings[]` and `postRetirementIncome[]` arrays from both persons' projections
- `lib/simulation/monteCarlo.ts` — no changes needed (already accepts year-varying arrays)

**Key insight:** The existing MC engine already supports year-varying `annualSavings` and `postRetirementIncome` arrays. The household adaptation happens entirely in the hook that builds these arrays, not in the simulation engine itself.

```typescript
// In useMonteCarloQuery, when household mode enabled:
const combinedSavings = buildCombinedSavingsArray(p1Income, p2Income, p1Profile, p2Profile)
const combinedPostRetIncome = buildCombinedPostRetirementIncome(p1Income, p2Income, p1Profile, p2Profile)

// These replace the single-person arrays in MonteCarloParams
params.annualSavings = combinedSavings
params.postRetirementIncome = combinedPostRetIncome
params.retirementAge = Math.max(p1.retirementAge, p2.retirementAge)
params.lifeExpectancy = Math.max(p1.lifeExpectancy, p2.lifeExpectancy)
```

**Validation:**
- MC with two identical people produces ~same success rate as one person with 2x savings/expenses
- Staggered retirement produces a visible inflection in percentile bands
- Backtest and sequence risk hooks also updated

### Phase 5: Projection Layer — Household Projection

**Goal:** Year-by-year combined projection table showing both persons.

**Files to modify:**
- `hooks/useProjection.ts` — create `useHouseholdProjection()` returning combined `ProjectionRow[]` with household-level aggregation
- `lib/calculations/projection.ts` — may need a thin wrapper or the hook handles composition

**Key decisions:**
- The projection table in household mode shows calendar year + both ages
- Combined liquid NW, combined CPF, combined total NW
- Per-person columns available in expanded view
- FIRE progress uses household metrics

### Phase 6: UI Layer — Input Pages

**Goal:** Add person switching UI and household toggle.

**Files to create:**
- `components/shared/HouseholdToggle.tsx` — toggle in settings or top-level nav
- `components/shared/PersonSelector.tsx` — tab bar for switching active person (cherry-pick from PR #1)
- `components/shared/PersonIndicator.tsx` — context banner (cherry-pick from PR #1)

**Files to modify:**
- `pages/InputsPage.tsx` — show PersonSelector when household enabled
- `components/profile/PersonalSection.tsx` — read from `useActiveProfile()`
- `components/income/SalaryModelSection.tsx` — read from `useActiveIncome()`
- `components/profile/CpfSection.tsx` — read from `useActiveProfile()`
- `components/healthcare/HealthcareSection.tsx` — read from `useActiveProfile()`
- `components/income/SrsTaxPlanningCard.tsx` — read from active person context

**Principle:** Every component that currently calls `useProfileStore()` or `useIncomeStore()` directly needs to be audited. In household mode, they should call `useActiveProfile()` or `useActiveIncome()` instead. A grep for direct store imports will produce the migration list.

### Phase 7: UI Layer — Dashboard + Analysis Pages

**Goal:** Display household metrics on dashboard and analysis pages.

**Files to modify:**
- `hooks/useDashboardMetrics.ts` — branch on household mode for combined metrics
- `pages/DashboardPage.tsx` — show "Household FIRE" instead of "Your FIRE"
- `pages/ProjectionPage.tsx` — calendar year axis, combined projection
- `pages/StressTestPage.tsx` — joint MC results
- `components/dashboard/*.tsx` — various panels switch to household metrics
- Chart components — calendar year X-axis instead of age

**Cherry-pick opportunity:** PR #1's calendar-year axis changes and hidden age-specific cards are well-implemented and can be adapted.

---

## 7. Parallel Workstreams

After Phase 1 (store factory) and Phase 2 (persistence), three workstreams can proceed in parallel:

```
Phase 1: Store Factory ─────────────────────┐
Phase 2: Persistence ───────────────────────┤
                                             │
         ┌───────────────────────────────────┤
         │                                   │
Phase 3: Calculations ──┐    Phase 6: UI Inputs ──┐
Phase 4: Simulations ───┤                          │
Phase 5: Projections ───┘    Phase 7: UI Dashboard ┘
         │                          │
         └── Workstream A ──────────┘── Workstream B
```

**Workstream A (Calculations):** Phases 3-5 can be built and tested with unit tests before any UI exists. Pure functions + hooks with mock stores.

**Workstream B (UI):** Phases 6-7 can start with the PersonSelector cherry-pick and household toggle, wiring up `useActiveStores` to existing components. Initially reads from Person 1 only (until Workstream A completes).

**Integration:** When both workstreams complete, the UI components start reading from household calculation hooks.

---

## 8. Persistence & Migration

### localStorage Key Layout

```
Solo mode (existing, unchanged):
  fireplanner-profile      { state: {...}, version: 20 }
  fireplanner-income       { state: {...}, version: 3 }
  fireplanner-allocation   { state: {...}, version: 3 }
  fireplanner-simulation   { state: {...}, version: 6 }
  fireplanner-withdrawal   { state: {...}, version: 2 }
  fireplanner-property     { state: {...}, version: N }

Household mode (adds):
  fireplanner-household    { state: { enabled, persons, ... }, version: 1 }
  fireplanner-profile-p2   { state: {...}, version: 20 }
  fireplanner-income-p2    { state: {...}, version: 3 }
```

### Migration Strategy

**Enabling household mode (first time):**
1. Create `fireplanner-household` with `enabled: true`
2. Create `fireplanner-profile-p2` with defaults (age 30, etc.)
3. Create `fireplanner-income-p2` with defaults
4. Copy `profile.annualExpenses` to `household.sharedAnnualExpenses`
5. Copy `profile.expenseAdjustments` to `household.sharedExpenseAdjustments`
6. Copy `profile.parentSupport` to `household.sharedParentSupport`
7. Copy `profile.financialGoals` to `household.sharedFinancialGoals`

**Disabling household mode:**
1. Set `household.enabled = false`
2. Person 2 data persists in localStorage (not deleted)
3. All reads revert to Person 1 stores
4. Re-enabling restores Person 2 data

**Export/import:**
- Export includes all keys (household + P2 stores) when household is enabled
- Import auto-detects household keys and creates stores if present
- Solo export imported into household mode: works (no household keys = solo data)
- Household export imported into solo mode: household keys are ignored, Person 1 data loads normally

### Scenario Save/Load

Scenarios already save all store data as a blob. Adding household keys to the blob is sufficient. The `loadScenario` function already migrates each store via `migrateStoreData`, so Person 2 stores get the same migration treatment.

---

## 9. Risk Registry

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Hook call order violation** | High | Cannot conditionally call hooks in React. `useActiveProfile()` must always call both P1 and P2 store hooks, then select. Or use a ref-based approach. |
| **Store sync race conditions** | Medium | When switching active person, ensure all derived hooks re-compute. Zustand's subscription model handles this naturally. |
| **Expense double-counting** | High | In household mode, per-person `annualExpenses` must be ignored. Clear separation: personal expenses (healthcare, parent support per-person) vs. shared expenses (rent, food, utilities). |
| **CPF housing split** | Medium | Two-person mortgage deduction must sum to total monthly payment. Validate that `p1CpfHousing + p2CpfHousing <= totalMortgagePayment`. |
| **Performance** | Low | Two income projections + one combined projection. Income engine is ~1ms per projection. Negligible. MC simulation is unchanged (one run). |
| **URL share size** | Medium | Household mode roughly doubles the compressed state. May exceed 8KB URL limit. Mitigation: share URL shows warning and suggests JSON export instead. |
| **Stale detection** | Medium | `useMonteCarloQuery` stale detection must include both persons' params. Currently hashes a single person's data. |

---

## 10. Anti-Patterns to Avoid

### Don't: Create a monolithic household store that duplicates per-person fields
This was PR #1's approach. It creates a maintenance burden where every new field must be added to both the domain store and the household store.

### Don't: Run separate MC simulations per person and average results
Correlated returns must affect both persons' portfolios in the same simulation path. Averaging independent simulations underestimates joint tail risk.

### Don't: Use age as the primary timeline axis in household mode
Two people with different ages cannot share an age-based X-axis. Calendar year is the only correct primary axis.

### Don't: Import stores cross-referentially
CLAUDE.md rule: "Do not import from one store inside another store's definition." This applies to household stores too. Cross-store reads happen in hooks only.

### Don't: Assume both persons have the same current age
The age gap can be up to 70 years in principle (18-year-old + 88-year-old). All array indexing must use calendar year, not age offsets.

### Don't: Modify the simulation engine for household mode
The MC engine (`lib/simulation/monteCarlo.ts`) already accepts year-varying arrays. The household logic belongs in the hooks that *build* those arrays, not in the engine that *consumes* them.

---

## 11. Testing Strategy

### Unit Tests (lib/calculations/household.test.ts)
- `combineIncomeProjections`: same age, different ages, one person not working
- `buildCombinedSavingsArray`: staggered retirement transitions
- `householdFireNumber`: shared expenses / SWR with CPF LIFE offsets
- Calendar year alignment with 5-year, 10-year, 20-year age gaps

### Integration Tests
Two new scenarios in `lib/integration.test.ts`:
1. **Equal Partners** (both age 30, both $72K income, shared $48K expenses)
   - Should produce same FIRE number as solo mode with $48K expenses
   - Combined savings = 2x single person savings
2. **Staggered Couple** (Person 1: age 35, $180K, retires at 50; Person 2: age 30, $72K, retires at 60)
   - Household FIRE determined by later retiree
   - Transition phase correctly modeled

### Hook Tests (renderHook with React Testing Library)
- `useActiveProfile` returns correct person's data after switching
- `useHouseholdFireCalculations` recomputes when either person's data changes
- Stale detection in MC hook triggers when Person 2's income changes

---

## 12. Open Questions

1. **Expense allocation in transition phase:** When Person 1 retires but Person 2 still works, do shared expenses stay the same? Should there be a `retirementSpendingAdjustment` per-person or per-household?

2. **Property CPF split:** How should the monthly CPF OA housing deduction be split between two people? Equal split? Proportional to income? User-configurable?

3. **Person naming:** Should we allow custom names ("Alice" / "Bob") or keep it generic ("Person 1" / "Person 2")? PR #1 used custom names.

4. **Dashboard display:** Should the dashboard show a combined view by default, or per-person views with a toggle? PR #1 showed combined with hidden age-specific cards.

---

## Appendix A: File Impact Summary

### Modified (existing files)
| File | Change |
|------|--------|
| `stores/useProfileStore.ts` | Extract factory function |
| `stores/useIncomeStore.ts` | Extract factory function |
| `lib/storeRegistry.ts` | Add household + P2 store entries |
| `lib/scenarios.ts` | Use shared `STORE_KEYS` |
| `lib/shareUrl.ts` | Use shared `STORE_KEYS` |
| `lib/exportImport.ts` | Use shared `STORE_KEYS` |
| `lib/types.ts` | Add household types |
| `hooks/useIncomeProjection.ts` | Add household variant |
| `hooks/useFireCalculations.ts` | Add household variant |
| `hooks/useProjection.ts` | Add household variant |
| `hooks/useMonteCarloQuery.ts` | Build combined arrays |
| `hooks/useDashboardMetrics.ts` | Branch on household mode |
| `pages/InputsPage.tsx` | PersonSelector integration |
| `pages/DashboardPage.tsx` | Household metrics display |
| `pages/ProjectionPage.tsx` | Calendar year axis |
| Various component files | `useActiveProfile()` migration |

### Created (new files)
| File | Purpose |
|------|---------|
| `stores/useHouseholdStore.ts` | Coordinator store |
| `stores/personStores.ts` | Module-scope person store instances |
| `hooks/useActiveStores.ts` | Active person resolution |
| `lib/storeKeys.ts` | Centralized store key registry |
| `lib/calculations/household.ts` | Pure combination functions |
| `lib/calculations/household.test.ts` | Unit tests |
| `components/shared/HouseholdToggle.tsx` | Enable/disable toggle |
| `components/shared/PersonSelector.tsx` | Person switching tabs |
| `components/shared/PersonIndicator.tsx` | Active person banner |
