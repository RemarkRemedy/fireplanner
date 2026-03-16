import type { IlpCatalogSnapshot } from '../../../scripts/ilp-catalog/catalogSnapshot'
import { createDefaultPolicy } from '../../stores/useIlpStore'
import { templateVariantToPolicySeed } from '../ilp-catalog/templateToPolicy'
import type { IlpCatalogProduct, IlpTemplateVariant } from '../ilp-catalog/types'
import { ilpPolicySchema } from '../validation/ilpSchema'
import { analyzeIlpPolicy, type IlpFund, type IlpPolicyInput } from './ilp'
import type { GoldenFixtureArtifact } from './ilpGoldenHarness'

export type GoldenIlpFixtureClass = 'supported' | 'partial-modeled-subset'

export type GoldenCoverageTag =
  | 'baseline'
  | 'event-heavy'
  | 'ocf-stress'
  | 'kernel:scheduled-payout-manual-assumption'
  | 'branch:aia-invest-easy-cash-srs-three-percent-single-premium-charge'
  | 'branch:aia-invest-easy-cash-srs-three-percent-top-up-charge'
  | 'branch:aia-invest-easy-cash-srs-three-percent-recurring-single-premium-charge'
  | 'branch:aia-invest-easy-cpf-zero-single-premium-charge'
  | 'branch:aia-invest-easy-cpf-zero-top-up-charge'
  | 'branch:aia-invest-easy-cpf-zero-recurring-single-premium-charge'
  | 'branch:aia-platinum-retirement-elite-regular-premium-charge'
  | 'branch:aia-platinum-retirement-elite-regular-supplementary-charge'
  | 'branch:aia-platinum-retirement-elite-top-up-premium-charge'
  | 'branch:aia-platinum-retirement-elite-premium-holiday-charge'
  | 'branch:aia-platinum-retirement-elite-partial-withdrawal-charge'
  | 'branch:aia-platinum-retirement-elite-full-surrender-charge'
  | 'branch:aia-elite-secure-income-sp-single-premium-charge'
  | 'branch:aia-elite-secure-income-sp-supplementary-charge-manual-input'
  | 'branch:aia-elite-secure-income-sp-top-up-premium-charge'
  | 'branch:aia-elite-secure-income-sp-partial-withdrawal-charge'
  | 'branch:aia-elite-secure-income-sp-full-surrender-charge'
  | 'branch:aia-elite-secure-income-5p-premium-year-premium-charge'
  | 'branch:aia-elite-secure-income-5p-supplementary-charge-manual-input'
  | 'branch:aia-elite-secure-income-5p-top-up-premium-charge'
  | 'branch:aia-elite-secure-income-5p-premium-holiday-charge'
  | 'branch:aia-elite-secure-income-5p-partial-withdrawal-charge'
  | 'branch:aia-elite-secure-income-5p-full-surrender-charge'
  | 'branch:aia-wealth-venture-zero-regular-premium-charge'
  | 'branch:aia-wealth-venture-regular-supplementary-charge'
  | 'branch:aia-wealth-venture-top-up-premium-charge'
  | 'branch:aia-wealth-venture-premium-holiday-charge'
  | 'branch:aia-wealth-venture-partial-withdrawal-charge'
  | 'branch:aia-wealth-venture-full-surrender-charge'
  | 'branch:aia-platinum-wealth-elite-2-regular-premium-charge'
  | 'branch:aia-platinum-wealth-elite-2-top-up-premium-charge'
  | 'branch:aia-platinum-wealth-elite-2-premium-holiday-charge'
  | 'branch:aia-platinum-wealth-elite-2-partial-withdrawal-charge'
  | 'branch:aia-platinum-wealth-elite-2-full-surrender-charge'
  | 'branch:aia-platinum-wealth-legacy-regular-premium-charge'
  | 'branch:aia-platinum-wealth-legacy-top-up-premium-charge'
  | 'branch:aia-platinum-wealth-legacy-premium-holiday-charge'
  | 'branch:aia-platinum-wealth-legacy-partial-withdrawal-charge'
  | 'branch:aia-platinum-wealth-legacy-full-surrender-charge'
  | 'branch:aia-pro-achiever-3-regular-premium-charge'
  | 'branch:aia-pro-achiever-3-top-up-premium-charge'
  | 'branch:aia-pro-achiever-3-partial-withdrawal-charge'
  | 'branch:aia-pro-achiever-3-full-surrender-charge'
  | 'branch:aia-platinum-wealth-venture-2-zero-regular-premium-charge'
  | 'branch:aia-platinum-wealth-venture-2-regular-supplementary-charge'
  | 'branch:aia-platinum-wealth-venture-2-top-up-premium-charge'
  | 'branch:aia-platinum-wealth-venture-2-premium-holiday-charge'
  | 'branch:aia-platinum-wealth-venture-2-partial-withdrawal-charge'
  | 'branch:aia-platinum-wealth-venture-2-full-surrender-charge'
  | 'branch:hsbc-holiday-repayment'
  | 'branch:hsbc-holiday-no-repayment'
  | 'branch:hsbc-bonus-suspension'
  | 'branch:hsbc-premium-reduction-brc'
  | 'branch:hsbc-top-up-routing'
  | 'branch:hsbc-life-flexi-protector-regular-premium-charge'
  | 'branch:hsbc-life-flexi-protector-regular-premium-allocation-uplift'
  | 'branch:hsbc-life-flexi-protector-additional-bonus-units'
  | 'branch:hsbc-life-flexi-protector-administration-fee'
  | 'branch:hsbc-life-flexi-protector-top-up-premium-charge'
  | 'branch:hsbc-life-flexi-protector-recurring-single-premium-charge'
  | 'branch:hsbc-life-flexi-protector-zero-partial-withdrawal-charge'
  | 'branch:hsbc-harvest-holiday-charge'
  | 'branch:hsbc-harvest-pwc'
  | 'branch:hsbc-harvest-brc'
  | 'branch:hsbc-harvest-topup-charge'
  | 'branch:hsbc-abundance-free-withdrawal'
  | 'branch:hsbc-abundance-tiered-brc'
  | 'branch:hsbc-abundance-topup-charge'
  | 'branch:hsbc-abundance-power-up-restoration'
  | 'branch:wealth-focus-startup-bonus'
  | 'branch:wealth-focus-premium-contribution-bonus'
  | 'branch:wealth-focus-loyalty-bonus'
  | 'branch:wealth-focus-premium-base-amf'
  | 'branch:wealth-focus-top-up-premium-charge'
  | 'branch:wealth-focus-partial-withdrawal-charge'
  | 'branch:wealth-focus-eec'
  | 'branch:wealth-focus-ad-hoc-top-up-routing'
  | 'branch:wealth-focus-premium-holiday-charge'
  | 'branch:hsbc-voyage-premium-base-amf'
  | 'branch:hsbc-voyage-tiered-brc'
  | 'branch:hsbc-voyage-topup-charge'
  | 'branch:hsbc-voyage-premium-holiday-suspension'
  | 'branch:tokio-atlas-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction'
  | 'hsbc-voyage-premium-base-amf'
  | 'hsbc-voyage-startup-bonus-tiered'
  | 'hsbc-voyage-bonus-recovery-charge'
  | 'hsbc-voyage-power-up-bonus-modeled-subset'
  | 'hsbc-voyage-loyalty-bonus-partial-withdrawal-subset'
  | 'hsbc-voyage-topup-premium-charge'
  | 'hsbc-voyage-partial-withdrawal-charge'
  | 'hsbc-voyage-eec'
  | 'branch:goal-builder-ii-welcome-bonus'
  | 'branch:goal-builder-ii-welcome-bonus-recovery'
  | 'branch:goal-builder-ii-premium-year-paf'
  | 'branch:goal-builder-ii-loyalty-bonus-cadence'
  | 'branch:goal-builder-ii-top-up-premium-charge'
  | 'branch:goal-builder-ii-recurrent-single-premium-charge'
  | 'branch:goal-builder-ii-premium-year-surrender-charge'
  | 'branch:manulife-smartretire-v-administrative-charge'
  | 'branch:manulife-smartretire-v-withdrawal-and-surrender-charge'
  | 'branch:manulife-smartretire-v-premium-shortfall-charge'
  | 'branch:manulife-smartretire-v-zero-top-up-charge'
  | 'branch:manulife-investready-iii-administrative-charge'
  | 'branch:manulife-investready-iii-premium-shortfall-charge'
  | 'branch:manulife-investready-iii-zero-top-up-charge'
  | 'branch:manulife-investready-iii-partial-withdrawal-charge'
  | 'branch:manulife-investready-iii-full-surrender-charge'
  | 'branch:singlife-legacy-invest-welcome-bonus'
  | 'branch:singlife-legacy-invest-loyalty-bonus'
  | 'branch:singlife-legacy-invest-administrative-charge'
  | 'branch:singlife-legacy-invest-top-up-charge'
  | 'branch:singlife-legacy-invest-partial-withdrawal-charge'
  | 'branch:singlife-legacy-invest-surrender-charge'
  | 'branch:singlife-legacy-invest-premium-shortfall-charge'
  | 'branch:singlife-savvy-invest-ii-welcome-bonus'
  | 'branch:singlife-savvy-invest-ii-regular-premium-allocation-uplift'
  | 'branch:singlife-savvy-invest-ii-loyalty-bonus'
  | 'branch:singlife-savvy-invest-ii-administrative-charge'
  | 'branch:singlife-savvy-invest-ii-supplementary-charge'
  | 'branch:singlife-savvy-invest-ii-zero-top-up-charge'
  | 'branch:singlife-savvy-invest-ii-partial-withdrawal-charge'
  | 'branch:singlife-savvy-invest-ii-surrender-charge'
  | 'branch:singlife-savvy-invest-ii-premium-shortfall-charge'
  | 'branch:etiqa-invest-plus-sp-zero-single-premium-charge'
  | 'branch:etiqa-invest-plus-sp-policy-charge'
  | 'branch:etiqa-invest-plus-sp-top-up-premium-charge'
  | 'branch:etiqa-invest-plus-sp-initial-partial-withdrawal-charge'
  | 'branch:etiqa-invest-plus-sp-initial-surrender-charge'
  | 'branch:etiqa-dash-pet-plus-zero-single-premium-charge'
  | 'branch:etiqa-dash-pet-plus-management-charge'
  | 'branch:etiqa-dash-pet-plus-zero-top-up-charge'
  | 'branch:etiqa-dash-pet-plus-zero-partial-withdrawal-charge'
  | 'branch:pru-holiday-refund'
  | 'branch:pru-holiday-fallback'
  | 'branch:pru-top-up-charge'
  | 'branch:pru-free-withdrawal'
  | 'branch:pru-charged-withdrawal'
  | 'branch:prulink-investgrowth-sp-single-premium-charge'
  | 'branch:prulink-investgrowth-sp-premium-assurance-charge'
  | 'branch:prulink-investgrowth-sp-top-up-charge'
  | 'branch:prulink-investgrowth-sp-top-up-assurance-charge'
  | 'branch:manulink-investor-ii-single-premium-charge'
  | 'branch:manulink-investor-ii-top-up-premium-charge'
  | 'branch:manulink-investor-ii-srs-recurring-single-premium-charge'
  | 'branch:prulink-investgrowth-recurring-premium-charge'
  | 'branch:prulink-investgrowth-premium-assurance-charge'
  | 'branch:prulink-investgrowth-top-up-charge'
  | 'branch:prulink-investgrowth-top-up-assurance-charge'
  | 'branch:income-wealthlink-gl3-single-premium-charge'
  | 'branch:income-wealthlink-gl3-top-up-premium-charge'
  | 'branch:income-wealthlink-gl3-recurring-single-premium-charge'
  | 'branch:income-wealthlink-gl3-open-ended-zero-surrender-charge'
  | 'kernel:protected-base-assurance'
  | 'branch:income-vs1-policy-fee'
  | 'branch:income-vs1-death-ti-insurance-cover-charge'
  | 'branch:income-vs1-regular-premium-allocation-uplift'
  | 'branch:income-vs1-investment-bonus'
  | 'branch:income-vs1-loyalty-bonus'
  | 'branch:income-vs1-premium-holiday-charge'
  | 'branch:income-vs1-partial-withdrawal-charge'
  | 'branch:income-vs1-surrender-charge'
  | 'branch:income-vs1-ad-hoc-top-up-routing'
  | 'branch:income-vs2-policy-fee'
  | 'branch:income-vs2-death-ti-insurance-cover-charge'
  | 'branch:income-vs2-regular-premium-allocation-uplift'
  | 'branch:income-vs2-investment-bonus'
  | 'branch:income-vs2-loyalty-bonus'
  | 'branch:income-vs2-premium-holiday-charge'
  | 'branch:income-vs2-partial-withdrawal-charge'
  | 'branch:income-vs2-surrender-charge'
  | 'branch:income-vs2-ad-hoc-top-up-routing'
  | 'branch:income-vs3-policy-fee'
  | 'branch:income-vs3-death-ti-insurance-cover-charge'
  | 'branch:income-vs3-regular-premium-allocation-uplift'
  | 'branch:income-vs3-investment-bonus'
  | 'branch:income-vs3-loyalty-bonus'
  | 'branch:income-vs3-premium-holiday-charge'
  | 'branch:income-vs3-partial-withdrawal-charge'
  | 'branch:income-vs3-surrender-charge'
  | 'branch:income-vs3-ad-hoc-top-up-routing'
  | 'branch:income-snack-investment-zero-single-premium-charge'
  | 'branch:income-snack-investment-zero-top-up-charge'
  | 'branch:income-snack-investment-zero-withdrawal-charge'
  | 'branch:hsbc-life-wealth-invest-cpf-zero-single-premium-charge'
  | 'branch:hsbc-life-wealth-invest-cpf-zero-recurring-single-premium-charge'
  | 'branch:hsbc-life-wealth-invest-cpf-zero-top-up-charge'
  | 'branch:hsbc-life-wealth-invest-cpf-zero-redemption-fee'
  | 'branch:invest-starter-policy-charge'
  | 'branch:invest-starter-premium-shortfall-charge'
  | 'branch:invest-starter-premium-shortfall-refund'
  | 'branch:invest-starter-partial-withdrawal-charge'
  | 'branch:invest-starter-surrender-charge'
  | 'branch:invest-starter-ad-hoc-top-up-routing'
  | 'branch:etiqa-tiq-invest-zero-single-premium-charge'
  | 'branch:etiqa-tiq-invest-management-charge'
  | 'branch:etiqa-tiq-invest-zero-top-up-charge'
  | 'branch:etiqa-tiq-invest-zero-recurring-single-premium-charge'
  | 'branch:etiqa-tiq-invest-zero-partial-withdrawal-charge'
  | 'branch:tokio-marine-wealth-enhancer-cpfis-zero-single-premium-charge'
  | 'branch:tokio-marine-wealth-enhancer-cpfis-zero-top-up-charge'
  | 'branch:tokio-marine-wealth-enhancer-cpfis-zero-recurring-single-premium-charge'
  | 'branch:tokio-marine-wealth-enhancer-cpfis-zero-partial-withdrawal-charge'
  | 'branch:tokio-marine-affluence-atfuture-zero-partial-withdrawal-charge'
  | 'branch:tokio-marine-goelite-zero-single-premium-charge'
  | 'branch:tokio-marine-goelite-establishment-charge'
  | 'branch:tokio-marine-goelite-administrative-charge'
  | 'branch:tokio-marine-goelite-recurring-single-and-top-up-charge'
  | 'branch:tokio-marine-goelite-zero-partial-withdrawal-charge'
  | 'branch:tokio-marine-goelite-surrender-charge'
  | 'branch:tokio-marine-goelite-secure-zero-single-premium-charge'
  | 'branch:tokio-marine-goelite-secure-establishment-charge'
  | 'branch:tokio-marine-goelite-secure-administrative-charge'
  | 'branch:tokio-marine-goelite-secure-recurring-single-and-top-up-charge'
  | 'branch:tokio-marine-goelite-secure-zero-partial-withdrawal-charge'
  | 'branch:tokio-marine-goelite-secure-surrender-charge'
  | 'branch:tokio-marine-gowealth-enrich-zero-single-premium-charge'
  | 'branch:tokio-marine-gowealth-enrich-establishment-charge'
  | 'branch:tokio-marine-gowealth-enrich-administrative-charge'
  | 'branch:tokio-marine-gowealth-enrich-recurring-single-and-top-up-charge'
  | 'branch:tokio-marine-gowealth-enrich-single-premium-partial-withdrawal-charge'
  | 'branch:tokio-marine-gowealth-enrich-surrender-charge'
  | 'branch:tokio-marine-goassure-initial-charge'
  | 'branch:tokio-marine-goassure-policy-charge'
  | 'branch:tokio-marine-goassure-recurring-single-and-top-up-charge'
  | 'branch:tokio-marine-goassure-partial-withdrawal-charge'
  | 'branch:tokio-marine-goassure-premium-shortfall-charge'
  | 'branch:tokio-marine-goassure-surrender-charge'
  | 'branch:tokio-wealth-builder-atfuture-advanced-death-monthly-protection-charge'
  | 'branch:fwd-invest-flexi-vii-initial-account-charge'
  | 'branch:fwd-invest-flexi-vii-insurance-charge'
  | 'branch:fwd-invest-flexi-vii-top-up-premium-charge'
  | 'branch:fwd-invest-flexi-vii-initial-account-redemption-fee'
  | 'branch:fwd-invest-flexi-vii-initial-account-surrender-charge'
  | 'branch:fwd-invest-goal-1-zero-single-premium-charge'
  | 'branch:fwd-invest-goal-1-initial-account-charge'
  | 'branch:fwd-invest-goal-1-plan-charge'
  | 'branch:fwd-invest-goal-1-surrender-charge'
  | 'branch:fwd-invest-goal-1-zero-partial-withdrawal-charge'
  | 'branch:hsbc-life-wealth-invest-cash-srs-max-single-premium-charge'
  | 'branch:hsbc-life-wealth-invest-cash-srs-max-recurring-single-premium-charge'
  | 'branch:hsbc-life-wealth-invest-cash-srs-max-top-up-charge'
  | 'branch:hsbc-life-wealth-invest-cash-srs-zero-redemption-fee'
  | 'branch:etiqa-flex-prime-ii-startup-bonus'
  | 'branch:etiqa-flex-prime-ii-special-bonus'
  | 'branch:etiqa-flex-prime-ii-loyalty-bonus'
  | 'branch:etiqa-flex-prime-ii-policy-charge'
  | 'branch:etiqa-flex-prime-ii-insurance-charge'
  | 'branch:etiqa-flex-prime-ii-top-up-premium-charge'
  | 'branch:etiqa-flex-prime-ii-startup-bonus-recovery'
  | 'branch:etiqa-flex-prime-ii-partial-withdrawal-charge'
  | 'branch:etiqa-flex-prime-ii-surrender-charge'
  | 'branch:etiqa-flex-pro-startup-bonus'
  | 'branch:etiqa-flex-pro-special-bonus'
  | 'branch:etiqa-flex-pro-loyalty-bonus'
  | 'branch:etiqa-flex-pro-policy-charge'
  | 'branch:etiqa-flex-pro-insurance-charge'
  | 'branch:etiqa-flex-pro-top-up-premium-charge'
  | 'branch:etiqa-flex-pro-startup-bonus-recovery'
  | 'branch:etiqa-flex-pro-partial-withdrawal-charge'
  | 'branch:etiqa-flex-pro-surrender-charge'
  | 'branch:etiqa-vista-startup-bonus'
  | 'branch:etiqa-vista-special-bonus'
  | 'branch:etiqa-vista-loyalty-bonus'
  | 'branch:etiqa-vista-policy-charge'
  | 'branch:etiqa-vista-insurance-charge'
  | 'branch:etiqa-vista-top-up-premium-charge'
  | 'branch:etiqa-vista-startup-bonus-recovery'
  | 'branch:etiqa-vista-partial-withdrawal-charge'
  | 'branch:etiqa-vista-surrender-charge'
  | 'branch:etiqa-flex-wealth-ii-startup-bonus'
  | 'branch:etiqa-flex-wealth-ii-special-bonus'
  | 'branch:etiqa-flex-wealth-ii-loyalty-bonus'
  | 'branch:etiqa-flex-wealth-ii-cumulative-paid-policy-charge'
  | 'branch:etiqa-flex-wealth-ii-insurance-charge'
  | 'branch:etiqa-flex-wealth-ii-top-up-premium-charge'
  | 'branch:etiqa-flex-wealth-ii-startup-bonus-recovery'
  | 'branch:etiqa-flex-wealth-ii-surrender-charge'
  | 'branch:etiqa-flex-wealth-ii-top-up-account-routing'
  | 'branch:etiqa-smart-flex-ii-startup-bonus'
  | 'branch:etiqa-smart-flex-ii-special-bonus'
  | 'branch:etiqa-smart-flex-ii-loyalty-bonus'
  | 'branch:etiqa-smart-flex-ii-cumulative-paid-policy-charge'
  | 'branch:etiqa-smart-flex-ii-insurance-charge'
  | 'branch:etiqa-smart-flex-ii-top-up-premium-charge'
  | 'branch:etiqa-smart-flex-ii-startup-bonus-recovery'
  | 'branch:etiqa-smart-flex-ii-surrender-charge'
  | 'branch:etiqa-smart-flex-ii-top-up-account-routing'
  | 'branch:etiqa-smart-vista-startup-bonus'
  | 'branch:etiqa-smart-vista-special-bonus'
  | 'branch:etiqa-smart-vista-loyalty-bonus'
  | 'branch:etiqa-smart-vista-cumulative-paid-policy-charge'
  | 'branch:etiqa-smart-vista-insurance-charge'
  | 'branch:etiqa-smart-vista-top-up-premium-charge'
  | 'branch:etiqa-smart-vista-startup-bonus-recovery'
  | 'branch:etiqa-smart-vista-surrender-charge'
  | 'branch:etiqa-smart-vista-top-up-account-routing'
  | 'branch:etiqa-wealth-purpose-startup-bonus'
  | 'branch:etiqa-wealth-purpose-special-bonus'
  | 'branch:etiqa-wealth-purpose-loyalty-bonus'
  | 'branch:etiqa-wealth-purpose-cumulative-paid-policy-charge'
  | 'branch:etiqa-wealth-purpose-insurance-charge'
  | 'branch:etiqa-wealth-purpose-top-up-premium-charge'
  | 'branch:etiqa-wealth-purpose-startup-bonus-recovery'
  | 'branch:etiqa-wealth-purpose-surrender-charge'
  | 'branch:etiqa-wealth-purpose-top-up-account-routing'
  | 'branch:great-eastern-gia-sp-initial-single-premium-charge'
  | 'branch:great-eastern-gia-sp-top-up-premium-charge'
  | 'branch:great-eastern-gia-sp-open-ended-zero-surrender-charge'
  | 'branch:great-eastern-gia2-sp-initial-single-premium-charge'
  | 'branch:great-eastern-gia2-sp-top-up-premium-charge'
  | 'branch:great-eastern-gia2-sp-open-ended-zero-surrender-charge'
  | 'branch:great-eastern-gia-rsp-recurrent-single-premium-charge'
  | 'branch:great-eastern-gia-rsp-top-up-premium-charge'
  | 'branch:great-eastern-gia-rsp-open-ended-zero-surrender-charge'
  | 'branch:great-eastern-gia2-rsp-recurrent-single-premium-charge'
  | 'branch:great-eastern-gia2-rsp-top-up-premium-charge'
  | 'branch:great-eastern-gia2-rsp-open-ended-zero-surrender-charge'
  | 'branch:great-eastern-wa4-policy-fee-rate'
  | 'branch:great-eastern-wa4-fixed-policy-fee'
  | 'branch:great-eastern-wa4-insurance-charge'
  | 'branch:great-eastern-wa4-welcome-bonus'
  | 'branch:great-eastern-wa4-premium-bonus'
  | 'branch:great-eastern-wa4-premium-holiday-charge'
  | 'branch:great-eastern-wa4-premium-holiday-charge-refund'
  | 'branch:great-eastern-wa4-partial-withdrawal-charge'
  | 'branch:great-eastern-wa4-top-up-premium-charge'
  | 'branch:great-eastern-wa4-loyalty-bonus'
  | 'branch:great-eastern-wa4-surrender-charge'
  | 'branch:great-eastern-ilp2-policy-fee-rate'
  | 'branch:great-eastern-ilp2-choice10-fixed-policy-fee'
  | 'branch:great-eastern-ilp2-insurance-charge'
  | 'branch:great-eastern-ilp2-welcome-bonus'
  | 'branch:great-eastern-ilp2-premium-bonus'
  | 'branch:great-eastern-ilp2-premium-holiday-charge'
  | 'branch:great-eastern-ilp2-premium-holiday-charge-refund'
  | 'branch:great-eastern-ilp2-partial-withdrawal-charge'
  | 'branch:great-eastern-ilp2-top-up-premium-charge'
  | 'branch:great-eastern-ilp2-loyalty-bonus'
  | 'branch:great-eastern-ilp2-surrender-charge'
  | 'branch:great-eastern-prestige-portfolio-premium-charge-manual-input'
  | 'branch:great-eastern-prestige-portfolio-recurrent-single-premium-charge-manual-input'
  | 'branch:great-eastern-prestige-portfolio-wrap-fee-manual-input'
  | 'branch:great-eastern-prestige-portfolio-policy-fee'
  | 'branch:great-eastern-prestige-portfolio-top-up-premium-charge-manual-input'
  | 'branch:great-eastern-prestige-portfolio-partial-withdrawal-zero-charge'
  | 'branch:great-eastern-prestige-portfolio-open-ended-zero-surrender-charge'
  | 'tokio-initial-vs-accumulation-regular-premium-routing'
  | 'tokio-regular-premium-routing-to-accumulation-account'
  | 'tokio-initial-bonus-tiered-premium-allocation'
  | 'tokio-performance-investment-bonus'
  | 'tokio-premium-bonus'
  | 'tokio-loyalty-bonus'
  | 'tokio-power-up-bonus'
  | 'tokio-top-up-routing'
  | 'tokio-recurring-single-premium-routing'
  | 'tokio-recurring-single-premium-manual-resumption-after-premium-holiday'
  | 'tokio-regular-premium-reduction-consumes-recurring-single-premium-first'
  | 'tokio-post-mip-regular-premium-routing-back-to-initial-account'
  | 'tokio-initial-charge-on-initial-account'
  | 'tokio-initial-charge-on-accumulation-account'
  | 'tokio-policy-charge-on-accumulation-account'
  | 'tokio-policy-charge-on-policy-value'
  | 'tokio-admin-charge-on-initial-account'
  | 'tokio-admin-charge-on-accumulation-account'
  | 'tokio-top-up-premium-charge'
  | 'tokio-recurring-single-premium-charge'
  | 'tokio-initial-account-surrender-charge'
  | 'tokio-accumulation-account-surrender-charge'
  | 'tokio-accumulation-partial-withdrawal-charge'
  | 'tokio-premium-shortfall-charge-premium-holiday'
  | 'tokio-premium-shortfall-charge-non-payment'
  | 'tokio-premium-shortfall-charge-regular-premium-reduction'
  | 'tokio-premium-increase-restores-shortfall-charge-cessation'
  | 'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only'
  | 'tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events'
  | 'branch:prosper-assurance-charge'
  | 'kernel:distribution-mode-assumption'
  | 'kernel:tokio-locked-in-protection-state'
  | 'branch:assure-ii-pre-70-assurance'
  | 'branch:assure-ii-post-70-charge-tail'
  | 'branch:assure-ii-manual-reduction-resumption'
  | 'branch:hsbc-flexi-choice-max-assurance'
  | 'branch:tokio-harvest-flexi-advanced-death-monthly-protection-charge'
  | 'branch:tokio-wealth-flexi-advanced-death-monthly-protection-charge'
  | 'branch:tokio-wealth-flexi-link-5-10-advanced-death-monthly-protection-charge'
  | 'branch:tokio-wealth-flexi-link-3-12-advanced-death-monthly-protection-charge'
  | 'branch:tokio-harvest-builder-atfuture-advanced-death-monthly-protection-charge'
  | 'branch:tokio-goclassic-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction'
  | 'branch:tokio-marine-affluence-atfuture-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts'
  | 'branch:tokio-goaffluence-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts'
  | 'branch:tokio-goluxe-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts'
  | 'branch:tokio-bonus-ladder'
  | 'branch:tokio-post-mip-routing'
  | 'branch:tokio-harvest-max-advanced-death-monthly-protection-charge-accrual'
  | 'branch:tokio-wealth-max-ii-advanced-death-monthly-protection-charge-accrual'
  | 'branch:tokio-harvest-pro-advanced-death-monthly-protection-charge-accrual'
  | 'branch:tokio-wealth-pro-ii-advanced-death-monthly-protection-charge-accrual'
  | 'branch:tokio-multi-account-structure'
  | 'branch:tokio-rsp-manual-resumption'
  | 'branch:tokio-shortfall-exclusive'
  | 'branch:tokio-reduction-consumes-rsp-first'
  | 'branch:tokio-charge-waiver'

export interface GoldenFixtureCoverageTarget {
  productId: string
  variantId: string
  scenarioId: string
  fixtureClass: GoldenIlpFixtureClass
  coverageTags: GoldenCoverageTag[]
}

interface GoldenFixtureManualSource {
  supportStatus: 'partial'
  sourceFileName: string
  sourceChecksumSha256: string
}

export interface GoldenIlpFixtureInput extends GoldenFixtureCoverageTarget {
  id: string
  fileName: `${string}.json`
  description: string
  policy: IlpPolicyInput
  manualSource?: GoldenFixtureManualSource
  integrityChecks?: Array<{
    description: string
    test: (fixture: GoldenIlpFixtureInput, artifact: GoldenFixtureArtifact) => boolean
  }>
}

interface GoldenFixtureDefinition extends GoldenFixtureCoverageTarget {
  description: string
  manualSource?: GoldenFixtureManualSource
  integrityChecks?: Array<{
    description: string
    test: (fixture: GoldenIlpFixtureInput, artifact: GoldenFixtureArtifact) => boolean
  }>
}

const HSBC_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Global Equity Blend',
    allocation: 0.6,
    ocf: 0.013,
    grossReturnLow: 0.05,
    grossReturnMid: 0.08,
    grossReturnHigh: 0.11,
  },
  {
    name: 'Asia Income Blend',
    allocation: 0.4,
    ocf: 0.009,
    grossReturnLow: 0.035,
    grossReturnMid: 0.06,
    grossReturnHigh: 0.08,
  },
]

const HSBC_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'Emerging Markets Equity',
    allocation: 0.7,
    ocf: 0.022,
    grossReturnLow: 0.04,
    grossReturnMid: 0.082,
    grossReturnHigh: 0.12,
  },
  {
    name: 'High Yield Income',
    allocation: 0.3,
    ocf: 0.018,
    grossReturnLow: 0.03,
    grossReturnMid: 0.055,
    grossReturnHigh: 0.075,
  },
]

const PRU_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Growth Managed Fund',
    allocation: 0.55,
    ocf: 0.014,
    grossReturnLow: 0.05,
    grossReturnMid: 0.078,
    grossReturnHigh: 0.105,
  },
  {
    name: 'Income Managed Fund',
    allocation: 0.45,
    ocf: 0.01,
    grossReturnLow: 0.035,
    grossReturnMid: 0.058,
    grossReturnHigh: 0.075,
  },
]

const PRU_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'High OCF Equity Fund',
    allocation: 0.65,
    ocf: 0.024,
    grossReturnLow: 0.045,
    grossReturnMid: 0.08,
    grossReturnHigh: 0.115,
  },
  {
    name: 'Alternative Income Fund',
    allocation: 0.35,
    ocf: 0.019,
    grossReturnLow: 0.03,
    grossReturnMid: 0.052,
    grossReturnHigh: 0.07,
  },
]

const MANULIFE_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Manulife Global Equity',
    allocation: 0.6,
    ocf: 0.013,
    grossReturnLow: 0.045,
    grossReturnMid: 0.074,
    grossReturnHigh: 0.1,
  },
  {
    name: 'Manulife Income',
    allocation: 0.4,
    ocf: 0.01,
    grossReturnLow: 0.03,
    grossReturnMid: 0.052,
    grossReturnHigh: 0.07,
  },
]

const MANULIFE_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'Manulife Emerging Growth',
    allocation: 0.67,
    ocf: 0.024,
    grossReturnLow: 0.038,
    grossReturnMid: 0.08,
    grossReturnHigh: 0.115,
  },
  {
    name: 'Manulife Strategic Bond',
    allocation: 0.33,
    ocf: 0.019,
    grossReturnLow: 0.028,
    grossReturnMid: 0.05,
    grossReturnHigh: 0.068,
  },
]

const INCOME_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Income Global Opportunities',
    allocation: 0.6,
    ocf: 0.012,
    grossReturnLow: 0.045,
    grossReturnMid: 0.072,
    grossReturnHigh: 0.098,
  },
  {
    name: 'Income Stable Yield',
    allocation: 0.4,
    ocf: 0.009,
    grossReturnLow: 0.03,
    grossReturnMid: 0.052,
    grossReturnHigh: 0.07,
  },
]

const INCOME_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'Income Emerging Equity',
    allocation: 0.65,
    ocf: 0.023,
    grossReturnLow: 0.038,
    grossReturnMid: 0.078,
    grossReturnHigh: 0.115,
  },
  {
    name: 'Income Alternative Income',
    allocation: 0.35,
    ocf: 0.019,
    grossReturnLow: 0.028,
    grossReturnMid: 0.05,
    grossReturnHigh: 0.068,
  },
]

const AIA_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'AIA Global Growth',
    allocation: 0.6,
    ocf: 0.013,
    grossReturnLow: 0.045,
    grossReturnMid: 0.074,
    grossReturnHigh: 0.1,
  },
  {
    name: 'AIA Income Opportunities',
    allocation: 0.4,
    ocf: 0.01,
    grossReturnLow: 0.03,
    grossReturnMid: 0.052,
    grossReturnHigh: 0.07,
  },
]

const AIA_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'AIA Emerging Leaders',
    allocation: 0.68,
    ocf: 0.024,
    grossReturnLow: 0.038,
    grossReturnMid: 0.08,
    grossReturnHigh: 0.117,
  },
  {
    name: 'AIA Alternative Income',
    allocation: 0.32,
    ocf: 0.019,
    grossReturnLow: 0.027,
    grossReturnMid: 0.049,
    grossReturnHigh: 0.067,
  },
]

const ETIQA_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Etiqa Global Opportunity',
    allocation: 0.58,
    ocf: 0.012,
    grossReturnLow: 0.045,
    grossReturnMid: 0.074,
    grossReturnHigh: 0.1,
  },
  {
    name: 'Etiqa Income Builder',
    allocation: 0.42,
    ocf: 0.009,
    grossReturnLow: 0.03,
    grossReturnMid: 0.052,
    grossReturnHigh: 0.07,
  },
]

const ETIQA_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'Etiqa Asia Growth',
    allocation: 0.66,
    ocf: 0.023,
    grossReturnLow: 0.038,
    grossReturnMid: 0.079,
    grossReturnHigh: 0.112,
  },
  {
    name: 'Etiqa Strategic Income',
    allocation: 0.34,
    ocf: 0.018,
    grossReturnLow: 0.028,
    grossReturnMid: 0.05,
    grossReturnHigh: 0.068,
  },
]

const GREAT_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Great Asia Growth',
    allocation: 0.58,
    ocf: 0.012,
    grossReturnLow: 0.044,
    grossReturnMid: 0.071,
    grossReturnHigh: 0.097,
  },
  {
    name: 'Great Income Opportunities',
    allocation: 0.42,
    ocf: 0.009,
    grossReturnLow: 0.03,
    grossReturnMid: 0.051,
    grossReturnHigh: 0.069,
  },
]

const GREAT_STRESS_FUNDS: IlpFund[] = [
  {
    name: 'Great Emerging Leaders',
    allocation: 0.68,
    ocf: 0.024,
    grossReturnLow: 0.037,
    grossReturnMid: 0.079,
    grossReturnHigh: 0.116,
  },
  {
    name: 'Great Alternative Income',
    allocation: 0.32,
    ocf: 0.019,
    grossReturnLow: 0.027,
    grossReturnMid: 0.049,
    grossReturnHigh: 0.067,
  },
]

const TOKIO_BALANCED_FUNDS: IlpFund[] = [
  {
    name: 'Asia Balanced Growth',
    allocation: 0.6,
    ocf: 0.013,
    grossReturnLow: 0.045,
    grossReturnMid: 0.072,
    grossReturnHigh: 0.098,
  },
  {
    name: 'Global Income Opportunities',
    allocation: 0.4,
    ocf: 0.01,
    grossReturnLow: 0.03,
    grossReturnMid: 0.05,
    grossReturnHigh: 0.068,
  },
]

function cloneFunds(funds: IlpFund[]): IlpFund[] {
  return funds.map((fund) => ({ ...fund }))
}

function clonePolicySeedIntoInput(
  seed: ReturnType<typeof templateVariantToPolicySeed>,
  id: string,
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = createDefaultPolicy()
  return ilpPolicySchema.parse({
    ...base,
    ...seed,
    id,
    eecTable: [...seed.eecTable],
    policyEvents: seed.policyEvents?.map((event) => ({ ...event })) ?? [],
    funds: seed.funds.map((fund) => ({ ...fund })),
    accounts: seed.accounts.map((account) => ({
      ...account,
      contributionRules: account.contributionRules?.map((rule) => ({ ...rule })),
    })),
    bonuses: seed.bonuses.map((bonus) => ({
      ...bonus,
      appliesTo: [...bonus.appliesTo],
      cadenceYears: bonus.cadenceYears,
      tieredRates: bonus.tieredRates?.map((tier) => ({ ...tier })),
      suspensionRules: bonus.suspensionRules?.map((rule) => ({ ...rule })),
      restorationRules: bonus.restorationRules?.map((rule) => ({ ...rule })),
    })),
    chargeRules: seed.chargeRules?.map((rule) => ({
      ...rule,
      appliesTo: [...rule.appliesTo],
      fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
      premiumBaseConfig: rule.premiumBaseConfig
        ? {
            useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig.useHigherOfCommencementAndPrevailing,
            multiplierSchedule: rule.premiumBaseConfig.multiplierSchedule.map((tier) => ({ ...tier })),
          }
        : undefined,
      amountSchedule: rule.amountSchedule?.map((tier) => ({ ...tier })),
    })) ?? [],
    eventChargeRules: seed.eventChargeRules?.map((rule) => ({
      ...rule,
      appliesTo: [...rule.appliesTo],
      fallbackAppliesTo: rule.fallbackAppliesTo ? [...rule.fallbackAppliesTo] : undefined,
      freeLifetimeMonths: rule.freeLifetimeMonths,
      rateSchedule: rule.rateSchedule?.map((tier) => ({ ...tier })),
    })) ?? [],
    catalogSource: seed.catalogSource ? { ...seed.catalogSource } : undefined,
    catalogWarnings: seed.catalogWarnings ? [...seed.catalogWarnings] : undefined,
    ...overrides,
  })
}

