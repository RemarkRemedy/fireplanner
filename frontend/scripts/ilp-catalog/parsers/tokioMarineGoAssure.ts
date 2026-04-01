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

const TERM_OPTIONS = [5, 10, 15, 20, 25] as const

type SupportedTerm = (typeof TERM_OPTIONS)[number]

type BonusRateBand = readonly [number, number, number, number]

interface SumAssuredTierBonusConfig {
  minSumAssured: number
  maxSumAssured: number | null
  policyYearRates: BonusRateBand
}

const SURRENDER_CHARGE_TABLE_BY_TERM: Record<SupportedTerm, readonly number[]> = {
  5: [1, 1, 0.85, 0.25, 0.1],
  10: [1, 1, 0.95, 0.95, 0.7, 0.65, 0.6, 0.45, 0.25, 0.08],
  15: [1, 1, 0.95, 0.95, 0.76, 0.76, 0.76, 0.73, 0.73, 0.73, 0.7, 0.6, 0.45, 0.25, 0.07],
  20: [1, 1, 0.95, 0.95, 0.87, 0.87, 0.87, 0.87, 0.87, 0.87, 0.75, 0.75, 0.7, 0.7, 0.52, 0.45, 0.35, 0.25, 0.15, 0.08],
  25: [1, 1, 0.95, 0.95, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.82, 0.82, 0.75, 0.75, 0.65, 0.65, 0.6, 0.6, 0.55, 0.5, 0.45, 0.35, 0.25, 0.15, 0.08],
}

const INITIAL_CHARGE_BASE_RATE_BY_TERM: Record<SupportedTerm, number> = {
  5: 0.0112,
  10: 0.0065,
  15: 0.0045,
  20: 0.0035,
  25: 0.003,
}

const INITIAL_BONUS_SUM_ASSURED_TIERS_BY_TERM: Record<SupportedTerm, readonly SumAssuredTierBonusConfig[]> = {
  5: [
    { minSumAssured: 100_000, maxSumAssured: 199_000, policyYearRates: [0, 0, 0, 0] },
    { minSumAssured: 200_000, maxSumAssured: 299_000, policyYearRates: [0.01, 0.01, 0.02, 0.02] },
    { minSumAssured: 300_000, maxSumAssured: null, policyYearRates: [0.02, 0.02, 0.03, 0.03] },
  ],
  10: [
    { minSumAssured: 100_000, maxSumAssured: 199_000, policyYearRates: [0.01, 0.02, 0.03, 0.05] },
    { minSumAssured: 200_000, maxSumAssured: 299_000, policyYearRates: [0.02, 0.03, 0.04, 0.06] },
    { minSumAssured: 300_000, maxSumAssured: null, policyYearRates: [0.03, 0.04, 0.05, 0.07] },
  ],
  15: [
    { minSumAssured: 100_000, maxSumAssured: 199_000, policyYearRates: [0.02, 0.03, 0.04, 0.06] },
    { minSumAssured: 200_000, maxSumAssured: 299_000, policyYearRates: [0.03, 0.04, 0.05, 0.07] },
    { minSumAssured: 300_000, maxSumAssured: null, policyYearRates: [0.04, 0.05, 0.06, 0.08] },
  ],
  20: [
    { minSumAssured: 100_000, maxSumAssured: 199_000, policyYearRates: [0.03, 0.04, 0.05, 0.07] },
    { minSumAssured: 200_000, maxSumAssured: 299_000, policyYearRates: [0.04, 0.05, 0.06, 0.08] },
    { minSumAssured: 300_000, maxSumAssured: null, policyYearRates: [0.05, 0.06, 0.07, 0.09] },
  ],
  25: [
    { minSumAssured: 100_000, maxSumAssured: 199_000, policyYearRates: [0.04, 0.05, 0.06, 0.08] },
    { minSumAssured: 200_000, maxSumAssured: 299_000, policyYearRates: [0.05, 0.06, 0.07, 0.09] },
    { minSumAssured: 300_000, maxSumAssured: null, policyYearRates: [0.06, 0.07, 0.08, 0.1] },
  ],
}

const LOYALTY_BONUS_RATE_BY_TERM: Record<SupportedTerm, number> = {
  5: 0,
  10: 0,
  15: 0.012,
  20: 0.012,
  25: 0.012,
}

const ACHIEVEMENT_BONUS_RATE_BY_TERM: Record<SupportedTerm, number> = {
  5: 0,
  10: 0,
  15: 0.035,
  20: 0.035,
  25: 0.035,
}

