import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateBonusTier,
  IlpTemplateFeeRule,
  IlpTemplateEventChargeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const MIP_LENGTH = 15

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  0.99,
  0.99,
  0.99,
  0.91,
  0.84,
  0.76,
  0.68,
  0.6,
  0.5,
  0.43,
  0.34,
  0.26,
  0.15,
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.5 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.57 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.64 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.71 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.75 },
]

const INITIAL_CHARGE_RATE_SCHEDULE = Array.from({ length: MIP_LENGTH }, (_, index) => {
  const policyYear = index + 1
  return {
    startPolicyYear: policyYear,
    endPolicyYear: policyYear,
    rate: Number((0.0085 * policyYear).toFixed(4)),
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
  const page4 = sourceRef(4, 'Initial Bonus', snippetNear(document, 4, 'Initial Bonus', 22))

  return [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 2,
      rate: null,
      amount: null,
      tieredRates: INITIAL_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Tier is based on the published SGD annualised regular premium band for the 15-year premium payment term.',
        'Allocated to the Initial Units Account upon each regular premium received in the first two policy years.',
      ],
      sourceRefs: [page4],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page11 = sourceRef(11, 'Initial Charge', snippetNear(document, 11, 'Initial Charge', 24))
  const page12 = sourceRef(12, 'Policy Charge', snippetNear(document, 12, 'Policy Charge', 24))

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
        'Models the published monthly initial charge for the SGD 15-year term as 0.85% p.a. multiplied by the current policy year.',
      ],
      sourceRefs: [page11],
    },
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      activeWindow: 'during-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: 15, mode: 'policy-year' },
        ],
      },
      notes: [
        'Models the published monthly policy charge during the premium payment term using annualised regular premium committed at commencement date multiplied by the current policy year.',
      ],
      sourceRefs: [page12],
    },
    {
      id: 'policy-charge-after-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      activeWindow: 'after-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 16, endPolicyYear: null, mode: 'fixed', multiplier: 15 },
        ],
      },
      notes: [
        'Models the published monthly policy charge after the premium payment term using the fixed 15-year multiplier.',
      ],
      sourceRefs: [page12],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, '#goAffluence', 18))
  const page4 = sourceRef(4, 'Initial Bonus', snippetNear(document, 4, 'Initial Bonus', 22))
  const page7 = sourceRef(7, 'Regular Premium and Recurring Single Premium', snippetNear(document, 7, 'Regular premium due during the first 24 months', 26))
  const page8 = sourceRef(8, 'Top-up Premium and Premium Holiday', snippetNear(document, 8, 'Premium Holiday', 18))
  const page9 = sourceRef(9, 'Partial Withdrawal and Regular Withdrawal', snippetNear(document, 9, 'Partial Withdrawal', 22))
  const page10 = sourceRef(10, 'Dividend Distribution', snippetNear(document, 10, 'Dividend Distribution', 22))
  const page11 = sourceRef(11, 'Initial Charge', snippetNear(document, 11, 'Initial Charge', 24))
  const page12 = sourceRef(12, 'Policy Charge and top-up charges', snippetNear(document, 12, 'Policy Charge', 28))
  const page19 = sourceRef(19, 'Appendix A Surrender Charge', snippetNear(document, 19, 'Premium Payment Term: 15', 22))

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
      sourceRefs: [page8, page12],
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
      sourceRefs: [page7, page12],
    },
  ]

  return {
    id: 'sgd-mip-15',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 24,
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
        sourceRefs: [page1, page7, page11],
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
        sourceRefs: [page1, page7, page12],
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
        sourceRefs: [page1, page7, page8],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: buildFeeRules(document),
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: 15,
          accountIds: ['accumulation', 'topup'],
        },
        {
          startPolicyYear: 16,
          endPolicyYear: null,
          accountIds: ['initial', 'accumulation', 'topup'],
        },
      ],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment unless the policyholder elects cash payout.',
        'During the 15-year premium payment term, only dividends from the Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'After the premium payment term, dividends from the Initial Units Account, Accumulation Units Account, and Top-up Units Account may be paid in cash.',
        'The published $50 minimum dividend amount and 30-day instruction window remain informational only in V1.',
      ],
      sourceRefs: [page10],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      'This partial template models the SGD / premium-payment-term-15 corridor only.',
      'This partial template models regular-premium routing through the 15-year payment term, the published initial bonus tiers, the year-scaled initial charge schedule, the policy charge premium-base multiplier basis, top-up routing, recurring single premium routing, the published 15-year surrender charge table, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      'Recurring single premium stays blocked during premium holiday until regular premium resumes at the committed commencement-date amount.',
    ],
    unsupportedItems: [
      'Loyalty bonus and achievement bonus remain metadata-only because the published adjustment-factor and milestone qualification gates are not yet represented directly in the template bonus basis.',
      'Monthly protection charge, advanced death benefit, accidental/dependent medical/retrenchment benefits, multiple-life handling, and change-of-life-assured administration remain metadata-only for this product.',
      'Regular withdrawal, partial-withdrawal limit and minimum-account-value constraints, premium holiday state handling, and non-SGD/premium-term variants remain metadata-only for this product.',
      'The published $50 dividend payout threshold and 30-day record-date instruction window remain informational only in V1.',
    ],
    sourceRefs: [page1, page4, page7, page8, page9, page10, page11, page12, page19],
  }
}

export function parseTokioMarineGoAffluence(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goaffluence',
    insurer: 'Tokio Marine',
    productName: '#goAffluence',
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
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-goaffluence-loyalty-and-achievement-bonuses',
      'tokio-goaffluence-monthly-protection-and-benefit-riders',
      'tokio-goaffluence-dividend-payout-threshold-record-date-regular-withdrawal-and-partial-withdrawal-constraints',
      'tokio-goaffluence-premium-holiday-and-non-sgd-or-non-15-year-variants',
    ],
    warnings: [
      'Structured extraction validated against the #goAffluence product summary text layer.',
      'The parser currently covers the SGD / premium-payment-term-15 corridor only.',
      'Initial charge is modeled through the published year-scaled account-value fee schedule on the Initial Units Account, policy charge is modeled through the published premium-base multiplier formula, and phase-specific dividend cash-payout account restrictions are modeled through the manual distribution-mode assumption surface.',
      'Recurring single premium is modeled as a scheduled stream routed into the Top-up Units Account net of the published 5% premium charge.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
