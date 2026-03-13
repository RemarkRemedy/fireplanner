# ILP Cumulative-Paid Premium Charge Kernel Execution Spec

Last updated: 2026-03-13

## Goal

Add a bounded runtime charge basis for products whose recurring policy charge is based on **cumulative regular premiums actually paid**.

This slice exists because the next viable Etiqa parser-throughput corridor is blocked by one shared missing mechanic:

- `EIP_Invest smart flex II_Product Summary.pdf`
- `EIP_Invest flex wealth II_Product Summary.pdf`
- `EIP_Invest Wealth Purpose_Product Summary.pdf`

All three publish policy-charge formulas that depend on total regular premiums paid to date, with Premium-Free-Period years freezing the running base until regular premium payments resume.

For these products, the missing mechanic is two-part:

- the charge base is cumulative regular premiums actually paid
- after the premium payment term, the applicable rate tier can depend on the number of annualised regular premiums actually paid

The current engine can already model:
- account-value charges
- annual-contribution charges
- fixed-annual charges
- assurance-sum-at-risk charges
- `premium-base-mip-multiplier` charges

It cannot honestly model cumulative-paid premium charges or the published post-term rate-tier switching tied to annualised premiums paid.

## Why This Is Next

The current parser-throughput loop reached a real blocker:

- three consecutive standard-family regular-premium products
- same insurer corridor
- same economically material missing mechanic

That is the exact threshold for opening a new kernel workstream instead of forcing more parsers.

## Proof Products

This slice must be proven against these products:

1. `etiqa-invest-smart-flex-ii`
- first intended parser consumer
- cleanest direct example of cumulative-paid policy charge plus premium-free-period freeze/resume

2. `etiqa-invest-flex-wealth-ii`
- same mechanic with different bonus tables and premium-term options
- proves the new basis is not one-product-specific

3. `etiqa-invest-wealth-purpose`
- same policy-charge mechanic with 3/5/10/15/20-year term coverage
- proves the basis scales across shorter and longer premium terms

The goal of this slice is to unlock truthful parser throughput for this Etiqa corridor.

It does **not** imply any of the three products become `supported` immediately. That depends on the rest of their modeled boundary and supported-grade golden coverage.

## Source-Backed Contract

The published policy charge in these products is:

- monthly policy charge = `(policy charge percentage / 12) x total regular Premium paid`

Important published behavior:

- during Premium-Free-Period / missed-premium years, total regular premiums paid does **not** continue increasing automatically
- when regular premiums resume, the cumulative-paid base resumes increasing from the actual paid total
- for some terms, the applicable policy-charge percentage after the premium payment term is selected by:
  - `Number of Annualised Regular Premium Paid`
  - defined as `Total Regular Premiums Paid / Annualised Regular Premium at Policy Inception`
  - rounded down to the nearest whole number
- this is distinct from:
  - `annualised premium at issue x lower(policy year, premium term)`
  - `higher(commencement annual premium, prevailing annual premium) x multiplier`

## Scope

This slice includes exactly:

1. a new runtime charge basis for cumulative paid regular premium
2. optional rate-tier selection based on annualised regular premiums actually paid
3. correct interaction with:
  - missed premiums
  - Premium-Free-Period freeze
  - regular-premium resumption
4. parser-throughput proof for the three named Etiqa products
5. golden proof that the new basis behaves as published

This slice does **not** include:

- premium shortfall charge modeling
- Premium-Free-Period accumulated-month entitlement modeling
- insurance charge modeling
- free partial withdrawal allowance/cap logic
- distribution-paying-fund behavior
- any protection-state or death-benefit modeling

## Keep vs Replace

### Keep

Keep these current concepts and behaviors:

- regular premium payment state remains owned by the core cashflow kernel
- year-bucketed premium-holiday / missed-premium semantics remain unchanged
- `premium-base-mip-multiplier` remains available for products like HSBC Wealth Voyage and current Etiqa flex products
- authored `chargeRules` remain the public runtime surface
- parser/catalog `feeRules -> chargeRules` mapping stays intact

### Add

Add one new charge basis to the runtime/public rule vocabulary:

- `cumulative-paid-regular-premium`

This basis must:

- use only **regular** premiums actually paid
- exclude:
  - top-ups
  - recurring single premiums
  - premium-holiday repayments
  - ad hoc repayments unless the product explicitly says they count as regular premiums paid
- freeze when regular premiums are not paid
- resume when regular premiums are paid again
- optionally support rate-tier selection by annualised regular premiums actually paid

### Do not replace

Do not reinterpret this mechanic as:

- `annual-contribution`
- `premium-base-mip-multiplier`
- a synthetic multiplier schedule

Those are different published economics.

## Runtime Definition

For a given projection year:

