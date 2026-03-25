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

const STARTUP_BONUS_RATE = 0.35
const LOYALTY_BONUS_RATE = 0.0035
const TOP_UP_PREMIUM_CHARGE_RATE = 0.05
const AMF_RATE = 0.035
const BRC_RATE = 0.35
const PWC_SCHEDULE = [1, 0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.05]
const EEC_SCHEDULE = [1, 0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.05]
const PHC_SCHEDULE = [0, 0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.05]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  return {
    page,
    section,
    excerpt: normalizeWhitespace(excerpt).slice(0, 220),
  }
}

function roundRate(value: number): number {
  return Number(value.toFixed(6))
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

function buildYearRateSchedule(values: number[]): Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }> {
  return values.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate: roundRate(rate),
  }))
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page3 = sourceRef(3, 'Accounts and bonuses', snippetNear(document, 3, 'This plan consists of two (2) accounts'))
  const page4 = sourceRef(4, 'Start-up Bonus', snippetNear(document, 4, 'Start-up Bonus'))
  const page5 = sourceRef(5, 'Loyalty Bonus', snippetNear(document, 5, 'Loyalty Bonus'))
  const page8 = sourceRef(8, 'Recurring Single Premium and Premium Holiday', snippetNear(document, 8, 'RECURRING SINGLE PREMIUM'))
  const page9 = sourceRef(9, 'Fees and charges', snippetNear(document, 9, 'ACCOUNT MAINTENANCE FEE'))
  const page10 = sourceRef(10, 'Fees and charges', snippetNear(document, 10, 'PREMIUM HOLIDAY CHARGE'))
  const page11 = sourceRef(11, 'Fees and charges', snippetNear(document, 11, 'EARLY ENCASHMENT CHARGE'))
  const page13 = sourceRef(13, 'Distribution Paying Fund', snippetNear(document, 13, 'Distribution Paying Fund'))
  const page14 = sourceRef(14, 'Regular Withdrawal', snippetNear(document, 14, 'REGULAR WITHDRAWAL', 20))

  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'startup-bonus',
      type: 'allocation',
      label: 'Start-up Bonus',
      mode: 'premium-allocation',
      appliesTo: ['regular'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: roundRate(STARTUP_BONUS_RATE),
      amount: null,
      tieredRates: [],
      notes: [
        'Applied to each regular premium received in the first policy year.',
        'Allocated into the Regular Premium Account only.',
      ],
      sourceRefs: [page4],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'monthly-rate',
      appliesTo: ['regular'],
      startPolicyYear: 10,
      endPolicyYear: null,
      rate: roundRate(LOYALTY_BONUS_RATE),
      amount: null,
      tieredRates: [],
      notes: [
        'Allocated monthly from the first policy month in policy year 10 onward while the policy remains in force.',
        'No Loyalty Bonus will be payable in the next 12 policy months after a partial withdrawal from the Regular Premium Account.',
        'Regular Withdrawal is modeled through the manual scheduled-payout assumption surface, so loyalty-bonus suspension follows scheduled redemptions while that assumption is active.',
      ],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12, startOffsetMonths: 1 },
        { trigger: 'scheduled-payout', suspensionMonths: 12, startOffsetMonths: 1 },
      ],
      sourceRefs: [page5, page14],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'amf',
      label: 'Account Maintenance Fee',
      basis: 'account-value',
      rate: roundRate(AMF_RATE),
      amount: 0,
      appliesTo: ['regular'],
      activeWindow: 'during-mip',
      startPolicyYear: 1,
      endPolicyYear: 11,
      notes: [
        'Charged monthly on the Regular Premium Account during the first eleven policy years.',
      ],
      sourceRefs: [page9],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up / Recurring Single Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: roundRate(TOP_UP_PREMIUM_CHARGE_RATE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applied to ad-hoc top-up premiums credited into the Top-up Account.',
      ],
      sourceRefs: [page8, page9],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['topup'],
      rate: roundRate(TOP_UP_PREMIUM_CHARGE_RATE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Applied to recurring single premium payments credited into the Top-up Account.',
      ],
      sourceRefs: [page8, page9],
    },
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['regular'],
      rate: 0,
      rateSchedule: buildYearRateSchedule(PHC_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Charged monthly against the prevailing regular premium amount during premium holiday from policy year 2 to 11.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['regular'],
      rate: 0,
      rateSchedule: buildYearRateSchedule(PWC_SCHEDULE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Charged only on withdrawals from the Regular Premium Account in policy years 2 to 11.',
        'Withdrawals from the Top-up Account are not charged.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'brc',
      label: 'Bonus Recovery Charge',
      trigger: 'regular-premium-reduction',
      basis: 'premium-reduction-with-startup-recovery',
      appliesTo: ['regular'],
      rate: roundRate(BRC_RATE),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applied to each regular premium reduction during the first eleven policy years.',
        'Modeled as annual reduction amount x 35% x remaining fraction of 132 months.',
      ],
      sourceRefs: [page9],
    },
  ]

  return {
    id: 'sgd-mip-11',
    currency: 'SGD',
    mipLength: 11,
    icpMonths: 1,
    accounts: [
      {
        id: 'regular',
        label: 'Regular Premium Account',
        feeRate: roundRate(AMF_RATE),
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [],
        sourceRefs: [page3],
      },
      {
        id: 'topup',
        label: 'Top-up Account',
        feeRate: 0,
        postMipFeeRate: 0,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page3, page8],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'regular',
      minimumStartPolicyYear: 12,
      minimumAnnualWithdrawalAmount: 1_200,
      source: 'policy-redemption',
      notes: [
        'Regular Withdrawal may be paid yearly, half-yearly, quarterly, or monthly from policy year 12 onward by redeeming units from the Regular Premium Account.',
        'V1 exposes Regular Withdrawal as a manual scheduled-redemption assumption from the Regular Premium Account only.',
        'V1 models the published start gate from policy year 12 and the annualised minimum Regular Withdrawal threshold, while minimum remaining Regular Premium Account value checks and the insurer’s right to suspend or terminate the facility remain informational only.',
      ],
      sourceRefs: [page14],
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      minimumAnnualPayoutAmount: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash, with reinvestment as the default if no option is elected.',
        'Cash payout applies to both the Regular Premium Account and the Top-up Account.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption while designated-bank-account routing remains informational only.',
      ],
      sourceRefs: [page13],
    },
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      blockTopUpsDuringPremiumHoliday: true,
      minimumTopUpAmount: 250,
      topUpAmountIncrement: 10,
    },
    eecTable: EEC_SCHEDULE.map(roundRate),
    warnings: [
      'This template captures the modeled regular-premium, top-up, premium-holiday, withdrawal-charge, BRC, the current-state death-benefit estimate as 102% of total account value after manual current amount owing, the current terminal-illness snapshot as the lower of that amount and a manual remaining aggregate TI cap, the current residual death-benefit estimate after a TI claim today for the supported acceleration corridor, and reinvest-default distribution mechanics.',
    ],
    unsupportedItems: [
      'The current-state death-benefit estimate needs a manual current amount owing input because overdue or outstanding policy charges are not reconstructed from history in V1.',
      'The current terminal-illness snapshot and current residual death-benefit estimate after a TI claim today both need a manual remaining aggregate TI cap, while payout currency, payout timing, and post-claim state remain informational only.',
    ],
    sourceRefs: [page3, page4, page5, page8, page9, page10, page11, page13],
  }
}

