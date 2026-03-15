import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateBonusTier,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const WELCOME_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: 29_999.99, rate: 0.1 },
  { currency: 'SGD', minAnnualPremium: 30_000, maxAnnualPremium: null, rate: 0.12 },
]

const ADMIN_CHARGE_RATE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 10, rate: 0.03 },
] as const

const SURRENDER_AND_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.2 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Welcome Bonus / Loyalty Bonus / Maturity Bonus', snippetNear(document, 2, 'Welcome Bonus', 30))

  return [
    {
      id: 'welcome-bonus',
      type: 'allocation',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: WELCOME_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Applied to each basic regular premium received during the first 12 months of the policy for the SGD regular-pay 10-years / policy-term-15-years corridor.',
        'Single premium top-ups and unpaid regular premiums do not receive the Welcome Bonus.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 11,
      endPolicyYear: 14,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      notes: [
        'Pays 0.30% p.a. of account value on each policy anniversary immediately after the end of the 10-year premium payment term and before the original policy maturity date.',
        'If the policy is extended, loyalty bonus still ceases on the original maturity date; the extension election itself remains informational only in V1.',
      ],
      sourceRefs: [page2],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page7 = sourceRef(7, 'Administrative Charge', snippetNear(document, 7, 'Administrative Charge', 20))

  return [
    {
      id: 'administrative-charge',
      label: 'Administrative Charge',
      basis: 'account-value',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      rateSchedule: ADMIN_CHARGE_RATE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly administrative charge as 3.0% p.a. of account value during the first 10 policy years for the selected corridor.',
      ],
      sourceRefs: [page7],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and plan options', snippetNear(document, 1, 'limited premium payment term investment-linked plan', 28))
  const page2 = sourceRef(2, 'Welcome Bonus / Loyalty Bonus / Maturity Bonus', snippetNear(document, 2, 'Welcome Bonus', 30))
  const page3 = sourceRef(3, 'Extension Benefit / Free Partial Withdrawal Benefit', snippetNear(document, 3, 'Free Partial Withdrawal Benefit', 32))
  const page7 = sourceRef(7, 'Administrative Charge', snippetNear(document, 7, 'Administrative Charge', 20))
  const page8 = sourceRef(8, 'Partial Withdrawal Charge / Premium Shortfall Charge', snippetNear(document, 8, 'Premium Shortfall Charge', 28))
  const page17 = sourceRef(17, 'Appendix A charge schedules', snippetNear(document, 17, 'Appendix A', 30))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'single-premium-top-up-charge',
      label: 'Single Premium Top-up Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% charge on each accepted single premium top-up.',
      ],
      sourceRefs: [page1, page8],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: SURRENDER_AND_WITHDRAWAL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Appendix A partial-withdrawal charge schedule during the first 10 policy years.',
        'Free Partial Withdrawal Benefit elections, life-stage gating, and penalty-free withdrawal sequencing remain informational only in V1.',
      ],
      sourceRefs: [page3, page8, page17],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge on annualised basic regular premium after the grace period when premiums are unpaid during the 10-year premium payment term.',
      ],
      sourceRefs: [page8, page17],
    },
  ]

  return {
    id: 'sgd-mip-10-term-15',
    currency: 'SGD',
    mipLength: 10,
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
          { phase: 'after-mip', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page7, page8],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: buildFeeRules(document),
    eventChargeRules,
    eecTable: SURRENDER_AND_WITHDRAWAL_CHARGE_SCHEDULE.map((tier) => tier.rate),
    warnings: [
      'This partial template models the SGD / regular-pay-10-years / policy-term-15-years corridor only.',
      'This partial template models the welcome bonus tiers, the 0.30% annual loyalty bonus from policy years 11 to 14, the first-10-policy-years administrative charge, the 3% single-premium top-up charge, and the published Appendix A surrender / withdrawal / premium-shortfall charge schedules.',
      'Special Booster, Maturity Bonus, and Free Partial Withdrawal Benefit sequencing remain informational only in V1.',
    ],
    unsupportedItems: [
      'Special Booster remains informational only because it is a one-time bonus based on total basic regular premiums paid during the premium payment term.',
      'Maturity Bonus remains informational only because it is a one-time maturity-date payout on account value and is not yet represented in the current executable templates.',
      'Death and Terminal Illness payout mechanics remain informational only.',
      'Extension Benefit elections and post-extension behavior remain informational only.',
      'Free Partial Withdrawal Benefit life-stage gating, penalty-free sequencing, and withdrawal limits remain informational only.',
      'Change of Life Assured, Secondary Life Assured, and policy-continuity mechanics remain informational only.',
      'Regular withdrawal operational constraints and dividend-distribution choices remain informational only.',
      'Single-premium corridor, USD corridor, and other premium-term / policy-term combinations remain informational only.',
      'Fund-level annual management charges and switching mechanics remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page7, page8, page17],
  }
}

export function parseSinglifeLegacyInvest({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'singlife-legacy-invest',
    insurer: 'Singlife',
    productName: 'Singlife Legacy Invest',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:singlife-legacy-invest-welcome-bonus',
      'branch:singlife-legacy-invest-loyalty-bonus',
      'branch:singlife-legacy-invest-administrative-charge',
      'branch:singlife-legacy-invest-top-up-charge',
      'branch:singlife-legacy-invest-partial-withdrawal-charge',
      'branch:singlife-legacy-invest-surrender-charge',
      'branch:singlife-legacy-invest-premium-shortfall-charge',
    ],
    metadataOnlyBehaviors: [
      'singlife-legacy-invest-special-booster',
      'singlife-legacy-invest-maturity-bonus',
      'singlife-legacy-invest-protection-benefits',
      'singlife-legacy-invest-extension-benefit',
      'singlife-legacy-invest-free-partial-withdrawal-benefit',
      'singlife-legacy-invest-change-of-life-assured',
      'singlife-legacy-invest-secondary-life-assured',
      'singlife-legacy-invest-regular-withdrawal',
      'singlife-legacy-invest-dividend-distribution',
      'singlife-legacy-invest-non-sgd-and-other-term-corridors',
    ],
    warnings: [
      'Singlife Legacy Invest is cataloged as a partial modeled subset in V1. The parser captures the SGD / regular-pay-10-years / policy-term-15-years corridor: welcome bonus tiers, annual loyalty bonus, administrative charge, single-premium top-up charge, and the Appendix A surrender / withdrawal / premium-shortfall schedules.',
      'Special Booster, Maturity Bonus, Free Partial Withdrawal Benefit sequencing, and protection-side benefits remain informational only because the current engine does not yet execute those one-time or stateful mechanics.',
      'Structured extraction validated against the Singlife Legacy Invest product summary text layer.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
