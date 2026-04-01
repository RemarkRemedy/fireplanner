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

interface SourceRefs {
  page1: IlpCatalogSourceRef
  page2: IlpCatalogSourceRef
  page3: IlpCatalogSourceRef
  page4: IlpCatalogSourceRef
  page5: IlpCatalogSourceRef
  page6: IlpCatalogSourceRef
  page8: IlpCatalogSourceRef
  page11: IlpCatalogSourceRef
  page12: IlpCatalogSourceRef
  page13: IlpCatalogSourceRef
  page14: IlpCatalogSourceRef
  page23: IlpCatalogSourceRef
  page24: IlpCatalogSourceRef
}

const TERM_OPTIONS = [
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
] as const

type SupportedTerm = (typeof TERM_OPTIONS)[number]

const BOOSTER_BONUS_RATE_BY_TERM: Record<SupportedTerm, readonly [number, number, number, number, number]> = {
  10: [0.23, 0.29, 0.32, 0.39, 0.44],
  11: [0.23, 0.29, 0.32, 0.39, 0.44],
  12: [0.23, 0.29, 0.32, 0.39, 0.44],
  13: [0.23, 0.29, 0.32, 0.39, 0.44],
  14: [0.23, 0.29, 0.32, 0.39, 0.44],
  15: [0.28, 0.32, 0.4, 0.47, 0.51],
  16: [0.28, 0.32, 0.4, 0.47, 0.51],
  17: [0.28, 0.32, 0.4, 0.47, 0.51],
  18: [0.28, 0.32, 0.4, 0.47, 0.51],
  19: [0.28, 0.32, 0.4, 0.47, 0.51],
  20: [0.34, 0.49, 0.56, 0.59, 0.63],
  21: [0.34, 0.49, 0.56, 0.59, 0.63],
  22: [0.34, 0.49, 0.56, 0.59, 0.63],
  23: [0.34, 0.49, 0.56, 0.59, 0.63],
  24: [0.34, 0.49, 0.56, 0.59, 0.63],
  25: [0.4, 0.55, 0.8, 0.83, 0.87],
  26: [0.41, 0.56, 0.82, 0.84, 0.89],
  27: [0.42, 0.57, 0.83, 0.86, 0.9],
  28: [0.44, 0.59, 0.85, 0.87, 0.92],
  29: [0.45, 0.6, 0.86, 0.89, 0.93],
  30: [0.49, 0.61, 0.87, 0.89, 0.93],
}

const ACCUMULATION_BONUS_SCHEDULE_BY_TERM: Record<SupportedTerm, readonly Array<{ policyYear: number, rate: number }>> = {
  10: [{ policyYear: 10, rate: 0.02 }],
  11: [{ policyYear: 11, rate: 0.02 }],
  12: [{ policyYear: 12, rate: 0.02 }],
  13: [{ policyYear: 13, rate: 0.02 }],
  14: [{ policyYear: 14, rate: 0.02 }],
  15: [{ policyYear: 10, rate: 0.02 }, { policyYear: 15, rate: 0.02 }],
  16: [{ policyYear: 11, rate: 0.02 }, { policyYear: 16, rate: 0.02 }],
  17: [{ policyYear: 12, rate: 0.02 }, { policyYear: 17, rate: 0.02 }],
  18: [{ policyYear: 13, rate: 0.02 }, { policyYear: 18, rate: 0.02 }],
  19: [{ policyYear: 14, rate: 0.02 }, { policyYear: 19, rate: 0.02 }],
  20: [{ policyYear: 10, rate: 0.02 }, { policyYear: 15, rate: 0.02 }, { policyYear: 20, rate: 0.02 }],
  21: [{ policyYear: 11, rate: 0.02 }, { policyYear: 16, rate: 0.02 }, { policyYear: 21, rate: 0.02 }],
  22: [{ policyYear: 12, rate: 0.02 }, { policyYear: 17, rate: 0.02 }, { policyYear: 22, rate: 0.02 }],
  23: [{ policyYear: 13, rate: 0.02 }, { policyYear: 18, rate: 0.02 }, { policyYear: 23, rate: 0.02 }],
  24: [{ policyYear: 14, rate: 0.02 }, { policyYear: 19, rate: 0.02 }, { policyYear: 24, rate: 0.02 }],
  25: [{ policyYear: 15, rate: 0.02 }, { policyYear: 20, rate: 0.02 }, { policyYear: 25, rate: 0.02 }],
  26: [{ policyYear: 16, rate: 0.02 }, { policyYear: 21, rate: 0.02 }, { policyYear: 26, rate: 0.02 }],
  27: [{ policyYear: 17, rate: 0.02 }, { policyYear: 22, rate: 0.02 }, { policyYear: 27, rate: 0.02 }],
  28: [{ policyYear: 18, rate: 0.02 }, { policyYear: 23, rate: 0.02 }, { policyYear: 28, rate: 0.02 }],
  29: [{ policyYear: 19, rate: 0.02 }, { policyYear: 24, rate: 0.02 }, { policyYear: 29, rate: 0.02 }],
  30: [
    { policyYear: 15, rate: 0.03 },
    { policyYear: 20, rate: 0.03 },
    { policyYear: 25, rate: 0.03 },
    { policyYear: 30, rate: 0.03 },
  ],
}

