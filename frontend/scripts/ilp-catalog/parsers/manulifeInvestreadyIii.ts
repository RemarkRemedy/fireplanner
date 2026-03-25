import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
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
    id: 'sgd-mip-5-flexi-1',
    label: '5 Years Flexi 1',
    mipLength: 5,
    flexiStartYears: 1,
    postMipFeeRate: 0.01,
    annualPremiumBonusRate: 0,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 25_000, maxAnnualPremium: null, rate: 0.058 },
    ],
    loyaltyBonusRate: 0,
    surrenderChargeSchedule: [0.15, 0.12, 0.09, 0.06, 0.03],
    premiumShortfallSchedule: [],
    hasPolicyFee: false,
  },
  {
    id: 'sgd-mip-5-flexi-4',
    label: '5 Years Flexi 4',
    mipLength: 5,
    flexiStartYears: 4,
    postMipFeeRate: 0.01,
    annualPremiumBonusRate: 0,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 47_999.99, rate: 0.01 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.02 },
    ],
    loyaltyBonusRate: 0,
    surrenderChargeSchedule: [1, 1, 0.75, 0.4, 0.2],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.75 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
    ],
    hasPolicyFee: false,
  },
  {
    id: 'sgd-mip-6-flexi-2',
    label: '6 Years Flexi 2',
    mipLength: 6,
    flexiStartYears: 2,
    postMipFeeRate: 0.01,
    annualPremiumBonusRate: 0,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 10_000, maxAnnualPremium: null, rate: 0.116 },
    ],
    loyaltyBonusRate: 0,
    surrenderChargeSchedule: [1, 1, 0.77, 0.4, 0.2, 0.1],
    premiumShortfallSchedule: [
      { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
    ],
    hasPolicyFee: false,
  },
  {
    id: 'sgd-mip-7-flexi-5',
    label: '7 Years Flexi 5',
    mipLength: 7,
    flexiStartYears: 5,
    postMipFeeRate: 0.01,
    annualPremiumBonusRate: 0,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 47_999.99, rate: 0.07 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.12 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.77, 0.4, 0.2, 0.1, 0.05],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.77 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.4 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
    ],
    hasPolicyFee: false,
  },
  {
    id: 'sgd-mip-10-flexi-3',
    label: '10 Years Flexi 3',
    mipLength: 10,
    flexiStartYears: 3,
    postMipFeeRate: 0.007,
    annualPremiumBonusRate: 0.02,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 9_599.99, rate: 0.08 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.15 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.79, 0.6, 0.5, 0.08, 0.08, 0.08, 0.08, 0.08],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
    ],
    hasPolicyFee: true,
    policyFeeAnnualisedPremiumBand: 'S$6,000 to S$9,599.99',
  },
  {
    id: 'sgd-mip-10-flexi-5',
    label: '10 Years Flexi 5',
    mipLength: 10,
    flexiStartYears: 5,
    postMipFeeRate: 0.007,
    annualPremiumBonusRate: 0.05,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 9_599.99, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.25 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.79, 0.6, 0.5, 0.08, 0.08, 0.08, 0.08, 0.08],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
    ],
    hasPolicyFee: true,
    policyFeeAnnualisedPremiumBand: 'S$6,000 to S$9,599.99',
  },
  {
    id: 'sgd-mip-10-flexi-8',
    label: '10 Years Flexi 8',
    mipLength: 10,
    flexiStartYears: 8,
    postMipFeeRate: 0.007,
    annualPremiumBonusRate: 0.05,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 9_599.99, rate: 0.13 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.3 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.79, 0.6, 0.5, 0.08, 0.08, 0.08, 0.08, 0.08],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.47 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.44 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.21 },
    ],
    hasPolicyFee: true,
    policyFeeAnnualisedPremiumBand: 'S$6,000 to S$9,599.99',
  },
  {
    id: 'sgd-mip-13-flexi-10',
    label: '13 Years Flexi 10',
    mipLength: 13,
    flexiStartYears: 10,
    postMipFeeRate: 0.007,
    annualPremiumBonusRate: 0.05,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_599.99, rate: 0.15 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.45 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.81, 0.63, 0.53, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.81 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.63 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.53 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.27 },
      { startPolicyYear: 9, endPolicyYear: 9, rate: 0.22 },
      { startPolicyYear: 10, endPolicyYear: 10, rate: 0.14 },
    ],
    hasPolicyFee: true,
    policyFeeAnnualisedPremiumBand: 'S$3,600 to S$9,599.99',
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

