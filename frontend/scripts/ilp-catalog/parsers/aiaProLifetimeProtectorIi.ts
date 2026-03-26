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

type DeathBenefitOption = 'plus' | 'max'

const REGULAR_PREMIUM_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.8 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.55 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.5 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.08 },
  { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [0.75, 0.5, 0] as const

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

function buildBenefitChargeRule(
  deathBenefitOption: DeathBenefitOption,
  page1: IlpCatalogSourceRef,
  page3: IlpCatalogSourceRef,
  page13: IlpCatalogSourceRef,
): IlpTemplateFeeRule {
  const isPlus = deathBenefitOption === 'plus'

  return {
    id: 'benefit-charge',
    label: `Benefit Charge (${isPlus ? 'Plus' : 'Max'})`,
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['policy'],
    activeWindow: 'policy-term',
    requiresManualInput: true,
    assuranceConfig: {
      formula: isPlus ? 'aia-plp2-plus-death' : 'aia-plp2-max-death',
      monthlyModalFactor: 1 / 12,
      maxAgeNextBirthday: 99,
      policyYearRateMultiplierSchedule: [
        { startPolicyYear: 1, endPolicyYear: 1, multiplier: 0.5 },
      ],
      sumAssuredRateMultiplierTiers: [
        { minSumAssured: 0, maxSumAssured: 119_999.99, multiplier: 1 },
        { minSumAssured: 120_000, maxSumAssured: 249_999.99, multiplier: 0.95 },
        { minSumAssured: 250_000, maxSumAssured: null, multiplier: 0.92 },
      ],
    },
    notes: [
      `Models the published monthly Appendix A Benefit Charge for the ${isPlus ? 'Plus' : 'Max'} Death Benefit option after entering the insured-life details and current insured amount.`,
      isPlus
        ? 'The Plus option uses the published insured-amount-only sum-at-risk basis.'
        : 'The Max option uses the published insured amount plus total top-up premiums less total withdrawals less policy value sum-at-risk basis.',
      'The first policy year receives the published 50% monthly Benefit Charge reduction, and insured-amount bands apply the published 5% / 8% monthly Benefit Charge reduction at S$120,000 / S$250,000 and above.',
      'No Lapse Privilege debt carry, extra-mortality revisions, and claim-side payout settlement remain informational only.',
    ],
    sourceRefs: [page1, page3, page13],
  }
}

function buildVariant(document: ExtractedPdfDocument, deathBenefitOption: DeathBenefitOption): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit options', snippetNear(document, 1, 'Death Benefit payable', 22))
  const page2 = sourceRef(2, 'Special Bonus and maturity', snippetNear(document, 2, 'Special Bonus', 18))
  const page3 = sourceRef(3, 'Regular premium, top-up, and charge schedules', snippetNear(document, 3, '5.5. Benefit Charge', 28))
  const page4 = sourceRef(4, 'Policy flexibility and premium variation', snippetNear(document, 4, 'Vary Regular Premium', 22))
  const page5 = sourceRef(5, 'Top-up, full surrender, and partial withdrawal', snippetNear(document, 5, 'Partial Withdrawal', 22))
  const page6 = sourceRef(6, 'Premium holiday and no lapse privilege', snippetNear(document, 6, 'No Lapse Privilege', 22))
  const page13 = sourceRef(13, 'Appendix A annual benefit charge schedule', snippetNear(document, 13, 'Current annual Benefit Charge per S$1,000 Sum-at-Risk', 26))
  const coverLabel = deathBenefitOption === 'plus' ? 'Plus' : 'Max'

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'special-bonus',
      type: 'allocation',
      label: 'Special Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      yearBasis: 'premium-year',
      requiresPremiumsPaidUpToDate: true,
      rate: 0.02,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published additional 2% of regular premiums from the 10th annual / 19th semi-annual / 37th quarterly / 109th monthly paid premium onward.',
        'Premium-year timing follows accepted full regular premiums; premium-holiday and reinstatement timing effects remain informational only in V1.',
      ],
      sourceRefs: [page2, page3],
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
        'Models the published regular-premium charge schedule by accepted full regular-premium count.',
        'When premiums resume after premium holiday or reinstatement, the premium charge continues from the band immediately after the last accepted regular premium.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      amountSchedule: [
        { startPolicyYear: 1, endPolicyYear: null, amount: 60 },
      ],
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published S$5 monthly policy fee as a fixed S$60 annual drag.',
      ],
      sourceRefs: [page3],
    },
    buildBenefitChargeRule(deathBenefitOption, page1, page3, page13),
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'fixed-amount-with-overlap-months',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
        { startPolicyYear: 3, endPolicyYear: null, rate: 0 },
      ],
      amount: 50,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published fixed S$50 monthly Premium Holiday Charge during the first two policy years only.',
        'No Lapse Privilege debt carry and premium-holiday behavior beyond this fixed monthly deduction remain informational only.',
      ],
      sourceRefs: [page6],
    },
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
      sourceRefs: [page3, page5],
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
        'No policy-level partial withdrawal charge is stated in the summary.',
        'V1 blocks explicit one-off partial withdrawals before the end of the second policy year.',
        'V1 also blocks explicit one-off partial withdrawals that would leave policy value below the published S$1,000 residual floor.',
        'V1 also blocks explicit one-off partial withdrawals below the published S$1,000 minimum amount.',
      ],
      sourceRefs: [page5],
    },
  ]

  return {
    id: deathBenefitOption === 'plus' ? 'sgd-open-ended-plus' : 'sgd-open-ended-max',
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
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3, page5],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      blockTopUpsWhenPremiumsNotPaidUpToDate: true,
      minimumPartialWithdrawalAmount: 1_000,
      minimumPartialWithdrawalStartPolicyMonthByAccount: [
        { accountId: 'policy', startPolicyMonth: 25 },
      ],
      partialWithdrawalMinimumRemainingValueRules: [
        { activeWindow: 'policy-term', basis: 'policy-value', minimumValue: 1_000 },
      ],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      `This supported template models the SGD open-ended ${coverLabel} corridor with the published premium-year regular premium charge schedule, the 2% Special Bonus from premium year 10 onward, the fixed S$5 monthly policy fee, the Appendix A Benefit Charge, the fixed S$50 monthly premium-holiday charge during the first two policy years, the 5% top-up premium charge with blocking in months where regular premiums are not paid up to date, the nil policy-level partial-withdrawal charge path with the post-second-policy-year start gate plus the published S$1,000 minimum one-off withdrawal amount and S$1,000 residual policy-value floor, the first-two-policy-years full-surrender charge schedule, and the current-state death benefit via a manual current insured amount input.`,
      'No Lapse Privilege debt carry, policy-variation approval rules, and claim-side payout settlement remain informational only.',
    ],
    unsupportedItems: [
      'No Lapse Privilege debt carry and post-depletion fee accrual remain informational only.',
      'Insured-amount variation, milestone-event increase option, regular-premium variation, and premium-frequency change handling remain informational only.',
      'AIA Vitality PowerUp Dollar, optional riders, fund switching, automatic fund switching, automatic fund re-balancing, and fund-level management charges remain informational only.',
      'Reinstatement underwriting and extra-mortality revisions remain informational only.',
      deathBenefitOption === 'plus'
        ? 'The Plus current death benefit needs a manual current insured amount input because insured-amount changes and claim-side reductions are not reconstructed from history in V1.'
        : 'The Max current death benefit needs a manual current insured amount input because insured-amount changes and claim-side reductions are not reconstructed from history in V1.',
      `The ${coverLabel} death-benefit claim-side payout settlement itself remains metadata-only beyond the modeled current snapshot and Benefit Charge corridor.`,
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page13],
  }
}

