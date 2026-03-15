import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateBonusTier,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const MIP_LENGTH = 12

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  0.92,
  0.85,
  0.78,
  0.75,
  0.68,
  0.58,
  0.48,
  0.075,
  0.015,
  0.01,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.92 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.85 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.78 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.75 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.68 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.58 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.48 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.075 },
  { startPolicyYear: 11, endPolicyYear: 11, rate: 0.015 },
  { startPolicyYear: 12, endPolicyYear: 12, rate: 0.01 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.16 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
]

const POWER_UP_BONUS_POLICY_YEAR_10_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 23_999.99, rate: 0.01 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.014 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.017 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0195 },
] as const

const POWER_UP_BONUS_POLICY_YEAR_11_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 23_999.99, rate: 0.015 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.019 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.022 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0245 },
] as const

const POWER_UP_BONUS_POLICY_YEAR_12_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 23_999.99, rate: 0.0305 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0345 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0375 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.04 },
] as const

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  return {
    page,
    section,
    excerpt: normalizeWhitespace(excerpt).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 6): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const page3 = sourceRef(3, 'Premium Bonus / Power-up Bonus', snippetNear(document, 3, 'Premium Bonus', 34))
  const page4 = sourceRef(4, 'Loyalty Bonus / Involuntary Unemployment Benefit', snippetNear(document, 4, 'Loyalty Bonus', 24))

  return [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['accumulation'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: INITIAL_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Tier is based on the published SGD annualised regular premium band for Wealth Flexi-Link 3.12.',
        'Allocated to the Accumulation Units Account in the first policy year.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'premium-bonus',
      type: 'custom',
      label: 'Premium Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: 12,
      rate: 0.0023,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual premium bonus on Total Investment Value from the end of policy year 4 until the end of the minimum investment period.',
        'The source document conditions payment on all regular premiums due in the prior 12 months being paid and no withdrawals from the Accumulation Units Account in the prior 12 months; those gates remain manual review assumptions in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus-policy-year-10',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 10)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 10,
      endPolicyYear: 10,
      rate: null,
      amount: null,
      tieredRates: POWER_UP_BONUS_POLICY_YEAR_10_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 10 using the published SGD annualised regular premium bands.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus-policy-year-11',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 11)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: 11,
      rate: null,
      amount: null,
      tieredRates: POWER_UP_BONUS_POLICY_YEAR_11_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 11 using the published SGD annualised regular premium bands.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus-policy-year-12',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 12)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 12,
      endPolicyYear: 12,
      rate: null,
      amount: null,
      tieredRates: POWER_UP_BONUS_POLICY_YEAR_12_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 12 using the published SGD annualised regular premium bands.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 13,
      endPolicyYear: null,
      rate: 0.0055,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual loyalty bonus on Total Investment Value from the end of policy year 13 onward.',
        'The source document conditions payment on no withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page4],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page10 = sourceRef(10, 'Policy Charge', snippetNear(document, 10, 'Policy Charge', 26))

  return [
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.0245,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly policy charge during the minimum investment period as 2.45% p.a. of Total Investment Value.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'policy-charge-after-mip',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.006,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'after-mip',
      notes: [
        'Models the published monthly policy charge after the minimum investment period as 0.60% p.a. of Total Investment Value.',
      ],
      sourceRefs: [page10],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'Wealth Flexi-Link 3.12', 18))
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const page3 = sourceRef(3, 'Premium Bonus / Power-up Bonus', snippetNear(document, 3, 'Premium Bonus', 34))
  const page4 = sourceRef(4, 'Loyalty Bonus / Involuntary Unemployment Benefit', snippetNear(document, 4, 'Loyalty Bonus', 24))
  const page5 = sourceRef(5, 'Regular Premium Routing / Reduction', snippetNear(document, 5, '100% of the regular premium paid', 20))
  const page6 = sourceRef(6, 'Recurring Single Premium / Top-up Premium', snippetNear(document, 6, 'Recurring Single Premium', 26))
  const page7 = sourceRef(7, 'Non-payment / Partial Withdrawal', snippetNear(document, 7, 'Non-payment of Regular Premium', 30))
  const page8 = sourceRef(8, 'Regular Withdrawal / Full Surrender', snippetNear(document, 8, 'Regular Withdrawal', 24))
  const page9 = sourceRef(9, 'Dividend Distribution', snippetNear(document, 9, 'Dividend Distribution', 24))
  const page10 = sourceRef(10, 'Policy Charge / MPC', snippetNear(document, 10, 'Policy Charge', 26))
  const page11 = sourceRef(11, 'Premium Shortfall Charge', snippetNear(document, 11, 'Premium Shortfall Charge', 24))
  const page17 = sourceRef(17, 'Appendix A Charges', snippetNear(document, 17, 'SURRENDER CHARGE', 28))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each top-up premium allocation to the Top-up Units Account.',
      ],
      sourceRefs: [page6, page10],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['topup'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each recurring single premium allocation to the Top-up Units Account.',
      ],
      sourceRefs: [page6, page10],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0,
      rateSchedule: PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies only to partial withdrawals from the Accumulation Units Account during the minimum investment period.',
        'Partial withdrawals from the Accumulation Units Account are not allowed in the first two policy years.',
      ],
      sourceRefs: [page7, page11, page17],
    },
    {
      id: 'premium-shortfall-charge-non-payment',
      label: 'Premium Shortfall Charge (Non-payment)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when regular premium is not paid after the grace period during policy year 3.',
        'Deduct from Accumulation Units Account first, then Top-up Units Account.',
        'The involuntary unemployment benefit waiver remains metadata-only.',
      ],
      sourceRefs: [page4, page7, page11, page17],
    },
  ]

  return {
    id: 'sgd-mip-12',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 1,
    accounts: [
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page5, page10],
      },
      {
        id: 'topup',
        label: 'Top-up Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page6, page7],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: buildFeeRules(document),
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      'This partial template models the SGD / MIP 12 corridor only.',
      'This partial template models regular-premium routing to the Accumulation Units Account, top-up routing, recurring single premium routing, a 2.45% account-value policy charge during the minimum investment period, a 0.60% account-value policy charge thereafter, and the published surrender, partial-withdrawal, and premium-shortfall charge schedules.',
      'Premium bonus, power-up bonus, and loyalty bonus are modeled at the published rate windows, but their paid-up and no-withdrawal eligibility gates remain manual review assumptions.',
      'Recurring single premium stays blocked after a premium-holiday event until regular premium resumes at the commencement-date amount.',
    ],
    unsupportedItems: [
      'Involuntary unemployment waiver, enhanced death benefit monthly protection charge, dividend distribution election, credit-card charge, life-replacement administration, regular withdrawal behavior, and minimum-account-value enforcement remain metadata-only for this product.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7, page8, page9, page10, page11, page17],
  }
}