const WELLNESS_BONUS_RATE_BY_TERM: Record<SupportedTerm, number> = {
  5: 0,
  10: 0.035,
  15: 0.04,
  20: 0.06,
  25: 0.065,
}

const MINIMUM_REGULAR_PREMIUM_BY_TERM: Record<SupportedTerm, Record<'annual' | 'semi-annual' | 'quarterly' | 'monthly', number>> = {
  5: {
    annual: 6_000,
    'semi-annual': 3_000,
    quarterly: 1_500,
    monthly: 500,
  },
  10: {
    annual: 3_600,
    'semi-annual': 1_800,
    quarterly: 900,
    monthly: 300,
  },
  15: {
    annual: 2_400,
    'semi-annual': 1_200,
    quarterly: 600,
    monthly: 200,
  },
  20: {
    annual: 1_800,
    'semi-annual': 900,
    quarterly: 450,
    monthly: 150,
  },
  25: {
    annual: 1_500,
    'semi-annual': 750,
    quarterly: 375,
    monthly: 125,
  },
}

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildInitialChargeRateSchedule(term: SupportedTerm) {
  const baseRate = INITIAL_CHARGE_BASE_RATE_BY_TERM[term]
  return Array.from({ length: term }, (_, index) => {
    const policyYear = index + 1
    return {
      startPolicyYear: policyYear,
      endPolicyYear: policyYear,
      rate: Number((baseRate * policyYear).toFixed(4)),
    }
  })
}

function buildPremiumWindowChargeSchedule(term: SupportedTerm) {
  return SURRENDER_CHARGE_TABLE_BY_TERM[term]
    .slice(4)
    .map((rate, index) => {
      const policyYear = index + 5
      return {
        startPolicyYear: policyYear,
        endPolicyYear: policyYear,
        rate,
      }
    })
}

function buildFeeRules(term: SupportedTerm, document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page13 = sourceRef(13, 'Initial Charge', snippetNear(document, 13, 'Initial Charge', 22))
  const page14 = sourceRef(14, 'Policy Charge', snippetNear(document, 14, 'Policy Charge', 24))
  const page19 = sourceRef(19, 'Monthly Protection Charges (Death)', snippetNear(document, 19, 'Monthly Rates for Monthly Protection Charges', 40))
  const page20 = sourceRef(20, 'Monthly Protection Charges (Death continued)', snippetNear(document, 20, 'Monthly Rates for Monthly Protection Charges', 40))
  const page21 = sourceRef(21, 'Monthly Protection Charges (TPD)', snippetNear(document, 21, 'Monthly Rates for Monthly Protection Charges', 40))
  const page22 = sourceRef(22, 'Monthly Protection Charges (TPD continued)', snippetNear(document, 22, 'Monthly Rates for Monthly Protection Charges', 40))

  return [
    {
      id: 'initial-charge',
      label: 'Initial Charge',
      basis: 'account-value',
      rate: 0,
      rateSchedule: buildInitialChargeRateSchedule(term),
      amount: 0,
      appliesTo: ['initial'],
      activeWindow: 'during-mip',
      notes: [
        `Models the published monthly initial charge for the SGD ${term}-year minimum contribution period as ${(
          INITIAL_CHARGE_BASE_RATE_BY_TERM[term] * 100
        ).toFixed(2)}% p.a. multiplied by the current policy year.`,
        'The source states this charge continues during premium holiday.',
      ],
      sourceRefs: [page13],
    },
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.01,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      startPolicyYear: 5,
      endPolicyYear: term,
      activeWindow: 'during-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 5, endPolicyYear: term, mode: 'policy-year' },
        ],
      },
      notes: [
        `Models the published monthly policy charge from the 49th policy month until the end of the ${term}-year minimum contribution period.`,
        'If the Accumulation Units Account is insufficient, the remaining deduction falls back to the Initial Units Account and/or Top-up Units Account.',
      ],
      sourceRefs: [page14],
    },
    {
      id: 'monthly-protection-charge-death',
      label: 'Monthly Protection Charge (Death)',
      basis: 'assurance-sum-at-risk',
      rate: 0,
      amount: 0,
      appliesTo: ['accumulation'],
      assuranceValueAppliesTo: ['initial', 'accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      activeWindow: 'policy-term',
      assuranceConfig: {
        formula: 'tokio-mpc-goassure-basic-sum-at-risk',
        rateTable: 'tokio-goassure-mpc-death',
        monthlyModalFactor: 1,
        sumAssuredRateMultiplierTiers: [
          { minSumAssured: 100_000, maxSumAssured: 199_999, multiplier: 1 },
          { minSumAssured: 200_000, maxSumAssured: 299_999, multiplier: 0.95 },
          { minSumAssured: 300_000, maxSumAssured: null, multiplier: 0.9 },
        ],
      },
      notes: [
        `Models the published monthly protection charge on the Death basic sum at risk for the supported SGD ${term}-year corridor using the goAssure smoker-specific rate tables.`,
        'The charge deducts from the Accumulation Units Account first and falls back to the Initial Units Account and/or Top-up Units Account if needed.',
        'V1 needs manual current Basic Sum Assured and Protection Age inputs because withdrawal-adjusted protection history is not reconstructed from source state.',
      ],
      sourceRefs: [page19, page20],
    },
    {
      id: 'monthly-protection-charge-tpd',
      label: 'Monthly Protection Charge (TPD)',
      basis: 'assurance-sum-at-risk',
      rate: 0,
      amount: 0,
      appliesTo: ['accumulation'],
      assuranceValueAppliesTo: ['initial', 'accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      activeWindow: 'policy-term',
      assuranceConfig: {
        formula: 'tokio-mpc-goassure-tpd-sum-at-risk',
        rateTable: 'tokio-goassure-mpc-tpd',
        monthlyModalFactor: 1,
        sumAssuredRateMultiplierTiers: [
          { minSumAssured: 100_000, maxSumAssured: 199_999, multiplier: 1 },
          { minSumAssured: 200_000, maxSumAssured: 299_999, multiplier: 0.95 },
          { minSumAssured: 300_000, maxSumAssured: null, multiplier: 0.9 },
        ],
      },
      notes: [
        'Models the published monthly protection charge on TPD sum at risk using the goAssure smoker-specific TPD rate tables and the manual current TPD acceleration ratio input.',
        'The charge ends from Protection Age onward because the source states monthly protection charges are deducted only up to the policy anniversary at Protection Age.',
        'V1 needs manual current Basic Sum Assured, Protection Age, and TPD acceleration ratio inputs because withdrawal-adjusted protection history is not reconstructed from source state.',
      ],
      sourceRefs: [page21, page22],
    },
  ]
}

