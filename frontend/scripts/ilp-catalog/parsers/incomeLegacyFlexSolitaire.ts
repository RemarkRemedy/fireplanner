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

type LegacyFlexMip = 5 | 10

interface LegacyFlexVariantConfig {
  id: string
  mipLength: LegacyFlexMip
  regularPremiumChargeSchedule: readonly number[]
  premiumHolidayChargeSchedule: readonly number[]
  withdrawalAndSurrenderChargeSchedule: readonly number[]
}

const TOP_UP_PREMIUM_CHARGE_RATE = 0.03

const VARIANT_CONFIGS: readonly LegacyFlexVariantConfig[] = [
  {
    id: 'sgd-regular-mip-5',
    mipLength: 5,
    regularPremiumChargeSchedule: [0.28, 0.23, 0.14, 0.07, 0.05],
    premiumHolidayChargeSchedule: [0.9, 0.8, 0.6, 0.4, 0.2],
    withdrawalAndSurrenderChargeSchedule: [0.9, 0.8, 0.6, 0.4, 0.2],
  },
  {
    id: 'sgd-regular-mip-10',
    mipLength: 10,
    regularPremiumChargeSchedule: [0.35, 0.26, 0.15, 0.1, 0.045, 0.03, 0.03, 0.03, 0.03, 0.03],
    premiumHolidayChargeSchedule: [0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.3, 0.2],
    withdrawalAndSurrenderChargeSchedule: [0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.3, 0.2],
  },
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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 16): string {
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

function buildVariant(document: ExtractedPdfDocument, config: LegacyFlexVariantConfig): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Policy description and product structure', snippetNear(document, 1, 'Legacy Flex Solitaire is a whole life investment-linked plan', 20))
  const page2 = sourceRef(2, 'Loyalty bonus, top-ups, and future premium option', snippetNear(document, 2, 'We will provide an annual loyalty bonus', 22))
  const page9 = sourceRef(9, 'Premium charge schedule and policy fee', snippetNear(document, 9, '7.1 Premium Charge', 24))
  const page10 = sourceRef(10, 'Policy fee and insurance cover charge', snippetNear(document, 10, '7.2 Policy Fee', 28))
  const page11 = sourceRef(11, 'Partial withdrawal and premium holiday mechanics', snippetNear(document, 11, '7.7 Partial Withdrawal Charge', 24))
  const page12 = sourceRef(12, 'Subscription of premium and top-up units', snippetNear(document, 12, '100% of your regular premium less any premium charge', 22))
  const page17 = sourceRef(17, 'Declaration and Reinvesting of Distributions', snippetNear(document, 17, 'Declaration and Reinvesting of Distributions', 18))
  const page21 = sourceRef(21, 'Appendix 1 insurance cover charge rates', snippetNear(document, 21, 'Appendix 1', 20))
  const page25 = sourceRef(25, 'Appendix 2 surrender, partial withdrawal, and premium holiday charges', snippetNear(document, 25, 'Appendix 2', 24))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'regular-premium-charge',
      label: 'Regular Premium Charge',
      basis: 'annual-contribution',
      yearBasis: 'premium-year',
      rate: 0,
      amount: 0,
      appliesTo: ['premium'],
      rateSchedule: buildRateSchedule(config.regularPremiumChargeSchedule),
      activeWindow: 'policy-term',
      notes: [
        'Models the published regular premium charge schedule by accepted regular-premium year for the regular-premium corridors only.',
        'The separate single-premium corridor remains informational only in V1.',
      ],
      sourceRefs: [page9, page12],
    },
    {
      id: 'policy-fee',
      label: 'Policy Fee',
      basis: 'fixed-annual',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['premium'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: 4,
      notes: [
        'Models the published monthly policy fee as a manual annual amount for the first four policy years only.',
        'Enter the annual policy fee amount using the published sum-assured-at-entry and original-insured entry-age table because the rate depends on policy-entry inputs rather than prevailing account balances.',
        'The policy fee is deducted from the premium account first and falls back to the top-up account if the premium account is insufficient.',
      ],
      sourceRefs: [page10],
    },
    {
      id: 'insurance-cover-charge',
      label: 'Insurance Cover Charge',
      basis: 'assurance-sum-at-risk',
      rate: 0,
      amount: 0,
      requiresManualInput: true,
      appliesTo: ['premium'],
      assuranceValueAppliesTo: ['premium', 'topup'],
      fallbackAppliesTo: ['topup'],
      activeWindow: 'policy-term',
      assuranceConfig: {
        formula: 'income-legacy-flex-solitaire-death-ti',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 120,
      },
      notes: [
        'Models the published Appendix 1 monthly insurance cover charge after entering the insured-life details and the current adjusted sum assured.',
        'Enter the current adjusted sum assured manually because the published protection base changes after top-ups, charged withdrawals, and other policy alterations outside the current automatic state surface.',
        'The insurance cover charge is deducted from the premium account first and falls back to the top-up account if the premium account is insufficient.',
      ],
      sourceRefs: [page10, page21],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: TOP_UP_PREMIUM_CHARGE_RATE,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 3% premium charge on each accepted top-up premium allocated into the top-up account.',
        'Top-ups are blocked during premium holiday, but that acceptance gating remains informational only in V1.',
      ],
      sourceRefs: [page2, page9, page12],
    },
    {
      id: 'premium-holiday-charge',
      label: 'Premium Holiday Charge',
      trigger: 'premium-holiday',
      basis: 'annual-premium-with-overlap-months',
      appliesTo: ['premium'],
      fallbackAppliesTo: ['topup'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(config.premiumHolidayChargeSchedule),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium holiday charge on annualised regular premium during the selected minimum investment period.',
        'The charge is taken from the premium account first and falls back to the top-up account if the premium account is insufficient.',
      ],
      sourceRefs: [page11, page25],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['premium'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(config.withdrawalAndSurrenderChargeSchedule),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published Appendix 2 charge factor on partial withdrawals from the premium account during the selected minimum investment period.',
        'Top-up-account withdrawals after 12 months are charge-free, but first-12-month top-up-account withdrawal charges remain informational only in V1.',
        'Qualifying Withdrawal Access Option withdrawals can be represented in V1 by setting chargeWaived on the premium-account partial-withdrawal event.',
        'Withdrawal Access Option timing, 5%-of-prevailing-premium-account-value limits, and once-per-policy-year administration remain manual in V1.',
      ],
      sourceRefs: [page11, page25],
    },
  ]

  const loyaltyBonusRate = config.mipLength === 5 ? 0.0025 : 0.005
  const bonuses: IlpTemplateBonus[] = [
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['premium'],
      startPolicyYear: config.mipLength + 1,
      endPolicyYear: null,
      rate: loyaltyBonusRate,
      amount: null,
      tieredRates: [],
      suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
      notes: [
        `Applied annually from the end of the ${config.mipLength}-year MIP on the premium-account policy value.`,
        'Qualifying Withdrawal Access Option withdrawals and top-up-account withdrawals can be represented in V1 by setting bonusSuspensionWaived on the recorded partial-withdrawal event.',
        'Premium holidays do not suspend Loyalty Bonus eligibility in the published summary.',
      ],
      sourceRefs: [page2],
    },
  ]

  return {
    id: config.id,
    currency: 'SGD',
    mipLength: config.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'premium',
        label: 'Premium Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'premium', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'premium', contributionShare: 1 },
        ],
        sourceRefs: [page1, page12],
      },
      {
        id: 'topup',
        label: 'Top-up Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page2, page12],
      },
    ],
    bonuses,
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['premium', 'topup'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
      source: 'distribution-paying-funds',
      notes: [
        'Legacy Flex Solitaire reinvests declared distributions into the same ILP sub-fund by default.',
        'Published payout distributions are available only after exercising the retirement option and meeting the insurer-set minimum distribution amount, so V1 models only the reinvested baseline.',
      ],
      sourceRefs: [page17],
    },
    eecTable: [...config.withdrawalAndSurrenderChargeSchedule],
    warnings: [
      `Legacy Flex Solitaire is cataloged as supported in V1 for the ${config.mipLength}-year regular-premium corridor. The parser captures the premium-year regular premium charge schedule, a manual-input policy-fee amount for policy years 1-4, the manual-input Appendix 1 insurance-cover-charge corridor, the current-state death and terminal-illness benefit estimate as the higher of adjusted sum assured or policy value via a manual current adjusted sum assured input, the published Loyalty Bonus rate with the supported partial-withdrawal suspension subset, the top-up premium charge, the premium-holiday charge schedule, the premium-account Appendix 2 partial-withdrawal / surrender charge schedule, and the published reinvest-only distribution baseline.`,
      'Qualifying Withdrawal Access Option withdrawals can be represented in V1 with event-level charge and loyalty-bonus-suspension waivers, and qualifying top-up-account withdrawals can be represented with event-level loyalty-bonus-suspension waivers, while timing, caps, once-per-policy-year administration, adjusted-sum-assured exceptions, and No Lapse Guarantee exceptions remain informational only.',
      'Single-premium charging, automatic adjusted-sum-assured changes after top-ups and withdrawals, No Lapse Guarantee behavior, top-up-account first-12-month charge timing, and retirement-option distribution payouts remain informational only in V1. The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, and an admitted-and-settled TI claim is supported as a current policy-termination state.',
    ],
    unsupportedItems: [
      'Single-premium corridor remains informational only in V1, including the 4% single-premium charge and the single-premium Appendix 2 charge schedule.',
      'Withdrawal Access Option timing, 5%-of-prevailing-premium-account-value limits, once-per-policy-year administration, and top-up-account first-12-month charge timing remain informational only in V1.',
      'Automatic adjusted-sum-assured updates after top-ups, charged withdrawals, withdrawal-access exceptions, and sum-assured reductions remain informational only, so the current adjusted sum assured must be maintained manually for the insurance-cover-charge corridor and current death / terminal-illness benefit estimate.',
      'The current admitted-state TI payable amount is supported through the published full-termination TI corridor after manual claim-amount entry, and an admitted-and-settled TI claim is supported as a current policy-termination state, but terminal-illness definitions, exclusions, insurer-side settlement, secondary-insured continuation, bequest option behavior, and other protection-side claim mechanics remain informational only beyond the supported current death / terminal-illness benefit estimate and insurance-cover-charge corridor.',
      'No Lapse Guarantee debt carry and termination behavior remain informational only.',
      'Future Premium Option and recurring top-up enrollment remain informational only.',
      'Withdrawal Access Option, retirement-option distribution payout elections, and the insurer-set minimum distribution payout threshold remain informational only.',
      'Fund-level annual management fees, fund switching, and suspension of dealings remain informational only.',
      'Top-up-account withdrawals and surrenders within the first 12 months remain informational only because the current executable slice treats the top-up account as charge-free throughout.',
    ],
    sourceRefs: [page1, page2, page9, page11, page12, page17, page25],
  }
}

