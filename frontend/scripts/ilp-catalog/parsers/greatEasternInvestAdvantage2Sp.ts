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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 8): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview', snippetNear(document, 1, 'About your plan'))
  const page2 = sourceRef(2, 'Premium charge and top-ups', snippetNear(document, 2, 'Premium charge', 18))
  const page3 = sourceRef(3, 'Partial and full surrender', snippetNear(document, 3, 'Partial surrender', 18))

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
        'Applies a 3% premium charge to the single premium when paid in cash or through SRS.',
        'The same published premium-charge table also applies to accepted single premium top-ups.',
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
        'Applies the published 3% premium charge to accepted single premium top-ups paid in cash or through SRS.',
      ],
      sourceRefs: [page2],
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
      'This Cash / SRS variant assumes the published 3% premium-charge path for initial and top-up premiums.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Death and terminal-illness benefit formulas remain informational only.',
      'Single-premium principal tracking remains informational only in V1.',
      'Fund-switching and minimum-transaction guards remain informational only.',
    ],
    sourceRefs: [page1, page2, page3],
  }
}

export function parseGreatEasternInvestAdvantage2Sp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-great-invest-advantage-2-sp',
    insurer: 'Great Eastern',
    productName: 'GREAT Invest Advantage 2 (SP)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:great-eastern-gia2-sp-single-premium-charge',
      'branch:great-eastern-gia2-sp-top-up-premium-charge',
      'branch:great-eastern-gia2-sp-open-ended-zero-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'great-eastern-gia2-sp-death-benefit',
      'great-eastern-gia2-sp-terminal-illness-benefit',
      'great-eastern-gia2-sp-single-premium-principal-tracking',
      'great-eastern-gia2-sp-srs-surrender-destination',
    ],
    warnings: [
      'GREAT Invest Advantage 2 (SP) is cataloged as a partial modeled subset in V1. The parser captures the published premium-charge path, top-up premium charge, and explicit no-surrender-charge structure through the open-ended no-MIP basis, while protection benefits and single-premium principal tracking remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
