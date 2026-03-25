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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 16): string {
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

function buildTokioEliteSecureMpcFeeRule(
  page1: IlpCatalogSourceRef,
  page2: IlpCatalogSourceRef,
  page5: IlpCatalogSourceRef,
  page7: IlpCatalogSourceRef,
  page11: IlpCatalogSourceRef,
): IlpTemplateFeeRule {
  return {
    id: 'monthly-protection-charge',
    label: 'Monthly Protection Charge',
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['policy'],
    assuranceValueAppliesTo: ['policy'],
    activeWindow: 'policy-term',
    requiresManualInput: true,
    assuranceConfig: {
      formula: 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium',
      rateTable: 'tokio-mpc-unzo-death',
      monthlyModalFactor: 1,
      maxAgeNextBirthday: 99,
      tokioProtectionState: {
        mode: 'locked-in-policy-value-with-adjusted-single-premium',
        trackedValueAccountIds: ['policy'],
        withdrawalReductionAccountIds: ['policy'],
      },
    },
    notes: [
      'Models the published Monthly Protection Charge deducted monthly in advance from the Single Premium Units Account value while the policy remains in force.',
      'The sum at risk is the published death benefit less the Single Premium Units Account value, where the death-benefit floor is the higher of the Locked-in Policy Value and Adjusted Single Premium.',
      'The engine uses an annual approximation of the published monthiversary locked-in-value updates and proportional partial-withdrawal reductions to Locked-in Policy Value and Adjusted Single Premium.',
      'Change-of-life-assured administration and payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge remain metadata-only.',
      'User-entered current Locked-in Policy Value and Adjusted Single Premium can represent the present effect of insurer-approved reductions, but the approval workflow itself remains metadata-only.',
    ],
    sourceRefs: [page1, page2, page5, page7, page11],
  }
}

function buildVariant(document: ExtractedPdfDocument, variantId: 'sgd-open-ended-cash' | 'sgd-open-ended-srs'): IlpTemplateVariant {
  const isCash = variantId === 'sgd-open-ended-cash'
  const page1 = sourceRef(1, 'Plan description and locked-in policy value', snippetNear(document, 1, '#goElite Secure', 22))
  const page2 = sourceRef(2, 'Reduction in Locked-in Policy Value and Death Benefit', snippetNear(document, 2, 'Reduction in Locked-in Policy Value', 32))
  const page3 = sourceRef(3, 'Single premium and recurring single premium', snippetNear(document, 3, 'Single Premium', 24))
  const page4 = sourceRef(4, 'Top-up premium and partial withdrawal', snippetNear(document, 4, 'Top-up Premiums', 24))
  const page5 = sourceRef(5, 'Partial withdrawal effects on Locked-in Policy Value and Adjusted Single Premium', snippetNear(document, 5, 'Upon each partial withdrawal from the Single Premium Units Account', 28))
  const page6 = sourceRef(6, 'Dividend distribution', snippetNear(document, 6, 'Dividend Distribution', 26))
  const page7 = sourceRef(7, 'Fees and charges', snippetNear(document, 7, 'Administrative Charge', 28))
  const page8 = sourceRef(8, 'Surrender charge and switching charge', snippetNear(document, 8, 'Surrender Charge', 24))
  const page11 = sourceRef(11, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 11, 'Monthly Rates for Monthly Protection Charges', 20))

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
      sourceRefs: [page7],
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
      sourceRefs: [page7],
    },
    buildTokioEliteSecureMpcFeeRule(page1, page2, page5, page7, page11),
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
      sourceRefs: [page3, page7],
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
      sourceRefs: [page4, page7],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy', 'topup'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        'The product summary states nil partial withdrawal charge.',
      ],
      sourceRefs: [page4, page8],
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
        sourceRefs: [page1, page3, page7],
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
        sourceRefs: [page3, page4, page7],
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
            'Cash policies may reinvest dividends or receive cash payouts from dividend-paying ILP sub-funds in the Single Premium Units Account and/or Top-up Units Account.',
            'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
          ]
        : [
            'SRS policies default dividend distributions to reinvestment, and the source summary does not offer a cash-payout election for this corridor.',
          ],
      sourceRefs: [page6],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    exitChargeBasis: 'initial-single-premium-base',
    warnings: [
      isCash
        ? '#goElite Secure (Cash) is cataloged as a supported V1 corridor. The parser captures the published zero single-premium charge, the 1.4% p.a. establishment charge on the original initial single premium for the first five policy years, the first-five-policy-years surrender charge on that same original base, the 1.00% administrative charge on the Single Premium Units Account, the published current death-benefit estimate plus Monthly Protection Charge through the locked-in-policy-value plus adjusted-single-premium protection-state kernel, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, the published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor, and the cash-payout-capable manual distribution-mode assumption surface with the published $50 minimum cash-payout threshold and 30-day record-date lead time through the open-ended single-premium basis.'
        : '#goElite Secure (SRS) is cataloged as a supported V1 corridor. The parser captures the published zero single-premium charge, the 1.4% p.a. establishment charge on the original initial single premium for the first five policy years, the first-five-policy-years surrender charge on that same original base, the 1.00% administrative charge on the Single Premium Units Account, the published current death-benefit estimate plus Monthly Protection Charge through the locked-in-policy-value plus adjusted-single-premium protection-state kernel, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, the published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor, and the reinvest-only distribution-mode support surface through the open-ended single-premium basis.',
    ],
    unsupportedItems: [
      'Death-benefit payout handling beyond the modeled current death-benefit estimate, aggregation-limit handling, and any policy action that changes the life assured remain informational only.',
      'Fund management fee and third-party banking / currency-conversion charges remain informational only.',
      'Fund-switching administration and user-requested reductions in Locked-in Policy Value remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7, page8, page11],
  }
}

