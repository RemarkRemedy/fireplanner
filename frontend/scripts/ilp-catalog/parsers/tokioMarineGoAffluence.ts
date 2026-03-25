import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateBonusTier,
  IlpTemplateFeeRule,
  IlpTemplateEventChargeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

const MIP_LENGTH = 15

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  0.99,
  0.99,
  0.99,
  0.91,
  0.84,
  0.76,
  0.68,
  0.6,
  0.5,
  0.43,
  0.34,
  0.26,
  0.15,
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.5 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.57 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.64 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.71 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.75 },
]

const LOYALTY_BONUS_POLICY_YEARS_3_TO_10: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.007 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.007 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.007 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.007 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0075 },
]

const LOYALTY_BONUS_POLICY_YEAR_11_ONWARD: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.0092 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.0092 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0098 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0099 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0099 },
]

const INITIAL_CHARGE_RATE_SCHEDULE = Array.from({ length: MIP_LENGTH }, (_, index) => {
  const policyYear = index + 1
  return {
    startPolicyYear: policyYear,
    endPolicyYear: policyYear,
    rate: Number((0.0085 * policyYear).toFixed(4)),
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
  const page4 = sourceRef(4, 'Initial Bonus', snippetNear(document, 4, 'Initial Bonus', 22))
  const page5 = sourceRef(5, 'Loyalty Bonus / Achievement Bonus', snippetNear(document, 5, 'Loyalty Bonus', 36))
  const page6 = sourceRef(6, 'Achievement Bonus', snippetNear(document, 6, 'Achievement Bonus', 24))

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
      sourceRefs: [page4],
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
        'Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 3 to the end of policy year 10.',
        'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [page5],
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
      tieredRates: LOYALTY_BONUS_POLICY_YEAR_11_ONWARD.map((tier) => ({ ...tier })),
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 11 to the end of the premium payment term.',
        'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'achievement-bonus',
      type: 'custom',
      label: 'Achievement Bonus',
      mode: 'one-time',
      oneTimePayoutBasis: 'committed-annual-premium-at-issue',
      appliesTo: ['accumulation'],
      startPolicyYear: 20,
      endPolicyYear: 25,
      cadenceYears: 5,
      rate: 0.25,
      amount: null,
      tieredRates: [],
      qualificationRules: [
        { trigger: 'premium-holiday', disqualifyThroughReferenceYear: true },
        { trigger: 'regular-premium-reduction', disqualifyThroughReferenceYear: true },
        { trigger: 'partial-withdrawal', disqualifyThroughReferenceYear: true },
      ],
      notes: [
        'Models the published achievement bonus for the SGD 15-year premium payment term as 25% of annualised regular premium committed at commencement date at the end of policy years 20 and 25.',
        'Each milestone is disqualified if any premium holiday, regular-premium reduction, or partial withdrawal from the Accumulation Units Account occurs before the end of that eligible policy year.',
        'The bonus is allocated to the Accumulation Units Account using the latest investment allocation instructions on the next pricing day after the policy anniversary.',
      ],
      sourceRefs: [page5, page6],
    },
    {
      id: 'loyalty-bonus-after-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (After Premium Payment Term)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 16,
      endPolicyYear: null,
      rate: null,
      amount: null,
      tieredRates: LOYALTY_BONUS_POLICY_YEAR_11_ONWARD.map((tier) => ({ ...tier })),
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value after the premium payment term using the policy year 11 onward loyalty bonus rate table without the adjustment-factor multiplier.',
      ],
      sourceRefs: [page5],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page11 = sourceRef(11, 'Initial Charge', snippetNear(document, 11, 'Initial Charge', 24))
  const page12 = sourceRef(12, 'Policy Charge', snippetNear(document, 12, 'Policy Charge', 24))

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
        'Models the published monthly initial charge for the SGD 15-year term as 0.85% p.a. multiplied by the current policy year.',
      ],
      sourceRefs: [page11],
    },
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      activeWindow: 'during-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: 15, mode: 'policy-year' },
        ],
      },
      notes: [
        'Models the published monthly policy charge during the premium payment term using annualised regular premium committed at commencement date multiplied by the current policy year.',
      ],
      sourceRefs: [page12],
    },
    {
      id: 'policy-charge-after-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
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
      sourceRefs: [page12],
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
    fallbackAppliesTo: ['initial', 'topup'],
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
        ? 'Models the published Monthly Protection Charge for the Advanced Death with Life Benefit Rider corridor through the policy anniversary immediately after age 99.'
        : 'Models the published Monthly Protection Charge for the Advanced Death corridor during the 15-year premium payment term.',
      'The Monthly Protection Charge for policy years 1 to 2 is accrued and collected in one lump sum in policy year 3.',
      'Sum at risk is the published net premium less 101% of the Initial Units Account value and 101% of the Accumulation Units Account value, floored at zero.',
      'The charge is deducted monthly in advance from the Accumulation Units Account, with outstanding amounts deducted from the Initial Units Account and/or Top-up Units Account if needed.',
      ...(withLifeBenefitRider
        ? ['For policies with more than one life assured, the rider terminates on the policy anniversary immediately after the 99th birthday of the youngest life assured.']
        : []),
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
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, '#goAffluence', 18))
  const page4 = sourceRef(4, 'Initial Bonus', snippetNear(document, 4, 'Initial Bonus', 22))
  const page7 = sourceRef(7, 'Regular Premium and Recurring Single Premium', snippetNear(document, 7, 'Regular premium due during the first 24 months', 26))
  const page8 = sourceRef(8, 'Top-up Premium and Premium Holiday', snippetNear(document, 8, 'Premium Holiday', 18))
  const page9 = sourceRef(9, 'Partial Withdrawal and Regular Withdrawal', snippetNear(document, 9, 'Partial Withdrawal', 22))
  const page10 = sourceRef(10, 'Dividend Distribution', snippetNear(document, 10, 'Dividend Distribution', 22))
  const page11 = sourceRef(11, 'Initial Charge', snippetNear(document, 11, 'Initial Charge', 24))
  const page12 = sourceRef(12, 'Policy Charge and top-up charges', snippetNear(document, 12, 'Policy Charge', 28))
  const page17 = isAdvancedDeath
    ? sourceRef(17, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 17, 'Monthly Rates for Monthly Protection Charges', 24))
    : null
  const page19 = sourceRef(19, 'Appendix A Surrender Charge', snippetNear(document, 19, 'Premium Payment Term: 15', 22))

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
      sourceRefs: [page8, page12],
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
      sourceRefs: [page7, page12],
    },
  ]

  const feeRules = buildFeeRules(document)
  if (isAdvancedDeath && page17) {
    feeRules.push(buildTokioMpcFeeRule(page1, page12, page17, hasLifeBenefitRider))
  }

  return {
    id: deathBenefitOption === 'basic-death'
      ? 'sgd-mip-15'
      : hasLifeBenefitRider
        ? 'sgd-mip-15-advanced-death-life-benefit-rider'
        : 'sgd-mip-15-advanced-death',
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
        sourceRefs: [page1, page7, page11],
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
        sourceRefs: [page1, page7, page12],
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
        sourceRefs: [page1, page7, page8],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPremiumHolidayStartPolicyMonth: 25,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
    },
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
        'During the 15-year premium payment term, only dividends from the Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'After the premium payment term, dividends from the Initial Units Account, Accumulation Units Account, and Top-up Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 minimum dividend amount are reinvested.',
        'Distribution-option instruction changes require at least 30 days before the Record Date.',
      ],
      sourceRefs: [page10],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This ${isAdvancedDeath ? 'supported' : 'partial'} template models the SGD / premium-payment-term-15 (${hasLifeBenefitRider ? 'Advanced Death with Life Benefit Rider' : isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      `This ${isAdvancedDeath ? 'supported' : 'partial'} template models regular-premium routing through the 15-year payment term, the published initial bonus tiers, annual loyalty bonus, achievement bonus at policy years 20 and 25 using the commencement-date annualised regular premium basis, the year-scaled initial charge schedule, the policy charge premium-base multiplier basis, top-up routing, recurring single premium routing, the published 15-year surrender charge table, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.`,
      'The resident-corridor current accidental-death estimate before age 75 is also modeled on the published annualised regular premium band after you enter current age; premium-holiday and regular-premium-reduction history, 180-day timing, residency / Singapore-location claim gates, double-indemnity payout, and accidental-death last-life settlement remain informational only.',
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'The Advanced Death with Life Benefit Rider variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, static current multi-life last-life handling, oldest-life MPC rating, youngest-life rider age gating, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.'
              : 'The Advanced Death variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, static current multi-life last-life handling, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Recurring single premium events before policy month 13 or below the published monthly-equivalent minimum of S$50 are blocked; insurer-defined increase / reduction minimums remain informational only.',
      'Recurring single premium stays blocked during premium holiday until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the committed commencement-date amount.',
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider termination / fallback handling, dependent medical / retrenchment benefits, and change-of-life-assured administration remain metadata-only for this product.'
              : 'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, together with Advanced Death Benefit with Life Benefit Rider, dependent medical / retrenchment benefits, and change-of-life-assured administration, remains metadata-only for this product.',
          ]
        : [
            'Advanced Death selection, Monthly Protection Charge, Advanced Death Benefit with Life Benefit Rider, dependent medical / retrenchment benefits, and change-of-life-assured administration remain metadata-only for this product.',
          ]),
      'The resident current accidental-death estimate before age 75 is modeled on the published annualised regular premium band, while double indemnity, 180-day timing, residency / Singapore-location claim gates, accidental-death last-life settlement, and premium-holiday / regular-premium-reduction history remain metadata-only for this product.',
      'Regular withdrawal, partial-withdrawal limit and minimum-account-value constraints, premium holiday state handling, and non-SGD/premium-term variants remain metadata-only for this product.',
    ],
    sourceRefs: [page1, page4, page7, page8, page9, page10, page11, page12, page19, ...(page17 ? [page17] : [])],
  }
}

