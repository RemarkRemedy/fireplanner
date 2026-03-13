# ILP Multi-Account Structure Kernel Execution Spec

Last updated: 2026-03-13

## Goal

Promote the validated `multi-account-special-account` family from ad hoc product-specific handling to one reusable runtime kernel that sits on top of the completed core cashflow kernel.

This slice is not a general protection-state expansion.

It is a bounded structural kernel for products where:
- regular premiums are routed across more than one primary account
- top-ups or supplementary premiums route into a distinct account
- recurring charges, withdrawals, and fallback deductions interact across that account set
- the product remains within ILP fee-drag / surrender economics rather than broad death-benefit modeling

## Why This Is Next

The validated classifier now has:
- `58` standard 2-account core cashflow
- `5` multi-account / special-account
- `29` protection-heavy / death-benefit

The first vertical `core-cashflow-kernel` slice is complete and green. The next highest-yield bounded family is `multi-account-special-account`.

It is small enough to scope tightly and already partially proven in the current runtime through Prudential product-specific flows.

## Named Proof Products

This slice must be proven against these products:

1. `prudential-pruvantage-wealth-ii`
- current status: `supported`
- reason: existing multi-account golden coverage already exists and is the stable baseline

2. `prudential-pruvantage-prosper`
- current status: `partial`
- reason: same structural family as Wealth II, but still not yet promoted to supported

3. `prudential-pruvantage-assure-ii`
- current status: `partial`
- reason: same structural family with additional bounded assurance-state behavior already modeled as a subset

4. `prudential-pruvantage-assure-sp`
- current status: `not-in-catalog`
- reason: validates whether the kernel can absorb the Prudential multi-account family beyond the currently seeded products
- execution note: this product is not a Step 1 / Step 2 runtime target because it has no catalog/parser entry yet
- handle it only after the normalized structure is proven on the 3 existing catalog-backed Prudential products
- expected landing point:
  - parser addition in Step 3 if the kernel is already stable
  - otherwise defer to Step 4 review without blocking the runtime refactor

5. `tokio-marine-wealth-pro-ii`
- current status: `partial`
- reason: already has parser/runtime subset coverage and existing golden fixtures, so it is the cleanest non-Prudential structural proof product

## Structural Family Contract

A product belongs in this kernel when all of the following are true:
- it has more than two economically distinct accounts
- at least one account has separate routing semantics from regular premium routing
- withdrawal / charge / fallback behavior depends on account role, not just account balance
- the fee-drag and surrender model remains meaningful without full protection-state expansion

Examples this kernel must support:
- Growth Account + Flex Account + Additional Investment Account
- Initial Units / additional account structures where supplementary premiums and fallback deductions are structurally separate

Examples explicitly out of scope:
- multi-life state machines
- death-benefit option switching
- capital-guarantee option economics
- broader protection-state dependent benefit calculations

## Current Runtime State

The current engine already has partial ingredients:
- more than two accounts are supported mechanically
- contribution routing phases exist
- top-up routing exists
- fallback deduction exists
- recurring and event charge paths are unified under the core cashflow kernel
- some Prudential multi-account assumptions are encoded through parser/template data rather than a named structural kernel

That means this slice is a consolidation/generalization task, not a greenfield build.

## Keep vs Replace

### Keep

Keep these authored/runtime surfaces:
- `accounts`
- `contributionRules`
- `chargeRules`
- `eventChargeRules`
- `policyEvents`
- fallback deduction semantics already in the cashflow kernel
- regular-premium split semantics for current Prudential products

Keep these products green while refactoring:
- `prudential-pruvantage-wealth-ii`
- all currently declared golden fixtures for supported products

### Replace / Generalize

Replace product-shaped branching with a named internal multi-account structure model that makes these concepts explicit:
- account role
  - primary regular-premium account
  - secondary regular-premium account
  - supplementary / additional account
- routing intent by premium type
  - regular premium
  - top-up premium
  - recurring single premium
  - premium-holiday repayment
- fallback deduction order
- withdrawal eligibility scope
  - which accounts count for free-withdrawal windows
  - which accounts reduce protection-linked state versus which do not
- account-scoped charge applicability
  - which recurring charges apply only to primary accounts
  - which charges exclude supplementary accounts

The runtime should evaluate these through one normalized structure, not by repeatedly inferring the same roles from ad hoc product assumptions.

## Internal Kernel Model

