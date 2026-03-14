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
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.3 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.2 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.1 },
  { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
] as const

const PREMIUM_HOLIDAY_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
  { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.5,
  0.45,
  0.4,
  0.35,
  0.3,
  0.25,
  0.2,
  0.15,
  0.1,
  0.05,
  0,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  1,
  0.818,
  0.667,
  0.538,
  0.429,
  0.333,
  0.25,
  0.176,
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
  const page1 = sourceRef(1, 'Plan overview and Target Monthly Retirement Income', snippetNear(document, 1, 'Target Monthly Retirement Income', 18))
  const page2 = sourceRef(2, 'Monthly Retirement Income and Power-up Bonus', snippetNear(document, 2, 'Monthly Retirement Income', 18))
  const page3 = sourceRef(3, 'Regular premium and top-up subscription', snippetNear(document, 3, '100% of Regular Premium less Premium Charge', 18))
  const page4 = sourceRef(4, 'Supplementary Charge and Premium Holiday Charge', snippetNear(document, 4, 'Supplementary Charge', 18))
  const page5 = sourceRef(4, 'Full Surrender Charge and Partial Withdrawal Charge', snippetNear(document, 4, 'Full Surrender Charge', 20))
  const page6 = sourceRef(5, 'Top-up and withdrawal effects', snippetNear(document, 5, 'You may request to pay additional top-up premium', 20))
  const page7 = sourceRef(7, 'Premium holiday and reinstatement', snippetNear(document, 7, 'For reinstatement', 18))

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
        'Models the published regular premium charge schedule by accepted premium count.',
        'If premiums were missed and later resumed, the regular premium charge continues from the band immediately after the last accepted regular premium.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'account-value',
      rate: roundRate(0.025),
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 5,
      notes: [
        'Models the published 2.50% p.a. charge on Regular Premium Policy Value for the regular-pay corridor.',
        'The separate 0.50% p.a. single-premium supplementary charge remains outside the current executable slice.',
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
    id: 'sgd-mip-5',
    currency: 'SGD',
    mipLength: 5,
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
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
      notes: [
        'Target Monthly Retirement Income after the selected retirement age is paid by redeeming units from policy value.',
      ],
      sourceRefs: [page1, page2],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Platinum Retirement Elite is cataloged as a partial modeled subset in V1. The current parser models only the regular-pay 5-year corridor: premium-year regular premium charges, the 2.50% p.a. regular-premium supplementary charge, the premium-holiday charge schedule, the 3% top-up premium charge, the regular-premium withdrawal / surrender charge schedules, and scheduled payout capability through the payout-state kernel.',
      'Target Monthly Retirement Income amount, payout-age selection, payout-period selection, and stepped-up-income election remain manual or informational inputs in V1.',
      'The single-pay corridor, including 5% initial premium charge, 0.50% p.a. single-premium supplementary charge, and single-premium withdrawal / surrender charge schedules, remains outside the current executable slice.',
    ],
    unsupportedItems: [
      'Target Monthly Retirement Income amount, Target Retirement Age, Target Payout Period, and Stepped-up Income Option remain manual-assumption inputs in V1.',
      'Power-up Bonus remains informational only because it depends on a withdrawal-adjustment factor and separately documented single-premium versus regular-premium policy values.',
      'Single-pay and SRS single-premium corridors remain informational only in V1, including the 5% single-premium charge and single-premium withdrawal / surrender charge schedules.',
      'Death, accidental death, and terminal illness benefit formulas remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Minimum withdrawal amount, minimum post-withdrawal policy value, top-up eligibility while premiums are outstanding, and top-up suspension remain informational only.',
      'Fund switching mechanics remain informational only.',
      'Reinstatement and premium-holiday effects on payout continuity remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7],
  }
}

export function parseAiaPlatinumRetirementElite({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-platinum-retirement-elite',
    insurer: 'AIA Singapore',
    productName: 'AIA Platinum Retirement Elite',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:aia-platinum-retirement-elite-regular-premium-charge',
      'branch:aia-platinum-retirement-elite-regular-supplementary-charge',
      'branch:aia-platinum-retirement-elite-top-up-premium-charge',
      'branch:aia-platinum-retirement-elite-premium-holiday-charge',
      'branch:aia-platinum-retirement-elite-partial-withdrawal-charge',
      'branch:aia-platinum-retirement-elite-full-surrender-charge',
      'kernel:scheduled-payout-manual-assumption',
    ],
    metadataOnlyBehaviors: [
      'aia-platinum-retirement-elite-monthly-retirement-income-election',
      'aia-platinum-retirement-elite-stepped-up-income-option',
      'aia-platinum-retirement-elite-power-up-bonus',
      'aia-platinum-retirement-elite-single-premium-corridor',
      'aia-platinum-retirement-elite-protection-benefits',
      'aia-platinum-retirement-elite-fund-management-charge',
      'aia-platinum-retirement-elite-top-up-eligibility-gating',
      'aia-platinum-retirement-elite-fund-switching',
      'aia-platinum-retirement-elite-reinstatement-and-payout-continuity',
    ],
    warnings: [
      'AIA Platinum Retirement Elite is cataloged as a partial modeled subset in V1. The current parser models only the regular-pay 5-year corridor: premium-year regular premium charges, the 2.50% p.a. regular-premium supplementary charge, the premium-holiday charge schedule, the 3% top-up premium charge, the regular-premium withdrawal / surrender charge schedules, and scheduled payout capability through the payout-state kernel, while the single-pay corridor, payout-election logic, bonuses, protection benefits, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
