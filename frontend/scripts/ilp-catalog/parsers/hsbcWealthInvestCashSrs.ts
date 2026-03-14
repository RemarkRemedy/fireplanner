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
  const page3 = sourceRef(3, 'Benefits', snippetNear(document, 3, 'Death Benefit', 18))
  const page5 = sourceRef(5, 'Fees and charges', snippetNear(document, 5, 'Redemption Fee', 22))
  const page6 = sourceRef(6, 'Subscription and premium types', snippetNear(document, 6, 'Premium (single, recurring and top-up)', 22))
  const page8 = sourceRef(8, 'Redemption of units', snippetNear(document, 8, 'Minimum Partial Redemption Amount', 18))
  const page11 = sourceRef(11, 'Switching of units', snippetNear(document, 11, 'SWITCHING OF UNITS', 20))
  const page14 = sourceRef(14, 'Key policy provisions', snippetNear(document, 14, 'Free-look Period', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge (Cash/SRS)',
      basis: 'annual-contribution',
      rate: 0.05,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published up-to-5% premium-charge corridor applied after allocating the initial single premium into units for the Cash/SRS corridor.',
      ],
      sourceRefs: [page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge (Cash/SRS)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published up-to-5% premium-charge corridor applied after allocating each approved top-up premium into units for the Cash/SRS corridor.',
      ],
      sourceRefs: [page6],
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
        'Models the currently nil redemption-fee path for partial redemptions.',
      ],
      sourceRefs: [page5, page8],
    },
  ]

  return {
    id: 'sgd-open-ended-cash-srs',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page6],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [],
    warnings: [
      'HSBC Life Wealth Invest (Cash/SRS) is cataloged as a partial modeled subset in V1. The parser captures the published up-to-5% premium-charge corridor for initial single premiums and top-ups plus the nil-redemption-fee withdrawal path for the Cash/SRS corridor through the open-ended no-MIP basis.',
      'Switching fees are currently nil, but dividend payout elections, switching behavior, and SRS eligibility constraints remain outside the current calculator surface.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Death and terminal-illness benefit formulas remain informational only, including the 101% of total premiums principal-style floor.',
      'Single-premium principal tracking remains informational only in V1.',
      'Recurring single premium enrollment, cadence, and failed-deduction handling remain informational only.',
      'Fund-level management charges and additional ILP-sub-fund charges remain informational only because they depend on the selected fund mix and are not a single product-level rate.',
      'Dividend payout elections, switching administration, and SRS eligibility constraints remain informational only.',
      'Termination and free-look refund behavior remain informational only.',
    ],
    sourceRefs: [page3, page5, page6, page8, page11, page14],
  }
}

export function parseHsbcWealthInvestCashSrs(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'hsbc-life-wealth-invest-cash-srs',
    insurer: 'HSBC Life',
    productName: 'HSBC Life Wealth Invest (Cash/SRS)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:hsbc-life-wealth-invest-cash-srs-max-single-premium-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-max-top-up-charge',
      'branch:hsbc-life-wealth-invest-cash-srs-zero-redemption-fee',
    ],
    metadataOnlyBehaviors: [
      'hsbc-life-wealth-invest-cash-srs-death-benefit',
      'hsbc-life-wealth-invest-cash-srs-terminal-illness-benefit',
      'hsbc-life-wealth-invest-cash-srs-single-premium-principal-tracking',
      'hsbc-life-wealth-invest-cash-srs-recurring-single-premium',
      'hsbc-life-wealth-invest-cash-srs-fund-management-charge',
      'hsbc-life-wealth-invest-cash-srs-additional-ilp-sub-fund-charges',
      'hsbc-life-wealth-invest-cash-srs-dividend-and-switching-options',
      'hsbc-life-wealth-invest-cash-srs-free-look-refund',
      'hsbc-life-wealth-invest-cash-srs-termination',
    ],
    warnings: [
      'HSBC Life Wealth Invest (Cash/SRS) is cataloged as a partial modeled subset in V1. The parser captures the published up-to-5% premium-charge corridor for initial single premiums and top-ups plus the nil-redemption-fee withdrawal path for the Cash/SRS corridor through the open-ended no-MIP basis, while protection formulas, dividend payout handling, recurring-single-premium handling, single-premium principal tracking, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
