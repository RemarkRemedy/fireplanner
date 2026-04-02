import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogContributionMode,
  IlpCatalogPaymentStructure,
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

type SinglifeLegacyPaymentStructure = Extract<IlpCatalogPaymentStructure, 'ppt' | 'single-pay'>
type SinglifeLegacyContributionMode = Extract<IlpCatalogContributionMode, 'regular-pay' | 'single-pay'>

interface SinglifeLegacyVariantConfig {
  id: string
  label: string
  paymentStructure: SinglifeLegacyPaymentStructure
  contributionMode: SinglifeLegacyContributionMode
  premiumPaymentTermYears: number | null
  policyTermYears: number
  mipLength: number | null
  welcomeBonusRate: number
  welcomeBonusTiers?: IlpTemplateBonusTier[]
  specialBoosterRate: number
  specialBoosterPayoutYear: number
  maturityBonusRate: number
  administrativeChargeRate: number
  administrativeChargeYears: number
  surrenderAndWithdrawalChargeSchedule: number[]
  premiumShortfallChargeSchedule?: number[]
}

const THIRTY_K_TIER = 30_000

const SINGLIFE_LEGACY_VARIANTS: SinglifeLegacyVariantConfig[] = [
  {
    id: 'sgd-single-premium-term-10',
    label: 'SGD / Single Premium / Policy Term 10 years',
    paymentStructure: 'single-pay',
    contributionMode: 'single-pay',
    premiumPaymentTermYears: null,
    policyTermYears: 10,
    mipLength: null,
    welcomeBonusRate: 0.02,
    specialBoosterRate: 0.0175,
    specialBoosterPayoutYear: 1,
    maturityBonusRate: 0.03,
    administrativeChargeRate: 0.035,
    administrativeChargeYears: 4,
    surrenderAndWithdrawalChargeSchedule: [1, 0.9, 0.6, 0.3],
  },
  {
    id: 'sgd-single-premium-term-15',
    label: 'SGD / Single Premium / Policy Term 15 years',
    paymentStructure: 'single-pay',
    contributionMode: 'single-pay',
    premiumPaymentTermYears: null,
    policyTermYears: 15,
    mipLength: null,
    welcomeBonusRate: 0.02,
    specialBoosterRate: 0.0175,
    specialBoosterPayoutYear: 1,
    maturityBonusRate: 0.04,
    administrativeChargeRate: 0.035,
    administrativeChargeYears: 4,
    surrenderAndWithdrawalChargeSchedule: [1, 0.9, 0.6, 0.3],
  },
  {
    id: 'sgd-mip-3-term-10',
    label: 'SGD / Premium Payment Term 3 years / Policy Term 10 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 3,
    policyTermYears: 10,
    mipLength: 3,
    welcomeBonusRate: 0.04,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 20_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.04 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.06 },
    ],
    specialBoosterRate: 0.0175,
    specialBoosterPayoutYear: 3,
    maturityBonusRate: 0.03,
    administrativeChargeRate: 0.032,
    administrativeChargeYears: 6,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.7, 0.5, 0.4, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.75, 0.4, 0.2],
  },
  {
    id: 'sgd-mip-3-term-15',
    label: 'SGD / Premium Payment Term 3 years / Policy Term 15 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 3,
    policyTermYears: 15,
    mipLength: 3,
    welcomeBonusRate: 0.04,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 20_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.04 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.06 },
    ],
    specialBoosterRate: 0.0175,
    specialBoosterPayoutYear: 3,
    maturityBonusRate: 0.04,
    administrativeChargeRate: 0.032,
    administrativeChargeYears: 6,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.7, 0.5, 0.4, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.75, 0.4, 0.2],
  },
  {
    id: 'sgd-mip-3-term-20',
    label: 'SGD / Premium Payment Term 3 years / Policy Term 20 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 3,
    policyTermYears: 20,
    mipLength: 3,
    welcomeBonusRate: 0.04,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 20_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.04 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.06 },
    ],
    specialBoosterRate: 0.0175,
    specialBoosterPayoutYear: 3,
    maturityBonusRate: 0.05,
    administrativeChargeRate: 0.032,
    administrativeChargeYears: 6,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.7, 0.5, 0.4, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.75, 0.4, 0.2],
  },
  {
    id: 'sgd-mip-5-term-10',
    label: 'SGD / Premium Payment Term 5 years / Policy Term 10 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 5,
    policyTermYears: 10,
    mipLength: 5,
    welcomeBonusRate: 0.08,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 18_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.08 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.1 },
    ],
    specialBoosterRate: 0.0175,
    specialBoosterPayoutYear: 5,
    maturityBonusRate: 0.03,
    administrativeChargeRate: 0.03,
    administrativeChargeYears: 8,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2],
  },
  {
    id: 'sgd-mip-5-term-15',
    label: 'SGD / Premium Payment Term 5 years / Policy Term 15 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 5,
    policyTermYears: 15,
    mipLength: 5,
    welcomeBonusRate: 0.08,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 18_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.08 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.1 },
    ],
    specialBoosterRate: 0.0175,
    specialBoosterPayoutYear: 5,
    maturityBonusRate: 0.04,
    administrativeChargeRate: 0.03,
    administrativeChargeYears: 8,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2],
  },
  {
    id: 'sgd-mip-5-term-20',
    label: 'SGD / Premium Payment Term 5 years / Policy Term 20 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 5,
    policyTermYears: 20,
    mipLength: 5,
    welcomeBonusRate: 0.08,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 18_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.08 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.1 },
    ],
    specialBoosterRate: 0.0175,
    specialBoosterPayoutYear: 5,
    maturityBonusRate: 0.05,
    administrativeChargeRate: 0.03,
    administrativeChargeYears: 8,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.75, 0.6, 0.5, 0.45, 0.4, 0.2],
  },
  {
    id: 'sgd-mip-10-term-15',
    label: 'SGD / Premium Payment Term 10 years / Policy Term 15 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 10,
    policyTermYears: 15,
    mipLength: 10,
    welcomeBonusRate: 0.1,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.12 },
    ],
    specialBoosterRate: 0.025,
    specialBoosterPayoutYear: 10,
    maturityBonusRate: 0.03,
    administrativeChargeRate: 0.03,
    administrativeChargeYears: 10,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1],
  },
  {
    id: 'sgd-mip-10-term-20',
    label: 'SGD / Premium Payment Term 10 years / Policy Term 20 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 10,
    policyTermYears: 20,
    mipLength: 10,
    welcomeBonusRate: 0.1,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.12 },
    ],
    specialBoosterRate: 0.025,
    specialBoosterPayoutYear: 10,
    maturityBonusRate: 0.04,
    administrativeChargeRate: 0.03,
    administrativeChargeYears: 10,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1],
  },
  {
    id: 'sgd-mip-10-term-25',
    label: 'SGD / Premium Payment Term 10 years / Policy Term 25 years',
    paymentStructure: 'ppt',
    contributionMode: 'regular-pay',
    premiumPaymentTermYears: 10,
    policyTermYears: 25,
    mipLength: 10,
    welcomeBonusRate: 0.1,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: THIRTY_K_TIER - 0.01, rate: 0.1 },
      { currency: 'SGD', minAnnualPremium: THIRTY_K_TIER, maxAnnualPremium: null, rate: 0.12 },
    ],
    specialBoosterRate: 0.025,
    specialBoosterPayoutYear: 10,
    maturityBonusRate: 0.05,
    administrativeChargeRate: 0.03,
    administrativeChargeYears: 10,
    surrenderAndWithdrawalChargeSchedule: [1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2],
    premiumShortfallChargeSchedule: [1, 1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.1],
  },
] as const

