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

type PremiumPaymentTerm = 20 | 25

const INITIAL_ACCOUNT_CHARGE_RATE_SCHEDULE: Record<PremiumPaymentTerm, Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }>> = {
  20: [
    { startPolicyYear: 1, endPolicyYear: 9, rate: 0.038 },
    { startPolicyYear: 10, endPolicyYear: null, rate: 0.012 },
  ],
  25: [
    { startPolicyYear: 1, endPolicyYear: 10, rate: 0.035 },
    { startPolicyYear: 11, endPolicyYear: null, rate: 0.01 },
  ],
}

const PREMIUM_REDUCTION_CHARGE_SCHEDULE: Record<PremiumPaymentTerm, Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }>> = {
  20: [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.85 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.68 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.56 },
    { startPolicyYear: 6, endPolicyYear: 6, rate: 0.48 },
    { startPolicyYear: 7, endPolicyYear: 7, rate: 0.42 },
    { startPolicyYear: 8, endPolicyYear: 8, rate: 0.37 },
    { startPolicyYear: 9, endPolicyYear: 9, rate: 0.32 },
  ],
  25: [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.98 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.8 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.67 },
    { startPolicyYear: 6, endPolicyYear: 6, rate: 0.58 },
    { startPolicyYear: 7, endPolicyYear: 7, rate: 0.52 },
    { startPolicyYear: 8, endPolicyYear: 8, rate: 0.47 },
    { startPolicyYear: 9, endPolicyYear: 9, rate: 0.43 },
    { startPolicyYear: 10, endPolicyYear: 10, rate: 0.34 },
  ],
}

const REDEMPTION_FEE_SCHEDULE: Record<PremiumPaymentTerm, Array<{ startPolicyYear: number, endPolicyYear: number | null, rate: number }>> = {
  20: [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.5 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.3 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
    { startPolicyYear: 6, endPolicyYear: 9, rate: 0.1 },
  ],
  25: [
    { startPolicyYear: 3, endPolicyYear: 3, rate: 0.5 },
    { startPolicyYear: 4, endPolicyYear: 4, rate: 0.3 },
    { startPolicyYear: 5, endPolicyYear: 5, rate: 0.2 },
    { startPolicyYear: 6, endPolicyYear: 10, rate: 0.1 },
  ],
}

const SURRENDER_CHARGE_SCHEDULE: Record<PremiumPaymentTerm, number[]> = {
  20: [
    1,
    1,
    0.85,
    0.68,
    0.56,
    0.48,
    0.42,
    0.37,
    0.32,
    0.22,
    0.21,
    0.2,
    0.19,
    0.18,
    0.17,
    0.15,
    0.11,
    0.1,
    0.08,
    0.06,
  ],
  25: [
    1,
    1,
    0.98,
    0.8,
    0.67,
    0.58,
    0.52,
    0.47,
    0.43,
    0.34,
    0.33,
    0.32,
    0.29,
    0.27,
    0.26,
    0.25,
    0.23,
    0.17,
    0.11,
    0.11,
    0.1,
    0.1,
    0.09,
    0.07,
    0.05,
  ],
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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 16): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildInitialAccountChargeRule(term: PremiumPaymentTerm, page9: IlpCatalogSourceRef): IlpTemplateFeeRule {
  return {
    id: 'initial-account-charge',
    label: 'Initial Account Charge',
    basis: 'premium-base-mip-multiplier',
    yearBasis: 'policy-year',
    rate: 0,
    amount: 0,
    appliesTo: ['initial'],
    fallbackAppliesTo: ['accumulation'],
    premiumBaseConfig: {
      useHigherOfCommencementAndPrevailing: true,
      multiplierYearBasis: 'policy-year',
      multiplierSchedule: term === 20
        ? [
            { startPolicyYear: 1, endPolicyYear: 19, mode: 'policy-year' },
            { startPolicyYear: 20, endPolicyYear: null, mode: 'fixed', multiplier: 20 },
          ]
        : [
            { startPolicyYear: 1, endPolicyYear: 24, mode: 'policy-year' },
            { startPolicyYear: 25, endPolicyYear: null, mode: 'fixed', multiplier: 25 },
          ],
    },
    rateSchedule: INITIAL_ACCOUNT_CHARGE_RATE_SCHEDULE[term].map((tier) => ({ ...tier })),
    activeWindow: 'policy-term',
    notes: [
      `Models the published monthly initial-account charge for the ${term}-year premium-payment-term corridor.`,
      'The charge remains anchored to the commencement-date annualised regular premium and therefore does not reduce after premium reductions or missed premiums.',
      'If the initial units account is insufficient, the remaining deduction falls back to the accumulation units account.',
    ],
    sourceRefs: [page9],
  }
}

