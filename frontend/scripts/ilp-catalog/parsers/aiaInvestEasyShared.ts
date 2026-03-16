import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

export interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

interface AiaInvestEasyConfig {
  id: string
  insurer: string
  productName: string
  variantId: string
  singlePremiumChargeRate: number
  topUpChargeRate: number
  recurringTopUpChargeRate: number
  modeledEconomics: string[]
  metadataOnlyBehaviors: string[]
  warnings: string[]
  unsupportedItems: string[]
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

function snippetNear(
  document: ExtractedPdfDocument,
  pageNumber: number,
  keyword: string,
  lineWindow = 10,
): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument, config: AiaInvestEasyConfig): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan description and benefits', snippetNear(document, 1, config.productName, 18))
  const page2 = sourceRef(2, 'Subscription and policy options', snippetNear(document, 2, '5. Fees and Charges', 26))
  const page2Recurring = sourceRef(document.pages.length > 3 ? 2 : 2, 'Regular top-up premiums', snippetNear(document, 2, 'You may pay regular top-up premiums', 10))
  const page3 = sourceRef(3, 'Fund switching and free-look', snippetNear(document, 3, '7. Other Material Information', 22))
  const page4 = sourceRef(4, 'Exclusions and available funds', snippetNear(document, 4, '8. Other Material Information', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'annual-contribution',
      rate: config.singlePremiumChargeRate,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        config.singlePremiumChargeRate === 0
          ? 'Models the published 100% allocation of the initial single premium into units with no policy-level premium deduction.'
          : 'Models the published upfront 3% premium charge on the initial single premium subscription.',
      ],
      sourceRefs: [page1, page2],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: config.topUpChargeRate,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        config.topUpChargeRate === 0
          ? 'Models the published 100% allocation of top-up premiums into units with no policy-level top-up deduction.'
          : 'Models the published upfront 3% premium charge on each top-up premium.',
      ],
      sourceRefs: [page1, page2],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Regular Top-up Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: config.recurringTopUpChargeRate,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        config.recurringTopUpChargeRate === 0
          ? 'Models the published 100% allocation of recurring top-up premiums into units with no policy-level deduction.'
          : 'Models the published upfront 3% premium charge on each recurring top-up premium.',
        'Use recurring-single-premium events to represent the chosen monthly, quarterly, semi-annual, or annual regular top-up stream.',
      ],
      sourceRefs: [page1, page2, page2Recurring],
    },
  ]

  return {
    id: config.variantId,
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
      ...config.warnings,
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: config.unsupportedItems,
    sourceRefs: [page1, page2, page3, page4],
  }
}

export function buildAiaInvestEasyProduct(
  context: ParseContext,
  config: AiaInvestEasyConfig,
): IlpCatalogProduct {
  return {
    id: config.id,
    insurer: config.insurer,
    productName: config.productName,
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: config.modeledEconomics,
    metadataOnlyBehaviors: config.metadataOnlyBehaviors,
    warnings: [
      `${config.productName} is cataloged as a supported V1 product. ${config.warnings[0]}`,
    ],
    archived: false,
    variants: [buildVariant(context.document, config)],
  }
}
