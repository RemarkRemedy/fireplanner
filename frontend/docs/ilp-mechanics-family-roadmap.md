# ILP Mechanics Family Roadmap

Last updated: 2026-03-13

## Status

This document supersedes the older 7-family roadmap language.

The execution source of truth is now:

- product classification: `frontend/scripts/ilp-catalog/fixtures/audit/family-classification.json`
- classification summary: `frontend/docs/ilp-mechanics-family-classification.md`

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

3. `implementationCohort`
   Insurer-shaped rollout grouping. Useful for execution, not the canonical family axis.

## Current Baseline

- Summary corpus baseline: `92`
- Current catalog products: `9`
- Current `supported` products: `2`
- Structural family counts from the classifier:
  - `58` standard 2-account core cashflow
  - `5` multi-account / special-account
  - `29` protection-heavy / death-benefit

Most importantly:

- `supported-now` is only `2`
- `supported-after-kernel` is `61`
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

### 3. Assurance-charge kernel

Needed where insurance / assurance charges materially affect economics.

### 4. Bonus-richness kernel

Needed after the cashflow kernel is trustworthy.

### 5. Distribution-mode assumption model

Useful for fidelity, but not ahead of cashflow correctness.

### 6. Protection-structure kernel

The clearest V1 partial boundary. This is last unless scope expands deliberately.

## Immediate Next Step

Classification QA is complete. Do not resume ad hoc product implementation.

Validated classifier state:

- primary family split:
  - `58` standard 2-account core cashflow
  - `5` multi-account / special-account
  - `29` protection-heavy / death-benefit
- support boundary:
  - `2` supported-now
  - `61` supported-after-kernel
  - `29` partial-v1

The immediate execution focus is no longer classifier QA. It is choosing the next family/cohort promotion that should consume the completed cashflow kernel.

## Sequencing After QA

1. Lock the classifier and use it as the execution source of truth.
2. Treat the first vertical `core-cashflow-kernel` slice as complete:
   - generalized charge objects
   - routing phases
   - premium-holiday state transitions
   - golden proof on the named products
3. Use that completed slice to drive the next adoption step:
   - pick the highest-yield family/cohort that mainly depended on the cashflow kernel
   - verify promotion with targeted fixtures and golden coverage
4. Only then decide whether the next major workstream is:
   - multi-account structure
   - assurance-charge
   - bonus richness

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
