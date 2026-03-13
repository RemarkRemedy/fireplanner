# ILP Core Cashflow Kernel Execution Spec

Last updated: 2026-03-13

## Purpose

This spec defines the first vertical implementation slice of the validated `core-cashflow-kernel`.

This slice is intended to replace ad hoc, insurer-specific cashflow branching with one reusable kernel for:

- recurring and scheduled contribution routing
- recurring and event-driven charges
- premium-holiday state transitions

This spec exists before coding because the current engine already contains partial implementations of these mechanics. The main risk is not missing features; it is refactoring the wrong things or duplicating rule paths.

## Preconditions

These are already true:

- the family classifier is validated enough to drive sequencing
- current execution source of truth:
  - `frontend/scripts/ilp-catalog/fixtures/audit/family-classification.json`
- current validated split:
  - `58` standard 2-account core cashflow
  - `5` multi-account / special-account
  - `29` protection-heavy / death-benefit
- current validated boundary:
  - `2` supported-now
  - `61` supported-after-kernel
  - `29` partial-v1

## Scope

This slice includes exactly:

1. Generalized charge objects
2. Routing phases
3. Premium-holiday state transitions
4. Golden proof on three named products

This slice does **not** include:

- new protection-state modeling
- death-benefit option modeling
- capital-guarantee logic
- distribution-mode assumptions
- bonus-engine expansion beyond what is required to keep existing behavior working
- new parser families outside the three proof products

## Named Proof Products

The golden proof set for this slice is fixed now:

1. Standard/core proof
   - `hsbc-life-wealth-accelerate`
   - reason: currently `supported`, standard/core family, already strongly golden-gated

2. Multi-account proof
   - `prudential-pruvantage-wealth-ii`
   - reason: currently `supported`, multi-account family, existing golden coverage exercises routing + holiday behavior

3. Partial cohort proof
   - `tokio-marine-wealth-pro-ii`
   - reason: current partial product with existing subset fixtures and strong shortfall / recurring-single-premium / holiday interactions

The goal is not to promote Tokio to `supported` in this slice. The goal is to prove the core cashflow kernel on a current partial cohort without widening scope.

## Layer Naming and Canonical Terms

This spec is written against the current `fireplanner-ilp` engine, which already has both catalog-layer and runtime-layer rule shapes.

The canonical naming for this slice is:

- catalog/template layer:
  - `feeRules`
  - template `eventChargeRules`
- runtime policy layer:
  - `chargeRules`
  - runtime `eventChargeRules`

Important distinction:

- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/templateToPolicy.ts` currently bridges catalog `feeRules` into runtime `chargeRules` via `mapFeeRulesToChargeRules()`
- this slice does **not** rename catalog inputs
- this slice unifies **runtime evaluation**, not catalog vocabulary

## Current Engine Surfaces

The current engine already has these relevant surfaces:

- `accounts[].contributionRules`
- runtime `chargeRules`
- `eventChargeRules`
- `policyEvents`
- premium-base charge rules
- assurance charge rules
- recurring-single-premium events
- top-up events
- premium-holiday, repayment, reduction, increase, and resumption events

Relevant files:

- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/validation/ilpSchema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/types.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/schema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/templateToPolicy.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilpGoldenFixtures.ts`

Important current behaviors already in the engine:

- routing share fallback in `getRuleShare()`:
  - use matching `contributionRules[].share` when present
  - otherwise fall back to `account.contributionShare`
- premium-holiday repayment target fallback:
  - use `event.accountId`
  - otherwise `aua`
  - otherwise first account
- top-up routing fallback:
  - explicit event target account when present
  - otherwise route through configured shares / fallback shares
- assurance charges are already evaluated separately in `computeAssuranceChargeByAccount()`

## Keep vs Replace

### Keep

These should survive this slice:

- `policyEvents` as the user-visible event input surface
- `accounts[].contributionRules` as the authored routing definition surface
- `account.contributionShare` as the fallback routing definition surface
- assurance-charge and premium-base rule data shapes
- premium-holiday repayment target fallback behavior
- top-up routing fallback behavior
- existing golden fixtures and supported-product public outputs
- store and schema persistence compatibility where possible

### Refactor / unify

These should be unified behind one runtime cashflow kernel:

- runtime `chargeRules`
- `eventChargeRules`
- routing logic for:
  - recurring premium
  - top-up
  - recurring single premium
  - after-ICP / after-MIP transitions
- premium-holiday suppression / repayment / restart handling

### Do not add another parallel abstraction

This slice should not create:

- a second separate charge engine beside `feeRules` / `eventChargeRules`
- a second routing system beside `contributionRules`
- insurer-specific holiday branching outside the generalized cashflow path

