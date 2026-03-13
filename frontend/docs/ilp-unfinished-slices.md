# ILP Unfinished Slices

This document is now a historical product-slice backlog.

It is not the sequencing source of truth anymore.

Use these instead for current planning:

- `frontend/scripts/ilp-catalog/fixtures/audit/family-classification.json`
- `frontend/docs/ilp-mechanics-family-classification.md`
- `frontend/docs/ilp-mechanics-family-roadmap.md`

Last updated: 2026-03-13

This file tracks the meaningful ILP modeling slices that are still not complete for a public release.

## Release Gate First

Before any additional major kernel slice is implemented, add full product-level golden tests for the currently strongest families.

Why:
- current slices have targeted regression coverage, but not full row-by-row product fixture coverage
- the calculator now includes policy-state behavior, fallback accounts, event charges, and seeded partial products
- release confidence now depends on product-level golden outputs, not just slice-specific unit tests

Current gate status:
1. HSBC Wealth Accelerate has full supported-product golden coverage
2. PRUVantage Wealth II has full supported-product golden coverage
3. PRUVantage Prosper and bounded PRUVantage Assure II assurance paths now have modeled-subset golden fixtures
4. Golden coverage remains required before any product is labeled `supported`

## Core Cashflow Kernel

Status:
- first vertical slice complete
- green behind:
  - `npm run type-check`
  - targeted ILP unit tests
  - `npm run golden:check`

Completed in this slice:
- unified internal runtime path for recurring routing
- unified internal runtime path for recurring and event-driven cashflow-linked charges
- premium-holiday state integration through the same normalized cashflow path

Current rule:
- future cashflow-kernel changes must extend this unified path
- do not reintroduce bespoke insurer-specific routing / charge branches outside the kernel

## Unfinished Slices

### 1. Prudential Assurance-Charge Completion

Status:
- first vertical slice complete
- PRUVantage Prosper now has first-class assurance-charge modeling with explicit life-assured inputs and rate-table-backed sum-at-risk charges
- PRUVantage Assure II now uses Prudential's published Appendix A total assurance-charge curve across the projected age path
- manual reduction and later resumption of sum assured / Wealth Assure Value are now modeled as user-entered resulting-state events and locked by partial-subset golden fixtures
- bounded HSBC Flexi Protector death / TI COI now runs through the same normalized assurance path and is locked by a manual partial-subset golden fixture

What is missing:
- fuller protection-state transitions after Wealth Share activation, change of life assured, Premium Pass, and other Prudential option-driven state changes
- broader HSBC Flexi expansion only if TPD / option-state mechanics become source-complete enough to model safely
- supported-grade golden coverage if any Prudential assurance family is ever upgraded from `partial` to `supported`

Why it matters:
- assurance charges are still the largest remaining modeled cost gap in the seeded Prudential partial products
- the next unsafe shortcut would be to auto-model Assure II without resolving the post-70 protection split

Current boundary:
- Prosper can now be modeled after entering age-next-birthday, sex, smoker status, and the current net regular premium base
- Assure II can now be modeled from Prudential's published Appendix A age-based total assurance-charge curve after the user enters current sum assured plus current Wealth Assure Value
- Assure II can also model user-entered manual reduction/resumption events as resulting-state overrides
- HSBC Flexi can now model the bounded death / TI COI subset with explicit basic sum assured and net supplementary premium base inputs
- Assure II remains intentionally partial because option-driven protection-state changes like Wealth Share, Premium Pass, and change-of-life-assured are still not encoded
- HSBC Flexi remains intentionally partial because TPD and broader option-state mechanics are still out of scope

### 2. Broader Top-Up / Ad-Hoc Premium Mechanics

Status:
- partially implemented
- simple top-up routing and top-up premium charges are supported
- HSBC Wealth Abundance now seeds a partial modeled subset with regular-vs-top-up routing, SGD recurring-single-premium charges, and tier-aware startup bonus recovery
- HSBC Wealth Harvest now seeds a partial modeled subset with regular-vs-top-up routing plus explicit top-up and recurring single premium charges
- HSBC Wealth Voyage now seeds a partial modeled subset with top-up routing, top-up premium charge, partial-withdrawal charge, and split startup bonus recovery
- recurring single premium routing and premium charges are now supported for Tokio-style top-up-account flows
- Tokio non-payment premium shortfall charge is now supported when represented with premium-holiday events
- Tokio regular-premium-reduction shortfall charge is now supported from the reduction month onward
- Tokio premium increases can now restore the regular-premium path and stop reduction-based shortfall charges from the increase month onward
- Tokio non-payment shortfall charge now uses the committed premium basis from the product summary, even when a prior reduction exists
- Tokio overlapping non-payment and reduction shortfall charges now keep only the higher published charge instead of double-counting
- Tokio regular-premium reductions now consume recurring single premium first before lowering the regular premium path
- Tokio Wealth Pro (II) now models explicit user-entered insurer-approved charge waivers on qualifying partial withdrawals, premium-holiday events, and regular-premium-reduction shortfall events
- recurring single premium now stays blocked after a premium-holiday event until an explicit recurring-single-premium-resumption event restarts the stream, and the published premium charge only applies in active months
- Tokio Wealth Max (II) and Wealth Pro (II) now model post-MIP regular-premium routing back into the Initial Units Account and lock that path with partial-subset golden fixtures

