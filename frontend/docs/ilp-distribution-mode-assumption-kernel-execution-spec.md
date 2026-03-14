# ILP Distribution-Mode Assumption Kernel Execution Spec

Last updated: 2026-03-14

## Goal

Unblock standard-family ILPs whose remaining honest parser blocker is dividend / distribution election handling, without inventing fund-manager dividend schedules or monthly sub-state.

This slice adds an explicit assumption surface for distribution-paying funds:
- `reinvest` remains the release-safe default and is economically inert inside the calculator
- optional `cash-payout` becomes executable only through a manual annual distribution-yield assumption
- product-level restrictions such as "cash payout not allowed during MIP" are enforced by the kernel

## Trigger Cohort

The immediate shared-blocker cohort is:
- `WA_MIRG_PdtSum.pdf` (`Manulife InvestReady Growth`)
- `WA_MIRP_PdtSum.pdf` (`Manulife InvestReady (III)` alternate summary family)
- `WA_MSRI5_PdtSum.pdf` (`Manulife SmartRetire (V)` income corridor)
- `WA_MSRS5_PdtSum.pdf` (`Manulife SmartRetire (V)` sum corridor)

These products publish deterministic election rules but do not publish deterministic future dividend amounts.

## Source-backed contract

Observed source facts from the blocked summaries:
- dividend-paying funds may be reinvested or paid out in cash
- some products force reinvestment during MIP and allow payout only after MIP
- cash payout is subject to a minimum distribution amount of `$40` / `S$40`
- withdrawal / surrender charges do not apply to dividend payment or withdrawal of reinvested dividends
- some bonus / gating language references whether dividends were paid out or reinvested-dividend withdrawals were made

Not source-backed and therefore not parser-derived facts:
- future dividend amount
- future dividend timing
- future fund-manager declaration schedule
- whether a future declaration clears the `$40` threshold

## V1 decision

V1 accepts a narrow assumption-driven distribution-mode model:
- parser may declare that a variant supports manual distribution assumptions
- the seeded default is `reinvest`
- `cash-payout` requires an explicit annual distribution-yield assumption entered by the user
- the minimum-payout threshold remains informational only in V1 and is disclosed in warnings

This is an assumption model, not a parser-derived fact.

## Runtime contract

### Policy surface

Add `distributionSupport` to the policy / template surface:
- `mode: 'manual-assumption'`
- `accountIds: string[]`
- `defaultMode: 'reinvest'`
- `cashPayoutAllowedDuringMip: boolean`
- `cashPayoutAllowedAfterMip: boolean`
- `source: 'distribution-paying-funds'`

Add `distributionAssumption` to the runtime surface:
- `mode: 'disabled'`
- `mode: 'reinvest'`, `source: 'catalog-default' | 'manual-assumption'`
- `mode: 'cash-payout'`, `source: 'manual-assumption'`, `annualYieldRate: number`

### Yearly treatment

Use a simple annual-state model:
- compute assumed distribution on eligible accounts as `openBalance * annualYieldRate`
- if effective mode for the year is `reinvest`, do nothing to policy value
- if effective mode for the year is `cash-payout` and payout is allowed in that phase, subtract the assumed distribution from policy value as an annual withdrawal-like outflow that is not subject to withdrawal charges or EEC
- if the product forbids cash payout in the current phase, force reinvestment for that year

Rationale:
- current fund return inputs behave like total-return assumptions
- reinvestment therefore remains the current no-op baseline
- cash payout can be approximated safely by removing the assumed distribution yield from policy value

### Non-goals

Do not implement in this slice:
- declaration-date or record-date simulation
- threshold enforcement for the `$40` / `S$40` minimum payout
- withdrawal of previously reinvested dividends as a separate event stream
- bonus / loyalty gating tied to dividend withdrawals unless the product can already be represented honestly under the reinvest-default assumption
- UI forms for editing the new assumption beyond schema support if not already surfaced elsewhere

## New basis and schema changes

### Calculator

Add:
- distribution support and assumption types to `src/lib/calculations/ilp.ts`
- validation that `distributionAssumption` requires `distributionSupport`
- validation that supported account ids exist on the policy
- annual distribution deduction helper that applies after growth and before the yearly close is finalized

### Catalog/template surface

Add optional `distributionSupport` to:
- `src/lib/ilp-catalog/types.ts`
- `src/lib/ilp-catalog/schema.ts`
- `src/lib/ilp-catalog/templateToPolicy.ts`
- `src/lib/ilp-catalog/policySeedSchema.ts`
- `src/lib/validation/ilpSchema.ts`

Seeding rule:
- parser-backed products with this support seed `distributionAssumption: { mode: 'reinvest', source: 'catalog-default' }`
- seed warnings must state that cash payout needs a manual annual yield assumption and that the minimum payout threshold remains informational only

## Direct calculator tests required

Add isolated tests in `src/lib/calculations/ilp.test.ts` covering:
1. uninterrupted payment baseline
   - reinvest-default support is a no-op against the existing projection path
2. freeze during missed-premium / premium-free-period
   - reinvest-default support does not break existing premium-holiday handling
3. resume after premium restart
   - reinvest-default support remains stable across premium-holiday repayment / restart flow
4. cash-payout proof
   - a manual annual distribution-yield assumption reduces post-growth policy value only when payout is allowed in that phase
5. no regression of existing basis types
   - existing scheduled-payout / assurance / premium-year tests continue to pass

## Proof parser

Use `manulifeInvestreadyIii` as the proof parser for the kernel slice:
- attach `distributionSupport` to the regular-premium account
- seed explicit reinvest-default assumption warnings
- keep cash payout threshold and dividend-withdrawal gating metadata-only

This parser already has the closest matching source language for the V1 surface:
- dividend-paying funds can be reinvested or paid out in cash
- payout remains subject to the published `$40` minimum amount
- withdrawal of accumulated reinvested dividends remains informational only in V1

The stricter Manulife follow-on cohort (`WA_MIRG`, `WA_MIRP`, `WA_MSRI5`, `WA_MSRS5`) is the blocker set with stronger phase-specific payout language that should consume this kernel after the proof parser lands.

## Expected follow-on parser throughput after kernel commit

The kernel should immediately unblock:
- `WA_MIRG_PdtSum.pdf`
- `WA_MIRP_PdtSum.pdf`
- `WA_MSRI5_PdtSum.pdf`
- `WA_MSRS5_PdtSum.pdf`

provided the remaining product economics fit the current kernels honestly.

## Verification gate

Kernel verification must pass with:
- `npm run catalog:build`
- `npm run catalog:family-classification`
- `npm run type-check`
- `npx vitest run src/lib/calculations/ilp.test.ts [touched parser tests] src/lib/ilp-catalog/templateToPolicy.test.ts src/pages/IlpReviewPage.test.tsx`
- `npm run golden:check`

## Review standard

This slice is acceptable only if:
- reinvest-default is explicit rather than hidden in parser prose
- cash-payout math cannot occur without a manual annual yield assumption
- payout restrictions by phase are enforced deterministically
- the `$40` threshold stays disclosed as informational only, not silently modeled
- existing supported products remain green under `golden:check`
