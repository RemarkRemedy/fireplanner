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
  0.92,
  0.83,
  0.58,
  0.57,
  0.49,
  0.3,
  0.12,
  0.03,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
  { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.16 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 39_999.99, rate: 0.36 },
  { currency: 'SGD', minAnnualPremium: 40_000, maxAnnualPremium: null, rate: 0.38 },
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
  const page2 = sourceRef(2, 'Initial Bonus / Premium Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const page3 = sourceRef(3, 'Power-up Bonus', snippetNear(document, 3, 'Power-up Bonus', 24))

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
        'Tier is based on the published SGD annualised regular premium band for Wealth Flexi-Link 5.10.',
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
      startPolicyYear: 6,
      endPolicyYear: 10,
      rate: 0.002,
      amount: null,
      tieredRates: [],
      qualificationRules: [
        { formula: 'no-new-premium-arrears-in-lookback-months', lookbackMonths: 12 },
        { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
      ],
      notes: [
        'Annual premium bonus on Total Investment Value from the end of policy year 6 until the end of the minimum investment period.',
        'The bonus is credited only when all regular premiums due in the prior 12 months have been paid and no partial withdrawal from the Accumulation Units Account occurred in that same 12-month window.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'power-up-bonus-policy-year-8',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 8)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 8,
      endPolicyYear: 8,
      rate: 0.001,
      amount: null,
      tieredRates: [],
      qualificationRules: [
        { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
      ],
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 8.',
        'The bonus is credited only when no partial withdrawal from the Accumulation Units Account occurred in the prior 12 months.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'power-up-bonus-policy-year-9',
      type: 'power-up',
      label: 'Power-up Bonus (Policy Year 9)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 9,
      endPolicyYear: 9,
      rate: 0.002,
      amount: null,
      tieredRates: [],
      qualificationRules: [
        { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
      ],
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 9.',
        'The bonus is credited only when no partial withdrawal from the Accumulation Units Account occurred in the prior 12 months.',
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
      rate: 0.005,
      amount: null,
      tieredRates: [],
      qualificationRules: [
        { trigger: 'partial-withdrawal', accountIds: ['accumulation'], disqualifyIfAnyInLookbackMonths: 12 },
      ],
      notes: [
        'Annual power-up bonus on Total Investment Value at the end of policy year 10.',
        'The bonus is credited only when no partial withdrawal from the Accumulation Units Account occurred in the prior 12 months.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page9 = sourceRef(9, 'Policy Charge', snippetNear(document, 9, 'Policy Charge', 22))

  return [
    {
      id: 'policy-charge',
      label: 'Policy Charge',
      basis: 'account-value',
      rate: 0.025,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly policy charge during the minimum investment period as 2.50% p.a. of Total Investment Value.',
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
  const page2 = sourceRef(2, 'Initial Bonus / Premium Bonus', snippetNear(document, 2, 'Initial Bonus', 24))
  const page3 = sourceRef(3, 'Power-up Bonus / Involuntary Unemployment Benefit', snippetNear(document, 3, 'Power-up Bonus', 24))
  const page4 = sourceRef(4, 'Regular Premium Routing', snippetNear(document, 4, '100% of the regular premium paid', 18))
  const page5 = sourceRef(5, 'Recurring Single Premium and Top-up Premium', snippetNear(document, 5, 'Recurring Single Premium', 22))
  const page6 = sourceRef(6, 'Non-payment of Regular Premium', snippetNear(document, 6, 'Non-payment of Regular Premium', 24))
  const page7 = sourceRef(7, 'Partial Withdrawal', snippetNear(document, 7, 'Partial Withdrawal', 28))
  const page9Distribution = sourceRef(9, 'Dividend Distribution', snippetNear(document, 9, 'Dividend Distribution', 24))
  const page9 = sourceRef(9, 'Policy Charge / MPC', snippetNear(document, 9, 'Policy Charge', 30))
  const page10 = sourceRef(10, 'Premium Charge / Surrender Charge / Partial Withdrawal Charge / Premium Shortfall Charge', snippetNear(document, 10, 'Premium Charge for Recurring Single Premium and Top-up Premium', 30))
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
      sourceRefs: [page5, page10],
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
      sourceRefs: [page5, page10],
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
      sourceRefs: [page7, page10, page17],
    },
    {
      id: 'premium-shortfall-charge-non-payment',
      label: 'Premium Shortfall Charge (Non-payment)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup'],
      manualWaiverGrantGroup: 'tokio-wealth-flexi-link-5-10-manual-shortfall-waiver',
      manualWaiverMaxGrantCount: 3,
      manualWaiverMaxOverlapMonths: 6,
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when regular premium is not paid after the grace period during policy years 3 to 5.',
        'Deduct from Accumulation Units Account first, then Top-up Units Account.',
        'When Tokio approves the involuntary unemployment benefit, mark the qualifying premium-holiday event chargeWaived.',
        'The modeled waiver corridor honors the published up-to-6-month premium-shortfall-charge waiver and the shared three-grants-per-lifetime limit when related approved events reuse the same chargeWaiverGrantId.',
      ],
      sourceRefs: [page3, page6, page10, page17],
    },
  ]

  const feeRules = buildFeeRules(document)
  if (deathBenefitOption === 'advanced-death') {
    feeRules.push(buildTokioMpcFeeRule(page1, page9, page16))
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
        sourceRefs: [page5, page7],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPremiumHolidayStartPolicyMonth: 25,
      minimumRegularPremiumVariationStartPolicyMonth: 61,
      minimumRegularPremiumAmountByFrequency: {
        annual: 6_000,
        'semi-annual': 3_000,
        quarterly: 1_500,
        monthly: 500,
      },
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['accumulation', 'topup'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: 5,
          accountIds: ['topup'],
        },
        {
          startPolicyYear: 6,
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
        'For the first five policy years, only dividends from the Top-up Units Account may be paid in cash.',
        'After the first five policy years, dividends from both the Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 annual dividend threshold remain reinvested in V1.',
        'Cash payout elections should be lodged at least 30 days before the dividend record date.',
      ],
      sourceRefs: [page9Distribution],
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
      `This supported template models the SGD / MIP 10 (${isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      'This supported template models regular-premium routing to the Accumulation Units Account, top-up routing, recurring single premium routing, the after-first-five-policy-years regular-premium variation start gate with the published SGD minimum regular-premium table, a 2.50% account-value policy charge during the minimum investment period, no policy charges after the minimum investment period, the published surrender, partial-withdrawal, and premium-shortfall charge schedules, and the published phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface. Minimum regular-premium increase / reduction amounts remain informational only because the summary leaves those insurer-defined.',
      ...(isAdvancedDeath
        ? [
            'The Advanced Death variant also models the published current death-benefit estimate and Monthly Protection Charge during the minimum investment period after you enter the insured-life details and current net premium base with static current multi-life last-life handling.',
          ]
        : []),
      'The resident-corridor current accidental-death estimate during the first policy year is also modeled as the higher of 105% of current Accumulation Units Account value or 105% of net premiums less current amount owing.',
      'Premium bonus and power-up bonus also model the published 12-month premium-payment and partial-withdrawal eligibility gates.',
      'Regular withdrawals after the minimum investment period are modeled through the manual scheduled-redemption assumption surface, and that annualized surface now enforces the published Minimum Account Value of S$3,000 while selected-fund minimum holdings, pending-transaction sequencing, and exact intra-year payout timing remain informational only.',
      'Recurring single premium events before policy month 13 or below the published monthly-equivalent minimum of S$50 are blocked; insurer-defined increase / reduction minimums remain informational only.',
      'Recurring single premium stays blocked after a premium-holiday event until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the commencement-date amount. Use the charge waiver toggle on qualifying premium-holiday events only after Tokio has approved the involuntary unemployment benefit; the engine now honors the published up-to-6-month premium-shortfall-charge waiver cap and the shared three-grants-per-lifetime limit when related approved events reuse the same chargeWaiverGrantId, while the published 90-day application timing, proof, first-assured coverage, and Tokio variation of benefit grant counts remain informational only.',
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? [
            'Advanced Death Benefit payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, eligible-rider fallback, credit-card charge, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
          ]
        : [
            'Advanced Death Benefit selection, eligible-rider fallback, credit-card charge, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
          ]),
      'The resident-corridor current accidental-death estimate during the first policy year is modeled on current Accumulation Units Account value and explicit Accumulation Units Account withdrawal history only; eligible-rider value, residency / Singapore-location claim gates, the 180-day timing rule, accidental-death last-life settlement, and ambiguous prior partial-withdrawal account attribution remain metadata-only for this product.',
    ],
    sourceRefs: [
      page1,
      page2,
      page3,
      page4,
      page5,
      page6,
      page7,
      page9Distribution,
      page9,
      page10,
      ...(isAdvancedDeath ? [page16] : []),
      page17,
    ],
  }
}

export function parseTokioMarineWealthFlexiLink510(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-wealth-flexi-link-5-10',
    insurer: 'Tokio Marine',
    productName: 'Wealth Flexi-Link 5.10',
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
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'kernel:minimum-premium-holiday-start-month',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'kernel:committed-premium-rsp-resumption-gate',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-start-gate',
      'kernel:scheduled-payout-minimum-remaining-policy-value',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-accumulation-account-surrender-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-non-payment',
      'tokio-explicit-charge-waiver-for-shortfall-events',
      'kernel:manual-charge-waiver-grant-limits',
      'branch:tokio-wealth-flexi-link-5-10-advanced-death-monthly-protection-charge',
      'branch:tokio-current-only-multi-life-life-state',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:bonus-lookback-qualification-window',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'tokio-wealth-flexi-link-5-10-involuntary-unemployment-benefit-administration',
      'tokio-wealth-flexi-link-5-10-advanced-death-benefit-selection',
      'tokio-wealth-flexi-link-5-10-advanced-death-benefit-payout-handling',
      'tokio-wealth-flexi-link-5-10-accidental-death-claim-gates-and-eligible-rider-value',
      'tokio-wealth-flexi-link-5-10-eligible-rider-fallback',
      'tokio-wealth-flexi-link-5-10-credit-card-charge',
      'tokio-wealth-flexi-link-5-10-change-of-life-assured-and-life-replacement-administration',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Flexi-Link 5.10 product summary text layer.',
      'Wealth Flexi-Link 5.10 is modeled as split SGD / MIP 10 death-benefit-option variants with the published after-first-five-policy-years regular-premium variation start gate and the published SGD minimum regular-premium table, a 2.50% policy charge during the minimum investment period, and no policy charges after the minimum investment period.',
      'The resident-corridor current accidental-death estimate during the first policy year is also modeled as the higher of 105% of current Accumulation Units Account value or 105% of net premiums less current amount owing; eligible-rider value, residency / Singapore-location claim gates, the 180-day timing rule, accidental-death last-life settlement, and ambiguous prior partial-withdrawal account attribution remain informational only.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface: only Top-up Units Account dividends may be paid in cash during the first five policy years, Accumulation Units Account dividends join after policy year 5, and the published SGD 50 minimum payout threshold plus 30-day record-date lead time are applied.',
      'Premium bonus and power-up bonus also model the published 12-month premium-payment and partial-withdrawal eligibility gates.',
      'The regular-withdrawal disqualification limb for Premium Bonus remains informational in V1 because no executable post-MIP scheduled withdrawal surface is available.',
      'Recurring single premium stays blocked after a premium-holiday event until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the commencement-date amount.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
    ],
  }
}
