# CPF Setup Screen Redesign

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Redesign the `/setup` CPF screen to handle 3 user states: knows exact balances (total or breakdown), doesn't know (auto-estimate with mortgage adjustment), and foreigner (skip entirely).

**Context:** The current CPF screen has a toggle + total input, but the toggle-off state still shows the estimated total as an editable field, which confuses users. The estimate doesn't account for CPF OA usage for mortgage, which is the single largest factor that makes estimates inaccurate.

---

## Design

### Screen states

```
Foreigner → screen skipped entirely (existing skipWhen works)

Citizen/PR → show screen:
  ┌─────────────────────────────────────────────────┐
  │  Your CPF                                        │
  │                                                  │
  │  ○ I know my balances    ● Estimate for me       │  ← pill toggle (default: Estimate)
  │                                                  │
  │  [STATE A or STATE B content below]              │
  │                                                  │
  │  [Back]                        [Continue]        │
  └─────────────────────────────────────────────────┘
```

**State A: "Estimate for me" (default)**

```
  Based on your age (30) and income ($72K/yr), we estimate
  your total CPF is approximately:

  ┌──────────────────────────────┐
  │  ~$183,000                   │  ← read-only display, NOT editable
  │  OA ~$110K · SA ~$37K · MA ~$37K │
  └──────────────────────────────┘

  ☐ I've used CPF OA for my mortgage
    → [How much OA was used? $____]  (showWhen checked)

  This is a rough estimate. You can enter exact balances
  on the CPF details page after setup.
```

The estimate is computed by a pure function in `lib/calculations/cpf.ts` (NOT inline in the component — per CLAUDE.md, pure functions belong in `lib/`):

```typescript
// lib/calculations/cpf.ts
export function estimateCpfBalances(
  currentAge: number,
  grossAnnualIncome: number,
  residencyStatus: ResidencyStatus,
  prMonths?: number,
  oaMortgageUsed?: number,
): { total: number; oa: number; sa: number; ma: number; ra: number }
```

**Formula (sums contributions across age brackets, not single rate):**
1. `workStartAge = 25` (accounts for NS + university; conservative default)
2. For each year from `workStartAge` to `currentAge`:
   - `ageAtYear = workStartAge + yearIndex`
   - `rates = getCpfRatesForAge(ageAtYear, residencyStatus, prMonths)` (from cpfRates.ts)
   - `cappedIncome = min(grossAnnualIncome, OW_CEILING_ANNUAL)` (OW ceiling $96K/yr from cpfRates.ts)
   - `yearContribution = cappedIncome * rates.totalRate`
   - Accumulate into running total
3. Apply `CPF_ESTIMATE_RETENTION_FACTOR = 0.7` (named constant in `lib/data/cpfRates.ts` — accounts for interest partially offsetting withdrawals/housing usage)
4. Split the estimated total into OA/SA/MA/RA using `CPF_HEURISTIC_SPLIT` (from `lib/data/cpfRates.ts`)
5. If mortgage OA used: subtract from OA portion ONLY (not from total before split), clamp OA to min 0

**Key differences from old formula:**
- Sums across age brackets (37% for under-55, 34% for 55-60, etc.) instead of using current-age rate for entire career
- Caps income at OW ceiling ($96K/yr) so high earners don't get impossibly high estimates
- Accounts for PR graduated rates via `getCpfRatesForAge(age, residencyStatus, prMonths)`
- Mortgage deduction applied AFTER split, to OA only
- Uses 25 as work start age (not 23) to account for NS for males

**State B: "I know my balances"**

```
  ○ Total    ● By account     ← sub-pill toggle

  [If Total]:
    Total CPF balance (OA + SA + MA)
    $ [________]
    We'll split it by age-based heuristics.

  [If By account]:
    Ordinary Account (OA)   (i)
    $ [________]

    Special Account (SA)    (i)
    $ [________]

    MediSave Account (MA)   (i)    ← validated: max $79,000 (BHS)
    $ [________]

    Retirement Account (RA) (i)    ← only shown if age >= 55
    $ [________]
```

