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

const POLICY_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 5, rate: 0.023 },
  { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.07,
  0.05,
  0.04,
  0.026,
  0.012,
  0,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  0.07,
  0.05,
  0.04,
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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 12): string {
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

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'single Premium Investment-linked insurance plan', 20))
  const page2 = sourceRef(2, 'Power-up bonus and maturity benefit', snippetNear(document, 2, 'Power-up Bonus', 18))
  const page3 = sourceRef(3, 'Surrender and partial withdrawal policy options', snippetNear(document, 3, 'Partial Withdrawal', 18))
  const page4Dividend = sourceRef(4, 'Distribution of Dividend', snippetNear(document, 4, 'Distribution of Dividend', 18))
  const page7 = sourceRef(7, 'Initial single-premium subscription illustration', snippetNear(document, 7, 'There is no fees and charges incurred for the purchase', 14))
  const page9 = sourceRef(9, 'Top-up premium charge', snippetNear(document, 9, 'Premium Charge on Top-up', 16))
  const page10 = sourceRef(10, 'Policy charge and representative management charge', snippetNear(document, 10, 'Policy Charge', 24))

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
        'The published initial subscription illustration shows no fees and charges on the initial single premium purchase.',
      ],
      sourceRefs: [page7],
    },
    {
      id: 'policy-charge',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.023,
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      rateSchedule: POLICY_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      notes: [
        'Models the published policy-charge schedule for the initial account value only.',
        'Top-up vintages have their own effective-date-based charge clocks and remain informational only in V1.',
      ],
      sourceRefs: [page1, page10],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: 0.04,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 4.00% premium charge on each accepted single-premium top-up.',
        'Top-up-specific policy-charge and surrender-charge clocks remain informational only in V1.',
      ],
      sourceRefs: [page9],
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
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      allocation: 'equal-split',
      notes: [
        'Models the published initial-account partial-withdrawal charge table.',
        'V1 blocks explicit one-off partial withdrawals that would leave the remaining account value below the published S$1,000 minimum.',
        'Top-up withdrawals are processed from the latest top-up first and remain informational only in V1.',
      ],
      sourceRefs: [page3, page10],
    },
  ]

  return {
    id: 'sgd-open-ended-single-premium-initial-only',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Initial Account Value',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page7],
      },
      {
        id: 'topup',
        label: 'Additional Account Value',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page1, page9, page10],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 500,
      partialWithdrawalAmountIncrement: 100,
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'account-value',
          accountId: 'policy',
          minimumValue: 1_000,
        },
      ],
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment unless the policyholder elects payout.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
        'Minimum S$40 payout thresholds, change-request cutoffs, and withdrawal consequences on reinvested dividends remain informational only.',
      ],
      sourceRefs: [page4Dividend],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'Invest plus SP is cataloged as a supported V1 product for the initial single-premium corridor only. The parser captures zero initial subscription charge, the initial-account policy-charge schedule, the 4.00% top-up premium charge, the initial-account surrender / partial-withdrawal charge tables, the published S$500 minimum withdrawal amount in multiples of S$100 plus the published S$1,000 post-withdrawal minimum remaining-account-value floor on explicit one-off partial withdrawals, the current ordinary death-benefit estimate as the higher of account value or 101% of net premium, and reinvest-default distribution support.',
      'Current-due Power-up Bonus is modeled through manual current initial-account and top-up-account bonus-credit amounts. Future recurring Initial Account Power-up Bonus is modeled through the published three-year cadence after a manual observed-average input seeds the current incomplete block, and future recurring Top-up Account Power-up Bonus is modeled for new projection-start top-ups after a manual representative-management-charge rate is supplied.',
      'Historical top-up-vintage rolling-average qualification, pre-projection top-up vintages, and top-up-specific charge clocks outside the modeled future new-top-up bonus lane remain informational only in V1.',
      'Grace-period top-up funding, reinstatement, and free-look handling remain informational only.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Historical top-up-vintage Power-up Bonus qualification and rolling average accounting for vintages that started before the current projection remain informational only.',
      'Top-up-specific surrender charge clocks remain informational only, and top-up-specific policy-charge / partial-withdrawal charge clocks are only modeled for new projection-start top-up bonus qualification.',
      'Representative management charge remains informational only outside the modeled future new-top-up Power-up Bonus lane because the application-agreed rate can vary up to 0.75% per annum.',
      'Fund-level management fees, dividend payout thresholds, change-request cutoffs, and withdrawal consequences on reinvested dividends remain informational only.',
      'Grace-period top-up funding remains informational only.',
      'Reinstatement remains informational only.',
      'Free-look handling remains informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4Dividend, page7, page9, page10],
  }
}

export function parseEtiqaInvestPlusSp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'etiqa-invest-plus-sp',
    insurer: 'Etiqa',
    productName: 'Invest plus SP',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:etiqa-invest-plus-sp-zero-single-premium-charge',
      'branch:etiqa-invest-plus-sp-policy-charge',
      'branch:etiqa-invest-plus-sp-top-up-premium-charge',
      'branch:etiqa-invest-plus-sp-initial-partial-withdrawal-charge',
      'branch:etiqa-invest-plus-sp-initial-surrender-charge',
      'branch:etiqa-invest-plus-sp-current-power-up-bonus-credit',
      'branch:etiqa-invest-plus-sp-initial-power-up-bonus',
      'branch:etiqa-invest-plus-sp-projected-top-up-power-up-bonus-for-new-top-ups',
      'kernel:current-death-benefit-estimate',
      'kernel:partial-withdrawal-amount-increment-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'etiqa-invest-plus-sp-historical-top-up-power-up-bonus-vintage-accounting',
      'etiqa-invest-plus-sp-top-up-vintage-accounting',
      'etiqa-invest-plus-sp-representative-management-charge',
      'etiqa-invest-plus-sp-fund-management-fee',
      'etiqa-invest-plus-sp-dividend-threshold-and-withdrawal-consequences',
      'etiqa-invest-plus-sp-grace-period-top-up-funding',
      'etiqa-invest-plus-sp-reinstatement',
      'etiqa-invest-plus-sp-free-look',
    ],
    warnings: [
      'Invest plus SP is cataloged as a supported V1 product for the initial single-premium corridor only. The parser captures zero initial subscription charge, the initial-account policy-charge schedule, the 4.00% top-up premium charge, the initial-account surrender / partial-withdrawal charge tables, the current ordinary death-benefit estimate as the higher of account value or 101% of net premium, reinvest-default distribution support, current-due Power-up Bonus crediting through manual initial-account and top-up-account amounts plus status, future recurring Initial Account Power-up Bonus through the published three-year cadence after a manual observed-average input seeds the current incomplete block, and future recurring Top-up Account Power-up Bonus for new projection-start top-ups after a manual representative-management-charge rate is supplied, including top-up-specific policy-charge and partial-withdrawal-charge clocks inside that projected new-top-up lane. Historical top-up-vintage rolling-average qualification, pre-projection top-up vintages, representative-management-charge effects outside that new-top-up lane, top-up-vintage post-charge accounting, and grace-period / reinstatement / free-look administration remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
