# ILP Unfinished Slices

Last updated: 2026-03-13

This file tracks the meaningful ILP modeling slices that are still not complete for a public release.

## Release Gate First

Before any additional major kernel slice is implemented, add full product-level golden tests for the currently strongest families.

Why:
- current slices have targeted regression coverage, but not full row-by-row product fixture coverage
- the calculator now includes policy-state behavior, fallback accounts, event charges, and seeded partial products
- release confidence now depends on product-level golden outputs, not just slice-specific unit tests

Recommended gate:
1. Add golden fixtures for HSBC Wealth Accelerate
2. Add golden fixtures for PRUVantage Wealth II
3. Add modeled-subset golden fixtures for partial Prudential families
4. Require golden coverage before any product is labeled `supported`

## Unfinished Slices

### 1. Real Assurance-Charge Modeling

Status:
- not implemented
- current Prudential partial products only seed a manual fixed-annual placeholder

What is missing:
- first-class assurance-charge inputs
- age / life-assured dependent charge basis
- Wealth Assure / sum-assured dependent logic where applicable
- monthly deduction behavior beyond a manual annual estimate

Why it matters:
- this is the largest known remaining modeled cost gap in the seeded Prudential partial products

Current workaround:
- users can seed partial Prudential products
- the page warns when the manual assurance-charge placeholder is still zero

### 2. Broader Top-Up / Ad-Hoc Premium Mechanics

Status:
- partially implemented
- simple top-up routing and top-up premium charges are supported

What is missing:
- richer ad-hoc premium variants beyond current top-up event handling
- more product-specific routing cases
- cases where ad-hoc premiums affect other downstream mechanics not yet modeled

Why it matters:
- this appears frequently in the corpus and still limits broader product fidelity

### 3. Richer Bonus Ladder Modeling

Status:
- partially implemented
- annual-rate, premium-allocation, one-time, tiered rates, suspension, and restoration exist

What is missing:
- more complex conditional bonus ladders
- product-specific status gates beyond current suspension/restoration rules
- more insurer-specific bonus interactions that do not reduce cleanly to current rule primitives

Why it matters:
- bonus structure is a large part of projected fee drag and hold-vs-exit economics

### 4. Distribution / Dividend Mode Modeling

Status:
- not implemented as executable behavior
- currently warning/informational only for affected products

What is missing:
- explicit distribution-mode state
- account-value impact from payout/dividend elections
- downstream effect on fee drag and surrender value where relevant

Why it matters:
- several Prudential-family products expose distribution-related choices that can change account growth

### 5. Broader Multi-Account / Special Account Structures

Status:
- partially implemented
- current runtime now handles more than two accounts and fallback deduction

What is missing:
- more generalized support for special account structures beyond current Prudential shapes
- additional routing / fee / withdrawal interactions across more complex account sets

Why it matters:
- corpus audit still shows non-trivial multi-account variation outside the currently modeled families

### 6. Protection-Heavy Product Structures

Status:
- not implemented
- still outside the intended scope of the current ILP fee-drag engine

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
1. Real assurance-charge modeling
2. Broader top-up / ad-hoc premium mechanics
3. Richer bonus ladder modeling
4. Distribution / dividend mode
5. Broader multi-account special cases
6. Protection-heavy structures only if explicitly in scope

## Current Rule

Do not continue major kernel expansion until the golden-test harness exists for the currently strongest supported/partial families.
