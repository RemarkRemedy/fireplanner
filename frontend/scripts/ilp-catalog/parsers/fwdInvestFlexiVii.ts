import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const MIP_LENGTH = 10

const INITIAL_ACCOUNT_CHARGE_RATE = 0.024

const BOOSTER_BONUS_TIERS = [
  { currency: 'SGD' as const, minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.2 },
  { currency: 'SGD' as const, minAnnualPremium: 12_000, maxAnnualPremium: 35_999.99, rate: 0.38 },
  { currency: 'SGD' as const, minAnnualPremium: 36_000, maxAnnualPremium: null, rate: 0.42 },
]

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.68 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.58 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.55 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.45 },
] as const

const REDEMPTION_FEE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.68 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.58 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.55 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.45 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.07 },
] as const

const SURRENDER_CHARGE_SCHEDULE = [
  1,
  1,
  0.8,
  0.68,
  0.58,
  0.55,
  0.45,
  0.3,
  0.15,
  0.07,
] as const

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  const normalizedExcerpt = normalizeWhitespace(excerpt)
  return {
    page,
    section,
    excerpt: (normalizedExcerpt || `${section} excerpt unavailable`).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest Flexi VII', 18))
  const page3 = sourceRef(3, 'Bonus overview and support benefits', snippetNear(document, 3, 'Booster Bonus', 22))
  const page4 = sourceRef(4, 'Loyalty Bonus and Support Benefit', snippetNear(document, 4, 'Loyalty Bonus', 28))
  const page5 = sourceRef(5, 'Regular premium and missed-premium behavior', snippetNear(document, 5, 'Regular Premium', 26))
  const page6 = sourceRef(6, 'Top-up premium and initial account charge', snippetNear(document, 6, 'Top-up premium', 26))
  const page7 = sourceRef(7, 'Initial account charge and premium shortfall charge', snippetNear(document, 7, 'Initial account charge', 28))
  const page8 = sourceRef(8, 'Top-up premium charge', snippetNear(document, 8, 'Premium charge', 18))
  const page9 = sourceRef(9, 'Premium shortfall and redemption fee', snippetNear(document, 9, 'premium shortfall charge', 28))
  const page10 = sourceRef(10, 'Surrender charge', snippetNear(document, 10, 'Surrender charge', 24))
  const page12 = sourceRef(12, 'Withdrawal rules and minimum account value', snippetNear(document, 12, 'Withdrawals are allowed', 24))
  const page13 = sourceRef(13, 'Regular withdrawal and change of person insured', snippetNear(document, 13, 'Regular withdrawal', 18))

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'booster-bonus',
      type: 'sign-up',
      label: 'Booster Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      annualPremiumTierBasis: 'committed-annual-premium-at-issue',
      rate: null,
      amount: null,
      tieredRates: BOOSTER_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Applied on each regular premium received during the first policy year, using the published Annualised Regular Premium band at issue.',
        'Top-up premiums do not earn Booster Bonus; loyalty-bonus and repayment-restoration mechanics remain informational only in V1.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'annual-premium-bonus',
      type: 'allocation',
      label: 'Annual Premium Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 7,
      rate: 0.01,
      amount: null,
      requiresPremiumsPaidUpToDate: true,
      requiredRegularPremiumPaymentFrequency: 'annual',
      tieredRates: [],
      notes: [
        'Applied on each annual regular premium paid via the annual premium payment frequency option during the first 7 policy years.',
        'Repayment and restoration interactions remain informational only in V1.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'loyalty-bonus-y11-to-y20',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Years 11-20)',
      mode: 'annual-rate',
      appliesTo: ['initial'],
      startPolicyYear: 11,
      endPolicyYear: 20,
      rate: 0.015,
      amount: null,
      tieredRates: [],
      notes: [
        'Applied annually on the initial units account value from policy years 11 to 20.',
        'Manual policy-repayment events credited into the initial units account can model the published Loyalty Bonus restoration on repayment amounts for the current policy year.',
        'Pending-transaction timing and repayment-allocation waterfalls remain informational only in V1.',
      ],
      restorationRules: [
        { trigger: 'policy-repayment', basis: 'repaid-premium' },
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'loyalty-bonus-y21-plus',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Year 21+)',
      mode: 'annual-rate',
      appliesTo: ['initial'],
      startPolicyYear: 21,
      endPolicyYear: null,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      notes: [
        'Applied annually on the initial units account value from policy year 21 onward.',
        'Manual policy-repayment events credited into the initial units account can model the published Loyalty Bonus restoration on repayment amounts for the current policy year.',
        'Pending-transaction timing and repayment-allocation waterfalls remain informational only in V1.',
      ],
      restorationRules: [
        { trigger: 'policy-repayment', basis: 'repaid-premium' },
      ],
      sourceRefs: [page3, page4],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'initial-account-charge',
      label: 'Initial Account Charge',
      basis: 'premium-base-mip-multiplier',
      yearBasis: 'policy-year',
      rate: INITIAL_ACCOUNT_CHARGE_RATE,
      amount: 0,
      appliesTo: ['initial'],
      fallbackAppliesTo: ['accumulation'],
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: 9, mode: 'policy-year' },
          { startPolicyYear: 10, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
        ],
      },
      activeWindow: 'policy-term',
      notes: [
        'Models the published monthly initial-account charge throughout the policy term.',
        'The charge stays anchored to the commencement-date annualised regular premium and therefore does not reduce after non-payment or premium reduction.',
        'If the initial units account is insufficient, the remaining deduction falls back to the accumulation units account.',
      ],
      sourceRefs: [page6, page7],
    },
    {
      id: 'insurance-charge',
      label: 'Insurance Charge',
      basis: 'assurance-sum-at-risk',
      rate: 0,
      amount: 0,
      appliesTo: ['initial'],
      fallbackAppliesTo: ['accumulation'],
      assuranceValueAppliesTo: ['initial', 'accumulation'],
      activeWindow: 'policy-term',
      requiresManualInput: true,
      assuranceConfig: {
        formula: 'fwd-invest-repayment-inclusive-death',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      notes: [
        'Requires insured-life details and the current net regular-premium, supplementary / top-up, and repayment bases before the calculator can model the monthly insurance charge.',
        'Models the published Appendix B attained-age / sex / smoker insurance charge on the 101% paid-premium-and-repayment protected base, net of policy value.',
        'The charge is deducted from the initial units account first, with accumulation units account fallback if the initial account is insufficient.',
      ],
      sourceRefs: [page1, page7],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted top-up premium.',
        'V1 blocks top-ups below the published S$3,000 minimum, before policy month 13, and until missed-premium, prior initial-account withdrawal, and regular-premium-reduction obligations are fully cleared through repayment events.',
        'The exact repayment-allocation waterfall and the total top-up cap remain informational only in V1.',
      ],
      sourceRefs: [page6, page8],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['initial'],
      fallbackAppliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge on unpaid regular premium during policy years 3 to 7 after the grace period.',
        'Mark the premium-holiday event with an insurer-approved charge waiver when Support Benefit approval or an already-admitted Premium Pause Waiver applies for that missed-premium period.',
        'Mark the same premium-holiday event as charge-refunded when the charge was deducted first and later refunded after admitted Support Benefit approval.',
        'Automatic 12-month Premium Pause Waiver activation, month accounting, and repayment-allocation waterfalls remain informational only in V1.',
      ],
      sourceRefs: [page7, page9],
    },
    {
      id: 'premium-shortfall-charge-refund',
      label: 'Premium Shortfall Charge Refund',
      trigger: 'premium-holiday',
      basis: 'source-event-charge-refund',
      appliesTo: ['initial'],
      rate: 1,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      sourceChargeRuleId: 'premium-shortfall-charge',
      notes: [
        'Models the published retrospective refund of deducted premium shortfall charge after admitted Support Benefit approval.',
        'Use the same premium-holiday event and mark it as charge-refunded when the charge was deducted between the qualifying event date and notification date and later refunded.',
        'Automatic Premium Pause Waiver activation, waiting-period gating, and repayment-allocation waterfalls remain informational only in V1.',
      ],
      sourceRefs: [page4, page9],
    },
    {
      id: 'initial-account-redemption-fee',
      label: 'Initial Account Redemption Fee',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['initial'],
      rate: 0,
      rateSchedule: REDEMPTION_FEE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published initial-units-account redemption fee schedule during the 10-year minimum investment term.',
        'Accumulation-units-account withdrawals remain charge-free in the published summary.',
        'V1 blocks authored initial-units-account withdrawals before policy month 25 and enforces the published minimum-account-value floor on explicit one-off partial-withdrawal events.',
        'Minimum withdrawal amount, regular-withdrawal elections, and broader withdrawal administration remain informational only.',
      ],
      sourceRefs: [page9, page12],
    },
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: MIP_LENGTH,
    icpMonths: 1,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page7, page12],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page5, page6, page12],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_SCHEDULE],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumTopUpAmount: 3_000,
      minimumTopUpStartPolicyMonth: 13,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'initial', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'initial', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
      topUpRepaymentClearance: {
        includeMissedPremiums: true,
        priorOffsetRules: [
          { trigger: 'partial-withdrawal', accountIds: ['initial'] },
          { trigger: 'regular-premium-reduction' },
        ],
      },
    },
    warnings: [
      'FWD Invest Flexi VII (SGD / 10-year minimum investment term) is cataloged as a supported V1 product. The parser captures the published Booster Bonus, fixed-premium-base initial-account charge, annual-premium bonus under the annual premium-frequency assumption, the Appendix B insurance charge with manual repayment-base input, the 5% top-up premium charge with blocking below the published S$3,000 minimum, before policy month 13, and aggregate repayment-clearance gating for missed premiums, prior initial-account withdrawals, and regular-premium-reduction differences, the premium shortfall charge corridor with admitted-state charge-waiver and retrospective charge-refund support on premium-holiday events, the initial-units-account redemption-fee schedule, and the initial-units-account surrender-charge schedule.',
      'Automatic 12-month Premium Pause Waiver activation, Support Benefit approval history, and repayment-allocation waterfalls remain outside the current engine.',
      'Repayment-allocation waterfalls, payment-frequency changes after issue, and broader withdrawal administration remain outside the current engine beyond the modeled initial-account policy-month-25 gate and S$3,000 minimum-account-value floor for explicit one-off partial withdrawals.',
    ],
    unsupportedItems: [
      'Automatic 12-month Premium Pause Waiver activation and month accounting, Support Benefit approval history, and broader premium-shortfall recovery behavior remain informational only beyond the modeled admitted-state charge-waived / charge-refunded premium-holiday path.',
      'Changing the regular premium payment frequency after issue remains informational only.',
      'The exact repayment-allocation waterfall and total top-up cap remain informational only beyond the modeled aggregate top-up-clearance gate and the published S$3,000 minimum top-up amount.',
      'Regular-premium reduction and restoration mechanics from policy year 8 onward remain informational only.',
      'Minimum withdrawal requirements, regular-withdrawal elections, and broader withdrawal administration remain informational only beyond the modeled initial-units-account policy-month-25 gate and S$3,000 minimum-account-value floor.',
      'Policy closure charge, change-of-person-insured handling, switching-fee review rights, and fund-level management charges remain informational only.',
    ],
    sourceRefs: [page1, page3, page5, page6, page7, page8, page9, page10, page12, page13],
  }
}

