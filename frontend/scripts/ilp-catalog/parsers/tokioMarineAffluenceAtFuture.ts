import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateBonusTier,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const MIP_LENGTH = 15
const INITIAL_CHARGE_RATE = 0.01
const INITIAL_CHARGE_CAP_POLICY_YEAR = 10

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  0.99,
  0.99,
  0.99,
  0.91,
  0.9,
  0.8,
  0.75,
  0.65,
  0.55,
  0.5,
  0.4,
  0.3,
  0.12,
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.72 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.8 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.87 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.95 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 1 },
]

const LOYALTY_BONUS_POLICY_YEARS_3_TO_10: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.007 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.007 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.007 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.007 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0075 },
]

// The brochure reuses this rate table from years 11-40; only years 11-15 carry
// the premium-term adjustment factor because the premium payment term ends at year 15.
const LOYALTY_BONUS_POLICY_YEARS_11_TO_40: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.0092 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.0092 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0098 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0099 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0099 },
]

const INITIAL_CHARGE_RATE_SCHEDULE = Array.from({ length: MIP_LENGTH }, (_, index) => {
  const policyYear = index + 1
  const multiplier = Math.min(policyYear, INITIAL_CHARGE_CAP_POLICY_YEAR)
  return {
    startPolicyYear: policyYear,
    endPolicyYear: policyYear,
    rate: Number((INITIAL_CHARGE_RATE * multiplier).toFixed(4)),
  }
})

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  return {
    page,
    section,
    excerpt: normalizeWhitespace(excerpt).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 6): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const loyaltyPage3 = sourceRef(3, 'Loyalty Bonus', snippetNear(document, 3, 'Loyalty Bonus', 40))
  const loyaltyPage4 = sourceRef(4, 'Loyalty Bonus', snippetNear(document, 4, 'Loyalty Bonus Rate', 28))

  return [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 2,
      rate: null,
      amount: null,
      tieredRates: INITIAL_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Tier is based on the published SGD annualised regular premium band for the 15-year premium payment term.',
        'Allocated to the Initial Units Account upon each regular premium received in the first two policy years.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'loyalty-bonus-policy-years-3-10',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Years 3-10)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 3,
      endPolicyYear: 10,
      rate: null,
      amount: null,
      tieredRates: LOYALTY_BONUS_POLICY_YEARS_3_TO_10.map((tier) => ({ ...tier })),
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 3 to the end of policy year 10 for the SGD 15-year premium payment term.',
        'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [loyaltyPage3],
    },
    {
      id: 'loyalty-bonus-policy-years-11-15',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Years 11-15)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: 15,
      rate: null,
      amount: null,
      tieredRates: LOYALTY_BONUS_POLICY_YEARS_11_TO_40.map((tier) => ({ ...tier })),
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 11 to the end of the premium payment term for the SGD 15-year premium payment term.',
        'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [loyaltyPage3],
    },
    {
      id: 'loyalty-bonus-policy-years-16-40',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Years 16-40)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 16,
      endPolicyYear: 40,
      rate: null,
      amount: null,
      tieredRates: LOYALTY_BONUS_POLICY_YEARS_11_TO_40.map((tier) => ({ ...tier })),
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from the end of the premium payment term to the end of policy year 40 using the post-premium-payment-term loyalty bonus table.',
      ],
      sourceRefs: [loyaltyPage4],
    },
    {
      id: 'loyalty-bonus-policy-year-41-onward',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Year 41 Onward)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 41,
      endPolicyYear: null,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from policy year 41 onward.',
      ],
      sourceRefs: [loyaltyPage4],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page10 = sourceRef(10, 'Initial Charge', snippetNear(document, 10, 'Initial Charge', 28))
  const page11 = sourceRef(11, 'Policy Charge', snippetNear(document, 11, 'Policy Charge', 30))

  return [
    {
      id: 'initial-charge',
      label: 'Initial Charge',
      basis: 'account-value',
      rate: 0,
      rateSchedule: INITIAL_CHARGE_RATE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      appliesTo: ['initial'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly initial charge for the SGD 15-year term as 1.00% p.a. multiplied by the current policy year, capped at policy year 10.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      activeWindow: 'during-mip',
      startPolicyYear: 3,
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 3, endPolicyYear: 15, mode: 'policy-year' },
        ],
      },
      notes: [
        'Models the published monthly policy charge from the 25th policy month through the premium payment term using annualised regular premium committed at commencement date multiplied by the current policy year.',
      ],
      sourceRefs: [page11],
    },
    {
      id: 'policy-charge-after-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      activeWindow: 'after-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 16, endPolicyYear: null, mode: 'fixed', multiplier: 15 },
        ],
      },
      notes: [
        'Models the published monthly policy charge after the premium payment term using the fixed 15-year multiplier.',
      ],
      sourceRefs: [page11],
    },
  ]
}

