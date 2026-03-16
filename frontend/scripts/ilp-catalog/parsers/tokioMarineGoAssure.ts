import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
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

const SURRENDER_CHARGE_TABLE = [1, 1, 0.95, 0.95, 0.7, 0.65, 0.6, 0.45, 0.25, 0.08] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.7 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.65 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.6 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.45 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.7 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.65 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.6 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.45 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
] as const

const INITIAL_CHARGE_RATE_SCHEDULE = Array.from({ length: MIP_LENGTH }, (_, index) => {
  const policyYear = index + 1
  return {
    startPolicyYear: policyYear,
    endPolicyYear: policyYear,
    rate: Number((0.0065 * policyYear).toFixed(4)),
  }
})

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page13 = sourceRef(13, 'Initial Charge', snippetNear(document, 13, 'Initial Charge', 22))
  const page14 = sourceRef(14, 'Policy Charge', snippetNear(document, 14, 'Policy Charge', 24))

  return [
    {
      id: 'initial-charge',
      label: 'Initial Charge',
      basis: 'account-value',
      rate: 0,
      rateSchedule: INITIAL_CHARGE_RATE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      appliesTo: ['initial'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly initial charge for the SGD 10-year minimum contribution period as 0.65% p.a. multiplied by the current policy year.',
        'The source states this charge continues during premium holiday.',
      ],
      sourceRefs: [page13],
    },
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.01,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      startPolicyYear: 5,
      endPolicyYear: 10,
      activeWindow: 'during-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 5, endPolicyYear: 10, mode: 'policy-year' },
        ],
      },
      notes: [
        'Models the published monthly policy charge from the 49th policy month until the end of the 10-year minimum contribution period.',
        'If the Accumulation Units Account is insufficient, the remaining deduction falls back to the Initial Units Account and/or Top-up Units Account.',
      ],
      sourceRefs: [page14],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan description and account model', snippetNear(document, 1, '#goAssure', 22))
  const page5 = sourceRef(5, 'Waiver and distribution rules', snippetNear(document, 5, 'Dividend Distribution', 24))
  const page8 = sourceRef(8, 'Regular premium routing and minimum premiums', snippetNear(document, 8, 'Regular premium due during the first 48 months', 24))
  const page13 = sourceRef(13, 'Initial Charge', snippetNear(document, 13, 'Initial Charge', 22))
  const page14 = sourceRef(14, 'Policy Charge and premium charge', snippetNear(document, 14, 'Policy Charge', 26))
  const page15 = sourceRef(15, 'Premium Shortfall Charge', snippetNear(document, 15, 'Premium Shortfall Charge', 30))
  const page23 = sourceRef(23, 'Appendix A surrender and withdrawal charges', snippetNear(document, 23, 'Surrender Charge', 26))
  const page24 = sourceRef(24, 'Appendix A partial withdrawal and shortfall charge', snippetNear(document, 24, 'Partial Withdrawal Charge', 26))

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
      sourceRefs: [page8, page14],
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
      sourceRefs: [page8, page14],
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
        'Applies only to partial withdrawals from the Accumulation Units Account during the minimum contribution period.',
        'Cash dividend payouts after the minimum contribution period are not subject to partial withdrawal charge.',
      ],
      sourceRefs: [page5, page23, page24],
    },
    {
      id: 'premium-shortfall-charge-non-payment',
      label: 'Premium Shortfall Charge (Non-payment)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-goassure-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge during premium holiday after the first four policy years.',
        'Deducts from the Accumulation Units Account first, then the Initial Units Account and/or Top-up Units Account if needed.',
      ],
      sourceRefs: [page15, page24],
    },
    {
      id: 'premium-shortfall-charge-reduction',
      label: 'Premium Shortfall Charge (Regular Premium Reduction)',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-goassure-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when annualised regular premium is reduced below the commencement-date commitment after the first four policy years.',
        'When both premium holiday and premium reduction apply, the higher amount is imposed.',
      ],
      sourceRefs: [page15, page24],
    },
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 48,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page8, page13],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page1, page8, page14, page15],
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
        sourceRefs: [page1, page8, page14],
      },
    ],
    bonuses: [],
    feeRules: buildFeeRules(document),
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying funds are automatically reinvested during the minimum contribution period.',
        'After the minimum contribution period, cash payout may be received from the Initial Units Account, Accumulation Units Account, and Top-up Units Account.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page5],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      '#goAssure is cataloged as a supported V1 corridor. The parser captures the SGD 10-year cash corridor: three-account regular-premium / top-up routing, the published initial-charge schedule, the premium-base policy charge during MIP, recurring-single-premium and top-up charges, the partial-withdrawal charge schedule, the premium-shortfall charge schedules, the 10-year surrender-charge table, and the manual distribution-mode assumption surface.',
      'Dividend cash payout after the minimum contribution period requires a manual annual distribution-yield assumption, and the published minimum payout threshold remains informational only.',
      'Initial Bonus, Loyalty Bonus, Achievement Bonus, Wellness Bonus, waiver mechanics, Monthly Protection Charge, Guaranteed Extra Protection, and protection-side claim behavior remain outside the current engine.',
    ],
    unsupportedItems: [
      'Initial Bonus, Loyalty Bonus, Achievement Bonus, and Wellness Bonus remain informational only.',
      'Waiver of Partial Withdrawal Charge and/or Premium Shortfall Charge remains informational only.',
      'Monthly Protection Charge, sum-at-risk formulas, protection-age transitions, and Guaranteed Extra Protection remain informational only.',
      'Credit-card charge, administrative charge nil surface, policy-currency-change charge nil surface, and third-party charges remain informational only.',
      'The published minimum dividend-payout threshold and post-MIP cash-dividend processing details remain informational only.',
    ],
    sourceRefs: [page1, page5, page8, page13, page14, page15, page23, page24],
  }
}

export function parseTokioMarineGoAssure(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goassure',
    insurer: 'Tokio Marine',
    productName: '#goAssure',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:tokio-marine-goassure-initial-charge',
      'branch:tokio-marine-goassure-policy-charge',
      'branch:tokio-marine-goassure-recurring-single-and-top-up-charge',
      'branch:tokio-marine-goassure-partial-withdrawal-charge',
      'branch:tokio-marine-goassure-premium-shortfall-charge',
      'branch:tokio-marine-goassure-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-marine-goassure-initial-bonus',
      'tokio-marine-goassure-loyalty-bonus',
      'tokio-marine-goassure-achievement-bonus',
      'tokio-marine-goassure-wellness-bonus',
      'tokio-marine-goassure-waiver-of-partial-withdrawal-and-shortfall-charge',
      'tokio-marine-goassure-monthly-protection-charge',
      'tokio-marine-goassure-guaranteed-extra-protection',
      'tokio-marine-goassure-protection-benefits',
      'tokio-marine-goassure-dividend-payout-threshold',
      'tokio-marine-goassure-third-party-charges',
    ],
    warnings: [
      '#goAssure is cataloged as a supported V1 product. The parser captures the SGD 10-year cash corridor charge surfaces and distribution-mode assumption support, while bonuses, waiver mechanics, Monthly Protection Charge, and protection-side claim behavior remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document),
    ],
  }
}
