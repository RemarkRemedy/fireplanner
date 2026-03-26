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
  const page18 = sourceRef(18, 'Regular withdrawal', snippetNear(document, 18, 'REGULAR WITHDRAWAL', 24))
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
        'The calculator models the monthly deduction path only; TI / TPD cap logic, staged TPD payout treatment, claim-currency settlement, post-claim continuation, and later underwritten sum-assured changes remain informational only.',
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
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsDuringPremiumHoliday: true,
    },
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
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      minimumAnnualWithdrawalAmount: 1_200,
      source: 'policy-redemption',
      notes: [
        'Regular Withdrawal may be paid annually, semi-annually, quarterly, or monthly from the policy account.',
        'V1 exposes Regular Withdrawal as a manual scheduled-redemption assumption from the policy account.',
        'V1 models the published S$1,200 annualised minimum Regular Withdrawal threshold, while multiples-of-S$10 administration, minimum holding amount, and the insurer’s suspension / termination control over the facility remain informational only.',
      ],
      sourceRefs: [page18],
    },
    eecTable: [],
    warnings: [
      `This supported template models the SGD open-ended ${coverLabel} corridor with the published regular-premium charge schedule, the year-5-onward 102% regular-premium allocation uplift, the tiered Additional Bonus Units, the fixed S$5 monthly administration fee, the monthly death / TI insurance charge, the admitted-TI residual-death continuation corridor from remaining account value after the modeled TI payout, the current payable-now TPD snapshot from the published basic-sum-assured corridor after manual indebtedness, current TPD payout stage, and current-claim-stage TPD cap inputs, the 5% top-up / recurring-single-premium charge path, premium-holiday blocking of ad-hoc top-ups and recurring single premiums, the nil withdrawal/redemption-fee path, and manual Regular Withdrawal scheduled-redemption support with the published S$1,200 annual threshold.`,
      'Dividend cash payout remains a manual assumption surface and still depends on fund-level dividend declaration.',
    ],
    unsupportedItems: [
      'Terminal Illness and TPD cross-policy benefit caps remain informational only.',
      'The current TPD snapshot is modeled as the amount payable now after entering current indebtedness, the current TPD payout stage, the current-claim-stage TPD cap, and, for later-stage claims, the current remaining TPD balance.',
      'TPD Activities-of-Daily-Living qualification gating and later-balance release timing remain informational only beyond the modeled payable-now TPD snapshot.',
      'TI claim-currency settlement, plus TPD post-claim continuation and claim-currency settlement, remain informational only.',
      'Automatic Premium Holiday activation after missed regular premiums, lapse-state no-benefit periods, and premium-holiday resumption rules remain informational only.',
      'Policy reinstatement backpay, health evidence, approval timing, and post-reinstatement charge continuation remain informational only.',
      'Guaranteed Insurability Option milestone eligibility, health conditions, issue-time product availability, and cross-policy / sum-assured limits remain informational only.',
      'Life Replacement Option eligibility / underwriting, rider deletion, cover reset, assignment / beneficiary revocation, and new-life waiting-period / pre-existing-condition handling remain informational only.',
      'USD-denominated policies do not allow monthly Regular Premium mode and do not offer the Recurring Single Premium corridor, which remain informational only.',
      'Regular Withdrawal multiples-of-S$10 administration, minimum holding amounts, and the insurer’s suspension / termination control over the Regular Withdrawal facility remain informational only.',
      'Policy-change approvals, next-commencement-day change timing, and fund-switching administrative rules remain informational only.',
      'Fund-level management charges and other underlying-fund expenses remain informational only.',
    ],
    sourceRefs: [page4, page9, page10, page11, page12, page16, page17, page18, page24],
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
      'kernel:premium-holiday-top-up-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'kernel:current-tpd-benefit-estimate',
      'branch:hsbc-life-flexi-protector-top-up-premium-charge',
      'branch:hsbc-life-flexi-protector-recurring-single-premium-charge',
      'branch:hsbc-life-flexi-protector-zero-partial-withdrawal-charge',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-minimum-annual-withdrawal-amount',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'hsbc-life-flexi-protector-tpd-cross-policy-benefit-caps',
      'hsbc-life-flexi-protector-tpd-adl-qualification-and-later-release',
      'hsbc-life-flexi-protector-ti-claim-currency-settlement',
      'hsbc-life-flexi-protector-tpd-claim-currency-and-post-claim-continuation',
      'hsbc-life-flexi-protector-premium-holiday-lapse-and-no-claim-state',
      'hsbc-life-flexi-protector-reinstatement-and-backpay',
      'hsbc-life-flexi-protector-gio-milestone-eligibility-and-health-conditions',
      'hsbc-life-flexi-protector-gio-cross-policy-and-sum-assured-limits',
      'hsbc-life-flexi-protector-life-replacement-eligibility-and-underwriting',
      'hsbc-life-flexi-protector-life-replacement-cover-reset-and-beneficiary-reset',
      'hsbc-life-flexi-protector-regular-withdrawal-minimum-holding-and-termination',
      'hsbc-life-flexi-protector-policy-change-and-fund-switch-approvals',
      'hsbc-life-flexi-protector-usd-no-monthly-regular-premium-mode',
      'hsbc-life-flexi-protector-usd-no-rsp-corridor',
    ],
    warnings: [
      'HSBC Life Flexi Protector is cataloged as a supported V1 product. The parser captures explicit SGD open-ended Choice Cover and Max Cover variants with the published regular-premium charge schedule, the year-5-onward 102% regular-premium allocation uplift, the tiered Additional Bonus Units, the fixed S$5 monthly administration fee, the Choice/Max death and terminal-illness insurance-charge corridor, the current-state death-benefit estimate from that same cover corridor after manual sum-assured and supplementary-base inputs are provided, the current TI snapshot from the same cover corridor after manual indebtedness and remaining aggregate TI-cap inputs are provided, the admitted-TI residual death continuation corridor from remaining account value after the modeled TI payout, the current payable-now TPD snapshot from the published basic-sum-assured corridor after manual indebtedness, current TPD payout stage, current-claim-stage TPD cap, and, for later-stage claims, current remaining TPD balance inputs are provided, the 5% top-up / recurring-single-premium charge path, premium-holiday blocking of ad-hoc top-ups and recurring single premiums, and the nil withdrawal/redemption-fee path.',
      'TPD cross-policy cap derivation, ADL qualification / later-balance release handling, TI claim-currency conversion, TPD claim-currency conversion and post-claim continuation, Premium Holiday lapse / no-claim state, reinstatement, Guaranteed Insurability Option milestone / cross-policy limits, Life Replacement Option underwriting / cover resets, remaining regular-withdrawal holding / termination controls, policy-change / fund-switch approvals, and USD payment-frequency / RSP constraints remain informational only.',
      'Structured extraction validated against the HSBC Life Flexi Protector product summary text layer.',
    ],
    archived: false,
    variants: [
      buildVariant(document, 'choice-cover'),
      buildVariant(document, 'max-cover'),
    ],
  }
}
