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

const MIP_LENGTH = 10

const SURRENDER_CHARGE_TABLE = [
  1,
  1,
  1,
  0.99,
  0.99,
  0.96,
  0.93,
  0.89,
  0.8,
  0.1,
]

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.62 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.52 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
] as const

const PREMIUM_SHORTFALL_NON_PAYMENT_SCHEDULE = [
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.62 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.52 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0 },
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.14 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.27 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.31 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.33 },
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
      rate: 0.018,
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
      startPolicyYear: 11,
      endPolicyYear: 23,
      rate: 0.0155,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual bonus on the Accumulation Units Account value from policy year 11 to policy year 23.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus',
      type: 'power-up',
      label: 'Power-up Bonus',
      mode: 'annual-rate',
      appliesTo: ['initial'],
      startPolicyYear: 11,
      endPolicyYear: null,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual bonus on the Initial Units Account value from policy year 11 onward.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page10 = sourceRef(10, 'Initial Setup Charge / Policy Charge / Admin Charge / MPC', snippetNear(document, 10, 'Initial setup charge', 32))

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
          { startPolicyYear: 4, endPolicyYear: 10, mode: 'policy-year' },
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
          { startPolicyYear: 11, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
        ],
      },
      notes: [
        'Models the published post-MIP policy investment charge using the fixed 10-year multiplier.',
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
          { startPolicyYear: 1, endPolicyYear: 10, mode: 'fixed', multiplier: 1 },
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
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'via top-up premium or recurring single premium'))
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 16))
  const page3 = sourceRef(3, 'Performance Investment / Loyalty / Power-up Bonus', snippetNear(document, 3, 'Performance Investment Bonus', 20))
  const page4 = sourceRef(4, 'Regular Premium Routing', snippetNear(document, 4, 'Initial Units Account: Regular premium due during the first 36 months', 14))
  const page5 = sourceRef(5, 'Recurring Single Premium and Top-up Premium', snippetNear(document, 5, 'Recurring Single Premium', 18))
  const page9 = sourceRef(9, 'Dividend Distribution', snippetNear(document, 9, 'Dividend Distribution', 20))
  const page11 = sourceRef(11, 'Partial Withdrawal Charge and Premium Shortfall Charge', snippetNear(document, 11, 'Partial Withdrawal Charge', 28))
  const page12 = sourceRef(12, 'Premium Shortfall Charge and fee notes', snippetNear(document, 12, 'Premium Shortfall Charge', 26))
  const page17 = sourceRef(17, 'Appendix A Charges', snippetNear(document, 17, 'SURRENDER CHARGE', 24))
  const page10 = isAdvancedDeath
    ? sourceRef(10, 'Monthly Protection Charge / Charges', snippetNear(document, 10, 'Monthly Protection Charge', 28))
    : null
  const page14 = isAdvancedDeath
    ? sourceRef(14, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 14, 'Monthly Rates for Monthly Protection Charges', 24))
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
      sourceRefs: [page5, page11],
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
      sourceRefs: [page5, page11],
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
      ],
      sourceRefs: [page11, page17],
    },
    {
      id: 'premium-shortfall-charge-non-payment',
      label: 'Premium Shortfall Charge (Non-payment)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_NON_PAYMENT_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when regular premium is not paid after the grace period during policy years 4 to 10.',
        'Deduct from Accumulation Units Account first, then Top-up Units Account, then Initial Units Account.',
        'Use a premium-holiday event to represent the non-payment period after the grace period.',
      ],
      sourceRefs: [page11, page12, page17],
    },
    {
      id: 'premium-shortfall-charge-reduction',
      label: 'Premium Shortfall Charge (Regular Premium Reduction)',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_NON_PAYMENT_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when annualised regular premium is reduced below the commencement-date commitment during policy years 4 to 10.',
        'Uses the annual reduction amount as the charge base and deducts from Accumulation Units Account first, then Top-up Units Account, then Initial Units Account.',
        'Use a regular-premium-increase event to restore the commencement-date amount and stop this shortfall charge.',
      ],
      sourceRefs: [page4, page11, page12, page17],
    },
  ]

  const feeRules = buildFeeRules(document)
  if (isAdvancedDeath && page10 != null && page14 != null) {
    feeRules.push(buildTokioMpcFeeRule(page1, page10, page14, hasLifeBenefitRider))
  }
  const advancedSourceRefs = isAdvancedDeath && page10 != null && page14 != null
    ? [page10, page14]
    : []

  return {
    id: deathBenefitOption === 'basic-death'
      ? 'sgd-mip-10'
      : hasLifeBenefitRider
        ? 'sgd-mip-10-advanced-death-life-benefit-rider'
        : 'sgd-mip-10-advanced-death',
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
        sourceRefs: [page4],
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
        sourceRefs: [page4],
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
        sourceRefs: [page5],
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
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying funds default to reinvestment, while cash payout can be explored through the manual annual distribution-yield assumption.',
        'The published dividend election applies across the Initial Units Account, Accumulation Units Account, and Top-up Units Account.',
        'Cash payouts below the published SGD 50 annual dividend threshold remain reinvested in V1.',
        'Cash payout elections should be lodged at least 30 days before the dividend record date.',
      ],
      sourceRefs: [page9],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This supported template models the SGD / MIP 10 (${hasLifeBenefitRider ? 'Advanced Death with Life Benefit Rider' : isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.${hasLifeBenefitRider ? ' The Life Benefit Rider path is limited to the single-life corridor.' : ''}`,
      'This supported template models regular-premium routing through year 10, top-up routing, recurring single premium routing, the published initial setup charge, policy investment charge, admin charge, surrender charge on the Initial Units Account, and the published partial-withdrawal charge schedule.',
      'This supported template also models the published premium shortfall charge for non-payment periods and regular-premium reductions, including the higher-charge rule when both overlap.',
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'The Advanced Death with Life Benefit Rider variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, and the published sum-at-risk valuation across the Initial Units Account and Accumulation Units Account after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.'
              : 'The Advanced Death variant also models the published Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, and the published sum-at-risk valuation across the Initial Units Account and Accumulation Units Account after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Recurring single premium stays blocked after a premium-holiday event until you add an explicit recurring-single-premium-resumption event for the restart month.',
      'Initial bonus tiers are modeled using the published SGD annualised regular premium bands for this SGD variant.',
      'Harvest Pro keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    ],
    unsupportedItems: [
      ...(!isAdvancedDeath
        ? [
            'Advanced Death selection, Advanced Death with Life Benefit Rider selection, Monthly Protection Charge, multiple-life last-life settlement, and life replacement administration remain metadata-only for this product.',
          ]
        : hasLifeBenefitRider
          ? [
              'Advanced Death and Life Benefit Rider payout handling beyond the modeled Monthly Protection Charge, multiple-life last-life settlement, oldest/youngest-life rider-term and Monthly Protection Charge recalculation, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
            ]
          : [
              'Advanced Death payout handling beyond the modeled Monthly Protection Charge, Advanced Death with Life Benefit Rider selection, multiple-life last-life settlement, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
            ]),
    ],
    sourceRefs: [
      page1,
      page2,
      page3,
      page4,
      page5,
      page9,
      ...advancedSourceRefs,
      page11,
      page12,
      page17,
    ],
  }
}

export function parseTokioMarineHarvestPro(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-harvest-pro',
    insurer: 'Tokio Marine',
    productName: 'Harvest Pro',
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
      'branch:tokio-harvest-pro-advanced-death-monthly-protection-charge-accrual',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-harvest-pro-advanced-death-payout-handling',
      'tokio-harvest-pro-multiple-life-last-life-settlement',
      'tokio-harvest-pro-change-of-life-assured-and-life-replacement-administration',
    ],
    warnings: [
      'Structured extraction validated against the Harvest Pro product summary text layer.',
      'Harvest Pro is modeled as split SGD / MIP 10 death-benefit-option variants with the published initial setup charge, policy investment charge, and admin charge tied to the commencement-date premium commitment.',
      'The Basic Death variant leaves the published Monthly Protection Charge metadata-only, the Advanced Death variant models the published first-three-policy-years accrual and policy-year-4 catch-up timing after you enter the insured-life details and current net premium base, and the Advanced Death with Life Benefit Rider variant extends that same Monthly Protection Charge corridor through the policy anniversary immediately after age 99 for the single-life corridor.',
      'Recurring single premium is modeled as a scheduled stream routed into the Top-up Units Account net of the published 5% premium charge.',
      'Recurring single premium stays blocked after a premium-holiday event until you enter an explicit recurring-single-premium-resumption event for the administrative restart month.',
      'Regular premiums paid after the minimum investment period are modeled back into the Initial Units Account in line with the product summary.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface across the Initial, Accumulation, and Top-up Units Accounts, with payouts below SGD 50 remaining reinvested and cash-payout elections submitted at least 30 days before the record date.',
      'The Advanced Death and single-life Advanced Death with Life Benefit Rider variants both model the published first-three-policy-years Monthly Protection Charge accrual and policy-year-4 lump-sum catch-up before normal monthly-in-advance deductions resume.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
      buildVariant(context.document, 'advanced-death-life-benefit-rider'),
    ],
  }
}
