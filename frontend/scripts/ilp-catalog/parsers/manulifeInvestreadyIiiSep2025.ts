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
    id: 'sgd-mip-5-flexi-4-sep-2025',
    label: '5 Years Flexi 4',
    mipLength: 5,
    flexiStartYears: 4,
    stepUpBoosterRate: 0.1,
    postMipFeeRate: 0.01,
    annualPremiumBonusRate: 0,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 59_999.99, rate: 0.01 },
      { currency: 'SGD', minAnnualPremium: 60_000, maxAnnualPremium: null, rate: 0.02 },
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
    id: 'sgd-mip-7-flexi-5-sep-2025',
    label: '7 Years Flexi 5',
    mipLength: 7,
    flexiStartYears: 5,
    stepUpBoosterRate: 0.1,
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
    id: 'sgd-mip-10-flexi-3-sep-2025',
    label: '10 Years Flexi 3',
    mipLength: 10,
    flexiStartYears: 3,
    stepUpBoosterRate: 0.15,
    postMipFeeRate: 0.007,
    annualPremiumBonusRate: 0.02,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 9_599.99, rate: 0.13 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.2 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
    ],
    hasPolicyFee: true,
    policyFeeAnnualisedPremiumBand: 'S$6,000 to S$9,599.99',
  },
  {
    id: 'sgd-mip-10-flexi-5-sep-2025',
    label: '10 Years Flexi 5',
    mipLength: 10,
    flexiStartYears: 5,
    stepUpBoosterRate: 0.16,
    postMipFeeRate: 0.007,
    annualPremiumBonusRate: 0.05,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 9_599.99, rate: 0.16 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.31 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
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
    id: 'sgd-mip-10-flexi-8-sep-2025',
    label: '10 Years Flexi 8',
    mipLength: 10,
    flexiStartYears: 8,
    stepUpBoosterRate: 0.18,
    postMipFeeRate: 0.007,
    annualPremiumBonusRate: 0.05,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 9_599.99, rate: 0.21 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.38 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.79, 0.6, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
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
    id: 'sgd-mip-13-flexi-10-sep-2025',
    label: '13 Years Flexi 10',
    mipLength: 13,
    flexiStartYears: 10,
    stepUpBoosterRate: 0.25,
    postMipFeeRate: 0.007,
    annualPremiumBonusRate: 0.05,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 9_599.99, rate: 0.25 },
      { currency: 'SGD', minAnnualPremium: 9_600, maxAnnualPremium: null, rate: 0.55 },
    ],
    loyaltyBonusRate: 0.003,
    surrenderChargeSchedule: [1, 1, 0.81, 0.63, 0.53, 0.49, 0.46, 0.27, 0.22, 0.14, 0.08, 0.08, 0.08],
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
  lineWindow = 18,
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

function buildStepUpBoosterRateSchedule(
  mipLength: number,
  stepRate: number,
): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  const schedule: Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> = []

  for (let startPolicyYear = mipLength, bandIndex = 1; startPolicyYear <= 100; startPolicyYear += 5, bandIndex += 1) {
    schedule.push({
      startPolicyYear,
      endPolicyYear: Math.min(100, startPolicyYear + 4),
      rate: Math.round(stepRate * bandIndex * 1_000_000) / 1_000_000,
    })
  }

  return schedule
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
      sourceRefs: [page4],
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
          : 'No partial withdrawals or withdrawals of reinvested dividends in the preceding 12 consecutive months are allowed for the loyalty-bonus payment to be credited.',
      ],
      sourceRefs: [page4, page5],
    },
    {
      id: 'step-up-booster-bonus',
      type: 'custom',
      label: 'Step-up Booster Bonus',
      mode: 'one-time',
      oneTimePayoutBasis: 'step-up-booster-delta',
      appliesTo: ['policy'],
      startPolicyYear: variantDefinition.mipLength,
      endPolicyYear: null,
      cadenceYears: 1,
      rate: variantDefinition.stepUpBoosterRate,
      amount: null,
      tieredRates: [],
      policyYearRateSchedule: buildStepUpBoosterRateSchedule(
        variantDefinition.mipLength,
        variantDefinition.stepUpBoosterRate,
      ),
      stepUpPayoutConfig: {
        premiumShortfallChargeYears: variantDefinition.flexiStartYears,
        partialWithdrawalAccountIds: ['policy'],
        countPartialWithdrawalsFromPolicyYear: variantDefinition.mipLength + 1,
      },
      qualificationRules: [
        {
          formula: 'cumulative-effective-account-value-ratio',
          maximumRatio: 1,
        },
        {
          trigger: 'premium-holiday',
          disqualifyThroughPolicyYear: variantDefinition.flexiStartYears,
        },
      ],
      notes: [
        `Applied at the end of MIP and every 5 policy years thereafter for the ${variantDefinition.label} corridor when the published effective-account-value test remains satisfied and all regular basic premiums were paid in full before Flexi Start.`,
        'The payout follows the published step-up formula: booster rate times the lower of first-year annualised regular basic premium or the reduced cumulative-regular-premium base, less any previously credited Step-up Booster Bonus amount.',
        'The supported corridor counts modeled policy-account partial withdrawals after MIP; withdrawals of accumulated reinvested dividends remain informational only in V1.',
      ],
      sourceRefs: [page5],
    },
  ]
}