function buildTokioMpcFeeRule(
  optionPage: IlpCatalogSourceRef,
  chargePage: IlpCatalogSourceRef,
  tablePage: IlpCatalogSourceRef,
  withLifeBenefitRider = false,
): IlpTemplateFeeRule {
  return {
    id: 'monthly-protection-charge',
    label: 'Monthly Protection Charge',
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['accumulation'],
    assuranceValueAppliesTo: ['initial', 'accumulation'],
    fallbackAppliesTo: ['topup', 'initial'],
    activeWindow: withLifeBenefitRider ? 'policy-term' : 'during-mip',
    assuranceConfig: {
      formula: 'tokio-mpc-net-premium-floor',
      rateTable: 'tokio-mpc-unzo-death',
      monthlyModalFactor: 1,
      maxAgeNextBirthday: 99,
      accrual: {
        startPolicyYear: 1,
        endPolicyYear: 2,
        settlementPolicyYear: 3,
      },
    },
    requiresManualInput: true,
    notes: [
      withLifeBenefitRider
        ? 'Models the published Monthly Protection Charge for the Advanced Death Benefit with Life Benefit Rider corridor through the policy anniversary immediately after age 99.'
        : 'Models the published Monthly Protection Charge for the Advanced Death corridor during the 15-year premium payment term.',
      'The Monthly Protection Charge for policy years 1 to 2 is accrued and collected in one lump sum in policy year 3.',
      'Sum at risk is the published net premium less 101% of the Initial Units Account value and 101% of the Accumulation Units Account value, floored at zero.',
      'The charge is deducted monthly in advance from the Accumulation Units Account, with outstanding amounts deducted from the Top-up Units Account and then the Initial Units Account if needed.',
    ],
    sourceRefs: [optionPage, chargePage, tablePage],
  }
}

function buildVariant(
  document: ExtractedPdfDocument,
  deathBenefitOption: 'basic-death' | 'advanced-death' | 'advanced-death-life-benefit-rider',
): IlpTemplateVariant {
  const isAdvancedDeath = deathBenefitOption !== 'basic-death'
  const hasLifeBenefitRider = deathBenefitOption === 'advanced-death-life-benefit-rider'
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'Affluence@Future', 18))
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const page5 = sourceRef(5, 'Regular Premium Routing', snippetNear(document, 5, 'Initial Units Account', 24))
  const page6 = sourceRef(6, 'Recurring Single Premium / Top-up Premium', snippetNear(document, 6, 'Recurring Single Premium', 28))
  const page8 = sourceRef(8, 'Partial Withdrawal / Regular Withdrawal', snippetNear(document, 8, 'Partial Withdrawal', 24))
  const page10 = sourceRef(10, 'Dividend Distribution / Initial Charge', snippetNear(document, 10, 'Dividend Distribution', 28))
  const page11 = sourceRef(11, 'Policy Charge / top-up charges', snippetNear(document, 11, 'Policy Charge', 32))
  const page12Mpc = sourceRef(12, 'Monthly Protection Charge', snippetNear(document, 12, 'Monthly Protection Charge', 26))
  const page12Withdrawal = sourceRef(12, 'Partial Withdrawal and Regular Withdrawal Charge', snippetNear(document, 12, 'Partial Withdrawal and Regular Withdrawal Charge', 12))
  const page16 = isAdvancedDeath
    ? sourceRef(16, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 16, 'Monthly Rates for Monthly Protection Charges', 24))
    : null
  const page18 = sourceRef(18, 'Appendix A Surrender Charge', snippetNear(document, 18, 'Premium Payment Term: 15 – 20 Years', 30))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
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
      sourceRefs: [page6, page11],
    },
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
      sourceRefs: [page6, page11],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'The source document publishes nil partial-withdrawal and regular-withdrawal charges.',
        'Minimum withdrawal amount, minimum remaining account value, and during-vs-after-premium-term withdrawal-account gating remain metadata-only constraints in this partial template.',
      ],
      sourceRefs: [page8, page12Withdrawal],
    },
  ]

  const feeRules = buildFeeRules(document)
  if (isAdvancedDeath && page16) {
    feeRules.push(buildTokioMpcFeeRule(page1, page12Mpc, page16, hasLifeBenefitRider))
  }

  return {
    id: hasLifeBenefitRider
      ? 'sgd-mip-15-advanced-death-life-benefit-rider'
      : isAdvancedDeath
        ? 'sgd-mip-15-advanced-death'
        : 'sgd-mip-15',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 24,
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
        sourceRefs: [page1, page5, page10],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page11],
      },
      {
        id: 'topup',
        label: 'Top-up Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page11],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: 15,
          accountIds: ['accumulation', 'topup'],
        },
        {
          startPolicyYear: 16,
          endPolicyYear: null,
          accountIds: ['initial', 'accumulation', 'topup'],
        },
      ],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment unless the policyholder elects cash payout.',
        'During the premium payment term, only dividends from the Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'After the premium payment term, dividends from the Initial Units Account, Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 minimum dividend amount are reinvested.',
        'Distribution-option instruction changes require at least 30 days before the Record Date.',
      ],
      sourceRefs: [page10],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This partial template models the SGD / premium-payment-term-15 (${hasLifeBenefitRider ? 'Advanced Death with Life Benefit Rider' : isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      'This partial template models 24-month initial-versus-accumulation routing, the published initial bonus tiers, the year-scaled initial charge schedule with the policy-year-10 cap, the policy charge premium-base multiplier basis, top-up routing, recurring single premium routing, nil partial-withdrawal charge, the published 15-year surrender charge table, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'The Advanced Death with Life Benefit Rider variant also models the published Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.'
              : 'The Advanced Death variant also models the published Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Recurring single premium stays blocked during premium holiday until regular premium resumes at the committed commencement-date amount.',
    ],
    unsupportedItems: [
      ...(hasLifeBenefitRider
        ? [
            'Advanced Death payout handling beyond the modeled Monthly Protection Charge, Life Benefit Rider termination / fallback handling, multiple-life last-life settlement, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
          ]
        : isAdvancedDeath
        ? [
            'Advanced Death payout handling beyond the modeled Monthly Protection Charge, Life Benefit Rider selection, multiple-life last-life settlement, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
          ]
        : [
            'This basic-death corridor does not model Advanced Death selection, Life Benefit Rider selection, or Monthly Protection Charge; multiple-life last-life settlement and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
          ]),
      'Regular withdrawal behavior, minimum-account-value enforcement, premium holiday state handling, and non-SGD or non-15-year variants remain metadata-only for this product.',
    ],
    sourceRefs: [page1, page2, page5, page6, page8, page10, page11, page12Withdrawal, ...(page16 ? [page16] : []), page18],
  }
}

