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
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'Manulink Investor (II) is a single premium investment-linked policy', 12))
  const page2 = sourceRef(2, 'Premium charge and top-ups', snippetNear(document, 2, 'Premium charge', 18))
  const page2Recurring = sourceRef(2, 'Recurring single premium option', snippetNear(document, 2, 'Recurring Single Premium Option', 16))
  const page3 = sourceRef(3, 'Withdrawals, switching, and dividends', snippetNear(document, 3, 'Partial Withdrawal', 18))
  const page5 = sourceRef(5, 'Ending the policy', snippetNear(document, 5, 'Ending the policy', 14))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge (Cash / SRS)',
      basis: 'annual-contribution',
      rate: 0.03,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 3% charge on the initial single premium for cash- and SRS-funded policies.',
      ],
      sourceRefs: [page2],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge (Cash / SRS)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% charge on each top-up premium for the cash / SRS charge corridor.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge (SRS)',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% charge on each recurring single premium paid under the SRS-only RSP option.',
        'Use recurring-single-premium events to represent the standing SRS instruction and its chosen cadence.',
      ],
      sourceRefs: [page2, page2Recurring],
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
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page2],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [],
    warnings: [
      'Manulink Investor (II) is cataloged as a partial modeled subset in V1. The parser captures the published 3% single-premium, top-up, and SRS recurring-single-premium charge path for the explicit cash / SRS corridor through the open-ended no-MIP basis.',
      'CPF funding availability remains metadata-only because the product summary does not publish an explicit CPF premium-charge rate.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Death and terminal-illness benefit formulas remain informational only.',
      'Single-premium principal tracking remains informational only in V1.',
      'Partial-withdrawal and full-surrender administration remain informational only.',
      'Fund-level management fees remain informational only because they vary by chosen ILP sub-fund and are published in the fund summaries.',
      'Fund-switching and dividend distribution elections remain informational only.',
      'Lapsing and termination behavior remains informational only.',
    ],
    sourceRefs: [page1, page2, page2Recurring, page3, page5],
  }
}

export function parseManulifeManulinkInvestorIi(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-manulink-investor-ii',
    insurer: 'Manulife Singapore',
    productName: 'Manulink Investor (II)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:manulink-investor-ii-single-premium-charge',
      'branch:manulink-investor-ii-top-up-premium-charge',
      'branch:manulink-investor-ii-srs-recurring-single-premium-charge',
      'tokio-recurring-single-premium-routing',
    ],
    metadataOnlyBehaviors: [
      'manulink-investor-ii-death-benefit',
      'manulink-investor-ii-terminal-illness-benefit',
      'manulink-investor-ii-single-premium-principal-tracking',
      'manulink-investor-ii-cpf-funding-route',
      'manulink-investor-ii-partial-withdrawal',
      'manulink-investor-ii-full-surrender',
      'manulink-investor-ii-fund-management-fee',
      'manulink-investor-ii-fund-switching',
      'manulink-investor-ii-dividend-distribution-mode',
      'manulink-investor-ii-lapse-and-termination',
    ],
    warnings: [
      'Manulink Investor (II) is cataloged as a partial modeled subset in V1. The parser captures the published 3% single-premium, top-up, and SRS recurring-single-premium charge path for the explicit cash / SRS corridor through the open-ended no-MIP basis, while protection formulas, principal-tracking, CPF funding, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