const SURRENDER_CHARGE_SCHEDULE_BY_TERM: Record<SupportedTerm, readonly number[]> = {
  10: [1, 1, 0.99, 0.99, 0.99, 0.81, 0.65, 0.5, 0.31, 0.09],
  11: [1, 1, 0.99, 0.99, 0.99, 0.83, 0.69, 0.55, 0.38, 0.24, 0.09],
  12: [1, 1, 0.99, 0.99, 0.99, 0.85, 0.73, 0.6, 0.46, 0.33, 0.23, 0.09],
  13: [1, 1, 0.99, 0.99, 0.99, 0.87, 0.76, 0.66, 0.53, 0.42, 0.31, 0.23, 0.09],
  14: [1, 1, 0.99, 0.99, 0.99, 0.89, 0.8, 0.71, 0.61, 0.51, 0.39, 0.32, 0.23, 0.09],
  15: [1, 1, 0.99, 0.99, 0.99, 0.91, 0.84, 0.76, 0.68, 0.6, 0.47, 0.4, 0.31, 0.24, 0.15],
  16: [1, 1, 0.99, 0.99, 0.99, 0.92, 0.86, 0.79, 0.72, 0.65, 0.52, 0.44, 0.36, 0.29, 0.2, 0.15],
  17: [1, 1, 0.99, 0.99, 0.99, 0.93, 0.88, 0.82, 0.76, 0.69, 0.56, 0.48, 0.41, 0.35, 0.25, 0.19, 0.15],
  18: [1, 1, 0.99, 0.99, 0.99, 0.95, 0.9, 0.85, 0.79, 0.74, 0.61, 0.53, 0.46, 0.4, 0.3, 0.23, 0.18, 0.15],
  19: [1, 1, 0.99, 0.99, 0.99, 0.96, 0.92, 0.88, 0.83, 0.78, 0.65, 0.57, 0.51, 0.46, 0.35, 0.26, 0.2, 0.18, 0.15],
  20: [1, 1, 0.99, 0.99, 0.99, 0.97, 0.94, 0.91, 0.87, 0.83, 0.7, 0.61, 0.56, 0.51, 0.4, 0.3, 0.23, 0.2, 0.18, 0.15],
  21: [1, 1, 0.99, 0.99, 0.99, 0.97, 0.94, 0.92, 0.88, 0.84, 0.73, 0.65, 0.61, 0.56, 0.45, 0.35, 0.29, 0.26, 0.23, 0.18, 0.15],
  22: [1, 1, 0.99, 0.99, 0.99, 0.97, 0.95, 0.92, 0.89, 0.86, 0.76, 0.69, 0.66, 0.62, 0.5, 0.41, 0.35, 0.31, 0.28, 0.22, 0.17, 0.15],
  23: [1, 1, 0.99, 0.99, 0.99, 0.98, 0.95, 0.93, 0.9, 0.87, 0.79, 0.74, 0.7, 0.67, 0.55, 0.46, 0.4, 0.37, 0.34, 0.25, 0.2, 0.16, 0.15],
  24: [1, 1, 0.99, 0.99, 0.99, 0.98, 0.96, 0.93, 0.91, 0.89, 0.82, 0.78, 0.75, 0.73, 0.6, 0.52, 0.46, 0.42, 0.39, 0.29, 0.22, 0.18, 0.17, 0.15],
  25: [1, 1, 0.99, 0.99, 0.99, 0.98, 0.96, 0.94, 0.92, 0.9, 0.85, 0.82, 0.8, 0.78, 0.65, 0.57, 0.52, 0.48, 0.44, 0.32, 0.24, 0.19, 0.18, 0.16, 0.15],
  26: [1, 1, 0.99, 0.99, 0.99, 0.98, 0.96, 0.95, 0.93, 0.91, 0.86, 0.84, 0.82, 0.8, 0.68, 0.6, 0.55, 0.52, 0.48, 0.36, 0.29, 0.24, 0.23, 0.22, 0.21, 0.15],
  27: [1, 1, 0.99, 0.99, 0.99, 0.98, 0.97, 0.95, 0.94, 0.92, 0.87, 0.85, 0.83, 0.82, 0.7, 0.63, 0.59, 0.56, 0.52, 0.41, 0.34, 0.3, 0.29, 0.27, 0.26, 0.22, 0.15],
  28: [1, 1, 0.99, 0.99, 0.99, 0.99, 0.97, 0.96, 0.94, 0.93, 0.89, 0.87, 0.85, 0.83, 0.73, 0.67, 0.62, 0.59, 0.55, 0.45, 0.38, 0.35, 0.34, 0.33, 0.32, 0.29, 0.23, 0.15],
  29: [1, 1, 0.99, 0.99, 0.99, 0.99, 0.98, 0.96, 0.95, 0.94, 0.9, 0.88, 0.86, 0.85, 0.75, 0.7, 0.66, 0.63, 0.59, 0.5, 0.43, 0.41, 0.4, 0.38, 0.37, 0.35, 0.31, 0.23, 0.15],
  30: [1, 1, 0.99, 0.99, 0.99, 0.99, 0.98, 0.97, 0.96, 0.95, 0.91, 0.9, 0.88, 0.87, 0.78, 0.73, 0.69, 0.67, 0.63, 0.54, 0.48, 0.46, 0.45, 0.44, 0.43, 0.42, 0.39, 0.31, 0.24, 0.15],
}

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
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function formatPolicyYears(years: number[]): string {
  if (years.length === 0) return ''
  if (years.length === 1) return `${years[0]}`
  if (years.length === 2) return `${years[0]} and ${years[1]}`
  return `${years.slice(0, -1).join(', ')}, and ${years[years.length - 1]}`
}

