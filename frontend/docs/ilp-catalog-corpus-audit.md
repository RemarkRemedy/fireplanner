# ILP Catalog Corpus Audit

Generated at: 2026-03-12T14:40:13.594Z

## Scope

- Summary PDFs audited: 92
- Brochures were excluded by filename heuristic.
- This audit classifies economic/product structure against the current ILP engine, not parser success.

## Support Buckets

- A-core-fit: 0
- B-extendable: 61
- C-major-gap: 31
- parser-error: 0

## By Insurer

- Tokio Marine: 21
- AIA: 20
- Etiqa: 11
- Great Eastern: 11
- HSBC Life: 10
- Prudential: 7
- Manulife/AIA-like: 5
- FWD: 4
- Singlife: 2
- Unknown/SNACKIV: 1

## Gap Counts

- ad-hoc-premium-routing: 70
- non-guaranteed-charges: 68
- dynamic-charge-model: 63
- withdrawal-reduction-charges: 60
- premium-holiday: 49
- tiered-bonus: 46
- dividend-mode: 42
- multi-life: 25
- free-partial-withdrawal: 21
- death-benefit-structure: 17
- three-plus-account-model: 11
- tiered-fee: 1

## High-Impact Gaps

- Dynamic charge model: 63 products
  Examples: EIP_Dash PET Plus_Summary.pdf; EIP_Invest Smart Vista_Product Summary.pdf; EIP_Invest Wealth Purpose_Product Summary.pdf; EIP_Invest flex prime II_Product Summary.pdf; EIP_Invest flex pro_Product Summary.pdf; EIP_Invest flex wealth II_Product Summary.pdf; EIP_Invest plus SP_Summary.pdf; EIP_Invest smart flex II_Product Summary.pdf
- Multi-life: 25 products
  Examples: FWD Invest First Horizon Product Summary.pdf; FWD Invest Flexi VII Product Summary.pdf; FWD_Invest First Summit_Summary.pdf; FWD_Invest Flexi Elite_Summary.pdf; TML_ULH_TPDN_CIZ_Summary.pdf; TML_ULI_TPDN_CIZ_Summary.pdf; TML_ULP_TPDN_CIZ_Summary.pdf; TML_UNWO_TPDN_CIN_Summary.pdf
- Death-benefit structure / capital guarantee: 17 products
  Examples: HSBC Life Flexi Protector Product Summary.pdf; TML_UNWO_TPDN_CIN_Summary.pdf; TML_UNWU_TPDN_CIN_Summary.pdf; TML_UNYD_TPDN_CIN_Summary.pdf; TML_UNYF_TPDN_CIZ_Summary.pdf; TML_UNYG_TPDN_CIZ_Summary.pdf; TML_UNYJ_TPDN_CIZ_Summary.pdf; TML_UNYR_TPDN_CIZ_Summary.pdf
- Three-plus-account model: 11 products
  Examples: PRUVantage Assure II Product Summary.pdf; PRUVantage Prosper Product Summary.pdf; PRUVantage Wealth II Product Summary.pdf; TML_UNYA_TPDY_CIN_Summary.pdf; TML_UNYD_TPDN_CIN_Summary.pdf; TML_UNYF_TPDN_CIZ_Summary.pdf; TML_UNYG_TPDN_CIZ_Summary.pdf; TML_UNYR_TPDN_CIZ_Summary.pdf
- Premium holiday / withdrawal behavior: 69 products
  Examples: EIP_Invest Smart Vista_Product Summary.pdf; EIP_Invest Wealth Purpose_Product Summary.pdf; EIP_Invest flex prime II_Product Summary.pdf; EIP_Invest flex pro_Product Summary.pdf; EIP_Invest flex wealth II_Product Summary.pdf; EIP_Invest plus SP_Summary.pdf; EIP_Invest smart flex II_Product Summary.pdf; EIP_Invest starter_Product Summary.pdf

## Representative Major-Gap Products

- FWD Invest First Horizon Product Summary.pdf
  Insurer: FWD
  Account model: IUA + AUA
  Gap tags: ad-hoc-premium-routing, dynamic-charge-model, multi-life, tiered-bonus
- FWD Invest Flexi VII Product Summary.pdf
  Insurer: FWD
  Account model: IUA + AUA
  Gap tags: ad-hoc-premium-routing, dynamic-charge-model, multi-life, tiered-bonus
