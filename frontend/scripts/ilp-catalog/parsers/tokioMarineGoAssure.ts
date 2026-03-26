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

const MIP_LENGTH = 10

const SURRENDER_CHARGE_TABLE = [1, 1, 0.95, 0.95, 0.7, 0.65, 0.6, 0.45, 0.25, 0.08] as const

const PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE = [
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.7 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.65 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.6 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.45 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
] as const

const PREMIUM_SHORTFALL_CHARGE_SCHEDULE = [
  { startPolicyYear: 5, endPolicyYear: 5, rate: 0.7 },
  { startPolicyYear: 6, endPolicyYear: 6, rate: 0.65 },
  { startPolicyYear: 7, endPolicyYear: 7, rate: 0.6 },
  { startPolicyYear: 8, endPolicyYear: 8, rate: 0.45 },
  { startPolicyYear: 9, endPolicyYear: 9, rate: 0.25 },
  { startPolicyYear: 10, endPolicyYear: 10, rate: 0.08 },
] as const

const INITIAL_CHARGE_RATE_SCHEDULE = Array.from({ length: MIP_LENGTH }, (_, index) => {
  const policyYear = index + 1
  return {
    startPolicyYear: policyYear,
    endPolicyYear: policyYear,
    rate: Number((0.0065 * policyYear).toFixed(4)),
  }
})

const INITIAL_BONUS_SUM_ASSURED_TIERS = [
  { minSumAssured: 100_000, maxSumAssured: 199_000, year1Rate: 0.01, year2Rate: 0.02, year3Rate: 0.03, year4Rate: 0.05 },
  { minSumAssured: 200_000, maxSumAssured: 299_000, year1Rate: 0.02, year2Rate: 0.03, year3Rate: 0.04, year4Rate: 0.06 },
  { minSumAssured: 300_000, maxSumAssured: null, year1Rate: 0.03, year2Rate: 0.04, year3Rate: 0.05, year4Rate: 0.07 },
] as const

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

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 10): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function buildFeeRules(document: ExtractedPdfDocument): IlpTemplateFeeRule[] {
  const page13 = sourceRef(13, 'Initial Charge', snippetNear(document, 13, 'Initial Charge', 22))
  const page14 = sourceRef(14, 'Policy Charge', snippetNear(document, 14, 'Policy Charge', 24))

  return [
    {
      id: 'initial-charge',
      label: 'Initial Charge',
      basis: 'account-value',
      rate: 0,
      rateSchedule: INITIAL_CHARGE_RATE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      appliesTo: ['initial'],
      activeWindow: 'during-mip',
      notes: [
        'Models the published monthly initial charge for the SGD 10-year minimum contribution period as 0.65% p.a. multiplied by the current policy year.',
        'The source states this charge continues during premium holiday.',
      ],
      sourceRefs: [page13],
    },
    {
      id: 'policy-charge-during-mip',
      label: 'Policy Charge',
      basis: 'premium-base-mip-multiplier',
      rate: 0.01,
      amount: 0,
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['initial', 'topup'],
      startPolicyYear: 5,
      endPolicyYear: 10,
      activeWindow: 'during-mip',
      premiumBaseConfig: {
        useHigherOfCommencementAndPrevailing: false,
        multiplierYearBasis: 'policy-year',
        multiplierSchedule: [
          { startPolicyYear: 5, endPolicyYear: 10, mode: 'policy-year' },
        ],
      },
      notes: [
        'Models the published monthly policy charge from the 49th policy month until the end of the 10-year minimum contribution period.',
        'If the Accumulation Units Account is insufficient, the remaining deduction falls back to the Initial Units Account and/or Top-up Units Account.',
      ],
      sourceRefs: [page14],
    },
  ]
}

