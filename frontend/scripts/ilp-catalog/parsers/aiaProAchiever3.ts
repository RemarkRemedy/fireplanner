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

const REGULAR_PREMIUM_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.76 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.51 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.26 },
  { startPolicyYear: 4, endPolicyYear: 6, rate: 0.04 },
  { startPolicyYear: 7, endPolicyYear: null, rate: 0 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.35, 0.2, 0.05, 0] as const
const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [4, 2.333, 1.5, 1, 0.818, 0.539, 0.25, 0.053, 0] as const
const PREMIUM_HOLIDAY_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.3 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.2 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.2 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.1 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.1 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.05 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.05 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.025 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.025 },
  { startPolicyYear: 11, endPolicyYear: null, rate: 0 },
] as const
const ANNUAL_PREMIUM_TIERS = [
  { minAnnualPremium: 2_400, maxAnnualPremium: 4_799.99 },
  { minAnnualPremium: 4_800, maxAnnualPremium: 7_199.99 },
  { minAnnualPremium: 7_200, maxAnnualPremium: 11_999.99 },
  { minAnnualPremium: 12_000, maxAnnualPremium: null },
] as const
const WELCOME_BONUS_YEAR_1_RATES = [0.05, 0.05, 0.1, 0.15] as const
const WELCOME_BONUS_YEAR_2_RATES = [0, 0.08, 0.13, 0.18] as const
const WELCOME_BONUS_YEAR_3_RATES = [0, 0.1, 0.15, 0.2] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 16): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
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

function buildTieredBonusRates(rates: readonly number[]) {
  return ANNUAL_PREMIUM_TIERS.map((tier, index) => ({
    currency: 'SGD' as const,
    minAnnualPremium: tier.minAnnualPremium,
    maxAnnualPremium: tier.maxAnnualPremium,
    rate: rates[index],
  }))
}