function buildInitialBonus(term: SupportedTerm, policyYear: 1 | 2 | 3 | 4, page3: IlpCatalogSourceRef, page4: IlpCatalogSourceRef): IlpTemplateBonus {
  return {
    id: `initial-bonus-policy-year-${policyYear}`,
    type: 'sign-up',
    label: `Initial Bonus (Policy Year ${policyYear})`,
    mode: 'premium-allocation',
    annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
    appliesTo: ['initial'],
    startPolicyYear: policyYear,
    endPolicyYear: policyYear,
    rate: 0,
    amount: null,
    tieredRates: INITIAL_BONUS_SUM_ASSURED_TIERS_BY_TERM[term].map((tier) => ({
      currency: 'SGD',
      minAnnualPremium: null,
      maxAnnualPremium: null,
      minSumAssured: tier.minSumAssured,
      maxSumAssured: tier.maxSumAssured,
      rate: tier.policyYearRates[policyYear - 1],
    })),
    notes: [
      `Models the published Initial Bonus credited on each regular premium received in policy year ${policyYear} for the SGD ${term}-year minimum contribution corridor.`,
      'The applicable rate band depends on the initial Basic Sum Assured as at commencement date and therefore needs that manual issue-date input in V1.',
    ],
    sourceRefs: [page3, page4],
  }
}

