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

const REGULAR_PREMIUM_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.8 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.55 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.5 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.08 },
  { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [0.75, 0.5, 0] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit options', snippetNear(document, 1, 'AIA Pro Lifetime Protector (II)', 22))
  const page2 = sourceRef(2, 'Special Bonus and maturity', snippetNear(document, 2, 'Special Bonus', 18))
  const page3 = sourceRef(3, 'Regular premium, top-up, and charge schedules', snippetNear(document, 3, 'Number of Full Regular Premiums paid to and accepted by us', 24))
  const page4 = sourceRef(4, 'Policy flexibility and premium variation', snippetNear(document, 4, 'Vary Regular Premium', 22))
  const page5 = sourceRef(5, 'Top-up, full surrender, and partial withdrawal', snippetNear(document, 5, 'Partial Withdrawal', 22))
  const page6 = sourceRef(6, 'Premium holiday and no lapse privilege', snippetNear(document, 6, 'No Lapse Privilege', 22))
  const page12 = sourceRef(12, 'Appendix A annual benefit charge schedule', snippetNear(document, 12, 'APPENDIX A', 22))

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'special-bonus',
      type: 'allocation',
      label: 'Special Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      yearBasis: 'premium-year',
      requiresPremiumsPaidUpToDate: true,
      rate: 0.02,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published additional 2% of regular premiums from the 10th annual / 19th semi-annual / 37th quarterly / 109th monthly paid premium onward.',
        'Premium-year timing follows accepted full regular premiums; premium-holiday and reinstatement timing effects remain informational only in V1.',
      ],
      sourceRefs: [page2, page3],
    },
  ]

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
        'Models the published regular-premium charge schedule by accepted full regular-premium count.',
        'When premiums resume after premium holiday or reinstatement, the premium charge continues from the band immediately after the last accepted regular premium.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      amountSchedule: [
        { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
      ],
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published S$5 monthly policy fee as a fixed S$60 annual drag.',
      ],
      sourceRefs: [page3],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-Up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted ad-hoc top-up premium.',
        'Top-ups are only accepted while regular premiums are fully paid when due, but that eligibility gate remains informational only in V1.',
      ],
      sourceRefs: [page3, page5],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'No policy-level partial withdrawal charge is stated in the summary.',
        'Partial withdrawals are only available after the end of the second policy year and remain subject to minimum-withdrawal and minimum-residual-value rules that stay informational only in V1.',
      ],
      sourceRefs: [page5],
    },
  ]

  return {
    id: 'sgd-open-ended-regular-pay',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
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
        sourceRefs: [page1, page3, page5],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Pro Lifetime Protector (II) is cataloged as a partial modeled subset in V1. The parser captures the published premium-year regular premium charge schedule, the 2% Special Bonus from premium year 10 onward, the fixed S$5 monthly policy fee, the 5% top-up premium charge, the nil policy-level partial-withdrawal charge path, and the first-two-policy-years full-surrender charge schedule through the open-ended regular-premium basis.',
      'The fixed S$50 monthly premium-holiday charge, AIA Appendix A benefit-charge curve, death-benefit option differences, and no-lapse privilege remain outside the current executable slice.',
    ],
    unsupportedItems: [
      'The S$50 monthly premium-holiday charge in the first two policy years remains informational only because the current event kernel does not author fixed-per-month premium-holiday deductions.',
      'Benefit Charge remains informational only because the current assurance kernel does not yet include the AIA Appendix A rate table and its insurer-specific discount overlays.',
      'Plus versus Max death-benefit payout handling remains informational only beyond the modeled charge surface.',
      'No Lapse Privilege debt carry and post-depletion fee accrual remain informational only.',
      'Partial-withdrawal eligibility timing, minimum withdrawal amount, and minimum residual policy-value rules remain informational only.',
      'Insured-amount variation, milestone-event increase option, regular-premium variation, and premium-frequency change handling remain informational only.',
      'AIA Vitality PowerUp Dollar, optional riders, fund switching, automatic fund switching, automatic fund re-balancing, and fund-level management charges remain informational only.',
      'Reinstatement underwriting and termination-side protection payouts remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page12],
  }
}

export function parseAiaProLifetimeProtectorIi({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-pro-lifetime-protector-ii',
    insurer: 'AIA Singapore',
    productName: 'AIA Pro Lifetime Protector (II)',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:aia-pro-lifetime-protector-ii-regular-premium-charge',
      'branch:aia-pro-lifetime-protector-ii-special-bonus',
      'branch:aia-pro-lifetime-protector-ii-policy-fee',
      'branch:aia-pro-lifetime-protector-ii-top-up-premium-charge',
      'branch:aia-pro-lifetime-protector-ii-zero-partial-withdrawal-charge',
      'branch:aia-pro-lifetime-protector-ii-full-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'aia-pro-lifetime-protector-ii-premium-holiday-charge-fixed-monthly',
      'aia-pro-lifetime-protector-ii-benefit-charge-plus-option',
      'aia-pro-lifetime-protector-ii-benefit-charge-max-option',
      'aia-pro-lifetime-protector-ii-death-benefit-plus-option',
      'aia-pro-lifetime-protector-ii-death-benefit-max-option',
      'aia-pro-lifetime-protector-ii-no-lapse-privilege',
      'aia-pro-lifetime-protector-ii-partial-withdrawal-eligibility-gate',
      'aia-pro-lifetime-protector-ii-top-up-eligibility-gate',
      'aia-pro-lifetime-protector-ii-insured-amount-variation',
      'aia-pro-lifetime-protector-ii-milestone-event-increase-option',
      'aia-pro-lifetime-protector-ii-regular-premium-variation',
      'aia-pro-lifetime-protector-ii-premium-frequency-change',
      'aia-pro-lifetime-protector-ii-aia-vitality-powerup-dollar',
      'aia-pro-lifetime-protector-ii-optional-riders',
      'aia-pro-lifetime-protector-ii-fund-switching-and-rebalancing',
      'aia-pro-lifetime-protector-ii-fund-management-charge',
      'aia-pro-lifetime-protector-ii-reinstatement',
      'aia-pro-lifetime-protector-ii-termination-limits',
    ],
    warnings: [
      'AIA Pro Lifetime Protector (II) is cataloged as a partial modeled subset in V1. The parser captures the premium-year regular premium charge schedule, the year-10-onward Special Bonus, the fixed S$5 monthly policy fee, the 5% top-up premium charge, the nil policy-level partial-withdrawal charge path, and the first-two-policy-years full-surrender charge schedule, while the fixed monthly premium-holiday charge, benefit-charge curve, death-benefit options, and no-lapse mechanics remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
