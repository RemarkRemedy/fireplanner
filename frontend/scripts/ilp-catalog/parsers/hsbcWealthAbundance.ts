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

const STARTUP_BONUS_TIERS = [
  { minAnnualPremium: 6_000, maxAnnualPremium: 23_999.99, rate: 0.08 },
  { minAnnualPremium: 24_000, maxAnnualPremium: 41_999.99, rate: 0.1 },
  { minAnnualPremium: 42_000, maxAnnualPremium: null, rate: 0.12 },
]
const POWER_UP_RATE = 0.001
const LOYALTY_RATE = 0.003
const TOP_UP_PREMIUM_CHARGE_RATE = 0.03
const AMF_DURING_MIP = 0.021
const AMF_AFTER_MIP = 0.006
const PWC_SCHEDULE = [1, 1, 0.8, 0.6, 0.4, 0.08, 0.08, 0.08, 0.08, 0.08]
const EEC_SCHEDULE = [1, 1, 0.8, 0.65, 0.5, 0.47, 0.44, 0.21, 0.16, 0.08]

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

function buildStartUpBonus(currency: 'SGD' | 'USD', page4: IlpCatalogSourceRef): IlpTemplateBonus {
  return {
    id: 'startup-bonus',
    type: 'allocation',
    label: 'Start-up Bonus',
    mode: 'premium-allocation',
    appliesTo: ['regular'],
    startPolicyYear: 1,
    endPolicyYear: 1,
    rate: 0,
    amount: null,
    tieredRates: STARTUP_BONUS_TIERS.map((tier) => ({
      currency,
      minAnnualPremium: tier.minAnnualPremium,
      maxAnnualPremium: tier.maxAnnualPremium,
      rate: roundRate(tier.rate),
    })),
    notes: [
      'Allocated once on the regular premium paid in the first policy year.',
      'Top-up premiums and recurring single premiums are excluded.',
    ],
    sourceRefs: [page4],
  }
}

