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
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.8 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.6 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.45 },
  { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
] as const

const ADDITIONAL_BONUS_UNIT_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 0, maxAccountValue: 29_999, rate: 0 },
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 30_000, maxAccountValue: 99_999, rate: 0.001 },
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 100_000, maxAccountValue: 499_999, rate: 0.002 },
  { currency: 'SGD', minAnnualPremium: null, maxAnnualPremium: null, minAccountValue: 500_000, maxAccountValue: null, rate: 0.003 },
] as const

type CoverOption = 'choice-cover' | 'max-cover'

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
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument, coverOption: CoverOption): IlpTemplateVariant {
  const page4 = sourceRef(4, 'Benefits and additional bonus units', snippetNear(document, 4, 'Additional Bonus Units', 24))
  const page9 = sourceRef(9, 'Distribution of dividend', snippetNear(document, 9, 'Distribution of Dividend', 24))
  const page10 = sourceRef(10, 'Regular premium and premium holiday', snippetNear(document, 10, 'Regular Premium', 28))
  const page11 = sourceRef(11, 'Top-up premium and recurring single premium', snippetNear(document, 11, 'TOP-UP PREMIUM', 28))
  const page12 = sourceRef(12, 'Premium allocation', snippetNear(document, 12, 'Percentage (%) of', 24))
  const page16 = sourceRef(16, 'Fees and charges', snippetNear(document, 16, 'PREMIUM CHARGE', 28))
  const page17 = sourceRef(17, 'Partial withdrawal and regular withdrawal', snippetNear(document, 17, 'PARTIAL WITHDRAWAL', 24))
  const page24 = sourceRef(24, 'Surrender and termination', snippetNear(document, 24, 'SURRENDER OF THE POLICY', 24))
  const insuranceFormula = coverOption === 'choice-cover' ? 'hsbc-flexi-choice-death-ti' : 'hsbc-flexi-max-death-ti'
  const coverLabel = coverOption === 'choice-cover' ? 'Choice Cover' : 'Max Cover'

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'regular-premium-allocation-uplift',
      type: 'allocation',
      label: 'Regular Premium Allocation Uplift',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 5,
      endPolicyYear: null,
      rate: 0.02,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published increase from 100% to 102% of regular premium units from the fifth policy year onward.',
      ],
      sourceRefs: [page12],
    },
    {
      id: 'additional-bonus-units',
      type: 'loyalty',
      label: 'Additional Bonus Units',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: null,
      rate: 0,
      amount: null,
      tieredRates: ADDITIONAL_BONUS_UNIT_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Modeled as a yearly policy-commencement-day annual-rate bonus based on the published account-value bands.',
        'Partial and regular withdrawals can reduce future Additional Bonus Units by reducing the account value; there is no separate withdrawal clawback rule.',
      ],
      sourceRefs: [page4, page17],
    },
  ]

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
        'Models the published regular-premium charge schedule from the subscription table.',
        'The separate 102% regular-premium allocation from policy year 5 onward is modeled as a standalone allocation uplift bonus.',
      ],
      sourceRefs: [page10, page12, page16],
    },
    {
      id: 'administration-fee',
      label: 'Administration Fee',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      amountSchedule: [
        { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
      ],
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published S$5 monthly administration fee as a fixed S$60 annual drag.',
      ],
      sourceRefs: [page16],
    },
    {
      id: 'death-ti-insurance-charge',
      label: 'Death / TI Insurance Charge',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: insuranceFormula,
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        `Models the monthly ${coverLabel} death / TI insurance charge using the existing HSBC assurance formula after entering the insured-life details and current basic-sum-assured / supplementary-premium-base inputs.`,
        'The calculator models the monthly deduction path only; TPD payout treatment and later underwritten sum-assured changes remain informational only.',
      ],
      sourceRefs: [page4, page16],
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
      ],
      sourceRefs: [page11, page16],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted recurring single premium.',
        'This parser captures the SGD corridor only because recurring single premium is not available for USD-denominated policies.',
      ],
      sourceRefs: [page11, page16],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'The redemption fee is currently waived and no additional partial-withdrawal charge is stated in the product summary.',
        'Minimum withdrawal amount, minimum holding amount, and account-value depletion termination rules remain informational only in V1.',
      ],
      sourceRefs: [page16, page17, page24],
    },
  ]

  return {
    id: coverOption === 'choice-cover' ? 'sgd-open-ended-choice-cover' : 'sgd-open-ended-max-cover',
    currency: 'SGD',
    mipBasis: 'open-ended',
    mipLength: null,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page10, page11, page12, page16],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      minimumAnnualPayoutAmount: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'The summary allows either dividend reinvestment or cash payout, with reinvestment as the default.',
        'Cash payout still depends on the fund-level dividend declaration, while the published S$30 minimum payout threshold is modeled.',
      ],
      sourceRefs: [page9],
    },
    eecTable: [],
    warnings: [
      `This supported template models the SGD open-ended ${coverLabel} corridor with the published regular-premium charge schedule, the year-5-onward 102% regular-premium allocation uplift, the tiered Additional Bonus Units, the fixed S$5 monthly administration fee, the monthly death / TI insurance charge, the 5% top-up / recurring-single-premium charge path, and the nil withdrawal/redemption-fee path.`,
      'Dividend cash payout remains a manual assumption surface and still depends on fund-level dividend declaration.',
    ],
    unsupportedItems: [
      'TPD payout treatment, terminal-illness claim limits, and cross-policy benefit caps remain informational only.',
      'Premium Holiday activation, top-up / recurring-single-premium suspension, lapse-state no-benefit periods, and premium-holiday resumption rules remain informational only.',
      'Policy reinstatement backpay, health evidence, approval timing, and post-reinstatement charge continuation remain informational only.',
      'Guaranteed Insurability Option milestone eligibility, health conditions, issue-time product availability, and cross-policy / sum-assured limits remain informational only.',
      'Life Replacement Option eligibility / underwriting, rider deletion, cover reset, assignment / beneficiary revocation, and new-life waiting-period / pre-existing-condition handling remain informational only.',
      'USD-specific payment constraints and the no-RSP USD corridor remain informational only.',
      'Minimum holding amounts, regular withdrawal facility rules, policy-change approval rules, and fund-switching mechanics remain informational only.',
      'Fund-level management charges and other underlying-fund expenses remain informational only.',
    ],
    sourceRefs: [page4, page9, page10, page11, page12, page16, page17, page24],
  }
}

