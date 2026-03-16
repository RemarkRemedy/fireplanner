import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

type FlexMode = 'flexi-3' | 'flexi-5'

const INITIAL_ACCOUNT_CHARGE_RATE = 0.025

const REDEMPTION_FEE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.79 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.6 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.5 },
  { startPolicyYear: 6, endPolicyYear: 10, rate: 0.05 },
] as const

const SURRENDER_CHARGE_SCHEDULE: Record<FlexMode, number[]> = {
  'flexi-3': [1, 1, 0.79, 0.6, 0.5, 0.45, 0.4, 0.2, 0.15, 0.05],
  'flexi-5': [1, 1, 0.8, 0.68, 0.58, 0.55, 0.45, 0.18, 0.12, 0.03],
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
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function flexModeLabel(flexMode: FlexMode): string {
  return flexMode === 'flexi-3' ? '10 years – (3 flexi)' : '10 years – (5 flexi)'
}

function buildInitialAccountChargeRule(page6: IlpCatalogSourceRef): IlpTemplateFeeRule {
  return {
    id: 'initial-account-charge',
    label: 'Initial Account Charge',
    basis: 'account-value',
    yearBasis: 'policy-year',
    rate: INITIAL_ACCOUNT_CHARGE_RATE,
    amount: 0,
    appliesTo: ['initial'],
    activeWindow: 'during-mip',
    notes: [
      'Models the published monthly initial-account charge on the initial-units-account value during the 10-year minimum investment term.',
      'The charge remains deductible even when regular premiums are not being paid during the minimum investment term.',
      'Pending-transaction deferral timing remains informational only in V1.',
    ],
    sourceRefs: [page6],
  }
}

function buildInsuranceChargeRule(page6: IlpCatalogSourceRef): IlpTemplateFeeRule {
  return {
    id: 'insurance-charge',
    label: 'Insurance Charge',
    basis: 'assurance-sum-at-risk',
    rate: 0,
    amount: 0,
    appliesTo: ['initial', 'accumulation'],
    assuranceValueAppliesTo: ['initial', 'accumulation'],
    activeWindow: 'policy-term',
    requiresManualInput: true,
    assuranceConfig: {
      formula: 'fwd-invest-flexi-elite-death',
      monthlyModalFactor: 1 / 12,
      maxAgeNextBirthday: 99,
    },
    notes: [
      'Requires insured-life details and the current net regular-premium and top-up-premium bases before the calculator can model the monthly insurance charge.',
      'Models the published 101% of total regular premiums paid plus total top-up premiums paid, less total withdrawals made, minus policy value sum-at-risk formula.',
      'The protection-benefit payout path and multi-life administration remain informational only in V1.',
    ],
    sourceRefs: [page6],
  }
}

function buildVariant(document: ExtractedPdfDocument, flexMode: FlexMode): IlpTemplateVariant {
  const variantLabel = flexModeLabel(flexMode)
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest Flexi Elite', 18))
  const page2 = sourceRef(2, 'Booster Bonus and Annual Premium Bonus', snippetNear(document, 2, 'Booster Bonus', 22))
  const page3 = sourceRef(3, 'Contribution Bonus and Involuntary Unemployment Benefit', snippetNear(document, 3, 'Contribution Bonus', 28))
  const page5 = sourceRef(5, 'Regular premium and top-up premium overview', snippetNear(document, 5, 'Regular Premium for FWD Invest Flexi Elite', 30))
  const page6 = sourceRef(6, 'Initial account charge and insurance charge', snippetNear(document, 6, 'Initial account charge', 26))
  const page6Insurance = sourceRef(6, 'Initial account charge and insurance charge', snippetNear(document, 6, 'Insurance charge is payable', 20))
  const page7 = sourceRef(7, 'Top-up premium charge and premium shortfall charge period', snippetNear(document, 7, 'Premium charge', 28))
  const page8 = sourceRef(8, 'Premium shortfall charge formula', snippetNear(document, 8, 'The premium shortfall charge =', 28))
  const page9 = sourceRef(9, 'Redemption fee', snippetNear(document, 9, 'Redemption fee rate', 24))
  const page10 = sourceRef(10, 'Surrender charge', snippetNear(document, 10, 'Surrender charge rate', 26))
  const page11 = sourceRef(11, 'Withdrawal option overview', snippetNear(document, 11, 'Withdrawal option and Free Partial Withdrawal Benefit', 28))
  const page12 = sourceRef(12, 'Partial withdrawal limits and minimum account value', snippetNear(document, 12, 'Partial withdrawal limit', 28))
  const page13 = sourceRef(13, 'Free Partial Withdrawal Benefit', snippetNear(document, 13, 'Free Partial Withdrawal Benefit', 28))
  const page17 = sourceRef(17, 'Dividend distribution options', snippetNear(document, 17, 'What are the options to manage my dividends', 28))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'Models the published 5% premium charge on each accepted top-up premium.',
        'The regular-premium-paid gate, minimum top-up amount, and investment-strategy routing remain informational only in V1.',
      ],
      sourceRefs: [page5, page7],
    },
    {
      id: 'initial-account-redemption-fee',
      label: 'Initial Account Redemption Fee',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['initial'],
      rate: 0,
      amount: 0,
      rateSchedule: REDEMPTION_FEE_SCHEDULE.map((tier) => ({ ...tier })),
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        `Models the published initial-units-account redemption-fee schedule for the ${variantLabel} corridor.`,
        'The first-two-policy-year withdrawal lockout, partial-withdrawal limit, minimum withdrawal amount, and minimum account-value rules remain informational only.',
        'Free Partial Withdrawal Benefit waivers remain informational only in V1.',
      ],
      sourceRefs: [page9, page11, page12, page13],
    },
  ]

  return {
    id: `sgd-mip-10-${flexMode}`,
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: 10,
    icpMonths: 1,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
          { phase: 'after-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page5, page6, page11, page12, page13],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page5, page7, page11],
      },
    ],
    bonuses: [],
    feeRules: [
      buildInitialAccountChargeRule(page6),
      buildInsuranceChargeRule(page6Insurance),
    ],
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash, with reinvestment as the default if no option is elected.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption and the published S$10 minimum payout threshold remains informational only.',
      ],
      sourceRefs: [page17],
    },
    eecTable: [...SURRENDER_CHARGE_SCHEDULE[flexMode]],
    warnings: [
      `FWD Invest Flexi Elite (${variantLabel}) is cataloged as a supported V1 product. The parser captures the published initial-account-value charge, monthly insurance charge, the 5% top-up premium charge, the initial-units-account redemption-fee schedule, the initial-units-account surrender-charge schedule, and the reinvest-default distribution-mode assumption surface.`,
      'Premium shortfall charge remains informational only because the published unemployment waiver, refund, and restart timing cannot be expressed exactly in the current event kernel without overstating chargeable missed-premium months.',
      'Booster Bonus, Annual Premium Bonus, Contribution Bonus, Free Partial Withdrawal Benefit, the published S$10 dividend cash-out threshold, and broader premium-flexibility behavior remain metadata-only.',
    ],
    unsupportedItems: [
      'Premium shortfall charge remains informational only because the unemployment waiver, refund, and variant-specific charge periods are not modeled exactly in V1.',
      'Booster Bonus, Annual Premium Bonus, and Contribution Bonus remain informational only.',
      'Free Partial Withdrawal Benefit eligibility, capped fee waivers, and life-event proof requirements remain informational only.',
      'Partial-withdrawal limit formulas, minimum withdrawal requirements, and minimum account-value gates remain informational only.',
      'Regular-premium reduction and increase windows, top-up eligibility gates, and premium-payment continuation after the minimum investment term remain informational only.',
      'Policy closure charge, fund-switching review rights, the published S$10 dividend cash-out threshold and pending-transaction sale timing, and change-of-policy-currency handling remain informational only.',
    ],
    sourceRefs: [page1, page2, page3, page5, page6, page7, page8, page9, page10, page11, page12, page13, page17],
  }
}