function buildBonuses(document: ExtractedPdfDocument): IlpTemplateBonus[] {
  const page3 = sourceRef(3, 'Initial Bonus', snippetNear(document, 3, 'Initial Bonus', 24))
  const page4 = sourceRef(4, 'Initial Bonus Rates', snippetNear(document, 4, 'Initial Bonus', 28))
  const page6 = sourceRef(6, 'Wellness Bonus', snippetNear(document, 6, 'Wellness Bonus', 28))

  return [
    {
      id: 'initial-bonus-policy-year-1',
      type: 'sign-up',
      label: 'Initial Bonus (Policy Year 1)',
      mode: 'premium-allocation',
      annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
      appliesTo: ['initial'],
      startPolicyYear: 1,
      endPolicyYear: 1,
      rate: 0,
      amount: null,
      tieredRates: INITIAL_BONUS_SUM_ASSURED_TIERS.map((tier) => ({
        currency: 'SGD',
        minAnnualPremium: null,
        maxAnnualPremium: null,
        minSumAssured: tier.minSumAssured,
        maxSumAssured: tier.maxSumAssured,
        rate: tier.year1Rate,
      })),
      notes: [
        'Models the published Initial Bonus credited on each regular premium received in policy year 1 for the SGD 10-year minimum contribution corridor.',
        'The applicable rate band depends on the initial Basic Sum Assured as at commencement date and therefore needs that manual issue-date input in V1.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'initial-bonus-policy-year-2',
      type: 'sign-up',
      label: 'Initial Bonus (Policy Year 2)',
      mode: 'premium-allocation',
      annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
      appliesTo: ['initial'],
      startPolicyYear: 2,
      endPolicyYear: 2,
      rate: 0,
      amount: null,
      tieredRates: INITIAL_BONUS_SUM_ASSURED_TIERS.map((tier) => ({
        currency: 'SGD',
        minAnnualPremium: null,
        maxAnnualPremium: null,
        minSumAssured: tier.minSumAssured,
        maxSumAssured: tier.maxSumAssured,
        rate: tier.year2Rate,
      })),
      notes: [
        'Models the published Initial Bonus credited on each regular premium received in policy year 2 for the SGD 10-year minimum contribution corridor.',
        'The applicable rate band depends on the initial Basic Sum Assured as at commencement date and therefore needs that manual issue-date input in V1.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'initial-bonus-policy-year-3',
      type: 'sign-up',
      label: 'Initial Bonus (Policy Year 3)',
      mode: 'premium-allocation',
      annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
      appliesTo: ['initial'],
      startPolicyYear: 3,
      endPolicyYear: 3,
      rate: 0,
      amount: null,
      tieredRates: INITIAL_BONUS_SUM_ASSURED_TIERS.map((tier) => ({
        currency: 'SGD',
        minAnnualPremium: null,
        maxAnnualPremium: null,
        minSumAssured: tier.minSumAssured,
        maxSumAssured: tier.maxSumAssured,
        rate: tier.year3Rate,
      })),
      notes: [
        'Models the published Initial Bonus credited on each regular premium received in policy year 3 for the SGD 10-year minimum contribution corridor.',
        'The applicable rate band depends on the initial Basic Sum Assured as at commencement date and therefore needs that manual issue-date input in V1.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'initial-bonus-policy-year-4',
      type: 'sign-up',
      label: 'Initial Bonus (Policy Year 4)',
      mode: 'premium-allocation',
      annualPremiumTierBasis: 'initial-basic-sum-assured-at-issue',
      appliesTo: ['initial'],
      startPolicyYear: 4,
      endPolicyYear: 4,
      rate: 0,
      amount: null,
      tieredRates: INITIAL_BONUS_SUM_ASSURED_TIERS.map((tier) => ({
        currency: 'SGD',
        minAnnualPremium: null,
        maxAnnualPremium: null,
        minSumAssured: tier.minSumAssured,
        maxSumAssured: tier.maxSumAssured,
        rate: tier.year4Rate,
      })),
      notes: [
        'Models the published Initial Bonus credited on each regular premium received in policy year 4 for the SGD 10-year minimum contribution corridor.',
        'The applicable rate band depends on the initial Basic Sum Assured as at commencement date and therefore needs that manual issue-date input in V1.',
      ],
      sourceRefs: [page3, page4],
    },
    {
      id: 'wellness-bonus',
      type: 'custom',
      label: 'Wellness Bonus',
      mode: 'annual-rate',
      appliesTo: ['accumulation'],
      startPolicyYear: 15,
      endPolicyYear: 15,
      rate: 0.035,
      amount: null,
      tieredRates: [],
      notes: [
        'Models the published 3.50% Wellness Bonus rate for the SGD 10-year minimum contribution corridor on the Accumulation Units Account.',
        'V1 carries this as a simplified policy-year-15 account-value credit so the core bonus magnitude appears in projection, while the published fully-paid / no-premium-holiday / no-regular-premium-reduction / no-Accumulation-Units-Account-withdrawal / no-claim qualification conditions remain informational only.',
        'The source text also describes the one-time Wellness Bonus as a delayed payout after the minimum contribution period; exact locked-basis timing remains informational only in V1.',
      ],
      sourceRefs: [page6],
    },
  ]
}

function buildVariant(document: ExtractedPdfDocument): IlpTemplateVariant {
  const page1 = sourceRef(1, 'Plan description and account model', snippetNear(document, 1, '#goAssure', 22))
  const page5 = sourceRef(5, 'Waiver and distribution rules', snippetNear(document, 5, 'Dividend Distribution', 24))
  const page8 = sourceRef(8, 'Regular premium routing and minimum premiums', snippetNear(document, 8, 'Regular premium due during the first 48 months', 24))
  const page13 = sourceRef(13, 'Initial Charge', snippetNear(document, 13, 'Initial Charge', 22))
  const page14 = sourceRef(14, 'Policy Charge and premium charge', snippetNear(document, 14, 'Policy Charge', 26))
  const page15 = sourceRef(15, 'Premium Shortfall Charge', snippetNear(document, 15, 'Premium Shortfall Charge', 30))
  const page23 = sourceRef(23, 'Appendix A surrender and withdrawal charges', snippetNear(document, 23, 'Surrender Charge', 26))
  const page24 = sourceRef(24, 'Appendix A partial withdrawal and shortfall charge', snippetNear(document, 24, 'Partial Withdrawal Charge', 26))

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'top-up-premium-charge',
      label: 'Top-up Premium Charge',
      trigger: 'top-up',
      basis: 'event-amount',
      appliesTo: ['topup'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each top-up premium allocation to the Top-up Units Account.',
      ],
      sourceRefs: [page8, page14],
    },
    {
      id: 'recurring-single-premium-charge',
      label: 'Recurring Single Premium Charge',
      trigger: 'recurring-single-premium',
      basis: 'event-amount-with-overlap-months',
      appliesTo: ['topup'],
      rate: 0.05,
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'A 5% premium charge is deducted before each recurring single premium allocation to the Top-up Units Account.',
      ],
      sourceRefs: [page8, page14],
    },
    {
      id: 'partial-withdrawal-charge',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['accumulation'],
      manualWaiverMode: 'capped-free-event',
      manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
      manualWaiverMaxGrantCount: 3,
      freeEventCount: 3,
      freeEventMaxAmountRate: 0.15,
      freeEventMaxAmountBasis: 'open-balance',
      rate: 0,
      rateSchedule: PARTIAL_WITHDRAWAL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Applies only to partial withdrawals from the Accumulation Units Account during the minimum contribution period.',
        'Cash dividend payouts after the minimum contribution period are not subject to partial withdrawal charge.',
        'Dividend cash payouts are modeled separately from partial withdrawals in V1.',
        'When Tokio approves the hospitalisation or involuntary-unemployment waiver, mark the qualifying withdrawal event chargeWaived and, if the same approval also covers a premium-holiday or regular-premium-reduction event, reuse the same chargeWaiverGrantId.',
        'The modeled waiver corridor honors the published up-to-15%-of-prevailing-Accumulation-Units-Account partial-withdrawal charge waiver and the shared three-grants-per-lifetime limit across the qualifying charge-waived event family.',
      ],
      sourceRefs: [page5, page23, page24],
    },
    {
      id: 'premium-shortfall-charge-non-payment',
      label: 'Premium Shortfall Charge (Non-payment)',
      trigger: 'premium-holiday',
      basis: 'committed-annual-premium-with-overlap-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
      manualWaiverMaxGrantCount: 3,
      manualWaiverMaxOverlapMonths: 12,
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-goassure-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge during premium holiday after the first four policy years.',
        'Deducts from the Accumulation Units Account first, then the Initial Units Account and/or Top-up Units Account if needed.',
        'When Tokio approves the hospitalisation or involuntary-unemployment waiver, mark the qualifying premium-holiday event chargeWaived and, if the same approval also covers a qualifying partial withdrawal, reuse the same chargeWaiverGrantId.',
        'The modeled waiver corridor honors the published up-to-12-month premium-shortfall-charge waiver and the shared three-grants-per-lifetime limit across the qualifying charge-waived event family.',
      ],
      sourceRefs: [page15, page24],
    },
    {
      id: 'premium-shortfall-charge-reduction',
      label: 'Premium Shortfall Charge (Regular Premium Reduction)',
      trigger: 'regular-premium-reduction',
      basis: 'annual-reduction-with-active-months',
      appliesTo: ['accumulation'],
      fallbackAppliesTo: ['topup', 'initial'],
      manualWaiverGrantGroup: 'tokio-goassure-manual-charge-waiver',
      manualWaiverMaxGrantCount: 3,
      manualWaiverMaxOverlapMonths: 12,
      rate: 0,
      rateSchedule: PREMIUM_SHORTFALL_CHARGE_SCHEDULE.map((tier) => ({ ...tier })),
      amount: 0,
      exclusiveGroup: 'tokio-goassure-premium-shortfall',
      groupResolution: 'max-total-charge',
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'Models the published monthly premium shortfall charge when annualised regular premium is reduced below the commencement-date commitment after the first four policy years.',
        'When both premium holiday and premium reduction apply, the higher amount is imposed.',
        'When Tokio approves the hospitalisation or involuntary-unemployment waiver, mark the qualifying regular-premium-reduction event chargeWaived and, if the same approval also covers a qualifying partial withdrawal, reuse the same chargeWaiverGrantId.',
        'The modeled waiver corridor honors the published up-to-12-month premium-shortfall-charge waiver and the shared three-grants-per-lifetime limit across the qualifying charge-waived event family.',
      ],
      sourceRefs: [page15, page24],
    },
  ]

  return {
    id: 'sgd-mip-10',
    currency: 'SGD',
    mipLength: MIP_LENGTH,
    icpMonths: 48,
    accounts: [
      {
        id: 'initial',
        label: 'Initial Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'initial', contributionShare: 1 },
        ],
        sourceRefs: [page1, page8, page13],
      },
      {
        id: 'accumulation',
        label: 'Accumulation Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'accumulation', contributionShare: 1 },
          { phase: 'after-mip', targetAccountId: 'accumulation', contributionShare: 1 },
        ],
        sourceRefs: [page1, page8, page14, page15],
      },
      {
        id: 'topup',
        label: 'Top-up Units Account',
        feeRate: null,
        postMipFeeRate: null,
        subjectToEec: false,
        contributionRules: [
          { phase: 'top-up', targetAccountId: 'topup', contributionShare: 1 },
        ],
        sourceRefs: [page1, page8, page14],
      },
    ],
    bonuses: buildBonuses(document),
    feeRules: buildFeeRules(document),
    eventChargeRules,
    policyStateSupport: {
      automaticLapseOnAccountValueDepletion: false,
      minimumRegularPremiumVariationStartPolicyMonth: 49,
      minimumRegularPremiumAmountByFrequency: {
        annual: 3_600,
        'semi-annual': 1_800,
        quarterly: 900,
        monthly: 300,
      },
      minimumRecurringSinglePremiumStartPolicyMonth: 13,
      minimumRecurringSinglePremiumMonthlyAmount: 50,
    },
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['initial', 'accumulation', 'topup'],
      cashPayoutWindows: [
        {
          startPolicyYear: 1,
          endPolicyYear: 10,
          accountIds: ['accumulation', 'topup'],
        },
        {
          startPolicyYear: 11,
          endPolicyYear: null,
          accountIds: ['initial', 'accumulation', 'topup'],
        },
      ],
      recordDateInstructionLeadDays: 30,
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'During the minimum contribution period, dividends from the Initial Units Account are automatically reinvested.',
        'During the minimum contribution period, cash payout may be received from the Accumulation Units Account and Top-up Units Account.',
        'After the minimum contribution period, cash payout may be received from the Initial Units Account, Accumulation Units Account, and Top-up Units Account.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption.',
        'Distribution-option changes should be submitted at least 30 days before the Record Date.',
      ],
      sourceRefs: [page5],
    },
    eecTable: [...SURRENDER_CHARGE_TABLE],
    warnings: [
      '#goAssure is cataloged as a supported V1 corridor. The parser captures the SGD 10-year cash corridor: three-account regular-premium / top-up routing, the published Initial Bonus corridor for policy years 1 to 4 via manual initial basic sum assured at issue bands, the published initial-charge schedule, the premium-base policy charge during MIP, recurring-single-premium and top-up charges, the partial-withdrawal charge schedule, the premium-shortfall charge schedules, the 10-year surrender-charge table, the current-state death-benefit estimate before and after Protection Age via manual current Protection Age / amount-owing / basic-sum-assured inputs, the current terminal-illness snapshot as the lower of that current death corridor and a manual remaining aggregate TI cap, the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, the current TPD benefit estimate before Protection Age via the same current death corridor plus a manual current TPD acceleration ratio and remaining aggregate TPD cap, and the manual distribution-mode assumption surface.',
      'Dividend cash payouts are partially modeled through the manual distribution-mode assumption surface: during the minimum contribution period, Initial Units Account dividends stay reinvested while Accumulation Units Account and Top-up Units Account dividends may be paid in cash; after the minimum contribution period, Initial Units Account dividends join the cash-payout corridor; distribution-option changes should be submitted at least 30 days before the Record Date; and the published $50 per-dividend minimum payout threshold remains informational only.',
      'Explicit regular-premium variation now honors the published after-first-four-policy-years start gate and the SGD minimum regular premium table for annual / semi-annual / quarterly / monthly payment modes. Tokio-defined minimum increase / reduction amounts remain informational only.',
      'Recurring single premium events before policy month 13 or below the published monthly-equivalent minimum of S$50 are blocked; the published maximum recurring single premium table and insurer-defined increase / reduction minimums remain informational only.',
      'Use the charge waiver toggle on qualifying Accumulation Units Account partial withdrawals, premium holidays, or regular-premium reductions only after Tokio has approved the hospitalisation or involuntary-unemployment waiver. The engine now honors the published up-to-15%-of-Accumulation-Units-Account withdrawal cap, the up-to-12-month premium-shortfall-charge waiver cap, and the shared three-grants-per-lifetime limit when related approved events share the same chargeWaiverGrantId; the published 90-day application timing, proof requirements, exclusions, and first-assured coverage remain informational only.',
      'The core 3.50% Wellness Bonus amount for the SGD 10-year minimum-contribution corridor is modeled as a simplified policy-year-15 Accumulation Units Account credit. The published fully-paid / no-premium-holiday / no-regular-premium-reduction / no-Accumulation-Units-Account-withdrawal / no-claim qualification conditions and the source-stated delayed payout basis remain informational only. On this corridor, Loyalty Bonus is N.A. and Achievement Bonus is 0.00%, so they are not carried as active residual mechanics in V1.',
      'The modeled Initial Bonus corridor still needs the initial basic sum assured at issue because the commencement-date sum-assured bands are not reconstructed from current state in V1.',
      'The current-state death-benefit estimate needs manual current Protection Age, current amount owing, and, after Protection Age, current basic sum assured inputs because protection-age elections and withdrawal-adjusted basic-sum-assured history are not reconstructed in V1.',
      'The current terminal-illness snapshot also needs a manual remaining aggregate TI cap because cross-policy TI-limit usage is not reconstructed from history in V1.',
      'The current TPD benefit estimate before Protection Age also needs a manual current TPD acceleration ratio plus a manual remaining aggregate TPD cap because the TPD rider sum assured and cross-policy TPD-limit usage are not reconstructed from history in V1.',
    ],
    unsupportedItems: [
      'Waiver approval timing, hospitalisation / retrenchment proof, medical and unemployment exclusions, first-assured coverage, and Tokio’s discretionary variation of benefit grant counts remain informational only beyond the modeled explicit chargeWaived plus optional shared chargeWaiverGrantId event path.',
      'Monthly Protection Charge, sum-at-risk formulas, Guaranteed Extra Protection, terminal-illness exclusions / settlement, post-TPD continuation state, and broader protection-side claim behavior remain informational only beyond the modeled current TI snapshot and current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today.',
      'Credit-card charge, administrative charge nil surface, policy-currency-change charge nil surface, and third-party charges remain informational only.',
      'The published $50 per-dividend minimum payout threshold, plus detailed dividend-payment processing and settlement handling, remain informational only.',
    ],
    sourceRefs: [page1, page5, page8, page13, page14, page15, page23, page24],
  }
}

