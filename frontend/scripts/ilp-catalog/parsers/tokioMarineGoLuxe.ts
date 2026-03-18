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
  1,
  0.95,
  0.76,
  0.76,
  0.76,
  0.73,
  0.73,
  0.73,
  0.7,
  0.6,
  0.45,
  0.25,
  0.07,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.95 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.76 },
  { startPolicyYear: 6, endPolicyYear: 15, rate: 0.08 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.5 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.45 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.4 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.35 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.15 },
  { startPolicyYear: 11, endPolicyYear: 15, rate: 0 },
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.045 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.06 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.085 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.11 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.125 },
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
  const page1 = sourceRef(1, 'Initial Bonus', snippetNear(document, 1, 'Initial Bonus', 18))
  const page2 = sourceRef(2, 'Initial Bonus Rates', snippetNear(document, 2, 'Initial bonus rates on a per annum basis', 20))
  const loyaltyPage = sourceRef(2, 'Loyalty Bonus / Achievement Bonus', snippetNear(document, 2, 'Loyalty Bonus', 28))

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
      tieredRates: INITIAL_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Tier is based on the published SGD annualised regular premium band for the 15-year minimum contribution period.',
        'Allocated to the Initial Units Account upon each regular premium received in the first three policy years.',
      ],
      sourceRefs: [page1, page2],
    },
    {
      id: 'loyalty-bonus-policy-years-4-10',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Years 4-10)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: 10,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 4 to the end of policy year 10.',
        'During the first 10 policy years, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [loyaltyPage],
    },
    {
      id: 'loyalty-bonus-policy-years-11-15',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Years 11-15)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: 15,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from policy year 11 to the end of the minimum contribution period without the adjustment-factor multiplier.',
      ],
      sourceRefs: [loyaltyPage],
    },
    {
      id: 'loyalty-bonus-after-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (After Minimum Contribution Period)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 16,
      endPolicyYear: null,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value after the minimum contribution period.',
      ],
      sourceRefs: [loyaltyPage],
    },
  ]
}

function buildTokioMpcFeeRule(
  optionPage: IlpCatalogSourceRef,
  chargePage: IlpCatalogSourceRef,
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
    activeWindow: 'during-mip',
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
      'Models the published Monthly Protection Charge for the Advanced Death corridor during the 15-year minimum contribution period.',
      'The Monthly Protection Charge for policy years 1 to 3 is accrued and collected in one lump sum in policy year 4.',
      'Sum at risk is the published net premium less 101% of the Initial Units Account value and 101% of the Accumulation Units Account value, floored at zero.',
      'The charge is deducted monthly in advance from the Accumulation Units Account, with outstanding amounts deducted from the Initial Units Account and/or Top-up Units Account if needed.',
    ],
    sourceRefs: [optionPage, chargePage],
  }
}

