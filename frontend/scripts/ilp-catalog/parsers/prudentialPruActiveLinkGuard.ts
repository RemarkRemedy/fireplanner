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
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.75 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.55 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.45 },
  { startPolicyYear: 4, endPolicyYear: 7, rate: 0.05 },
  { startPolicyYear: 8, endPolicyYear: null, rate: 0 },
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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Nature and objective of plan', snippetNear(document, 1, 'Nature and Objective of Plan', 12))
  const page2 = sourceRef(2, 'Death and terminal illness benefits', snippetNear(document, 2, 'Multiplier benefit', 18))
  const page4 = sourceRef(4, 'Total and permanent disability benefit', snippetNear(document, 4, 'Multiplier benefit', 18))
  const page6 = sourceRef(6, 'Premium', snippetNear(document, 6, 'Minimum premium', 10))
  const page10 = sourceRef(10, 'Investment Booster (Lump Sum)', snippetNear(document, 10, 'Top-up with Investment Booster (Lump Sum)', 18))
  const page11 = sourceRef(11, 'Investment Booster (Regular) and withdrawal conditions', snippetNear(document, 11, 'Top-up with Investment Booster (Regular)', 18))
  const page12 = sourceRef(12, 'Surrender charge', snippetNear(document, 12, 'Surrender the policy', 18))
  const page13 = sourceRef(13, 'No Lapse Period', snippetNear(document, 13, 'No Lapse Period', 18))
  const page14 = sourceRef(14, 'Charges', snippetNear(document, 14, 'Premium Charge', 24))
  const page20 = sourceRef(20, 'Appendix A assurance charges', snippetNear(document, 20, 'Appendix A', 32))

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
        'Models the published regular premium charge schedule by premium year.',
        'Premium-year charge bands freeze when premiums stop and resume at the last accepted premium-year band when regular premiums restart.',
      ],
      sourceRefs: [page6, page14],
    },
    {
      id: 'administration-charge',
      label: 'Administration Charge',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      amountSchedule: [
        { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
      ],
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published S$5 monthly administration charge as a fixed S$60 annual drag.',
        'The published CPI-linked increase cap above S$5 per month remains informational only in V1.',
      ],
      sourceRefs: [page14],
    },
    {
      id: 'assurance-charge-combined',
      label: 'Assurance Charge (Death / TPD / TI)',
      basis: 'assurance-sum-at-risk',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      requiresManualInput: true,
      assuranceConfig: {
        formula: 'prudential-linkguard-combined',
        monthlyModalFactor: 0.0834,
      },
      notes: [
        'Models the guaranteed Appendix A assurance charge for Death, Total and Permanent Disability, and Terminal Illness after entering insured-life details and the current sum assured.',
        'The default modeled sum-at-risk uses 2x current sum assured before age 50 and 1x current sum assured from age 50 onward.',
        'Optional retention of the Multiplier benefit after age 50 and any medical or occupational extra loading remain informational only in V1.',
      ],
      sourceRefs: [page1, page2, page4, page14, page20],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Investment Booster (Lump Sum) Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% upfront charge on Investment Booster (Lump Sum) premiums.',
        'The recurring Investment Booster (Regular) schedule remains informational only in V1.',
      ],
      sourceRefs: [page10, page11, page14],
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
        'No policy-level partial-withdrawal charge is stated in the product summary.',
        'The 25-month fully-paid gate, minimum withdrawal amount, minimum residual account balance, and Investment Booster paid-to-date cap remain informational only in V1.',
      ],
      sourceRefs: [page11, page12],
    },
  ]

  return {
    id: 'sgd-open-ended-cash-or-srs',
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
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page10],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [],
    warnings: [
      'This supported template models the SGD open-ended core corridor with the premium-year regular premium charge schedule, the fixed S$5 monthly administration charge, the guaranteed Appendix A Death / TPD / TI assurance charge, the current-state death / terminal-illness / payable-now TPD estimates after entering the current sum assured, amount owing, the current Accelerated TI payout mode, and the current TPD settlement stage, the 3% Investment Booster (Lump Sum) premium charge, and the nil policy-level partial-withdrawal charge path.',
      'Post-age-50 current death, terminal-illness, and initial TPD estimates also need the retained Multiplier benefit status. Later staged TPD payouts also need the current remaining TPD balance. No Lapse Period debt carry, surrender-charge-on-allocated-premiums, and non-core rider charges remain informational only.',
      'The current death-benefit estimate is modeled after entering the current sum assured, current amount owing, and, after age 50, the retained Multiplier benefit status.',
      'The current Accelerated Terminal Illness estimate is modeled after entering the current sum assured, current amount owing, whether the current Accelerated TI payout still matches the death-benefit corridor, and, after age 50, the retained Multiplier benefit status.',
      'The current Total and Permanent Disability estimate is modeled as the payable-now staged claim amount after entering whether the present TPD claim still matches the death-benefit corridor, whether the currently payable stage is the initial lump sum or the later balance lump sum, and, for later-stage claims, the current remaining TPD balance.',
    ],
    unsupportedItems: [
      'Death, terminal illness, and total and permanent disability claim-side settlement remains metadata-only beyond the modeled current death / terminal-illness / payable-now TPD snapshots and Appendix A assurance-charge corridor, including deferment timing, later-balance release timing, cease-disability stop-payment handling, and post-claim continuation.',
      'Medical, occupational, and hazardous-activity extra loadings remain informational only.',
      'Critical illness, pre-critical illness, and other supplementary rider charges remain informational only.',
      'No Lapse Period amount-owed carry and reinstatement behavior remain informational only.',
      'Partial withdrawal eligibility is not enforced automatically, including the 25-month fully-paid gate and the Investment Booster paid-to-date cap.',
      'Surrender charges on allocated premiums, including separate treatment for increased sum assured and exclusion for Investment Booster premiums, remain informational only.',
      'Investment Booster (Regular) recurrence and the published stop-paying-premiums continuation behavior remain informational only.',
      'Fund-switch minimums and any future switch administration charge remain informational only.',
    ],
    sourceRefs: [page1, page6, page10, page11, page12, page13, page14],
  }
}