The target is a unified runtime layer, not another adapter stack.

## Preserved Runtime Semantics

This slice preserves the existing runtime semantics unless a golden-backed diff explicitly justifies a change.

### Premium-holiday semantics

Premium-holiday handling remains **year-bucketed** in this slice.

Specifically:

- keep the existing `getPremiumHolidayMonths()` / `getContributionPhaseMonths()` style of year-level month counting
- do **not** replace it with true policy-month state windows in this refactor
- do **not** reinterpret ICP / post-ICP routing around a new monthly state engine

Reason:

- the current engine already uses year-bucketed overlap counts
- replacing that with true windows would be a behavior change, not just a kernel refactor
- the goal of this slice is unification, not a silent timing-model rewrite

### Event charge windows

Current contract mismatch:

- template event-charge rules include `activeWindow`
- runtime `IlpEventChargeRule` does not

Decision for this slice:

- do **not** add runtime `activeWindow`
- keep runtime event-charge applicability driven by:
  - event trigger type
  - event overlap / year applicability
  - current runtime trigger semantics

If runtime `activeWindow` is ever added later, that is a separate schema/runtime slice with its own golden impact.

### Charge timing

This slice preserves current runtime ordering semantics.

That means:

- do not change when recurring contributions are resolved relative to returns and charge application
- do not change when event-triggered charges fire within the annual step
- do not change premium-base or assurance charge timing in this slice

If timing normalization is needed later, it must be treated as a separate golden-gated behavior change.

## Generalized Means

For this slice, “generalized” means:

### Charges

One runtime charge application path that can evaluate:

- recurring charges
- event-triggered charges
- year-tiered rates
- overlap-sensitive charges
- account-applied vs policy-applied charges

This does **not** require deleting current authored rule types immediately.

Chosen direction:

- refactor runtime evaluation first
- preserve existing authored schema shapes for now
- normalize runtime `chargeRules` and runtime `eventChargeRules` into one internal evaluation model inside `ilp.ts`

Why:

- it reduces churn in schema/store/catalog inputs
- it keeps current fixtures and parser outputs mostly stable
- it minimizes migration risk while still removing duplicated runtime logic

### Routing

One runtime routing path should handle:

- recurring monthly contribution
- phase changes:
  - `during-icp`
  - `after-icp`
  - `after-mip`
  - `top-up`
- event-scheduled recurring-single-premium routing
- top-up event routing

### Premium-holiday state

One runtime state machine should decide:

- whether scheduled recurring premium is active in the year
- whether recurring-single-premium is active in the year
- how repayment / restart hooks affect contribution flow
- how charge rules can read the active/overlap state

This slice should generalize state transitions, not every insurer-specific business rule.

## Explicit Charge Base Definitions

For this slice, the canonical contribution-linked charge bases are:

### `annual-contribution`

Recurring `chargeRules` with `basis: 'annual-contribution'` use the routed recurring contribution for that account/year produced by the existing recurring contribution resolver.

Included:

- scheduled recurring premium routed into the account for that year
- year-bucketed effects of premium holiday / reduction / increase on that recurring flow

Excluded:

- top-up events
- recurring-single-premium events
- premium-holiday repayment contributions
- other event-scheduled inflows

Reason:

- this preserves the current meaning of recurring contribution-linked charges
- event-driven inflows are already handled through event paths, not the recurring annual contribution basis

### Event-driven contribution-linked charges

Top-up, recurring-single-premium, repayment, and other event-specific charge bases remain event-driven in this slice.

They should not be silently absorbed into recurring `annual-contribution` charges just because the runtime kernel is being unified.

## Assurance-Charge Boundary

Assurance charges are **outside** the scope of this core-cashflow-kernel slice.

Explicitly:

- keep `computeAssuranceChargeByAccount()` separate in this slice
- do not fold protection / assurance math into the generalized cashflow kernel
- do not expand protection modeling as part of this refactor

Constraint:

- the unified cashflow kernel must not regress assurance-charge inputs or outputs
- golden outputs that include assurance effects must remain stable

## Out-of-Scope Semantics

These remain outside this slice:

- delayed/partial repayment variants not already modeled
- insurer-specific administrative restart conditions beyond a generic restart hook
- death-benefit payout calculations
- life-assured replacement mechanics
- distribution payout amount modeling

If a product requires those for correctness, it remains `partial`.

## Functional Goals

After this slice:

1. The engine should have one clear internal path for cashflow routing and cashflow-linked charges.
2. Existing supported products must remain golden-green without behavior regression.
3. `tokio-marine-wealth-pro-ii` should continue to work through the unified kernel with no loss of current modeled subset behavior.
4. The next kernel slice should be able to build on this layer instead of adding more branching.

