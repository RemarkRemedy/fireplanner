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

const REGULAR_PREMIUM_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: null, rate: 0 },
] as const

const PREMIUM_HOLIDAY_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.6 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.3 },
  { startPolicyYear: 3, endPolicyYear: 4, rate: 0.2 },
  { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.6,
  0.6,
  0.5,
  0.4,
  0.3,
  0.2,
  0.1,
  0,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  1.5,
  1.5,
  1,
  0.667,
  0.429,
  0.25,
  0.111,
  0,
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

function snippetNear(
  document: ExtractedPdfDocument,
  pageNumber: number,
  keyword: string,
  lineWindow = 14,
): string {
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

function buildTiers(values: Array<{ minAnnualPremium: number, maxAnnualPremium: number | null, rate: number }>): IlpTemplateBonusTier[] {
  return values.map((tier) => ({
    currency: 'SGD',
    minAnnualPremium: tier.minAnnualPremium,
    maxAnnualPremium: tier.maxAnnualPremium,
    rate: tier.rate,
  }))
}

function buildBonuses(page2: IlpCatalogSourceRef, page3: IlpCatalogSourceRef, page4: IlpCatalogSourceRef): IlpTemplateBonus[] {
  return [
    {
      id: 'welcome-bonus-y1',
      type: 'allocation',
      label: 'Welcome Bonus (Premium Year 1)',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      yearBasis: 'premium-year',
      rate: null,
      amount: null,
      tieredRates: buildTiers([
        { minAnnualPremium: 24_000, maxAnnualPremium: 41_999.99, rate: 0.03 },
        { minAnnualPremium: 42_000, maxAnnualPremium: null, rate: 0.03 },
      ]),
      notes: [
        'Applied to accepted regular premiums in premium year 1 using the published annualised regular premium tier.',
      ],
      sourceRefs: [page2, page3],
    },
    {
      id: 'welcome-bonus-y2',
      type: 'allocation',
      label: 'Welcome Bonus (Premium Year 2)',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 2,
      endPolicyYear: 2,
      yearBasis: 'premium-year',
      rate: null,
      amount: null,
      tieredRates: buildTiers([
        { minAnnualPremium: 42_000, maxAnnualPremium: null, rate: 0.04 },
      ]),
      notes: [
        'Applied to accepted regular premiums in premium year 2 using the published annualised regular premium tier.',
      ],
      sourceRefs: [page2, page3],
    },
    {
      id: 'welcome-bonus-y3',
      type: 'allocation',
      label: 'Welcome Bonus (Premium Year 3)',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 3,
      endPolicyYear: 3,
      yearBasis: 'premium-year',
      rate: null,
      amount: null,
      tieredRates: buildTiers([
        { minAnnualPremium: 42_000, maxAnnualPremium: null, rate: 0.05 },
      ]),
      notes: [
        'Applied to accepted regular premiums in premium year 3 using the published annualised regular premium tier.',
      ],
      sourceRefs: [page2, page3],
    },
    {
      id: 'investment-bonus',
      type: 'custom',
      label: 'Investment Bonus',
      mode: 'one-time',
      oneTimePayoutBasis: 'committed-annual-premium-at-issue',
      appliesTo: ['policy'],
      startPolicyYear: 8,
      endPolicyYear: 11,
      cadenceYears: 1,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.025,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published investment bonus as 2.5% of annualised regular premium at the beginning of policy years 8 to 11.',
        'The bonus is only credited while the policy remains in force and regular premiums are paid up to date.',
      ],
      sourceRefs: [page2, page4],
    },
    {
      id: 'performance-bonus',
      type: 'loyalty',
      label: 'Performance Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 8,
      endPolicyYear: null,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.004,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published annual Performance Bonus from the beginning of policy year 8 onward.',
        'The bonus credits 0.40% p.a. of Regular Premium Policy Value while the policy is in force and regular premiums are paid up to date.',
      ],
      sourceRefs: [page2, page4],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and bonuses', snippetNear(document, 1, 'AIA Platinum Wealth Venture 2.0', 20))
  const page2 = sourceRef(2, 'Bonuses and maturity benefit', snippetNear(document, 2, 'Investment Bonus', 20))
  const page3 = sourceRef(3, 'Regular premium and top-up subscription', snippetNear(document, 3, '100% of regular premium will be used to purchase regular premium units', 20))
  const page4 = sourceRef(4, 'Supplementary Charge and Premium Holiday Charge', snippetNear(document, 4, 'Supplementary Charge', 22))
  const page4BenefitCharge = sourceRef(4, 'Benefit Charge', snippetNear(document, 4, 'Benefit Charge', 22))
  const page5 = sourceRef(5, 'Full Surrender Charge and Partial Withdrawal Charge', snippetNear(document, 5, 'Full Surrender Charge', 20))
  const page6 = sourceRef(6, 'Top-up and withdrawal effects', snippetNear(document, 6, 'You may request to pay additional top-up premium', 20))
  const page7 = sourceRef(7, 'Premium holiday continuation', snippetNear(document, 7, 'Premium Holiday', 18))
  const page8 = sourceRef(8, 'Reinstatement and termination', snippetNear(document, 8, 'For reinstatement', 18))
  const page10 = sourceRef(10, 'Distribution of dividends', snippetNear(document, 10, 'Distribution of Dividends', 22))
  const page14 = sourceRef(14, 'Appendix A annual benefit charge schedule', snippetNear(document, 14, 'Current annual Benefit Charge per S$1,000 Sum-at-Risk', 22))

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
        'Models the published zero regular-premium charge corridor: 100% of accepted regular premium purchases regular premium units.',
      ],
      sourceRefs: [page3],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'account-value',
      rate: roundRate(0.036),
      amount: null,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 7,
      notes: [
        'Models the published 3.60% p.a. charge on Regular Premium Policy Value for the regular-pay corridor.',
      ],
      sourceRefs: [page4],
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
        formula: 'aia-venture-benefit-charge',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      notes: [
        'Models the published monthly Benefit Charge deducted to provide insurance cover for the regular-pay corridor.',
        'The sum at risk is the published total regular premiums paid plus total top-ups less total withdrawals less policy value, floored at zero.',
        'The published Appendix A rates vary by the insured’s gender and attained age, so life-assured inputs are required before the charge can be projected honestly.',
      ],
      sourceRefs: [page1, page4BenefitCharge, page14],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-Up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge on each accepted top-up premium.',
        'V1 blocks ad-hoc top-ups in policy months where regular premiums are no longer paid up to date.',
      ],
      sourceRefs: [page3, page6],
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
      allocation: 'pro-rata-by-value',
      notes: [
        'Charged monthly during premium holiday based on the annualised regular premium.',
        'The charge stops once all outstanding regular premiums are fully repaid.',
      ],
      sourceRefs: [page4, page7, page8],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published partial withdrawal charge factor on withdrawn Regular Premium Policy Value.',
        'V1 blocks explicit one-off partial withdrawals that would leave policy value below the published S$10,000 residual floor.',
        'The single-premium withdrawal schedule and published minimum withdrawal amount remain outside the current regular-pay-only executable slice.',
      ],
      sourceRefs: [page5, page6],
    },
  ]

  return {
    id: 'sgd-mip-5',
    currency: 'SGD',
    mipLength: 5,
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
        sourceRefs: [page1, page3, page6],
      },
    ],
    bonuses: buildBonuses(page2, page3, page4),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumTopUpAmount: 1_000,
      minimumPartialWithdrawalAmount: 1_000,
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 10_000 },
      ],
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 50,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds default to reinvestment as additional units unless a cash dividend election is made.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published S$50 minimum remain reinvested.',
      ],
      sourceRefs: [page10],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Platinum Wealth Venture 2.0 is cataloged as a supported V1 product for the regular-pay 5-year corridor. The parser captures the published Welcome Bonus tiers for premium years 1 to 3, the Investment Bonus milestones at policy years 8 to 11, the annual Performance Bonus from policy year 8 onward, the current-state death benefit as the higher of policy value or total regular premiums paid plus top-up premiums less withdrawals, the current accidental-death uplift as 100% of cumulative paid regular premiums during the first 2 policy years, zero regular-premium charge, the 3.60% p.a. regular-premium supplementary charge for the first 7 policy years, the published Appendix A Benefit Charge corridor, the premium-holiday charge schedule with full-outstanding-premium repayment resumption, annual-state lapse / termination after projected account-value depletion, the 3% top-up premium charge with blocking in months where regular premiums are not paid up to date and the published S$1,000 minimum on explicit ad-hoc top-ups, the regular-premium withdrawal / surrender charge schedules, and reinvest-default distribution support, while accidental-death and secondary-insured claim handling, fund-level charges, and underwriting or approval handling around premium resumption remain informational only beyond the modeled current ordinary death-benefit estimate, current accidental-death estimate, and Benefit Charge.',
      'Accidental-death claim admission / exclusions / settlement and Secondary Insured mechanics remain informational only beyond the modeled current ordinary death-benefit estimate plus the first-2-policy-year 100%-of-paid-regular-premiums accidental-death uplift.',
      'Automatic fund switching, reinvested dividend top-up units, and fund-level management charges remain informational only in V1.',
    ],
    unsupportedItems: [
      'Accidental-death claim admission / exclusions / settlement, secondary-insured handling, and other protection-side claim handling remain informational only beyond the modeled current ordinary death-benefit estimate plus the first-2-policy-year 100%-of-paid-regular-premiums accidental-death uplift.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Top-up suspension and single-premium withdrawal scheduling remain informational only.',
      'Fund switching and reinvested dividend top-up units remain informational only.',
      'Any underwriting or approval handling around premium resumption remains informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7, page8, page10],
  }
}