function buildSourceRefs(document: ExtractedPdfDocument): SourceRefs {
  return {
    page1: sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest First Max', 24)),
    page2: sourceRef(2, 'Booster Bonus', snippetNear(document, 2, 'Booster Bonus', 32)),
    page3: sourceRef(3, 'Booster Bonus and Loyalty Bonus', snippetNear(document, 3, 'Loyalty Bonus', 40)),
    page4: sourceRef(4, 'Loyalty Bonus', snippetNear(document, 4, 'Loyalty Bonus', 32)),
    page5: sourceRef(5, 'Accumulation Bonus conditions', snippetNear(document, 5, 'Accumulation Bonus', 28)),
    page6: sourceRef(6, 'Accumulation bonus schedule', snippetNear(document, 6, 'Applicable Accumulation Bonus rate', 26)),
    page8: sourceRef(8, 'Recurring single premium and top-up premium', snippetNear(document, 8, 'Recurring single premium', 28)),
    page11: sourceRef(11, 'Initial account charge', snippetNear(document, 11, 'Initial account charge', 34)),
    page12: sourceRef(12, 'Accumulation account charge and premium charge', snippetNear(document, 12, 'Accumulation account charge', 30)),
    page13: sourceRef(13, 'Premium charge and surrender charge', snippetNear(document, 13, 'Surrender charge', 30)),
    page14: sourceRef(14, 'Policy changes and regular premium variation', snippetNear(document, 14, 'Increase in regular premium', 34)),
    page23: sourceRef(23, 'Appendix A surrender charge rate', snippetNear(document, 23, 'Appendix A – Surrender charge rate', 28)),
    page24: sourceRef(24, 'Appendix B increase regular premium layer illustration', snippetNear(document, 24, 'Illustration on increase regular premium layer', 28)),
  }
}

