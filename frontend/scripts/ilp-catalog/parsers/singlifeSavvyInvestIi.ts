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
  { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_999.99, rate: 0.1 },
  { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: null, rate: 0.4 },
]

const SURRENDER_CHARGE_SCHEDULE = [
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
  const page3 = sourceRef(3, 'Welcome Bonus / Loyalty Bonus / Life Stage Benefit', snippetNear(document, 3, 'Welcome Bonus', 32))
  const page5 = sourceRef(5, 'Basic regular premium allocation', snippetNear(document, 5, '1st to 120th', 20))

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
        'Applied to each basic regular premium received during the first 12 months for the SGD 10 years (Fixed) corridor.',
        'Single premium top-up and unpaid regular premiums do not receive the Welcome Bonus.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'regular-premium-allocation-uplift-policy-years-11-20',
      type: 'allocation',
      label: 'Regular Premium Allocation Uplift (Policy Years 11-20)',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 11,
      endPolicyYear: 20,
      rate: 0.02,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 102% of basic regular premium units from policy year 11 to policy year 20.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'regular-premium-allocation-uplift-policy-year-21-onward',
      type: 'allocation',
      label: 'Regular Premium Allocation Uplift (Policy Year 21 Onward)',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 21,
      endPolicyYear: null,
      rate: 0.05,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 105% of basic regular premium units from policy year 21 onward.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'loyalty-bonus-payments-1-10',
      type: 'loyalty',
      label: 'Loyalty Bonus (Payments 1-10)',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 11,
      endPolicyYear: 20,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'Models the published first 10 loyalty-bonus payments at 0.30% p.a. of account value after the 10-year fixed minimum investment period.',
        'Withdrawals in the prior 12 months suspend this loyalty-bonus payment unless the withdrawal was made under the Life Stage Benefit, which remains informational only in V1.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'loyalty-bonus-payments-11-20',
      type: 'loyalty',
      label: 'Loyalty Bonus (Payments 11-20)',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 21,
      endPolicyYear: 30,
      rate: 0.004,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'Models the published 11th to 20th loyalty-bonus payments at 0.40% p.a. of account value.',
        'Withdrawals in the prior 12 months suspend this loyalty-bonus payment unless the withdrawal was made under the Life Stage Benefit, which remains informational only in V1.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'loyalty-bonus-payments-21-plus',
      type: 'loyalty',
      label: 'Loyalty Bonus (Payments 21+)',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 31,
      endPolicyYear: null,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'Models the published 21st and subsequent loyalty-bonus payments at 0.50% p.a. of account value.',
        'Withdrawals in the prior 12 months suspend this loyalty-bonus payment unless the withdrawal was made under the Life Stage Benefit, which remains informational only in V1.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page6 = sourceRef(6, 'Administrative Charge / Supplementary Charge', snippetNear(document, 6, 'Administrative Charge', 24))

  return [
    {
      id: 'administrative-charge',
      label: 'Administrative Charge',
      basis: 'account-value',
      rate: 0.006,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 0.60% p.a. administrative charge on account value throughout the policy term.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'account-value',
      rate: 0.019,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'during-mip',
      startPolicyYear: 1,
      endPolicyYear: 10,
      notes: [
        'Models the published 1.90% p.a. supplementary charge on account value during the first 10 policy years.',
      ],
      sourceRefs: [page6],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and minimum investment period options', snippetNear(document, 1, 'whole life, regular premium investment-linked plan', 28))
  const page2 = sourceRef(2, 'Minimum Investment Period and Welcome Bonus table', snippetNear(document, 2, '10 years (Fixed)', 28))
  const page3 = sourceRef(3, 'Loyalty Bonus / Life Stage Benefit', snippetNear(document, 3, 'Loyalty Bonus', 34))
  const page5 = sourceRef(5, 'Basic regular premium allocation', snippetNear(document, 5, '1st to 120th', 20))
  const page6 = sourceRef(6, 'Administrative Charge / Supplementary Charge', snippetNear(document, 6, 'Administrative Charge', 24))
  const page7 = sourceRef(7, 'Surrender Charge / Partial Withdrawal Charge / Premium Shortfall Charge', snippetNear(document, 7, 'Surrender charge', 34))
  const page8 = sourceRef(8, 'Premium holiday / Partial withdrawal / Surrender', snippetNear(document, 8, 'Premium holiday during the minimum investment period', 34))
  const page12 = sourceRef(12, 'Distribution of Dividends', snippetNear(document, 12, 'Distribution of Dividends', 24))
  const page13 = sourceRef(13, 'Dividend cash-out threshold', snippetNear(document, 13, 'minimum dividend cash out amount', 18))
  const page15 = sourceRef(15, 'Appendix A charge schedules', snippetNear(document, 15, 'Appendix A', 30))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'single-premium-top-up-charge',
      label: 'Single Premium Top-up Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the currently published nil premium charge on single premium top-ups.',
      ],
      sourceRefs: [page7, page8],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: SURRENDER_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Appendix A partial-withdrawal charge schedule for the 10 years (Fixed) corridor.',
        'Life Stage Benefit withdrawals waive this charge and bypass the withdrawal limit, but those benefit elections remain informational only in V1.',
      ],
      sourceRefs: [page3, page7, page8, page15],
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
        'Models the published monthly premium shortfall charge after the grace period when regular premiums are unpaid during the 10-year fixed minimum investment period.',
        'Back-payments are not allowed; use premium-holiday exit by resuming ongoing premium payments only.',
      ],
      sourceRefs: [page7, page8, page15],
    },
  ]

  return {
    id: 'sgd-mip-10-fixed',
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
        sourceRefs: [page1, page5, page6],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: buildFeeRules(document),
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest declared dividends or pay them out in cash, with reinvestment as the default if no option is elected.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption and the published S$40 minimum cash-out threshold remains informational only.',
      ],
      sourceRefs: [page12, page13],
    },
    eecTable: SURRENDER_CHARGE_SCHEDULE.map((tier) => tier.rate),
    warnings: [
      'This partial template models the SGD / 10 years (Fixed) corridor only.',
      'This partial template models the welcome bonus tiers, the 100% / 102% / 105% regular-premium allocation ladder, the published loyalty-bonus payment windows, the 0.60% administrative charge, the first-10-policy-years 1.90% supplementary charge, the currently nil top-up charge, the Appendix A surrender / withdrawal / premium-shortfall schedules, and the reinvest-default distribution-mode assumption surface.',
      'Life Stage Benefit, cost of insurance, and other minimum-investment-period variants remain informational only in V1.',
    ],
    unsupportedItems: [
      'Life Stage Benefit penalty waivers, timing windows, and allowable partial-withdrawal-limit overrides remain informational only.',
      'Cost of Insurance and all death / terminal-illness protection payouts remain informational only because they depend on sum at risk, attained age, gender, smoking status, and claim-state handling.',
      'Change of Life Assured and rider continuity effects remain informational only.',
      'Flexible MIP variants, other fixed MIP variants, and other annualised-premium corridors remain informational only.',
      'Allowable partial withdrawal amount limits from Appendix B remain informational only.',
      'Fund switching, fund-level annual management charges, the published S$40 dividend cash-out threshold, and future non-guaranteed top-up-charge changes remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page5, page6, page7, page8, page12, page13, page15],
  }
}

