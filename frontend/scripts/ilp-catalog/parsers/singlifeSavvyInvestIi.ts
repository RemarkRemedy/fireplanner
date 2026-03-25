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

const VARIANTS = [
  {
    id: 'sgd-mip-3-fixed',
    displayLabel: '3 years (Fixed)',
    mipLength: 3,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: 24_999.99, rate: 0 },
      { currency: 'SGD', minAnnualPremium: 25_000, maxAnnualPremium: null, rate: 0.03 },
    ],
    surrenderChargeSchedule: [1, 1, 0.75],
    partialWithdrawalChargeSchedule: [1, 1, 0.75],
    premiumShortfallChargeSchedule: [1, 1, 0.75],
  },
  {
    id: 'sgd-mip-5-fixed',
    displayLabel: '5 years (Fixed)',
    mipLength: 5,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: 24_999.99, rate: 0.06 },
      { currency: 'SGD', minAnnualPremium: 25_000, maxAnnualPremium: null, rate: 0.1 },
    ],
    surrenderChargeSchedule: [1, 1, 0.75, 0.4, 0.2],
    partialWithdrawalChargeSchedule: [1, 1, 0.75, 0.4, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.75, 0.4, 0.2],
  },
  {
    id: 'sgd-mip-5-flexible',
    displayLabel: '5 years (Flexible)',
    mipLength: 5,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.04 },
    ],
    surrenderChargeSchedule: [1, 1, 0.75, 0.4, 0.2],
    partialWithdrawalChargeSchedule: [0.1, 0.1, 0.1, 0.05, 0.05],
    premiumShortfallChargeSchedule: [1, 1, 0.75],
  },
  {
    id: 'sgd-mip-10-fixed',
    displayLabel: '10 years (Fixed)',
    mipLength: 10,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_999.99, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: null, rate: 0.4 },
    ],
    surrenderChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1],
    partialWithdrawalChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1],
    premiumShortfallChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1],
  },
  {
    id: 'sgd-mip-10-flexible',
    displayLabel: '10 years (Flexible)',
    mipLength: 10,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 9_999.99, rate: 0.08 },
      { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: null, rate: 0.15 },
    ],
    surrenderChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1],
    partialWithdrawalChargeSchedule: [0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05],
    premiumShortfallChargeSchedule: [1, 1, 0.8],
  },
  {
    id: 'sgd-mip-20-flexible',
    displayLabel: '20 years (Flexible)',
    mipLength: 20,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 2_400, maxAnnualPremium: 9_999.99, rate: 0.3 },
      { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: null, rate: 0.6 },
    ],
    surrenderChargeSchedule: [1, 1, 0.9, 0.75, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.05, 0.05, 0.05],
    partialWithdrawalChargeSchedule: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    premiumShortfallChargeSchedule: [1, 1, 0.9, 0.75, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4],
  },
] as const

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  const normalizedExcerpt = normalizeWhitespace(excerpt)
  return {
    page,
    section,
    excerpt: (normalizedExcerpt || `${section} excerpt unavailable`).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildRateSchedule(values: readonly number[]): Array<{ startPolicyYear: number, endPolicyYear: number, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate,
  }))
}

