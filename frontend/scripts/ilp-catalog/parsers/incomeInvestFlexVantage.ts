import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateBonusTier,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const TERM_OPTIONS = [5, 10, 15, 20] as const
type MipTerm = (typeof TERM_OPTIONS)[number]

const SURRENDER_CHARGE: Record<MipTerm, number[]> = {
  5: [1, 1, 0.75, 0.4, 0.2],
  10: [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05],
  15: [1, 1, 0.8, 0.65, 0.55, 0.5, 0.47, 0.45, 0.4, 0.35, 0.25, 0.15, 0.1, 0.05, 0.05],
  20: [1, 1, 0.9, 0.75, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.05, 0.05, 0.05],
}

const PARTIAL_WITHDRAWAL_CHARGE: Record<MipTerm, number[]> = {
  ...SURRENDER_CHARGE,
}

const PREMIUM_HOLIDAY_CHARGE: Record<MipTerm, number[]> = {
  5: [1, 1, 0.75, 0.4, 0.2],
  10: [1, 1, 0.8, 0.6, 0.5],
  15: [1, 1, 0.8, 0.65, 0.55, 0.5, 0.45, 0.45, 0.4, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35],
  20: [1, 1, 0.9, 0.75, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
}

const INVESTMENT_BONUS_TIERS: Record<MipTerm, IlpTemplateBonusTier[]> = {
  5: [
    { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.04 },
  ],
  10: [
    { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 9_599.99, rate: 0.05 },
    { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.2 },
  ],
  15: [
    { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_599.99, rate: 0.1 },
    { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.4 },
  ],
  20: [
    { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 9_599.99, rate: 0.25 },
    { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.55 },
  ],
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

function buildBonuses(term: MipTerm, page2: IlpCatalogSourceRef, page3: IlpCatalogSourceRef): IlpTemplateBonus[] {
  const investmentBonusTiers = INVESTMENT_BONUS_TIERS[term].map((tier) => ({ ...tier }))
  const loyaltyStartPolicyYear = Math.max(10, term)

  return [
    {
      id: 'regular-premium-allocation-step-2',
      type: 'allocation',
      label: 'Regular Premium Allocation Step 2',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 11,
      endPolicyYear: 20,
      rate: 0.02,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 102% of regular premium units starting after the first 120 months.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'regular-premium-allocation-step-3',
      type: 'allocation',
      label: 'Regular Premium Allocation Step 3',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 21,
      endPolicyYear: null,
      rate: 0.05,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 105% of regular premium units starting after the first 240 months.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'investment-bonus',
      type: 'allocation',
      label: 'Investment Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: investmentBonusTiers,
      notes: [
        'Applied to regular premiums paid in the first 12 months only.',
        'No investment bonus is provided for top-ups.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: loyaltyStartPolicyYear,
      endPolicyYear: null,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual loyalty bonus from the 10th policy anniversary or the end of MIP, whichever is later.',
        'If any partial withdrawal is made in the prior 12 months, loyalty bonus eligibility is lost.',
        'Withdrawals under the Life Events Withdrawal Benefit are not modeled separately in V1.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, term: MipTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan description and MIP', snippetNear(document, 1, 'Minimum Investment Period'))
  const page2 = sourceRef(2, 'Regular premium allocation and investment bonus', snippetNear(document, 2, 'Investment Bonus', 18))
  const page3 = sourceRef(3, 'Loyalty bonus and top-ups', snippetNear(document, 3, 'Loyalty Bonus', 16))
  const page4 = sourceRef(4, 'Death and terminal illness benefit', snippetNear(document, 4, 'Death and Terminal Illness'))
  const page5 = sourceRef(5, 'Secondary insured and life events withdrawal benefit', snippetNear(document, 5, 'Secondary Insured Option', 18))
  const page7 = sourceRef(7, 'Premium holiday', snippetNear(document, 7, 'Premium Holiday', 16))
  const page19 = sourceRef(19, 'Appendix 2 surrender charge', snippetNear(document, 19, 'Appendix 2', 18))
  const page20 = sourceRef(20, 'Appendix 3 partial withdrawal charge', snippetNear(document, 20, 'Appendix 3', 18))
  const page21 = sourceRef(21, 'Appendix 4 premium holiday charge', snippetNear(document, 21, 'Appendix 4', 18))
  const page12 = sourceRef(12, 'Appendix 1 death and TI insurance cover charge', snippetNear(document, 12, 'Appendix 1', 16))

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipLength: term,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Fund Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page2, page3],
      },
    ],
    bonuses: buildBonuses(term, page2, page3),
    feeRules: [],
    eventChargeRules: [
      {
        id: 'premium-holiday-charge',
        label: 'Premium Holiday Charge',
        trigger: 'premium-holiday',
        basis: 'annual-premium-with-overlap-months',
        appliesTo: ['policy'],
        rate: 0,
        rateSchedule: buildRateSchedule(PREMIUM_HOLIDAY_CHARGE[term]),
        amount: 0,
        activeWindow: 'during-mip',
        allocation: 'equal-split',
        notes: [
          'Applied monthly during premium holiday based on the published annualised-regular-premium percentages.',
        ],
        sourceRefs: [page7, page21],
      },
      {
        id: 'partial-withdrawal-charge',
        label: 'Partial Withdrawal Charge',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['policy'],
        rate: 0,
        rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE[term]),
        amount: 0,
        activeWindow: 'during-mip',
        allocation: 'equal-split',
        notes: [
          'Applied to partial withdrawals during the minimum investment period.',
          'Life Events Withdrawal Benefit free withdrawals remain informational only in V1.',
        ],
        sourceRefs: [page5, page20],
      },
    ],
    eecTable: [...SURRENDER_CHARGE[term]],
    warnings: [
      'Invest Flex Vantage is modeled as a partial subset in V1. The parser captures regular-premium allocation uplifts, first-year investment bonus, annual loyalty bonus, top-up routing, premium holiday charge, partial-withdrawal charge, and surrender-charge schedules.',
      'Death/TI insurance cover charges, secondary insured option, and life-events withdrawal benefit remain informational only in V1.',
    ],
    unsupportedItems: [
      'Death and terminal illness insurance cover charges remain informational only.',
      'Secondary insured option remains informational only.',
      'Life Events Withdrawal Benefit free-withdrawal treatment remains informational only.',
      'Future Premium Option remains informational only.',
      'Death benefit continuation after insured replacement remains informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page7, page12, page19, page20, page21],
  }
}

export function parseIncomeInvestFlexVantage(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'income-invest-flex-vantage',
    insurer: 'Income Insurance',
    productName: 'Invest Flex Vantage',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:income-vs2-regular-premium-allocation-uplift',
      'branch:income-vs2-investment-bonus',
      'branch:income-vs2-loyalty-bonus',
      'branch:income-vs2-premium-holiday-charge',
      'branch:income-vs2-partial-withdrawal-charge',
      'branch:income-vs2-surrender-charge',
      'branch:income-vs2-ad-hoc-top-up-routing',
    ],
    metadataOnlyBehaviors: [
      'income-vs2-death-ti-insurance-cover-charge',
      'income-vs2-secondary-insured-option',
      'income-vs2-life-events-withdrawal-benefit',
      'income-vs2-future-premium-option',
    ],
    warnings: [
      'Invest Flex Vantage is currently cataloged as a partial product. The regular-premium charge and bonus path is modeled, but insurance-cover charges and insured-replacement / life-event options remain informational only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(context.document, term)),
  }
}