function buildBonuses(page2: IlpCatalogSourceRef, page3: IlpCatalogSourceRef): IlpTemplateBonus[] {
  return [
    {
      id: 'welcome-bonus-premium-year-1',
      type: 'sign-up',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      yearBasis: 'premium-year',
      rate: null,
      amount: null,
      tieredRates: buildTieredBonusRates(WELCOME_BONUS_YEAR_1_RATES),
      notes: [
        'Applied on each regular premium received during premium year 1 for the published IIP 10 corridor.',
        'Rates vary by annualised regular premium, and top-up premiums do not qualify.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'welcome-bonus-premium-year-2',
      type: 'sign-up',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 2,
      endPolicyYear: 2,
      yearBasis: 'premium-year',
      rate: null,
      amount: null,
      tieredRates: buildTieredBonusRates(WELCOME_BONUS_YEAR_2_RATES),
      notes: [
        'Applied on each regular premium received during premium year 2 for the published IIP 10 corridor.',
        'The lowest annualised-premium tier does not receive a premium-year-2 Welcome Bonus.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'welcome-bonus-premium-year-3',
      type: 'sign-up',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 3,
      endPolicyYear: 3,
      yearBasis: 'premium-year',
      rate: null,
      amount: null,
      tieredRates: buildTieredBonusRates(WELCOME_BONUS_YEAR_3_RATES),
      notes: [
        'Applied on each regular premium received during premium year 3 for the published IIP 10 corridor.',
        'The lowest annualised-premium tier does not receive a premium-year-3 Welcome Bonus.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'special-bonus-premium-years-10-20',
      type: 'allocation',
      label: 'Special Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: 20,
      yearBasis: 'premium-year',
      rate: 0.05,
      amount: null,
      tieredRates: [],
      notes: [
        'Applied on each regular premium received from premium years 10 to 20 in the published IIP 10 corridor.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'special-bonus-premium-year-21-onward',
      type: 'allocation',
      label: 'Special Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 21,
      endPolicyYear: null,
      yearBasis: 'premium-year',
      rate: 0.08,
      amount: null,
      tieredRates: [],
      notes: [
        'Applied on each regular premium received from premium year 21 onward in the published IIP 10 corridor.',
      ],
      sourceRefs: [page3],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'AIA Pro Achiever 3.0', 22))
  const page2 = sourceRef(2, 'Welcome and Special Bonus', snippetNear(document, 2, 'Special Bonus', 18))
  const page3 = sourceRef(3, 'Special Bonus and maturity benefit', snippetNear(document, 3, 'Special Bonus', 18))
  const page5 = sourceRef(5, 'Regular premium charge and benefit charge', snippetNear(document, 5, 'Premium charge for basic regular premium', 24))
  const page5BenefitCharge = sourceRef(5, 'Benefit Charge', snippetNear(document, 5, 'Benefit Charge', 22))
  const page6 = sourceRef(6, 'Premium Holiday Charge', snippetNear(document, 6, 'Premium Holiday Charge = Premium Holiday Charge Annual Rate/12 x Annualised Regular Premium', 26))
  const page8 = sourceRef(8, 'Full surrender charge', snippetNear(document, 8, 'Full Surrender Charge', 22))
  const page10 = sourceRef(10, 'Partial withdrawal charge', snippetNear(document, 10, 'Partial Withdrawal Charge', 22))
  const page11 = sourceRef(11, 'Top-up and withdrawal options', snippetNear(document, 11, 'Top-Up', 18))
  const page14 = sourceRef(14, 'Premium Pass and premium holiday interactions', snippetNear(document, 14, 'Premium Pass', 18))
  const page17 = sourceRef(17, 'Distribution of dividends', snippetNear(document, 17, 'Distribution of Dividends', 24))
  const page22 = sourceRef(22, 'Appendix A annual benefit charge schedule', snippetNear(document, 22, 'Current annual Benefit Charge per S$1,000 Sum-at-Risk', 22))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'regular-premium-charge',
      label: 'Regular Premium Charge',
      basis: 'annual-contribution',
      yearBasis: 'premium-year',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      rateSchedule: REGULAR_PREMIUM_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'policy-term',
      notes: [
        'Models the published basic regular premium charge schedule for the 10-year IIP corridor.',
        'Premium Reward and Premium Pass interactions remain informational only.',
      ],
      sourceRefs: [page2, page5],
    },
    {
      id: 'benefit-charge',
      label: 'Benefit Charge',
      basis: 'assurance-sum-at-risk',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      requiresManualInput: true,
      assuranceConfig: {
        formula: 'aia-pro-achiever-3-benefit-charge',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      notes: [
        'Models the published monthly Benefit Charge deducted to provide insurance cover for the regular-pay corridor.',
        'The sum at risk is the published total regular premiums paid plus total top-ups and premium reduction top-up amount, less total withdrawals and policy value, floored at zero.',
        'Enter the current net protected premium base manually because premium-reduction top-up history is not reconstructed in V1, while the published Appendix A rates vary by the insured’s gender and attained age.',
      ],
      sourceRefs: [page5BenefitCharge, page22],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'account-value',
      rate: roundRate(0.039),
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 10,
      suspensionRules: [
        {
          trigger: 'premium-holiday',
          basis: 'prorate-by-overlap-months',
        },
      ],
      notes: [
        'Models the published 3.90% p.a. charge on Regular Premium Policy Value for the 10-year IIP corridor, including proration off during explicit premium-holiday overlap months.',
        'Premium Pass activation remains informational only in V1.',
      ],
      sourceRefs: [page5, page14],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-Up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted ad-hoc top-up premium.',
        'V1 blocks ad-hoc top-ups in policy months where regular premiums are no longer paid up to date.',
      ],
      sourceRefs: [page5, page11],
    },
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      yearBasis: 'premium-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: PREMIUM_HOLIDAY_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly Premium Holiday Charge as the annualised regular premium multiplied by the premium-year charge rate for the active premium-holiday months.',
        'Because back payments are not allowed and the published charge schedule is tied to accepted premium count, the charge can still apply beyond policy year 10 until the 11th annual regular premium is accepted.',
        'Premium Pass entitlement and waiver logic remain informational only in V1.',
      ],
      sourceRefs: [page6, page14],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      yearBasis: 'premium-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published partial withdrawal charge factor on withdrawn Regular Premium Policy Value for the 10-year IIP corridor.',
        'Premium Reduction Policy Value and Premium Reduction Top-Up units remain outside the current executable slice.',
      ],
      sourceRefs: [page10, page11],
    },
  ]

  return {
    id: 'sgd-iip-10',
    currency: 'SGD',
    mipLength: 10,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Regular Premium Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page11],
      },
    ],
    bonuses: buildBonuses(page2, page3),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'By default, fund dividends are reinvested into the policy as additional units.',
        'If a fund offers cash dividend payouts, that option is only allowed after the end of the relevant IIP; V1 seeds reinvestment by default, cash payout requires a manual annual distribution-yield assumption, and payouts below the published S$50 minimum remain reinvested.',
      ],
      sourceRefs: [page17],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Pro Achiever 3.0 is cataloged as a supported V1 product for the regular-pay corridor. The parser models the 10-year IIP corridor: the premium-year Welcome Bonus tiers for premium years 1 to 3, the Special Bonus ladder from premium year 10 onward, the premium-year regular premium charge schedule, the published Appendix A Benefit Charge corridor, the 3.90% Supplementary Charge corridor including explicit premium-holiday overlap proration, the premium-year Premium Holiday Charge schedule during active premium-holiday months, the 5% top-up premium charge with blocking in months where regular premiums are not paid up to date and the published S$1,000 minimum on explicit ad-hoc top-ups, the regular-premium full-surrender / partial-withdrawal charge schedules, the current ordinary death-benefit estimate as the higher of policy value or a manual current net protected premium base, and the reinvest-default distribution-mode assumption surface; seeded premium-holiday months that would have qualified for Premium Pass may still show false-positive Premium Holiday Charges because Premium Pass state is not modeled in V1.',
      'Premium Pass, Premium Reduction, Premium Reward, and protection-side options remain outside the current engine.',
      'Secondary Insured handling and fund-level charges remain informational only in V1.',
    ],
    unsupportedItems: [
      'Accidental-death claim admission / exclusions / settlement and secondary-insured handling remain informational only beyond the modeled current ordinary death-benefit estimate, current accidental-death uplift, and Appendix A Benefit Charge corridor.',
      'Premium Pass entitlement and activation remain informational only, so seeded premium-holiday months that would have qualified for Premium Pass still project the published Premium Holiday Charge and suppressed Supplementary Charge in V1.',
      'Premium Reduction Charge, Premium Reduction Policy Value, and Premium Reduction Top-Up units remain informational only.',
      'Premium Reward remains informational only because it adds units and depends on paid-up and bonus-state conditions outside the current executable slice.',
      'Post-IIP cash-election operations and fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund switching, automatic fund switching, automatic fund re-balancing, and secondary insured handling remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page5, page8, page10, page11, page14, page17, page22],
  }
}

