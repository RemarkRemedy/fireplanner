# ILP Assurance-Charge Kernel Execution Spec

Last updated: 2026-03-13

## Goal

Advance the assurance-charge kernel from bounded product-specific implementations to one reusable runtime layer for ILP products where insurance / assurance charges materially affect fee drag.

This slice is not a general protection-benefit expansion.

It is a bounded economics slice for products where:
- the published assurance / insurance charge materially affects accumulation and surrender economics
- the source provides deterministic charge tables or formulas
- the required state can be represented by explicit user-entered inputs and bounded policy events
- full death-benefit / ownership / rider option modeling is still intentionally out of scope

## Why This Is Next

The core cashflow kernel first vertical slice is complete.

The multi-account structure kernel first vertical slice is now complete with no new `supported` promotions. The remaining blockers on the current multi-account partial products are primarily:
- assurance-charge scope
- distribution-mode assumptions
- broader protection / ownership mechanics

The next highest-yield bounded workstream is therefore the assurance-charge kernel.

## Named Proof Products

This slice must be proven against these products:

1. `prudential-pruvantage-prosper`
- current status: `partial`
- reason: already has first-class rate-table-backed assurance charges and is the cleanest Prudential assurance baseline

2. `prudential-pruvantage-assure-ii`
- current status: `partial`
- reason: already has Appendix A total charge curve support plus bounded manual reduction/resumption events

3. `hsbc-life-flexi-protector`
- current status: analysis-only bounded target
- reason: it is the cleanest next non-Prudential assurance product because the death / TI charge side is source-complete and already partially implemented in runtime helpers

Optional later proof target after the kernel is stable:
4. `prudential-pruvantage-assure-sp`
- only if a catalog/parser entry is added after the kernel is green on the products above

## Structural Contract

A product belongs in this kernel when all are true:
- assurance / insurance charges are economically material during accumulation
- the charge formula can be expressed from published rate tables or deterministic formula rules
- the required protection state can be represented as explicit inputs and bounded events
- the product can still be presented honestly as fee-drag / surrender modeling without claiming full protection-state coverage

Examples in scope:
- Prudential age-based assurance charge curves and sum-at-risk formulas
- HSBC Flexi death / TI COI based on a selected cover option and explicit sum-assured inputs

Examples out of scope:
- multi-life state evolution
- change-of-life-assured state machines beyond explicit metadata-only boundaries
- rider-linked assurance changes
- full death-benefit option modeling and payout simulation
- protection options whose charge basis is not source-complete enough to encode safely

## Current Runtime State

What already exists:
- Prosper assurance charges from explicit rate tables plus life-assured inputs
- Assure II assurance charges from Prudential Appendix A total rate curve
- Growth/Flex first then Additional-account fallback for Prudential
- bounded manual reduction / resumption events for Assure II
- bounded HSBC Flexi death / TI COI formulas and rate-table support in runtime/data

What is still fragmented:
- assurance logic still sits as product-shaped formulas rather than one normalized assurance kernel contract
- supported vs partial boundary for assurance products is still mostly product-local
- non-Prudential assurance proof coverage is not yet formalized in the golden gate

## Keep vs Replace

### Keep

Keep these authored surfaces:
- `assuranceProfile`
- existing `chargeRules` with `basis: 'assurance-sum-at-risk'`
- bounded protection-state events already modeled:
  - `assurance-benefit-reduction`
  - `assurance-benefit-resumption`

Keep these runtime boundaries:
- assurance charges remain a distinct evaluation path from the core cashflow kernel
- year-bucketed cashflow behavior stays unchanged
- no new public schema unless a new assurance input is strictly necessary

Keep these products green while refactoring:
- all current supported products
- current Prudential partial-subset golden fixtures

### Replace / Generalize

Replace product-shaped assurance branching with one normalized internal assurance model that makes these concepts explicit:
- assurance profile requirements by formula family
- sum-at-risk basis by formula family
- deduction order across account groups
- bounded frozen / resumed protection state where already modeled
- rate-table lookup contract

The runtime should evaluate assurance charges through one internal normalization layer, not by scattering formula-specific assumptions across helpers.

## Internal Kernel Model

Add one internal normalized assurance structure, for example:
- assurance formula family
- normalized required profile inputs
- normalized protection-state inputs at projection start
- normalized per-year charge basis
- normalized deduction order