function buildBoosterBonusTiers(term: SupportedTerm) {
  const [band1, band2, band3, band4, band5] = BOOSTER_BONUS_RATE_BY_TERM[term]
  return [
    { currency: 'SGD' as const, minAnnualPremium: null, maxAnnualPremium: 11_999.99, rate: band1 },
    { currency: 'SGD' as const, minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99, rate: band2 },
    { currency: 'SGD' as const, minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: band3 },
    { currency: 'SGD' as const, minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: band4 },
    { currency: 'SGD' as const, minAnnualPremium: 48_000, maxAnnualPremium: null, rate: band5 },
  ]
}

function buildInitialAccountChargeRateSchedule(term: SupportedTerm) {
  const schedule = [
    { startPolicyYear: 1, endPolicyYear: Math.min(term, 10), rate: 0.06 },
  ]

  if (term >= 11) {
    schedule.push({ startPolicyYear: 11, endPolicyYear: Math.min(term, 20), rate: 0.055 })
  }
  if (term >= 21) {
    schedule.push({ startPolicyYear: 21, endPolicyYear: Math.min(term, 25), rate: 0.04 })
  }
  if (term >= 26) {
    schedule.push({ startPolicyYear: 26, endPolicyYear: term, rate: 0.035 })
  }

  return schedule.filter((entry) => entry.startPolicyYear <= entry.endPolicyYear)
}

function buildAccumulationBonusPolicyYearRateSchedule(term: SupportedTerm) {
  return ACCUMULATION_BONUS_SCHEDULE_BY_TERM[term].map((entry) => ({
    startPolicyYear: entry.policyYear,
    endPolicyYear: entry.policyYear,
    rate: entry.rate,
  }))
}