function buildBonuses(term: SupportedTerm, document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page3 = sourceRef(3, 'Initial Bonus', snippetNear(document, 3, 'Initial Bonus', 24))
  const page4 = sourceRef(4, 'Initial Bonus Rates', snippetNear(document, 4, 'Initial Bonus', 28))
  const page5 = sourceRef(5, 'Loyalty Bonus and Achievement Bonus', snippetNear(document, 5, 'Loyalty Bonus', 28))
  const page6 = sourceRef(6, 'Wellness Bonus', snippetNear(document, 6, 'Wellness Bonus', 28))

  const bonuses: IlpTemplateBonus[] = [
    buildInitialBonus(term, 1, page3, page4),
    buildInitialBonus(term, 2, page3, page4),
    buildInitialBonus(term, 3, page3, page4),
    buildInitialBonus(term, 4, page3, page4),
  ]

  const loyaltyRate = LOYALTY_BONUS_RATE_BY_TERM[term]
  if (loyaltyRate > 0) {
    bonuses.push({
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: `Loyalty Bonus (Policy Years 11-${term})`,
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: term,
      rate: loyaltyRate,
      amount: null,
      tieredRates: [],
      notes: [
        `Models the published ${(loyaltyRate * 100).toFixed(2)}% p.a. Loyalty Bonus on the Accumulation Units Account value from the end of policy year 11 to the end of the ${term}-year minimum contribution period.`,
        'The published fully-paid / no-premium-holiday / no-regular-premium-reduction / no-Accumulation-Units-Account-withdrawal / no-claim qualification conditions remain informational only in V1.',
      ],
      sourceRefs: [page5],
    })
  }

  const achievementRate = ACHIEVEMENT_BONUS_RATE_BY_TERM[term]
  if (achievementRate > 0) {
    bonuses.push({
      id: 'achievement-bonus',
      type: 'custom',
      label: 'Achievement Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: term,
      endPolicyYear: term,
      rate: achievementRate,
      amount: null,
      tieredRates: [],
      notes: [
        `Models the published one-time ${(achievementRate * 100).toFixed(2)}% Achievement Bonus for the SGD ${term}-year corridor as a simplified policy-year-${term} Accumulation Units Account credit.`,
        'The published qualification conditions and exact insurer-side payout timing remain informational only in V1.',
      ],
      sourceRefs: [page5],
    })
  }

  const wellnessRate = WELLNESS_BONUS_RATE_BY_TERM[term]
  if (wellnessRate > 0) {
    bonuses.push({
      id: 'wellness-bonus',
      type: 'custom',
      label: 'Wellness Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: term + 5,
      endPolicyYear: term + 5,
      rate: wellnessRate,
      amount: null,
      tieredRates: [],
      notes: [
        `Models the published ${(wellnessRate * 100).toFixed(2)}% Wellness Bonus for the SGD ${term}-year minimum contribution corridor as a simplified policy-year-${term + 5} Accumulation Units Account credit.`,
        'The published fully-paid / no-premium-holiday / no-regular-premium-reduction / no-Accumulation-Units-Account-withdrawal / no-claim qualification conditions and the delayed-payout basis remain informational only in V1.',
      ],
      sourceRefs: [page6],
    })
  }

  return bonuses
}

function buildBonusWarning(term: SupportedTerm): string {
  const loyaltyRate = LOYALTY_BONUS_RATE_BY_TERM[term]
  const achievementRate = ACHIEVEMENT_BONUS_RATE_BY_TERM[term]
  const wellnessRate = WELLNESS_BONUS_RATE_BY_TERM[term]

  if (loyaltyRate === 0 && achievementRate === 0 && wellnessRate === 0) {
    return `The SGD ${term}-year minimum-contribution corridor publishes no Loyalty Bonus, a 0.00% Achievement Bonus, and a 0.00% Wellness Bonus rate, so those mechanics are not carried as active residual mechanics in V1.`
  }

  if (loyaltyRate === 0 && achievementRate === 0) {
    return `The core ${(wellnessRate * 100).toFixed(2)}% Wellness Bonus amount for the SGD ${term}-year minimum-contribution corridor is modeled as a simplified policy-year-${term + 5} Accumulation Units Account credit. The published fully-paid / no-premium-holiday / no-regular-premium-reduction / no-Accumulation-Units-Account-withdrawal / no-claim qualification conditions and the source-stated delayed payout basis remain informational only. On this corridor, Loyalty Bonus is N.A. and Achievement Bonus is 0.00%, so they are not carried as active residual mechanics in V1.`
  }

  return `The core ${(loyaltyRate * 100).toFixed(2)}% Loyalty Bonus, ${(achievementRate * 100).toFixed(2)}% Achievement Bonus, and ${(wellnessRate * 100).toFixed(2)}% Wellness Bonus amounts for the SGD ${term}-year minimum-contribution corridor are modeled as simplified Accumulation Units Account credits at the published policy-year windows. The published fully-paid / no-premium-holiday / no-regular-premium-reduction / no-Accumulation-Units-Account-withdrawal / no-claim qualification conditions and the source-stated delayed payout basis remain informational only.`
}