- compute the monthly cumulative-paid base from actual regular premiums paid up to each policy month
- apply the rule's published annual rate for that month
  - either a fixed / policy-year rate
  - or a rate selected from annualised-premiums-paid count tiers
- monthly charge = `(rate / 12) x cumulativePaidRegularPremiumAtMonth`
- yearly charge is the sum of monthly charges across the projection year

Important runtime decisions:

1. **Base source**
- use the normalized core cashflow kernel's actual regular-premium paid stream
- do not infer from nominal scheduled premium alone

2. **Freeze semantics**
- if the policy is in Premium-Free-Period / missed-premium state and no regular premium is paid, the cumulative-paid base remains flat

3. **Resume semantics**
- when regular premiums resume, the cumulative-paid base increases only by the actually paid regular premium amount

4. **Account application**
- allocation remains through the rule's normal `appliesTo` / fallback allocation path
- for the Etiqa proof products, charges apply to `regular`

5. **Rate-tier selection**
- if the rule defines annualised-premiums-paid count tiers:
  - calculate `floor(cumulativePaidRegularPremiumAtMonth / annualisedRegularPremiumAtPolicyInception)`
  - select the matching tier rate for that month
- otherwise use the rule's normal fixed / policy-year rate path

## Layer Contract

Catalog/runtime schema impact:

- add the new basis to:
  - `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/types.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/schema.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/validation/ilpSchema.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`

No new public event shape is needed.

This slice should consume existing normalized cashflow-state signals, not add a parallel premium-tracking subsystem.

## Acceptance Criteria

This slice is complete only if all are true:

1. There is one explicit runtime charge basis for cumulative paid regular premiums.
2. The new basis uses actual regular premiums paid, not scheduled premiums or policy-year multipliers.
3. Where required by source, post-term rate selection by annualised regular premiums paid is modeled honestly.
4. Premium-Free-Period / missed-premium years freeze the cumulative-paid base.
5. Premium resumption restarts accumulation from actual paid premiums.
6. The three named Etiqa products can be parsed honestly using this basis.
7. Existing supported-product outputs remain green under `npm run golden:check`.
8. No existing `premium-base-mip-multiplier` product regresses.

## Golden Proof Requirements

At minimum, add or extend proof coverage so the Etiqa corridor directly asserts:

1. baseline policy-charge drag for one product with uninterrupted premium payment
2. premium-free-period freeze:
- charge base stops growing while no regular premium is paid
3. premium resumption:
- charge base resumes increasing after regular premium restarts
4. annualised-premiums-paid count-tier switching:
- after the premium payment term, the selected policy-charge rate changes only when the cumulative-paid annualised count crosses the published threshold
5. cross-product parity:
- the same basis works for:
  - `etiqa-invest-smart-flex-ii`
  - `etiqa-invest-flex-wealth-ii`
  - `etiqa-invest-wealth-purpose`

Also keep these invariants green:

- `npm run golden:check`
- existing supported-product opportunity-cost outputs
- existing supported-product hold-to-MIP and future-exit comparisons

## Implementation Sequence

### Step 1. Add the new runtime charge basis

Add `cumulative-paid-regular-premium` to the allowed charge bases and implement its evaluator in:

- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`

Do this without changing existing charge-basis behavior.

### Step 2. Source the base and optional count tiers from normalized cashflow state

Expose or reuse the normalized regular-premium-paid stream from the core cashflow kernel so the new basis can read:

- cumulative regular premiums paid up to each policy month

Also support rate-tier selection when a rule publishes post-term rates by:

- number of annualised regular premiums paid
- using annualised regular premium at policy inception as the divisor

Do not duplicate regular-premium tracking in a second subsystem.

### Step 3. Prove the basis directly with calculator tests

Add targeted tests for:

- uninterrupted payment accumulation
- freeze during missed-premium / Premium-Free-Period years
- resume after premium restart

### Step 4. Implement the three Etiqa parsers

Land:

- `etiqa-invest-smart-flex-ii`
- `etiqa-invest-flex-wealth-ii`
- `etiqa-invest-wealth-purpose`

as truthful `partial` or `supported` products depending on the remaining modeled boundary after parser implementation and golden coverage.

### Step 5. Expand golden proof and re-run the promotion pass

Once the parsers land:

- rebuild catalog
- refresh classification
- refresh golden fixtures if needed
- run `npm run golden:check`
- decide whether any of the three products are promotable or should remain `partial`

## Non-Goals

This slice must not quietly absorb:

- premium shortfall charge modeling
- Premium-Free-Period entitlement tracking
- free withdrawal benefit caps
- insurance charge modeling
- distribution-mode assumptions
- protection-state or payout-state logic

If one of those becomes required to keep the slice honest, stop and split it into a separate workstream.