function requireProduct(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, productId: string): IlpCatalogProduct {
  const product = snapshot.products.find((entry) => entry.id === productId)
  if (!product) {
    throw new Error(`Golden fixture source product "${productId}" not found in ILP catalog.`)
  }
  return product
}

function requireVariant(product: IlpCatalogProduct, variantId: string): IlpTemplateVariant {
  const variant = product.variants.find((entry) => entry.id === variantId)
  if (!variant) {
    throw new Error(`Golden fixture source variant "${variantId}" not found for product "${product.id}".`)
  }
  return variant
}

function seedPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: string,
  variantId: string,
  fixtureId: string,
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const product = requireProduct(snapshot, productId)
  const variant = requireVariant(product, variantId)
  return clonePolicySeedIntoInput(templateVariantToPolicySeed(product, variant, snapshot.manifest), fixtureId, overrides)
}

function withFunds(policy: IlpPolicyInput, funds: IlpFund[]): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    funds: cloneFunds(funds),
  })
}

function withResolvedManualInputs(policy: IlpPolicyInput): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    chargeRules: policy.chargeRules?.map((rule) => ({
      ...rule,
      requiresManualInput: false,
    })) ?? [],
    eventChargeRules: policy.eventChargeRules?.map((rule) => ({
      ...rule,
      requiresManualInput: false,
    })) ?? [],
  })
}

function withoutRecurringContribution(policy: IlpPolicyInput): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    monthlyContribution: 0,
    accounts: policy.accounts.map((account) => ({
      ...account,
      contributionShare: 0,
      contributionRules: account.contributionRules?.map((rule) => ({
        ...rule,
        contributionShare: rule.phase === 'top-up' ? rule.contributionShare : 0,
      })),
    })),
  })
}

function withHsbcBalances(policy: IlpPolicyInput, iua: number, aua: number): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => ({
      ...account,
      currentValue: account.id === 'iua' ? iua : aua,
    })),
  })
}

function withHsbcHarvestBalances(policy: IlpPolicyInput, regular: number, topup: number): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => ({
      ...account,
      currentValue: account.id === 'regular' ? regular : topup,
    })),
  })
}

function withPruBalancesAndSplit(
  policy: IlpPolicyInput,
  growth: number,
  flex: number,
  additional: number,
  growthShare: number,
): IlpPolicyInput {
  const flexShare = Number((1 - growthShare).toFixed(6))

  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => {
      if (account.id === 'growth') {
        return { ...account, currentValue: growth, contributionShare: growthShare }
      }
      if (account.id === 'flex') {
        return { ...account, currentValue: flex, contributionShare: flexShare }
      }
      return { ...account, currentValue: additional, contributionShare: 0 }
    }),
  })
}

function withPruBalancesOnly(
  policy: IlpPolicyInput,
  growth: number,
  flex: number,
  additional: number,
): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => {
      if (account.id === 'growth') {
        return { ...account, currentValue: growth }
      }
      if (account.id === 'flex') {
        return { ...account, currentValue: flex }
      }
      return { ...account, currentValue: additional }
    }),
  })
}

function withTokioBalances(
  policy: IlpPolicyInput,
  initial: number,
  accumulation: number,
  topup: number,
): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => {
      if (account.id === 'initial') {
        return { ...account, currentValue: initial }
      }
      if (account.id === 'accumulation') {
        return { ...account, currentValue: accumulation }
      }
      return { ...account, currentValue: topup }
    }),
  })
}

function withTokioSinglePremiumBalances(
  policy: IlpPolicyInput,
  policyValue: number,
  topup: number,
): IlpPolicyInput {
  return ilpPolicySchema.parse({
    ...policy,
    accounts: policy.accounts.map((account) => {
      if (account.id === 'policy') {
        return { ...account, currentValue: policyValue }
      }
      return { ...account, currentValue: topup }
    }),
  })
}

function hsbcFlexiProtectorBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-choice-cover' | 'sgd-open-ended-max-cover',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-flexi-protector', variantId, id)
  const coverLabel = variantId.endsWith('choice-cover') ? 'Choice Cover' : 'Max Cover'

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden HSBC Life Flexi Protector (SGD / Open-ended ${coverLabel})`,
      monthlyContribution: 500,
      currentPolicyYear: 7,
      monthsAlreadyPaid: 72,
      postMipYears: 10,
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      assuranceProfile: {
        currentAgeNextBirthday: 35,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentBasicSumAssured: 150_000,
        currentNetSupplementaryPremiumBase: 24_000,
      },
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 120_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function hsbcFlexiProtectorBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-choice-cover' | 'sgd-open-ended-max-cover',
  id: string,
): IlpPolicyInput {
  return hsbcFlexiProtectorBasePolicy(snapshot, variantId, id, HSBC_BALANCED_FUNDS)
}

function hsbcFlexiProtectorEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return hsbcFlexiProtectorBasePolicy(snapshot, 'sgd-open-ended-choice-cover', id, HSBC_BALANCED_FUNDS, {
    name: 'Golden HSBC Life Flexi Protector (SGD / Open-ended Choice Cover Event Heavy)',
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 97,
        durationMonths: 1,
        amount: 6_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 100,
        durationMonths: 4,
        amount: 1_500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 107,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function hsbcFlexiProtectorStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-choice-cover' | 'sgd-open-ended-max-cover',
  id: string,
): IlpPolicyInput {
  return hsbcFlexiProtectorBasePolicy(snapshot, variantId, id, HSBC_STRESS_FUNDS, {
    name: `Golden HSBC Life Flexi Protector (${variantId.toUpperCase()} OCF Stress)`,
  })
}

function hsbcBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-accelerate', variantId, id)
  const isUsd = variantId.startsWith('usd')
  const isLongMip = variantId.endsWith('30')

  return withHsbcBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden HSBC Wealth Accelerate (${variantId.toUpperCase()})`,
        monthlyContribution: isUsd ? 700 : 1_000,
        currentPolicyYear: isLongMip ? 8 : 6,
        monthsAlreadyPaid: isLongMip ? 84 : 60,
        policyEvents: [],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    isUsd ? 12_500 : 15_000,
    isUsd ? 8_400 : 10_500,
  )
}

function hsbcEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-accelerate', 'sgd-mip-25', id)
  return withHsbcBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Accelerate (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 1_000,
        currentPolicyYear: 14,
        monthsAlreadyPaid: 156,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 169,
            durationMonths: 3,
            repayMissedPremiums: true,
            repaymentAccountId: 'aua',
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 173,
            durationMonths: 1,
            amount: 3_500,
            accountId: 'aua',
          },
          {
            id: 'premium-reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 181,
            durationMonths: 1,
            amount: 4_800,
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 184,
            durationMonths: 1,
            amount: 5_000,
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    18_000,
    32_000,
  )
}

function hsbcHolidayNoRepaymentPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-accelerate', 'sgd-mip-25', id)
  return withHsbcBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Accelerate (SGD / MIP 25 Holiday No Repayment)',
        monthlyContribution: 1_000,
        currentPolicyYear: 14,
        monthsAlreadyPaid: 156,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 169,
            durationMonths: 4,
            repayMissedPremiums: false,
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    16_500,
    28_000,
  )
}

function hsbcStressPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-accelerate', 'usd-mip-30', id)
  return withHsbcBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Accelerate (USD / MIP 30 Stress Mix)',
        monthlyContribution: 750,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    14_000,
    10_200,
  )
}

function hsbcHarvestBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-harvest', 'sgd-mip-11', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Harvest (SGD / MIP 11 Baseline)',
        monthlyContribution: 1_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        postMipYears: 10,
        policyEvents: [],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    14_000,
    2_500,
  )
}

function hsbcHarvestEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-harvest', 'sgd-mip-11', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Harvest (SGD / MIP 11 Event Heavy)',
        monthlyContribution: 1_000,
        currentPolicyYear: 10,
        monthsAlreadyPaid: 108,
        postMipYears: 5,
        policyEvents: [
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 109,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 110,
            durationMonths: 2,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 112,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 114,
            durationMonths: 1,
            amount: 500,
            accountId: 'regular',
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    24_000,
    3_000,
  )
}

function hsbcHarvestStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-harvest', 'sgd-mip-11', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Harvest (SGD / MIP 11 Stress Mix)',
        monthlyContribution: 1_000,
        currentPolicyYear: 6,
        monthsAlreadyPaid: 60,
        postMipYears: 8,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    17_000,
    3_400,
  )
}

function hsbcAbundanceBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-abundance', variantId, id)
  const isUsd = variantId.startsWith('usd')

  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden HSBC Wealth Abundance (${variantId.toUpperCase()})`,
        monthlyContribution: isUsd ? 2_000 : 2_500,
        currentPolicyYear: 5,
        monthsAlreadyPaid: 48,
        postMipYears: 8,
        policyEvents: [],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    isUsd ? 26_000 : 32_000,
    isUsd ? 4_000 : 5_500,
  )
}

function hsbcAbundanceEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-abundance', 'sgd-mip-10', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Abundance (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 2_500,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        postMipYears: 5,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 85,
            durationMonths: 2,
            repayMissedPremiums: true,
            repaymentAccountId: 'regular',
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 88,
            durationMonths: 1,
            amount: 2_000,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 90,
            durationMonths: 1,
            amount: 3_000,
          },
          {
            id: 'free-withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 92,
            durationMonths: 1,
            amount: 1_500,
            accountId: 'regular',
          },
          {
            id: 'charged-withdrawal-2',
            type: 'partial-withdrawal',
            startPolicyMonth: 94,
            durationMonths: 1,
            amount: 4_000,
            accountId: 'regular',
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    34_000,
    6_000,
  )
}

function hsbcAbundanceStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-abundance', 'usd-mip-10', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Abundance (USD / MIP 10 Stress Mix)',
        monthlyContribution: 2_000,
        currentPolicyYear: 6,
        monthsAlreadyPaid: 60,
        postMipYears: 8,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    27_500,
    4_200,
  )
}

function hsbcVoyageBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-voyage', variantId, id)
  const isUsd = variantId.startsWith('usd')
  const mipLength = Number(variantId.slice(variantId.lastIndexOf('-') + 1))
  const currentPolicyYear = Math.max(3, Math.min(mipLength - 2, Math.floor(mipLength / 2)))

  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden HSBC Wealth Voyage (${variantId.toUpperCase()})`,
        monthlyContribution: isUsd ? 1_200 : 1_500,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
        postMipYears: 5,
        policyEvents: [],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    isUsd ? 18_000 : 24_000,
    isUsd ? 5_500 : 7_500,
  )
}

function hsbcVoyageEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-voyage', 'sgd-mip-20', id)
  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Voyage (SGD / MIP 20 Event Heavy)',
        monthlyContribution: 1_500,
        currentPolicyYear: 9,
        monthsAlreadyPaid: 96,
        postMipYears: 5,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 97,
            durationMonths: 2,
            repayMissedPremiums: false,
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 100,
            durationMonths: 1,
            amount: 2_000,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 102,
            durationMonths: 1,
            amount: 1_800,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 104,
            durationMonths: 1,
            amount: 3_000,
            accountId: 'regular',
          },
        ],
      }),
      HSBC_BALANCED_FUNDS,
    ),
    28_000,
    5_000,
  )
}

function hsbcVoyageStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-voyage', 'usd-mip-20', id)

  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden HSBC Wealth Voyage (USD / MIP 20 OCF Stress)',
        monthlyContribution: 1_200,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        postMipYears: 5,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    18_500,
    5_250,
  )
}

function hsbcWealthFocusBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'hsbc-life-wealth-focus-flexi-1' | 'hsbc-life-wealth-focus-flexi-3' | 'hsbc-life-wealth-focus-flexi-5',
  variantId: 'sgd-mip-10' | 'usd-mip-10',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, productId, variantId, id)
  const flexiTerm = Number(productId.slice(-1))
  const isUsd = variantId.startsWith('usd')
  const monthlyContribution = flexiTerm === 1
    ? 2_100
    : flexiTerm === 3
      ? 1_500
      : 1_000

  return withHsbcHarvestBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden HSBC Wealth Focus Flexi ${flexiTerm} (${variantId.toUpperCase()})`,
        monthlyContribution,
        currentPolicyYear: Math.max(2, flexiTerm + 1),
        monthsAlreadyPaid: Math.max(1, flexiTerm) * 12,
        postMipYears: 5,
        policyEvents: [],
        ...overrides,
      }),
      funds,
    ),
    isUsd ? 20_000 : 28_000,
    isUsd ? 4_500 : 6_500,
  )
}

function hsbcWealthFocusBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'hsbc-life-wealth-focus-flexi-1' | 'hsbc-life-wealth-focus-flexi-3' | 'hsbc-life-wealth-focus-flexi-5',
  variantId: 'sgd-mip-10' | 'usd-mip-10',
  id: string,
): IlpPolicyInput {
  const distributionAssumption = {
    mode: 'cash-payout' as const,
    source: 'manual-assumption' as const,
    annualYieldRate: 0.03,
  }

  return hsbcWealthFocusBasePolicy(snapshot, productId, variantId, id, HSBC_BALANCED_FUNDS, {
    distributionAssumption,
  })
}

function hsbcWealthFocusEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'hsbc-life-wealth-focus-flexi-1' | 'hsbc-life-wealth-focus-flexi-3' | 'hsbc-life-wealth-focus-flexi-5',
  id: string,
): IlpPolicyInput {
  const flexiTerm = Number(productId.slice(-1))
  const startPolicyMonth = flexiTerm * 12 + 1
  const policyEvents = [
    ...(flexiTerm > 1
      ? [{
          id: 'holiday-1',
          type: 'premium-holiday' as const,
          startPolicyMonth,
          durationMonths: Math.min(3, flexiTerm),
          repayMissedPremiums: false,
        }]
      : []),
    {
      id: 'top-up-1',
      type: 'top-up' as const,
      startPolicyMonth: startPolicyMonth + 4,
      durationMonths: 1,
      amount: 3_000,
    },
    {
      id: 'withdrawal-1',
      type: 'partial-withdrawal' as const,
      startPolicyMonth: startPolicyMonth + 7,
      durationMonths: 1,
      amount: 2_500,
      accountId: 'regular' as const,
    },
  ]

  return hsbcWealthFocusBasePolicy(snapshot, productId, 'sgd-mip-10', id, HSBC_BALANCED_FUNDS, {
    name: `Golden HSBC Wealth Focus Flexi ${flexiTerm} (SGD / MIP 10 Event Heavy)`,
    currentPolicyYear: flexiTerm + 1,
    monthsAlreadyPaid: flexiTerm * 12,
    policyEvents,
  })
}

function hsbcWealthFocusStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'hsbc-life-wealth-focus-flexi-1' | 'hsbc-life-wealth-focus-flexi-3' | 'hsbc-life-wealth-focus-flexi-5',
  variantId: 'sgd-mip-10' | 'usd-mip-10',
  id: string,
): IlpPolicyInput {
  return hsbcWealthFocusBasePolicy(snapshot, productId, variantId, id, HSBC_STRESS_FUNDS, {
    name: `Golden HSBC Wealth Focus ${productId.slice(-1)} (${variantId.toUpperCase()} OCF Stress)`,
  })
}

function pruBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', variantId, id)
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 3), term - 1)
  const distributionAssumption = variantId === 'sgd-mip-20'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden PRUVantage Wealth II (${variantId.toUpperCase()})`,
        monthlyContribution: 1_400,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
        distributionAssumption,
        policyEvents: [],
      }),
      PRU_BALANCED_FUNDS,
    ),
    12_000 + term * 500,
    10_000 + term * 450,
    2_500 + term * 80,
    0.55,
  )
}

function pruEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', 'sgd-mip-25', id)
  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Wealth II (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 1_500,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 121,
            durationMonths: 4,
            repayMissedPremiums: true,
            repaymentAccountId: 'flex',
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 129,
            durationMonths: 1,
            amount: 8_000,
          },
          {
            id: 'withdrawal-free-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 133,
            durationMonths: 1,
            amount: 2_500,
            accountId: 'growth',
          },
          {
            id: 'withdrawal-charged-2',
            type: 'partial-withdrawal',
            startPolicyMonth: 145,
            durationMonths: 1,
            amount: 1_800,
            accountId: 'flex',
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    22_000,
    17_000,
    4_000,
    0.6,
  )
}

function pruHolidayFallbackPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', 'sgd-mip-25', id)
  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Wealth II (SGD / MIP 25 Holiday Fallback)',
        monthlyContribution: 1_500,
        currentPolicyYear: 12,
        monthsAlreadyPaid: 132,
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 133,
            durationMonths: 6,
            repayMissedPremiums: false,
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    200,
    150,
    6_000,
    0.5,
  )
}

function pruStressSplitPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-wealth-ii', 'sgd-mip-20', id)
  return withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Wealth II (SGD / MIP 20 Split Stress)',
        monthlyContribution: 1_350,
        currentPolicyYear: 9,
        monthsAlreadyPaid: 96,
        policyEvents: [],
      }),
      PRU_STRESS_FUNDS,
    ),
    7_000,
    24_000,
    5_000,
    0.2,
  )
}

function prosperAssurancePolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Prosper (SGD / MIP 25 Assurance)',
        monthlyContribution: 1_200,
        currentPolicyYear: 10,
        monthsAlreadyPaid: 120,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 100_000,
        },
        policyEvents: [],
      }),
      PRU_BALANCED_FUNDS,
    ),
    50_000,
    50_000,
    50_000,
    0.5,
  ))
}

function pruInvestGrowthSpBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-prulink-investgrowth-sp', variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })
  const distributionAssumption = variantId === 'sgd-open-ended-cash'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden PRULink InvestGrowth (SP) (${variantId.toUpperCase()})`,
      policyEvents: [],
      distributionAssumption,
      ...overrides,
    }),
    funds,
  )
}

function pruInvestGrowthSpBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthSpBasePolicy(snapshot, variantId, id, PRU_BALANCED_FUNDS)
}

function pruInvestGrowthSpEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthSpBasePolicy(snapshot, 'sgd-open-ended-cash', id, PRU_BALANCED_FUNDS, {
    name: 'Golden PRULink InvestGrowth (SP) (SGD / Open-ended Cash Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
    ],
  })
}

function pruInvestGrowthSpStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthSpBasePolicy(snapshot, 'sgd-open-ended-cash', id, PRU_STRESS_FUNDS, {
    name: 'Golden PRULink InvestGrowth (SP) (SGD / Open-ended Cash OCF Stress)',
  })
}

function pruInvestGrowthRegularBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
  funds: IlpFund[] = PRU_BALANCED_FUNDS,
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-prulink-investgrowth', variantId, id)

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden PRULink InvestGrowth (${variantId.toUpperCase()})`,
      monthlyContribution: 400,
      currentPolicyYear: 3,
      monthsAlreadyPaid: 24,
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function pruInvestGrowthRegularEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthRegularBaselinePolicy(snapshot, 'sgd-open-ended-cash', id, PRU_BALANCED_FUNDS, {
    name: 'Golden PRULink InvestGrowth (SGD / Open-ended Cash Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 31,
        durationMonths: 1,
        amount: 8_000,
      },
    ],
  })
}

function pruInvestGrowthRegularStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return pruInvestGrowthRegularBaselinePolicy(snapshot, 'sgd-open-ended-cash', id, PRU_STRESS_FUNDS, {
    name: 'Golden PRULink InvestGrowth (SGD / Open-ended Cash OCF Stress)',
  })
}

function manulinkInvestorIiBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'manulife-manulink-investor-ii', variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })
  const distributionAssumption = variantId === 'sgd-open-ended-cash'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden Manulink Investor (II) (${variantId.toUpperCase()})`,
      policyEvents: [],
      distributionAssumption,
      ...overrides,
    }),
    funds,
  )
}

function manulinkInvestorIiBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
): IlpPolicyInput {
  return manulinkInvestorIiBasePolicy(snapshot, variantId, id, MANULIFE_BALANCED_FUNDS)
}

function manulinkInvestorIiCashEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulinkInvestorIiBasePolicy(snapshot, 'sgd-open-ended-cash', id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Manulink Investor (II) (SGD / Open-ended Cash Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
    ],
  })
}

function manulinkInvestorIiSrsEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulinkInvestorIiBasePolicy(snapshot, 'sgd-open-ended-srs', id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Manulink Investor (II) (SGD / Open-ended SRS Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
    ],
  })
}

function manulinkInvestorIiStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulinkInvestorIiBasePolicy(snapshot, 'sgd-open-ended-cash', id, MANULIFE_STRESS_FUNDS, {
    name: 'Golden Manulink Investor (II) (SGD / Open-ended Cash OCF Stress)',
  })
}

function incomeSnackInvestmentBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'income-snack-investment', 'sgd-open-ended', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden SNACK-Investment (SGD / Open-ended)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function incomeSnackInvestmentBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeSnackInvestmentBasePolicy(snapshot, id, INCOME_BALANCED_FUNDS)
}

function incomeSnackInvestmentEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeSnackInvestmentBasePolicy(snapshot, id, INCOME_BALANCED_FUNDS, {
    name: 'Golden SNACK-Investment (SGD / Open-ended Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 11,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function incomeSnackInvestmentStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeSnackInvestmentBasePolicy(snapshot, id, INCOME_STRESS_FUNDS, {
    name: 'Golden SNACK-Investment (SGD / Open-ended OCF Stress)',
  })
}

function incomeWealthLinkGl3BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'income-wealthlink-gl3', 'sgd-open-ended-cash-or-srs', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden WealthLink (GL3) (SGD / Open-ended Cash Or Srs)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function incomeWealthLinkGl3BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeWealthLinkGl3BasePolicy(snapshot, id, INCOME_BALANCED_FUNDS)
}

function incomeWealthLinkGl3EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeWealthLinkGl3BasePolicy(snapshot, id, INCOME_BALANCED_FUNDS, {
    name: 'Golden WealthLink (GL3) (SGD / Open-ended Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 11,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function incomeWealthLinkGl3StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeWealthLinkGl3BasePolicy(snapshot, id, INCOME_STRESS_FUNDS, {
    name: 'Golden WealthLink (GL3) (SGD / Open-ended OCF Stress)',
  })
}

function incomeInvestFlexBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 4), term - 1)
  const monthlyContribution = term >= 15 ? 850 : 900
  const currentNetRegularPremiumBase = monthlyContribution * 12 * (currentPolicyYear - 1)
  const base = seedPolicy(snapshot, 'income-invest-flex', variantId, id, {
    monthlyContribution,
    currentPolicyYear,
    monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
    assuranceProfile: {
      currentAgeNextBirthday: 45,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden Invest Flex (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 12_000 + (term * 1_800),
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function incomeInvestFlexBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const distributionAssumption = variantId === 'sgd-mip-20'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.035,
      }
    : undefined

  return incomeInvestFlexBasePolicy(snapshot, variantId, id, INCOME_BALANCED_FUNDS, {
    name: `Golden Invest Flex (${variantId.toUpperCase()} Baseline)`,
    distributionAssumption,
  })
}

function incomeInvestFlexEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeInvestFlexBasePolicy(snapshot, 'sgd-mip-20', id, INCOME_BALANCED_FUNDS, {
    name: 'Golden Invest Flex (SGD / MIP 20 Event Heavy)',
    currentPolicyYear: 19,
    monthsAlreadyPaid: 216,
    monthlyContribution: 900,
    assuranceProfile: {
      currentAgeNextBirthday: 52,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 194_400,
    },
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 217,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 221,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'life-event-withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 223,
        durationMonths: 1,
        amount: 3_000,
        accountId: 'policy',
        chargeWaived: true,
        bonusSuspensionWaived: true,
      },
      {
        id: 'charged-withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 229,
        durationMonths: 1,
        amount: 2_000,
        accountId: 'policy',
      },
    ],
  })
}

function incomeInvestFlexStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeInvestFlexBasePolicy(snapshot, 'sgd-mip-15', id, INCOME_STRESS_FUNDS, {
    name: 'Golden Invest Flex (SGD / MIP 15 OCF Stress)',
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
    monthlyContribution: 850,
    assuranceProfile: {
      currentAgeNextBirthday: 43,
      sex: 'female',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 71_400,
    },
  })
}

function incomeInvestFlexVantageBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 4), term - 1)
  const monthlyContribution = term >= 15 ? 850 : 900
  const currentNetRegularPremiumBase = monthlyContribution * 12 * (currentPolicyYear - 1)
  const base = seedPolicy(snapshot, 'income-invest-flex-vantage', variantId, id, {
    monthlyContribution,
    currentPolicyYear,
    monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
    assuranceProfile: {
      currentAgeNextBirthday: 45,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden Invest Flex Vantage (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 12_000 + (term * 1_800),
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function incomeInvestFlexVantageBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const distributionAssumption = variantId === 'sgd-mip-20'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.035,
      }
    : undefined

  return incomeInvestFlexVantageBasePolicy(snapshot, variantId, id, INCOME_BALANCED_FUNDS, {
    name: `Golden Invest Flex Vantage (${variantId.toUpperCase()} Baseline)`,
    distributionAssumption,
  })
}

function incomeInvestFlexVantageEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeInvestFlexVantageBasePolicy(snapshot, 'sgd-mip-20', id, INCOME_BALANCED_FUNDS, {
    name: 'Golden Invest Flex Vantage (SGD / MIP 20 Event Heavy)',
    currentPolicyYear: 19,
    monthsAlreadyPaid: 216,
    monthlyContribution: 900,
    assuranceProfile: {
      currentAgeNextBirthday: 52,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 194_400,
    },
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 217,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 221,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'life-event-withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 223,
        durationMonths: 1,
        amount: 3_000,
        accountId: 'policy',
        chargeWaived: true,
        bonusSuspensionWaived: true,
      },
      {
        id: 'charged-withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 229,
        durationMonths: 1,
        amount: 2_000,
        accountId: 'policy',
      },
    ],
  })
}

function incomeInvestFlexVantageStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeInvestFlexVantageBasePolicy(snapshot, 'sgd-mip-15', id, INCOME_STRESS_FUNDS, {
    name: 'Golden Invest Flex Vantage (SGD / MIP 15 OCF Stress)',
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
    monthlyContribution: 850,
    assuranceProfile: {
      currentAgeNextBirthday: 43,
      sex: 'female',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 71_400,
    },
  })
}

function incomeInvestFlexTriVantageBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'income-invest-flex-trivantage', 'sgd-mip-10', id, {
    monthlyContribution: 900,
    currentPolicyYear: 6,
    monthsAlreadyPaid: 60,
    assuranceProfile: {
      currentAgeNextBirthday: 45,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 54_000,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden Invest Flex TriVantage (SGD / MIP 10)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 30_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function incomeInvestFlexTriVantageBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeInvestFlexTriVantageBasePolicy(snapshot, id, INCOME_BALANCED_FUNDS)
}

function incomeInvestFlexTriVantageEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeInvestFlexTriVantageBasePolicy(snapshot, id, INCOME_BALANCED_FUNDS, {
    name: 'Golden Invest Flex TriVantage (SGD / MIP 10 Event Heavy)',
    currentPolicyYear: 9,
    monthsAlreadyPaid: 96,
    assuranceProfile: {
      currentAgeNextBirthday: 49,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 86_400,
    },
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 97,
        durationMonths: 2,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 100,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'life-event-withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 103,
        durationMonths: 1,
        amount: 2_500,
        accountId: 'policy',
        chargeWaived: true,
        bonusSuspensionWaived: true,
      },
    ],
  })
}

function incomeInvestFlexTriVantageStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return incomeInvestFlexTriVantageBasePolicy(snapshot, id, INCOME_STRESS_FUNDS, {
    name: 'Golden Invest Flex TriVantage (SGD / MIP 10 OCF Stress)',
    currentPolicyYear: 7,
    monthsAlreadyPaid: 72,
    assuranceProfile: {
      currentAgeNextBirthday: 43,
      sex: 'female',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 64_800,
    },
  })
}

function greatEasternWealthAdvantage4BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId:
    | 'sgd-mip-10-choice-5'
    | 'sgd-mip-10-choice-10-under-6000'
    | 'sgd-mip-10-choice-10-6000-and-above'
    | 'sgd-mip-15-choice-15-under-6000'
    | 'sgd-mip-15-choice-15-6000-and-above',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const currentPolicyYear = variantId.startsWith('sgd-mip-15') ? 8 : 6
  const monthlyContribution = variantId.endsWith('6000-and-above')
    ? 800
    : variantId === 'sgd-mip-10-choice-5'
      ? 900
      : 350
  const currentNetRegularPremiumBase = monthlyContribution * 12 * (currentPolicyYear - 1)
  const base = seedPolicy(snapshot, 'great-eastern-wealth-advantage-4', variantId, id, {
    monthlyContribution,
    currentPolicyYear,
    monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
    assuranceProfile: {
      currentAgeNextBirthday: 45,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase,
      currentNetSupplementaryPremiumBase: 0,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden GREAT Wealth Advantage 4 (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: variantId.startsWith('sgd-mip-15') ? 42_000 : 28_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function greatEasternWealthAdvantage4BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId:
    | 'sgd-mip-10-choice-5'
    | 'sgd-mip-10-choice-10-under-6000'
    | 'sgd-mip-10-choice-10-6000-and-above'
    | 'sgd-mip-15-choice-15-under-6000'
    | 'sgd-mip-15-choice-15-6000-and-above',
  id: string,
): IlpPolicyInput {
  return greatEasternWealthAdvantage4BasePolicy(snapshot, variantId, id, HSBC_BALANCED_FUNDS)
}

function greatEasternWealthAdvantage4EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternWealthAdvantage4BasePolicy(snapshot, 'sgd-mip-10-choice-10-under-6000', id, HSBC_BALANCED_FUNDS, {
    name: 'Golden GREAT Wealth Advantage 4 (SGD / MIP 10 Choice 10 Under 6000 Event Heavy)',
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
    assuranceProfile: {
      currentAgeNextBirthday: 47,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 29_400,
      currentNetSupplementaryPremiumBase: 4_500,
    },
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 85,
        durationMonths: 2,
        repayMissedPremiums: true,
        repaymentAccountId: 'policy',
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 88,
        durationMonths: 1,
        amount: 4_500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 91,
        durationMonths: 1,
        amount: 1_800,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternWealthAdvantage4StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternWealthAdvantage4BasePolicy(snapshot, 'sgd-mip-15-choice-15-6000-and-above', id, HSBC_STRESS_FUNDS, {
    name: 'Golden GREAT Wealth Advantage 4 (SGD / MIP 15 Choice 15 6000 And Above OCF Stress)',
    currentPolicyYear: 11,
    monthsAlreadyPaid: 120,
    assuranceProfile: {
      currentAgeNextBirthday: 49,
      sex: 'female',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 96_000,
      currentNetSupplementaryPremiumBase: 12_000,
    },
  })
}

function greatEasternInvestmentLinkedInsurancePlan2BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId:
    | 'sgd-mip-10-choice-5'
    | 'sgd-mip-10-choice-10-under-6000'
    | 'sgd-mip-10-choice-10-6000-and-above',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const currentPolicyYear = variantId === 'sgd-mip-10-choice-5' ? 6 : 8
  const monthlyContribution = variantId.endsWith('6000-and-above')
    ? 800
    : variantId === 'sgd-mip-10-choice-5'
      ? 900
      : 350
  const currentNetRegularPremiumBase = monthlyContribution * 12 * (currentPolicyYear - 1)
  const base = seedPolicy(snapshot, 'great-eastern-investment-linked-insurance-plan-2', variantId, id, {
    monthlyContribution,
    currentPolicyYear,
    monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
    assuranceProfile: {
      currentAgeNextBirthday: 44,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase,
      currentNetSupplementaryPremiumBase: 0,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden Investment-linked Insurance Plan 2 (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: variantId === 'sgd-mip-10-choice-5' ? 28_000 : 41_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function greatEasternInvestmentLinkedInsurancePlan2BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId:
    | 'sgd-mip-10-choice-5'
    | 'sgd-mip-10-choice-10-under-6000'
    | 'sgd-mip-10-choice-10-6000-and-above',
  id: string,
): IlpPolicyInput {
  return greatEasternInvestmentLinkedInsurancePlan2BasePolicy(snapshot, variantId, id, HSBC_BALANCED_FUNDS)
}

function greatEasternInvestmentLinkedInsurancePlan2EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternInvestmentLinkedInsurancePlan2BasePolicy(snapshot, 'sgd-mip-10-choice-10-under-6000', id, HSBC_BALANCED_FUNDS, {
    name: 'Golden Investment-linked Insurance Plan 2 (SGD / MIP 10 Choice 10 Under 6000 Event Heavy)',
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
    assuranceProfile: {
      currentAgeNextBirthday: 47,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 29_400,
      currentNetSupplementaryPremiumBase: 4_500,
    },
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 85,
        durationMonths: 2,
        repayMissedPremiums: true,
        repaymentAccountId: 'policy',
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 88,
        durationMonths: 1,
        amount: 4_500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 91,
        durationMonths: 1,
        amount: 1_800,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternInvestmentLinkedInsurancePlan2StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternInvestmentLinkedInsurancePlan2BasePolicy(snapshot, 'sgd-mip-10-choice-10-6000-and-above', id, HSBC_STRESS_FUNDS, {
    name: 'Golden Investment-linked Insurance Plan 2 (SGD / MIP 10 Choice 10 6000 And Above OCF Stress)',
    currentPolicyYear: 9,
    monthsAlreadyPaid: 96,
    assuranceProfile: {
      currentAgeNextBirthday: 49,
      sex: 'female',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 76_800,
      currentNetSupplementaryPremiumBase: 12_000,
    },
  })
}

function greatEasternPrestigePortfolioBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId:
    | 'sgd-open-ended-single-premium-cash'
    | 'sgd-open-ended-single-premium-srs'
    | 'sgd-open-ended-recurrent-single-premium-srs',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const isSinglePremium = variantId !== 'sgd-open-ended-recurrent-single-premium-srs'
  const base = seedPolicy(snapshot, 'great-eastern-prestige-portfolio', variantId, id, {
    initialSinglePremium: isSinglePremium ? 100_000 : 0,
    monthlyContribution: isSinglePremium ? 0 : 650,
    currentPolicyYear: isSinglePremium ? 1 : 4,
    monthsAlreadyPaid: isSinglePremium ? 0 : 36,
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden Prestige Portfolio (${variantId.toUpperCase()})`,
      chargeRules: (base.chargeRules ?? []).map((rule) => {
        if (rule.id === 'premium-charge' || rule.id === 'recurrent-single-premium-charge') {
          return { ...rule, rate: 0.03 }
        }
        if (rule.id === 'wrap-fee') {
          return { ...rule, rate: 0.015 }
        }
        return rule
      }),
      eventChargeRules: (base.eventChargeRules ?? []).map((rule) => {
        if (rule.id === 'top-up-premium-charge' || rule.id === 'recurring-single-premium-charge') {
          return { ...rule, rate: 0.03 }
        }
        return rule
      }),
      accounts: base.accounts.map((account) => ({
        ...account,
        ...(isSinglePremium ? {} : { currentValue: 34_000 }),
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function greatEasternPrestigePortfolioBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId:
    | 'sgd-open-ended-single-premium-cash'
    | 'sgd-open-ended-single-premium-srs'
    | 'sgd-open-ended-recurrent-single-premium-srs',
  id: string,
): IlpPolicyInput {
  return greatEasternPrestigePortfolioBasePolicy(snapshot, variantId, id, GREAT_BALANCED_FUNDS)
}

function greatEasternPrestigePortfolioEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternPrestigePortfolioBasePolicy(snapshot, 'sgd-open-ended-recurrent-single-premium-srs', id, GREAT_BALANCED_FUNDS, {
    name: 'Golden Prestige Portfolio (SGD / Open-ended Recurrent Single Premium Srs Event Heavy)',
    monthlyContribution: 650,
    currentPolicyYear: 5,
    monthsAlreadyPaid: 48,
    policyEvents: [
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 49,
        durationMonths: 6,
        amount: 650,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 52,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 57,
        durationMonths: 1,
        amount: 6_000,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternPrestigePortfolioStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternPrestigePortfolioBasePolicy(snapshot, 'sgd-open-ended-single-premium-srs', id, GREAT_STRESS_FUNDS, {
    name: 'Golden Prestige Portfolio (SGD / Open-ended Single Premium Srs OCF Stress)',
  })
}

function hsbcWealthInvestCpfBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-invest-cpf', 'sgd-open-ended-cpf', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden HSBC Life Wealth Invest (CPF) (SGD / Open-ended CPF)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function hsbcWealthInvestCpfBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return hsbcWealthInvestCpfBasePolicy(snapshot, id, HSBC_BALANCED_FUNDS)
}

function hsbcWealthInvestCpfEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return hsbcWealthInvestCpfBasePolicy(snapshot, id, HSBC_BALANCED_FUNDS, {
    name: 'Golden HSBC Life Wealth Invest (CPF) (SGD / Open-ended CPF Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 11,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function hsbcWealthInvestCpfStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return hsbcWealthInvestCpfBasePolicy(snapshot, id, HSBC_STRESS_FUNDS, {
    name: 'Golden HSBC Life Wealth Invest (CPF) (SGD / Open-ended CPF OCF Stress)',
  })
}

function tokioMarineWealthEnhancerCpfisBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-enhancer-cpfis', 'sgd-open-ended-cpf', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden TM Wealth Enhancer (CPFIS) (SGD / Open-ended CPF)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function tokioMarineWealthEnhancerCpfisBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineWealthEnhancerCpfisBasePolicy(snapshot, id, HSBC_BALANCED_FUNDS)
}

function tokioMarineWealthEnhancerCpfisEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineWealthEnhancerCpfisBasePolicy(snapshot, id, HSBC_BALANCED_FUNDS, {
    name: 'Golden TM Wealth Enhancer (CPFIS) (SGD / Open-ended CPF Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 11,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function tokioMarineWealthEnhancerCpfisStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineWealthEnhancerCpfisBasePolicy(snapshot, id, HSBC_STRESS_FUNDS, {
    name: 'Golden TM Wealth Enhancer (CPFIS) (SGD / Open-ended CPF OCF Stress)',
  })
}

function tokioMarineGoEliteBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goelite', variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })
  const distributionAssumption = variantId === 'sgd-open-ended-cash'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden #goElite (${variantId.toUpperCase()})`,
      policyEvents: [],
      distributionAssumption,
      ...overrides,
    }),
    funds,
  ))
}

function tokioMarineGoEliteBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
): IlpPolicyInput {
  return tokioMarineGoEliteBasePolicy(snapshot, variantId, id, TOKIO_BALANCED_FUNDS)
}

function tokioMarineGoEliteEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineGoEliteBasePolicy(snapshot, 'sgd-open-ended-cash', id, TOKIO_BALANCED_FUNDS, {
    name: 'Golden #goElite (SGD / Open-ended Cash Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 13,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 14,
        durationMonths: 6,
        amount: 500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 18,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function tokioMarineGoEliteStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
): IlpPolicyInput {
  return tokioMarineGoEliteBasePolicy(snapshot, variantId, id, HSBC_STRESS_FUNDS, {
    name: `Golden #goElite (${variantId.toUpperCase()} OCF Stress)`,
  })
}

function tokioMarineGoEliteSecureBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goelite-secure', variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 3,
    monthsAlreadyPaid: 24,
  })
  const distributionAssumption = variantId === 'sgd-open-ended-cash'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withResolvedManualInputs(withTokioSinglePremiumBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden #goElite Secure (${variantId.toUpperCase()})`,
        policyEvents: [],
        distributionAssumption,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentLockedInPolicyValue: 92_000,
          currentAdjustedSinglePremium: 88_000,
        },
        ...overrides,
      }),
      funds,
    ),
    80_000,
    6_000,
  ))
}

function tokioMarineGoEliteSecureBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
): IlpPolicyInput {
  return tokioMarineGoEliteSecureBasePolicy(snapshot, variantId, id, TOKIO_BALANCED_FUNDS)
}

function tokioMarineGoEliteSecureEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineGoEliteSecureBasePolicy(snapshot, 'sgd-open-ended-cash', id, TOKIO_BALANCED_FUNDS, {
    name: 'Golden #goElite Secure (SGD / Open-ended Cash Event Heavy)',
    currentPolicyYear: 4,
    monthsAlreadyPaid: 36,
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 37,
        durationMonths: 1,
        amount: 4_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 38,
        durationMonths: 12,
        amount: 300,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 42,
        durationMonths: 1,
        amount: 3_000,
        accountId: 'policy',
      },
    ],
    assuranceProfile: {
      currentAgeNextBirthday: 46,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentLockedInPolicyValue: 94_000,
      currentAdjustedSinglePremium: 89_000,
    },
  })
}

function tokioMarineGoEliteSecureStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
): IlpPolicyInput {
  return tokioMarineGoEliteSecureBasePolicy(snapshot, variantId, id, HSBC_STRESS_FUNDS, {
    name:
      variantId === 'sgd-open-ended-cash'
        ? 'Golden #goElite Secure (SGD / Open-ended Cash OCF Stress)'
        : 'Golden #goElite Secure (SGD / Open-ended SRS OCF Stress)',
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
    postMipYears: 15,
    assuranceProfile: {
      currentAgeNextBirthday: 52,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentLockedInPolicyValue: 96_000,
      currentAdjustedSinglePremium: 86_000,
    },
  })
}

function tokioMarineGoWealthEnrichBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-gowealth-enrich', 'sgd-open-ended-cash', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withResolvedManualInputs(withTokioSinglePremiumBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden #goWealth Enrich (SGD / Open-ended Cash)',
        policyEvents: [],
        distributionAssumption: {
          mode: 'cash-payout',
          source: 'manual-assumption',
          annualYieldRate: 0.04,
        },
        ...overrides,
      }),
      funds,
    ),
    100_000,
    0,
  ))
}

function tokioMarineGoWealthEnrichBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineGoWealthEnrichBasePolicy(snapshot, id, TOKIO_BALANCED_FUNDS)
}

function tokioMarineGoWealthEnrichEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineGoWealthEnrichBasePolicy(snapshot, id, TOKIO_BALANCED_FUNDS, {
    name: 'Golden #goWealth Enrich (SGD / Open-ended Cash Event Heavy)',
    currentPolicyYear: 2,
    monthsAlreadyPaid: 12,
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 13,
        durationMonths: 1,
        amount: 4_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 14,
        durationMonths: 12,
        amount: 300,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 18,
        durationMonths: 1,
        amount: 3_000,
        accountId: 'policy',
      },
    ],
  })
}

function tokioMarineGoWealthEnrichStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineGoWealthEnrichBasePolicy(snapshot, id, HSBC_STRESS_FUNDS, {
    name: 'Golden #goWealth Enrich (SGD / Open-ended Cash OCF Stress)',
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
    postMipYears: 15,
  })
}

function tokioMarineGoAssureBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goassure', 'sgd-mip-10', id)
  return withFunds(
    withTokioBalances(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden #goAssure (SGD / MIP 10)',
        monthlyContribution: 350,
        currentPolicyYear: 6,
        monthsAlreadyPaid: 60,
        policyEvents: [],
        distributionAssumption: {
          mode: 'reinvest',
          source: 'catalog-default',
        },
        ...overrides,
      }),
      24_000,
      12_000,
      4_000,
    ),
    funds,
  )
}

function tokioMarineGoAssureBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineGoAssureBasePolicy(snapshot, id, TOKIO_BALANCED_FUNDS)
}

function tokioMarineGoAssureEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineGoAssureBasePolicy(snapshot, id, TOKIO_BALANCED_FUNDS, {
    name: 'Golden #goAssure (SGD / MIP 10 Event Heavy)',
    currentPolicyYear: 7,
    monthsAlreadyPaid: 72,
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 73,
        durationMonths: 3,
        repayMissedPremiums: false,
      },
      {
        id: 'reduction-1',
        type: 'regular-premium-reduction',
        startPolicyMonth: 77,
        durationMonths: 1,
        amount: 1_200,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 78,
        durationMonths: 1,
        amount: 5_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 79,
        durationMonths: 6,
        amount: 300,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 84,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'accumulation',
      },
    ],
  })
}

function tokioMarineGoAssureStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return tokioMarineGoAssureBasePolicy(snapshot, id, HSBC_STRESS_FUNDS, {
    name: 'Golden #goAssure (SGD / MIP 10 OCF Stress)',
    currentPolicyYear: 9,
    monthsAlreadyPaid: 96,
    postMipYears: 5,
    distributionAssumption: {
      mode: 'cash-payout',
      source: 'manual-assumption',
      annualYieldRate: 0.04,
    },
  })
}

function fwdInvestGoal1BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended' | 'usd-open-ended',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'fwd-invest-goal-1', variantId, id, {
    initialSinglePremium: variantId === 'sgd-open-ended' ? 100_000 : 75_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: variantId === 'sgd-open-ended'
        ? 'Golden FWD Invest Goal 1 (SGD / Open-ended)'
        : 'Golden FWD Invest Goal 1 (USD / Open-ended)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function fwdInvestGoal1BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended' | 'usd-open-ended',
  id: string,
): IlpPolicyInput {
  return fwdInvestGoal1BasePolicy(snapshot, variantId, id, HSBC_BALANCED_FUNDS)
}

function fwdInvestGoal1EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return fwdInvestGoal1BasePolicy(snapshot, 'sgd-open-ended', id, HSBC_BALANCED_FUNDS, {
    name: 'Golden FWD Invest Goal 1 (SGD / Open-ended Event Heavy)',
    currentPolicyYear: 4,
    monthsAlreadyPaid: 36,
    policyEvents: [
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 40,
        durationMonths: 1,
        amount: 5_000,
        accountId: 'policy',
      },
    ],
  })
}

function fwdInvestGoal1StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended' | 'usd-open-ended',
  id: string,
): IlpPolicyInput {
  return fwdInvestGoal1BasePolicy(snapshot, variantId, id, HSBC_STRESS_FUNDS, {
    name: variantId === 'sgd-open-ended'
      ? 'Golden FWD Invest Goal 1 (SGD / Open-ended OCF Stress)'
      : 'Golden FWD Invest Goal 1 (USD / Open-ended OCF Stress)',
  })
}

function fwdInvestFlexiViiBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'fwd-invest-flexi-vii', 'sgd-mip-10', id)

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden FWD Invest Flexi VII (SGD / MIP 10)',
      monthlyContribution: 1_000,
      currentPolicyYear: 6,
      monthsAlreadyPaid: 60,
      postMipYears: 5,
      assuranceProfile: {
        currentAgeNextBirthday: 40,
        sex: 'male',
        smokerStatus: 'non-smoker',
        currentNetRegularPremiumBase: 100_000,
        currentNetSupplementaryPremiumBase: 20_000,
      },
      accounts: base.accounts.map((account) => {
        if (account.id === 'initial') {
          return { ...account, currentValue: 30_000 }
        }
        return { ...account, currentValue: 5_000 }
      }),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function fwdInvestFlexiViiBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return fwdInvestFlexiViiBasePolicy(snapshot, id, HSBC_BALANCED_FUNDS)
}

function fwdInvestFlexiViiEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return fwdInvestFlexiViiBasePolicy(snapshot, id, HSBC_BALANCED_FUNDS, {
    name: 'Golden FWD Invest Flexi VII (SGD / MIP 10 Event Heavy)',
    currentPolicyYear: 7,
    monthsAlreadyPaid: 72,
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 73,
        durationMonths: 1,
        amount: 5_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 78,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'initial',
      },
    ],
  })
}

function fwdInvestFlexiViiStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return fwdInvestFlexiViiBasePolicy(snapshot, id, HSBC_STRESS_FUNDS, {
    name: 'Golden FWD Invest Flexi VII (SGD / MIP 10 OCF Stress)',
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
  })
}

function hsbcWealthInvestCashSrsBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-wealth-invest-cash-srs', variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })
  const distributionAssumption = variantId === 'sgd-open-ended-cash'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden HSBC Life Wealth Invest (Cash/SRS) (${variantId.toUpperCase()})`,
      chargeRules: (base.chargeRules ?? []).map((rule) => (
        rule.id === 'single-premium-charge'
          ? { ...rule, rate: 0.05 }
          : rule
      )),
      eventChargeRules: (base.eventChargeRules ?? []).map((rule) => (
        rule.id === 'top-up-premium-charge' || rule.id === 'recurring-single-premium-charge'
          ? { ...rule, rate: 0.05 }
          : rule
      )),
      policyEvents: [],
      distributionAssumption,
      ...overrides,
    }),
    funds,
  ))
}

function hsbcWealthInvestCashSrsBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
): IlpPolicyInput {
  return hsbcWealthInvestCashSrsBasePolicy(snapshot, variantId, id, HSBC_BALANCED_FUNDS)
}

function hsbcWealthInvestCashEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return hsbcWealthInvestCashSrsBasePolicy(snapshot, 'sgd-open-ended-cash', id, HSBC_BALANCED_FUNDS, {
    name: 'Golden HSBC Life Wealth Invest (Cash/SRS) (SGD / Open-ended Cash Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 11,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function hsbcWealthInvestCashSrsStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs',
  id: string,
): IlpPolicyInput {
  return hsbcWealthInvestCashSrsBasePolicy(snapshot, variantId, id, HSBC_STRESS_FUNDS, {
    name: `Golden HSBC Life Wealth Invest (Cash/SRS) (${variantId.toUpperCase()} OCF Stress)`,
  })
}

function hsbcGoalBuilderIiBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-mip-5' | 'sgd-mip-10' | 'sgd-mip-15' | 'usd-mip-5' | 'usd-mip-10' | 'usd-mip-15',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'hsbc-life-goal-builder-ii', variantId, id, {
    monthlyContribution: 1_000,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden HSBC Goal Builder II (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 18_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function hsbcGoalBuilderIiBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-mip-5' | 'sgd-mip-10' | 'sgd-mip-15' | 'usd-mip-5' | 'usd-mip-10' | 'usd-mip-15',
  id: string,
): IlpPolicyInput {
  const payoutStartPolicyYear = variantId.endsWith('mip-5')
    ? 6
    : variantId.endsWith('mip-10')
      ? 11
      : 16

  return hsbcGoalBuilderIiBasePolicy(snapshot, variantId, id, HSBC_BALANCED_FUNDS, {
    name: `Golden HSBC Goal Builder II (${variantId.toUpperCase()} Baseline)`,
    distributionAssumption: {
      mode: 'cash-payout',
      source: 'manual-assumption',
      annualYieldRate: 0.03,
    },
    scheduledPayoutAssumption: {
      mode: 'scheduled-redemption',
      source: 'manual-assumption',
      accountId: 'policy',
      startPolicyYear: payoutStartPolicyYear,
      durationYears: 8,
      annualPayoutAmount: 2_400,
    },
  })
}

function hsbcGoalBuilderIiEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return hsbcGoalBuilderIiBasePolicy(snapshot, 'sgd-mip-10', id, HSBC_BALANCED_FUNDS, {
    name: 'Golden HSBC Goal Builder II (SGD / MIP 10 Event Heavy)',
    currentPolicyYear: 2,
    monthsAlreadyPaid: 18,
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 19,
        durationMonths: 1,
        amount: 6_000,
      },
      {
        id: 'reduction-1',
        type: 'regular-premium-reduction',
        startPolicyMonth: 20,
        durationMonths: 1,
        amount: 400,
      },
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 23,
        durationMonths: 4,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 30,
        durationMonths: 1,
        amount: 1_200,
        accountId: 'policy',
      },
    ],
  })
}

function hsbcGoalBuilderIiStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return hsbcGoalBuilderIiBasePolicy(snapshot, 'sgd-mip-15', id, HSBC_STRESS_FUNDS, {
    name: 'Golden HSBC Goal Builder II (SGD / MIP 15 OCF Stress)',
    currentPolicyYear: 6,
    monthsAlreadyPaid: 60,
  })
}

function manulifeSmartRetireSumBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-mip-8-flexi-3' | 'sgd-mip-8-flexi-5' | 'sgd-mip-12-flexi-8',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'manulife-smartretire-v-sum', variantId, id, {
    monthlyContribution: 1_000,
    currentPolicyYear: variantId === 'sgd-mip-12-flexi-8' ? 6 : 4,
    monthsAlreadyPaid: variantId === 'sgd-mip-12-flexi-8' ? 60 : 36,
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden Manulife SmartRetire (V) - Sum (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 22_000,
      })),
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function manulifeSmartRetireSumBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-mip-8-flexi-3' | 'sgd-mip-8-flexi-5' | 'sgd-mip-12-flexi-8',
  id: string,
): IlpPolicyInput {
  return manulifeSmartRetireSumBasePolicy(snapshot, variantId, id, MANULIFE_BALANCED_FUNDS, {
    name: `Golden Manulife SmartRetire (V) - Sum (${variantId.toUpperCase()} Baseline)`,
  })
}

function manulifeSmartRetireSumEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeSmartRetireSumBasePolicy(snapshot, 'sgd-mip-8-flexi-5', id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Manulife SmartRetire (V) - Sum (SGD / MIP 8 Flexi 5 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 37,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 41,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 46,
        durationMonths: 1,
        amount: 3_500,
        accountId: 'policy',
      },
    ],
  })
}

function manulifeSmartRetireSumStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeSmartRetireSumBasePolicy(snapshot, 'sgd-mip-12-flexi-8', id, MANULIFE_STRESS_FUNDS, {
    name: 'Golden Manulife SmartRetire (V) - Sum (SGD / MIP 12 Flexi 8 OCF Stress)',
  })
}

function manulifeSmartRetireIncomeBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-mip-8-flexi-3' | 'sgd-mip-8-flexi-5' | 'sgd-mip-12-flexi-8',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'manulife-smartretire-v-income', variantId, id, {
    monthlyContribution: 1_000,
    currentPolicyYear: variantId === 'sgd-mip-12-flexi-8' ? 6 : 4,
    monthsAlreadyPaid: variantId === 'sgd-mip-12-flexi-8' ? 60 : 36,
  })
  const scheduledStartPolicyYear = variantId === 'sgd-mip-12-flexi-8' ? 7 : 5

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden Manulife SmartRetire (V) - Income (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 22_000,
      })),
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      scheduledPayoutAssumption: {
        mode: 'scheduled-redemption',
        source: 'manual-assumption',
        accountId: 'policy',
        startPolicyYear: scheduledStartPolicyYear,
        durationYears: 10,
        annualPayoutAmount: 4_800,
      },
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function manulifeSmartRetireIncomeBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-mip-8-flexi-3' | 'sgd-mip-8-flexi-5' | 'sgd-mip-12-flexi-8',
  id: string,
): IlpPolicyInput {
  return manulifeSmartRetireIncomeBasePolicy(snapshot, variantId, id, MANULIFE_BALANCED_FUNDS, {
    name: `Golden Manulife SmartRetire (V) - Income (${variantId.toUpperCase()} Baseline)`,
  })
}

function manulifeSmartRetireIncomeEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeSmartRetireIncomeBasePolicy(snapshot, 'sgd-mip-8-flexi-5', id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Manulife SmartRetire (V) - Income (SGD / MIP 8 Flexi 5 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 37,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 41,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 46,
        durationMonths: 1,
        amount: 3_500,
        accountId: 'policy',
      },
    ],
  })
}

function manulifeSmartRetireIncomeStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeSmartRetireIncomeBasePolicy(snapshot, 'sgd-mip-12-flexi-8', id, MANULIFE_STRESS_FUNDS, {
    name: 'Golden Manulife SmartRetire (V) - Income (SGD / MIP 12 Flexi 8 OCF Stress)',
  })
}

function manulifeInvestreadyIiiBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const monthlyContribution = 350
  const currentPolicyYear = 2
  const currentNetRegularPremiumBase = monthlyContribution * 12 * (currentPolicyYear - 1)
  const base = seedPolicy(snapshot, 'manulife-investready-iii', 'sgd-mip-5-flexi-4', id, {
    monthlyContribution,
    currentPolicyYear,
    monthsAlreadyPaid: 24,
    assuranceProfile: {
      currentAgeNextBirthday: 47,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden Manulife InvestReady (III) (SGD / MIP 5 Flexi 4)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 18_000,
      })),
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function manulifeInvestreadyIiiBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeInvestreadyIiiBasePolicy(snapshot, id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Manulife InvestReady (III) (SGD / MIP 5 Flexi 4 Baseline)',
  })
}

function manulifeInvestreadyIiiEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeInvestreadyIiiBasePolicy(snapshot, id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Manulife InvestReady (III) (SGD / MIP 5 Flexi 4 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 25,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 30,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 34,
        durationMonths: 1,
        amount: 3_500,
        accountId: 'policy',
      },
    ],
  })
}

function manulifeInvestreadyIiiStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeInvestreadyIiiBasePolicy(snapshot, id, MANULIFE_STRESS_FUNDS, {
    name: 'Golden Manulife InvestReady (III) (SGD / MIP 5 Flexi 4 OCF Stress)',
  })
}

const MANULIFE_INVESTREADY_III_SEP_2025_VARIANT_LABELS = {
  'sgd-mip-5-flexi-4-sep-2025': 'SGD / MIP 5 Flexi 4',
  'sgd-mip-7-flexi-5-sep-2025': 'SGD / MIP 7 Flexi 5',
  'sgd-mip-10-flexi-3-sep-2025': 'SGD / MIP 10 Flexi 3',
  'sgd-mip-10-flexi-5-sep-2025': 'SGD / MIP 10 Flexi 5',
  'sgd-mip-10-flexi-8-sep-2025': 'SGD / MIP 10 Flexi 8',
  'sgd-mip-13-flexi-10-sep-2025': 'SGD / MIP 13 Flexi 10',
} as const

function manulifeInvestreadyIiiSep2025BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: keyof typeof MANULIFE_INVESTREADY_III_SEP_2025_VARIANT_LABELS,
  variantLabel: string,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const monthlyContribution = 350
  const currentPolicyYear = 2
  const currentNetRegularPremiumBase = monthlyContribution * 12 * (currentPolicyYear - 1)
  const base = seedPolicy(snapshot, 'manulife-investready-iii-sep-2025', variantId, id, {
    monthlyContribution,
    currentPolicyYear,
    monthsAlreadyPaid: 24,
    assuranceProfile: {
      currentAgeNextBirthday: 47,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden Manulife InvestReady (III) Sep-2025 (${variantLabel})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 18_000,
      })),
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function manulifeInvestreadyIiiSep2025BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: keyof typeof MANULIFE_INVESTREADY_III_SEP_2025_VARIANT_LABELS,
  id: string,
): IlpPolicyInput {
  const variantLabel = MANULIFE_INVESTREADY_III_SEP_2025_VARIANT_LABELS[variantId]
  return manulifeInvestreadyIiiSep2025BasePolicy(snapshot, variantId, variantLabel, id, MANULIFE_BALANCED_FUNDS, {
    name: `Golden Manulife InvestReady (III) Sep-2025 (${variantLabel} Baseline)`,
  })
}

function manulifeInvestreadyIiiSep2025EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeInvestreadyIiiSep2025BasePolicy(
    snapshot,
    'sgd-mip-5-flexi-4-sep-2025',
    MANULIFE_INVESTREADY_III_SEP_2025_VARIANT_LABELS['sgd-mip-5-flexi-4-sep-2025'],
    id,
    MANULIFE_BALANCED_FUNDS,
    {
    name: 'Golden Manulife InvestReady (III) Sep-2025 (SGD / MIP 5 Flexi 4 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 25,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 30,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 34,
        durationMonths: 1,
        amount: 3_500,
        accountId: 'policy',
      },
    ],
  },
  )
}

function manulifeInvestreadyIiiSep2025StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return manulifeInvestreadyIiiSep2025BasePolicy(
    snapshot,
    'sgd-mip-5-flexi-4-sep-2025',
    MANULIFE_INVESTREADY_III_SEP_2025_VARIANT_LABELS['sgd-mip-5-flexi-4-sep-2025'],
    id,
    MANULIFE_STRESS_FUNDS,
    {
    name: 'Golden Manulife InvestReady (III) Sep-2025 (SGD / MIP 5 Flexi 4 OCF Stress)',
  },
  )
}

function singlifeLegacyInvestBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'singlife-legacy-invest', 'sgd-mip-10-term-15', id, {
    monthlyContribution: 1_500,
    currentPolicyYear: 9,
    monthsAlreadyPaid: 96,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden Singlife Legacy Invest (SGD / MIP 10 Term 15)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 42_000,
      })),
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      scheduledPayoutAssumption: {
        mode: 'scheduled-redemption',
        source: 'manual-assumption',
        accountId: 'policy',
        startPolicyYear: 11,
        durationYears: 5,
        annualPayoutAmount: 6_000,
      },
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function singlifeLegacyInvestBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return singlifeLegacyInvestBasePolicy(snapshot, id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Singlife Legacy Invest (SGD / MIP 10 Term 15 Baseline)',
  })
}

function singlifeLegacyInvestEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return singlifeLegacyInvestBasePolicy(snapshot, id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Singlife Legacy Invest (SGD / MIP 10 Term 15 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 97,
        durationMonths: 6,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 102,
        durationMonths: 1,
        amount: 12_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 106,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function singlifeLegacyInvestStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return singlifeLegacyInvestBasePolicy(snapshot, id, MANULIFE_STRESS_FUNDS, {
    name: 'Golden Singlife Legacy Invest (SGD / MIP 10 Term 15 OCF Stress)',
  })
}

function singlifeSavvyInvestIiBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'singlife-savvy-invest-ii', 'sgd-mip-10-fixed', id, {
    monthlyContribution: 1_000,
    currentPolicyYear: 9,
    monthsAlreadyPaid: 96,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden Singlife Savvy Invest II (SGD / MIP 10 Fixed)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 30_000,
      })),
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function singlifeSavvyInvestIiBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return singlifeSavvyInvestIiBasePolicy(snapshot, id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Singlife Savvy Invest II (SGD / MIP 10 Fixed Baseline)',
  })
}

function singlifeSavvyInvestIiEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return singlifeSavvyInvestIiBasePolicy(snapshot, id, MANULIFE_BALANCED_FUNDS, {
    name: 'Golden Singlife Savvy Invest II (SGD / MIP 10 Fixed Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 97,
        durationMonths: 6,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 101,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 105,
        durationMonths: 1,
        amount: 3_500,
        accountId: 'policy',
      },
    ],
  })
}

function singlifeSavvyInvestIiStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return singlifeSavvyInvestIiBasePolicy(snapshot, id, MANULIFE_STRESS_FUNDS, {
    name: 'Golden Singlife Savvy Invest II (SGD / MIP 10 Fixed OCF Stress)',
  })
}

function etiqaInvestPlusSpBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'etiqa-invest-plus-sp', 'sgd-open-ended-single-premium-initial-only', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 3,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden Etiqa Invest plus SP (SGD / Open-ended Initial Only)',
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function etiqaInvestPlusSpBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaInvestPlusSpBasePolicy(snapshot, id, ETIQA_BALANCED_FUNDS, {
    name: 'Golden Etiqa Invest plus SP (SGD / Open-ended Initial Only Baseline)',
  })
}

function etiqaInvestPlusSpEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaInvestPlusSpBasePolicy(snapshot, id, ETIQA_BALANCED_FUNDS, {
    name: 'Golden Etiqa Invest plus SP (SGD / Open-ended Initial Only Event Heavy)',
    policyEvents: [
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 4,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 8,
        durationMonths: 1,
        amount: 10_000,
        accountId: 'policy',
      },
    ],
  })
}

function etiqaInvestPlusSpStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaInvestPlusSpBasePolicy(snapshot, id, ETIQA_STRESS_FUNDS, {
    name: 'Golden Etiqa Invest plus SP (SGD / Open-ended Initial Only OCF Stress)',
    currentPolicyYear: 6,
  })
}

function etiqaDashPetPlusBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'etiqa-dash-pet-plus', 'sgd-open-ended-rider', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden Etiqa Dash PET Plus (SGD / Open-ended Rider)',
      distributionAssumption: {
        mode: 'cash-payout',
        source: 'manual-assumption',
        annualYieldRate: 0.03,
      },
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function etiqaDashPetPlusBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaDashPetPlusBasePolicy(snapshot, id, ETIQA_BALANCED_FUNDS, {
    name: 'Golden Etiqa Dash PET Plus (SGD / Open-ended Rider Baseline)',
  })
}

function etiqaDashPetPlusEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaDashPetPlusBasePolicy(snapshot, id, ETIQA_BALANCED_FUNDS, {
    name: 'Golden Etiqa Dash PET Plus (SGD / Open-ended Rider Event Heavy)',
    policyEvents: [
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 4,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 8,
        durationMonths: 1,
        amount: 10_000,
        accountId: 'policy',
      },
    ],
  })
}

function etiqaDashPetPlusStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaDashPetPlusBasePolicy(snapshot, id, ETIQA_STRESS_FUNDS, {
    name: 'Golden Etiqa Dash PET Plus (SGD / Open-ended Rider OCF Stress)',
  })
}

function aiaInvestEasyBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'aia-invest-easy-cash-srs' | 'aia-invest-easy-cpf',
  variantId: 'sgd-open-ended-cash-srs' | 'sgd-open-ended-cpf',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, productId, variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: productId === 'aia-invest-easy-cpf'
        ? 'Golden AIA Invest Easy (CPF) (SGD / Open-ended CPF)'
        : 'Golden AIA Invest Easy (Cash/SRS) (SGD / Open-ended Cash Srs)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function aiaInvestEasyCashSrsBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaInvestEasyBasePolicy(snapshot, 'aia-invest-easy-cash-srs', 'sgd-open-ended-cash-srs', id, AIA_BALANCED_FUNDS)
}

function aiaInvestEasyCashSrsEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaInvestEasyBasePolicy(snapshot, 'aia-invest-easy-cash-srs', 'sgd-open-ended-cash-srs', id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Invest Easy (Cash/SRS) (SGD / Open-ended Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
    ],
  })
}

function aiaInvestEasyCashSrsStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaInvestEasyBasePolicy(snapshot, 'aia-invest-easy-cash-srs', 'sgd-open-ended-cash-srs', id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Invest Easy (Cash/SRS) (SGD / Open-ended OCF Stress)',
  })
}

function aiaInvestEasyCpfBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaInvestEasyBasePolicy(snapshot, 'aia-invest-easy-cpf', 'sgd-open-ended-cpf', id, AIA_BALANCED_FUNDS)
}

function aiaInvestEasyCpfEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaInvestEasyBasePolicy(snapshot, 'aia-invest-easy-cpf', 'sgd-open-ended-cpf', id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Invest Easy (CPF) (SGD / Open-ended Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
    ],
  })
}

function aiaInvestEasyCpfStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaInvestEasyBasePolicy(snapshot, 'aia-invest-easy-cpf', 'sgd-open-ended-cpf', id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Invest Easy (CPF) (SGD / Open-ended OCF Stress)',
  })
}

function aiaPlatinumRetirementEliteBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'aia-platinum-retirement-elite', 'sgd-mip-5', id, {
    monthlyContribution: 900,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden AIA Platinum Retirement Elite (SGD / MIP 5)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 24_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function aiaPlatinumRetirementEliteBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumRetirementEliteBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Platinum Retirement Elite (SGD / MIP 5 Baseline)',
    scheduledPayoutAssumption: {
      mode: 'scheduled-redemption',
      source: 'manual-assumption',
      accountId: 'policy',
      startPolicyYear: 4,
      durationYears: 10,
      annualPayoutAmount: 7_200,
    },
  })
}

function aiaPlatinumRetirementEliteEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumRetirementEliteBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Platinum Retirement Elite (SGD / MIP 5 Event Heavy)',
    scheduledPayoutAssumption: {
      mode: 'scheduled-redemption',
      source: 'manual-assumption',
      accountId: 'policy',
      startPolicyYear: 4,
      durationYears: 10,
      annualPayoutAmount: 8_400,
    },
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 14,
        durationMonths: 4,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 20,
        durationMonths: 1,
        amount: 9_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 28,
        durationMonths: 1,
        amount: 4_500,
        accountId: 'policy',
      },
    ],
  })
}

function aiaPlatinumRetirementEliteStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumRetirementEliteBasePolicy(snapshot, id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Platinum Retirement Elite (SGD / MIP 5 OCF Stress)',
  })
}

function aiaEliteSecureIncome5PayBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'aia-elite-secure-income-5-pay', 'sgd-mip-5', id, {
    monthlyContribution: 900,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden AIA Elite Secure Income - 5 Pay (SGD / MIP 5)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 24_000,
      })),
      chargeRules: (base.chargeRules ?? []).map((rule) => (
        rule.id === 'supplementary-charge'
          ? { ...rule, amount: 180 }
          : rule
      )),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function aiaEliteSecureIncome5PayBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaEliteSecureIncome5PayBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Elite Secure Income - 5 Pay (SGD / MIP 5 Baseline)',
    scheduledPayoutAssumption: {
      mode: 'scheduled-redemption',
      source: 'manual-assumption',
      accountId: 'policy',
      startPolicyYear: 4,
      durationYears: 10,
      annualPayoutAmount: 7_200,
    },
  })
}

function aiaEliteSecureIncome5PayEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaEliteSecureIncome5PayBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Elite Secure Income - 5 Pay (SGD / MIP 5 Event Heavy)',
    scheduledPayoutAssumption: {
      mode: 'scheduled-redemption',
      source: 'manual-assumption',
      accountId: 'policy',
      startPolicyYear: 4,
      durationYears: 10,
      annualPayoutAmount: 8_400,
    },
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 14,
        durationMonths: 4,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 20,
        durationMonths: 1,
        amount: 9_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 28,
        durationMonths: 1,
        amount: 4_500,
        accountId: 'policy',
      },
    ],
  })
}

function aiaEliteSecureIncome5PayStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaEliteSecureIncome5PayBasePolicy(snapshot, id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Elite Secure Income - 5 Pay (SGD / MIP 5 OCF Stress)',
  })
}

function aiaEliteSecureIncomeSpBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'aia-elite-secure-income-single-premium', 'sgd-open-ended-sp', id, {
    initialSinglePremium: 120_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden AIA Elite Secure Income - Single Premium (SGD / Open-ended)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 86_000,
      })),
      chargeRules: (base.chargeRules ?? []).map((rule) => (
        rule.id === 'supplementary-charge'
          ? { ...rule, amount: 180 }
          : rule
      )),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function aiaEliteSecureIncomeSpBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaEliteSecureIncomeSpBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Elite Secure Income - Single Premium (SGD / Open-ended Baseline)',
    scheduledPayoutAssumption: {
      mode: 'scheduled-redemption',
      source: 'manual-assumption',
      accountId: 'policy',
      startPolicyYear: 4,
      durationYears: 10,
      annualPayoutAmount: 7_200,
    },
  })
}

function aiaEliteSecureIncomeSpEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaEliteSecureIncomeSpBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Elite Secure Income - Single Premium (SGD / Open-ended Event Heavy)',
    scheduledPayoutAssumption: {
      mode: 'scheduled-redemption',
      source: 'manual-assumption',
      accountId: 'policy',
      startPolicyYear: 5,
      durationYears: 10,
      annualPayoutAmount: 7_200,
    },
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 18,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 30,
        durationMonths: 1,
        amount: 5_000,
        accountId: 'policy',
      },
    ],
  })
}

function aiaEliteSecureIncomeSpStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaEliteSecureIncomeSpBasePolicy(snapshot, id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Elite Secure Income - Single Premium (SGD / Open-ended OCF Stress)',
    scheduledPayoutAssumption: {
      mode: 'scheduled-redemption',
      source: 'manual-assumption',
      accountId: 'policy',
      startPolicyYear: 5,
      durationYears: 10,
      annualPayoutAmount: 6_800,
    },
  })
}

function aiaWealthVentureBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'aia-wealth-venture', 'sgd-mip-8', id, {
    monthlyContribution: 900,
    currentPolicyYear: 4,
    monthsAlreadyPaid: 36,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden AIA Wealth Venture (SGD / MIP 8)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 24_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function aiaWealthVentureBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaWealthVentureBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Wealth Venture (SGD / MIP 8 Baseline)',
    distributionAssumption: {
      mode: 'cash-payout',
      source: 'manual-assumption',
      annualYieldRate: 0.035,
    },
  })
}

function aiaWealthVentureEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaWealthVentureBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Wealth Venture (SGD / MIP 8 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 37,
        durationMonths: 4,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 43,
        durationMonths: 1,
        amount: 9_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 48,
        durationMonths: 1,
        amount: 4_500,
        accountId: 'policy',
      },
    ],
  })
}

function aiaWealthVentureStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaWealthVentureBasePolicy(snapshot, id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Wealth Venture (SGD / MIP 8 OCF Stress)',
  })
}

function aiaPlatinumWealthElite2BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'aia-platinum-wealth-elite-2', 'sgd-mip-5', id, {
    monthlyContribution: 900,
    currentPolicyYear: 3,
    monthsAlreadyPaid: 24,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden AIA Platinum Wealth Elite 2.0 (SGD / MIP 5)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 20_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function aiaPlatinumWealthElite2BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthElite2BasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Platinum Wealth Elite 2.0 (SGD / MIP 5 Baseline)',
  })
}

function aiaPlatinumWealthElite2EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthElite2BasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Platinum Wealth Elite 2.0 (SGD / MIP 5 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 25,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 29,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 33,
        durationMonths: 1,
        amount: 3_500,
        accountId: 'policy',
      },
    ],
  })
}

function aiaPlatinumWealthElite2StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthElite2BasePolicy(snapshot, id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Platinum Wealth Elite 2.0 (SGD / MIP 5 OCF Stress)',
  })
}

function aiaPlatinumWealthLegacyBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'aia-platinum-wealth-legacy', 'sgd-mip-5', id, {
    monthlyContribution: 900,
    currentPolicyYear: 3,
    monthsAlreadyPaid: 24,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden AIA Platinum Wealth Legacy (SGD / MIP 5)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 20_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function aiaPlatinumWealthLegacyBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthLegacyBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Platinum Wealth Legacy (SGD / MIP 5 Baseline)',
  })
}

function aiaPlatinumWealthLegacyEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthLegacyBasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Platinum Wealth Legacy (SGD / MIP 5 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 25,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 29,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 33,
        durationMonths: 1,
        amount: 3_500,
        accountId: 'policy',
      },
    ],
  })
}

function aiaPlatinumWealthLegacyStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthLegacyBasePolicy(snapshot, id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Platinum Wealth Legacy (SGD / MIP 5 OCF Stress)',
  })
}

function aiaProAchiever3BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'aia-pro-achiever-3', 'sgd-iip-10', id, {
    monthlyContribution: 900,
    currentPolicyYear: 8,
    monthsAlreadyPaid: 84,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden AIA Pro Achiever 3.0 (SGD / IIP 10)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 26_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function aiaProAchiever3BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaProAchiever3BasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Pro Achiever 3.0 (SGD / IIP 10 Baseline)',
    currentPolicyYear: 9,
    monthsAlreadyPaid: 96,
    postMipYears: 5,
    distributionAssumption: {
      mode: 'cash-payout',
      source: 'manual-assumption',
      annualYieldRate: 0.035,
    },
  })
}

function aiaProAchiever3EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaProAchiever3BasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Pro Achiever 3.0 (SGD / IIP 10 Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 85,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 93,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function aiaProAchiever3StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaProAchiever3BasePolicy(snapshot, id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Pro Achiever 3.0 (SGD / IIP 10 OCF Stress)',
    currentPolicyYear: 9,
    monthsAlreadyPaid: 96,
    postMipYears: 5,
    distributionAssumption: {
      mode: 'cash-payout',
      source: 'manual-assumption',
      annualYieldRate: 0.03,
    },
  })
}

function aiaPlatinumWealthVenture2BasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'aia-platinum-wealth-venture-2', 'sgd-mip-5', id, {
    monthlyContribution: 900,
    currentPolicyYear: 3,
    monthsAlreadyPaid: 24,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden AIA Platinum Wealth Venture 2.0 (SGD / MIP 5)',
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 22_000,
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function aiaPlatinumWealthVenture2BaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthVenture2BasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Platinum Wealth Venture 2.0 (SGD / MIP 5 Baseline)',
    distributionAssumption: {
      mode: 'cash-payout',
      source: 'manual-assumption',
      annualYieldRate: 0.035,
    },
  })
}

function aiaPlatinumWealthVenture2EventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthVenture2BasePolicy(snapshot, id, AIA_BALANCED_FUNDS, {
    name: 'Golden AIA Platinum Wealth Venture 2.0 (SGD / MIP 5 Event Heavy)',
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 25,
        durationMonths: 3,
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 29,
        durationMonths: 1,
        amount: 8_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 33,
        durationMonths: 1,
        amount: 3_500,
        accountId: 'policy',
      },
    ],
  })
}

function aiaPlatinumWealthVenture2StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return aiaPlatinumWealthVenture2BasePolicy(snapshot, id, AIA_STRESS_FUNDS, {
    name: 'Golden AIA Platinum Wealth Venture 2.0 (SGD / MIP 5 OCF Stress)',
  })
}

function etiqaTiqInvestBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'etiqa-tiq-invest', 'sgd-open-ended', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden Tiq Invest (SGD / Open-ended)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function etiqaInvestStarterBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'etiqa-invest-starter', 'sgd-mip-5', id, {
    monthlyContribution: 0,
    currentPolicyYear: 2,
    monthsAlreadyPaid: 12,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden Etiqa Invest starter (SGD / MIP 5)',
      monthlyContribution: 350,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: 12_000,
        contributionRules: [
          { phase: 'during-icp', contributionShare: 1 },
          { phase: 'after-icp', contributionShare: 1 },
          { phase: 'top-up', contributionShare: 1 },
        ],
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function etiqaInvestStarterBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaInvestStarterBasePolicy(snapshot, id, ETIQA_BALANCED_FUNDS)
}

function etiqaInvestStarterEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaInvestStarterBasePolicy(snapshot, id, ETIQA_BALANCED_FUNDS, {
    name: 'Golden Etiqa Invest starter (SGD / MIP 5 Event Heavy)',
    currentPolicyYear: 3,
    monthsAlreadyPaid: 24,
    policyEvents: [
      {
        id: 'holiday-1',
        type: 'premium-holiday',
        startPolicyMonth: 25,
        durationMonths: 3,
        repayMissedPremiums: true,
        repaymentAccountId: 'portfolio',
      },
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 29,
        durationMonths: 1,
        amount: 2_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 31,
        durationMonths: 1,
        amount: 1_000,
        accountId: 'portfolio',
      },
    ],
  })
}

function etiqaInvestStarterStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaInvestStarterBasePolicy(snapshot, id, ETIQA_STRESS_FUNDS, {
    name: 'Golden Etiqa Invest starter (SGD / MIP 5 OCF Stress)',
    currentPolicyYear: 4,
    monthsAlreadyPaid: 36,
  })
}

function etiqaTiqInvestBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaTiqInvestBasePolicy(snapshot, id, ETIQA_BALANCED_FUNDS)
}

function etiqaTiqInvestEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaTiqInvestBasePolicy(snapshot, id, ETIQA_BALANCED_FUNDS, {
    name: 'Golden Tiq Invest (SGD / Open-ended Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'rsp-1',
        type: 'recurring-single-premium',
        startPolicyMonth: 7,
        durationMonths: 6,
        amount: 500,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 11,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function etiqaTiqInvestStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return etiqaTiqInvestBasePolicy(snapshot, id, ETIQA_STRESS_FUNDS, {
    name: 'Golden Tiq Invest (SGD / Open-ended OCF Stress)',
  })
}

function etiqaFlexSupportedBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'etiqa-invest-flex-prime-ii' | 'etiqa-invest-flex-pro' | 'etiqa-invest-vista',
  variantId: 'sgd-mip-10-flexi-3' | 'sgd-mip-10-flexi-5' | 'sgd-mip-20',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const isTwentyYear = variantId === 'sgd-mip-20'
  const monthlyContribution = isTwentyYear ? 400 : 800
  const currentPolicyYear = isTwentyYear ? 8 : 6
  const currentNetRegularPremiumBase = monthlyContribution * 12 * (currentPolicyYear - 1)
  const base = seedPolicy(snapshot, productId, variantId, id, {
    monthlyContribution,
    currentPolicyYear,
    monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
    assuranceProfile: {
      currentAgeNextBirthday: isTwentyYear ? 44 : 42,
      sex: isTwentyYear ? 'female' : 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden ${productId} (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: account.id === 'regular'
          ? (isTwentyYear ? 26_000 : 21_000)
          : (isTwentyYear ? 5_000 : 3_000),
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function etiqaFlexBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'etiqa-invest-flex-prime-ii' | 'etiqa-invest-flex-pro' | 'etiqa-invest-vista',
  variantId: 'sgd-mip-10-flexi-3' | 'sgd-mip-10-flexi-5' | 'sgd-mip-20',
  id: string,
): IlpPolicyInput {
  return etiqaFlexSupportedBasePolicy(snapshot, productId, variantId, id, ETIQA_BALANCED_FUNDS)
}

function etiqaFlexEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'etiqa-invest-flex-prime-ii' | 'etiqa-invest-flex-pro' | 'etiqa-invest-vista',
  variantId: 'sgd-mip-10-flexi-3' | 'sgd-mip-10-flexi-5' | 'sgd-mip-20',
  id: string,
): IlpPolicyInput {
  const isTwentyYear = variantId === 'sgd-mip-20'
  return etiqaFlexSupportedBasePolicy(snapshot, productId, variantId, id, ETIQA_BALANCED_FUNDS, {
    name: `Golden ${productId} (${variantId.toUpperCase()} Event Heavy)`,
    currentPolicyYear: isTwentyYear ? 9 : 8,
    monthsAlreadyPaid: isTwentyYear ? 96 : 84,
    assuranceProfile: {
      currentAgeNextBirthday: isTwentyYear ? 46 : 45,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: isTwentyYear ? 38_400 : 67_200,
    },
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: isTwentyYear ? 97 : 85,
        durationMonths: 1,
        amount: 6_000,
      },
      {
        id: 'reduction-1',
        type: 'regular-premium-reduction',
        startPolicyMonth: isTwentyYear ? 99 : 87,
        durationMonths: 1,
        amount: 2_400,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: isTwentyYear ? 102 : 90,
        durationMonths: 1,
        amount: 2_000,
        accountId: 'regular',
      },
    ],
  })
}

function etiqaFlexStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'etiqa-invest-flex-prime-ii' | 'etiqa-invest-flex-pro' | 'etiqa-invest-vista',
  variantId: 'sgd-mip-10-flexi-3' | 'sgd-mip-10-flexi-5' | 'sgd-mip-20',
  id: string,
): IlpPolicyInput {
  const isTwentyYear = variantId === 'sgd-mip-20'
  return etiqaFlexSupportedBasePolicy(snapshot, productId, variantId, id, ETIQA_STRESS_FUNDS, {
    name: `Golden ${productId} (${variantId.toUpperCase()} OCF Stress)`,
    currentPolicyYear: isTwentyYear ? 9 : 8,
    monthsAlreadyPaid: isTwentyYear ? 96 : 84,
    assuranceProfile: {
      currentAgeNextBirthday: isTwentyYear ? 46 : 45,
      sex: 'female',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: isTwentyYear ? 38_400 : 67_200,
    },
  })
}

function etiqaCumulativeSupportedBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'etiqa-invest-flex-wealth-ii' | 'etiqa-invest-smart-flex-ii' | 'etiqa-invest-smart-vista' | 'etiqa-invest-wealth-purpose',
  variantId: 'sgd-mip-10' | 'sgd-mip-15' | 'sgd-mip-20',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = term === 10 ? 6 : term === 15 ? 9 : 11
  const monthlyContribution = term === 20 ? 450 : 750
  const currentNetRegularPremiumBase = monthlyContribution * 12 * (currentPolicyYear - 1)
  const base = seedPolicy(snapshot, productId, variantId, id, {
    monthlyContribution,
    currentPolicyYear,
    monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
    assuranceProfile: {
      currentAgeNextBirthday: term >= 20 ? 46 : 43,
      sex: term >= 20 ? 'female' : 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase,
    },
  })

  return withResolvedManualInputs(withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden ${productId} (${variantId.toUpperCase()})`,
      accounts: base.accounts.map((account) => ({
        ...account,
        currentValue: account.id === 'regular'
          ? (term >= 20 ? 29_000 : term === 15 ? 24_000 : 18_000)
          : (term >= 20 ? 7_000 : 4_500),
      })),
      policyEvents: [],
      ...overrides,
    }),
    funds,
  ))
}

function etiqaCumulativeBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'etiqa-invest-flex-wealth-ii' | 'etiqa-invest-smart-flex-ii' | 'etiqa-invest-smart-vista' | 'etiqa-invest-wealth-purpose',
  variantId: 'sgd-mip-10' | 'sgd-mip-15' | 'sgd-mip-20',
  id: string,
): IlpPolicyInput {
  return etiqaCumulativeSupportedBasePolicy(snapshot, productId, variantId, id, ETIQA_BALANCED_FUNDS)
}

function etiqaCumulativeEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'etiqa-invest-flex-wealth-ii' | 'etiqa-invest-smart-flex-ii' | 'etiqa-invest-smart-vista' | 'etiqa-invest-wealth-purpose',
  id: string,
): IlpPolicyInput {
  return etiqaCumulativeSupportedBasePolicy(snapshot, productId, 'sgd-mip-20', id, ETIQA_BALANCED_FUNDS, {
    name: `Golden ${productId} (SGD / MIP 20 Event Heavy)`,
    currentPolicyYear: 12,
    monthsAlreadyPaid: 132,
    monthlyContribution: 450,
    assuranceProfile: {
      currentAgeNextBirthday: 48,
      sex: 'male',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 59_400,
    },
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 133,
        durationMonths: 1,
        amount: 7_500,
      },
      {
        id: 'reduction-1',
        type: 'regular-premium-reduction',
        startPolicyMonth: 136,
        durationMonths: 1,
        amount: 1_800,
      },
    ],
  })
}

function etiqaCumulativeStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId: 'etiqa-invest-flex-wealth-ii' | 'etiqa-invest-smart-flex-ii' | 'etiqa-invest-smart-vista' | 'etiqa-invest-wealth-purpose',
  id: string,
): IlpPolicyInput {
  return etiqaCumulativeSupportedBasePolicy(snapshot, productId, 'sgd-mip-15', id, ETIQA_STRESS_FUNDS, {
    name: `Golden ${productId} (SGD / MIP 15 OCF Stress)`,
    currentPolicyYear: 9,
    monthsAlreadyPaid: 96,
    monthlyContribution: 750,
    assuranceProfile: {
      currentAgeNextBirthday: 45,
      sex: 'female',
      smokerStatus: 'non-smoker',
      currentNetRegularPremiumBase: 72_000,
    },
  })
}

function greatEasternGiaSpBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'great-eastern-great-invest-advantage-sp', variantId, id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden GREAT Invest Advantage (SP) (${variantId.toUpperCase()})`,
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function greatEasternGiaSpBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis',
  id: string,
): IlpPolicyInput {
  return greatEasternGiaSpBasePolicy(snapshot, variantId, id, GREAT_BALANCED_FUNDS)
}

function greatEasternGiaSpEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGiaSpBasePolicy(snapshot, 'sgd-open-ended-cash-or-srs', id, GREAT_BALANCED_FUNDS, {
    name: 'Golden GREAT Invest Advantage (SP) (SGD / Open-ended Cash Or Srs Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 10,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternGiaSpStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGiaSpBasePolicy(snapshot, 'sgd-open-ended-cash-or-srs', id, GREAT_STRESS_FUNDS, {
    name: 'Golden GREAT Invest Advantage (SP) (SGD / Open-ended Cash Or Srs OCF Stress)',
  })
}

function greatEasternGia2SpBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'great-eastern-great-invest-advantage-2-sp', 'sgd-open-ended-cash-or-srs', id, {
    initialSinglePremium: 100_000,
    monthlyContribution: 0,
    currentPolicyYear: 1,
    monthsAlreadyPaid: 0,
  })

  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden GREAT Invest Advantage 2 (SP) (SGD / Open-ended Cash Or Srs)',
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function greatEasternGia2SpBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2SpBasePolicy(snapshot, id, GREAT_BALANCED_FUNDS)
}

function greatEasternGia2SpEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2SpBasePolicy(snapshot, id, GREAT_BALANCED_FUNDS, {
    name: 'Golden GREAT Invest Advantage 2 (SP) (SGD / Open-ended Cash Or Srs Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 6,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 10,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternGia2SpStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2SpBasePolicy(snapshot, id, GREAT_STRESS_FUNDS, {
    name: 'Golden GREAT Invest Advantage 2 (SP) (SGD / Open-ended Cash Or Srs OCF Stress)',
  })
}

function greatEasternGiaRspBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis',
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'great-eastern-great-invest-advantage-rsp', variantId, id)
  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: `Golden GREAT Invest Advantage (RSP) (${variantId.toUpperCase()})`,
      monthlyContribution: 350,
      currentPolicyYear: 3,
      monthsAlreadyPaid: 24,
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function greatEasternGiaRspBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis',
  id: string,
): IlpPolicyInput {
  return greatEasternGiaRspBasePolicy(snapshot, variantId, id, GREAT_BALANCED_FUNDS)
}

function greatEasternGiaRspEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGiaRspBasePolicy(snapshot, 'sgd-open-ended-cash-or-srs', id, GREAT_BALANCED_FUNDS, {
    name: 'Golden GREAT Invest Advantage (RSP) (SGD / Open-ended Cash Or Srs Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 31,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 33,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternGiaRspStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGiaRspBasePolicy(snapshot, 'sgd-open-ended-cash-or-srs', id, GREAT_STRESS_FUNDS, {
    name: 'Golden GREAT Invest Advantage (RSP) (SGD / Open-ended Cash Or Srs OCF Stress)',
  })
}

function greatEasternGia2RspBasePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
  funds: IlpFund[],
  overrides: Partial<IlpPolicyInput> = {},
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'great-eastern-great-invest-advantage-2-rsp', 'sgd-open-ended-cash-or-srs', id)
  return withFunds(
    ilpPolicySchema.parse({
      ...base,
      name: 'Golden GREAT Invest Advantage 2 (RSP) (SGD / Open-ended Cash Or Srs)',
      monthlyContribution: 350,
      currentPolicyYear: 3,
      monthsAlreadyPaid: 24,
      policyEvents: [],
      ...overrides,
    }),
    funds,
  )
}

function greatEasternGia2RspBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2RspBasePolicy(snapshot, id, GREAT_BALANCED_FUNDS)
}

function greatEasternGia2RspEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2RspBasePolicy(snapshot, id, GREAT_BALANCED_FUNDS, {
    name: 'Golden GREAT Invest Advantage 2 (RSP) (SGD / Open-ended Cash Or Srs Event Heavy)',
    policyEvents: [
      {
        id: 'top-up-1',
        type: 'top-up',
        startPolicyMonth: 31,
        durationMonths: 1,
        amount: 10_000,
      },
      {
        id: 'withdrawal-1',
        type: 'partial-withdrawal',
        startPolicyMonth: 33,
        durationMonths: 1,
        amount: 4_000,
        accountId: 'policy',
      },
    ],
  })
}

function greatEasternGia2RspStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  return greatEasternGia2RspBasePolicy(snapshot, id, GREAT_STRESS_FUNDS, {
    name: 'Golden GREAT Invest Advantage 2 (RSP) (SGD / Open-ended Cash Or Srs OCF Stress)',
  })
}

function prosperBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', variantId, id)
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 3), term - 1)
  const distributionAssumption = variantId === 'sgd-mip-20'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden PRUVantage Prosper (${variantId.toUpperCase()})`,
        monthlyContribution: 1_250,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
        distributionAssumption,
        assuranceProfile: {
          currentAgeNextBirthday: 47,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 95_000,
        },
        policyEvents: [],
      }),
      PRU_BALANCED_FUNDS,
    ),
    10_000 + term * 650,
    9_000 + term * 600,
    2_500 + term * 120,
    0.55,
  ))
}

function prosperEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Prosper (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 1_350,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        assuranceProfile: {
          currentAgeNextBirthday: 49,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 102_000,
        },
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 121,
            durationMonths: 4,
            repayMissedPremiums: true,
            repaymentAccountId: 'flex',
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 129,
            durationMonths: 1,
            amount: 7_500,
          },
          {
            id: 'withdrawal-free-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 133,
            durationMonths: 1,
            amount: 2_500,
            accountId: 'growth',
          },
          {
            id: 'withdrawal-charged-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 145,
            durationMonths: 1,
            amount: 1_800,
            accountId: 'flex',
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    20_000,
    16_000,
    4_500,
    0.58,
  ))
}

function prosperHolidayFallbackPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Prosper (SGD / MIP 25 Holiday Fallback)',
        monthlyContribution: 1_350,
        currentPolicyYear: 12,
        monthsAlreadyPaid: 132,
        assuranceProfile: {
          currentAgeNextBirthday: 50,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 102_000,
        },
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 133,
            durationMonths: 6,
            repayMissedPremiums: false,
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    200,
    150,
    6_500,
    0.5,
  ))
}

function prosperStressPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-prosper', 'sgd-mip-20', id)
  return withResolvedManualInputs(withPruBalancesAndSplit(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Prosper (SGD / MIP 20 Split Stress)',
        monthlyContribution: 1_200,
        currentPolicyYear: 9,
        monthsAlreadyPaid: 96,
        assuranceProfile: {
          currentAgeNextBirthday: 46,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 86_000,
        },
        policyEvents: [],
      }),
      PRU_STRESS_FUNDS,
    ),
    6_500,
    21_000,
    4_800,
    0.22,
  ))
}

function assureIiBoundedAssurancePolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      withoutRecurringContribution(
        ilpPolicySchema.parse({
          ...base,
          name: 'Golden PRUVantage Assure II (SGD / MIP 25 Bounded Assurance)',
          currentPolicyYear: 23,
          monthsAlreadyPaid: 276,
          postMipYears: 3,
          assuranceProfile: {
            currentAgeNextBirthday: 68,
            sex: 'male',
            smokerStatus: 'non-smoker',
            currentNetRegularPremiumBase: 100_000,
            currentSumAssured: 148_000,
            currentWealthAssureValue: 101_000,
          },
          policyEvents: [],
        }),
      ),
      PRU_BALANCED_FUNDS,
    ),
    50_000,
    50_000,
    50_000,
  ))
}

function assureIiStateOverridePolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      withoutRecurringContribution(
        ilpPolicySchema.parse({
          ...base,
          name: 'Golden PRUVantage Assure II (SGD / MIP 25 State Override)',
          currentPolicyYear: 24,
          monthsAlreadyPaid: 288,
          postMipYears: 3,
          assuranceProfile: {
            currentAgeNextBirthday: 70,
            sex: 'male',
            smokerStatus: 'non-smoker',
            currentNetRegularPremiumBase: 100_000,
            currentSumAssured: 140_000,
            currentWealthAssureValue: 135_000,
          },
          policyEvents: [
            {
              id: 'reduce-1',
              type: 'assurance-benefit-reduction',
              startPolicyMonth: 289,
              durationMonths: 1,
              resultingSumAssured: 110_000,
              resultingWealthAssureValue: 105_000,
            },
            {
              id: 'resume-1',
              type: 'assurance-benefit-resumption',
              startPolicyMonth: 313,
              durationMonths: 1,
              resultingSumAssured: 140_000,
            },
          ],
        }),
      ),
      PRU_BALANCED_FUNDS,
    ),
    50_000,
    50_000,
    50_000,
  ))
}

function assureIiBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  variantId: string,
  id: string,
): IlpPolicyInput {
  if (variantId === 'sgd-mip-25') {
    return assureIiBoundedAssurancePolicy(snapshot, id)
  }

  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', variantId, id)
  const term = Number(variantId.replace('sgd-mip-', ''))
  const currentPolicyYear = Math.min(Math.max(Math.floor(term / 2) + 1, 3), term - 1)
  const distributionAssumption = variantId === 'sgd-mip-20'
    ? {
        mode: 'cash-payout' as const,
        source: 'manual-assumption' as const,
        annualYieldRate: 0.04,
      }
    : base.distributionAssumption

  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: `Golden PRUVantage Assure II (${variantId.toUpperCase()})`,
        monthlyContribution: 1_200,
        currentPolicyYear,
        monthsAlreadyPaid: (currentPolicyYear - 1) * 12,
        distributionAssumption,
        assuranceProfile: {
          currentAgeNextBirthday: 48,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 92_000,
          currentSumAssured: 145_000,
          currentWealthAssureValue: 110_000,
        },
        policyEvents: [],
      }),
      PRU_BALANCED_FUNDS,
    ),
    11_000 + term * 700,
    10_000 + term * 650,
    3_000 + term * 100,
  ))
}

function assureIiEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Assure II (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 1_300,
        currentPolicyYear: 11,
        monthsAlreadyPaid: 120,
        assuranceProfile: {
          currentAgeNextBirthday: 52,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 100_000,
          currentSumAssured: 150_000,
          currentWealthAssureValue: 120_000,
        },
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 121,
            durationMonths: 4,
            repayMissedPremiums: true,
            repaymentAccountId: 'flex',
          },
          {
            id: 'top-up-1',
            type: 'top-up',
            startPolicyMonth: 129,
            durationMonths: 1,
            amount: 7_500,
          },
          {
            id: 'withdrawal-free-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 133,
            durationMonths: 1,
            amount: 2_500,
            accountId: 'growth',
          },
          {
            id: 'withdrawal-charged-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 145,
            durationMonths: 1,
            amount: 1_800,
            accountId: 'flex',
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    20_000,
    16_000,
    4_500,
  ))
}

function assureIiHolidayFallbackPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-25', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Assure II (SGD / MIP 25 Holiday Fallback)',
        monthlyContribution: 1_300,
        currentPolicyYear: 12,
        monthsAlreadyPaid: 132,
        assuranceProfile: {
          currentAgeNextBirthday: 53,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 100_000,
          currentSumAssured: 150_000,
          currentWealthAssureValue: 122_000,
        },
        policyEvents: [
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 133,
            durationMonths: 6,
            repayMissedPremiums: false,
          },
        ],
      }),
      PRU_BALANCED_FUNDS,
    ),
    200,
    150,
    6_500,
  ))
}

function assureIiStressPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'prudential-pruvantage-assure-ii', 'sgd-mip-20', id)
  return withResolvedManualInputs(withPruBalancesOnly(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden PRUVantage Assure II (SGD / MIP 20 Split Stress)',
        monthlyContribution: 1_150,
        currentPolicyYear: 9,
        monthsAlreadyPaid: 96,
        assuranceProfile: {
          currentAgeNextBirthday: 47,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 88_000,
          currentSumAssured: 135_000,
          currentWealthAssureValue: 108_000,
        },
        policyEvents: [],
      }),
      PRU_STRESS_FUNDS,
    ),
    7_000,
    22_000,
    5_000,
  ))
}

function tokioEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-max-ii', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Max (II) (SGD / MIP 15 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 49,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 40,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 46,
            durationMonths: 1,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 50,
            durationMonths: 1,
            amount: 600,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioWealthMaxAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-max-ii', 'sgd-mip-15-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Max (II) (SGD / MIP 15 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  ))
}

function tokioWealthMaxStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-max-ii', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Max (II) (SGD / MIP 15 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        postMipYears: 15,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    3_000,
    14_000,
    0,
  )
}

function tokioGoLuxeEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goluxe', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goLuxe (SGD / MIP 15 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 49,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 40,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 46,
            durationMonths: 1,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 50,
            durationMonths: 1,
            amount: 600,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioGoLuxeAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goluxe', 'sgd-mip-15-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goLuxe (SGD / MIP 15 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  ))
}

function tokioGoLuxeStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goluxe', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goLuxe (SGD / MIP 15 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        postMipYears: 15,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    3_000,
    14_000,
    0,
  )
}

function tokioAffluenceAtFutureEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-affluence-atfuture', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Affluence@Future (SGD / MIP 15 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 49,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 40,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 46,
            durationMonths: 1,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 50,
            durationMonths: 1,
            amount: 600,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioAffluenceAtFutureAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-affluence-atfuture', 'sgd-mip-15-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Affluence@Future (SGD / MIP 15 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 24,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  ))
}

function tokioAffluenceAtFutureStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-affluence-atfuture', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Affluence@Future (SGD / MIP 15 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        postMipYears: 15,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    3_000,
    14_000,
    0,
  )
}

function tokioGoAffluenceEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goaffluence', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goAffluence (SGD / MIP 15 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 49,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 40,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 46,
            durationMonths: 1,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioGoAffluenceAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goaffluence', 'sgd-mip-15-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goAffluence (SGD / MIP 15 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 24,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  ))
}

function tokioGoAffluenceStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goaffluence', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goAffluence (SGD / MIP 15 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        postMipYears: 15,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    3_000,
    14_000,
    0,
  )
}

function tokioAtlasEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-atlas-wealth', 'sgd-mip-25', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine TM Atlas Wealth (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 200,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioAtlasAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-atlas-wealth', 'sgd-mip-25-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine TM Atlas Wealth (SGD / MIP 25 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  ))
}

function tokioAtlasStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-atlas-wealth', 'sgd-mip-25', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine TM Atlas Wealth (SGD / MIP 25 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        postMipYears: 15,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    3_000,
    14_000,
    0,
  )
}

function tokioGoClassicEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goclassic', 'sgd-mip-25', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goClassic (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    18_000,
    9_000,
    0,
  )
}

function tokioGoClassicAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goclassic', 'sgd-mip-25-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goClassic (SGD / MIP 25 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 24,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    18_000,
    9_000,
    0,
  ))
}

function tokioGoClassicStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goclassic', 'sgd-mip-25', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goClassic (SGD / MIP 25 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 12,
        monthsAlreadyPaid: 132,
        postMipYears: 15,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    26_000,
    13_000,
    0,
  )
}

function tokioGoClassicSecureEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goclassic-secure', 'sgd-mip-25', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goClassic Secure (SGD / MIP 25 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    18_000,
    9_000,
    0,
  )
}

function tokioGoClassicSecureAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goclassic-secure', 'sgd-mip-25-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goClassic Secure (SGD / MIP 25 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 24,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
          currentTokioLockedInValue: 60_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    18_000,
    9_000,
    0,
  ))
}

function tokioGoClassicSecureStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-goclassic-secure', 'sgd-mip-25', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine #goClassic Secure (SGD / MIP 25 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 12,
        monthsAlreadyPaid: 132,
        postMipYears: 15,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    26_000,
    13_000,
    0,
  )
}

function tokioBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  productId:
    | 'tokio-marine-atlas-wealth'
    | 'tokio-marine-affluence-atfuture'
    | 'tokio-marine-goclassic'
    | 'tokio-marine-goclassic-secure'
    | 'tokio-marine-goaffluence'
    | 'tokio-marine-goluxe'
    | 'tokio-marine-harvest-builder-atfuture'
    | 'tokio-marine-harvest-flexi'
    | 'tokio-marine-harvest-max'
    | 'tokio-marine-harvest-pro'
    | 'tokio-marine-wealth-builder-atfuture'
    | 'tokio-marine-wealth-flexi'
    | 'tokio-marine-wealth-flexi-link-3-12'
    | 'tokio-marine-wealth-flexi-link-5-10'
    | 'tokio-marine-wealth-max-ii'
    | 'tokio-marine-wealth-pro-ii',
  variantId: 'sgd-mip-25' | 'sgd-mip-15' | 'sgd-mip-12' | 'sgd-mip-10',
  id: string,
  name: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, productId, variantId, id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name,
        monthlyContribution: 2_000,
        currentPolicyYear: 1,
        monthsAlreadyPaid: 0,
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    0,
    0,
  )
}

function tokioWealthProEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-pro-ii', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 37,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 39,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 40,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 45,
            durationMonths: 1,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioWealthProWaivedChargesPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-pro-ii', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Waived Charges)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
            chargeWaived: true,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 40,
            durationMonths: 3,
            chargeWaived: true,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 44,
            durationMonths: 2,
            amount: 600,
            chargeWaived: true,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioWealthProStructuralProofPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-pro-ii', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Structural Proof)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 38,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 39,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 37,
            durationMonths: 3,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    200,
    50,
    300,
  )
}

function tokioWealthProAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-pro-ii', 'sgd-mip-10-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  ))
}

function tokioWealthProStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-pro-ii', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 6,
        monthsAlreadyPaid: 60,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    2_500,
    11_000,
    0,
  )
}

function tokioHarvestFlexiEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-flexi', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Flexi (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 40,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 46,
            durationMonths: 1,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 47,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  )
}

function tokioHarvestFlexiAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-flexi', 'sgd-mip-10-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Flexi (SGD / MIP 10 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  ))
}

function tokioHarvestFlexiStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-flexi', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Flexi (SGD / MIP 10 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    0,
    14_000,
    3_000,
  )
}

function tokioWealthFlexiEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 40,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 46,
            durationMonths: 1,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 47,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  )
}

function tokioWealthFlexiAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi', 'sgd-mip-10-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi (SGD / MIP 10 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  ))
}

function tokioWealthFlexiStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi (SGD / MIP 10 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    0,
    14_000,
    3_000,
  )
}

function tokioWealthFlexiLink510EventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi-link-5-10', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi-Link 5.10 (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 47,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  )
}

function tokioWealthFlexiLink510AdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi-link-5-10', 'sgd-mip-10-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi-Link 5.10 (SGD / MIP 10 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  ))
}

function tokioWealthFlexiLink510StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi-link-5-10', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi-Link 5.10 (SGD / MIP 10 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    0,
    14_000,
    3_000,
  )
}

function tokioWealthFlexiLink312EventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi-link-3-12', 'sgd-mip-12', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi-Link 3.12 (SGD / MIP 12 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 47,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  )
}

function tokioWealthFlexiLink312AdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi-link-3-12', 'sgd-mip-12-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi-Link 3.12 (SGD / MIP 12 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  ))
}

function tokioWealthFlexiLink312StressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-flexi-link-3-12', 'sgd-mip-12', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Flexi-Link 3.12 (SGD / MIP 12 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 10,
        monthsAlreadyPaid: 108,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    0,
    14_000,
    3_000,
  )
}

function tokioWealthBuilderAtfutureEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-builder-atfuture', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Builder@Future (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 47,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  )
}

function tokioWealthBuilderAtfutureAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-builder-atfuture', 'sgd-mip-10-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Builder@Future (SGD / MIP 10 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  ))
}

function tokioWealthBuilderAtfutureStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-wealth-builder-atfuture', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Wealth Builder@Future (SGD / MIP 10 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    0,
    14_000,
    3_000,
  )
}

function tokioHarvestBuilderAtfutureEventHeavyPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-builder-atfuture', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Builder@Future (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 38,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 41,
            durationMonths: 3,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 47,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  )
}

function tokioHarvestBuilderAtfutureAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-builder-atfuture', 'sgd-mip-10-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Builder@Future (SGD / MIP 10 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    0,
    8_000,
    1_500,
  ))
}

function tokioHarvestBuilderAtfutureStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-builder-atfuture', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Builder@Future (SGD / MIP 10 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    0,
    14_000,
    3_000,
  )
}

function tokioHarvestProEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-pro', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Pro (SGD / MIP 10 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 37,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 39,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 40,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 45,
            durationMonths: 1,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioHarvestProStructuralProofPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-pro', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Pro (SGD / MIP 10 Structural Proof)',
        monthlyContribution: 350,
        currentPolicyYear: 3,
        monthsAlreadyPaid: 36,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 37,
            durationMonths: 1,
            amount: 1_000,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 38,
            durationMonths: 1,
            amount: 500,
            accountId: 'accumulation',
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 39,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 37,
            durationMonths: 3,
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    200,
    50,
    300,
  )
}

function tokioHarvestProAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-pro', 'sgd-mip-10-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Pro (SGD / MIP 10 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  ))
}

function tokioHarvestProStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-pro', 'sgd-mip-10', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Pro (SGD / MIP 10 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 6,
        monthsAlreadyPaid: 60,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    2_500,
    11_000,
    0,
  )
}

function tokioHarvestMaxEventHeavyPolicy(snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>, id: string): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-max', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Max (SGD / MIP 15 Event Heavy)',
        monthlyContribution: 350,
        currentPolicyYear: 6,
        monthsAlreadyPaid: 60,
        postMipYears: 15,
        policyEvents: [
          {
            id: 'topup-1',
            type: 'top-up',
            startPolicyMonth: 61,
            durationMonths: 1,
            amount: 1_200,
          },
          {
            id: 'rsp-1',
            type: 'recurring-single-premium',
            startPolicyMonth: 62,
            durationMonths: 12,
            amount: 100,
          },
          {
            id: 'reduction-1',
            type: 'regular-premium-reduction',
            startPolicyMonth: 64,
            durationMonths: 1,
            amount: 600,
          },
          {
            id: 'holiday-1',
            type: 'premium-holiday',
            startPolicyMonth: 65,
            durationMonths: 3,
          },
          {
            id: 'rsp-resume-1',
            type: 'recurring-single-premium-resumption',
            startPolicyMonth: 70,
            durationMonths: 1,
          },
          {
            id: 'withdrawal-1',
            type: 'partial-withdrawal',
            startPolicyMonth: 71,
            durationMonths: 1,
            amount: 600,
            accountId: 'accumulation',
          },
        ],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  )
}

function tokioHarvestMaxAdvancedDeathBaselinePolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-max', 'sgd-mip-15-advanced-death', id)
  return withResolvedManualInputs(withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Max (SGD / MIP 15 Advanced Death Baseline)',
        monthlyContribution: 2_000,
        currentPolicyYear: 4,
        monthsAlreadyPaid: 36,
        assuranceProfile: {
          currentAgeNextBirthday: 45,
          sex: 'male',
          smokerStatus: 'non-smoker',
          currentNetRegularPremiumBase: 72_000,
        },
        postMipYears: 15,
        policyEvents: [],
      }),
      TOKIO_BALANCED_FUNDS,
    ),
    1_500,
    8_000,
    0,
  ))
}

function tokioHarvestMaxStressPolicy(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  id: string,
): IlpPolicyInput {
  const base = seedPolicy(snapshot, 'tokio-marine-harvest-max', 'sgd-mip-15', id)
  return withTokioBalances(
    withFunds(
      ilpPolicySchema.parse({
        ...base,
        name: 'Golden Tokio Marine Harvest Max (SGD / MIP 15 OCF Stress)',
        monthlyContribution: 2_000,
        currentPolicyYear: 8,
        monthsAlreadyPaid: 84,
        postMipYears: 15,
        policyEvents: [],
      }),
      HSBC_STRESS_FUNDS,
    ),
    3_000,
    14_000,
    0,
  )
}