- FWD_Invest First Summit_Summary.pdf
  Insurer: FWD
  Account model: IUA + AUA
  Gap tags: ad-hoc-premium-routing, multi-life, tiered-bonus
- FWD_Invest Flexi Elite_Summary.pdf
  Insurer: FWD
  Account model: IUA + AUA
  Gap tags: ad-hoc-premium-routing, dynamic-charge-model, free-partial-withdrawal, multi-life, tiered-bonus
- HSBC Life Flexi Protector Product Summary.pdf
  Insurer: HSBC Life
  Account model: Unclear
  Gap tags: ad-hoc-premium-routing, death-benefit-structure, dividend-mode, dynamic-charge-model, non-guaranteed-charges, premium-holiday, tiered-fee
- PRUVantage Assure II Product Summary.pdf
  Insurer: Prudential
  Account model: Growth Account + Flex Account + Additional Investment Account
  Gap tags: dynamic-charge-model, free-partial-withdrawal, non-guaranteed-charges, premium-holiday, three-plus-account-model, withdrawal-reduction-charges
- PRUVantage Prosper Product Summary.pdf
  Insurer: Prudential
  Account model: Growth Account + Flex Account + Additional Investment Account
  Gap tags: dynamic-charge-model, free-partial-withdrawal, non-guaranteed-charges, premium-holiday, three-plus-account-model, withdrawal-reduction-charges
- PRUVantage Wealth II Product Summary.pdf
  Insurer: Prudential
  Account model: Growth Account + Flex Account + Additional Investment Account
  Gap tags: dynamic-charge-model, free-partial-withdrawal, non-guaranteed-charges, premium-holiday, three-plus-account-model, withdrawal-reduction-charges
- TML_ULH_TPDN_CIZ_Summary.pdf
  Insurer: Tokio Marine
  Account model: Top-up Account
  Gap tags: ad-hoc-premium-routing, dividend-mode, multi-life, withdrawal-reduction-charges
- TML_ULI_TPDN_CIZ_Summary.pdf
  Insurer: Tokio Marine
  Account model: Top-up Account
  Gap tags: ad-hoc-premium-routing, dividend-mode, dynamic-charge-model, multi-life, non-guaranteed-charges, withdrawal-reduction-charges
- TML_ULP_TPDN_CIZ_Summary.pdf
  Insurer: Tokio Marine
  Account model: Top-up Account
  Gap tags: ad-hoc-premium-routing, dividend-mode, multi-life, tiered-bonus, withdrawal-reduction-charges
- TML_UNWO_TPDN_CIN_Summary.pdf
  Insurer: Tokio Marine
  Account model: IUA + AUA
  Gap tags: ad-hoc-premium-routing, death-benefit-structure, dividend-mode, dynamic-charge-model, multi-life, non-guaranteed-charges, premium-holiday, tiered-bonus
- TML_UNWU_TPDN_CIN_Summary.pdf
  Insurer: Tokio Marine
  Account model: IUA + AUA
  Gap tags: ad-hoc-premium-routing, death-benefit-structure, dividend-mode, dynamic-charge-model, multi-life, non-guaranteed-charges, premium-holiday, tiered-bonus
- TML_UNXN_TPDN_CIN_Summary.pdf
  Insurer: Tokio Marine
  Account model: IUA + AUA
  Gap tags: ad-hoc-premium-routing, dividend-mode, dynamic-charge-model, multi-life, non-guaranteed-charges, premium-holiday, tiered-bonus
- TML_UNYA_TPDY_CIN_Summary.pdf
  Insurer: Tokio Marine
  Account model: IUA + AUA + Top-up Account
  Gap tags: ad-hoc-premium-routing, dividend-mode, dynamic-charge-model, non-guaranteed-charges, premium-holiday, three-plus-account-model, tiered-bonus, withdrawal-reduction-charges

## Recommended V1 Completeness Boundary

- V1 can be near-complete for standard two-account ILPs with EEC, account-level fees, and bonus ladders.
- To push V1 closer to corpus completeness, the first engine extensions to prioritize are:
  1. dynamic charge model for insurance/protection/admin charges
  2. richer account-model support for three-account products
  3. product metadata + UI warnings for premium holiday, free withdrawals, and charge recovery mechanics
- Multi-life and death-benefit-option/capital-guarantee products are the clearest candidates for partial support first, not full V1 parity.