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

const SURRENDER_CHARGE_SCHEDULE_MIP_10 = [1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09] as const

const BOOSTER_BONUS_TIERS = [
  { currency: 'SGD' as const, minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.23 },
  { currency: 'SGD' as const, minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.29 },
  { currency: 'SGD' as const, minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.32 },
  { currency: 'SGD' as const, minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.39 },
  { currency: 'SGD' as const, minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.44 },
]

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
  const page2 = sourceRef(2, 'Booster Bonus', snippetNear(document, 2, 'Booster Bonus', 28))
  const page3 = sourceRef(3, 'Booster Bonus and Loyalty Bonus', snippetNear(document, 3, 'Loyalty Bonus', 36))
  const page4 = sourceRef(4, 'Loyalty Bonus', snippetNear(document, 4, 'Loyalty Bonus', 28))
  const page5 = sourceRef(5, 'Loyalty and accumulation bonus', snippetNear(document, 5, 'Accumulation Bonus', 24))
  const page6 = sourceRef(6, 'Accumulation bonus schedule', snippetNear(document, 6, 'Applicable Accumulation Bonus rate', 24))
  const page8 = sourceRef(8, 'Recurring single premium and top-up premium', snippetNear(document, 8, 'Recurring single premium', 28))
  const page11 = sourceRef(11, 'Initial account charge', snippetNear(document, 11, 'Initial account charge', 28))
  const page12 = sourceRef(12, 'Accumulation account charge and premium charge', snippetNear(document, 12, 'Accumulation account charge', 28))
  const page13 = sourceRef(13, 'Policy changes and zero redemption fee', snippetNear(document, 13, 'Redemption fee', 26))
  const page14 = sourceRef(14, 'Withdrawal options', snippetNear(document, 14, 'Withdrawal options', 28))
  const page23 = sourceRef(23, 'Appendix A surrender charge rate', snippetNear(document, 23, 'Appendix A – Surrender charge rate', 24))
  const page24 = sourceRef(24, 'Appendix B increase regular premium layer illustration', snippetNear(document, 24, 'Illustration on increase regular premium layer', 24))

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'booster-bonus',
      type: 'sign-up',
      label: 'Booster Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 2,
      annualPremiumTierBasis: 'committed-annual-premium-at-issue',
      rate: null,
      amount: null,
      tieredRates: BOOSTER_BONUS_TIERS.map((tier) => ({ ...tier })),
      qualificationRules: [
        {
          trigger: 'premium-holiday',
          disqualifyThroughPolicyYear: 2,
        },
      ],
      notes: [
        'Models the published base-layer Booster Bonus rates on each regular premium received during the first 2 policy years of the supported SGD 10-year corridor.',
        'When missed premiums are represented with a premium-holiday event during the first 2 policy years, the remaining base-layer Booster Bonus credits are suppressed through the end of policy year 2.',
        'Increase-regular-premium-layer bonus handling and grace-period administration remain informational only.',
      ],
      sourceRefs: [page2, page3],
    },
    {
      id: 'loyalty-bonus-during-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Years 3-10)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 3,
      endPolicyYear: 10,
      rate: 0.007,
      amount: null,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
        includePolicyRepaymentsInPaidRegularPremium: true,
      },
      notes: [
        'Models the published during-premium-term Loyalty Bonus on accumulation-units-account value using the stated annual adjustment-factor formula.',
        'Manual policy-repayment events can be counted as regular premium paid for that policy year when modeling the published adjustment factor for the base layer.',
        'Pending-transaction timing and increase-regular-premium-layer loyalty handling remain informational only.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'loyalty-bonus-after-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Year 11 Onward)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: null,
      rate: 0.011,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published post-premium-term Loyalty Bonus on accumulation-units-account value from policy year 11 onward.',
        'Pending-transaction timing and increase-regular-premium-layer loyalty handling remain informational only.',
      ],
      sourceRefs: [page4],
    },
    {
      id: 'accumulation-bonus',
      type: 'custom',
      label: 'Accumulation Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 10,
      endPolicyYear: 12,
      rate: 0,
      amount: null,
      tieredRates: [],
      policyYearRateSchedule: [
        { startPolicyYear: 10, endPolicyYear: 10, rate: 0.02 },
        { startPolicyYear: 11, endPolicyYear: 11, rate: 0.02 },
        { startPolicyYear: 12, endPolicyYear: 12, rate: 0.02 },
      ],
      qualificationRules: [
        {
          trigger: 'partial-withdrawal',
          disqualifyIfAnyInLookbackMonths: 60,
        },
        {
          trigger: 'reinvested-dividend-withdrawal',
          disqualifyIfAnyInLookbackMonths: 60,
        },
        {
          trigger: 'regular-premium-reduction',
          disqualifyIfAnyInLookbackMonths: 60,
        },
        {
          formula: 'no-new-premium-arrears-in-lookback-months',
          lookbackMonths: 60,
        },
      ],
      excludedValueRules: [
        {
          trigger: 'top-up',
          basis: 'event-amount',
          lookbackMonths: 12,
        },
      ],
      notes: [
        'Models the published SGD 10-year base-layer Accumulation Bonus schedule at the end of policy years 10 to 12 when no withdrawals or regular-premium reductions occur in the prior 60 months and no outstanding regular-premium arrears attributable to that lookback window remain.',
        'Current-policy-year top-up premiums are excluded from the supported base-value calculation through the published current-year exclusion rule.',
        'Current-policy-year top-up proration by exact acceptance date and increase-regular-premium-layer accumulation-bonus handling remain informational only.',
      ],
      sourceRefs: [page5, page6],
    },
  ]

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
        'During the premium payment term, the executable path assumes authored one-off withdrawals only from the accumulation units account from the 25th policy month onward.',
        'The executable path blocks authored partial withdrawals that would leave the monitored remaining value below the published minimum-account-value threshold.',
        'Initial-units-account withdrawal lockout, regular-withdrawal timing, minimum withdrawal amount, and increase-layer withdrawal ordering remain informational only.',
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
        ],
        sourceRefs: [page1, page2, page3, page11, page14, page23],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page3, page4, page5, page8, page12, page14],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_SCHEDULE_MIP_10],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 25,
      minimumRegularPremiumAmountByFrequency: {
        annual: 6_000,
        'semi-annual': 3_000,
        quarterly: 1_500,
        monthly: 500,
      },
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'accumulation', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
    },
    warnings: [
      'FWD Invest First Max is cataloged as a supported V1 corridor. The parser captures the SGD 10-year base-layer corridor only: the published Booster Bonus, Loyalty Bonus, Accumulation Bonus base-value schedule, initial-account charge, accumulation-account charge, 5% top-up / recurring-single premium charges, the after-policy-month-25 regular-premium variation start gate with the published SGD minimum regular-premium table, zero redemption fee on the executable accumulation-account one-off partial-withdrawal path with start-month and minimum-remaining-value gating, and the 10-year surrender-charge schedule.',
      'Current-policy-year top-up proration within Accumulation Bonus, maturity benefit, increase regular premium layers, minimum increase / reduction amounts from application forms, and broader missed-premium behavior remain informational only.',
      'The product supports longer premium-payment terms and multi-layer premium increases, but those corridors remain outside this executable slice.',
    ],
    unsupportedItems: [
      'Accumulation Bonus current-policy-year top-up proration by exact acceptance date and increase-regular-premium-layer handling remain informational only.',
      'Booster Bonus handling for increase-regular-premium layers and exact grace-period administration remain informational only.',
      'Loyalty Bonus pending-transaction timing and increase-regular-premium-layer handling remain informational only.',
      'Maturity Benefit, multi-life last-survivor handling, and change-of-person-insured behavior remain informational only beyond the modeled current ordinary death-benefit amount.',
      'Recurring single premium reduction priority, increase regular premium layers, and minimum increase / reduction amounts from application forms remain informational only.',
      'Missed-premium and grace-period administration outside the explicit premium-holiday booster-suppression path, plus broader bonus-suspension interactions, remain informational only.',
      'Minimum withdrawal amount, initial-units-account withdrawal rules, policy closure charge, change-of-policy-currency handling, and fund management charges remain informational only.',
    ],
    sourceRefs: [page1, page5, page6, page8, page11, page12, page13, page14, page23, page24],
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
      'branch:fwd-invest-first-max-booster-bonus',
      'branch:fwd-invest-first-max-loyalty-bonus',
      'kernel:bonus-lookback-qualification-window',
      'branch:fwd-invest-first-max-accumulation-bonus-base-value',
      'branch:fwd-invest-first-max-initial-account-charge',
      'branch:fwd-invest-first-max-accumulation-account-charge',
      'kernel:current-death-benefit-estimate',
      'branch:fwd-invest-first-max-top-up-premium-charge',
      'branch:fwd-invest-first-max-recurring-single-premium-charge',
      'branch:fwd-invest-first-max-zero-redemption-fee',
      'branch:fwd-invest-first-max-surrender-charge',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
    ],
    coveredElsewhereBehaviors: [
      'fwd-invest-first-max-policy-closure-charge',
      'fwd-invest-first-max-fund-management-charge',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-first-max-accumulation-bonus-current-year-top-up-proration',
      'fwd-invest-first-max-maturity-benefit',
      'fwd-invest-first-max-multi-life-last-survivor',
      'fwd-invest-first-max-increase-regular-premium-layer',
      'fwd-invest-first-max-regular-premium-variation-application-form-minimums',
      'fwd-invest-first-max-missed-premium-grace-period',
      'fwd-invest-first-max-minimum-withdrawal-rules',
      'fwd-invest-first-max-change-of-person-insured',
      'fwd-invest-first-max-change-of-policy-currency',
    ],
    warnings: [
      'FWD Invest First Max is cataloged as a supported V1 corridor. The current parser covers the SGD 10-year base-layer corridor: the published Booster Bonus, Loyalty Bonus, the Accumulation Bonus base-value schedule with a 60-month qualification window, initial-account charge, accumulation-account charge, the current-state death-benefit estimate as 105% of policy value, top-up and recurring-single premium charges, zero redemption fee, and the 10-year surrender-charge schedule.',
      'Current-policy-year top-up proration within Accumulation Bonus, maturity benefit, multi-life last-survivor handling, increase regular premium layers, minimum increase / reduction amounts from application forms, and broader premium-flexibility administration beyond the modeled base-layer booster missed-premium suppression remain informational only.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
