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

const WELCOME_BONUS_TIERS: IlpTemplateBonusTier[] = [
  { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: 29_999.99, rate: 0.1 },
  { currency: 'SGD', minAnnualPremium: 30_000, maxAnnualPremium: null, rate: 0.12 },
]

const ADMIN_CHARGE_RATE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 10, rate: 0.03 },
] as const

const SURRENDER_AND_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.2 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 1, endPolicyYear: 1, rate: 1 },
  { startPolicyYear: 2, endPolicyYear: 2, rate: 1 },
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.45 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.2 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.1 },
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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 18): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return `Approximate excerpt; keyword "${keyword}" not found on page. ${page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')}`
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Welcome Bonus / Loyalty Bonus / Maturity Bonus', snippetNear(document, 2, 'Welcome Bonus', 30))
  const page3 = sourceRef(3, 'Maturity Bonus', snippetNear(document, 3, 'Maturity Bonus', 22))

  return [
    {
      id: 'welcome-bonus',
      type: 'allocation',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: WELCOME_BONUS_TIERS.map((tier) => ({ ...tier })),
      notes: [
        'Applied to each basic regular premium received during the first 12 months of the policy for the SGD regular-pay 10-years / policy-term-15-years corridor.',
        'Single premium top-ups and unpaid regular premiums do not receive the Welcome Bonus.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'special-booster',
      type: 'custom',
      label: 'Special Booster',
      mode: 'one-time',
      oneTimePayoutBasis: 'committed-annual-premium-at-issue',
      appliesTo: ['policy'],
      startPolicyYear: 10,
      endPolicyYear: 10,
      requiresPremiumsPaidUpToDate: true,
      rate: 0.25,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published 2.50% Special Booster rate for the SGD regular-pay 10-year corridor as a one-time payout at the end of the premium payment term.',
        'This V1 slice assumes the full committed regular premiums have been paid by the end of policy year 10; any reduction for still-unpaid regular premiums remains informational only.',
        'Single premium top-ups are excluded from the published Special Booster basis and are not included in this modeled amount.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 11,
      endPolicyYear: 14,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      notes: [
        'Pays 0.30% p.a. of account value on each policy anniversary immediately after the end of the 10-year premium payment term and before the original policy maturity date.',
        'If the policy is extended, loyalty bonus still ceases on the original maturity date; the extension election itself remains informational only in V1.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'maturity-bonus',
      type: 'custom',
      label: 'Maturity Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: 15,
      endPolicyYear: 15,
      rate: 0.03,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published 3.0% Maturity Bonus for the SGD regular-pay 10-year / policy-term-15-year corridor as a one-time credit on the original policy maturity date.',
        'Extension Benefit election, cash-versus-reinvestment handling after extension, and policy termination after maturity remain informational only in V1.',
      ],
      sourceRefs: [page2, page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page7 = sourceRef(7, 'Administrative Charge', snippetNear(document, 7, 'Administrative Charge', 20))

  return [
    {
      id: 'administrative-charge',
      label: 'Administrative Charge',
      basis: 'account-value',
      rate: 0,
      amount: 0,
      appliesTo: ['policy'],
      rateSchedule: ADMIN_CHARGE_RATE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly administrative charge as 3.0% p.a. of account value during the first 10 policy years for the selected corridor.',
      ],
      sourceRefs: [page7],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and plan options', snippetNear(document, 1, 'limited premium payment term investment-linked plan', 28))
  const page2 = sourceRef(2, 'Welcome Bonus / Loyalty Bonus / Maturity Bonus', snippetNear(document, 2, 'Welcome Bonus', 30))
  const page3 = sourceRef(3, 'Extension Benefit / Free Partial Withdrawal Benefit', snippetNear(document, 3, 'Free Partial Withdrawal Benefit', 32))
  const page7 = sourceRef(7, 'Administrative Charge', snippetNear(document, 7, 'Administrative Charge', 20))
  const page8 = sourceRef(8, 'Partial Withdrawal Charge / Premium Shortfall Charge', snippetNear(document, 8, 'Premium Shortfall Charge', 28))
  const page11 = sourceRef(11, 'Regular Withdrawal', snippetNear(document, 11, 'Regular Withdrawal', 24))
  const page12 = sourceRef(12, 'Dividend Distribution Option', snippetNear(document, 12, 'Dividend Distribution Option', 24))
  const page17 = sourceRef(17, 'Appendix A charge schedules', snippetNear(document, 17, 'Appendix A', 30))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'single-premium-top-up-charge',
      label: 'Single Premium Top-up Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0.03,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% charge on each accepted single premium top-up.',
      ],
      sourceRefs: [page1, page8],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: SURRENDER_AND_WITHDRAWAL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Appendix A partial-withdrawal charge schedule during the first 10 policy years.',
        'Qualifying Free Partial Withdrawal Benefit withdrawals can be represented in V1 by setting chargeWaived on the partial-withdrawal event.',
        'Life-stage gating, non-life-stage gating, benefit sequencing, use-count limits, and withdrawal-limit mechanics remain manual in V1.',
      ],
      sourceRefs: [page3, page8, page17],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge on annualised basic regular premium after the grace period when premiums are unpaid during the 10-year premium payment term.',
      ],
      sourceRefs: [page8, page17],
    },
  ]

  return {
    id: 'sgd-mip-10-term-15',
    currency: 'SGD',
    mipLength: 10,
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
          { phase: 'after-mip', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page7, page8],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: buildFeeRules(document),
    eventChargeRules,
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      minimumWithdrawalAmountPerOccurrence: 500,
      source: 'policy-redemption',
      notes: [
        'After the Partial Withdrawal Charge Period, regular withdrawals may be applied annually, semi-annually, quarterly, or monthly from the policy account.',
        'V1 exposes regular withdrawal as a manual payout-state assumption and blocks manual scheduled-redemption assumptions whose per-withdrawal amount would fall below the published $500 minimum once the payout frequency is supplied.',
        'The published $1,000 minimum remaining account value plus sub-fund-selection and pending-transaction resumption rules remain informational only.',
      ],
      sourceRefs: [page11],
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['policy'],
      defaultMode: 'reinvest',
      minimumAnnualPayoutAmount: 40,
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest declared dividends or pay them out in cash, with reinvestment as the default if no option is elected.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption, and payouts below the published $40 minimum remain reinvested.',
      ],
      sourceRefs: [page12],
    },
    eecTable: SURRENDER_AND_WITHDRAWAL_CHARGE_SCHEDULE.map((tier) => tier.rate),
    warnings: [
      'This supported template models the SGD / regular-pay-10-years / policy-term-15-years corridor only.',
      'This supported template models the welcome bonus tiers, the published 2.50% Special Booster on the fully-paid 10-year premium-payment corridor, the 0.30% annual loyalty bonus from policy years 11 to 14, the published 3.0% Maturity Bonus on the original policy maturity date, the first-10-policy-years administrative charge, the 3% single-premium top-up charge, the current-state death and terminal-illness benefit amount as the higher of 101% of total basic regular premiums paid plus top-ups less withdrawals or account value less manual current amount owing, the published Appendix A surrender / withdrawal / premium-shortfall charge schedules, manual regular-withdrawal payout support, and the reinvest-default distribution-mode assumption surface.',
      'Qualifying Free Partial Withdrawal Benefit withdrawals can be represented in V1 with event-level charge waivers, while life-stage gating, non-life-stage gating, sequencing, and withdrawal-limit mechanics remain informational only. An admitted-and-settled terminal-illness claim is supported as a current policy-termination state.',
    ],
    unsupportedItems: [
      'Special Booster is modeled for the fully-paid 10-year regular-premium corridor, but any reduction for still-unpaid basic regular premiums due during the premium payment term remains informational only.',
      'The current-state death-benefit estimate needs a manual current amount owing input because indebtedness is not reconstructed from history in V1.',
      'The current-state terminal-illness benefit amount is modeled as an early payout of the current death-benefit estimate after manual current amount owing, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but pre-settlement claim admission, exclusions, and other post-claim policy effects remain informational only.',
      'Extension Benefit elections and post-extension behavior remain informational only.',
      'Free Partial Withdrawal Benefit life-stage gating, non-life-stage gating, penalty-free sequencing, and withdrawal limits remain informational only.',
      'Change of Life Assured, Secondary Life Assured, and policy-continuity mechanics remain informational only.',
      'Cash-payment timing remains informational only.',
      'Regular-withdrawal sub-fund selection, pending-transaction resumption, and operational constraints remain informational only.',
      'Single-premium corridor, USD corridor, and other premium-term / policy-term combinations remain informational only.',
      'Fund-level annual management charges and switching mechanics remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page7, page8, page11, page12, page17],
  }
}