What is missing:
- richer ad-hoc premium variants beyond current top-up / recurring-single-premium handling
- more product-specific routing cases
- cases where ad-hoc premiums affect other downstream mechanics not yet modeled

Why it matters:
- this appears frequently in the corpus and still limits broader product fidelity

### 3. Richer Bonus Ladder Modeling

Status:
- first vertical slice complete
- annual-rate, premium-allocation, one-time, tiered rates, suspension, and restoration exist behind one normalized internal bonus-evaluation path
- annual-rate bonuses can now resolve tiered rates from account-value bands as well as annual-premium bands
- HSBC and Tokio bonus ladders now run through the same normalized kernel path
- current supported / partial bonus subsets remain golden-gated

What is missing:
- more complex conditional bonus ladders
- product-specific status gates beyond current suspension/restoration rules
- more insurer-specific bonus interactions that do not reduce cleanly to current rule primitives

Why it matters:
- bonus structure is a large part of projected fee drag and hold-vs-exit economics
- the remaining blockers for current partial products are now mostly outside the bonus kernel itself:
  - distribution-mode assumptions
  - broader protection / ownership mechanics
  - parser/catalog expansion where no safe supported boundary exists

### 4. Distribution / Dividend Mode Modeling

Status:
- not implemented as executable behavior
- currently metadata/warning only for affected products
- source-backed analysis is now captured in [ilp-distribution-mode-analysis.md](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/docs/ilp-distribution-mode-analysis.md)

What is missing:
- explicit distribution-mode state
- account-value impact from payout/dividend elections
- downstream effect on fee drag and surrender value where relevant

Current boundary:
- PRUVantage Prosper only states that dividend-paying funds in the Growth Account default to reinvestment, and that payout is allowed only for dividend-paying funds. It does not provide a deterministic future dividend amount.
- Tokio Wealth Max (II) and Wealth Pro (II) define the cash-vs-reinvest election mechanics and account eligibility, but the actual cash distribution still depends on future fund dividend declarations and therefore cannot be computed from the product summary alone.
- A release-safe implementation therefore needs either:
  1. an explicit user-entered dividend-yield / payout assumption, or
  2. a deliberate simplifying assumption such as "all dividend funds reinvest" with the alternative mode remaining metadata-only.

Why it matters:
- several Prudential-family products expose distribution-related choices that can change account growth

### 5. Broader Multi-Account / Special Account Structures

Status:
- first vertical slice complete
- current runtime now has a normalized multi-account role/group layer on top of the unified cashflow kernel
- proven on:
  - Prudential multi-account shapes
  - Tokio Wealth Pro (II) as the non-Prudential structural proof

What is missing:
- more generalized support for special account structures beyond current Prudential shapes
- additional routing / fee / withdrawal interactions across more complex account sets
- promotion-grade closure for current partial products still blocked by:
  - assurance-charge scope
  - distribution-mode assumptions
  - broader protection / ownership mechanics

Why it matters:
- corpus audit still shows non-trivial multi-account variation outside the currently modeled families

### 6. Protection-Heavy Product Structures

Status:
- not implemented
- still outside the intended scope of the current ILP fee-drag engine
- HSBC Flexi Protector is the next bounded protection-light target, but only after a dedicated COI profile + formula slice captured in [ilp-hsbc-flexi-protector-analysis.md](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/docs/ilp-hsbc-flexi-protector-analysis.md)
- HSBC Flexi death / TI COI is now runtime-supported as a bounded subset; TPD COI and broader option-state mechanics remain unfinished

What is missing:
- multi-life support
- death-benefit option logic
- capital-guarantee / payout-heavy mechanics
- other protection-state dependent economics

Why it matters:
- these are real product mechanics in the corpus
- they are also the least attractive next target for V1 because they push the tool beyond fee-drag review into broader insurance-benefit modeling

## Execution Order After Golden Tests

Recommended next order after the golden-test harness is in place:
1. Broader top-up / ad-hoc premium mechanics
2. Richer bonus ladder modeling
3. Distribution / dividend mode
4. Broader multi-account special cases
5. Protection-heavy structures only if explicitly in scope

## Current Rule

Extend the golden gate alongside any future modeled assurance-charge expansion before changing additional supported boundaries.
