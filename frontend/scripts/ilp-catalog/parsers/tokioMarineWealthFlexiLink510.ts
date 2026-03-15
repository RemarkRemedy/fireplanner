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

const MIP_LENGTH = 10

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  0.92,
  0.83,
  0.58,
  0.57,
  0.49,
  0.3,
  0.12,
  0.03,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
  { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.16 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 39_999.99, rate: 0.36 },
  { currency: 'SGD', minAnnualPremium: 40_000, maxAnnualPremium: null, rate: 0.38 },
]

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
  const page2 = sourceRef(2, 'Initial Bonus / Premium Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const page3 = sourceRef(3, 'Power-up Bonus', snippetNear(document, 3, 'Power-up Bonus', 24))

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
        'Tier is based on the published SGD annualised regular premium band for Wealth Flexi-Link 5.10.',
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
      startPolicyYear: 6,
      endPolicyYear: 10,
      rate: 0.002,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual premium bonus on Total Investment Value from the end of policy year 6 until the end of the minimum investment period.',
        'The source document conditions payment on all regular premiums due in the prior 12 months being paid and no withdrawals from the Accumulation Units Account in the prior 12 months; those gates remain manual review assumptions in this partial template.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'power-up-bonus-policy-year-8',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 8)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 8,
      endPolicyYear: 8,
      rate: 0.001,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 8.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus-policy-year-9',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 9)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 9,
      endPolicyYear: 9,
      rate: 0.002,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 9.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
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
      rate: 0.005,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 10.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page9 = sourceRef(9, 'Policy Charge', snippetNear(document, 9, 'Policy Charge', 22))

  return [
    {
      id: 'policy-charge',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.025,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly policy charge during the minimum investment period as 2.50% p.a. of Total Investment Value.',
      ],
      sourceRefs: [page9],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'Wealth Flexi-Link 5.10', 18))
  const page2 = sourceRef(2, 'Initial Bonus / Premium Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const page3 = sourceRef(3, 'Power-up Bonus / Involuntary Unemployment Benefit', snippetNear(document, 3, 'Power-up Bonus', 24))
  const page4 = sourceRef(4, 'Regular Premium Routing', snippetNear(document, 4, '100% of the regular premium paid', 18))
  const page5 = sourceRef(5, 'Recurring Single Premium and Top-up Premium', snippetNear(document, 5, 'Recurring Single Premium', 22))
  const page6 = sourceRef(6, 'Non-payment of Regular Premium', snippetNear(document, 6, 'Non-payment of Regular Premium', 24))
  const page7 = sourceRef(7, 'Partial Withdrawal', snippetNear(document, 7, 'Partial Withdrawal', 28))
  const page9Distribution = sourceRef(9, 'Dividend Distribution', snippetNear(document, 9, 'Dividend Distribution', 24))
  const page9 = sourceRef(9, 'Policy Charge / MPC', snippetNear(document, 9, 'Policy Charge', 26))
  const page10 = sourceRef(10, 'Premium Charge / Surrender Charge / Partial Withdrawal Charge / Premium Shortfall Charge', snippetNear(document, 10, 'Premium Charge for Recurring Single Premium and Top-up Premium', 30))
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
      sourceRefs: [page5, page10],
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
      sourceRefs: [page5, page10],
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
      sourceRefs: [page7, page10, page17],
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
        'Models the published monthly premium shortfall charge when regular premium is not paid after the grace period during policy years 3 to 5.',
        'Deduct from Accumulation Units Account first, then Top-up Units Account.',
        'The involuntary unemployment benefit waiver remains metadata-only.',
      ],
      sourceRefs: [page3, page6, page10, page17],
    },
  ]

  return {
    id: 'sgd-mip-10',
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
        sourceRefs: [page4, page9],
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
        sourceRefs: [page5, page7],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: buildFeeRules(document),
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: 5,
          accountIds: ['topup'],
        },
        {
          startPolicyYear: 6,
          endPolicyYear: null,
          accountIds: ['accumulation', 'topup'],
        },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment unless the policyholder elects cash payout.',
        'For the first five policy years, only dividends from the Top-up Units Account may be paid in cash.',
        'After the first five policy years, dividends from both the Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'The published $50 minimum dividend amount and 30-day instruction window remain informational only in V1.',
      ],
      sourceRefs: [page9Distribution],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      'This partial template models the SGD / MIP 10 corridor only.',
      'This partial template models regular-premium routing to the Accumulation Units Account, top-up routing, recurring single premium routing, a 2.50% account-value policy charge during the minimum investment period, the published surrender, partial-withdrawal, and premium-shortfall charge schedules, and the published phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      'Premium bonus and power-up bonus are modeled at the published rate windows, but their paid-up and no-withdrawal eligibility gates remain manual review assumptions.',
      'Recurring single premium stays blocked after a premium-holiday event until regular premium resumes at the commencement-date amount.',
      'No policy charges apply after the minimum investment period in the source document.',
    ],
    unsupportedItems: [
      'Involuntary unemployment waiver, enhanced death benefit monthly protection charge, credit-card charge, and life-replacement administration remain metadata-only for this product.',
      'The published $50 dividend payout threshold and 30-day record-date instruction window remain informational only in V1.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7, page9Distribution, page9, page10, page17],
  }
}

export function parseTokioMarineWealthFlexiLink510(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-wealth-flexi-link-5-10',
    insurer: 'Tokio Marine',
    productName: 'Wealth Flexi-Link 5.10',
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
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-account-surrender-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-wealth-flexi-link-5-10-involuntary-unemployment-waiver',
      'tokio-wealth-flexi-link-5-10-monthly-protection-charge',
      'tokio-wealth-flexi-link-5-10-dividend-payout-threshold-and-record-date-instructions',
      'tokio-wealth-flexi-link-5-10-credit-card-charge',
      'tokio-wealth-flexi-link-5-10-life-replacement-option',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Flexi-Link 5.10 product summary text layer.',
      'Wealth Flexi-Link 5.10 is modeled as the SGD / MIP 10 corridor with a published 2.50% policy charge during the minimum investment period and no policy charges after the minimum investment period.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface: only Top-up Units Account dividends may be paid in cash during the first five policy years, and Accumulation Units Account dividends join after policy year 5.',
      'Premium bonus and power-up bonus retain the published paid-up and no-withdrawal eligibility gates as manual review assumptions.',
      'Recurring single premium stays blocked after a premium-holiday event until regular premium resumes at the commencement-date amount.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
