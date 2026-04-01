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

const TERM_OPTIONS = [
  15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
] as const

type SupportedTerm = (typeof TERM_OPTIONS)[number]
type DeathBenefitOption = 'basic-death' | 'advanced-death' | 'advanced-death-life-benefit-rider'

const PREMIUM_BANDS: Array<Pick<IlpTemplateBonusTier, 'currency' | 'minAnnualPremium' | 'maxAnnualPremium'>> = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: 11_999.99 },
  { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99 },
  { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99 },
  { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99 },
  { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null },
]

const INITIAL_BONUS_RATE_BY_TERM_GROUP = {
  '15-19': [0.5, 0.57, 0.64, 0.71, 0.75],
  '20-24': [0.6, 0.79, 0.9, 0.93, 0.95],
  '25': [0.85, 1, 1.17, 1.23, 1.3],
  '26-27': [0.86, 1.01, 1.2, 1.25, 1.32],
  '28-29': [0.88, 1.03, 1.24, 1.26, 1.35],
  '30': [1, 1.2, 1.35, 1.4, 1.48],
} as const

const LOYALTY_BONUS_POLICY_YEARS_3_TO_10_RATES = [0.007, 0.007, 0.007, 0.007, 0.0075] as const
const LOYALTY_BONUS_POLICY_YEAR_11_ONWARD_RATES = [0.0092, 0.0092, 0.0098, 0.0099, 0.0099] as const

const INITIAL_CHARGE_BASE_RATE_BY_TERM_GROUP = {
  '15': 0.0085,
  '16-19': 0.0075,
  '20': 0.0065,
  '21-24': 0.0055,
  '25-29': 0.0045,
  '30': 0.0035,
} as const

const ACHIEVEMENT_QUALIFICATION_RULES: NonNullable<IlpTemplateBonus['qualificationRules']> = [
  { trigger: 'premium-holiday', disqualifyThroughReferenceYear: true },
  { trigger: 'regular-premium-reduction', disqualifyThroughReferenceYear: true },
  { trigger: 'partial-withdrawal', disqualifyThroughReferenceYear: true },
]

