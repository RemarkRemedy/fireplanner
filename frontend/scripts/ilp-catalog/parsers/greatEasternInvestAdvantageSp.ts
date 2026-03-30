import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateFeeRule,
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
  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'initial-single-premium-charge',
      label: paymentMode === 'cpfis' ? 'Initial Single Premium Charge (CPFIS)' : 'Initial Single Premium Charge (Cash / SRS)',
      basis: 'initial-single-premium',
      rate: premiumChargeRate,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        paymentMode === 'cpfis'
          ? 'No initial premium charge applies when the accepted payment method is CPFIS.'
          : 'Applies the published 3% upfront deduction to the initial single premium before the policy value is seeded.',
      ],
      sourceRefs: [page2],
    },
  ]

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
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 500,
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
      'Enter the gross initial single premium in the seeded policy if you want the starting policy value to include the upfront single-premium deduction path.',
      'This open-ended single-premium product uses the new no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'The current-state terminal-illness benefit amount is modeled as the same amount as the current death-benefit estimate after manual current amount owing, but terminal-illness claim admission, exclusions, settlement, and policy termination remain informational only.',
      'Fund-switching, surrender-destination handling, minimum-transaction guards, and exact per-fund NAV divergence remain informational only beyond the modeled explicit selected-fund partial-surrender floor that uses the current configured fund split as a proportional selected-fund balance proxy.',
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
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:great-eastern-gia-sp-initial-single-premium-charge',
      'branch:great-eastern-gia-sp-top-up-premium-charge',
      'branch:great-eastern-gia-sp-open-ended-zero-surrender-charge',
      'kernel:partial-withdrawal-minimum-amount-block',
      'kernel:partial-withdrawal-selected-fund-minimum-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'great-eastern-gia-sp-srs-cpfis-surrender-destination',
    ],
    warnings: [
      'GREAT Invest Advantage (SP) is cataloged as a supported V1 product. The parser captures the upfront initial single-premium charge, accepted top-up premium charge, the published S$500 minimum one-off partial withdrawal amount, the published explicit selected-fund partial-surrender floor that blocks withdrawals leaving the chosen fund below S$500 using the current configured fund split as a proportional selected-fund balance proxy, the current-state death and terminal-illness benefit amount as the higher of 110% of single premium plus top-ups less partial surrenders or account value less manual current amount owing, and the explicit no-surrender-charge structure through the open-ended no-MIP basis, while terminal-illness claim admission / exclusions / settlement, surrender-destination handling, and exact per-fund NAV divergence remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'cash-or-srs'),
      buildVariant(context.document, 'cpfis'),
    ],
  }
}
