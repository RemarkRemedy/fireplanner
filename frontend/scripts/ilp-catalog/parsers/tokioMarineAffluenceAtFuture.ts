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

const INITIAL_BONUS_RATE_BY_TERM_GROUP_AND_POLICY_YEAR = {
  '15-19': {
    1: [0.72, 0.8, 0.87, 0.95, 1],
    2: [0.52, 0.6, 0.67, 0.75, 0.78],
  },
  '20-24': {
    1: [0.88, 1.1, 1.2, 1.23, 1.28],
    2: [0.63, 0.9, 0.95, 0.98, 0.98],
  },
  '25': {
    1: [1.08, 1.25, 1.43, 1.48, 1.55],
    2: [0.88, 1.05, 1.22, 1.28, 1.32],
  },
  '26-27': {
    1: [1.08, 1.25, 1.43, 1.48, 1.55],
    2: [0.88, 1.05, 1.22, 1.28, 1.34],
  },
  '28-29': {
    1: [1.1, 1.26, 1.47, 1.49, 1.58],
    2: [0.9, 1.05, 1.26, 1.28, 1.37],
  },
  '30': {
    1: [1.23, 1.45, 1.58, 1.63, 1.72],
    2: [1, 1.2, 1.35, 1.4, 1.48],
  },
} as const

const LOYALTY_PERIOD_A_RATES = [0.007, 0.007, 0.007, 0.007, 0.0075] as const
const LOYALTY_PERIOD_B_RATES = [0.0092, 0.0092, 0.0098, 0.0099, 0.0099] as const
const LOYALTY_POLICY_YEARS_11_TO_15_RATES = [0.0155, 0.0155, 0.0161, 0.0162, 0.0162] as const
const LOYALTY_PERIOD_C_RATE_BY_TERM_GROUP = {
  '16-19': [0.0155, 0.0155, 0.0161, 0.0162, 0.0162],
  '20-24': [0.0148, 0.0148, 0.0154, 0.0155, 0.0155],
  '25-29': [0.0135, 0.0135, 0.0141, 0.0142, 0.0142],
  '30': [0.0125, 0.0125, 0.0131, 0.0132, 0.0132],
} as const

const INITIAL_CHARGE_BASE_RATE_BY_TERM_GROUP = {
  '15': 0.01,
  '16-19': 0.0085,
  '20': 0.007,
  '21-24': 0.006,
  '25-29': 0.0048,
  '30': 0.0036,
} as const

const SURRENDER_CHARGE_ROWS_15_TO_20: Array<Array<number | null>> = [
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.91, 0.93, 0.95, 0.96, 0.96, 0.97],
  [0.9, 0.9, 0.9, 0.92, 0.93, 0.94],
  [0.8, 0.85, 0.86, 0.89, 0.9, 0.91],
  [0.75, 0.78, 0.81, 0.86, 0.86, 0.87],
  [0.65, 0.73, 0.78, 0.81, 0.83, 0.85],
  [0.55, 0.65, 0.7, 0.78, 0.81, 0.83],
  [0.5, 0.6, 0.65, 0.7, 0.78, 0.8],
  [0.4, 0.5, 0.6, 0.65, 0.7, 0.75],
  [0.3, 0.4, 0.5, 0.6, 0.65, 0.7],
  [0.12, 0.3, 0.4, 0.5, 0.6, 0.65],
  [null, 0.12, 0.3, 0.4, 0.5, 0.55],
  [null, null, 0.12, 0.3, 0.4, 0.5],
  [null, null, null, 0.12, 0.3, 0.35],
  [null, null, null, null, 0.12, 0.25],
  [null, null, null, null, null, 0.12],
] as const

