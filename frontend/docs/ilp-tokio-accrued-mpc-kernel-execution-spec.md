# ILP Tokio Accrued MPC Kernel Execution Spec

Last updated: 2026-03-16

## Goal

Add one bounded assurance-kernel extension for Tokio Marine products whose Monthly Protection Charge (`MPC`):

- accrues during an initial published policy-year window
- is not deducted during that accrual window
- is collected later as a lump-sum catch-up together with the current year's normal MPC
- then continues as a normal monthly-in-advance deduction path

This is not a full death-benefit kernel.

It is a reusable timing extension for already-modeled Tokio MPC products that differ only because the published charge timing is deferred for the first few policy years.

## Why This Is Next

Parser throughput has now hit the same missing mechanic on multiple Tokio products that are otherwise parser-ready:

1. `Harvest Pro`
2. `Wealth Pro (II)`
3. `Wealth Max (II)`

All three publish the same extra timing rule:

- MPC applies under advanced-death-style corridors
- the first three policy years accrue instead of deducting immediately
- the accrued amount is collected in the fourth policy year
- after that, the ordinary Tokio monthly-in-advance MPC path resumes

That repeated blocker is what triggers kernel mode.

## Mandatory Proof Product

### Primary proof parser

`tokio-marine-harvest-pro`

Required proof corridor:

- keep `SGD / MIP 10` as the basic-death variant without MPC
- add `SGD / MIP 10 (Advanced Death)` consuming the accrued-MPC timing extension
- years 1 to 3 accrue MPC only
- policy year 4 deducts:
  - accrued years 1 to 3 MPC
  - plus policy year 4 MPC
- fallback order remains source-backed:
  - `accumulation`
  - then `topup`
  - then `initial`

## Structural Contract

This extension applies only when all are true:

- the product already fits the existing Tokio MPC formula family
- the published source explicitly says early policy years are accrued
- the published lump-sum settlement year is explicit
- the fallback deduction order is explicit

Examples in scope:

- `first three (3) policy years will be accrued and deducted ... in one lump sum in the 4th policy year`
- continued normal monthly-in-advance deduction after the accrual window
- fallback from accumulation to top-up to initial

Examples out of scope:

- full death-benefit payout simulation
- rider-benefit valuation
- benefit-option switching state
- capital-guarantee state
- multi-life payout sequencing

## Keep vs Add

### Keep

- existing `assurance-sum-at-risk` basis
- existing `tokio-mpc-net-premium-floor` formula
- existing Tokio age/sex rate table
- existing fallback account allocation logic

### Add

Add one timing extension inside `assuranceConfig`:

- optional accrued-MPC timing metadata
- carry-forward of undeducted accrued assurance charge by rule
- settlement-year collection of carried accrual plus the current year's MPC

Do not create a second Tokio formula family just for timing.

## Runtime Definition

For an assurance rule with accrued-MPC timing:

1. compute the current policy year's MPC normally
2. if the current policy year is within the accrual window:
   - do not deduct it
   - add it to the rule's carried accrued balance
3. if the current policy year is the settlement year or later:
   - total charge due is:
     - carried accrued balance
     - plus current policy-year MPC
   - deduct that due amount through the published primary/fallback account order
   - any undeducted remainder stays carried forward

For rules without accrued timing metadata:

- behavior remains exactly unchanged

## Contract Shape

Add an optional assurance timing block like:

- `accrual.startPolicyYear`
- `accrual.endPolicyYear`
- `accrual.settlementPolicyYear`

Validation requirements:

- `endPolicyYear >= startPolicyYear`
- `settlementPolicyYear === endPolicyYear + 1`

## Acceptance Criteria

This slice is complete only if all are true:

1. assurance rules can author accrued-MPC timing explicitly
2. the calculator carries accrued assurance charge by rule across projection years
3. years inside the accrual window do not deduct MPC
4. the settlement year deducts accrued balance plus current-year MPC
5. fallback order still applies when collecting accrued balance
6. existing non-accrued Tokio MPC products remain unchanged
7. `Harvest Pro` consumes the new timing extension in an explicit advanced-death variant
8. the full kernel gate is green

## Direct Calculator Proof Requirements

Minimum required tests:

1. accrued Tokio MPC stays undeducted in policy years 1 to 3
2. policy year 4 deducts accrued balance plus current-year MPC
3. settlement-year fallback order uses `accumulation -> topup -> initial`
4. ordinary non-accrued Tokio MPC products still deduct immediately

## Immediate Follow-ons After Kernel Commit

Once this kernel slice is green, the next honest consumers are:

- `Wealth Pro (II)`
- `Wealth Max (II)`
