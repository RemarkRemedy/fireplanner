# ILP Family Work Packets

## Purpose
This document turns the corridor rollout into execution packets that can be assigned family-by-family after Phase 0 lands.

Each packet includes:
- product family and current product IDs
- source PDF
- current executable slice
- confirmed missing corridors
- dependency level
- suggested branch name
- expected parser/test touchpoints
- recommended verification commands

These packets inherit the corpus finding that all 92 current products are already `supported-now`. Treat each packet as corridor expansion inside an already-supported family, not as a general support rescue.
Do not pull metadata-only warnings from `outside-current-models.md` into packet scope unless a newly executable corridor strictly requires that mechanic.
If `PR 2a` or `PR 2b` scope changes, re-evaluate the dependency level on every packet that references those prerequisites.

## Cohort Lens

The 92-policy corpus audit says family/cohort is the right execution lens. Use these implementation cohorts to reuse patterns across packets:
- `aia-ilp-generic`
  - Packets `A1`, `A2`, `A3`
- `fwd-ilp-generic`
  - Packets `F1`, `F2`
- `hsbc-premium-base-recovery`
  - Packet `H1`
- `etiqa-rsp-recovery`
  - Packets `E1`, `E2`
- `generic`
  - Packet `I1`
- `singlife-ilp-generic`
  - Packet `S1`
- `tokio-shortfall-recurring-single-premium`
  - Packets `T1` through `T6`

## Dependency Levels

### `Phase 0 only`
Can be surfaced as disabled choices without kernel work.

### `After PR 2a`
Needs corridor metadata and schedule lookup, but not new payment-lane support.

### `After PR 2b`
Needs explicit single-pay / mixed-lane support before executable modeling is honest.

## Family Packets

### Packet A1
- Family: `AIA Platinum Wealth Elite 2.0`
- Product ID: `aia-platinum-wealth-elite-2`
- Source PDF: `WA_Sum_201106386R_PWE2.0_Jul2025.pdf`
- Implementation cohort: `aia-ilp-generic`
- Current executable slice:
  - `sgd-mip-5`
- Confirmed missing corridors:
  - `SGD / Single Pay`
  - `SGD / Regular Pay 6 years`
  - `SGD / Regular Pay 7 years`
  - `SGD / Regular Pay 8 years`
  - `SGD / Regular Pay 9 years`
  - `SGD / Regular Pay 10 years`
- Dependency level:
  - `After PR 2b`
- Why:
  - mixed lane (`single pay` + regular pay)
  - extended regular-pay corridor beyond current slice
- Suggested branch:
  - `codex/ilp-aia-pwe2-corridors`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthElite2.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthElite2.test.ts`
- Notes:
  - current warning already explicitly says single-pay and premium-term extension remain informational only

### Packet A2
- Family: `AIA Platinum Wealth Legacy`
- Product ID: `aia-platinum-wealth-legacy`
- Source PDF: `WA_Sum_201106386R_PWL_Jul2025.pdf`
- Implementation cohort: `aia-ilp-generic`
- Current executable slice:
  - `sgd-mip-5`
- Confirmed missing corridors:
  - `SGD / Single Pay`
- Dependency level:
  - `After PR 2b`
- Why:
  - single-pay lane support
- Suggested branch:
  - `codex/ilp-aia-pwl-single-pay`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthLegacy.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthLegacy.test.ts`

### Packet A3
- Family: `AIA Pro Achiever 3.0`
- Product ID: `aia-pro-achiever-3`
- Source PDF: `WA_Sum_201106386R_APA3.0_Oct2024.pdf`
- Implementation cohort: `aia-ilp-generic`
- Current executable slice:
  - `sgd-iip-10`
- Confirmed missing corridors:
  - `SGD / IIP 15 years`
  - `SGD / IIP 20 years`
- Dependency level:
  - `After PR 2a`
- Why:
  - same family, same lane, corridor table expansion only
