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

const TERM_OPTIONS = [10, 15, 20, 25] as const
type MipTerm = (typeof TERM_OPTIONS)[number]

const APPENDIX_2_CHARGE: Record<MipTerm, number[]> = {
  10: [1, 1, 0.8, 0.65, 0.55, 0.5, 0.4, 0.3, 0.2, 0.08],
  15: [1, 1, 0.85, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.08],
  20: [1, 1, 0.9, 0.8, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.16, 0.14, 0.12, 0.1, 0.08],
  25: [1, 1, 0.95, 0.85, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.18, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06, 0.05, 0.04],
}

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
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

function buildBonuses(term: MipTerm, page1: IlpCatalogSourceRef): IlpTemplateBonus[] {
  return [
    {
      id: 'post-mip-regular-premium-allocation',
      type: 'allocation',
      label: 'Post-MIP Regular Premium Allocation Uplift',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: term + 1,
      endPolicyYear: null,
      rate: 0.05,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 105% of regular premium used to buy units after the selected MIP ends.',
        'This uplift applies to regular premiums only. Top-ups continue to buy units at 100%.',
      ],
      sourceRefs: [page1],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, term: MipTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Policy description and regular premium allocation', snippetNear(document, 1, 'Percentage of regular premium to buy units', 18))
  const page2 = sourceRef(2, 'Investment bonus', snippetNear(document, 2, 'Investment Bonus', 18))
  const page3 = sourceRef(3, 'Loyalty bonus and top-ups', snippetNear(document, 3, 'Loyalty Bonus', 18))
  const page4 = sourceRef(4, 'No Lapse Guarantee', snippetNear(document, 4, 'No Lapse Guarantee', 18))
  const page7 = sourceRef(7, 'Fees and charges', snippetNear(document, 7, 'Policy Fee', 20))
  const page8 = sourceRef(8, 'Premium holiday charge', snippetNear(document, 8, 'Premium Holiday Charge', 16))
  const page9 = sourceRef(9, 'Subscription and redemption of units', snippetNear(document, 9, '100% of your regular premium', 20))
  const page17 = sourceRef(17, 'Declaration and Reinvesting of Distributions', snippetNear(document, 17, 'Declaration and Reinvesting of Distributions', 18))
  const page21 = sourceRef(21, 'Appendix 2 charges', snippetNear(document, 21, 'Appendix 2', 20))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'account-value',
      rate: 0,
      amount: null,
      appliesTo: ['policy'],
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 5, rate: 0.05 },
        { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
      ],
      activeWindow: 'policy-term',
      notes: [
        'Models the published monthly-deducted policy fee as an annualised percentage of policy value.',
      ],
      sourceRefs: [page7],
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
      rateSchedule: buildRateSchedule(APPENDIX_2_CHARGE[term]),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Appendix 2 charge percentage on the policy value withdrawn during the selected MIP.',
        'The minimum S$500 withdrawal amount and minimum S$1,000 post-withdrawal policy value remain informational only in V1.',
      ],
      sourceRefs: [page7, page9, page21],
    },
  ]

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipLength: term,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page9],
      },
    ],
    bonuses: buildBonuses(term, page1),
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: [
        'Income declares distributions only on a reinvested basis for AstraLink ILP sub-funds that carry a distribution option.',
        'The published corridor does not provide a normal cash-payout election; each declared distribution is reinvested into the same ILP sub-fund.',
      ],
      sourceRefs: [page17],
    },
    eecTable: [...APPENDIX_2_CHARGE[term]],
    warnings: [
      'AstraLink (VA2) is modeled as a partial subset in V1. The parser captures the 105% post-MIP regular-premium allocation uplift, the policy-fee schedule, top-up routing, the Appendix 2 partial-withdrawal / surrender charge schedules, and the published reinvest-only distribution mode.',
      'Investment bonus and loyalty bonus remain informational only because the published tables depend on dimensions or term rows that are not fully representable without guesswork in the current template schema.',
      'Insurance cover charge, No Lapse Guarantee, and premium-holiday free-window gating remain informational only in V1.',
    ],
    unsupportedItems: [
      'Investment bonus tables depend on annual premium bands and sum assured multiple, including a separate rider table, and remain informational only.',
      'Loyalty bonus remains informational only because the extracted 25-year row is not machine-readable enough to model without guesswork.',
      'Insurance cover charge depends on age, sex, smoker status, and sum at risk and remains informational only.',
      'No Lapse Guarantee amount-owed carry and reinstatement behavior remain informational only.',
      'Premium holiday free-window gating and the pre-2nd-anniversary lapse path remain informational only.',
      'Minimum withdrawal amount, minimum post-withdrawal policy value, and top-up blocking during premium holiday remain informational only.',
      'Changing premium or sum assured, retirement option, and guaranteed insurability option remain informational only.',
      'All protection-benefit payout mechanics remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page7, page8, page9, page17, page21],
  }
}

export function parseIncomeAstralinkVa2({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'income-astralink-va2',
    insurer: 'Income Insurance',
    productName: 'AstraLink (VA2)',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:astralink-va2-post-mip-regular-allocation',
      'branch:astralink-va2-policy-fee',
      'branch:astralink-va2-partial-withdrawal-charge',
      'branch:astralink-va2-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'astralink-va2-investment-bonus',
      'astralink-va2-loyalty-bonus',
      'astralink-va2-insurance-cover-charge',
      'astralink-va2-no-lapse-guarantee',
      'astralink-va2-premium-holiday-charge',
      'astralink-va2-premium-holiday-gating',
      'astralink-va2-protection-benefits',
      'astralink-va2-flexible-options',
    ],
    warnings: [
      'AstraLink (VA2) is cataloged as a partial modeled subset in V1. The parser captures the 105% post-MIP regular-premium allocation uplift, the policy-fee schedule, top-up routing, the Appendix 2 partial-withdrawal / surrender charge schedules, and the published reinvest-only distribution mode, while investment bonus, loyalty bonus, insurance cover charge, premium-holiday gating, and protection-side payouts remain outside the current engine.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(document, term)),
  }
}
