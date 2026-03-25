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

const TERM_OPTIONS = [10, 15, 20, 25] as const
type MipTerm = (typeof TERM_OPTIONS)[number]

const APPENDIX_2_CHARGE: Record<MipTerm, number[]> = {
  10: [1, 1, 0.8, 0.65, 0.55, 0.5, 0.4, 0.3, 0.2, 0.08],
  15: [1, 1, 0.85, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.08],
  20: [1, 1, 0.9, 0.8, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.16, 0.14, 0.12, 0.1, 0.08],
  25: [1, 1, 0.95, 0.85, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.18, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06, 0.05, 0.04],
}
const PREMIUM_HOLIDAY_NO_CHARGE_MONTHS: Record<MipTerm, number> = {
  10: 12,
  15: 12,
  20: 24,
  25: 24,
}
const PREMIUM_HOLIDAY_MIN_START_POLICY_MONTH = 13
const PREMIUM_HOLIDAY_NO_CHARGE_START_POLICY_YEAR = 3
const LOYALTY_BONUS_PHASES: Record<MipTerm, Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }>> = {
  10: [
    { startPolicyYear: 10, endPolicyYear: null, rate: 0.003 },
  ],
  15: [
    { startPolicyYear: 10, endPolicyYear: 15, rate: 0.002 },
    { startPolicyYear: 16, endPolicyYear: null, rate: 0.006 },
  ],
  20: [
    { startPolicyYear: 10, endPolicyYear: 20, rate: 0.003 },
    { startPolicyYear: 21, endPolicyYear: null, rate: 0.009 },
  ],
  25: [
    { startPolicyYear: 10, endPolicyYear: 25, rate: 0.004 },
    { startPolicyYear: 26, endPolicyYear: null, rate: 0.01 },
  ],
}
const INVESTMENT_BONUS_BANDS = [
  {
    minAnnualPremium: 1_200,
    maxAnnualPremium: 9_599.99,
    ratesByTerm: {
      10: [0, 0.07, 0.11, 0.15, 0.19, 0.23],
      15: [0, 0.07, 0.26, 0.3, 0.34, 0.38],
      20: [0, 0.07, 0.4, 0.44, 0.48, 0.52],
      25: [0, 0.07, 0.42, 0.46, 0.5, 0.54],
    } satisfies Record<MipTerm, readonly number[]>,
  },
  {
    minAnnualPremium: 9_600,
    maxAnnualPremium: null,
    ratesByTerm: {
      10: [0, 0.15, 0.19, 0.23, 0.27, 0.31],
      15: [0, 0.15, 0.34, 0.38, 0.42, 0.46],
      20: [0, 0.15, 0.5, 0.54, 0.58, 0.65],
      25: [0, 0.15, 0.52, 0.56, 0.6, 0.67],
    } satisfies Record<MipTerm, readonly number[]>,
  },
] as const
const INVESTMENT_BONUS_MULTIPLE_BANDS: Array<{ min: number, max: number | null }> = [
  { min: 0, max: 9.99 },
  { min: 10, max: 19.99 },
  { min: 20, max: 29.99 },
  { min: 30, max: 39.99 },
  { min: 40, max: 49.99 },
  { min: 50, max: null },
]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function roundRate(value: number): number {
  return Number(value.toFixed(6))
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  const normalizedExcerpt = normalizeWhitespace(excerpt)
  return {
    page,
    section,
    excerpt: (normalizedExcerpt || `${section} excerpt unavailable`).slice(0, 220),
  }
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildRateSchedule(values: readonly number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate: roundRate(rate),
  }))
}

function buildInvestmentBonusTiers(term: MipTerm) {
  return INVESTMENT_BONUS_BANDS.flatMap((band) => (
    INVESTMENT_BONUS_MULTIPLE_BANDS.map((multipleBand, index) => ({
      currency: 'SGD' as const,
      minAnnualPremium: band.minAnnualPremium,
      maxAnnualPremium: band.maxAnnualPremium,
      minSumAssuredMultiple: multipleBand.min,
      maxSumAssuredMultiple: multipleBand.max,
      rate: roundRate(band.ratesByTerm[term][index] ?? 0),
    }))
  ))
}

