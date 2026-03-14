import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateEventChargeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

type PaymentMode = 'cash-or-srs' | 'cpfis'

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

function buildVariant(
  document: ExtractedPdfDocument,
  paymentMode: PaymentMode,
): IlpTemplateVariant {
  const premiumChargeRate = paymentMode === 'cpfis' ? 0 : 0.03
  const page1 = sourceRef(1, 'Plan overview', snippetNear(document, 1, 'About your plan'))
  const page2 = sourceRef(2, 'Premium charge and top-ups', snippetNear(document, 2, 'Premium charge', 18))
  const page3 = sourceRef(3, 'Partial and full surrender', snippetNear(document, 3, 'Partial surrender', 18))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: paymentMode === 'cpfis' ? 'Top-up Premium Charge (CPFIS)' : 'Top-up Premium Charge (Cash / SRS)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: premiumChargeRate,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        paymentMode === 'cpfis'
          ? 'No premium charge applies to accepted top-ups when the payment method is CPFIS.'
          : 'Applies the published 3% premium charge to accepted single premium top-ups paid in cash or through SRS.',
      ],
      sourceRefs: [page2],
    },
  ]

  return {
    id: paymentMode === 'cpfis' ? 'sgd-open-ended-cpfis' : 'sgd-open-ended-cash-or-srs',
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
    feeRules: [],
    eventChargeRules,
    eecTable: [],
    warnings: [
      paymentMode === 'cpfis'
        ? 'This CPFIS variant omits the initial single-premium charge because the published path is 0%, and it models the accepted top-up corridor through the event charge surface.'
        : 'This Cash / SRS variant keeps the initial 3% single-premium charge metadata-only because the current engine does not yet model one-time deductions from the initial single premium before unit creation, while accepted top-up premiums continue to use the executable event charge surface.',
      'This open-ended single-premium product uses the new no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Initial single-premium charge remains informational only because the current engine does not yet model one-time deductions from the initial single premium before unit creation.',
      'Death and terminal-illness benefit formulas remain informational only.',
      'Single-premium principal tracking remains informational only in V1.',
      'Fund-switching and minimum-transaction guards remain informational only.',
    ],
    sourceRefs: [page1, page2, page3],
  }
}

export function parseGreatEasternInvestAdvantageSp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-great-invest-advantage-sp',
    insurer: 'Great Eastern',
    productName: 'GREAT Invest Advantage (SP)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:great-eastern-gia-sp-top-up-premium-charge',
      'branch:great-eastern-gia-sp-open-ended-zero-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'great-eastern-gia-sp-initial-single-premium-charge',
      'great-eastern-gia-sp-death-benefit',
      'great-eastern-gia-sp-terminal-illness-benefit',
      'great-eastern-gia-sp-single-premium-principal-tracking',
      'great-eastern-gia-sp-srs-cpfis-surrender-destination',
    ],
    warnings: [
      'GREAT Invest Advantage (SP) is cataloged as a partial modeled subset in V1. The parser captures the published top-up premium charge and explicit no-surrender-charge structure through the open-ended no-MIP basis, while the initial single-premium charge, protection benefits, and single-premium principal tracking remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'cash-or-srs'),
      buildVariant(context.document, 'cpfis'),
    ],
  }
}
