# Prudential Assurance-State Analysis

Last updated: 2026-03-13

## Scope

This note captures the remaining Prudential assurance-state gap after the Assure II post-70 charge tail was modeled from the published Appendix A rate curve.

The open question is narrower:
- can we safely encode manual reduction / resumption behavior for `sum assured` and `Wealth Assure Value`
- without inventing monthly protection-state mechanics that are not explicit in the product summary

## Source Evidence

### Base benefit scope

From `PRUVantage Assure II Product Summary.pdf`:
- page 1 / extracted lines 27-30
  `PRUVantage Assure II is a regular premium whole of life investment-linked policy ... provides financial protection against death for as long as the life assured lives and an Accidental Disability benefit until the policy anniversary before the life assured turns 70 years old.`

Implication:
- death benefit is lifelong
- accidental disability benefit has an explicit age stop

### Assurance-charge basis

From page 10 / extracted lines 671-692:
- assurance charge is billed monthly
- charged first to Growth + Flex, then to Additional when Growth/Flex are exhausted
- charges for the basic benefits of death and accidental disability are guaranteed
- Appendix A contains the charge table

From page 26 / extracted lines 2299-2337:
- monthly charge example uses:
  - current age next birthday
  - sex
  - smoker status
  - sum assured
  - Wealth Assure Value
  - Growth + Flex account value
  - Additional account value
- benefit base:
  - `Highest of (Sum assured, Wealth Assure Value, Growth Account Value and Flex Account Value) + Additional Investment Account Value`
- sum-at-risk:
  - `Benefit - Growth/Flex value - Additional value`
- monthly charge:
  - `Assurance charge rate / 1000 * Sum-at-Risk * Monthly modal factor`

Implication:
- the total applicable assurance charge is source-defined well enough to compute from a single age-based rate curve
- the current engine’s `prudential-assure-ii-combined` rule is aligned with the documented example

### All-age charge curve

From page 24 / extracted lines 1652-1655:
- `Appendix A – Assurance Charges`
- `Charges for Death and Accidental Disability Benefits (per S$1,000 Sum-at-Risk, per annum)`
- `Monthly Modal Factor: 0.0834`

The Appendix A table continues through age 102.

Implication:
- for fee modeling, the published total rate curve can be used after age 70 without decomposing death-only vs accidental-disability components
- that is the basis for the current Assure II post-70 charge-tail modeling

### Manual reduction / resumption rules

From page 13 / extracted lines 813-839:
- after the premium term, the user can reduce `sum assured` and/or `Wealth Assure Value`
- when either is reduced, Prudential compares the new value against the other tracked protection value and current values
- after reduction:
  - the 3% yearly increase in sum assured stops
  - the revised Wealth Assure Value remains unchanged
- the user can later resume the sum assured to the same amount before the reduction
  - the 3% yearly increase resumes at the next policy anniversary
  - Wealth Assure Value calculation also resumes
- accidental disability sum assured is also reduced to the new sum assured
- assurance charges depend on the higher of either sum assured or Wealth Assure Value attained

Implication:
- the product summary clearly defines that manual reduction changes future protection-state evolution
- the summary does not give a compact closed-form yearly rule for every path once multiple reductions/resumptions are chained

## Confirmed Current Model Boundary

What the ILP runtime now models:
- Prosper assurance charges from explicit rate tables plus life-assured inputs
- Assure II assurance charges from Prudential Appendix A total rate curve, including ages after 70
- Growth/Flex first, Additional-account fallback
- current `sum assured` and current `Wealth Assure Value` as projection-start state

What still remains outside the model:
- manual reduction of `sum assured`
- manual reduction of `Wealth Assure Value`
- later resumption of the pre-reduction `sum assured`
- resumed Wealth Assure Value growth after a prior freeze
- Wealth Share / Premium Pass / change-of-life-assured state transitions

## Current Engineering Reading

The remaining gap is not the charge formula anymore.

The remaining gap is state evolution:
- which protection value changes, and when
- when 3% automatic growth is frozen
- when it resumes
- what baseline it resumes from
- how chained reductions/resumptions interact

In the current annual engine, that likely requires explicit policy events rather than more parser metadata.

## Implemented Narrow Slice

The implemented safe slice is:
- `assurance-benefit-reduction`
  - effective policy month
  - resulting sum assured
  - resulting Wealth Assure Value
- `assurance-benefit-resumption`
  - effective policy month
  - resumed sum assured

Runtime semantics:
- reduction freezes automatic protection growth
- reduction applies the user-entered resulting values
- resumption restores the user-entered sum assured
- automatic growth resumes from the next projection year
- Wealth Assure progression resumes from the carried state rather than jumping back to a guessed prior level

This remains intentionally partial and is now locked by curated Assure II golden fixtures.