const SURRENDER_CHARGE_ROWS_21_TO_30: Array<Array<number | null>> = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.97, 0.97, 0.98, 0.98, 0.98, 0.99, 0.99, 0.99, 0.99, 0.99],
  [0.95, 0.96, 0.96, 0.96, 0.96, 0.98, 0.98, 0.98, 0.98, 0.98],
  [0.91, 0.93, 0.93, 0.93, 0.94, 0.96, 0.97, 0.97, 0.97, 0.97],
  [0.87, 0.89, 0.9, 0.91, 0.92, 0.94, 0.95, 0.95, 0.95, 0.96],
  [0.85, 0.87, 0.89, 0.9, 0.9, 0.92, 0.93, 0.94, 0.94, 0.95],
  [0.83, 0.85, 0.87, 0.88, 0.88, 0.9, 0.92, 0.94, 0.94, 0.94],
  [0.8, 0.83, 0.85, 0.86, 0.86, 0.88, 0.9, 0.92, 0.92, 0.93],
  [0.78, 0.8, 0.83, 0.84, 0.84, 0.86, 0.88, 0.9, 0.91, 0.92],
  [0.75, 0.78, 0.79, 0.81, 0.82, 0.84, 0.86, 0.88, 0.9, 0.91],
  [0.7, 0.75, 0.76, 0.78, 0.8, 0.82, 0.84, 0.86, 0.88, 0.9],
  [0.65, 0.7, 0.73, 0.74, 0.75, 0.8, 0.82, 0.84, 0.86, 0.88],
  [0.55, 0.65, 0.7, 0.7, 0.7, 0.75, 0.8, 0.82, 0.85, 0.86],
  [0.5, 0.55, 0.6, 0.65, 0.65, 0.7, 0.75, 0.8, 0.82, 0.84],
  [0.35, 0.5, 0.55, 0.6, 0.6, 0.65, 0.7, 0.75, 0.8, 0.82],
  [0.25, 0.35, 0.5, 0.55, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8],
  [0.12, 0.25, 0.35, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75],
  [null, 0.12, 0.25, 0.35, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
  [null, null, 0.12, 0.25, 0.35, 0.45, 0.5, 0.55, 0.6, 0.65],
  [null, null, null, 0.12, 0.25, 0.35, 0.45, 0.5, 0.55, 0.6],
  [null, null, null, null, 0.12, 0.25, 0.35, 0.45, 0.5, 0.55],
  [null, null, null, null, null, 0.12, 0.25, 0.35, 0.45, 0.5],
  [null, null, null, null, null, null, 0.12, 0.25, 0.35, 0.4],
  [null, null, null, null, null, null, null, 0.12, 0.25, 0.3],
  [null, null, null, null, null, null, null, null, 0.12, 0.25],
  [null, null, null, null, null, null, null, null, null, 0.09],
] as const

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

function getInitialBonusRates(term: SupportedTerm, policyYear: 1 | 2): readonly number[] {
  if (term <= 19) return INITIAL_BONUS_RATE_BY_TERM_GROUP_AND_POLICY_YEAR['15-19'][policyYear]
  if (term <= 24) return INITIAL_BONUS_RATE_BY_TERM_GROUP_AND_POLICY_YEAR['20-24'][policyYear]
  if (term === 25) return INITIAL_BONUS_RATE_BY_TERM_GROUP_AND_POLICY_YEAR['25'][policyYear]
  if (term <= 27) return INITIAL_BONUS_RATE_BY_TERM_GROUP_AND_POLICY_YEAR['26-27'][policyYear]
  if (term <= 29) return INITIAL_BONUS_RATE_BY_TERM_GROUP_AND_POLICY_YEAR['28-29'][policyYear]
  return INITIAL_BONUS_RATE_BY_TERM_GROUP_AND_POLICY_YEAR['30'][policyYear]
}

