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

const MIP_LENGTH = 10

const INITIAL_ACCOUNT_CHARGE_RATE = 0.024

const REDEMPTION_FEE_SCHEDULE = [
  { startPolicyYear: 3, endPolicyYear: 3, rate: 0.8 },
  { startPolicyYear: 4, endPolicyYear: 4, rate: 0.68 },
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.58 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.55 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.45 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.3 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.15 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.07 },
] as const

const SURRENDER_CHARGE_SCHEDULE = [
  1,
  1,
  0.8,
  0.68,
  0.58,
  0.55,
  0.45,
  0.3,
  0.15,
  0.07,
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
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest Flexi VII', 18))
  const page3 = sourceRef(3, 'Bonus overview and support benefits', snippetNear(document, 3, 'Booster Bonus', 22))
  const page5 = sourceRef(5, 'Regular premium and missed-premium behavior', snippetNear(document, 5, 'Regular Premium', 26))
  const page6 = sourceRef(6, 'Top-up premium and initial account charge', snippetNear(document, 6, 'Top-up premium', 26))
  const page7 = sourceRef(7, 'Initial account charge and premium shortfall charge', snippetNear(document, 7, 'Initial account charge', 28))
  const page8 = sourceRef(8, 'Top-up premium charge', snippetNear(document, 8, 'Premium charge', 18))
  const page9 = sourceRef(9, 'Premium shortfall and redemption fee', snippetNear(document, 9, 'premium shortfall charge', 28))
  const page10 = sourceRef(10, 'Surrender charge', snippetNear(document, 10, 'Surrender charge', 24))
  const page12 = sourceRef(12, 'Withdrawal rules and minimum account value', snippetNear(document, 12, 'Withdrawals are allowed', 24))
  const page13 = sourceRef(13, 'Regular withdrawal and change of person insured', snippetNear(document, 13, 'Regular withdrawal', 18))

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'initial-account-charge',
      label: 'Initial Account Charge',
      basis: 'premium-base-mip-multiplier',
      yearBasis: 'policy-year',
      rate: INITIAL_ACCOUNT_CHARGE_RATE,
      amount: 0,
      appliesTo: ['initial'],
      fallbackAppliesTo: ['accumulation'],
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: true,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 1, endPolicyYear: 9, mode: 'policy-year' },
          { startPolicyYear: 10, endPolicyYear: null, mode: 'fixed', multiplier: 10 },
        ],
      },
      activeWindow: 'policy-term',
      notes: [
        'Models the published monthly initial-account charge throughout the policy term.',
        'The charge stays anchored to the commencement-date annualised regular premium and therefore does not reduce after non-payment or premium reduction.',
        'If the initial units account is insufficient, the remaining deduction falls back to the accumulation units account.',
      ],
      sourceRefs: [page6, page7],
    },
  ]

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
        'Top-up repayment precedence, year-2 eligibility, and the total top-up cap remain informational only in V1.',
      ],
      sourceRefs: [page6, page8],
    },
    {
      id: 'initial-account-redemption-fee',
      label: 'Initial Account Redemption Fee',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['initial'],
      rate: 0,
      rateSchedule: REDEMPTION_FEE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published initial-units-account redemption fee schedule during the 10-year minimum investment term.',
        'Accumulation-units-account withdrawals remain charge-free in the published summary.',
        'The first-two-policy-year lockout, minimum withdrawal amount, and minimum account-value rules remain informational only.',
      ],
      sourceRefs: [page9, page12],
    },
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: MIP_LENGTH,
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
        sourceRefs: [page1, page5, page7, page12],
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
        sourceRefs: [page5, page6, page12],
      },
    ],
    bonuses: [],
    feeRules,
    eventChargeRules,
    eecTable: [...SURRENDER_CHARGE_SCHEDULE],
    warnings: [
      'FWD Invest Flexi VII (SGD / 10-year minimum investment term) is cataloged as a partial modeled subset in V1. The parser captures the published fixed-premium-base initial account charge, the 5% top-up premium charge, the initial-units-account redemption-fee schedule, and the initial-units-account surrender-charge schedule.',
      'Premium shortfall charge remains informational only because the automatic 12-month Premium Pause Waiver cannot be expressed exactly in the current event kernel without overstating chargeable missed-premium months.',
      'Booster Bonus, Annual Premium Bonus, Loyalty Bonus, insurance charge, repayment waterfalls, and withdrawal eligibility gates remain outside the current engine.',
    ],
    unsupportedItems: [
      'Premium shortfall charge remains informational only because the automatic 12-month Premium Pause Waiver on missed premiums is not modeled exactly in V1.',
      'Support Benefit approvals and premium-shortfall-charge refund / waiver behavior remain informational only.',
      'Booster Bonus, Annual Premium Bonus, Loyalty Bonus, and repayment-driven bonus restoration remain informational only.',
      'Insurance charge remains informational only because the attained-age / sex / smoker Appendix B rate table is not yet wired for this FWD protection formula.',
      'Top-up repayment precedence for missed premiums, prior withdrawals, and prior regular-premium reductions remains informational only.',
      'Regular-premium reduction and restoration mechanics from policy year 8 onward remain informational only.',
      'Initial-units-account withdrawal lockout in the first two policy years, minimum withdrawal requirements, minimum account-value gates, and regular-withdrawal elections remain informational only.',
      'Policy closure charge, change-of-person-insured handling, switching-fee review rights, and fund-level management charges remain informational only.',
    ],
    sourceRefs: [page1, page3, page5, page6, page7, page8, page9, page10, page12, page13],
  }
}

export function parseFwdInvestFlexiVii(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-flexi-vii',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest Flexi VII',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:fwd-invest-flexi-vii-initial-account-charge',
      'branch:fwd-invest-flexi-vii-top-up-premium-charge',
      'branch:fwd-invest-flexi-vii-initial-account-redemption-fee',
      'branch:fwd-invest-flexi-vii-initial-account-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-flexi-vii-premium-shortfall-charge',
      'fwd-invest-flexi-vii-premium-pause-waiver',
      'fwd-invest-flexi-vii-support-benefit-waiver-and-refund',
      'fwd-invest-flexi-vii-insurance-charge',
      'fwd-invest-flexi-vii-booster-bonus',
      'fwd-invest-flexi-vii-annual-premium-bonus',
      'fwd-invest-flexi-vii-loyalty-bonus',
      'fwd-invest-flexi-vii-repayment-bonus-restoration',
      'fwd-invest-flexi-vii-top-up-repayment-waterfall',
      'fwd-invest-flexi-vii-regular-premium-reduction-and-restoration',
      'fwd-invest-flexi-vii-withdrawal-eligibility-gates',
      'fwd-invest-flexi-vii-policy-closure-charge',
      'fwd-invest-flexi-vii-change-of-person-insured',
      'fwd-invest-flexi-vii-fund-switching',
      'fwd-invest-flexi-vii-fund-level-charges',
    ],
    warnings: [
      'FWD Invest Flexi VII is cataloged as a partial modeled subset in V1. The current parser covers the published charge surfaces that fit the existing two-account and surrender kernels.',
      'Premium shortfall / Premium Pause Waiver behavior, bonuses, insurance charge, repayment waterfalls, and broader withdrawal / premium-flexibility behavior remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document),
    ],
  }
}