function buildMainWarning(term: SupportedTerm): string {
  const bonusClause = term >= 15
    ? `, the published 1.20% Loyalty Bonus from policy years 11 to ${term}, a simplified policy-year-${term} Achievement Bonus credit for the published 3.50% core bonus amount, and a simplified policy-year-${term + 5} Wellness Bonus credit for the published ${(WELLNESS_BONUS_RATE_BY_TERM[term] * 100).toFixed(2)}% core bonus amount`
    : term === 10
      ? ', and a simplified policy-year-15 Wellness Bonus credit for the published 3.50% core bonus amount while Loyalty Bonus is N.A. and Achievement Bonus is 0.00%'
      : ', and the published no-Loyalty-Bonus / zero-Achievement-Bonus / zero-Wellness-Bonus residual corridor'

  return `#goAssure is cataloged as a supported V1 corridor. The parser captures the SGD ${term}-year cash corridor: three-account regular-premium / top-up routing, the published Initial Bonus corridor for policy years 1 to 4 via manual initial basic sum assured at issue bands, the published initial-charge schedule, the premium-base policy charge during MIP, recurring-single-premium and top-up charges, the modeled Monthly Protection Charge corridors for Death basic sum at risk and TPD sum at risk using the published smoker-specific rate tables plus manual current Basic Sum Assured / Protection Age / TPD acceleration ratio inputs, the partial-withdrawal charge schedule, the premium-shortfall charge schedules, the ${term}-year surrender-charge table${bonusClause}, the current-state death-benefit estimate before and after Protection Age via manual current Protection Age / amount-owing / basic-sum-assured inputs, the current terminal-illness snapshot as the lower of that current death corridor and a manual remaining aggregate TI cap, the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, the current TPD benefit estimate before Protection Age via the same current death corridor plus a manual current TPD acceleration ratio and remaining aggregate TPD cap, and the manual distribution-mode assumption support.`
}

