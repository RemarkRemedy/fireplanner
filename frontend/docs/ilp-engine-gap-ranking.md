# ILP Engine Gap Ranking (92-Summary Baseline)

Generated at: 2026-03-12T15:00:00+08:00

This document ranks kernel workstreams. It does not assign products to families.

For the canonical product-level classifier, use:

- `frontend/scripts/ilp-catalog/fixtures/audit/family-classification.json`
- `frontend/docs/ilp-mechanics-family-classification.md`

## Baseline

- Summary corpus baseline: 92 product summary PDFs
- Current audit result: 61 `B-extendable`, 31 `C-major-gap`, 0 parser errors
- Source: [ilp-catalog-corpus-audit.md](/Users/tj/TJDevelopment/fireplanner/frontend/docs/ilp-catalog-corpus-audit.md)

## Current Engine Constraints

The current ILP engine is narrow in three confirmed ways:

1. Account charges are modeled as one `feeRate` plus one optional `postMipFeeRate` per account, with no policy-level charge objects and no conditional charge rules: [ilp.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/calculations/ilp.ts#L12), [ilp.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/calculations/ilp.ts#L271)
2. Contribution routing is a static per-account `contributionShare`, not a policy-state machine with premium holiday, top-up routing, missed-premium behavior, or withdrawal-triggered rule changes: [ilp.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/calculations/ilp.ts#L12), [ilp.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/calculations/ilp.ts#L261)
3. Bonus modeling is limited to `annual-rate`, `premium-allocation`, and `one-time`, and applies directly off account balance or annual contribution without richer policy-state conditions: [ilp.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/calculations/ilp.ts#L22), [ilp.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/calculations/ilp.ts#L184)

## Re-Ranked Workstreams

This ranking is by engine workstream, not raw document tags. The goal is to rank the code changes that unlock the most real product support on the 92-summary corpus.

| Rank | Workstream | Audit tags grouped into it | Products touched | Why it ranks here |
| --- | --- | --- | ---: | --- |
| 1 | Core policy cashflow kernel | `dynamic-charge-model`, `non-guaranteed-charges`, `tiered-fee`, `ad-hoc-premium-routing`, `premium-holiday`, `withdrawal-reduction-charges`, `free-partial-withdrawal` | 91 / 92 | This is the real center of gravity. It touches every `B-extendable` product and almost the entire corpus. |
| 2 | Protection structure modeling | `multi-life`, `death-benefit-structure` | 27 / 92 | This is the largest remaining full-support blocker after the cashflow kernel, but it also expands scope from fee-drag into insurance-benefit logic. |
| 3 | Multi-account model expansion | `three-plus-account-model` | 11 / 92 | Lower count, but it is a hard blocker for the Prudential `PRUVantage*` family and several Tokio products. |
| 4 | Bonus engine richness | `tiered-bonus` | 46 / 92 | Important, but it sits on top of the cashflow kernel rather than replacing it. |
| 5 | Distribution / dividend mode | `dividend-mode` | 42 / 92 | Relevant for completeness, but many cases can stay partial or assumption-driven longer than the top four workstreams. |

## Why Rank 1 Is The Real Priority

The strongest result from the 92-summary baseline is this:

- The combined cashflow/charge kernel touches 91 of 92 products.
- It covers all 61 `B-extendable` products.
- The only product outside that kernel is [WA_Sum_200501737H_ILP01_SP_May2023.pdf](/Users/tj/Downloads/pdfs/WA_Sum_200501737H_ILP01_SP_May2023.pdf), which is major-gap solely because of `multi-life`.

This means the fastest path to broad V1 completeness is not “more parsers first.” It is a projection-engine redesign around:

1. Charge rules
2. Routing phases and policy-state changes
3. Withdrawal / premium-holiday state transitions

Without that kernel, parser coverage just produces more products that must stay `partial`.

## Ranked Detail

### 1. Core Policy Cashflow Kernel

- Affected products: 91 / 92
- Bucket split: 61 `B-extendable`, 30 `C-major-gap`
- Representative files:
  - [EIP_Dash PET Plus_Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Dash%20PET%20Plus_Summary.pdf)
  - [EIP_Invest Smart Vista_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20Smart%20Vista_Product%20Summary.pdf)
  - [EIP_Invest Wealth Purpose_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20Wealth%20Purpose_Product%20Summary.pdf)
  - [EIP_Invest flex prime II_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20flex%20prime%20II_Product%20Summary.pdf)
  - [EIP_Invest flex pro_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20flex%20pro_Product%20Summary.pdf)
  - [EIP_Invest flex wealth II_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20flex%20wealth%20II_Product%20Summary.pdf)

What this workstream needs:

- Charge objects instead of one `feeRate`
- Policy-level charges and account-level charges
- Conditional / time-windowed charges
- Top-up and recurring-single-premium routing
- Premium holiday and missed-premium behavior
- Withdrawal-triggered charge recovery and benefit suspension windows

Release implication:

- This is the work that turns the current 61 `B-extendable` products from “catalog-visible but not truly modeled” into realistically supportable V1 candidates.

### 2. Protection Structure Modeling

- Affected products: 27 / 92
- Bucket split: 27 `C-major-gap`
- Representative files:
  - [FWD Invest First Horizon Product Summary.pdf](/Users/tj/Downloads/pdfs/FWD%20Invest%20First%20Horizon%20Product%20Summary.pdf)
  - [FWD Invest Flexi VII Product Summary.pdf](/Users/tj/Downloads/pdfs/FWD%20Invest%20Flexi%20VII%20Product%20Summary.pdf)
  - [FWD_Invest First Summit_Summary.pdf](/Users/tj/Downloads/pdfs/FWD_Invest%20First%20Summit_Summary.pdf)
  - [FWD_Invest Flexi Elite_Summary.pdf](/Users/tj/Downloads/pdfs/FWD_Invest%20Flexi%20Elite_Summary.pdf)
  - [HSBC Life Flexi Protector Product Summary.pdf](/Users/tj/Downloads/pdfs/HSBC%20Life%20Flexi%20Protector%20Product%20Summary.pdf)
  - [TML_ULH_TPDN_CIZ_Summary.pdf](/Users/tj/Downloads/pdfs/TML_ULH_TPDN_CIZ_Summary.pdf)

What makes this different:

- Multi-life and death-benefit-option products are not just fee/routing variants.
- They require explicit modeling of insured-life state, death-benefit formulas, or protection-option choices.

Release implication:

- This is the clearest partial-support boundary for V1.
- If V1 must be “as complete as possible,” these products should still likely remain `partial` before the kernel is complete.

### 3. Multi-Account Model Expansion

- Affected products: 11 / 92
- Bucket split: 11 `C-major-gap`
- Representative files:
  - [PRUVantage Assure II Product Summary.pdf](/Users/tj/Downloads/pdfs/PRUVantage%20Assure%20II%20Product%20Summary.pdf)
  - [PRUVantage Prosper Product Summary.pdf](/Users/tj/Downloads/pdfs/PRUVantage%20Prosper%20Product%20Summary.pdf)
  - [PRUVantage Wealth II Product Summary.pdf](/Users/tj/Downloads/pdfs/PRUVantage%20Wealth%20II%20Product%20Summary.pdf)
  - [TML_UNYA_TPDY_CIN_Summary.pdf](/Users/tj/Downloads/pdfs/TML_UNYA_TPDY_CIN_Summary.pdf)
  - [TML_UNYD_TPDN_CIN_Summary.pdf](/Users/tj/Downloads/pdfs/TML_UNYD_TPDN_CIN_Summary.pdf)
  - [TML_UNYF_TPDN_CIZ_Summary.pdf](/Users/tj/Downloads/pdfs/TML_UNYF_TPDN_CIZ_Summary.pdf)

What this workstream needs:

- More than two runtime accounts
- Routing rules that can move contributions and charges across three or more account buckets
- Exit-value logic that understands which accounts remain subject to EEC / surrender rules

Release implication:

- This is a smaller count than protection structure, but it is economically central for the affected product families.
- It is the main path to full support for the `PRUVantage*` series.

### 4. Bonus Engine Richness

- Affected products: 46 / 92
- Bucket split: 23 `B-extendable`, 23 `C-major-gap`
- Representative files:
  - [EIP_Invest Smart Vista_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20Smart%20Vista_Product%20Summary.pdf)
  - [EIP_Invest Wealth Purpose_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20Wealth%20Purpose_Product%20Summary.pdf)
  - [EIP_Invest flex prime II_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20flex%20prime%20II_Product%20Summary.pdf)
  - [EIP_Invest flex pro_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20flex%20pro_Product%20Summary.pdf)
  - [EIP_Invest flex wealth II_Product Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20flex%20wealth%20II_Product%20Summary.pdf)
  - [EIP_Invest plus SP_Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20plus%20SP_Summary.pdf)

What this workstream needs:

- Tiered bonus ladders
- Bonus conditions tied to premium tiers or status windows
- Better interaction between bonus qualification and premium holiday / withdrawal events

Release implication:

- Important for fidelity, but lower than the kernel because the kernel is a prerequisite for simulating many of the bonus conditions correctly.

### 5. Distribution / Dividend Mode

- Affected products: 42 / 92
- Bucket split: 21 `B-extendable`, 21 `C-major-gap`
- Representative files:
  - [EIP_Dash PET Plus_Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Dash%20PET%20Plus_Summary.pdf)
  - [EIP_Invest plus SP_Summary.pdf](/Users/tj/Downloads/pdfs/EIP_Invest%20plus%20SP_Summary.pdf)
  - [GBII_Summary.pdf](/Users/tj/Downloads/pdfs/GBII_Summary.pdf)
  - [HSBC Life Flexi Protector Product Summary.pdf](/Users/tj/Downloads/pdfs/HSBC%20Life%20Flexi%20Protector%20Product%20Summary.pdf)
  - [HSBC Life Wealth Abundance Product Summary.pdf](/Users/tj/Downloads/pdfs/HSBC%20Life%20Wealth%20Abundance%20Product%20Summary.pdf)
  - [HSBC Life Wealth Accelerate Product Summary.pdf](/Users/tj/Downloads/pdfs/HSBC%20Life%20Wealth%20Accelerate%20Product%20Summary.pdf)

What this likely means in practice:

- Some products allow payout vs reinvestment modes or similar distribution choices.
- Many of these can stay `partial` or assumption-based longer than the top four workstreams, depending on how much the mode affects surrender-value economics.

## Recommended Sequencing

1. Build the core policy cashflow kernel first.
2. Add multi-account support second.
3. Upgrade the bonus engine on top of the new kernel.
4. Decide whether distribution mode stays assumption-based or becomes explicit.
5. Keep protection-structure products as `partial` until there is a deliberate decision to expand beyond fee-drag review into insurance-benefit modeling.

## Practical Takeaway

Using the 92-summary corpus as the real baseline changes the planning lens:

- The largest opportunity is not parser coverage.
- The largest opportunity is a generalized projection kernel.
- That kernel is the only change that meaningfully improves support breadth across the full corpus.
