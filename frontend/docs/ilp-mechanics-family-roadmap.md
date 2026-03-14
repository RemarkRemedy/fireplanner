# ILP Mechanics Family Roadmap

Last updated: 2026-03-14

## Status

This document supersedes the older 7-family roadmap language.

The execution source of truth is now:

- product classification: `frontend/scripts/ilp-catalog/fixtures/audit/family-classification.json`
- classification summary: `frontend/docs/ilp-mechanics-family-classification.md`

Execution sequencing must read:

- `kernelWorkstreams` as the taxonomic set implied by a product's mechanics
- `remainingKernelBlockers` as the active execution blocker set after subtracting completed kernels and bounded-scope decisions

This roadmap now exists only to explain sequencing.

## Planning Model

The planning model has three layers:

1. `primaryFamily`
   Structural and mutually exclusive.

   - `standard-2-account-core-cashflow`
   - `multi-account-special-account`
   - `protection-heavy-death-benefit`

2. `overlayTags`
   Cross-cutting mechanics that can apply to any primary family.

   - `dynamic-charge`
   - `premium-holiday-recovery`
   - `ad-hoc-premium-routing`
   - `assurance-charge`
   - `bonus-richness`
   - `distribution-mode`
   - `protection-structure`
   - `payment-history`

3. `implementationCohort`
   Insurer-shaped rollout grouping. Useful for execution, not the canonical family axis.

## Current Baseline

- Summary corpus baseline: `92`
- Current catalog products: `56`
- Current `supported` products: `6`
- Structural family counts from the classifier:
  - `58` standard 2-account core cashflow
  - `5` multi-account / special-account
  - `29` protection-heavy / death-benefit

Most importantly:

- `supported-now` is `6`
- `supported-after-kernel` is `57`
- `partial-v1` is `29`

`supported-after-kernel` is a boundary label, not a one-step claim. Many of those products still require multiple workstreams.

## Kernel Workstreams

The classifier now compresses planning into real implementation tracks instead of pretending every overlay is independent.

### 1. Core cashflow kernel

This intentionally combines:

- dynamic charge modeling
- premium-holiday / refund / recovery state
- ad-hoc premium routing

Reason:

- these mechanics interact in the runtime
- the gap ranking already identified them as one monolithic workstream
- treating them as separate planning tracks would recreate the same fragmentation we are trying to remove

Current status:

- first vertical slice is complete and green
- completed scope:
  - unified internal runtime path for recurring routing
  - unified internal runtime path for recurring and event-driven cashflow-linked charges
  - premium-holiday state integration through the same normalized cashflow path
- verification:
  - targeted ILP unit tests green
  - `npm run golden:check` green

Remaining work in this workstream:

- broaden family-level adoption using the unified kernel
- remove remaining non-kernel helper duplication only where it improves clarity without changing economics
- use the now-stable kernel to promote the next validated family/cohort work instead of adding more bespoke routing/charge branches

### 2. Multi-account structure kernel

Needed when the structural family is `multi-account-special-account`.

Current status:
- first vertical slice complete
- green on:
  - `npm run type-check`
  - targeted ILP unit tests
  - targeted golden refresh / golden check

Completed in this slice:
- normalized internal multi-account role metadata
- normalized supplementary-routing and fallback-resolution path through the unified cashflow kernel
- non-Prudential structural proof coverage on `tokio-marine-wealth-pro-ii`

Promotion review result:
- `prudential-pruvantage-prosper` and `prudential-pruvantage-assure-ii` are now promotable with supported-grade golden coverage
- `tokio-marine-wealth-pro-ii` remains `partial`
- remaining blockers after this workstream are now mostly:
  - distribution-mode assumptions
  - broader protection-state / ownership mechanics

### 3. Assurance-charge kernel

Needed where insurance / assurance charges materially affect economics.

Current status:
- protected-base assurance slice complete
- green on:
  - `npm run type-check`
  - targeted ILP unit tests
  - `npm run golden:check`

Completed in this slice:
- one normalized internal assurance evaluation path for:
  - `prudential-pruvantage-prosper`
  - `prudential-pruvantage-assure-ii`
  - bounded `hsbc-life-flexi-protector` death / TI COI
  - paid-premium-floor protected-base COI formulas such as `Manulife InvestReady (III)`
  - sum-assured protected-base COI formulas such as `ManuInvest Duo`
- unified normalized assurance profile + state-event seam
- preserved Prudential fallback deduction order
- bounded non-catalog golden proof for HSBC Flexi Choice vs Max death / TI charges
- protected-base assurance proof coverage for uninterrupted payments, premium-holiday freeze, premium restart, and no regression of the existing assurance families

Promotion review result:
- the assurance kernel is no longer the primary blocker for:
  - `prudential-pruvantage-prosper`
  - `prudential-pruvantage-assure-ii`
- those two products now qualify for promotion after supported-grade golden expansion
- remaining blockers outside this kernel now concentrate in:
  - distribution-mode assumptions
  - broader protection-state / ownership mechanics
  - parser/catalog expansion where no safe public product entry exists yet

Immediate parser follow-ons after this slice:
- `manulife-manuinvest-duo`
- `GREAT Life Advantage 4` if it still fits without widening into non-lapse debt / continuation state

### 4. Bonus-richness kernel

Needed after the cashflow kernel is trustworthy.

Current status:
- first vertical slice complete
- green on:
  - `npm run type-check`
  - targeted ILP unit tests
  - `npm run golden:check`

