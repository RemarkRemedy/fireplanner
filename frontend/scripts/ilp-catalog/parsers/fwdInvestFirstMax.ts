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

const SURRENDER_CHARGE_SCHEDULE_MIP_10 = [1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest First Max', 24))
  const page5 = sourceRef(5, 'Loyalty and accumulation bonus', snippetNear(document, 5, 'Accumulation Bonus', 24))
  const page8 = sourceRef(8, 'Recurring single premium and top-up premium', snippetNear(document, 8, 'Recurring single premium', 28))
  const page11 = sourceRef(11, 'Initial account charge', snippetNear(document, 11, 'Initial account charge', 28))
  const page12 = sourceRef(12, 'Accumulation account charge and premium charge', snippetNear(document, 12, 'Accumulation account charge', 28))
  const page13 = sourceRef(13, 'Policy changes and zero redemption fee', snippetNear(document, 13, 'Redemption fee', 26))
  const page14 = sourceRef(14, 'Withdrawal options', snippetNear(document, 14, 'Withdrawal options', 28))
  const page23 = sourceRef(23, 'Appendix A surrender charge rate', snippetNear(document, 23, 'Appendix A – Surrender charge rate', 24))
  const page24 = sourceRef(24, 'Appendix B increase regular premium layer illustration', snippetNear(document, 24, 'Illustration on increase regular premium layer', 24))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'initial-account-charge',
      label: 'Initial Account Charge',
      basis: 'account-value',
      yearBasis: 'policy-year',
      rate: 0,
      amount: 0,
      appliesTo: ['initial'],
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 10, rate: 0.06 },
      ],
      activeWindow: 'during-mip',
      notes: [
        'Models the published 6.00% p.a. initial-account charge for the 10-year premium-payment-term base-layer corridor.',
        'The charge remains deductible even when regular premiums are not paid during the premium payment term.',
        'Increase regular premium layers are informational only in this slice.',
      ],
      sourceRefs: [page11, page24],
    },
    {
      id: 'accumulation-account-charge',
      label: 'Accumulation Account Charge',
      basis: 'account-value',
      yearBasis: 'policy-year',
      rate: 0,
      amount: 0,
      appliesTo: ['accumulation'],
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 10, rate: 0.016 },
        { startPolicyYear: 11, endPolicyYear: 20, rate: 0.014 },
        { startPolicyYear: 21, endPolicyYear: null, rate: 0.012 },
      ],
      activeWindow: 'policy-term',
      notes: [
        'Models the published accumulation-account charge schedule on accumulation-units-account value.',
        'Recurring single premiums and top-up premiums route to the base-layer accumulation units account in this corridor.',
        'Per-layer charge timing for increase regular premium layers remains informational only.',
      ],
      sourceRefs: [page12, page24],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted top-up premium.',
        'Top-up minimum amount and investment-strategy routing remain informational only in V1.',
      ],
      sourceRefs: [page8, page12],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted recurring single premium.',
        'Reduction priority between recurring single premium and regular premium remains informational only in V1.',
      ],
      sourceRefs: [page8, page12],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'No redemption fee is stated for withdrawals.',
        'During the premium payment term, the executable path assumes withdrawals only from the accumulation units account after the first 24 months.',
        'Initial-units-account withdrawal lockout, minimum withdrawal amount, and minimum account-value rules remain informational only.',
      ],
      sourceRefs: [page13, page14],
    },
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: 10,
    icpMonths: 1,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page11, page14, page23],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page5, page8, page12, page14],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_SCHEDULE_MIP_10],
    warnings: [
      'FWD Invest First Max is cataloged as a partial modeled subset in V1. The parser captures the SGD 10-year base-layer corridor only: the published initial-account charge, accumulation-account charge, 5% top-up / recurring-single premium charges, zero redemption fee, and the 10-year surrender-charge schedule.',
      'Booster Bonus, Loyalty Bonus, Accumulation Bonus, maturity benefit, increase regular premium layers, and reduction / missed-premium behavior remain informational only.',
      'The product supports longer premium-payment terms and multi-layer premium increases, but those corridors remain outside this executable slice.',
    ],
    unsupportedItems: [
      'Booster Bonus, Loyalty Bonus, and Accumulation Bonus remain informational only because their conditions and increase-layer interactions are not executed in this slice.',
      'Maturity Benefit, death benefit, and change-of-person-insured handling remain informational only.',
      'Recurring single premium reduction priority, increase regular premium layers, and regular-premium reduction sequencing remain informational only.',
      'Missed-premium, grace-period, and bonus-suspension interactions remain informational only.',
      'Minimum withdrawal amount, minimum account-value gates, policy closure charge, change-of-policy-currency handling, and fund management charges remain informational only.',
    ],
    sourceRefs: [page1, page5, page8, page11, page12, page13, page14, page23, page24],
  }
}

export function parseFwdInvestFirstMax(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-first-max',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest First Max',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:fwd-invest-first-max-initial-account-charge',
      'branch:fwd-invest-first-max-accumulation-account-charge',
      'branch:fwd-invest-first-max-top-up-premium-charge',
      'branch:fwd-invest-first-max-recurring-single-premium-charge',
      'branch:fwd-invest-first-max-zero-redemption-fee',
      'branch:fwd-invest-first-max-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-first-max-booster-bonus',
      'fwd-invest-first-max-loyalty-bonus',
      'fwd-invest-first-max-accumulation-bonus',
      'fwd-invest-first-max-maturity-benefit',
      'fwd-invest-first-max-death-benefit',
      'fwd-invest-first-max-multi-life-last-survivor',
      'fwd-invest-first-max-increase-regular-premium-layer',
      'fwd-invest-first-max-regular-premium-reduction',
      'fwd-invest-first-max-missed-premium-grace-period',
      'fwd-invest-first-max-minimum-withdrawal-rules',
      'fwd-invest-first-max-policy-closure-charge',
      'fwd-invest-first-max-change-of-person-insured',
      'fwd-invest-first-max-change-of-policy-currency',
      'fwd-invest-first-max-fund-management-charge',
    ],
    warnings: [
      'FWD Invest First Max is cataloged as a supported V1 corridor. The current parser covers the SGD 10-year base-layer corridor: initial-account charge, accumulation-account charge, top-up and recurring-single premium charges, zero redemption fee, and the 10-year surrender-charge schedule.',
      'Bonus units, maturity benefit, multi-life last-survivor handling, increase regular premium layers, and broader premium-flexibility behavior remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
