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
  const page1 = sourceRef(1, 'Plan description and subscription', snippetNear(document, 1, 'TM Wealth Enhancer is a whole life single premium investment-linked plan', 18))
  const page2 = sourceRef(2, 'Fees and charges', snippetNear(document, 2, 'Fees and Charges', 20))
  const page3 = sourceRef(3, 'Administrative charge and termination', snippetNear(document, 3, 'Administrative Charge', 20))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge (CPF)',
      basis: 'annual-contribution',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 100% allocation of the initial CPF-funded single premium with no additional premium charge.',
      ],
      sourceRefs: [page1],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Ad-Hoc Top-up Premium Charge (CPF)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 100% allocation of ad-hoc top-up premiums with no additional top-up charge.',
      ],
      sourceRefs: [page1],
    },
  ]

  return {
    id: 'sgd-open-ended-cpf',
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
        sourceRefs: [page1],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [],
    warnings: [
      'TM Wealth Enhancer (CPFIS) is cataloged as a partial modeled subset in V1. The parser captures the published zero-charge single-premium and ad-hoc top-up allocation path for the CPF-funded corridor through the open-ended no-MIP basis.',
      'Administrative charge is not applicable and switching is published as free, but switching behavior itself remains outside the current calculator surface.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Death-benefit protection formulas remain informational only.',
      'Single-premium and top-up policy-value tracking remain informational only in V1.',
      'Regular top-up premium enrollment remains informational only in V1.',
      'Partial-withdrawal and full-surrender administration remain informational only.',
      'Fund-level management fees and embedded custody or bank charges remain informational only because they are reflected through fund pricing rather than the policy charge surface.',
      'Fund-switching behavior remains informational only.',
      'Lapse and termination behavior remains informational only.',
    ],
    sourceRefs: [page1, page2, page3],
  }
}

export function parseTokioMarineWealthEnhancerCpfis(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-wealth-enhancer-cpfis',
    insurer: 'Tokio Marine',
    productName: 'TM Wealth Enhancer (CPFIS)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:tokio-marine-wealth-enhancer-cpfis-zero-single-premium-charge',
      'branch:tokio-marine-wealth-enhancer-cpfis-zero-top-up-charge',
    ],
    metadataOnlyBehaviors: [
      'tokio-marine-wealth-enhancer-cpfis-death-benefit',
      'tokio-marine-wealth-enhancer-cpfis-single-premium-policy-value-tracking',
      'tokio-marine-wealth-enhancer-cpfis-regular-top-up-premiums',
      'tokio-marine-wealth-enhancer-cpfis-partial-withdrawal',
      'tokio-marine-wealth-enhancer-cpfis-full-surrender',
      'tokio-marine-wealth-enhancer-cpfis-fund-management-fee',
      'tokio-marine-wealth-enhancer-cpfis-accounting-and-custody-fees',
      'tokio-marine-wealth-enhancer-cpfis-fund-switching',
      'tokio-marine-wealth-enhancer-cpfis-lapse-and-termination',
    ],
    warnings: [
      'TM Wealth Enhancer (CPFIS) is cataloged as a partial modeled subset in V1. The parser captures the published zero-charge single-premium and ad-hoc top-up allocation path for the CPF-funded corridor through the open-ended no-MIP basis, while protection formulas, regular top-up enrollment, withdrawal administration, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