function buildVariant(document: ExtractedPdfDocument, term: SupportedTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan description and account model', snippetNear(document, 1, '#goAssure', 22))
  const page5 = sourceRef(5, 'Waiver and distribution rules', snippetNear(document, 5, 'Dividend Distribution', 24))
  const page8 = sourceRef(8, 'Regular premium routing and minimum premiums', snippetNear(document, 8, 'Regular premium due during the first 48 months', 24))
  const page13 = sourceRef(13, 'Initial Charge', snippetNear(document, 13, 'Initial Charge', 22))
  const page14 = sourceRef(14, 'Policy Charge and premium charge', snippetNear(document, 14, 'Policy Charge', 26))
  const page15 = sourceRef(15, 'Premium Shortfall Charge', snippetNear(document, 15, 'Premium Shortfall Charge', 30))
  const page23 = sourceRef(23, 'Appendix A surrender and withdrawal charges', snippetNear(document, 23, 'Surrender Charge', 26))
  const page24 = sourceRef(24, 'Appendix A partial withdrawal and shortfall charge', snippetNear(document, 24, 'Partial Withdrawal Charge', 26))

  const premiumWindowChargeSchedule = buildPremiumWindowChargeSchedule(term)
  const minimumRegularPremiumAmountByFrequency = MINIMUM_REGULAR_PREMIUM_BY_TERM[term]

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
      sourceRefs: [page8, page14],
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
      sourceRefs: [page8, page14],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      manualWaiverMode: 'capped-free-event',
      manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
      manualWaiverMaxGrantCount: 3,
      freeEventCount: 3,
      freeEventMaxAmountRate: 0.15,
      freeEventMaxAmountBasis: 'open-balance',
      rate: 0,
      rateSchedule: premiumWindowChargeSchedule.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies only to partial withdrawals from the Accumulation Units Account during the minimum contribution period.',
        'Cash dividend payouts after the minimum contribution period are not subject to partial withdrawal charge.',
        'Dividend cash payouts are modeled separately from partial withdrawals in V1.',
        'When Tokio approves the hospitalisation or involuntary-unemployment waiver, mark the qualifying withdrawal event chargeWaived and, if the same approval also covers a premium-holiday or regular-premium-reduction event, reuse the same chargeWaiverGrantId.',
        'The modeled waiver corridor honors the published up-to-15%-of-prevailing-Accumulation-Units-Account partial-withdrawal charge waiver and the shared three-grants-per-lifetime limit across the qualifying charge-waived event family.',
      ],
      sourceRefs: [page5, page23, page24],
    },
    {
      id: 'premium-shortfall-charge-non-payment',
      label: 'Premium Shortfall Charge (Non-payment)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
      manualWaiverMaxGrantCount: 3,
      manualWaiverMaxOverlapMonths: 12,
      rate: 0,
      rateSchedule: premiumWindowChargeSchedule.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-goassure-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge during premium holiday after the first four policy years.',
        'Deducts from the Accumulation Units Account first, then the Initial Units Account and/or Top-up Units Account if needed.',
        'When Tokio approves the hospitalisation or involuntary-unemployment waiver, mark the qualifying premium-holiday event chargeWaived and, if the same approval also covers a qualifying partial withdrawal, reuse the same chargeWaiverGrantId.',
        'The modeled waiver corridor honors the published up-to-12-month premium-shortfall-charge waiver and the shared three-grants-per-lifetime limit across the qualifying charge-waived event family.',
      ],
      sourceRefs: [page15, page24],
    },
    {
      id: 'premium-shortfall-charge-reduction',
      label: 'Premium Shortfall Charge (Regular Premium Reduction)',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
      manualWaiverMaxGrantCount: 3,
      manualWaiverMaxOverlapMonths: 12,
      rate: 0,
      rateSchedule: premiumWindowChargeSchedule.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-goassure-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when annualised regular premium is reduced below the commencement-date commitment after the first four policy years.',
        'When both premium holiday and premium reduction apply, the higher amount is imposed.',
        'When Tokio approves the hospitalisation or involuntary-unemployment waiver, mark the qualifying regular-premium-reduction event chargeWaived and, if the same approval also covers a qualifying partial withdrawal, reuse the same chargeWaiverGrantId.',
        'The modeled waiver corridor honors the published up-to-12-month premium-shortfall-charge waiver and the shared three-grants-per-lifetime limit across the qualifying charge-waived event family.',
      ],
      sourceRefs: [page15, page24],
    },
  ]

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipLength: term,
    icpMonths: 48,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page8, page13],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page1, page8, page14, page15],
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
        sourceRefs: [page1, page8, page14],
      },
    ],
    bonuses: buildBonuses(term, document),
    feeRules: buildFeeRules(term, document),
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 49,
      minimumRegularPremiumAmountByFrequency,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: term,
          accountIds: ['accumulation', 'topup'],
        },
        {
          startPolicyYear: term + 1,
          endPolicyYear: null,
          accountIds: ['initial', 'accumulation', 'topup'],
        },
      ],
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'During the minimum contribution period, dividends from the Initial Units Account are automatically reinvested.',
        'During the minimum contribution period, cash payout may be received from the Accumulation Units Account and Top-up Units Account.',
        'After the minimum contribution period, cash payout may be received from the Initial Units Account, Accumulation Units Account, and Top-up Units Account.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
        'Distribution-option changes should be submitted at least 30 days before the Record Date.',
      ],
      sourceRefs: [page5],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE_BY_TERM[term]],
    warnings: [
      buildMainWarning(term),
      'Dividend cash payouts are partially modeled through the manual distribution-mode assumption surface: during the minimum contribution period, Initial Units Account dividends stay reinvested while Accumulation Units Account and Top-up Units Account dividends may be paid in cash; after the minimum contribution period, Initial Units Account dividends join the cash-payout corridor; distribution-option changes should be submitted at least 30 days before the Record Date; and the published $50 per-dividend minimum payout threshold remains informational only.',
      'Explicit regular-premium variation now honors the published after-first-four-policy-years start gate and the SGD minimum regular premium table for annual / semi-annual / quarterly / monthly payment modes. Tokio-defined minimum increase / reduction amounts remain informational only.',
      'Recurring single premium events before policy month 13 or below the published monthly-equivalent minimum of S$50 are blocked; the published maximum recurring single premium table and insurer-defined increase / reduction minimums remain informational only.',
      'Use the charge waiver toggle on qualifying Accumulation Units Account partial withdrawals, premium holidays, or regular-premium reductions only after Tokio has approved the hospitalisation or involuntary-unemployment waiver. The engine now honors the published up-to-15%-of-Accumulation-Units-Account withdrawal cap, the up-to-12-month premium-shortfall-charge waiver cap, and the shared three-grants-per-lifetime limit when related approved events share the same chargeWaiverGrantId; the published 90-day application timing, proof requirements, exclusions, and first-assured coverage remain informational only.',
      buildBonusWarning(term),
      'The modeled Initial Bonus corridor still needs the initial basic sum assured at issue because the commencement-date sum-assured bands are not reconstructed from current state in V1.',
      'The current-state death-benefit estimate needs manual current Protection Age, current amount owing, and, after Protection Age, current basic sum assured inputs because protection-age elections and withdrawal-adjusted basic-sum-assured history are not reconstructed in V1.',
      'The current terminal-illness snapshot also needs a manual remaining aggregate TI cap because cross-policy TI-limit usage is not reconstructed from history in V1.',
      'The current TPD benefit estimate before Protection Age also needs a manual current TPD acceleration ratio plus a manual remaining aggregate TPD cap because the TPD rider sum assured and cross-policy TPD-limit usage are not reconstructed from history in V1.',
    ],
    unsupportedItems: [
      'Waiver approval timing, hospitalisation / retrenchment proof, medical and unemployment exclusions, first-assured coverage, and Tokio’s discretionary variation of benefit grant counts remain informational only beyond the modeled explicit chargeWaived plus optional shared chargeWaiverGrantId event path.',
      'Guaranteed Extra Protection, terminal-illness exclusions / settlement, post-TPD continuation state, and broader protection-side claim behavior remain informational only beyond the modeled Monthly Protection Charge, current TI snapshot, and current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today.',
      'Credit-card charge, administrative charge nil surface, policy-currency-change charge nil surface, and third-party charges remain informational only.',
      'The published $50 per-dividend minimum payout threshold, plus detailed dividend-payment processing and settlement handling, remain informational only.',
    ],
    sourceRefs: [page1, page5, page8, page13, page14, page15, page23, page24],
  }
}