export function parseTokioMarineAffluenceAtFuture(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-affluence-atfuture',
    insurer: 'Tokio Marine',
    productName: 'Affluence@Future',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'tokio-initial-vs-accumulation-regular-premium-routing',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'branch:tokio-loyalty-bonus-adjustment-factor',
      'branch:tokio-marine-affluence-atfuture-zero-partial-withdrawal-charge',
      'branch:tokio-marine-affluence-atfuture-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts',
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-affluence-atfuture-advanced-death-payout-handling',
      'tokio-affluence-atfuture-life-benefit-rider',
      'tokio-affluence-atfuture-regular-withdrawal-behavior',
      'tokio-affluence-atfuture-minimum-account-value-enforcement',
      'tokio-affluence-atfuture-multiple-life-last-life-settlement',
      'tokio-affluence-atfuture-change-of-life-assured-and-life-replacement-administration',
      'tokio-affluence-atfuture-premium-holiday-state-handling',
      'tokio-affluence-atfuture-non-sgd-or-non-15-year-variants',
    ],
    warnings: [
      'Affluence@Future is cataloged as a supported V1 product. The SGD / 15-year premium-payment corridors model regular-premium routing, initial bonus allocation, annual loyalty bonus with the published bounded adjustment-factor formula during the premium payment term and the post-term rate windows thereafter, initial and policy charges, top-up and recurring-single-premium routing / charges, zero-charge partial withdrawals, surrender mechanics, and reinvest-default distribution support; the Advanced Death variant also models the accrued Monthly Protection Charge corridor from insured-life inputs, and the Advanced Death with Life Benefit Rider variant extends that same published Monthly Protection Charge corridor through the policy anniversary immediately after age 99.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
      'Advanced-death payout handling beyond the modeled Monthly Protection Charge, Life Benefit Rider handling, regular-withdrawal behavior, minimum-account-value enforcement, multiple-life last-life settlement, change-of-life-assured / life-replacement administration, and premium-holiday / non-SGD / non-15-year variants remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
      buildVariant(context.document, 'advanced-death-life-benefit-rider'),
    ],
  }
}