export function parseAiaPlatinumWealthVenture2({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-platinum-wealth-venture-2',
    insurer: 'AIA Singapore',
    productName: 'AIA Platinum Wealth Venture 2.0',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:aia-platinum-wealth-venture-2-welcome-bonus',
      'branch:aia-platinum-wealth-venture-2-investment-bonus',
      'branch:aia-platinum-wealth-venture-2-performance-bonus',
      'branch:aia-platinum-wealth-venture-2-zero-regular-premium-charge',
      'branch:aia-platinum-wealth-venture-2-regular-supplementary-charge',
      'branch:aia-platinum-wealth-venture-2-benefit-charge',
      'branch:aia-platinum-wealth-venture-2-top-up-premium-charge',
      'branch:aia-platinum-wealth-venture-2-premium-holiday-charge',
      'branch:aia-platinum-wealth-venture-2-partial-withdrawal-charge',
      'branch:aia-platinum-wealth-venture-2-full-surrender-charge',
      'kernel:automatic-lapse-on-account-depletion',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: ['aia-platinum-wealth-venture-2-fund-management-charge'],
    metadataOnlyBehaviors: [
      'aia-platinum-wealth-venture-2-secondary-insured-option',
      'aia-platinum-wealth-venture-2-fund-switching',
    ],
    warnings: [
      'AIA Platinum Wealth Venture 2.0 is cataloged as a supported V1 product for the regular-pay 5-year corridor. The parser captures the published Welcome Bonus tiers for premium years 1 to 3, the Investment Bonus milestones at policy years 8 to 11, the annual Performance Bonus from policy year 8 onward, the current-state death benefit as the higher of policy value or total regular premiums paid plus top-up premiums less withdrawals, the current accidental-death uplift as 100% of cumulative paid regular premiums during the first 2 policy years, zero regular-premium charge, the 3.60% p.a. regular-premium supplementary charge for the first 7 policy years, the published Appendix A Benefit Charge corridor, the premium-holiday charge schedule with full-outstanding-premium repayment resumption, annual-state lapse / termination after projected account-value depletion, the 3% top-up premium charge with blocking in months where regular premiums are not paid up to date and the published S$1,000 minimum on explicit ad-hoc top-ups, the regular-premium withdrawal / surrender charge schedules with the published S$10,000 residual policy-value floor on explicit one-off withdrawals, and reinvest-default distribution support, while secondary-insured claim handling, fund-level charges, and underwriting or approval handling around premium resumption remain informational only beyond the modeled current ordinary death, accidental-death, and Benefit Charge estimates.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
