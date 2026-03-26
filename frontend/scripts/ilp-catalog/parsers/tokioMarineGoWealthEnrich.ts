import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  0.07,
  0.04,
  0.02,
  0,
] as const

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

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const loyaltyPage = sourceRef(2, 'Loyalty Bonus', snippetNear(document, 2, 'Loyalty Bonus', 20))

  return [
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: null,
      rate: 0.0022,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published 0.22% annual loyalty bonus on the Single Premium Units Account value from the first policy anniversary onward while the policy remains in force.',
        'The loyalty bonus is allocated in the form of additional units to the Single Premium Units Account using the latest investment allocation instructions.',
      ],
      sourceRefs: [loyaltyPage],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan description and loyalty bonus', snippetNear(document, 1, '#goWealth Enrich', 20))
  const page3 = sourceRef(3, 'Subscription of units and partial withdrawal', snippetNear(document, 3, 'Recurring Single Premium', 24))
  const page5 = sourceRef(5, 'Dividend distribution and fees', snippetNear(document, 5, 'Dividend Distribution', 24))
  const page6 = sourceRef(6, 'Fees and charges', snippetNear(document, 6, 'Administrative Charge', 24))

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
    {
      id: 'single-premium-partial-withdrawal-charge',
      label: 'Single Premium Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published partial withdrawal charge on the Single Premium Units Account during the first three policy years.',
        'Top-up Units Account withdrawals do not use this charge path in V1.',
      ],
      sourceRefs: [page3, page6],
    },
  ]

  return {
    id: 'sgd-open-ended-cash',
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
    bonuses: buildBonuses(document),
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
      minimumAnnualPayoutAmount: 50,
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may be reinvested or paid out in cash for cash policies.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page5],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    exitChargeBasis: 'initial-single-premium-base',
    warnings: [
      '#goWealth Enrich is cataloged as a supported V1 corridor. The parser captures the published 1.4% p.a. establishment charge on the original initial single premium for the first five policy years, the first-five-policy-years surrender charge on that same original base, the 1.00% administrative charge on the Single Premium Units Account, the 5% recurring-single-premium and top-up charge path, the first-three-policy-years single-premium partial-withdrawal charge schedule, the published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor, the published 0.22% annual loyalty bonus on the Single Premium Units Account from the first policy anniversary onward, the resident-corridor current-state death benefit as 105% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing, the resident-corridor current accidental-death estimate before age 75 as 120% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing, and the cash-payout-capable manual distribution-mode assumption surface through the open-ended single-premium basis.',
      'The non-resident 101% death-benefit corridor, accidental-death claim gates and cap aggregation, principal-floor handling, and related fund-level charges remain outside the current engine.',
    ],
    unsupportedItems: [
      'The resident-corridor current accidental-death estimate also needs manual current age and current amount owing inputs; the age-75 cut-off is modeled, while residency and Singapore-location claim gates, the 180-day death timing rule, and aggregate accidental-death cap handling remain informational only.',
      'The non-resident 101% death-benefit corridor remains informational only.',
      'Single-premium protection-state and principal-floor behavior remain informational only.',
      'Fund management fee, switching charge, and third-party banking / currency-conversion charges remain informational only.',
    ],
    sourceRefs: [page1, page3, page5, page6],
  }
}

export function parseTokioMarineGoWealthEnrich(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-gowealth-enrich',
    insurer: 'Tokio Marine',
    productName: '#goWealth Enrich',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:tokio-marine-gowealth-enrich-zero-single-premium-charge',
      'branch:tokio-marine-gowealth-enrich-establishment-charge',
      'branch:tokio-marine-gowealth-enrich-administrative-charge',
      'branch:tokio-marine-gowealth-enrich-recurring-single-and-top-up-charge',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'branch:tokio-marine-gowealth-enrich-single-premium-partial-withdrawal-charge',
      'branch:tokio-marine-gowealth-enrich-surrender-charge',
      'branch:tokio-marine-gowealth-enrich-loyalty-bonus',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: [
      'tokio-marine-gowealth-enrich-fund-management-fee',
      'tokio-marine-gowealth-enrich-third-party-charges',
    ],
    metadataOnlyBehaviors: [
      'tokio-marine-gowealth-enrich-accidental-death-claim-gates-and-cap-aggregation',
      'tokio-marine-gowealth-enrich-principal-floor',
      'tokio-marine-gowealth-enrich-switching-charge',
    ],
    warnings: [
      '#goWealth Enrich is cataloged as a supported V1 product. The parser captures the published zero single-premium charge, the 1.4% p.a. establishment charge on the original initial single premium for the first five policy years, the first-five-policy-years surrender charge on that same original base, the 1.00% administrative charge on the Single Premium Units Account, the 5% recurring-single-premium and top-up charge path, the first-three-policy-years single-premium partial-withdrawal charge schedule, the published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor, the published 0.22% annual loyalty bonus on the Single Premium Units Account from the first policy anniversary onward, the resident-corridor current-state death benefit as 105% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing, the resident-corridor current accidental-death estimate before age 75 as 120% of the Single Premium Units Account value plus 100% of the Top-up Units Account value less current amounts owing, and the cash-payout-capable distribution-mode assumption surface with the published $50 minimum cash-payout threshold plus the 30-day record-date instruction lead time, while the non-resident 101% death-benefit corridor, accidental-death claim gates and cap aggregation, principal-floor handling, and fund-level charges remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
