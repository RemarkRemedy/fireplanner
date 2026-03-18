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
  0.88,
  0.86,
  0.84,
  0.82,
  0.8,
  0.78,
  0.76,
  0.73,
  0.7,
  0.67,
  0.64,
  0.61,
  0.58,
  0.54,
  0.5,
  0.45,
  0.4,
  0.35,
  0.3,
  0.25,
  0.2,
  0.15,
  0.1,
] as const

const INITIAL_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: 0.075 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: 0.1 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.12 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.14 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.195 },
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
  const loyaltyPage = sourceRef(2, 'Loyalty Bonus', snippetNear(document, 2, 'Loyalty Bonus', 28))

  return [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 5,
      rate: null,
      amount: null,
      tieredRates: INITIAL_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Tier is based on the published SGD annualised regular premium band for the 25-year premium payment term.',
        'Allocated to the Initial Units Account upon each regular premium received in the first five policy years.',
      ],
      sourceRefs: [page1, page2],
    },
    {
      id: 'loyalty-bonus-during-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (During Premium Payment Term)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 6,
      endPolicyYear: 25,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 6 to the end of the premium payment term.',
        'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus withdrawals, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [loyaltyPage],
    },
    {
      id: 'loyalty-bonus-after-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (After Premium Payment Term)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 26,
      endPolicyYear: null,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value after the premium payment term without the adjustment-factor multiplier.',
      ],
      sourceRefs: [loyaltyPage],
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
        endPolicyYear: 1,
        settlementPolicyYear: 2,
      },
      disableFutureChargesOnInsufficientDeduction: true,
    },
    notes: [
      'Models the published Monthly Protection Charge for the Advanced Death corridor during the 25-year premium payment term.',
      'The first policy year Monthly Protection Charge is accrued and deducted from the Accumulation Units Account in one lump sum in the second policy year.',
      'From the second policy year onward, Monthly Protection Charge is deducted monthly in advance from the Accumulation Units Account while the policy remains in force.',
      'The sum at risk is the published net premium less 101% of policy value, using Initial plus Accumulation Units Account value for the valuation basis.',
      'If the Accumulation Units Account cannot fully fund Monthly Protection Charge due, the death benefit is downgraded to Basic Death Benefit, future new Monthly Protection Charge stops, and the outstanding amount remains collectible as indebtedness.',
    ],
    sourceRefs: [optionPage, chargePage, tablePage],
  }
}

function buildVariant(
  document: ExtractedPdfDocument,
  deathBenefitOption: 'basic-death' | 'advanced-death',
): IlpTemplateVariant {
  const isAdvancedDeath = deathBenefitOption === 'advanced-death'
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'TM Atlas Wealth', 18))
  const page2 = sourceRef(2, 'Initial Bonus / Loyalty Bonus', snippetNear(document, 2, 'Loyalty Bonus', 22))
  const page4 = sourceRef(4, 'Regular Premium Routing', snippetNear(document, 4, 'Regular premium due during the first 12 months', 20))
  const page5 = sourceRef(5, 'Recurring Single Premium / Top-up Premium / Premium Holiday', snippetNear(document, 5, 'Recurring Single Premium', 22))
  const page8Dividend = sourceRef(8, 'Dividend Distribution / Initial Charge / Policy Charge', snippetNear(document, 8, 'Dividend Distribution', 32))
  const page8Charges = sourceRef(8, 'Initial Charge / Policy Charge / MPC', snippetNear(document, 8, 'Initial Charge', 28))
  const page9 = sourceRef(9, 'Premium Charge / Surrender Charge', snippetNear(document, 9, 'Premium Charge for Recurring Single Premium and Top-up Premium', 26))
  const page14 = sourceRef(
    14,
    isAdvancedDeath ? 'Appendix A Monthly Protection Charge Rates' : 'Appendix A Surrender Charge',
    snippetNear(document, 14, isAdvancedDeath ? 'Monthly Rates for Monthly Protection Charges' : 'Premium Payment Term: 25', 24),
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
      sourceRefs: [page5, page9],
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
      sourceRefs: [page5, page9],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = []
  if (isAdvancedDeath) {
    feeRules.push(buildTokioMpcFeeRule(page1, page8Charges, page14))
  }

  return {
    id: isAdvancedDeath ? 'sgd-mip-25-advanced-death' : 'sgd-mip-25',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 12,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: 0.055,
        postMipFeeRate: 0.015,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page2, page4, page8Charges],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: 0.015,
        postMipFeeRate: 0.015,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page2, page4, page5, page8Charges, page9],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules,
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
      sourceRefs: [page8Dividend],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      `This partial template models the SGD / premium-payment-term-25 (${isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      'This partial template models 12-month initial-versus-accumulation routing, the published 25-year initial bonus tiers, the published initial charge and policy charge through executable account fee rates, recurring single premium and top-up routing into the Accumulation Units Account, the published 25-year surrender charge on the Initial Units Account, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      ...(isAdvancedDeath
        ? [
            'The Advanced Death variant also models the published current death-benefit estimate, first-policy-year Monthly Protection Charge accrual, policy-year-2 settlement, policy-value valuation basis, and irreversible downgrade to Basic Death after failed Accumulation Units Account deduction.',
          ]
        : []),
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? [
            'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, multiple-life last-life settlement, change-of-life-assured administration, premium-holiday lapse behavior, regular withdrawal, credit-card charge, and non-SGD or non-25-year corridors remain metadata-only.',
          ]
        : [
            'Advanced Death selection, Monthly Protection Charge, multiple-life last-life settlement, change-of-life-assured administration, premium-holiday lapse behavior, regular withdrawal, credit-card charge, and non-SGD or non-25-year corridors remain metadata-only.',
          ]),
    ],
    sourceRefs: [page1, page2, page4, page5, page8Dividend, page8Charges, page9, page14],
  }
}

export function parseTokioMarineAtlasWealth(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-atlas-wealth',
    insurer: 'Tokio Marine',
    productName: 'TM Atlas Wealth',
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
      'branch:tokio-loyalty-bonus-adjustment-factor',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
      'branch:tokio-atlas-advanced-death-monthly-protection-charge-disable-on-insufficient-deduction',
    ],
    metadataOnlyBehaviors: [
      'tokio-atlas-advanced-death-payout-handling',
      'tokio-atlas-multiple-life-last-life-settlement',
      'tokio-atlas-change-of-life-assured-administration',
      'tokio-atlas-premium-holiday-lapse-state',
      'tokio-atlas-regular-withdrawal-facility',
      'tokio-atlas-credit-card-charge',
    ],
    warnings: [
      'TM Atlas Wealth is cataloged as a supported V1 product. The parser captures split SGD / premium-payment-term-25 Basic Death and Advanced Death corridors with executable regular-premium routing, published initial bonus tiers, annual loyalty bonus with the published bounded adjustment-factor formula during the premium payment term and the flat post-term rate thereafter, account-fee-rate modeling for the initial and policy charges, recurring single premium and top-up charges into the Accumulation Units Account, the 25-year surrender charge on the Initial Units Account, and the published phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
      'Basic Death keeps Monthly Protection Charge metadata-only, while the Advanced Death variant models the published current death-benefit estimate, first-policy-year accrual, policy-year-2 settlement, policy-value valuation basis, and irreversible downgrade after failed deduction.',
      'Premium-holiday lapse behavior, multiple-life last-life settlement, change-of-life-assured administration, regular withdrawal, credit-card charge, and other corridors remain informational only.',
      'Structured extraction validated against the TM Atlas Wealth product summary text layer.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'basic-death'),
      buildVariant(context.document, 'advanced-death'),
    ],
  }
}