export function parseSinglifeLegacyInvest({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'singlife-legacy-invest',
    insurer: 'Singlife',
    productName: 'Singlife Legacy Invest',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:singlife-legacy-invest-welcome-bonus',
      'branch:singlife-legacy-invest-special-booster',
      'branch:singlife-legacy-invest-loyalty-bonus',
      'branch:singlife-legacy-invest-maturity-bonus',
      'branch:singlife-legacy-invest-administrative-charge',
      'branch:singlife-legacy-invest-top-up-charge',
      'branch:singlife-legacy-invest-partial-withdrawal-charge',
      'branch:singlife-legacy-invest-surrender-charge',
      'branch:singlife-legacy-invest-premium-shortfall-charge',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-per-occurrence-minimum',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'singlife-legacy-invest-extension-benefit',
      'singlife-legacy-invest-free-partial-withdrawal-benefit-eligibility-and-limits',
      'singlife-legacy-invest-change-of-life-assured',
      'singlife-legacy-invest-secondary-life-assured',
      'singlife-legacy-invest-regular-withdrawal-operational-constraints',
      'singlife-legacy-invest-non-sgd-and-other-term-corridors',
    ],
    warnings: [
      'Singlife Legacy Invest is cataloged as a supported V1 product for the SGD / regular-pay-10-years / policy-term-15-years corridor. The parser captures welcome bonus tiers, the published 2.50% Special Booster on the fully-paid 10-year premium-payment corridor, annual loyalty bonus, the published 3.0% Maturity Bonus on the original policy maturity date, administrative charge, single-premium top-up charge, the current-state death and terminal-illness benefit amount as the higher of 101% of total basic regular premiums paid plus top-ups less withdrawals or account value less manual current amount owing, the Appendix A surrender / withdrawal / premium-shortfall schedules, manual regular-withdrawal payout support with the published $500 per-withdrawal minimum once payout frequency is supplied, and reinvest-default distribution support.',
      'Qualifying Free Partial Withdrawal Benefit withdrawals can be represented in V1 with event-level charge waivers, while life-stage gating, non-life-stage gating, sequencing, withdrawal limits, and non-SGD or alternate-term corridors remain informational only beyond the modeled current ordinary death and terminal-illness benefit amount. An admitted-and-settled terminal-illness claim is supported as a current policy-termination state.',
      'Structured extraction validated against the Singlife Legacy Invest product summary text layer.',
    ],
    archived: false,
    variants: [buildVariant(document)],
  }
}