const GOLDEN_FIXTURE_MANIFEST: GoldenFixtureDefinition[] = [
  {
    productId: 'aia-invest-easy-cash-srs',
    variantId: 'sgd-open-ended-cash-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:aia-invest-easy-cash-srs-three-percent-single-premium-charge'],
    description: 'AIA Invest Easy (Cash/SRS) baseline scenario proving the supported 3% single-premium corridor.',
  },
  {
    productId: 'aia-invest-easy-cash-srs',
    variantId: 'sgd-open-ended-cash-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-invest-easy-cash-srs-three-percent-top-up-charge',
      'branch:aia-invest-easy-cash-srs-three-percent-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'AIA Invest Easy (Cash/SRS) supported event-heavy scenario covering 3% top-up and recurring-top-up charges.',
  },
  {
    productId: 'aia-invest-easy-cash-srs',
    variantId: 'sgd-open-ended-cash-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Invest Easy (Cash/SRS) alternate-fund stress scenario through the open-ended no-MIP basis.',
  },
  {
    productId: 'aia-invest-easy-cpf',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:aia-invest-easy-cpf-zero-single-premium-charge'],
    description: 'AIA Invest Easy (CPF) baseline scenario proving zero-charge initial single-premium seeding.',
  },
  {
    productId: 'aia-invest-easy-cpf',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-invest-easy-cpf-zero-top-up-charge',
      'branch:aia-invest-easy-cpf-zero-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'AIA Invest Easy (CPF) supported event-heavy scenario covering zero-charge top-up and recurring-top-up routing.',
  },
  {
    productId: 'aia-invest-easy-cpf',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Invest Easy (CPF) alternate-fund stress scenario through the open-ended no-MIP basis.',
  },
  {
    productId: 'aia-platinum-retirement-elite',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:scheduled-payout-manual-assumption',
      'branch:aia-platinum-retirement-elite-regular-premium-charge',
      'branch:aia-platinum-retirement-elite-regular-supplementary-charge',
      'branch:aia-platinum-retirement-elite-full-surrender-charge',
    ],
    description: 'AIA Platinum Retirement Elite baseline scenario covering the supported regular-pay corridor and manual scheduled-redemption assumption.',
    integrityChecks: [
      {
        description: 'manual scheduled-redemption assumption produces annual withdrawals in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'aia-platinum-retirement-elite',
    variantId: 'sgd-mip-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-platinum-retirement-elite-top-up-premium-charge',
      'branch:aia-platinum-retirement-elite-premium-holiday-charge',
      'branch:aia-platinum-retirement-elite-partial-withdrawal-charge',
    ],
    description: 'AIA Platinum Retirement Elite event-heavy scenario covering premium holiday, top-up, partial withdrawal, and manual scheduled-redemption.',
    integrityChecks: [
      {
        description: 'event-heavy policy produces annual withdrawals from the seeded payout and withdrawal events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'aia-platinum-retirement-elite',
    variantId: 'sgd-mip-5',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Platinum Retirement Elite alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'aia-elite-secure-income-single-premium',
    variantId: 'sgd-open-ended-sp',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:scheduled-payout-manual-assumption',
      'branch:aia-elite-secure-income-sp-single-premium-charge',
      'branch:aia-elite-secure-income-sp-supplementary-charge-manual-input',
      'branch:aia-elite-secure-income-sp-full-surrender-charge',
    ],
    description: 'AIA Elite Secure Income - Single Premium baseline scenario covering the supported single-premium corridor, manual annual supplementary charge input, and manual scheduled-redemption assumption.',
    integrityChecks: [
      {
        description: 'manual supplementary-charge input produces positive cumulative fees in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
      {
        description: 'manual scheduled-redemption assumption produces annual withdrawals in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'aia-elite-secure-income-single-premium',
    variantId: 'sgd-open-ended-sp',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-elite-secure-income-sp-top-up-premium-charge',
      'branch:aia-elite-secure-income-sp-partial-withdrawal-charge',
    ],
    description: 'AIA Elite Secure Income - Single Premium event-heavy scenario covering top-up, partial withdrawal, and manual scheduled-redemption.',
    integrityChecks: [
      {
        description: 'event-heavy policy produces annual withdrawals from the seeded payout and withdrawal events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'event-heavy policy records additional annual contribution from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
    ],
  },
  {
    productId: 'aia-elite-secure-income-single-premium',
    variantId: 'sgd-open-ended-sp',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Elite Secure Income - Single Premium alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'aia-elite-secure-income-5-pay',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:scheduled-payout-manual-assumption',
      'branch:aia-elite-secure-income-5p-premium-year-premium-charge',
      'branch:aia-elite-secure-income-5p-supplementary-charge-manual-input',
      'branch:aia-elite-secure-income-5p-full-surrender-charge',
    ],
    description: 'AIA Elite Secure Income - 5 Pay baseline scenario covering the supported regular-pay corridor, manual annual supplementary charge input, and manual scheduled-redemption assumption.',
    integrityChecks: [
      {
        description: 'manual supplementary-charge input produces positive cumulative fees in projection output',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'manual scheduled-redemption assumption produces annual withdrawals in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'aia-elite-secure-income-5-pay',
    variantId: 'sgd-mip-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-elite-secure-income-5p-top-up-premium-charge',
      'branch:aia-elite-secure-income-5p-premium-holiday-charge',
      'branch:aia-elite-secure-income-5p-partial-withdrawal-charge',
    ],
    description: 'AIA Elite Secure Income - 5 Pay event-heavy scenario covering premium holiday, top-up, partial withdrawal, and manual scheduled-redemption.',
    integrityChecks: [
      {
        description: 'event-heavy policy produces annual withdrawals from the seeded payout and withdrawal events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'aia-elite-secure-income-5-pay',
    variantId: 'sgd-mip-5',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Elite Secure Income - 5 Pay alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'aia-wealth-venture',
    variantId: 'sgd-mip-8',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:aia-wealth-venture-zero-regular-premium-charge',
      'branch:aia-wealth-venture-regular-supplementary-charge',
      'branch:aia-wealth-venture-full-surrender-charge',
    ],
    description: 'AIA Wealth Venture baseline scenario proving the supported regular-pay corridor and cash-payout distribution assumption.',
    integrityChecks: [
      {
        description: 'records positive annual fees under the supported supplementary-charge corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'pays positive annual distributions under the cash payout assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'aia-wealth-venture',
    variantId: 'sgd-mip-8',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-wealth-venture-top-up-premium-charge',
      'branch:aia-wealth-venture-premium-holiday-charge',
      'branch:aia-wealth-venture-partial-withdrawal-charge',
    ],
    description: 'AIA Wealth Venture event-heavy scenario covering premium holiday, top-up, and partial withdrawal on the supported regular-pay corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy produces a later withdrawal and top-up activity',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'aia-wealth-venture',
    variantId: 'sgd-mip-8',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Wealth Venture alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'aia-platinum-wealth-elite-2',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:aia-platinum-wealth-elite-2-regular-premium-charge',
      'branch:aia-platinum-wealth-elite-2-full-surrender-charge',
    ],
    description: 'AIA Platinum Wealth Elite 2.0 baseline scenario proving the supported regular-pay corridor.',
    integrityChecks: [
      {
        description: 'records positive annual fees under the supported premium-charge corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'aia-platinum-wealth-elite-2',
    variantId: 'sgd-mip-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-platinum-wealth-elite-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-elite-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-elite-2-partial-withdrawal-charge',
    ],
    description: 'AIA Platinum Wealth Elite 2.0 event-heavy scenario covering premium holiday, top-up, and partial withdrawal on the supported regular-pay corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy produces a later withdrawal and top-up activity',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'aia-platinum-wealth-elite-2',
    variantId: 'sgd-mip-5',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Platinum Wealth Elite 2.0 alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'aia-platinum-wealth-legacy',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:aia-platinum-wealth-legacy-regular-premium-charge',
      'branch:aia-platinum-wealth-legacy-full-surrender-charge',
    ],
    description: 'AIA Platinum Wealth Legacy baseline scenario proving the supported regular-pay corridor.',
    integrityChecks: [
      {
        description: 'records positive annual fees under the supported premium-charge corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'aia-platinum-wealth-legacy',
    variantId: 'sgd-mip-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-platinum-wealth-legacy-top-up-premium-charge',
      'branch:aia-platinum-wealth-legacy-premium-holiday-charge',
      'branch:aia-platinum-wealth-legacy-partial-withdrawal-charge',
    ],
    description: 'AIA Platinum Wealth Legacy event-heavy scenario covering premium holiday, top-up, and partial withdrawal on the supported regular-pay corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy produces a later withdrawal and top-up activity',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'aia-platinum-wealth-legacy',
    variantId: 'sgd-mip-5',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Platinum Wealth Legacy alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'aia-pro-achiever-3',
    variantId: 'sgd-iip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:aia-pro-achiever-3-regular-premium-charge',
      'branch:aia-pro-achiever-3-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'AIA Pro Achiever 3.0 baseline scenario proving the supported regular-pay corridor and post-IIP manual cash-payout distribution assumption.',
    integrityChecks: [
      {
        description: 'manual cash-payout distribution assumption produces annual withdrawals after the IIP',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'aia-pro-achiever-3',
    variantId: 'sgd-iip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-pro-achiever-3-top-up-premium-charge',
      'branch:aia-pro-achiever-3-partial-withdrawal-charge',
    ],
    description: 'AIA Pro Achiever 3.0 event-heavy scenario covering top-up and partial withdrawal on the supported regular-pay corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records both top-up contribution and later withdrawals',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > 0),
      },
    ],
  },
  {
    productId: 'aia-pro-achiever-3',
    variantId: 'sgd-iip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Pro Achiever 3.0 alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'aia-platinum-wealth-venture-2',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:aia-platinum-wealth-venture-2-zero-regular-premium-charge',
      'branch:aia-platinum-wealth-venture-2-regular-supplementary-charge',
      'branch:aia-platinum-wealth-venture-2-full-surrender-charge',
    ],
    description: 'AIA Platinum Wealth Venture 2.0 baseline scenario proving the supported regular-pay corridor and cash-payout distribution assumption.',
    integrityChecks: [
      {
        description: 'records positive annual fees under the supported supplementary-charge corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'pays positive annual distributions under the cash payout assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'aia-platinum-wealth-venture-2',
    variantId: 'sgd-mip-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:aia-platinum-wealth-venture-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-venture-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-venture-2-partial-withdrawal-charge',
    ],
    description: 'AIA Platinum Wealth Venture 2.0 event-heavy scenario covering premium holiday, top-up, and partial withdrawal on the supported regular-pay corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy produces a later withdrawal and top-up activity',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'aia-platinum-wealth-venture-2',
    variantId: 'sgd-mip-5',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'AIA Platinum Wealth Venture 2.0 alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'sgd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'kernel:distribution-mode-assumption'],
    description: 'Baseline in-force HSBC SGD / MIP 25 scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'sgd-mip-30',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force HSBC SGD / MIP 30 scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'usd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force HSBC USD / MIP 25 scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'usd-mip-30',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force HSBC USD / MIP 30 scenario.',
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-holiday-repayment',
      'branch:hsbc-bonus-suspension',
      'branch:hsbc-premium-reduction-brc',
      'branch:hsbc-top-up-routing',
    ],
    description: 'HSBC event-heavy scenario covering repayment, suspension, BRC, and top-up routing.',
    integrityChecks: [
      {
        description: 'suppresses AUA bonus during the suspension window',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 15
          && row.accounts.some((account) => account.accountId === 'aua' && account.bonusCredit === 0)
        )),
      },
      {
        description: 'routes top-up contribution into AUA',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualContribution > artifact.policyInput.monthlyContribution * 12
          && row.accounts.some((account) => account.accountId === 'aua' && account.contributionAmount === row.annualContribution)
        )),
      },
      {
        description: 'applies BRC as a material extra IUA charge',
        test: (_, artifact) => {
          const iua = artifact.policyInput.accounts.find((account) => account.id === 'iua')
          return artifact.expected.projections.mid.rows.some((row) => {
            const account = row.accounts.find((candidate) => candidate.accountId === 'iua')
            if (!account || !iua) return false
            return account.grossFee - (account.open * iua.feeRate) > 1_000
          })
        },
      },
      {
        description: 'records the seeded partial withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.accounts.some((account) => account.accountId === 'aua' && account.withdrawalAmount >= 3_500)
        )),
      },
      {
        description: 'premium-holiday repayment restores a stronger later AUA bonus path than the same holiday without repayment',
        test: (fixture, artifact) => {
          const withoutRepayment = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.map((event) => (
              event.type === 'premium-holiday' ? { ...event, repayMissedPremiums: false, repaymentAccountId: undefined } : event
            )),
          })
          const withRepaymentBonus = artifact.expected.projections.mid.rows
            .filter((row) => row.policyYear >= 18)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'aua')?.bonusCredit ?? 0), 0)
          const withoutRepaymentBonus = analyzeIlpPolicy(withoutRepayment).projections.mid.rows
            .filter((row) => row.policyYear >= 18)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'aua')?.bonusCredit ?? 0), 0)
          return withRepaymentBonus > withoutRepaymentBonus
        },
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'sgd-mip-25',
    scenarioId: 'holiday-no-repayment',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:hsbc-holiday-no-repayment'],
    description: 'HSBC holiday edge-case without repayment.',
    integrityChecks: [
      {
        description: 'reduces annual contribution when premiums are not repaid',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution < artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'does not create negative refund charges without repayment',
        test: (_, artifact) => artifact.expected.projections.mid.rows.every((row) => (
          row.accounts.every((account) => account.grossFee >= 0)
        )),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-accelerate',
    variantId: 'usd-mip-30',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC alternate-fund stress scenario.',
  },
  {
    productId: 'hsbc-life-wealth-harvest',
    variantId: 'sgd-mip-11',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'kernel:distribution-mode-assumption'],
    description: 'HSBC Wealth Harvest baseline scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-harvest',
    variantId: 'sgd-mip-11',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-harvest-holiday-charge',
      'branch:hsbc-harvest-pwc',
      'branch:hsbc-harvest-brc',
      'branch:hsbc-harvest-topup-charge',
    ],
    description: 'HSBC Wealth Harvest supported event-heavy scenario covering holiday charges, BRC, top-up charge, and regular-account PWC.',
    integrityChecks: [
      {
        description: 'premium holiday materially increases regular-account gross fees beyond the base AMF path',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 1_200
        )),
      },
      {
        description: 'the seeded top-up credits the top-up account after its premium charge',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 1_000
        )),
      },
      {
        description: 'BRC adds a material regular-account charge after the reduction event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 1_250
        )),
      },
      {
        description: 'the regular-account partial withdrawal is recorded',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'regular')?.withdrawalAmount ?? 0) >= 500
        )),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-harvest',
    variantId: 'sgd-mip-11',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Wealth Harvest alternate-fund stress scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-abundance',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'kernel:distribution-mode-assumption'],
    description: 'HSBC Wealth Abundance SGD baseline scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-abundance',
    variantId: 'usd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Abundance USD baseline scenario without recurring single premium under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-abundance',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-abundance-free-withdrawal',
      'branch:hsbc-abundance-tiered-brc',
      'branch:hsbc-abundance-topup-charge',
      'branch:hsbc-abundance-power-up-restoration',
    ],
    description: 'HSBC Wealth Abundance supported event-heavy scenario covering free and charged withdrawals, top-up charge, premium-holiday repayment, and tiered BRC.',
    integrityChecks: [
      {
        description: 'the top-up charge reduces the top-up account contribution below the gross top-up amount',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 1_900
        )),
      },
      {
        description: 'the free first withdrawal keeps regular-account gross fees materially below the charged second withdrawal year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualWithdrawals >= 5_500
          && (() => {
            const regularGrossFee = row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0
            return regularGrossFee > 900 && regularGrossFee < 1_000
          })()
        )),
      },
      {
        description: 'tiered BRC adds a material regular-account charge after the reduction event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 8
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 800
        )),
      },
      {
        description: 'premium-holiday repayment restores a positive annual contribution after the holiday year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 8 && row.annualContribution > 28_000
        )),
      },
      {
        description: 'removing restoration rules materially weakens the later regular-account bonus path',
        test: (fixture, artifact) => {
          const withoutRestoration = ilpPolicySchema.parse({
            ...fixture.policy,
            bonuses: fixture.policy.bonuses.map((bonus) => ({
              ...bonus,
              restorationRules: [],
            })),
          })
          const withRestorationBonus = artifact.expected.projections.mid.rows
            .filter((row) => row.policyYear >= 11)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'regular')?.bonusCredit ?? 0), 0)
          const withoutRestorationBonus = analyzeIlpPolicy(withoutRestoration).projections.mid.rows
            .filter((row) => row.policyYear >= 11)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'regular')?.bonusCredit ?? 0), 0)
          return withRestorationBonus > withoutRestorationBonus
        },
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-abundance',
    variantId: 'usd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Wealth Abundance alternate-fund stress scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'hsbc-voyage-startup-bonus-tiered',
      'hsbc-voyage-premium-base-amf',
      'hsbc-voyage-eec',
      'kernel:distribution-mode-assumption',
    ],
    description: 'HSBC Wealth Voyage SGD / MIP 15 baseline scenario proving start-up bonus, premium-base AMF, surrender mechanics, and reinvest-default distribution support.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'hsbc-voyage-power-up-bonus-modeled-subset',
      'hsbc-voyage-loyalty-bonus-partial-withdrawal-subset',
      'hsbc-voyage-partial-withdrawal-charge',
    ],
    description: 'HSBC Wealth Voyage SGD / MIP 20 baseline scenario proving the modeled power-up / loyalty bonus subset and withdrawal-charge corridor.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'sgd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Voyage SGD / MIP 25 baseline scenario.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'usd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Voyage USD / MIP 15 baseline scenario.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'usd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Voyage USD / MIP 20 baseline scenario.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'usd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Wealth Voyage USD / MIP 25 baseline scenario.',
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'sgd-mip-20',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'hsbc-voyage-premium-base-amf',
      'hsbc-voyage-bonus-recovery-charge',
      'hsbc-voyage-topup-premium-charge',
      'hsbc-voyage-partial-withdrawal-charge',
    ],
    description: 'HSBC Wealth Voyage event-heavy scenario covering premium-base AMF, top-up charge, partial withdrawal charge, regular-premium reduction BRC, and a free-duration premium holiday suspension.',
    integrityChecks: [
      {
        description: 'premium-base AMF remains materially above the old account-value fee scale',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 3_000
        )),
      },
      {
        description: 'the seeded top-up reaches the top-up account after its premium charge',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 1_900
        )),
      },
      {
        description: 'tiered startup recovery adds a visible regular-account charge after the reduction event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && (row.accounts.find((account) => account.accountId === 'regular')?.grossFee ?? 0) > 3_500
        )),
      },
      {
        description: 'premium holiday suppresses annual contribution below the full committed premium year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear >= 10
          && row.annualContribution < artifact.policyInput.monthlyContribution * 12
        )),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-voyage',
    variantId: 'usd-mip-20',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Wealth Voyage USD / MIP 20 alternate-fund stress scenario under the V1 reinvestment-default assumption.',
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-1',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:wealth-focus-startup-bonus',
      'branch:wealth-focus-premium-contribution-bonus',
      'branch:wealth-focus-loyalty-bonus',
      'branch:wealth-focus-premium-base-amf',
      'branch:wealth-focus-partial-withdrawal-charge',
      'branch:wealth-focus-eec',
      'kernel:distribution-mode-assumption',
    ],
    description: 'HSBC Wealth Focus Flexi 1 SGD baseline scenario proving supported bonus, AMF, and surrender-charge mechanics through the two-account corridor.',
    integrityChecks: [
      {
        description: 'baseline Flexi 1 corridor incurs positive gross fees from the premium-base AMF',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
      {
        description: 'baseline Flexi 1 corridor records positive annual withdrawals from the manual distribution assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-1',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:wealth-focus-top-up-premium-charge',
      'branch:wealth-focus-partial-withdrawal-charge',
      'branch:wealth-focus-ad-hoc-top-up-routing',
    ],
    description: 'HSBC Wealth Focus Flexi 1 SGD event-heavy scenario proving charged top-up routing and in-MIP regular-account withdrawals.',
    integrityChecks: [
      {
        description: 'event-heavy Flexi 1 corridor credits the charged top-up into the top-up account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 2_900
        )),
      },
      {
        description: 'event-heavy Flexi 1 corridor executes the seeded regular-account withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-1',
    variantId: 'usd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Wealth Focus Flexi 1 USD alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-3',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:wealth-focus-startup-bonus',
      'branch:wealth-focus-premium-contribution-bonus',
      'branch:wealth-focus-loyalty-bonus',
      'branch:wealth-focus-premium-base-amf',
      'branch:wealth-focus-eec',
      'kernel:distribution-mode-assumption',
    ],
    description: 'HSBC Wealth Focus Flexi 3 SGD baseline scenario proving supported bonus, AMF, surrender-charge, and cash-payout distribution handling.',
    integrityChecks: [
      {
        description: 'baseline Flexi 3 cash-payout corridor records positive annual withdrawals from the manual distribution assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-3',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:wealth-focus-top-up-premium-charge',
      'branch:wealth-focus-partial-withdrawal-charge',
      'branch:wealth-focus-ad-hoc-top-up-routing',
      'branch:wealth-focus-premium-holiday-charge',
    ],
    description: 'HSBC Wealth Focus Flexi 3 SGD event-heavy scenario proving premium holiday, charged top-up routing, and in-MIP regular-account withdrawals.',
    integrityChecks: [
      {
        description: 'event-heavy Flexi 3 corridor credits the charged top-up into the top-up account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 2_900
        )),
      },
      {
        description: 'event-heavy Flexi 3 corridor executes the seeded regular-account withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-3',
    variantId: 'usd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Wealth Focus Flexi 3 USD alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-5',
    variantId: 'usd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:wealth-focus-startup-bonus',
      'branch:wealth-focus-premium-contribution-bonus',
      'branch:wealth-focus-loyalty-bonus',
      'branch:wealth-focus-premium-base-amf',
      'branch:wealth-focus-eec',
      'kernel:distribution-mode-assumption',
    ],
    description: 'HSBC Wealth Focus Flexi 5 USD baseline scenario proving the supported second-currency corridor and cash-payout distribution handling.',
    integrityChecks: [
      {
        description: 'baseline Flexi 5 USD corridor incurs positive gross fees from the premium-base AMF',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
      {
        description: 'baseline Flexi 5 USD corridor records positive annual withdrawals from the manual distribution assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-5',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:wealth-focus-top-up-premium-charge',
      'branch:wealth-focus-partial-withdrawal-charge',
      'branch:wealth-focus-ad-hoc-top-up-routing',
      'branch:wealth-focus-premium-holiday-charge',
    ],
    description: 'HSBC Wealth Focus Flexi 5 SGD event-heavy scenario proving premium holiday, charged top-up routing, and in-MIP regular-account withdrawals.',
    integrityChecks: [
      {
        description: 'event-heavy Flexi 5 corridor credits the charged top-up into the top-up account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0) > 2_900
        )),
      },
      {
        description: 'event-heavy Flexi 5 corridor executes the seeded regular-account withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-focus-flexi-5',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Wealth Focus Flexi 5 SGD alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 5 scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 10 scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 15 scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'kernel:distribution-mode-assumption'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 20 scenario with eligible Growth Account cash-payout distributions.',
    integrityChecks: [
      {
        description: 'pays positive annual distributions once the 10-year Growth Account election is eligible',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline in-force PRUVantage Wealth II SGD / MIP 25 scenario.',
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:pru-holiday-refund',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
    ],
    description: 'PRUVantage Wealth II event-heavy scenario covering refund, top-up charge, and withdrawal branches.',
    integrityChecks: [
      {
        description: 'creates a negative holiday-charge refund in Growth or Flex',
        test: (fixture, artifact) => {
          const withoutRefund = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.filter((rule) => rule.id !== 'premium-holiday-charge-refund'),
          })
          const withRefundFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutRefundFees = analyzeIlpPolicy(withoutRefund).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withRefundFees < withoutRefundFees
        },
      },
      {
        description: 'records top-up premium in the projection year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualContribution > artifact.policyInput.monthlyContribution * 12
        )),
      },
      {
        description: 'keeps the free withdrawal materially cheaper than the charged withdrawal',
        test: (_, artifact) => {
          const rows = artifact.expected.projections.mid.rows
          const freeRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'growth' && account.withdrawalAmount > 0))
          const chargedRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'flex' && account.withdrawalAmount > 0))
          const freeGrossFee = freeRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const chargedGrossFee = chargedRow?.accounts.find((account) => account.accountId === 'flex')?.grossFee ?? 0
          return chargedGrossFee > freeGrossFee
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'holiday-fallback',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:pru-holiday-fallback'],
    description: 'PRUVantage Wealth II holiday fallback scenario forcing charges into Additional Investment Account.',
    integrityChecks: [
      {
        description: 'routes holiday charge fallback into Additional Investment Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.accounts.some((account) => account.accountId === 'additional' && account.grossFee > 0)
        )),
      },
      {
        description: 'suppresses annual contribution during the unrepaid holiday year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution < artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-wealth-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress-split',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRUVantage Wealth II alternate-fund high-OCF stress scenario with non-default premium split.',
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge'],
    description: 'Baseline in-force PRUVantage Prosper SGD / MIP 5 scenario.',
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge'],
    description: 'Baseline in-force PRUVantage Prosper SGD / MIP 10 scenario.',
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge'],
    description: 'Baseline in-force PRUVantage Prosper SGD / MIP 15 scenario.',
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge', 'kernel:distribution-mode-assumption'],
    description: 'Baseline in-force PRUVantage Prosper SGD / MIP 20 scenario with eligible Growth Account cash-payout distributions.',
    integrityChecks: [
      {
        description: 'pays positive annual distributions once the 10-year Growth Account election is eligible',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-25',
    scenarioId: 'assurance-active',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:prosper-assurance-charge'],
    description: 'PRUVantage Prosper baseline scenario with assurance charges active from explicit insured-life inputs.',
    integrityChecks: [
      {
        description: 'applies non-zero Prosper assurance charges to Growth and Flex',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const growthFee = firstRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const flexFee = firstRow?.accounts.find((account) => account.accountId === 'flex')?.grossFee ?? 0
          return growthFee > 0 && flexFee > 0
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:pru-holiday-refund',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
    ],
    description: 'PRUVantage Prosper event-heavy scenario covering refund, top-up charge, and withdrawal branches.',
    integrityChecks: [
      {
        description: 'creates a negative holiday-charge refund in Growth or Flex',
        test: (fixture, artifact) => {
          const withoutRefund = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.filter((rule) => rule.id !== 'premium-holiday-charge-refund'),
          })
          const withRefundFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutRefundFees = analyzeIlpPolicy(withoutRefund).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withRefundFees < withoutRefundFees
        },
      },
      {
        description: 'records top-up premium in the projection year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualContribution > artifact.policyInput.monthlyContribution * 12
        )),
      },
      {
        description: 'keeps the free withdrawal materially cheaper than the charged withdrawal',
        test: (_, artifact) => {
          const rows = artifact.expected.projections.mid.rows
          const freeRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'growth' && account.withdrawalAmount > 0))
          const chargedRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'flex' && account.withdrawalAmount > 0))
          const freeGrossFee = freeRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const chargedGrossFee = chargedRow?.accounts.find((account) => account.accountId === 'flex')?.grossFee ?? 0
          return chargedGrossFee > freeGrossFee
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-25',
    scenarioId: 'holiday-fallback',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:pru-holiday-fallback'],
    description: 'PRUVantage Prosper holiday fallback scenario forcing charges into Additional Investment Account.',
    integrityChecks: [
      {
        description: 'routes holiday charge fallback into Additional Investment Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.accounts.some((account) => account.accountId === 'additional' && account.grossFee > 0)
        )),
      },
      {
        description: 'suppresses annual contribution during the unrepaid holiday year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution < artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-prosper',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress-split',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRUVantage Prosper alternate-fund high-OCF stress scenario with non-default premium split.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance'],
    description: 'Baseline in-force PRUVantage Assure II SGD / MIP 5 scenario.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance'],
    description: 'Baseline in-force PRUVantage Assure II SGD / MIP 10 scenario.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance'],
    description: 'Baseline in-force PRUVantage Assure II SGD / MIP 15 scenario.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance', 'kernel:distribution-mode-assumption'],
    description: 'Baseline in-force PRUVantage Assure II SGD / MIP 20 scenario with eligible Growth Account cash-payout distributions.',
    integrityChecks: [
      {
        description: 'pays positive annual distributions once the 10-year Growth Account election is eligible',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'assurance-tail',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:assure-ii-pre-70-assurance', 'branch:assure-ii-post-70-charge-tail'],
    description: 'PRUVantage Assure II baseline scenario proving pre-70 assurance and the post-70 charge tail.',
    integrityChecks: [
      {
        description: 'applies non-zero Assure II combined assurance before age 70',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const growthFee = firstRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          return growthFee > 0
        },
      },
      {
        description: 'continues non-zero Assure II assurance charges after age 70 from the published rate curve',
        test: (_, artifact) => {
          const laterRow = artifact.expected.projections.mid.rows.find((row) => row.policyYear >= 26)
          const growthFee = laterRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          return growthFee > 0
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:pru-holiday-refund',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
    ],
    description: 'PRUVantage Assure II event-heavy scenario covering refund, top-up charge, and withdrawal branches.',
    integrityChecks: [
      {
        description: 'creates a negative holiday-charge refund in Growth or Flex',
        test: (fixture, artifact) => {
          const withoutRefund = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.filter((rule) => rule.id !== 'premium-holiday-charge-refund'),
          })
          const withRefundFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutRefundFees = analyzeIlpPolicy(withoutRefund).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withRefundFees < withoutRefundFees
        },
      },
      {
        description: 'records top-up premium in the projection year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualContribution > artifact.policyInput.monthlyContribution * 12
        )),
      },
      {
        description: 'keeps the free withdrawal materially cheaper than the charged withdrawal',
        test: (_, artifact) => {
          const rows = artifact.expected.projections.mid.rows
          const freeRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'growth' && account.withdrawalAmount > 0))
          const chargedRow = rows.find((row) => row.accounts.some((account) => account.accountId === 'flex' && account.withdrawalAmount > 0))
          const freeGrossFee = freeRow?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const chargedGrossFee = chargedRow?.accounts.find((account) => account.accountId === 'flex')?.grossFee ?? 0
          return chargedGrossFee > freeGrossFee
        },
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'holiday-fallback',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:pru-holiday-fallback'],
    description: 'PRUVantage Assure II holiday fallback scenario forcing charges into Additional Investment Account.',
    integrityChecks: [
      {
        description: 'routes holiday charge fallback into Additional Investment Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.accounts.some((account) => account.accountId === 'additional' && account.grossFee > 0)
        )),
      },
      {
        description: 'suppresses annual contribution during the unrepaid holiday year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution < artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress-split',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRUVantage Assure II alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'prudential-pruvantage-assure-ii',
    variantId: 'sgd-mip-25',
    scenarioId: 'assurance-state-override',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:assure-ii-manual-reduction-resumption'],
    description: 'PRUVantage Assure II scenario proving manual reduction and later resumption of the assurance state.',
    integrityChecks: [
      {
        description: 'reduced assurance state lowers the charge after the reduction year',
        test: (_, artifact) => {
          const reductionYear = artifact.expected.projections.mid.rows.find((row) => row.policyYear === 25)
          const frozenYear = artifact.expected.projections.mid.rows.find((row) => row.policyYear === 26)
          const reducedGrowthFee = reductionYear?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const frozenGrowthFee = frozenYear?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          return reducedGrowthFee > frozenGrowthFee && frozenGrowthFee > 0
        },
      },
      {
        description: 'resumption restores a higher charge path from the next policy year',
        test: (_, artifact) => {
          const frozenYear = artifact.expected.projections.mid.rows.find((row) => row.policyYear === 26)
          const resumedYear = artifact.expected.projections.mid.rows.find((row) => row.policyYear === 27)
          const frozenGrowthFee = frozenYear?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          const resumedGrowthFee = resumedYear?.accounts.find((account) => account.accountId === 'growth')?.grossFee ?? 0
          return resumedGrowthFee > frozenGrowthFee
        },
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:prulink-investgrowth-sp-single-premium-charge',
      'branch:prulink-investgrowth-sp-premium-assurance-charge',
    ],
    description: 'Baseline PRULink InvestGrowth (SP) cash scenario proving the initial single-premium charge and Direct Income cash-payout support.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'pays positive annual distributions under the cash Direct Income assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:prulink-investgrowth-sp-single-premium-charge',
      'branch:prulink-investgrowth-sp-premium-assurance-charge',
    ],
    description: 'Baseline PRULink InvestGrowth (SP) SRS scenario proving the supported initial single-premium corridor without Direct Income payouts.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline PRULink InvestGrowth (SP) CPF scenario proving the supported zero-charge corridor.',
    integrityChecks: [
      {
        description: 'keeps the initial single-premium corridor fee-free under the published CPF charge path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:prulink-investgrowth-sp-top-up-charge',
      'branch:prulink-investgrowth-sp-top-up-assurance-charge',
    ],
    description: 'PRULink InvestGrowth (SP) cash event-heavy scenario proving standard top-up premium and assurance charges.',
    integrityChecks: [
      {
        description: 'records positive annual contribution from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'top-up event increases cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth-sp',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRULink InvestGrowth (SP) cash alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'etiqa-invest-plus-sp',
    variantId: 'sgd-open-ended-single-premium-initial-only',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:etiqa-invest-plus-sp-zero-single-premium-charge',
      'branch:etiqa-invest-plus-sp-policy-charge',
      'branch:etiqa-invest-plus-sp-initial-surrender-charge',
    ],
    description: 'Etiqa Invest plus SP baseline scenario covering the supported initial single-premium corridor with policy-charge, surrender-charge, and cash-payout distribution assumptions.',
  },
  {
    productId: 'etiqa-invest-plus-sp',
    variantId: 'sgd-open-ended-single-premium-initial-only',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-invest-plus-sp-top-up-premium-charge',
      'branch:etiqa-invest-plus-sp-initial-partial-withdrawal-charge',
    ],
    description: 'Etiqa Invest plus SP event-heavy scenario covering an initial-account withdrawal followed by a charged top-up on the supported corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records both a later top-up and an executed withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0 && row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'etiqa-invest-plus-sp',
    variantId: 'sgd-open-ended-single-premium-initial-only',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest plus SP alternate-fund high-OCF stress scenario through the supported initial corridor.',
  },
  {
    productId: 'etiqa-dash-pet-plus',
    variantId: 'sgd-open-ended-rider',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:etiqa-dash-pet-plus-zero-single-premium-charge',
      'branch:etiqa-dash-pet-plus-management-charge',
    ],
    description: 'Etiqa Dash PET Plus baseline scenario covering the supported zero-charge rider corridor, management charge, and cash-payout distribution assumption.',
    integrityChecks: [
      {
        description: 'records positive cumulative fees under the management-charge corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (row.cumulativeGrossFees ?? 0) > 0),
      },
      {
        description: 'pays positive annual distributions under the cash payout assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'etiqa-dash-pet-plus',
    variantId: 'sgd-open-ended-rider',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-dash-pet-plus-zero-top-up-charge',
      'branch:etiqa-dash-pet-plus-zero-partial-withdrawal-charge',
    ],
    description: 'Etiqa Dash PET Plus event-heavy scenario covering a rider-account withdrawal followed by a zero-charge top-up.',
    integrityChecks: [
      {
        description: 'event-heavy policy records both a later top-up and an executed withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0 && row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'etiqa-dash-pet-plus',
    variantId: 'sgd-open-ended-rider',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Dash PET Plus alternate-fund high-OCF stress scenario through the supported open-ended rider corridor.',
  },
  {
    productId: 'manulife-manulink-investor-ii',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:manulink-investor-ii-single-premium-charge',
    ],
    description: 'Baseline Manulink Investor (II) cash scenario proving the supported initial single-premium corridor and cash-payout distribution assumption.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'pays positive annual distributions under the cash payout assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'manulife-manulink-investor-ii',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:manulink-investor-ii-single-premium-charge'],
    description: 'Baseline Manulink Investor (II) SRS scenario proving the supported initial single-premium corridor without payout elections.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'manulife-manulink-investor-ii',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: ['event-heavy', 'branch:manulink-investor-ii-top-up-premium-charge'],
    description: 'Manulink Investor (II) cash event-heavy scenario proving charged top-up routing.',
    integrityChecks: [
      {
        description: 'records positive annual contribution from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'top-up event increases cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventChargeFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventChargeFees > withoutEventChargeFees
        },
      },
    ],
  },
  {
    productId: 'manulife-manulink-investor-ii',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:manulink-investor-ii-top-up-premium-charge',
      'branch:manulink-investor-ii-srs-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'Manulink Investor (II) SRS event-heavy scenario proving charged top-up and recurring single-premium routing.',
    integrityChecks: [
      {
        description: 'records positive annual contribution from the seeded SRS recurring-single-premium events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'recurring single-premium events increase cumulative fees beyond the top-up-only baseline',
        test: (fixture, artifact) => {
          const withoutRecurring = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.filter((event) => event.type !== 'recurring-single-premium') ?? [],
          })
          const withRecurringFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutRecurringFees = analyzeIlpPolicy(withoutRecurring).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withRecurringFees > withoutRecurringFees
        },
      },
    ],
  },
  {
    productId: 'manulife-manulink-investor-ii',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Manulink Investor (II) cash alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'hsbc-life-wealth-invest-cash-srs',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:hsbc-life-wealth-invest-cash-srs-max-single-premium-charge',
    ],
    description: 'HSBC Life Wealth Invest (Cash) baseline scenario proving supported manual-input single-premium charging and cash-payout distribution support.',
    integrityChecks: [
      {
        description: 'records a positive inception single-premium charge under the supported cash corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'pays positive annual distributions under the cash payout assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-invest-cash-srs',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-life-wealth-invest-cash-srs-max-top-up-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-max-recurring-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-zero-redemption-fee',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'HSBC Life Wealth Invest (Cash) event-heavy scenario proving manual-input top-up and recurring-single-premium charges plus nil-redemption-fee withdrawals.',
    integrityChecks: [
      {
        description: 'records positive annual contribution from seeded top-up and recurring-single-premium events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'event-heavy corridor executes a later withdrawal through the nil-redemption-fee path',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-invest-cash-srs',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Life Wealth Invest (SRS) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'hsbc-life-goal-builder-ii',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Goal Builder II SGD / MIP 5 baseline scenario under supported payout and distribution assumptions.',
  },
  {
    productId: 'hsbc-life-goal-builder-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:distribution-mode-assumption',
      'branch:goal-builder-ii-welcome-bonus',
      'branch:goal-builder-ii-premium-year-paf',
      'branch:goal-builder-ii-loyalty-bonus-cadence',
    ],
    description: 'HSBC Goal Builder II baseline scenario covering welcome bonus, premium-year PAF and loyalty mechanics, plus manual scheduled-redemption and cash-payout distribution assumptions.',
    integrityChecks: [
      {
        description: 'baseline policy incurs positive fees under the premium-year PAF corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'baseline policy produces annual withdrawals under the scheduled-redemption or cash-payout distribution assumptions',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-goal-builder-ii',
    variantId: 'usd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Goal Builder II USD / MIP 5 baseline scenario under supported payout and distribution assumptions.',
  },
  {
    productId: 'hsbc-life-goal-builder-ii',
    variantId: 'usd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Goal Builder II USD / MIP 10 baseline scenario under supported payout and distribution assumptions.',
  },
  {
    productId: 'hsbc-life-goal-builder-ii',
    variantId: 'usd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Goal Builder II USD / MIP 15 baseline scenario under supported payout and distribution assumptions.',
  },
  {
    productId: 'hsbc-life-goal-builder-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:goal-builder-ii-welcome-bonus-recovery',
      'branch:goal-builder-ii-top-up-premium-charge',
      'branch:goal-builder-ii-premium-year-surrender-charge',
    ],
    description: 'HSBC Goal Builder II event-heavy scenario covering premium reduction, top-up charging, premium holiday, and partial withdrawal during the surrender-penalty corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records annual contribution in excess of the scheduled premium from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'event-heavy policy records a partial withdrawal in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'hsbc-life-goal-builder-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress', 'branch:goal-builder-ii-recurrent-single-premium-charge'],
    description: 'HSBC Goal Builder II alternate-fund high-OCF stress scenario. Post-MIP recurrent-single-premium charging remains structurally covered by parser/test support because V1 golden seeds do not admit mature-policy states.',
  },
  {
    productId: 'manulife-smartretire-v-sum',
    variantId: 'sgd-mip-8-flexi-3',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife SmartRetire (V) - Sum 8 Years Flexi 3 baseline scenario under supported distribution assumptions.',
  },
  {
    productId: 'manulife-smartretire-v-sum',
    variantId: 'sgd-mip-8-flexi-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:manulife-smartretire-v-administrative-charge',
      'branch:manulife-smartretire-v-withdrawal-and-surrender-charge',
    ],
    description: 'Manulife SmartRetire (V) - Sum 8 Years Flexi 5 baseline scenario covering administrative charges, withdrawal / surrender charges, and supported cash-payout distribution assumptions.',
    integrityChecks: [
      {
        description: 'baseline policy incurs positive cumulative fees under the administrative-charge corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'baseline policy produces annual withdrawals under the cash-payout distribution assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'manulife-smartretire-v-sum',
    variantId: 'sgd-mip-12-flexi-8',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife SmartRetire (V) - Sum 12 Years Flexi 8 baseline scenario under supported distribution assumptions.',
  },
  {
    productId: 'manulife-smartretire-v-sum',
    variantId: 'sgd-mip-8-flexi-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:manulife-smartretire-v-zero-top-up-charge',
      'branch:manulife-smartretire-v-premium-shortfall-charge',
      'branch:manulife-smartretire-v-withdrawal-and-surrender-charge',
    ],
    description: 'Manulife SmartRetire (V) - Sum event-heavy scenario covering premium holiday, zero-charge top-up, and partial withdrawal during the MIP charge corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records annual contribution above scheduled premium from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'event-heavy policy records annual withdrawals in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'manulife-smartretire-v-sum',
    variantId: 'sgd-mip-12-flexi-8',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Manulife SmartRetire (V) - Sum alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'manulife-smartretire-v-income',
    variantId: 'sgd-mip-8-flexi-3',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife SmartRetire (V) - Income 8 Years Flexi 3 baseline scenario under supported payout and distribution assumptions.',
  },
  {
    productId: 'manulife-smartretire-v-income',
    variantId: 'sgd-mip-8-flexi-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:distribution-mode-assumption',
      'branch:manulife-smartretire-v-administrative-charge',
      'branch:manulife-smartretire-v-withdrawal-and-surrender-charge',
    ],
    description: 'Manulife SmartRetire (V) - Income 8 Years Flexi 5 baseline scenario covering administrative charges, withdrawal / surrender charges, and supported scheduled-redemption plus cash-payout distribution assumptions.',
    integrityChecks: [
      {
        description: 'baseline policy incurs positive cumulative fees under the administrative-charge corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
      {
        description: 'baseline policy produces annual withdrawals under the scheduled-redemption or cash-payout assumptions',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'manulife-smartretire-v-income',
    variantId: 'sgd-mip-12-flexi-8',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife SmartRetire (V) - Income 12 Years Flexi 8 baseline scenario under supported payout and distribution assumptions.',
  },
  {
    productId: 'manulife-smartretire-v-income',
    variantId: 'sgd-mip-8-flexi-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:manulife-smartretire-v-zero-top-up-charge',
      'branch:manulife-smartretire-v-premium-shortfall-charge',
      'branch:manulife-smartretire-v-withdrawal-and-surrender-charge',
    ],
    description: 'Manulife SmartRetire (V) - Income event-heavy scenario covering premium holiday, zero-charge top-up, partial withdrawal, and supported scheduled-redemption.',
    integrityChecks: [
      {
        description: 'event-heavy policy records annual contribution above scheduled premium from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'event-heavy policy records annual withdrawals in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'manulife-smartretire-v-income',
    variantId: 'sgd-mip-12-flexi-8',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Manulife SmartRetire (V) - Income alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'manulife-investready-iii',
    variantId: 'sgd-mip-5-flexi-4',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:protected-base-assurance',
      'kernel:distribution-mode-assumption',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-full-surrender-charge',
    ],
    description: 'Manulife InvestReady (III) baseline scenario covering the supported administration-charge, full-surrender-charge, protected-base assurance, and cash-payout distribution corridors.',
    integrityChecks: [
      {
        description: 'baseline policy incurs positive cumulative fees under the administration-charge corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
      {
        description: 'baseline policy produces annual withdrawals under the manual cash-payout distribution assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'baseline policy exposes a positive surrender-charge rate during the MIP corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.eecRate > 0),
      },
    ],
  },
  {
    productId: 'manulife-investready-iii',
    variantId: 'sgd-mip-5-flexi-4',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:manulife-investready-iii-premium-shortfall-charge',
      'branch:manulife-investready-iii-zero-top-up-charge',
      'branch:manulife-investready-iii-partial-withdrawal-charge',
    ],
    description: 'Manulife InvestReady (III) event-heavy scenario covering premium holiday, zero-charge top-up, and in-MIP partial withdrawal on the supported corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records both top-up contribution and later withdrawals',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0 && row.annualWithdrawals > 0),
      },
      {
        description: 'premium holiday increases cumulative fees beyond the same policy without the holiday event',
        test: (fixture, artifact) => {
          const withoutHoliday = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.filter((event) => event.type !== 'premium-holiday'),
          })
          const withHolidayFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutHolidayFees = analyzeIlpPolicy(withoutHoliday).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withHolidayFees > withoutHolidayFees
        },
      },
    ],
  },
  {
    productId: 'manulife-investready-iii',
    variantId: 'sgd-mip-5-flexi-4',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Manulife InvestReady (III) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'manulife-investready-iii-sep-2025',
    variantId: 'sgd-mip-5-flexi-4-sep-2025',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:protected-base-assurance',
      'kernel:distribution-mode-assumption',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-full-surrender-charge',
    ],
    description: 'Manulife InvestReady (III) Sep-2025 baseline scenario covering the supported administration-charge, full-surrender-charge, protected-base assurance, and post-MIP cash-payout distribution corridors.',
    integrityChecks: [
      {
        description: 'baseline policy incurs positive cumulative fees under the administration-charge corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
      {
        description: 'baseline policy exposes a positive surrender-charge rate during the MIP corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.eecRate > 0),
      },
    ],
  },
  {
    productId: 'manulife-investready-iii-sep-2025',
    variantId: 'sgd-mip-5-flexi-4-sep-2025',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:manulife-investready-iii-premium-shortfall-charge',
      'branch:manulife-investready-iii-zero-top-up-charge',
      'branch:manulife-investready-iii-partial-withdrawal-charge',
    ],
    description: 'Manulife InvestReady (III) Sep-2025 event-heavy scenario covering premium holiday, zero-charge top-up, and in-MIP partial withdrawal on the supported corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records both top-up contribution and later withdrawals',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0 && row.annualWithdrawals > 0),
      },
      {
        description: 'premium holiday increases cumulative fees beyond the same policy without the holiday event',
        test: (fixture, artifact) => {
          const withoutHoliday = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.filter((event) => event.type !== 'premium-holiday'),
          })
          const withHolidayFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutHolidayFees = analyzeIlpPolicy(withoutHoliday).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withHolidayFees > withoutHolidayFees
        },
      },
    ],
  },
  {
    productId: 'manulife-investready-iii-sep-2025',
    variantId: 'sgd-mip-5-flexi-4-sep-2025',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Manulife InvestReady (III) Sep-2025 alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'manulife-investready-iii-sep-2025',
    variantId: 'sgd-mip-7-flexi-5-sep-2025',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife InvestReady (III) Sep-2025 7 Years Flexi 5 baseline scenario under supported post-MIP distribution assumptions.',
  },
  {
    productId: 'manulife-investready-iii-sep-2025',
    variantId: 'sgd-mip-10-flexi-3-sep-2025',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife InvestReady (III) Sep-2025 10 Years Flexi 3 baseline scenario under supported post-MIP distribution assumptions.',
  },
  {
    productId: 'manulife-investready-iii-sep-2025',
    variantId: 'sgd-mip-10-flexi-5-sep-2025',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife InvestReady (III) Sep-2025 10 Years Flexi 5 baseline scenario under supported post-MIP distribution assumptions.',
  },
  {
    productId: 'manulife-investready-iii-sep-2025',
    variantId: 'sgd-mip-10-flexi-8-sep-2025',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife InvestReady (III) Sep-2025 10 Years Flexi 8 baseline scenario under supported post-MIP distribution assumptions.',
  },
  {
    productId: 'manulife-investready-iii-sep-2025',
    variantId: 'sgd-mip-13-flexi-10-sep-2025',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Manulife InvestReady (III) Sep-2025 13 Years Flexi 10 baseline scenario under supported post-MIP distribution assumptions.',
  },
  {
    productId: 'singlife-legacy-invest',
    variantId: 'sgd-mip-10-term-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:distribution-mode-assumption',
      'branch:singlife-legacy-invest-welcome-bonus',
      'branch:singlife-legacy-invest-loyalty-bonus',
      'branch:singlife-legacy-invest-administrative-charge',
    ],
    description: 'Singlife Legacy Invest baseline scenario covering the supported SGD / regular-pay-10-years / policy-term-15-years corridor with scheduled-redemption and cash-payout distribution assumptions.',
    integrityChecks: [
      {
        description: 'baseline policy produces annual withdrawals under the scheduled-redemption assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'singlife-legacy-invest',
    variantId: 'sgd-mip-10-term-15',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:singlife-legacy-invest-top-up-charge',
      'branch:singlife-legacy-invest-partial-withdrawal-charge',
      'branch:singlife-legacy-invest-surrender-charge',
      'branch:singlife-legacy-invest-premium-shortfall-charge',
    ],
    description: 'Singlife Legacy Invest event-heavy scenario covering premium holiday, charged top-up, charged withdrawal, and the same supported payout corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records annual contribution above scheduled premium from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'event-heavy policy records annual withdrawals in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'singlife-legacy-invest',
    variantId: 'sgd-mip-10-term-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Singlife Legacy Invest alternate-fund high-OCF stress scenario through the supported SGD corridor.',
  },
  {
    productId: 'singlife-savvy-invest-ii',
    variantId: 'sgd-mip-10-fixed',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:singlife-savvy-invest-ii-welcome-bonus',
      'branch:singlife-savvy-invest-ii-regular-premium-allocation-uplift',
      'branch:singlife-savvy-invest-ii-loyalty-bonus',
      'branch:singlife-savvy-invest-ii-administrative-charge',
      'branch:singlife-savvy-invest-ii-supplementary-charge',
    ],
    description: 'Singlife Savvy Invest II baseline scenario covering the supported SGD / 10 years (Fixed) corridor with allocation uplifts, loyalty windows, and cash-payout distribution assumption support.',
    integrityChecks: [
      {
        description: 'baseline policy incurs positive cumulative fees under the administrative and supplementary charge corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'singlife-savvy-invest-ii',
    variantId: 'sgd-mip-10-fixed',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:singlife-savvy-invest-ii-zero-top-up-charge',
      'branch:singlife-savvy-invest-ii-partial-withdrawal-charge',
      'branch:singlife-savvy-invest-ii-surrender-charge',
      'branch:singlife-savvy-invest-ii-premium-shortfall-charge',
    ],
    description: 'Singlife Savvy Invest II event-heavy scenario covering premium holiday, nil-charge top-up, charged withdrawal, and the same supported distribution corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records annual contribution above scheduled premium from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'event-heavy policy records annual withdrawals in projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'singlife-savvy-invest-ii',
    variantId: 'sgd-mip-10-fixed',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Singlife Savvy Invest II alternate-fund high-OCF stress scenario through the supported fixed-10 corridor.',
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:prulink-investgrowth-recurring-premium-charge',
      'branch:prulink-investgrowth-premium-assurance-charge',
    ],
    description: 'Baseline PRULink InvestGrowth cash scenario proving the supported recurring-premium corridor.',
    integrityChecks: [
      {
        description: 'records positive recurring-premium fees during the projection horizon',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:prulink-investgrowth-recurring-premium-charge',
      'branch:prulink-investgrowth-premium-assurance-charge',
    ],
    description: 'Baseline PRULink InvestGrowth SRS scenario proving the supported recurring-premium corridor.',
    integrityChecks: [
      {
        description: 'records positive recurring-premium fees during the projection horizon',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline PRULink InvestGrowth CPF scenario proving the supported zero-charge corridor.',
    integrityChecks: [
      {
        description: 'keeps the recurring-premium corridor fee-free under the published CPF charge path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:prulink-investgrowth-top-up-charge',
      'branch:prulink-investgrowth-top-up-assurance-charge',
    ],
    description: 'PRULink InvestGrowth cash event-heavy scenario proving standard top-up premium and assurance charges.',
    integrityChecks: [
      {
        description: 'records positive annual contribution from the seeded top-up event',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
      {
        description: 'top-up event increases cumulative fees beyond the recurring-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
    ],
  },
  {
    productId: 'prudential-prulink-investgrowth',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'PRULink InvestGrowth cash alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'income-snack-investment',
    variantId: 'sgd-open-ended',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:income-snack-investment-zero-single-premium-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Baseline SNACK-Investment scenario proving zero-charge initial single-premium seeding through the supported open-ended corridor.',
    integrityChecks: [
      {
        description: 'keeps policy-level gross fees at zero under the published nil-charge single-premium path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
      {
        description: 'reinvest-only distribution support does not create payout withdrawals in the baseline seed',
        test: (_, artifact) => artifact.expected.projections.mid.rows.every((row) => row.annualWithdrawals === 0),
      },
    ],
  },
  {
    productId: 'income-snack-investment',
    variantId: 'sgd-open-ended',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:income-snack-investment-zero-top-up-charge',
      'branch:income-snack-investment-zero-withdrawal-charge',
    ],
    description: 'SNACK-Investment supported event-heavy scenario covering zero-charge top-up routing and nil-charge withdrawals.',
    integrityChecks: [
      {
        description: 'zero-charge top-up credits the full gross top-up amount to the policy account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'policy')?.contributionAmount ?? 0) >= 10_000
        )),
      },
      {
        description: 'nil-charge withdrawals leave the policy-account gross fee at zero in the withdrawal year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualWithdrawals >= 4_000
          && (row.accounts.find((account) => account.accountId === 'policy')?.grossFee ?? 0) === 0
        )),
      },
    ],
  },
  {
    productId: 'income-snack-investment',
    variantId: 'sgd-open-ended',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'SNACK-Investment alternate-fund stress scenario through the supported open-ended corridor.',
  },
  {
    productId: 'income-wealthlink-gl3',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:income-wealthlink-gl3-single-premium-charge',
    ],
    description: 'Baseline WealthLink (GL3) scenario proving the supported upfront single-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'income-wealthlink-gl3',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:income-wealthlink-gl3-top-up-premium-charge',
      'branch:income-wealthlink-gl3-recurring-single-premium-charge',
      'branch:income-wealthlink-gl3-open-ended-zero-surrender-charge',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'WealthLink (GL3) event-heavy scenario proving top-up, recurring single-premium, and zero-charge withdrawal behavior.',
    integrityChecks: [
      {
        description: 'top-up and recurring single-premium events increase cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'income-wealthlink-gl3',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'WealthLink (GL3) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'income-invest-flex',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:protected-base-assurance',
      'branch:income-vs1-policy-fee',
      'branch:income-vs1-death-ti-insurance-cover-charge',
    ],
    description: 'Invest Flex baseline scenario for the SGD / MIP 5 corridor.',
  },
  {
    productId: 'income-invest-flex',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:income-vs1-regular-premium-allocation-uplift',
      'branch:income-vs1-investment-bonus',
    ],
    description: 'Invest Flex baseline scenario for the SGD / MIP 10 corridor.',
  },
  {
    productId: 'income-invest-flex',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:income-vs1-loyalty-bonus',
      'branch:income-vs1-surrender-charge',
    ],
    description: 'Invest Flex baseline scenario for the SGD / MIP 15 corridor.',
  },
  {
    productId: 'income-invest-flex',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'kernel:distribution-mode-assumption'],
    description: 'Invest Flex baseline scenario for the SGD / MIP 20 corridor with the manual cash-payout distribution assumption.',
    integrityChecks: [
      {
        description: 'cash-payout distribution assumption produces non-zero annual distributions after the 5th policy anniversary',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'income-invest-flex',
    variantId: 'sgd-mip-20',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:income-vs1-premium-holiday-charge',
      'branch:income-vs1-partial-withdrawal-charge',
      'branch:income-vs1-ad-hoc-top-up-routing',
    ],
    description: 'Invest Flex event-heavy scenario covering premium holiday, top-up, and mixed partial-withdrawal treatment.',
    integrityChecks: [
      {
        description: 'seeded partial withdrawals are present in the projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'income-invest-flex',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Invest Flex alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'income-invest-flex-vantage',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:protected-base-assurance',
      'branch:income-vs2-policy-fee',
      'branch:income-vs2-death-ti-insurance-cover-charge',
    ],
    description: 'Invest Flex Vantage baseline scenario for the SGD / MIP 5 corridor.',
  },
  {
    productId: 'income-invest-flex-vantage',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:income-vs2-regular-premium-allocation-uplift',
      'branch:income-vs2-investment-bonus',
    ],
    description: 'Invest Flex Vantage baseline scenario for the SGD / MIP 10 corridor.',
  },
  {
    productId: 'income-invest-flex-vantage',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:income-vs2-loyalty-bonus',
      'branch:income-vs2-surrender-charge',
    ],
    description: 'Invest Flex Vantage baseline scenario for the SGD / MIP 15 corridor.',
  },
  {
    productId: 'income-invest-flex-vantage',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'kernel:distribution-mode-assumption'],
    description: 'Invest Flex Vantage baseline scenario for the SGD / MIP 20 corridor with the manual cash-payout distribution assumption.',
    integrityChecks: [
      {
        description: 'cash-payout distribution assumption produces non-zero annual distributions',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'income-invest-flex-vantage',
    variantId: 'sgd-mip-20',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:income-vs2-premium-holiday-charge',
      'branch:income-vs2-partial-withdrawal-charge',
      'branch:income-vs2-ad-hoc-top-up-routing',
    ],
    description: 'Invest Flex Vantage event-heavy scenario covering premium holiday, top-up, and waived life-event withdrawal treatment.',
    integrityChecks: [
      {
        description: 'seeded partial withdrawals are present in the projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'income-invest-flex-vantage',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Invest Flex Vantage alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'income-invest-flex-trivantage',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:protected-base-assurance',
      'branch:income-vs3-policy-fee',
      'branch:income-vs3-death-ti-insurance-cover-charge',
      'branch:income-vs3-regular-premium-allocation-uplift',
      'branch:income-vs3-investment-bonus',
      'branch:income-vs3-loyalty-bonus',
      'branch:income-vs3-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Invest Flex TriVantage baseline scenario for the SGD / MIP 10 corridor.',
  },
  {
    productId: 'income-invest-flex-trivantage',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:income-vs3-premium-holiday-charge',
      'branch:income-vs3-partial-withdrawal-charge',
      'branch:income-vs3-ad-hoc-top-up-routing',
    ],
    description: 'Invest Flex TriVantage event-heavy scenario covering premium holiday, top-up, and waived life-event withdrawal treatment.',
    integrityChecks: [
      {
        description: 'seeded partial withdrawals are present in the projection output',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'income-invest-flex-trivantage',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Invest Flex TriVantage alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'hsbc-life-wealth-invest-cpf',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:hsbc-life-wealth-invest-cpf-zero-single-premium-charge'],
    description: 'HSBC Life Wealth Invest (CPF) baseline scenario proving zero-charge initial single-premium seeding through the open-ended CPF corridor.',
  },
  {
    productId: 'hsbc-life-wealth-invest-cpf',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-life-wealth-invest-cpf-zero-recurring-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-top-up-charge',
      'branch:hsbc-life-wealth-invest-cpf-zero-redemption-fee',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'HSBC Life Wealth Invest (CPF) supported event-heavy scenario covering zero-charge top-up, recurring single premium routing, and nil-redemption-fee withdrawals.',
    integrityChecks: [
      {
        description: 'zero-charge top-up credits the full gross top-up amount to the policy account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'policy')?.contributionAmount ?? 0) >= 10_000
        )),
      },
      {
        description: 'nil redemption-fee withdrawals leave the policy-account gross fee at zero in the withdrawal year',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.annualWithdrawals >= 4_000
          && (row.accounts.find((account) => account.accountId === 'policy')?.grossFee ?? 0) === 0
        )),
      },
    ],
  },
  {
    productId: 'hsbc-life-wealth-invest-cpf',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Life Wealth Invest (CPF) alternate-fund stress scenario through the open-ended CPF corridor.',
  },
  {
    productId: 'etiqa-invest-starter',
    variantId: 'sgd-mip-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:invest-starter-policy-charge',
      'branch:invest-starter-surrender-charge',
    ],
    description: 'Etiqa Invest starter baseline scenario proving the supported policy-charge and five-year surrender corridor.',
    integrityChecks: [
      {
        description: 'baseline policy incurs positive ongoing fees from the published account-value policy charge',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'etiqa-invest-starter',
    variantId: 'sgd-mip-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:invest-starter-premium-shortfall-charge',
      'branch:invest-starter-premium-shortfall-refund',
      'branch:invest-starter-partial-withdrawal-charge',
      'branch:invest-starter-ad-hoc-top-up-routing',
    ],
    description: 'Etiqa Invest starter event-heavy scenario proving premium-holiday shortfall charging and refund, ad-hoc top-up routing, and a charged partial withdrawal.',
    integrityChecks: [
      {
        description: 'event-heavy policy records both additional contribution and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 4_200 && row.annualWithdrawals > 0),
      },
      {
        description: 'premium-holiday repayment reduces cumulative fees versus leaving the shortfall charge unrepaid',
        test: (fixture, artifact) => {
          const withoutRepayment = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.map((event) => (
              event.type === 'premium-holiday'
                ? { ...event, repayMissedPremiums: false, repaymentAccountId: undefined }
                : event
            )),
          })
          const withRefundFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutRefundFees = analyzeIlpPolicy(withoutRepayment).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withRefundFees < withoutRefundFees
        },
      },
    ],
  },
  {
    productId: 'etiqa-invest-starter',
    variantId: 'sgd-mip-5',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest starter alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'etiqa-tiq-invest',
    variantId: 'sgd-open-ended',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:etiqa-tiq-invest-zero-single-premium-charge', 'branch:etiqa-tiq-invest-management-charge'],
    description: 'Tiq Invest baseline scenario proving zero-charge initial single-premium seeding and annual management-charge drag through the open-ended corridor.',
  },
  {
    productId: 'etiqa-tiq-invest',
    variantId: 'sgd-open-ended',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-tiq-invest-zero-top-up-charge',
      'branch:etiqa-tiq-invest-zero-recurring-single-premium-charge',
      'branch:etiqa-tiq-invest-zero-partial-withdrawal-charge',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'Tiq Invest supported event-heavy scenario covering zero-charge top-up, recurring single premium routing, and nil-charge withdrawals.',
    integrityChecks: [
      {
        description: 'zero-charge top-up credits the full gross top-up amount to the policy account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'policy')?.contributionAmount ?? 0) >= 10_000
        )),
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'etiqa-tiq-invest',
    variantId: 'sgd-open-ended',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tiq Invest alternate-fund stress scenario through the open-ended corridor.',
  },
  {
    productId: 'tokio-marine-wealth-enhancer-cpfis',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'branch:tokio-marine-wealth-enhancer-cpfis-zero-single-premium-charge'],
    description: 'TM Wealth Enhancer (CPFIS) baseline scenario proving zero-charge initial single-premium seeding through the open-ended CPF corridor.',
  },
  {
    productId: 'tokio-marine-wealth-enhancer-cpfis',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-marine-wealth-enhancer-cpfis-zero-top-up-charge',
      'branch:tokio-marine-wealth-enhancer-cpfis-zero-recurring-single-premium-charge',
      'branch:tokio-marine-wealth-enhancer-cpfis-zero-partial-withdrawal-charge',
      'tokio-recurring-single-premium-routing',
    ],
    description: 'TM Wealth Enhancer (CPFIS) supported event-heavy scenario covering zero-charge top-up, recurring single premium routing, and nil-charge withdrawals.',
    integrityChecks: [
      {
        description: 'zero-charge top-up credits the full gross top-up amount to the policy account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          (row.accounts.find((account) => account.accountId === 'policy')?.contributionAmount ?? 0) >= 10_000
        )),
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-enhancer-cpfis',
    variantId: 'sgd-open-ended-cpf',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'TM Wealth Enhancer (CPFIS) alternate-fund stress scenario through the open-ended CPF corridor.',
  },
  {
    productId: 'tokio-marine-goelite',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:tokio-marine-goelite-zero-single-premium-charge',
      'branch:tokio-marine-goelite-establishment-charge',
      'branch:tokio-marine-goelite-administrative-charge',
      'branch:tokio-marine-goelite-surrender-charge',
    ],
    description: '#goElite cash baseline scenario proving supported zero-charge single-premium seeding, original-base establishment and surrender charging, account-value administration fees, and cash-payout distribution assumptions.',
    integrityChecks: [
      {
        description: 'baseline cash corridor records positive annual withdrawals under the manual cash-payout distribution assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'baseline cash corridor incurs positive gross fees from establishment and administrative charges',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-goelite',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: '#goElite SRS baseline scenario proving the supported reinvest-only open-ended corridor.',
    integrityChecks: [
      {
        description: 'baseline SRS corridor keeps dividend distributions reinvested with no withdrawal payouts',
        test: (_, artifact) => artifact.expected.projections.mid.rows.every((row) => row.annualWithdrawals === 0),
      },
      {
        description: 'baseline SRS corridor still incurs positive establishment and administrative fees',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-goelite',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-marine-goelite-recurring-single-and-top-up-charge',
      'branch:tokio-marine-goelite-zero-partial-withdrawal-charge',
      'tokio-recurring-single-premium-routing',
    ],
    description: '#goElite cash event-heavy scenario proving recurring-single-premium routing, charged top-up allocation, and nil-charge withdrawals.',
    integrityChecks: [
      {
        description: 'event-heavy cash corridor records positive annual contribution from seeded top-up and recurring-single-premium events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'event-heavy cash corridor executes a later withdrawal through the nil-charge withdrawal path',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-goelite',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: '#goElite SRS alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'tokio-marine-goelite-secure',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'kernel:tokio-locked-in-protection-state',
      'branch:tokio-marine-goelite-secure-zero-single-premium-charge',
      'branch:tokio-marine-goelite-secure-establishment-charge',
      'branch:tokio-marine-goelite-secure-administrative-charge',
      'branch:tokio-marine-goelite-secure-surrender-charge',
    ],
    description: '#goElite Secure cash baseline scenario proving supported zero-charge single-premium seeding, locked-in protection-state MPC handling, original-base establishment and surrender charging, account-value administration fees, and cash-payout distribution assumptions.',
    integrityChecks: [
      {
        description: 'baseline secure cash corridor records positive annual withdrawals under the manual cash-payout distribution assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'baseline secure cash corridor incurs positive gross fees from establishment, administrative, and protection charges',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-goelite-secure',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline', 'kernel:tokio-locked-in-protection-state'],
    description: '#goElite Secure SRS baseline scenario proving the supported reinvest-only secure open-ended corridor.',
    integrityChecks: [
      {
        description: 'baseline secure SRS corridor keeps dividend distributions reinvested with no withdrawal payouts',
        test: (_, artifact) => artifact.expected.projections.mid.rows.every((row) => row.annualWithdrawals === 0),
      },
      {
        description: 'baseline secure SRS corridor still incurs positive establishment, administrative, and protection fees',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-goelite-secure',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-marine-goelite-secure-recurring-single-and-top-up-charge',
      'branch:tokio-marine-goelite-secure-zero-partial-withdrawal-charge',
      'tokio-recurring-single-premium-routing',
      'tokio-top-up-routing',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
    ],
    description: '#goElite Secure cash event-heavy scenario proving recurring-single-premium routing, charged top-up allocation, and nil-charge withdrawals through the secure corridor.',
    integrityChecks: [
      {
        description: 'event-heavy secure cash corridor records positive annual contribution from seeded top-up and recurring-single-premium events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'event-heavy secure cash corridor executes a later withdrawal through the nil-charge withdrawal path',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-goelite-secure',
    variantId: 'sgd-open-ended-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress', 'kernel:tokio-locked-in-protection-state'],
    description: '#goElite Secure SRS alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'tokio-marine-gowealth-enrich',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:tokio-marine-gowealth-enrich-zero-single-premium-charge',
      'branch:tokio-marine-gowealth-enrich-establishment-charge',
      'branch:tokio-marine-gowealth-enrich-administrative-charge',
      'branch:tokio-marine-gowealth-enrich-surrender-charge',
    ],
    description: '#goWealth Enrich cash baseline scenario proving supported zero-charge single-premium seeding, original-base establishment and surrender charging, account-value administration fees, and cash-payout distribution assumptions.',
    integrityChecks: [
      {
        description: 'baseline goWealth Enrich corridor records positive annual withdrawals under the manual cash-payout distribution assumption',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
      {
        description: 'baseline goWealth Enrich corridor incurs positive gross fees from establishment and administrative charges',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-gowealth-enrich',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-marine-gowealth-enrich-recurring-single-and-top-up-charge',
      'branch:tokio-marine-gowealth-enrich-single-premium-partial-withdrawal-charge',
      'tokio-recurring-single-premium-routing',
      'tokio-top-up-routing',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
    ],
    description: '#goWealth Enrich cash event-heavy scenario proving recurring-single-premium routing, charged top-up allocation, and scheduled single-premium withdrawal charges.',
    integrityChecks: [
      {
        description: 'event-heavy goWealth Enrich corridor records positive annual contribution from seeded top-up and recurring-single-premium events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'event-heavy goWealth Enrich corridor executes a later withdrawal through the single-premium withdrawal charge path',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-gowealth-enrich',
    variantId: 'sgd-open-ended-cash',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: '#goWealth Enrich cash alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'tokio-marine-goassure',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:distribution-mode-assumption',
      'branch:tokio-marine-goassure-initial-charge',
      'branch:tokio-marine-goassure-policy-charge',
      'branch:tokio-marine-goassure-surrender-charge',
    ],
    description: '#goAssure baseline scenario proving supported initial-charge, premium-base policy-charge, surrender-charge, and distribution-assumption support through the SGD / MIP 10 corridor.',
    integrityChecks: [
      {
        description: 'baseline goAssure corridor incurs positive gross fees from initial and policy charges',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-goassure',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-marine-goassure-recurring-single-and-top-up-charge',
      'branch:tokio-marine-goassure-partial-withdrawal-charge',
      'branch:tokio-marine-goassure-premium-shortfall-charge',
      'tokio-recurring-single-premium-routing',
      'tokio-top-up-routing',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
    ],
    description: '#goAssure event-heavy scenario proving recurring-single-premium routing, top-up charging, accumulation-account withdrawal charging, and premium-shortfall mechanics.',
    integrityChecks: [
      {
        description: 'event-heavy goAssure corridor records positive annual contribution from top-up and recurring-single-premium events',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > 0),
      },
      {
        description: 'event-heavy goAssure corridor executes a later partial withdrawal from the accumulation account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'tokio-marine-goassure',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: '#goAssure alternate-fund high-OCF stress scenario through the SGD / MIP 10 corridor.',
  },
  {
    productId: 'fwd-invest-flexi-vii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:protected-base-assurance',
      'branch:fwd-invest-flexi-vii-initial-account-charge',
      'branch:fwd-invest-flexi-vii-insurance-charge',
      'branch:fwd-invest-flexi-vii-initial-account-surrender-charge',
    ],
    description: 'FWD Invest Flexi VII baseline scenario proving the supported fixed-premium-base initial-account charge, Appendix B insurance charge, and 10-year initial-account surrender-charge corridor.',
    integrityChecks: [
      {
        description: 'baseline policy incurs positive cumulative fees under the initial-account charge and assurance-charge corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
      {
        description: 'baseline policy charges more with the supported insurance-charge rule than without it',
        test: (fixture, artifact) => {
          const withoutInsurance = ilpPolicySchema.parse({
            ...fixture.policy,
            chargeRules: fixture.policy.chargeRules?.filter((rule) => rule.id !== 'insurance-charge') ?? [],
          })
          const withInsuranceFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutInsuranceFees = analyzeIlpPolicy(withoutInsurance).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withInsuranceFees > withoutInsuranceFees
        },
      },
    ],
  },
  {
    productId: 'fwd-invest-flexi-vii',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:fwd-invest-flexi-vii-top-up-premium-charge',
      'branch:fwd-invest-flexi-vii-initial-account-redemption-fee',
    ],
    description: 'FWD Invest Flexi VII event-heavy scenario covering charged top-up allocation and in-MIP initial-account withdrawal fees on the supported corridor.',
    integrityChecks: [
      {
        description: 'event-heavy policy records both a top-up contribution spike and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12 && row.annualWithdrawals > 0),
      },
      {
        description: 'event-heavy initial-account withdrawal increases cumulative fees beyond the same policy without the withdrawal event',
        test: (fixture, artifact) => {
          const withoutWithdrawal = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.filter((event) => event.type !== 'partial-withdrawal') ?? [],
          })
          const withWithdrawalFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutWithdrawalFees = analyzeIlpPolicy(withoutWithdrawal).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withWithdrawalFees > withoutWithdrawalFees
        },
      },
    ],
  },
  {
    productId: 'fwd-invest-flexi-vii',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'FWD Invest Flexi VII alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'fwd-invest-goal-1',
    variantId: 'sgd-open-ended',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:fwd-invest-goal-1-zero-single-premium-charge',
      'branch:fwd-invest-goal-1-initial-account-charge',
      'branch:fwd-invest-goal-1-plan-charge',
      'branch:fwd-invest-goal-1-surrender-charge',
    ],
    description: 'FWD Invest Goal 1 SGD baseline scenario proving supported zero-charge single-premium seeding, account-value initial-account charges, original-base plan charges, and original-base surrender charges through the open-ended corridor.',
    integrityChecks: [
      {
        description: 'baseline SGD corridor incurs positive gross fees from plan and initial-account charges',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'fwd-invest-goal-1',
    variantId: 'usd-open-ended',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'FWD Invest Goal 1 USD baseline scenario proving the supported second-currency open-ended corridor.',
    integrityChecks: [
      {
        description: 'baseline USD corridor also incurs positive gross fees from plan and initial-account charges',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'fwd-invest-goal-1',
    variantId: 'sgd-open-ended',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:fwd-invest-goal-1-zero-partial-withdrawal-charge',
    ],
    description: 'FWD Invest Goal 1 SGD event-heavy scenario proving the nil-charge partial-withdrawal path through the open-ended corridor.',
    integrityChecks: [
      {
        description: 'event-heavy SGD corridor executes the seeded partial withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'fwd-invest-goal-1',
    variantId: 'usd-open-ended',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'FWD Invest Goal 1 USD alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'etiqa-invest-flex-prime-ii',
    variantId: 'sgd-mip-10-flexi-3',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-prime-ii-startup-bonus',
      'branch:etiqa-flex-prime-ii-special-bonus',
    ],
    description: 'Etiqa Invest Flex Prime II baseline scenario for the SGD / MIP 10 Flexi 3 corridor.',
  },
  {
    productId: 'etiqa-invest-flex-prime-ii',
    variantId: 'sgd-mip-10-flexi-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-prime-ii-loyalty-bonus',
      'branch:etiqa-flex-prime-ii-policy-charge',
      'branch:etiqa-flex-prime-ii-insurance-charge',
    ],
    description: 'Etiqa Invest Flex Prime II baseline scenario proving the supported regular-account insurance-charge corridor.',
  },
  {
    productId: 'etiqa-invest-flex-prime-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-prime-ii-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Etiqa Invest Flex Prime II baseline scenario for the SGD / MIP 20 corridor.',
  },
  {
    productId: 'etiqa-invest-flex-prime-ii',
    variantId: 'sgd-mip-10-flexi-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-flex-prime-ii-top-up-premium-charge',
      'branch:etiqa-flex-prime-ii-startup-bonus-recovery',
      'branch:etiqa-flex-prime-ii-partial-withdrawal-charge',
    ],
    description: 'Etiqa Invest Flex Prime II event-heavy scenario proving top-up charge, start-up bonus recovery, and charged regular-account withdrawals.',
    integrityChecks: [
      {
        description: 'event-heavy corridor produces both a reduction event and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'etiqa-invest-flex-prime-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest Flex Prime II alternate-fund stress scenario through the supported 20-year corridor.',
  },
  {
    productId: 'etiqa-invest-flex-pro',
    variantId: 'sgd-mip-10-flexi-3',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-pro-startup-bonus',
      'branch:etiqa-flex-pro-special-bonus',
    ],
    description: 'Etiqa Invest Flex Pro baseline scenario for the SGD / MIP 10 Flexi 3 corridor.',
  },
  {
    productId: 'etiqa-invest-flex-pro',
    variantId: 'sgd-mip-10-flexi-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-pro-loyalty-bonus',
      'branch:etiqa-flex-pro-policy-charge',
      'branch:etiqa-flex-pro-insurance-charge',
    ],
    description: 'Etiqa Invest Flex Pro baseline scenario for the SGD / MIP 10 Flexi 5 corridor.',
  },
  {
    productId: 'etiqa-invest-flex-pro',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-pro-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Etiqa Invest Flex Pro baseline scenario for the SGD / MIP 20 corridor.',
  },
  {
    productId: 'etiqa-invest-flex-pro',
    variantId: 'sgd-mip-10-flexi-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-flex-pro-top-up-premium-charge',
      'branch:etiqa-flex-pro-startup-bonus-recovery',
      'branch:etiqa-flex-pro-partial-withdrawal-charge',
    ],
    description: 'Etiqa Invest Flex Pro event-heavy scenario covering top-up charge, start-up bonus recovery, and charged regular-account withdrawals.',
    integrityChecks: [
      {
        description: 'event-heavy corridor produces both a reduction event and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'etiqa-invest-flex-pro',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest Flex Pro alternate-fund stress scenario through the supported 20-year corridor.',
  },
  {
    productId: 'etiqa-invest-vista',
    variantId: 'sgd-mip-10-flexi-3',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-vista-startup-bonus',
      'branch:etiqa-vista-special-bonus',
    ],
    description: 'Etiqa Invest Vista baseline scenario for the SGD / MIP 10 Flexi 3 corridor.',
  },
  {
    productId: 'etiqa-invest-vista',
    variantId: 'sgd-mip-10-flexi-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-vista-loyalty-bonus',
      'branch:etiqa-vista-policy-charge',
      'branch:etiqa-vista-insurance-charge',
    ],
    description: 'Etiqa Invest Vista baseline scenario proving the supported regular-account insurance-charge corridor.',
  },
  {
    productId: 'etiqa-invest-vista',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-vista-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Etiqa Invest Vista baseline scenario for the SGD / MIP 20 corridor.',
  },
  {
    productId: 'etiqa-invest-vista',
    variantId: 'sgd-mip-10-flexi-5',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-vista-top-up-premium-charge',
      'branch:etiqa-vista-startup-bonus-recovery',
      'branch:etiqa-vista-partial-withdrawal-charge',
    ],
    description: 'Etiqa Invest Vista event-heavy scenario covering top-up charge, start-up bonus recovery, and charged regular-account withdrawals.',
    integrityChecks: [
      {
        description: 'event-heavy corridor produces both a reduction event and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.cumulativeGrossFees > 0),
      },
    ],
  },
  {
    productId: 'etiqa-invest-vista',
    variantId: 'sgd-mip-20',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest Vista alternate-fund stress scenario through the supported 20-year corridor.',
  },
  {
    productId: 'etiqa-invest-flex-wealth-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-wealth-ii-startup-bonus',
      'branch:etiqa-flex-wealth-ii-special-bonus',
      'branch:etiqa-flex-wealth-ii-cumulative-paid-policy-charge',
      'branch:etiqa-flex-wealth-ii-insurance-charge',
    ],
    description: 'Etiqa Invest Flex Wealth II baseline scenario for the SGD / MIP 10 corridor.',
  },
  {
    productId: 'etiqa-invest-flex-wealth-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-wealth-ii-loyalty-bonus',
    ],
    description: 'Etiqa Invest Flex Wealth II baseline scenario for the SGD / MIP 15 corridor.',
  },
  {
    productId: 'etiqa-invest-flex-wealth-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-flex-wealth-ii-surrender-charge',
    ],
    description: 'Etiqa Invest Flex Wealth II baseline scenario for the SGD / MIP 20 corridor.',
  },
  {
    productId: 'etiqa-invest-flex-wealth-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-flex-wealth-ii-top-up-premium-charge',
      'branch:etiqa-flex-wealth-ii-startup-bonus-recovery',
      'branch:etiqa-flex-wealth-ii-top-up-account-routing',
    ],
    description: 'Etiqa Invest Flex Wealth II event-heavy scenario covering top-up routing and start-up bonus recovery.',
    integrityChecks: [
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'etiqa-invest-flex-wealth-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest Flex Wealth II alternate-fund stress scenario through the supported 15-year corridor.',
  },
  {
    productId: 'etiqa-invest-smart-flex-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-smart-flex-ii-startup-bonus',
      'branch:etiqa-smart-flex-ii-special-bonus',
      'branch:etiqa-smart-flex-ii-cumulative-paid-policy-charge',
      'branch:etiqa-smart-flex-ii-insurance-charge',
    ],
    description: 'Etiqa Invest Smart Flex II baseline scenario for the SGD / MIP 10 corridor.',
  },
  {
    productId: 'etiqa-invest-smart-flex-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-smart-flex-ii-loyalty-bonus',
    ],
    description: 'Etiqa Invest Smart Flex II baseline scenario for the SGD / MIP 15 corridor.',
  },
  {
    productId: 'etiqa-invest-smart-flex-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-smart-flex-ii-surrender-charge',
    ],
    description: 'Etiqa Invest Smart Flex II baseline scenario for the SGD / MIP 20 corridor.',
  },
  {
    productId: 'etiqa-invest-smart-flex-ii',
    variantId: 'sgd-mip-20',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-smart-flex-ii-top-up-premium-charge',
      'branch:etiqa-smart-flex-ii-startup-bonus-recovery',
      'branch:etiqa-smart-flex-ii-top-up-account-routing',
    ],
    description: 'Etiqa Invest Smart Flex II event-heavy scenario covering top-up routing and start-up bonus recovery.',
    integrityChecks: [
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'etiqa-invest-smart-flex-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest Smart Flex II alternate-fund stress scenario through the supported 15-year corridor.',
  },
  {
    productId: 'etiqa-invest-smart-vista',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-smart-vista-startup-bonus',
      'branch:etiqa-smart-vista-special-bonus',
      'branch:etiqa-smart-vista-cumulative-paid-policy-charge',
      'branch:etiqa-smart-vista-insurance-charge',
    ],
    description: 'Etiqa Invest Smart Vista baseline scenario for the SGD / MIP 10 corridor.',
  },
  {
    productId: 'etiqa-invest-smart-vista',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-smart-vista-loyalty-bonus',
    ],
    description: 'Etiqa Invest Smart Vista baseline scenario for the SGD / MIP 15 corridor.',
  },
  {
    productId: 'etiqa-invest-smart-vista',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-smart-vista-surrender-charge',
    ],
    description: 'Etiqa Invest Smart Vista baseline scenario for the SGD / MIP 20 corridor.',
  },
  {
    productId: 'etiqa-invest-smart-vista',
    variantId: 'sgd-mip-20',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-smart-vista-top-up-premium-charge',
      'branch:etiqa-smart-vista-startup-bonus-recovery',
      'branch:etiqa-smart-vista-top-up-account-routing',
    ],
    description: 'Etiqa Invest Smart Vista event-heavy scenario covering top-up routing and start-up bonus recovery.',
    integrityChecks: [
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'etiqa-invest-smart-vista',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest Smart Vista alternate-fund stress scenario through the supported 15-year corridor.',
  },
  {
    productId: 'etiqa-invest-wealth-purpose',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-wealth-purpose-startup-bonus',
      'branch:etiqa-wealth-purpose-special-bonus',
      'branch:etiqa-wealth-purpose-cumulative-paid-policy-charge',
      'branch:etiqa-wealth-purpose-insurance-charge',
    ],
    description: 'Etiqa Invest Wealth Purpose baseline scenario for the SGD / MIP 10 corridor.',
  },
  {
    productId: 'etiqa-invest-wealth-purpose',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-wealth-purpose-loyalty-bonus',
    ],
    description: 'Etiqa Invest Wealth Purpose baseline scenario for the SGD / MIP 15 corridor.',
  },
  {
    productId: 'etiqa-invest-wealth-purpose',
    variantId: 'sgd-mip-20',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:etiqa-wealth-purpose-surrender-charge',
    ],
    description: 'Etiqa Invest Wealth Purpose baseline scenario for the SGD / MIP 20 corridor.',
  },
  {
    productId: 'etiqa-invest-wealth-purpose',
    variantId: 'sgd-mip-20',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:etiqa-wealth-purpose-top-up-premium-charge',
      'branch:etiqa-wealth-purpose-startup-bonus-recovery',
      'branch:etiqa-wealth-purpose-top-up-account-routing',
    ],
    description: 'Etiqa Invest Wealth Purpose event-heavy scenario covering top-up routing and start-up bonus recovery.',
    integrityChecks: [
      {
        description: 'event-heavy policy retains top-up contribution in excess of the scheduled annual premium',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'etiqa-invest-wealth-purpose',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Etiqa Invest Wealth Purpose alternate-fund stress scenario through the supported 15-year corridor.',
  },
  {
    productId: 'great-eastern-wealth-advantage-4',
    variantId: 'sgd-mip-10-choice-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:protected-base-assurance',
      'branch:great-eastern-wa4-welcome-bonus',
      'branch:great-eastern-wa4-premium-bonus',
      'branch:great-eastern-wa4-policy-fee-rate',
      'branch:great-eastern-wa4-insurance-charge',
    ],
    description: 'Baseline GREAT Wealth Advantage 4 scenario proving the supported monthly insurance-charge corridor on the Choice 5 MIP path.',
  },
  {
    productId: 'great-eastern-wealth-advantage-4',
    variantId: 'sgd-mip-10-choice-10-6000-and-above',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline GREAT Wealth Advantage 4 scenario proving the supported high-annualised-premium Choice 10 corridor.',
  },
  {
    productId: 'great-eastern-wealth-advantage-4',
    variantId: 'sgd-mip-15-choice-15-under-6000',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline GREAT Wealth Advantage 4 scenario proving the supported low-annualised-premium Choice 15 corridor.',
  },
  {
    productId: 'great-eastern-wealth-advantage-4',
    variantId: 'sgd-mip-10-choice-10-under-6000',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-wa4-fixed-policy-fee',
      'branch:great-eastern-wa4-premium-holiday-charge',
      'branch:great-eastern-wa4-premium-holiday-charge-refund',
      'branch:great-eastern-wa4-partial-withdrawal-charge',
      'branch:great-eastern-wa4-top-up-premium-charge',
    ],
    description: 'GREAT Wealth Advantage 4 event-heavy scenario proving the low-annualised-premium fixed fee plus holiday refund and top-up handling.',
    integrityChecks: [
      {
        description: 'event-heavy corridor produces both a premium-holiday repayment and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > 4_200),
      },
    ],
  },
  {
    productId: 'great-eastern-wealth-advantage-4',
    variantId: 'sgd-mip-15-choice-15-6000-and-above',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: [
      'ocf-stress',
      'branch:great-eastern-wa4-loyalty-bonus',
      'branch:great-eastern-wa4-surrender-charge',
    ],
    description: 'GREAT Wealth Advantage 4 alternate-fund high-OCF stress scenario through the long-MIP supported corridor.',
  },
  {
    productId: 'great-eastern-investment-linked-insurance-plan-2',
    variantId: 'sgd-mip-10-choice-5',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:protected-base-assurance',
      'branch:great-eastern-ilp2-welcome-bonus',
      'branch:great-eastern-ilp2-premium-bonus',
      'branch:great-eastern-ilp2-policy-fee-rate',
      'branch:great-eastern-ilp2-insurance-charge',
    ],
    description: 'Baseline Investment-linked Insurance Plan 2 scenario proving the supported monthly insurance-charge corridor on the Choice 5 MIP path.',
  },
  {
    productId: 'great-eastern-investment-linked-insurance-plan-2',
    variantId: 'sgd-mip-10-choice-10-under-6000',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-ilp2-choice10-fixed-policy-fee',
      'branch:great-eastern-ilp2-premium-holiday-charge',
      'branch:great-eastern-ilp2-premium-holiday-charge-refund',
      'branch:great-eastern-ilp2-partial-withdrawal-charge',
      'branch:great-eastern-ilp2-top-up-premium-charge',
    ],
    description: 'Investment-linked Insurance Plan 2 event-heavy scenario proving the low-annualised-premium fixed fee plus holiday refund and top-up handling.',
    integrityChecks: [
      {
        description: 'event-heavy corridor produces both a premium-holiday repayment and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > 4_200),
      },
    ],
  },
  {
    productId: 'great-eastern-investment-linked-insurance-plan-2',
    variantId: 'sgd-mip-10-choice-10-6000-and-above',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: [
      'ocf-stress',
      'branch:great-eastern-ilp2-loyalty-bonus',
      'branch:great-eastern-ilp2-surrender-charge',
    ],
    description: 'Investment-linked Insurance Plan 2 alternate-fund high-OCF stress scenario through the supported Choice 10 corridor.',
  },
  {
    productId: 'great-eastern-prestige-portfolio',
    variantId: 'sgd-open-ended-single-premium-cash',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:great-eastern-prestige-portfolio-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-wrap-fee-manual-input',
      'branch:great-eastern-prestige-portfolio-policy-fee',
    ],
    description: 'Baseline Prestige Portfolio single-premium cash scenario proving the supported upfront premium-charge, wrap-fee, and policy-fee corridor.',
    integrityChecks: [
      {
        description: 'records positive inception fees under the supported single-premium corridor',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'great-eastern-prestige-portfolio',
    variantId: 'sgd-open-ended-recurrent-single-premium-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-prestige-portfolio-recurrent-single-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-top-up-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-partial-withdrawal-zero-charge',
    ],
    description: 'Prestige Portfolio event-heavy recurrent-single-premium SRS scenario proving manual-input recurrent-charge handling plus top-up and nil-charge withdrawal behavior.',
    integrityChecks: [
      {
        description: 'event-heavy corridor produces both recurring-single-premium activity and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > 0),
      },
    ],
  },
  {
    productId: 'great-eastern-prestige-portfolio',
    variantId: 'sgd-open-ended-single-premium-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: [
      'ocf-stress',
      'branch:great-eastern-prestige-portfolio-open-ended-zero-surrender-charge',
    ],
    description: 'Prestige Portfolio alternate-fund stress scenario through the supported single-premium SRS corridor.',
  },
  {
    productId: 'great-eastern-great-invest-advantage-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:great-eastern-gia-sp-initial-single-premium-charge',
    ],
    description: 'Baseline GREAT Invest Advantage (SP) cash/SRS scenario proving the supported upfront single-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-sp',
    variantId: 'sgd-open-ended-cpfis',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline GREAT Invest Advantage (SP) CPFIS scenario proving the supported zero-charge corridor.',
    integrityChecks: [
      {
        description: 'keeps the initial single-premium corridor fee-free under the published CPFIS charge path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-gia-sp-top-up-premium-charge',
      'branch:great-eastern-gia-sp-open-ended-zero-surrender-charge',
    ],
    description: 'GREAT Invest Advantage (SP) event-heavy scenario proving accepted top-up charges and zero-charge withdrawals.',
    integrityChecks: [
      {
        description: 'top-up event increases cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'GREAT Invest Advantage (SP) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:great-eastern-gia2-sp-initial-single-premium-charge',
    ],
    description: 'Baseline GREAT Invest Advantage 2 (SP) scenario proving the supported upfront single-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records a positive upfront single-premium charge at honest inception',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-gia2-sp-top-up-premium-charge',
      'branch:great-eastern-gia2-sp-open-ended-zero-surrender-charge',
    ],
    description: 'GREAT Invest Advantage 2 (SP) event-heavy scenario proving accepted top-up charges and zero-charge withdrawals.',
    integrityChecks: [
      {
        description: 'top-up event increases cumulative fees beyond the initial single-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-sp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'GREAT Invest Advantage 2 (SP) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'great-eastern-great-invest-advantage-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:great-eastern-gia-rsp-recurrent-single-premium-charge',
    ],
    description: 'Baseline GREAT Invest Advantage (RSP) cash/SRS scenario proving the supported recurrent-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records positive recurring-premium fees during the projection horizon',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-rsp',
    variantId: 'sgd-open-ended-cpfis',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'Baseline GREAT Invest Advantage (RSP) CPFIS scenario proving the supported zero-charge corridor.',
    integrityChecks: [
      {
        description: 'keeps the recurring-premium corridor fee-free under the published CPFIS charge path',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) === 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-gia-rsp-top-up-premium-charge',
      'branch:great-eastern-gia-rsp-open-ended-zero-surrender-charge',
    ],
    description: 'GREAT Invest Advantage (RSP) event-heavy scenario proving accepted top-up charges and zero-charge withdrawals.',
    integrityChecks: [
      {
        description: 'top-up event increases cumulative fees beyond the recurring-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'GREAT Invest Advantage (RSP) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:great-eastern-gia2-rsp-recurrent-single-premium-charge',
    ],
    description: 'Baseline GREAT Invest Advantage 2 (RSP) scenario proving the supported recurrent-premium charge corridor.',
    integrityChecks: [
      {
        description: 'records positive recurring-premium fees during the projection horizon',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0) > 0,
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:great-eastern-gia2-rsp-top-up-premium-charge',
      'branch:great-eastern-gia2-rsp-open-ended-zero-surrender-charge',
    ],
    description: 'GREAT Invest Advantage 2 (RSP) event-heavy scenario proving accepted top-up charges and zero-charge withdrawals.',
    integrityChecks: [
      {
        description: 'top-up event increases cumulative fees beyond the recurring-premium-only baseline',
        test: (fixture, artifact) => {
          const withoutEventCharges = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: [],
          })
          const withEventCharges = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutEventChargeFees = analyzeIlpPolicy(withoutEventCharges).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withEventCharges > withoutEventChargeFees
        },
      },
      {
        description: 'the seeded withdrawal executes through the published open-ended withdrawal corridor',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0),
      },
    ],
  },
  {
    productId: 'great-eastern-great-invest-advantage-2-rsp',
    variantId: 'sgd-open-ended-cash-or-srs',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'GREAT Invest Advantage 2 (RSP) alternate-fund high-OCF stress scenario.',
  },
  {
    productId: 'hsbc-life-flexi-protector',
    variantId: 'sgd-open-ended-choice-cover',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:hsbc-life-flexi-protector-regular-premium-charge',
      'branch:hsbc-life-flexi-protector-regular-premium-allocation-uplift',
      'branch:hsbc-life-flexi-protector-additional-bonus-units',
      'branch:hsbc-life-flexi-protector-administration-fee',
      'branch:hsbc-flexi-choice-max-assurance',
      'kernel:distribution-mode-assumption',
    ],
    description: 'HSBC Life Flexi Protector baseline scenario proving the supported Choice Cover regular-premium, account-value bonus, administration-fee, insurance-charge, and manual distribution corridor.',
    integrityChecks: [
      {
        description: 'Choice-cover baseline applies a positive annual-rate Additional Bonus Units credit on the policy account',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const policyBonus = firstRow?.accounts.find((account) => account.accountId === 'policy')?.bonusCredit ?? 0
          return policyBonus > 0
        },
      },
      {
        description: 'Choice cover applies a non-zero death / TI assurance charge from the normalized path',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const policyFee = firstRow?.accounts.find((account) => account.accountId === 'policy')?.grossFee ?? 0
          return policyFee > 0
        },
      },
    ],
  },
  {
    productId: 'hsbc-life-flexi-protector',
    variantId: 'sgd-open-ended-max-cover',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: ['baseline'],
    description: 'HSBC Life Flexi Protector baseline scenario proving the supported Max Cover corridor.',
    integrityChecks: [
      {
        description: 'Max cover produces a higher first-year death / TI assurance charge than Choice from the same balances',
        test: (fixture) => {
          const maxPolicy = ilpPolicySchema.parse({
            ...fixture.policy,
            chargeRules: fixture.policy.chargeRules?.map((rule) => ({
              ...rule,
              id: 'flexi-choice-death-ti',
              assuranceConfig: rule.assuranceConfig
                ? {
                    ...rule.assuranceConfig,
                    formula: 'hsbc-flexi-choice-death-ti',
                  }
                : undefined,
            })),
          })
          const maxFee = analyzeIlpPolicy(fixture.policy).projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'policy')?.grossFee ?? 0
          const choiceFee = analyzeIlpPolicy(maxPolicy).projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'policy')?.grossFee ?? 0
          return maxFee > choiceFee
        },
      },
    ],
  },
  {
    productId: 'hsbc-life-flexi-protector',
    variantId: 'sgd-open-ended-choice-cover',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:hsbc-life-flexi-protector-top-up-premium-charge',
      'branch:hsbc-life-flexi-protector-recurring-single-premium-charge',
      'branch:hsbc-life-flexi-protector-zero-partial-withdrawal-charge',
    ],
    description: 'HSBC Life Flexi Protector event-heavy scenario covering top-up, recurring-single-premium, and zero-charge withdrawal behavior on the supported Choice Cover corridor.',
    integrityChecks: [
      {
        description: 'event-heavy corridor produces both contribution spikes and a later withdrawal',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => row.annualWithdrawals > 0 && row.annualContribution > artifact.policyInput.monthlyContribution * 12),
      },
    ],
  },
  {
    productId: 'hsbc-life-flexi-protector',
    variantId: 'sgd-open-ended-max-cover',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'HSBC Life Flexi Protector alternate-fund high-OCF stress scenario through the supported Max Cover corridor.',
  },
  {
    productId: 'tokio-marine-atlas-wealth',
    variantId: 'sgd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-policy-value',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'TM Atlas Wealth basic-death supported baseline proving initial routing, bonus tiers, policy-value charge basis, and dividend distribution support through the SGD / MIP 25 corridor.',
  },
  {
    productId: 'tokio-marine-atlas-wealth',
    variantId: 'sgd-mip-25-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-atlas-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction',
    ],
    description: 'TM Atlas Wealth advanced-death supported baseline proving published MPC accrual, settlement, and disable-on-failure behavior.',
  },
  {
    productId: 'tokio-marine-atlas-wealth',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
    ],
    description: 'TM Atlas Wealth event-heavy supported scenario covering accumulation-account top-up routing and recurring-single-premium charging.',
  },
  {
    productId: 'tokio-marine-atlas-wealth',
    variantId: 'sgd-mip-25',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'TM Atlas Wealth supported OCF stress scenario through the same SGD / MIP 25 corridor.',
  },
  {
    productId: 'tokio-marine-goclassic',
    variantId: 'sgd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-policy-value',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine #goClassic supported baseline proving initial routing, fee-rate modeling, policy-value charge basis, and surrender mechanics through the SGD / MIP 25 corridor.',
  },
  {
    productId: 'tokio-marine-goclassic',
    variantId: 'sgd-mip-25-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-goclassic-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction',
    ],
    description: 'Tokio Marine #goClassic advanced-death supported baseline proving accrued Monthly Protection Charge handling and permanent disable-on-failure behavior from insured-life inputs.',
  },
  {
    productId: 'tokio-marine-goclassic',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
    ],
    description: 'Tokio Marine #goClassic supported scenario covering accumulation-account top-up routing and recurring-single-premium charging.',
  },
  {
    productId: 'tokio-marine-goclassic',
    variantId: 'sgd-mip-25',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine #goClassic supported OCF stress scenario through the same SGD / MIP 25 corridor.',
  },
  {
    productId: 'tokio-marine-goclassic-secure',
    variantId: 'sgd-mip-25',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-policy-value',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine #goClassic Secure supported baseline proving initial routing, fee-rate modeling, policy-value charge basis, and surrender mechanics through the SGD / MIP 25 corridor.',
  },
  {
    productId: 'tokio-marine-goclassic-secure',
    variantId: 'sgd-mip-25-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'kernel:tokio-locked-in-protection-state',
    ],
    description: 'Tokio Marine #goClassic Secure advanced-death supported baseline proving Locked-in Policy Value protection-state handling from insured-life inputs.',
  },
  {
    productId: 'tokio-marine-goclassic-secure',
    variantId: 'sgd-mip-25',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
    ],
    description: 'Tokio Marine #goClassic Secure supported scenario covering accumulation-account top-up routing and recurring-single-premium charging.',
  },
  {
    productId: 'tokio-marine-goclassic-secure',
    variantId: 'sgd-mip-25',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine #goClassic Secure supported OCF stress scenario through the same SGD / MIP 25 corridor.',
  },
  {
    productId: 'tokio-marine-harvest-builder-atfuture',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-regular-premium-routing-to-accumulation-account',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-premium-bonus',
      'tokio-power-up-bonus',
      'tokio-loyalty-bonus',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-accumulation-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Harvest Builder@Future supported baseline proving its accumulation-account routing, split policy-charge windows, and published bonus ladders.',
  },
  {
    productId: 'tokio-marine-harvest-builder-atfuture',
    variantId: 'sgd-mip-10-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-harvest-builder-atfuture-advanced-death-monthly-protection-charge',
    ],
    description: 'Tokio Marine Harvest Builder@Future advanced-death supported baseline proving Monthly Protection Charge handling from insured-life inputs.',
  },
  {
    productId: 'tokio-marine-harvest-builder-atfuture',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
    ],
    description: 'Tokio Marine Harvest Builder@Future supported scenario covering top-up routing, recurring-single-premium charging, withdrawal charging, and non-payment shortfall deductions.',
  },
  {
    productId: 'tokio-marine-harvest-builder-atfuture',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Harvest Builder@Future supported OCF stress scenario through the same SGD / MIP 10 corridor.',
  },
  {
    productId: 'tokio-marine-wealth-builder-atfuture',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-regular-premium-routing-to-accumulation-account',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-premium-bonus',
      'tokio-power-up-bonus',
      'tokio-loyalty-bonus',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-accumulation-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Wealth Builder@Future supported baseline proving its accumulation-account routing, split policy-charge windows, and published bonus ladders.',
  },
  {
    productId: 'tokio-marine-wealth-builder-atfuture',
    variantId: 'sgd-mip-10-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-wealth-builder-atfuture-advanced-death-monthly-protection-charge',
    ],
    description: 'Tokio Marine Wealth Builder@Future advanced-death supported baseline proving Monthly Protection Charge handling from insured-life inputs.',
  },
  {
    productId: 'tokio-marine-wealth-builder-atfuture',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
    ],
    description: 'Tokio Marine Wealth Builder@Future supported scenario covering top-up routing, recurring-single-premium charging, withdrawal charging, and non-payment shortfall deductions.',
  },
  {
    productId: 'tokio-marine-wealth-builder-atfuture',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Wealth Builder@Future supported OCF stress scenario through the same SGD / MIP 10 corridor.',
  },
  {
    productId: 'tokio-marine-wealth-flexi-link-3-12',
    variantId: 'sgd-mip-12',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-regular-premium-routing-to-accumulation-account',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-premium-bonus',
      'tokio-power-up-bonus',
      'tokio-loyalty-bonus',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-accumulation-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Wealth Flexi-Link 3.12 supported baseline proving its accumulation-account routing, split policy-charge windows, and published bonus ladders.',
  },
  {
    productId: 'tokio-marine-wealth-flexi-link-3-12',
    variantId: 'sgd-mip-12-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-wealth-flexi-link-3-12-advanced-death-monthly-protection-charge',
    ],
    description: 'Tokio Marine Wealth Flexi-Link 3.12 advanced-death supported baseline proving Monthly Protection Charge handling from insured-life inputs.',
  },
  {
    productId: 'tokio-marine-wealth-flexi-link-3-12',
    variantId: 'sgd-mip-12',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
    ],
    description: 'Tokio Marine Wealth Flexi-Link 3.12 supported scenario covering top-up routing, recurring-single-premium charging, withdrawal charging, and non-payment shortfall deductions.',
  },
  {
    productId: 'tokio-marine-wealth-flexi-link-3-12',
    variantId: 'sgd-mip-12',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Wealth Flexi-Link 3.12 supported OCF stress scenario through the same SGD / MIP 12 corridor.',
  },
  {
    productId: 'tokio-marine-wealth-flexi-link-5-10',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-regular-premium-routing-to-accumulation-account',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-premium-bonus',
      'tokio-power-up-bonus',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-accumulation-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Wealth Flexi-Link 5.10 supported baseline proving its accumulation-account routing, policy charge, and published premium-bonus and power-up-bonus windows.',
  },
  {
    productId: 'tokio-marine-wealth-flexi-link-5-10',
    variantId: 'sgd-mip-10-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-wealth-flexi-link-5-10-advanced-death-monthly-protection-charge',
    ],
    description: 'Tokio Marine Wealth Flexi-Link 5.10 advanced-death supported baseline proving Monthly Protection Charge handling from insured-life inputs.',
  },
  {
    productId: 'tokio-marine-wealth-flexi-link-5-10',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
    ],
    description: 'Tokio Marine Wealth Flexi-Link 5.10 supported scenario covering top-up routing, recurring-single-premium charging, withdrawal charging, and non-payment shortfall deductions.',
  },
  {
    productId: 'tokio-marine-wealth-flexi-link-5-10',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Wealth Flexi-Link 5.10 supported OCF stress scenario through the same SGD / MIP 10 corridor.',
  },
  {
    productId: 'tokio-marine-wealth-flexi',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-regular-premium-routing-to-accumulation-account',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-performance-investment-bonus',
      'tokio-initial-charge-on-accumulation-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-admin-charge-on-accumulation-account',
      'tokio-accumulation-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Wealth Flexi supported baseline proving its accumulation-account routing, charge basis, and split performance-bonus windows.',
  },
  {
    productId: 'tokio-marine-wealth-flexi',
    variantId: 'sgd-mip-10-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-wealth-flexi-advanced-death-monthly-protection-charge',
    ],
    description: 'Tokio Marine Wealth Flexi advanced-death supported baseline proving Monthly Protection Charge handling from insured-life inputs.',
  },
  {
    productId: 'tokio-marine-wealth-flexi',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
    ],
    description: 'Tokio Marine Wealth Flexi supported scenario covering top-up routing, recurring-single-premium resumption, withdrawal charging, and shortfall exclusivity.',
  },
  {
    productId: 'tokio-marine-wealth-flexi',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Wealth Flexi supported OCF stress scenario through the same SGD / MIP 10 corridor.',
  },
  {
    productId: 'tokio-marine-harvest-flexi',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-regular-premium-routing-to-accumulation-account',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-performance-investment-bonus',
      'tokio-initial-charge-on-accumulation-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-admin-charge-on-accumulation-account',
      'tokio-accumulation-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Harvest Flexi supported baseline proving its accumulation-account routing, charge basis, and published bonus windows.',
  },
  {
    productId: 'tokio-marine-harvest-flexi',
    variantId: 'sgd-mip-10-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-harvest-flexi-advanced-death-monthly-protection-charge',
    ],
    description: 'Tokio Marine Harvest Flexi advanced-death supported baseline proving Monthly Protection Charge handling from insured-life inputs.',
  },
  {
    productId: 'tokio-marine-harvest-flexi',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
    ],
    description: 'Tokio Marine Harvest Flexi supported scenario covering top-up routing, recurring-single-premium resumption, withdrawal charging, and shortfall exclusivity.',
  },
  {
    productId: 'tokio-marine-harvest-flexi',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Harvest Flexi supported OCF stress scenario through the same SGD / MIP 10 corridor.',
  },
  {
    productId: 'tokio-marine-harvest-pro',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-bonus-ladder',
      'branch:tokio-post-mip-routing',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-performance-investment-bonus',
      'tokio-loyalty-bonus',
      'tokio-power-up-bonus',
      'tokio-post-mip-regular-premium-routing-back-to-initial-account',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-admin-charge-on-initial-account',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Harvest Pro supported baseline proving later performance, loyalty, and power-up bonus credit on top of the seeded bonus ladder.',
  },
  {
    productId: 'tokio-marine-harvest-pro',
    variantId: 'sgd-mip-10-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-harvest-pro-advanced-death-monthly-protection-charge-accrual',
    ],
    description: 'Tokio Marine Harvest Pro advanced-death supported baseline proving accrued Monthly Protection Charge handling.',
  },
  {
    productId: 'tokio-marine-harvest-pro',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'branch:tokio-reduction-consumes-rsp-first',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-recurring-single-premium-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
    ],
    description: 'Tokio Marine Harvest Pro supported scenario covering recurring-single-premium resumption, shortfall exclusivity, and reduction ordering.',
  },
  {
    productId: 'tokio-marine-harvest-pro',
    variantId: 'sgd-mip-10',
    scenarioId: 'structural-proof',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-multi-account-structure',
      'tokio-top-up-routing',
      'tokio-top-up-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
    ],
    description: 'Tokio Marine Harvest Pro structural proof scenario covering supplementary routing, fallback deduction into non-primary accounts, and accumulation-only withdrawal scope.',
  },
  {
    productId: 'tokio-marine-harvest-pro',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Harvest Pro supported OCF stress scenario through the same SGD / MIP 10 corridor.',
  },
  {
    productId: 'tokio-marine-harvest-max',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-bonus-ladder',
      'branch:tokio-post-mip-routing',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-performance-investment-bonus',
      'tokio-loyalty-bonus',
      'tokio-power-up-bonus',
      'tokio-post-mip-regular-premium-routing-back-to-initial-account',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-admin-charge-on-initial-account',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Harvest Max supported baseline proving its published charge ladder and bonus windows.',
  },
  {
    productId: 'tokio-marine-harvest-max',
    variantId: 'sgd-mip-15-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-harvest-max-advanced-death-monthly-protection-charge-accrual',
    ],
    description: 'Tokio Marine Harvest Max advanced-death supported baseline proving accrued Monthly Protection Charge handling.',
  },
  {
    productId: 'tokio-marine-harvest-max',
    variantId: 'sgd-mip-15',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'branch:tokio-reduction-consumes-rsp-first',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
    ],
    description: 'Tokio Marine Harvest Max supported scenario covering recurring-single-premium resumption, shortfall exclusivity, reduction ordering, and the published withdrawal corridor.',
  },
  {
    productId: 'tokio-marine-harvest-max',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Harvest Max supported OCF stress scenario through the same SGD / MIP 15 corridor.',
  },
  {
    productId: 'tokio-marine-affluence-atfuture',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Affluence@Future supported baseline proving initial routing, charge basis, and surrender mechanics through the SGD / MIP 15 corridor.',
  },
  {
    productId: 'tokio-marine-affluence-atfuture',
    variantId: 'sgd-mip-15-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-marine-affluence-atfuture-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts',
    ],
    description: 'Tokio Marine Affluence@Future advanced-death supported baseline proving accrued Monthly Protection Charge handling across the Initial and Accumulation Units Accounts.',
  },
  {
    productId: 'tokio-marine-affluence-atfuture',
    variantId: 'sgd-mip-15',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-reduction-consumes-rsp-first',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'branch:tokio-marine-affluence-atfuture-zero-partial-withdrawal-charge',
    ],
    description: 'Tokio Marine Affluence@Future supported scenario covering recurring-single-premium resumption, reduction ordering, and the published zero-charge withdrawal corridor.',
  },
  {
    productId: 'tokio-marine-affluence-atfuture',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Affluence@Future supported OCF stress scenario through the same SGD / MIP 15 corridor.',
  },
  {
    productId: 'tokio-marine-goluxe',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine #goLuxe supported baseline proving initial routing, charge basis, and surrender mechanics through the SGD / MIP 15 corridor.',
  },
  {
    productId: 'tokio-marine-goluxe',
    variantId: 'sgd-mip-15-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-goluxe-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts',
    ],
    description: 'Tokio Marine #goLuxe advanced-death supported baseline proving accrued Monthly Protection Charge handling across the Initial and Accumulation Units Accounts.',
  },
  {
    productId: 'tokio-marine-goluxe',
    variantId: 'sgd-mip-15',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'branch:tokio-reduction-consumes-rsp-first',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-premium-holiday',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
    ],
    description: 'Tokio Marine #goLuxe supported scenario covering recurring-single-premium resumption, premium-shortfall exclusivity, and accumulation-account withdrawal charging.',
  },
  {
    productId: 'tokio-marine-goluxe',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine #goLuxe supported OCF stress scenario through the same SGD / MIP 15 corridor.',
  },
  {
    productId: 'tokio-marine-goaffluence',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine #goAffluence supported baseline proving initial routing, charge basis, and surrender mechanics through the SGD / MIP 15 corridor.',
  },
  {
    productId: 'tokio-marine-goaffluence',
    variantId: 'sgd-mip-15-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-goaffluence-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts',
    ],
    description: 'Tokio Marine #goAffluence advanced-death supported baseline proving accrued Monthly Protection Charge handling across the Initial and Accumulation Units Accounts.',
  },
  {
    productId: 'tokio-marine-goaffluence',
    variantId: 'sgd-mip-15',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-reduction-consumes-rsp-first',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
    ],
    description: 'Tokio Marine #goAffluence supported scenario covering recurring-single-premium resumption, reduction ordering, and top-up routing through the Top-up Units Account.',
  },
  {
    productId: 'tokio-marine-goaffluence',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine #goAffluence supported OCF stress scenario through the same SGD / MIP 15 corridor.',
  },
  {
    productId: 'tokio-marine-wealth-max-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-bonus-ladder',
      'branch:tokio-post-mip-routing',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-performance-investment-bonus',
      'tokio-loyalty-bonus',
      'tokio-power-up-bonus',
      'tokio-post-mip-regular-premium-routing-back-to-initial-account',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-admin-charge-on-initial-account',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Wealth Max (II) supported baseline proving later performance, loyalty, and power-up bonus credit on top of the seeded bonus ladder.',
    integrityChecks: [
      {
        description: 'performance investment bonus eventually credits the Accumulation Units Account after the ICP routing phase',
        test: (_, artifact) => {
          return artifact.expected.projections.mid.rows.some((row) => (
            row.policyYear >= 5
            && row.policyYear <= 15
            && (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0) > 0
          ))
        },
      },
      {
        description: 'loyalty and power-up bonuses both become active in the post-MIP tail',
        test: (_, artifact) => {
          return artifact.expected.projections.mid.rows.some((row) => (
            row.policyYear >= 16
            && (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0) > 0
            && (row.accounts.find((account) => account.accountId === 'initial')?.bonusCredit ?? 0) > 0
          ))
        },
      },
      {
        description: 'post-MIP regular premiums route back into the Initial Units Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear > 15
          && row.annualContribution > 0
          && (row.accounts.find((account) => account.accountId === 'initial')?.contributionAmount ?? 0) === row.annualContribution
          && (row.accounts.find((account) => account.accountId === 'accumulation')?.contributionAmount ?? 0) === 0
        )),
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-max-ii',
    variantId: 'sgd-mip-15-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-wealth-max-ii-advanced-death-monthly-protection-charge-accrual',
    ],
    description: 'Tokio Marine Wealth Max (II) advanced-death supported baseline proving accrued Monthly Protection Charge handling.',
  },
  {
    productId: 'tokio-marine-wealth-max-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'branch:tokio-reduction-consumes-rsp-first',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
    ],
    description: 'Tokio Marine Wealth Max (II) supported scenario covering recurring-single-premium resumption, shortfall exclusivity, and reduction ordering.',
    integrityChecks: [
      {
        description: 'manual recurring-single-premium resumption restores additional top-up contribution after the holiday window',
        test: (fixture, artifact) => {
          const withoutResumption = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.filter((event) => event.type !== 'recurring-single-premium-resumption'),
          })
          const withResumptionContribution = artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          const withoutResumptionContribution = analyzeIlpPolicy(withoutResumption).projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          return withResumptionContribution > withoutResumptionContribution
        },
      },
      {
        description: 'reduction consumes recurring single premium first before cutting the regular-premium path',
        test: (_, artifact) => {
          const topupContribution = artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          return topupContribution > 0 && topupContribution < 700
        },
      },
      {
        description: 'exclusive shortfall grouping avoids charging both Tokio shortfall paths together',
        test: (fixture, artifact) => {
          const withoutExclusivity = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.map((rule) => ({
              ...rule,
              exclusiveGroup: undefined,
              groupResolution: undefined,
            })),
          })
          const withExclusiveFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutExclusiveFees = analyzeIlpPolicy(withoutExclusivity).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withExclusiveFees < withoutExclusiveFees
        },
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-max-ii',
    variantId: 'sgd-mip-15',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Wealth Max (II) supported OCF stress scenario through the same SGD / MIP 15 corridor.',
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-bonus-ladder',
      'branch:tokio-post-mip-routing',
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-performance-investment-bonus',
      'tokio-loyalty-bonus',
      'tokio-power-up-bonus',
      'tokio-post-mip-regular-premium-routing-back-to-initial-account',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-admin-charge-on-initial-account',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    description: 'Tokio Marine Wealth Pro (II) supported baseline proving later performance, loyalty, and power-up bonus credit on top of the seeded bonus ladder.',
    integrityChecks: [
      {
        description: 'performance investment bonus eventually credits the Accumulation Units Account after the ICP routing phase',
        test: (_, artifact) => {
          return artifact.expected.projections.mid.rows.some((row) => (
            row.policyYear >= 5
            && row.policyYear <= 10
            && (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0) > 0
          ))
        },
      },
      {
        description: 'loyalty and power-up bonuses both become active in the post-MIP tail',
        test: (_, artifact) => {
          return artifact.expected.projections.mid.rows.some((row) => (
            row.policyYear >= 11
            && (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0) > 0
            && (row.accounts.find((account) => account.accountId === 'initial')?.bonusCredit ?? 0) > 0
          ))
        },
      },
      {
        description: 'post-MIP regular premiums route back into the Initial Units Account',
        test: (_, artifact) => artifact.expected.projections.mid.rows.some((row) => (
          row.policyYear > 10
          && row.annualContribution > 0
          && (row.accounts.find((account) => account.accountId === 'initial')?.contributionAmount ?? 0) === row.annualContribution
          && (row.accounts.find((account) => account.accountId === 'accumulation')?.contributionAmount ?? 0) === 0
        )),
      },
      {
        description: 'lowering the premium tier weakens the later Tokio accumulation bonus path',
        test: (fixture, artifact) => {
          const lowerTierPolicy = ilpPolicySchema.parse({
            ...fixture.policy,
            monthlyContribution: 1_000,
          })
          const baselineAccumulationBonus = artifact.expected.projections.mid.rows
            .filter((row) => row.policyYear >= 6 && row.policyYear <= 10)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0), 0)
          const lowerTierAccumulationBonus = analyzeIlpPolicy(lowerTierPolicy).projections.mid.rows
            .filter((row) => row.policyYear >= 6 && row.policyYear <= 10)
            .reduce((sum, row) => sum + (row.accounts.find((account) => account.accountId === 'accumulation')?.bonusCredit ?? 0), 0)
          return baselineAccumulationBonus > lowerTierAccumulationBonus
        },
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10-advanced-death',
    scenarioId: 'baseline',
    fixtureClass: 'supported',
    coverageTags: [
      'baseline',
      'branch:tokio-wealth-pro-ii-advanced-death-monthly-protection-charge-accrual',
    ],
    description: 'Tokio Marine Wealth Pro (II) advanced-death supported baseline proving accrued Monthly Protection Charge handling.',
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'event-heavy',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-rsp-manual-resumption',
      'branch:tokio-shortfall-exclusive',
      'branch:tokio-reduction-consumes-rsp-first',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-recurring-single-premium-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
    ],
    description: 'Tokio Marine Wealth Pro (II) supported scenario covering recurring-single-premium resumption, shortfall exclusivity, and reduction ordering.',
    integrityChecks: [
      {
        description: 'manual recurring-single-premium resumption restores additional top-up contribution after the holiday window',
        test: (fixture, artifact) => {
          const withoutResumption = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.filter((event) => event.type !== 'recurring-single-premium-resumption'),
          })
          const withResumptionContribution = artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          const withoutResumptionContribution = analyzeIlpPolicy(withoutResumption).projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          return withResumptionContribution > withoutResumptionContribution
        },
      },
      {
        description: 'reduction consumes recurring single premium first before cutting the regular-premium path',
        test: (_, artifact) => {
          const topupContribution = artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          return topupContribution > 0 && topupContribution < 700
        },
      },
      {
        description: 'exclusive shortfall grouping avoids charging both Tokio shortfall paths together',
        test: (fixture, artifact) => {
          const withoutExclusivity = ilpPolicySchema.parse({
            ...fixture.policy,
            eventChargeRules: fixture.policy.eventChargeRules?.map((rule) => ({
              ...rule,
              exclusiveGroup: undefined,
              groupResolution: undefined,
            })),
          })
          const withExclusiveFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutExclusiveFees = analyzeIlpPolicy(withoutExclusivity).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withExclusiveFees < withoutExclusiveFees
        },
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'waived-charges',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-charge-waiver',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events',
    ],
    description: 'Tokio Marine Wealth Pro (II) supported scenario proving explicit insurer-approved charge waivers for withdrawal and shortfall events.',
    integrityChecks: [
      {
        description: 'waived events materially reduce cumulative gross fees versus the same events without waivers',
        test: (fixture, artifact) => {
          const withoutWaivers = ilpPolicySchema.parse({
            ...fixture.policy,
            policyEvents: fixture.policy.policyEvents?.map((event) => ({
              ...event,
              chargeWaived: false,
            })),
          })
          const withWaiverFees = artifact.expected.projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          const withoutWaiverFees = analyzeIlpPolicy(withoutWaivers).projections.mid.rows[0]?.cumulativeGrossFees ?? 0
          return withWaiverFees < withoutWaiverFees
        },
      },
      {
        description: 'the waived partial withdrawal still executes against the accumulation account',
        test: (_, artifact) => (artifact.expected.projections.mid.rows[0]?.accounts.find((account) => account.accountId === 'accumulation')?.withdrawalAmount ?? 0) >= 500,
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'structural-proof',
    fixtureClass: 'supported',
    coverageTags: [
      'event-heavy',
      'branch:tokio-multi-account-structure',
      'tokio-top-up-routing',
      'tokio-top-up-premium-charge',
    ],
    description: 'Tokio Marine Wealth Pro (II) structural proof scenario covering supplementary routing, fallback deduction into non-primary accounts, and accumulation-only withdrawal scope.',
    integrityChecks: [
      {
        description: 'supplementary premium routing keeps the explicit top-up premium in the Top-up Units Account while regular premium stays off the top-up path',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const topupContribution = firstRow?.accounts.find((account) => account.accountId === 'topup')?.contributionAmount ?? 0
          const initialContribution = firstRow?.accounts.find((account) => account.accountId === 'initial')?.contributionAmount ?? 0
          return topupContribution >= 1_000 && initialContribution === 0
        },
      },
      {
        description: 'shortfall fallback reaches the Top-up and Initial Units Accounts when the Accumulation Units Account is insufficient',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const topupFee = firstRow?.accounts.find((account) => account.accountId === 'topup')?.grossFee ?? 0
          const initialFee = firstRow?.accounts.find((account) => account.accountId === 'initial')?.grossFee ?? 0
          return topupFee > 50 && initialFee > 0
        },
      },
      {
        description: 'the seeded withdrawal stays on the Accumulation Units Account rather than leaking into Top-up or Initial Units',
        test: (_, artifact) => {
          const firstRow = artifact.expected.projections.mid.rows[0]
          const accumulationWithdrawal = firstRow?.accounts.find((account) => account.accountId === 'accumulation')?.withdrawalAmount ?? 0
          const topupWithdrawal = firstRow?.accounts.find((account) => account.accountId === 'topup')?.withdrawalAmount ?? 0
          const initialWithdrawal = firstRow?.accounts.find((account) => account.accountId === 'initial')?.withdrawalAmount ?? 0
          return accumulationWithdrawal >= 500 && topupWithdrawal === 0 && initialWithdrawal === 0
        },
      },
    ],
  },
  {
    productId: 'tokio-marine-wealth-pro-ii',
    variantId: 'sgd-mip-10',
    scenarioId: 'ocf-stress',
    fixtureClass: 'supported',
    coverageTags: ['ocf-stress'],
    description: 'Tokio Marine Wealth Pro (II) supported OCF stress scenario through the same SGD / MIP 10 corridor.',
  },
]