function buildPremiumReductionChargeRule(term: PremiumPaymentTerm, page12: IlpCatalogSourceRef): IlpTemplateEventChargeRule {
  return {
    id: 'premium-reduction-charge',
    label: 'Premium Reduction Charge',
    trigger: 'regular-premium-reduction',
    basis: 'annual-reduction-with-active-months',
    appliesTo: ['initial'],
    fallbackAppliesTo: ['accumulation'],
    rate: 0,
    amount: 0,
    rateSchedule: PREMIUM_REDUCTION_CHARGE_SCHEDULE[term].map((tier) => ({ ...tier })),
    activeWindow: 'during-mip',
    allocation: 'equal-split',
    notes: [
      `Models the published monthly premium-reduction charge for the ${term}-year premium-payment-term corridor.`,
      'The charge applies to the reduction from the commencement-date annualised regular premium until you restore the original premium or the charge period ends.',
      'Support Benefit waiver approval remains informational only in V1.',
    ],
    sourceRefs: [page12],
  }
}

function buildVariant(document: ExtractedPdfDocument, term: PremiumPaymentTerm): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan overview and death benefit', snippetNear(document, 1, 'FWD Invest First Horizon', 18))
  const page7 = sourceRef(7, 'Missed regular premium and Premium Pause Waiver', snippetNear(document, 7, 'During Policy Year 3', 26))
  const page8 = sourceRef(8, 'Top-up premium', snippetNear(document, 8, 'Top-up premium', 20))
  const page9 = sourceRef(9, 'Initial account charge and insurance charge', snippetNear(document, 9, 'Initial account charge', 30))
  const page10 = sourceRef(10, 'Top-up premium charge', snippetNear(document, 10, 'Premium charge', 16))
  const page11 = sourceRef(11, 'Premium shortfall charge', snippetNear(document, 11, 'Premium shortfall charge', 26))
  const page12 = sourceRef(12, 'Premium reduction charge', snippetNear(document, 12, 'Premium reduction charge', 26))
  const page13 = sourceRef(13, 'Policy closure charge and redemption fee', snippetNear(document, 13, 'Policy closure charge', 24))
  const page14 = sourceRef(14, 'Surrender charge', snippetNear(document, 14, 'Surrender charge', 28))
  const page16 = sourceRef(16, 'Withdrawal rules and partial withdrawal limits', snippetNear(document, 16, 'Withdrawals are allowed', 28))

  return {
    id: `sgd-mip-${term}`,
    currency: 'SGD',
    mipBasis: 'finite',
    mipLength: term,
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
        sourceRefs: [page1, page7, page9, page16],
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
        sourceRefs: [page7, page8, page16],
      },
    ],
    bonuses: [],
    feeRules: [
      buildInitialAccountChargeRule(term, page9),
    ],
    eventChargeRules: [
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
          'The year-2 eligibility gate, repayment waterfall, and total top-up cap remain informational only in V1.',
        ],
        sourceRefs: [page8, page10],
      },
      buildPremiumReductionChargeRule(term, page12),
      {
        id: 'initial-account-redemption-fee',
        label: 'Initial Account Redemption Fee',
        trigger: 'partial-withdrawal',
        basis: 'event-amount',
        appliesTo: ['initial'],
        rate: 0,
        amount: 0,
        rateSchedule: REDEMPTION_FEE_SCHEDULE[term].map((tier) => ({ ...tier })),
        activeWindow: 'during-mip',
        allocation: 'equal-split',
        notes: [
          `Models the published initial-units-account redemption fee schedule for the ${term}-year premium-payment-term corridor.`,
          'Withdrawals from the accumulation units account are charge-free under the published summary.',
          'The first-two-policy-year no-withdrawal gate, partial-withdrawal limit, and minimum account-value rules remain informational only.',
        ],
        sourceRefs: [page13, page16],
      },
    ],
    eecTable: [...SURRENDER_CHARGE_SCHEDULE[term]],
    warnings: [
      `FWD Invest First Horizon (${term}-year premium payment term) is cataloged as a partial modeled subset in V1. The parser captures the published fixed-premium-base initial account charge, the premium-reduction charge schedule, the 5% top-up premium charge, the initial-units-account redemption-fee schedule, and the initial-units-account surrender-charge schedule.`,
      'Premium shortfall charge remains informational only because the automatic 24-month Premium Pause Waiver cannot be expressed exactly in the current event kernel without miscounting year-3 missed premiums.',
      'Booster Bonus, Annual Premium Bonus, Loyalty Bonus, insurance charge, repayment waterfalls, and withdrawal-eligibility gates remain outside the current engine.',
    ],
    unsupportedItems: [
      'Premium shortfall charge remains informational only because the automatic 24-month Premium Pause Waiver starts only from policy year 4 and is not modeled exactly in V1.',
      'Policy year 3 non-payment behavior, Support Benefit approvals, and Premium Pause Waiver month accounting remain informational only.',
      'Booster Bonus, Annual Premium Bonus, Loyalty Bonus, and repayment-driven bonus restoration remain informational only.',
      'Insurance charge remains informational only because the attained-age / sex / smoker Appendix B rate table is not yet wired for this FWD protection formula.',
      'Top-up repayment precedence for missed premiums, prior withdrawals, and prior premium reductions remains informational only.',
      'Top-up eligibility from policy year 2, total top-up cap, minimum top-up amount, and minimum withdrawal requirements remain informational only.',
      'Initial-units-account withdrawal lockout in the first two policy years, the 50%-minus-prior-withdrawals partial-withdrawal limit, and minimum account-value gates remain informational only.',
      'Policy closure charge, switching fee review rights, fund management charges, change-of-person-insured handling, and fund-level transaction deferrals remain informational only.',
    ],
    sourceRefs: [page1, page7, page8, page9, page10, page11, page12, page13, page14, page16],
  }
}