export function parseSinglifeSavvyInvestIi({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'singlife-savvy-invest-ii',
    insurer: 'Singlife',
    productName: 'Singlife Savvy Invest II',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:singlife-savvy-invest-ii-welcome-bonus',
      'branch:singlife-savvy-invest-ii-regular-premium-allocation-uplift',
      'branch:singlife-savvy-invest-ii-loyalty-bonus',
      'branch:singlife-savvy-invest-ii-administrative-charge',
      'branch:singlife-savvy-invest-ii-supplementary-charge',
      'branch:singlife-savvy-invest-ii-zero-top-up-charge',
      'branch:singlife-savvy-invest-ii-partial-withdrawal-charge',
      'branch:singlife-savvy-invest-ii-surrender-charge',
      'branch:singlife-savvy-invest-ii-premium-shortfall-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'singlife-savvy-invest-ii-life-stage-benefit',
      'singlife-savvy-invest-ii-cost-of-insurance',
      'singlife-savvy-invest-ii-protection-benefits',
      'singlife-savvy-invest-ii-change-of-life-assured',
      'singlife-savvy-invest-ii-appendix-b-withdrawal-limits',
      'singlife-savvy-invest-ii-flexible-and-other-mip-corridors',
      'singlife-savvy-invest-ii-dividend-cashout-threshold',
      'singlife-savvy-invest-ii-fund-management-and-switching',
    ],
    warnings: [
      'Singlife Savvy Invest II is cataloged as a partial modeled subset in V1. The parser captures the SGD / 10 years (Fixed) corridor: welcome bonus tiers, regular-premium allocation uplifts, loyalty-bonus windows, administrative and supplementary charges, the currently nil top-up charge, the Appendix A surrender / withdrawal / premium-shortfall schedules, and reinvest-default distribution support.',
      'Life Stage Benefit waivers, cost of insurance, and protection-side benefits remain informational only because the current engine does not yet execute those stateful or insured-life-dependent mechanics.',
      'Structured extraction validated against the Singlife Savvy Invest II product summary text layer.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
