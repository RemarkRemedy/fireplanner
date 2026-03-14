# ILP Protected-Base Assurance Kernel Execution Spec

Last updated: 2026-03-14

## Goal

Add one bounded assurance-kernel extension for ILP products whose recurring protection charge is:

- rate-table driven
- charged on a published protected base / net amount at risk
- economically material to accumulation and lapse behavior
- still representable without modeling full payout, rider, or non-lapse-debt state machines

This is not a full protection-structure expansion.

It is a reusable assurance-charge slice for products where the missing executable piece is the **published protected-base formula**, not the whole death-benefit contract.

## Why This Is Next

Parser throughput hit the shared-blocker trigger on the next three viable uncataloged candidates:

1. `WA_MID01_PdtSum.pdf` (`ManuInvest Duo`)
2. `WA_MIR03_PdtSum.pdf` (`Manulife InvestReady (III)`)
3. `PS(EN)_GREAT Life Advantage 4_(SG)_v2.0.pdf` (`GREAT Life Advantage 4`)

All three publish:

- monthly protection / insurance / cost-of-insurance charges
- annual rate tables by attained age, sex, and smoker status
- a deterministic protected-base formula
- accumulation economics that are materially affected by those charges

All three are currently blocked because the runtime only supports a small set of product-specific assurance formulas:

- Prudential Prosper death / accidental death
- Prudential Assure II combined
- HSBC Flexi Choice / Max death-TI

The missing mechanic is therefore narrower than “all protection structure”:

- it is a generic **protected-base assurance formula family** problem
- plus the already-published payment-history freeze / resume behavior where the protected base depends on premiums paid

## Mandatory Proof Products

### Primary proof parser

1. `manulife-investready-iii`
- cleanest proof target for the new premium-history-sensitive protected base
- published COI formula is deterministic:
  - `101% x (total regular basic premiums paid + accepted top-up premiums - withdrawals) - account value`
- payment pauses freeze the paid-premium-driven protected base
- premium restart resumes the protected-base growth without inventing monthly sub-state

### Secondary validation target

2. `manulife-manuinvest-duo`
- same insurer family and rate-table pattern
- deterministic protected base:
  - `(sum insured - withdrawals) - account value`
- proves the kernel handles a sum-assured-based protected base, not only a paid-premium floor

### Parser follow-on after the kernel is green

3. `great-eastern-life-advantage-4`
- deterministic protected base:
  - `(basic sum assured + single premium top-ups paid - withdrawals) - account value`
- explicit monthly policy fee and premium-holiday charge already fit the existing core/payment-history surfaces
- non-lapse guarantee debt and continuation-event logic remain outside this slice

## Structural Contract

A product belongs in this kernel extension when all are true:

- the recurring assurance / insurance charge uses a published rate table
- the protected base is expressible from published inputs and bounded annual policy state
- the charge materially affects fee drag or lapse pressure
- the product can still be presented honestly as a `partial` without claiming full protection-state modeling

Examples in scope:

- `sum-assured-less-withdrawals` protected bases
- `sum-assured-plus-topups-less-withdrawals` protected bases
- `paid-premium-floor` protected bases such as `101% of paid premiums less withdrawals`
- existing age / sex / smoker rate-table lookups
- payment-history freeze / resume of protected-base growth when the formula depends on premiums paid

Examples out of scope:

- non-lapse guarantee debt ledgers
- rider continuation-event state machines
- benefit payout simulation
- multi-life or change-of-life-assured modeling
- reinstatement underwriting or health-state transitions
- products whose protected-base formula is not source-complete

## Keep vs Add

### Keep

Keep these current authored/runtime surfaces:

- `chargeRules` with `basis: 'assurance-sum-at-risk'`
- existing assurance profile fields for age / sex / smoker inputs
- payment-history kernel state for paid premiums, premium-year freeze / resume, and premiums-paid-up-to-date
- annual-state projection only

Keep these current products green:

- all existing supported products
- all current Prudential / HSBC assurance fixtures

### Add

Add one normalized internal concept:

- **protected-base assurance formula family**

This internal layer should let the runtime answer two questions generically:

1. what protected base applies before subtracting policy value?
2. which parts of annual policy state can change that protected base?

Likely new initial formula families:

- `paid-premium-floor-101`
- `sum-assured-less-withdrawals`
- `sum-assured-plus-topups-less-withdrawals`

Important constraint:

- do not add a new public “protection product” abstraction if extending `assuranceConfig` is sufficient

## Runtime Definition

For each projection year:

1. derive the policy-year protected base for each assurance rule
2. derive the midpoint applicable value from the charge scope accounts
3. compute `sum-at-risk = max(0, protected-base - midpoint applicable value)` unless the product’s published formula says otherwise
4. annualize the charge from:
   - protected-base formula family
   - attained age
   - sex
   - smoker status
   - selected rate table