function scheduleFromRates(rates: readonly number[]) {
  return rates.map((rate, index) => ({
    startPolicyYear: index + 1,
    endPolicyYear: index + 1,
    rate,
  }))
}

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

function buildBonuses(document: ExtractedPdfDocument, config: SinglifeLegacyVariantConfig): IlpTemplateBonus[] {
  const page2 = sourceRef(2, 'Welcome Bonus / Loyalty Bonus / Maturity Bonus', snippetNear(document, 2, 'Welcome Bonus', 30))
  const page3 = sourceRef(3, 'Maturity Bonus', snippetNear(document, 3, 'Maturity Bonus', 22))
  const premiumTermLabel = config.paymentStructure === 'single-pay'
    ? 'single-premium corridor'
    : `${config.premiumPaymentTermYears}-year premium-payment corridor`

  return [
    {
      id: 'welcome-bonus',
      type: 'allocation',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      annualPremiumTierBasis: config.paymentStructure === 'single-pay'
        ? 'initial-single-premium-at-issue'
        : 'committed-annual-premium-at-issue',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: config.paymentStructure === 'single-pay' ? config.welcomeBonusRate : null,
      amount: null,
      tieredRates: config.welcomeBonusTiers?.map((tier) => ({ ...tier })) ?? [],
      notes: [
        config.paymentStructure === 'single-pay'
          ? `Applied as a ${formatPct(config.welcomeBonusRate)} uplift on the accepted initial single premium for the ${config.label} corridor.`
          : `Applied to each basic regular premium received during the first 12 months of the policy for the ${config.label} corridor.`,
        'Single premium top-ups and unpaid basic regular premiums do not receive the Welcome Bonus.',
      ],
      sourceRefs: [page2],
    },
    {
      id: 'special-booster',
      type: 'custom',
      label: 'Special Booster',
      mode: 'one-time',
      oneTimePayoutBasis: config.paymentStructure === 'single-pay'
        ? 'initial-single-premium-at-issue'
        : 'committed-annual-premium-at-issue',
      appliesTo: ['policy'],
      startPolicyYear: config.specialBoosterPayoutYear,
      endPolicyYear: config.specialBoosterPayoutYear,
      requiresPremiumsPaidUpToDate: true,
      rate: config.specialBoosterRate,
      amount: null,
      tieredRates: [],
      notes: [
        `Models the published ${formatPct(config.specialBoosterRate)} Special Booster rate for the ${premiumTermLabel} as a one-time payout at the end of the premium payment term.`,
        ...(config.paymentStructure === 'single-pay'
          ? []
          : [`This V1 slice assumes the full committed regular premiums have been paid by the end of policy year ${config.specialBoosterPayoutYear}; any reduction for still-unpaid regular premiums remains informational only.`]),
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
      startPolicyYear: config.paymentStructure === 'single-pay' ? 2 : config.specialBoosterPayoutYear + 1,
      endPolicyYear: config.policyTermYears - 1,
      rate: 0.003,
      amount: null,
      tieredRates: [],
      notes: [
        `Pays 0.30% p.a. of account value on each policy anniversary immediately after the end of the ${premiumTermLabel} and before the original policy maturity date.`,
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
      startPolicyYear: config.policyTermYears,
      endPolicyYear: config.policyTermYears,
      rate: config.maturityBonusRate,
      amount: null,
      tieredRates: [],
      notes: [
        `Models the published ${formatPct(config.maturityBonusRate)} Maturity Bonus for the ${config.label} corridor as a one-time credit on the original policy maturity date.`,
        'Extension Benefit election, cash-versus-reinvestment handling after extension, and policy termination after maturity remain informational only in V1.',
      ],
      sourceRefs: [page2, page3],
    },
  ]
}

function buildFeeRules(document: ExtractedPdfDocument, config: SinglifeLegacyVariantConfig): IlpTemplateFeeRule[] {
  const page7 = sourceRef(7, 'Administrative Charge', snippetNear(document, 7, 'Administrative Charge', 20))

  return [
    {
      id: 'administrative-charge',
      label: 'Administrative Charge',
      basis: 'account-value',
      rate: config.administrativeChargeRate,
      amount: 0,
      appliesTo: ['policy'],
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: config.administrativeChargeYears, rate: config.administrativeChargeRate },
      ],
      activeWindow: 'policy-term',
      notes: [
        `Models the published monthly administrative charge as ${formatPct(config.administrativeChargeRate)} p.a. of account value during the first ${config.administrativeChargeYears} policy years for the selected corridor.`,
      ],
      sourceRefs: [page7],
    },
  ]
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(rate === Math.trunc(rate * 100) / 100 ? 0 : 2)}%`
}

function buildVariant(document: ExtractedPdfDocument, config: SinglifeLegacyVariantConfig): IlpTemplateVariant {
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
      rateSchedule: scheduleFromRates(config.surrenderAndWithdrawalChargeSchedule),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published Appendix A partial-withdrawal charge schedule for the selected premium-payment corridor.',
        'Qualifying Free Partial Withdrawal Benefit withdrawals can be represented in V1 by setting chargeWaived on the partial-withdrawal event.',
        'Life-stage gating, non-life-stage gating, benefit sequencing, use-count limits, and withdrawal-limit mechanics remain manual in V1.',
      ],
      sourceRefs: [page3, page8, page17],
    },
  ]
  if (config.premiumShortfallChargeSchedule) {
    eventChargeRules.push({
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      yearBasis: 'policy-year',
      appliesTo: ['policy'],
      rate: 0,
      rateSchedule: scheduleFromRates(config.premiumShortfallChargeSchedule),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        `Models the published monthly premium shortfall charge on annualised basic regular premium after the grace period when premiums are unpaid during the ${config.premiumPaymentTermYears}-year premium payment term.`,
      ],
      sourceRefs: [page8, page17],
    })
  }

  return {
    id: config.id,
    currency: 'SGD',
    mipBasis: config.paymentStructure === 'single-pay' ? 'open-ended' : 'finite',
    mipLength: config.mipLength,
    paymentStructure: config.paymentStructure,
    premiumPaymentTermYears: config.premiumPaymentTermYears,
    policyTermYears: config.policyTermYears,
    contributionMode: config.contributionMode,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: config.paymentStructure === 'single-pay' ? 'Single Premium Policy Account' : 'Policy Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: config.paymentStructure === 'single-pay'
          ? [
              { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
              { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
            ]
          : [
              { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
              { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
              { phase: 'after-mip', targetAccountId: 'policy', contributionShare: 1 },
              { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
            ],
        sourceRefs: [page1, page7, page8],
      },
    ],
    bonuses: buildBonuses(document, config),
    feeRules: buildFeeRules(document, config),
    eventChargeRules,
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      minimumWithdrawalAmountPerOccurrence: 500,
      minimumRemainingPolicyValue: 1_000,
      source: 'policy-redemption',
      notes: [
        'After the Partial Withdrawal Charge Period, regular withdrawals may be applied annually, semi-annually, quarterly, or monthly from the policy account.',
        'V1 exposes regular withdrawal as a manual payout-state assumption and blocks manual scheduled-redemption assumptions whose per-withdrawal amount would fall below the published $500 minimum once the payout frequency is supplied.',
        'The published $1,000 minimum remaining account value is modeled on the scheduled-redemption assumption surface; sub-fund-selection and pending-transaction resumption rules remain informational only.',
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
    eecTable: [...config.surrenderAndWithdrawalChargeSchedule],
    warnings: [
      `${config.label} is cataloged as a supported V1 corridor. The parser captures the published Welcome Bonus schedule, the published ${formatPct(config.specialBoosterRate)} Special Booster at the end of the premium payment term, the 0.30% p.a. Loyalty Bonus until the original policy maturity date, the published ${formatPct(config.maturityBonusRate)} Maturity Bonus on the original policy maturity date, the first-${config.administrativeChargeYears}-policy-years Administrative Charge, the 3% single-premium top-up charge, the current-state death and terminal-illness benefit amount as the higher of 101% of paid premiums plus top-ups less withdrawals or account value less manual current amount owing, the published Appendix A surrender / withdrawal${config.premiumShortfallChargeSchedule ? ' / premium-shortfall' : ''} charge schedules, manual regular-withdrawal payout support with the published $500 per-withdrawal minimum and $1,000 minimum remaining policy value once payout frequency is supplied, and the reinvest-default distribution-mode assumption surface.`,
      'Qualifying Free Partial Withdrawal Benefit withdrawals can be represented in V1 with event-level charge waivers, while life-stage gating, non-life-stage gating, sequencing, and withdrawal-limit mechanics remain informational only. An admitted-and-settled terminal-illness claim is supported as a current policy-termination state.',
    ],
    unsupportedItems: [
      ...(config.paymentStructure === 'single-pay'
        ? []
        : [`Special Booster is modeled for the fully-paid ${config.premiumPaymentTermYears}-year regular-premium corridor, but any reduction for still-unpaid basic regular premiums due during the premium payment term remains informational only.`]),
      'The current-state death-benefit estimate needs a manual current amount owing input because indebtedness is not reconstructed from history in V1.',
      'The current-state terminal-illness benefit amount is modeled as an early payout of the current death-benefit estimate after manual current amount owing, and an admitted-and-settled terminal-illness claim is supported as a current policy-termination state, but pre-settlement claim admission, exclusions, and other post-claim policy effects remain informational only.',
      'Extension Benefit elections and post-extension behavior remain informational only.',
      'Free Partial Withdrawal Benefit life-stage gating, non-life-stage gating, penalty-free sequencing, and withdrawal limits remain informational only.',
      'Change of Life Assured, Secondary Life Assured, and policy-continuity mechanics remain informational only.',
      'Cash-payment timing remains informational only.',
      'Regular-withdrawal sub-fund selection, pending-transaction resumption, and operational constraints remain informational only.',
      'USD corridors and any premium-term / policy-term combinations not listed in the published SGD matrix remain informational only.',
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
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'singlife-legacy-invest-extension-benefit',
      'singlife-legacy-invest-free-partial-withdrawal-benefit-eligibility-and-limits',
      'singlife-legacy-invest-change-of-life-assured',
      'singlife-legacy-invest-secondary-life-assured',
      'singlife-legacy-invest-regular-withdrawal-operational-constraints',
      'singlife-legacy-invest-usd-corridors',
    ],
    warnings: [
      'Singlife Legacy Invest is cataloged as a supported V1 product for the published SGD single-premium and regular-pay policy-term matrix. The parser captures term-specific Welcome Bonus tables, Special Booster rates, Loyalty Bonus timing, Maturity Bonus rates, Administrative Charge schedules, the 3% single-premium top-up charge, the current-state death and terminal-illness benefit amount as the higher of 101% of paid premiums plus top-ups less withdrawals or account value less manual current amount owing, the Appendix A surrender / withdrawal / premium-shortfall schedules where applicable, manual regular-withdrawal payout support with the published $500 per-withdrawal minimum and $1,000 minimum remaining policy value once payout frequency is supplied, and reinvest-default distribution support.',
      'Qualifying Free Partial Withdrawal Benefit withdrawals can be represented in V1 with event-level charge waivers, while life-stage gating, non-life-stage gating, sequencing, withdrawal limits, and USD corridors remain informational only beyond the modeled current ordinary death and terminal-illness benefit amount. An admitted-and-settled terminal-illness claim is supported as a current policy-termination state.',
      'Structured extraction validated against the Singlife Legacy Invest product summary text layer.',
    ],
    archived: false,
    variants: SINGLIFE_LEGACY_VARIANTS.map((config) => buildVariant(document, config)),
  }
}