function snippetNear(
  document: ExtractedPdfDocument,
  pageNumber: number,
  keyword: string,
  lineWindow = 12,
): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildRateSchedule(values: readonly number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate,
  }))
}

function buildBonuses(
  variantDefinition: typeof VARIANTS[number],
  page4: IlpCatalogSourceRef,
  page5: IlpCatalogSourceRef,
): IlpTemplateBonus[] {
  return [
    {
      id: 'welcome-bonus',
      type: 'sign-up',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: variantDefinition.welcomeBonusTiers.map((tier) => ({ ...tier })),
      notes: [
        `Applied to the first 12 months of regular basic premium paid for the ${variantDefinition.label} corridor, excluding top-up premiums.`,
      ],
      sourceRefs: [page4],
    },
    {
      id: 'annual-premium-bonus',
      type: 'allocation',
      label: 'Annual Premium Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: variantDefinition.annualPremiumBonusRate,
      amount: null,
      requiresPremiumsPaidUpToDate: true,
      requiredRegularPremiumPaymentFrequency: 'annual',
      tieredRates: [],
      notes: [
        `Applied once on the first annual regular basic premium for the ${variantDefinition.label} corridor when the policy is issued on annual premium payment mode.`,
        'Any later change from annual to a non-annual premium payment mode during the premium-shortfall-charge period remains informational only in V1.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: variantDefinition.mipLength + 1,
      endPolicyYear: null,
      rate: variantDefinition.loyaltyBonusRate,
      amount: null,
      tieredRates: [],
      qualificationRules: [
        { trigger: 'partial-withdrawal', disqualifyInReferenceYear: true },
        { trigger: 'reinvested-dividend-withdrawal', disqualifyInReferenceYear: true },
      ],
      notes: [
        `Applied from the policy anniversary immediately after the end of MIP for the ${variantDefinition.label} corridor.`,
        variantDefinition.loyaltyBonusRate === 0
          ? 'The published loyalty-bonus rate for this corridor is 0.0%, so the executable bonus remains economically neutral.'
          : 'Any partial withdrawal or reinvested-dividend withdrawal in the preceding 12 consecutive months disqualifies the annual loyalty-bonus payment for that policy year.',
      ],
      sourceRefs: [page5],
    },
  ]
}

function buildVariant(
  document: ExtractedPdfDocument,
  variantDefinition: typeof VARIANTS[number],
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'Manulife InvestReady (III)', 16))
  const page2 = sourceRef(2, 'MIP and flexi start table', snippetNear(document, 2, 'Flexi start date', 18))
  const page4 = sourceRef(4, 'Welcome Bonus', snippetNear(document, 4, 'Welcome Bonus rate is based on the table below', 24))
  const page5 = sourceRef(5, 'Annual Premium Bonus and Loyalty Bonus', snippetNear(document, 5, 'Annual Premium Bonus rate is based on the table below', 30))
  const page6 = sourceRef(6, 'COI and administrative charge', snippetNear(document, 6, 'Cost of Insurance', 22))
  const page8 = sourceRef(8, 'Withdrawal and premium shortfall charge tables', snippetNear(document, 8, 'Partial Withdrawal Charge', 28))
  const page9 = sourceRef(9, 'Top-up premium and flexi options', snippetNear(document, 9, 'Top-up premium', 24))
  const page10 = sourceRef(10, 'Partial withdrawal rules', snippetNear(document, 10, 'Partial Withdrawal', 22))
  const page12 = sourceRef(12, 'Distribution of dividends', snippetNear(document, 12, 'Distribution of Dividends', 20))
  const page19 = sourceRef(19, 'Appendix A annual COI table', snippetNear(document, 19, 'Annual Cost of Insurance', 22))

  const feeRules: IlpTemplateFeeRule[] = [
    ...(variantDefinition.hasPolicyFee
      ? [{
          id: 'policy-fee',
          label: 'Policy Fee',
          basis: 'fixed-annual',
          rate: 0,
          amount: 0,
          requiresManualInput: true,
          appliesTo: ['policy'],
          activeWindow: 'policy-term',
          notes: [
            'Enter the actual annual policy-fee amount before trusting the projection.',
            `The published policy fee is S$5 deducted on each policy monthiversary only when the first-year annualised basic premium for the ${variantDefinition.label} corridor is in the ${variantDefinition.policyFeeAnnualisedPremiumBand} band.`,
          ],
          sourceRefs: [page6],
        }]
      : []),
    {
      id: 'cost-of-insurance',
      label: 'Cost of Insurance (Death / TI)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'manulife-investready-iii-death-ti',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Requires insured-life details plus the current net regular premium base and current net top-up premium base before the calculator can model the annualised COI.',
        'Models the published 101% paid-premium floor net-amount-at-risk formula for death and terminal illness benefit.',
      ],
      sourceRefs: [page6, page19],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        `Models the published prevailing 0% top-up charge for the ${variantDefinition.label} corridor.`,
      ],
      sourceRefs: [page9],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(variantDefinition.surrenderChargeSchedule),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published MIP partial-withdrawal charge schedule for the ${variantDefinition.label} corridor.`,
        'The separate MIP partial-withdrawal amount-limit table remains informational only in V1.',
      ],
      sourceRefs: [page8, page10],
    },
  ]

  if (variantDefinition.premiumShortfallSchedule.length > 0) {
    eventChargeRules.splice(1, 0, {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: variantDefinition.premiumShortfallSchedule.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'pro-rata-by-value',
      notes: [
        `Models the published monthly premium shortfall charge before the Flexi Start date for the ${variantDefinition.label} corridor.`,
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page2, page8, page9],
    })
  }

  return {
    id: variantDefinition.id,
    currency: 'SGD',
    mipLength: variantDefinition.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0.025,
        postMipFeeRate: variantDefinition.postMipFeeRate,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page9],
      },
    ],
    bonuses: buildBonuses(variantDefinition, page4, page5),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 500,
      partialWithdrawalMinimumRemainingValueRules: [
        {
          activeWindow: 'policy-term',
          basis: 'policy-value',
          minimumValue: 1_000,
        },
      ],
      minimumRegularPremiumVariationStartPolicyMonth: (variantDefinition.flexiStartYears * 12) + 1,
      minimumRegularPremiumAmountByFrequency: {
        annual: 40,
        'semi-annual': 40,
        quarterly: 40,
        monthly: 40,
      },
      minimumTopUpAmount: 2_500,
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 40,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying funds may be reinvested or paid out in cash, subject to the published minimum payout amount.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption and amounts below S$40 remain reinvested.',
      ],
      sourceRefs: [page12],
    },
    eecTable: [...variantDefinition.surrenderChargeSchedule],
    warnings: [
      `${variantDefinition.label} is cataloged as a supported V1 corridor. The parser captures the published 2.50% / ${(variantDefinition.postMipFeeRate * 100).toFixed(2)}% administration-charge path, the 101% paid-premium-floor COI formula after you enter the insured-life details and current premium bases, the current-state death-benefit estimate net of manually entered current amount owing, the current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap, subject to the published S$1,000,000 TI limit, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, the Welcome Bonus tiers, the annual-premium bonus gate when the seed uses annual premium frequency, the published Loyalty Bonus rate for this corridor, the ${variantDefinition.hasPolicyFee ? 'low-band policy-fee surface through manual annual-fee input, the ' : ''}${variantDefinition.premiumShortfallSchedule.length > 0 ? 'premium-shortfall charge before Flexi Start, the ' : ''}prevailing 0% top-up charge, the published S$2,500 minimum on explicit ad-hoc top-up premiums, the published S$500 minimum on explicit one-off partial withdrawals with the S$1,000 residual policy-value floor, the MIP partial-withdrawal charge schedule, the MIP full-surrender charge schedule, and the reinvest-default distribution-mode assumption surface with the published S$40 minimum cash-payout threshold.`,
      `${variantDefinition.hasPolicyFee ? 'Issue-time policy-fee band selection, ' : ''}the flexi-start premium-variation start-month gate and the published minimum reduced premium floor after Flexi Start are modeled, while annual-mode clawback on later payment-mode changes and the separate MIP partial-withdrawal amount-limit table remain informational only.`,
      'Selected-fund management charges are represented through the policy fund OCF inputs rather than a product-level parser rate.',
    ],
    unsupportedItems: [
      ...(variantDefinition.hasPolicyFee
        ? ['Issue-time policy-fee band selection remains informational only; enter the actual annual policy-fee amount for low-band corridors before trusting the projection.']
        : []),
      'Changing the regular premium payment mode from annual to a non-annual mode during the premium-shortfall-charge period remains informational only.',
      'Top-up underwriting remains informational only.',
      'Reinvested-dividend withdrawal approval and available-balance verification remain informational only.',
      'Current amount owing, the remaining aggregate TI cap, and the remaining aggregate TI + CI cap must still be entered manually for the current death / terminal-illness and residual-after-TI estimates; claim-notification valuation timing, TI claim admission, and settlement remain informational only.',
      'Reinstatement underwriting and pre-existing-condition exclusions remain informational only.',
      'The separate MIP partial-withdrawal amount-limit table remains informational only.',
    ],
    sourceRefs: [page1, page2, page6, page8, page9, page10, page12, page19],
  }
}

export function parseManulifeInvestreadyIii(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-investready-iii',
    insurer: 'Manulife Singapore',
    productName: 'Manulife InvestReady (III)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'branch:manulife-investready-iii-welcome-bonus',
      'branch:manulife-investready-iii-annual-premium-bonus',
      'branch:manulife-investready-iii-loyalty-bonus',
      'branch:manulife-investready-iii-policy-fee-manual-input',
      'branch:manulife-investready-iii-administrative-charge',
      'branch:manulife-investready-iii-premium-shortfall-charge',
      'branch:manulife-investready-iii-zero-top-up-charge',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'branch:manulife-investready-iii-partial-withdrawal-charge',
      'branch:manulife-investready-iii-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'manulife-investready-iii-top-up-underwriting',
      'manulife-investready-iii-ti-claim-admission-settlement-and-notification-timing',
      'manulife-investready-iii-reinstatement-underwriting-and-pre-existing-condition-exclusions',
      'manulife-investready-iii-annual-mode-clawback-on-payment-mode-change',
    ],
    warnings: [
      'Manulife InvestReady (III) Jan-2026 summary cohort is cataloged as a separate supported corridor set in V1. The parser captures the published administration-charge path, the 101% paid-premium-floor cost-of-insurance formula after you enter insured-life details and current premium bases, the current-state death-benefit estimate net of manually entered current amount owing, the current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap, subject to the published S$1,000,000 TI limit, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, the Welcome Bonus tiers, the annual-premium bonus gate under the annual premium-frequency assumption, the published Loyalty Bonus rates including the 12-month suspension after partial withdrawals or withdrawals of reinvested dividends, the low-band policy-fee surface through manual annual-fee input for the 10-year and 13-year corridors, the premium-shortfall charge before Flexi Start where applicable, the prevailing 0% top-up charge, the published S$2,500 minimum on explicit ad-hoc top-up premiums, the flexi-start premium-variation start-month gate, the published minimum reduced premium floor after Flexi Start, the published S$500 minimum on explicit one-off partial withdrawals with the S$1,000 residual policy-value floor, the MIP partial-withdrawal charge schedules, the MIP full-surrender charge schedules, and the reinvest-default distribution-mode assumption surface with the published S$40 minimum cash-payout threshold. Selected-fund management charges are represented through the policy fund OCF inputs rather than a product-level parser rate, while issue-time policy-fee band selection, annual-mode clawback on later payment-mode changes, the separate MIP partial-withdrawal amount-limit table, terminal-illness claim admission / notification valuation timing / settlement, top-up underwriting, and reinstatement underwriting and pre-existing-condition exclusions remain informational only.',
    ],
    archived: false,
    variants: VARIANTS.map((variant) => buildVariant(context.document, variant)),
  }
}
