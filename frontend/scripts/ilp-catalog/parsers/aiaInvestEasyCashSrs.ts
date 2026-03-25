import { buildAiaInvestEasyProduct, type ParseContext } from './aiaInvestEasyShared.js'

export function parseAiaInvestEasyCashSrs(context: ParseContext) {
  return buildAiaInvestEasyProduct(context, {
    id: 'aia-invest-easy-cash-srs',
    insurer: 'AIA Singapore',
    productName: 'AIA Invest Easy (Cash/SRS)',
    variantId: 'sgd-open-ended-cash-srs',
    singlePremiumChargeRate: 0.03,
    topUpChargeRate: 0.03,
    recurringTopUpChargeRate: 0.03,
    minimumTopUpAmount: 1_000,
    minimumPartialWithdrawalAmount: 1_000,
    partialWithdrawalMinimumPolicyValue: 1_000,
    modeledEconomics: [
      'branch:aia-invest-easy-cash-srs-three-percent-single-premium-charge',
      'branch:aia-invest-easy-cash-srs-three-percent-top-up-charge',
      'branch:aia-invest-easy-cash-srs-three-percent-recurring-single-premium-charge',
      'branch:aia-invest-easy-cash-srs-zero-partial-withdrawal-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'tokio-recurring-single-premium-routing',
    ],
    metadataOnlyBehaviors: [
      'aia-invest-easy-cash-srs-first-year-accidental-death-claim-exclusions',
      'aia-invest-easy-cash-srs-maturity-benefit',
      'aia-invest-easy-cash-srs-full-surrender',
      'aia-invest-easy-cash-srs-fund-switching',
      'aia-invest-easy-cash-srs-automatic-fund-rebalancing',
      'aia-invest-easy-cash-srs-fund-management-charge',
      'aia-invest-easy-cash-srs-free-look-refund',
      'aia-invest-easy-cash-srs-top-up-age-limit',
    ],
    warnings: [
      'The parser captures the published 3% single-premium, ad-hoc top-up, and regular top-up premium charges for the Cash/SRS corridor through the open-ended no-MIP basis, the published S$1,000 minimum on explicit ad-hoc top-ups, the nil policy-level partial-withdrawal charge path with the published S$1,000 minimum one-off withdrawal amount and S$1,000 residual policy-value floor, and now also models the current-state death benefit as 100% of policy value plus the current first-year accidental-death estimate as the higher of ordinary death benefit or 110% of single premium plus total top-up premium less total withdrawals, while maturity, broader withdrawal and surrender administration, regular top-up cadence-specific minimums, switching, free-look handling, top-up age-limit handling, and fund-level charges remain informational only beyond the modeled current protection estimates.',
      'Cash/SRS funding keeps the same product shell but uses a different premium-charge corridor from the CPF version.',
    ],
    unsupportedItems: [
      'First-year accidental-death claim admission, exclusions, and settlement remain informational only beyond the modeled current accidental-death estimate.',
      'Maturity benefit at insured age 100 remains informational only.',
      'Broader partial-withdrawal administration and full-surrender administration remain informational only.',
      'Fund-switching and automatic fund re-balancing remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected fund mix rather than a single product-level rate.',
      'Free-look refund behavior remains informational only.',
      'Top-up age-limit handling remains informational only.',
    ],
  })
}
