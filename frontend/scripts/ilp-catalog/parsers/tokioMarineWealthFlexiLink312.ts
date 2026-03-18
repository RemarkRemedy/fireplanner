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

const MIP_LENGTH = 12

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  0.92,
  0.85,
  0.78,
  0.75,
  0.68,
  0.58,
  0.48,
  0.075,
  0.015,
  0.01,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.92 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.85 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.78 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.75 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.68 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.58 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.48 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.075 },
  { startPolicyYear: 11, endPolicyYear: 11, rate: 0.015 },
  { startPolicyYear: 12, endPolicyYear: 12, rate: 0.01 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.16 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.3 },
]

const POWER_UP_BONUS_POLICY_YEAR_10_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 23_999.99, rate: 0.01 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.014 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.017 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0195 },
] as const

const POWER_UP_BONUS_POLICY_YEAR_11_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 23_999.99, rate: 0.015 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.019 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.022 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.0245 },
] as const

const POWER_UP_BONUS_POLICY_YEAR_12_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 23_999.99, rate: 0.0305 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.0345 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.0375 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.04 },
] as const

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
  const page3 = sourceRef(3, 'Premium Bonus / Power-up Bonus', snippetNear(document, 3, 'Premium Bonus', 34))
  const page4 = sourceRef(4, 'Loyalty Bonus / Involuntary Unemployment Benefit', snippetNear(document, 4, 'Loyalty Bonus', 24))

  return [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['accumulation'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: INITIAL_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Tier is based on the published SGD annualised regular premium band for Wealth Flexi-Link 3.12.',
        'Allocated to the Accumulation Units Account in the first policy year.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'premium-bonus',
      type: 'custom',
      label: 'Premium Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: 12,
      rate: 0.0023,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual premium bonus on Total Investment Value from the end of policy year 4 until the end of the minimum investment period.',
        'The source document conditions payment on all regular premiums due in the prior 12 months being paid and no withdrawals from the Accumulation Units Account in the prior 12 months; those gates remain manual review assumptions in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus-policy-year-10',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 10)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 10,
      endPolicyYear: 10,
      rate: null,
      amount: null,
      tieredRates: POWER_UP_BONUS_POLICY_YEAR_10_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 10 using the published SGD annualised regular premium bands.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus-policy-year-11',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 11)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: 11,
      rate: null,
      amount: null,
      tieredRates: POWER_UP_BONUS_POLICY_YEAR_11_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 11 using the published SGD annualised regular premium bands.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus-policy-year-12',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 12)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 12,
      endPolicyYear: 12,
      rate: null,
      amount: null,
      tieredRates: POWER_UP_BONUS_POLICY_YEAR_12_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 12 using the published SGD annualised regular premium bands.',
        'The source document conditions payment on no partial withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 13,
      endPolicyYear: null,
      rate: 0.0055,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual loyalty bonus on Total Investment Value from the end of policy year 13 onward.',
        'The source document conditions payment on no withdrawal from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page4],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page10 = sourceRef(10, 'Policy Charge', snippetNear(document, 10, 'Policy Charge', 26))

  return [
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.0245,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly policy charge during the minimum investment period as 2.45% p.a. of Total Investment Value.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'policy-charge-after-mip',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.006,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'after-mip',
      notes: [
        'Models the published monthly policy charge after the minimum investment period as 0.60% p.a. of Total Investment Value.',
      ],
      sourceRefs: [page10],
    },
  ]
}

