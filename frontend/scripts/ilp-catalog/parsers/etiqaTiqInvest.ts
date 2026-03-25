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
  const page1 = sourceRef(1, 'Plan overview', snippetNear(document, 1, 'Nature and Objective of Plan', 12))
  const page2 = sourceRef(2, 'Surrender and maturity benefits', snippetNear(document, 2, 'Partial Withdrawal', 16))
  const page5 = sourceRef(5, 'Illustrative zero transaction charges', snippetNear(document, 5, 'There is no fees & charges incurred upon the withdrawal', 8))
  const page6 = sourceRef(6, 'Management charge and top-ups', snippetNear(document, 6, 'Management Charge Fee', 18))
  const page6Recurring = sourceRef(6, 'Recurring top-up', snippetNear(document, 6, 'Recurring Top-up', 12))
  const page7 = sourceRef(7, 'Fund switching', snippetNear(document, 7, 'Fund Switching', 12))
  const page9 = sourceRef(9, 'Grace period and reinstatement', snippetNear(document, 9, 'Grace Period', 16))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'annual-contribution',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'The published purchase illustration shows no fees and charges on the initial single premium subscription.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'management-charge-fee',
      label: 'Management Charge Fee',
      basis: 'account-value',
      rate: 0.0075,
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Deducted monthly from account value from policy commencement while the policy remains in force.',
      ],
      sourceRefs: [page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'The published subscription example states no fees and charges apply to top-ups.',
        'V1 also blocks explicit ad-hoc top-ups below the published S$500 minimum and ad-hoc top-ups that are not in S$100 increments.',
      ],
      sourceRefs: [page5, page6],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Top-up Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'The published top-up section states recurring top-ups follow the same zero-charge policy surface as ad-hoc top-ups.',
        'Use recurring-single-premium events to represent the chosen monthly, quarterly, semi-annual, or annual recurring top-up cadence.',
      ],
      sourceRefs: [page5, page6, page6Recurring],
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
        'The published redemption example states no fees and charges apply on withdrawals.',
        'V1 also blocks explicit one-off partial withdrawals below the published S$200 minimum and, because Tiq Invest only allows one Packaged fund at a time, blocks withdrawals that would leave policy value below the published S$200 remaining-fund floor.',
      ],
      sourceRefs: [page2, page5],
    },
  ]

  return {
    id: 'sgd-open-ended',
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
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumTopUpAmount: 500,
      topUpAmountIncrement: 100,
      minimumPartialWithdrawalAmount: 200,
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'policy-value',
          minimumValue: 200,
        },
      ],
    },
    warnings: [
      'Tiq Invest is cataloged as a supported V1 product. The parser captures the published zero-charge initial subscription, zero-charge ad-hoc and recurring top-up path, the published S$500 ad-hoc top-up minimum with S$100 increments, the published zero-charge one-off withdrawal path with the S$200 minimum amount and S$200 remaining-value floor on this one-Packaged-fund policy, the 0.75% annual management charge through the open-ended no-MIP basis, the current-state death benefit as the higher of account value or the 105%-of-premiums floor after partial withdrawals and current amounts owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, and the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input.',
      'There is no insurance charge imposed on this policy.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'The current admitted-state TI payable amount and residual death-benefit estimate after a TI claim today are supported through the published partial-TI continuation corridor after manual claim-amount and residual-death input, but claim exclusions and insurer-side settlement mechanics remain informational only.',
      'Top-up approval, recurring top-up minimums by payment frequency, and Packaged-fund allocation administration remain informational only.',
      'Grace-period funding remains informational only.',
      'Fund-switching administration remains informational only.',
    ],
    sourceRefs: [page1, page2, page5, page6, page7, page9],
  }
}

export function parseEtiqaTiqInvest(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'etiqa-tiq-invest',
    insurer: 'Etiqa',
    productName: 'Tiq Invest',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:etiqa-tiq-invest-zero-single-premium-charge',
      'branch:etiqa-tiq-invest-management-charge',
      'branch:etiqa-tiq-invest-zero-top-up-charge',
      'branch:etiqa-tiq-invest-zero-recurring-single-premium-charge',
      'branch:etiqa-tiq-invest-zero-partial-withdrawal-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'tokio-recurring-single-premium-routing',
    ],
    metadataOnlyBehaviors: [
      'etiqa-tiq-invest-fund-switching',
      'etiqa-tiq-invest-grace-period-funding',
    ],
    warnings: [
      'Tiq Invest is cataloged as a supported V1 product. The parser captures the published zero-charge initial subscription, zero-charge ad-hoc and recurring top-up path, the published S$500 ad-hoc top-up minimum with S$100 increments, the published zero-charge one-off withdrawal path with the S$200 minimum amount and S$200 remaining-value floor on this one-Packaged-fund policy, the 0.75% annual management charge through the open-ended no-MIP basis, the current-state death benefit as the higher of account value or the 105%-of-premiums floor after partial withdrawals and current amounts owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, and the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, while claim exclusions / insurer-side settlement mechanics, top-up approval, recurring top-up minimums by payment frequency, fund-switching administration, Packaged-fund allocation administration, and grace-period funding remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
