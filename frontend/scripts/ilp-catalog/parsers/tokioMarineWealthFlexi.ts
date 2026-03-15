import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateBonusTier,
  IlpTemplateEventChargeRule,
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
  0.79,
  0.6,
  0.5,
  0.47,
  0.44,
  0.21,
  0.16,
  0.07,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 5, rate: 0.1 },
  { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  { startPolicyYear: 4, endPolicyYear: 10, rate: 0 },
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.15 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.18 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.2 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.22 },
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
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 22))
  const page3 = sourceRef(3, 'Performance Investment Bonus', snippetNear(document, 3, 'Performance Investment Bonus Rate', 18))

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
        'Tier is based on the annualised regular premium band stated in the product summary.',
        'Allocated to the Accumulation Units Account in the first policy year.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'performance-investment-bonus-policy-years-4-6',
      type: 'custom',
      label: 'Performance Investment Bonus (Policy Years 4-6)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: 6,
      rate: 0.012,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual performance investment bonus on the Accumulation Units Account value from the end of policy year 4 to the end of policy year 6.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'performance-investment-bonus-policy-years-7-10',
      type: 'custom',
      label: 'Performance Investment Bonus (Policy Years 7-10)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 7,
      endPolicyYear: 10,
      rate: 0.017,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual performance investment bonus on the Accumulation Units Account value from the end of policy year 7 to the end of policy year 10.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'performance-investment-bonus-after-mip',
      type: 'custom',
      label: 'Performance Investment Bonus (After MIP)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: null,
      rate: 0.01,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual performance investment bonus on the Accumulation Units Account value after the minimum investment period.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'via top-up premium or recurring single premium', 12))
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 22))
  const page3 = sourceRef(3, 'Regular Premium Routing and Performance Investment Bonus', snippetNear(document, 3, '100% of the regular premium paid', 18))
  const page4 = sourceRef(4, 'Recurring Single Premium and Top-up Premium', snippetNear(document, 4, 'Recurring Single Premium', 22))
  const page5 = sourceRef(5, 'Non-payment of Regular Premium', snippetNear(document, 5, 'Non-payment of Regular Premium', 18))
  const page6 = sourceRef(6, 'Partial Withdrawal', snippetNear(document, 6, 'Partial Withdrawal', 26))
  const page9 = sourceRef(9, 'Initial Setup Charge / Policy Investment Charge / Admin Charge', snippetNear(document, 9, 'Initial Setup Charge', 28))
  const page10 = sourceRef(10, 'Premium Charge / Surrender Charge / Partial Withdrawal Charge', snippetNear(document, 10, 'Premium Charge for Recurring Single Premium and Top-up Premium', 24))
  const page11 = sourceRef(11, 'Premium Shortfall Charge', snippetNear(document, 11, 'Premium Shortfall Charge', 26))
  const page16 = sourceRef(16, 'Appendix A Charges', snippetNear(document, 16, 'SURRENDER CHARGE', 24))

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
        'A 5% premium charge is deducted before each top-up premium is allocated to the Top-up Units Account.',
      ],
      sourceRefs: [page4, page10],
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
      sourceRefs: [page4, page10],
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
      ],
      sourceRefs: [page6, page10, page16],
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
      exclusiveGroup: 'tokio-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when regular premium is not paid after the grace period.',
        'Deduct from Accumulation Units Account first, then Top-up Units Account.',
        'Use a premium-holiday event to represent the non-payment period after the grace period.',
      ],
      sourceRefs: [page5, page11, page16],
    },
    {
      id: 'premium-shortfall-charge-reduction',
      label: 'Premium Shortfall Charge (Regular Premium Reduction)',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when annualised regular premium is reduced below the commencement-date commitment during the minimum investment period.',
        'Uses the annual reduction amount as the charge base and deducts from Accumulation Units Account first, then Top-up Units Account.',
        'Use a regular-premium-increase event to restore the commencement-date amount and stop this shortfall charge.',
      ],
      sourceRefs: [page3, page11, page16],
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
        sourceRefs: [page3],
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
        sourceRefs: [page4],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: [],
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      'This partial template models regular-premium routing to the Accumulation Units Account, top-up routing, recurring single premium routing, the split performance-investment-bonus schedule, and the published surrender, partial-withdrawal, and premium-shortfall charge schedules.',
      'Recurring single premium stays blocked after a premium-holiday event until you add an explicit recurring-single-premium-resumption event for the administrative restart month.',
      'Initial bonus tiers are modeled using the published SGD annualised regular premium bands for this SGD variant.',
    ],
    unsupportedItems: [
      'Initial setup charge, policy investment charge, admin charge, monthly protection charge, and dividend distribution election remain metadata-only for this product.',
      'Advanced death benefit, life benefit rider, life replacement administration, and multiple-life handling remain metadata-only for this product.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page9, page10, page11, page16],
  }
}

export function parseTokioMarineWealthFlexi(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-wealth-flexi',
    insurer: 'Tokio Marine',
    productName: 'Wealth Flexi',
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
      'tokio-performance-investment-bonus',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-account-surrender-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
    ],
    metadataOnlyBehaviors: [
      'tokio-initial-setup-policy-investment-admin-monthly-protection-and-dividend-distribution',
      'tokio-multiple-life-and-capital-guarantee-options',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Flexi product summary text layer.',
      'Performance investment bonus is modeled as three published policy-year windows: policy years 4 to 6, policy years 7 to 10, and after the minimum investment period.',
      'Recurring single premium is modeled as a scheduled stream routed into the Top-up Units Account net of the published 5% premium charge.',
      'Recurring single premium stays blocked after a premium-holiday event until you enter an explicit recurring-single-premium-resumption event for the administrative restart month.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