function getLoyaltyPeriodCRates(term: SupportedTerm): readonly number[] {
  if (term <= 19) return LOYALTY_PERIOD_C_RATE_BY_TERM_GROUP['16-19']
  if (term <= 24) return LOYALTY_PERIOD_C_RATE_BY_TERM_GROUP['20-24']
  if (term <= 29) return LOYALTY_PERIOD_C_RATE_BY_TERM_GROUP['25-29']
  return LOYALTY_PERIOD_C_RATE_BY_TERM_GROUP['30']
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
  const capPolicyYear = term - 5
  return Array.from({ length: term }, (_, index) => {
    const policyYear = index + 1
    return {
      startPolicyYear: policyYear,
      endPolicyYear: policyYear,
      rate: Number((baseRate * Math.min(policyYear, capPolicyYear)).toFixed(4)),
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

function buildInitialBonusBonuses(term: SupportedTerm, page2: IlpCatalogSourceRef): IlpTemplateBonus[] {
  const bonuses: IlpTemplateBonus[] = []

  for (const policyYear of [1, 2] as const) {
    const publishedRates = getInitialBonusRates(term, policyYear)
    const cappedRates = publishedRates.map((rate) => Math.min(rate, 1))
    const residualRates = publishedRates.map((rate) => Number(Math.max(0, rate - 1).toFixed(4)))
    const hasResidualLayer = residualRates.some((rate) => rate > 0)

    bonuses.push({
      id: `initial-bonus-policy-year-${policyYear}`,
      type: 'allocation',
      label: `Initial Bonus (Policy Year ${policyYear})`,
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: policyYear,
      endPolicyYear: policyYear,
      rate: null,
      amount: null,
      tieredRates: buildTieredRates(cappedRates),
      notes: [
        `Tier is based on the published SGD annualised regular premium band for the selected ${term}-year premium payment term in policy year ${policyYear}.`,
        'Rates are taken directly from the policy-year-specific published table that the brochure describes as inclusive of the additional first-year welcome bonus.',
        'Allocated to the Initial Units Account upon each regular premium received in the applicable policy year.',
      ],
      sourceRefs: [page2],
    })

    if (hasResidualLayer) {
      bonuses.push({
        id: `initial-bonus-policy-year-${policyYear}-excess`,
        type: 'allocation',
        label: `Initial Bonus (Policy Year ${policyYear} Excess Rate Layer)`,
        mode: 'premium-allocation',
        appliesTo: ['initial'],
        startPolicyYear: policyYear,
        endPolicyYear: policyYear,
        rate: null,
        amount: null,
        tieredRates: buildTieredRates(residualRates),
        notes: [
          `Captures the published policy-year-${policyYear} initial-bonus percentages above 100% as an additional allocation layer for the higher SGD premium bands.`,
          'Allocated to the Initial Units Account together with the base Initial Bonus on each regular premium received in the applicable policy year.',
        ],
        sourceRefs: [page2],
      })
    }
  }

  return bonuses
}

function buildBonuses(document: ExtractedPdfDocument, term: SupportedTerm): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 30))
  const loyaltyPage3 = sourceRef(3, 'Loyalty Bonus', snippetNear(document, 3, 'Loyalty Bonus', 40))
  const loyaltyPage4 = sourceRef(4, 'Loyalty Bonus', snippetNear(document, 4, 'Period A', 36))
  const loyaltyPage5 = sourceRef(5, 'Loyalty Bonus', snippetNear(document, 5, 'ii) The loyalty bonus rate payable from policy year 41 onwards', 14))

  const bonuses: IlpTemplateBonus[] = [...buildInitialBonusBonuses(term, page2)]

  bonuses.push({
    id: 'loyalty-bonus-period-a',
    type: 'loyalty',
    label: 'Loyalty Bonus (Period A)',
    mode: 'annual-rate',
    appliesTo: ['accumulation'],
    startPolicyYear: 3,
    endPolicyYear: 10,
    rate: null,
    amount: null,
    tieredRates: buildTieredRates(LOYALTY_PERIOD_A_RATES),
    adjustmentFactorConfig: {
      formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
      withdrawalAccountIds: ['accumulation'],
    },
    notes: [
      'Models the published annual loyalty bonus on the Accumulation Units Account value for Period A, which the source defines as policy years 3 to 10.',
      'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
    ],
    sourceRefs: term === 15 ? [loyaltyPage3] : [loyaltyPage3, loyaltyPage4],
  })

  if (term === 15) {
    bonuses.push(
      {
        id: 'loyalty-bonus-policy-years-11-15',
        type: 'loyalty',
        label: 'Loyalty Bonus (Policy Years 11-15)',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 11,
        endPolicyYear: 15,
        rate: null,
        amount: null,
        tieredRates: buildTieredRates(LOYALTY_POLICY_YEARS_11_TO_15_RATES),
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
        notes: [
          'Models the published annual loyalty bonus on the Accumulation Units Account value from policy years 11 to 15 for the 15-year premium payment term.',
          'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
        ],
        sourceRefs: [loyaltyPage3],
      },
      {
        id: 'loyalty-bonus-policy-years-16-40',
        type: 'loyalty',
        label: 'Loyalty Bonus (Policy Years 16-40)',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 16,
        endPolicyYear: 40,
        rate: null,
        amount: null,
        tieredRates: buildTieredRates(LOYALTY_PERIOD_B_RATES),
        notes: [
          'Models the published annual loyalty bonus on the Accumulation Units Account value after the premium payment term through policy year 40.',
        ],
        sourceRefs: [loyaltyPage4, loyaltyPage5],
      },
    )
  } else {
    const periodBEndPolicyYear = term - 5
    bonuses.push(
      {
        id: 'loyalty-bonus-period-b',
        type: 'loyalty',
        label: `Loyalty Bonus (Period B: Policy Years 11-${periodBEndPolicyYear})`,
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: 11,
        endPolicyYear: periodBEndPolicyYear,
        rate: null,
        amount: null,
        tieredRates: buildTieredRates(LOYALTY_PERIOD_B_RATES),
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
        notes: [
          `Models the published annual loyalty bonus on the Accumulation Units Account value for Period B, which the source defines as policy years 11 to premium-payment-term minus 5 years for the ${term}-year corridor.`,
          'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
        ],
        sourceRefs: [loyaltyPage3, loyaltyPage4],
      },
      {
        id: 'loyalty-bonus-period-c',
        type: 'loyalty',
        label: `Loyalty Bonus (Period C: Policy Years ${term - 4}-${term})`,
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: term - 4,
        endPolicyYear: term,
        rate: null,
        amount: null,
        tieredRates: buildTieredRates(getLoyaltyPeriodCRates(term)),
        adjustmentFactorConfig: {
          formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
          withdrawalAccountIds: ['accumulation'],
        },
        notes: [
          `Models the published annual loyalty bonus on the Accumulation Units Account value for Period C, which the source defines as premium-payment-term minus 4 years through the end of the ${term}-year premium payment term.`,
          'During the premium payment term, the annual rate is multiplied by the published adjustment factor of policy-year regular premium paid minus partial withdrawals from the Accumulation Units Account, divided by annualised regular premium committed at commencement date, floored at 0 and capped at 1.',
        ],
        sourceRefs: [loyaltyPage3, loyaltyPage4],
      },
      {
        id: 'loyalty-bonus-after-mip-to-policy-year-40',
        type: 'loyalty',
        label: 'Loyalty Bonus (After Premium Payment Term to Policy Year 40)',
        mode: 'annual-rate',
        appliesTo: ['accumulation'],
        startPolicyYear: term + 1,
        endPolicyYear: 40,
        rate: null,
        amount: null,
        tieredRates: buildTieredRates(LOYALTY_PERIOD_B_RATES),
        notes: [
          'Models the published annual loyalty bonus on the Accumulation Units Account value after the premium payment term through policy year 40 using the post-premium-payment-term rate table.',
        ],
        sourceRefs: [loyaltyPage4, loyaltyPage5],
      },
    )
  }

  bonuses.push({
    id: 'loyalty-bonus-policy-year-41-onward',
    type: 'loyalty',
    label: 'Loyalty Bonus (Policy Year 41 Onward)',
    mode: 'annual-rate',
    appliesTo: ['accumulation'],
    startPolicyYear: 41,
    endPolicyYear: null,
    rate: 0.003,
    amount: null,
    tieredRates: [],
    notes: [
      'Models the published annual loyalty bonus on the Accumulation Units Account value from policy year 41 onward.',
    ],
    sourceRefs: [loyaltyPage5],
  })

  return bonuses
}

function buildFeeRules(document: ExtractedPdfDocument, term: SupportedTerm): IlpTemplateFeeRule[] {
  const page10 = sourceRef(10, 'Initial Charge', snippetNear(document, 10, 'Initial Charge', 28))
  const page11 = sourceRef(11, 'Policy Charge', snippetNear(document, 11, 'Policy Charge', 34))
  const initialChargeBaseRate = getInitialChargeBaseRate(term)
  const initialChargeCapPolicyYear = term - 5

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
        `Models the published monthly initial charge for the selected SGD ${term}-year premium payment term as ${(initialChargeBaseRate * 100).toFixed(2)}% p.a. multiplied by the current policy year, capped at policy year ${initialChargeCapPolicyYear}.`,
      ],
      sourceRefs: [page10, page11],
    },
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      activeWindow: 'during-mip',
      startPolicyYear: 3,
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 3, endPolicyYear: term, mode: 'policy-year' },
        ],
      },
      notes: [
        `Models the published monthly policy charge from the 25th policy month through the ${term}-year premium payment term using annualised regular premium committed at commencement date multiplied by the current policy year.`,
      ],
      sourceRefs: [page11],
    },
    {
      id: 'policy-charge-after-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.012,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
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
      sourceRefs: [page11],
    },
  ]
}

