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

type VoyageMip = 15 | 20 | 25

const STARTUP_RATE_TABLE: Record<VoyageMip, { year1: [number, number], year2: [number, number] }> = {
  15: { year1: [0.15, 0.2], year2: [0.15, 0.2] },
  20: { year1: [0.2, 0.2], year2: [0.25, 0.4] },
  25: { year1: [0.25, 0.3], year2: [0.45, 0.5] },
}

const POWER_UP_BANDS: Record<VoyageMip, Array<{ startPolicyYear: number, endPolicyYear: number, rate: number }>> = {
  15: [
    { startPolicyYear: 6, endPolicyYear: 15, rate: 0.002 },
  ],
  20: [
    { startPolicyYear: 3, endPolicyYear: 5, rate: 0.001 },
    { startPolicyYear: 6, endPolicyYear: 10, rate: 0.003 },
    { startPolicyYear: 11, endPolicyYear: 15, rate: 0.005 },
    { startPolicyYear: 16, endPolicyYear: 20, rate: 0.008 },
  ],
  25: [
    { startPolicyYear: 3, endPolicyYear: 5, rate: 0.001 },
    { startPolicyYear: 6, endPolicyYear: 10, rate: 0.004 },
    { startPolicyYear: 11, endPolicyYear: 15, rate: 0.007 },
    { startPolicyYear: 16, endPolicyYear: 20, rate: 0.008 },
    { startPolicyYear: 21, endPolicyYear: 25, rate: 0.01 },
  ],
}

const LOYALTY_RATE_TABLE: Record<VoyageMip, number> = {
  15: 0.01,
  20: 0.011,
  25: 0.012,
}

const AMF_RATE_DURING_MIP: Record<VoyageMip, number> = {
  15: 0.023,
  20: 0.0215,
  25: 0.0215,
}

