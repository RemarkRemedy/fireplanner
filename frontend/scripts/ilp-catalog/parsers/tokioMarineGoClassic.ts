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

const TERM_OPTIONS = [
  5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
] as const

type SupportedTerm = (typeof TERM_OPTIONS)[number]

const BASE_SURRENDER_CHARGE_TABLE = [
  1,
  1,
  0.95,
  0.93,
  0.91,
  0.89,
  0.87,
  0.85,
  0.83,
  0.8,
  0.77,
  0.74,
  0.71,
  0.68,
  0.64,
  0.6,
  0.56,
  0.51,
  0.46,
  0.41,
  0.36,
  0.31,
  0.26,
  0.21,
  0.15,
] as const

type InitialBonusRatesByTerm = readonly [number, number, number, number, number, number, number, number, number]

interface InitialBonusTierConfig {
  minAnnualPremium: number | null
  maxAnnualPremium: number | null
  ratesByTerm: InitialBonusRatesByTerm
}

const INITIAL_BONUS_TIER_CONFIGS: InitialBonusTierConfig[] = [
  { minAnnualPremium: null, maxAnnualPremium: 11_999.99, ratesByTerm: [0.02, 0.05, 0.09, 0.12, 0.12, 0.12, 0.12, 0.12, 0.15] },
  { minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, ratesByTerm: [0.04, 0.09, 0.12, 0.22, 0.22, 0.22, 0.22, 0.22, 0.25] },
  { minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, ratesByTerm: [0.05, 0.12, 0.17, 0.27, 0.27, 0.3, 0.34, 0.35, 0.42] },
  { minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, ratesByTerm: [0.07, 0.17, 0.22, 0.29, 0.32, 0.34, 0.35, 0.37, 0.44] },
  { minAnnualPremium: 48_000, maxAnnualPremium: null, ratesByTerm: [0.09, 0.2, 0.25, 0.32, 0.35, 0.37, 0.39, 0.4, 0.47] },
]

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

function resolveInitialBonusRate(term: SupportedTerm, ratesByTerm: InitialBonusRatesByTerm): number {
  if (term <= 9) return ratesByTerm[0]
  if (term <= 14) return ratesByTerm[1]
  if (term <= 19) return ratesByTerm[2]
  if (term === 20) return ratesByTerm[3]
  if (term === 21) return ratesByTerm[4]
  if (term === 22) return ratesByTerm[5]
  if (term === 23) return ratesByTerm[6]
  if (term === 24) return ratesByTerm[7]
  return ratesByTerm[8]
}

function buildInitialBonusTiers(term: SupportedTerm): IlpTemplateBonusTier[] {
  return INITIAL_BONUS_TIER_CONFIGS.map((tier) => ({
    currency: 'SGD',
    minAnnualPremium: tier.minAnnualPremium,
    maxAnnualPremium: tier.maxAnnualPremium,
    rate: resolveInitialBonusRate(term, tier.ratesByTerm),
  }))
}

function buildSurrenderChargeTable(term: SupportedTerm): number[] {
  if (term === 25) return [...BASE_SURRENDER_CHARGE_TABLE]
  return [1, 1, ...BASE_SURRENDER_CHARGE_TABLE.slice(27 - term)]
}

function describeInitialBonusTerm(term: SupportedTerm): string {
  if (term <= 9) return '5-to-9-year premium payment terms'
  if (term <= 14) return '10-to-14-year premium payment terms'
  if (term <= 19) return '15-to-19-year premium payment terms'
  return `${term}-year premium payment term`
}

function buildBonuses(document: ExtractedPdfDocument, term: SupportedTerm): IlpTemplateBonus[] {
  const page1 = sourceRef(1, 'Initial Bonus', snippetNear(document, 1, 'Initial Bonus', 18))
  const page2 = sourceRef(2, 'Initial Bonus Rates', snippetNear(document, 2, 'Initial bonus rates on a per annum basis', 20))
  const loyaltyPage = sourceRef(2, 'Loyalty Bonus', snippetNear(document, 2, 'Loyalty Bonus', 32))
  const additionalPage = sourceRef(3, 'Additional Bonus', snippetNear(document, 3, 'Additional Bonus', 24))

  return [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 3,
      rate: null,
      amount: null,
      tieredRates: buildInitialBonusTiers(term),
      notes: [
        `Tier is based on the published SGD annualised regular premium band for the ${describeInitialBonusTerm(term)}.`,
        'Allocated to the Initial Units Account upon each regular premium received in the first three policy years.',
      ],
      sourceRefs: [page1, page2],
    },
    {
      id: 'loyalty-bonus-during-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (During Premium Payment Term)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: term,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        `Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 4 to the end of the ${term}-year premium payment term.`,
        'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [loyaltyPage],
    },
    {
      id: 'loyalty-bonus-after-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (After Premium Payment Term)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: term + 1,
      endPolicyYear: null,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value after the premium payment term without the adjustment-factor multiplier.',
      ],
      sourceRefs: [loyaltyPage],
    },
    {
      id: 'additional-bonus',
      type: 'custom',
      label: 'Additional Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: term,
      rate: 0.002,
      amount: null,
      tieredRates: [],
      qualificationRules: [
        { trigger: 'premium-holiday', disqualifyInReferenceYear: true },
        { trigger: 'regular-premium-reduction', disqualifyInReferenceYear: true },
        { trigger: 'partial-withdrawal', disqualifyInReferenceYear: true },
      ],
      notes: [
        `Models the published annual Additional Bonus of 0.20% of the Accumulation Units Account value during the ${term}-year premium payment term only.`,
        'The bonus is disqualified in a policy year if any premium holiday, regular-premium reduction, or partial withdrawal occurs during that same policy year.',
      ],
      sourceRefs: [additionalPage],
    },
  ]
}