export function parseTokioMarineGoAffluence(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goaffluence',
    insurer: 'Tokio Marine',
    productName: '#goAffluence',
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
      'kernel:minimum-premium-holiday-start-month',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'kernel:committed-premium-rsp-resumption-gate',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-initial-account-surrender-charge',
      'branch:tokio-loyalty-bonus-adjustment-factor',
      'branch:tokio-goaffluence-achievement-bonus-premium-base-milestones',
      'branch:tokio-goaffluence-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts',
      'branch:tokio-current-only-multi-life-life-state',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-goaffluence-advanced-death-payout-life-benefit-rider-and-life-assured-administration',
      'tokio-goaffluence-accidental-death-claim-gates-and-premium-change-history',
      'tokio-goaffluence-regular-withdrawal-and-partial-withdrawal-constraints',
      'tokio-goaffluence-premium-holiday-and-non-sgd-or-non-15-year-variants',
    ],
    warnings: [
      '#goAffluence is cataloged as a supported V1 product. The SGD / 15-year premium-payment corridors model regular-premium routing, initial bonus allocation, annual loyalty bonus with the published bounded adjustment-factor formula during the premium payment term and the flat post-term rate table thereafter, achievement bonus at policy years 20 and 25 using the commencement-date annualised regular premium basis with milestone-year qualification gates, initial and policy charges, top-up and recurring-single-premium routing / charges, the commencement-date recurring-single-premium resumption gate after premium holiday, surrender mechanics, reinvest-default distribution support, and the resident-corridor current accidental-death estimate before age 75 on the published annualised regular premium band after current age is entered; the Advanced Death variant also models the published current death-benefit estimate and accrued Monthly Protection Charge corridor from insured-life inputs with static current multi-life last-life handling, and the Advanced Death with Life Benefit Rider variant extends that same corridor through the policy anniversary immediately after age 99 with oldest-life MPC rating and youngest-life rider age gating.',
      'Recurring single premium stays blocked after a premium-holiday event until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the commencement-date amount.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
      'Advanced-death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, accidental-death claim gating beyond the resident premium-band current-state shortcut, regular-withdrawal administration, partial-withdrawal limit and minimum-account-value constraints, and premium-holiday / non-SGD / non-15-year variants remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
      buildVariant(context.document, 'advanced-death-life-benefit-rider'),
    ],
  }
}
