# ILP Payout-State Kernel Execution Spec

Last updated: 2026-03-14

## Goal

Add one bounded kernel slice for ILP products whose published economics include a **scheduled income / payout phase** that redeems policy units over time.

This slice exists because parser throughput reached a shared blocker rather than isolated product gaps:

- `WA_Sum_201106386R_ESISP_Jul2025.pdf`
- `WA_Sum_201106386R_ESI5P_Jul2025.pdf`
- `WA_Sum_201106386R_PRE_Jul2025.pdf`

All three products publish economically material payout-state behavior:

- the policy owner selects a payout start condition
- the product pays scheduled monthly income by redeeming policy value / units
- the payout path is part of the product’s core economic story, not an optional footnote

The current engine can model:

- annual contribution flow
- annual charges and bonuses
- premium-holiday suppression / recovery
- explicit partial-withdrawal events when the user enters them manually

It cannot honestly model:

- a product-level payout phase that runs automatically after a chosen start point
- policy value consumption through scheduled income redemptions rather than ad hoc withdrawals
- products where the payout election is source-defined but the payout amount is a user-selected assumption rather than a parser-derived fact

## Why This Is Next

Parser throughput continued until the next 3 viable AIA-coded candidates failed for the same missing mechanic:

- `AIA Elite Secure Income – Single Premium`
- `AIA Elite Secure Income – 5 Pay`
- `AIA Platinum Retirement Elite`

This is the kernel trigger:

- same blocker across multiple candidates
- blocker is structural, not insurer-row noise
- forcing these parsers into the current engine would either ignore the payout phase or invent a payout schedule that is not in the source

## Proof Products

### Mandatory proof target

1. `aia-elite-secure-income-single-premium`
- cleanest single-account proof target
- single-premium corridor avoids regular-premium recovery logic in the first proof
- published payout mechanics are explicit
- still requires an assumption-driven payout amount because the source lets the user choose Monthly Income

### Immediate follow-on corridor after the proof parser is green

2. `aia-elite-secure-income-5-pay`
- same payout-state mechanic
- adds limited-premium funding
- should fit if the payout kernel is sound and remains orthogonal to payment-history

3. `aia-platinum-retirement-elite`
- same scheduled income redemption pattern
- broader option range, but same modeling boundary

### Out of scope for this slice

4. products whose remaining blocker is no-lapse / protection-state rather than payout-state
5. dividend-election / distribution-mode products where the missing fact is fund-level payout amount rather than scheduled policy-level redemption

## Source-Backed Contract

### AIA Elite Secure Income – Single Premium

Published mechanics:
- single-premium ILP
- owner chooses payout age and payout period
- monthly income is paid by redeeming policy units / value
- top-ups exist
- source does not publish one deterministic future monthly-income amount

### AIA Elite Secure Income – 5 Pay

Published mechanics:
- limited-premium ILP
- same payout-age / payout-period selection structure
- same monthly income redemption concept
- source again does not publish one deterministic future monthly-income amount

### AIA Platinum Retirement Elite

Published mechanics:
- single-pay or 5-pay retirement ILP
- target monthly retirement income is paid by redeeming units from policy value
- user chooses retirement age / payout period / stepped-up option
- target income and payout horizon are not parser-deterministic from the product summary alone

Shared implication:

- the payout engine behavior is source-backed
- the payout amount is not parser-derived fact
- executable modeling therefore requires an explicit manual assumption surface, not a hardcoded parser default

## Scope

This slice includes exactly:

1. one normalized payout-state contract in the calculator layer
2. one authored/template way for a parser to declare that a product supports scheduled income redemptions
3. one explicit manual-assumption surface for payout amount and timing
4. annual aggregate payout handling only
5. direct calculator proof that scheduled payouts consume policy value correctly
6. one proof parser consuming the new payout contract end-to-end as a `partial`

This slice does **not** include:

- monthly sub-state projection
- protection-structure work
- dividend / distribution-yield modeling
- deriving payout amount from marketing illustrations
- support-grade promotion
- broad no-lapse / protection-state work

## Keep vs Add

### Keep

Keep these current concepts:
- policy-year annual projection
- ad hoc partial-withdrawal events
- existing open-ended / finite-MIP basis handling
- current fee / bonus evaluators

### Add

Add one explicit payout-state authored/runtime contract:

- parser/template layer may declare `scheduledPayoutSupport`
- runtime may consume an optional `scheduledPayoutAssumption`

