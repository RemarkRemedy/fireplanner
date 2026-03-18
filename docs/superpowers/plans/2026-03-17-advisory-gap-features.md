# Advisory Gap Features: 9-Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the computational gap between Fireplanner and fee-only advisory services (Providend, Endowus) by adding 9 features covering expense granularity, income floor modeling, tax optimization, survivor planning, bucket visualization, guardrail dashboards, estate projection, annual review nudges, and auto CPF fallback.

**Architecture:** Each feature is an independent task touching different subsystems. Features 1-3 are pure computation + UI with no engine dependencies between them. Feature 4 (survivor) touches the household compiler. Features 5-7 are dashboard/visualization layers on existing data. Features 8-9 are behavioral/engine enhancements. All follow the existing pattern: pure functions in `lib/`, derived hooks in `hooks/`, UI in `components/` or `pages/`.

**Store count:** The codebase currently has **10** Zustand stores (not 7 as CLAUDE.md states — CLAUDE.md is stale): `useProfileStore`, `useIncomeStore`, `useAllocationStore`, `useSimulationStore`, `useWithdrawalStore`, `usePropertyStore`, `useUIStore`, `useNormalizedAnalysisStore`, `useHouseholdPlanStore`, `useIlpStore`. No new stores are created by this plan.

**Validation:** Every new persisted type (`RetirementExpenseItem`, `TimeBucket`, `BucketConfig`) must have a corresponding Zod schema in `lib/validation/schemas.ts`. The `guaranteed` flag on `IncomeSource` extends the existing schema. Hooks must check validity before computing.

**Tech Stack:** TypeScript, React, Zustand, Vitest, Recharts, Zod, Web Worker (existing)

**Research basis:** `docs/research/advisory-landscape-singapore.md`

**Review status:** 4-agent deep review completed 2026-03-17. Raw outputs: `docs/superpowers/reviews/2026-03-17-advisory-gap-plan-review.md`

### Blockers Fixed in This Revision
| # | Fix Applied |
|---|------------|
| B1 | Feature 1 calculation rewritten in **real terms** matching `fireNumberBasis`; fixed-term items use PV annuity instead of perpetuity |
| B3 | Feature 2 `buildGuaranteedIncomeArray` no longer includes CPF LIFE; dual-path wiring documented |
| B4 | Feature 3 redesigned: SRS/RSTU/CPF are independent deductions, $80K cap is personal reliefs only. Per-adult scoping added. |
| B5 | Feature 4 rewritten to match actual compiler: no `livingAdultIds`, uses `adultTimingById` + `owner` filtering. Type corrected to `HouseholdAssumptions`. |
| B6 | Feature 9 upgraded to preserve FRS lock, exclude CPFIS balances, respect CPF LIFE transition |
| B7 | Fixed all file paths: `IncomeSection` → `components/household/`, `CpfSection` → `components/profile/` |
| B8 | Fixed type name: `PlanAssumptions` → `HouseholdAssumptions` |
| B9 | Fixed import: `RSTU_TAX_RELIEF_CAP` source is `cpfRates.ts` not `taxBrackets.ts` |

### B2 Resolution: Hybrid Approach (Option C)

**F1 (Per-Expense SWR)** stays on `useProfileStore`. It's a display-layer calculator — it doesn't feed the simulation engine. However, when the user enables it, the blended FIRE number **overloads** the dashboard's primary FIRE number (progress, years-to-FIRE, FIRE age all recalculate against the blended target). Toggle lives in `useUIStore` as `useBlendedFireNumber: boolean`.

**F2 (Income Floor)** routes through `useHouseholdPlanStore`. Guaranteed income streams change simulation results (reduce withdrawal needs), so they must flow through the `compileHouseholdPlan` pipeline. Extend existing `IncomeSource` with new `kind` values (`'annuity' | 'endowment' | 'pension'`) rather than creating a parallel `GuaranteedIncomeStream` type. Add a `guaranteed: boolean` flag to `IncomeSource` to distinguish floor income from variable income.

---

## Dependency Map

```
Feature 1 (Per-Expense SWR)     ──independent──
Feature 2 (Income Floor)        ──independent──
Feature 3 (Tax Optimizer)       ──independent──
Feature 4 (Survivor Model)      ──independent──
Feature 5 (Bucket Viz)          ── depends on Feature 2 (income floor feeds bucket 0) ──
Feature 6 (Guardrail Dashboard) ──independent──
Feature 7 (Estate Projection)   ──independent──
Feature 8 (Annual Review)       ──independent──
Feature 9 (Auto CPF OA)         ──independent──
```

Features 1, 2, 3, 4, 6, 7, 8, 9 can all run in parallel. Feature 5 should run after Feature 2.

---

## Chunk 1: Per-Expense SWR / Expense Itemisation

**Inspired by:** FirePathLion V2 spreadsheet, Providend bucket philosophy

**What it does:** Users itemise retirement expenses, assign per-item SWR rates based on flexibility, see a visual "expenses funded" tracker and a blended FIRE number that's lower than the blanket-SWR number.

**Key insight:** This does NOT change the simulation engine. The existing engine continues to use the aggregate expense number for MC/backtest/projection. However, when toggled on, the blended FIRE number **overloads the dashboard's primary FIRE number** — progress %, years-to-FIRE, and FIRE age all recalculate against the (lower) blended target. This makes the feature motivating, not just informational. Data lives on `useProfileStore` (display-layer only, does not feed the compiler pipeline).

### Files

- Create: `frontend/src/lib/calculations/expenseSwr.ts` — pure calculation functions
- Create: `frontend/src/lib/calculations/expenseSwr.test.ts` — tests
- Create: `frontend/src/components/dashboard/ExpenseSwrPanel.tsx` — visual "expenses funded" panel
- Create: `frontend/src/components/inputs/ExpenseItemiser.tsx` — itemisation UI
- Modify: `frontend/src/lib/types.ts` — add `RetirementExpenseItem` type
- Modify: `frontend/src/stores/useProfileStore.ts` — add `retirementExpenseItems: RetirementExpenseItem[]`
- Modify: `frontend/src/pages/DashboardPage.tsx` — render `ExpenseSwrPanel`

### Types

```typescript
// In lib/types.ts
export type ExpenseFlexibility = 'essential' | 'fixed-term' | 'flexible'

export interface RetirementExpenseItem {
  id: string
  label: string
  annualAmount: number           // today's dollars
  flexibility: ExpenseFlexibility
  swr: number                    // e.g. 0.0325, 0.04, 0.05
  endAge?: number                // null = lifetime, else stops at this age
  category?: string              // optional grouping
}
```

