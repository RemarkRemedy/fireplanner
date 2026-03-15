# ILP Distribution Eligibility Window Kernel Execution Spec

Last updated: 2026-03-15

## Goal

Extend the existing distribution-mode assumption kernel so it can represent products whose cash-payout eligibility changes by policy-year window, without inventing dividend amounts, schedules, or fund-level declaration logic.

This slice keeps the current manual-assumption model:
- `reinvest` remains the seeded default and is economically inert
- `cash-payout` remains executable only through a user-entered annual distribution-yield assumption

The new capability is narrower:
- allow payout-eligible account sets to vary across policy-year windows
- allow payout eligibility to start after an intra-MIP threshold such as the 5th policy anniversary

## Trigger cohort

The shared blocker cohort now includes:
- `TML_UNWU_TPDN_CIN_Summary.pdf` (`#goClassic`)
- `TML_UNXN_TPDN_CIN_Summary.pdf` (`#goClassic Secure`)
- `TML_UNYD_TPDN_CIN_Summary.pdf` (`#goAffluence`)
- `TML_UNYF_TPDN_CIZ_Summary.pdf` (`#goLuxe`)
- `TML_UNZS_TPDN_CIZ_Summary.pdf` (`Wealth Pro (II)`)
- `TML_UNZV_TPDN_CIZ_Summary.pdf` (`Wealth Max (II)`)
- `TML_UOAB_TPDN_CIN_Summary.pdf` (`Wealth Flexi-Link 3.12`)
- `TML_UOAJ_TPDN_CIN_Summary.pdf` (`Wealth Flexi-Link 5.10`)
- `VS1_Summary.pdf` (`Invest Flex`)

These products already fit the current manual distribution-yield assumption, but they need more precise source-backed payout eligibility windows than the flat `accountIds + during/after-MIP booleans` surface can express.

## Source-backed contract

The product summaries in this cohort publish deterministic distribution election rules such as:
- during premium-payment term / minimum investment period, only a subset of accounts may pay cash dividends
- after premium-payment term / minimum investment period, additional accounts become cash-payout eligible
- some products delay payout eligibility until a fixed policy anniversary inside MIP
- reinvestment remains the default election
- minimum payout thresholds such as `$50` remain informational only in V1

Still not source-backed and therefore not parser-derived facts:
- future dividend amount
- future dividend timing
- fund-manager declaration schedule
- whether a future declaration clears the minimum threshold

## V1 design

Add optional explicit payout eligibility windows to the distribution support surface.

### Template/runtime surface

Keep the existing shape:
- `accountIds`
- `cashPayoutAllowedDuringMip`
- `cashPayoutAllowedAfterMip`

Add:
- `cashPayoutWindows?: Array<{ startPolicyYear: number, endPolicyYear: number | null, accountIds: string[] }>`

Interpretation:
- if `cashPayoutWindows` is absent, preserve the current behavior using the flat `accountIds` plus phase booleans
- if `cashPayoutWindows` is present, it is the authoritative payout-eligibility contract
- `accountIds` then becomes the union of all payout-eligible accounts across every authored window
- a policy year with no matching window is treated as reinvest-only for payout purposes

This keeps existing supported products stable while allowing blocked products to opt into the richer windowed contract.

### Validation rules

When `cashPayoutWindows` is present:
- each window must contain at least one valid account id
- each window must satisfy `startPolicyYear >= 1`
- if `endPolicyYear` is present, it must be `>= startPolicyYear`
- authored windows must not overlap
- at least one payout-eligible window must exist before a `cash-payout` assumption is accepted

Backward-compatibility rule:
- legacy products without `cashPayoutWindows` continue to use the current during/after-MIP booleans

## Runtime contract

The annual distribution deduction remains unchanged except for active-account resolution:
- determine the active policy year
- resolve the eligible payout account ids for that policy year
  - from authored `cashPayoutWindows` when present
  - otherwise from the legacy during/after-MIP booleans
- compute assumed payout per eligible account as `openBalance * annualYieldRate`
- if the current year has no eligible payout window, force reinvestment for that year

This preserves the current economic assumption while tightening the source-backed payout-account boundaries.

## Non-goals

Do not add in this slice:
- declaration-date or record-date simulation
- minimum-payout threshold enforcement
- separate tracking of withdrawn previously reinvested distributions
- extra UI fields beyond exposing the existing distribution assumption surface
- fund-level payout-account mapping within a single account bucket

## Direct calculator tests required

Add isolated tests in `src/lib/calculations/ilp.test.ts` covering:
1. legacy no-window support stays behaviorally identical
2. a windowed policy pays cash only from the authored during-MIP account set
3. the eligible account set expands after MIP when the authored window changes
4. a policy year with no active payout window forces reinvestment even under `cash-payout`

## Proof parser

Use `tokioMarineGoClassic` as the proof parser for this kernel slice.

Why `#goClassic`:
- the source language is simple and deterministic
- during premium-payment term only the Accumulation Units Account is cash-payout eligible
- after premium-payment term the Initial Units Account becomes eligible as well
- the product remains partial for unrelated loyalty / protection / withdrawal mechanics, so this is an honest kernel proof rather than an inflated support upgrade

Parser expectations:
- attach `distributionSupport` with the union account set
- author two cash-payout windows:
  - years `1-25`: `['accumulation']`
  - years `26+`: `['initial', 'accumulation']`
- keep the published minimum-payout threshold and instruction window informational only

## Expected follow-on parser throughput

Once committed, this kernel should immediately unblock the Tokio distribution cohort whose remaining honest gap is phase-specific payout eligibility:
- `#goClassic`
- `#goClassic Secure`
- `#goAffluence`
- `#goLuxe`
- `Wealth Pro (II)`
- `Wealth Max (II)`

It also provides the right surface for products like `Invest Flex` whose payout eligibility starts only after a later policy-year threshold.

## Verification gate

Kernel verification must pass with:
- `npm run catalog:build`
- `npm run catalog:family-classification`
- `npm run type-check`
- `npx vitest run src/lib/calculations/ilp.test.ts [touched parser tests] src/lib/ilp-catalog/templateToPolicy.test.ts src/pages/IlpReviewPage.test.tsx`
- `npm run golden:check`

## Review standard

This slice is acceptable only if:
- legacy distribution-support products remain green without parser churn
- windowed products can narrow and expand eligible payout accounts by policy year without hidden assumptions
- years with no active payout window behave as reinvest-only
- the published minimum payout thresholds remain disclosed as informational only
