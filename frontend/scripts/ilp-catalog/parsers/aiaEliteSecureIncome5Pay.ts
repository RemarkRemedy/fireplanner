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
  { startPolicyYear: 1, endPolicyYear: 1, rate: 0.3 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 0.2 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.1 },
  { startPolicyYear: 4, endPolicyYear: null, rate: 0 },
] as const

const PREMIUM_HOLIDAY_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 4, rate: 0.35 },
  { startPolicyYear: 5, endPolicyYear: null, rate: 0 },
] as const

const FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.5,
  0.45,
  0.4,
  0.35,
  0.3,
  0.25,
  0.2,
  0.15,
  0.1,
  0.05,
  0,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  1,
  0.818,
  0.667,
  0.538,
  0.429,
  0.333,
  0.25,
  0.176,
  0.111,
  0.053,
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
  lineWindow = 12,
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

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and Secure Monthly Income', snippetNear(document, 1, 'Secure Monthly Income', 18))
  const page2 = sourceRef(2, 'Secure payout conditions and Target Monthly Income', snippetNear(document, 2, 'The conditions to be satisfied before Secure Monthly Income is payable', 18))
  const page3 = sourceRef(3, 'Regular premium and top-up subscription', snippetNear(document, 3, '100% of Regular Premium less Premium Charge', 18))
  const page4 = sourceRef(4, 'Premium Charge and Supplementary Charge', snippetNear(document, 4, 'Premium Charge', 20))
  const page5 = sourceRef(5, 'Premium Holiday Charge and Full Surrender Charge', snippetNear(document, 5, 'Premium Holiday Charge', 18))
  const page6 = sourceRef(5, 'Partial Withdrawal Charge and top-up effects', snippetNear(document, 5, 'Partial Withdrawal Charge', 20))
  const page7 = sourceRef(8, 'Partial withdrawal effects and reinstatement', snippetNear(document, 8, 'Reinstatement', 20))

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
        'Models the published regular premium charge schedule by accepted premium count.',
        'If premiums were missed or the policy was reinstated, the charge resumes from the band immediately after the last accepted regular premium.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'supplementary-charge',
      label: 'Supplementary Charge',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 10,
      notes: [
        'Models the published monthly supplementary-charge formula as a manual annual charge amount for each full in-force policy year.',
        'Enter the annual supplementary charge amount from the policy illustration because the summary states the formula but not the annual rate.',
      ],
      sourceRefs: [page4],
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
        'V1 blocks ad-hoc top-ups in policy months where regular premiums are not paid up to date.',
        'Top-ups do not change the Secure Monthly Income or Secure Payout Period.',
      ],
      sourceRefs: [page3, page4, page6],
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
        'The charge stops once all outstanding premiums are fully repaid.',
      ],
      sourceRefs: [page5, page7],
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
        'Models the published policy-year partial withdrawal charge factor on withdrawn regular premium policy value.',
        'Partial withdrawals from regular premium units or bonus units affect Secure Monthly Income and Power-up Bonus, but those downstream effects remain informational only in V1.',
      ],
      sourceRefs: [page6, page7],
    },
  ]

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'power-up-bonus',
      type: 'power-up',
      label: 'Power-up Bonus',
      mode: 'one-time',
      oneTimePayoutBasis: 'committed-annual-premium-at-issue',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      cadenceYears: 5,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.125,
      amount: 0,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'cumulative-withdrawal-factor-product-over-account-value',
        withdrawalAccountIds: ['policy'],
        countFromPolicyYear: 6,
      },
      notes: [
        'Models the published 12.5% of annual premium Power-up Bonus from the end of policy year 10 and every fifth policy year thereafter.',
        'Partial withdrawals from policy year 6 onward reduce the bonus by the published cumulative product of withdrawal factors.',
      ],
      sourceRefs: [page2, page6],
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
        label: 'Policy Account',
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
    bonuses,
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
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      source: 'policy-redemption',
      payoutStateSupport: {
        defaultState: 'secure-income',
        suppressWhileLapsed: true,
        stateAfterPremiumHolidayActivation: 'target-income',
        stateAfterReinstatement: 'target-income',
      },
      notes: [
        'Monthly Income after the selected payout age is paid via redemption of policy units, with Secure Monthly Income during the Secure Payout Period and Target Monthly Income thereafter.',
      ],
      sourceRefs: [page1, page2, page7],
    },
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'AIA Elite Secure Income - 5 Pay is cataloged as supported in V1 for the regular-pay corridor. The parser captures the premium-year regular premium charge schedule, a manual-input annual supplementary charge amount from the policy illustration, the 3% top-up premium charge with blocking in policy months where regular premiums are not paid up to date and the published S$1,000 minimum on explicit ad-hoc top-ups, the premium-holiday charge schedule, annual-state lapse after projected account-value depletion, the full-surrender / partial-withdrawal charge schedules, the published S$10,000 residual policy-value floor on explicit one-off partial withdrawals, the Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability through the payout-state kernel, the current-state death and terminal-illness benefit amount as the higher of 105% of policy value or a manual current net protected premium base input, the current admitted-state terminal-illness payable amount as a manual current claim amount, an admitted-and-settled terminal-illness claim as a current policy-termination state, and the current accidental-death uplift as 50% of cumulative paid regular premiums during the first 5 policy years, including permanent Target Monthly Income fallback after Premium Holiday activation or reinstatement in the annual-state model.',
      'Secure Monthly Income eligibility depends on no premium holiday, no regular-premium-unit or bonus-unit withdrawal, and no prior reinstatement, so payout selection and payout-state gating remain manual or informational inputs in V1.',
      'Supplementary charge requires a manual annual amount from the policy illustration because the summary states the formula but not the annual rate.',
    ],
    unsupportedItems: [
      'Secure Monthly Income amount, payout age, and payout period selection remain manual-assumption inputs in V1.',
      'Secure Monthly Income versus Target Monthly Income gating remains informational only, including payout opt-out, reinvested-unit handling, and resumption after payout suspension.',
      'Regular-premium paid history and paid / deemed-paid Secure Monthly Income erosion need a manual current net protected premium base input in V1.',
      'Accidental-death claim admission timing, exclusions, and settlement remain informational only beyond the modeled current ordinary death amount plus the first-5-policy-year 50%-of-paid-regular-premiums uplift.',
      'The current admitted-state terminal-illness payable amount is supported through manual claim-amount input, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but terminal-illness exclusions and settlement remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund switching remains informational only because it is not allowed under the product terms.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7],
  }
}