function buildVariant(term: SupportedTerm, refs: SourceRefs): IlpTemplateVariant {
  const accumulationBonusSchedule = ACCUMULATION_BONUS_SCHEDULE_BY_TERM[term]
  const accumulationBonusYears = accumulationBonusSchedule.map((entry) => entry.policyYear)
  const initialAccountChargeSchedule = buildInitialAccountChargeRateSchedule(term)

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'booster-bonus',
      type: 'sign-up',
      label: 'Booster Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 2,
      annualPremiumTierBasis: 'committed-annual-premium-at-issue',
      rate: null,
      amount: null,
      tieredRates: buildBoosterBonusTiers(term),
      qualificationRules: [
        {
          trigger: 'premium-holiday',
          disqualifyThroughPolicyYear: 2,
        },
      ],
      notes: [
        `Models the published base-layer Booster Bonus rates on each regular premium received during the first 2 policy years of the supported SGD ${term}-year corridor.`,
        'When missed premiums are represented with a premium-holiday event during the first 2 policy years, the remaining base-layer Booster Bonus credits are suppressed through the end of policy year 2.',
        'Increase-regular-premium-layer bonus handling and grace-period administration remain informational only.',
      ],
      sourceRefs: [refs.page2, refs.page3],
    },
    {
      id: 'loyalty-bonus-during-mip',
      type: 'loyalty',
      label: `Loyalty Bonus (Policy Years 3-${term})`,
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 3,
      endPolicyYear: term,
      rate: 0.007,
      amount: null,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
        includePolicyRepaymentsInPaidRegularPremium: true,
      },
      notes: [
        `Models the published during-premium-term Loyalty Bonus on accumulation-units-account value through policy year ${term}, using the stated annual adjustment-factor formula.`,
        'Manual policy-repayment events can be counted as regular premium paid for that policy year when modeling the published adjustment factor for the base layer.',
        'Pending-transaction timing and increase-regular-premium-layer loyalty handling remain informational only.',
      ],
      sourceRefs: [refs.page3, refs.page4],
    },
    {
      id: 'loyalty-bonus-after-mip',
      type: 'loyalty',
      label: `Loyalty Bonus (Policy Year ${term + 1} Onward)`,
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: term + 1,
      endPolicyYear: null,
      rate: 0.011,
      amount: null,
      tieredRates: [],
      notes: [
        `Models the published post-premium-term Loyalty Bonus on accumulation-units-account value from policy year ${term + 1} onward.`,
        'Pending-transaction timing and increase-regular-premium-layer loyalty handling remain informational only.',
      ],
      sourceRefs: [refs.page4],
    },
    {
      id: 'accumulation-bonus',
      type: 'custom',
      label: 'Accumulation Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: accumulationBonusYears[0] ?? term,
      endPolicyYear: accumulationBonusYears[accumulationBonusYears.length - 1] ?? term,
      rate: 0,
      amount: null,
      tieredRates: [],
      policyYearRateSchedule: buildAccumulationBonusPolicyYearRateSchedule(term),
      qualificationRules: [
        {
          trigger: 'partial-withdrawal',
          disqualifyIfAnyInLookbackMonths: 60,
        },
        {
          trigger: 'reinvested-dividend-withdrawal',
          disqualifyIfAnyInLookbackMonths: 60,
        },
        {
          trigger: 'regular-premium-reduction',
          disqualifyIfAnyInLookbackMonths: 60,
        },
        {
          formula: 'no-new-premium-arrears-in-lookback-months',
          lookbackMonths: 60,
        },
      ],
      excludedValueRules: [
        {
          trigger: 'top-up',
          basis: 'event-amount',
          lookbackMonths: 12,
        },
      ],
      notes: [
        `Models the published SGD ${term}-year base-layer Accumulation Bonus schedule at the end of policy years ${formatPolicyYears(accumulationBonusYears)}.`,
        'Current-policy-year top-up premiums are excluded from the supported base-value calculation through the published current-year exclusion rule.',
        'Current-policy-year top-up proration by exact acceptance date and increase-regular-premium-layer accumulation-bonus handling remain informational only.',
      ],
      sourceRefs: [refs.page5, refs.page6, refs.page24],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'initial-account-charge',
      label: 'Initial Account Charge',
      basis: 'account-value',
      yearBasis: 'policy-year',
      rate: 0,
      amount: 0,
      appliesTo: ['initial'],
      rateSchedule: initialAccountChargeSchedule,
      activeWindow: 'during-mip',
      notes: [
        `Models the published initial-account charge schedule for the supported SGD ${term}-year base-layer corridor.`,
        'The charge remains deductible even when regular premiums are not paid during the premium payment term.',
        'Increase regular premium layers are informational only in this slice.',
      ],
      sourceRefs: [refs.page11, refs.page24],
    },
    {
      id: 'accumulation-account-charge',
      label: 'Accumulation Account Charge',
      basis: 'account-value',
      yearBasis: 'policy-year',
      rate: 0,
      amount: 0,
      appliesTo: ['accumulation'],
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 10, rate: 0.016 },
        { startPolicyYear: 11, endPolicyYear: 20, rate: 0.014 },
        { startPolicyYear: 21, endPolicyYear: null, rate: 0.012 },
      ],
      activeWindow: 'policy-term',
      notes: [
        'Models the published accumulation-account charge schedule on accumulation-units-account value.',
        'Recurring single premiums and top-up premiums route to the base-layer accumulation units account in this corridor.',
        'Per-layer charge timing for increase regular premium layers remains informational only.',
      ],
      sourceRefs: [refs.page12, refs.page24],
    },
  ]

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
        'Models the published 5% premium charge on each accepted top-up premium.',
        'Top-up minimum amount and investment-strategy routing remain informational only in V1.',
      ],
      sourceRefs: [refs.page8, refs.page12],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted recurring single premium.',
        'Reduction priority between recurring single premium and regular premium remains informational only in V1.',
      ],
      sourceRefs: [refs.page8, refs.page12, refs.page14],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'No redemption fee is stated for withdrawals.',
        'During the premium payment term, the executable path assumes authored one-off withdrawals only from the accumulation units account from the 25th policy month onward.',
        'The executable path blocks authored partial withdrawals that would leave the monitored remaining value below the published minimum-account-value threshold.',
        'Initial-units-account withdrawal lockout, regular-withdrawal timing, minimum withdrawal amount, and increase-layer withdrawal ordering remain informational only.',
      ],
      sourceRefs: [refs.page13, refs.page14],
    },
  ]

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: term,
    icpMonths: 1,
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
        sourceRefs: [refs.page1, refs.page2, refs.page3, refs.page11, refs.page14, refs.page23],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [refs.page3, refs.page4, refs.page5, refs.page8, refs.page12, refs.page14],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_SCHEDULE_BY_TERM[term]],
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 25,
      minimumRegularPremiumAmountByFrequency: {
        annual: 6_000,
        'semi-annual': 3_000,
        quarterly: 1_500,
        monthly: 500,
      },
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'accumulation', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
    },
    warnings: [
      `FWD Invest First Max is cataloged as a supported V1 corridor. The parser captures the SGD ${term}-year base-layer corridor only: the published Booster Bonus, Loyalty Bonus, Accumulation Bonus schedule on policy years ${formatPolicyYears(accumulationBonusYears)}, initial-account charge, accumulation-account charge, 5% top-up / recurring-single premium charges, the after-policy-month-25 regular-premium variation start gate with the published SGD minimum regular-premium table, zero redemption fee on the executable accumulation-account one-off partial-withdrawal path with start-month and minimum-remaining-value gating, and the ${term}-year surrender-charge schedule.`,
      'Current-policy-year top-up proration within Accumulation Bonus, maturity benefit, increase regular premium layers, minimum increase / reduction amounts from application forms, and broader missed-premium behavior remain informational only.',
    ],
    unsupportedItems: [
      'Accumulation Bonus current-policy-year top-up proration by exact acceptance date and increase-regular-premium-layer handling remain informational only.',
      'Booster Bonus handling for increase-regular-premium layers and exact grace-period administration remain informational only.',
      'Loyalty Bonus pending-transaction timing and increase-regular-premium-layer handling remain informational only.',
      'Maturity Benefit, multi-life last-survivor handling, and change-of-person-insured behavior remain informational only beyond the modeled current ordinary death-benefit amount.',
      'Recurring single premium reduction priority, increase regular premium layers, and minimum increase / reduction amounts from application forms remain informational only.',
      'Missed-premium and grace-period administration outside the explicit premium-holiday booster-suppression path, plus broader bonus-suspension interactions, remain informational only.',
      'Minimum withdrawal amount, initial-units-account withdrawal rules, policy closure charge, change-of-policy-currency handling, and fund management charges remain informational only.',
    ],
    sourceRefs: [refs.page1, refs.page5, refs.page6, refs.page8, refs.page11, refs.page12, refs.page13, refs.page14, refs.page23, refs.page24],
  }
}

