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
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 9_599.99, rate: 0.2 },
  { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.25 },
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
        'Tier is based on the published SGD annualised regular premium band for Wealth Builder@Future.',
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
      qualificationRules: [
        { formula: 'no-new-premium-arrears-in-lookback-months', lookbackMonths: 12 },
        { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
        { trigger: 'scheduled-payout', accountIds: ['accumulation', 'topup'], disqualifyInReferenceYear: true },
      ],
      notes: [
        'Annual premium bonus on the Accumulation Units Account value from the end of policy year 6 to the end of policy year 20.',
        'The bonus is credited only when all regular premiums due in the prior 12 months have been paid, no partial withdrawal from the Accumulation Units Account occurred in that same 12-month window, and no regular withdrawal is active in the bonus year.',
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
      qualificationRules: [
        { formula: 'no-new-premium-arrears-in-lookback-months', lookbackMonths: 12 },
        { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
        { trigger: 'scheduled-payout', accountIds: ['accumulation', 'topup'], disqualifyInReferenceYear: true },
      ],
      notes: [
        'Annual premium bonus on the Accumulation Units Account value from the end of policy year 21 onward.',
        'The bonus is credited only when all regular premiums due in the prior 12 months have been paid, no partial withdrawal from the Accumulation Units Account occurred in that same 12-month window, and no regular withdrawal is active in the bonus year.',
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
      qualificationRules: [
        { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
      ],
      notes: [
        'Annual power-up bonus on the Accumulation Units Account value at the end of the minimum investment period only.',
        'The bonus is credited only when no partial withdrawal from the Accumulation Units Account occurred in the prior 12 months.',
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
      qualificationRules: [
        { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
        { trigger: 'scheduled-payout', accountIds: ['accumulation', 'topup'], disqualifyInReferenceYear: true },
      ],
      notes: [
        'Annual loyalty bonus on the Accumulation Units Account value from the end of policy year 11 onward.',
        'The bonus is credited only when no partial withdrawal from the Accumulation Units Account occurred in the prior 12 months and no regular withdrawal is active in the bonus year.',
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
  withLifeBenefitRider = false,
): IlpTemplateFeeRule {
  return {
    id: 'monthly-protection-charge',
    label: 'Monthly Protection Charge',
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['accumulation'],
    fallbackAppliesTo: ['topup'],
    activeWindow: withLifeBenefitRider ? 'policy-term' : 'during-mip',
    assuranceConfig: {
      formula: 'tokio-mpc-net-premium-floor',
      rateTable: 'tokio-mpc-unzo-death',
      monthlyModalFactor: 1,
      maxAgeNextBirthday: 99,
    },
    requiresManualInput: true,
    notes: [
      withLifeBenefitRider
        ? 'Models the published Monthly Protection Charge for the Advanced Death with Life Benefit Rider corridor through the policy anniversary immediately after age 99.'
        : 'Models the published Monthly Protection Charge for the Advanced Death corridor during the 10-year minimum investment period.',
      'Sum at risk is the published net premium less 101% of the Accumulation Units Account value, floored at zero.',
      'The charge is deducted monthly in advance from the Accumulation Units Account, with outstanding amounts deducted from the Top-up Units Account if needed.',
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
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'Wealth Builder@Future', 18))
  const page2 = sourceRef(2, 'Initial Bonus / Premium Bonus', snippetNear(document, 2, 'Initial Bonus', 36))
  const page3 = sourceRef(3, 'Power-up Bonus / Loyalty Bonus', snippetNear(document, 3, 'Power-up Bonus', 30))
  const page4 = sourceRef(4, 'Regular Premium Routing / Reduction', snippetNear(document, 4, '100% of the regular premium paid', 24))
  const page5 = sourceRef(5, 'Recurring Single Premium / Top-up Premium', snippetNear(document, 5, 'Recurring Single Premium', 28))
  const page6 = sourceRef(6, 'Non-payment / Partial Withdrawal', snippetNear(document, 6, 'Non-payment of Regular Premium', 32))
  const page7 = sourceRef(7, 'Regular Withdrawal / Full Surrender', snippetNear(document, 7, 'Regular Withdrawal', 26))
  const page8 = sourceRef(8, 'Dividend Distribution', snippetNear(document, 8, 'Dividend Distribution', 24))
  const page9 = sourceRef(9, 'Policy Charge / MPC', snippetNear(document, 9, 'Policy Charge', 28))
  const page10 = sourceRef(10, 'Premium Shortfall Charge', snippetNear(document, 10, 'Premium Shortfall Charge', 24))
  const page14 = isAdvancedDeath
    ? sourceRef(14, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 14, 'Monthly Rates for Monthly Protection Charges', 24))
    : null
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
  if (isAdvancedDeath && page14) {
    feeRules.push(buildTokioMpcFeeRule(page1, page9, page14, hasLifeBenefitRider))
  }

  return {
    id: deathBenefitOption === 'basic-death'
      ? 'sgd-mip-10'
      : hasLifeBenefitRider
        ? 'sgd-mip-10-advanced-death-life-benefit-rider'
        : 'sgd-mip-10-advanced-death',
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
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 61,
      minimumRegularPremiumAmountByFrequency: {
        annual: 6_000,
        'semi-annual': 3_000,
        quarterly: 1_500,
        monthly: 500,
      },
      minimumPremiumHolidayStartPolicyMonth: 25,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
    },
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
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'accumulation',
      fallbackAccountIds: ['topup'],
      allowedFrequencies: ['annual', 'semi-annual', 'quarterly', 'monthly'],
      minimumStartPolicyYear: 11,
      minimumRemainingPolicyValue: 3_000,
      source: 'policy-redemption',
      notes: [
        'After the minimum investment period, regular withdrawals may be modeled through the manual scheduled-redemption assumption across the Accumulation Units Account with Top-up Units Account fallback.',
        'V1 enforces the published start gate after the minimum investment period and the published Minimum Account Value of S$3,000 on the annualized scheduled-redemption surface.',
        'Selected-fund minimum residual holdings, pending-transaction sequencing, and exact intra-year payout timing remain informational only.',
      ],
      sourceRefs: [page7],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This ${isAdvancedDeath ? 'supported' : 'partial'} template models the SGD / MIP 10 (${hasLifeBenefitRider ? 'Advanced Death with Life Benefit Rider' : isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      `This ${isAdvancedDeath ? 'supported' : 'partial'} template models regular-premium routing to the Accumulation Units Account, top-up routing, recurring single premium routing, the published premium-bonus windows, the end-of-MIP power-up bonus, the loyalty-bonus tail, the after-first-five-policy-years regular-premium variation start gate with the published SGD minimum regular-premium table, a 2.50% account-value policy charge during the minimum investment period, a 0.60% account-value policy charge thereafter, and the published surrender, partial-withdrawal, and premium-shortfall charge schedules.`,
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'The Advanced Death with Life Benefit Rider variant also models the published Monthly Protection Charge through the policy anniversary immediately after age 99 after you enter the insured-life details and current net premium base, with youngest-life rider age gating on the same static current multi-life surface.'
              : 'The Advanced Death variant also models the published Monthly Protection Charge during the minimum investment period after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Premium bonus, power-up bonus, and loyalty bonus also model the published 12-month premium-payment and partial-withdrawal eligibility gates, and Premium Bonus / Loyalty Bonus also model the published regular-withdrawal disqualification limb through the manual scheduled-redemption assumption surface after the minimum investment period.',
      'Minimum regular-premium increase / reduction amounts remain informational only because the summary leaves those insurer-defined.',
      'Recurring single premium events before policy month 13 or below the published monthly-equivalent minimum of S$50 are blocked; insurer-defined increase / reduction minimums remain informational only.',
      'Recurring single premium stays blocked after a premium-holiday event until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the commencement-date amount.',
      'Wealth Builder@Future keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'Advanced Death Benefit and Life Benefit Rider payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, and change-of-life-assured / life-replacement administration remain metadata-only for this product.'
              : 'Advanced Death Benefit payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider, credit-card charge, change-of-life-assured and life-replacement administration, selected-fund regular-withdrawal routing constraints, and rider premium-deduction handling remain metadata-only for this product.',
          ]
        : [
            'Advanced Death Benefit selection, Life Benefit Rider, monthly protection charge, credit-card charge, change-of-life-assured and life-replacement administration, selected-fund regular-withdrawal routing constraints, and rider premium-deduction handling remain metadata-only for this product.',
          ]),
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7, page8, page9, page10, ...(page14 ? [page14] : []), page15],
  }
}

export function parseTokioMarineWealthBuilderAtFuture(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-wealth-builder-atfuture',
    insurer: 'Tokio Marine',
    productName: 'Wealth Builder@Future',
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
      'kernel:bonus-lookback-qualification-window',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'kernel:minimum-premium-holiday-start-month',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'kernel:committed-premium-rsp-resumption-gate',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-account-surrender-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-start-gate',
      'kernel:scheduled-payout-minimum-remaining-policy-value',
      'branch:tokio-wealth-builder-atfuture-advanced-death-monthly-protection-charge',
      'branch:tokio-current-only-multi-life-life-state',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-wealth-builder-atfuture-advanced-death-benefit-payout-handling',
      'tokio-wealth-builder-atfuture-credit-card-charge',
      'tokio-wealth-builder-atfuture-change-of-life-assured-and-life-replacement-administration',
      'tokio-wealth-builder-atfuture-regular-withdrawal-routing-and-selected-fund-constraints',
      'tokio-wealth-builder-atfuture-rider-premium-deduction-handling',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Builder@Future product summary text layer.',
      'Wealth Builder@Future is modeled as split SGD / MIP 10 death-benefit-option corridors with the after-first-five-policy-years regular-premium variation start gate and the published SGD minimum regular-premium table, plus a published 2.50% policy charge during the minimum investment period and a 0.60% policy charge thereafter.',
      'Basic Death keeps Monthly Protection Charge metadata-only, while the Advanced Death variant models the published Monthly Protection Charge during the minimum investment period using the Accumulation Units Account sum-at-risk basis and Top-up Units Account fallback with static current multi-life last-life handling, and the Advanced Death with Life Benefit Rider variant extends that same Monthly Protection Charge corridor through the policy anniversary immediately after age 99 with youngest-life rider age gating on the same static current multi-life surface.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
      'Premium bonus, power-up bonus, and loyalty bonus also model the published 12-month premium-payment and partial-withdrawal eligibility gates.',
      'Minimum regular-premium increase / reduction amounts remain informational only because the summary leaves those insurer-defined.',
      'Recurring single premium stays blocked after a premium-holiday event until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the commencement-date amount.',
      'Manual regular-withdrawal support after the minimum investment period now enforces the published Minimum Account Value of S$3,000 on the annualized scheduled-redemption surface; selected-fund minimum holdings, pending-transaction sequencing, and exact intra-year payout timing remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
      buildVariant(context.document, 'advanced-death-life-benefit-rider'),
    ],
  }
}