const PWC_SCHEDULES: Record<VoyageMip, number[]> = {
  15: [0, 0, 0.5, 0.3, 0.2, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
  20: [0, 0, 0.5, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
  25: [0, 0, 0.5, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
}

const EEC_SCHEDULES: Record<VoyageMip, number[]> = {
  15: [1, 1, 0.74, 0.57, 0.47, 0.39, 0.33, 0.28, 0.24, 0.22, 0.19, 0.16, 0.13, 0.09, 0.05],
  20: [1, 1, 0.85, 0.68, 0.56, 0.48, 0.42, 0.37, 0.32, 0.28, 0.25, 0.24, 0.22, 0.2, 0.18, 0.15, 0.11, 0.07, 0.05, 0.03],
  25: [1, 1, 0.98, 0.8, 0.67, 0.58, 0.52, 0.47, 0.43, 0.39, 0.36, 0.34, 0.31, 0.29, 0.28, 0.27, 0.23, 0.17, 0.11, 0.11, 0.1, 0.1, 0.09, 0.07, 0.05],
}

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

function tieredStartupRates(currency: 'SGD' | 'USD', rates: [number, number]) {
  return [
    {
      currency,
      minAnnualPremium: 3_600,
      maxAnnualPremium: 11_999.99,
      rate: roundRate(rates[0]),
    },
    {
      currency,
      minAnnualPremium: 12_000,
      maxAnnualPremium: null,
      rate: roundRate(rates[1]),
    },
  ]
}

function buildPremiumBaseMultiplierSchedule(mipLength: VoyageMip) {
  if (mipLength === 15) {
    return [
      { startPolicyYear: 1, endPolicyYear: 12, mode: 'policy-year' as const },
      { startPolicyYear: 13, endPolicyYear: 15, mode: 'fixed' as const, multiplier: 12 },
    ]
  }

  if (mipLength === 20) {
    return [
      { startPolicyYear: 1, endPolicyYear: 16, mode: 'policy-year' as const },
      { startPolicyYear: 17, endPolicyYear: 20, mode: 'fixed' as const, multiplier: 16 },
    ]
  }

  return [
    { startPolicyYear: 1, endPolicyYear: 19, mode: 'policy-year' as const },
    { startPolicyYear: 20, endPolicyYear: 25, mode: 'fixed' as const, multiplier: 19 },
  ]
}

function buildDuringMipAmfRule(
  mipLength: VoyageMip,
  page10: IlpCatalogSourceRef,
): IlpTemplateFeeRule {
  return {
    id: 'amf-during-mip',
    label: 'Account Maintenance Fee',
    basis: 'premium-base-mip-multiplier',
    rate: roundRate(AMF_RATE_DURING_MIP[mipLength]),
    amount: 0,
    premiumBaseConfig: {
      useHigherOfCommencementAndPrevailing: true,
      multiplierSchedule: buildPremiumBaseMultiplierSchedule(mipLength),
    },
    appliesTo: ['regular'],
    activeWindow: 'during-mip',
    notes: [
      'Modeled from the published monthly AMF formula as an annualized premium-base charge on the Regular Premium Account.',
      'This captures the MIP-year multiplier schedule including the fixed multiplier cap in the last policy years before MIP end.',
    ],
    sourceRefs: [page10],
  }
}

function buildAfterMipAmfRule(
  mipLength: VoyageMip,
  page10: IlpCatalogSourceRef,
): IlpTemplateFeeRule {
  return {
    id: 'amf-after-mip',
    label: 'Account Maintenance Fee',
    basis: 'premium-base-mip-multiplier',
    rate: roundRate(0.01),
    amount: 0,
    premiumBaseConfig: {
      useHigherOfCommencementAndPrevailing: true,
      multiplierSchedule: [
        { startPolicyYear: mipLength + 1, endPolicyYear: null, mode: 'fixed', multiplier: mipLength },
      ],
    },
    appliesTo: ['regular'],
    activeWindow: 'after-mip',
    notes: [
      'Modeled from the published monthly AMF formula after MIP with the selected MIP as the fixed multiplier.',
    ],
    sourceRefs: [page10],
  }
}

function buildVariant(document: ExtractedPdfDocument, currency: 'SGD' | 'USD', mipLength: VoyageMip): IlpTemplateVariant {
  const page2 = sourceRef(2, 'Product description', snippetNear(document, 2, 'This product consists of 2 accounts'))
  const page4 = sourceRef(4, 'Start-up Bonus', snippetNear(document, 4, 'Start-up Bonus'))
  const page5 = sourceRef(5, 'Power-up Bonus and Loyalty Bonus', snippetNear(document, 5, 'Power-up Bonus Rate'))
  const page6 = sourceRef(6, 'Regular premium changes', snippetNear(document, 6, 'Changes to Regular Premium'))
  const page9 = sourceRef(9, 'Premium Charge and PHC', snippetNear(document, 9, '6.1 Premium Charge'))
  const page10 = sourceRef(10, 'Account Maintenance Fee', snippetNear(document, 10, '6.3 Account Maintenance Fee'))
  const page11 = sourceRef(11, 'Bonus Recovery Charge', snippetNear(document, 11, '6.4 Bonus Recovery Charge'))
  const page12 = sourceRef(12, 'Partial Withdrawal Charge and EEC', snippetNear(document, 12, '6.5 Partial Withdrawal Charge'))
  const page13 = sourceRef(13, 'Early Encashment Charge', snippetNear(document, 13, 'Early Encashment Charge Rate'))
  const page14 = sourceRef(14, 'Top-up Premiums', snippetNear(document, 14, 'Top-up Premiums'))
  const page16 = sourceRef(16, 'Regular Withdrawal', snippetNear(document, 16, '8.3 Regular Withdrawal', 22))
  const page19 = sourceRef(19, 'Distribution of Dividend', snippetNear(document, 19, 'If you choose to reinvest dividends'))

  const startupRates = STARTUP_RATE_TABLE[mipLength]
  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'startup-bonus-y1',
      type: 'allocation',
      label: 'Start-up Bonus (Policy Year 1)',
      mode: 'premium-allocation',
      appliesTo: ['regular'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: 0,
      amount: null,
      tieredRates: tieredStartupRates(currency, startupRates.year1),
      notes: [
        'Tiered start-up bonus applied to regular premiums paid in policy year 1 only.',
        'Top-up premiums are not entitled to the Start-up Bonus.',
      ],
      sourceRefs: [page4],
    },
    {
      id: 'startup-bonus-y2',
      type: 'allocation',
      label: 'Start-up Bonus (Policy Year 2)',
      mode: 'premium-allocation',
      appliesTo: ['regular'],
      startPolicyYear: 2,
      endPolicyYear: 2,
      rate: 0,
      amount: null,
      tieredRates: tieredStartupRates(currency, startupRates.year2),
      notes: [
        'Tiered start-up bonus applied to regular premiums paid in policy year 2 only.',
      ],
      sourceRefs: [page4],
    },
    ...POWER_UP_BANDS[mipLength].map<IlpTemplateBonus>((band, index) => ({
      id: `power-up-bonus-${index + 1}`,
      type: 'power-up',
      label: `Power-up Bonus (${band.startPolicyYear}-${band.endPolicyYear})`,
      mode: 'annual-rate',
      appliesTo: ['regular'],
      startPolicyYear: band.startPolicyYear,
      endPolicyYear: band.endPolicyYear,
      rate: roundRate(band.rate),
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
        { trigger: 'premium-holiday', suspensionMonths: 12 },
        { trigger: 'regular-premium-reduction', suspensionMonths: 12 },
      ],
      notes: [
        'No Power-up Bonus is payable in the subsequent 12 policy months after partial withdrawal, premium holiday, or regular premium reduction.',
        'Backpaid premium-holiday reinstatement remains metadata-only until missed-AMF repayment deductions are modeled for this family.',
      ],
      sourceRefs: [page5, page6],
    })),
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['regular'],
      startPolicyYear: mipLength + 1,
      endPolicyYear: null,
      rate: roundRate(LOYALTY_RATE_TABLE[mipLength]),
      amount: null,
      tieredRates: [],
      suspensionRules: [
        { trigger: 'partial-withdrawal', suspensionMonths: 12 },
        { trigger: 'scheduled-payout', suspensionMonths: 12 },
      ],
      notes: [
        'Loyalty Bonus is modeled after MIP with suspension on partial withdrawals and manual scheduled payouts.',
        'Regular Withdrawal is modeled through the manual scheduled-payout assumption surface, so loyalty-bonus suspension follows scheduled redemptions while that assumption is active.',
      ],
      sourceRefs: [page5, page16],
    },
  ]

  const feeRules: IlpTemplateFeeRule[] = [
    buildDuringMipAmfRule(mipLength, page10),
    buildAfterMipAmfRule(mipLength, page10),
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: roundRate(0.03),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Top-up premium charge is guaranteed at 3% throughout the policy term.',
      ],
      sourceRefs: [page9, page14],
    },
    {
      id: 'bonus-recovery-charge-y1',
      label: 'Bonus Recovery Charge (Policy Year 1 Start-up Bonus)',
      trigger: 'regular-premium-reduction',
      basis: 'premium-reduction-tiered-startup-recovery',
      appliesTo: ['regular'],
      rate: 0,
      amount: 0,
      sourceBonusId: 'startup-bonus-y1',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the policy-year 1 start-up bonus recovery component.',
      ],
      sourceRefs: [page11],
    },
    {
      id: 'bonus-recovery-charge-y2',
      label: 'Bonus Recovery Charge (Policy Year 2 Start-up Bonus)',
      trigger: 'regular-premium-reduction',
      basis: 'premium-reduction-tiered-startup-recovery',
      appliesTo: ['regular'],
      rate: 0,
      amount: 0,
      sourceBonusId: 'startup-bonus-y2',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the policy-year 2 start-up bonus recovery component.',
      ],
      sourceRefs: [page11],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['regular'],
      rate: 0,
      rateSchedule: PWC_SCHEDULES[mipLength].map((value, index) => ({
        startPolicyYear: index + 1,
        endPolicyYear: index + 1,
        rate: roundRate(value),
      })),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'PWC applies only to withdrawals from the Regular Premium Account during the MIP.',
        'Top-up Account withdrawals are modeled as charge-free.',
      ],
      sourceRefs: [page12],
    },
  ]

  return {
    id: `${currency.toLowerCase()}-mip-${mipLength}`,
    currency,
    mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'regular',
        label: 'Regular Premium Account',
        feeRate: 0,
        postMipFeeRate: 0,
        subjectToEec: true,
        contributionRules: [],
        sourceRefs: [page2, page10],
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
        sourceRefs: [page2, page14],
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
        'The published minimum withdrawal amounts, minimum holding checks on the Regular Premium Account, proportional sub-fund redemption details, and the insurer’s right to suspend or terminate the facility remain informational only in V1.',
      ],
      sourceRefs: [page16],
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
        'Cash dividends are paid in SGD irrespective of policy currency, and the published S$30 minimum annual payout applies across both the Regular Premium Account and Top-up Account.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published S$30 minimum remain reinvested.',
      ],
      sourceRefs: [page19],
    },
    eecTable: EEC_SCHEDULES[mipLength].map(roundRate),
    warnings: [
      'This template models the premium-base AMF, start-up bonus, BRC, top-up charge, PWC, EEC, the modeled subset of power-up / loyalty bonus suspension rules, and the reinvest-default distribution-mode assumption surface.',
      'Premium Holiday Charge waiver exhaustion, backpaid premium-holiday AMF reconciliation, and regular-withdrawal-linked loyalty suspension remain metadata-only for this product family.',
      'Life Replacement Option eligibility / underwriting, post-replacement cover resets, and policy-reissue fallback remain informational only in V1.',
    ],
    unsupportedItems: [
      'Life Replacement Option request timing, replacement eligibility, and underwriting acceptance remain informational only.',
      'Life Replacement Option rider termination, new suicide / incontestability / exclusion periods, and revised expiry-date administration remain informational only.',
      'Life Replacement Option policy-reissue fallback, non-identical replacement-policy terms, and post-replacement premium / term administration remain informational only.',
      'Designated-bank-account routing, unsuccessful cash-credit fallback to reinvestment, and payout execution operations remain informational only.',
    ],
    sourceRefs: [page2, page4, page5, page6, page10, page11, page12, page13, page14, page19],
  }
}

