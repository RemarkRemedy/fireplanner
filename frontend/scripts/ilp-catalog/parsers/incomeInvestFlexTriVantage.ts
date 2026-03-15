import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateEventChargeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const MIP_LENGTH = 10
const SURRENDER_AND_WITHDRAWAL_CHARGE = [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05]
const PREMIUM_HOLIDAY_CHARGE = [1, 1, 0.8, 0, 0, 0, 0, 0, 0, 0]

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

function buildBonuses(page2: IlpCatalogSourceRef): IlpTemplateBonus[] {
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
      rate: 0.15,
      amount: null,
      tieredRates: [],
      notes: [
        'Applied to regular premiums paid in the first 12 months only.',
        'No investment bonus is provided for top-up premiums.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      notes: [
        'Loyalty bonus starts from the 10th policy anniversary irrespective of premium holiday.',
        'No withdrawal in the previous 12 months is required, excluding withdrawals under Life Events Withdrawal Benefit.',
      ],
      sourceRefs: [page2],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan description and MIP', snippetNear(document, 1, 'Minimum Investment Period', 12))
  const page2 = sourceRef(2, 'Regular premium allocation and bonuses', snippetNear(document, 2, 'Investment Bonus', 18))
  const page4 = sourceRef(4, 'Secondary insured and life events withdrawal benefit', snippetNear(document, 4, 'Secondary Insured Option', 18))
  const page6 = sourceRef(6, 'Premium holiday and partial withdrawal', snippetNear(document, 6, 'Premium holiday', 16))
  const page8 = sourceRef(8, 'Insurance cover charge', snippetNear(document, 8, 'insurance cover charge', 16))
  const page16 = sourceRef(16, 'Appendix 2 surrender charge', snippetNear(document, 16, 'Appendix 2', 16))
  const page17 = sourceRef(17, 'Appendix 3 partial withdrawal charge', snippetNear(document, 17, 'Appendix 3', 16))
  const page18 = sourceRef(18, 'Appendix 4 premium holiday charge', snippetNear(document, 18, 'Appendix 4', 16))
  const page22 = sourceRef(22, 'Declaration and reinvesting of distributions', snippetNear(document, 22, 'Declaration and Reinvesting of Distributions', 18))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PREMIUM_HOLIDAY_CHARGE),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applied monthly during premium holiday within the MIP. From the 3rd policy anniversary, premium holiday is free for up to 84 months; the published table is modeled with zero rates from policy year 4 onward.',
      ],
      sourceRefs: [page6, page18],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(SURRENDER_AND_WITHDRAWAL_CHARGE),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applied to partial withdrawals during the minimum investment period.',
        'Life Events Withdrawal Benefit free withdrawals remain informational only in V1.',
      ],
      sourceRefs: [page4, page6, page17],
    },
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
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
        sourceRefs: [page1, page2],
      },
    ],
    bonuses: buildBonuses(page2),
    feeRules: [],
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Distribution-paying ILP sub-funds default to reinvestment, and future payouts can be elected by written instruction when the fund-level minimum amount is met.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption and the published minimum distribution amount remains informational only.',
      ],
      sourceRefs: [page22],
    },
    eecTable: [...SURRENDER_AND_WITHDRAWAL_CHARGE],
    warnings: [
      'Invest Flex TriVantage is currently modeled as a partial product in V1. Regular-premium allocation uplifts, investment bonus, loyalty bonus, top-up routing, premium-holiday charge, partial-withdrawal charge, surrender-charge schedules, and reinvest-default distribution support are modeled.',
      'Insurance cover charges, secondary insured option, life events withdrawal benefit, future premium option, and the published minimum distribution amount remain informational only.',
    ],
    unsupportedItems: [
      'Death and terminal illness insurance cover charges remain informational only.',
      'Secondary insured option remains informational only.',
      'Life Events Withdrawal Benefit free-withdrawal treatment remains informational only.',
      'Future Premium Option remains informational only.',
      'The published minimum distribution amount and fund-level payout processing remain informational only.',
    ],
    sourceRefs: [page1, page2, page4, page6, page8, page16, page17, page18, page22],
  }
}

export function parseIncomeInvestFlexTriVantage(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'income-invest-flex-trivantage',
    insurer: 'Income Insurance',
    productName: 'Invest Flex TriVantage',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:income-vs3-regular-premium-allocation-uplift',
      'branch:income-vs3-investment-bonus',
      'branch:income-vs3-loyalty-bonus',
      'branch:income-vs3-premium-holiday-charge',
      'branch:income-vs3-partial-withdrawal-charge',
      'branch:income-vs3-surrender-charge',
      'branch:income-vs3-ad-hoc-top-up-routing',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'income-vs3-death-ti-insurance-cover-charge',
      'income-vs3-secondary-insured-option',
      'income-vs3-life-events-withdrawal-benefit',
      'income-vs3-future-premium-option',
      'income-vs3-distribution-payout-threshold',
    ],
    warnings: [
      'Invest Flex TriVantage is currently cataloged as a partial product. The regular-premium charge and bonus path plus reinvest-default distribution support are modeled, but insurance-cover charges and insured-replacement / life-event options remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
