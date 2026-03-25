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
type PremiumTerm = (typeof TERM_OPTIONS)[number]

const WELCOME_BONUS_GROWTH: Record<PremiumTerm, [number, number, number]> = {
  5: [0.02, 0.03, 0.05],
  10: [0.08, 0.15, 0.22],
  15: [0.12, 0.2, 0.28],
  20: [0.15, 0.25, 0.35],
  25: [0.2, 0.3, 0.45],
}

const WELCOME_BONUS_FLEX: Record<PremiumTerm, [number, number, number]> = {
  5: [0.01, 0.02, 0.02],
  10: [0.02, 0.03, 0.08],
  15: [0.04, 0.06, 0.13],
  20: [0.06, 0.09, 0.17],
  25: [0.08, 0.12, 0.22],
}

const ADMIN_CHARGE: Record<PremiumTerm, { annualRate: number, durationYears: number }> = {
  5: { annualRate: 0.033, durationYears: 8 },
  10: { annualRate: 0.027, durationYears: 10 },
  15: { annualRate: 0.027, durationYears: 10 },
  20: { annualRate: 0.025, durationYears: 12 },
  25: { annualRate: 0.025, durationYears: 12 },
}

const PREMIUM_HOLIDAY_CHARGE: Record<PremiumTerm, number[]> = {
  5: [0, 0, 0.5, 0.5, 0.5],
  10: [0, 0, 0.5, 0.5, 0.5, 0.2, 0.2, 0.2, 0.2, 0.2],
  15: [0, 0, 0.5, 0.5, 0.5, 0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1],
  20: [0, 0, 0.5, 0.5, 0.5, 0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05],
  25: [0, 0, 0.5, 0.5, 0.5, 0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
}

const EXIT_CHARGE: Record<PremiumTerm, number[]> = {
  5: [1, 1, 0.6, 0.5, 0.4],
  10: [1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
  15: [1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05],
  20: [1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.45, 0.4, 0.4, 0.35, 0.3, 0.25, 0.2, 0.12, 0.1, 0.08, 0.08, 0.05, 0.05],
  25: [1, 1, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.18, 0.18, 0.15, 0.15, 0.1, 0.1, 0.08, 0.08, 0.05, 0.05],
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function roundRate(value: number): number {
  return Number(value.toFixed(6))
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

function buildRateSchedule(values: number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate: roundRate(rate),
  }))
}

function buildBonuses(term: PremiumTerm, page4: IlpCatalogSourceRef, page5: IlpCatalogSourceRef): IlpTemplateBonus[] {
  const growthRates = WELCOME_BONUS_GROWTH[term]
  const flexRates = WELCOME_BONUS_FLEX[term]

  return [
    ...growthRates.map((rate, index) => ({
      id: `growth-welcome-bonus-year-${index + 1}`,
      type: 'allocation' as const,
      label: `Growth Account Welcome Bonus (Year ${index + 1})`,
      mode: 'premium-allocation' as const,
      appliesTo: ['growth'],
      startPolicyYear: index + 1,
      endPolicyYear: index + 1,
      rate: roundRate(rate),
      amount: null,
      tieredRates: [],
      notes: ['Applied to the Growth Account based on the fixed regular-premium allocation.'],
      sourceRefs: [page4],
    })),
    ...flexRates.map((rate, index) => ({
      id: `flex-welcome-bonus-year-${index + 1}`,
      type: 'allocation' as const,
      label: `Flex Account Welcome Bonus (Year ${index + 1})`,
      mode: 'premium-allocation' as const,
      appliesTo: ['flex'],
      startPolicyYear: index + 1,
      endPolicyYear: index + 1,
      rate: roundRate(rate),
      amount: null,
      tieredRates: [],
      notes: ['Applied to the Flex Account based on the fixed regular-premium allocation.'],
      sourceRefs: [page5],
    })),
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['growth', 'flex'],
      startPolicyYear: term + 1,
      endPolicyYear: null,
      rate: 0.005,
      amount: null,
      tieredRates: [],
      notes: [
        'Applied one month after each policy anniversary after the premium term.',
        'Top-up premiums in the Additional Investment Account do not receive the Loyalty Bonus.',
      ],
      sourceRefs: [page5],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, term: PremiumTerm): IlpTemplateVariant {
  const page2 = sourceRef(2, 'Accounts', snippetNear(document, 2, 'Accounts:'))
  const page3 = sourceRef(3, 'Death Benefit', snippetNear(document, 3, 'Death Benefit:'))
  const page4 = sourceRef(4, 'Welcome Bonus', snippetNear(document, 4, 'Welcome Bonus Tables'))
  const page5 = sourceRef(5, 'Loyalty Bonus and Administration Charge', snippetNear(document, 5, 'Loyalty Bonus'))
  const page10 = sourceRef(10, 'Assurance Charge', snippetNear(document, 10, 'assurance charge'))
  const page11 = sourceRef(11, 'Top-up and Premium Holiday', snippetNear(document, 11, 'Investment Booster'))
  const page12 = sourceRef(12, 'Premium Holiday Refund and Premium Pass', snippetNear(document, 12, 'Premium Holiday Charge Refund'))
  const page13 = sourceRef(13, 'Partial Withdrawal Charge', snippetNear(document, 13, 'Partial Withdrawal Charge Table'))
  const page14 = sourceRef(14, 'Free Partial Withdrawal and Surrender Charge', snippetNear(document, 14, 'Free Partial Withdrawal after 10 years'))
  const dividendPayoutAllowedAfterMip = true
  const dividendPayoutAllowedDuringMip = term >= 15
  const dividendElectionNote = term === 5
    ? 'Growth Account dividend payout is only allowed after 5 years from the cover start date once 5 years of premiums have been paid.'
    : 'Growth Account dividend payout is only allowed after 10 years from the cover start date once 10 years of premiums have been paid.'

  const adminCharge = ADMIN_CHARGE[term]
  const holidayChargeSchedule = buildRateSchedule(PREMIUM_HOLIDAY_CHARGE[term])

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'administration-charge',
      label: 'Administration Charge',
      basis: 'account-value',
      rate: roundRate(adminCharge.annualRate),
      amount: null,
      appliesTo: ['growth', 'flex'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: adminCharge.durationYears,
      notes: ['Applied monthly to the Growth Account and Flex Account. The Additional Investment Account does not bear the administration charge.'],
      sourceRefs: [page5],
    },
    {
      id: 'assurance-charge-death',
      label: 'Assurance Charge (Death)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'prudential-prosper-death',
        monthlyModalFactor: 0.0834,
      },
      requiresManualInput: true,
      appliesTo: ['growth', 'flex'],
      fallbackAppliesTo: ['additional'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Requires insured-life details and the current net regular premium base before the calculator can model the annualised assurance charge.',
        'Use fallback deduction to route any overflow to the Additional Investment Account after Growth and Flex are exhausted.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'assurance-charge-accidental-death',
      label: 'Assurance Charge (Accidental Death)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'prudential-prosper-accidental-death',
        monthlyModalFactor: 0.0834,
      },
      requiresManualInput: true,
      appliesTo: ['growth', 'flex'],
      fallbackAppliesTo: ['additional'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Requires insured-life details and the current net regular premium base before the calculator can model the annualised accidental-death assurance charge.',
        'Use fallback deduction to route any overflow to the Additional Investment Account after Growth and Flex are exhausted.',
      ],
      sourceRefs: [page10],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Investment Booster Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['additional'],
      rate: 0.03,
      amount: 0,
      sourceChargeRuleId: undefined,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies a 3% upfront charge on Investment Booster (lump-sum top-up) premiums.',
        'The remaining top-up premium is credited to the Additional Investment Account.',
      ],
      sourceRefs: [page11],
    },
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['growth', 'flex'],
      fallbackAppliesTo: ['additional'],
      rate: 0,
      rateSchedule: holidayChargeSchedule,
      amount: 0,
      sourceChargeRuleId: undefined,
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-value',
      notes: [
        'Charged monthly during premium holiday based on the annualised regular premium.',
        'Charges Growth and Flex Account value first, then falls back to the Additional Investment Account when those balances are exhausted.',
      ],
      sourceRefs: [page11],
    },
    {
      id: 'premium-holiday-charge-refund',
      label: 'Premium Holiday Charge Refund',
      trigger: 'premium-holiday-repayment',
      basis: 'premium-holiday-charge-refund',
      appliesTo: ['growth', 'flex'],
      rate: 0.7,
      rateSchedule: [],
      amount: 0,
      sourceChargeRuleId: 'premium-holiday-charge',
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-contribution-share',
      notes: [
        'Refunds 70% of premium-holiday charges after full repayment of unpaid premiums due.',
        'Allocated back into Growth and Flex Accounts based on the regular-premium split.',
      ],
      sourceRefs: [page12],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['growth', 'flex'],
      freeEventCount: term >= 15 ? 1 : undefined,
      freeEventStartPolicyYear: term >= 15 ? 11 : undefined,
      freeEventMaxAmountRate: term >= 15 ? 0.1 : undefined,
      rate: 0,
      rateSchedule: buildRateSchedule(EXIT_CHARGE[term]),
      amount: 0,
      sourceChargeRuleId: undefined,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applies to Growth and Flex Account withdrawals only.',
        ...(term >= 15
          ? ['The first eligible Growth/Flex partial withdrawal after policy year 10 is charge-free up to 10% of combined Growth and Flex account value.']
          : []),
      ],
      sourceRefs: [page13, page14],
    },
  ]

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipLength: term,
    icpMonths: 24,
    accounts: [
      {
        id: 'growth',
        label: 'Growth Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [],
        sourceRefs: [page2],
      },
      {
        id: 'flex',
        label: 'Flex Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [],
        sourceRefs: [page2],
      },
      {
        id: 'additional',
        label: 'Additional Investment Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'additional', contributionShare: 1 },
        ],
        sourceRefs: [page2],
      },
    ],
    bonuses: buildBonuses(term, page4, page5),
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['growth'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: dividendPayoutAllowedDuringMip,
      cashPayoutAllowedAfterMip: dividendPayoutAllowedAfterMip,
      source: 'distribution-paying-funds',
      notes: [
        'Funds in the Growth Account that aim to distribute dividends reinvest by default.',
        dividendElectionNote,
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page2, page4],
    },
    eecTable: [...EXIT_CHARGE[term]],
    warnings: [
      'Set the actual Growth/Flex regular-premium split before trusting the fee-drag output. The seeded draft defaults to 50/50.',
      dividendElectionNote,
      'Enter insured-life details and the current net regular premium base to activate the modeled assurance charges.',
      'The current-state death-benefit estimate is modeled as the higher of the 101%-of-paid-regular-premiums floor net Growth/Flex withdrawals or current Growth/Flex account value, plus Additional Investment Account value, after manual current amount owing.',
      'The current accidental-death estimate is modeled as the higher of the 105%-of-paid-regular-premiums floor net Growth/Flex withdrawals or current Growth/Flex account value, plus Additional Investment Account value, after manual current amount owing.',
    ],
    unsupportedItems: [
      'The current-state death-benefit estimate needs a manual current amount owing input because current debt is not reconstructed from history in V1.',
      'Accidental-death pre-existing-condition / suicide exclusions and other death-claim settlement mechanics remain informational only beyond the modeled current ordinary and accidental-death benefit estimates.',
      'Premium Pass, Wealth Share, and secondary-life/ownership options remain informational only.',
    ],
    sourceRefs: [page2, page3, page4, page5, page10, page11, page12, page13, page14],
  }
}