## Implementation Plan

### Step 1. Add an internal normalized cashflow model

Inside `ilp.ts`, introduce an internal normalized representation for:

- recurring charge rules
- event-triggered charge rules
- contribution routes
- active policy-state year buckets

This is internal-only in this slice.

No user-facing schema redesign yet.

### Step 2. Normalize authored inputs into the internal model

Map current authored inputs into the new internal model:

- runtime `chargeRules` -> normalized recurring charge rules
- `eventChargeRules` -> normalized event charge rules
- `contributionRules` -> normalized route definitions
- `policyEvents` -> normalized year-bucketed state intervals and scheduled cashflow events

Preserve current fallback behavior explicitly during normalization:

- `contributionRules[].share` -> fallback to `account.contributionShare`
- repayment account target -> fallback to `event.accountId`, then `aua`, then first account
- top-up routing -> preserve explicit account targeting first, then share-based routing fallbacks

### Step 3. Replace duplicated runtime branches with normalized evaluation

Refactor the runtime so:

- recurring charges are applied through one evaluator
- event charges are applied through one evaluator
- contribution routing uses one phase/event-aware resolver
- premium-holiday state is consulted by both routing and charge evaluation

## Continuous Invariants

The following are invariants for every implementation stage in this slice, not just a final step:

- keep the public analyzer shape stable
- keep named golden proof fixtures green
- do not change authored schema contracts unless explicitly called out and migrated
- do not regress supported-product outputs while refactoring internals

Do not change the public analyzer shape in this slice:

- projections
- summary
- npvAnalysis
- opportunityCost

Any output changes must be deliberate and justified by golden diffs.

## Golden Proof Requirements

The slice is not complete until all of these are green:

### HSBC Wealth Accelerate

Preserve:

- `hsbc-life-wealth-accelerate-sgd-mip-25-baseline.json`
- `hsbc-life-wealth-accelerate-sgd-mip-25-event-heavy.json`
- `hsbc-life-wealth-accelerate-sgd-mip-25-holiday-no-repayment.json`
- `hsbc-life-wealth-accelerate-sgd-mip-30-baseline.json`
- `hsbc-life-wealth-accelerate-usd-mip-25-baseline.json`
- `hsbc-life-wealth-accelerate-usd-mip-30-baseline.json`
- `hsbc-life-wealth-accelerate-usd-mip-30-ocf-stress.json`

Reason:

- this proves standard-family routing + holiday paths remain intact

### PRUVantage Wealth II

Preserve:

- `prudential-pruvantage-wealth-ii-sgd-mip-5-baseline.json`
- `prudential-pruvantage-wealth-ii-sgd-mip-10-baseline.json`
- `prudential-pruvantage-wealth-ii-sgd-mip-15-baseline.json`
- `prudential-pruvantage-wealth-ii-sgd-mip-20-baseline.json`
- `prudential-pruvantage-wealth-ii-sgd-mip-20-ocf-stress-split.json`
- `prudential-pruvantage-wealth-ii-sgd-mip-25-baseline.json`
- `prudential-pruvantage-wealth-ii-sgd-mip-25-event-heavy.json`
- `prudential-pruvantage-wealth-ii-sgd-mip-25-holiday-fallback.json`

Reason:

- this proves multi-account routing + holiday behavior still works through the unified kernel

### Tokio Wealth Pro (II)

Preserve:

- `tokio-marine-wealth-pro-ii-sgd-mip-10-baseline.json`
- `tokio-marine-wealth-pro-ii-sgd-mip-10-event-heavy.json`
- `tokio-marine-wealth-pro-ii-sgd-mip-10-waived-charges.json`

Reason:

- this proves the unified kernel handles a current partial cohort with shortfall / holiday / recurring-single-premium interactions

## Verification Plan

Required:

- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run type-check:node`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run golden:check`

Targeted fixture checks:

- exact named proof fixtures listed above, with no substitutions

Targeted unit/regression checks:

- `src/lib/calculations/ilp.test.ts`
- `src/lib/calculations/ilp.golden.test.ts`
- `src/lib/ilp-catalog/templateToPolicy.test.ts`

## Acceptance Criteria

This slice is done when:

1. The runtime has one normalized internal cashflow kernel for routing + cashflow-linked charges.
2. No second parallel charge/routing abstraction was added.
3. All three named proof products remain green in the golden gate.
4. Existing supported products do not regress.
5. The resulting code makes the next kernel slice easier rather than adding more insurer branching.

## Explicit Non-Goal

This slice is not trying to make more products `supported` immediately.

It is trying to create the reusable kernel that the `61` `supported-after-kernel` products actually depend on.
