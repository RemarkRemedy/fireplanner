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
  const page2 = sourceRef(2, 'Premium charge', snippetNear(document, 2, 'Premium charge', 18))
  const page3 = sourceRef(3, 'Top-ups and surrender', snippetNear(document, 3, 'Single premium top-ups', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'recurrent-single-premium-charge',
      label: 'Recurring Premium Charge (Cash / SRS)',
      basis: 'annual-contribution',
      rate: 0.03,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Applies a 3% premium charge to recurrent single premiums when paid in cash or through SRS.',
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
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page2, page3],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 50,
      partialWithdrawalMinimumRemainingSelectedFundValueRules: [
        {
          activeWindow: 'policy-term',
          accountId: 'policy',
          minimumValue: 500,
        },
      ],
    },
    eecTable: [],
    warnings: [
      'This Cash / SRS variant assumes the published 3% premium-charge path for recurrent premiums and top-ups.',
      'This open-ended recurrent-single-premium product uses the no-MIP basis; ongoing premiums continue until the user changes them or the review horizon ends.',
    ],
    unsupportedItems: [
      'The current admitted-state terminal-illness payable amount is supported through manual claim-amount input on the published full-termination terminal-illness corridor, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but terminal-illness exclusions and broader claim settlement remain informational only.',
      'The published explicit selected-fund partial-surrender floor is supported on explicit one-off withdrawals using the current configured fund split as a proportional selected-fund balance proxy on the same projection row, but exact per-fund NAV divergence and fund-switching remain informational only.',
    ],
    sourceRefs: [page1, page2, page3],
  }
}

export function parseGreatEasternInvestAdvantage2Rsp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-great-invest-advantage-2-rsp',
    insurer: 'Great Eastern',
    productName: 'GREAT Invest Advantage 2 (RSP)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:great-eastern-gia2-rsp-recurrent-single-premium-charge',
      'branch:great-eastern-gia2-rsp-top-up-premium-charge',
      'branch:great-eastern-gia2-rsp-open-ended-zero-surrender-charge',
      'kernel:partial-withdrawal-minimum-amount-block',
      'kernel:partial-withdrawal-selected-fund-minimum-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'great-eastern-gia2-rsp-srs-surrender-destination',
    ],
    warnings: [
      'GREAT Invest Advantage 2 (RSP) is cataloged as a supported V1 product. The parser captures the published recurrent-premium charge path, top-up premium charge, the published S$50 minimum one-off partial withdrawal amount, the published explicit selected-fund partial-surrender floor that blocks withdrawals leaving the chosen fund below S$500 using the current configured fund split as a proportional selected-fund balance proxy on the same projection row, the current-state death and terminal-illness benefit amount as the higher of 110% of recurrent single premiums plus top-ups less partial surrenders or account value less manual current amount owing, the current admitted-state terminal-illness payable amount through manual claim-amount input on the published full-termination terminal-illness corridor, an admitted-and-settled terminal-illness claim as a current policy-termination state, and the explicit no-surrender-charge structure through the open-ended no-MIP basis, while exact per-fund NAV divergence, fund-switching, terminal-illness exclusions, broader claim settlement, and surrender-destination handling remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
