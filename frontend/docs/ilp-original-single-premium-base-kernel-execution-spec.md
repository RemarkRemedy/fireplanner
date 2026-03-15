# ILP Original Single-Premium Base Kernel Execution Spec

Last updated: 2026-03-16

## Goal

Add one bounded kernel slice for open-ended single-premium ILP products that publish:

1. recurring establishment charges as a percentage of the original initial single premium paid on commencement date, and/or
2. surrender charges as a percentage of that same original initial single-premium base

This slice exists because parser throughput has now hit the same honest blocker on multiple otherwise parser-ready Tokio Marine open-ended single-premium products:

- `#goElite`
- `#goElite Secure`
- `#goWealth Enrich`

All three already fit the current open-ended single-premium basis for:

- zero or simple upfront allocation
- administrative account-value charges
- recurring-single-premium and top-up charge paths
- partial withdrawal handling
- distribution-mode assumption support

The shared missing mechanic is not parser extraction. It is the lack of a reusable runtime base for charges and surrender penalties that reference the original initial single premium rather than current account value.

## Why This Is Next

Recent parser throughput continued until the next three cheapest honest candidates failed for the same reason:

1. `tokio-marine-goelite`
2. `tokio-marine-goelite-secure`
3. `tokio-marine-gowealth-enrich`

Repeated source-backed blocker:

- current runtime can deduct a one-time upfront initial single-premium charge before units are created
- current runtime can deduct recurring account-value and annual-contribution charges
- current runtime can compute exit charges only from current subject-to-EEC account value
- current runtime cannot author recurring annualized charges against the original initial single premium paid on commencement date
- current runtime cannot compute surrender penalties against that original initial single-premium base for open-ended products

That is the mode-machine trigger to switch from parser throughput to kernel mode.

## Proof Products

### Mandatory proof parser

1. `tokio-marine-gowealth-enrich`
- cleanest proof target
- one open-ended single-premium cash corridor
- published recurring establishment charge on original initial single premium
- published surrender charge on original initial single premium
- already has executable admin-charge, top-up / recurring-single-premium, partial-withdrawal, and distribution-mode surfaces
- does not add MPC to the proof slice

### Immediate follow-on parsers after kernel commit

2. `tokio-marine-goelite`
3. `tokio-marine-goelite-secure`

These should fit immediately once the same original-single-premium base exists.

### Explicitly out of scope for this slice

- locked-in policy value mechanics
- monthly protection charge / sum-at-risk formulas
- loyalty bonus / paid-up qualification state
- fund switching, credit-card, third-party, or fund-level charges
- protection claim handling
- product promotion to `supported`

## Source-Backed Contract

The kernel must support this published pattern:

1. the customer pays one initial single premium at policy commencement
2. that commencement lump sum remains the contractual base for certain later charges
3. a recurring establishment charge is computed as `% per annum x original initial single premium`
4. the recurring charge is deducted from current account units over a bounded policy-year window
5. a surrender charge is computed as `% x original initial single premium`
6. the surrender charge applies over a bounded policy-year table that is independent of MIP semantics

Important distinctions:

- this is not the same as the existing one-time `initial-single-premium` inception deduction
- this is not an account-value charge
- this is not an annual-contribution charge
- this is not a fake finite-MIP product
- this is not current-account-value EEC

## Scope

This slice includes exactly:

1. one reusable recurring charge basis for the original initial single premium paid on commencement date
2. one reusable exit-charge basis for surrender penalties against the original initial single premium
3. contract/schema/template/runtime mapping for both new bases
4. direct calculator tests for recurring and surrender behavior
5. one proof parser consuming the new bases end-to-end

This slice does **not** include:

- principal-floor / capital-guarantee state
- MPC / assurance-charge expansion
- loyalty or achievement bonus qualification state
- rider administration
- manual claim events
- parser-specific hacks that bypass the shared basis

## Keep vs Add

### Keep

- existing `initial-single-premium` basis for one-time inception deductions
- existing `annual-contribution`, `account-value`, `fixed-annual`, and `premium-base-mip-multiplier` behavior
- existing open-ended no-MIP support
- existing top-up and recurring-single-premium event-charge behavior

### Add

#### 1. Recurring charge basis

Add one explicit recurring charge basis:

- `initial-single-premium-base`

Meaning:

