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

const PLAN_CHARGE_SCHEDULE = [
  0.014,
  0.014,
  0.014,
  0.014,
  0.014,
] as const

const SURRENDER_CHARGE_TABLE = [
  0.07,
  0.056,
  0.042,
  0.028,
  0.014,
  0,
] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 14): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildRateSchedule(values: readonly number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate,
  }))
}

function buildVariant(
  document: ExtractedPdfDocument,
  variantId: 'sgd-open-ended' | 'usd-open-ended',
): IlpTemplateVariant {
  const currency = variantId === 'sgd-open-ended' ? 'SGD' : 'USD'
  const minimumPartialWithdrawalAmount = variantId === 'sgd-open-ended' ? 500 : 375
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest Goal 1', 18))
  const page2 = sourceRef(2, 'Initial account charge and plan charge', snippetNear(document, 2, 'Initial account charge', 24))
  const page3 = sourceRef(3, 'Surrender charge and switching fee', snippetNear(document, 3, 'Surrender charge', 24))
  const page4 = sourceRef(4, 'Withdrawal options and minimum account value', snippetNear(document, 4, 'Withdrawal options', 24))
  const page6 = sourceRef(6, 'Subscription and redemption illustration', snippetNear(document, 6, 'Illustration of units allocation', 24))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'initial-single-premium',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'The published units-allocation illustration shows a 0% premium charge on the initial single premium.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'initial-account-charge',
      label: 'Initial Account Charge',
      basis: 'account-value',
      rate: 0.01,
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 1.00% p.a. initial account charge deducted monthly from the initial units account.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'plan-charge',
      label: 'Plan Charge',
      basis: 'initial-single-premium-base',
      rate: 0,
      rateSchedule: buildRateSchedule(PLAN_CHARGE_SCHEDULE),
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 1.4% p.a. plan charge on the committed gross initial single premium during the first five policy years.',
      ],
      sourceRefs: [page2],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
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
        'No policy-level partial withdrawal charge is stated; withdrawals redeem units without an extra policy-level fee.',
        'V1 blocks explicit one-off partial withdrawals that would leave the initial-units-account value below 10% of the committed initial single premium.',
        'Minimum withdrawal amount, fund-selection routing, and pending-transaction execution timing remain informational only.',
      ],
      sourceRefs: [page4, page6],
    },
  ]

  return {
    id: variantId,
    currency,
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page2, page4, page6],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount,
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'initial-single-premium',
          accountId: 'policy',
          minimumValueRate: 0.1,
        },
      ],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    exitChargeBasis: 'initial-single-premium-base',
    warnings: [
      `FWD Invest Goal 1 (${currency}) is cataloged as a supported V1 product. The parser captures the published 0% single-premium charge, the 1.00% annual initial-account charge on account value, the 1.4% plan charge on the committed initial single premium during the first five policy years, the first-five-policy-years surrender charge on that same original base, the current-state death benefit as 105% of policy value, the zero policy-level partial-withdrawal charge, the published ${currency === 'SGD' ? 'SGD 500' : 'USD 375'} per-transaction minimum on explicit one-off partial withdrawals, and the 10%-of-committed-initial-single-premium minimum remaining-value floor on that same open-ended single-premium basis.`,
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
      'Fund-selection routing and pending-transaction execution timing remain informational only in V1.',
    ],
    unsupportedItems: [
      'Multi-life last-survivor death-trigger handling remains informational only.',
      'Single-premium principal tracking remains informational only in V1.',
      'Policy closure charge, currency-change processing, change-of-person-insured handling, and reviewable switching-fee administration remain informational only.',
      'Fund management fees remain informational only because they depend on the selected ILP sub-fund.',
    ],
    sourceRefs: [page1, page2, page3, page4, page6],
  }
}

export function parseFwdInvestGoal1(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-goal-1',
    insurer: 'FWD',
    productName: 'FWD Invest Goal 1',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:fwd-invest-goal-1-zero-single-premium-charge',
      'branch:fwd-invest-goal-1-initial-account-charge',
      'branch:fwd-invest-goal-1-plan-charge',
      'branch:fwd-invest-goal-1-surrender-charge',
      'branch:fwd-invest-goal-1-zero-partial-withdrawal-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:partial-withdrawal-minimum-amount-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
    ],
    coveredElsewhereBehaviors: [
      'fwd-invest-goal-1-policy-closure-charge',
      'fwd-invest-goal-1-fund-management-fees',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-goal-1-multi-life-last-survivor',
      'fwd-invest-goal-1-single-premium-principal-tracking',
      'fwd-invest-goal-1-currency-change-processing',
      'fwd-invest-goal-1-change-of-person-insured',
      'fwd-invest-goal-1-switching-fee-administration',
    ],
    warnings: [
      'FWD Invest Goal 1 is cataloged as a supported V1 product. The parser captures the published 0% single-premium charge, the 1.00% annual initial-account charge on account value, the 1.4% plan charge on the committed initial single premium during the first five policy years, the first-five-policy-years surrender charge on that same original base, the current-state death benefit as 105% of policy value, the zero policy-level partial-withdrawal charge, the published SGD 500 / USD 375 per-transaction minimum on explicit one-off partial withdrawals, and the 10%-of-committed-initial-single-premium minimum remaining-value floor on that same open-ended single-premium basis, while multi-life last-survivor handling, principal-tracking, and broader operational mechanics remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'sgd-open-ended'),
      buildVariant(context.document, 'usd-open-ended'),
    ],
  }
}