export function parseIncomeLegacyFlexSolitaire({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'income-legacy-flex-solitaire',
    insurer: 'Income Insurance',
    productName: 'Legacy Flex Solitaire (VA3S / VA3R)',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:income-legacy-flex-solitaire-regular-premium-charge',
      'branch:income-legacy-flex-solitaire-policy-fee',
      'branch:income-legacy-flex-solitaire-insurance-cover-charge',
      'branch:income-legacy-flex-solitaire-loyalty-bonus',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'branch:income-legacy-flex-solitaire-top-up-premium-charge',
      'branch:income-legacy-flex-solitaire-premium-holiday-charge',
      'branch:income-legacy-flex-solitaire-appendix-2-withdrawal-and-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: [],
    metadataOnlyBehaviors: [
      'income-legacy-flex-solitaire-single-premium-corridor',
      'income-legacy-flex-solitaire-no-lapse-guarantee',
      'income-legacy-flex-solitaire-future-premium-option',
      'income-legacy-flex-solitaire-withdrawal-access-option',
      'income-legacy-flex-solitaire-retirement-and-distribution-options',
      'income-legacy-flex-solitaire-secondary-insured-and-bequest-option',
      'income-legacy-flex-solitaire-top-up-account-first-12-month-charge-window',
      'income-legacy-flex-solitaire-fund-level-annual-management-fee',
      'income-legacy-flex-solitaire-fund-switching-and-suspension',
      'income-legacy-flex-solitaire-terminal-illness-and-claim-settlement',
    ],
    warnings: [
      'Legacy Flex Solitaire (VA3S / VA3R) is cataloged as supported in V1 for the regular-premium 5-year and 10-year corridors. The current parser models the premium-year regular premium charges, manual-input policy-fee and Appendix 1 insurance-cover-charge corridors, the current-state death and terminal-illness benefit estimate as the higher of adjusted sum assured or policy value via a manual current adjusted sum assured input, the current admitted-state TI payable amount through the published full-termination TI corridor after manual claim-amount entry, an admitted-and-settled TI claim as a current policy-termination state, the published Loyalty Bonus rate with the supported partial-withdrawal suspension subset, the top-up premium charge, premium-holiday charge, premium-account Appendix 2 withdrawal / surrender charges, and the published reinvest-only distribution baseline. The single-premium corridor, automatic adjusted-sum-assured updates, No Lapse Guarantee, retirement-option payout elections, top-up-account first-12-month charge timing, and broader claim-side settlement / continuation mechanics remain outside the current engine.',
      'Qualifying Withdrawal Access Option withdrawals can be represented in V1 with event-level charge and loyalty-bonus-suspension waivers, and qualifying top-up-account withdrawals can be represented with event-level loyalty-bonus-suspension waivers, while timing, caps, adjusted-sum-assured exceptions, No Lapse Guarantee exceptions, and retirement-option distribution behavior remain informational only.',
    ],
    archived: false,
    variants: VARIANT_CONFIGS.map((config) => buildVariant(document, config)),
  }
}
