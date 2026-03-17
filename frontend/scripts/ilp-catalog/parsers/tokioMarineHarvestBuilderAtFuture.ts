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
  0.8,
  0.6,
  0.5,
  0.45,
  0.4,
  0.2,
  0.15,
  0.03,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.05 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 9_599.99, rate: 0.15 },
  { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.2 },
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

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Initial Bonus / Premium Bonus', snippetNear(document, 2, 'Initial Bonus', 36))
  const page3 = sourceRef(3, 'Power-up Bonus / Loyalty Bonus', snippetNear(document, 3, 'Power-up Bonus', 30))

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
        'Tier is based on the published SGD annualised regular premium band for Harvest Builder@Future.',
        'Allocated to the Accumulation Units Account in the first policy year.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'premium-bonus-policy-years-6-20',
      type: 'custom',
      label: 'Premium Bonus (Policy Years 6-20)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 6,
      endPolicyYear: 20,
      rate: 0.0008,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual premium bonus on the Accumulation Units Account value from the end of policy year 6 to the end of policy year 20.',
        'The source document conditions payment on all regular premiums due in the prior 12 months being paid and no withdrawals from the Accumulation Units Account in the prior 12 months; those gates remain manual review assumptions in this partial template.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'premium-bonus-after-policy-year-20',
      type: 'custom',
      label: 'Premium Bonus (After Policy Year 20)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 21,
      endPolicyYear: null,
      rate: 0.0015,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual premium bonus on the Accumulation Units Account value from the end of policy year 21 onward.',
        'The source document conditions payment on all regular premiums due in the prior 12 months being paid and no withdrawals from the Accumulation Units Account in the prior 12 months; those gates remain manual review assumptions in this partial template.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'power-up-bonus',
      type: 'power-up',
      label: 'Power-up Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 10,
      endPolicyYear: 10,
      rate: 0.013,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual power-up bonus on the Accumulation Units Account value at the end of the minimum investment period only.',
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
      startPolicyYear: 11,
      endPolicyYear: null,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      notes: [
        'Annual loyalty bonus on the Accumulation Units Account value from the end of policy year 11 onward.',
        'The source document conditions payment on no withdrawals from the Accumulation Units Account in the prior 12 months; that gate remains a manual review assumption in this partial template.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page9 = sourceRef(9, 'Policy Charge', snippetNear(document, 9, 'Policy Charge', 28))

  return [
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.025,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly policy charge during the minimum investment period as 2.50% p.a. of the Accumulation Units Account value.',
      ],
      sourceRefs: [page9],
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
        'Models the published monthly policy charge after the minimum investment period as 0.60% p.a. of the Accumulation Units Account value.',
      ],
      sourceRefs: [page9],
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
      'Models the published Monthly Protection Charge for the Advanced Death Benefit corridor during the 10-year minimum investment period only.',
      'Sum at risk is the published net premium less 101% of the Accumulation Units Account value, floored at zero.',
      'The charge is deducted monthly in advance from the Accumulation Units Account, with outstanding amounts deducted from the Top-up Units Account if needed.',
    ],
    sourceRefs: [optionPage, chargePage, tablePage],
  }
}

