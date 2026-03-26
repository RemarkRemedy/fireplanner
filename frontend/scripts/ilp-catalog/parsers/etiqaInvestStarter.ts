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
          { phase: 'during-icp', targetAccountId: 'portfolio', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'portfolio', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'portfolio', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page13],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
    },
    eecTable: [...SHORTFALL_AND_EXIT_SCHEDULE],
    warnings: [
      'Invest starter is cataloged as a supported V1 product. The parser captures the policy charge, the current-due three-year policy-charge refund through manual trailing-36-month average-account-value and refund-status inputs, premium-holiday shortfall charge and refund, annual-state lapse after projected account-value depletion during premium holiday, partial-withdrawal charge, surrender charge horizon, regular-premium / top-up cashflow structure, the current-state death benefit as the higher of account value or the 105%-of-net-premiums-and-top-ups floor after manual current amount owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, and the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry.',
      'Future three-year policy charge refund qualification and one-time reward remain informational only in V1.',
      'Dividend reinvestment is automatic at the sub-fund level and is therefore treated as part of accumulation value rather than as a separate user election.',
    ],
    unsupportedItems: [
      'The current-state death and terminal-illness snapshot needs manual current amount owing and remaining aggregate TI cap inputs because debt and cross-policy TI cap usage are not reconstructed from history in V1.',
      'The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, but claim exclusions and insurer-side settlement mechanics remain informational only.',
      'Future three-year policy charge refund qualification and crediting, including the preceding-36-month no-partial-withdrawal test and rolling monthly account-value history outside the manual current refund inputs, remain informational only.',
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
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:automatic-lapse-on-account-depletion',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'branch:invest-starter-policy-charge',
      'branch:invest-starter-current-policy-charge-refund-credit',
      'branch:invest-starter-premium-shortfall-charge',
      'branch:invest-starter-premium-shortfall-refund',
      'branch:invest-starter-partial-withdrawal-charge',
      'branch:invest-starter-surrender-charge',
      'branch:invest-starter-ad-hoc-top-up-routing',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'invest-starter-policy-charge-refund-every-3-years',
      'invest-starter-one-time-reward',
      'invest-starter-change-of-life-insured',
      'invest-starter-optional-protection-riders',
    ],
    warnings: [
      'Invest starter is cataloged as a supported V1 product. The current-state death benefit as the higher of account value or the 105%-of-net-premiums-and-top-ups floor after manual current amount owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry, the current-due three-year policy-charge refund through manual trailing-36-month average-account-value and refund-status inputs, the regular-premium cashflow, top-up routing, policy charge, premium-holiday shortfall charge/refund, annual-state lapse after projected account-value depletion during premium holiday, and first-five-year withdrawal / surrender charge schedules are modeled, while terminal-illness claim exclusions / settlement mechanics, future three-year policy-charge refund qualification and crediting, one-time reward, change-of-life-insured, and optional protection riders remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