export function parseFwdInvestFirstMax(context: ParseContext): IlpCatalogProduct {
  const refs = buildSourceRefs(context.document)

  return {
    id: 'fwd-invest-first-max',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest First Max',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:fwd-invest-first-max-booster-bonus',
      'branch:fwd-invest-first-max-loyalty-bonus',
      'kernel:bonus-lookback-qualification-window',
      'branch:fwd-invest-first-max-accumulation-bonus-base-value',
      'branch:fwd-invest-first-max-initial-account-charge',
      'branch:fwd-invest-first-max-accumulation-account-charge',
      'kernel:current-death-benefit-estimate',
      'branch:fwd-invest-first-max-top-up-premium-charge',
      'branch:fwd-invest-first-max-recurring-single-premium-charge',
      'branch:fwd-invest-first-max-zero-redemption-fee',
      'branch:fwd-invest-first-max-surrender-charge',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
    ],
    coveredElsewhereBehaviors: [
      'fwd-invest-first-max-policy-closure-charge',
      'fwd-invest-first-max-fund-management-charge',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-first-max-accumulation-bonus-current-year-top-up-proration',
      'fwd-invest-first-max-maturity-benefit',
      'fwd-invest-first-max-multi-life-last-survivor',
      'fwd-invest-first-max-increase-regular-premium-layer',
      'fwd-invest-first-max-regular-premium-variation-application-form-minimums',
      'fwd-invest-first-max-missed-premium-grace-period',
      'fwd-invest-first-max-minimum-withdrawal-rules',
      'fwd-invest-first-max-change-of-person-insured',
      'fwd-invest-first-max-change-of-policy-currency',
    ],
    warnings: [
      'FWD Invest First Max is cataloged as a supported V1 family. The current parser covers the SGD 10-year to 30-year base-layer corridors: term-specific Booster Bonus, Loyalty Bonus timing, Accumulation Bonus schedules, initial-account charge schedules, accumulation-account charge, the current-state death-benefit estimate as 105% of policy value, top-up and recurring-single premium charges, zero redemption fee, and term-specific surrender-charge schedules.',
      'Current-policy-year top-up proration within Accumulation Bonus, maturity benefit, multi-life last-survivor handling, increase regular premium layers, minimum increase / reduction amounts from application forms, and broader premium-flexibility administration beyond the modeled base-layer booster missed-premium suppression remain informational only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(term, refs)),
  }
}