function buildVariant(
  document: ExtractedPdfDocument,
  deathBenefitOption: 'basic-death' | 'advanced-death',
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'Harvest Builder@Future', 18))
  const page2 = sourceRef(2, 'Initial Bonus / Premium Bonus', snippetNear(document, 2, 'Initial Bonus', 36))
  const page3 = sourceRef(3, 'Power-up Bonus / Loyalty Bonus', snippetNear(document, 3, 'Power-up Bonus', 30))
  const page4 = sourceRef(4, 'Regular Premium Routing / Reduction', snippetNear(document, 4, '100% of the regular premium paid', 24))
  const page5 = sourceRef(5, 'Recurring Single Premium / Top-up Premium', snippetNear(document, 5, 'Recurring Single Premium', 28))
  const page6 = sourceRef(6, 'Non-payment / Partial Withdrawal', snippetNear(document, 6, 'Non-payment of Regular Premium', 32))
  const page7 = sourceRef(7, 'Regular Withdrawal / Full Surrender', snippetNear(document, 7, 'Regular Withdrawal', 26))
  const page8 = sourceRef(8, 'Dividend Distribution', snippetNear(document, 8, 'Dividend Distribution', 24))
  const page9 = sourceRef(9, 'Policy Charge / MPC', snippetNear(document, 9, 'Policy Charge', 28))
  const page10 = sourceRef(10, 'Premium Shortfall Charge', snippetNear(document, 10, 'Premium Shortfall Charge', 24))
  const page14 = sourceRef(14, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 14, 'Monthly Rates for Monthly Protection Charges', 24))
  const page15 = sourceRef(15, 'Appendix A Charges', snippetNear(document, 15, 'SURRENDER CHARGE', 28))

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
      sourceRefs: [page5, page9],
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
      sourceRefs: [page5, page9],
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
      sourceRefs: [page6, page9, page15],
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
        'Models the published monthly premium shortfall charge when regular premium is not paid after the grace period during policy years 3 to 5.',
        'Deduct from Accumulation Units Account first, then Top-up Units Account.',
      ],
      sourceRefs: [page6, page10, page15],
    },
  ]

  const feeRules = buildFeeRules(document)
  if (deathBenefitOption === 'advanced-death') {
    feeRules.push(buildTokioMpcFeeRule(page1, page9, page14))
  }

  const isAdvancedDeath = deathBenefitOption === 'advanced-death'

  return {
    id: deathBenefitOption === 'basic-death' ? 'sgd-mip-10' : 'sgd-mip-10-advanced-death',
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
        sourceRefs: [page4, page9],
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
        sourceRefs: [page5, page6],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying funds default to reinvestment, while cash payout can be explored through the manual annual distribution-yield assumption.',
        'The published dividend election applies across the Accumulation Units Account and Top-up Units Account.',
        'Cash payouts below the published SGD 50 annual dividend threshold remain reinvested in V1.',
        'Cash payout elections should be lodged at least 30 days before the dividend record date.',
      ],
      sourceRefs: [page8],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This partial template models the SGD / MIP 10 (${isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      'This partial template models regular-premium routing to the Accumulation Units Account, top-up routing, recurring single premium routing, the published premium-bonus windows, the end-of-MIP power-up bonus, the loyalty-bonus tail, a 2.50% account-value policy charge during the minimum investment period, a 0.60% account-value policy charge thereafter, and the published surrender, partial-withdrawal, and premium-shortfall charge schedules.',
      ...(isAdvancedDeath
        ? [
            'The Advanced Death variant also models the published Monthly Protection Charge during the minimum investment period after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Premium bonus, power-up bonus, and loyalty bonus are modeled at the published rate windows, but their paid-up and no-withdrawal eligibility gates remain manual review assumptions.',
      'Recurring single premium stays blocked after a premium-holiday event until regular premium resumes at the commencement-date amount.',
      'Harvest Builder@Future keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? [
            'Advanced Death Benefit payout handling beyond the modeled Monthly Protection Charge, Life Benefit Rider, credit-card charge, life-replacement administration, regular withdrawal behavior, minimum-account-value enforcement, and rider premium-deduction handling remain metadata-only for this product.',
          ]
        : [
            'Advanced Death Benefit selection, Life Benefit Rider, credit-card charge, life-replacement administration, regular withdrawal behavior, minimum-account-value enforcement, and rider premium-deduction handling remain metadata-only for this product.',
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
      page9,
      page10,
      ...(isAdvancedDeath ? [page14] : []),
      page15,
    ],
  }
}

export function parseTokioMarineHarvestBuilderAtFuture(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-harvest-builder-atfuture',
    insurer: 'Tokio Marine',
    productName: 'Harvest Builder@Future',
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
      'branch:tokio-harvest-builder-atfuture-advanced-death-monthly-protection-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-harvest-builder-atfuture-benefit-payout-handling',
      'tokio-harvest-builder-atfuture-life-benefit-rider',
      'tokio-harvest-builder-atfuture-credit-card-charge',
      'tokio-harvest-builder-atfuture-life-replacement-option',
    ],
    warnings: [
      'Harvest Builder@Future is cataloged as a supported V1 product. The SGD / MIP 10 Basic Death and Advanced Death corridors model regular-premium routing to the Accumulation Units Account, top-up and recurring-single-premium routing and charges, the published premium-bonus / power-up-bonus / loyalty-bonus rate windows, policy-charge schedules, surrender / partial-withdrawal / premium-shortfall charge schedules, and reinvest-default distribution support with the published SGD 50 minimum payout threshold and 30-day record-date lead time; the Advanced Death variant also models the published Monthly Protection Charge corridor from insured-life inputs.',
      'Bonus paid-up and no-withdrawal eligibility gates, benefit payout handling beyond the modeled Monthly Protection Charge, Life Benefit Rider, credit-card charge, life-replacement administration, regular-withdrawal / minimum-account-value enforcement, rider premium-deduction handling, and premium-holiday resumption administration remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
    ],
  }
}