Completed in this slice:
- one normalized internal bonus-evaluation path for:
  - HSBC bonus subsets
  - Tokio bonus subsets
- unified normalized tier resolution for:
  - annual-premium bands
  - account-value bands
- unified suspension / restoration evaluation against normalized cashflow-state signals
- tighter golden integrity assertions for:
  - HSBC Wealth Accelerate
  - HSBC Wealth Abundance
  - Tokio Wealth Pro (II)

Promotion review result:
- HSBC Wealth Harvest and HSBC Wealth Abundance are now `supported` under the explicit V1 reinvestment-default assumption for dividend-paying funds
- `tokio-marine-wealth-pro-ii` remains `partial`
- blocker is no longer bonus-richness itself; the remaining blockers are:
  - distribution-mode assumptions where no safe default has been adopted
  - broader protection-state / ownership mechanics
  - broader parser/catalog expansion where no safe supported boundary exists

### 5. Distribution-mode assumption model

Useful for fidelity, but not ahead of cashflow correctness.

### 6. Payment-history kernel

Needed for products whose economically material charges, penalty horizons, or bonus cadence are keyed to Premium Year / payment-history state rather than Policy Year alone.

Current status:
- first vertical slice complete
- green on:
  - `npm run type-check`
  - targeted ILP unit tests
  - `npm run golden:check`

Current mandatory proof target:
- `GBII`

Optional follow-ons after `GBII` is green and re-reviewed:
- `Investment-linked Insurance Plan 2`
- `GREAT Life Advantage 4`

Completed in this slice:
- one normalized Premium Year / payment-history state surface for:
  - Premium Year freeze / resume
  - premiums-paid-up-to-date gating
  - premium-year keyed charges, penalties, and bonus cadence
- authored bonus cadence support for premium-year keyed recurring bonuses
- `GBII` proof-parser uplift for:
  - loyalty-bonus cadence keyed to Premium Year
  - retained partial boundary on the 24-month supplementary-premium exclusion

Promotion review result:
- `hsbc-life-goal-builder-ii` remains `partial`
- payment-history is no longer the primary blocker for `GBII`
- remaining bounded metadata-only behaviors on `GBII` are now:
  - loyalty-bonus supplementary-premium exclusion window
  - dividend payout election
  - death / terminal-illness payout mechanics
  - regular-withdrawal behavior
- next execution after approval/commit should return to parser throughput before opening another kernel

Scope line:
- add normalized Premium Year / payment-history state
- allow fee / penalty / bonus rules to consume that state honestly
- do not absorb broader protection-state or rider-stream logic into this slice

### 7. Protection-structure kernel

The clearest V1 partial boundary. This is last unless scope expands deliberately.

## Immediate Next Step

Classification QA is complete. Do not resume ad hoc product implementation.

Validated classifier state:

- primary family split:
  - `58` standard 2-account core cashflow
  - `5` multi-account / special-account
  - `29` protection-heavy / death-benefit
- support boundary:
- `6` supported-now
- `57` supported-after-kernel
- `29` partial-v1

The immediate execution focus is parser throughput on products unlocked by the protected-base assurance slice. Parser throughput hit the shared-blocker trigger on `Manulife InvestReady (III)`, `ManuInvest Duo`, and `GREAT Life Advantage 4`, which required one bounded protected-base assurance extension inside the assurance-charge kernel. That slice is now implemented and the loop should return to the cheapest honest parser candidates it unlocks.

## Sequencing After QA

1. Lock the classifier and use `remainingKernelBlockers` as the execution source of truth.
2. Treat the completed workstreams as stable:
   - core cashflow kernel
   - multi-account structure kernel
   - assurance-charge kernel
   - bonus-richness kernel
3. Treat the `payment-history-kernel` first slice as implemented:
   - proof target completed: `GBII`
   - follow-on proof landed: `Investment-linked Insurance Plan 2`
4. Treat the `open-ended-no-mip-kernel` as implemented:
   - proof target: `GREAT Invest Advantage (SP)`
   - immediate follow-ons after commit: `GREAT Invest Advantage 2 (SP)` and the adjacent open-ended Great Eastern corridor
5. Treat the `payout-state-kernel` as implemented:
   - proof target: `AIA Elite Secure Income - Single Premium`
   - immediate follow-ons after commit: `AIA Elite Secure Income - 5 Pay` and `AIA Platinum Retirement Elite`
6. Treat the protected-base assurance slice inside the `assurance-charge-kernel` as implemented:
   - proof target: `Manulife InvestReady (III)`
   - immediate follow-ons after commit: `ManuInvest Duo` and `GREAT Life Advantage 4` if they still fit without widening into broader protection-state logic
7. After the kernel commit lands, return to parser throughput for the cheapest truthful corridor it unlocks.

## V1 Boundary

Current V1 posture:

- `supported-now`
  - already parser-backed, modeled, and golden-gated

- `supported-after-kernel`
  - candidate for support once the relevant kernel workstreams are complete

- `partial-v1`
  - likely stays partial unless scope expands into deeper protection-state modeling

## Relationship To Other Docs

- `ilp-mechanics-family-classification.md`
  Current classification summary and counts

- `family-classification.json`
  Canonical product-level mapping and workstream metadata

- `ilp-engine-gap-ranking.md`
  Why the core cashflow kernel is still rank 1

- `ilp-unfinished-slices.md`
  Historical product-slice backlog only. Not a sequencing source of truth.