function buildVariant(document: ExtractedPdfDocument, currency: 'SGD' | 'USD'): IlpTemplateVariant {
  const page2 = sourceRef(2, 'Product description', snippetNear(document, 2, 'This product consists of 2 accounts'))
  const page4 = sourceRef(4, 'Bonuses', snippetNear(document, 4, 'Start-up Bonus'))
  const page5 = sourceRef(5, 'Free Partial Withdrawal Benefit', snippetNear(document, 5, 'Free Partial Withdrawal Benefit'))
  const page6 = sourceRef(6, 'Premium holiday', snippetNear(document, 6, 'Premium Holiday'))
  const page8 = sourceRef(8, 'Top-up Premiums and Recurring Single Premiums', snippetNear(document, 8, 'Top-up Premiums and Recurring Single Premiums'))
  const page9 = sourceRef(9, 'Policy charges', snippetNear(document, 9, 'Account Maintenance Fee'))
  const page10 = sourceRef(10, 'Policy charges', snippetNear(document, 10, 'Partial Withdrawal Charge'))
  const page11 = sourceRef(11, 'Policy charges', snippetNear(document, 11, 'Early Encashment Charge'))
  const page14 = sourceRef(14, 'Regular Withdrawal', snippetNear(document, 14, '8.3 Regular Withdrawal', 22))
  const page16 = sourceRef(16, 'Dividend distribution', snippetNear(document, 16, 'dividends'))

  const bonuses: IlpTemplateBonus[] = [
    buildStartUpBonus(currency, page4),
    {
      id: 'power-up-bonus',
      type: 'power-up',
      label: 'Power-up Bonus',
      mode: 'annual-rate',
      appliesTo: ['regular'],
      startPolicyYear: 5,
      endPolicyYear: 10,
      rate: roundRate(POWER_UP_RATE),
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
        { trigger: 'premium-holiday', suspensionMonths: 12 },
        { trigger: 'regular-premium-reduction', suspensionMonths: 12 },
      ],
      restorationRules: [
        {
          trigger: 'premium-holiday-repayment',
          basis: 'account-value-plus-repaid-premium-with-missed-months',
        },
      ],
      notes: [
        'Allocated monthly from policy year 5 to the end of the MIP.',
        'Suspended for 12 months after partial withdrawal, premium holiday, or regular premium reduction.',
      ],
      sourceRefs: [page4, page6],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['regular'],
      startPolicyYear: 11,
      endPolicyYear: null,
      rate: roundRate(LOYALTY_RATE),
      amount: null,
      tieredRates: [],
      notes: [
        'Allocated monthly from the first policy month after the MIP.',
        'Regular Withdrawal is modeled through the manual scheduled-payout assumption surface, so loyalty-bonus suspension follows scheduled redemptions while that assumption is active.',
      ],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
        { trigger: 'scheduled-payout', suspensionMonths: 12 },
      ],
      sourceRefs: [page4, page14],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'amf-during-mip',
      label: 'Account Maintenance Fee',
      basis: 'account-value',
      rate: roundRate(AMF_DURING_MIP),
      amount: null,
      appliesTo: ['regular'],
      activeWindow: 'during-mip',
      startPolicyYear: 1,
      endPolicyYear: 10,
      notes: ['Charged monthly on the Regular Premium Account during the MIP.'],
      sourceRefs: [page9],
    },
    {
      id: 'amf-after-mip',
      label: 'Account Maintenance Fee',
      basis: 'account-value',
      rate: roundRate(AMF_AFTER_MIP),
      amount: null,
      appliesTo: ['regular'],
      activeWindow: 'after-mip',
      startPolicyYear: 11,
      endPolicyYear: null,
      notes: ['Charged monthly on the Regular Premium Account after the MIP.'],
      sourceRefs: [page9],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: roundRate(TOP_UP_PREMIUM_CHARGE_RATE),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: ['Charged on top-up premiums credited into the Top-up Account.'],
      sourceRefs: [page8],
    },
    ...(currency === 'SGD'
      ? [{
          id: 'recurring-single-premium-charge',
          label: 'Recurring Single Premium Charge',
          trigger: 'recurring-single-premium' as const,
          basis: 'event-amount-with-overlap-months' as const,
          appliesTo: ['topup'],
          rate: roundRate(TOP_UP_PREMIUM_CHARGE_RATE),
          amount: 0,
          activeWindow: 'policy-term' as const,
          allocation: 'equal-split' as const,
          notes: [
            'Charged on recurring single premiums credited into the Top-up Account.',
            'Recurring single premium is not available for USD-denominated policies.',
          ],
          sourceRefs: [page8],
        }]
      : []),
    {
      id: 'bonus-recovery-charge',
      label: 'Bonus Recovery Charge',
      trigger: 'regular-premium-reduction',
      basis: 'premium-reduction-tiered-startup-recovery',
      appliesTo: ['regular'],
      rate: 0,
      amount: 0,
      sourceBonusId: 'startup-bonus',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Calculated from the difference between the current and reduced start-up bonus amounts, multiplied by the remaining committed-MIP fraction.',
      ],
      sourceRefs: [page9],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['regular'],
      freeEventCount: 2,
      freeEventStartPolicyYear: 3,
      freeEventMaxAmountRate: 0.06,
      rate: 0,
      rateSchedule: buildYearRateSchedule(PWC_SCHEDULE),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'The first two eligible regular-account withdrawals after policy year 2 are free up to 6% of regular-account value each.',
        'Top-up-account withdrawals are not charged.',
      ],
      sourceRefs: [page5, page10],
    },
  ]

  return {
    id: `${currency.toLowerCase()}-mip-10`,
    currency,
    mipLength: 10,
    icpMonths: 1,
    accounts: [
      {
        id: 'regular',
        label: 'Regular Premium Account',
        feeRate: 0,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [],
        sourceRefs: [page2],
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
        sourceRefs: [page2, page8],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'topup',
      fallbackAccountIds: ['regular'],
      source: 'policy-redemption',
      notes: [
        'Regular Withdrawal may be paid yearly, half-yearly, quarterly, or monthly after the MIP by redeeming units.',
        'V1 exposes Regular Withdrawal as a manual scheduled-redemption assumption that redeems the Top-up Account first and then the Regular Premium Account.',
        'The published minimum withdrawal amounts, minimum holding checks on the Regular Premium Account, and fund-allocation redemption details remain informational only in V1.',
      ],
      sourceRefs: [page14],
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['regular', 'topup'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 30,
      minimumAnnualPayoutCurrency: 'SGD',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash, with reinvestment as the default if no option is elected.',
        'Cash payout applies to both the Regular Premium Account and the Top-up Account.',
        'Cash dividends are paid in SGD irrespective of policy currency, and the published S$30 minimum annual payout applies across both the Regular Premium Account and Top-up Account.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published S$30 minimum remain reinvested.',
      ],
      sourceRefs: [page16],
    },
    eecTable: EEC_SCHEDULE.map(roundRate),
    warnings: [
      'This template captures the modeled regular-premium, top-up, recurring-single-premium, free-withdrawal, BRC, account-fee, and reinvest-default distribution subset.',
      ...(currency === 'USD' ? ['Recurring single premium is not available for USD-denominated policies and is therefore omitted from this variant.'] : []),
    ],
    unsupportedItems: [
      'Designated-bank-account routing, unsuccessful cash-credit fallback to reinvestment, and payout execution operations remain informational only.',
    ],
    sourceRefs: [page2, page4, page6, page8, page9, page10, page11, page16],
  }
}

export function parseHsbcWealthAbundance(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'hsbc-life-wealth-abundance',
    insurer: 'HSBC Life',
    productName: 'Wealth Abundance',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:hsbc-abundance-free-withdrawal',
      'branch:hsbc-abundance-tiered-brc',
      'branch:hsbc-abundance-topup-charge',
      'branch:hsbc-abundance-power-up-restoration',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'hsbc-abundance-dividend-bank-routing',
      'hsbc-abundance-rsp-administrative-restart-after-premium-holiday',
      'hsbc-abundance-life-replacement-option',
    ],
    warnings: [
      'Structured extraction validated against the Wealth Abundance product summary text layer.',
      'Wealth Abundance keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface with the published S$30 minimum annual payout threshold.',
      'Regular withdrawal is modeled through the manual payout-state kernel; post-holiday recurring-single-premium administrative restart and life replacement remain metadata-only in V1.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'SGD'),
      buildVariant(context.document, 'USD'),
    ],
  }
}
