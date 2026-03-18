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

const PREMIUM_SHORTFALL_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.9 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.62 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.49 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.46 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.32 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.26 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.21 },
] as const
const FLEXI_START_YEARS = 10
const MINIMUM_PREMIUM_PAYABLE_FACTOR = 13.971643
const WITHDRAWAL_AND_SURRENDER_CHARGE_SCHEDULES = {
  '15 Years Flexi 10': [1, 1, 0.9, 0.8, 0.62, 0.49, 0.46, 0.32, 0.26, 0.21, 0.18, 0.15, 0.12, 0.08, 0.08],
  '20 Years Flexi 10': [1, 1, 0.9, 0.85, 0.8, 0.75, 0.62, 0.52, 0.45, 0.4, 0.36, 0.33, 0.3, 0.27, 0.24, 0.21, 0.17, 0.13, 0.08, 0.08],
} as const
const ADMINISTRATIVE_CHARGE_RATES = {
  '15 Years Flexi 10': {
    duringMip: 0.0218,
    afterMip: 0.0095,
  },
  '20 Years Flexi 10': {
    duringMip: 0.018,
    afterMip: 0.0092,
  },
} as const
const ANNUAL_PREMIUM_BONUS_RATE = 0.03

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function buildRateSchedule(values: readonly number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate,
  }))
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
  lineWindow = 16,
): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(
  document: ExtractedPdfDocument,
  plan: { id: string, mipLength: 15 | 20, label: '15 Years Flexi 10' | '20 Years Flexi 10' },
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and death benefit', snippetNear(document, 1, 'Manulife InvestReady Growth', 18))
  const page4 = sourceRef(4, 'Bonuses', snippetNear(document, 4, 'Premium Bonus', 28))
  const page5 = sourceRef(5, 'COI and administrative charge', snippetNear(document, 5, 'Cost of Insurance', 26))
  const page7 = sourceRef(7, 'Premium shortfall charge', snippetNear(document, 7, 'Premium Shortfall Charge', 24))
  const page8 = sourceRef(8, 'Top-up premium', snippetNear(document, 8, 'Top-up Premium', 18))
  const page11 = sourceRef(11, 'Distribution of dividend', snippetNear(document, 11, 'Distribution of Dividend', 20))
  const page18 = sourceRef(18, 'Appendix A annual COI table', snippetNear(document, 18, 'Annual Cost of Insurance', 20))

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'annual-premium-bonus',
      type: 'allocation',
      label: 'Annual Premium Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: ANNUAL_PREMIUM_BONUS_RATE,
      amount: null,
      requiresPremiumsPaidUpToDate: true,
      requiredRegularPremiumPaymentFrequency: 'annual',
      tieredRates: [],
      notes: [
        `Applied once on the first annual regular basic premium for the ${plan.label} corridor when the policy is issued on annual premium payment frequency.`,
        'The product’s separate Premium Bonus, Booster Bonus, and annual-mode change handling remain informational only in V1.',
      ],
      sourceRefs: [page4],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = [
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
      sourceRefs: [page1, page5, page18],
    },
    {
      id: 'administrative-charge',
      label: 'Administrative Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierSchedule: [
          {
            startPolicyYear: 1,
            endPolicyYear: null,
            mode: 'fixed',
            multiplier: MINIMUM_PREMIUM_PAYABLE_FACTOR,
          },
        ],
      },
      rateSchedule: [
        {
          startPolicyYear: 1,
          endPolicyYear: plan.mipLength,
          rate: ADMINISTRATIVE_CHARGE_RATES[plan.label].duringMip,
        },
        {
          startPolicyYear: plan.mipLength + 1,
          endPolicyYear: null,
          rate: ADMINISTRATIVE_CHARGE_RATES[plan.label].afterMip,
        },
      ],
      notes: [
        `Models the published administrative charge as X% / 12 multiplied by the Value of Minimum Premium Payable for the ${plan.label} corridor.`,
        `V1 interprets the Value of Minimum Premium Payable as the future value of the annualised regular basic premium, accumulated annually at 6% through the ${FLEXI_START_YEARS}-year Flexi Start window.`,
        'Keep monthly contribution aligned to the committed regular basic premium because post-Flexi premium variation remains informational only in V1.',
      ],
      sourceRefs: [page5],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        `Models the published monthly premium shortfall charge schedule before Flexi Start for the ${plan.label} corridor.`,
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page1, page7],
    },
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published prevailing 5.0% top-up charge.',
      ],
      sourceRefs: [page8],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(WITHDRAWAL_AND_SURRENDER_CHARGE_SCHEDULES[plan.label]),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published in-MIP partial-withdrawal charge schedule for the ${plan.label} corridor.`,
        'The partial-withdrawal flexibility corridor from policy year 6 and the life-stage-event waiver remain informational only in V1.',
      ],
      sourceRefs: [page7],
    },
  ]

  return {
    id: plan.id,
    currency: 'SGD',
    mipLength: plan.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0,
        postMipFeeRate: 0,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page8],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    eecTable: [...WITHDRAWAL_AND_SURRENDER_CHARGE_SCHEDULES[plan.label]],
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 40,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying funds may be reinvested or paid out in cash, subject to the product summary minimum payout amount.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption and amounts below S$40 remain reinvested.',
      ],
      sourceRefs: [page11],
    },
    warnings: [
      `${plan.label} is cataloged as a supported V1 corridor. The parser captures the published administrative-charge path using the accumulated minimum-premium base, the one-time annual-premium bonus when the seed uses annual premium frequency, the 101% paid-premium-floor COI formula after you enter the insured-life details and current premium bases, the current-state death-benefit estimate from that same floor, the premium-shortfall charge before Flexi Start, the prevailing 5.0% top-up charge, the in-MIP partial-withdrawal charge schedule, the in-MIP full-surrender charge schedule, and the reinvest-default distribution-mode assumption surface.`,
      'The administrative-charge base is interpreted as the future value of annualised regular basic premiums payable through the 10-year Flexi Start window, accumulated at 6% per annum. Keep monthly contribution aligned to the committed regular basic premium because post-Flexi premium variation remains informational only in V1.',
      'Premium Bonus, Booster Bonus, Loyalty Bonus, partial-withdrawal flexibility, and fund-level management charges remain informational only.',
      'Withdrawals of accumulated reinvested dividends remain informational only.',
    ],
    unsupportedItems: [
      'Welcome Bonus, Premium Bonus, Booster Bonus, and Loyalty Bonus remain informational only.',
      'Changing the regular premium payment mode from annual to a non-annual mode remains informational only.',
      'The partial-withdrawal flexibility corridor from policy year 6 and the life-stage-event waiver remain informational only.',
      'Terminal-illness acceleration limits, amount-owed deductions, claim-notification valuation timing, and post-claim continuation remain informational only beyond the current death-benefit estimate.',
      'Withdrawals of accumulated reinvested dividends remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund switching, premium redirection, automatic fund rebalancing, change-of-payment-mode, change-of-life-insured, and post-Flexi premium variation options remain informational only.',
      'Reinstatement underwriting and pre-existing-condition exclusions remain informational only.',
    ],
    sourceRefs: [page1, page4, page5, page7, page8, page11, page18],
  }
}

export function parseManulifeInvestreadyGrowth(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-investready-growth',
    insurer: 'Manulife Singapore',
    productName: 'Manulife InvestReady Growth',
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
      'branch:manulife-investready-growth-annual-premium-bonus',
      'branch:manulife-investready-growth-administrative-charge',
      'branch:manulife-investready-growth-premium-shortfall-charge',
      'branch:manulife-investready-growth-top-up-charge',
      'branch:manulife-investready-growth-partial-withdrawal-charge',
      'branch:manulife-investready-growth-full-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'manulife-investready-growth-welcome-bonus',
      'manulife-investready-growth-premium-bonus',
      'manulife-investready-growth-booster-bonus',
      'manulife-investready-growth-loyalty-bonus',
      'manulife-investready-growth-partial-withdrawal-flexibility',
      'manulife-investready-growth-partial-withdrawal-flexibility-life-stage-waiver',
      'manulife-investready-growth-reinvested-dividend-withdrawals',
      'manulife-investready-growth-ti-acceleration-limits-and-claim-timing',
      'manulife-investready-growth-fund-management-charge',
      'manulife-investready-growth-fund-switching-and-redirection',
      'manulife-investready-growth-life-insured-change',
      'manulife-investready-growth-reinstatement-underwriting-and-pre-existing-condition-exclusions',
      'manulife-investready-growth-post-flexi-premium-variation',
    ],
    warnings: [
      'Manulife InvestReady Growth is cataloged as a supported V1 corridor. The parser captures the accumulated-minimum-premium administrative-charge path, the paid-premium-floor cost-of-insurance formula after you enter insured-life details and current premium bases, the current-state death-benefit estimate from that same floor, the premium-shortfall charge before Flexi Start, the prevailing 5.0% top-up charge, the in-MIP partial-withdrawal and full-surrender charge schedules, and the reinvest-default distribution-mode assumption surface with the published S$40 minimum cash-payout threshold, while bonus mechanics, partial-withdrawal flexibility, terminal-illness acceleration limits, amount-owed deductions, claim-notification valuation timing, post-claim continuation, reinstatement underwriting and pre-existing-condition exclusions, and fund-level charges remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, {
        id: 'sgd-mip-15-flexi-10',
        mipLength: 15,
        label: '15 Years Flexi 10',
      }),
      buildVariant(context.document, {
        id: 'sgd-mip-20-flexi-10',
        mipLength: 20,
        label: '20 Years Flexi 10',
      }),
    ],
  }
}
