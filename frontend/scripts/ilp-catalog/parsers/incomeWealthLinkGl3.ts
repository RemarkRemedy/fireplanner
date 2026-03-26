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
  const page1 = sourceRef(1, 'Policy description', snippetNear(document, 1, 'WealthLink is a single premium investment-linked plan', 12))
  const page2 = sourceRef(2, 'Death and accidental death benefits', snippetNear(document, 2, 'Accidental Death Benefit', 16))
  const page5 = sourceRef(5, 'Charges', snippetNear(document, 5, 'Premium Charge', 18))
  const page6 = sourceRef(6, 'Subscription of units', snippetNear(document, 6, 'Single Premium', 18))
  const page6RegularTopUp = sourceRef(6, 'Regular single premium top ups', snippetNear(document, 6, 'Regular Single Premium Top ups', 12))
  const page8 = sourceRef(8, 'Partial withdrawals and surrender', snippetNear(document, 8, 'Full Surrender and Partial Withdrawals', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'initial-single-premium',
      rate: 0.035,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Applies a 3.5% premium charge to the initial single premium.',
      ],
      sourceRefs: [page5, page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.035,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies a 3.5% premium charge to each top-up.',
      ],
      sourceRefs: [page5, page6],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Regular Single Premium Top-up Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0.035,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies the published 3.5% premium charge to each regular single premium top-up.',
        'Use recurring-single-premium events to represent the chosen monthly, quarterly, half-yearly, or annual top-up cadence.',
      ],
      sourceRefs: [page5, page6, page6RegularTopUp],
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
        'The published withdrawal section states there is no surrender charge on full or partial cash-ins.',
      ],
      sourceRefs: [page8],
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
        sourceRefs: [page1, page6],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [],
    warnings: [
      'WealthLink (GL3) is cataloged as a supported V1 product. The parser captures the published 3.5% upfront single-premium charge, ad hoc top-up and regular single premium top-up charge path, the explicit no-surrender-charge withdrawal path through the open-ended no-MIP basis, the current ordinary death-benefit estimate as 105% or 101% of net premiums paid using the age-65-anniversary tier, and the current accidental-death estimate as the published 105%-of-net-premiums corridor during the age-66-to-74 accident window.',
      'This product currently has no policy fee and no insurance cover charge.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Accidental-death claim admission, the 365-day accident timing gate, exclusions, and claim settlement remain informational only beyond the modeled current ordinary and accidental-death benefit estimates.',
      'Fund-level annual management fees remain informational only because they are published outside the product summary and vary by chosen ILP sub-fund.',
      'Fund-switching administration remains informational only.',
    ],
    sourceRefs: [page1, page2, page5, page6, page8],
  }
}

export function parseIncomeWealthLinkGl3(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'income-wealthlink-gl3',
    insurer: 'Income Insurance',
    productName: 'WealthLink (GL3)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:income-wealthlink-gl3-single-premium-charge',
      'branch:income-wealthlink-gl3-top-up-premium-charge',
      'branch:income-wealthlink-gl3-recurring-single-premium-charge',
      'branch:income-wealthlink-gl3-open-ended-zero-surrender-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'tokio-recurring-single-premium-routing',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'income-wealthlink-gl3-accidental-death-claim-exclusions',
      'income-wealthlink-gl3-fund-level-annual-management-fee',
      'income-wealthlink-gl3-fund-switching',
    ],
    warnings: [
      'WealthLink (GL3) is cataloged as a supported V1 product. The parser captures the published 3.5% upfront single-premium charge, ad hoc top-up and regular single premium top-up charge path, the explicit no-surrender-charge withdrawal path through the open-ended no-MIP basis, the current ordinary death-benefit estimate as 105% or 101% of net premiums paid using the age-65-anniversary tier, and the current accidental-death estimate as the published 105%-of-net-premiums corridor during the age-66-to-74 accident window, while accidental-death claim admission, the 365-day accident timing gate, exclusions, settlement, and fund-level annual management fees remain informational only beyond the modeled current ordinary and accidental-death benefit estimates.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