export function parseHsbcLifeFlexiProtector({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'hsbc-life-flexi-protector',
    insurer: 'HSBC Life',
    productName: 'HSBC Life Flexi Protector',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:hsbc-life-flexi-protector-regular-premium-charge',
      'branch:hsbc-life-flexi-protector-regular-premium-allocation-uplift',
      'branch:hsbc-life-flexi-protector-additional-bonus-units',
      'branch:hsbc-life-flexi-protector-administration-fee',
      'branch:hsbc-flexi-choice-max-assurance',
      'branch:hsbc-life-flexi-protector-top-up-premium-charge',
      'branch:hsbc-life-flexi-protector-recurring-single-premium-charge',
      'branch:hsbc-life-flexi-protector-zero-partial-withdrawal-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'hsbc-life-flexi-protector-tpd-payout-structure',
      'hsbc-life-flexi-protector-premium-holiday-lapse-and-no-claim-state',
      'hsbc-life-flexi-protector-reinstatement-and-backpay',
      'hsbc-life-flexi-protector-gio-milestone-eligibility-and-health-conditions',
      'hsbc-life-flexi-protector-gio-cross-policy-and-sum-assured-limits',
      'hsbc-life-flexi-protector-life-replacement-eligibility-and-underwriting',
      'hsbc-life-flexi-protector-life-replacement-cover-reset-and-beneficiary-reset',
      'hsbc-life-flexi-protector-policy-change-approvals',
      'hsbc-life-flexi-protector-usd-corridor',
    ],
    warnings: [
      'HSBC Life Flexi Protector is cataloged as a supported V1 product. The parser captures explicit SGD open-ended Choice Cover and Max Cover variants with the published regular-premium charge schedule, the year-5-onward 102% regular-premium allocation uplift, the tiered Additional Bonus Units, the fixed S$5 monthly administration fee, the Choice/Max death and terminal-illness insurance-charge corridor, the 5% top-up / recurring-single-premium charge path, and the nil withdrawal/redemption-fee path.',
      'TPD claim treatment, Premium Holiday lapse / no-claim state, reinstatement, Guaranteed Insurability Option milestone / cross-policy limits, Life Replacement Option underwriting / cover resets, policy-change approvals, and USD-specific constraints remain informational only.',
      'Structured extraction validated against the HSBC Life Flexi Protector product summary text layer.',
    ],
    archived: false,
    variants: [
      buildVariant(document, 'choice-cover'),
      buildVariant(document, 'max-cover'),
    ],
  }
}