function buildBonuses(document: ExtractedPdfDocument, variantDefinition: typeof VARIANTS[number]): IlpTemplateBonus[] {
  const page3 = sourceRef(3, 'Welcome Bonus / Loyalty Bonus / Life Stage Benefit', snippetNear(document, 3, 'Welcome Bonus', 32))
  const page5 = sourceRef(5, 'Basic regular premium allocation', snippetNear(document, 5, '1st to 120th', 20))

  return [
    {
      id: 'welcome-bonus',
      type: 'allocation',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: variantDefinition.welcomeBonusTiers.map((tier) => ({ ...tier })),
      notes: [
        `Applied to each basic regular premium received during the first 12 months for the SGD / ${variantDefinition.displayLabel} corridor.`,
        'Single premium top-up and unpaid regular premiums do not receive the Welcome Bonus.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'regular-premium-allocation-uplift-policy-years-11-20',
      type: 'allocation',
      label: 'Regular Premium Allocation Uplift (Policy Years 11-20)',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 11,
      endPolicyYear: 20,
      rate: 0.02,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 102% of basic regular premium units from policy year 11 to policy year 20.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'regular-premium-allocation-uplift-policy-year-21-onward',
      type: 'allocation',
      label: 'Regular Premium Allocation Uplift (Policy Year 21 Onward)',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 21,
      endPolicyYear: null,
      rate: 0.05,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 105% of basic regular premium units from policy year 21 onward.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'loyalty-bonus-payments-1-10',
      type: 'loyalty',
      label: 'Loyalty Bonus (Payments 1-10)',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: variantDefinition.mipLength + 1,
      endPolicyYear: variantDefinition.mipLength + 10,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'Models the published first 10 loyalty-bonus payments at 0.30% p.a. of account value after the 10-year fixed minimum investment period.',
        'Withdrawals in the prior 12 months suspend this loyalty-bonus payment.',
        'Qualifying post-MIP Life Stage Benefit withdrawals can be represented in V1 by setting bonusSuspensionWaived on the withdrawal event, while benefit timing, proof, and use-count administration remain manual.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'loyalty-bonus-payments-11-20',
      type: 'loyalty',
      label: 'Loyalty Bonus (Payments 11-20)',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: variantDefinition.mipLength + 11,
      endPolicyYear: variantDefinition.mipLength + 20,
      rate: 0.004,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'Models the published 11th to 20th loyalty-bonus payments at 0.40% p.a. of account value.',
        'Withdrawals in the prior 12 months suspend this loyalty-bonus payment.',
        'Qualifying post-MIP Life Stage Benefit withdrawals can be represented in V1 by setting bonusSuspensionWaived on the withdrawal event, while benefit timing, proof, and use-count administration remain manual.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'loyalty-bonus-payments-21-plus',
      type: 'loyalty',
      label: 'Loyalty Bonus (Payments 21+)',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: variantDefinition.mipLength + 21,
      endPolicyYear: null,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
      ],
      notes: [
        'Models the published 21st and subsequent loyalty-bonus payments at 0.50% p.a. of account value.',
        'Withdrawals in the prior 12 months suspend this loyalty-bonus payment.',
        'Qualifying post-MIP Life Stage Benefit withdrawals can be represented in V1 by setting bonusSuspensionWaived on the withdrawal event, while benefit timing, proof, and use-count administration remain manual.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page6 = sourceRef(6, 'Administrative Charge / Supplementary Charge', snippetNear(document, 6, 'Administrative Charge', 24))
  const page8 = sourceRef(8, 'Cost of Insurance', snippetNear(document, 8, 'Cost of Insurance', 24))
  const page18 = sourceRef(18, 'Appendix C cost of insurance rates', snippetNear(document, 18, 'Annual Cost of Insurance for Death Benefit and Terminal Illness Benefit', 24))

  return [
    {
      id: 'cost-of-insurance',
      label: 'Cost of Insurance (Death / TI)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'singlife-savvy-invest-ii-death-ti',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 120,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Requires insured-life details plus the current net regular premium base and current net supplementary premium base before the calculator can model the annualised COI.',
        'Models the published 101% paid-premium-floor sum-at-risk formula for the death and terminal-illness benefit.',
      ],
      sourceRefs: [page8, page18],
    },
    {
      id: 'administrative-charge',
      label: 'Administrative Charge',
      basis: 'account-value',
      rate: 0.006,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 0.60% p.a. administrative charge on account value throughout the policy term.',
      ],
      sourceRefs: [page6],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'account-value',
      rate: 0.019,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'during-mip',
      startPolicyYear: 1,
      endPolicyYear: 10,
      notes: [
        'Models the published 1.90% p.a. supplementary charge on account value during the first 10 policy years.',
      ],
      sourceRefs: [page6],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, variantDefinition: typeof VARIANTS[number]): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and minimum investment period options', snippetNear(document, 1, 'whole life, regular premium investment-linked plan', 28))
  const page2 = sourceRef(2, 'Minimum Investment Period and Welcome Bonus table', snippetNear(document, 2, '10 years (Fixed)', 28))
  const page3 = sourceRef(3, 'Loyalty Bonus / Life Stage Benefit', snippetNear(document, 3, 'Loyalty Bonus', 34))
  const page5 = sourceRef(5, 'Basic regular premium allocation', snippetNear(document, 5, '1st to 120th', 20))
  const page6 = sourceRef(6, 'Administrative Charge / Supplementary Charge', snippetNear(document, 6, 'Administrative Charge', 24))
  const page7 = sourceRef(7, 'Surrender Charge / Partial Withdrawal Charge / Premium Shortfall Charge', snippetNear(document, 7, 'Surrender charge', 34))
  const page8 = sourceRef(8, 'Premium holiday / Partial withdrawal / Surrender', snippetNear(document, 8, 'Premium holiday during the minimum investment period', 34))
  const page8CostOfInsurance = sourceRef(8, 'Cost of Insurance', snippetNear(document, 8, 'Cost of Insurance', 24))
  const page12 = sourceRef(12, 'Distribution of Dividends', snippetNear(document, 12, 'Distribution of Dividends', 24))
  const page13 = sourceRef(13, 'Dividend cash-out threshold', snippetNear(document, 13, 'minimum dividend cash out amount', 18))
  const page15 = sourceRef(15, 'Appendix A charge schedules', snippetNear(document, 15, 'Appendix A', 30))
  const page18 = sourceRef(18, 'Appendix C cost of insurance rates', snippetNear(document, 18, 'Annual Cost of Insurance for Death Benefit and Terminal Illness Benefit', 24))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'single-premium-top-up-charge',
      label: 'Single Premium Top-up Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the currently published nil premium charge on single premium top-ups.',
      ],
      sourceRefs: [page7, page8],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(variantDefinition.partialWithdrawalChargeSchedule),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published Appendix A partial-withdrawal charge schedule for the ${variantDefinition.displayLabel} corridor.`,
        'Qualifying in-MIP Life Stage Benefit withdrawals can be represented in V1 by setting chargeWaived on the withdrawal event.',
        'The published Life Stage Benefit timing, proof, use-count, and allowable-limit override mechanics remain manual in V1.',
      ],
      sourceRefs: [page3, page7, page8, page15],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(variantDefinition.premiumShortfallChargeSchedule),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published monthly premium shortfall charge after the grace period when regular premiums are unpaid during the ${variantDefinition.displayLabel} minimum investment period.`,
        'Back-payments are not allowed; use premium-holiday exit by resuming ongoing premium payments only.',
      ],
      sourceRefs: [page7, page8, page15],
    },
  ]

  return {
    id: variantDefinition.id,
    currency: 'SGD',
    mipLength: variantDefinition.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page6],
      },
    ],
    bonuses: buildBonuses(document, variantDefinition),
    feeRules: buildFeeRules(document),
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest declared dividends or pay them out in cash, with reinvestment as the default if no option is elected.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published S$40 minimum remain reinvested.',
      ],
      sourceRefs: [page12, page13],
    },
    eecTable: variantDefinition.surrenderChargeSchedule.map((rate) => rate),
    warnings: [
      `This supported template models the SGD / ${variantDefinition.displayLabel} corridor.`,
      'This supported template models the welcome bonus tiers, the 100% / 102% / 105% regular-premium allocation ladder, the published loyalty-bonus payment windows, the guaranteed cost-of-insurance formula after insured-life details and current premium bases are entered, the 0.60% administrative charge, the first-10-policy-years 1.90% supplementary charge, the currently nil top-up charge, the current-state death and terminal-illness benefit amount as the higher of 101% of total basic regular premiums paid plus top-ups less withdrawals or account value less manual current amount owing, the Appendix A surrender / withdrawal / premium-shortfall schedules, and the reinvest-default distribution-mode assumption surface.',
      'Qualifying Life Stage Benefit withdrawals can be represented in V1 with event-level charge and loyalty-bonus-suspension waivers, while benefit timing, proof, use-count, and Appendix B allowable partial-withdrawal-limit overrides remain informational only. An admitted-and-settled terminal-illness claim is supported as a current policy-termination state.',
    ],
    unsupportedItems: [
      'Life Stage Benefit timing windows, use-count limits, and Appendix B allowable partial-withdrawal-limit overrides remain informational only.',
      'The current-state death-benefit estimate needs a manual current amount owing input because indebtedness is not reconstructed from history in V1.',
      'The current-state terminal-illness benefit amount is modeled as an early payout of the current death-benefit estimate after manual current amount owing, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but pre-settlement claim admission, exclusions, and other post-claim policy effects remain informational only.',
      'Change of Life Assured and rider continuity effects remain informational only.',
      'Allowable partial withdrawal amount limits from Appendix B remain informational only.',
      'Fund switching, fund-level annual management charges, and future non-guaranteed top-up-charge changes remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page5, page6, page7, page8, page8CostOfInsurance, page12, page13, page15, page18],
  }
}