function buildPolicyForDefinition(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
  definition: GoldenFixtureDefinition,
): IlpPolicyInput {
  const id = `${definition.productId}-${definition.variantId}-${definition.scenarioId}`

  if (definition.productId === 'hsbc-life-wealth-accelerate' && definition.scenarioId === 'baseline') {
    return hsbcBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'hsbc-life-wealth-accelerate' && definition.scenarioId === 'event-heavy') {
    return hsbcEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-accelerate' && definition.scenarioId === 'holiday-no-repayment') {
    return hsbcHolidayNoRepaymentPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-accelerate' && definition.scenarioId === 'ocf-stress') {
    return hsbcStressPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-harvest' && definition.scenarioId === 'baseline') {
    return hsbcHarvestBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-harvest' && definition.scenarioId === 'event-heavy') {
    return hsbcHarvestEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-harvest' && definition.scenarioId === 'ocf-stress') {
    return hsbcHarvestStressPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-abundance' && definition.scenarioId === 'baseline') {
    return hsbcAbundanceBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'hsbc-life-wealth-abundance' && definition.scenarioId === 'event-heavy') {
    return hsbcAbundanceEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-abundance' && definition.scenarioId === 'ocf-stress') {
    return hsbcAbundanceStressPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-voyage' && definition.scenarioId === 'baseline') {
    return hsbcVoyageBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'hsbc-life-wealth-voyage' && definition.scenarioId === 'event-heavy') {
    return hsbcVoyageEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-voyage' && definition.scenarioId === 'ocf-stress') {
    return hsbcVoyageStressPolicy(snapshot, id)
  }
  if (
    (
      definition.productId === 'hsbc-life-wealth-focus-flexi-1'
      || definition.productId === 'hsbc-life-wealth-focus-flexi-3'
      || definition.productId === 'hsbc-life-wealth-focus-flexi-5'
    )
    && definition.scenarioId === 'baseline'
  ) {
    return hsbcWealthFocusBaselinePolicy(
      snapshot,
      definition.productId as 'hsbc-life-wealth-focus-flexi-1' | 'hsbc-life-wealth-focus-flexi-3' | 'hsbc-life-wealth-focus-flexi-5',
      definition.variantId as 'sgd-mip-10' | 'usd-mip-10',
      id,
    )
  }
  if (
    (
      definition.productId === 'hsbc-life-wealth-focus-flexi-1'
      || definition.productId === 'hsbc-life-wealth-focus-flexi-3'
      || definition.productId === 'hsbc-life-wealth-focus-flexi-5'
    )
    && definition.scenarioId === 'event-heavy'
  ) {
    return hsbcWealthFocusEventHeavyPolicy(
      snapshot,
      definition.productId as 'hsbc-life-wealth-focus-flexi-1' | 'hsbc-life-wealth-focus-flexi-3' | 'hsbc-life-wealth-focus-flexi-5',
      id,
    )
  }
  if (
    (
      definition.productId === 'hsbc-life-wealth-focus-flexi-1'
      || definition.productId === 'hsbc-life-wealth-focus-flexi-3'
      || definition.productId === 'hsbc-life-wealth-focus-flexi-5'
    )
    && definition.scenarioId === 'ocf-stress'
  ) {
    return hsbcWealthFocusStressPolicy(
      snapshot,
      definition.productId as 'hsbc-life-wealth-focus-flexi-1' | 'hsbc-life-wealth-focus-flexi-3' | 'hsbc-life-wealth-focus-flexi-5',
      definition.variantId as 'sgd-mip-10' | 'usd-mip-10',
      id,
    )
  }
  if (definition.productId === 'prudential-pruvantage-wealth-ii' && definition.scenarioId === 'baseline') {
    return pruBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-pruvantage-wealth-ii' && definition.scenarioId === 'event-heavy') {
    return pruEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-wealth-ii' && definition.scenarioId === 'holiday-fallback') {
    return pruHolidayFallbackPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-wealth-ii' && definition.scenarioId === 'ocf-stress-split') {
    return pruStressSplitPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'baseline') {
    return prosperBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'assurance-active') {
    return prosperAssurancePolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth-sp' && definition.scenarioId === 'baseline') {
    return pruInvestGrowthSpBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth-sp' && definition.scenarioId === 'event-heavy') {
    return pruInvestGrowthSpEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth-sp' && definition.scenarioId === 'ocf-stress') {
    return pruInvestGrowthSpStressPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-manulink-investor-ii' && definition.scenarioId === 'baseline') {
    return manulinkInvestorIiBaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended-cash' | 'sgd-open-ended-srs', id)
  }
  if (definition.productId === 'manulife-manulink-investor-ii' && definition.scenarioId === 'event-heavy') {
    return definition.variantId === 'sgd-open-ended-srs'
      ? manulinkInvestorIiSrsEventHeavyPolicy(snapshot, id)
      : manulinkInvestorIiCashEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-manulink-investor-ii' && definition.scenarioId === 'ocf-stress') {
    return manulinkInvestorIiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-invest-cash-srs' && definition.scenarioId === 'baseline') {
    return hsbcWealthInvestCashSrsBaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended-cash' | 'sgd-open-ended-srs', id)
  }
  if (definition.productId === 'hsbc-life-wealth-invest-cash-srs' && definition.scenarioId === 'event-heavy') {
    return hsbcWealthInvestCashEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-invest-cash-srs' && definition.scenarioId === 'ocf-stress') {
    return hsbcWealthInvestCashSrsStressPolicy(snapshot, definition.variantId as 'sgd-open-ended-cash' | 'sgd-open-ended-srs', id)
  }
  if (definition.productId === 'hsbc-life-goal-builder-ii' && definition.scenarioId === 'baseline') {
    return hsbcGoalBuilderIiBaselinePolicy(
      snapshot,
      definition.variantId as 'sgd-mip-5' | 'sgd-mip-10' | 'sgd-mip-15' | 'usd-mip-5' | 'usd-mip-10' | 'usd-mip-15',
      id,
    )
  }
  if (definition.productId === 'hsbc-life-goal-builder-ii' && definition.scenarioId === 'event-heavy') {
    return hsbcGoalBuilderIiEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-goal-builder-ii' && definition.scenarioId === 'ocf-stress') {
    return hsbcGoalBuilderIiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-smartretire-v-sum' && definition.scenarioId === 'baseline') {
    return manulifeSmartRetireSumBaselinePolicy(
      snapshot,
      definition.variantId as 'sgd-mip-8-flexi-3' | 'sgd-mip-8-flexi-5' | 'sgd-mip-12-flexi-8',
      id,
    )
  }
  if (definition.productId === 'manulife-smartretire-v-sum' && definition.scenarioId === 'event-heavy') {
    return manulifeSmartRetireSumEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-smartretire-v-sum' && definition.scenarioId === 'ocf-stress') {
    return manulifeSmartRetireSumStressPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-smartretire-v-income' && definition.scenarioId === 'baseline') {
    return manulifeSmartRetireIncomeBaselinePolicy(
      snapshot,
      definition.variantId as 'sgd-mip-8-flexi-3' | 'sgd-mip-8-flexi-5' | 'sgd-mip-12-flexi-8',
      id,
    )
  }
  if (definition.productId === 'manulife-smartretire-v-income' && definition.scenarioId === 'event-heavy') {
    return manulifeSmartRetireIncomeEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-smartretire-v-income' && definition.scenarioId === 'ocf-stress') {
    return manulifeSmartRetireIncomeStressPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-investready-iii' && definition.scenarioId === 'baseline') {
    return manulifeInvestreadyIiiBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-investready-iii' && definition.scenarioId === 'event-heavy') {
    return manulifeInvestreadyIiiEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-investready-iii' && definition.scenarioId === 'ocf-stress') {
    return manulifeInvestreadyIiiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-investready-iii-sep-2025' && definition.scenarioId === 'baseline') {
    return manulifeInvestreadyIiiSep2025BaselinePolicy(
      snapshot,
      definition.variantId as keyof typeof MANULIFE_INVESTREADY_III_SEP_2025_VARIANT_LABELS,
      id,
    )
  }
  if (definition.productId === 'manulife-investready-iii-sep-2025' && definition.scenarioId === 'event-heavy') {
    return manulifeInvestreadyIiiSep2025EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'manulife-investready-iii-sep-2025' && definition.scenarioId === 'ocf-stress') {
    return manulifeInvestreadyIiiSep2025StressPolicy(snapshot, id)
  }
  if (definition.productId === 'singlife-legacy-invest' && definition.scenarioId === 'baseline') {
    return singlifeLegacyInvestBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'singlife-legacy-invest' && definition.scenarioId === 'event-heavy') {
    return singlifeLegacyInvestEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'singlife-legacy-invest' && definition.scenarioId === 'ocf-stress') {
    return singlifeLegacyInvestStressPolicy(snapshot, id)
  }
  if (definition.productId === 'singlife-savvy-invest-ii' && definition.scenarioId === 'baseline') {
    return singlifeSavvyInvestIiBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'singlife-savvy-invest-ii' && definition.scenarioId === 'event-heavy') {
    return singlifeSavvyInvestIiEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'singlife-savvy-invest-ii' && definition.scenarioId === 'ocf-stress') {
    return singlifeSavvyInvestIiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-invest-plus-sp' && definition.scenarioId === 'baseline') {
    return etiqaInvestPlusSpBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-invest-plus-sp' && definition.scenarioId === 'event-heavy') {
    return etiqaInvestPlusSpEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-invest-plus-sp' && definition.scenarioId === 'ocf-stress') {
    return etiqaInvestPlusSpStressPolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-dash-pet-plus' && definition.scenarioId === 'baseline') {
    return etiqaDashPetPlusBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-dash-pet-plus' && definition.scenarioId === 'event-heavy') {
    return etiqaDashPetPlusEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-dash-pet-plus' && definition.scenarioId === 'ocf-stress') {
    return etiqaDashPetPlusStressPolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-invest-starter' && definition.scenarioId === 'baseline') {
    return etiqaInvestStarterBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-invest-starter' && definition.scenarioId === 'event-heavy') {
    return etiqaInvestStarterEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-invest-starter' && definition.scenarioId === 'ocf-stress') {
    return etiqaInvestStarterStressPolicy(snapshot, id)
  }
  if (definition.productId === 'income-snack-investment' && definition.scenarioId === 'baseline') {
    return incomeSnackInvestmentBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'income-snack-investment' && definition.scenarioId === 'event-heavy') {
    return incomeSnackInvestmentEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'income-snack-investment' && definition.scenarioId === 'ocf-stress') {
    return incomeSnackInvestmentStressPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth' && definition.scenarioId === 'baseline') {
    return pruInvestGrowthRegularBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth' && definition.scenarioId === 'event-heavy') {
    return pruInvestGrowthRegularEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-prulink-investgrowth' && definition.scenarioId === 'ocf-stress') {
    return pruInvestGrowthRegularStressPolicy(snapshot, id)
  }
  if (definition.productId === 'income-wealthlink-gl3' && definition.scenarioId === 'baseline') {
    return incomeWealthLinkGl3BaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'income-wealthlink-gl3' && definition.scenarioId === 'event-heavy') {
    return incomeWealthLinkGl3EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'income-wealthlink-gl3' && definition.scenarioId === 'ocf-stress') {
    return incomeWealthLinkGl3StressPolicy(snapshot, id)
  }
  if (definition.productId === 'income-invest-flex' && definition.scenarioId === 'baseline') {
    return incomeInvestFlexBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'income-invest-flex' && definition.scenarioId === 'event-heavy') {
    return incomeInvestFlexEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'income-invest-flex' && definition.scenarioId === 'ocf-stress') {
    return incomeInvestFlexStressPolicy(snapshot, id)
  }
  if (definition.productId === 'income-invest-flex-vantage' && definition.scenarioId === 'baseline') {
    return incomeInvestFlexVantageBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'income-invest-flex-vantage' && definition.scenarioId === 'event-heavy') {
    return incomeInvestFlexVantageEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'income-invest-flex-vantage' && definition.scenarioId === 'ocf-stress') {
    return incomeInvestFlexVantageStressPolicy(snapshot, id)
  }
  if (definition.productId === 'income-invest-flex-trivantage' && definition.scenarioId === 'baseline') {
    return incomeInvestFlexTriVantageBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'income-invest-flex-trivantage' && definition.scenarioId === 'event-heavy') {
    return incomeInvestFlexTriVantageEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'income-invest-flex-trivantage' && definition.scenarioId === 'ocf-stress') {
    return incomeInvestFlexTriVantageStressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-invest-easy-cash-srs' && definition.scenarioId === 'baseline') {
    return aiaInvestEasyCashSrsBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-invest-easy-cash-srs' && definition.scenarioId === 'event-heavy') {
    return aiaInvestEasyCashSrsEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-invest-easy-cash-srs' && definition.scenarioId === 'ocf-stress') {
    return aiaInvestEasyCashSrsStressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-invest-easy-cpf' && definition.scenarioId === 'baseline') {
    return aiaInvestEasyCpfBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-invest-easy-cpf' && definition.scenarioId === 'event-heavy') {
    return aiaInvestEasyCpfEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-invest-easy-cpf' && definition.scenarioId === 'ocf-stress') {
    return aiaInvestEasyCpfStressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-retirement-elite' && definition.scenarioId === 'baseline') {
    return aiaPlatinumRetirementEliteBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-retirement-elite' && definition.scenarioId === 'event-heavy') {
    return aiaPlatinumRetirementEliteEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-retirement-elite' && definition.scenarioId === 'ocf-stress') {
    return aiaPlatinumRetirementEliteStressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-elite-secure-income-5-pay' && definition.scenarioId === 'baseline') {
    return aiaEliteSecureIncome5PayBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-elite-secure-income-5-pay' && definition.scenarioId === 'event-heavy') {
    return aiaEliteSecureIncome5PayEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-elite-secure-income-5-pay' && definition.scenarioId === 'ocf-stress') {
    return aiaEliteSecureIncome5PayStressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-elite-secure-income-single-premium' && definition.scenarioId === 'baseline') {
    return aiaEliteSecureIncomeSpBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-elite-secure-income-single-premium' && definition.scenarioId === 'event-heavy') {
    return aiaEliteSecureIncomeSpEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-elite-secure-income-single-premium' && definition.scenarioId === 'ocf-stress') {
    return aiaEliteSecureIncomeSpStressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-wealth-venture' && definition.scenarioId === 'baseline') {
    return aiaWealthVentureBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-wealth-venture' && definition.scenarioId === 'event-heavy') {
    return aiaWealthVentureEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-wealth-venture' && definition.scenarioId === 'ocf-stress') {
    return aiaWealthVentureStressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-elite-2' && definition.scenarioId === 'baseline') {
    return aiaPlatinumWealthElite2BaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-elite-2' && definition.scenarioId === 'event-heavy') {
    return aiaPlatinumWealthElite2EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-elite-2' && definition.scenarioId === 'ocf-stress') {
    return aiaPlatinumWealthElite2StressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-legacy' && definition.scenarioId === 'baseline') {
    return aiaPlatinumWealthLegacyBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-legacy' && definition.scenarioId === 'event-heavy') {
    return aiaPlatinumWealthLegacyEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-legacy' && definition.scenarioId === 'ocf-stress') {
    return aiaPlatinumWealthLegacyStressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-pro-achiever-3' && definition.scenarioId === 'baseline') {
    return aiaProAchiever3BaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-pro-achiever-3' && definition.scenarioId === 'event-heavy') {
    return aiaProAchiever3EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-pro-achiever-3' && definition.scenarioId === 'ocf-stress') {
    return aiaProAchiever3StressPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-venture-2' && definition.scenarioId === 'baseline') {
    return aiaPlatinumWealthVenture2BaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-venture-2' && definition.scenarioId === 'event-heavy') {
    return aiaPlatinumWealthVenture2EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'aia-platinum-wealth-venture-2' && definition.scenarioId === 'ocf-stress') {
    return aiaPlatinumWealthVenture2StressPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-invest-cpf' && definition.scenarioId === 'baseline') {
    return hsbcWealthInvestCpfBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-invest-cpf' && definition.scenarioId === 'event-heavy') {
    return hsbcWealthInvestCpfEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-wealth-invest-cpf' && definition.scenarioId === 'ocf-stress') {
    return hsbcWealthInvestCpfStressPolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-tiq-invest' && definition.scenarioId === 'baseline') {
    return etiqaTiqInvestBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-tiq-invest' && definition.scenarioId === 'event-heavy') {
    return etiqaTiqInvestEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'etiqa-tiq-invest' && definition.scenarioId === 'ocf-stress') {
    return etiqaTiqInvestStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-enhancer-cpfis' && definition.scenarioId === 'baseline') {
    return tokioMarineWealthEnhancerCpfisBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-enhancer-cpfis' && definition.scenarioId === 'event-heavy') {
    return tokioMarineWealthEnhancerCpfisEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-enhancer-cpfis' && definition.scenarioId === 'ocf-stress') {
    return tokioMarineWealthEnhancerCpfisStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goelite' && definition.scenarioId === 'baseline') {
    return tokioMarineGoEliteBaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended-cash' | 'sgd-open-ended-srs', id)
  }
  if (definition.productId === 'tokio-marine-goelite' && definition.scenarioId === 'event-heavy') {
    return tokioMarineGoEliteEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goelite' && definition.scenarioId === 'ocf-stress') {
    return tokioMarineGoEliteStressPolicy(snapshot, definition.variantId as 'sgd-open-ended-cash' | 'sgd-open-ended-srs', id)
  }
  if (definition.productId === 'tokio-marine-goelite-secure' && definition.scenarioId === 'baseline') {
    return tokioMarineGoEliteSecureBaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended-cash' | 'sgd-open-ended-srs', id)
  }
  if (definition.productId === 'tokio-marine-goelite-secure' && definition.scenarioId === 'event-heavy') {
    return tokioMarineGoEliteSecureEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goelite-secure' && definition.scenarioId === 'ocf-stress') {
    return tokioMarineGoEliteSecureStressPolicy(snapshot, definition.variantId as 'sgd-open-ended-cash' | 'sgd-open-ended-srs', id)
  }
  if (definition.productId === 'tokio-marine-gowealth-enrich' && definition.scenarioId === 'baseline') {
    return tokioMarineGoWealthEnrichBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-gowealth-enrich' && definition.scenarioId === 'event-heavy') {
    return tokioMarineGoWealthEnrichEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-gowealth-enrich' && definition.scenarioId === 'ocf-stress') {
    return tokioMarineGoWealthEnrichStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goassure' && definition.scenarioId === 'baseline') {
    return tokioMarineGoAssureBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goassure' && definition.scenarioId === 'event-heavy') {
    return tokioMarineGoAssureEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goassure' && definition.scenarioId === 'ocf-stress') {
    return tokioMarineGoAssureStressPolicy(snapshot, id)
  }
  if (definition.productId === 'fwd-invest-flexi-vii' && definition.scenarioId === 'baseline') {
    return fwdInvestFlexiViiBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'fwd-invest-flexi-vii' && definition.scenarioId === 'event-heavy') {
    return fwdInvestFlexiViiEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'fwd-invest-flexi-vii' && definition.scenarioId === 'ocf-stress') {
    return fwdInvestFlexiViiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'fwd-invest-goal-1' && definition.scenarioId === 'baseline') {
    return fwdInvestGoal1BaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended' | 'usd-open-ended', id)
  }
  if (definition.productId === 'fwd-invest-goal-1' && definition.scenarioId === 'event-heavy') {
    return fwdInvestGoal1EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'fwd-invest-goal-1' && definition.scenarioId === 'ocf-stress') {
    return fwdInvestGoal1StressPolicy(snapshot, definition.variantId as 'sgd-open-ended' | 'usd-open-ended', id)
  }
  if (definition.productId === 'etiqa-invest-flex-prime-ii' && definition.scenarioId === 'baseline') {
    return etiqaFlexBaselinePolicy(snapshot, 'etiqa-invest-flex-prime-ii', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-flex-prime-ii' && definition.scenarioId === 'event-heavy') {
    return etiqaFlexEventHeavyPolicy(snapshot, 'etiqa-invest-flex-prime-ii', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-flex-prime-ii' && definition.scenarioId === 'ocf-stress') {
    return etiqaFlexStressPolicy(snapshot, 'etiqa-invest-flex-prime-ii', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-flex-pro' && definition.scenarioId === 'baseline') {
    return etiqaFlexBaselinePolicy(snapshot, 'etiqa-invest-flex-pro', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-flex-pro' && definition.scenarioId === 'event-heavy') {
    return etiqaFlexEventHeavyPolicy(snapshot, 'etiqa-invest-flex-pro', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-flex-pro' && definition.scenarioId === 'ocf-stress') {
    return etiqaFlexStressPolicy(snapshot, 'etiqa-invest-flex-pro', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-vista' && definition.scenarioId === 'baseline') {
    return etiqaFlexBaselinePolicy(snapshot, 'etiqa-invest-vista', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-vista' && definition.scenarioId === 'event-heavy') {
    return etiqaFlexEventHeavyPolicy(snapshot, 'etiqa-invest-vista', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-vista' && definition.scenarioId === 'ocf-stress') {
    return etiqaFlexStressPolicy(snapshot, 'etiqa-invest-vista', definition.variantId as
      | 'sgd-mip-10-flexi-3'
      | 'sgd-mip-10-flexi-5'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-flex-wealth-ii' && definition.scenarioId === 'baseline') {
    return etiqaCumulativeBaselinePolicy(snapshot, 'etiqa-invest-flex-wealth-ii', definition.variantId as
      | 'sgd-mip-10'
      | 'sgd-mip-15'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-flex-wealth-ii' && definition.scenarioId === 'event-heavy') {
    return etiqaCumulativeEventHeavyPolicy(snapshot, 'etiqa-invest-flex-wealth-ii', id)
  }
  if (definition.productId === 'etiqa-invest-flex-wealth-ii' && definition.scenarioId === 'ocf-stress') {
    return etiqaCumulativeStressPolicy(snapshot, 'etiqa-invest-flex-wealth-ii', id)
  }
  if (definition.productId === 'etiqa-invest-smart-flex-ii' && definition.scenarioId === 'baseline') {
    return etiqaCumulativeBaselinePolicy(snapshot, 'etiqa-invest-smart-flex-ii', definition.variantId as
      | 'sgd-mip-10'
      | 'sgd-mip-15'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-smart-flex-ii' && definition.scenarioId === 'event-heavy') {
    return etiqaCumulativeEventHeavyPolicy(snapshot, 'etiqa-invest-smart-flex-ii', id)
  }
  if (definition.productId === 'etiqa-invest-smart-flex-ii' && definition.scenarioId === 'ocf-stress') {
    return etiqaCumulativeStressPolicy(snapshot, 'etiqa-invest-smart-flex-ii', id)
  }
  if (definition.productId === 'etiqa-invest-smart-vista' && definition.scenarioId === 'baseline') {
    return etiqaCumulativeBaselinePolicy(snapshot, 'etiqa-invest-smart-vista', definition.variantId as
      | 'sgd-mip-10'
      | 'sgd-mip-15'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-smart-vista' && definition.scenarioId === 'event-heavy') {
    return etiqaCumulativeEventHeavyPolicy(snapshot, 'etiqa-invest-smart-vista', id)
  }
  if (definition.productId === 'etiqa-invest-smart-vista' && definition.scenarioId === 'ocf-stress') {
    return etiqaCumulativeStressPolicy(snapshot, 'etiqa-invest-smart-vista', id)
  }
  if (definition.productId === 'etiqa-invest-wealth-purpose' && definition.scenarioId === 'baseline') {
    return etiqaCumulativeBaselinePolicy(snapshot, 'etiqa-invest-wealth-purpose', definition.variantId as
      | 'sgd-mip-10'
      | 'sgd-mip-15'
      | 'sgd-mip-20', id)
  }
  if (definition.productId === 'etiqa-invest-wealth-purpose' && definition.scenarioId === 'event-heavy') {
    return etiqaCumulativeEventHeavyPolicy(snapshot, 'etiqa-invest-wealth-purpose', id)
  }
  if (definition.productId === 'etiqa-invest-wealth-purpose' && definition.scenarioId === 'ocf-stress') {
    return etiqaCumulativeStressPolicy(snapshot, 'etiqa-invest-wealth-purpose', id)
  }
  if (definition.productId === 'great-eastern-wealth-advantage-4' && definition.scenarioId === 'baseline') {
    return greatEasternWealthAdvantage4BaselinePolicy(snapshot, definition.variantId as
      | 'sgd-mip-10-choice-5'
      | 'sgd-mip-10-choice-10-under-6000'
      | 'sgd-mip-10-choice-10-6000-and-above'
      | 'sgd-mip-15-choice-15-under-6000'
      | 'sgd-mip-15-choice-15-6000-and-above', id)
  }
  if (definition.productId === 'great-eastern-wealth-advantage-4' && definition.scenarioId === 'event-heavy') {
    return greatEasternWealthAdvantage4EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-wealth-advantage-4' && definition.scenarioId === 'ocf-stress') {
    return greatEasternWealthAdvantage4StressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-investment-linked-insurance-plan-2' && definition.scenarioId === 'baseline') {
    return greatEasternInvestmentLinkedInsurancePlan2BaselinePolicy(snapshot, definition.variantId as
      | 'sgd-mip-10-choice-5'
      | 'sgd-mip-10-choice-10-under-6000'
      | 'sgd-mip-10-choice-10-6000-and-above', id)
  }
  if (definition.productId === 'great-eastern-investment-linked-insurance-plan-2' && definition.scenarioId === 'event-heavy') {
    return greatEasternInvestmentLinkedInsurancePlan2EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-investment-linked-insurance-plan-2' && definition.scenarioId === 'ocf-stress') {
    return greatEasternInvestmentLinkedInsurancePlan2StressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-prestige-portfolio' && definition.scenarioId === 'baseline') {
    return greatEasternPrestigePortfolioBaselinePolicy(snapshot, definition.variantId as
      | 'sgd-open-ended-single-premium-cash'
      | 'sgd-open-ended-single-premium-srs'
      | 'sgd-open-ended-recurrent-single-premium-srs', id)
  }
  if (definition.productId === 'great-eastern-prestige-portfolio' && definition.scenarioId === 'event-heavy') {
    return greatEasternPrestigePortfolioEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-prestige-portfolio' && definition.scenarioId === 'ocf-stress') {
    return greatEasternPrestigePortfolioStressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-sp' && definition.scenarioId === 'baseline') {
    return greatEasternGiaSpBaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis', id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-sp' && definition.scenarioId === 'event-heavy') {
    return greatEasternGiaSpEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-sp' && definition.scenarioId === 'ocf-stress') {
    return greatEasternGiaSpStressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-sp' && definition.scenarioId === 'baseline') {
    return greatEasternGia2SpBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-sp' && definition.scenarioId === 'event-heavy') {
    return greatEasternGia2SpEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-sp' && definition.scenarioId === 'ocf-stress') {
    return greatEasternGia2SpStressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-rsp' && definition.scenarioId === 'baseline') {
    return greatEasternGiaRspBaselinePolicy(snapshot, definition.variantId as 'sgd-open-ended-cash-or-srs' | 'sgd-open-ended-cpfis', id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-rsp' && definition.scenarioId === 'event-heavy') {
    return greatEasternGiaRspEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-rsp' && definition.scenarioId === 'ocf-stress') {
    return greatEasternGiaRspStressPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-rsp' && definition.scenarioId === 'baseline') {
    return greatEasternGia2RspBaselinePolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-rsp' && definition.scenarioId === 'event-heavy') {
    return greatEasternGia2RspEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'great-eastern-great-invest-advantage-2-rsp' && definition.scenarioId === 'ocf-stress') {
    return greatEasternGia2RspStressPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'event-heavy') {
    return prosperEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'holiday-fallback') {
    return prosperHolidayFallbackPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-prosper' && definition.scenarioId === 'ocf-stress-split') {
    return prosperStressPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'baseline') {
    return assureIiBaselinePolicy(snapshot, definition.variantId, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'assurance-tail') {
    return assureIiBoundedAssurancePolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'event-heavy') {
    return assureIiEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'holiday-fallback') {
    return assureIiHolidayFallbackPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'ocf-stress-split') {
    return assureIiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'prudential-pruvantage-assure-ii' && definition.scenarioId === 'assurance-state-override') {
    return assureIiStateOverridePolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-flexi-protector' && definition.scenarioId === 'baseline') {
    return hsbcFlexiProtectorBaselinePolicy(
      snapshot,
      definition.variantId as 'sgd-open-ended-choice-cover' | 'sgd-open-ended-max-cover',
      id,
    )
  }
  if (definition.productId === 'hsbc-life-flexi-protector' && definition.scenarioId === 'event-heavy') {
    return hsbcFlexiProtectorEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'hsbc-life-flexi-protector' && definition.scenarioId === 'ocf-stress') {
    return hsbcFlexiProtectorStressPolicy(
      snapshot,
      definition.variantId as 'sgd-open-ended-choice-cover' | 'sgd-open-ended-max-cover',
      id,
    )
  }
  if (definition.productId === 'tokio-marine-atlas-wealth' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-25-advanced-death') {
      return tokioAtlasAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-atlas-wealth',
      'sgd-mip-25',
      id,
      'Golden Tokio Marine TM Atlas Wealth (SGD / MIP 25 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-atlas-wealth' && definition.scenarioId === 'event-heavy') {
    return tokioAtlasEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-atlas-wealth' && definition.scenarioId === 'ocf-stress') {
    return tokioAtlasStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goclassic' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-25-advanced-death') {
      return tokioGoClassicAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-goclassic',
      'sgd-mip-25',
      id,
      'Golden Tokio Marine #goClassic (SGD / MIP 25 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-goclassic' && definition.scenarioId === 'event-heavy') {
    return tokioGoClassicEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goclassic' && definition.scenarioId === 'ocf-stress') {
    return tokioGoClassicStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goclassic-secure' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-25-advanced-death') {
      return tokioGoClassicSecureAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-goclassic-secure',
      'sgd-mip-25',
      id,
      'Golden Tokio Marine #goClassic Secure (SGD / MIP 25 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-goclassic-secure' && definition.scenarioId === 'event-heavy') {
    return tokioGoClassicSecureEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goclassic-secure' && definition.scenarioId === 'ocf-stress') {
    return tokioGoClassicSecureStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-builder-atfuture' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-10-advanced-death') {
      return tokioHarvestBuilderAtfutureAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-harvest-builder-atfuture',
      'sgd-mip-10',
      id,
      'Golden Tokio Marine Harvest Builder@Future (SGD / MIP 10 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-harvest-builder-atfuture' && definition.scenarioId === 'event-heavy') {
    return tokioHarvestBuilderAtfutureEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-builder-atfuture' && definition.scenarioId === 'ocf-stress') {
    return tokioHarvestBuilderAtfutureStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-builder-atfuture' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-10-advanced-death') {
      return tokioWealthBuilderAtfutureAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-wealth-builder-atfuture',
      'sgd-mip-10',
      id,
      'Golden Tokio Marine Wealth Builder@Future (SGD / MIP 10 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-wealth-builder-atfuture' && definition.scenarioId === 'event-heavy') {
    return tokioWealthBuilderAtfutureEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-builder-atfuture' && definition.scenarioId === 'ocf-stress') {
    return tokioWealthBuilderAtfutureStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-flexi-link-3-12' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-12-advanced-death') {
      return tokioWealthFlexiLink312AdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-wealth-flexi-link-3-12',
      'sgd-mip-12',
      id,
      'Golden Tokio Marine Wealth Flexi-Link 3.12 (SGD / MIP 12 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-wealth-flexi-link-3-12' && definition.scenarioId === 'event-heavy') {
    return tokioWealthFlexiLink312EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-flexi-link-3-12' && definition.scenarioId === 'ocf-stress') {
    return tokioWealthFlexiLink312StressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-flexi-link-5-10' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-10-advanced-death') {
      return tokioWealthFlexiLink510AdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-wealth-flexi-link-5-10',
      'sgd-mip-10',
      id,
      'Golden Tokio Marine Wealth Flexi-Link 5.10 (SGD / MIP 10 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-wealth-flexi-link-5-10' && definition.scenarioId === 'event-heavy') {
    return tokioWealthFlexiLink510EventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-flexi-link-5-10' && definition.scenarioId === 'ocf-stress') {
    return tokioWealthFlexiLink510StressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-flexi' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-10-advanced-death') {
      return tokioWealthFlexiAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-wealth-flexi',
      'sgd-mip-10',
      id,
      'Golden Tokio Marine Wealth Flexi (SGD / MIP 10 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-wealth-flexi' && definition.scenarioId === 'event-heavy') {
    return tokioWealthFlexiEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-flexi' && definition.scenarioId === 'ocf-stress') {
    return tokioWealthFlexiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-flexi' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-10-advanced-death') {
      return tokioHarvestFlexiAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-harvest-flexi',
      'sgd-mip-10',
      id,
      'Golden Tokio Marine Harvest Flexi (SGD / MIP 10 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-harvest-flexi' && definition.scenarioId === 'event-heavy') {
    return tokioHarvestFlexiEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-flexi' && definition.scenarioId === 'ocf-stress') {
    return tokioHarvestFlexiStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-pro' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-10-advanced-death') {
      return tokioHarvestProAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-harvest-pro',
      'sgd-mip-10',
      id,
      'Golden Tokio Marine Harvest Pro (SGD / MIP 10 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-harvest-pro' && definition.scenarioId === 'event-heavy') {
    return tokioHarvestProEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-pro' && definition.scenarioId === 'structural-proof') {
    return tokioHarvestProStructuralProofPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-pro' && definition.scenarioId === 'ocf-stress') {
    return tokioHarvestProStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-max' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-15-advanced-death') {
      return tokioHarvestMaxAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-harvest-max',
      'sgd-mip-15',
      id,
      'Golden Tokio Marine Harvest Max (SGD / MIP 15 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-harvest-max' && definition.scenarioId === 'event-heavy') {
    return tokioHarvestMaxEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-harvest-max' && definition.scenarioId === 'ocf-stress') {
    return tokioHarvestMaxStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-affluence-atfuture' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-15-advanced-death') {
      return tokioAffluenceAtFutureAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-affluence-atfuture',
      'sgd-mip-15',
      id,
      'Golden Tokio Marine Affluence@Future (SGD / MIP 15 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-affluence-atfuture' && definition.scenarioId === 'event-heavy') {
    return tokioAffluenceAtFutureEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-affluence-atfuture' && definition.scenarioId === 'ocf-stress') {
    return tokioAffluenceAtFutureStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goluxe' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-15-advanced-death') {
      return tokioGoLuxeAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-goluxe',
      'sgd-mip-15',
      id,
      'Golden Tokio Marine #goLuxe (SGD / MIP 15 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-goluxe' && definition.scenarioId === 'event-heavy') {
    return tokioGoLuxeEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goluxe' && definition.scenarioId === 'ocf-stress') {
    return tokioGoLuxeStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goaffluence' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-15-advanced-death') {
      return tokioGoAffluenceAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-goaffluence',
      'sgd-mip-15',
      id,
      'Golden Tokio Marine #goAffluence (SGD / MIP 15 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-goaffluence' && definition.scenarioId === 'event-heavy') {
    return tokioGoAffluenceEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-goaffluence' && definition.scenarioId === 'ocf-stress') {
    return tokioGoAffluenceStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-max-ii' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-15-advanced-death') {
      return tokioWealthMaxAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-wealth-max-ii',
      'sgd-mip-15',
      id,
      'Golden Tokio Marine Wealth Max (II) (SGD / MIP 15 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-wealth-max-ii' && definition.scenarioId === 'event-heavy') {
    return tokioEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-max-ii' && definition.scenarioId === 'ocf-stress') {
    return tokioWealthMaxStressPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'baseline') {
    if (definition.variantId === 'sgd-mip-10-advanced-death') {
      return tokioWealthProAdvancedDeathBaselinePolicy(snapshot, id)
    }
    return tokioBaselinePolicy(
      snapshot,
      'tokio-marine-wealth-pro-ii',
      'sgd-mip-10',
      id,
      'Golden Tokio Marine Wealth Pro (II) (SGD / MIP 10 Baseline)',
    )
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'event-heavy') {
    return tokioWealthProEventHeavyPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'waived-charges') {
    return tokioWealthProWaivedChargesPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'structural-proof') {
    return tokioWealthProStructuralProofPolicy(snapshot, id)
  }
  if (definition.productId === 'tokio-marine-wealth-pro-ii' && definition.scenarioId === 'ocf-stress') {
    return tokioWealthProStressPolicy(snapshot, id)
  }

  throw new Error(`No golden policy builder is defined for ${definition.productId}:${definition.variantId}:${definition.scenarioId}.`)
}

export function listGoldenFixtureCoverageTargets(): GoldenFixtureCoverageTarget[] {
  return GOLDEN_FIXTURE_MANIFEST.map((fixture) => ({
    productId: fixture.productId,
    variantId: fixture.variantId,
    scenarioId: fixture.scenarioId,
    fixtureClass: fixture.fixtureClass,
    coverageTags: [...fixture.coverageTags],
  }))
}

export function buildGoldenIlpFixtureInputs(
  snapshot: Pick<IlpCatalogSnapshot, 'manifest' | 'products'>,
): GoldenIlpFixtureInput[] {
  return GOLDEN_FIXTURE_MANIFEST.map((definition) => {
    const id = `${definition.productId}-${definition.variantId}-${definition.scenarioId}`
    const policy = buildPolicyForDefinition(snapshot, definition)

    return {
      id,
      fileName: `${id}.json`,
      fixtureClass: definition.fixtureClass,
      productId: definition.productId,
      variantId: definition.variantId,
      scenarioId: definition.scenarioId,
      coverageTags: [...definition.coverageTags],
      description: definition.description,
      policy,
      manualSource: definition.manualSource,
      integrityChecks: definition.integrityChecks,
    }
  })
}
