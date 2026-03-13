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

const MIP_LENGTH = 5
const SHORTFALL_AND_EXIT_SCHEDULE = [0.07, 0.07, 0.06, 0.06, 0.05]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function roundRate(value: number): number {
  return Number(value.toFixed(6))
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  const normalizedExcerpt = normalizeWhitespace(excerpt)
  return {
    page,
    section,
    excerpt: (normalizedExcerpt || `${section} excerpt unavailable`).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 8): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildRateSchedule(values: readonly number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate: roundRate(rate),
  }))
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Nature of plan and death benefit', snippetNear(document, 1, 'Nature and Objective of the Plan'))
  const page2 = sourceRef(2, 'Policy charge refund and one-time reward', snippetNear(document, 2, 'Policy Charge Refund'))
  const page3 = sourceRef(3, 'Change in regular premium and ad-hoc top-up', snippetNear(document, 3, 'Change in Regular Premium'))
  const page4 = sourceRef(4, 'Premium holiday and partial withdrawal', snippetNear(document, 4, 'Premium Holiday'))
  const page10 = sourceRef(10, 'Policy charge', snippetNear(document, 10, 'Policy charge is payable'))
  const page11 = sourceRef(11, 'Premium shortfall and partial withdrawal charges', snippetNear(document, 11, 'Premium shortfall charge'))
  const page12 = sourceRef(12, 'Surrender charge', snippetNear(document, 12, 'Surrender charge is payable'))
  const page13 = sourceRef(13, 'Regular premium minimums', snippetNear(document, 13, 'regular Premium investment-linked insurance plan'))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'policy-charge',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: roundRate(0.008),
      amount: null,
      appliesTo: ['portfolio'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Modeled as the published monthly 0.80% p.a. policy charge on account value throughout the policy term.',
      ],
      sourceRefs: [page10],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['portfolio'],
      rate: 0,
      rateSchedule: buildRateSchedule(SHORTFALL_AND_EXIT_SCHEDULE),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies during premium holiday in the first five policy years based on the annualised regular premium.',
        'The published refund on full repayment is modeled separately via a premium-holiday repayment refund rule.',
      ],
      sourceRefs: [page4, page11],
    },
    {
      id: 'premium-shortfall-charge-refund',
      label: 'Premium Shortfall Charge Refund',
      trigger: 'premium-holiday-repayment',
      basis: 'premium-holiday-charge-refund',
      appliesTo: ['portfolio'],
      rate: 1,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      sourceChargeRuleId: 'premium-shortfall-charge',
      notes: [
        'Returns all previously imposed premium shortfall charges without interest after all missed regular premiums are paid back in full.',
      ],
      sourceRefs: [page11],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['portfolio'],
      rate: 0,
      rateSchedule: buildRateSchedule(SHORTFALL_AND_EXIT_SCHEDULE),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies to partial withdrawals in the first five policy years.',
      ],
      sourceRefs: [page4, page11, page12],
    },
  ]

  return {
    id: 'sgd-mip-5',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 1,
    accounts: [
      {
        id: 'portfolio',
        label: 'Portfolio Fund Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'portfolio', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page13],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [...SHORTFALL_AND_EXIT_SCHEDULE],
    warnings: [
      'Invest starter is cataloged as a partial modeled subset in V1. The parser captures the policy charge, premium-holiday shortfall charge and refund, partial-withdrawal charge, surrender charge horizon, and regular-premium / top-up cashflow structure.',
      'The three-year policy charge refund and one-time reward remain informational only in V1 because they require bonus-state logic beyond the current kernel.',
      'Dividend reinvestment is automatic at the sub-fund level and is therefore treated as part of accumulation value rather than as a separate user election.',
    ],
    unsupportedItems: [
      'Policy charge refund every three years remains informational only.',
      'One-time reward for linked insurance purchases remains informational only.',
      'Change of life insured remains informational only.',
      'Optional protection riders remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page10, page11, page12, page13],
  }
}

export function parseEtiqaInvestStarter(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'etiqa-invest-starter',
    insurer: 'Etiqa',
    productName: 'Invest starter',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:invest-starter-policy-charge',
      'branch:invest-starter-premium-shortfall-charge',
      'branch:invest-starter-premium-shortfall-refund',
      'branch:invest-starter-partial-withdrawal-charge',
      'branch:invest-starter-surrender-charge',
      'branch:invest-starter-ad-hoc-top-up-routing',
    ],
    metadataOnlyBehaviors: [
      'invest-starter-policy-charge-refund-every-3-years',
      'invest-starter-one-time-reward',
      'invest-starter-change-of-life-insured',
      'invest-starter-optional-protection-riders',
    ],
    warnings: [
      'Invest starter is currently modeled as a partial product in V1. The regular-premium cashflow, top-up routing, policy charge, premium-holiday shortfall charge/refund, and first-five-year withdrawal / surrender charge schedules are modeled, but the three-year policy charge refund and one-time reward remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