export function parseAiaProLifetimeProtectorIi({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-pro-lifetime-protector-ii',
    insurer: 'AIA Singapore',
    productName: 'AIA Pro Lifetime Protector (II)',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:aia-pro-lifetime-protector-ii-regular-premium-charge',
      'branch:aia-pro-lifetime-protector-ii-special-bonus',
      'branch:aia-pro-lifetime-protector-ii-policy-fee',
      'branch:aia-pro-lifetime-protector-ii-plus-benefit-charge',
      'branch:aia-pro-lifetime-protector-ii-max-benefit-charge',
      'branch:aia-pro-lifetime-protector-ii-premium-holiday-charge-fixed-monthly',
      'branch:aia-pro-lifetime-protector-ii-top-up-premium-charge',
      'branch:aia-pro-lifetime-protector-ii-zero-partial-withdrawal-charge',
      'branch:aia-pro-lifetime-protector-ii-full-surrender-charge',
      'kernel:partial-withdrawal-start-policy-month-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:current-death-benefit-estimate',
    ],
    coveredElsewhereBehaviors: ['aia-pro-lifetime-protector-ii-fund-management-charge'],
    metadataOnlyBehaviors: [
      'aia-pro-lifetime-protector-ii-no-lapse-privilege',
      'aia-pro-lifetime-protector-ii-insured-amount-variation',
      'aia-pro-lifetime-protector-ii-milestone-event-increase-option',
      'aia-pro-lifetime-protector-ii-regular-premium-variation',
      'aia-pro-lifetime-protector-ii-premium-frequency-change',
      'aia-pro-lifetime-protector-ii-aia-vitality-powerup-dollar',
      'aia-pro-lifetime-protector-ii-optional-riders',
      'aia-pro-lifetime-protector-ii-fund-switching-and-rebalancing',
      'aia-pro-lifetime-protector-ii-reinstatement-underwriting-and-extra-mortality',
      'aia-pro-lifetime-protector-ii-termination-limits',
    ],
    warnings: [
      'AIA Pro Lifetime Protector (II) is cataloged as a supported V1 product. The parser captures explicit SGD open-ended Plus and Max variants with the published premium-year regular premium charge schedule, the year-10-onward Special Bonus, the fixed S$5 monthly policy fee, the Appendix A Benefit Charge corridor, the fixed S$50 monthly premium-holiday charge during the first two policy years, the 5% top-up premium charge with blocking in months where regular premiums are not paid up to date, the nil policy-level partial-withdrawal charge path with the post-second-policy-year start gate plus the published S$1,000 minimum one-off withdrawal amount and S$1,000 residual policy-value floor, the first-two-policy-years full-surrender charge schedule, and the current-state death benefit via a manual current insured amount input.',
      'No Lapse Privilege debt carry, claim-side death-benefit settlement, milestone insured-amount increases, and AIA Vitality add-on mechanics remain informational only.',
      'Structured extraction validated against the AIA Pro Lifetime Protector (II) product summary text layer.',
    ],
    archived: false,
    variants: [
      buildVariant(document, 'plus'),
      buildVariant(document, 'max'),
    ],
  }
}
