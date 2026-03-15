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

const TERM_OPTIONS = [5, 10, 15, 20, 25] as const
type PremiumTerm = (typeof TERM_OPTIONS)[number]

const ADMIN_CHARGE: Record<PremiumTerm, { annualRate: number, durationYears: number }> = {
  5: { annualRate: 0.033, durationYears: 8 },
  10: { annualRate: 0.029, durationYears: 10 },
  15: { annualRate: 0.029, durationYears: 10 },
  20: { annualRate: 0.026, durationYears: 12 },
  25: { annualRate: 0.026, durationYears: 12 },
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

function tier(currency: 'SGD', minAnnualPremium: number | null, maxAnnualPremium: number | null, rate: number): IlpTemplateBonusTier {
  return { currency, minAnnualPremium, maxAnnualPremium, rate: roundRate(rate) }
}

function buildBonuses(term: PremiumTerm, page8: IlpCatalogSourceRef, page9: IlpCatalogSourceRef): IlpTemplateBonus[] {
  const growthTiers: Record<PremiumTerm, IlpTemplateBonusTier[][]> = {
    5: [
      [tier('SGD', null, 29_999.99, 0.01), tier('SGD', 30_000, null, 0.02)],
      [tier('SGD', null, 29_999.99, 0.02), tier('SGD', 30_000, null, 0.03)],
      [tier('SGD', null, 29_999.99, 0.02), tier('SGD', 30_000, null, 0.03)],
    ],
    10: [
      [tier('SGD', null, 11_999.99, 0.05), tier('SGD', 12_000, null, 0.08)],
      [tier('SGD', null, 11_999.99, 0.06), tier('SGD', 12_000, null, 0.12)],
      [tier('SGD', null, 11_999.99, 0.09), tier('SGD', 12_000, null, 0.15)],
    ],
    15: [
      [tier('SGD', 3_600, null, 0.1)],
      [tier('SGD', 3_600, null, 0.15)],
      [tier('SGD', 3_600, null, 0.2)],
    ],
    20: [
      [tier('SGD', 2_400, null, 0.12)],
      [tier('SGD', 2_400, null, 0.18)],
      [tier('SGD', 2_400, null, 0.25)],
    ],
    25: [
      [tier('SGD', 1_800, null, 0.15)],
      [tier('SGD', 1_800, null, 0.2)],
      [tier('SGD', 1_800, null, 0.3)],
    ],
  }

  const flexTiers: Record<PremiumTerm, IlpTemplateBonusTier[][]> = {
    5: [
      [tier('SGD', null, 29_999.99, 0.01), tier('SGD', 30_000, null, 0.01)],
      [tier('SGD', null, 29_999.99, 0.01), tier('SGD', 30_000, null, 0.01)],
      [tier('SGD', null, 29_999.99, 0), tier('SGD', 30_000, null, 0.01)],
    ],
    10: [
      [tier('SGD', null, 11_999.99, 0.01), tier('SGD', 12_000, null, 0.02)],
      [tier('SGD', null, 11_999.99, 0.02), tier('SGD', 12_000, null, 0.03)],
      [tier('SGD', null, 11_999.99, 0.02), tier('SGD', 12_000, null, 0.05)],
    ],
    15: [
      [tier('SGD', 3_600, null, 0.04)],
      [tier('SGD', 3_600, null, 0.06)],
      [tier('SGD', 3_600, null, 0.1)],
    ],
    20: [
      [tier('SGD', 2_400, null, 0.06)],
      [tier('SGD', 2_400, null, 0.09)],
      [tier('SGD', 2_400, null, 0.15)],
    ],
    25: [
      [tier('SGD', 1_800, null, 0.08)],
      [tier('SGD', 1_800, null, 0.12)],
      [tier('SGD', 1_800, null, 0.2)],
    ],
  }

  return [
    ...growthTiers[term].map((tiers, index) => ({
      id: `growth-welcome-bonus-year-${index + 1}`,
      type: 'allocation' as const,
      label: `Growth Account Welcome Bonus (Year ${index + 1})`,
      mode: 'premium-allocation' as const,
      appliesTo: ['growth'],
      startPolicyYear: index + 1,
      endPolicyYear: index + 1,
      rate: tiers[0]?.rate ?? 0,
      amount: null,
      tieredRates: tiers,
      notes: ['Applied to the Growth Account based on premium term, annualised premium, and chosen regular-premium allocation.'],
      sourceRefs: [page8],
    })),
    ...flexTiers[term].map((tiers, index) => ({
      id: `flex-welcome-bonus-year-${index + 1}`,
      type: 'allocation' as const,
      label: `Flex Account Welcome Bonus (Year ${index + 1})`,
      mode: 'premium-allocation' as const,
      appliesTo: ['flex'],
      startPolicyYear: index + 1,
      endPolicyYear: index + 1,
      rate: tiers[0]?.rate ?? 0,
      amount: null,
      tieredRates: tiers,
      notes: ['Applied to the Flex Account based on premium term, annualised premium, and chosen regular-premium allocation.'],
      sourceRefs: [page8],
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
      sourceRefs: [page8, page9],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument, term: PremiumTerm): IlpTemplateVariant {
  const page3 = sourceRef(3, 'Accounts and dividend election', snippetNear(document, 3, 'Growth Account is where', 8))
  const page7 = sourceRef(7, 'Accounts', snippetNear(document, 7, 'Accounts:'))
  const page8 = sourceRef(8, 'Welcome Bonus', snippetNear(document, 8, 'Welcome Bonus Tables'))
  const page9 = sourceRef(9, 'Loyalty Bonus and Charges', snippetNear(document, 9, 'Administration Charge Table'))
  const page10 = sourceRef(10, 'Assurance Charge and Top-up Premium Charge', snippetNear(document, 10, 'assurance charge'))
  const page14 = sourceRef(14, 'Top-up and Premium Holiday', snippetNear(document, 14, 'Investment Booster'))
  const page15 = sourceRef(15, 'Premium Holiday Refund and Premium Pass', snippetNear(document, 15, 'Premium Holiday Charge Refund'))
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
      sourceRefs: [page9],
    },
    {
      id: 'assurance-charge-combined',
      label: 'Assurance Charge (Appendix A total charge curve)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'prudential-assure-ii-combined',
        monthlyModalFactor: 0.0834,
      },
      requiresManualInput: true,
      appliesTo: ['growth', 'flex'],
      fallbackAppliesTo: ['additional'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Requires life-assured details, current net regular premium base, and the current Wealth Assure Value before the calculator can model the combined assurance charge.',
        'Modeled from Prudential Appendix A as the total published assurance charge curve by age next birthday.',
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
      sourceRefs: [page10, page14],
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
      sourceRefs: [page14],
    },
    {
      id: 'premium-holiday-charge-refund',
      label: 'Premium Holiday Charge Refund',
      trigger: 'premium-holiday-repayment',
      basis: 'premium-holiday-charge-refund',
      appliesTo: ['growth', 'flex'],
      rate: 0.9,
      rateSchedule: [],
      amount: 0,
      sourceChargeRuleId: 'premium-holiday-charge',
      activeWindow: 'policy-term',
      allocation: 'pro-rata-by-contribution-share',
      notes: [
        'Refunds 90% of premium-holiday charges after full repayment of unpaid premiums due.',
        'Allocated back into Growth and Flex Accounts based on the regular-premium split.',
      ],
      sourceRefs: [page15],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['growth', 'flex'],
      freeEventCount: term >= 15 ? 1 : undefined,
      freeEventStartPolicyYear: term >= 11 ? 11 : undefined,
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
      sourceRefs: [page15],
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
        sourceRefs: [page7],
      },
      {
        id: 'flex',
        label: 'Flex Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [],
        sourceRefs: [page7],
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
        sourceRefs: [page7],
      },
    ],
    bonuses: buildBonuses(term, page8, page9),
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
        'Receiving dividend payouts lowers the published Wealth Assure Value relative to reinvestment.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page3, page7],
    },
    eecTable: [...EXIT_CHARGE[term]],
    warnings: [
      'Set the actual Growth/Flex regular-premium split before trusting the fee-drag output. The seeded draft defaults to 50/50.',
      dividendElectionNote,
      'Enter insured-life details, current sum assured, and current Wealth Assure Value to activate the modeled assurance charges.',
      'Manual reduction or resumption events for sum assured / Wealth Assure Value require explicit resulting-state inputs.',
    ],
    unsupportedItems: [
      'Premium Pass, Wealth Share, and change-of-life-assured features remain informational only.',
    ],
    sourceRefs: [page7, page8, page9, page10, page14, page15],
  }
}

export function parsePrudentialPruVantageAssureII(context: ParseContext): IlpCatalogProduct {
  const variants = TERM_OPTIONS.map((term) => buildVariant(context.document, term))

  return {
    id: 'prudential-pruvantage-assure-ii',
    insurer: 'Prudential',
    productName: 'PRUVantage Assure II',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:assure-ii-pre-70-assurance',
      'branch:assure-ii-post-70-charge-tail',
      'branch:assure-ii-manual-reduction-resumption',
      'branch:pru-holiday-refund',
      'branch:pru-holiday-fallback',
      'branch:pru-top-up-charge',
      'branch:pru-free-withdrawal',
      'branch:pru-charged-withdrawal',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'premium-pass-wealth-share-change-of-life-assured-options',
    ],
    warnings: [
      'This template captures account routing, welcome/loyalty bonuses, premium-holiday mechanics, exit charges, Assure II assurance charges from Prudential Appendix A after you enter the insured-life details, Wealth Assure Value, and current sum assured, plus Growth Account dividend-election support through the manual distribution-mode kernel. Manual reduction/resumption events for sum assured and Wealth Assure Value are modeled as user-entered resulting states. Premium Pass / Wealth Share / change-of-life-assured options remain informational only.',
    ],
    archived: false,
    variants,
  }
}