export function parseFwdInvestFlexiElite(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-flexi-elite',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest Flexi Elite',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'kernel:protected-base-assurance',
      'branch:fwd-invest-flexi-elite-initial-account-charge',
      'branch:fwd-invest-flexi-elite-insurance-charge',
      'branch:fwd-invest-flexi-elite-top-up-premium-charge',
      'branch:fwd-invest-flexi-elite-initial-account-redemption-fee',
      'branch:fwd-invest-flexi-elite-initial-account-surrender-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-flexi-elite-premium-shortfall-charge',
      'fwd-invest-flexi-elite-involuntary-unemployment-benefit',
      'fwd-invest-flexi-elite-premium-shortfall-charge-refund',
      'fwd-invest-flexi-elite-booster-bonus',
      'fwd-invest-flexi-elite-annual-premium-bonus',
      'fwd-invest-flexi-elite-contribution-bonus',
      'fwd-invest-flexi-elite-free-partial-withdrawal-benefit',
      'fwd-invest-flexi-elite-partial-withdrawal-limits',
      'fwd-invest-flexi-elite-premium-flexibility-gates',
      'fwd-invest-flexi-elite-regular-withdrawal-option',
      'fwd-invest-flexi-elite-policy-closure-charge',
      'fwd-invest-flexi-elite-fund-switching',
      'fwd-invest-flexi-elite-dividend-cashout-threshold',
      'fwd-invest-flexi-elite-change-of-policy-currency',
    ],
    warnings: [
      'FWD Invest Flexi Elite is cataloged as a supported V1 product. The current parser covers the published initial-account-value charge, monthly insurance charge, top-up premium charge, redemption-fee schedule, surrender-charge schedule, and reinvest-default distribution support that fit the existing kernels.',
      'Premium shortfall / unemployment-waiver behavior, bonuses, Free Partial Withdrawal Benefit, and broader premium-flexibility behavior remain metadata-only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 'flexi-3'),
      buildVariant(context.document, 'flexi-5'),
    ],
  }
}