5. deduct from the configured account order using the existing assurance deduction path

## Protected-Base Rules

### Family A. Paid-premium floor

Use when the product publishes a protected base tied to accepted premiums paid, for example:

- `101% x (regular premiums paid + top-ups paid - withdrawals)`

Behavior:

- uninterrupted premiums grow the protected base
- missed-premium / premium-free-period years freeze the regular-premium-driven component
- accepted top-ups can still increase the protected base if the source says they count
- premium restart resumes growth from the then-current paid-premium state

### Family B. Sum assured less withdrawals

Use when the product publishes:

- `(sum assured - withdrawals)` before subtracting account value

Behavior:

- withdrawals reduce the protected base
- missed premiums do not automatically change the protected base unless the source says sum assured changes
- user-entered later sum-assured state changes remain future work unless the current slice explicitly supports them

### Family C. Sum assured plus top-ups less withdrawals

Use when the product publishes:

- `(basic sum assured + accepted single-premium top-ups - withdrawals)` before subtracting account value

Behavior:

- top-ups increase the protected base
- withdrawals reduce the protected base
- account value still reduces the final sum-at-risk

## Data / Type Changes

Preferred implementation shape:

- extend `IlpAssuranceChargeConfig['formula']` with the new bounded families
- add only the minimal authored config needed to identify the protected-base family and its rate table
- reuse current `IlpAssuranceProfile` unless one additional source-complete input is strictly required

Avoid:

- a second parallel assurance schema
- public inputs for modeling rider state that the source summary does not pin safely

## Acceptance Criteria

This slice is complete only if all are true:

1. One normalized protected-base evaluator exists for the new assurance families.
2. Direct calculator tests prove:
   - uninterrupted payment baseline
   - freeze during missed-premium / premium-free-period
   - resume after premium restart
   - no regression of existing assurance basis types
3. Existing Prudential / HSBC assurance outputs do not regress.
4. `manulife-investready-iii` is implemented as a passing proof parser.
5. `npm run type-check` passes.
6. `npm run golden:check` passes.

## Direct Calculator Proof Requirements

Minimum required tests:

1. protected-base paid-premium baseline:
- uninterrupted payments increase the protected base and later assurance charge path

2. protected-base paid-premium freeze:
- a `premium-holiday` / premium-free-period year stops the paid-premium-driven growth used by the assurance basis

3. protected-base paid-premium resume:
- after payment restart, later years resume protected-base growth from the restarted paid-premium state

4. protected-base sum-assured variant:
- withdrawals reduce a sum-assured-based protected base correctly

5. no regression:
- existing Prudential Prosper, Prudential Assure II, and HSBC Flexi assurance tests stay green

## Proof Parser Scope

### Required parser in this slice

`Manulife InvestReady (III)` must model at least:

- COI through the new protected-base assurance family
- administrative charge
- published policy fee where applicable
- published premium shortfall charge corridor where the current payment-history/event-charge kernel already supports it
- honest metadata-only boundaries for:
  - benefit payout behavior
  - reinstatement underwriting
  - dividend mode
  - any remaining flexi-option states not source-complete enough for V1

### Allowed follow-on after the proof parser is green

`ManuInvest Duo` or `GREAT Life Advantage 4` may be added in the same workstream if they still fit without widening scope.

## Continuous Invariants

These remain true throughout implementation:

- no monthly micro-state is introduced
- no non-lapse debt engine is introduced in this slice
- protected products remain `partial` unless every remaining blocker is outside the kernel and supported-grade golden coverage exists
- payout formulas and rider-continuation behavior stay metadata-only unless a later slice opens them explicitly

## Implementation Sequence

### Step 1. Add normalized protected-base formula families

- extend the assurance evaluator to compute generic protected bases from bounded annual policy state
- keep current assurance formulas unchanged

### Step 2. Add direct calculator tests first

- baseline
- freeze during missed premium / premium-free period
- resume after premium restart
- no regression for existing assurance basis types

### Step 3. Add one proof parser

- implement `Manulife InvestReady (III)` against the new family
- keep it `partial`

### Step 4. Re-screen adjacent products

- check whether `ManuInvest Duo` and `GREAT Life Advantage 4` now honestly fit
- if yes, parser throughput resumes
- if the remaining blocker becomes non-lapse debt or rider continuation, stop widening this slice

## Verification Plan

Kernel gate for this slice:

- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run catalog:build`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run catalog:family-classification`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run src/lib/calculations/ilp.test.ts [touched parser tests] src/lib/ilp-catalog/templateToPolicy.test.ts src/pages/IlpReviewPage.test.tsx`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run golden:check`

## Non-Goals

This slice must not turn into:

- full protection-structure modeling
- non-lapse guarantee debt carry
- rider continuation-event execution
- multi-life support
- reinstatement-state simulation

If implementation pressure forces those in, stop and split the workstream instead of hiding them inside the assurance kernel.