function buildBonuses(term: MipTerm, page1: IlpCatalogSourceRef, page2: IlpCatalogSourceRef, page3: IlpCatalogSourceRef): IlpTemplateBonus[] {
  return [
    {
      id: 'investment-bonus',
      type: 'sign-up',
      label: 'Investment Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      annualPremiumTierBasis: 'initial-basic-sum-assured-multiple-at-issue',
      tieredRates: buildInvestmentBonusTiers(term),
      notes: [
        'Models the published basic-policy Table 1 investment bonus on regular premiums paid in the first 12 months using the issue-time sum assured multiple and annual premium band.',
        'The separate Critical Protect (ILP) rider table uses different rates and remains informational only.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'post-mip-regular-premium-allocation',
      type: 'allocation',
      label: 'Post-MIP Regular Premium Allocation Uplift',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: term + 1,
      endPolicyYear: null,
      rate: 0.05,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 105% of regular premium used to buy units after the selected MIP ends.',
        'This uplift applies to regular premiums only. Top-ups continue to buy units at 100%.',
      ],
      sourceRefs: [page1],
    },
    ...LOYALTY_BONUS_PHASES[term].map((phase, index) => ({
      id: index === 0 ? 'loyalty-bonus' : `loyalty-bonus-${index + 1}`,
      type: 'loyalty' as const,
      label: 'Loyalty Bonus',
      mode: 'annual-rate' as const,
      appliesTo: ['policy'],
      startPolicyYear: phase.startPolicyYear,
      endPolicyYear: phase.endPolicyYear,
      rate: phase.rate,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published annual loyalty bonus as a percentage of policy value from the 10th policy anniversary onward for the selected MIP corridor.',
        'The policy must stay in force for the loyalty bonus to be credited.',
      ],
      sourceRefs: [page3],
    })),
  ]
}

