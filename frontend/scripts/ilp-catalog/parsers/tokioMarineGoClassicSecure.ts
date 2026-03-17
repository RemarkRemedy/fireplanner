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

const MIP_LENGTH = 25

const SURRENDER_CHARGE_TABLE = [
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

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.15 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.25 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.42 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.44 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.47 },
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
        'Tier is based on the published SGD annualised regular premium band for the 25-year premium payment term.',
        'Allocated to the Initial Units Account upon each regular premium received in the first three policy years.',
      ],
      sourceRefs: [page1, page2],
    },
  ]
}

function buildTokioSecureMpcFeeRule(
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
    assuranceValueAppliesTo: ['initial', 'accumulation'],
    activeWindow: 'during-mip',
    requiresManualInput: true,
    assuranceConfig: {
      formula: 'tokio-mpc-locked-in-policy-value',
      rateTable: 'tokio-mpc-unzo-death',
      monthlyModalFactor: 1,
      maxAgeNextBirthday: 99,
      accrual: {
        startPolicyYear: 1,
        endPolicyYear: 2,
        settlementPolicyYear: 3,
      },
      disableFutureChargesOnInsufficientDeduction: true,
      tokioProtectionState: {
        mode: 'locked-in-policy-value',
        trackedValueAccountIds: ['initial', 'accumulation'],
        withdrawalReductionAccountIds: ['initial', 'accumulation'],
      },
    },
    notes: [
      'Models the published Monthly Protection Charge for the Advanced Death corridor during the premium payment term.',
      'The sum at risk is the published death benefit less policy value, where the protected floor is the carried Locked-in Policy Value and the valuation basis is total policy value.',
      'The first two policy years of MPC accrue and are deducted in one lump sum in policy year 3.',
      'If the Accumulation Units Account cannot fully fund MPC due, future new MPC stops permanently while the unpaid balance remains collectible as indebtedness.',
      'The engine uses an annual approximation of the published monthiversary locked-in-value ratchet and withdrawal reduction mechanics.',
    ],
    sourceRefs: [optionPage, chargePage, tablePage],
  }
}