### Data flow

All 3 modes set `draft.cpfKnown = true` (CPF is always included in projection).

**Estimate mode:**
- Call `estimateCpfBalances(age, income, residency, prMonths, oaMortgageUsed)` → returns `{ total, oa, sa, ma, ra }`
- `draft.cpfTotal = result.total`
- `draft.cpfBreakdown = { oa: result.oa, sa: result.sa, ma: result.ma, ra: result.ra }`
- `applySetupDraft` sees `cpfBreakdown` and uses those values directly (bypasses `splitCpfByAge`)

**Know balances - Total mode:**
- `draft.cpfTotal = userEnteredTotal`
- `draft.cpfBreakdown = undefined` (not provided)
- `applySetupDraft` splits via `splitCpfByAge` as usual

**Know balances - Breakdown mode:**
- `draft.cpfTotal = OA + SA + MA + RA`
- `draft.cpfBreakdown = { oa, sa, ma, ra }` (exact user values)
- `applySetupDraft` sees `cpfBreakdown` and uses those values directly (bypasses `splitCpfByAge`)

**`SetupDraft` interface change:**
```typescript
// Add to SetupDraft interface in setupDraft.ts:
cpfBreakdown?: { oa: number; sa: number; ma: number; ra: number }
```

**`applySetupDraft` change:**
```typescript
// In applySetupDraft, when setting CPF balances:
if (draft.cpfBreakdown) {
  // Use exact per-account values (from breakdown or estimate)
  balances = draft.cpfBreakdown
} else if (draft.cpfTotal) {
  // Split total by age-based heuristic
  balances = splitCpfByAge(draft.cpfTotal, draft.currentAge)
}
```

This eliminates the fragile "overwrite after apply" pattern.

### Implementation approach

This screen is too complex for the generic `NudgeField` system. Render it as custom content via `SetupScreen`'s `children` prop, similar to how `MonthlyIncomeInput` is rendered on the income screen.

Create a new component: `frontend/src/components/setup/CpfSetupInput.tsx`

Props (grouped to avoid 16-prop sprawl):
```typescript
interface CpfSplit { oa: number; sa: number; ma: number; ra: number }

interface CpfSetupInputProps {
  age: number
  showRA: boolean  // age >= 55
  mode: 'estimate' | 'know'
  onModeChange: (mode: 'estimate' | 'know') => void
  // Estimate display (read-only, computed by parent via estimateCpfBalances)
  estimate: { total: number; split: CpfSplit }
  // Mortgage adjustment
  mortgage: { used: boolean; amount: number }
  onMortgageChange: (m: { used: boolean; amount: number }) => void
  // Manual entry (total or breakdown)
  manual: { entryMode: 'total' | 'breakdown'; total: number } & CpfSplit
  onManualChange: (updates: Partial<CpfSetupInputProps['manual']>) => void
}
```

---

## Tasks

### Task 0: Create `estimateCpfBalances` pure function

**Files:**
- Modify: `frontend/src/lib/calculations/cpf.ts` (or create if not exists)
- Modify: `frontend/src/lib/data/cpfRates.ts` (add `CPF_ESTIMATE_RETENTION_FACTOR` constant)

- [ ] Read `frontend/src/lib/data/cpfRates.ts` in the WORKTREE (`../fireplanner-setup`) — find `getCpfRatesForAge`, `CPF_HEURISTIC_SPLIT`, `OW_CEILING` constants
- [ ] Add named constant: `export const CPF_ESTIMATE_RETENTION_FACTOR = 0.7` in cpfRates.ts with comment explaining rationale
- [ ] Add named constant: `export const CPF_WORK_START_AGE = 25` (accounts for NS + university)
- [ ] Implement `estimateCpfBalances` as a pure function:

