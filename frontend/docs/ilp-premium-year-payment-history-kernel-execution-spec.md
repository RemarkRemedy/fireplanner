# ILP Premium-Year / Payment-History Kernel Execution Spec

Last updated: 2026-03-13

## Goal

Add a bounded runtime state layer for products whose charges, bonuses, or penalty horizons depend on **premium years / premium-payment history**, not just policy year.

This slice exists because the next viable Great Eastern parser-throughput corridor is blocked by one shared missing mechanic:

- `GBII_Summary.pdf`
- `PS_GEL_Investment Linked Insurance Plan 2_v3.0.pdf`
- `PS(EN)_GREAT Life Advantage 4_(SG)_v2.0.pdf`

All three products publish economically material rules that depend on payment history rather than simple policy-year progression.

The current engine can model:
- policy-year schedules
- premium holiday suppression and repayment
- cumulative paid regular premium charge bases
- top-up / recurring-single-premium routing

It cannot honestly model:
- `Premium Year` remaining flat during premium holiday and resuming only when premium payment resumes
- fee / penalty horizons that extend when premium years stall
- bonus / reward eligibility gated on "first N premium years paid up to date"

## Why This Is Next

Parser throughput continued until the next 3 candidates from a new insurer cohort all depended on the same missing mechanic.

This is the trigger for kernel mode:
- different cohort from the blocked Income/AIA protection corridor
- same new blocker across multiple Great Eastern candidates
- economically material to fee drag, surrender value, and bonus path

## Proof Products

This slice has one mandatory proof target and two optional stretch targets.

### Mandatory proof target

1. `great-eastern-great-benefits-insurance-ii`
- cleanest proof target
- source-explicitly has **no insurance charge**
- payment-history mechanics are economically material and source-complete:
  - Premium Year freezing / resumption
  - Product Administration Fee extension
  - surrender-penalty extension
  - loyalty-bonus cadence keyed to Premium Year
- other remaining overlays are not blockers for landing a truthful `partial`:
  - `distribution-mode` stays metadata-only
  - `ad-hoc-premium-routing` is already covered by existing top-up / RSP support

### Optional stretch targets after GBII is green

2. `great-eastern-investment-linked-insurance-plan-2`
- only if the bounded payment-history kernel can also support:
  - bonus eligibility pause / resume
  - premium-holiday charge refund gating
- this product remains allowed to stay `partial` if assurance/protection boundaries stay explicit

3. `great-eastern-great-life-advantage-4`
- optional only
- if this product requires additional per-stream premium-reward state, it is out of scope for this slice and must remain blocked for a later kernel

This slice is successful if it unlocks truthful parser throughput for `GBII` and adds one reusable payment-history kernel that can later be extended to the other Great Eastern products without contradicting the modeled boundary.

## Source-Backed Contract

### GBII

Published mechanics:
- `Premium Year(s)` = number of years premiums have actually been paid, rounded up
- Premium holiday periods do **not** count toward Premium Year
- Product Administration Fee uses Premium Year for rate and duration examples
- surrender penalty period is extended when Premium Year stalls
- loyalty bonus is payable at the end of Premium Year 10, and every 2 years thereafter until Premium Year 24

### Investment-linked Insurance Plan 2

Published mechanics:
- welcome / premium bonus stop during premium holiday
- bonus resumes when premium payment resumes
- premium holiday charge refund requires premiums paid up to date

### GREAT Life Advantage 4

Published mechanics:
- premium reward starts only after the first 9 policy years are paid up to date
- premium holiday pauses reward eligibility
- increased basic regular premium is treated as a new premium stream for reward timing

The first two products clearly require a shared payment-history state model.
The third may require an additional per-stream extension. This spec keeps that branch explicit instead of silently absorbing it.

## Scope

This slice includes exactly:

1. one normalized payment-history state model
2. one explicit `premiumYear` concept distinct from `policyYear`
3. one "premiums paid up to date" / "premium stream active" eligibility surface
4. support for fee / penalty / bonus rules keyed off premium-year state
5. parser-throughput proof for `GBII`
6. optional follow-on proof for one additional Great Eastern product only if it fits this bounded kernel honestly

This slice does **not** include:

- full protection-state kernel
- sum assured / basic sum assured state modeling beyond what existing assurance paths already support
- distribution-mode assumptions
- rider-linked premium stream logic
- full multi-stream premium reward modeling if `GREAT Life Advantage 4` needs a separate stream-state extension
- auto-promotion of any Great Eastern product to `supported`

## Keep vs Replace

### Keep

Keep these current concepts:
- `policyYear`
- year-bucketed premium-holiday semantics from the core cashflow kernel
- current routing / charge / bonus authored surfaces
- current assurance-charge kernel
- current cumulative-paid-regular-premium basis

### Add

Add one normalized payment-history state surface that exposes:
- `premiumYearAtStartOfPolicyYear`
- `premiumYearAtEndOfPolicyYear`
- `premiumPaidInYear`
- `premiumsPaidUpToDate`
- `premiumYearMonthsInYear`

This state must be derived from actual regular premium payment behavior, not from a second hand-authored schedule.