export function parseHsbcWealthHarvest(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'hsbc-life-wealth-harvest',
    insurer: 'HSBC Life',
    productName: 'Wealth Harvest',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:hsbc-harvest-holiday-charge',
      'branch:hsbc-harvest-pwc',
      'branch:hsbc-harvest-brc',
      'branch:hsbc-harvest-topup-charge',
      'kernel:monthly-rate-bonus-crediting',
      'kernel:premium-holiday-top-up-block',
      'kernel:top-up-amount-gate-block',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-residual-death-benefit-after-ti-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-start-gate',
      'kernel:scheduled-payout-minimum-annual-withdrawal-amount',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'hsbc-harvest-terminal-illness-cap-overflow-and-post-claim-state',
      'hsbc-harvest-dividend-bank-routing',
      'hsbc-harvest-change-of-life-insured-insurance-charge-adjustment',
      'hsbc-harvest-rsp-restart-after-premium-holiday',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Harvest product summary text layer.',
      'Wealth Harvest keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface.',
      'The current-state death-benefit estimate is modeled as 102% of total account value after manual current amount owing, and the current terminal-illness snapshot plus the current residual death-benefit estimate after a TI claim today are modeled from that same supported acceleration corridor after a manual remaining aggregate TI cap is supplied.',
      'Regular withdrawal is modeled through the manual payout-state kernel with the published annualised minimum withdrawal threshold; payout settlement, minimum remaining account-value checks, change-of-life-insured insurance-charge adjustments, and recurring-single-premium administrative restart after premium holiday remain informational only beyond the modeled current ordinary death-benefit, terminal-illness, and residual-after-TI snapshot surface.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