export function parsePrudentialPruVantageProsper(context: ParseContext): IlpCatalogProduct {
  const variants = TERM_OPTIONS.map((term) => buildVariant(context.document, term))

  return {
    id: 'prudential-pruvantage-prosper',
    insurer: 'Prudential',
    productName: 'PRUVantage Prosper',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:prosper-assurance-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'branch:pru-holiday-refund',
      'branch:pru-holiday-fallback',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'pruvantage-prosper-accidental-death-and-claim-exclusions',
      'premium-pass-wealth-share-secondary-life-options',
    ],
    warnings: [
      'This template captures account routing, bonuses, premium-holiday mechanics, the current-state death-benefit estimate as the higher of the 101%-of-paid-regular-premiums floor net Growth/Flex withdrawals or current Growth/Flex account value plus Additional Investment Account value after manual current amount owing, the current accidental-death estimate as the higher of the 105%-of-paid-regular-premiums floor net Growth/Flex withdrawals or current Growth/Flex account value plus Additional Investment Account value after manual current amount owing, Prudential Prosper assurance charges after you enter the insured-life details and current net regular premium base, plus Growth Account dividend-election support through the manual distribution-mode kernel. Accidental-death pre-existing-condition / suicide exclusions and broader death-claim settlement mechanics, Premium Pass, Wealth Share, and secondary-life options remain informational only.',
    ],
    archived: false,
    variants,
  }
}
