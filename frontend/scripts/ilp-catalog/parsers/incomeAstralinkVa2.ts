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

function buildBonuses(term: MipTerm, page1: IlpCatalogSourceRef, page3: IlpCatalogSourceRef): IlpTemplateBonus[] {
  return [
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
      rate: 0,
      rateSchedule: buildRateSchedule(APPENDIX_2_CHARGE[term]),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published Appendix 2 premium-holiday charge after the first ${PREMIUM_HOLIDAY_NO_CHARGE_MONTHS[term]} months of charge-free premium holiday for the selected MIP corridor.`,
        'Premium-holiday start timing from the 2nd anniversary and the no-lapse / lapse gating remain manual in V1.',
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
    bonuses: buildBonuses(term, page1, page3),
    feeRules,
    eventChargeRules,
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
      'AstraLink (VA2) is modeled as a supported subset in V1. The parser captures the 105% post-MIP regular-premium allocation uplift, the term-specific annual loyalty bonus schedule from the 10th policy anniversary onward, the policy-fee schedule, the monthly insurance cover charge after insured-life and current-basic-benefit inputs are supplied, the Appendix 2 premium-holiday / partial-withdrawal / surrender charge schedules, and the published reinvest-only distribution mode.',
      'Investment bonus remains informational only because the published tables depend on sum-assured-multiple, annual-premium, and rider dimensions that are not expressible without overstating support in the current template surface.',
      'No Lapse Guarantee debt carry, premium-holiday start gating, and protection-side payout handling remain informational only in V1.',
    ],
    unsupportedItems: [
      'Investment bonus tables depend on annual premium bands and sum assured multiple, including a separate rider table, and remain informational only.',
      'No Lapse Guarantee amount-owed carry and reinstatement behavior remain informational only.',
      'Premium holiday start gating and the pre-2nd-anniversary lapse path remain informational only.',
      'Minimum withdrawal amount, minimum post-withdrawal policy value, and top-up blocking during premium holiday remain informational only.',
      'Changing premium or sum assured, retirement option, and guaranteed insurability option remain informational only.',
      'All protection-benefit payout mechanics remain informational only.',
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
      'branch:astralink-va2-post-mip-regular-allocation',
      'branch:astralink-va2-loyalty-bonus',
      'branch:astralink-va2-policy-fee',
      'branch:astralink-va2-insurance-cover-charge',
      'branch:astralink-va2-premium-holiday-charge',
      'branch:astralink-va2-partial-withdrawal-charge',
      'branch:astralink-va2-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'astralink-va2-investment-bonus',
      'astralink-va2-no-lapse-guarantee',
      'astralink-va2-premium-holiday-gating',
      'astralink-va2-protection-benefits',
      'astralink-va2-flexible-options',
    ],
    warnings: [
      'AstraLink (VA2) is cataloged as a supported V1 product. The parser captures the 105% post-MIP regular-premium allocation uplift, the term-specific annual loyalty bonus schedule, the policy-fee schedule, the monthly insurance cover charge after insured-life and current-basic-benefit inputs are supplied, the Appendix 2 premium-holiday / partial-withdrawal / surrender charge schedules, and the published reinvest-only distribution mode, while investment bonus, No Lapse Guarantee debt carry, premium-holiday start gating, and protection-side payouts remain informational only.',
    ],
    archived: false,
    variants: TERM_OPTIONS.map((term) => buildVariant(document, term)),
  }
}
