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
  const page3 = sourceRef(3, 'Policy description and flexible options', snippetNear(document, 3, 'SNACK-Investment is a single-premium micro investment-linked plan', 20))
  const page4 = sourceRef(4, 'Fees and charges', snippetNear(document, 4, '4. FEES & CHARGES', 18))
  const page5 = sourceRef(5, 'Premiums and top-ups', snippetNear(document, 5, '5. SUBSCRIPTION OF UNITS', 28))
  const page6 = sourceRef(6, 'Withdrawals and suspension', snippetNear(document, 6, '6. REDEMPTION OF UNITS', 24))
  const page7 = sourceRef(7, 'Free-look and distributions', snippetNear(document, 7, '9. FREE-LOOK', 22))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'annual-contribution',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published initial-premium purchase path with no policy-level premium charge.',
      ],
      sourceRefs: [page5],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published top-up purchase path with no policy-level top-up charge.',
      ],
      sourceRefs: [page3, page5],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published redeem-anytime with no-penalty withdrawal path.',
      ],
      sourceRefs: [page3, page6],
    },
  ]

  return {
    id: 'sgd-open-ended',
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
        sourceRefs: [page5],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: [
        'SNACK-Investment reinvests any declared ILP sub-fund distributions back into the same sub-fund.',
        'The published product summary states that distributions are not paid out under this product.',
      ],
      sourceRefs: [page7],
    },
    eecTable: [],
    warnings: [
      'SNACK-Investment is cataloged as a partial modeled subset in V1. The parser captures the published zero-charge initial premium, top-up, and no-penalty withdrawal path through the open-ended no-MIP basis.',
      'The plan reinvests declared distributions and does not support cash payouts in the published corridor; fund-level management fees remain outside the current calculator surface.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Accidental-death protection formulas remain informational only.',
      'Single-premium and top-up net-premium tracking remain informational only in V1.',
      'Trigger-driven top-up enrollment, weekly cap handling, and Auto Invest behavior remain informational only.',
      'Fund-level annual management fees remain informational only because the product summary publishes them only at fund level and does not give a single policy-level rate.',
      'Suspension, fund closure, and merged-fund handling remain informational only.',
      'Free-look refund mechanics remain informational only.',
    ],
    sourceRefs: [page3, page4, page5, page6, page7],
  }
}

export function parseIncomeSnackInvestment(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'income-snack-investment',
    insurer: 'Income Insurance',
    productName: 'SNACK-Investment',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:income-snack-investment-zero-single-premium-charge',
      'branch:income-snack-investment-zero-top-up-charge',
      'branch:income-snack-investment-zero-withdrawal-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'income-snack-investment-accidental-death-benefit',
      'income-snack-investment-single-premium-net-premium-tracking',
      'income-snack-investment-trigger-driven-top-ups',
      'income-snack-investment-auto-invest-weekly-cap',
      'income-snack-investment-fund-management-fee',
      'income-snack-investment-suspension-of-dealings',
      'income-snack-investment-free-look',
    ],
    warnings: [
      'SNACK-Investment is cataloged as a partial modeled subset in V1. The parser captures the published zero-charge initial premium, top-up, and no-penalty withdrawal path through the open-ended no-MIP basis, plus the reinvest-only distribution mode published for this product, while accidental-death protection, trigger-driven top-up automation, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