Minimum assumption contract:

- `mode: 'disabled' | 'scheduled-redemption'`
- `startPolicyYear: number`
- `durationYears: number`
- `annualPayoutAmount: number`
- `source: 'manual-assumption'`

For V1:

- payout amount is always explicit manual input
- runtime uses annual aggregate payout, not monthly micro-timing
- payouts reduce policy account value like scheduled withdrawals

### Do Not Add

Do not add:

- parser-authored fixed monthly income defaults that are not in the source
- hidden payout assumptions
- nominal-to-real conversion logic inside the ILP kernel

## Runtime Definition

For each projection year:

1. determine whether scheduled payout mode is active for that year
2. if inactive:
   - preserve current runtime behavior
3. if active:
   - subtract `annualPayoutAmount` from eligible payout account(s)
   - treat the deduction as policy-level withdrawal for value-consumption purposes
   - do not route it through ad hoc user-entered `partial-withdrawal` events

Important runtime decisions:

1. **Annual-state only**
- V1 uses annual aggregate payout
- `12 x monthly income` is input-side labeling only
- no monthly sequencing is introduced

2. **Source of truth**
- parser declares capability
- user/manual assumption declares amount and timing
- runtime never invents payout amount from parser text

3. **Account scope**
- first proof targets are single-account products
- multi-account payout-order rules are out of scope for this slice

4. **Charges**
- existing withdrawal-linked charges do not automatically attach to scheduled payout
- only products with source-explicit scheduled-payout charges may attach them later
- first slice treats scheduled payout as a separate withdrawal-class path unless source says otherwise

5. **UI labeling**
- payout assumption must be labeled as manual / assumption-driven
- outputs remain nominal ILP outputs

## Layer Contract

Likely implementation impact:

- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/types.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/schema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/templateToPolicy.ts`

Potential UI/seed touchpoint if needed for end-to-end proof:

- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/pages/IlpReviewPage.tsx`

Required implementation approach:

- add payout-state as a bounded new contract
- keep current products behavior identical when payout mode is disabled
- reject impossible combinations early
- avoid product-specific hardcoded payout math

## Acceptance Criteria

This slice is complete only if all are true:

1. The calculator can represent disabled vs scheduled-redemption payout state explicitly.
2. Existing products remain unchanged when payout state is absent.
3. Direct calculator tests prove scheduled payout consumes policy value correctly.
4. Direct calculator tests prove payout starts only when configured and stops after its duration.
5. Direct calculator tests prove no regression of existing basis types.
6. One proof parser consumes the new payout contract end-to-end and passes as a `partial`.
7. `npm run type-check` passes.
8. `npm run golden:check` passes.

## Direct Calculator Proof Requirements

At minimum, add calculator tests for:

1. accumulation baseline with payout mode disabled
2. scheduled payout beginning at configured start year
3. scheduled payout stopping after configured duration
4. payout draining policy value without changing unrelated fee rules
5. no regression for existing finite/open-ended basis products

## Continuous Invariants

These remain true throughout implementation:

- supported-product outputs remain stable
- payout amount is never silently inferred from parser text
- payout-state products remain `partial`
- manual assumption labeling is explicit wherever surfaced

## Open Modeling Decision

This slice depends on one business/modeling decision:

1. **Is V1 allowed to accept explicit manual payout assumptions for payout-state ILPs?**

If **yes**:
- proceed with the bounded annual-state kernel above
- parser proof target can land as `partial`

If **no**:
- payout-state must remain metadata-only
- these AIA products stay on the blocked-by-shared-mechanic board
- parser throughput should resume elsewhere instead of forcing a fake execution model

This is the only unresolved decision in the slice. The source material does not justify a parser-authored default payout amount.

## Implementation Sequence

### Step 1. Add the payout-state authored/runtime contract

Add the minimum types and schema needed for:
- parser-declared payout support
- user/manual payout assumption

### Step 2. Normalize runtime payout handling

Implement one annual payout-state path in:
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`

### Step 3. Add direct calculator proof

Extend:
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.test.ts`

### Step 4. Add one proof parser

Target:
- `AIA Elite Secure Income – Single Premium`

### Step 5. Return to parser throughput

Once the proof parser is green and committed, resume parser throughput on:
- `AIA Elite Secure Income – 5 Pay`
- `AIA Platinum Retirement Elite`
