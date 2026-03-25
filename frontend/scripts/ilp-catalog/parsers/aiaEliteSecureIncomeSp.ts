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

const FULL_SURRENDER_CHARGE_SCHEDULE = [
  0.12,
  0.11,
  0.1,
  0.09,
  0.08,
  0.07,
  0.06,
  0.05,
  0.04,
  0.03,
  0,
] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  0,
  0.124,
  0.111,
  0.099,
  0.087,
  0.075,
  0.064,
  0.053,
  0.042,
  0.031,
  0,
] as const

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

function snippetNear(
  document: ExtractedPdfDocument,
  pageNumber: number,
  keyword: string,
  lineWindow = 10,
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
    rate,
  }))
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and payout election', snippetNear(document, 1, 'Secure Monthly Income', 16))
  const page2 = sourceRef(2, 'Secure Monthly Income mechanics', snippetNear(document, 2, 'Secure Monthly Income', 18))
  const page3 = sourceRef(3, 'Premium and top-up allocation', snippetNear(document, 3, '100% of Single Premium less Premium Charge', 16))
  const page4 = sourceRef(4, 'Charges and premium charge', snippetNear(document, 4, 'Premium Charge', 20))
  const page5 = sourceRef(5, 'Top-up premium charge and charge notes', snippetNear(document, 5, 'Top-Up Premium', 18))
  const page6 = sourceRef(6, 'Partial withdrawals and surrender', snippetNear(document, 6, 'Partial Withdrawals', 18))
  const page7 = sourceRef(7, 'Reinstatement and payout continuation', snippetNear(document, 7, 'Reinstatement', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'single-premium-charge',
      label: 'Single Premium Charge',
      basis: 'initial-single-premium',
      rate: 0.05,
      amount: 0,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      notes: [
        'Models the published 5% premium charge deducted from the initial single premium before units are purchased.',
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
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge deducted from each ad hoc top-up before top-up units are purchased.',
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
      rateSchedule: buildRateSchedule(PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published policy-year partial withdrawal charge factor on withdrawn single premium policy value.',
        'Partial withdrawals affect Secure Monthly Income and Power-up Bonus, but those downstream effects remain informational only in V1.',
      ],
      sourceRefs: [page5, page6],
    },
  ]

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'power-up-bonus',
      type: 'power-up',
      label: 'Power-up Bonus',
      mode: 'one-time',
      oneTimePayoutBasis: 'initial-single-premium-at-issue',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: null,
      cadenceYears: 5,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.025,
      amount: 0,
      tieredRates: [],
      adjustmentFactorConfig: {
        formula: 'cumulative-withdrawal-factor-product-over-account-value',
        withdrawalAccountIds: ['policy'],
        countFromPolicyYear: 6,
      },
      notes: [
        'Models the published 2.5% of single premium Power-up Bonus from the end of policy year 10 and every fifth policy year thereafter.',
        'Partial withdrawals from policy year 6 onward reduce the bonus by the published cumulative product of withdrawal factors.',
      ],
      sourceRefs: [page2, page6],
    },
  ]

  return {
    id: 'sgd-open-ended-sp',
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
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page3],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    eecTable: [...FULL_SURRENDER_CHARGE_SCHEDULE],
    exitChargeBasis: 'account-value',
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
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
        stateAfterReinstatement: 'target-income',
      },
      notes: [
        'Secure Monthly Income is paid by redeeming policy units after the selected payout start and for the selected payout period.',
      ],
      sourceRefs: [page1, page2, page7],
    },
    warnings: [
      'AIA Elite Secure Income - Single Premium is cataloged as a supported V1 product. The parser captures the published 5% single-premium charge, manual annual supplementary charge input, 3% top-up premium charge, the published S$1,000 minimum on explicit ad-hoc top-ups, full-surrender / partial-withdrawal charge schedules, the published S$10,000 residual policy-value floor on explicit one-off partial withdrawals, the Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability through the payout-state kernel, the current-state death and terminal-illness benefit amount as the higher of 105% of policy value or a manual current net protected premium base input, the current admitted-state terminal-illness payable amount as a manual current claim amount, an admitted-and-settled terminal-illness claim as a current policy-termination state, and the current accidental-death uplift as 10% of a manual initial single premium input during the first 5 policy years, including lapse suppression and post-reinstatement Target Monthly Income fallback in the annual-state model.',
      'This open-ended single-premium product uses the no-MIP basis; the review horizon is chosen in the policy seed rather than by product contract.',
    ],
    unsupportedItems: [
      'Secure Monthly Income amount, payout age, and payout period selection remain manual-assumption inputs in V1.',
      'Single-premium principal tracking and paid / deemed-paid Secure Monthly Income erosion need a manual current net protected premium base input in V1.',
      'Accidental-death claim admission timing, exclusions, and settlement remain informational only beyond the modeled current ordinary death amount plus the first-5-policy-year 10%-of-single-premium uplift.',
      'The current admitted-state terminal-illness payable amount is supported through manual claim-amount input, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but terminal-illness exclusions and settlement remain informational only.',
      'Fund-level management charges remain informational only because they depend on the selected ILP sub-fund.',
      'Fund switching is not allowed and remains informational only.',
    ],
    sourceRefs: [page1, page2, page3, page4, page5, page6, page7],
  }
}

export function parseAiaEliteSecureIncomeSp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'aia-elite-secure-income-single-premium',
    insurer: 'AIA Singapore',
    productName: 'AIA Elite Secure Income - Single Premium',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:aia-elite-secure-income-sp-single-premium-charge',
      'branch:aia-elite-secure-income-sp-supplementary-charge-manual-input',
      'branch:aia-elite-secure-income-sp-top-up-premium-charge',
      'branch:aia-elite-secure-income-sp-full-surrender-charge',
      'branch:aia-elite-secure-income-sp-partial-withdrawal-charge',
      'branch:aia-elite-secure-income-sp-power-up-bonus-no-withdrawal-corridor',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-accidental-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:lapse-reinstatement-payout-state',
    ],
    metadataOnlyBehaviors: [
      'aia-elite-secure-income-sp-secure-monthly-income-election',
      'aia-elite-secure-income-sp-single-premium-principal-tracking',
      'aia-elite-secure-income-sp-fund-management-charge',
      'aia-elite-secure-income-sp-no-fund-switching',
    ],
    warnings: [
      'AIA Elite Secure Income - Single Premium is cataloged as a supported V1 product. The parser captures the published 5% single-premium charge, manual annual supplementary charge input, 3% top-up premium charge, the published S$1,000 minimum on explicit ad-hoc top-ups, full-surrender / partial-withdrawal charge schedules, the published S$10,000 residual policy-value floor on explicit one-off partial withdrawals, the Power-up Bonus corridor from the end of policy year 10 and every fifth policy year thereafter including the published cumulative withdrawal-factor adjustment from policy year 6 onward, scheduled payout capability through the payout-state kernel, the current-state death and terminal-illness benefit amount as the higher of 105% of policy value or a manual current net protected premium base input, the current admitted-state terminal-illness payable amount as a manual current claim amount, an admitted-and-settled terminal-illness claim as a current policy-termination state, and the current accidental-death uplift as 10% of a manual initial single premium input during the first 5 policy years; payout selection, principal tracking, accidental-death claim admission / exclusions / settlement, terminal-illness exclusions / settlement, and fund-level charges remain informational only beyond the modeled current ordinary death, accidental death, and terminal-illness benefit amounts.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