export function parseTokioMarineGoAssure(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'tokio-marine-goassure',
    insurer: 'Tokio Marine',
    productName: '#goAssure',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:tokio-marine-goassure-initial-bonus',
      'branch:tokio-marine-goassure-initial-charge',
      'branch:tokio-marine-goassure-policy-charge',
      'branch:tokio-marine-goassure-recurring-single-and-top-up-charge',
      'branch:tokio-marine-goassure-partial-withdrawal-charge',
      'branch:tokio-marine-goassure-premium-shortfall-charge',
      'branch:tokio-marine-goassure-surrender-charge',
      'branch:tokio-marine-goassure-wellness-bonus',
      'kernel:regular-premium-variation-start-gate',
      'kernel:regular-premium-variation-minimum-floor',
      'kernel:minimum-recurring-single-premium-start-month',
      'kernel:minimum-recurring-single-premium-amount',
      'tokio-explicit-charge-waiver-for-partial-withdrawal-and-shortfall-events',
      'kernel:free-withdrawal-event-cap',
      'kernel:manual-charge-waiver-grant-limits',
      'kernel:current-death-benefit-estimate',
      'kernel:current-ti-benefit-estimate',
      'kernel:current-tpd-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    coveredElsewhereBehaviors: ['tokio-marine-goassure-third-party-charges'],
    metadataOnlyBehaviors: [
      'tokio-marine-goassure-waiver-approval-gating-and-limits',
      'tokio-marine-goassure-monthly-protection-charge',
      'tokio-marine-goassure-guaranteed-extra-protection',
      'tokio-marine-goassure-dividend-payout-threshold',
    ],
    warnings: [
      '#goAssure is cataloged as a supported V1 product. The parser captures the SGD 10-year cash corridor charge surfaces, the policy-year-1-to-4 Initial Bonus corridor via manual initial basic sum assured at issue bands, a simplified year-15 Wellness Bonus credit on the Accumulation Units Account for the published 3.50% core bonus amount, the current-state death-benefit estimate before and after Protection Age via manual current Protection Age / amount-owing / basic-sum-assured inputs, the current terminal-illness snapshot as the lower of that current death corridor and a manual remaining aggregate TI cap, the current admitted-state TI payable amount plus residual death-benefit estimate after a TI claim today through the published partial-TI continuation corridor after manual claim-amount and residual-death input, the current TPD benefit estimate before Protection Age via the same current death corridor plus a manual current TPD acceleration ratio and remaining aggregate TPD cap, and distribution-mode assumption support, including phase-specific dividend cash-payout account eligibility and the 30-day record-date instruction lead time, while the published $50 per-dividend minimum payout threshold, Wellness Bonus qualification and exact delayed-payout basis, waiver mechanics, Monthly Protection Charge, terminal-illness exclusions / settlement, post-TPD continuation state, and broader protection-side claim behavior remain informational only.',
    ],
    archived: false,
    variants: [
      buildVariant(context.document),
    ],
  }
}