const ACHIEVEMENT_MILESTONES_BY_TERM: Record<SupportedTerm, Array<{ policyYear: number, rate: number, id: string, label: string }>> = {
  15: [{ policyYear: 15, rate: 0.3, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  16: [{ policyYear: 16, rate: 0.34, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  17: [{ policyYear: 17, rate: 0.38, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  18: [{ policyYear: 18, rate: 0.42, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  19: [{ policyYear: 19, rate: 0.46, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  20: [{ policyYear: 20, rate: 0.5, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  21: [{ policyYear: 21, rate: 0.54, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  22: [{ policyYear: 22, rate: 0.58, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  23: [{ policyYear: 23, rate: 0.62, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  24: [{ policyYear: 24, rate: 0.66, id: 'achievement-bonus', label: 'Achievement Bonus' }],
  25: [
    { policyYear: 20, rate: 0.25, id: 'achievement-bonus-policy-year-20', label: 'Achievement Bonus (Policy Year 20)' },
    { policyYear: 25, rate: 0.5, id: 'achievement-bonus-end-of-mip', label: 'Achievement Bonus (End of Premium Payment Term)' },
  ],
  26: [
    { policyYear: 20, rate: 0.25, id: 'achievement-bonus-policy-year-20', label: 'Achievement Bonus (Policy Year 20)' },
    { policyYear: 26, rate: 0.5, id: 'achievement-bonus-end-of-mip', label: 'Achievement Bonus (End of Premium Payment Term)' },
  ],
  27: [
    { policyYear: 20, rate: 0.25, id: 'achievement-bonus-policy-year-20', label: 'Achievement Bonus (Policy Year 20)' },
    { policyYear: 27, rate: 0.5, id: 'achievement-bonus-end-of-mip', label: 'Achievement Bonus (End of Premium Payment Term)' },
  ],
  28: [
    { policyYear: 20, rate: 0.05, id: 'achievement-bonus-policy-year-20', label: 'Achievement Bonus (Policy Year 20)' },
    { policyYear: 25, rate: 0.25, id: 'achievement-bonus-policy-year-25', label: 'Achievement Bonus (Policy Year 25)' },
    { policyYear: 28, rate: 0.5, id: 'achievement-bonus-end-of-mip', label: 'Achievement Bonus (End of Premium Payment Term)' },
  ],
  29: [
    { policyYear: 20, rate: 0.05, id: 'achievement-bonus-policy-year-20', label: 'Achievement Bonus (Policy Year 20)' },
    { policyYear: 25, rate: 0.25, id: 'achievement-bonus-policy-year-25', label: 'Achievement Bonus (Policy Year 25)' },
    { policyYear: 29, rate: 0.5, id: 'achievement-bonus-end-of-mip', label: 'Achievement Bonus (End of Premium Payment Term)' },
  ],
  30: [
    { policyYear: 20, rate: 0.1, id: 'achievement-bonus-policy-year-20', label: 'Achievement Bonus (Policy Year 20)' },
    { policyYear: 25, rate: 0.25, id: 'achievement-bonus-policy-year-25', label: 'Achievement Bonus (Policy Year 25)' },
    { policyYear: 30, rate: 0.5, id: 'achievement-bonus-end-of-mip', label: 'Achievement Bonus (End of Premium Payment Term)' },
  ],
}

const SURRENDER_CHARGE_ROWS_15_TO_20: Array<Array<number | null>> = [
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.91, 0.93, 0.95, 0.96, 0.97, 0.97],
  [0.84, 0.87, 0.89, 0.9, 0.92, 0.94],
  [0.76, 0.8, 0.84, 0.87, 0.89, 0.91],
  [0.68, 0.73, 0.76, 0.8, 0.83, 0.87],
  [0.6, 0.64, 0.68, 0.72, 0.75, 0.83],
  [0.5, 0.56, 0.62, 0.67, 0.72, 0.79],
  [0.43, 0.5, 0.56, 0.62, 0.67, 0.72],
  [0.34, 0.42, 0.49, 0.55, 0.61, 0.65],
  [0.26, 0.34, 0.42, 0.49, 0.56, 0.59],
  [0.15, 0.25, 0.34, 0.42, 0.5, 0.54],
  [null, 0.15, 0.25, 0.35, 0.44, 0.48],
  [null, null, 0.15, 0.27, 0.37, 0.41],
  [null, null, null, 0.15, 0.27, 0.33],
  [null, null, null, null, 0.15, 0.24],
  [null, null, null, null, null, 0.15],
]

const SURRENDER_CHARGE_ROWS_21_TO_30: Array<Array<number | null>> = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.97, 0.97, 0.98, 0.98, 0.98, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.95, 0.96, 0.96, 0.96, 0.96, 0.96, 0.97, 0.98, 0.98, 0.98],
  [0.92, 0.93, 0.93, 0.93, 0.94, 0.94, 0.95, 0.97, 0.97, 0.97],
  [0.88, 0.89, 0.9, 0.91, 0.92, 0.93, 0.94, 0.95, 0.95, 0.96],
  [0.85, 0.87, 0.89, 0.9, 0.9, 0.91, 0.92, 0.93, 0.94, 0.95],
  [0.81, 0.83, 0.85, 0.87, 0.88, 0.89, 0.9, 0.91, 0.92, 0.94],
  [0.75, 0.78, 0.8, 0.82, 0.85, 0.87, 0.88, 0.89, 0.91, 0.93],
  [0.69, 0.73, 0.76, 0.79, 0.83, 0.84, 0.86, 0.87, 0.89, 0.91],
  [0.63, 0.68, 0.73, 0.77, 0.8, 0.82, 0.84, 0.86, 0.87, 0.89],
  [0.58, 0.63, 0.68, 0.73, 0.77, 0.79, 0.81, 0.83, 0.85, 0.87],
  [0.52, 0.59, 0.65, 0.71, 0.73, 0.75, 0.78, 0.8, 0.83, 0.86],
  [0.46, 0.51, 0.58, 0.64, 0.69, 0.72, 0.74, 0.77, 0.8, 0.83],
  [0.39, 0.47, 0.54, 0.61, 0.65, 0.68, 0.71, 0.74, 0.77, 0.81],
  [0.32, 0.4, 0.48, 0.55, 0.6, 0.63, 0.67, 0.7, 0.74, 0.78],
  [0.23, 0.32, 0.41, 0.49, 0.54, 0.58, 0.62, 0.66, 0.7, 0.76],
  [0.15, 0.24, 0.33, 0.42, 0.48, 0.53, 0.57, 0.62, 0.67, 0.72],
  [null, 0.15, 0.24, 0.34, 0.41, 0.47, 0.53, 0.58, 0.63, 0.68],
  [null, null, 0.15, 0.25, 0.33, 0.4, 0.47, 0.53, 0.59, 0.63],
  [null, null, null, 0.15, 0.24, 0.31, 0.4, 0.47, 0.54, 0.58],
  [null, null, null, null, 0.15, 0.23, 0.32, 0.41, 0.49, 0.53],
  [null, null, null, null, null, 0.15, 0.23, 0.33, 0.42, 0.46],
  [null, null, null, null, null, null, 0.15, 0.24, 0.34, 0.39],
  [null, null, null, null, null, null, null, 0.15, 0.25, 0.31],
  [null, null, null, null, null, null, null, null, 0.15, 0.24],
  [null, null, null, null, null, null, null, null, null, 0.15],
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

function buildTieredRates(rates: readonly number[]): IlpTemplateBonusTier[] {
  return PREMIUM_BANDS.map((band, index) => ({
    ...band,
    rate: rates[index] ?? rates[rates.length - 1] ?? 0,
  }))
}

function getInitialBonusRates(term: SupportedTerm): readonly number[] {
  if (term <= 19) return INITIAL_BONUS_RATE_BY_TERM_GROUP['15-19']
  if (term <= 24) return INITIAL_BONUS_RATE_BY_TERM_GROUP['20-24']
  if (term === 25) return INITIAL_BONUS_RATE_BY_TERM_GROUP['25']
  if (term <= 27) return INITIAL_BONUS_RATE_BY_TERM_GROUP['26-27']
  if (term <= 29) return INITIAL_BONUS_RATE_BY_TERM_GROUP['28-29']
  return INITIAL_BONUS_RATE_BY_TERM_GROUP['30']
}

function getInitialChargeBaseRate(term: SupportedTerm): number {
  if (term === 15) return INITIAL_CHARGE_BASE_RATE_BY_TERM_GROUP['15']
  if (term <= 19) return INITIAL_CHARGE_BASE_RATE_BY_TERM_GROUP['16-19']
  if (term === 20) return INITIAL_CHARGE_BASE_RATE_BY_TERM_GROUP['20']
  if (term <= 24) return INITIAL_CHARGE_BASE_RATE_BY_TERM_GROUP['21-24']
  if (term <= 29) return INITIAL_CHARGE_BASE_RATE_BY_TERM_GROUP['25-29']
  return INITIAL_CHARGE_BASE_RATE_BY_TERM_GROUP['30']
}

function buildInitialChargeRateSchedule(term: SupportedTerm): Array<{ startPolicyYear: number, endPolicyYear: number, rate: number }> {
  const baseRate = getInitialChargeBaseRate(term)
  return Array.from({ length: term }, (_, index) => {
    const policyYear = index + 1
    return {
      startPolicyYear: policyYear,
      endPolicyYear: policyYear,
      rate: Number((baseRate * policyYear).toFixed(4)),
    }
  })
}

function buildSurrenderChargeTable(term: SupportedTerm): number[] {
  const rows = term <= 20 ? SURRENDER_CHARGE_ROWS_15_TO_20 : SURRENDER_CHARGE_ROWS_21_TO_30
  const columnIndex = term <= 20 ? term - 15 : term - 21
  return rows
    .map((row) => row[columnIndex])
    .filter((rate): rate is number => rate != null)
}

function buildAchievementBonuses(
  term: SupportedTerm,
  page5: IlpCatalogSourceRef,
  page6: IlpCatalogSourceRef,
): IlpTemplateBonus[] {
  return ACHIEVEMENT_MILESTONES_BY_TERM[term].map((milestone) => ({
    id: milestone.id,
    type: 'custom',
    label: milestone.label,
    mode: 'one-time',
    oneTimePayoutBasis: 'committed-annual-premium-at-issue',
    appliesTo: ['accumulation'],
    startPolicyYear: milestone.policyYear,
    endPolicyYear: milestone.policyYear,
    rate: milestone.rate,
    amount: null,
    tieredRates: [],
    qualificationRules: ACHIEVEMENT_QUALIFICATION_RULES.map((rule) => ({ ...rule })),
    notes: [
      `Models the published achievement bonus for the SGD ${term}-year premium payment term as ${(milestone.rate * 100).toFixed(2)}% of annualised regular premium committed at commencement date at the end of policy year ${milestone.policyYear}${milestone.policyYear === term ? ' (the end of the premium payment term)' : ''}.`,
      'The bonus is disqualified if any premium holiday, regular-premium reduction, or partial withdrawal from the Accumulation Units Account occurs before the end of that eligible policy year.',
      'The bonus is allocated to the Accumulation Units Account using the latest investment allocation instructions on the next pricing day after the policy anniversary.',
    ],
    sourceRefs: [page5, page6],
  }))
}

function buildInitialBonusBonuses(term: SupportedTerm, page4: IlpCatalogSourceRef): IlpTemplateBonus[] {
  const publishedRates = getInitialBonusRates(term)
  const cappedRates = publishedRates.map((rate) => Math.min(rate, 1))
  const residualRates = publishedRates.map((rate) => Number(Math.max(0, rate - 1).toFixed(4)))
  const hasResidualLayer = residualRates.some((rate) => rate > 0)

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'initial-bonus',
      type: 'allocation',
      label: 'Initial Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 2,
      rate: null,
      amount: null,
      tieredRates: buildTieredRates(cappedRates),
      notes: [
        `Tier is based on the published SGD annualised regular premium band for the selected ${term}-year premium payment term.`,
        'Allocated to the Initial Units Account upon each regular premium received in the first two policy years.',
      ],
      sourceRefs: [page4],
    },
  ]

  if (hasResidualLayer) {
    bonuses.push({
      id: 'initial-bonus-excess',
      type: 'allocation',
      label: 'Initial Bonus (Excess Rate Layer)',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 2,
      rate: null,
      amount: null,
      tieredRates: buildTieredRates(residualRates),
      notes: [
        'Captures the published initial-bonus percentages above 100% as an additional allocation layer for the higher SGD premium bands.',
        'Allocated to the Initial Units Account together with the base Initial Bonus upon each regular premium received in the first two policy years.',
      ],
      sourceRefs: [page4],
    })
  }

  return bonuses
}

function buildBonuses(document: ExtractedPdfDocument, term: SupportedTerm): IlpTemplateBonus[] {
  const page4 = sourceRef(4, 'Initial Bonus', snippetNear(document, 4, 'Initial Bonus', 22))
  const page5 = sourceRef(5, 'Loyalty Bonus / Achievement Bonus', snippetNear(document, 5, 'Loyalty Bonus', 36))
  const page6 = sourceRef(6, 'Achievement Bonus', snippetNear(document, 6, 'Achievement Bonus', 24))

  return [
    ...buildInitialBonusBonuses(term, page4),
    {
      id: 'loyalty-bonus-policy-years-3-10',
      type: 'loyalty',
      label: 'Loyalty Bonus (Policy Years 3-10)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 3,
      endPolicyYear: 10,
      rate: null,
      amount: null,
      tieredRates: buildTieredRates(LOYALTY_BONUS_POLICY_YEARS_3_TO_10_RATES),
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 3 to the end of policy year 10.',
        'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [page5],
    },
    {
      id: 'loyalty-bonus-policy-years-11-through-mip',
      type: 'loyalty',
      label: `Loyalty Bonus (Policy Years 11-${term})`,
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 11,
      endPolicyYear: term,
      rate: null,
      amount: null,
      tieredRates: buildTieredRates(LOYALTY_BONUS_POLICY_YEAR_11_ONWARD_RATES),
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: [
        `Models the published annual loyalty bonus on the Accumulation Units Account value from the end of policy year 11 to the end of the ${term}-year premium payment term.`,
        'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
      ],
      sourceRefs: [page5],
    },
    ...buildAchievementBonuses(term, page5, page6),
    {
      id: 'loyalty-bonus-after-mip',
      type: 'loyalty',
      label: 'Loyalty Bonus (After Premium Payment Term)',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: term + 1,
      endPolicyYear: null,
      rate: null,
      amount: null,
      tieredRates: buildTieredRates(LOYALTY_BONUS_POLICY_YEAR_11_ONWARD_RATES),
      notes: [
        'Models the published annual loyalty bonus on the Accumulation Units Account value after the premium payment term using the policy year 11 onward loyalty bonus rate table without the adjustment-factor multiplier.',
      ],
      sourceRefs: [page5],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument, term: SupportedTerm): IlpTemplateFeeRule[] {
  const page11 = sourceRef(11, 'Initial Charge', snippetNear(document, 11, 'Initial Charge', 24))
  const page12 = sourceRef(12, 'Policy Charge', snippetNear(document, 12, 'Policy Charge', 24))
  const initialChargeBaseRate = getInitialChargeBaseRate(term)

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
        `Models the published monthly initial charge for the selected SGD ${term}-year term as ${(initialChargeBaseRate * 100).toFixed(2)}% p.a. multiplied by the current policy year.`,
      ],
      sourceRefs: [page11],
    },
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      activeWindow: 'during-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: term, mode: 'policy-year' },
        ],
      },
      notes: [
        `Models the published monthly policy charge during the ${term}-year premium payment term using annualised regular premium committed at commencement date multiplied by the current policy year.`,
      ],
      sourceRefs: [page12],
    },
    {
      id: 'policy-charge-after-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      activeWindow: 'after-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: term + 1, endPolicyYear: null, mode: 'fixed', multiplier: term },
        ],
      },
      notes: [
        `Models the published monthly policy charge after the premium payment term using the fixed ${term}-year multiplier.`,
      ],
      sourceRefs: [page12],
    },
  ]
}

function buildTokioMpcFeeRule(
  optionPage: IlpCatalogSourceRef,
  chargePage: IlpCatalogSourceRef,
  tablePage: IlpCatalogSourceRef,
  term: SupportedTerm,
  withLifeBenefitRider = false,
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
    activeWindow: withLifeBenefitRider ? 'policy-term' : 'during-mip',
    assuranceConfig: {
      formula: 'tokio-mpc-net-premium-floor',
      rateTable: 'tokio-mpc-unzo-death',
      monthlyModalFactor: 1,
      maxAgeNextBirthday: 99,
      accrual: {
        startPolicyYear: 1,
        endPolicyYear: 2,
        settlementPolicyYear: 3,
      },
    },
    requiresManualInput: true,
    notes: [
      withLifeBenefitRider
        ? 'Models the published Monthly Protection Charge for the Advanced Death with Life Benefit Rider corridor through the policy anniversary immediately after age 99.'
        : `Models the published Monthly Protection Charge for the Advanced Death corridor during the ${term}-year premium payment term.`,
      'The Monthly Protection Charge for policy years 1 to 2 is accrued and collected in one lump sum in policy year 3.',
      'Sum at risk is the published net premium less 101% of the Initial Units Account value and 101% of the Accumulation Units Account value, floored at zero.',
      'The charge is deducted monthly in advance from the Accumulation Units Account, with outstanding amounts deducted from the Initial Units Account and/or Top-up Units Account if needed.',
      ...(withLifeBenefitRider
        ? ['For policies with more than one life assured, the rider terminates on the policy anniversary immediately after the 99th birthday of the youngest life assured.']
        : []),
    ],
    sourceRefs: [optionPage, chargePage, tablePage],
  }
}

function buildVariant(
  document: ExtractedPdfDocument,
  term: SupportedTerm,
  deathBenefitOption: DeathBenefitOption,
): IlpTemplateVariant {
  const isAdvancedDeath = deathBenefitOption !== 'basic-death'
  const hasLifeBenefitRider = deathBenefitOption === 'advanced-death-life-benefit-rider'
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, '#goAffluence', 18))
  const page4 = sourceRef(4, 'Initial Bonus', snippetNear(document, 4, 'Initial Bonus', 22))
  const page7 = sourceRef(7, 'Regular Premium and Recurring Single Premium', snippetNear(document, 7, 'Regular premium due during the first 24 months', 26))
  const page8 = sourceRef(8, 'Top-up Premium and Premium Holiday', snippetNear(document, 8, 'Premium Holiday', 18))
  const page9 = sourceRef(9, 'Partial Withdrawal and Regular Withdrawal', snippetNear(document, 9, 'Partial Withdrawal', 22))
  const page10 = sourceRef(10, 'Dividend Distribution', snippetNear(document, 10, 'Dividend Distribution', 22))
  const page11 = sourceRef(11, 'Initial Charge', snippetNear(document, 11, 'Initial Charge', 24))
  const page12 = sourceRef(12, 'Policy Charge and top-up charges', snippetNear(document, 12, 'Policy Charge', 28))
  const page17 = isAdvancedDeath
    ? sourceRef(17, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 17, 'Monthly Rates for Monthly Protection Charges', 24))
    : null
  const surrenderPage = term <= 20
    ? sourceRef(19, 'Appendix A Surrender Charge (Premium Payment Term 15-20 Years)', snippetNear(document, 19, 'Premium Payment Term: 15', 22))
    : sourceRef(18, 'Appendix A Surrender Charge (Premium Payment Term 21-30 Years)', snippetNear(document, 18, 'Premium Payment Term: 21', 24))

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
      sourceRefs: [page8, page12],
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
      sourceRefs: [page7, page12],
    },
  ]

  const feeRules = buildFeeRules(document, term)
  if (isAdvancedDeath && page17) {
    feeRules.push(buildTokioMpcFeeRule(page1, page12, page17, term, hasLifeBenefitRider))
  }

  return {
    id: deathBenefitOption === 'basic-death'
      ? `sgd-mip-${term}`
      : hasLifeBenefitRider
        ? `sgd-mip-${term}-advanced-death-life-benefit-rider`
        : `sgd-mip-${term}-advanced-death`,
    currency: 'SGD',
    mipLength: term,
    icpMonths: 24,
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
        sourceRefs: [page1, page7, page11],
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
        sourceRefs: [page1, page7, page12],
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
        sourceRefs: [page1, page7, page8],
      },
    ],
    bonuses: buildBonuses(document, term),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPremiumHolidayStartPolicyMonth: 25,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      requiresCommencementPremiumForRecurringSinglePremiumResumption: true,
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
      minimumAnnualPayoutAmount: 50,
      minimumAnnualPayoutCurrency: 'SGD',
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment unless the policyholder elects cash payout.',
        `During the ${term}-year premium payment term, only dividends from the Accumulation Units Account and Top-up Units Account may be paid in cash.`,
        'After the premium payment term, dividends from the Initial Units Account, Accumulation Units Account, and Top-up Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 minimum dividend amount are reinvested.',
        'Distribution-option instruction changes require at least 30 days before the Record Date.',
      ],
      sourceRefs: [page10],
    },
    eecTable: buildSurrenderChargeTable(term),
    warnings: [
      `This ${isAdvancedDeath ? 'supported' : 'partial'} template models the SGD / premium-payment-term-${term} (${hasLifeBenefitRider ? 'Advanced Death with Life Benefit Rider' : isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor only.`,
      `This ${isAdvancedDeath ? 'supported' : 'partial'} template models regular-premium routing through the ${term}-year payment term, the published term-specific initial bonus tiers, annual loyalty bonus, the published achievement-bonus milestone schedule for the selected term using the commencement-date annualised regular premium basis, the year-scaled initial charge schedule, the policy-charge premium-base multiplier basis, top-up routing, recurring single premium routing, the published ${term}-year surrender charge table, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.`,
      'The resident-corridor current accidental-death estimate before age 75 is also modeled on the published annualised regular premium band after you enter current age; premium-holiday and regular-premium-reduction history, 180-day timing, residency / Singapore-location claim gates, double-indemnity payout, and accidental-death last-life settlement remain informational only.',
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'The Advanced Death with Life Benefit Rider variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, static current multi-life last-life handling, oldest-life MPC rating, youngest-life rider age gating, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.'
              : 'The Advanced Death variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, static current multi-life last-life handling, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Recurring single premium events before policy month 13 or below the published monthly-equivalent minimum of S$50 are blocked; insurer-defined increase / reduction minimums remain informational only.',
      'Recurring single premium stays blocked during premium holiday until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the committed commencement-date amount.',
    ],
    unsupportedItems: [
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider termination / fallback handling, dependent medical / retrenchment benefits, and change-of-life-assured administration remain metadata-only for this product.'
              : 'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, together with Advanced Death Benefit with Life Benefit Rider, dependent medical / retrenchment benefits, and change-of-life-assured administration, remains metadata-only for this product.',
          ]
        : [
            'Advanced Death selection, Monthly Protection Charge, Advanced Death Benefit with Life Benefit Rider, dependent medical / retrenchment benefits, and change-of-life-assured administration remain metadata-only for this product.',
          ]),
      'The resident current accidental-death estimate before age 75 is modeled on the published annualised regular premium band, while double indemnity, 180-day timing, residency / Singapore-location claim gates, accidental-death last-life settlement, and premium-holiday / regular-premium-reduction history remain metadata-only for this product.',
      'Regular withdrawal, partial-withdrawal limit and minimum-account-value constraints, premium holiday state handling, and non-SGD variants remain metadata-only for this product.',
    ],
    sourceRefs: [page1, page4, page7, page8, page9, page10, page11, page12, surrenderPage, ...(page17 ? [page17] : [])],
  }
}