function buildTokioMpcFeeRule(
  optionPage: IlpCatalogSourceRef,
  chargePage: IlpCatalogSourceRef,
  tablePage: IlpCatalogSourceRef,
): IlpTemplateFeeRule {
  return {
    id: 'monthly-protection-charge',
    label: 'Monthly Protection Charge',
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['accumulation'],
    fallbackAppliesTo: ['topup'],
    activeWindow: 'during-mip',
    assuranceConfig: {
      formula: 'tokio-mpc-net-premium-floor',
      rateTable: 'tokio-mpc-unzo-death',
      monthlyModalFactor: 1,
      maxAgeNextBirthday: 99,
    },
    requiresManualInput: true,
    notes: [
      'Models the published Monthly Protection Charge for the Advanced Death Benefit corridor during the 12-year minimum investment period only.',
      'Sum at risk is the published net premium less 101% of Total Investment Value, using the modeled Accumulation Units Account value as the executable investment-value base.',
      'The charge is deducted monthly in advance from the Top-up Units Account first, and thereafter from the eligible rider if applicable; the eligible-rider fallback remains metadata-only in this partial template.',
    ],
    sourceRefs: [optionPage, chargePage, tablePage],
  }
}

function buildVariant(
  document: ExtractedPdfDocument,
  deathBenefitOption: 'basic-death' | 'advanced-death',
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Death Benefit Options', snippetNear(document, 1, 'Basic Death Benefit', 18))
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const page3 = sourceRef(3, 'Premium Bonus / Power-up Bonus', snippetNear(document, 3, 'Premium Bonus', 34))
  const page4 = sourceRef(4, 'Loyalty Bonus / Involuntary Unemployment Benefit', snippetNear(document, 4, 'Loyalty Bonus', 24))
  const page5 = sourceRef(5, 'Regular Premium Routing / Reduction', snippetNear(document, 5, '100% of the regular premium paid', 20))
  const page6 = sourceRef(6, 'Recurring Single Premium / Top-up Premium', snippetNear(document, 6, 'Recurring Single Premium', 26))
  const page7 = sourceRef(7, 'Non-payment / Partial Withdrawal', snippetNear(document, 7, 'Non-payment of Regular Premium', 30))
  const page8 = sourceRef(8, 'Regular Withdrawal / Full Surrender', snippetNear(document, 8, 'Regular Withdrawal', 24))
  const page9Distribution = sourceRef(9, 'Dividend Distribution', snippetNear(document, 9, 'Dividend Distribution', 24))
  const page10 = sourceRef(10, 'Policy Charge / MPC', snippetNear(document, 10, 'Policy Charge', 30))
  const page11 = sourceRef(11, 'Premium Shortfall Charge', snippetNear(document, 11, 'Premium Shortfall Charge', 24))
  const page16 = sourceRef(16, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 16, 'Monthly Rates for Monthly Protection Charges', 24))
  const page17 = sourceRef(17, 'Appendix A Charges', snippetNear(document, 17, 'SURRENDER CHARGE', 28))

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
      sourceRefs: [page6, page10],
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
      sourceRefs: [page6, page10],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0,
      rateSchedule: PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies only to partial withdrawals from the Accumulation Units Account during the minimum investment period.',
        'Partial withdrawals from the Accumulation Units Account are not allowed in the first two policy years.',
      ],
      sourceRefs: [page7, page11, page17],
    },
    {
      id: 'premium-shortfall-charge-non-payment',
      label: 'Premium Shortfall Charge (Non-payment)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when regular premium is not paid after the grace period during policy year 3.',
        'Deduct from Accumulation Units Account first, then Top-up Units Account.',
        'The involuntary unemployment benefit waiver remains metadata-only.',
      ],
      sourceRefs: [page4, page7, page11, page17],
    },
  ]

  const feeRules = buildFeeRules(document)
  if (deathBenefitOption === 'advanced-death') {
    feeRules.push(buildTokioMpcFeeRule(page1, page10, page16))
  }

  const isAdvancedDeath = deathBenefitOption === 'advanced-death'

  return {
    id: deathBenefitOption === 'basic-death' ? 'sgd-mip-12' : 'sgd-mip-12-advanced-death',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 1,
    accounts: [
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page5, page10],
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
        sourceRefs: [page6, page7],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: 3,
          accountIds: ['topup'],
        },
        {
          startPolicyYear: 4,
          endPolicyYear: null,
          accountIds: ['accumulation', 'topup'],
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
        'For the first three policy years, only dividends from the Top-up Units Account may be paid in cash.',
        'After the first three policy years, dividends from both the Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 annual dividend threshold remain reinvested in V1.',
        'Cash payout elections should be lodged at least 30 days before the dividend record date.',
      ],
      sourceRefs: [page9Distribution],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This supported template models the SGD / MIP 12 (${isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      'This supported template models regular-premium routing to the Accumulation Units Account, top-up routing, recurring single premium routing, a 2.45% account-value policy charge during the minimum investment period, a 0.60% account-value policy charge thereafter, the published surrender, partial-withdrawal, and premium-shortfall charge schedules, and the published phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      ...(isAdvancedDeath
        ? [
            'The Advanced Death variant also models the published current death-benefit estimate and Monthly Protection Charge during the minimum investment period after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Premium bonus, power-up bonus, and loyalty bonus are modeled at the published rate windows, but their paid-up and no-withdrawal eligibility gates remain manual review assumptions.',
      'Recurring single premium stays blocked after a premium-holiday event until regular premium resumes at the commencement-date amount.',
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? [
            'Advanced Death Benefit payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, eligible-rider fallback, involuntary unemployment waiver, credit-card charge, multiple-life last-life settlement, change-of-life-assured and life-replacement administration, regular withdrawal behavior, and minimum-account-value enforcement remain metadata-only for this product.',
          ]
        : [
            'Advanced Death Benefit selection, eligible-rider fallback, involuntary unemployment waiver, credit-card charge, multiple-life last-life settlement, change-of-life-assured and life-replacement administration, regular withdrawal behavior, and minimum-account-value enforcement remain metadata-only for this product.',
          ]),
    ],
    sourceRefs: [
      page1,
      page2,
      page3,
      page4,
      page5,
      page6,
      page7,
      page8,
      page9Distribution,
      page10,
      page11,
      ...(isAdvancedDeath ? [page16] : []),
      page17,
    ],
  }
}

