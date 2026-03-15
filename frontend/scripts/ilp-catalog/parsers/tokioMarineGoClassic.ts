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

const MIP_LENGTH = 25

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  0.95,
  0.93,
  0.91,
  0.89,
  0.87,
  0.85,
  0.83,
  0.8,
  0.77,
  0.74,
  0.71,
  0.68,
  0.64,
  0.6,
  0.56,
  0.51,
  0.46,
  0.41,
  0.36,
  0.31,
  0.26,
  0.21,
  0.15,
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.42 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.47 },
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
  const page1 = sourceRef(1, 'Initial Bonus', snippetNear(document, 1, 'Initial Bonus', 18))
  const page2 = sourceRef(2, 'Initial Bonus Rates', snippetNear(document, 2, 'Initial bonus rates on a per annum basis', 20))

  return [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 3,
      rate: null,
      amount: null,
      tieredRates: INITIAL_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Tier is based on the published SGD annualised regular premium band for the 25-year premium payment term.',
        'Allocated to the Initial Units Account upon each regular premium received in the first three policy years.',
      ],
      sourceRefs: [page1, page2],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, '#goClassic', 18))
  const page2 = sourceRef(2, 'Initial Bonus / Loyalty Bonus / Additional Bonus', snippetNear(document, 2, 'Loyalty Bonus', 22))
  const page4 = sourceRef(4, 'Regular Premium Routing', snippetNear(document, 4, 'Regular premium due during the first 24 months', 20))
  const page5 = sourceRef(5, 'Recurring Single Premium / Top-up Premium / Premium Holiday', snippetNear(document, 5, 'Recurring Single Premium', 22))
  const page8 = sourceRef(8, 'Dividend Distribution', snippetNear(document, 8, 'Dividend Distribution', 28))
  const page9 = sourceRef(9, 'Initial Charge / Policy Charge / MPC', snippetNear(document, 9, 'Initial Charge', 28))
  const page10 = sourceRef(10, 'Premium Charge / Surrender Charge', snippetNear(document, 10, 'Premium Charge for Recurring Single Premium and Top-up Premium', 26))
  const page14 = sourceRef(14, 'Appendix A Surrender Charge', snippetNear(document, 14, 'Premium Payment Term: 25', 24))

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
        'A 5% premium charge is deducted before each top-up premium allocation to the Accumulation Units Account.',
      ],
      sourceRefs: [page5, page10],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['accumulation'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each recurring single premium allocation to the Accumulation Units Account.',
      ],
      sourceRefs: [page5, page10],
    },
  ]

  return {
    id: 'sgd-mip-25',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 24,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: 0.0675,
        postMipFeeRate: 0.0135,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page2, page4, page9],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: 0.0135,
        postMipFeeRate: 0.0135,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page2, page4, page5, page9, page10],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: [],
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: 25,
          accountIds: ['accumulation'],
        },
        {
          startPolicyYear: 26,
          endPolicyYear: null,
          accountIds: ['initial', 'accumulation'],
        },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment unless the policyholder elects cash payout.',
        'During the 25-year premium payment term, only dividends from the Accumulation Units Account may be paid in cash.',
        'After the premium payment term, dividends from both the Initial Units Account and Accumulation Units Account may be paid in cash.',
        'The published $50 minimum dividend amount and 30-day instruction window remain informational only in V1.',
      ],
      sourceRefs: [page8],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      'This partial template models the SGD / premium-payment-term-25 corridor only.',
      'This partial template models 24-month initial-versus-accumulation routing, the published 25-year initial bonus tiers, the published initial charge and policy charge through executable account fee rates, recurring single premium and top-up routing into the Accumulation Units Account, the published 25-year surrender charge on the Initial Units Account, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
    ],
    unsupportedItems: [
      'Loyalty Bonus and Additional Bonus remain metadata-only because their annual qualification and adjustment-factor formulas need stateful bonus tracking beyond the current engine.',
      'Advanced Death Benefit monthly protection charges, premium-holiday lapse behavior, regular withdrawal, credit-card charge, and non-SGD or non-25-year corridors remain metadata-only.',
      'The published $50 dividend payout threshold and 30-day record-date instruction window remain informational only in V1.',
    ],
    sourceRefs: [page1, page2, page4, page5, page8, page9, page10, page14],
  }
}

export function parseTokioMarineGoClassic(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goclassic',
    insurer: 'Tokio Marine',
    productName: '#goClassic',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-policy-value',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-goclassic-loyalty-bonus-adjustment-factor',
      'tokio-goclassic-additional-bonus-qualification',
      'tokio-goclassic-advanced-death-benefit-mpc',
      'tokio-goclassic-premium-holiday-lapse-state',
      'tokio-goclassic-regular-withdrawal-facility',
      'tokio-goclassic-dividend-payout-threshold-and-record-date-instructions',
      'tokio-goclassic-credit-card-charge',
    ],
    warnings: [
      '#goClassic is cataloged as a partial modeled subset in V1. The parser captures one honest SGD / premium-payment-term-25 corridor with executable regular-premium routing, published initial bonus tiers, account-fee-rate modeling for the initial and policy charges, recurring single premium and top-up charges into the Accumulation Units Account, the 25-year surrender charge on the Initial Units Account, and the published phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      'Loyalty Bonus and Additional Bonus remain informational only because the source uses annual qualification gates and an adjustment-factor formula that the current engine does not execute.',
      'Advanced Death Benefit monthly protection charges, premium-holiday lapse behavior, regular withdrawal, and other corridors remain outside the current engine.',
      'Structured extraction validated against the #goClassic product summary text layer.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
