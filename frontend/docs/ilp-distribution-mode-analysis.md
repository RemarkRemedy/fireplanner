# ILP Distribution / Dividend Mode Analysis

Last updated: 2026-03-13

## Goal

Determine whether distribution-mode behavior can be promoted from metadata-only to executable modeling without inventing unsupported economics.

## Source-backed findings

### PRUVantage Prosper

Source: `/Users/tj/Downloads/pdfs/PRUVantage Prosper Product Summary.pdf`

Observed statements:
- Growth Account funds that aim to distribute dividends reinvest by default.
- Receiving dividend payments is only allowed for eligible dividend-paying funds.
- The product summary describes the option, but does not provide any deterministic future dividend amount, rate, or schedule.

Implication:
- The policy document defines the election mechanics, not the future cashflow amount.
- A calculator cannot derive future dividend cash payouts from this source alone.

### Tokio Marine Wealth Max (II)

Source: `/Users/tj/Downloads/pdfs/TML_UNZV_TPDN_CIZ_Summary.pdf`

Observed statements:
- User may choose dividend reinvestment or cash payout for eligible dividend-paying ILP sub-funds.
- Cash payout is only available if the declared dividend is at least `$50` in fund currency; otherwise it is reinvested.
- During minimum investment period:
  - cash dividends may be received from dividend funds in the Accumulation Units Account and Top-up Units Account
  - dividend funds in the Initial Units Account are automatically reinvested
- After minimum investment period:
  - cash dividends may be received from dividend funds in Initial, Accumulation, and Top-up accounts
- Cash dividend payment is explicitly not subject to partial-withdrawal charge.

Implication:
- The account-eligibility rules are deterministic.
- The cash amount is still unknown because it depends on future fund declarations and record dates.

### Tokio Marine Wealth Pro (II)

Source: `/Users/tj/Downloads/pdfs/TML_UNZS_TPDN_CIZ_Summary.pdf`

Observed statements:
- Same reinvest-vs-cash dividend election structure as Wealth Max (II)
- Same during-MIP restriction where Initial Units Account dividends are reinvested
- Same after-MIP access to cash dividends across all accounts
- Same `$50` minimum per fund-currency cash payment threshold

Implication:
- Same modeling boundary as Wealth Max (II)

## What is safe to model today

Safe from the product summaries alone:
- whether dividend mode exists
- which accounts are eligible for cash dividend payout during and after MIP
- the fact that cash dividend distribution is not subject to partial-withdrawal charge
- whether reinvestment should remain forced for a subset of accounts during MIP

Not safe from the product summaries alone:
- future dividend amount
- future dividend timing
- fund-level cash payout schedule
- whether future declared dividends will clear the `$50` threshold

## Recommended release-safe contract

### Recommended default

Keep dividend/distribution mode metadata-only unless the user explicitly provides a payout assumption.

### If executable modeling is added

Use an explicit manual assumption model:
- user chooses `reinvest` or `cash payout`
- user enters an annual dividend-yield assumption for affected dividend-paying funds or accounts
- runtime converts that yield into either:
  - additional reinvested value, or
  - cash payout that does not remain in policy value
- Tokio during-MIP account restrictions are applied on top of that assumption

This would be a modeled assumption, not a parser-derived fact. The UI would need to label it that way.

## Recommended next step

Do not implement distribution-mode math blindly from the product summaries.

Next safe move:
1. decide whether V1 accepts explicit manual dividend-yield assumptions
2. if yes, add an assumption-driven distribution-mode slice and lock it with golden fixtures
3. if no, keep distribution mode metadata-only and move to the next source-backed kernel gap instead