function buildVariant(
  document: ExtractedPdfDocument,
  deathBenefitOption: 'basic-death' | 'advanced-death',
): IlpTemplateVariant {
  const isAdvancedDeath = deathBenefitOption === 'advanced-death'
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, '#goLuxe', 18))
  const page2 = sourceRef(2, 'Initial Bonus / Loyalty Bonus / Achievement Bonus', snippetNear(document, 2, 'Loyalty Bonus', 22))
  const page4 = sourceRef(4, 'Regular Premium / Reduction / Recurring Single Premium', snippetNear(document, 4, 'Regular premium due during the first 36 months', 24))
  const page5 = sourceRef(5, 'Top-up Premium / Premium Holiday', snippetNear(document, 5, 'Premium Holiday', 18))
  const page6 = sourceRef(6, 'Partial Withdrawal', snippetNear(document, 6, 'Partial Withdrawal', 24))
  const page8 = sourceRef(8, 'Dividend Distribution', snippetNear(document, 8, 'Dividend Distribution', 24))
  const page9 = sourceRef(9, 'Initial Charge / Policy Charge / Monthly Protection Charge', snippetNear(document, 9, 'Initial Charge', 28))
  const page10 = sourceRef(10, 'Top-up Charge / Surrender / Partial Withdrawal / Premium Shortfall', snippetNear(document, 10, 'Premium Charge for Top-up Premium and/or Recurring Single Premium', 30))
  const page15 = sourceRef(15, 'Appendix A Charges', snippetNear(document, 15, 'Surrender Charge', 22))
  const page16 = sourceRef(16, 'Appendix A Premium Shortfall Charge', snippetNear(document, 16, 'Premium Shortfall Charge', 22))

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
      sourceRefs: [page4, page10],
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
        'Applies only to partial withdrawals from the Accumulation Units Account during the minimum contribution period.',
      ],
      sourceRefs: [page6, page10, page15],
    },
    {
      id: 'premium-shortfall-charge-premium-holiday',
      label: 'Premium Shortfall Charge (Premium Holiday)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when the policy is on premium holiday during the first ten policy years.',
        'Deduct from Accumulation Units Account first, then Initial Units Account and/or Top-up Units Account.',
      ],
      sourceRefs: [page5, page10, page16],
    },
    {
      id: 'premium-shortfall-charge-reduction',
      label: 'Premium Shortfall Charge (Regular Premium Reduction)',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when annualised regular premium is reduced below the commencement-date commitment during the first ten policy years.',
        'Uses the annual reduction amount as the charge base and deducts from Accumulation Units Account first, then Initial Units Account and/or Top-up Units Account.',
      ],
      sourceRefs: [page4, page10, page16],
    },
  ]

  const feeRules = isAdvancedDeath ? [buildTokioMpcFeeRule(page1, page9)] : []

  return {
    id: isAdvancedDeath ? 'sgd-mip-15-advanced-death' : 'sgd-mip-15',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 36,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: 0.03,
        postMipFeeRate: 0,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page4, page9],
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
        ],
        sourceRefs: [page1, page4, page9],
      },
      {
        id: 'topup',
        label: 'Top-up Units Account',
        feeRate: 0,
        postMipFeeRate: 0,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page1, page4, page5],
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
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      recordDateInstructionLeadDays: 30,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment unless the policyholder elects cash payout.',
        'During the 15-year minimum contribution period, only dividends from the Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'After the minimum contribution period, dividends from the Initial Units Account, Accumulation Units Account, and Top-up Units Account may be paid in cash.',
        'Cash payouts below the published $50 minimum dividend amount are reinvested, and distribution-option instruction changes require at least 30 days before the Record Date.',
      ],
      sourceRefs: [page8],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This partial template models the SGD / minimum-contribution-period-15 (${isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      'This partial template models regular-premium routing through year 15, the published initial charge and policy charge through account fee rates, top-up routing, recurring single premium routing, the published surrender charge on the Initial Units Account, the published partial-withdrawal and premium-shortfall charge schedules, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      ...(isAdvancedDeath
        ? [
            'The Advanced Death variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-three-policy-years accrual window, policy-year-4 lump-sum settlement, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Recurring single premium stays blocked during premium holiday until regular premium resumes at the committed commencement-date amount.',
    ],
    unsupportedItems: [
      'Achievement bonus remains metadata-only because the published first-ten-policy-years qualification gates and annualised-premium payout basis are not yet represented directly in the template bonus basis.',
      ...(isAdvancedDeath
        ? [
            'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, multiple-life last-life settlement, and change-of-life-assured administration remain metadata-only for this product.',
          ]
        : [
            'Advanced Death selection, Monthly Protection Charge, multiple-life last-life settlement, and change-of-life-assured administration remain metadata-only for this product.',
          ]),
      'Regular withdrawal, partial-withdrawal limit caps, and non-SGD policy currencies remain metadata-only for this product.',
    ],
    sourceRefs: [page1, page2, page4, page5, page6, page8, page9, page10, page15, page16],
  }
}

export function parseTokioMarineGoLuxe(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goluxe',
    insurer: 'Tokio Marine',
    productName: '#goLuxe',
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
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-initial-charge-on-initial-account',
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-initial-account-surrender-charge',
      'tokio-accumulation-partial-withdrawal-charge',
      'tokio-premium-shortfall-charge-premium-holiday',
      'tokio-premium-shortfall-charge-regular-premium-reduction',
      'tokio-premium-increase-restores-shortfall-charge-cessation',
      'tokio-overlapping-non-payment-and-reduction-shortfall-uses-higher-charge-only',
      'branch:tokio-loyalty-bonus-adjustment-factor',
      'branch:tokio-goluxe-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'tokio-goluxe-achievement-bonus-qualification',
      'tokio-goluxe-advanced-death-payout-handling',
      'tokio-goluxe-multiple-life-last-life-settlement',
      'tokio-goluxe-change-of-life-assured-administration',
      'tokio-goluxe-regular-withdrawal-facility',
      'tokio-goluxe-non-sgd-policy-currencies',
    ],
    warnings: [
      '#goLuxe is cataloged as a supported V1 product. The SGD / 15-year minimum-contribution corridors model regular-premium routing, initial bonus allocation, annual loyalty bonus with the published bounded adjustment-factor formula in policy years 4 to 10 and the flat post-window rates thereafter, initial and policy charges, top-up and recurring-single-premium routing / charges, partial-withdrawal and premium-shortfall charges, surrender mechanics, and reinvest-default distribution support with the published $50 minimum cash-payout threshold and 30-day record-date lead time; the Advanced Death variant also models the published current death-benefit estimate and accrued Monthly Protection Charge corridor from insured-life inputs.',
      'Achievement bonus qualification, advanced-death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, multiple-life last-life settlement, change-of-life-assured administration, regular-withdrawal rules, and non-SGD policy currencies remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
    ],
  }
}
