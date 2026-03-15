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
      mode: 'annual-rate',
      appliesTo: ['regular'],
      startPolicyYear: 10,
      endPolicyYear: null,
      rate: roundRate(LOYALTY_BONUS_RATE),
      amount: null,
      tieredRates: [],
      notes: [
        'Allocated monthly from the first policy month in policy year 10 onward while the policy remains in force.',
        'No Loyalty Bonus will be payable in the next 12 policy months after a partial withdrawal from the Regular Premium Account.',
        'The product summary also suspends this bonus after regular withdrawal from the Regular Premium Account, which remains metadata-only in V1.',
      ],
      sourceRefs: [page5],
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
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash, with reinvestment as the default if no option is elected.',
        'Cash payout applies to both the Regular Premium Account and the Top-up Account.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption while the published S$30 minimum payout threshold and designated-bank-account routing remain informational only.',
      ],
      sourceRefs: [page13],
    },
    eecTable: EEC_SCHEDULE.map(roundRate),
    warnings: [
      'This template captures the modeled regular-premium, top-up, premium-holiday, withdrawal-charge, BRC, and reinvest-default distribution mechanics.',
    ],
    unsupportedItems: [],
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
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'hsbc-harvest-regular-withdrawal-facility',
      'hsbc-harvest-dividend-payout-threshold',
      'hsbc-harvest-dividend-bank-routing',
      'hsbc-harvest-change-of-life-insured-insurance-charge-adjustment',
      'hsbc-harvest-rsp-restart-after-premium-holiday',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Harvest product summary text layer.',
      'Wealth Harvest keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface.',
      'Regular withdrawal, change-of-life-insured behavior, and recurring-single-premium administrative restart after premium holiday remain metadata-only in V1.',
    ],
    archived: false,
    variants: [buildVariant(context.document)],
  }
}