- base amount is the original gross initial single premium paid on commencement date
- charge may recur annually over a bounded authored schedule
- charge amount does **not** shrink with current account value
- charge amount does **not** depend on current annual contribution

#### 2. Exit charge basis

Add one explicit surrender / exit charge basis:

- `exitChargeBasis: 'account-value' | 'initial-single-premium-base'`

Meaning:

- existing products default to `account-value`
- open-ended single-premium products may author `initial-single-premium-base`
- `eecTable` remains the authored rate schedule, but the charge base becomes configurable

### Reuse of existing input

Reuse `initialSinglePremium` as the persisted commencement lump sum base.

Rules:

- the field continues to represent the original gross initial single premium paid on commencement date
- the existing one-time inception deduction only fires when projection starts at true inception
- the same persisted value may still be needed after inception to evaluate original-base recurring charges and surrender penalties

Do not add a second parallel “original single premium” field unless implementation proves it is strictly necessary.

## Runtime Definition

### Recurring original-base charge

For any `chargeRule` with basis `initial-single-premium-base`:

1. read the persisted `initialSinglePremium`
2. resolve the authored annual rate for the current policy year
3. compute `charge = initialSinglePremium x rate`
4. allocate and deduct using the authored primary / fallback account order
5. do not mutate the stored base after deduction

### Exit charge on original base

For any policy with `exitChargeBasis === 'initial-single-premium-base'`:

1. resolve the current exit-charge rate from `eecTable`
2. compute `exitCharge = initialSinglePremium x exitChargeRate`
3. use that value for cancel-now penalty and projected surrender rows
4. do not derive exit charge from account value for that product

### Open-ended products

This slice must work when `mipBasis === 'open-ended'`.

Important:

- open-ended products still do not get fake MIP transitions
- open-ended products may still have a finite authored surrender-charge schedule through `eecTable`
- the exit-charge horizon must therefore be independent of MIP state

## Layer Contract

Expected touch points:

- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/ilp-catalog/types.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/ilp-catalog/schema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/validation/ilpSchema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/ilp-catalog/templateToPolicy.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilp.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilp.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/components/ilp/PolicyInputForm.tsx`

Required authored/runtime additions:

- `chargeRules[].basis` accepts `initial-single-premium-base`
- policy/runtime contract accepts `exitChargeBasis`
- validation permits rate schedules on `initial-single-premium-base`
- template mapping preserves both surfaces without coercing them into existing recurring bases
- UI warnings stop treating non-zero `initialSinglePremium` after inception as inherently wrong when original-base charges or surrender use it

## Acceptance Criteria

This slice is complete only if all are true:

1. The catalog/runtime contract can represent recurring charges on the original initial single-premium base.
2. The catalog/runtime contract can represent surrender penalties on that same base.
3. Existing account-value EEC products behave identically after the refactor.
4. Existing one-time `initial-single-premium` inception deduction products behave identically after the refactor.
5. Direct calculator tests prove recurring original-base charges run for the authored years only.
6. Direct calculator tests prove original-base surrender penalties apply correctly in cancel-now and projection rows.
7. `tokio-marine-gowealth-enrich` consumes the new bases and passes the full kernel gate.
8. `npm run golden:check` remains green.

## Direct Calculator Proof Requirements

At minimum add direct calculator tests for:

1. recurring original-single-premium-base charge over a 5-year schedule on an open-ended single-premium product
2. no regression for existing one-time `initial-single-premium` inception deductions
3. no regression for existing account-value exit-charge products
4. original-single-premium-base surrender penalty in both current summary and projected surrender rows

## Implementation Sequence

### Step 1. Extend authored/runtime contract

Add `initial-single-premium-base` and `exitChargeBasis`.

### Step 2. Update validation and template mapping

Allow the new basis to flow end-to-end and keep the UI honest about `initialSinglePremium`.

### Step 3. Extend runtime charge calculation

Evaluate recurring original-base charges without mutating the commencement lump sum.

### Step 4. Extend exit-charge calculation

Decouple exit-charge base from MIP semantics and current account value.

### Step 5. Add direct calculator tests

Protect both the new original-base charge and the existing single-premium deduction / account-value EEC paths.

### Step 6. Upgrade the proof parser

Wire `tokio-marine-gowealth-enrich` to author the establishment charge and surrender charge honestly.

### Step 7. Run the kernel gate

Only after runtime, tests, and proof parser are green should this slice proceed to staging and approval review.
