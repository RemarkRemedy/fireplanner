import { buildAiaPlatinumWealthProduct, type ParseContext } from './aiaPlatinumWealthShared.js'

export function parseAiaPlatinumWealthElite2(context: ParseContext) {
  return buildAiaPlatinumWealthProduct(context, {
    id: 'aia-platinum-wealth-elite-2',
    productName: 'AIA Platinum Wealth Elite 2.0',
    planKeyword: 'Platinum Wealth Elite 2.0',
    overviewPage: 1,
    premiumPage: 4,
    chargePage: 4,
    holidayPage: 5,
    topUpPage: 8,
    nonPaymentPage: 9,
    regularPremiumChargeSchedule: [
      { startPolicyYear: 1, endPolicyYear: 1, rate: 0.3 },
      { startPolicyYear: 2, endPolicyYear: 2, rate: 0.25 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.15 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.08 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.06 },
    ],
    premiumHolidayChargeSchedule: [
      { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0 },
    ],
    regularFullSurrenderChargeSchedule: [0.5, 0.4, 0.3, 0.2, 0.1, 0],
    regularPartialWithdrawalChargeSchedule: [1, 0.667, 0.429, 0.25, 0.111, 0],
    modeledEconomics: [
      'branch:aia-platinum-wealth-elite-2-regular-premium-charge',
      'branch:aia-platinum-wealth-elite-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-elite-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-elite-2-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-elite-2-full-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'aia-platinum-wealth-elite-2-single-premium-corridor',
      'aia-platinum-wealth-elite-2-premium-term-extension',
      'aia-platinum-wealth-elite-2-administration-charge',
      'aia-platinum-wealth-elite-2-insurance-risk-charge',
      'aia-platinum-wealth-elite-2-free-legacy-cover',
      'aia-platinum-wealth-elite-2-no-lapse-privilege',
      'aia-platinum-wealth-elite-2-income-withdrawal-privilege',
      'aia-platinum-wealth-elite-2-protection-benefits',
      'aia-platinum-wealth-elite-2-fund-management-charge',
      'aia-platinum-wealth-elite-2-change-of-insured-and-layering',
      'aia-platinum-wealth-elite-2-vitality-bonus',
      'aia-platinum-wealth-elite-2-fund-switching-and-rebalancing',
    ],
    productWarning: 'The parser models only the SGD cash regular-pay 5-year corridor: premium-year regular premium charges, the 3% top-up premium charge, the premium-holiday charge schedule, and the regular-premium withdrawal / surrender charge schedules, while the single-pay corridor, premium-term extension, administration charge, insurance risk charge, no-lapse mechanics, and protection-side benefits remain outside the current engine.',
    additionalVariantWarnings: [
      'The current executable slice intentionally excludes the optional extension of the regular premium term beyond five years.',
    ],
    unsupportedItems: [
      'Single-pay corridor and the 5% single-premium charge remain informational only in V1.',
      'Optional extension of the regular premium term beyond five years remains informational only in V1.',
      'Administration charge remains informational only because it depends on issue-age and change-of-insured layering state.',
      'Insurance Risk Charge, Free Legacy Cover, and No Lapse Privilege debt accrual remain informational only.',
      'Income Withdrawal Privilege, vitality-linked bonuses, and change-of-insured effects remain informational only.',
      'Death, terminal illness, and other protection-side benefit formulas remain informational only.',
      'Fund-level management charges, fund switching, and automatic fund re-balancing remain informational only.',
    ],
  })
}