export function parseAiaEliteSecureIncome5Pay({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-elite-secure-income-5-pay',
    insurer: 'AIA Singapore',
    productName: 'AIA Elite Secure Income - 5 Pay',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:aia-elite-secure-income-5p-premium-year-premium-charge',
      'branch:aia-elite-secure-income-5p-supplementary-charge-manual-input',
      'branch:aia-elite-secure-income-5p-top-up-premium-charge',
      'branch:aia-elite-secure-income-5p-premium-holiday-charge',
      'branch:aia-elite-secure-income-5p-partial-withdrawal-charge',
      'branch:aia-elite-secure-income-5p-full-surrender-charge',
      'branch:aia-elite-secure-income-5p-power-up-bonus-no-withdrawal-corridor',
      'kernel:automatic-lapse-on-account-depletion',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:top-up-paid-up-to-date-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:lapse-reinstatement-payout-state',
    ],
    metadataOnlyBehaviors: [
      'aia-elite-secure-income-5p-secure-monthly-income-election',
      'aia-elite-secure-income-5p-secure-monthly-income-gating',
      'aia-elite-secure-income-5p-fund-management-charge',
      'aia-elite-secure-income-5p-withdrawal-eligibility-gating',
      'aia-elite-secure-income-5p-no-fund-switching',
    ],
    warnings: [
      'AIA Elite Secure Income - 5 Pay is cataloged as supported in V1 for the regular-pay corridor. The parser captures the premium-year regular premium charge schedule, a manual-input annual supplementary charge amount from the policy illustration, the 3% top-up premium charge with blocking in policy months where regular premiums are not paid up to date, the premium-holiday charge schedule, annual-state lapse after projected account-value depletion, the full-surrender / partial-withdrawal charge schedules, the published S$10,000 residual policy-value floor on explicit one-off partial withdrawals, the Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability through the payout-state kernel, the current-state death and terminal-illness benefit amount as the higher of 105% of policy value or a manual current net protected premium base input, the current admitted-state terminal-illness payable amount as a manual current claim amount, an admitted-and-settled terminal-illness claim as a current policy-termination state, and the current accidental-death uplift as 50% of cumulative paid regular premiums during the first 5 policy years; payout-election logic, accidental-death claim admission / exclusions / settlement, terminal-illness exclusions / settlement, and fund-level charges remain informational only beyond the modeled current ordinary death, accidental death, and terminal-illness benefit amounts.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