export function parseTokioMarineGoAssure(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goassure',
    insurer: 'Tokio Marine',
    productName: '#goAssure',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:tokio-marine-goassure-initial-bonus',
      'branch:tokio-marine-goassure-initial-charge',
      'branch:tokio-marine-goassure-policy-charge',
      'branch:tokio-marine-goassure-monthly-protection-charge',
      'branch:tokio-marine-goassure-recurring-single-and-top-up-charge',
      'branch:tokio-marine-goassure-partial-withdrawal-charge',
      'branch:tokio-marine-goassure-premium-shortfall-charge',
      'branch:tokio-marine-goassure-surrender-charge',
      'branch:tokio-marine-goassure-loyalty-bonus',
      'branch:tokio-marine-goassure-achievement-bonus',
      'branch:tokio-marine-goassure-wellness-bonus',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events',
      'kernel:free-withdrawal-event-cap',
      'kernel:manual-charge-waiver-grant-limits',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-tpd-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: ['tokio-marine-goassure-third-party-charges'],
    metadataOnlyBehaviors: [
      'tokio-marine-goassure-waiver-approval-gating-and-limits',
      'tokio-marine-goassure-guaranteed-extra-protection',
      'tokio-marine-goassure-dividend-payout-threshold',
    ],
    warnings: [
      '#goAssure is cataloged as a supported V1 family. The current parser covers the SGD 5-year, 10-year, 15-year, 20-year, and 25-year cash corridors: corridor-specific Initial Bonus tables, initial-charge schedules, policy-charge end years, partial-withdrawal / premium-shortfall / surrender-charge schedules, minimum regular premium floors, Loyalty / Achievement / Wellness Bonus schedules where published, the Monthly Protection Charge corridors for Death basic sum at risk and TPD sum at risk using the published smoker-specific rate tables plus manual current Basic Sum Assured / Protection Age / TPD acceleration ratio inputs, the current-state death-benefit estimate before and after Protection Age via manual current Protection Age / amount-owing / basic-sum-assured inputs, the current terminal-illness snapshot as the lower of that current death corridor and a manual remaining aggregate TI cap, the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, the current TPD benefit estimate before Protection Age via the same current death corridor plus a manual current TPD acceleration ratio and remaining aggregate TPD cap, and distribution-mode assumption support, including phase-specific dividend cash-payout account eligibility and the 30-day record-date instruction lead time, while the published $50 per-dividend minimum payout threshold, bonus qualification and delayed-payout administration, waiver mechanics, terminal-illness exclusions / settlement, post-TPD continuation state, Guaranteed Extra Protection, and broader protection-side claim behavior remain informational only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(context.document, term)),
  }
}