function buildVariant(
  document: ExtractedPdfDocument,
  variantDefinition: typeof VARIANTS[number],
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and death benefit', snippetNear(document, 1, 'Manulife InvestReady (III)', 18))
  const page4 = sourceRef(4, 'Welcome Bonus and Annual Premium Bonus', snippetNear(document, 4, 'Welcome Bonus rate is based on the table below', 24))
  const page5 = sourceRef(5, 'Loyalty Bonus and Step-up Booster Bonus', snippetNear(document, 5, 'Loyalty Bonus rate is based on the table below', 24))
  const page6 = sourceRef(6, 'COI, administrative charge, and policy fee', snippetNear(document, 6, 'Cost of Insurance', 28))
  const page7 = sourceRef(7, 'Policy fee and rider charges', snippetNear(document, 7, 'policy fee', 28))
  const page8 = sourceRef(8, 'Surrender and partial withdrawal charge tables', snippetNear(document, 8, 'Partial Withdrawal Charge (%)', 28))
  const page9 = sourceRef(9, 'Premium shortfall charge and management charge', snippetNear(document, 9, 'Premium Shortfall Charge (%)', 28))
  const page10 = sourceRef(10, 'Top-up premium and policy options', snippetNear(document, 10, 'Top-up Premium', 20))
  const page11 = sourceRef(11, 'Partial withdrawal and life-stage withdrawal options', snippetNear(document, 11, 'Life Stage Partial Withdrawal', 30))
  const page12 = sourceRef(12, 'Distribution of dividends', snippetNear(document, 12, 'Distribution of Dividends', 22))
  const page20 = sourceRef(20, 'Appendix A annual COI table', snippetNear(document, 20, 'Annual Cost of Insurance for Death Benefit', 20))

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
          sourceRefs: [page7],
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
        'Models the published 101% paid-premium floor net-amount-at-risk formula for death and terminal illness benefit, including top-up premiums and withdrawals.',
      ],
      sourceRefs: [page1, page6, page20],
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
        'Models the published prevailing 0% top-up charge for this cohort.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: variantDefinition.premiumShortfallSchedule.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        `Models the published monthly premium shortfall charge before Flexi Start for the ${variantDefinition.label} corridor.`,
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page1, page9],
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
        'The separate MIP partial-withdrawal amount-limit table and the life-stage waiver corridor remain informational only in V1.',
      ],
      sourceRefs: [page8, page11],
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
        feeRate: 0.025,
        postMipFeeRate: variantDefinition.postMipFeeRate,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page6, page10],
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
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'During MIP, dividend-paying funds are compulsory to be reinvested.',
        'After MIP, V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption and amounts below S$40 remain reinvested.',
      ],
      sourceRefs: [page12],
    },
    eecTable: [...variantDefinition.surrenderChargeSchedule],
    warnings: [
      `${variantDefinition.label} is cataloged as a supported V1 corridor. The parser captures the published 2.50% / ${(variantDefinition.postMipFeeRate * 100).toFixed(2)}% administration-charge path, the 101% paid-premium-floor COI formula after you enter the insured-life details and current premium bases, the current-state death-benefit estimate net of manually entered current amount owing, the current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap, subject to the published S$1,000,000 TI limit, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, the Welcome Bonus tiers, the annual-premium bonus gate when the seed uses annual premium frequency, the Loyalty Bonus rate for this corridor, the ${variantDefinition.hasPolicyFee ? 'low-band policy-fee surface through manual annual-fee input, the ' : ''}premium-shortfall charge before Flexi Start, the prevailing 0% top-up charge, the published S$2,500 minimum on explicit ad-hoc top-up premiums, the published S$500 minimum on explicit one-off partial withdrawals with the S$1,000 residual policy-value floor, the MIP partial-withdrawal charge schedule, the MIP full-surrender charge schedule, and the reinvest-default distribution-mode assumption surface.`,
      `${variantDefinition.hasPolicyFee ? 'Issue-time policy-fee band selection, ' : ''}the flexi-start premium-variation start-month gate and the published minimum reduced premium floor after Flexi Start are modeled, while annual-mode clawback on later payment-mode changes, the separate MIP partial-withdrawal amount-limit table, and life-stage partial-withdrawal waivers remain outside the current engine.`,
      'Selected-fund management charges are represented through the policy fund OCF inputs rather than a product-level parser rate.',
    ],
    unsupportedItems: [
      ...(variantDefinition.hasPolicyFee
        ? ['Issue-time policy-fee band selection remains informational only; enter the actual annual policy-fee amount for low-band corridors before trusting the projection.']
        : []),
      'Changing the regular premium payment mode from annual to a non-annual mode during the premium-shortfall-charge period remains informational only.',
      'Life-stage partial-withdrawal waivers remain informational only, including waiver eligibility proof, per-event caps, and the two-application lifetime limit.',
      'Current amount owing, the remaining aggregate TI cap, and the remaining aggregate TI + CI cap must still be entered manually for the current death / terminal-illness and residual-after-TI estimates; claim-notification valuation timing, TI claim admission, and settlement remain informational only.',
      'Fund switching, premium redirection, automatic fund rebalancing, and change-of-mode-of-payment options remain informational only.',
      'Reinstatement underwriting and pre-existing-condition exclusions remain informational only.',
    ],
    sourceRefs: [page1, page4, page6, page8, page9, page10, page11, page12, page20],
  }
}