- Suggested branch:
  - `codex/ilp-aia-pro-achiever-iip`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaProAchiever3.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaProAchiever3.test.ts`

### Packet F1
- Family: `FWD Invest First Summit`
- Product ID: `fwd-invest-first-summit`
- Source PDF: `FWD_Invest First Summit_Summary.pdf`
- Implementation cohort: `fwd-ilp-generic`
- Current executable slice:
  - `sgd-mip-10`
- Confirmed missing corridors:
  - premium payment term `11` through `30`
- Dependency level:
  - `After PR 2a`
- Why:
  - same family and same payment lane
  - needs corridor-dependent bonus/loyalty/reduction/surrender tables
- Suggested branch:
  - `codex/ilp-fwd-summit-ppt-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/fwdInvestFirstSummit.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/fwdInvestFirstSummit.test.ts`
- Notes:
  - best medium-effort, high-value family after easy wins

### Packet F2
- Family: `FWD Invest First Max`
- Product ID: `fwd-invest-first-max`
- Source PDF: `WA_Sum_200501737H_ILP05_RP_Feb2024.pdf`
- Implementation cohort: `fwd-ilp-generic`
- Current executable slice:
  - `sgd-mip-10`
- Confirmed missing corridors:
  - premium payment term `11` through `30`
- Dependency level:
  - `After PR 2a`
- Why:
  - same-family corridor expansion, but layered mechanics are more complex than Summit
- Suggested branch:
  - `codex/ilp-fwd-max-ppt-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/fwdInvestFirstMax.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/fwdInvestFirstMax.test.ts`
- Notes:
  - do after Summit, not before

### Packet H1
- Family: `HSBC Wealth Focus`
- Product IDs:
  - `hsbc-life-wealth-focus-flexi-1`
  - `hsbc-life-wealth-focus-flexi-3`
  - `hsbc-life-wealth-focus-flexi-5`
- Implementation cohort: `hsbc-premium-base-recovery`
- Missing product cards:
  - `hsbc-life-wealth-focus-flexi-2`
  - `hsbc-life-wealth-focus-flexi-4`
- Source family:
  - `WF brochure.pdf`
- Current executable slice:
  - per flexi card: `sgd-mip-10`, `usd-mip-10`
- Confirmed missing corridors:
  - `Flexi 2`
  - `Flexi 4`
- Dependency level:
  - `After PR 2a`
- Why:
  - same family, same MIP 10, but new flexi-term product cards
- Suggested branch:
  - `codex/ilp-hsbc-wealth-focus-flexi-gap`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/hsbcWealthFocus.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/hsbcWealthFocus.test.ts`
- Notes:
  - this is an easy-win family even though it renders as new product cards

### Packet E1
- Family: `Etiqa Invest flex wealth II`
- Product ID: `etiqa-invest-flex-wealth-ii`
- Source PDF: `EIP_Invest flex wealth II_Product Summary.pdf`
- Implementation cohort: `etiqa-rsp-recovery`
- Current executable slice:
  - `sgd-mip-10`
  - `sgd-mip-15`
  - `sgd-mip-20`
- Confirmed missing corridors:
  - `SGD / MIP 3 years`
  - `SGD / MIP 5 years`
- Dependency level:
  - `After PR 2a`
- Suggested branch:
  - `codex/ilp-etiqa-flex-wealth-ii-mips`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/etiqaInvestFlexWealthIi.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/etiqaInvestFlexWealthIi.test.ts`

### Packet E2
- Family: `Etiqa Invest Wealth Purpose`
- Product ID: `etiqa-invest-wealth-purpose`
- Source PDF: `EIP_Invest Wealth Purpose_Product Summary.pdf`
- Implementation cohort: `etiqa-rsp-recovery`
- Current executable slice:
  - `sgd-mip-10`
  - `sgd-mip-15`
  - `sgd-mip-20`
- Confirmed missing corridors:
  - `SGD / MIP 3 years`
  - `SGD / MIP 5 years`
- Dependency level:
  - `After PR 2a`
- Suggested branch:
  - `codex/ilp-etiqa-wealth-purpose-mips`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/etiqaInvestWealthPurpose.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/etiqaInvestWealthPurpose.test.ts`

### Packet I1
- Family: `Legacy Flex Solitaire (VA3S / VA3R)`
- Product ID: `income-legacy-flex-solitaire`
- Source PDF: `VA3R_VA3S_Summary.pdf`
- Implementation cohort: `generic`
- Current executable slice:
  - `sgd-regular-mip-5`
  - `sgd-regular-mip-10`
- Confirmed missing corridors:
  - `SGD / Single Premium / MIP 5 years`
- Dependency level:
  - `After PR 2b`
- Why:
  - single-premium lane addition
