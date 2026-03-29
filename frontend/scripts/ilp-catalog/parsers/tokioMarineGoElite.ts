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

const ESTABLISHMENT_CHARGE_SCHEDULE = [
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

function buildVariant(document: ExtractedPdfDocument, variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs'): IlpTemplateVariant {
  const isCash = variantId === 'sgd-open-ended-cash'
  const page1 = sourceRef(1, 'Plan description and benefits', snippetNear(document, 1, '#goElite', 20))
  const page3 = sourceRef(3, 'Recurring single premium, top-up premium, and partial withdrawal', snippetNear(document, 3, 'Recurring Single Premium', 28))
  const page5 = sourceRef(5, 'Dividend distribution', snippetNear(document, 5, 'Dividend Distribution', 28))
  const page6 = sourceRef(6, 'Fees and charges', snippetNear(document, 6, 'Administrative Charge', 28))

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
        'Models the published 100% allocation of the initial single premium into the Single Premium Units Account with no policy-level premium deduction.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'establishment-charge',
      label: 'Establishment Charge',
      basis: 'initial-single-premium-base',
      rate: 0,
      rateSchedule: buildRateSchedule(ESTABLISHMENT_CHARGE_SCHEDULE),
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 1.4% p.a. establishment charge on the original gross initial single premium during the first five policy years.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'administrative-charge',
      label: 'Administrative Charge',
      basis: 'account-value',
      rate: 0.01,
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 1.00% p.a. administrative charge on the Single Premium Units Account value.',
      ],
      sourceRefs: [page6],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['topup'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each recurring single premium allocation to the Top-up Units Account.',
      ],
      sourceRefs: [page3, page6],
    },
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each top-up premium allocation to the Top-up Units Account.',
      ],
      sourceRefs: [page3, page6],
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
        label: 'Single Premium Units Account',
        feeRate: 0.01,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page6],
      },
      {
        id: 'topup',
        label: 'Top-up Units Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page6],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 100,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 1_000,
      minimumPartialWithdrawalAmount: 500,
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'initial-single-premium',
          accountId: 'policy',
          minimumValueRate: 0.1,
        },
      ],
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy', 'topup'],
      defaultMode: 'reinvest',
      ...(isCash ? { minimumAnnualPayoutAmount: 50, recordDateInstructionLeadDays: 30 } : {}),
      cashPayoutAllowedDuringMip: isCash,
      cashPayoutAllowedAfterMip: isCash,
      source: 'distribution-paying-funds',
      notes: isCash
        ? [
            'Cash policies may reinvest dividends or receive cash payouts from dividend-paying ILP sub-funds.',
            'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
          ]
        : [
            'SRS policies default dividend distributions to reinvestment, and the source summary does not offer a cash-payout election for this corridor.',
          ],
      sourceRefs: [page5],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    exitChargeBasis: 'initial-single-premium-base',
    warnings: [
      isCash
        ? '#goElite (Cash) is cataloged as a supported V1 product. The parser captures the published zero single-premium charge, the 1.4% p.a. establishment charge on the original initial single premium for the first five policy years, the first-five-policy-years surrender charge on that same original base, the 1.00% administrative charge on the Single Premium Units Account, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, the published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor, and the cash-payout or reinvestment distribution assumption surface through the open-ended single-premium basis.'
        : '#goElite (SRS) is cataloged as a supported V1 product. The parser captures the published zero single-premium charge, the 1.4% p.a. establishment charge on the original initial single premium for the first five policy years, the first-five-policy-years surrender charge on that same original base, the 1.00% administrative charge on the Single Premium Units Account, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, the published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor, and the reinvest-only distribution-mode surface through the open-ended single-premium basis.',
    ],
    unsupportedItems: [
      'The resident-corridor current death benefit needs a manual current amount owing input because indebtedness is not reconstructed from history in V1.',
      'The resident-corridor current accidental-death estimate also needs manual current age and current amount owing inputs; the age-75 cut-off is modeled, while residency and Singapore-location claim gates, the 180-day death timing rule, aggregate accidental-death cap handling, and multi-life last-survivor settlement remain informational only.',
      'The non-resident 101% death-benefit corridor remains informational only.',
      'Fund management fee and third-party banking / currency-conversion charges remain informational only.',
    ],
    sourceRefs: [page1, page3, page5, page6],
  }
}

export function parseTokioMarineGoElite(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goelite',
    insurer: 'Tokio Marine',
    productName: '#goElite',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:tokio-marine-goelite-zero-single-premium-charge',
      'branch:tokio-marine-goelite-establishment-charge',
      'branch:tokio-marine-goelite-administrative-charge',
      'branch:tokio-marine-goelite-recurring-single-and-top-up-charge',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'branch:tokio-marine-goelite-zero-partial-withdrawal-charge',
      'branch:tokio-marine-goelite-surrender-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: ['tokio-marine-goelite-fund-level-and-third-party-charges'],
    metadataOnlyBehaviors: [
      'tokio-marine-goelite-non-resident-101-death-benefit',
      'tokio-marine-goelite-accidental-death-claim-gates-and-cap-aggregation',
      'tokio-marine-goelite-multi-life-last-survivor',
    ],
    warnings: [
      '#goElite is cataloged as a supported V1 product. The parser captures the published zero single-premium charge, the 1.4% p.a. establishment charge on the original initial single premium for the first five policy years, the first-five-policy-years surrender charge on that same original base, the 1.00% administrative charge on the Single Premium Units Account, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, the published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor, the resident-corridor current-state death benefit as 105% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing, the resident-corridor current accidental-death estimate before age 75 as 110% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing after a manual published Tokio accidental-death claim-corridor status is confirmed and the published SGD1,000,000 remaining aggregate accidental-death cap is entered, the matching manual current admitted accidental-death claim benefit amount plus admitted-and-settled termination state on that same resident corridor, and the cash-vs-SRS distribution-mode support surface with the published $50 minimum cash-payout threshold plus the 30-day record-date instruction lead time on the cash corridor; the non-resident 101% death-benefit corridor, broader accidental-death claim gates and cap aggregation, multi-life last-survivor handling, and fund-level charges remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'sgd-open-ended-cash'),
      buildVariant(context.document, 'sgd-open-ended-srs'),
    ],
  }
}