### Dollar Basis: REAL TERMS

**CRITICAL:** The existing dashboard FIRE number uses **real terms** (`netRealReturn = expectedReturn - inflation - fees`). This feature MUST use the same basis. All amounts are in **today's dollars**. No inflation adjustment in the capital calculation — the SWR already accounts for inflation sustainability.

When `fireNumberBasis` is `'today'`, both blanket and blended numbers are in today's dollars. When `'fireAge'`, both use the same inflation adjustment as `calculateAllFireMetrics`. Read `fireNumberBasis` from `useProfileStore` and apply the same logic.

### Calculation

```typescript
// In lib/calculations/expenseSwr.ts

/**
 * Capital needed to fund one expense item (TODAY'S DOLLARS — real terms).
 * For perpetual items: annualAmount / swr
 * For fixed-term items: PV of annuity using realReturn as discount rate
 */
export function capitalNeededForItem(
  item: RetirementExpenseItem,
  retirementAge: number,
  lifeExpectancy: number,
  netRealReturn: number            // expectedReturn - inflation - fees
): number {
  if (item.endAge != null && item.endAge > retirementAge) {
    // Fixed-term: PV of annuity for (endAge - retirementAge) years
    const years = item.endAge - retirementAge
    if (netRealReturn === 0) return item.annualAmount * years
    return item.annualAmount * (1 - Math.pow(1 + netRealReturn, -years)) / netRealReturn
  }
  // Perpetual (lifetime): capital = annualAmount / swr
  return item.annualAmount / item.swr
}

/** Blended FIRE number = sum of per-item capital needs (real terms) */
export function blendedFireNumber(
  items: RetirementExpenseItem[],
  retirementAge: number,
  lifeExpectancy: number,
  netRealReturn: number
): number {
  return items.reduce((sum, item) =>
    sum + capitalNeededForItem(item, retirementAge, lifeExpectancy, netRealReturn), 0)
}

/** Effective blended SWR = total annual expenses / blended FIRE number */
export function effectiveBlendedSwr(
  items: RetirementExpenseItem[],
  retirementAge: number,
  lifeExpectancy: number,
  netRealReturn: number
): number {
  const totalExpenses = items.reduce((sum, item) => sum + item.annualAmount, 0)
  const totalCapital = blendedFireNumber(items, retirementAge, lifeExpectancy, netRealReturn)
  return totalCapital > 0 ? totalExpenses / totalCapital : 0
}

/** For each item, compute: funded ratio = (portfolio * item.swr) covers how much of that item */
export function fundedItems(items: RetirementExpenseItem[], portfolio: number): FundedExpenseItem[] {
  // Sort by priority: essential first, then fixed-term, then flexible
  // Walk top-to-bottom, allocating portfolio capital to each item
  // Return each item with { ...item, capitalNeeded, capitalAllocated, fundedPercent }
}
```

### Steps

