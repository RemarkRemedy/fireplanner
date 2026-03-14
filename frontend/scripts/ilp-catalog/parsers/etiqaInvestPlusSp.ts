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

const POLICY_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 5, rate: 0.023 },
  { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.07,
  0.05,
  0.04,
  0.026,
  0.012,
  0,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  0.07,
  0.05,
  0.04,
  0,
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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 12): string {
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
    rate,
  }))
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'single Premium Investment-linked insurance plan', 20))
  const page2 = sourceRef(2, 'Power-up bonus and maturity benefit', snippetNear(document, 2, 'Power-up Bonus', 18))
  const page3 = sourceRef(3, 'Surrender and partial withdrawal policy options', snippetNear(document, 3, 'Partial Withdrawal', 18))
  const page7 = sourceRef(7, 'Initial single-premium subscription illustration', snippetNear(document, 7, 'There is no fees and charges incurred for the purchase', 14))
  const page9 = sourceRef(9, 'Top-up premium charge', snippetNear(document, 9, 'Premium Charge on Top-up', 16))
  const page10 = sourceRef(10, 'Policy charge and representative management charge', snippetNear(document, 10, 'Policy Charge', 24))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'annual-contribution',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'The published initial subscription illustration shows no fees and charges on the initial single premium purchase.',
      ],
      sourceRefs: [page7],
    },
    {
      id: 'policy-charge',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.023,
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      rateSchedule: POLICY_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      notes: [
        'Models the published policy-charge schedule for the initial account value only.',
        'Top-up vintages have their own effective-date-based charge clocks and remain informational only in V1.',
      ],
      sourceRefs: [page1, page10],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      allocation: 'equal-split',
      notes: [
        'Models the published initial-account partial-withdrawal charge table.',
        'Top-up withdrawals are processed from the latest top-up first and remain informational only in V1.',
      ],
      sourceRefs: [page3, page10],
    },
  ]

  return {
    id: 'sgd-open-ended-single-premium-initial-only',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Initial Account Value',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page7],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'Invest plus SP is cataloged as a partial modeled subset in V1. The parser captures the initial single-premium corridor only: zero initial subscription charge, the initial-account policy-charge schedule, and the initial-account surrender / partial-withdrawal charge tables.',
      'Power-up bonus, representative management charge, death-benefit principal floor, and top-up-specific charging remain informational only in V1.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Power-up bonus remains informational only because it credits additional units based on rolling initial-account and top-up averages.',
      'Death benefit and the 101% of net premium floor remain informational only.',
      'Top-up premium charge, top-up-specific policy-charge clocks, and top-up-specific surrender / withdrawal charge clocks remain informational only.',
      'Representative management charge remains informational only because the application-agreed rate can vary up to 0.75% per annum.',
      'Fund-level management fees, dividend elections, grace-period top-up funding, reinstatement, and free-look handling remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page7, page9, page10],
  }
}

export function parseEtiqaInvestPlusSp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'etiqa-invest-plus-sp',
    insurer: 'Etiqa',
    productName: 'Invest plus SP',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:etiqa-invest-plus-sp-zero-single-premium-charge',
      'branch:etiqa-invest-plus-sp-policy-charge',
      'branch:etiqa-invest-plus-sp-initial-partial-withdrawal-charge',
      'branch:etiqa-invest-plus-sp-initial-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'etiqa-invest-plus-sp-power-up-bonus',
      'etiqa-invest-plus-sp-death-benefit-floor',
      'etiqa-invest-plus-sp-top-up-premium-charge',
      'etiqa-invest-plus-sp-top-up-vintage-accounting',
      'etiqa-invest-plus-sp-representative-management-charge',
      'etiqa-invest-plus-sp-fund-management-fee',
      'etiqa-invest-plus-sp-dividend-handling',
      'etiqa-invest-plus-sp-grace-period-top-up-funding',
      'etiqa-invest-plus-sp-reinstatement',
      'etiqa-invest-plus-sp-free-look',
    ],
    warnings: [
      'Invest plus SP is cataloged as a partial modeled subset in V1. The parser captures the initial single-premium corridor only: zero initial subscription charge, the initial-account policy-charge schedule, and the initial-account surrender / partial-withdrawal charge tables, while power-up bonus, top-up-vintage charging, representative-management charges, and protection formulas remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