export function parseFwdInvestFlexiVii(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-flexi-vii',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest Flexi VII',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:protected-base-assurance',
      'branch:fwd-invest-flexi-vii-booster-bonus',
      'branch:fwd-invest-flexi-vii-annual-premium-bonus',
      'branch:fwd-invest-flexi-vii-loyalty-bonus',
      'branch:fwd-invest-flexi-vii-initial-account-charge',
      'branch:fwd-invest-flexi-vii-insurance-charge',
      'branch:fwd-invest-flexi-vii-premium-shortfall-charge',
      'branch:fwd-invest-flexi-vii-top-up-premium-charge',
      'branch:fwd-invest-flexi-vii-initial-account-redemption-fee',
      'branch:fwd-invest-flexi-vii-initial-account-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-repayment-clearance-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
    ],
    coveredElsewhereBehaviors: [
      'fwd-invest-flexi-vii-policy-closure-charge',
      'fwd-invest-flexi-vii-fund-level-charges',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-flexi-vii-premium-pause-waiver',
      'fwd-invest-flexi-vii-support-benefit-waiver-and-refund',
      'fwd-invest-flexi-vii-regular-premium-reduction-and-restoration',
      'fwd-invest-flexi-vii-minimum-withdrawal-and-regular-withdrawal-administration',
      'fwd-invest-flexi-vii-change-of-person-insured',
      'fwd-invest-flexi-vii-fund-switching',
    ],
    warnings: [
      'FWD Invest Flexi VII is cataloged as a supported V1 product. The current parser covers the published current-state ordinary death benefit as the higher of 105% of policy value or the 101% protected premium-and-repayment base, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap subject to the published S$2 million per-life limit, Booster Bonus, Loyalty Bonus, the fixed-premium-base initial-account charge, Appendix B insurance charge with manual repayment-base input, the premium shortfall charge corridor with admitted-state charge-waiver and retrospective charge-refund support on premium-holiday events, the 5% top-up premium charge with blocking below the published S$3,000 minimum, before policy month 13, and aggregate repayment-clearance gating for missed premiums, prior initial-account withdrawals, and regular-premium-reduction differences, the initial-units-account redemption-fee schedule, the initial-units-account policy-month-25 one-off partial-withdrawal gate with the published S$3,000 minimum-account-value floor, and the initial-units-account surrender-charge schedule through the existing two-account and surrender kernels.',
      'Automatic Premium Pause Waiver activation, Support Benefit approval history, the exact repayment-allocation waterfall, and broader withdrawal / premium-flexibility behavior remain metadata-only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document),
    ],
  }
}
