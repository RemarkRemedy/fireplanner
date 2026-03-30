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

type FlexiTerm = 1 | 3 | 5

interface FlexiConfig {
  startupTiers: IlpTemplateBonusTier[]
  loyaltyRate: number
  freeWithdrawalRate: number
  phcSchedule: number[]
  pwcSchedule: number[]
  eecSchedule: number[]
}

const AMF_DURING_MIP = 0.025
const AMF_AFTER_MIP = 0.01
const TOP_UP_PREMIUM_CHARGE_RATE = 0.03
const PREMIUM_CONTRIBUTION_BONUS_RATE = 0.01

const FLEXI_CONFIG: Record<FlexiTerm, FlexiConfig> = {
  1: {
    startupTiers: [
      { currency: 'SGD', minAnnualPremium: 25_000, maxAnnualPremium: 49_999.99, rate: 0.05 },
      { currency: 'SGD', minAnnualPremium: 50_000, maxAnnualPremium: null, rate: 0.1 },
      { currency: 'USD', minAnnualPremium: 25_000, maxAnnualPremium: 49_999.99, rate: 0.05 },
      { currency: 'USD', minAnnualPremium: 50_000, maxAnnualPremium: null, rate: 0.1 },
    ],
    loyaltyRate: 0.007,
    freeWithdrawalRate: 0.3,
    phcSchedule: [],
    pwcSchedule: [0.3, 0.23, 0.19, 0.16, 0.13, 0.1, 0.08, 0.06, 0.04, 0.03],
    eecSchedule: [0.3, 0.23, 0.19, 0.16, 0.13, 0.1, 0.08, 0.06, 0.04, 0.03],
  },
  3: {
    startupTiers: [
      { currency: 'SGD', minAnnualPremium: 9_000, maxAnnualPremium: 17_999.99, rate: 0.06 },
      { currency: 'SGD', minAnnualPremium: 18_000, maxAnnualPremium: null, rate: 0.12 },
      { currency: 'USD', minAnnualPremium: 9_000, maxAnnualPremium: 17_999.99, rate: 0.06 },
      { currency: 'USD', minAnnualPremium: 18_000, maxAnnualPremium: null, rate: 0.12 },
    ],
    loyaltyRate: 0.001,
    freeWithdrawalRate: 0.2,
    phcSchedule: [0, 0, 0.8],
    pwcSchedule: [1, 1, 0.8, 0.65, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    eecSchedule: [1, 1, 0.8, 0.65, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
  },
  5: {
    startupTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.15 },
      { currency: 'USD', minAnnualPremium: 6_000, maxAnnualPremium: 11_999.99, rate: 0.075 },
      { currency: 'USD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.15 },
    ],
    loyaltyRate: 0.0035,
    freeWithdrawalRate: 0.2,
    phcSchedule: [0, 0, 0.8, 0.65, 0.5],
    pwcSchedule: [1, 1, 0.8, 0.65, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
    eecSchedule: [1, 1, 0.8, 0.65, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08],
  },
}

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 8): string {
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

function parseFlexiTerm(filePath: string): FlexiTerm {
  const fileName = path.basename(filePath).toLowerCase()
  if (fileName.includes('flexi1')) return 1
  if (fileName.includes('flexi3')) return 3
  if (fileName.includes('flexi5')) return 5
  throw new Error(`Unable to determine Wealth Focus flexi term from source file: ${filePath}`)
}

function buildStartUpBonus(term: FlexiTerm, currency: 'SGD' | 'USD', page5: IlpCatalogSourceRef): IlpTemplateBonus {
  return {
    id: 'startup-bonus',
    type: 'allocation',
    label: 'Start-up Bonus',
    mode: 'premium-allocation',
    appliesTo: ['regular'],
    startPolicyYear: 1,
    endPolicyYear: 1,
    rate: 0,
    amount: null,
    tieredRates: FLEXI_CONFIG[term].startupTiers.filter((tier) => tier.currency === currency),
    notes: [
      'Applied to regular premiums paid in the first policy year only.',
      'Top-up premiums are excluded.',
    ],
    sourceRefs: [page5],
  }
}

function buildPremiumContributionBonus(page5: IlpCatalogSourceRef, page8: IlpCatalogSourceRef): IlpTemplateBonus {
  return {
    id: 'premium-contribution-bonus',
    type: 'allocation',
    label: 'Premium Contribution Bonus',
    mode: 'premium-allocation',
    appliesTo: ['regular'],
    startPolicyYear: 2,
    endPolicyYear: 10,
    rate: roundRate(PREMIUM_CONTRIBUTION_BONUS_RATE),
    amount: null,
    tieredRates: [],
    notes: [
      'Applied from policy month 13 to the end of the MIP on regular premiums only.',
      'Missed premiums during premium holiday receive no Premium Contribution Bonus, and repaid missed premiums also receive no bonus.',
    ],
    sourceRefs: [page5, page8],
  }
}

function buildLoyaltyBonus(term: FlexiTerm, page6: IlpCatalogSourceRef, page8: IlpCatalogSourceRef): IlpTemplateBonus {
  return {
    id: 'loyalty-bonus',
    type: 'loyalty',
    label: 'Loyalty Bonus',
    mode: 'annual-rate',
    appliesTo: ['regular'],
    startPolicyYear: 11,
    endPolicyYear: null,
    rate: roundRate(FLEXI_CONFIG[term].loyaltyRate),
    amount: null,
    tieredRates: [],
    excludedValueRules: [
      {
        trigger: 'premium-holiday-repayment',
        basis: 'repaid-premium',
      },
    ],
    notes: [
      'Allocated monthly from the first policy month after MIP on the Regular Premium Account only.',
      'Repaid missed regular premiums are tracked as a loyalty-bonus-excluded balance for future projection years in V1.',
      'Historical repaid missed premiums from before the projection start can be seeded as manual current excluded cohorts for the Loyalty Bonus base in V1.',
    ],
    sourceRefs: [page6, page8],
  }
}

function buildVariant(document: ExtractedPdfDocument, currency: 'SGD' | 'USD', term: FlexiTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description', snippetNear(document, 1, 'HSBC Life Wealth Focus Product Summary'))
  const page4 = sourceRef(4, 'Life Replacement Option', snippetNear(document, 4, 'Life Replacement Option'))
  const page5 = sourceRef(5, 'Bonuses', snippetNear(document, 5, 'Start-up Bonus', 20))
  const page6 = sourceRef(6, 'Loyalty Bonus and Free Partial Withdrawal Benefit', snippetNear(document, 6, 'Loyalty Bonus', 18))
  const page8 = sourceRef(8, 'Premium holiday', snippetNear(document, 8, 'Backpayment of missed Regular Premiums', 18))
  const page10 = sourceRef(10, 'Premium Charge and Premium Holiday Charge', snippetNear(document, 10, 'Premium Charge', 20))
  const page11 = sourceRef(11, 'AMF and Partial Withdrawal Charge', snippetNear(document, 11, 'Account Maintenance Fee', 22))
  const page12 = sourceRef(12, 'Early Encashment Charge', snippetNear(document, 12, 'Early Encashment Charge', 18))
  const page13 = sourceRef(13, 'Top-up Premiums', snippetNear(document, 13, 'Top-up Premium(s)', 18))
  const page15 = sourceRef(15, 'Regular Withdrawal', snippetNear(document, 15, 'Regular Withdrawal', 16))
  const page18 = sourceRef(18, 'Distribution of Dividend', snippetNear(document, 18, 'Distribution of Dividend', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'amf',
      label: 'Account Maintenance Fee',
      basis: 'premium-base-mip-multiplier',
      yearBasis: 'policy-year',
      rate: 0,
      amount: null,
      appliesTo: ['regular'],
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: term, mode: 'policy-year' },
          { startPolicyYear: term + 1, endPolicyYear: null, mode: 'fixed', multiplier: term },
        ],
      },
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 10, rate: roundRate(AMF_DURING_MIP) },
        { startPolicyYear: 11, endPolicyYear: null, rate: roundRate(AMF_AFTER_MIP) },
      ],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Charged monthly on the Regular Premium Account throughout the policy term, including during premium holiday.',
      ],
      sourceRefs: [page11],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: roundRate(TOP_UP_PREMIUM_CHARGE_RATE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: ['Charged on top-up premiums allocated into the Top-up Account.'],
      sourceRefs: [page10, page13],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['regular'],
      freeEventStartPolicyYear: 6,
      freeAmountPoolRate: roundRate(FLEXI_CONFIG[term].freeWithdrawalRate),
      freeAmountPoolBasis: 'open-balance-at-start-policy-year',
      freeAmountPoolReferencePolicyYear: 6,
      rate: 0,
      rateSchedule: buildRateSchedule(FLEXI_CONFIG[term].pwcSchedule),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies to withdrawals from the Regular Premium Account during the MIP.',
        'Top-up Account withdrawals are not charged.',
        `Free life-event withdrawals are modeled as a cumulative pool equal to ${Math.round(FLEXI_CONFIG[term].freeWithdrawalRate * 100)}% of the Regular Premium Account value at the start of policy year 6.`,
      ],
      sourceRefs: [page6, page11],
    },
  ]

  if (FLEXI_CONFIG[term].phcSchedule.length > 0) {
    eventChargeRules.push({
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['regular'],
      rate: 0,
      rateSchedule: buildRateSchedule(FLEXI_CONFIG[term].phcSchedule),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Charged monthly on annualised regular premium during premium holiday until the end of the selected Flexi Term.',
      ],
      sourceRefs: [page8, page10],
    })
  }

  return {
    id: `${currency.toLowerCase()}-mip-10`,
    currency,
    mipLength: 10,
    icpMonths: 1,
    accounts: [
      {
        id: 'regular',
        label: 'Regular Premium Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'regular', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'regular', contributionShare: 1 },
        ],
        sourceRefs: [page1, page10, page11],
      },
      {
        id: 'topup',
        label: 'Top-up Account',
        feeRate: 0,
        postMipFeeRate: 0,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page10, page13],
      },
    ],
    bonuses: [
      buildStartUpBonus(term, currency, page5),
      buildPremiumContributionBonus(page5, page8),
      buildLoyaltyBonus(term, page6, page8),
    ],
    feeRules,
    eventChargeRules,
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'topup',
      fallbackAccountIds: ['regular'],
      allowedFrequencies: currency === 'USD'
        ? ['annual', 'semi-annual', 'quarterly']
        : ['annual', 'semi-annual', 'quarterly', 'monthly'],
      minimumStartPolicyYear: 6,
      minimumAnnualWithdrawalAmount: 1_200,
      source: 'policy-redemption',
      notes: [
        'Regular Withdrawal may be paid yearly, half-yearly, quarterly, or monthly after the fifth policy anniversary by redeeming units.',
        'V1 exposes Regular Withdrawal as a manual scheduled-redemption assumption that redeems the Top-up Account first and then the Regular Premium Account.',
        'V1 models the published start gate after the fifth policy anniversary, the published annualised minimum Regular Withdrawal threshold, and the published payout-frequency availability by policy currency, while minimum remaining account value checks and qualifying life-event gating remain informational only.',
      ],
      sourceRefs: [page15],
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash, with reinvestment as the default if no option is elected.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page18],
    },
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpStartPolicyMonth: 13,
      minimumTopUpAmount: 5_000,
      topUpAmountIncrement: 10,
    },
    eecTable: FLEXI_CONFIG[term].eecSchedule.map(roundRate),
    warnings: [
      'Wealth Focus is modeled as a supported V1 product. The parser captures Start-up Bonus, Premium Contribution Bonus, Loyalty Bonus including projected repayment-excluded regular-premium balance after premium-holiday backpayment, AMF, top-up premium charge, premium-holiday top-up blocking, premium-holiday charge where applicable, partial-withdrawal charge, the current-state death-benefit estimate from regular-premium-paid history and current account balances after manual current amount owing, including manual current net protected premium base support once Regular Withdrawal assumptions are already active, the current accidental-death estimate before age 75 as the higher of that ordinary death amount or the 200%-of-paid-regular-premiums floor capped at SGD 2 million plus Top-up Account value after manual current age and current amount owing, including manual current accidental-death regular-premium-floor support once Regular Withdrawal assumptions are already active, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap subject to the published SGD 3 million aggregate limit, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, manual top-up-first scheduled payout support for Regular Withdrawal, MIP-end surrender charges, and the reinvest-default distribution-mode assumption surface.',
      'Life Replacement Option eligibility / underwriting, post-replacement cover resets, and policy-reissue fallback remain informational only in V1.',
    ],
    unsupportedItems: [
      'Life Replacement Option request timing, replacement eligibility, and underwriting acceptance remain informational only.',
      'Life Replacement Option rider termination, new suicide / incontestability / exclusion periods, and revised expiry-date administration remain informational only.',
      'Life Replacement Option policy-reissue fallback, non-identical replacement-policy terms, and post-replacement premium / term administration remain informational only.',
      'The current death-benefit estimate keeps a manual current net protected premium base input once Regular Withdrawal assumptions are already active because past top-up-first payout routing changes today’s protected base in ways this app cannot infer; that field is manual by design in V1.',
      'The current accidental-death estimate also needs manual current age and current amount owing inputs and, once Regular Withdrawal assumptions are already active, a manual current accidental-death regular-premium floor because past top-up-first payout routing changes today’s protected regular-premium floor in ways this app cannot infer; age-75 cut-off and the published SGD 2 million cap are modeled, while claim exclusions and settlement remain informational only.',
      'The current terminal-illness snapshot and residual death-benefit estimate after a TI claim today keep the same manual current net protected premium base requirement once Regular Withdrawal assumptions are already active because past top-up-first payout routing changes today’s protected base in ways this app cannot infer; that field is manual by design in V1.',
      'Terminal Illness claim admission, notification valuation timing, and settlement remain informational only beyond the modeled current TI snapshot and residual death-benefit estimate after TI claim today.',
      'Claim-side payout settlement remains informational only beyond the modeled current death, terminal-illness, and residual-after-TI snapshots.',
    ],
    sourceRefs: [page1, page4, page5, page6, page8, page10, page11, page12, page13, page15, page18],
  }
}

