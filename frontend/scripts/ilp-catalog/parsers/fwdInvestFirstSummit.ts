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
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
] as const
type MipTerm = (typeof TERM_OPTIONS)[number]

const INITIAL_ACCOUNT_CHARGE_RATE = 0.0395
const BOOSTER_BONUS_REWARD_BANDS = [
  { currency: 'SGD' as const, minAnnualPremium: null, maxAnnualPremium: 11_999.99 },
  { currency: 'SGD' as const, minAnnualPremium: 12_000, maxAnnualPremium: 23_999.99 },
  { currency: 'SGD' as const, minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99 },
  { currency: 'SGD' as const, minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99 },
  { currency: 'SGD' as const, minAnnualPremium: 48_000, maxAnnualPremium: null },
] as const
const SURRENDER_RATE_ROWS = [
  '1 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100',
  '2 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100',
  '3 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99',
  '4 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99',
  '5 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99',
  '6 99 99 99 98 98 98 98 98 97 97 97 96 95 93 92 91 89 87 85 83 81',
  '7 98 98 97 97 96 96 96 95 95 94 94 92 90 88 86 84 80 76 73 69 65',
  '8 97 96 96 95 95 94 93 93 92 92 91 88 85 82 79 76 71 66 60 55 50',
  '9 96 95 94 94 93 92 91 90 89 88 87 83 79 76 72 68 61 53 46 38 31',
  '10 95 94 93 92 91 90 89 87 86 84 83 78 74 69 65 60 51 42 33 24 9',
  '11 91 90 89 87 86 85 82 79 76 73 70 65 61 56 52 47 39 31 23 9',
  '12 90 88 87 85 84 82 78 74 69 65 61 57 53 48 44 40 32 23 9',
  '13 88 86 85 83 82 80 75 70 66 61 56 51 46 41 36 31 23 9',
  '14 87 85 83 82 80 78 73 67 62 56 51 46 40 35 29 24 9',
  '15 78 75 73 70 68 65 60 55 50 45 40 35 30 25 20 15',
  '16 73 70 67 63 60 57 52 46 41 35 30 26 23 19 15',
  '17 69 66 62 59 55 52 46 40 35 29 23 20 18 15',
  '18 67 63 59 56 52 48 42 37 31 26 20 18 15',
  '19 63 59 55 52 48 44 39 34 28 23 18 15',
  '20 54 50 45 41 36 32 29 25 22 18 15',
  '21 48 43 38 34 29 24 22 20 17 15',
  '22 46 41 35 30 24 19 18 16 15',
  '23 45 40 34 29 23 18 17 15',
  '24 44 38 33 27 22 16 15',
  '25 43 37 32 26 21 15',
  '26 42 35 29 22 15',
  '27 39 31 23 15',
  '28 31 23 15',
  '29 24 15',
  '30 15',
] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function boosterBonusRates(term: MipTerm): readonly number[] {
  if (term <= 14) return [0.02, 0.07, 0.09, 0.12, 0.15]
  if (term <= 19) return [0.05, 0.10, 0.15, 0.20, 0.23]
  if (term <= 24) return [0.18, 0.23, 0.28, 0.30, 0.33]

  switch (term) {
    case 25:
      return [0.25, 0.30, 0.40, 0.42, 0.45]
    case 26:
      return [0.26, 0.32, 0.42, 0.44, 0.47]
    case 27:
      return [0.27, 0.34, 0.44, 0.46, 0.49]
    case 28:
      return [0.28, 0.36, 0.46, 0.48, 0.51]
    case 29:
      return [0.29, 0.38, 0.48, 0.50, 0.53]
    case 30:
      return [0.30, 0.40, 0.50, 0.52, 0.55]
  }
}

function buildBoosterBonusTiers(term: MipTerm): IlpTemplateBonusTier[] {
  const rates = boosterBonusRates(term)
  return BOOSTER_BONUS_REWARD_BANDS.map((band, index) => ({
    ...band,
    rate: rates[index] ?? 0,
  }))
}

function premiumReductionEndYear(term: MipTerm): number {
  if (term <= 15) return 4
  if (term <= 24) return 6
  return 8
}

function buildSurrenderChargeSchedule(term: MipTerm): number[] {
  const columnIndex = 30 - term

  return SURRENDER_RATE_ROWS
    .map((row) => row.split(' ').map((value) => Number(value)))
    .filter(([policyYear]) => policyYear <= term)
    .map(([policyYear, ...values]) => {
      const value = values[columnIndex]
      if (value == null) {
        throw new Error(`Missing FWD Invest First Summit surrender rate for ${term}-year term at policy year ${policyYear}`)
      }

      return roundRate(value / 100)
    })
}

