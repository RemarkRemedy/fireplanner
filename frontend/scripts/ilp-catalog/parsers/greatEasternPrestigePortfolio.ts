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

type VariantId = 'sgd-open-ended-regular-pay-cash' | 'sgd-open-ended-recurrent-single-premium-srs'

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 16): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument, variantId: VariantId): IlpTemplateVariant {
  const isRegularPay = variantId === 'sgd-open-ended-regular-pay-cash'
  const premiumModeLabel = isRegularPay ? 'regular premium' : 'recurrent single premium'
  const premiumDocumentLabel = isRegularPay ? 'policy illustration' : 'product quotation'
  const variantWarningLabel = isRegularPay ? 'Prestige Portfolio (Regular Premium / Cash)' : 'Prestige Portfolio (Recurrent Single Premium / SRS)'

  const page2 = sourceRef(2, 'Benefits and premium types', snippetNear(document, 2, 'Premium type', 20))
  const page3 = sourceRef(3, 'Premium charge, wrap fee, and policy fee', snippetNear(document, 3, 'Premium charge', 28))
  const page4 = sourceRef(4, 'Top-ups, withdrawals, and surrender', snippetNear(document, 4, 'Partial Withdrawal of funds', 30))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'premium-charge',
      label: 'Premium Charge',
      basis: 'annual-contribution',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        `Enter the actual ${premiumModeLabel} premium-charge percentage from the issued ${premiumDocumentLabel} before trusting the projection.`,
        'The product summary publishes only the configurable cap: up to 3% at policy start, and requestable up to 5% after issue.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'wrap-fee',
      label: 'Wrap Fee',
      basis: 'account-value',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Enter the actual quoted wrap-fee percentage before trusting the projection.',
        'The product summary publishes only the configurable cap: up to 1.5% p.a. at policy start, and requestable up to 2% p.a. after issue.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'account-value',
      rate: 0.002,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 0.2% p.a. policy fee deducted monthly from total investment value.',
      ],
      sourceRefs: [page3],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Investment Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        `Enter the actual top-up premium-charge percentage from the issued ${premiumDocumentLabel} before trusting any top-up scenario.`,
        'The summary states that the premium charge also applies to each accepted investment top-up.',
      ],
      sourceRefs: [page3, page4],
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
        'Models the published no-stated-charge partial-withdrawal path at the policy level.',
        'Minimum withdrawal and remaining-fund value thresholds remain informational only.',
      ],
      sourceRefs: [page4],
    },
  ]

  return {
    id: variantId,
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0.002,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page2, page3, page4],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [],
    warnings: [
      `${variantWarningLabel} is cataloged as a partial modeled subset in V1. The parser captures the quote-driven premium-charge surface through manual input, the quote-driven wrap-fee surface through manual input, the published 0.2% p.a. policy fee, the quote-driven top-up premium-charge surface through manual input, and the nil policy-level partial-withdrawal charge path through the open-ended basis.`,
      `Enter the actual premium-charge and wrap-fee percentages from the issued ${premiumDocumentLabel} before trusting the analysis.`,
    ],
    unsupportedItems: [
      'Single-premium corridor remains informational only in this parser slice.',
      'Death-benefit and accidental-death-benefit payout handling remain informational only, including basic-sum-assured state tracking for recurrent single premium.',
      ...(isRegularPay
        ? ['Regular-premium early-surrender deductions remain informational only because they are shown only in the policy illustration rather than as a published fixed catalog schedule.']
        : []),
      'SRS return-destination handling on withdrawals and surrender remains informational only.',
      'Fund switching, premium-apportionment changes, and minimum-transaction guards remain informational only.',
      'Post-issue fee changes, newly introduced fees, and fund-level charges remain informational only.',
    ],
    sourceRefs: [page2, page3, page4],
  }
}

export function parseGreatEasternPrestigePortfolio(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'great-eastern-prestige-portfolio',
    insurer: 'Great Eastern',
    productName: 'Prestige Portfolio',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:great-eastern-prestige-portfolio-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-wrap-fee-manual-input',
      'branch:great-eastern-prestige-portfolio-policy-fee',
      'branch:great-eastern-prestige-portfolio-top-up-premium-charge-manual-input',
      'branch:great-eastern-prestige-portfolio-partial-withdrawal-zero-charge',
    ],
    metadataOnlyBehaviors: [
      'great-eastern-prestige-portfolio-single-premium-corridor',
      'great-eastern-prestige-portfolio-regular-premium-surrender-deductions',
      'great-eastern-prestige-portfolio-death-and-accidental-death-benefits',
      'great-eastern-prestige-portfolio-basic-sum-assured-state',
      'great-eastern-prestige-portfolio-srs-return-destination',
      'great-eastern-prestige-portfolio-fund-switching',
      'great-eastern-prestige-portfolio-minimum-transaction-guards',
      'great-eastern-prestige-portfolio-post-issue-fee-changes',
      'great-eastern-prestige-portfolio-fund-level-fees',
    ],
    warnings: [
      'Prestige Portfolio is cataloged as a partial modeled subset in V1. The parser currently covers only the recurring-pay corridors that fit the existing seed model: regular premium (cash) and recurrent single premium (SRS).',
      'Quoted premium-charge and wrap-fee percentages remain manual inputs, while single-premium handling, protection-side benefits, and regular-premium surrender deductions remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'sgd-open-ended-regular-pay-cash'),
      buildVariant(context.document, 'sgd-open-ended-recurrent-single-premium-srs'),
    ],
  }
}
