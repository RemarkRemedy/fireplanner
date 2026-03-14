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
  const page6 = sourceRef(6, 'Premium', snippetNear(document, 6, 'Minimum premium', 10))
  const page10 = sourceRef(10, 'Investment Booster (Lump Sum)', snippetNear(document, 10, 'Top-up with Investment Booster (Lump Sum)', 18))
  const page11 = sourceRef(11, 'Investment Booster (Regular) and withdrawal conditions', snippetNear(document, 11, 'Top-up with Investment Booster (Regular)', 18))
  const page12 = sourceRef(12, 'Surrender charge', snippetNear(document, 12, 'Surrender the policy', 18))
  const page13 = sourceRef(13, 'No Lapse Period', snippetNear(document, 13, 'No Lapse Period', 18))
  const page14 = sourceRef(14, 'Charges', snippetNear(document, 14, 'Premium Charge', 24))

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
      'PRUActive LinkGuard is modeled as a partial subset in V1. The parser captures the premium-year regular premium charge schedule, the S$5 monthly administration charge, and the 3% Investment Booster (Lump Sum) premium charge.',
      'Assurance charges depend on Appendix A rates, age, sum assured, Multiplier settings, and possible medical or occupational loadings, so they remain informational only in V1.',
      'No Lapse Period debt carry, withdrawal eligibility gating, surrender-charge-on-allocated-premiums, and Investment Booster (Regular) recurrence remain informational only in V1.',
    ],
    unsupportedItems: [
      'Death, terminal illness, total and permanent disability, and multiplier-benefit payout mechanics remain informational only.',
      'Appendix A assurance charge curves and medical or occupational loadings remain informational only.',
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
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:pruactive-linkguard-premium-year-premium-charge',
      'branch:pruactive-linkguard-administration-charge',
      'branch:pruactive-linkguard-top-up-premium-charge',
    ],
    metadataOnlyBehaviors: [
      'pruactive-linkguard-assurance-charge',
      'pruactive-linkguard-no-lapse-period',
      'pruactive-linkguard-withdrawal-eligibility',
      'pruactive-linkguard-surrender-charge',
      'pruactive-linkguard-investment-booster-regular',
      'pruactive-linkguard-protection-benefits',
      'pruactive-linkguard-fund-switching',
    ],
    warnings: [
      'PRUActive LinkGuard is cataloged as a partial modeled subset in V1. The parser captures the premium-year regular premium charge schedule, the S$5 monthly administration charge, and the 3% Investment Booster (Lump Sum) premium charge, while assurance charges, No Lapse Period debt behavior, withdrawal eligibility, surrender mechanics, and protection-side payouts remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