function buildVariant(
  document: ExtractedPdfDocument,
  deathBenefitOption: 'basic-death' | 'advanced-death',
): IlpTemplateVariant {
  const isAdvancedDeath = deathBenefitOption === 'advanced-death'
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, '#goClassic Secure', 18))
  const page2 = sourceRef(2, 'Initial Bonus / Loyalty Bonus / Additional Bonus', snippetNear(document, 2, 'Loyalty Bonus', 22))
  const page4 = sourceRef(4, 'Regular Premium Routing', snippetNear(document, 4, 'Regular premium due during the first 24 months', 20))
  const page5 = sourceRef(5, 'Recurring Single Premium / Top-up Premium / Premium Holiday', snippetNear(document, 5, 'Recurring Single Premium', 22))
  const page9Distribution = sourceRef(9, 'Dividend Distribution', snippetNear(document, 9, 'Dividend Distribution', 28))
  const page10Charges = sourceRef(10, 'Initial Charge / Policy Charge / MPC', snippetNear(document, 10, 'Initial Charge', 28))
  const page10 = sourceRef(10, 'Premium Charge / Surrender Charge', snippetNear(document, 10, 'Premium Charge for Recurring Single Premium and Top-up Premium', 26))
  const page14Surrender = sourceRef(
    14,
    'Appendix A Surrender Charge',
    snippetNear(document, 14, 'Premium Payment Term: 25', 24),
  )
  const page14Mpc = sourceRef(
    14,
    'Appendix A Monthly Protection Charge Rates',
    snippetNear(document, 14, 'Monthly Rates for Monthly Protection Charges', 24),
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
  ]

  return {
    id: isAdvancedDeath ? 'sgd-mip-25-advanced-death' : 'sgd-mip-25',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
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
        sourceRefs: [page1, page2, page4, page10Charges],
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
        sourceRefs: [page2, page4, page5, page10Charges, page10],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: isAdvancedDeath ? [buildTokioSecureMpcFeeRule(page1, page10Charges, page14Mpc)] : [],
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: 25,
          accountIds: ['accumulation'],
        },
        {
          startPolicyYear: 26,
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
        'During the 25-year premium payment term, only dividends from the Accumulation Units Account may be paid in cash.',
        'After the premium payment term, dividends from both the Initial Units Account and Accumulation Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 annual dividend threshold remain reinvested in V1.',
        'Cash payout elections should be lodged at least 30 days before the dividend record date.',
      ],
      sourceRefs: [page9Distribution],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      isAdvancedDeath
        ? 'This partial template models the SGD / premium-payment-term-25 (Advanced Death) corridor only.'
        : 'This partial template models the SGD / premium-payment-term-25 (Basic Death) corridor only.',
      isAdvancedDeath
        ? 'This partial template models 24-month initial-versus-accumulation routing, the published 25-year initial bonus tiers, the published initial charge and policy charge through executable account fee rates, recurring single premium and top-up routing into the Accumulation Units Account, the published 25-year surrender charge on the Initial Units Account, the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface, and the published Advanced Death Monthly Protection Charge through the locked-in-value protection-state kernel.'
        : 'This partial template models 24-month initial-versus-accumulation routing, the published 25-year initial bonus tiers, the published initial charge and policy charge through executable account fee rates, recurring single premium and top-up routing into the Accumulation Units Account, the published 25-year surrender charge on the Initial Units Account, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? ['Full death-benefit payout handling, change-of-life-assured administration, and the exact published monthiversary ratchet timing remain outside the current engine boundary.']
        : ['Locked-in Policy Value, Monthly Protection Charge, and the related Advanced Death behavior remain metadata-only on the Basic Death corridor.']),
      'Loyalty Bonus and Additional Bonus remain metadata-only because their annual qualification and adjustment-factor formulas need stateful bonus tracking beyond the current engine.',
      'Premium-holiday lapse behavior, regular withdrawal, credit-card charge, and non-SGD or non-25-year corridors remain metadata-only.',
    ],
    sourceRefs: [
      page1,
      page2,
      page4,
      page5,
      page9Distribution,
      page10Charges,
      page10,
      page14Surrender,
      ...(isAdvancedDeath ? [page14Mpc] : []),
    ],
  }
}

export function parseTokioMarineGoClassicSecure(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goclassic-secure',
    insurer: 'Tokio Marine',
    productName: '#goClassic Secure',
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
      'tokio-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
      'kernel:tokio-locked-in-protection-state',
    ],
    metadataOnlyBehaviors: [
      'tokio-goclassic-secure-loyalty-bonus-adjustment-factor',
      'tokio-goclassic-secure-additional-bonus-qualification',
      'tokio-goclassic-secure-premium-holiday-lapse-state',
      'tokio-goclassic-secure-regular-withdrawal-facility',
      'tokio-goclassic-secure-credit-card-charge',
      'tokio-goclassic-secure-aggregation-limit',
      'tokio-goclassic-secure-change-of-life-assured',
    ],
    warnings: [
      '#goClassic Secure is cataloged as a supported V1 product. The parser captures split SGD / premium-payment-term-25 Basic Death and Advanced Death corridors with executable regular-premium routing, published initial bonus tiers, fee-rate modeling for the initial and policy charges, recurring single premium and top-up charges into the Accumulation Units Account, the 25-year surrender charge on the Initial Units Account, and the published phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
      'Basic Death keeps Monthly Protection Charge metadata-only, while the Advanced Death variant models the published Locked-in Policy Value floor, policy-year-3 MPC settlement of years 1-2 accruals, and irreversible downgrade after failed deduction through the locked-in-value protection-state kernel.',
      'Loyalty Bonus and Additional Bonus annual qualification and adjustment-factor handling, premium-holiday lapse state, regular-withdrawal administration, credit-card charge, aggregation limits, and change-of-life-assured administration remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
    ],
  }
}
