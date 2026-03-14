import { buildAiaInvestEasyProduct, type ParseContext } from './aiaInvestEasyShared.js'

export function parseAiaInvestEasyCashSrs(context: ParseContext) {
  return buildAiaInvestEasyProduct(context, {
    id: 'aia-invest-easy-cash-srs',
    insurer: 'AIA Singapore',
    productName: 'AIA Invest Easy (Cash/SRS)',
    variantId: 'sgd-open-ended-cash-srs',
    singlePremiumChargeRate: 0.03,
    topUpChargeRate: 0.03,
    modeledEconomics: [
      'branch:aia-invest-easy-cash-srs-three-percent-single-premium-charge',
      'branch:aia-invest-easy-cash-srs-three-percent-top-up-charge',
    ],
    metadataOnlyBehaviors: [
      'aia-invest-easy-cash-srs-death-benefit',
      'aia-invest-easy-cash-srs-first-year-accidental-death-benefit',
      'aia-invest-easy-cash-srs-maturity-benefit',
      'aia-invest-easy-cash-srs-partial-withdrawal',
      'aia-invest-easy-cash-srs-full-surrender',
      'aia-invest-easy-cash-srs-fund-switching',
      'aia-invest-easy-cash-srs-automatic-fund-rebalancing',
      'aia-invest-easy-cash-srs-fund-management-charge',
      'aia-invest-easy-cash-srs-free-look-refund',
      'aia-invest-easy-cash-srs-top-up-age-limit',
    ],
    warnings: [
      'The parser captures the published 3% single-premium and 3% top-up premium charges for the Cash/SRS corridor through the open-ended no-MIP basis, while protection benefits, withdrawals, switching, and fund-level charges remain outside the current engine.',
      'Cash/SRS funding keeps the same product shell but uses a different premium-charge corridor from the CPF version.',
    ],
    unsupportedItems: [
      'Death and first-year accidental death benefit formulas remain informational only.',
      'Maturity benefit at insured age 100 remains informational only.',
      'Partial-withdrawal and full-surrender administration remain informational only.',
      'Fund-switching and automatic fund re-balancing remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected fund mix rather than a single product-level rate.',
      'Free-look refund behavior remains informational only.',
      'Top-up age-limit handling remains informational only.',
    ],
  })
}