Important constraints:
- do not collapse assurance charges into the core cashflow kernel
- do not add a second public schema abstraction unless a missing input is unavoidable
- do not widen the modeled protection boundary just to make the kernel look cleaner

## Scope Decisions

### In Scope

1. Unified normalized assurance input model
- one internal layer that validates and resolves the required assurance inputs for each supported formula family

2. Unified rate-table-backed assurance evaluation path
- Prosper and Assure II continue through the same normalized evaluator
- HSBC Flexi death / TI formulas are brought under the same internal assurance path

3. Unified deduction-order handling for assurance charges
- preserve current Prudential Growth/Flex then Additional fallback
- preserve current bounded HSBC behavior
- express this structurally instead of product-local helper branching

4. Golden proof expansion
- add or extend fixtures so assurance behavior is proven on the named products
- no support promotion without matching golden coverage

### Out of Scope

- TPD COI unless the sum-at-risk basis is pinned safely from source
- Wealth Share / Premium Pass / change-of-life-assured option-state expansion
- rider interactions
- death-benefit payout simulation
- distribution-mode assumptions

## Acceptance Criteria

This slice is complete only if all are true:

1. There is one clear normalized internal path for assurance profile resolution and rate-table-backed charge evaluation.
2. Existing Prudential assurance outputs do not regress.
3. HSBC Flexi death / TI assurance formulas run through the same normalized assurance path.
4. The golden gate proves assurance behavior on the named products.
5. No product is promoted to `supported` unless its remaining blockers are outside the assurance kernel.

## Golden Proof Set

At minimum, maintain or extend coverage for:
- existing Prudential partial-subset fixtures:
  - `prudential-pruvantage-prosper-sgd-mip-25-assurance-active.json`
  - `prudential-pruvantage-assure-ii-sgd-mip-25-assurance-tail.json`
  - `prudential-pruvantage-assure-ii-sgd-mip-25-assurance-state-override.json`

Add one bounded non-Prudential proof fixture for:
- `hsbc-life-flexi-protector`
  - only for the already-bounded death / TI COI subset
  - do not include TPD until the source basis is defensible
  - execution note: this does not require a catalog/parser entry in this slice
  - the Step 3 proof may use a manually-constructed golden fixture around the bounded runtime-supported death / TI subset
  - only add a catalog/parser entry later if the modeled boundary remains clean after the kernel is proven

Each proof fixture must assert at least one assurance behavior directly, for example:
- rate-table-driven charge rises along the projected age path
- manual reduction freezes automatic growth and lowers later assurance charges
- resumption restores a higher later charge path from the next projection year
- bounded HSBC Choice / Max cover formulas produce distinct charge outcomes from the same starting balances

## Continuous Invariants

These remain true throughout implementation:
- existing `npm run golden:check` remains green after each checkpoint
- supported-product opportunity-cost outputs remain stable
- core cashflow kernel outputs remain stable
- do not widen a product from `partial` to `supported` without golden coverage and an explicit modeled-boundary review
- keep protection-state options outside the kernel unless source-complete and intentionally scoped in

## Implementation Sequence

### Step 1. Normalize assurance metadata internally
- add one internal assurance normalization layer on top of current `chargeRules`, `assuranceProfile`, and bounded assurance-state events
- no public schema changes unless a missing input is unavoidable

### Step 2. Route existing Prudential assurance logic through the normalized path
- Prosper and Assure II must use the same normalized evaluator and deduction-order handling
- preserve current outputs exactly

### Step 3. Bring HSBC Flexi death / TI subset under the same path
- reuse the existing bounded formulas and rate tables
- prove that the assurance kernel is not Prudential-only
- do not include TPD in this step

### Step 4. Review promotions
- only after the above is green, decide whether any current partial products can move to `supported`
- if remaining blockers are still distribution / ownership / protection-state mechanics, keep them `partial`

## Verification Plan

Minimum verification for each step:
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run src/lib/calculations/ilp.test.ts`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run src/lib/calculations/ilp.golden.test.ts`

Final gate for the slice:
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run golden:check`

## Non-Goals

This slice must not turn into:
- full protection-state modeling
- multi-life support
- rider modeling
- distribution-mode redesign
- a broad parser expansion project

If implementation pressure starts forcing those concerns in, stop and split the workstream instead of hiding them inside the assurance kernel.