function buildTokioMpcFeeRule(
  optionPage: IlpCatalogSourceRef,
  chargePage: IlpCatalogSourceRef,
  tablePage: IlpCatalogSourceRef,
  term: SupportedTerm,
): IlpTemplateFeeRule {
  return {
    id: 'monthly-protection-charge',
    label: 'Monthly Protection Charge',
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['accumulation'],
    assuranceValueAppliesTo: ['initial', 'accumulation'],
    activeWindow: 'during-mip',
    requiresManualInput: true,
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
      disableFutureChargesOnInsufficientDeduction: true,
    },
    notes: [
      `Models the published Monthly Protection Charge for the Advanced Death corridor during the ${term}-year premium payment term.`,
      'The sum at risk is the published net premium less 101% of policy value, using Initial plus Accumulation Units Account value for the valuation basis.',
      'The first two policy years accrue and are deducted in one lump sum in the third policy year.',
      'If the Accumulation Units Account cannot fully fund MPC due, future Advanced Death MPC stops permanently while the unpaid balance remains collectible as indebtedness.',
      'Advanced Death payout handling beyond the modeled MPC and change-of-life-assured administration remain metadata-only.',
    ],
    sourceRefs: [optionPage, chargePage, tablePage],
  }
}

function buildVariant(
  document: ExtractedPdfDocument,
  term: SupportedTerm,
  deathBenefitOption: 'basic-death' | 'advanced-death',
): IlpTemplateVariant {
  const isAdvancedDeath = deathBenefitOption === 'advanced-death'
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, '#goClassic', 18))
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial bonus rates on a per annum basis', 22))
  const page3 = sourceRef(3, 'Loyalty Bonus / Additional Bonus', snippetNear(document, 3, 'Additional Bonus', 28))
  const page4 = sourceRef(4, 'Regular Premium Routing', snippetNear(document, 4, 'Regular premium due during the first 24 months', 20))
  const page5 = sourceRef(5, 'Recurring Single Premium / Top-up Premium / Premium Holiday', snippetNear(document, 5, 'Recurring Single Premium', 22))
  const page6 = sourceRef(6, 'Partial Withdrawal', snippetNear(document, 6, 'Partial Withdrawal', 26))
  const page8 = sourceRef(8, 'Dividend Distribution', snippetNear(document, 8, 'Dividend Distribution', 28))
  const page9 = sourceRef(9, 'Initial Charge / Policy Charge / MPC', snippetNear(document, 9, 'Initial Charge', 28))
  const page10 = sourceRef(10, 'Premium Charge / Surrender Charge', snippetNear(document, 10, 'Premium Charge for Recurring Single Premium and Top-up Premium', 26))
  const page13 = sourceRef(
    13,
    'Appendix A Monthly Protection Charge Rates',
    snippetNear(document, 13, 'Monthly Rates for Monthly Protection Charges', 24),
  )
  const page14 = sourceRef(
    14,
    'Appendix A Surrender Charge',
    snippetNear(document, 14, 'Premium Payment Term:', 24),
  )

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
        'A 5% premium charge is deducted before each top-up premium allocation to the Accumulation Units Account.',
      ],
      sourceRefs: [page5, page10],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['accumulation'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each recurring single premium allocation to the Accumulation Units Account.',
      ],
      sourceRefs: [page5, page10],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['initial', 'accumulation'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'No policy-level partial withdrawal charge is stated in the summary.',
        'V1 blocks explicit one-off partial withdrawals before the third policy year on the Accumulation Units Account and before the end of the premium payment term on the Initial Units Account.',
        'V1 also blocks explicit one-off partial withdrawals below the published S$500 minimum amount and any one-off withdrawal that would leave total policy value below the published S$3,000 minimum account value.',
        'Regular-withdrawal administration and selected-fund residual-value conditions remain informational only in V1.',
      ],
      sourceRefs: [page6, page10],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = []
  if (isAdvancedDeath) {
    feeRules.push(buildTokioMpcFeeRule(page1, page9, page13, term))
  }

  return {
    id: isAdvancedDeath ? `sgd-mip-${term}-advanced-death` : `sgd-mip-${term}`,
    currency: 'SGD',
    mipLength: term,
    icpMonths: 24,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: 0.0675,
        postMipFeeRate: 0.0135,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page2, page4, page9],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: 0.0135,
        postMipFeeRate: 0.0135,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page3, page4, page5, page9, page10],
      },
    ],
    bonuses: buildBonuses(document, term),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 500,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
        { accountId: 'initial', startPolicyMonth: term * 12 + 1 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 3_000 },
      ],
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: term,
          accountIds: ['accumulation'],
        },
        {
          startPolicyYear: term + 1,
          endPolicyYear: null,
          accountIds: ['initial', 'accumulation'],
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
        `During the ${term}-year premium payment term, only dividends from the Accumulation Units Account may be paid in cash.`,
        'After the premium payment term, dividends from both the Initial Units Account and Accumulation Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 annual dividend threshold remain reinvested in V1.',
        'Cash payout elections should be lodged at least 30 days before the dividend record date.',
      ],
      sourceRefs: [page8],
    },
    eecTable: buildSurrenderChargeTable(term),
    warnings: [
      `This supported template models the SGD / premium-payment-term-${term} (${isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor.`,
      `This supported template models 24-month initial-versus-accumulation routing, the published ${describeInitialBonusTerm(term)} initial bonus tiers, the published initial charge and policy charge through executable account fee rates, recurring single premium and top-up routing into the Accumulation Units Account, the nil policy-level one-off partial-withdrawal charge path with the published policy-year-3 start gate, S$500 minimum amount, and S$3,000 minimum account value, the published ${term}-year surrender charge on the Initial Units Account, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.`,
      ...(isAdvancedDeath
        ? [
            `The Advanced Death variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, policy-value valuation basis, and the irreversible downgrade to Basic Death after failed Accumulation Units Account deduction during the ${term}-year premium payment term.`,
          ]
        : []),
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? [
            'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, premium-holiday lapse behavior, regular withdrawal, selected-fund residual-value conditions, credit-card charge, change-of-life-assured administration, and non-SGD corridors remain metadata-only.',
          ]
        : [
            'Advanced Death Benefit selection, Monthly Protection Charge, premium-holiday lapse behavior, regular withdrawal, selected-fund residual-value conditions, credit-card charge, change-of-life-assured administration, and non-SGD corridors remain metadata-only.',
          ]),
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page8, page9, page10, page13, page14],
  }
}