export function parsePrudentialPruActiveLinkGuard({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'prudential-pruactive-linkguard',
    insurer: 'Prudential',
    productName: 'PRUActive LinkGuard',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:pruactive-linkguard-premium-year-premium-charge',
      'branch:pruactive-linkguard-administration-charge',
      'branch:pruactive-linkguard-combined-assurance-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-tpd-benefit-estimate',
      'branch:pruactive-linkguard-top-up-premium-charge',
      'branch:pruactive-linkguard-zero-partial-withdrawal-charge',
    ],
    metadataOnlyBehaviors: [
      'pruactive-linkguard-no-lapse-period',
      'pruactive-linkguard-withdrawal-eligibility',
      'pruactive-linkguard-surrender-charge',
      'pruactive-linkguard-investment-booster-regular',
      'pruactive-linkguard-retained-multiplier-option',
      'pruactive-linkguard-rider-benefits-and-loadings',
      'pruactive-linkguard-protection-payout-settlement',
      'pruactive-linkguard-fund-switching',
    ],
    warnings: [
      'PRUActive LinkGuard is cataloged as a supported core corridor in V1. The parser models the premium-year regular premium charge schedule, the fixed S$5 monthly administration charge, the guaranteed Appendix A Death / TPD / TI assurance charge, the current-state death / terminal-illness / payable-now TPD estimates using manual current sum assured / amount owing / current Accelerated TI payout mode / current TPD settlement stage / post-age-50 retained multiplier status / current remaining TPD balance for later-stage claims, the 3% Investment Booster (Lump Sum) premium charge, and the nil policy-level partial-withdrawal charge path, while No Lapse Period debt carry, surrender mechanics, rider charges, and deeper claim-side payout settlement remain metadata-only.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
