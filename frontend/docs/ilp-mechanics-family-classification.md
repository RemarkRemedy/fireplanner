# ILP Mechanics Family Classification

This file is generated from the corpus audit and the current catalog snapshot.

Corpus size: 92

## Classification Contract

- `primaryFamily` is structural and mutually exclusive.
- `overlayTags` are cross-cutting mechanics that can apply to any primary family.
- `implementationCohort` groups insurer-shaped rollout work without replacing the primary family axis.
- `v1SupportBoundary` is the current V1 planning boundary, not a public support claim by itself.
- `kernelWorkstreams` are the taxonomic implementation tracks implied by the product mechanics.
- `remainingKernelBlockers` are the current execution blockers after subtracting completed kernels and product-specific bounded-scope decisions. Use this field, not `kernelWorkstreams`, as the execution source of truth.

## Primary Families

| Key | Count |
| --- | ---: |
| `standard-2-account-core-cashflow` | 58 |
| `protection-heavy-death-benefit` | 29 |
| `multi-account-special-account` | 5 |

## Overlay Counts

| Key | Count |
| --- | ---: |
| `dynamic-charge` | 83 |
| `ad-hoc-premium-routing` | 71 |
| `premium-holiday-recovery` | 69 |
| `bonus-richness` | 46 |
| `assurance-charge` | 43 |
| `distribution-mode` | 42 |
| `protection-structure` | 29 |
| `payment-history` | 3 |

## Implementation Cohorts

| Key | Count |
| --- | ---: |
| `tokio-shortfall-recurring-single-premium` | 21 |
| `aia-ilp-generic` | 20 |
| `generic` | 13 |
| `great-eastern-ilp-generic` | 11 |
| `hsbc-premium-base-recovery` | 10 |
| `etiqa-rsp-recovery` | 7 |
| `fwd-ilp-generic` | 4 |
| `prudential-pruvantage-multi-account` | 4 |
| `singlife-ilp-generic` | 2 |

## V1 Support Boundaries

| Key | Count |
| --- | ---: |
| `supported-now` | 92 |

## Kernel Workstream Tiers

| Key | Count |
| --- | ---: |
| `0-workstreams` | 92 |

## Remaining Kernel Blocker Tiers

| Key | Count |
| --- | ---: |
| `0-workstreams` | 92 |

## Product Matrix

| File | Primary family | Overlays | Cohort | Boundary | Kernel tier | Remaining blocker tier | Catalog status | Golden coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EIP_Dash PET Plus_Summary.pdf | `standard-2-account-core-cashflow` | assurance-charge, distribution-mode, dynamic-charge | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest flex prime II_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest flex pro_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest flex wealth II_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest plus SP_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest smart flex II_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest Smart Vista_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest starter_Product Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest vista_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Invest Wealth Purpose_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| EIP_Tiq_Invest_Summary.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| FWD Invest First Horizon Product Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, protection-structure | `fwd-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| FWD Invest Flexi VII Product Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, protection-structure | `fwd-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| FWD_Invest First Summit_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, bonus-richness, protection-structure | `fwd-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| FWD_Invest Flexi Elite_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery, protection-structure | `fwd-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| GBII_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, distribution-mode, dynamic-charge, payment-history, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| GL3_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Flexi Protector Product Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Abundance Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Accelerate Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Harvest Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Invest (Cash_SRS) PS.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, distribution-mode, dynamic-charge | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Invest (CPF) Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, dynamic-charge | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Voyage Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRUActive LinkGuard Product Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRULink InvestGrowth (SP) Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRULink InvestGrowth Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRUVantage Assure (SP) Product Summary.pdf | `multi-account-special-account` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `prudential-pruvantage-multi-account` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRUVantage Assure II Product Summary.pdf | `multi-account-special-account` | dynamic-charge, premium-holiday-recovery | `prudential-pruvantage-multi-account` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRUVantage Prosper Product Summary.pdf | `multi-account-special-account` | dynamic-charge, premium-holiday-recovery | `prudential-pruvantage-multi-account` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRUVantage Wealth II Product Summary.pdf | `multi-account-special-account` | dynamic-charge, premium-holiday-recovery | `prudential-pruvantage-multi-account` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS_GEL_Investment Linked Insurance Plan 2_v3.0.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge, payment-history, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS(EN)_GREAT Invest Advantage (RSP)_(SG)_v3.0.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS(EN)_GREAT Invest Advantage (SP)_(SG)_v3.0.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS(EN)_GREAT Invest Advantage 2 (SP)_(SG)_v2.0.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS(EN)_GREAT Invest Advantage2(RSP)_v2.0.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS(EN)_GREAT Life Advantage 4_(SG)_v2.0.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge, payment-history, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS(EN)_GREAT Wealth Advantage 4_(SG)_v2.0.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS(EN)_Prestige Legacy Advantage_(SG)_v2.0.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS(EN)_Prestige Portfolio_(SG)_v5.0.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `great-eastern-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| SinglifeLegacyInvest_PS_Dec25.pdf | `protection-heavy-death-benefit` | bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `singlife-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| SinglifeSavvyInvestII_PS_Dec25.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `singlife-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| SNACKIV_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UL4_TPDN_CIZ_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_ULH_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, distribution-mode, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_ULI_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_ULP_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, bonus-richness, distribution-mode, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNWO_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNWU_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNXN_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNYA_TPDY_CIN_Summary.pdf | `multi-account-special-account` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNYD_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNYF_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNYG_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNYJ_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNYR_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNZA_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNZL_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNZO_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNZS_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNZV_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UNZY_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UOAB_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| TML_UOAN_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| VA2_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| VA3R_VA3S_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| VS1_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| VS2_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| VS3_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_MI2_ILP_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_MID01_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_MIR03_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_MIRG_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_MIRP_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_MSRI5_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_MSRS5_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_200501737H_ILP01_SP_May2023.pdf | `protection-heavy-death-benefit` | protection-structure | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_200501737H_ILP05_RP_Feb2024.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, bonus-richness, protection-structure | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_APA3.0_Oct2024.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_AWV_Jan2026.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_CPFIE_Oct2024.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_ESI5P_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_ESISP_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_NonCPFIE_Oct2024.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_PLP(II)_Oct2024.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery, protection-structure | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_PRE_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_PWE2.0_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_PWL_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WA_Sum_201106386R_PWV2.0_Apr2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WF PS v1.51_MIP10Flexi1.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WF PS v1.51_MIP10Flexi3.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| WF PS v1.51_MIP10Flexi5.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |

