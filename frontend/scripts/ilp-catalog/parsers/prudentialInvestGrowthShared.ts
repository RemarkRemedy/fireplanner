import type {
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

type ProductMode = 'single-premium' | 'recurrent-single-premium'
type PaymentMode = 'cash-or-srs' | 'cpf'

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

function premiumChargeLabel(productMode: ProductMode, paymentMode: PaymentMode): string {
  const base = productMode === 'single-premium' ? 'Single Premium Charge' : 'Recurring Premium Charge'
  return paymentMode === 'cpf' ? `${base} (CPF)` : `${base} (Cash / SRS)`
}

function assuranceChargeLabel(productMode: ProductMode, paymentMode: PaymentMode): string {
  const base = productMode === 'single-premium'
    ? 'Premium-based Assurance Charge'
    : 'Recurring Premium-based Assurance Charge'
  return paymentMode === 'cpf' ? `${base} (CPF)` : `${base} (Cash / SRS)`
}

export function buildPrudentialInvestGrowthVariant(
  document: ExtractedPdfDocument,
  productMode: ProductMode,
  paymentMode: PaymentMode,
): IlpTemplateVariant {
  const premiumChargeRate = paymentMode === 'cpf' ? 0 : 0.03
  const assuranceChargeRate = paymentMode === 'cpf' ? 0 : 0.015
  const page1 = sourceRef(1, 'Plan overview', snippetNear(document, 1, 'Nature of Plan', 12))
  const page2 = sourceRef(2, 'Top-ups and withdrawals', snippetNear(document, 2, 'Top-up your premium', 12))
  const page3 = sourceRef(3, 'Additional option', snippetNear(document, 3, 'Direct Income Option', 14))
  const chargesPage = productMode === 'single-premium' ? 5 : 5
  const page5 = sourceRef(chargesPage, 'Charges', snippetNear(document, chargesPage, 'Charges:', 24))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'premium-charge',
      label: premiumChargeLabel(productMode, paymentMode),
      basis: 'annual-contribution',
      rate: premiumChargeRate,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        productMode === 'single-premium'
          ? 'Models the published upfront charge on the initial single premium.'
          : 'Models the published upfront charge on each recurrent single premium payment.',
        paymentMode === 'cpf'
          ? 'CPF-funded variants use the published 0% premium-charge path.'
          : 'Cash and SRS variants use the published 3% premium-charge path.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'assurance-charge-on-premium',
      label: assuranceChargeLabel(productMode, paymentMode),
      basis: 'annual-contribution',
      rate: assuranceChargeRate,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        paymentMode === 'cpf'
          ? 'CPF-funded variants do not pay the published 1.5% assurance charge on premium events.'
          : 'Cash and SRS variants pay the published 1.5% assurance charge on premium events.',
        'This is modeled as a premium-event charge rather than a sum-at-risk mortality curve.',
      ],
      sourceRefs: [page5],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: paymentMode === 'cpf' ? 'Top-up Premium Charge (CPF)' : 'Top-up Premium Charge (Cash / SRS)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: premiumChargeRate,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        paymentMode === 'cpf'
          ? 'CPF-funded variants use the published 0% top-up premium-charge path.'
          : 'Models the published 3% standard top-up premium charge.',
        'The reduced e-top-up rate is not modeled automatically and remains metadata-only.',
      ],
      sourceRefs: [page2, page5],
    },
    {
      id: 'top-up-assurance-charge',
      label: paymentMode === 'cpf' ? 'Top-up Assurance Charge (CPF)' : 'Top-up Assurance Charge (Cash / SRS)',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: assuranceChargeRate,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        paymentMode === 'cpf'
          ? 'CPF-funded variants do not pay the published 1.5% assurance charge on top-ups.'
          : 'Models the published 1.5% assurance charge on standard top-up premiums.',
        'The reduced e-top-up rate is not modeled automatically and remains metadata-only.',
      ],
      sourceRefs: [page2, page5],
    },
  ]

  return {
    id: paymentMode === 'cpf' ? 'sgd-open-ended-cpf' : 'sgd-open-ended-cash-or-srs',
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
        contributionRules: productMode === 'single-premium'
          ? [
              { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
              { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
            ]
          : [
              { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
              { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
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
      paymentMode === 'cpf'
        ? 'This CPF-funded variant uses the published 0% premium-charge and 0% premium-event assurance-charge path.'
        : 'This Cash / SRS variant uses the published 3% premium-charge and 1.5% premium-event assurance-charge path.',
      'This open-ended product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
      ...(productMode === 'single-premium'
        ? ['The Direct Income option is available only for cash-funded policies and remains metadata-only.']
        : []),
    ],
    unsupportedItems: [
      'Death and terminal-illness benefit formulas remain informational only.',
      productMode === 'single-premium'
        ? 'Single-premium principal tracking remains informational only in V1.'
        : 'Recurrent-single-premium paid-premium tracking remains informational only in V1.',
      'e-top-up reduced premium-charge and assurance-charge treatment remains informational only.',
      'Withdrawal administration and fund-switching mechanics remain informational only.',
      ...(productMode === 'single-premium'
        ? ['Direct Income option mechanics remain informational only.']
        : []),
    ],
    sourceRefs: [page1, page2, page5, ...(productMode === 'single-premium' ? [page3] : [])],
  }
}