export function parseHsbcWealthVoyage(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'hsbc-life-wealth-voyage',
    insurer: 'HSBC Life',
    productName: 'Wealth Voyage',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'hsbc-voyage-premium-base-amf',
      'hsbc-voyage-startup-bonus-tiered',
      'hsbc-voyage-bonus-recovery-charge',
      'hsbc-voyage-power-up-bonus-modeled-subset',
      'hsbc-voyage-loyalty-bonus-partial-withdrawal-subset',
      'hsbc-voyage-topup-premium-charge',
      'hsbc-voyage-partial-withdrawal-charge',
      'hsbc-voyage-eec',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'hsbc-voyage-premium-holiday-charge-after-free-duration',
      'hsbc-voyage-premium-holiday-backpay-amf-reconciliation',
      'hsbc-voyage-regular-withdrawal-loyalty-suspension',
      'hsbc-voyage-dividend-cash-payout-routing-fallback-and-execution',
      'hsbc-voyage-life-replacement-eligibility-and-underwriting',
      'hsbc-voyage-life-replacement-cover-reset-and-rider-termination',
      'hsbc-voyage-life-replacement-policy-reissue-fallback',
    ],
    warnings: [
      'Wealth Voyage is cataloged as a supported V1 product. Premium-base AMF, start-up bonus, bonus recovery charge, top-up charge, partial-withdrawal charge, surrender mechanics, manual regular-withdrawal payout support, the modeled subset of power-up / loyalty bonus suspension rules, and reinvest-default distribution support are modeled; premium-holiday charge after the free duration, premium-holiday backpay AMF reconciliation, regular-withdrawal-linked loyalty suspension, dividend cash-payout routing / fallback / execution, Life Replacement Option eligibility / underwriting, post-replacement cover resets, and policy-reissue fallback remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'SGD', 15),
      buildVariant(context.document, 'SGD', 20),
      buildVariant(context.document, 'SGD', 25),
      buildVariant(context.document, 'USD', 15),
      buildVariant(context.document, 'USD', 20),
      buildVariant(context.document, 'USD', 25),
    ],
  }
}