export function parseTokioMarineGoClassic(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goclassic',
    insurer: 'Tokio Marine',
    productName: '#goClassic',
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
      'tokio-policy-charge-on-policy-value',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'branch:tokio-goclassic-zero-partial-withdrawal-charge',
      'tokio-initial-account-surrender-charge',
      'branch:tokio-loyalty-bonus-adjustment-factor',
      'branch:tokio-additional-bonus-current-year-qualification',
      'branch:tokio-current-only-multi-life-life-state',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'branch:tokio-goclassic-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'tokio-goclassic-advanced-death-payout-handling',
      'tokio-goclassic-change-of-life-assured-administration',
      'tokio-goclassic-premium-holiday-lapse-state',
      'tokio-goclassic-regular-withdrawal-facility',
      'tokio-goclassic-credit-card-charge',
    ],
    warnings: [
      '#goClassic is cataloged as a supported V1 product. The parser captures the published SGD premium-payment-term family from 5 to 25 years across Basic Death and Advanced Death corridors with executable regular-premium routing, published term-specific initial bonus tiers, annual loyalty bonus with the published bounded adjustment-factor formula during the premium payment term and the flat post-term rate thereafter, the published 0.20% Additional Bonus during the premium payment term with same-policy-year qualification gates, fee-rate modeling for the initial and policy charges, recurring single premium and top-up charges into the Accumulation Units Account, the nil policy-level one-off partial-withdrawal charge path with the published policy-year-3 start gate, S$500 minimum amount, and S$3,000 minimum account value, the published term-specific surrender charge on the Initial Units Account, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
      'Additional Bonus is modeled on the published same-policy-year qualification corridor only; regular-withdrawal administration, selected-fund residual-value conditions, premium-holiday lapse behavior, credit-card charge, change-of-life-assured administration, and other non-SGD corridors remain informational only.',
      'Basic Death keeps Monthly Protection Charge metadata-only, while the Advanced Death variants model the published current death-benefit estimate, first-two-policy-years accrual, policy-year-3 settlement, policy-value valuation basis, irreversible downgrade after failed deduction, and static current multi-life last-life handling.',
    ],
    archived: false,
    variants: TERM_OPTIONS.flatMap((term) => [
      buildVariant(context.document, term, 'basic-death'),
      buildVariant(context.document, term, 'advanced-death'),
    ]),
  }
}
