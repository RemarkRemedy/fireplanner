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
| `supported-after-kernel` | 57 |
| `partial-v1` | 29 |
| `supported-now` | 6 |

## Kernel Workstream Tiers

| Key | Count |
| --- | ---: |
| `2-3-workstreams` | 32 |
| `4-plus-workstreams` | 28 |
| `1-workstream` | 26 |
| `0-workstreams` | 6 |

## Remaining Kernel Blocker Tiers

| Key | Count |
| --- | ---: |
| `0-workstreams` | 44 |
| `1-workstream` | 26 |
| `2-3-workstreams` | 22 |

## Product Matrix

| File | Primary family | Overlays | Cohort | Boundary | Kernel tier | Remaining blocker tier | Catalog status | Golden coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EIP_Dash PET Plus_Summary.pdf | `standard-2-account-core-cashflow` | assurance-charge, distribution-mode, dynamic-charge | `generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| EIP_Invest flex prime II_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| EIP_Invest flex pro_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| EIP_Invest flex wealth II_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| EIP_Invest plus SP_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| EIP_Invest smart flex II_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| EIP_Invest Smart Vista_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| EIP_Invest starter_Product Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| EIP_Invest vista_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| EIP_Invest Wealth Purpose_Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery | `etiqa-rsp-recovery` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| EIP_Tiq_Invest_Summary.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge | `generic` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| FWD Invest First Horizon Product Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, protection-structure | `fwd-ilp-generic` | `partial-v1` | `4-plus-workstreams` | `1-workstream` | `partial` | `none` |
| FWD Invest Flexi VII Product Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, protection-structure | `fwd-ilp-generic` | `partial-v1` | `4-plus-workstreams` | `1-workstream` | `partial` | `none` |
| FWD_Invest First Summit_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, bonus-richness, protection-structure | `fwd-ilp-generic` | `partial-v1` | `2-3-workstreams` | `1-workstream` | `not-in-catalog` | `none` |
| FWD_Invest Flexi Elite_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, dynamic-charge, premium-holiday-recovery, protection-structure | `fwd-ilp-generic` | `partial-v1` | `4-plus-workstreams` | `1-workstream` | `partial` | `none` |
| GBII_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, distribution-mode, dynamic-charge, payment-history, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| GL3_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `great-eastern-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| HSBC Life Flexi Protector Product Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `hsbc-premium-base-recovery` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `subset-fixtures` |
| HSBC Life Wealth Abundance Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Accelerate Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Harvest Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| HSBC Life Wealth Invest (Cash_SRS) PS.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, distribution-mode, dynamic-charge | `hsbc-premium-base-recovery` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| HSBC Life Wealth Invest (CPF) Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, dynamic-charge | `hsbc-premium-base-recovery` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| HSBC Life Wealth Voyage Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `subset-fixtures` |
| PRUActive LinkGuard Product Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| PRULink InvestGrowth (SP) Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| PRULink InvestGrowth Product Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| PRUVantage Assure (SP) Product Summary.pdf | `multi-account-special-account` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `prudential-pruvantage-multi-account` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| PRUVantage Assure II Product Summary.pdf | `multi-account-special-account` | dynamic-charge, premium-holiday-recovery | `prudential-pruvantage-multi-account` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRUVantage Prosper Product Summary.pdf | `multi-account-special-account` | dynamic-charge, premium-holiday-recovery | `prudential-pruvantage-multi-account` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PRUVantage Wealth II Product Summary.pdf | `multi-account-special-account` | dynamic-charge, premium-holiday-recovery | `prudential-pruvantage-multi-account` | `supported-now` | `0-workstreams` | `0-workstreams` | `supported` | `full-supported-gate` |
| PS_GEL_Investment Linked Insurance Plan 2_v3.0.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge, payment-history, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| PS(EN)_GREAT Invest Advantage (RSP)_(SG)_v3.0.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `great-eastern-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| PS(EN)_GREAT Invest Advantage (SP)_(SG)_v3.0.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `great-eastern-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| PS(EN)_GREAT Invest Advantage 2 (SP)_(SG)_v2.0.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `great-eastern-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| PS(EN)_GREAT Invest Advantage2(RSP)_v2.0.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `great-eastern-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| PS(EN)_GREAT Life Advantage 4_(SG)_v2.0.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge, payment-history, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| PS(EN)_GREAT Wealth Advantage 4_(SG)_v2.0.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| PS(EN)_Prestige Legacy Advantage_(SG)_v2.0.pdf | `standard-2-account-core-cashflow` | assurance-charge, dynamic-charge, premium-holiday-recovery | `great-eastern-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| PS(EN)_Prestige Portfolio_(SG)_v5.0.pdf | `standard-2-account-core-cashflow` | dynamic-charge | `great-eastern-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| SinglifeLegacyInvest_PS_Dec25.pdf | `protection-heavy-death-benefit` | bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `singlife-ilp-generic` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| SinglifeSavvyInvestII_PS_Dec25.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `singlife-ilp-generic` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| SNACKIV_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| TML_UL4_TPDN_CIZ_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing | `tokio-shortfall-recurring-single-premium` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| TML_ULH_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, distribution-mode, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `2-3-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_ULI_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_ULP_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, bonus-richness, distribution-mode, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNWO_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNWU_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNXN_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNYA_TPDY_CIN_Summary.pdf | `multi-account-special-account` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `tokio-shortfall-recurring-single-premium` | `supported-after-kernel` | `4-plus-workstreams` | `1-workstream` | `not-in-catalog` | `none` |
| TML_UNYD_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNYF_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNYG_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNYJ_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNYR_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNZA_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNZL_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNZO_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UNZS_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `subset-fixtures` |
| TML_UNZV_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `subset-fixtures` |
| TML_UNZY_TPDN_CIZ_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UOAB_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| TML_UOAN_TPDN_CIN_Summary.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery, protection-structure | `tokio-shortfall-recurring-single-premium` | `partial-v1` | `4-plus-workstreams` | `2-3-workstreams` | `partial` | `none` |
| VA2_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| VA3R_VA3S_Summary.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| VS1_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| VS2_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| VS3_Summary.pdf | `standard-2-account-core-cashflow` | dynamic-charge, premium-holiday-recovery | `generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_MI2_ILP_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `aia-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_MID01_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_MIR03_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_MIRG_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_MIRP_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_MSRI5_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_MSRS5_PdtSum.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_Sum_200501737H_ILP01_SP_May2023.pdf | `protection-heavy-death-benefit` | protection-structure | `aia-ilp-generic` | `partial-v1` | `1-workstream` | `1-workstream` | `partial` | `none` |
| WA_Sum_200501737H_ILP05_RP_Feb2024.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, bonus-richness, protection-structure | `aia-ilp-generic` | `partial-v1` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_Sum_201106386R_APA3.0_Oct2024.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `0-workstreams` | `partial` | `none` |
| WA_Sum_201106386R_AWV_Jan2026.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_Sum_201106386R_CPFIE_Oct2024.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `aia-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_Sum_201106386R_ESI5P_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_Sum_201106386R_ESISP_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_Sum_201106386R_NonCPFIE_Oct2024.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge | `aia-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_Sum_201106386R_PLP(II)_Oct2024.pdf | `protection-heavy-death-benefit` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery, protection-structure | `aia-ilp-generic` | `partial-v1` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WA_Sum_201106386R_PRE_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_Sum_201106386R_PWE2.0_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_Sum_201106386R_PWL_Jul2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `1-workstream` | `0-workstreams` | `partial` | `none` |
| WA_Sum_201106386R_PWV2.0_Apr2025.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `aia-ilp-generic` | `supported-after-kernel` | `2-3-workstreams` | `1-workstream` | `partial` | `none` |
| WF PS v1.51_MIP10Flexi1.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-after-kernel` | `4-plus-workstreams` | `1-workstream` | `partial` | `none` |
| WF PS v1.51_MIP10Flexi3.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-after-kernel` | `4-plus-workstreams` | `1-workstream` | `partial` | `none` |
| WF PS v1.51_MIP10Flexi5.pdf | `standard-2-account-core-cashflow` | ad-hoc-premium-routing, assurance-charge, bonus-richness, distribution-mode, dynamic-charge, premium-holiday-recovery | `hsbc-premium-base-recovery` | `supported-after-kernel` | `4-plus-workstreams` | `1-workstream` | `partial` | `none` |

