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

const VARIANTS = [
  {
    id: 'sgd-mip-8-flexi-3',
    label: '8 Years Flexi 3',
    mipLength: 8,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 24_000, maxAnnualPremium: 35_999.99, rate: 0.005 },
      { currency: 'SGD', minAnnualPremium: 36_000, maxAnnualPremium: 47_999.99, rate: 0.01 },
      { currency: 'SGD', minAnnualPremium: 48_000, maxAnnualPremium: null, rate: 0.025 },
    ],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
    ],
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0],
  },
  {
    id: 'sgd-mip-8-flexi-5',
    label: '8 Years Flexi 5',
    mipLength: 8,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 6_000, maxAnnualPremium: 8_999.99, rate: 0.01 },
      { currency: 'SGD', minAnnualPremium: 9_000, maxAnnualPremium: 14_999.99, rate: 0.025 },
      { currency: 'SGD', minAnnualPremium: 15_000, maxAnnualPremium: null, rate: 0.075 },
    ],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.6 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.5 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.4 },
    ],
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0],
  },
  {
    id: 'sgd-mip-12-flexi-8',
    label: '12 Years Flexi 8',
    mipLength: 12,
    welcomeBonusTiers: [
      { currency: 'SGD', minAnnualPremium: 3_600, maxAnnualPremium: 7_199.99, rate: 0.025 },
      { currency: 'SGD', minAnnualPremium: 7_200, maxAnnualPremium: 11_999.99, rate: 0.085 },
      { currency: 'SGD', minAnnualPremium: 12_000, maxAnnualPremium: null, rate: 0.15 },
    ],
    premiumShortfallSchedule: [
      { startPolicyYear: 1, endPolicyYear: 2, rate: 1 },
      { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
      { startPolicyYear: 4, endPolicyYear: 4, rate: 0.7 },
      { startPolicyYear: 5, endPolicyYear: 5, rate: 0.6 },
      { startPolicyYear: 6, endPolicyYear: 6, rate: 0.5 },
      { startPolicyYear: 7, endPolicyYear: 7, rate: 0.4 },
      { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
    ],
    withdrawalAndSurrenderChargeSchedule: [1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0],
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

function snippetNear(
  document: ExtractedPdfDocument,
  pageNumber: number,
  keyword: string,
  lineWindow = 16,
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

function buildBonuses(
  variantDefinition: typeof VARIANTS[number],
  page4: IlpCatalogSourceRef,
  page5: IlpCatalogSourceRef,
  page8: IlpCatalogSourceRef,
): IlpTemplateBonus[] {
  return [
    {
      id: 'welcome-bonus',
      type: 'sign-up',
      label: 'Welcome Bonus',
      mode: 'premium-allocation',
      appliesTo: ['policy'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: null,
      amount: null,
      tieredRates: variantDefinition.welcomeBonusTiers.map((tier) => ({ ...tier })),
      notes: [
        `Applied on the first 12 months of regular basic premium for the ${variantDefinition.label} corridor.`,
        'Top-up premium does not qualify for the Welcome Bonus.',
      ],
      sourceRefs: [page4, page8],
    },
    {
      id: 'loyalty-bonus',
      type: 'loyalty',
      label: 'Loyalty Bonus',
      mode: 'annual-rate',
      appliesTo: ['policy'],
      startPolicyYear: variantDefinition.mipLength + 1,
      endPolicyYear: null,
      rate: 0.0035,
      amount: null,
      tieredRates: [],
      suspensionRules: [{ trigger: 'partial-withdrawal', suspensionMonths: 12 }],
      notes: [
        'Applied annually as additional units on the policy account value from the next policy anniversary after the minimum investment period ends.',
        'Top-up premium qualifies as part of account value for Loyalty Bonus eligibility, subject to the published no-partial-withdrawal qualification.',
        'Target Retirement Income payouts do not suspend Loyalty Bonus eligibility in the source document and therefore remain outside the partial-withdrawal suspension path.',
      ],
      sourceRefs: [page4, page5, page8],
    },
  ]
}

function buildVariant(
  document: ExtractedPdfDocument,
  variantDefinition: typeof VARIANTS[number],
): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Product description and death benefit', snippetNear(document, 1, 'Target Retirement Income', 18))
  const page3 = sourceRef(3, 'Target retirement income and minimum premium', snippetNear(document, 3, 'Payment of Target Retirement Income', 22))
  const page4 = sourceRef(4, 'Welcome Bonus and Loyalty Bonus', snippetNear(document, 4, 'Welcome Bonus', 28))
  const page5 = sourceRef(5, 'Administrative charge and surrender charge', snippetNear(document, 5, 'Administrative Charge', 22))
  const page6 = sourceRef(6, 'Partial withdrawal charge and premium shortfall charge', snippetNear(document, 6, 'Premium Shortfall Charge', 24))
  const page8 = sourceRef(8, 'Top-up premium and policy options', snippetNear(document, 8, 'Top-up Premium', 22))
  const page9 = sourceRef(9, 'Distribution of dividend', snippetNear(document, 9, 'Distribution of Dividend', 20))
  const page19 = sourceRef(19, 'Appendix B annual COI table for death benefit', snippetNear(document, 19, 'Annual Cost of Insurance for Death Benefit', 26))
  const page21 = sourceRef(21, 'Appendix B annual COI table for WOP on TPD', snippetNear(document, 21, 'Annual Cost of Insurance for Waiver of Premium Benefit on TPD', 26))

  const flexiStartPolicyYear = Math.max(
    ...variantDefinition.premiumShortfallSchedule.map((tier) => tier.endPolicyYear),
  ) + 1

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'cost-of-insurance-death',
      label: 'Cost of Insurance (Death Benefit)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'manulife-smartretire-death',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 99,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'policy-term',
      startPolicyYear: 1,
      endPolicyYear: null,
      notes: [
        'Models the published monthly COI for the death benefit during the minimum investment period using 105% of basic premiums paid plus top-up premiums less withdrawals, net of account value.',
        'After the minimum investment period and before target retirement age, the modeled death-benefit COI uses current basic sum insured less withdrawals and account value.',
        'No death-benefit COI is modeled on or after the supplied target retirement age.',
        'Requires insured-life details, plus current target retirement age and current basic sum insured for the later accumulation corridor.',
      ],
      sourceRefs: [page5, page19],
    },
    {
      id: 'cost-of-insurance-wop-on-tpd',
      label: 'Cost of Insurance (WOP on TPD)',
      basis: 'assurance-sum-at-risk',
      rate: null,
      amount: null,
      assuranceConfig: {
        formula: 'manulife-smartretire-wop-tpd',
        monthlyModalFactor: 1 / 12,
        maxAgeNextBirthday: 70,
      },
      requiresManualInput: true,
      appliesTo: ['policy'],
      activeWindow: 'during-mip',
      startPolicyYear: 1,
      endPolicyYear: flexiStartPolicyYear - 1,
      notes: [
        `Models the published monthly COI for Waiver of Premium benefit on TPD through policy year ${flexiStartPolicyYear - 1}, with NAAR equal to the remaining scheduled basic premiums until before Flexi Start and capped at S$1,000,000.`,
        'Requires the policy-owner insured-life details before the calculator can model the guaranteed WOP-on-TPD COI table.',
      ],
      sourceRefs: [page5, page21],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published prevailing 0% top-up charge.',
      ],
      sourceRefs: [page8],
    },
    {
      id: 'premium-shortfall-charge',
      label: 'Premium Shortfall Charge',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: variantDefinition.premiumShortfallSchedule.map((tier) => ({ ...tier })),
      activeWindow: 'during-mip',
      allocation: 'pro-rata-by-value',
      notes: [
        `Models the published monthly premium shortfall charge before Flexi Start for the ${variantDefinition.label} corridor.`,
        'Use a premium-holiday event to represent missed regular premiums after the grace period.',
      ],
      sourceRefs: [page1, page6],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['policy'],
      rate: 0,
      amount: 0,
      rateSchedule: buildRateSchedule(variantDefinition.withdrawalAndSurrenderChargeSchedule),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published MIP partial-withdrawal charge schedule for the ${variantDefinition.label} corridor.`,
        'Regular retirement-income payouts remain a separate payout-state path and do not use this ad hoc withdrawal charge rule.',
      ],
      sourceRefs: [page5, page6],
    },
  ]

  return {
    id: variantDefinition.id,
    currency: 'SGD',
    mipLength: variantDefinition.mipLength,
    icpMonths: 1,
    accounts: [
      {
        id: 'policy',
        label: 'Policy Account',
        feeRate: 0.025,
        postMipFeeRate: 0.0075,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'policy', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'policy', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page8],
      },
    ],
    bonuses: buildBonuses(variantDefinition, page4, page5, page8),
    feeRules,
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: true,
      minimumTopUpAmount: 2_500,
    },
    scheduledPayoutSupport: {
      mode: 'manual-assumption',
      accountId: 'policy',
      requiresTargetRetirementAgeStart: true,
      source: 'policy-redemption',
      notes: [
        'Target Retirement Income is paid monthly by selling policy units from the selected retirement age until the end of the selected retirement period, if there is sufficient account value.',
      ],
      sourceRefs: [page3],
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
        'Dividend-paying funds may be reinvested or paid out in cash.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
      ],
      sourceRefs: [page9],
    },
    eecTable: [...variantDefinition.withdrawalAndSurrenderChargeSchedule],
    warnings: [
      `${variantDefinition.label} is cataloged as a supported V1 corridor. The parser captures the published 2.50% / 0.75% administrative-charge path, the MIP withdrawal / surrender charge schedule, the premium-shortfall charge before Flexi Start, the prevailing 0% top-up charge, the published S$2,500 minimum on explicit ad-hoc top-up premiums, the welcome-bonus and loyalty-bonus mechanics, the current-state death-benefit estimate across the MIP and later current-only mature-policy corridors, the guaranteed death-benefit COI table, the guaranteed WOP-on-TPD COI table before Flexi Start after insured-life details are supplied, the current admitted-state WOP premium-waiver path before Flexi Start when the current WOP claim-history status and remaining-waiver-runway inputs are supplied, the target-retirement-age COI refund path both before and after target retirement age when current refund-eligible death COI, explicit refund-gate status, and already-due refund-status inputs are supplied where applicable, scheduled retirement-income capability through the payout-state kernel with the published target-retirement-age start gate, annual-state lapse / termination after projected account-value depletion, and the reinvest-default distribution-mode assumption surface.`,
      'Waiver-of-premium claim admission history before the current projection start, broader COI refund claim-history reconstruction beyond the explicit current inputs, flexi-start premium variation, and fund-level management charges remain outside the current engine.',
      'Top-up allocation across up to 10 funds at a minimum of 10% per fund remains informational only.',
      'Withdrawals of accumulated reinvested dividends remain informational only.',
    ],
    unsupportedItems: [
      'The current-state death-benefit estimate now covers the MIP corridor plus the later current-only mature-policy corridors once manual amount-owing and retirement-state inputs are supplied. Claim-side handling after benefit settlement remains informational only.',
      'Death-benefit claim settlement and post-claim handling remain informational only beyond the modeled death-benefit COI table.',
      'Waiver of Premium benefit on TPD claim admission history before the current projection start, insurer-side claim settlement, and broader post-claim administration remain informational only beyond the modeled WOP-on-TPD COI table and current admitted-state waived-premium path.',
      'Refund of Cost of Insurance at target retirement age is modeled only through explicit current refund-eligible death COI, SmartRetire refund-gate status, WOP-on-TPD claim-state, and already-due refund-status inputs. Broader refund claim-history reconstruction remains informational only.',
      'Flexi-start regular-premium variation and change-of-basic-sum-insured mechanics remain informational only.',
      'Top-up allocation across up to 10 funds at a minimum of 10% per fund remains informational only.',
      'Reinstatement underwriting, approval, premium-allocation carry-forward, and exclusion resets after reinstatement remain informational only.',
      'Withdrawals of accumulated reinvested dividends remain informational only.',
      'Fund-level management charges, fund switching, premium redirection, and automatic fund rebalancing remain informational only.',
    ],
    sourceRefs: [page1, page3, page4, page5, page6, page8, page9],
  }
}

export function parseManulifeSmartRetireIncome({ document, sourceChecksumSha256 }: ParseContext): IlpCatalogProduct {
  return {
    id: 'manulife-smartretire-v-income',
    insurer: 'Manulife Singapore',
    productName: 'Manulife SmartRetire (V) - Income',
    sourceFileName: path.basename(document.filePath),
    sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:manulife-smartretire-v-administrative-charge',
      'branch:manulife-smartretire-v-withdrawal-and-surrender-charge',
      'branch:manulife-smartretire-v-premium-shortfall-charge',
      'branch:manulife-smartretire-v-zero-top-up-charge',
      'kernel:top-up-amount-gate-block',
      'branch:manulife-smartretire-v-welcome-bonus',
      'branch:manulife-smartretire-v-loyalty-bonus',
      'branch:manulife-smartretire-v-death-coi',
      'branch:manulife-smartretire-v-wop-on-tpd-coi',
      'branch:manulife-smartretire-v-wop-premium-waiver',
      'branch:manulife-smartretire-v-coi-refund',
      'kernel:current-death-benefit-estimate',
      'kernel:automatic-lapse-on-account-depletion',
      'kernel:scheduled-payout-manual-assumption',
      'kernel:scheduled-payout-target-retirement-age-gate',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: ['manulife-smartretire-v-income-fund-management-charge'],
    metadataOnlyBehaviors: [
      'manulife-smartretire-v-income-claim-handling',
      'manulife-smartretire-v-income-waiver-of-premium-benefit',
      'manulife-smartretire-v-income-coi-refund-claim-history',
      'manulife-smartretire-v-income-flexi-start-premium-variation',
      'manulife-smartretire-v-income-reinstatement-underwriting-and-exclusion-resets',
      'manulife-smartretire-v-income-reinvested-dividend-withdrawal',
      'manulife-smartretire-v-income-fund-switching-and-redirection',
    ],
    warnings: [
      'Manulife SmartRetire (V) - Income is cataloged as a supported V1 product for the regular-pay corridors. The parser captures the published administrative-charge path, MIP withdrawal / surrender schedule, premium-shortfall charge before Flexi Start, prevailing 0% top-up charge, the published S$2,500 minimum on explicit ad-hoc top-up premiums, welcome-bonus and loyalty-bonus mechanics, the current-state death-benefit estimate across the MIP and later current-only mature-policy corridors, the guaranteed death-benefit COI table, the guaranteed WOP-on-TPD COI table before Flexi Start after insured-life details are supplied, the current admitted-state WOP premium-waiver path before Flexi Start when the current WOP claim-history status and remaining-waiver-runway inputs are supplied, the target-retirement-age COI refund path both before and after target retirement age when current refund-eligible death COI, explicit refund-gate status, and already-due refund-status inputs are supplied where applicable, scheduled retirement-income capability through the payout-state kernel with the published target-retirement-age start gate, annual-state lapse / termination after projected account-value depletion, and the reinvest-default distribution-mode assumption surface, while top-up allocation across up to 10 funds at a minimum of 10% per fund, broader insurer-side claim settlement, reinstatement underwriting and exclusion resets, and fund-level charges remain outside the current engine.',
    ],
    archived: false,
    variants: VARIANTS.map((variantDefinition) => buildVariant(document, variantDefinition)),
  }
}