function buildTokioMpcFeeRule(
  term: SupportedTerm,
  optionPage: IlpCatalogSourceRef,
  chargePage: IlpCatalogSourceRef,
  tablePage: IlpCatalogSourceRef,
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
    fallbackAppliesTo: ['topup', 'initial'],
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
        ? 'Models the published Monthly Protection Charge for the Advanced Death Benefit with Life Benefit Rider corridor through the policy anniversary immediately after age 99.'
        : `Models the published Monthly Protection Charge for the Advanced Death corridor during the selected ${term}-year premium payment term.`,
      'The Monthly Protection Charge for policy years 1 to 2 is accrued and collected in one lump sum in policy year 3.',
      'Sum at risk is the published net premium less 101% of the Initial Units Account value and 101% of the Accumulation Units Account value, floored at zero.',
      'The charge is deducted monthly in advance from the Accumulation Units Account, with outstanding amounts deducted from the Top-up Units Account and then the Initial Units Account if needed.',
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
  const page1 = sourceRef(1, 'Plan Description', snippetNear(document, 1, 'Affluence@Future', 18))
  const page2 = sourceRef(2, 'Initial Bonus', snippetNear(document, 2, 'Initial Bonus', 30))
  const page5 = sourceRef(5, 'Regular Premium Routing', snippetNear(document, 5, 'Regular premium for Affluence@Future', 26))
  const page6 = sourceRef(6, 'Recurring Single Premium / Top-up Premium', snippetNear(document, 6, 'Recurring Single Premium', 28))
  const page8 = sourceRef(8, 'Partial Withdrawal / Regular Withdrawal', snippetNear(document, 8, 'Partial Withdrawal', 28))
  const page10 = sourceRef(10, 'Dividend Distribution / Initial Charge', snippetNear(document, 10, 'Dividend Distribution', 32))
  const page11 = sourceRef(11, 'Policy Charge / top-up charges', snippetNear(document, 11, 'Policy Charge', 34))
  const page12Mpc = sourceRef(12, 'Monthly Protection Charge', snippetNear(document, 12, 'Monthly Protection Charge', 26))
  const page12Withdrawal = sourceRef(12, 'Partial Withdrawal and Regular Withdrawal Charge', snippetNear(document, 12, 'Partial Withdrawal and Regular Withdrawal Charge', 12))
  const page16 = isAdvancedDeath
    ? sourceRef(16, 'Appendix A Monthly Protection Charge Rates', snippetNear(document, 16, 'Monthly Rates for Monthly Protection Charges', 24))
    : null
  const surrenderPage = term <= 20
    ? sourceRef(18, 'Appendix A Surrender Charge', snippetNear(document, 18, 'Premium Payment Term: 15 – 20 Years', 32))
    : sourceRef(17, 'Appendix A Surrender Charge', snippetNear(document, 17, 'Premium Payment Term: 21 -30 Years', 32))

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
      sourceRefs: [page6, page11],
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
      sourceRefs: [page6, page11],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'The source document publishes nil partial-withdrawal and regular-withdrawal charges.',
        'Minimum withdrawal amount, minimum remaining account value, and during-vs-after-premium-term withdrawal-account gating remain metadata-only constraints in this partial template.',
      ],
      sourceRefs: [page8, page12Withdrawal],
    },
  ]

  const feeRules = buildFeeRules(document, term)
  if (isAdvancedDeath && page16) {
    feeRules.push(buildTokioMpcFeeRule(term, page1, page12Mpc, page16, hasLifeBenefitRider))
  }

  return {
    id: hasLifeBenefitRider
      ? `sgd-mip-${term}-advanced-death-life-benefit-rider`
      : isAdvancedDeath
        ? `sgd-mip-${term}-advanced-death`
        : `sgd-mip-${term}`,
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
        sourceRefs: [page1, page5, page10],
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
        sourceRefs: [page1, page5, page11],
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
        sourceRefs: [page1, page6, page11],
      },
    ],
    bonuses: buildBonuses(document, term),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumPartialWithdrawalAmount: 500,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
        { accountId: 'topup', startPolicyMonth: 25 },
        { accountId: 'initial', startPolicyMonth: term * 12 + 1 },
      ],
      minimumPremiumHolidayStartPolicyMonth: 25,
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 3_000 },
      ],
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
        'After the premium payment term, dividends from the Initial Units Account, Accumulation Units Account and Top-up Units Account may be paid in cash.',
        'Cash payouts below the published SGD 50 minimum dividend amount are reinvested.',
        'Distribution-option instruction changes require at least 30 days before the Record Date.',
      ],
      sourceRefs: [page10],
    },
    eecTable: buildSurrenderChargeTable(term),
    warnings: [
      `This supported template models the SGD / premium-payment-term-${term} (${hasLifeBenefitRider ? 'Advanced Death with Life Benefit Rider' : isAdvancedDeath ? 'Advanced Death' : 'Basic Death'}) corridor.`,
      `This supported template models 24-month initial-versus-accumulation routing, the published policy-year-specific initial bonus tables${getInitialBonusRates(term, 1).some((rate) => rate > 1) || getInitialBonusRates(term, 2).some((rate) => rate > 1) ? ' including an excess allocation layer for published rates above 100%' : ''}, the published loyalty-bonus period windows and bounded adjustment-factor formula during the premium payment term, the term-specific initial-charge schedule with the policy-year-${term - 5} cap, the policy-charge premium-base multiplier basis, top-up routing, recurring-single-premium routing, nil partial-withdrawal charge, one-off partial withdrawals from policy year 3 with the published S$500 minimum amount and S$3,000 minimum policy-value floor, the published ${term}-year surrender charge table, and the phase-specific dividend cash-payout account restrictions through the manual distribution-mode assumption surface.`,
      ...(isAdvancedDeath
        ? [
            hasLifeBenefitRider
              ? 'The Advanced Death with Life Benefit Rider variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, static current multi-life last-life handling, oldest-life MPC rating, youngest-life rider age gating, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base through the policy anniversary immediately after age 99.'
              : 'The Advanced Death variant also models the published current death-benefit estimate, Monthly Protection Charge, including the first-two-policy-years accrual window, policy-year-3 lump-sum settlement, static current multi-life last-life handling, oldest-life MPC rating, youngest-life rider age gating, and the published sum-at-risk valuation across the Initial and Accumulation Units Accounts after you enter the insured-life details and current net premium base.',
          ]
        : []),
      'Recurring single premium events before policy month 13 or below the published monthly-equivalent minimum of S$50 are blocked; insurer-defined increase / reduction minimums remain informational only.',
      'Recurring single premium stays blocked during premium holiday until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the committed commencement-date amount.',
    ],
    unsupportedItems: [
      ...(hasLifeBenefitRider
        ? [
            'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider termination / fallback handling, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
          ]
        : isAdvancedDeath
          ? [
              'Advanced Death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider selection, and change-of-life-assured / life-replacement administration remain metadata-only for this product.',
            ]
          : [
              'This basic-death corridor does not model Advanced Death selection, Life Benefit Rider selection, or Monthly Protection Charge; change-of-life-assured / life-replacement administration remains metadata-only for this product.',
            ]),
      'Regular withdrawal behavior, selected-fund residual-value conditions, and premium-holiday state handling remain metadata-only for this product.',
    ],
    sourceRefs: [page1, page2, page5, page6, page8, page10, page11, page12Withdrawal, ...(page16 ? [page16] : []), surrenderPage],
  }
}