```typescript
export function estimateCpfBalances(
  currentAge: number,
  grossAnnualIncome: number,
  residencyStatus: ResidencyStatus,
  prMonths?: number,
  oaMortgageUsed?: number,
): { total: number; oa: number; sa: number; ma: number; ra: number } {
  // Sum contributions across each year of career (not single current rate)
  let totalContributions = 0
  const cappedIncome = Math.min(grossAnnualIncome, OW_CEILING_ANNUAL)
  for (let age = CPF_WORK_START_AGE; age < currentAge; age++) {
    const rates = getCpfRatesForAge(age, residencyStatus, prMonths)
    totalContributions += cappedIncome * rates.totalRate
  }
  // Apply retention factor (interest partially offsets housing/education withdrawals)
  const estimatedTotal = Math.round(totalContributions * CPF_ESTIMATE_RETENTION_FACTOR)
  // Split into accounts using age-based heuristic
  const split = splitCpfByAge(estimatedTotal, currentAge) // from setupDraft.ts or move here
  // Subtract mortgage OA usage AFTER split (mortgage only reduces OA)
  if (oaMortgageUsed && oaMortgageUsed > 0) {
    split.oa = Math.max(0, split.oa - oaMortgageUsed)
  }
  const total = split.oa + split.sa + split.ma + split.ra
  return { total, ...split }
}
```

- [ ] Write tests for `estimateCpfBalances`:
  - Age 30 citizen $72K income → reasonable estimate (~$100-150K)
  - Age 55 citizen $120K income → sums across bracket changes (37% to 34% at 55)
  - High earner $200K → capped at OW ceiling (~$96K contributions)
  - PR year 1 → much lower estimate (9% vs 37%)
  - With mortgage OA $50K → OA reduced, SA/MA unchanged
  - Mortgage exceeding estimated OA → OA clamped to 0

### Task 1: Create CpfSetupInput component

**Files:**
- Create: `frontend/src/components/setup/CpfSetupInput.tsx`

- [ ] Read `frontend/src/lib/data/healthcarePremiums.ts` for `MEDISAVE_BHS` ($79,000) — use the constant, don't hardcode
- [ ] Implement the component with grouped props interface above
- [ ] Pill toggle: "Estimate for me" / "I know my balances"
- [ ] Estimate state: read-only display card with `estimate.total` + `estimate.split` breakdown, mortgage checkbox + CurrencyInput
- [ ] Know state: sub-pill "Total" / "By account"
  - Total: single CurrencyInput
  - Breakdown: OA/SA/MA CurrencyInputs + RA (only when `showRA`)
  - MA validated against `MEDISAVE_BHS`
- [ ] Use existing shared components: `CurrencyInput`, `NumberInput`, `InfoTooltip`

### Task 2: Integrate into SetupPage

**Files:**
- Modify: `frontend/src/pages/SetupPage.tsx`

- [ ] Simplify the CPF screen definition to just the title (no fields — custom content handles everything):
  ```typescript
  { id: 'cpf', title: 'Your CPF', fields: [], skipWhen: { field: 'residency', equals: 'foreigner' } }
  ```
- [ ] Add CPF-related values to INITIAL_VALUES:
  ```typescript
  cpfMode: 'estimate',       // 'estimate' | 'know'
  cpfEntryMode: 'total',     // 'total' | 'breakdown'
  cpfTotal: 0,
  cpfOA: 0, cpfSA: 0, cpfMA: 0, cpfRA: 0,
  usedOaForMortgage: false,
  oaMortgageAmount: 0,
  ```
- [ ] Render `CpfSetupInput` as `children` of `SetupScreen` when current screen is 'cpf'
- [ ] Compute estimate via pure function in the render (for display in CpfSetupInput):
  ```typescript
  const estimate = useMemo(() => estimateCpfBalances(
    age, grossAnnualIncome, residency, undefined,
    values.usedOaForMortgage ? values.oaMortgageAmount : undefined
  ), [age, grossAnnualIncome, residency, values.usedOaForMortgage, values.oaMortgageAmount])
  ```
