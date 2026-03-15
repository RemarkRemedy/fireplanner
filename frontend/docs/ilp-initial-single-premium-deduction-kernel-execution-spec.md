# ILP Initial Single-Premium Deduction Kernel Execution Spec

Last updated: 2026-03-15

## Goal

Add one bounded kernel slice for single-premium ILP products that publish an upfront deduction on the initial single premium before units are created.

This slice exists because parser throughput has now hit the same missing mechanic on multiple otherwise parser-ready Great Eastern products:

- `PS(EN)_GREAT Invest Advantage (SP)_(SG)_v3.0.pdf`
- `PS(EN)_GREAT Invest Advantage 2 (SP)_(SG)_v2.0.pdf`

Both products already fit the current open-ended single-premium basis and already publish executable top-up and zero-surrender surfaces. The remaining blocker is the initial single-premium charge that reduces the subscribed amount before unit creation.

## Why This Is Next

Recent parser throughput continued until the next viable Great Eastern SP products failed for the same reason:

1. `great-eastern-great-invest-advantage-sp`
2. `great-eastern-great-invest-advantage-2-sp`

The repeated blocker is structural, not product-specific:

- current runtime handles annual-contribution fees, account-value fees, and event charges
- current runtime does not author or evaluate a one-time deduction against the initial single premium before initial units are allocated
- current parser slices currently leave this as metadata-only to avoid inventing unsupported behavior

That is the trigger to switch from parser throughput to kernel mode.

## Proof Products

### Mandatory proof parser

1. `great-eastern-great-invest-advantage-sp`
- cleanest proof target
- one-account open-ended single-premium product
- published 3% initial charge on Cash / SRS corridor
- published 0% initial charge on CPFIS corridor
- already has executable top-up and zero-surrender path

### Immediate follow-on parser after kernel commit

2. `great-eastern-great-invest-advantage-2-sp`
- same missing initial single-premium deduction mechanic
- should fit immediately once the basis is available

### Explicitly out of scope for this slice

- `great-eastern-prestige-portfolio`
- `aia-elite-secure-income-sp`
- `aia-platinum-retirement-elite`
- `aia-platinum-wealth-elite-2`
- `aia-platinum-wealth-legacy`

These products may share adjacent single-premium gaps, but they also bring extra manual-input, payout, or schedule surfaces that are not needed to prove this kernel slice.

## Source-Backed Contract

The kernel must support this published pattern:

1. the customer pays one initial single premium at policy inception
2. a published percentage charge is deducted immediately from that initial single premium
3. the net amount is what purchases the initial units / policy value
4. top-up premiums continue to use their separate existing event-charge path

Important distinction:

- this is not an annual recurring fee
- this is not an account-value fee
- this is not a premium-year schedule
- this is a one-time initial contribution deduction
- this slice treats `initialSinglePremium` as one gross inception lump sum, not as an installment schedule or recurring stream

## Scope

This slice includes exactly:

1. one authored/runtime way to represent an upfront charge on the initial single premium
2. template-to-policy mapping for that new basis
3. direct calculator tests for the new one-time deduction basis
4. one proof parser consuming the new basis end-to-end

This slice does **not** include:

- new protection-state logic
- single-premium principal tracking
- payout-state work
- fund-level charges
- free-look refund logic
- promotion of any product to `supported`

## Keep vs Add

### Keep

- existing `annual-contribution` fee behavior for recurring premium products
- existing event-charge handling for top-ups / recurring-single-premium / withdrawals
- existing open-ended and finite-MIP support
- existing account-value and premium-base rule behavior

### Add

Add one explicit fee basis for template/runtime use:

- `initial-single-premium`

Meaning:

- applies once at policy inception
- rate is applied to the one-time gross initial single premium amount entered at projection start
- resulting deduction reduces the initial amount routed into the receiving account
- never re-fires after inception

### Do Not Fake

Do not model this mechanic as:

- an `account-value` charge in policy year 1
- an `annual-contribution` fee that keeps reapplying
- a synthetic top-up event at policy issue

Those would distort the published economics.

## Runtime Definition

At policy inception:

1. read the one-time gross initial single premium amount
2. resolve any fee rule with basis `initial-single-premium`
3. deduct the charged amount once
4. route the net amount into the receiving account according to existing contribution rules
5. continue the rest of the projection with the net seeded balance

The new basis must:

- support fixed rate and zero-rate corridors
- coexist with existing zero-charge initial single-premium products
- not alter top-up or recurring-single-premium event handling
- remain out of scope for installment-style payment schedules until a separate mechanic is explicitly modeled

## Layer Contract

Expected touch points:

- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/types.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/schema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/templateToPolicy.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/validation/ilpSchema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.test.ts`

Required mapping rule:

- parser-authored `feeRules` with basis `initial-single-premium` must survive into runtime without being coerced into a normal recurring `chargeRule`

## Acceptance Criteria

This slice is complete only if all are true:

1. The catalog/runtime contract can represent an upfront initial single-premium deduction explicitly.
2. The charge fires exactly once at policy inception.
3. Existing `annual-contribution` and `account-value` behavior is unchanged.
4. Direct calculator tests prove the deduction reduces initial seeded value correctly.
5. Direct calculator tests prove zero-rate initial single-premium corridors stay unchanged.
6. `great-eastern-great-invest-advantage-sp` consumes the new basis and passes the full kernel gate.
7. `npm run golden:check` remains green.

## Direct Calculator Proof Requirements

At minimum add direct calculator tests for:

1. non-zero upfront initial single-premium deduction applied once at policy start
2. zero-rate initial single-premium corridor applied once with no reduction
3. no regression for standard annual-contribution fee products
4. no regression for top-up event charges on the same policy

## Implementation Sequence

### Step 1. Add the new authored/runtime basis

Extend types, schema, and validation for `initial-single-premium`.

### Step 2. Map it through template-to-policy

Ensure the new basis reaches runtime without being treated as a recurring annual fee.

### Step 3. Evaluate it once at projection start

Implement the one-time deduction in the calculator layer before initial unit seeding is finalized.

### Step 4. Add direct calculator tests

Prove non-zero and zero-rate initial single-premium behavior and protect existing recurring-fee semantics.

### Step 5. Add the proof parser

Upgrade `great-eastern-great-invest-advantage-sp` to consume the new basis.

### Step 6. Run the kernel gate

Only after the proof parser and calculator tests are green should this slice proceed to staging and review.