export function parseTokioMarineGoAffluence(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goaffluence',
    insurer: 'Tokio Marine',
    productName: '#goAffluence',
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
      'tokio-policy-charge-on-accumulation-account',
      'tokio-top-up-routing',
      'tokio-recurring-single-premium-routing',
      'tokio-recurring-single-premium-manual-resumption-after-premium-holiday',
      'kernel:minimum-premium-holiday-start-month',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'kernel:committed-premium-rsp-resumption-gate',
      'tokio-regular-premium-reduction-consumes-recurring-single-premium-first',
      'tokio-top-up-premium-charge',
      'tokio-recurring-single-premium-charge',
      'tokio-initial-account-surrender-charge',
      'branch:tokio-loyalty-bonus-adjustment-factor',
      'branch:tokio-goaffluence-achievement-bonus-premium-base-milestones',
      'branch:tokio-goaffluence-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts',
      'branch:tokio-current-only-multi-life-life-state',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'tokio-goaffluence-advanced-death-payout-life-benefit-rider-and-life-assured-administration',
      'tokio-goaffluence-accidental-death-claim-gates-and-premium-change-history',
      'tokio-goaffluence-regular-withdrawal-and-partial-withdrawal-constraints',
      'tokio-goaffluence-premium-holiday-and-non-sgd-variants',
    ],
    warnings: [
      '#goAffluence is cataloged as a supported V1 product. The parser captures the published SGD premium-payment-term family from 15 to 30 years across Basic Death, Advanced Death, and Advanced Death with Life Benefit Rider corridors with executable regular-premium routing, term-bucket initial bonus allocation, annual loyalty bonus with the published bounded adjustment-factor formula during the premium payment term and the flat post-term rate table thereafter, the term-specific achievement-bonus milestone schedule using the commencement-date annualised regular premium basis with milestone-year qualification gates, term-bucket initial-charge slopes, policy-charge premium-base multipliers, top-up and recurring-single-premium routing / charges, the commencement-date recurring-single-premium resumption gate after premium holiday, term-specific surrender mechanics, reinvest-default distribution support, and the resident-corridor current accidental-death estimate before age 75 on the published annualised regular premium band after current age is entered; the Advanced Death variant also models the published current death-benefit estimate and accrued Monthly Protection Charge corridor from insured-life inputs with static current multi-life last-life handling, and the Advanced Death with Life Benefit Rider variant extends that same corridor through the policy anniversary immediately after age 99 with oldest-life MPC rating and youngest-life rider age gating.',
      'Recurring single premium stays blocked after a premium-holiday event until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the commencement-date amount.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
      'Advanced-death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, accidental-death claim gating beyond the resident premium-band current-state shortcut, regular-withdrawal administration, partial-withdrawal limit and minimum-account-value constraints, and premium-holiday / non-SGD variants remain informational only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.flatMap((term) => [
      buildVariant(context.document, term, 'basic-death'),
      buildVariant(context.document, term, 'advanced-death'),
      buildVariant(context.document, term, 'advanced-death-life-benefit-rider'),
    ]),
  }
}