- Suggested branch:
  - `codex/ilp-income-legacy-flex-solitaire-sp`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/incomeLegacyFlexSolitaire.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/incomeLegacyFlexSolitaire.test.ts`

### Packet S1
- Family: `Singlife Legacy Invest`
- Product ID: `singlife-legacy-invest`
- Source PDF: `SinglifeLegacyInvest_PS_Dec25.pdf`
- Implementation cohort: `singlife-ilp-generic`
- Current executable slice:
  - `sgd-mip-10-term-15`
- Confirmed missing corridors:
  - `Single Premium / Term 10`
  - `Single Premium / Term 15`
  - `3 years / Term 10`
  - `3 years / Term 15`
  - `3 years / Term 20`
  - `5 years / Term 10`
  - `5 years / Term 15`
  - `5 years / Term 20`
  - `10 years / Term 20`
  - `10 years / Term 25`
- Dependency level:
  - `After PR 2b`
- Why:
  - mixed family with both single-premium and multiple limited-premium lanes
- Suggested branch:
  - `codex/ilp-singlife-legacy-invest-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/singlifeLegacyInvest.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/singlifeLegacyInvest.test.ts`

### Packet T1
- Family: `TM Atlas Wealth`
- Product ID: `tokio-marine-atlas-wealth`
- Source PDF: `TML_UNWO_TPDN_CIN_Summary.pdf`
- Implementation cohort: `tokio-shortfall-recurring-single-premium`
- Current executable slice:
  - `sgd-mip-25`
  - `sgd-mip-25-advanced-death`
- Confirmed missing corridors:
  - terms `5..24`, each with:
    - base
    - advanced death
- Dependency level:
  - `After PR 2a`
- Suggested branch:
  - `codex/ilp-tokio-atlas-wealth-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineAtlasWealth.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineAtlasWealth.test.ts`

### Packet T2
- Family: `Affluence@Future`
- Product ID: `tokio-marine-affluence-atfuture`
- Source PDF: `TML_UNZA_TPDN_CIN_Summary.pdf`
- Implementation cohort: `tokio-shortfall-recurring-single-premium`
- Current executable slice:
  - `sgd-mip-15`
  - `sgd-mip-15-advanced-death`
  - `sgd-mip-15-advanced-death-life-benefit-rider`
- Confirmed missing corridors:
  - terms `16..30`, each with:
    - base
    - advanced death
    - advanced death + life benefit rider
- Dependency level:
  - `After PR 2a`
- Suggested branch:
  - `codex/ilp-tokio-affluence-atfuture-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineAffluenceAtFuture.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineAffluenceAtFuture.test.ts`

### Packet T3
- Family: `#goClassic`
- Product ID: `tokio-marine-goclassic`
- Source PDF: `TML_UNWU_TPDN_CIN_Summary.pdf`
- Implementation cohort: `tokio-shortfall-recurring-single-premium`
- Current executable slice:
  - `sgd-mip-25`
  - `sgd-mip-25-advanced-death`
- Confirmed missing corridors:
  - terms `5..24`, each with:
    - base
    - advanced death
- Dependency level:
  - `After PR 2a`
- Suggested branch:
  - `codex/ilp-tokio-goclassic-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassic.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassic.test.ts`

### Packet T4
- Family: `#goClassic Secure`
- Product ID: `tokio-marine-goclassic-secure`
- Source PDF: `TML_UNXN_TPDN_CIN_Summary.pdf`
- Implementation cohort: `tokio-shortfall-recurring-single-premium`
- Current executable slice:
  - `sgd-mip-25`
  - `sgd-mip-25-advanced-death`
- Confirmed missing corridors:
  - terms `5..24`, each with:
    - base
    - advanced death
- Dependency level:
  - `After PR 2a`
- Suggested branch:
  - `codex/ilp-tokio-goclassic-secure-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassicSecure.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassicSecure.test.ts`

### Packet T5
- Family: `#goAssure`
- Product ID: `tokio-marine-goassure`
- Source PDF: `TML_UNYA_TPDY_CIN_Summary.pdf`
- Implementation cohort: `tokio-shortfall-recurring-single-premium`
- Current executable slice:
  - `sgd-mip-10`
- Confirmed missing corridors:
  - `5`
  - `15`
  - `20`
  - `25`
- Dependency level:
  - `After PR 2a`
- Suggested branch:
  - `codex/ilp-tokio-goassure-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoAssure.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoAssure.test.ts`

### Packet T6
- Family: `#goAffluence`
- Product ID: `tokio-marine-goaffluence`
- Source PDF: `TML_UNYD_TPDN_CIN_Summary.pdf`
- Implementation cohort: `tokio-shortfall-recurring-single-premium`
- Current executable slice:
  - `sgd-mip-15`
  - `sgd-mip-15-advanced-death`
  - `sgd-mip-15-advanced-death-life-benefit-rider`
- Confirmed missing corridors:
  - terms `16..30`, each with:
    - base
    - advanced death
    - advanced death + life benefit rider
- Dependency level:
  - `After PR 2a`
- Suggested branch:
  - `codex/ilp-tokio-goaffluence-family`
- Expected parser/test touchpoints:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoAffluence.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoAffluence.test.ts`

## Suggested Landing Order

### Immediately after Phase 0
1. Packet H1
2. Packet E1
3. Packet E2
4. Packet A3

### Medium-complexity same-family expansions
5. Packet F1
6. Packet F2

### Tokio batch after PR 2a has proven out
7. Packet T5
8. Packet T1
9. Packet T3
10. Packet T4
11. Packet T2
12. Packet T6

### Mixed-lane families after PR 2b
13. Packet I1
14. Packet A2
15. Packet A1
16. Packet S1

## Shared Verification Commands

Run from:
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend`

Core:
- `npm run type-check`
- `npm run catalog:build`
- `npm run golden:check:source`

Family-specific:
- run the touched parser test file(s)
- run picker/UI coverage if catalog rendering changes:
  - `src/pages/IlpFeeDashboardBridge.test.tsx`

## Current Local Noise
As of this document, repo status contains only unrelated untracked local artifacts:
- `.codex-tmp/immutable-honking-star.rewrite.md`
- `.wrangler/`

Do not bundle those into family corridor work.