Add the minimum authored contract needed for rule families that are genuinely premium-year keyed:
- recurring `chargeRules` may declare `yearBasis: 'policy-year' | 'premium-year'`
- `eventChargeRules` that use year-banded schedules may declare `yearBasis: 'policy-year' | 'premium-year'`
- bonus rules that have cadence or gating keyed to premium-payment history may read the normalized `premiumsPaidUpToDate` signal and, where needed, a premium-year cadence basis

This is not optional. The current authored rule surface is policy-year keyed, so premium-year behavior must be representable explicitly instead of hidden in internal one-off branches.

### Do Not Replace

Do not reinterpret payment-history-dependent rules as:
- policy-year schedules
- cumulative-paid premium charge rules
- ad hoc event triggers

Those are different published mechanics.

## Runtime Definition

For each projection year:

1. calculate the number of premium-bearing months actually paid in that policy year
2. update a normalized Premium Year state from actual paid premium progress
3. expose whether premiums for the required historical window are "paid up to date"
4. let rules consume this normalized state for:
   - fee rate selection
   - fee duration extension
   - bonus eligibility / cadence
   - surrender-penalty timing

Important runtime decisions:

1. **Premium Year**
- Premium Year advances only when actual regular premiums are paid
- premium holiday / missed-premium months freeze Premium Year
- once premium resumes, Premium Year resumes from the frozen value

2. **Paid-up-to-date eligibility**
- products may query whether required scheduled regular premiums for a gating window were fully paid
- this powers “bonus stops during premium holiday; resumes when premiums resume”
 - this may also gate refund eligibility when the source contract says fees/charges are refunded only after premiums are paid up to date

3. **Rule consumption**
- use payment-history state as an input into existing rule evaluation
- do not fork a separate fee or bonus subsystem

4. **Rounding**
- preserve published "rounded up to nearest whole number" or equivalent wording where explicitly stated
- if wording differs by product, keep the kernel primitive flexible enough to support the published rule

5. **Repayment semantics**
- a repayment event may restore `premiumsPaidUpToDate`
- a repayment event does **not** advance `premiumYear` by itself unless a product explicitly states that arrears repayment counts as additional Premium Years
- for this slice, the conservative default is:
  - restore eligibility flags only
  - do not backfill missed Premium Years

## Layer Contract

Schema/runtime impact may include:
- normalized internal payment-history state in:
  - `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`
- any necessary authored/runtime rule extensions in:
  - `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/types.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/schema.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/validation/ilpSchema.ts`

Required implementation approach:
- add internal normalized state first
- then extend the public authored rule contract where premium-year keyed behavior cannot be represented honestly with current policy-year-only fields
- do not hide premium-year logic in product-specific hardcoded branches

## Acceptance Criteria

This slice is complete only if all are true:

1. The runtime has one normalized payment-history state model.
2. Premium Year can freeze during premium holiday and resume afterward.
3. At least one charge or penalty rule can consume Premium Year instead of policy year.
4. Bonus / reward eligibility can read “premiums paid up to date” from normalized state.
5. `GBII` can be parsed honestly using this kernel.
6. If a second Great Eastern proof product is landed in this slice, its remaining overlays are explicitly bounded and source-backed.
7. Existing supported-product outputs remain green under `npm run golden:check`.
8. Existing cumulative-paid premium basis products do not regress.

## Golden Proof Requirements

At minimum, add or extend proof coverage so the Great Eastern corridor directly asserts:

1. Premium Year freeze during premium holiday
2. Premium Year resumption after premium payment resumes
3. fee / penalty extension due to Premium Year stall
4. bonus or reward eligibility pauses during premium holiday and resumes on payment restart
5. repayment can restore `premiumsPaidUpToDate` without silently advancing `premiumYear`
6. supported-product outputs remain unchanged

## Continuous Invariants

These remain true throughout implementation:
- `npm run golden:check` remains green after each checkpoint
- supported-product summary / NPV / opportunity-cost outputs remain stable
- assurance-charge outputs remain stable
- cumulative-paid premium charge outputs remain stable
- no product is promoted to `supported` without supported-grade golden coverage

## Implementation Sequence

### Step 1. Add normalized payment-history state

Implement internal Premium Year / payment-history state in:
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`

Do this without changing existing product behavior.

### Step 2. Wire existing rule evaluation to consume payment-history state

Add the smallest necessary extension so fee / penalty / bonus evaluators can read:
- Premium Year
- premiums-paid-up-to-date

Explicitly add public authored fields where premium-year keyed schedules or cadence cannot be represented honestly with existing policy-year-only contracts.

### Step 3. Prove the kernel directly with calculator tests

Add tests for:
- uninterrupted premium payment baseline
- freeze during premium holiday
- resume after premium restart
- no regression of policy-year-based rules

### Step 4. Implement `GBII` as proof parser

Land:
- parser
- parser test
- template mapping/page coverage
- generated catalog refresh

This is the minimum proof parser for the slice and the only mandatory parser for approval.

### Step 5. Optionally attempt one additional Great Eastern parser

Try:
- `Investment-linked Insurance Plan 2`
or
- `GREAT Life Advantage 4`

If `Investment-linked Insurance Plan 2` needs repayment-driven Premium Year semantics beyond the conservative contract above, leave it for a follow-on extension.

If `GREAT Life Advantage 4` requires new-stream premium-reward state beyond this slice, stop there and leave it for a later kernel.
