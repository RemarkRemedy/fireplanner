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

const REGULAR_PREMIUM_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: null, rate: 0 },
] as const

const PREMIUM_HOLIDAY_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.6 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.3 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.2 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.2 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.1 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.1 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.05 },
  { startPolicyYear: 8, endPolicyYear: null, rate: 0 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.7,
  0.65,
  0.6,
  0.55,
  0.5,
  0.4,
  0.3,
  0.2,
  0.1,
  0.05,
  0,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  2.333,
  1.857,
  1.5,
  1.222,
  1,
  0.667,
  0.429,
  0.25,
  0.111,
  0.053,
  0,
] as const

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

function snippetNear(
  document: ExtractedPdfDocument,
  pageNumber: number,
  keyword: string,
  lineWindow = 14,
): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
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
  const page1 = sourceRef(1, 'Plan overview and bonuses', snippetNear(document, 1, 'AIA Wealth Venture', 18))
  const page2 = sourceRef(2, 'Bonuses and maturity benefit', snippetNear(document, 2, 'Investment Bonus', 18))
  const page3 = sourceRef(3, 'Regular premium and top-up subscription', snippetNear(document, 3, '100% of regular premium will be used to purchase regular premium units', 18))
  const page4 = sourceRef(4, 'Supplementary Charge and Premium Holiday Charge', snippetNear(document, 4, 'Supplementary Charge', 18))
  const page5 = sourceRef(4, 'Full Surrender Charge and Partial Withdrawal Charge', snippetNear(document, 4, 'Full Surrender Charge', 20))
  const page6 = sourceRef(5, 'Top-up and withdrawal effects', snippetNear(document, 5, 'You may request to pay additional top-up premium', 20))
  const page7 = sourceRef(7, 'Premium holiday and reinstatement', snippetNear(document, 7, 'your policy will remain on Premium Holiday', 18))
  const page8 = sourceRef(8, 'Distribution of dividends', snippetNear(document, 8, 'Distribution of Dividends', 22))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'regular-premium-charge',
      label: 'Regular Premium Charge',
      basis: 'annual-contribution',
      yearBasis: 'premium-year',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      rateSchedule: REGULAR_PREMIUM_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'policy-term',
      notes: [
        'Models the published zero regular-premium charge corridor: 100% of accepted regular premium purchases regular premium units.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'account-value',
      rate: roundRate(0.036),
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 10,
      notes: [
        'Models the published 3.60% p.a. charge on Regular Premium Policy Value for the regular-pay corridor.',
        'Benefit Charge and protection-side sum-at-risk formulas remain outside the current executable slice.',
      ],
      sourceRefs: [page4],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-Up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge on each accepted top-up premium.',
        'Top-ups are only accepted when regular premiums are fully paid when due, but that gating remains informational only in V1.',
      ],
      sourceRefs: [page3, page6],
    },
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      yearBasis: 'premium-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: PREMIUM_HOLIDAY_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        'Charged monthly during premium holiday based on the annualised regular premium.',
        'The charge stops once all outstanding regular premiums are fully repaid.',
      ],
      sourceRefs: [page4, page7],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published partial withdrawal charge factor on withdrawn Regular Premium Policy Value.',
        'The single-premium withdrawal schedule is outside the current regular-pay-only executable slice.',
      ],
      sourceRefs: [page5, page6],
    },
  ]

  return {
    id: 'sgd-mip-8',
    currency: 'SGD',
    mipLength: 8,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Regular Premium Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page6],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment as additional units unless a cash dividend election is made.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published S$50 minimum remain reinvested.',
      ],
      sourceRefs: [page8],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Wealth Venture is cataloged as a partial modeled subset in V1. The current parser models the regular-pay 8-year corridor: zero regular-premium charge, the 3.60% p.a. regular-premium supplementary charge, the premium-holiday charge schedule plus full-outstanding-premium repayment resumption, the 3% top-up premium charge, the regular-premium withdrawal / surrender charge schedules, and reinvest-default distribution support.',
      'Welcome Bonus, Investment Bonus, Performance Bonus, Benefit Charge, and Secondary Insured mechanics remain informational only in V1.',
      'Automatic fund switching, automatic fund re-balancing, and regular top-up enrollment gating remain informational only in V1.',
    ],
    unsupportedItems: [
      'Welcome Bonus, Investment Bonus, and Performance Bonus remain informational only because they credit additional regular-premium units outside the current executable slice.',
      'Benefit Charge, death benefit, accidental death benefit, secondary insured, and other protection-side formulas remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Minimum withdrawal amount, minimum post-withdrawal policy value, regular-top-up eligibility while premiums are outstanding, and top-up suspension remain informational only.',
      'Fund switching and automatic fund switching / re-balancing remain informational only.',
      'Any underwriting or approval handling around premium resumption remains informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7, page8],
  }
}

export function parseAiaWealthVenture({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-wealth-venture',
    insurer: 'AIA Singapore',
    productName: 'AIA Wealth Venture',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:aia-wealth-venture-zero-regular-premium-charge',
      'branch:aia-wealth-venture-regular-supplementary-charge',
      'branch:aia-wealth-venture-top-up-premium-charge',
      'branch:aia-wealth-venture-premium-holiday-charge',
      'branch:aia-wealth-venture-partial-withdrawal-charge',
      'branch:aia-wealth-venture-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'aia-wealth-venture-welcome-bonus',
      'aia-wealth-venture-investment-bonus',
      'aia-wealth-venture-performance-bonus',
      'aia-wealth-venture-benefit-charge',
      'aia-wealth-venture-protection-benefits',
      'aia-wealth-venture-secondary-insured-option',
      'aia-wealth-venture-fund-management-charge',
      'aia-wealth-venture-top-up-eligibility-gating',
      'aia-wealth-venture-fund-switching',
    ],
    warnings: [
      'AIA Wealth Venture is cataloged as a supported V1 product for the regular-pay 8-year corridor. The parser captures zero regular-premium charge, the 3.60% p.a. regular-premium supplementary charge, the premium-holiday charge schedule with full-outstanding-premium repayment resumption, the 3% top-up premium charge, the regular-premium withdrawal / surrender charge schedules, and reinvest-default distribution support, while bonuses, protection benefits, secondary-insured options, fund-level charges, and underwriting or approval handling around premium resumption remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