- [ ] **Step 1: Write failing tests for `capitalNeededForItem` and `blendedFireNumber`**
  - Test: $24K/yr essential at 3.25% SWR, perpetual = $24K / 0.0325 = $738,461 (today's dollars, real terms)
  - Test: $12K/yr fixed-term ending at age 75 (retirement 65, 10 years) with 3% real return = PV annuity
  - Test: Two items totalling $60K with different SWRs produce blended number < $60K/0.0325

- [ ] **Step 2: Run tests — expect FAIL (functions don't exist)**
  - Run: `cd frontend && npx vitest run src/lib/calculations/expenseSwr.test.ts`

- [ ] **Step 3: Implement `capitalNeededForItem`, `blendedFireNumber`, `effectiveBlendedSwr`**

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Write failing tests for `fundedItems`**
  - Test: $1M portfolio, 3 items totalling $50K → first 2 fully funded, third partially
  - Test: empty items array returns empty array
  - Test: $0 portfolio → all items 0% funded

- [ ] **Step 6: Implement `fundedItems`**

- [ ] **Step 7: Run tests — expect PASS**

- [ ] **Step 8: Commit calculation layer**
  ```bash
  git add frontend/src/lib/calculations/expenseSwr.ts frontend/src/lib/calculations/expenseSwr.test.ts
  git commit -m "feat: add per-expense SWR calculation functions"
  ```

- [ ] **Step 9: Add `RetirementExpenseItem` type to `lib/types.ts`**

- [ ] **Step 10: Add `retirementExpenseItems` array to `useProfileStore`**
  - Include CRUD actions: `addRetirementExpenseItem`, `updateRetirementExpenseItem`, `removeRetirementExpenseItem`
  - Persist via existing zustand persist middleware (bump version, add migration)
  - Default: empty array (feature is opt-in)

- [ ] **Step 11: Build `ExpenseItemiser` component**
  - Table with columns: Label, Annual Amount (CurrencyInput), Flexibility (select), SWR (PercentInput), End Age (optional NumberInput)
  - Preset SWR values when flexibility changes: essential=3.25%, fixed-term=4%, flexible=5%
  - Add/remove row buttons
  - "Import from expenses" button that seeds from `annualExpenses` with a single "All expenses" row

- [ ] **Step 12: Add `useBlendedFireNumber` toggle to `useUIStore`**
  - `useBlendedFireNumber: boolean` (default false, persisted)
  - Action: `setUseBlendedFireNumber(enabled: boolean)`

- [ ] **Step 13: Wire overload into `useDashboardMetrics`**
  - When `useBlendedFireNumber` is true AND `retirementExpenseItems.length > 0`:
    - Replace `fireNumber` with `blendedFireNumber(items, retirementAge, lifeExpectancy, netRealReturn)`
    - Recalculate `progress`, `yearsToFire`, `fireAge` based on the blended target
  - When false or items empty: use existing blanket FIRE number (no change)
  - This is a **read-only override** in the hook — it does not mutate any store

- [ ] **Step 14: Build `ExpenseSwrPanel` dashboard component**
  - Shows: Blanket FIRE Number vs Blended FIRE Number (with DeltaBadge showing savings)
  - Toggle switch: "Use blended FIRE number as my target" (wires to `useBlendedFireNumber`)
  - Progress bar: "X of Y expenses fully funded"
  - Per-item funded status (green checkmark / amber partial / red unfunded)
  - Effective blended SWR display
  - When toggle is on, the StatusPanel above automatically reflects the blended number

- [ ] **Step 15: Wire into DashboardPage and InputsPage**
  - Add `ExpenseSwrPanel` to dashboard (after `StatusPanel`)
  - Add `ExpenseItemiser` to expenses section in InputsPage (advanced mode)

- [ ] **Step 16: Run type-check, lint, tests**
  ```bash
  cd frontend && npm run type-check && npm run lint && npm run test
  ```

- [ ] **Step 17: Commit UI layer**

---

## Chunk 2: Income Floor Modeling (Guaranteed Income Streams)

**Inspired by:** Providend RetireWell income bucket, Wade Pfau Safety-First

**What it does:** Users add guaranteed income sources (private annuities, endowment payouts, rental income) beyond CPF LIFE. The engine subtracts the income floor from expenses before touching the portfolio, improving success rates.

**Key insight:** The household model already has `IncomeSource` with various `kind` values. Rather than creating a parallel `GuaranteedIncomeStream` type, **extend the existing `IncomeSource`** with new `kind` values and a `guaranteed: boolean` flag. This routes data through the `compileHouseholdPlan` pipeline naturally, works in both single and household mode, and avoids double-counting.

### Files

- Create: `frontend/src/lib/calculations/incomeFloor.ts` — income floor aggregation (sums guaranteed streams)
- Create: `frontend/src/lib/calculations/incomeFloor.test.ts` — tests
- Modify: `frontend/src/lib/household/types.ts` — extend `IncomeSource` with `guaranteed` flag and new `kind` values
- Modify: `frontend/src/lib/household/compileHouseholdPlan.ts` — tag guaranteed income in compiled output
- Modify: `frontend/src/hooks/useIncomeProjection.ts` — expose `guaranteedIncomeByYear` alongside `postRetirementIncome`
- Create: `frontend/src/components/inputs/GuaranteedIncomeEditor.tsx` — UI for adding streams
- Modify: `frontend/src/components/household/IncomeSection.tsx` — add guaranteed income subsection

### Types

```typescript
// In lib/household/types.ts — extend existing IncomeSource
// Add to IncomeSourceKind union:
//   'annuity' | 'endowment' | 'pension'
// (rental already exists as a kind)

// Add to IncomeSource interface:
//   guaranteed: boolean  // true = income floor (safe, contractual), false = variable

// The existing IncomeSource already has: id, owner, label, kind, timing, annualAmount,
// growthRate, growthModel, taxTreatment, isCpfApplicable, isActive, streamType.
// Adding `guaranteed` is a single field addition — no new type needed.
```

**No separate `GuaranteedIncomeStream` type.** Use `IncomeSource` with `guaranteed: true`.

### Calculation

```typescript
// In lib/calculations/incomeFloor.ts

/** Total guaranteed income at a given age */
export function guaranteedIncomeAtAge(
  streams: GuaranteedIncomeStream[],
  age: number,
  currentAge: number,
  inflation: number
): number {
  return streams
    .filter(s => age >= s.startAge && (s.endAge == null || age < s.endAge))
    .reduce((sum, s) => {
      const yearsFromNow = age - currentAge
      const growth = s.inflationAdjusted ? inflation : (s.growthRate ?? 0)
      return sum + s.annualPayout * Math.pow(1 + growth, yearsFromNow)
    }, 0)
}

/**
 * Build year-by-year guaranteed income array for MC postRetirementIncome.
 * IMPORTANT: Do NOT include CPF LIFE here — the compiler already adds CPF LIFE
 * to postRetirementIncome. This function only adds user-defined guaranteed streams.
 */
export function buildGuaranteedIncomeArray(
  streams: GuaranteedIncomeStream[],
  retirementAge: number,
  currentAge: number,
  lifeExpectancy: number,
  inflation: number
): number[] {
  // For each year from retirementAge to lifeExpectancy:
  //   guaranteedIncomeAtAge(streams, age) — CPF LIFE is handled separately
}
```

### Steps

- [ ] **Step 1: Write failing tests for `guaranteedIncomeAtAge`**
  - Test: annuity $24K/yr starting age 65, check age 64 returns 0, age 65 returns $24K
  - Test: endowment $12K/yr ages 60-70, check age 70 returns 0
  - Test: inflation-adjusted stream grows correctly

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement `guaranteedIncomeAtAge` and `buildGuaranteedIncomeArray`**

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit calculation layer**

- [ ] **Step 6: Extend `IncomeSource` type in `lib/household/types.ts`**
  - Add `guaranteed?: boolean` (default false) to `IncomeSource` interface
  - Add `'annuity' | 'endowment' | 'pension'` to `IncomeSourceKind` union (if not already present — verify by reading the type)
  - No new store needed — guaranteed income streams are added as `IncomeSource` entries in `useHouseholdPlanStore.income[]` with `guaranteed: true`
  - Bump household plan schema version, add migration (existing income entries get `guaranteed: false`)

- [ ] **Step 7: Update `compileHouseholdPlan` to tag guaranteed income**
  - In the compiled output, separate `postRetirementIncome` into `guaranteedIncome` and `variableIncome` components
  - This allows the MC engine (and bucket viz in Feature 5) to distinguish floor vs variable income
  - Do NOT include CPF LIFE in the guaranteed tag — it's already handled separately

- [ ] **Step 8: Wire into `useIncomeProjection` hook**
  - Expose `guaranteedIncomeByYear: number[]` from the compiled output
  - Both single-adult and household paths must produce this array
  - For single-adult path: filter `incomeStreams` by `guaranteed: true` and sum their projected values

- [ ] **Step 9: Build `GuaranteedIncomeEditor` UI**
  - Card-based list with add/remove
  - Fields: label, type (dropdown: annuity/endowment/pension/rental), annual payout (CurrencyInput), start age, end age (optional), inflation-adjusted toggle
  - Presets: "Private Annuity", "Endowment Plan", "Rental Income"
  - Under the hood: creates `IncomeSource` entries with `guaranteed: true` in `useHouseholdPlanStore`

- [ ] **Step 10: Add to `components/household/IncomeSection.tsx` (advanced mode)**

- [ ] **Step 11: Run type-check, lint, tests**

- [ ] **Step 12: Commit UI + wiring**

---

## Chunk 3: CPF/SRS Tax Optimisation Recommender

**Inspired by:** Providend, Endowus advisory

**What it does:** Given the user's gross income, existing contributions, and marginal tax rate, recommends whether to max out SRS and/or RSTU contributions to minimise tax payable.

**Key insight: How SG tax deductions actually work.**
In `calculateChargeableIncome()`, the deductions are **independent line items**, NOT competing for a shared cap:
- `chargeableIncome = grossIncome - cpfEmployee - srsDeduction - rstuDeduction - personalReliefs`
- **CPF employee** — mandatory, not a choice (deducted by employer)
- **SRS** — capped at $15,300 (SC/PR) or $35,700 (foreigner). Separate deduction, NOT part of $80K.
- **RSTU** (SA/RA cash top-up) — capped at $8,000. Separate deduction, NOT part of $80K. Constant lives in `cpfRates.ts` as `RSTU_TAX_RELIEF_CAP`.
- **Personal reliefs** — capped at $80K. Includes earned income relief, spouse relief, parent relief, etc. Does NOT include CPF employee, SRS, or RSTU.

So the optimizer's job is simpler than originally thought: recommend maxing each independent deduction based on marginal tax rate. The question is "is it worth contributing $X to SRS/RSTU given your marginal rate?" not "how to allocate across a shared cap."

### Files

- Create: `frontend/src/lib/calculations/taxOptimizer.ts` — optimization logic
- Create: `frontend/src/lib/calculations/taxOptimizer.test.ts` — tests
- Create: `frontend/src/hooks/useTaxOptimization.ts` — derived hook reading from stores
- Create: `frontend/src/components/health/TaxOptimizationPanel.tsx` — UI panel
- Modify: `frontend/src/pages/HealthCheckPage.tsx` — add panel

### Calculation

```typescript
// In lib/calculations/taxOptimizer.ts

export interface TaxOptimizationInput {
  grossIncome: number
  cpfEmployeeContribution: number    // mandatory, already deducted
  currentSrsContribution: number
  currentRstuTopUp: number           // current voluntary SA/RA cash top-up
  personalReliefs: number            // all personal reliefs (capped at $80K separately)
  residencyStatus: ResidencyStatus
  age: number
}

export interface TaxOptimizationResult {
  recommendedSrs: number             // optimal SRS contribution
  recommendedRstu: number            // optimal SA/RA cash top-up
  currentTax: number
  optimizedTax: number
  taxSavings: number
  marginalRate: number               // marginal rate AFTER optimization
  breakdown: {
    cpfEmployee: number              // not changeable, shown for context
    srs: { current: number; recommended: number; savingsFromMax: number }
    rstu: { current: number; recommended: number; savingsFromMax: number }
    personalReliefs: number          // separate $80K cap, shown for context
    chargeableIncome: { current: number; optimized: number }
  }
}

/**
 * Optimize tax deductions.
 * Each deduction is INDEPENDENT — they don't share a cap.
 * Strategy: compute tax savings from maxing each deduction independently.
 * Use existing calculateChargeableIncome() and calculateProgressiveTax() from tax.ts.
 * Constants: SRS_ANNUAL_CAP from taxBrackets.ts, RSTU_TAX_RELIEF_CAP from cpfRates.ts.
 */
export function optimizeTaxContributions(input: TaxOptimizationInput): TaxOptimizationResult
```

The optimizer should:
1. Calculate current tax: `calculateChargeableIncome(gross, cpfEmp, currentSrs, personalReliefs, status, currentRstu)` → `calculateProgressiveTax(chargeable)`
2. Calculate optimized tax: same but with SRS maxed to cap and RSTU maxed to $8K
3. Calculate per-deduction savings: tax(without SRS max) vs tax(with SRS max), same for RSTU
4. Recommend maxing SRS if marginal rate > 0% (always beneficial). Recommend RSTU if marginal rate makes $8K worthwhile vs CPF SA lock-up.
5. Return current vs optimized comparison

**Per-adult scoping:** The hook must compute per-adult (HealthCheckPage is already tabbed by adult). Read each adult's income/CPF data independently. Do NOT aggregate household income then optimize.

### Steps

- [ ] **Step 1: Write failing tests**
  - Test: $120K income, no SRS/RSTU → recommends max SRS ($15.3K) + max RSTU ($8K), compute exact tax savings using progressive brackets
  - Test: $60K income, low marginal rate → SRS beneficial but smaller savings per dollar
  - Test: already maxed SRS + RSTU → recommends $0 additional, taxSavings = 0
  - Test: foreigner with $35.7K SRS cap → higher SRS recommendation
  - Test: per-adult independence — two adults with different incomes get different recommendations

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement `optimizeTaxContributions`**
  - Use existing `calculateChargeableIncome` and `calculateProgressiveTax` from `tax.ts`
  - Constants: `SRS_ANNUAL_CAP` from `taxBrackets.ts`, `RSTU_TAX_RELIEF_CAP` from `cpfRates.ts`

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit calculation**

- [ ] **Step 6: Build `useTaxOptimization` hook**
  - Accept `adultId` parameter (HealthCheckPage is already tabbed per adult)
  - Read that adult's grossIncome, CPF employee contribution, SRS contribution, RSTU top-up, personal reliefs from household plan store
  - Call `optimizeTaxContributions` per-adult, memoize
  - Do NOT aggregate household income — compute per-entity first (CLAUDE.md rule)

- [ ] **Step 7: Build `TaxOptimizationPanel` UI**
  - Card with: Current Tax, Optimized Tax, Savings (green DeltaBadge)
  - Breakdown table: each deduction type, current vs recommended
  - Relief cap utilization bar ($X of $80K used)
  - "Apply recommendations" button that updates SRS and RSTU in stores

- [ ] **Step 8: Add to HealthCheckPage (new section after Insurance Needs)**

- [ ] **Step 9: Run type-check, lint, tests**

- [ ] **Step 10: Commit**

---

## Chunk 4: Household Survivor Spending Model

**Inspired by:** Providend household planning. Already a known gap in CLAUDE.md.

**What it does:** When one partner passes (reaches `lifeExpectancy`), joint expenses adjust by a survivor ratio (~70-80%) instead of the current behaviour where the deceased's 50% share simply stops.

### Files

- Modify: `frontend/src/lib/household/types.ts` — add `survivorExpenseRatio` to `HouseholdAssumptions` (NOTE: actual type is `HouseholdAssumptions`, NOT `PlanAssumptions`)
- Modify: `frontend/src/lib/household/compileHouseholdPlan.ts` — adjust expense resolution post-death
- Create: `frontend/src/lib/calculations/survivorSpending.test.ts` — tests
- Modify: `frontend/src/components/household/HouseholdSetupWizard.tsx` — add ratio input + update comment

### How the expense loop ACTUALLY works

**Read `compileHouseholdPlan.ts` before implementing.** The expense accumulation does NOT use a `livingAdultIds` array. Instead:

1. Each `ExpenseItem` has an `owner: EntryOwner` field (`'self' | 'partner' | 'shared'`)
2. The timing system (`resolveTimingRule`) resolves each expense's active year range, clamped to the owner adult's `lifeExpectancy`
3. For `'shared'` expenses, the timing system resolves against both adults and uses the wider window
4. The accumulation loop iterates per-expense-entry per-year, checking if the expense is active at that year offset

**Current behaviour:** Shared expenses continue at full amount for as long as either adult is alive. When one dies, their owned expenses stop, but shared expenses are unaffected.

**Desired behaviour:** After death of one adult:
- Deceased's owned expenses → stop (already correct, no change)
- Shared expenses → multiply by `survivorExpenseRatio` (e.g. 0.75) for remaining years
- Surviving adult's owned expenses → no change

**Implementation approach:** In the year-by-year expense accumulation, check if any adult has died (their `yearOffset > lifeExpectancyYearOffset`). If so, apply `survivorExpenseRatio` to any expense entry with `owner === 'shared'`.

```typescript
// In compileHouseholdPlan.ts, within the expense accumulation section:
// For each expense entry at each yearOffset:
const anyAdultDeceased = plan.adults.some(a =>
  yearOffset > adultTimingById[a.id].lifeExpectancyYearOffset
)
const multiplier = (entry.owner === 'shared' && anyAdultDeceased)
  ? (assumptions.survivorExpenseRatio ?? 0.75)
  : 1.0
// Apply multiplier to this entry's contribution for this year
```

### Steps

- [ ] **Step 1: Write failing test**
  - Two adults, shared expenses $60K/yr, adult A dies at year 10
  - Before year 10: expenses = $60K
  - Year 10+: expenses = $60K * 0.75 = $45K
  - Test with custom ratio 0.80

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Add `survivorExpenseRatio?: number` to `HouseholdAssumptions` in `lib/household/types.ts`**
  - Default: `0.75` (75% of couple costs)

- [ ] **Step 4: Implement survivor ratio in `compileHouseholdPlan.ts` expense accumulation**
  - Read the actual expense accumulation code first — find where expense entries are summed per year
  - For each year where any adult's `yearOffset > lifeExpectancyYearOffset`, apply `survivorExpenseRatio` to `shared`-owner expense entries
  - Do NOT assume a `livingAdultIds` array exists — use `adultTimingById` to check death status

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Commit calculation**

- [ ] **Step 7: Add UI field**
  - In `HouseholdSetupWizard.tsx` or assumptions section: "Survivor spending ratio" PercentInput
  - Tooltip: "When one partner passes, joint expenses typically reduce to 70-80% of couple costs"
  - Only show for couple/household plans
  - Update the existing comment at line 827 to reflect the new behaviour

- [ ] **Step 8: Run type-check, lint, tests**

- [ ] **Step 9: Commit**

---

## Chunk 5: Bucket Visualisation with Time-Segmented Allocation

**Inspired by:** Providend RetireWell, Morningstar Three-Bucket

**What it does:** Users assign current assets to time buckets (0-5yrs, 5-10yrs, 10-20yrs, 20+yrs) with different asset allocations per bucket. A visual shows bucket fill levels and the refill waterfall.

**Depends on:** Feature 2 (income floor) — guaranteed income feeds the "safe floor" that reduces how much bucket 0 needs.

**Key insight:** This is a visualisation layer. It does NOT replace the existing MC simulation engine. It's a parallel view that helps users think about their asset allocation in terms of time horizons, similar to how the per-expense SWR is a parallel FIRE number view.

### Files

- Create: `frontend/src/lib/calculations/bucketAllocation.ts` — bucket math
- Create: `frontend/src/lib/calculations/bucketAllocation.test.ts` — tests
- Create: `frontend/src/components/dashboard/BucketVisualization.tsx` — bucket viz
- Create: `frontend/src/components/inputs/BucketAllocator.tsx` — input UI
- Modify: `frontend/src/lib/types.ts` — add `TimeBucket` type
- Modify: `frontend/src/stores/useAllocationStore.ts` — add bucket config
- Modify: `frontend/src/pages/DashboardPage.tsx` — render bucket viz

### Types

```typescript
export interface TimeBucket {
  id: string
  label: string                    // e.g. "Years 1-5"
  startYear: number                // 0
  endYear: number                  // 5
  targetAllocation: {              // asset allocation for this bucket
    equities: number               // 0.0 to 1.0
    bonds: number
    cash: number
  }
  currentAmount: number            // user-entered current allocation to this bucket
}

export interface BucketConfig {
  enabled: boolean
  buckets: TimeBucket[]
  incomeFloorAnnual: number        // from Feature 2, or manual entry
}
```

### Calculation

```typescript
// In lib/calculations/bucketAllocation.ts

/** How much capital each bucket needs, given annual expenses minus income floor */
export function bucketCapitalNeeds(
  annualExpenseGap: number,  // expenses - guaranteed income
  buckets: TimeBucket[],
  inflation: number
): BucketNeed[]

/** Current bucket fill status */
export function bucketFillStatus(
  buckets: TimeBucket[],
  needs: BucketNeed[]
): BucketStatus[]  // { bucket, needed, allocated, fillPercent, yearsOfSpendingCovered }

/** Simulate refill waterfall: when bucket N depletes, bucket N+1 refills it */
export function simulateBucketRefill(
  buckets: TimeBucket[],
  years: number
): BucketRefillTimeline[]
```

### Steps

- [ ] **Step 1: Write failing tests for `bucketCapitalNeeds`**
  - $60K/yr gap, 4 buckets (0-5, 5-10, 10-20, 20+) → bucket 0 needs ~$300K nominal
  - With 2% inflation, bucket 0 needs more than $300K

- [ ] **Step 2: Implement `bucketCapitalNeeds`**

- [ ] **Step 3: Write tests for `bucketFillStatus`**
  - $1.5M portfolio split across 4 buckets → compute fill percentages

- [ ] **Step 4: Implement `bucketFillStatus` and `simulateBucketRefill`**

- [ ] **Step 5: Run all tests — expect PASS**

- [ ] **Step 6: Commit calculation layer**

- [ ] **Step 7: Add types and store fields**
  - `BucketConfig` in `useAllocationStore` with default 4-bucket template
  - Persist, version bump

- [ ] **Step 8: Build `BucketAllocator` input UI**
  - Visual bucket editor: 4 horizontal bars, each with allocation sliders and amount input
  - "Auto-distribute" button that splits current portfolio across buckets proportionally
  - Preset templates: "Conservative" (heavy cash), "Moderate", "Aggressive" (heavy equities in long buckets)

- [ ] **Step 9: Build `BucketVisualization` dashboard component**
  - 4 vertical/horizontal buckets with fill level (water metaphor or progress bars)
  - Color: green = fully funded, amber = partially, red = empty
  - Label: "Years 1-5: Funded" / "Years 5-10: 73% funded"
  - Refill arrow indicators between buckets
  - Total coverage summary: "Your next X years of spending are secured"

- [ ] **Step 10: Wire into Dashboard and Inputs pages**

- [ ] **Step 11: Run type-check, lint, tests**

- [ ] **Step 12: Commit**

---

## Chunk 6: Dynamic Guardrail Dashboard

**Inspired by:** Kitces Risk-Based Guardrails, Vanguard Dynamic Spending

**What it does:** For users who have run MC simulation with a guardrails withdrawal strategy, show where they currently sit relative to their guardrails and what action (if any) to take.

**Key insight:** The guardrails strategy already exists in `withdrawal.ts` with `initialRate`, `ceilingTrigger`, `floorTrigger`, `adjustmentSize`. This feature is a presentation layer that computes the current state and shows it visually.

### Files

- Create: `frontend/src/lib/calculations/guardrailStatus.ts` — status computation
- Create: `frontend/src/lib/calculations/guardrailStatus.test.ts` — tests
- Create: `frontend/src/hooks/useGuardrailStatus.ts` — derived hook
- Create: `frontend/src/components/dashboard/GuardrailDashboard.tsx` — visual panel
- Modify: `frontend/src/pages/DashboardPage.tsx` — render conditionally

### Calculation

```typescript
// In lib/calculations/guardrailStatus.ts

export interface GuardrailStatus {
  currentWithdrawalRate: number        // current annual withdrawal / portfolio
  initialRate: number                  // target rate
  upperGuardrail: number               // rate below which you can raise spending
  lowerGuardrail: number               // rate above which you must cut spending
  zone: 'raise' | 'comfort' | 'cut'   // which zone you're in
  suggestedAdjustment: number          // +10% or -10% or 0
  additionalMonthlySpending: number    // how much more/less per month
  portfolioValue: number
  annualWithdrawal: number
}

export function computeGuardrailStatus(
  portfolioValue: number,
  annualWithdrawal: number,
  params: {
    initialRate: number
    ceilingTrigger: number     // e.g. 1.20
    floorTrigger: number       // e.g. 0.80
    adjustmentSize: number     // e.g. 0.10
  }
): GuardrailStatus
```

Logic (aligned with `withdrawal.ts` naming):
- `currentRate = annualWithdrawal / portfolioValue`
- `ceilingRate = initialRate * ceilingTrigger` (e.g. 5% * 1.20 = 6%) — if rate exceeds this, must **cut** spending
- `floorRate = initialRate * floorTrigger` (e.g. 5% * 0.80 = 4%) — if rate drops below this, can **raise** spending
- Zone: `currentRate > ceilingRate ? 'cut' : currentRate < floorRate ? 'raise' : 'comfort'`

NOTE: In the `withdrawal.ts` code, `ceilingTrigger` means the withdrawal rate has hit a ceiling (too high, must cut). `floorTrigger` means it hit a floor (too low, can raise). This naming is from the Guyton-Klinger paper.

### Steps

- [ ] **Step 1: Write failing tests**
  - Test: $1M portfolio, $40K withdrawal, initialRate 5% → currentRate 4%, zone = 'comfort'
  - Test: $1.5M portfolio, $40K withdrawal → currentRate 2.67%, below floor trigger → zone = 'raise'
  - Test: $600K portfolio, $40K withdrawal → currentRate 6.67%, above ceiling trigger → zone = 'cut'

- [ ] **Step 2: Implement `computeGuardrailStatus`**

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit calculation**

- [ ] **Step 5: Build `useGuardrailStatus` hook**
  - Read portfolio value from **projection output** (not starting `liquidNetWorth` — that's stale after contributions/withdrawals). Use the latest projection row's `liquidNW` or simulation result's current portfolio.
  - Read annual withdrawal from simulation results or expenses at retirement
  - Read guardrail params from withdrawal store
  - Only return data if user has selected guardrails strategy

- [ ] **Step 6: Build `GuardrailDashboard` component**
  - Horizontal gauge/thermometer: green zone (comfort), blue zone (can raise), red zone (must cut)
  - Current position marker on the gauge
  - Text: "Your withdrawal rate: X%. You're in the comfort zone." or "You could increase spending by $Y/month"
  - Only shown when guardrails strategy is selected

- [ ] **Step 7: Add to DashboardPage (conditional on strategy selection)**

- [ ] **Step 8: Run type-check, lint, tests**

- [ ] **Step 9: Commit**

---

## Chunk 7: Net Estate at Death Projection

**Inspired by:** Providend estate planning

**What it does:** Projects total assets minus liabilities minus estate costs at the user's expected death age. Shows what's left for beneficiaries.

### Files

- Create: `frontend/src/lib/data/estateCosts.ts` — SG-specific defaults (funeral, legal/admin costs)
- Create: `frontend/src/lib/calculations/estateProjection.ts` — calculation
- Create: `frontend/src/lib/calculations/estateProjection.test.ts` — tests
- Create: `frontend/src/hooks/useEstateProjection.ts` — derived hook
- Create: `frontend/src/components/dashboard/EstateProjectionPanel.tsx` — UI
- Modify: `frontend/src/pages/DashboardPage.tsx` — render panel

### Calculation

```typescript
// In lib/calculations/estateProjection.ts

export interface EstateProjectionInput {
  portfolioAtDeath: number          // from projection engine
  cpfBalancesAtDeath: {             // CPF is cash to nominees on death
    oa: number; sa: number; ma: number; ra: number
  }
  propertyValueAtDeath: number      // from property store, inflated
  outstandingMortgageAtDeath: number
  otherDebts: number
  funeralCosts: number              // from protection fields (default $15K)
  legalAdminCosts: number           // default ~$5K for probate/admin
  insurancePayouts: number          // death benefit coverage
}

export interface EstateProjectionResult {
  grossEstate: number               // portfolio + CPF + property + insurance
  totalDeductions: number           // mortgage + debts + funeral + legal
  netEstate: number                 // gross - deductions
  breakdown: {
    portfolio: number
    cpf: number
    property: number
    insurance: number
    mortgage: number
    debts: number
    costs: number
  }
}

export function projectNetEstate(input: EstateProjectionInput): EstateProjectionResult
```

### Steps

- [ ] **Step 1: Write failing tests**
  - Test: $500K portfolio + $200K CPF + $1M property - $400K mortgage - $20K costs = $1.28M net estate
  - Test: zero portfolio → CPF + property - debts
  - Test: all zeros → $0 net estate

- [ ] **Step 2: Implement `projectNetEstate`**

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit calculation**

- [ ] **Step 5: Build `useEstateProjection` hook**
  - Read portfolio at death age from the **deterministic projection output** (the year-by-year projection's `liquidNW` at the death-age row). NOTE: `generateIncomeProjection` is the income engine — portfolio values come from `projection.ts` output or the compiled household plan's `rows` array.
  - Read CPF balances at death age from the income projection output (each row has `cpfOA`, `cpfSA`, `cpfMA`, `cpfRA`)
  - Read property value from property projection (uses Bala's Table decay, mortgage amortization). Do NOT just inflate the current value — use the property engine's output.
  - Read funeral costs from protection fields on `PlanningAdult`
  - Default legal/admin costs from `lib/data/estateCosts.ts` (create this file — SG-specific defaults per CLAUDE.md rules)

- [ ] **Step 6: Build `EstateProjectionPanel`**
  - Summary card: "Estimated net estate at age X: $Y"
  - Breakdown: stacked bar or waterfall chart showing assets vs deductions
  - Disclaimer: "This is an estimate. Consult a qualified estate planner for advice."

- [ ] **Step 7: Add to DashboardPage (at bottom, after existing panels)**

- [ ] **Step 8: Run type-check, lint, tests**

- [ ] **Step 9: Commit**

---

## Chunk 8: Annual Review Nudge/Checklist

**Inspired by:** Providend annual review meetings

**What it does:** Prompts users once a year to revisit their assumptions, update inputs, and re-run simulations. Tracks when the last review was done.

### Files

- Create: `frontend/src/lib/data/annualReviewItems.ts` — review checklist data constant (CLAUDE.md: data arrays in lib/data/)
- Create: `frontend/src/lib/annualReview.ts` — `isReviewDue()` logic function
- Create: `frontend/src/components/shared/AnnualReviewBanner.tsx` — banner component
- Create: `frontend/src/components/shared/AnnualReviewChecklist.tsx` — checklist drawer
- Modify: `frontend/src/pages/DashboardPage.tsx` — show banner
- Modify: `frontend/src/stores/useUIStore.ts` — add `lastReviewDate` field

### Logic

```typescript
// In lib/annualReview.ts

export interface ReviewChecklist {
  items: ReviewItem[]
  lastCompletedDate: string | null   // ISO date
}

export interface ReviewItem {
  id: string
  label: string
  description: string
  link: string                       // route to navigate to
  checked: boolean
}

// NOTE: This is a data constant — move to lib/data/annualReviewItems.ts per CLAUDE.md rules.
// Section IDs must match actual InputsPage anchors. Verify by reading router.tsx redirects.
export const ANNUAL_REVIEW_ITEMS: Omit<ReviewItem, 'checked'>[] = [
  { id: 'income', label: 'Update salary & income', description: 'Verify current salary, bonus, and any new income streams', link: '/inputs#section-income' },
  { id: 'expenses', label: 'Review expense assumptions', description: 'Check if spending has changed from last year', link: '/inputs#section-expenses' },
  { id: 'cpf', label: 'Check CPF balances', description: 'Update OA/SA/MA with latest CPF statement', link: '/inputs#section-cpf' },
  { id: 'srs', label: 'Review SRS contributions', description: 'Optimise SRS for this tax year', link: '/health-check' },
  { id: 'insurance', label: 'Check insurance coverage', description: 'Verify coverage still matches needs', link: '/health-check' },
  { id: 'goals', label: 'Update financial goals', description: 'Add new goals, remove completed ones', link: '/inputs#section-expenses' },
  { id: 'retirement-age', label: 'Reassess retirement age target', description: 'Still on track? Need to adjust?', link: '/inputs#section-personal' },
  { id: 'simulation', label: 'Re-run Monte Carlo simulation', description: 'See updated success probability', link: '/stress-test' },
  { id: 'property', label: 'Update property valuation', description: 'Check current market value estimate', link: '/inputs#section-property' },
]
// IMPORTANT: Verify all #section-* anchors exist in InputsPage before shipping.

export function isReviewDue(lastReviewDate: string | null): boolean {
  if (!lastReviewDate) return true
  const last = new Date(lastReviewDate)
  const now = new Date()
  const monthsSince = (now.getFullYear() - last.getFullYear()) * 12 + (now.getMonth() - last.getMonth())
  return monthsSince >= 12
}
```

### Steps

- [ ] **Step 1: Write failing tests for `isReviewDue`**
  - Test: null → true
  - Test: 13 months ago → true
  - Test: 6 months ago → false
  - Test: exactly 12 months ago → true

- [ ] **Step 2: Implement `isReviewDue` and review items**

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

- [ ] **Step 5: Add review state to `useUIStore`**
  - `lastReviewDate: string | null` (ISO date, persisted)
  - `reviewSnoozeUntil: string | null` (ISO date, persisted — dismiss snoozes for 30 days)
  - `reviewCheckedItems: string[]` (persisted, cleared on completion)
  - Actions: `markReviewItem(id)`, `completeReview()`, `snoozeReview()` (sets snoozeUntil to 30 days from now)
  - Update `isReviewDue` to also check snooze: `if (snoozeUntil && new Date() < new Date(snoozeUntil)) return false`

- [ ] **Step 6: Build `AnnualReviewBanner`**
  - Amber/blue banner at top of Dashboard: "It's been X months since your last review. Time for an annual check-up?"
  - "Start review" button → opens checklist drawer
  - "Dismiss" button (snoozes for 30 days)
  - Only shows when `isReviewDue()` returns true

- [ ] **Step 7: Build `AnnualReviewChecklist`**
  - Drawer/sheet with checklist items
  - Each item: checkbox + label + description + "Go" link button
  - Progress indicator: "X of 9 completed"
  - "Complete review" button (sets `lastReviewDate` to today, clears checked items)
  - Pattern: follow existing `ChecklistPage.tsx` pattern (checkbox + line-through + progress bar)

- [ ] **Step 8: Wire into DashboardPage**

- [ ] **Step 9: Run type-check, lint, tests**

- [ ] **Step 10: Commit**

---

## Chunk 9: Auto CPF OA Withdrawal on Portfolio Depletion

**Already documented in:** `memory/project_future_features.md`

**What it does:** When the liquid portfolio hits zero and the user is 55+, automatically draw from CPF OA to cover the expense gap (bridging portfolio depletion to CPF LIFE start age).

**Key insight:** The engine already has `cpfAutoFallback` (boolean) that does exactly this. But it only triggers inside `projection.ts`. The MC engine does NOT have this logic. This feature needs to:
1. Verify `cpfAutoFallback` works correctly in `projection.ts` (search for `cpfAutoFallback` — do NOT rely on line numbers as they shift)
2. Port the auto-fallback logic to the MC engine so Monte Carlo results reflect CPF as a backstop
3. Make the feature more discoverable in the UI (currently hidden in Advanced mode)

### Files

- Modify: `frontend/src/lib/simulation/monteCarlo.ts` — add CPF auto-fallback in decumulation loop
- Create: `frontend/src/lib/simulation/monteCarlo.cpfFallback.test.ts` — tests
- Modify: `frontend/src/lib/simulation/simulation.worker.ts` — pass CPF params to MC
- Modify: `frontend/src/components/profile/CpfSection.tsx` — surface auto-fallback toggle more prominently (NOTE: actual path is `components/profile/`, NOT `components/inputs/`)

### Calculation changes in MC engine

Currently, the MC decumulation loop in `monteCarlo.ts` only tracks `portfolio`. It doesn't model CPF balances. To add auto-fallback:

**Option A+ (balanced):** Accept pre-computed CPF state at retirement from the deterministic projection, then track it year-by-year in MC with simplified but rule-consistent logic. This avoids re-implementing full CPF mechanics in MC while maintaining parity with the deterministic fallback.

Add to `MonteCarloEngineParams`:
```typescript
cpfAutoFallback?: {
  oaBalanceAtRetirement: number     // withdrawable OA (EXCLUDING CPFIS-invested portion)
  oaGrowthRate: number              // 2.5% (from cpfRates.ts OA_INTEREST_RATE)
  oaLockedForFRS: number            // amount locked for FRS — cannot withdraw
  includeSA?: boolean
  saBalanceAtRetirement?: number    // withdrawable SA (EXCLUDING CPFIS-invested)
  saGrowthRate?: number             // 4% (from cpfRates.ts SA_INTEREST_RATE)
  cpfLifeStartAge?: number          // when CPF LIFE starts (changes fallback behavior)
  retirementAge: number             // for age tracking in MC loop
}
```

**Key rules to preserve (from deterministic `projection.ts` fallback):**
1. OA withdrawal only from age 55+
2. FRS amount is locked — cannot withdraw below this floor
3. CPFIS-invested balances are excluded (not liquid)
4. Once CPF LIFE starts, RA is annuitized — OA fallback continues but RA stops
5. SA fallback only if `includeSA` is true, and only after OA is exhausted

**Warning for UI:** If the user has CPF housing payments consuming OA, the `oaBalanceAtRetirement` from the deterministic projection already reflects those deductions. Add a note if property expenses + fallback are both enabled.

### Steps

- [ ] **Step 1: Write failing test for MC with CPF fallback**
  - Scenario: small portfolio ($200K) that depletes in 10 years, but $300K CPF OA
  - Without fallback: success rate ~30%
  - With fallback: success rate should be significantly higher

- [ ] **Step 2: Run test — expect FAIL (MC doesn't have fallback)**

- [ ] **Step 3: Add `cpfAutoFallback` to `MonteCarloEngineParams`**

- [ ] **Step 4: Implement CPF auto-fallback in MC decumulation loop**
  - After `portfolio` goes to 0, draw from `cpfOaBalance` (growing at OA rate)
  - Track `cpfOaBalance` per simulation year, floored at `oaLockedForFRS`
  - If `includeSA`, draw from SA (growing at SA rate) after OA reaches FRS floor
  - If `cpfLifeStartAge` is set and current age >= that, stop RA-related fallback (annuitized)
  - Portfolio depletion age = when BOTH portfolio AND withdrawable CPF are exhausted
  - Model is similar to existing `retirementMitigation.cash_bucket` implementation (~70 lines)

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Commit MC engine change**

- [ ] **Step 7: Wire CPF balances into MC params**
  - In `frontend/src/lib/simulation/monteCarloParams.ts` (the canonical MC params builder), read CPF OA/SA balances at retirement age from income projection
  - Exclude CPFIS-invested portions (check `cpfisOaReturn`/`cpfisSaReturn` fields)
  - Compute `oaLockedForFRS` from the FRS schedule
  - Pass as `cpfAutoFallback` config when the store toggle is enabled

- [ ] **Step 8: Surface auto-fallback toggle in `components/profile/CpfSection.tsx`**
  - Move from Advanced-only to visible in Simple mode
  - Tooltip: "When your investment portfolio is depleted, automatically draw from CPF OA (and optionally SA) to continue funding retirement expenses"
  - Show estimated "CPF bridge years" based on current CPF balances

- [ ] **Step 9: Update simulation worker to pass CPF fallback params**

- [ ] **Step 10: Run type-check, lint, tests**

- [ ] **Step 11: Commit**

---

## Execution Order & Parallelism

### Wave 1 (All independent — run in parallel)
- **Agent 1:** Feature 1 (Per-Expense SWR)
- **Agent 2:** Feature 2 (Income Floor)
- **Agent 3:** Feature 3 (Tax Optimizer)
- **Agent 4:** Feature 4 (Survivor Model)

### Wave 2 (After Wave 1 completes)
- **Agent 5:** Feature 5 (Bucket Viz) — needs Feature 2's income floor types
- **Agent 6:** Feature 6 (Guardrail Dashboard) — independent but logically after core features
- **Agent 7:** Feature 7 (Estate Projection) — independent

### Wave 3 (Lowest risk, can run anytime)
- **Agent 8:** Feature 8 (Annual Review)
- **Agent 9:** Feature 9 (Auto CPF OA)

### Total estimated scope
- Wave 1: 4 agents, each ~4-6 hours → all complete in ~6 hours wall-clock
- Wave 2: 3 agents, each ~3-5 hours → complete in ~5 hours
- Wave 3: 2 agents, each ~2-3 hours → complete in ~3 hours
- Integration/merge conflict resolution: ~2-4 hours
- **Total: ~16-20 hours wall-clock with full parallelism**

Each feature should be on its own branch (`feat/expense-swr`, `feat/income-floor`, etc.) and merged independently after tests pass. Push to `private` remote only (features don't go to `origin` per CLAUDE.md).

### Merge conflict mitigation
Features 1, 2, and 5 all modify `lib/types.ts` and potentially `useProfileStore`. To minimize conflicts:
- **Option A (recommended):** Add all new types to `lib/types.ts` in a single "groundwork" commit before dispatching parallel agents.
- **Option B:** Accept merge conflicts and resolve when merging branches sequentially.
- Store version bumps: coordinate so each feature uses a unique version number (current + N for feature N).
