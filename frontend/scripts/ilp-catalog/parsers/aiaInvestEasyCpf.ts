import { buildAiaInvestEasyProduct, type ParseContext } from './aiaInvestEasyShared.js'

export function parseAiaInvestEasyCpf(context: ParseContext) {
  return buildAiaInvestEasyProduct(context, {
    id: 'aia-invest-easy-cpf',
    insurer: 'AIA Singapore',
    productName: 'AIA Invest Easy (CPF)',
    variantId: 'sgd-open-ended-cpf',
    singlePremiumChargeRate: 0,
    topUpChargeRate: 0,
    recurringTopUpChargeRate: 0,
    minimumTopUpAmount: 1_000,
    minimumPartialWithdrawalAmount: 1_000,
    modeledEconomics: [
      'branch:aia-invest-easy-cpf-zero-single-premium-charge',
      'branch:aia-invest-easy-cpf-zero-top-up-charge',
      'branch:aia-invest-easy-cpf-zero-recurring-single-premium-charge',
      'branch:aia-invest-easy-cpf-zero-partial-withdrawal-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'tokio-recurring-single-premium-routing',
    ],
    metadataOnlyBehaviors: [
      'aia-invest-easy-cpf-first-year-accidental-death-claim-exclusions',
      'aia-invest-easy-cpf-maturity-benefit',
      'aia-invest-easy-cpf-full-surrender',
      'aia-invest-easy-cpf-fund-switching',
      'aia-invest-easy-cpf-automatic-fund-rebalancing',
      'aia-invest-easy-cpf-fund-management-charge',
      'aia-invest-easy-cpf-free-look-refund',
      'aia-invest-easy-cpf-cpf-fund-eligibility',
      'aia-invest-easy-cpf-top-up-age-limit',
    ],
    warnings: [
      'The parser captures the published zero-charge single-premium, ad-hoc top-up, and regular top-up allocation path for the CPF-funded corridor through the open-ended no-MIP basis, the published S$1,000 minimum on explicit ad-hoc top-ups, the nil policy-level partial-withdrawal charge path with the published S$1,000 minimum one-off withdrawal amount and S$1,000 residual policy-value floor on explicit one-off withdrawals, and now also models the current-state death benefit as 100% of policy value plus the current first-year accidental-death estimate as the higher of ordinary death benefit or 110% of single premium plus total top-up premium less total withdrawals, while maturity, broader withdrawal and surrender administration, regular top-up cadence-specific minimums, switching, free-look handling, CPF fund-eligibility restrictions, top-up age-limit handling, and fund-level charges remain informational only beyond the modeled current protection estimates.',
      'Fund access is limited to CPFIS-eligible ILP sub-funds.',
    ],
    unsupportedItems: [
      'First-year accidental-death claim admission, exclusions, and settlement remain informational only beyond the modeled current accidental-death estimate.',
      'Maturity benefit at insured age 100 remains informational only.',
      'Broader partial-withdrawal administration remains informational only.',
      'Full-surrender administration remains informational only.',
      'Fund-switching and automatic fund re-balancing remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected fund mix rather than a single product-level rate.',
      'Free-look refund behavior remains informational only.',
      'CPF-eligible fund restrictions and top-up age-limit handling remain informational only.',
    ],
    partialWithdrawalMinimumPolicyValue: 1_000,
  })
}