export function parseAiaProAchiever3({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-pro-achiever-3',
    insurer: 'AIA Singapore',
    productName: 'AIA Pro Achiever 3.0',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:aia-pro-achiever-3-welcome-bonus',
      'branch:aia-pro-achiever-3-special-bonus',
      'branch:aia-pro-achiever-3-regular-premium-charge',
      'branch:aia-pro-achiever-3-benefit-charge',
      'branch:aia-pro-achiever-3-regular-supplementary-charge',
      'branch:aia-pro-achiever-3-premium-holiday-charge',
      'branch:aia-pro-achiever-3-top-up-premium-charge',
      'branch:aia-pro-achiever-3-partial-withdrawal-charge',
      'branch:aia-pro-achiever-3-full-surrender-charge',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: ['aia-pro-achiever-3-fund-management-charge'],
    metadataOnlyBehaviors: [
      'aia-pro-achiever-3-premium-pass',
      'aia-pro-achiever-3-premium-reduction',
      'aia-pro-achiever-3-premium-reward',
      'aia-pro-achiever-3-secondary-insured-option',
    ],
    warnings: [
      'AIA Pro Achiever 3.0 is cataloged as a supported V1 product for the regular-pay corridor. The parser models the 10-year IIP Welcome Bonus tiers for premium years 1 to 3, the Special Bonus ladder from premium year 10 onward, the premium-charge corridor, the published Appendix A Benefit Charge corridor, the Supplementary Charge corridor including explicit premium-holiday overlap suppression, the Premium Holiday Charge schedule during active premium-holiday months, the 5% top-up premium charge, the regular-premium withdrawal / surrender charge schedules, the current accidental-death uplift as 100% of cumulative paid regular premiums during the first 2 policy years, and reinvest-default dividend support with cash payout allowed only after IIP, while Premium Pass entitlement/activation, premium-reduction mechanics, premium rewards, and protection-side claim handling beyond the modeled current ordinary death, accidental-death, Benefit Charge, Supplementary Charge, and Premium Holiday Charge estimates remain outside the current engine; seeded premium-holiday months that would have qualified for Premium Pass may still show false-positive Premium Holiday Charges because Premium Pass state is not modeled in V1.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