export function parseTokioMarineWealthFlexiLink312(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-wealth-flexi-link-3-12',
    insurer: 'Tokio Marine',
    productName: 'Wealth Flexi-Link 3.12',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'tokio-regular-premium-routing-to-accumulation-account',
      'tokio-initial-bonus-tiered-premium-allocation',
      'tokio-premium-bonus',
      'tokio-power-up-bonus',
      'tokio-loyalty-bonus',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-account-surrender-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'branch:tokio-wealth-flexi-link-3-12-advanced-death-monthly-protection-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-wealth-flexi-link-3-12-involuntary-unemployment-waiver',
      'tokio-wealth-flexi-link-3-12-advanced-death-benefit-selection',
      'tokio-wealth-flexi-link-3-12-advanced-death-benefit-payout-handling',
      'tokio-wealth-flexi-link-3-12-eligible-rider-fallback',
      'tokio-wealth-flexi-link-3-12-regular-withdrawal-and-minimum-account-value-constraints',
      'tokio-wealth-flexi-link-3-12-credit-card-charge',
      'tokio-wealth-flexi-link-3-12-multiple-life-last-life-settlement',
      'tokio-wealth-flexi-link-3-12-change-of-life-assured-and-life-replacement-administration',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Flexi-Link 3.12 product summary text layer.',
      'Wealth Flexi-Link 3.12 is modeled as split SGD / MIP 12 death-benefit-option variants with a published 2.45% policy charge during the minimum investment period and a 0.60% policy charge thereafter.',
      'The Advanced Death variant also models the published current death-benefit estimate and Monthly Protection Charge during the minimum investment period after you enter the insured-life details and current net premium base.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface: only Top-up Units Account dividends may be paid in cash during the first three policy years, Accumulation Units Account dividends join after policy year 3, and the published SGD 50 minimum payout threshold plus 30-day record-date lead time are applied.',
      'Premium bonus, power-up bonus, and loyalty bonus retain the published paid-up and no-withdrawal eligibility gates as manual review assumptions.',
      'Recurring single premium stays blocked after a premium-holiday event until regular premium resumes at the commencement-date amount.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
    ],
  }
}