function buildBonuses(document: ExtractedPdfDocument, term: MipTerm): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Booster Bonus', snippetNear(document, 2, 'Applicable Booster Bonus rates per annum', 24))
  const page3 = sourceRef(3, 'Loyalty Bonus formula', snippetNear(document, 3, 'Loyalty Bonus', 28))
  const page4 = sourceRef(4, 'Loyalty Bonus and Perpetual Bonus', snippetNear(document, 4, 'Applicable Loyalty Bonus rate per annum', 28))
  const loyaltyNotes = term === 10
    ? [
        'Models the published 0.60% p.a. during-premium-term Loyalty Bonus for the supported 10-year premium-payment-term corridor.',
        'Pending-transaction timing remains informational only in V1.',
      ]
    : [
        `Models the published Loyalty Bonus schedule for the supported ${term}-year premium-payment-term corridor: 0.60% p.a. for policy years 4 to 10 and 1.50% p.a. for policy years 11 to ${term}.`,
        'Pending-transaction timing remains informational only in V1.',
      ]

  return [
    {
      id: 'booster-bonus',
      type: 'sign-up',
      label: 'Booster Bonus',
      mode: 'premium-allocation',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 3,
      rate: null,
      amount: null,
      tieredRates: buildBoosterBonusTiers(term),
      notes: [
        `Models the published Booster Bonus rates for the supported ${term}-year premium-payment-term corridor, applied on each regular premium received during the first 3 policy years.`,
        'Top-up premiums do not earn Booster Bonus.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 4,
      endPolicyYear: term,
      rate: term === 10 ? 0.006 : 0,
      amount: null,
      tieredRates: [],
      policyYearRateSchedule: term === 10
        ? undefined
        : [
            { startPolicyYear: 4, endPolicyYear: 10, rate: 0.006 },
            { startPolicyYear: 11, endPolicyYear: term, rate: 0.015 },
          ],
      adjustmentFactorConfig: {
        formula: 'paid-regular-premium-less-partial-withdrawal-over-annualised-premium',
        withdrawalAccountIds: ['accumulation'],
      },
      notes: loyaltyNotes,
      sourceRefs: [page3, page4],
    },
    {
      id: 'perpetual-bonus',
      type: 'loyalty',
      label: 'Perpetual Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: term + 1,
      endPolicyYear: null,
      rate: 0.01,
      amount: null,
      tieredRates: [],
      notes: [
        `Models the published 1.00% p.a. Perpetual Bonus on accumulation-units-account value from policy year ${term + 1} onward for the supported ${term}-year premium-payment-term corridor.`,
        'Pending-transaction timing and policy-in-force qualification remain informational only in V1.',
      ],
      sourceRefs: [page4],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, term: MipTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest First Summit', 24))
  const page3 = sourceRef(3, 'Initial and accumulation account definitions', snippetNear(document, 3, 'Accumulation units account', 18))
  const page8 = sourceRef(8, 'Initial account charge', snippetNear(document, 8, 'Initial account charge', 26))
  const page9 = sourceRef(9, 'Accumulation account charge and top-up premium charge', snippetNear(document, 9, 'Accumulation account charge', 28))
  const page10 = sourceRef(10, 'Premium shortfall charge', snippetNear(document, 10, 'Premium shortfall charge', 30))
  const page11 = sourceRef(11, 'Premium reduction charge', snippetNear(document, 11, 'Premium reduction charge', 26))
  const page12 = sourceRef(12, 'Surrender charge and redemption fee', snippetNear(document, 12, 'Surrender charge', 24))
  const page13 = sourceRef(13, 'Withdrawal options and minimum account value', snippetNear(document, 13, 'Withdrawal options', 30))
  const page14 = sourceRef(14, 'Partial and regular withdrawal rules', snippetNear(document, 14, 'Regular withdrawal', 26))
  const page20 = sourceRef(20, 'Support benefit exclusions and policy termination', snippetNear(document, 20, 'no premium shortfall charge', 24))
  const page22 = sourceRef(22, 'Appendix A surrender charge rate', snippetNear(document, 22, 'Appendix A – Surrender charge rate', 24))
  const reductionEndYear = premiumReductionEndYear(term)

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'initial-account-charge',
      label: 'Initial Account Charge',
      basis: 'account-value',
      yearBasis: 'policy-year',
      rate: INITIAL_ACCOUNT_CHARGE_RATE,
      amount: 0,
      appliesTo: ['initial'],
      activeWindow: 'during-mip',
      notes: [
        `Models the published 3.95% p.a. initial-account charge for the supported ${term}-year premium-payment-term corridor.`,
        'The charge remains deductible even when regular premiums are not paid during the premium payment term.',
      ],
      sourceRefs: [page8],
    },
    {
      id: 'accumulation-account-charge',
      label: 'Accumulation Account Charge',
      basis: 'premium-base-mip-multiplier-capped-account-value',
      yearBasis: 'policy-year',
      rate: 0.015,
      amount: 0,
      appliesTo: ['accumulation'],
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        capRate: 0.007,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: null, mode: 'fixed', multiplier: term },
        ],
      },
      activeWindow: 'policy-term',
      notes: [
        `Models the published accumulation-account charge as the lower of 1.50% p.a. of accumulation-account value or 0.70% p.a. of the ${term}-year premium base at issue.`,
        'The cap remains anchored to the annualised regular premium committed at the effective date, matching the published formula.',
      ],
      sourceRefs: [page9],
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
        'V1 blocks top-ups below the published S$3,000 minimum, before policy month 13, and in policy months where regular premiums are not paid up to date.',
        'The lifetime top-up cap remains informational only in V1.',
      ],
      sourceRefs: [page9],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      rate: 0.09,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published 9% p.a. premium shortfall charge on unpaid premiums after 24 continuous months of missed premiums during the premium payment term.',
        'Mark the premium-holiday event with an insurer-approved charge waiver when an admitted Support Benefit approval waives the premium shortfall charge for that missed-premium period.',
        'Mark the same premium-holiday event as charge-refunded when the charge was deducted first and later refunded after admitted Support Benefit approval.',
        'Support Benefit approval history, reinstatement timing, and accumulation of outstanding unpaid charges remain informational only.',
      ],
      sourceRefs: [page10, page20],
    },
    {
      id: 'premium-shortfall-charge-refund',
      label: 'Premium Shortfall Charge Refund',
      trigger: 'premium-holiday',
      basis: 'source-event-charge-refund',
      appliesTo: ['accumulation'],
      rate: 1,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      sourceChargeRuleId: 'premium-shortfall-charge',
      notes: [
        'Models the published retrospective refund of deducted premium shortfall charge after admitted Support Benefit approval.',
        'Use the same premium-holiday event and mark it as charge-refunded when the charge was deducted between the qualifying event date and notification date and later refunded.',
        'Approval history before the current projection start, reinstatement timing, and broader unpaid-charge accumulation remain informational only.',
      ],
      sourceRefs: [page10, page20],
    },
    {
      id: 'premium-reduction-charge',
      label: 'Premium Reduction Charge',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      rate: 0,
      amount: 0,
      rateSchedule: [
        { startPolicyYear: 3, endPolicyYear: reductionEndYear, rate: 0.09 },
      ],
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published 9% p.a. premium reduction charge on the reduced annualised regular premium during policy years 3 to ${reductionEndYear} for the supported ${term}-year corridor.`,
        'Mark the reduction event with an insurer-approved charge waiver when an admitted Support Benefit approval waives the premium reduction charge for that period.',
        'Mark the same reduction event as charge-refunded when the charge was deducted first and later refunded after admitted Support Benefit approval.',
        'Support Benefit approval history and subsequent premium restorations remain informational only.',
      ],
      sourceRefs: [page11, page20],
    },
    {
      id: 'premium-reduction-charge-refund',
      label: 'Premium Reduction Charge Refund',
      trigger: 'regular-premium-reduction',
      basis: 'source-event-charge-refund',
      appliesTo: ['accumulation'],
      rate: 1,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      sourceChargeRuleId: 'premium-reduction-charge',
      notes: [
        'Models the published retrospective refund of deducted premium reduction charge after admitted Support Benefit approval.',
        'Use the same reduction event and mark it as charge-refunded when the charge was deducted between the qualifying event date and notification date and later refunded.',
        'Approval history before the current projection start and later premium restorations remain informational only.',
      ],
      sourceRefs: [page11, page20],
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
        'Initial-units-account withdrawal lockout after the premium payment term, regular-withdrawal timing, and minimum withdrawal amount remain informational only.',
      ],
      sourceRefs: [page12, page13, page14],
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
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page8, page13, page22],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page3, page9, page10, page13, page14],
      },
    ],
    bonuses: buildBonuses(document, term),
    feeRules,
    eventChargeRules,
    eecTable: buildSurrenderChargeSchedule(term),
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 3_000,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'accumulation', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'during-mip', basis: 'account-value', accountId: 'accumulation', minimumValue: 3_000 },
        { activeWindow: 'after-mip', basis: 'policy-value', minimumValue: 3_000 },
      ],
      minimumTopUpStartPolicyMonth: 13,
    },
    warnings: [
      `FWD Invest First Summit is cataloged as a supported V1 corridor. The parser captures the SGD ${term}-year premium-payment corridor: initial-account charge, capped accumulation-account charge, top-up premium charge with blocking below the published S$3,000 minimum, before policy month 13, and in policy months where regular premiums are not paid up to date, premium shortfall charge with admitted-state Support Benefit charge-waiver and retrospective charge-refund support on premium-holiday events, premium reduction charge with admitted-state Support Benefit charge-waiver and retrospective charge-refund support on reduction events, zero redemption fee on the executable one-off partial-withdrawal path with accumulation-account start-month and minimum-remaining-value gating, the published Booster Bonus rates for policy years 1 to 3, the published Loyalty Bonus schedule throughout the premium payment term, the published 1.0% p.a. Perpetual Bonus after the premium payment term, the ${term}-year surrender-charge schedule, and the current-state death-benefit estimate as 105% of policy value.`,
      'Support Benefit approval history, multi-life last-survivor handling, and broader policy-flexibility behavior remain outside the current engine.',
    ],
    unsupportedItems: [
      `Booster Bonus pending-transaction timing and reward-band change notices remain informational only beyond the modeled ${term}-year-corridor bonus rates.`,
      'Loyalty Bonus pending-transaction timing remains informational only beyond the modeled published corridor-specific bonus schedule and the published adjustment-factor formula.',
      'Perpetual Bonus qualification and pending-transaction timing remain informational only beyond the modeled published 1.0% p.a. accumulation-account bonus rate.',
      'Support Benefit approval history, premium-shortfall recovery state, and outstanding-charge accumulation remain informational only beyond the modeled explicit charge-waived / charge-refunded event path.',
      'Multi-life last-survivor handling and change-of-person-insured behavior remain informational only beyond the modeled current ordinary death-benefit amount.',
      'Top-up cap, minimum withdrawal amount, regular withdrawal scheduling, and initial-units-account withdrawal rules beyond the modeled S$3,000 top-up minimum and the modeled accumulation-account one-off path remain informational only.',
      'Policy closure charge, change-of-policy-currency handling, switching-fee review rights, and fund management charges remain informational only.',
    ],
    sourceRefs: [page1, page3, page8, page9, page10, page11, page12, page13, page14, page20, page22],
  }
}

export function parseFwdInvestFirstSummit(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-first-summit',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest First Summit',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:fwd-invest-first-summit-initial-account-charge',
      'branch:fwd-invest-first-summit-accumulation-account-charge',
      'branch:fwd-invest-first-summit-top-up-premium-charge',
      'branch:fwd-invest-first-summit-premium-shortfall-charge',
      'branch:fwd-invest-first-summit-premium-reduction-charge',
      'branch:fwd-invest-first-summit-zero-redemption-fee',
      'branch:fwd-invest-first-summit-booster-bonus',
      'branch:fwd-invest-first-summit-loyalty-bonus',
      'branch:fwd-invest-first-summit-perpetual-bonus',
      'branch:fwd-invest-first-summit-surrender-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:top-up-start-policy-month-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
    ],
    coveredElsewhereBehaviors: [
      'fwd-invest-first-summit-policy-closure-charge',
      'fwd-invest-first-summit-fund-management-charge',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-first-summit-support-benefit-waiver-and-refund',
      'fwd-invest-first-summit-multi-life-last-survivor',
      'fwd-invest-first-summit-change-of-person-insured',
      'fwd-invest-first-summit-minimum-withdrawal-rules',
      'fwd-invest-first-summit-change-of-policy-currency',
    ],
    warnings: [
      'FWD Invest First Summit is cataloged as a supported V1 family. The current parser covers the SGD 10-year to 30-year premium-payment corridors with term-specific Booster Bonus, Loyalty Bonus, premium reduction charge, accumulation-account cap, and surrender-charge schedules, alongside the current-state death-benefit estimate as 105% of policy value.',
      'Support Benefit approval history, multi-life last-survivor handling, and broader policy-flexibility behavior remain metadata-only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(context.document, term)),
  }
}