Add one internal normalized structure for multi-account products, for example:
- normalized account roles
- normalized routing groups
- normalized deduction order
- normalized withdrawal scope groups

Important constraint:
- do not add a second public schema abstraction
- public authored surfaces remain the same unless a new field is strictly necessary
- this kernel should normalize existing parser/store input, not replace it

## Scope Decisions

### In Scope

1. Explicit normalized account roles
- identify which accounts are:
  - regular-premium receiving accounts
  - supplementary premium receiving accounts
  - fallback deduction accounts
  - withdrawal-charge target accounts

2. Generalized routing groups
- regular premiums can intentionally split across multiple primary accounts
- supplementary premiums can intentionally route to a distinct account group
- repayments must reuse the product’s regular-premium routing intent where source docs require it

3. Generalized fallback deduction order
- recurring charges and event charges must be able to express ordered fallback across grouped accounts
- preserve current supported-product economics exactly

4. Account-scoped withdrawal semantics
- distinguish withdrawals that affect only primary accounts from those that can also hit supplementary accounts
- express this structurally rather than parser-specific conditionals

5. Golden proof expansion
- extend golden coverage for the named proof products above
- no product promotion to `supported` until the kernel-backed coverage exists

### Out of Scope

- new protection-state modeling
- new assurance-charge formulas
- distribution/dividend assumptions
- bonus-engine redesign beyond what is required to preserve current multi-account bonus targeting
- broad parser expansion across the whole corpus

## Acceptance Criteria

This slice is complete only if all are true:

1. There is one clear normalized internal path for multi-account role resolution and routing/deduction grouping.
2. Current supported multi-account product outputs do not regress.
3. The named Prudential partial products can be expressed through the same kernel without product-specific runtime branches.
4. One Tokio proof product demonstrates the kernel is not Prudential-only.
5. Golden coverage is extended for every product/variant promoted by this slice.

## Golden Proof Set

At minimum, extend coverage for:

### Existing supported baseline
- existing `prudential-pruvantage-wealth-ii` full-supported-gate fixtures must remain green

### New subset or promotion fixtures
- one baseline multi-account routing scenario for `prudential-pruvantage-prosper`
- one event-heavy multi-account scenario for `prudential-pruvantage-assure-ii`
- one structural proof scenario for `prudential-pruvantage-assure-sp`
- one non-Prudential proof scenario for the chosen Tokio product

Each new fixture must assert at least one structural kernel behavior directly, for example:
- supplementary account excluded from a recurring charge
- fallback deduction hits the supplementary account after primary accounts exhaust
- withdrawal scope excludes the supplementary account where the source requires it
- repayment allocation returns only to primary routing accounts

## Continuous Invariants

These must remain true throughout implementation, not only at the end:
- existing `npm run golden:check` remains green after each checkpoint
- existing supported-product opportunity-cost outputs remain stable
- assurance-charge outputs remain stable for already modeled products
- do not change premium-holiday behavior from year-bucketed handling
- do not widen any product from `partial` to `supported` without matching golden coverage

## Implementation Sequence

### Step 1. Normalize multi-account role metadata internally
- add one internal normalization layer on top of existing accounts/rules
- identify primary, supplementary, fallback, and withdrawal-scope roles from current authored inputs
- no public schema changes unless strictly required

### Step 2. Route existing multi-account logic through the normalized structure
- refactor routing, fallback deduction, and withdrawal-scope evaluation to use the normalized roles/groups
- preserve current Prudential outputs exactly

### Step 3. Prove non-Prudential applicability
- use `tokio-marine-wealth-pro-ii` as the fixed non-Prudential proof product
- wire its existing subset through the same normalized structure
- add targeted fixture coverage proving the structure is generic
- if the kernel is stable after that, add `prudential-pruvantage-assure-sp` as the first new parser-backed multi-account product

### Step 4. Review promotions
- only after the above is green, decide whether any current `partial` Prudential multi-account products move to `supported`
- promotion decision must be based on modeled-boundary truth, not parser completeness alone

## Verification Plan

Minimum verification for each step:
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run src/lib/calculations/ilp.test.ts`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run src/lib/calculations/ilp.golden.test.ts`

Final gate for the slice:
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run golden:check`

## Non-Goals

This slice must not turn into:
- assurance-charge redesign
- protection-benefit modeling
- distribution-mode modeling
- a generic parser expansion project

If implementation pressure starts forcing those concerns in, stop and split the workstream instead of smuggling them into the multi-account kernel.
