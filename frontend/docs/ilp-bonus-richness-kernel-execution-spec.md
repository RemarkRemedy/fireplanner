# ILP Bonus-Richness Kernel Execution Spec

Last updated: 2026-03-13

## Goal

Advance bonus modeling from product-shaped bonus helpers to one reusable runtime layer for ILP products where bonus mechanics materially change fee drag, surrender economics, or hold-vs-exit comparisons.

This is not a generic “model every marketing bonus” expansion.

It is a bounded kernel slice for bonuses that:
- are source-complete enough to encode deterministically
- materially affect account value growth
- can be expressed through published schedules, tiers, suspension rules, and restoration rules
- can consume already-normalized cashflow state instead of re-deriving premium-holiday and routing behavior independently

## Why This Is Next

The core cashflow kernel is now stable and unified.

That matters because bonus calculations depend on:
- correct per-year routed premium amounts
- correct year-level premium-holiday suppression / repayment state
- correct account balances after charges and withdrawals
- stable event applicability

The bonus-richness overlay touches `46` products in the classified corpus. It is therefore the next highest-yield bounded workstream after:
- core cashflow kernel
- multi-account structure kernel
- first vertical assurance-charge kernel

## Named Proof Products

This slice must be proven against these products:

1. `hsbc-life-wealth-accelerate`
- current status: `supported`
- reason: already has bonus suspension / restoration logic in the current supported set and is the best regression anchor for “do not break existing bonus paths”

2. `hsbc-life-wealth-abundance`
- current status: `partial`
- reason: exercises tiered startup bonus, power-up restoration, loyalty suspension, and free-withdrawal interactions

3. `tokio-marine-wealth-pro-ii`
- current status: `partial`
- reason: exercises tiered initial bonus plus performance, loyalty, and power-up bonus families in a non-HSBC structure

Optional later proof targets after the kernel is green:
4. `hsbc-life-wealth-voyage`
5. `tokio-marine-wealth-max-ii`

## Structural Contract

A product belongs in this kernel when all are true:
- bonus value is economically material during accumulation or MIP-end comparison
- the bonus schedule can be represented by deterministic tiers or event-linked rules
- the bonus depends on cashflow state that the runtime already models or can expose cleanly
- the product can still be presented honestly without inventing unsupported bonus assumptions

Examples in scope:
- annual-rate bonuses with premium-based or account-value-based tiers
- premium-allocation and one-time bonuses
- bonus suspension on published triggers like:
  - premium holiday
  - partial withdrawal
  - regular premium reduction
- bonus restoration on published repayment / recovery events where the source contract is deterministic

Examples out of scope:
- discretionary / insurer-declared bonus amounts
- fund-distribution / dividend behavior disguised as bonus modeling
- option-state bonus effects whose prerequisites are not modeled safely
- any bonus rule that depends on unsupported rider, multi-life, or full death-benefit state

## Current Runtime State

What already exists:
- `annual-rate`, `premium-allocation`, and `one-time` bonus modes
- tiered bonus rates
- account-value-banded and annual-premium-banded bonus tiers
- suspension rules
- restoration rules
- seeded modeled bonus subsets for:
  - HSBC Wealth Accelerate
  - HSBC Wealth Harvest
  - HSBC Wealth Abundance
  - HSBC Wealth Voyage
  - Tokio Wealth Max (II)
  - Tokio Wealth Pro (II)

What is still fragmented:
- bonus eligibility and credit basis are still resolved in product-shaped combinations instead of one normalized internal bonus model
- suspension / restoration logic still reaches directly into raw policy-event semantics in places where it should read the normalized cashflow-state surface
- product coverage still depends on local bonus-specific assumptions rather than a single bounded kernel contract

## Keep vs Replace

### Keep

Keep these authored surfaces:
- `bonuses`
- `tieredRates`
- `suspensionRules`
- `restorationRules`

Keep these public rule concepts:
- `annual-rate`
- `premium-allocation`
- `one-time`
- premium-band tiers
- account-value-band tiers

Keep these runtime boundaries:
- the cashflow kernel remains the source of truth for:
  - routed premium amounts
  - premium-holiday month counts
  - repayments
  - reduction / increase state
  - event applicability by year
- bonus logic consumes those normalized signals through an explicit interface
- bonus logic must not reimplement holiday or routing semantics locally

Keep these products green while refactoring:
- all current supported products
- existing bonus-related partial-subset golden fixtures

### Replace / Generalize

Replace product-shaped bonus branching with one normalized internal bonus model that makes these concepts explicit:
- credit basis
- tier selector basis
- eligible account targets
- effective annual eligible premium amount
- effective account-value basis
- suspension-state input
- restoration-state input

The runtime should resolve bonus credit through one internal normalization layer, not by scattering insurer-specific assumptions across helper branches.

## Explicit Interface Decision

