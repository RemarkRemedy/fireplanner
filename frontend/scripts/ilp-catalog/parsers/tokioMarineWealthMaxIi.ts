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

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  1,
  0.99,
  0.99,
  0.98,
  0.96,
  0.95,
  0.9,
  0.89,
  0.88,
  0.83,
  0.8,
  0.75,
  0.08,
]

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.95 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.76 },
  { startPolicyYear: 6, endPolicyYear: 15, rate: 0.05 },
]

const PREMIUM_SHORTFALL_NON_PAYMENT_SCHEDULE = [
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.58 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.53 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.51 },
]

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.33 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.52 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.53 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.59 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.6 },
]

const INITIAL_CHARGE_RATE_SCHEDULE = Array.from({ length: MIP_LENGTH }, (_, index) => ({
  startPolicyYear: index + 1,
  endPolicyYear: index + 1,
  rate: 0.0105 * (index + 1),
}))

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
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 16))
  const page3 = sourceRef(3, 'Performance Investment / Loyalty / Power-up Bonus', snippetNear(document, 3, 'Performance Investment Bonus', 20))

  return [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: INITIAL_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Tier is based on the annualised regular premium band stated in the product summary.',
        'Allocated to the Initial Units Account in the first policy year.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'performance-investment-bonus',
      type: 'custom',
      label: 'Performance Investment Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: MIP_LENGTH,
      rate: 0.017,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual bonus on the Accumulation Units Account value from the end of policy year 4 until the end of the minimum investment period.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 16,
      endPolicyYear: 28,
      rate: 0.012,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual bonus on the Accumulation Units Account value from policy year 16 to policy year 28.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus',
      type: 'power-up',
      label: 'Power-up Bonus',
      mode: 'annual-rate',
      appliesTo: ['initial'],
      startPolicyYear: 16,
      endPolicyYear: null,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual bonus on the Initial Units Account value from policy year 16 onward.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page10 = sourceRef(10, 'Initial Setup Charge / Policy Charge / Admin Charge / MPC', snippetNear(document, 10, 'Initial Setup Charge', 32))

  return [
    {
      id: 'initial-charge',
      label: 'Initial Setup Charge',
      basis: 'account-value',
      rate: 0,
      rateSchedule: INITIAL_CHARGE_RATE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      appliesTo: ['initial'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly initial setup charge during the minimum investment period as 1.05% p.a. multiplied by the current policy year.',
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
      startPolicyYear: 4,
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 4, endPolicyYear: 15, mode: 'policy-year' },
        ],
      },
      notes: [
        'Models the published monthly policy investment charge from the 37th policy month through the minimum investment period using annualised regular premium committed at commencement date multiplied by the current policy year.',
        'Regular-premium reduction, non-payment, and withdrawals do not change the charge base once the policy is in force.',
      ],
      sourceRefs: [page10],
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
        useHigherOfCommencementAndPrevailing: true,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 16, endPolicyYear: null, mode: 'fixed', multiplier: 15 },
        ],
      },
      notes: [
        'Models the published post-MIP policy investment charge using the fixed 15-year multiplier.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'admin-charge',
      label: 'Admin Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.02,
      amount: 0,
      appliesTo: ['initial'],
      fallbackAppliesTo: ['topup', 'accumulation'],
      activeWindow: 'during-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: 15, mode: 'fixed', multiplier: 1 },
        ],
      },
      notes: [
        'Models the published monthly admin charge during the minimum investment period as 2.00% p.a. of the annualised regular premium committed at commencement date.',
      ],
      sourceRefs: [page10],
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
        endPolicyYear: 3,
        settlementPolicyYear: 4,
      },
    },
    requiresManualInput: true,
    notes: [
      withLifeBenefitRider
        ? 'Models the published Monthly Protection Charge for the single-life Advanced Death with Life Benefit Rider corridor through the policy anniversary immediately after age 99.'
        : 'Models the published Monthly Protection Charge for the Advanced Death corridor during the minimum investment period.',
      'The Monthly Protection Charge for policy years 1 to 3 is accrued and collected in one lump sum in policy year 4.',
      'From policy year 4 onward, the Monthly Protection Charge is deducted monthly in advance from the Accumulation Units Account, then the Top-up Units Account, then the Initial Units Account if needed.',
      'Sum at risk is the published net premium less 101% of the Initial Units Account value and 101% of the Accumulation Units Account value, floored at zero.',
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
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 16))
  const page3 = sourceRef(3, 'Performance Investment / Loyalty / Power-up Bonus', snippetNear(document, 3, 'Performance Investment Bonus', 20))
  const page5 = sourceRef(5, 'Regular Premium Routing', snippetNear(document, 5, 'Initial Units Account'))
  const page6 = sourceRef(6, 'Recurring Single Premium and Top-up Premium', snippetNear(document, 6, 'Recurring Single Premium'))
  const page9 = sourceRef(9, 'Dividend Distribution', snippetNear(document, 9, 'Dividend Distribution', 18))
  const page11 = sourceRef(11, 'Premium Charge', snippetNear(document, 11, 'Premium Charge for Recurring Single Premium and Top-up Premium'))
  const page12 = sourceRef(12, 'Premium Shortfall Charge', snippetNear(document, 12, 'Premium Shortfall Charge'))
  const page19 = sourceRef(19, 'Appendix A Charges', snippetNear(document, 19, 'SURRENDER CHARGE'))
  const page18 = isAdvancedDeath
    ? sourceRef(18, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 18, 'Monthly Rates for Monthly Protection Charges', 24))
    : null

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
        'A 5% premium charge is deducted before each top-up premium is allocated to the Top-up Units Account.',
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
      rate: 0,
      rateSchedule: PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies only to partial withdrawals from the Accumulation Units Account during the minimum investment period.',
      ],
      sourceRefs: [page11, page19],
    },
    {
      id: 'premium-shortfall-charge-non-payment',
      label: 'Premium Shortfall Charge (Non-payment)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_NON_PAYMENT_SCHEDULE,
      amount: 0,
      exclusiveGroup: 'tokio-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when regular premium is not paid after the grace period.',
        'Deduct from Accumulation Units Account first, then Top-up Units Account, then Initial Units Account.',
        'Use a premium-holiday event to represent the non-payment period after the grace period.',
      ],
      sourceRefs: [page12, page19],
    },
    {
      id: 'premium-shortfall-charge-reduction',
      label: 'Premium Shortfall Charge (Regular Premium Reduction)',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_NON_PAYMENT_SCHEDULE,
      amount: 0,
      exclusiveGroup: 'tokio-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when annualised regular premium is reduced below the commencement-date commitment.',
        'Uses the annual reduction amount as the charge base and deducts from Accumulation Units Account first, then Top-up Units Account, then Initial Units Account.',
        'Use a regular-premium-increase event to restore the commencement-date amount and stop this shortfall charge.',
      ],
      sourceRefs: [page12, page19],
    },
  ]

  const feeRules = buildFeeRules(document)
  if (isAdvancedDeath && page18 != null) {
    feeRules.push(buildTokioMpcFeeRule(page2, page11, page18, hasLifeBenefitRider))
  }
  const advancedSourceRefs = isAdvancedDeath && page18 != null
    ? [page18]
    : []

  return {
    id: deathBenefitOption === 'basic-death'
      ? 'sgd-mip-15'
      : hasLifeBenefitRider
        ? 'sgd-mip-15-advanced-death-life-benefit-rider'
        : 'sgd-mip-15-advanced-death',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 36,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page5],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page5],
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
        sourceRefs: [page6],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
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
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment unless the policyholder elects cash payout.',
        'During the 15-year minimum investment period, only dividends from the Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'After the minimum investment period, dividends from the Initial Units Account, Accumulation Units Account, and Top-up Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 annual dividend threshold remain reinvested in V1.',
        'Cash payout elections should be lodged at least 30 days before the dividend record date.',
      ],
      sourceRefs: [page9],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This supported template models the SGD / MIP 15 (${hasLifeBenefitRider ? 'Advanced Death with Life Benefit Rider' : isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.${hasLifeBenefitRider ? ' The Life Benefit Rider path is limited to the single-life corridor.' : ''}`,
      'This supported template models regular-premium routing through year 15, top-up routing, recurring single premium routing, the published initial setup charge, policy investment charge, admin charge, surrender charge on the Initial Units Account, and the published partial-withdrawal charge schedule.',
      'This supported template also models the published premium shortfall charge for non-payment periods and regular-premium reductions, including the higher-charge rule when both overlap.',
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'The Advanced Death with Life Benefit Rider variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, and the published sum-at-risk valuation across the Initial Units Account and Accumulation Units Account after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.'
              : 'The Advanced Death variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, and the published sum-at-risk valuation across the Initial Units Account and Accumulation Units Account after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Recurring single premium remains blocked after a premium-holiday event until you add an explicit recurring-single-premium-resumption event for the restart month.',
      'Initial bonus tiers are modeled using the published SGD annualised regular premium bands for this SGD variant.',
      'Regular premiums paid after the minimum investment period route back to the Initial Units Account in line with the product summary.',
      'The phase-specific dividend cash-payout account restrictions are modeled through the manual distribution-mode assumption surface, together with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    ],
    unsupportedItems: [
      ...(!isAdvancedDeath
        ? [
            'Advanced Death selection, Advanced Death with Life Benefit Rider selection, Monthly Protection Charge, multiple-life last-life settlement, and life replacement administration remain metadata-only for this product.',
          ]
        : hasLifeBenefitRider
          ? [
              'Advanced Death and Life Benefit Rider payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, multiple-life last-life settlement, oldest/youngest-life rider-term and Monthly Protection Charge recalculation, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
            ]
          : [
              'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Advanced Death with Life Benefit Rider selection, multiple-life last-life settlement, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
            ]),
      'The published regular withdrawal facility remains informational only in V1.',
    ],
    sourceRefs: [page2, page3, page5, page6, page9, page11, page12, ...advancedSourceRefs, page19],
  }
}

export function parseTokioMarineWealthMaxIi(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-wealth-max-ii',
    insurer: 'Tokio Marine',
    productName: 'Wealth Max (II)',
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
      'tokio-performance-investment-bonus',
      'tokio-loyalty-bonus',
      'tokio-power-up-bonus',
      'tokio-top-up-routing',
      'tokio-post-mip-regular-premium-routing-back-to-initial-account',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-admin-charge-on-initial-account',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-initial-account-surrender-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
      'branch:tokio-wealth-max-ii-advanced-death-monthly-protection-charge-accrual',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-wealth-max-ii-advanced-death-payout-handling',
      'tokio-wealth-max-ii-multiple-life-last-life-settlement',
      'tokio-wealth-max-ii-change-of-life-assured-and-life-replacement-administration',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Max (II) product summary text layer.',
      'Wealth Max (II) is modeled with the published initial setup charge, policy investment charge, and admin charge tied to the commencement-date premium commitment.',
      'Basic Death keeps Monthly Protection Charge metadata-only, the Advanced Death variant models the published first-three-policy-years accrual window and policy-year-4 lump-sum settlement after you enter the insured-life details and current net premium base, and the Advanced Death with Life Benefit Rider variant extends that same Monthly Protection Charge corridor through the policy anniversary immediately after age 99 for the single-life corridor.',
      'Recurring single premium is modeled as a scheduled stream routed into the Top-up Units Account net of the published 5% premium charge.',
      'When a regular-premium reduction overlaps a recurring single premium, the modeled cashflow reduces the recurring single premium first before reducing regular premium contributions.',
      'Recurring single premium stays blocked after a premium-holiday event until you enter an explicit recurring-single-premium-resumption event for the administrative restart month.',
      'Regular premiums paid after the minimum investment period are modeled back into the Initial Units Account in line with the product summary.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface: only Accumulation Units Account and Top-up Units Account dividends may be paid in cash during the minimum investment period, Initial Units Account dividends join after the minimum investment period, payouts below SGD 50 remain reinvested, and cash-payout elections should be made at least 30 days before the record date.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
      buildVariant(context.document, 'advanced-death-life-benefit-rider'),
    ],
  }
}