export function parseSinglifeSavvyInvestIi({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'singlife-savvy-invest-ii',
    insurer: 'Singlife',
    productName: 'Singlife Savvy Invest II',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:singlife-savvy-invest-ii-welcome-bonus',
      'branch:singlife-savvy-invest-ii-regular-premium-allocation-uplift',
      'branch:singlife-savvy-invest-ii-loyalty-bonus',
      'branch:singlife-savvy-invest-ii-cost-of-insurance',
      'branch:singlife-savvy-invest-ii-administrative-charge',
      'branch:singlife-savvy-invest-ii-supplementary-charge',
      'branch:singlife-savvy-invest-ii-zero-top-up-charge',
      'branch:singlife-savvy-invest-ii-partial-withdrawal-charge',
      'branch:singlife-savvy-invest-ii-surrender-charge',
      'branch:singlife-savvy-invest-ii-premium-shortfall-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'singlife-savvy-invest-ii-life-stage-benefit-eligibility-and-limit-overrides',
      'singlife-savvy-invest-ii-change-of-life-assured',
      'singlife-savvy-invest-ii-appendix-b-withdrawal-limits',
      'singlife-savvy-invest-ii-fund-management-and-switching',
    ],
    warnings: [
      'Singlife Savvy Invest II is cataloged as a supported V1 product for the published SGD / 3 years (Fixed), 5 years (Fixed), 5 years (Flexible), 10 years (Fixed), 10 years (Flexible), and 20 years (Flexible) corridors. The parser captures the corridor-specific welcome bonus tiers and Appendix A surrender / withdrawal / premium-shortfall schedules, plus the shared regular-premium allocation uplifts, loyalty-bonus windows, guaranteed cost-of-insurance formula after you enter insured-life details and current premium bases, administrative and supplementary charges, the currently nil top-up charge, the current-state death and terminal-illness benefit amount as the higher of 101% of total basic regular premiums paid plus top-ups less withdrawals or account value less manual current amount owing, and reinvest-default distribution support.',
      'Qualifying Life Stage Benefit withdrawals can be represented in V1 with event-level charge and loyalty-bonus-suspension waivers, while benefit timing, proof, use-count, and allowable partial-withdrawal limits from Appendix B remain informational only beyond the modeled current ordinary death and terminal-illness benefit amount. An admitted-and-settled terminal-illness claim is supported as a current policy-termination state.',
      'Structured extraction validated against the Singlife Savvy Invest II product summary text layer.',
    ],
    archived: false,
    variants: VARIANTS.map((variantDefinition) => buildVariant(document, variantDefinition)),
  }
}