The bonus kernel will not read raw `policyEvents` directly as its primary state input.

It will consume a defined normalized cashflow-state interface produced by the core cashflow kernel, for example:
- year context
- annual routed premium by account
- annual premium paid / suppressed / repaid
- premium-holiday months in year
- trigger activity flags for:
  - partial withdrawal
  - premium holiday
  - premium-holiday repayment
  - regular premium reduction
  - regular premium increase
  - top-up

Reason:
- the cashflow kernel already owns the conservative year-bucketed semantics
- bonus logic should not fork those semantics and drift
- this keeps the boundary stable as more products adopt the kernel

## Internal Kernel Model

Add one internal normalized bonus structure, for example:
- normalized bonus family / mode
- normalized target accounts
- normalized tier basis
- normalized credit basis
- normalized suspension triggers
- normalized restoration basis

Important constraints:
- do not create a second public bonus schema
- do not re-derive holiday or routing state from raw events inside the bonus evaluator
- do not widen the modeled boundary just to fit a specific product’s marketing wording

## Scope Decisions

### In Scope

1. Unified normalized bonus input model
- one internal layer for all authored bonus rules

2. Unified tier resolution
- premium-band tiers
- account-value-band tiers
- preserve current behavior for already-modeled products

3. Unified suspension / restoration evaluation
- consume normalized cashflow-state signals
- preserve year-bucketed trigger behavior unless explicitly changed later by a spec

4. Golden proof expansion
- extend or refresh fixtures so the named products prove:
  - tier selection
  - suspension behavior
  - restoration behavior
  - non-HSBC bonus structure coverage

### Out of Scope

- distribution / dividend mode
- discretionary loyalty / terminal bonuses not source-complete enough to encode
- rider-linked bonus changes
- full protection-state-dependent bonus options
- new parser expansion beyond what is needed to keep the named proof products coherent

## Acceptance Criteria

This slice is complete only if all are true:

1. There is one clear normalized internal path for bonus eligibility, tier selection, suspension, restoration, and credit allocation.
2. Supported-product bonus outputs do not regress.
3. The bonus kernel reads normalized cashflow state through a defined interface instead of re-deriving raw event semantics.
4. HSBC and Tokio bonus subsets both run through the same normalized bonus path.
5. The golden gate proves the named bonus behaviors on the named proof products.
6. No product is promoted to `supported` unless its remaining blockers are outside the bonus kernel.

## Golden Proof Set

At minimum, maintain or extend coverage for:
- existing supported fixtures:
  - `hsbc-life-wealth-accelerate-sgd-mip-25-event-heavy.json`
  - `hsbc-life-wealth-accelerate-sgd-mip-25-holiday-no-repayment.json`
- existing partial fixtures:
  - `hsbc-life-wealth-abundance-sgd-mip-10-event-heavy.json`
  - `tokio-marine-wealth-pro-ii-sgd-mip-10-baseline.json`
  - `tokio-marine-wealth-pro-ii-sgd-mip-10-event-heavy.json`

Add or extend integrity assertions so the proof set explicitly checks:
- tier choice changes the credited bonus amount
- premium holiday suppresses a bonus when the product says it should
- repayment / restoration restores a materially higher later bonus path when the product says it should
- Tokio non-HSBC bonus families (initial / performance / loyalty / power-up) all remain active on the normalized path

## Continuous Invariants

These remain true throughout implementation:
- `npm run golden:check` remains green after each checkpoint
- supported-product opportunity-cost outputs remain stable
- core cashflow kernel outputs remain stable
- assurance-charge outputs remain stable
- do not widen a product from `partial` to `supported` without golden coverage and explicit modeled-boundary review

## Implementation Sequence

### Step 1. Normalize bonus metadata internally
- add one internal bonus normalization layer on top of current `bonuses`
- no public schema changes unless a missing authored concept is unavoidable

### Step 2. Route existing HSBC bonus subsets through the normalized path
- preserve current outputs exactly
- do not change supported-product economics

### Step 3. Route Tokio bonus subsets through the same path
- prove the kernel is not HSBC-specific
- preserve existing bonus-ladder outputs

### Step 4. Expand and tighten golden proof assertions
- ensure the named proof fixtures directly assert the intended bonus behaviors

### Step 5. Review promotions
- only after the above is green, decide whether any current partial products can move to `supported`
- if remaining blockers are still outside bonus logic, keep them `partial`

## Verification Plan

Minimum verification for each step:
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run src/lib/calculations/ilp.test.ts`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run src/lib/calculations/ilp.golden.test.ts`

Final gate for the slice:
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run golden:check`

## Non-Goals

This slice must not turn into:
- distribution-mode modeling
- full product marketing bonus coverage
- protection-state redesign
- a new public bonus DSL
- a broad parser expansion effort

If implementation pressure starts forcing those concerns in, stop and split the workstream instead of hiding them inside the bonus kernel.