export function parseTokioMarineWealthFlexiLink312(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-wealth-flexi-link-3-12',
    insurer: 'Tokio Marine',
    productName: 'Wealth Flexi-Link 3.12',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'tokio-regular-premium-routing-to-accumulation-account',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-premium-bonus',
      'tokio-power-up-bonus',
      'tokio-loyalty-bonus',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-account-surrender-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
    ],
    metadataOnlyBehaviors: [
      'tokio-wealth-flexi-link-3-12-involuntary-unemployment-waiver',
      'tokio-wealth-flexi-link-3-12-monthly-protection-charge',
      'tokio-wealth-flexi-link-3-12-dividend-distribution-election',
      'tokio-wealth-flexi-link-3-12-credit-card-charge',
      'tokio-wealth-flexi-link-3-12-life-replacement-option',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Flexi-Link 3.12 product summary text layer.',
      'Wealth Flexi-Link 3.12 is modeled as the SGD / MIP 12 corridor with a published 2.45% policy charge during the minimum investment period and a 0.60% policy charge thereafter.',
      'Premium bonus, power-up bonus, and loyalty bonus retain the published paid-up and no-withdrawal eligibility gates as manual review assumptions.',
      'Recurring single premium stays blocked after a premium-holiday event until regular premium resumes at the commencement-date amount.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
