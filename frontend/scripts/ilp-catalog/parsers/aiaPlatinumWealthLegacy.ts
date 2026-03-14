import { buildAiaPlatinumWealthProduct, type ParseContext } from './aiaPlatinumWealthShared.js'

export function parseAiaPlatinumWealthLegacy(context: ParseContext) {
  return buildAiaPlatinumWealthProduct(context, {
    id: 'aia-platinum-wealth-legacy',
    productName: 'AIA Platinum Wealth Legacy',
    planKeyword: 'AIA Platinum Wealth Legacy',
    overviewPage: 1,
    premiumPage: 3,
    chargePage: 3,
    holidayPage: 4,
    topUpPage: 6,
    nonPaymentPage: 7,
    regularPremiumChargeSchedule: [
      { startPolicyYear: 1, endPolicyYear: 1, rate: 0.36 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0.18 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.06 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.06 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.04 },
    ],
    premiumHolidayChargeSchedule: [
      { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0 },
    ],
    modeledEconomics: [
      'branch:aia-platinum-wealth-legacy-regular-premium-charge',
      'branch:aia-platinum-wealth-legacy-top-up-premium-charge',
      'branch:aia-platinum-wealth-legacy-premium-holiday-charge',
    ],
    metadataOnlyBehaviors: [
      'aia-platinum-wealth-legacy-single-premium-corridor',
      'aia-platinum-wealth-legacy-partial-withdrawal-surrender-charge',
      'aia-platinum-wealth-legacy-administration-charge',
      'aia-platinum-wealth-legacy-insurance-risk-charge',
      'aia-platinum-wealth-legacy-no-lapse-privilege',
      'aia-platinum-wealth-legacy-expiry-age-election',
      'aia-platinum-wealth-legacy-protection-benefits',
      'aia-platinum-wealth-legacy-fund-management-charge',
      'aia-platinum-wealth-legacy-layering-and-adjusted-partial-withdrawal',
      'aia-platinum-wealth-legacy-no-fund-switching',
    ],
    productWarning: 'The parser models only the cash regular-pay 5-year corridor: premium-year regular premium charges, the 3% top-up premium charge, and the premium-holiday charge schedule, while the single-pay corridor, partial-withdrawal / surrender schedule, administration charge, insurance risk charge, no-lapse mechanics, and protection-side benefits remain outside the current engine.',
    additionalVariantWarnings: [
      'The published partial-withdrawal / surrender table is left informational only because the summary shows policy years 1 to 10 but does not state the post-year-10 treatment explicitly.',
    ],
    unsupportedItems: [
      'Single-pay corridor and the 5% single-premium charge remain informational only in V1.',
      'Published partial-withdrawal / surrender charge tables remain informational only because the summary does not state the post-year-10 treatment explicitly.',
      'Administration charge remains informational only because the applicable rates live in the policy illustration rather than the product summary.',
      'Insurance Risk Charge, No Lapse Privilege, and expiry-age election mechanics remain informational only.',
      'Adjusted partial withdrawal, layer creation from insured-amount changes, and minimum-insured-amount gating remain informational only.',
      'Death, terminal illness, and other protection-side benefit formulas remain informational only.',
      'Fund-level management charges and no-fund-switching constraints remain informational only.',
    ],
  })
}