function buildVariant(document: ExtractedPdfDocument, term: MipTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Policy description and regular premium allocation', snippetNear(document, 1, 'Percentage of regular premium to buy units', 18))
  const page2 = sourceRef(2, 'Investment bonus', snippetNear(document, 2, 'Investment Bonus', 18))
  const page3 = sourceRef(3, 'Loyalty bonus and top-ups', snippetNear(document, 3, 'Loyalty Bonus', 18))
  const page4 = sourceRef(4, 'No Lapse Guarantee', snippetNear(document, 4, 'No Lapse Guarantee', 18))
  const page7 = sourceRef(7, 'Fees and charges', snippetNear(document, 7, 'Policy Fee', 20))
  const page8 = sourceRef(8, 'Premium holiday charge', snippetNear(document, 8, 'Premium Holiday Charge', 16))
  const page9 = sourceRef(9, 'Subscription and redemption of units', snippetNear(document, 9, '100% of your regular premium', 20))
  const page17 = sourceRef(17, 'Declaration and Reinvesting of Distributions', snippetNear(document, 17, 'Declaration and Reinvesting of Distributions', 18))
  const page21 = sourceRef(21, 'Appendix 2 charges', snippetNear(document, 21, 'Appendix 2', 20))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'account-value',
      rate: 0,
      amount: null,
      appliesTo: ['policy'],
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 5, rate: 0.05 },
        { startPolicyYear: 6, endPolicyYear: null, rate: 0.01 },
      ],
      activeWindow: 'policy-term',
      notes: [
        'Models the published monthly-deducted policy fee as an annualised percentage of policy value.',
      ],
      sourceRefs: [page7],
    },
    {
      id: 'insurance-cover-charge',
      label: 'Insurance Cover Charge',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      requiresManualInput: true,
      assuranceConfig: {
        formula: 'great-eastern-gla4-death-ti',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 120,
      },
      notes: [
        'Models the published monthly insurance cover charge using the Appendix 1 rate table after insured-life details and the current applicable basic benefit are entered.',
        'Use the current sum assured field as the current applicable basic benefit before charges: enter the MPV before the anniversary immediately after age 70, and the sum assured thereafter.',
        'Top-ups and withdrawals remain included in the modeled sum-at-risk path through the existing protected-base assurance kernel.',
      ],
      sourceRefs: [page4, page7],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      freeLifetimeMonths: PREMIUM_HOLIDAY_NO_CHARGE_MONTHS[term],
      freeLifetimeMonthsStartPolicyYear: PREMIUM_HOLIDAY_NO_CHARGE_START_POLICY_YEAR,
      rate: 0,
      rateSchedule: buildRateSchedule(APPENDIX_2_CHARGE[term]),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published Appendix 2 premium-holiday charge from the 2nd policy anniversary during the MIP, with the first ${PREMIUM_HOLIDAY_NO_CHARGE_MONTHS[term]} months waived from the 3rd policy anniversary for the selected MIP corridor.`,
        'Pre-2nd-anniversary nonpayment termination, No Lapse Guarantee debt carry, and reinstatement remain manual in V1.',
      ],
      sourceRefs: [page8, page21],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(APPENDIX_2_CHARGE[term]),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Appendix 2 charge percentage on the policy value withdrawn during the selected MIP.',
        'The minimum S$500 withdrawal amount and minimum S$1,000 post-withdrawal policy value remain informational only in V1.',
      ],
      sourceRefs: [page7, page9, page21],
    },
  ]

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipLength: term,
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
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page9],
      },
    ],
    bonuses: buildBonuses(term, page1, page2, page3),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsDuringPremiumHoliday: true,
      minimumPremiumHolidayStartPolicyMonth: PREMIUM_HOLIDAY_MIN_START_POLICY_MONTH,
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: [
        'Income declares distributions only on a reinvested basis for AstraLink ILP sub-funds that carry a distribution option.',
        'The published corridor does not provide a normal cash-payout election; each declared distribution is reinvested into the same ILP sub-fund.',
      ],
      sourceRefs: [page17],
    },
    eecTable: [...APPENDIX_2_CHARGE[term]],
    warnings: [
      'AstraLink (VA2) is modeled as a supported subset in V1. The parser captures the basic-policy Table 1 investment bonus on first-year regular premiums, the 105% post-MIP regular-premium allocation uplift, the term-specific annual loyalty bonus schedule from the 10th policy anniversary onward, the current-state death / terminal-illness / TPD estimates as the higher of current applicable basic benefit or policy value, with TPD capped by a manual remaining aggregate TPD cap, the current accidental-death estimate as the current death corridor plus a manual accidental-claim-mode uplift on current applicable basic benefit before age 70, the policy-fee schedule, the monthly insurance cover charge after insured-life and current-basic-benefit inputs are supplied, the Appendix 2 premium-holiday / partial-withdrawal / surrender charge schedules including premium-holiday start gating from the 2nd policy anniversary and the published charge-free window from the 3rd policy anniversary, active premium-holiday top-up blocking, and the published reinvest-only distribution mode.',
      'The separate Investment Bonus table for Critical Protect (ILP) rider cases remains informational only.',
      'No Lapse Guarantee debt carry, pre-2nd-anniversary nonpayment termination, and broader protection-side claim settlement remain informational only in V1 beyond the modeled current death / terminal-illness / TPD / accidental-death / accidental-TPD snapshots.',
    ],
    unsupportedItems: [
      'The separate Investment Bonus table for Critical Protect (ILP) rider cases remains informational only.',
      'No Lapse Guarantee amount-owed carry and reinstatement behavior remain informational only.',
      'Pre-2nd-anniversary nonpayment termination remains informational only.',
      'Minimum withdrawal amount and minimum post-withdrawal policy value remain informational only.',
      'Changing premium or sum assured, retirement option, and guaranteed insurability option remain informational only.',
      'The current-state death / terminal-illness / TPD estimates need a manual current applicable basic benefit input because that benefit changes across MPV / sum-assured mode and is not reconstructed from history in V1.',
      'The current-state TPD estimate also needs a manual remaining aggregate TPD cap because the published S$6.5 million aggregate limit is not reconstructed from cross-policy history in V1.',
      'Accidental-death / accidental-TPD claim admission and exclusions, and broader protection-side claim settlement remain informational only beyond the modeled current death / terminal-illness / TPD / accidental-death / accidental-TPD snapshots.',
    ],
    sourceRefs: [page1, page2, page3, page4, page7, page8, page9, page17, page21],
  }
}

export function parseIncomeAstralinkVa2({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'income-astralink-va2',
    insurer: 'Income Insurance',
    productName: 'AstraLink (VA2)',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-tpd-benefit-estimate',
      'kernel:current-accidental-tpd-benefit-estimate',
      'branch:astralink-va2-investment-bonus',
      'branch:astralink-va2-post-mip-regular-allocation',
      'branch:astralink-va2-loyalty-bonus',
      'branch:astralink-va2-policy-fee',
      'branch:astralink-va2-insurance-cover-charge',
      'branch:astralink-va2-premium-holiday-charge',
      'branch:astralink-va2-partial-withdrawal-charge',
      'branch:astralink-va2-surrender-charge',
      'kernel:minimum-premium-holiday-start-month',
      'kernel:premium-holiday-top-up-block',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'astralink-va2-no-lapse-guarantee',
      'astralink-va2-pre-2nd-anniversary-nonpayment-termination',
      'astralink-va2-accidental-tpd-and-claim-settlement',
      'astralink-va2-flexible-options',
    ],
    warnings: [
      'AstraLink (VA2) is cataloged as a supported V1 product. The parser captures the basic-policy Table 1 investment bonus on first-year regular premiums, the 105% post-MIP regular-premium allocation uplift, the term-specific annual loyalty bonus schedule, the current-state death / terminal-illness / TPD estimates as the higher of current applicable basic benefit or policy value, with TPD capped by a manual remaining aggregate TPD cap, the current accidental-death estimate as the current death corridor plus a manual accidental-claim-mode uplift on current applicable basic benefit before age 70, the current accidental-TPD estimate as the current TPD corridor plus that same manual accidental-claim-mode uplift before age 70, the policy-fee schedule, the monthly insurance cover charge after insured-life and current-basic-benefit inputs are supplied, the Appendix 2 premium-holiday / partial-withdrawal / surrender charge schedules including premium-holiday start gating from the 2nd policy anniversary and the published charge-free window from the 3rd policy anniversary, and the published reinvest-only distribution mode, while the Critical Protect (ILP) rider investment-bonus table, No Lapse Guarantee debt carry, pre-2nd-anniversary nonpayment termination, and broader protection-side claim settlement remain informational only beyond the modeled current death / terminal-illness / TPD / accidental-death / accidental-TPD snapshots.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(document, term)),
  }
}