- [ ] Update `draftFromValues` to handle the 3 modes using `cpfBreakdown`:
  ```typescript
  // Estimate mode:
  draft.cpfTotal = estimate.total
  draft.cpfBreakdown = { oa: estimate.oa, sa: estimate.sa, ma: estimate.ma, ra: estimate.ra }

  // Know/Total mode:
  draft.cpfTotal = values.cpfTotal
  draft.cpfBreakdown = undefined  // let applySetupDraft use splitCpfByAge

  // Know/Breakdown mode:
  draft.cpfTotal = oa + sa + ma + ra
  draft.cpfBreakdown = { oa, sa, ma, ra }  // exact user values
  ```
- [ ] Modify `setupDraft.ts`: add `cpfBreakdown` to `SetupDraft` interface and update `applySetupDraft` to use it when present (see Data Flow section above)

### Task 3: Update hydration for redo

**Files:**
- Modify: `frontend/src/pages/SetupPage.tsx`

- [ ] In `hydrateDraftToValues`, always hydrate to "know/breakdown" when CPF data exists (since we can't distinguish estimate from manual after the fact — accept this limitation):
  ```typescript
  const selfAdult = plan.adults.find(a => a.owner === 'self')
  const cpfTotal = selfAdult ? (selfAdult.cpf.balances.oa + selfAdult.cpf.balances.sa + selfAdult.cpf.balances.ma + selfAdult.cpf.balances.ra) : 0
  values.cpfMode = cpfTotal > 0 ? 'know' : 'estimate'
  values.cpfEntryMode = cpfTotal > 0 ? 'breakdown' : 'total'
  values.cpfOA = selfAdult?.cpf.balances.oa ?? 0
  values.cpfSA = selfAdult?.cpf.balances.sa ?? 0
  values.cpfMA = selfAdult?.cpf.balances.ma ?? 0
  values.cpfRA = selfAdult?.cpf.balances.ra ?? 0
  values.cpfTotal = cpfTotal
  ```
  **Limitation:** Cannot distinguish "user entered these exact values" from "estimate produced these values." Redo always shows breakdown with existing values. This is acceptable — the user can switch back to estimate mode if they want.

### Task 4: Tests

- [ ] Test: `estimateCpfBalances` — covered in Task 0 (6 tests)
- [ ] Test: know/total mode → `draft.cpfBreakdown` is undefined, `draft.cpfTotal` is user value
- [ ] Test: know/breakdown mode → `draft.cpfBreakdown` has exact OA/SA/MA/RA, `draft.cpfTotal` is sum
- [ ] Test: estimate mode → `draft.cpfBreakdown` has estimated split with mortgage adjustment
- [ ] Test: `applySetupDraft` with `cpfBreakdown` → uses exact values, not `splitCpfByAge`
- [ ] Test: `applySetupDraft` without `cpfBreakdown` → falls back to `splitCpfByAge`
- [ ] Test: MA validation rejects > MEDISAVE_BHS ($79,000)
- [ ] Test: RA field hidden when age < 55 (component test)
- [ ] Test: hydration always shows breakdown when CPF data exists

### Task 5: Integration test

- [ ] Test: individual setup with estimate CPF → projection has no errors, CPF included in chart
- [ ] Test: individual setup with breakdown CPF → exact balances preserved in plan

---

## Dependencies

- `CPF_HEURISTIC_SPLIT` from `lib/data/cpfRates.ts` (already exists)
- `MEDISAVE_BHS` from `lib/data/healthcarePremiums.ts` (already exists)
- CPF total contribution rate by age — need to either export a `getCpfTotalRate(age)` from cpfRates.ts or compute inline from existing employee+employer rate tables

## Risk

- The estimate formula (`yearsWorked * income * rate * 0.7`) is a rough heuristic. It doesn't account for salary growth over career, income changes, or voluntary top-ups. This is acceptable for a quick setup estimate — the CPF refine flow (`/refine/cpf`) replaces it with actuals.
- The mortgage OA deduction is also rough — it doesn't account for accrued interest on OA withdrawals (which CPF Board tracks). For accuracy, users should enter exact balances on the CPF details page.
