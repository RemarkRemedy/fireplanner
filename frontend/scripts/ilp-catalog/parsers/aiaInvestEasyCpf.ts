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
    modeledEconomics: [
      'branch:aia-invest-easy-cpf-zero-single-premium-charge',
      'branch:aia-invest-easy-cpf-zero-top-up-charge',
      'branch:aia-invest-easy-cpf-zero-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
    ],
    metadataOnlyBehaviors: [
      'aia-invest-easy-cpf-death-benefit',
      'aia-invest-easy-cpf-first-year-accidental-death-benefit',
      'aia-invest-easy-cpf-maturity-benefit',
      'aia-invest-easy-cpf-partial-withdrawal',
      'aia-invest-easy-cpf-full-surrender',
      'aia-invest-easy-cpf-fund-switching',
      'aia-invest-easy-cpf-automatic-fund-rebalancing',
      'aia-invest-easy-cpf-fund-management-charge',
      'aia-invest-easy-cpf-free-look-refund',
      'aia-invest-easy-cpf-cpf-fund-eligibility',
      'aia-invest-easy-cpf-top-up-age-limit',
    ],
    warnings: [
      'The parser captures the published zero-charge single-premium, ad-hoc top-up, and regular top-up allocation path for the CPF-funded corridor through the open-ended no-MIP basis, while protection benefits, withdrawals, switching, and fund-level charges remain outside the current engine.',
      'Fund access is limited to CPFIS-eligible ILP sub-funds.',
    ],
    unsupportedItems: [
      'Death and first-year accidental death benefit formulas remain informational only.',
      'Maturity benefit at insured age 100 remains informational only.',
      'Partial-withdrawal and full-surrender administration remain informational only.',
      'Fund-switching and automatic fund re-balancing remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected fund mix rather than a single product-level rate.',
      'Free-look refund behavior remains informational only.',
      'CPF-eligible fund restrictions and top-up age-limit handling remain informational only.',
    ],
  })
}