export function parseTokioMarineGoEliteSecure(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goelite-secure',
    insurer: 'Tokio Marine',
    productName: '#goElite Secure',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:tokio-marine-goelite-secure-zero-single-premium-charge',
      'branch:tokio-marine-goelite-secure-establishment-charge',
      'branch:tokio-marine-goelite-secure-administrative-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:tokio-locked-in-protection-state',
      'branch:tokio-marine-goelite-secure-recurring-single-and-top-up-charge',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'branch:tokio-marine-goelite-secure-zero-partial-withdrawal-charge',
      'branch:tokio-marine-goelite-secure-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-marine-goelite-secure-death-benefit-payout-handling',
      'tokio-marine-goelite-secure-aggregation-limit',
      'tokio-marine-goelite-secure-fund-switching',
      'tokio-marine-goelite-secure-fund-level-and-third-party-charges',
    ],
    warnings: [
      '#goElite Secure is cataloged as a supported V1 product. The parser captures the published zero single-premium charge, the 1.4% p.a. establishment charge on the original initial single premium for the first five policy years, the first-five-policy-years surrender charge on that same original base, the 1.00% administrative charge on the Single Premium Units Account, the published current death-benefit estimate plus Monthly Protection Charge through the locked-in-policy-value plus adjusted-single-premium protection-state kernel, the 5% recurring-single-premium and top-up charge path, nil partial-withdrawal charge, the published S$500 minimum one-off partial withdrawal amount plus the 10%-of-initial-single-premium minimum remaining Single Premium Units Account floor, and the cash-vs-SRS distribution-mode support surface, with the SRS corridor remaining reinvest-only.',
      'The modeled current death-benefit estimate and Monthly Protection Charge use the published death-benefit floor logic across Locked-in Policy Value and Adjusted Single Premium. User-entered current Locked-in Policy Value and Adjusted Single Premium can represent the present effect of insurer-approved reductions, while change-of-life-assured handling, future approved-reduction administration, death-benefit payout handling, aggregation limits, fund switching, and fund-level / third-party charges remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'sgd-open-ended-cash'),
      buildVariant(context.document, 'sgd-open-ended-srs'),
    ],
  }
}
