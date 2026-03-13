# HSBC Flexi Protector Analysis

Last updated: 2026-03-13

## Goal

Determine the next safe modeling boundary for `HSBC Life Flexi Protector` without inflating support claims beyond what the current annual ILP engine can defend.

Source:
- `/Users/tj/Downloads/pdfs/HSBC Life Flexi Protector Product Summary.pdf`

## Source-backed findings

### Regular premium allocation

The product summary publishes a deterministic regular-premium allocation schedule:

| Policy year | % to purchase units | Premium charge |
| --- | --- | --- |
| 1 | 20% | 80% |
| 2 | 40% | 60% |
| 3 | 55% | 45% |
| 4 | 100% | 0% |
| 5+ | 102% | 0% |

Implication:
- this is not an MIP/EEC product
- the premium-charge path is deterministic and source-complete
- policy year 5 onward effectively includes a 2% premium-allocation uplift

### Additional Bonus Units

The product summary publishes a deterministic annual account-value bonus:

| Account Value tier | Annual rate |
| --- | --- |
| First 29,999 | 0.00% |
| Next 30,000 - 99,999 | 0.10% |
| Next 100,000 - 499,999 | 0.20% |
| Next 500,000 and above | 0.30% |

Implication:
- this is not a premium-tiered bonus
- the new account-value-banded annual-rate bonus primitive is the correct runtime shape

### Account / ad-hoc premium mechanics

The product summary is deterministic on:
- ad-hoc Top-up: 5% premium charge
- Recurring Single Premium: 5% premium charge
- both are stopped during Premium Holiday
- both contribute to death-benefit and insurance-charge formulas

Implication:
- existing top-up / recurring-single-premium mechanics are close enough for a bounded modeled subset
- restart behavior after Premium Holiday still needs explicit handling if we want to claim it as modeled

### Premium Holiday

Flexi Protector does not publish a separate premium-holiday charge table.
Instead:
- no Premium Holiday is allowed during the Initial Premium Payment Term
- after that, Premium Holiday only means regular premiums stop while policy charges continue
- the termination clause explicitly states that non-payment during the `1st 24 months` triggers termination, which pins the Initial Premium Payment Term boundary to the first 24 policy months

Implication:
- this is simpler than Voyage / Harvest PHC logic
- current runtime can already express “contributions stop, charges continue”
- the remaining work is not the holiday boundary itself; it is the COI profile and formula support

### Fixed administration fee

The product summary publishes:
- monthly administration fee: `$5`
- hard cap: `$12`

Implication:
- current `fixed-annual` charge rules can model the base `$60` yearly fee
- the cap language is not a current runtime concern because the published base fee is deterministic

### Insurance Charge / COI

The product summary publishes deterministic COI structure:
- monthly charge
- age-based rate tables
- separate death/TI table and TPD table
- Choice Cover sum-at-risk:
  - `Basic Sum Assured + RSP + Top-up - Partial Withdrawal - Regular Withdrawal - Account Value`
- Max Cover sum-at-risk:
  - `Basic Sum Assured`

Implication:
- the charge side is source-complete
- the missing runtime piece is not the rate table itself; it is the required state/input contract

### Protection / option boundary

Flexi Protector still includes broader protection behavior:
- Choice Cover vs Max Cover
- TPD benefit option behavior
- change of life assured
- riders
- GIO / LRO

Implication:
- the product should remain `partial` unless the modeled subset is stated sharply
- the next safe support claim is “investment/charge subset,” not “full protection product”

## What the current engine can already cover

With the current runtime:
- regular-premium charge schedules can be represented using year-bounded `annual-contribution` charge rules plus premium-allocation bonus uplift
- fixed admin fee can be modeled with `fixed-annual`
- Additional Bonus Units can now be modeled with annual-rate bonus tiers keyed by account-value bands
- top-up and recurring-single-premium premium charges are already modeled
- Premium Holiday without a separate PHC table is already expressible

## What is still missing before a safe partial Flexi Protector parser

### 1. Explicit Flexi protection profile inputs

The runtime needs a profile separate from Prudential assurance inputs:
- cover option: `choice` or `max`
- current basic sum assured
- current cumulative top-up / RSP base used in the Choice Cover sum-at-risk formula
- possibly separate withdrawal totals if they cannot be derived cleanly from policy events alone

### 2. HSBC Flexi COI formula support

The runtime needs explicit assurance formulas for:
- death / terminal illness COI under `choice`
- death / terminal illness COI under `max`
- TPD COI

### 3. Source-backed rate tables

The rate tables on pages 29-32 need to be transcribed into a repo-managed table file and tested before parser promotion.

## Recommended next coding slice

The death / TI COI runtime slice is now implemented:
- repo-managed HSBC death / TI rate table
- current basic sum assured input
- current net RSP + top-up base input
- bounded Choice Cover and Max Cover death / TI COI formulas
- straight `1/12` monthly annualization because the source publishes yearly charges but no separate modal factor

TPD COI is still not implemented.

Do not write the full Flexi Protector parser yet.

Next safe coding slice:
1. add the remaining TPD COI contract if the sum-at-risk basis can be pinned safely from source
2. only then seed Flexi Protector as a `partial` modeled subset

## Recommended support boundary once that slice lands

Safe modeled subset:
- regular-premium allocation schedule
- admin fee
- Additional Bonus Units
- top-up / RSP premium charges
- Premium Holiday without a separate PHC
- COI for the selected cover option from published rate tables

Keep metadata-only:
- rider interactions
- LRO / GIO effects
- administrative restart nuances after Premium Holiday if not explicitly modeled
- any option-driven protection-state changes not represented by the initial profile contract