export function parseHsbcWealthFocus({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  const flexiTerm = parseFlexiTerm(document.filePath)
  const sourceFileName = path.basename(document.filePath)
  const productName = `Wealth Focus (Flexi ${flexiTerm})`
  const modeledEconomics = [
    'branch:wealth-focus-startup-bonus',
    'branch:wealth-focus-premium-contribution-bonus',
    'branch:wealth-focus-loyalty-bonus',
    'branch:wealth-focus-premium-base-amf',
    'branch:wealth-focus-top-up-premium-charge',
    'branch:wealth-focus-partial-withdrawal-charge',
    'branch:wealth-focus-eec',
    'branch:wealth-focus-ad-hoc-top-up-routing',
    'kernel:cumulative-free-partial-withdrawal-pool',
    'kernel:current-death-benefit-estimate',
    'kernel:current-accidental-death-benefit-estimate',
    'kernel:current-ti-benefit-estimate',
    'kernel:current-residual-death-benefit-after-ti-estimate',
    'kernel:scheduled-payout-manual-assumption',
    'kernel:scheduled-payout-start-gate',
    'kernel:scheduled-payout-minimum-annual-withdrawal-amount',
    'kernel:scheduled-payout-frequency-eligibility-gate',
    'kernel:distribution-mode-assumption',
    'kernel:premium-holiday-top-up-block',
    'kernel:top-up-start-policy-month-block',
    'kernel:top-up-amount-gate-block',
  ]

  if (FLEXI_CONFIG[flexiTerm].phcSchedule.length > 0) {
    modeledEconomics.push('branch:wealth-focus-premium-holiday-charge')
  }

  return {
    id: `hsbc-life-wealth-focus-flexi-${flexiTerm}`,
    insurer: 'HSBC Life',
    productName,
    sourceFileName,
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics,
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'wealth-focus-life-replacement-eligibility-and-underwriting',
      'wealth-focus-life-replacement-cover-reset-and-rider-termination',
      'wealth-focus-life-replacement-policy-reissue-fallback',
      'wealth-focus-accidental-death-claim-settlement-and-exclusions',
      'wealth-focus-terminal-illness-claim-admission-and-settlement',
      'wealth-focus-claim-side-benefit-settlement',
    ],
    warnings: [
      `Wealth Focus Flexi ${flexiTerm} is currently modeled as a supported V1 product. Accumulation charges, the cumulative life-event free-withdrawal pool, the current-state death-benefit estimate after manual current amount owing, the current accidental-death estimate before age 75 as the higher of the ordinary death amount or the 200%-of-paid-regular-premiums floor capped at SGD 2 million plus Top-up Account value after manual current age and current amount owing, including manual current accidental-death regular-premium-floor support once Regular Withdrawal assumptions are already active, the current terminal-illness snapshot as the lower of the ordinary death amount and a manual remaining aggregate TI cap subject to the published SGD 3 million aggregate limit, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, the top-up-first manual scheduled-payout surface for Regular Withdrawal, MIP-end surrender charges, regular/top-up routing, the documented bonuses including projected repayment-excluded Loyalty Bonus base after premium-holiday backpayment plus manual current excluded cohorts for historical repaid premiums, and reinvest-default distribution support are modeled, while Life Replacement Option eligibility / underwriting, post-replacement cover resets, policy-reissue fallback, accidental-death claim exclusions and settlement, terminal-illness claim admission / notification valuation timing / settlement, and claim-side benefit settlement remain informational only beyond the modeled current ordinary death, accidental death, TI, and residual-after-TI snapshot surface.`,
    ],
    archived: false,
    variants: [
      buildVariant(document, 'SGD', flexiTerm),
      buildVariant(document, 'USD', flexiTerm),
    ],
  }
}