export function parseManulifeInvestreadyIiiSep2025(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-investready-iii-sep-2025',
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
      'branch:manulife-investready-iii-step-up-booster-bonus',
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
      'manulife-investready-iii-life-stage-partial-withdrawal',
      'manulife-investready-iii-ti-claim-admission-settlement-and-notification-timing',
      'manulife-investready-iii-fund-switching-and-redirection',
      'manulife-investready-iii-reinstatement-underwriting-and-pre-existing-condition-exclusions',
    ],
    warnings: [
      'Manulife InvestReady (III) Sep-2025 summary cohort is cataloged as a separate supported corridor set in V1. The parser captures the published administration-charge path, the 101% paid-premium-floor cost-of-insurance formula after you enter insured-life details and current premium bases, the current-state death-benefit estimate net of manually entered current amount owing, the current terminal-illness benefit estimate as the lower of the modeled current death benefit, a manual remaining aggregate TI cap, and a manual remaining aggregate TI + CI cap, subject to the published S$1,000,000 TI limit, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, the Welcome Bonus tiers, the annual-premium bonus gate under the annual premium-frequency assumption, the published Loyalty Bonus rates, the Step-up Booster Bonus appendix-band and reduced-base qualification path, the low-band policy-fee surface through manual annual-fee input for the 10-year and 13-year corridors, the premium-shortfall charge before Flexi Start, the prevailing 0% top-up charge, the published S$2,500 minimum on explicit ad-hoc top-up premiums, the flexi-start premium-variation start-month gate, the published minimum reduced premium floor after Flexi Start, the published S$500 minimum on explicit one-off partial withdrawals with the S$1,000 residual policy-value floor, the MIP partial-withdrawal charge schedules, the MIP full-surrender charge schedules, and the reinvest-default distribution-mode assumption surface with the published S$40 minimum cash-payout threshold. Selected-fund management charges are represented through the policy fund OCF inputs rather than a product-level parser rate, while issue-time policy-fee band selection, annual-mode clawback on later payment-mode changes, the separate MIP partial-withdrawal amount-limit table, life-stage withdrawal waivers, terminal-illness claim admission / settlement / notification valuation timing, and reinstatement underwriting and pre-existing-condition exclusions remain outside the current engine.',
    ],
    archived: false,
    variants: VARIANTS.map((variant) => buildVariant(context.document, variant)),
  }
}