export function parseTokioMarineAffluenceAtFuture(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-affluence-atfuture',
    insurer: 'Tokio Marine',
    productName: 'Affluence@Future',
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
      'branch:tokio-loyalty-bonus-adjustment-factor',
      'branch:tokio-marine-affluence-atfuture-zero-partial-withdrawal-charge',
      'branch:tokio-marine-affluence-atfuture-advanced-death-monthly-protection-charge-accrual-and-valuation-accounts',
      'branch:tokio-current-only-multi-life-life-state',
      'tokio-initial-account-surrender-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'tokio-affluence-atfuture-advanced-death-payout-handling',
      'tokio-affluence-atfuture-life-benefit-rider',
      'tokio-affluence-atfuture-regular-withdrawal-behavior',
      'tokio-affluence-atfuture-selected-fund-residual-value-conditions',
      'tokio-affluence-atfuture-change-of-life-assured-and-life-replacement-administration',
      'tokio-affluence-atfuture-premium-holiday-state-handling',
      'tokio-affluence-atfuture-non-sgd-variants',
    ],
    warnings: [
      'Affluence@Future is cataloged as a supported V1 product. The SGD premium-payment-term family from 15 to 30 years models regular-premium routing, policy-year-specific initial bonus allocation with honest excess-rate layering where the published rates exceed 100%, annual loyalty bonus with the published Period A / B / C timing and bounded adjustment-factor formula during the premium payment term, term-specific initial and policy charges, top-up and recurring-single-premium routing / charges, the commencement-date recurring-single-premium resumption gate after premium holiday, zero-charge one-off partial withdrawals from policy year 3 with the published S$500 minimum amount and S$3,000 minimum policy-value floor, surrender mechanics, and reinvest-default distribution support; the Advanced Death variants also model the published current death-benefit estimate and accrued Monthly Protection Charge corridor from insured-life inputs, including static current multi-life last-life handling, oldest-life MPC rating, and youngest-life rider age gating, and the Advanced Death with Life Benefit Rider variant extends that same corridor through the policy anniversary immediately after age 99.',
      'Recurring single premium stays blocked after a premium-holiday event until an explicit recurring-single-premium resumption is entered and the regular premium amount is restored to the commencement-date amount.',
      'Dividend cash payouts are modeled through the manual distribution-mode assumption surface with the published SGD 50 minimum payout threshold and 30-day record-date lead time.',
      'Advanced-death payout handling beyond the modeled current death-benefit estimate and Monthly Protection Charge, Life Benefit Rider handling, regular-withdrawal behavior, selected-fund residual-value conditions, change-of-life-assured / life-replacement administration, and premium-holiday / non-SGD variants remain informational only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.flatMap((term) => [
      buildVariant(context.document, term, 'basic-death'),
      buildVariant(context.document, term, 'advanced-death'),
      buildVariant(context.document, term, 'advanced-death-life-benefit-rider'),
    ]),
  }
}