export function parseFwdInvestFirstHorizon(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'fwd-invest-first-horizon',
    insurer: 'FWD Singapore',
    productName: 'FWD Invest First Horizon',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:fwd-invest-first-horizon-initial-account-charge',
      'branch:fwd-invest-first-horizon-premium-reduction-charge',
      'branch:fwd-invest-first-horizon-top-up-premium-charge',
      'branch:fwd-invest-first-horizon-initial-account-redemption-fee',
      'branch:fwd-invest-first-horizon-initial-account-surrender-charge',
    ],
    metadataOnlyBehaviors: [
      'fwd-invest-first-horizon-premium-shortfall-charge',
      'fwd-invest-first-horizon-premium-pause-waiver',
      'fwd-invest-first-horizon-support-benefit-waiver',
      'fwd-invest-first-horizon-insurance-charge',
      'fwd-invest-first-horizon-booster-bonus',
      'fwd-invest-first-horizon-annual-premium-bonus',
      'fwd-invest-first-horizon-loyalty-bonus',
      'fwd-invest-first-horizon-repayment-bonus-restoration',
      'fwd-invest-first-horizon-top-up-repayment-waterfall',
      'fwd-invest-first-horizon-withdrawal-eligibility-gates',
      'fwd-invest-first-horizon-top-up-eligibility-and-cap',
      'fwd-invest-first-horizon-policy-closure-charge',
      'fwd-invest-first-horizon-change-of-person-insured',
      'fwd-invest-first-horizon-fund-switching',
      'fwd-invest-first-horizon-fund-level-charges',
    ],
    warnings: [
      'FWD Invest First Horizon is cataloged as a partial modeled subset in V1. The parser currently covers the published 20-year and 25-year regular-premium corridors that fit the current charge and surrender kernels.',
      'Premium shortfall / Premium Pause Waiver behavior, bonus mechanics, insurance charge, repayment waterfalls, and withdrawal eligibility gates remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document, 20),
      buildVariant(context.document, 25),
    ],
  }
}
