import { z } from 'zod'

export const ilpCatalogSourceRefSchema = z.object({
  page: z.number().int().min(1),
  section: z.string().min(1),
  excerpt: z.string().min(1),
})

export const ilpTemplateContributionRuleSchema = z.object({
  phase: z.enum(['during-icp', 'after-icp', 'after-mip', 'top-up']),
  targetAccountId: z.string().min(1),
  contributionShare: z.number().min(0).max(1),
})

export const ilpTemplateAccountSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  feeRate: z.number().min(0).max(0.2).nullable(),
  postMipFeeRate: z.number().min(0).max(0.2).nullable(),
  subjectToEec: z.boolean(),
  contributionRules: z.array(ilpTemplateContributionRuleSchema),
  sourceRefs: z.array(ilpCatalogSourceRefSchema),
})

export const ilpTemplateBonusTierSchema = z.object({
  currency: z.enum(['SGD', 'USD']),
  minAnnualPremium: z.number().min(0).nullable(),
  maxAnnualPremium: z.number().min(0).nullable(),
  minSumAssured: z.number().min(0).nullable().optional(),
  maxSumAssured: z.number().min(0).nullable().optional(),
  minSumAssuredMultiple: z.number().min(0).nullable().optional(),
  maxSumAssuredMultiple: z.number().min(0).nullable().optional(),
  minAccountValue: z.number().min(0).nullable().optional(),
  maxAccountValue: z.number().min(0).nullable().optional(),
  rate: z.number().min(0).max(1),
})

export const ilpTemplateBonusSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['power-up', 'loyalty', 'allocation', 'sign-up', 'custom']),
  label: z.string().min(1),
  mode: z.enum(['annual-rate', 'monthly-rate', 'premium-allocation', 'one-time']),
  oneTimePayoutBasis: z.enum(['fixed-amount', 'committed-annual-premium-at-issue', 'initial-single-premium-at-issue', 'step-up-booster-delta']).optional(),
  annualPremiumTierBasis: z.enum([
    'projected-paid-regular-premium-this-year',
    'committed-annual-premium-at-issue',
    'initial-basic-sum-assured-at-issue',
    'initial-basic-sum-assured-multiple-at-issue',
    'initial-single-premium-at-issue',
  ]).optional(),
  appliesTo: z.array(z.string().min(1)).max(20),
  startPolicyYear: z.number().int().min(1).max(100),
  endPolicyYear: z.number().int().min(1).max(100).nullable(),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  cadenceYears: z.number().int().min(1).max(100).optional(),
  requiresPremiumsPaidUpToDate: z.boolean().optional(),
  requiredRegularPremiumPaymentFrequency: z.enum(['annual', 'semi-annual', 'quarterly', 'monthly']).optional(),
  rate: z.number().min(0).max(1).nullable(),
  amount: z.number().min(0).max(100_000_000).nullable(),
  tieredRates: z.array(ilpTemplateBonusTierSchema),
  policyYearRateSchedule: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    rate: z.number().min(0).max(5),
  })).max(25).optional(),
  vitalityStatusRateSchedule: z.array(z.object({
    status: z.enum(['bronze', 'silver', 'gold', 'platinum']),
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    rate: z.number().min(0).max(5),
  })).max(25).optional(),
  stepUpPayoutConfig: z.object({
    premiumShortfallChargeYears: z.number().int().min(1).max(100),
    partialWithdrawalAccountIds: z.array(z.string().min(1)).min(1).max(10),
    countPartialWithdrawalsFromPolicyYear: z.number().int().min(1).max(100),
  }).optional(),
  adjustmentFactorConfig: z.object({
    formula: z.union([
      z.literal('paid-regular-premium-less-partial-withdrawal-over-annualised-premium'),
      z.literal('cumulative-withdrawal-factor-product-over-account-value'),
    ]),
    withdrawalAccountIds: z.array(z.string().min(1)).min(1).max(10),
    countFromPolicyYear: z.number().int().min(1).max(100).optional(),
    includePolicyRepaymentsInPaidRegularPremium: z.boolean().optional(),
    policyRepaymentPriorOffsetRules: z.array(z.object({
      trigger: z.enum(['partial-withdrawal', 'regular-premium-reduction']),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
    })).max(5).optional(),
  }).optional(),
  qualificationRules: z.array(z.union([
    z.object({
      trigger: z.enum(['premium-holiday', 'partial-withdrawal', 'reinvested-dividend-withdrawal', 'regular-premium-reduction', 'scheduled-payout']),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
      disqualifyThroughPolicyYear: z.number().int().min(1).max(100),
    }),
    z.object({
      trigger: z.enum(['premium-holiday', 'partial-withdrawal', 'reinvested-dividend-withdrawal', 'regular-premium-reduction', 'scheduled-payout']),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
      disqualifyInReferenceYear: z.literal(true),
    }),
    z.object({
      trigger: z.enum(['premium-holiday', 'partial-withdrawal', 'reinvested-dividend-withdrawal', 'regular-premium-reduction', 'scheduled-payout']),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
      disqualifyThroughReferenceYear: z.literal(true),
    }),
    z.object({
      trigger: z.literal('partial-withdrawal'),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
      disqualifyWhenCumulativeAmountExceeds: z.literal('annualised-regular-premium-at-issue'),
      countFromPolicyYear: z.number().int().min(1).max(100),
    }),
    z.object({
      trigger: z.enum(['premium-holiday', 'partial-withdrawal', 'reinvested-dividend-withdrawal', 'regular-premium-reduction', 'scheduled-payout']),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
      disqualifyIfAnyFromPolicyYear: z.number().int().min(1).max(100),
    }),
    z.object({
      trigger: z.enum(['premium-holiday', 'partial-withdrawal', 'reinvested-dividend-withdrawal', 'regular-premium-reduction', 'scheduled-payout']),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
      disqualifyIfAnyInLookbackMonths: z.number().int().min(1).max(120),
    }),
    z.object({
      formula: z.literal('policy-year-growth-measure'),
      minimumRatio: z.number().min(0).max(100),
      rounding: z.literal('floor-whole-percent'),
    }),
    z.object({
      formula: z.literal('cumulative-effective-account-value-ratio'),
      maximumRatio: z.number().min(0).max(100),
      includeReinvestedDividendWithdrawals: z.boolean().optional(),
    }),
    z.object({
      formula: z.literal('no-new-premium-arrears-in-lookback-months'),
      lookbackMonths: z.number().int().min(1).max(120),
    }),
  ])).max(5).optional(),
  suspensionRules: z.array(z.object({
    trigger: z.enum(['premium-holiday', 'partial-withdrawal', 'reinvested-dividend-withdrawal', 'regular-premium-reduction', 'scheduled-payout']),
    suspensionMonths: z.number().int().min(1).max(120),
    startOffsetMonths: z.number().int().min(0).max(120).optional(),
    accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
  })).max(5).optional(),
  restorationRules: z.array(z.object({
    trigger: z.enum(['premium-holiday-repayment', 'policy-repayment']),
    basis: z.enum(['repaid-premium-with-missed-months', 'account-value-plus-repaid-premium-with-missed-months', 'repaid-premium']),
  })).max(5).optional(),
  excludedValueRules: z.array(z.object({
    trigger: z.enum(['premium-holiday-repayment', 'policy-repayment', 'top-up', 'recurring-single-premium']),
    basis: z.enum(['repaid-premium', 'event-amount']),
    lookbackMonths: z.number().int().min(1).max(120).optional(),
    netAmountFactor: z.number().min(0).max(1).optional(),
  })).max(5).optional(),
  preservedValueRules: z.array(z.object({
    trigger: z.literal('partial-withdrawal'),
    basis: z.literal('event-amount'),
    accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
    requiresBonusSuspensionWaived: z.boolean().optional(),
  })).max(5).optional(),
  notes: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema),
}).superRefine((bonus, ctx) => {
  if (bonus.oneTimePayoutBasis === 'step-up-booster-delta') {
    if (bonus.stepUpPayoutConfig == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'step-up-booster-delta bonuses require stepUpPayoutConfig',
        path: ['stepUpPayoutConfig'],
      })
    }

    if ((bonus.policyYearRateSchedule?.length ?? 0) === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'step-up-booster-delta bonuses require a non-empty policyYearRateSchedule',
        path: ['policyYearRateSchedule'],
      })
    }

    if (
      bonus.stepUpPayoutConfig != null
      && bonus.stepUpPayoutConfig.countPartialWithdrawalsFromPolicyYear !== (bonus.startPolicyYear + 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'step-up-booster-delta bonuses must start counting partial withdrawals from the first policy year after MIP',
        path: ['stepUpPayoutConfig', 'countPartialWithdrawalsFromPolicyYear'],
      })
    }
  }
})

export const ilpTemplateFeeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  basis: z.enum(['account-value', 'annual-contribution', 'fixed-annual', 'assurance-sum-at-risk', 'insured-amount-at-issue', 'premium-base-mip-multiplier', 'premium-base-mip-multiplier-capped-account-value', 'cumulative-paid-regular-premium', 'initial-single-premium', 'initial-single-premium-base']).optional(),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  requiresPremiumsPaidUpToDate: z.boolean().optional(),
  suspensionRules: z.array(z.object({
    trigger: z.literal('premium-holiday'),
    basis: z.literal('prorate-by-overlap-months'),
  })).max(5).optional(),
  rate: z.number().min(0).max(0.2).nullable(),
  amount: z.number().min(0).max(100_000_000).nullable().optional(),
  assuranceConfig: z.object({
    formula: z.enum([
      'prudential-prosper-death',
      'prudential-prosper-accidental-death',
      'prudential-assure-ii-combined',
      'prudential-linkguard-combined',
      'aia-plp2-plus-death',
      'aia-plp2-max-death',
      'aia-pro-achiever-3-benefit-charge',
      'aia-venture-benefit-charge',
      'hsbc-flexi-choice-death-ti',
      'hsbc-flexi-max-death-ti',
      'great-eastern-wa4-death-ti',
      'great-eastern-gla4-death-ti',
      'great-eastern-pla-death-ti',
      'fwd-invest-flexi-elite-death',
      'fwd-invest-repayment-inclusive-death',
      'income-invest-flex-death-ti',
      'income-legacy-flex-solitaire-death-ti',
      'manulife-investready-iii-death-ti',
      'singlife-savvy-invest-ii-death-ti',
      'manulife-smartretire-death',
      'manulife-smartretire-wop-tpd',
      'manulife-manuinvest-duo-death-ti-tpd',
      'tokio-mpc-net-premium-floor',
      'tokio-mpc-locked-in-policy-value',
      'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium',
      'tokio-mpc-goassure-basic-sum-at-risk',
      'tokio-mpc-goassure-tpd-sum-at-risk',
    ]),
    rateTable: z.enum([
      'tokio-mpc-unzo-death',
      'tokio-goassure-mpc-death',
      'tokio-goassure-mpc-tpd',
    ]).optional(),
    monthlyModalFactor: z.number().min(0).max(1),
    maxAgeNextBirthday: z.number().int().min(1).max(122).optional(),
    policyYearRateMultiplierSchedule: z.array(z.object({
      startPolicyYear: z.number().int().min(1).max(100),
      endPolicyYear: z.number().int().min(1).max(100).nullable(),
      multiplier: z.number().min(0).max(2),
    })).max(20).optional(),
    sumAssuredRateMultiplierTiers: z.array(z.object({
      minSumAssured: z.number().min(0).max(100_000_000),
      maxSumAssured: z.number().min(0).max(100_000_000).nullable(),
      multiplier: z.number().min(0).max(2),
    })).max(20).optional(),
    accrual: z.object({
      startPolicyYear: z.number().int().min(1).max(100),
      endPolicyYear: z.number().int().min(1).max(100),
      settlementPolicyYear: z.number().int().min(1).max(100),
    }).optional(),
    disableFutureChargesOnInsufficientDeduction: z.boolean().optional(),
    tokioProtectionState: z.object({
      mode: z.enum(['locked-in-policy-value', 'locked-in-policy-value-with-adjusted-single-premium']),
      trackedValueAccountIds: z.array(z.string().min(1)).min(1).max(10),
      withdrawalReductionAccountIds: z.array(z.string().min(1)).min(1).max(10),
    }).optional(),
  }).optional(),
  issueAgeRateTiers: z.array(z.object({
    minIssueAgeNextBirthday: z.number().int().min(1).max(120),
    maxIssueAgeNextBirthday: z.number().int().min(1).max(120).nullable(),
    rate: z.number().min(0).max(1),
  })).max(25).optional(),
  premiumBaseConfig: z.object({
    useHigherOfCommencementAndPrevailing: z.boolean(),
    capRate: z.number().min(0).max(1).optional(),
    multiplierYearBasis: z.enum(['policy-year', 'premium-year']).optional(),
    multiplierSchedule: z.array(z.object({
      startPolicyYear: z.number().int().min(1).max(100),
      endPolicyYear: z.number().int().min(1).max(100).nullable(),
      mode: z.enum(['policy-year', 'fixed']),
      multiplier: z.number().min(0).max(100).optional(),
    })).min(1).max(20),
  }).optional(),
  cumulativePaidPremiumConfig: z.object({
    annualisedPremiumAtIssue: z.number().min(0).max(100_000_000).optional(),
    countRateSchedule: z.array(z.object({
      minAnnualisedPremiumsPaid: z.number().int().min(0).max(1_200),
      maxAnnualisedPremiumsPaid: z.number().int().min(0).max(1_200).nullable(),
      rate: z.number().min(0).max(1),
    })).min(1).max(40).optional(),
  }).optional(),
  requiresManualInput: z.boolean().optional(),
  appliesTo: z.array(z.string().min(1)).max(20),
  assuranceValueAppliesTo: z.array(z.string().min(1)).min(1).max(10).optional(),
  fallbackAppliesTo: z.array(z.string().min(1)).max(20).optional(),
  rateSchedule: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    rate: z.number().min(0).max(1),
  })).max(40).optional(),
  amountSchedule: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    amount: z.number().min(0).max(100_000_000),
  })).max(40).optional(),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
  startPolicyYear: z.number().int().min(1).max(100).optional(),
  endPolicyYear: z.number().int().min(1).max(100).nullable().optional(),
  notes: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema),
}).superRefine((rule, ctx) => {
  if (rule.basis !== 'assurance-sum-at-risk' && rule.assuranceValueAppliesTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'assuranceValueAppliesTo can only be used on assurance-sum-at-risk fee rules',
      path: ['assuranceValueAppliesTo'],
    })
  }

  const accrual = rule.assuranceConfig?.accrual
  const tokioProtectionState = rule.assuranceConfig?.tokioProtectionState

  if (
    tokioProtectionState
    && rule.assuranceConfig
    && rule.assuranceConfig.formula !== 'tokio-mpc-locked-in-policy-value'
    && rule.assuranceConfig.formula !== 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'tokioProtectionState can only be used on Tokio locked-in-policy-value assurance formulas',
      path: ['assuranceConfig', 'tokioProtectionState'],
    })
  }

  if (!accrual) return

  if (accrual.endPolicyYear < accrual.startPolicyYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Assurance accrual endPolicyYear must be greater than or equal to startPolicyYear',
      path: ['assuranceConfig', 'accrual', 'endPolicyYear'],
    })
  }

  if (accrual.settlementPolicyYear !== accrual.endPolicyYear + 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Assurance accrual settlementPolicyYear must be exactly one policy year after accrual endPolicyYear',
      path: ['assuranceConfig', 'accrual', 'settlementPolicyYear'],
    })
  }
})

export const ilpTemplateEventChargeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  trigger: z.enum(['partial-withdrawal', 'regular-premium-reduction', 'premium-holiday', 'premium-holiday-repayment', 'top-up', 'recurring-single-premium']),
  basis: z.enum(['event-amount', 'account-value', 'premium-reduction-with-startup-recovery', 'premium-reduction-tiered-startup-recovery', 'repaid-premium-with-missed-months', 'annual-premium-with-overlap-months', 'committed-annual-premium-with-overlap-months', 'premium-holiday-charge-refund', 'source-event-charge-refund', 'event-amount-with-overlap-months', 'annual-reduction-with-active-months', 'fixed-amount-with-overlap-months']),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  appliesTo: z.array(z.string().min(1)).max(20),
  fallbackAppliesTo: z.array(z.string().min(1)).max(20).optional(),
  manualWaiverMode: z.enum(['full-skip', 'capped-free-event']).optional(),
  manualWaiverGrantGroup: z.string().min(1).optional(),
  manualWaiverMaxGrantCount: z.number().int().min(1).max(10).optional(),
  manualWaiverMaxOverlapMonths: z.number().int().min(1).max(120).optional(),
  freeLifetimeMonths: z.number().int().min(1).max(240).optional(),
  freeLifetimeMonthsStartPolicyYear: z.number().int().min(1).max(100).optional(),
  freeLifetimeMonthsSchedule: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    months: z.number().int().min(1).max(240),
  })).max(20).optional(),
  freeLifetimeMonthsResetOnRepayment: z.boolean().optional(),
  freeEventCount: z.number().int().min(1).max(10).optional(),
  freeEventStartPolicyYear: z.number().int().min(1).max(100).optional(),
  freeEventMaxAmountRate: z.number().min(0).max(1).optional(),
  freeEventMaxAmountBasis: z.enum(['open-balance', 'initial-single-premium', 'cumulative-paid-regular-premium']).optional(),
  freeAmountPoolRate: z.number().min(0).max(1).optional(),
  freeAmountPoolBasis: z.enum(['open-balance-at-start-policy-year', 'initial-single-premium']).optional(),
  freeAmountPoolReferencePolicyYear: z.number().int().min(1).max(100).optional(),
  rate: z.number().min(0).max(5).nullable(),
  rateSchedule: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    rate: z.number().min(0).max(5),
  })).max(40).optional(),
  amount: z.number().min(0).max(100_000_000).nullable(),
  sourceChargeRuleId: z.string().min(1).optional(),
  sourceBonusId: z.string().min(1).optional(),
  requiresManualInput: z.boolean().optional(),
  exclusiveGroup: z.string().min(1).optional(),
  groupResolution: z.enum(['max-total-charge']).optional(),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
  allocation: z.enum(['pro-rata-by-value', 'pro-rata-by-contribution-share', 'equal-split']),
  notes: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema),
}).superRefine((rule, ctx) => {
  if (rule.manualWaiverMode === 'capped-free-event' && (rule.trigger !== 'partial-withdrawal' || rule.basis !== 'event-amount')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'manualWaiverMode = capped-free-event can only be used on partial-withdrawal event-amount rules',
      path: ['manualWaiverMode'],
    })
  }

  if (rule.manualWaiverMode === 'capped-free-event' && rule.freeEventCount == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'manualWaiverMode = capped-free-event requires freeEventCount',
      path: ['manualWaiverMode'],
    })
  }

  if (rule.manualWaiverMaxGrantCount != null && !rule.manualWaiverGrantGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'manualWaiverMaxGrantCount requires manualWaiverGrantGroup',
      path: ['manualWaiverMaxGrantCount'],
    })
  }

  if (
    rule.manualWaiverMaxOverlapMonths != null
    && rule.trigger !== 'premium-holiday'
    && rule.trigger !== 'regular-premium-reduction'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'manualWaiverMaxOverlapMonths can only be used on premium-holiday or regular-premium-reduction rules',
      path: ['manualWaiverMaxOverlapMonths'],
    })
  }

  const hasFreeAmountPool = rule.freeAmountPoolRate != null
    || rule.freeAmountPoolBasis != null
    || rule.freeAmountPoolReferencePolicyYear != null

  if (!hasFreeAmountPool) return

  if (rule.freeAmountPoolRate == null || rule.freeAmountPoolBasis == null || rule.freeAmountPoolReferencePolicyYear == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'freeAmountPoolRate, freeAmountPoolBasis, and freeAmountPoolReferencePolicyYear must be authored together',
      path: ['freeAmountPoolRate'],
    })
  }

  if (rule.trigger !== 'partial-withdrawal' || rule.basis !== 'event-amount') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Free amount pools can only be used on partial-withdrawal event-amount rules',
      path: ['trigger'],
    })
  }

  if (rule.freeEventCount != null || rule.freeEventMaxAmountRate != null || rule.freeEventMaxAmountBasis != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Free amount pools cannot be combined with first-N free event settings on the same rule',
      path: ['freeAmountPoolRate'],
    })
  }
})

export const ilpTemplateScheduledPayoutSupportSchema = z.object({
  mode: z.literal('manual-assumption'),
  accountId: z.string().min(1),
  fallbackAccountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
  allowedFrequencies: z.array(z.enum(['annual', 'semi-annual', 'quarterly', 'monthly'])).min(1).max(4).optional(),
  minimumStartPolicyYear: z.number().int().min(1).max(100).optional(),
  requiresTargetRetirementAgeStart: z.boolean().optional(),
  minimumAnnualWithdrawalAmount: z.number().min(1).max(100_000_000).optional(),
  minimumWithdrawalAmountPerOccurrence: z.number().min(1).max(100_000_000).optional(),
  minimumRemainingPolicyValue: z.number().min(1).max(100_000_000).optional(),
  source: z.literal('policy-redemption'),
  payoutStateSupport: z.object({
    defaultState: z.enum(['secure-income', 'target-income']),
    suppressWhileLapsed: z.boolean(),
    stateAfterPremiumHolidayActivation: z.enum(['secure-income', 'target-income']).optional(),
    stateAfterReinstatement: z.enum(['secure-income', 'target-income']).optional(),
  }).optional(),
  notes: z.array(z.string()).min(1),
  sourceRefs: z.array(ilpCatalogSourceRefSchema),
})

export const ilpTemplateDistributionSupportSchema = z.object({
  mode: z.literal('manual-assumption'),
  accountIds: z.array(z.string().min(1)).min(1).max(10),
  minimumAnnualPayoutAmount: z.number().min(0).max(100_000_000).optional(),
  minimumAnnualPayoutCurrency: z.enum(['SGD', 'USD']).optional(),
  recordDateInstructionLeadDays: z.number().int().min(1).max(365).optional(),
  cashPayoutWindows: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    accountIds: z.array(z.string().min(1)).min(1).max(10),
  })).min(1).max(10).optional(),
  defaultMode: z.literal('reinvest'),
  cashPayoutAllowedDuringMip: z.boolean(),
  cashPayoutAllowedAfterMip: z.boolean(),
  source: z.literal('distribution-paying-funds'),
  notes: z.array(z.string()).min(1),
  sourceRefs: z.array(ilpCatalogSourceRefSchema),
})

export const ilpTemplatePolicyStateSupportSchema = z.object({
  automaticLapseOnAccountValueDepletion: z.boolean(),
  minimumRegularPremiumVariationStartPolicyMonth: z.number().int().min(1).max(1200).optional(),
  minimumRegularPremiumAmountByFrequency: z.object({
    annual: z.number().min(0).max(100_000_000).optional(),
    'semi-annual': z.number().min(0).max(100_000_000).optional(),
    quarterly: z.number().min(0).max(100_000_000).optional(),
    monthly: z.number().min(0).max(100_000_000).optional(),
  }).optional(),
  blockRegularPremiumVariationDuringPremiumHoliday: z.boolean().optional(),
  blockTopUpsDuringPremiumHoliday: z.boolean().optional(),
  blockTopUpsWhenPremiumsNotPaidUpToDate: z.boolean().optional(),
  minimumTopUpAmount: z.number().min(0).max(100_000_000).optional(),
  topUpAmountIncrement: z.number().min(0).max(100_000_000).optional(),
  minimumRecurringSinglePremiumMonthlyAmount: z.number().min(0).max(100_000_000).optional(),
  minimumRecurringSinglePremiumStartPolicyMonth: z.number().int().min(1).max(1200).optional(),
  requiresCommencementPremiumForRecurringSinglePremiumResumption: z.boolean().optional(),
  minimumPremiumHolidayStartPolicyMonth: z.number().int().min(1).max(1200).optional(),
  minimumPartialWithdrawalStartPolicyMonthByAccount: z.array(z.object({
    accountId: z.string().min(1),
    startPolicyMonth: z.number().int().min(1).max(1200),
  })).min(1).max(10).optional(),
  minimumPartialWithdrawalAmount: z.number().min(0).max(100_000_000).optional(),
  partialWithdrawalAmountIncrement: z.number().min(0).max(100_000_000).optional(),
  partialWithdrawalMaximumAmountRules: z.array(z.object({
    activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
    accountId: z.string().min(1),
    basis: z.enum([
      'cumulative-paid-regular-premium-less-prior-gross-withdrawals',
      'account-value-less-prior-withdrawals',
    ]),
    startPolicyYear: z.number().int().min(1).max(1200).optional(),
    endPolicyYear: z.number().int().min(1).max(1200).nullable().optional(),
    maximumValueRate: z.number().min(0).max(100),
  })).min(1).max(10).optional(),
  partialWithdrawalMinimumRemainingValueRules: z.array(z.object({
    activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
    basis: z.enum(['account-value', 'policy-value', 'initial-single-premium']),
    accountId: z.string().min(1).optional(),
    minimumValue: z.number().min(0).max(100_000_000).optional(),
    minimumValueRate: z.number().min(0).max(100).optional(),
  })).min(1).max(10).optional(),
  minimumTopUpStartPolicyMonth: z.number().int().min(1).max(1200).optional(),
  topUpRepaymentClearance: z.object({
    includeMissedPremiums: z.boolean().optional(),
    priorOffsetRules: z.array(z.object({
      trigger: z.enum(['partial-withdrawal', 'regular-premium-reduction']),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
    })).min(1).max(5).optional(),
  }).optional(),
}).superRefine((support, ctx) => {
  support.partialWithdrawalMinimumRemainingValueRules?.forEach((rule, index) => {
    if (rule.basis === 'account-value' && !rule.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'account-value withdrawal minimum rules require accountId',
        path: ['partialWithdrawalMinimumRemainingValueRules', index, 'accountId'],
      })
    }

    if (rule.basis === 'policy-value' && rule.accountId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policy-value withdrawal minimum rules must not define accountId',
        path: ['partialWithdrawalMinimumRemainingValueRules', index, 'accountId'],
      })
    }

    if ((rule.basis === 'account-value' || rule.basis === 'policy-value') && rule.minimumValue == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fixed withdrawal minimum rules require minimumValue',
        path: ['partialWithdrawalMinimumRemainingValueRules', index, 'minimumValue'],
      })
    }

    if (rule.basis === 'initial-single-premium') {
      if (!rule.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'initial-single-premium withdrawal minimum rules require accountId',
          path: ['partialWithdrawalMinimumRemainingValueRules', index, 'accountId'],
        })
      }

      if (rule.minimumValueRate == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'initial-single-premium withdrawal minimum rules require minimumValueRate',
          path: ['partialWithdrawalMinimumRemainingValueRules', index, 'minimumValueRate'],
        })
      }
    }
  })
})

export const ilpTemplateVariantSchema = z.object({
  id: z.string().min(1),
  currency: z.enum(['SGD', 'USD']),
  mipBasis: z.enum(['finite', 'open-ended']).optional(),
  mipLength: z.number().int().min(1).max(100).nullable().optional(),
  icpMonths: z.number().int().min(1).max(1_200),
  accounts: z.array(ilpTemplateAccountSchema).min(1).max(10),
  bonuses: z.array(ilpTemplateBonusSchema).max(40),
  feeRules: z.array(ilpTemplateFeeRuleSchema).max(20),
  eventChargeRules: z.array(ilpTemplateEventChargeRuleSchema).max(20),
  policyStateSupport: ilpTemplatePolicyStateSupportSchema.optional(),
  scheduledPayoutSupport: ilpTemplateScheduledPayoutSupportSchema.optional(),
  distributionSupport: ilpTemplateDistributionSupportSchema.optional(),
  eecTable: z.array(z.number().min(0).max(1)).max(100),
  eecYearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  exitChargeBasis: z.enum(['account-value', 'initial-single-premium-base']).optional(),
  warnings: z.array(z.string()),
  unsupportedItems: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema),
}).superRefine((variant, ctx) => {
  const accountIds = new Set(variant.accounts.map((account) => account.id))
  const mipBasis = variant.mipBasis ?? 'finite'

  if (mipBasis === 'finite' && variant.mipLength == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Finite variants must define mipLength',
      path: ['mipLength'],
    })
  }

  if (mipBasis === 'open-ended' && variant.mipLength != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Open-ended variants must not define mipLength',
      path: ['mipLength'],
    })
  }

  if (mipBasis === 'open-ended') {
    variant.accounts.forEach((account, accountIndex) => {
      const hasAfterMipRule = account.contributionRules.some((rule) => rule.phase === 'after-mip')
      if (hasAfterMipRule) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Open-ended variants cannot define after-mip contribution rules',
          path: ['accounts', accountIndex, 'contributionRules'],
        })
      }
    })

    variant.feeRules.forEach((rule, ruleIndex) => {
      if (rule.activeWindow === 'after-mip') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Open-ended variants cannot define after-mip fee rules',
          path: ['feeRules', ruleIndex, 'activeWindow'],
        })
      }
    })

    variant.eventChargeRules.forEach((rule, ruleIndex) => {
      if (rule.activeWindow === 'after-mip') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Open-ended variants cannot define after-mip event charge rules',
          path: ['eventChargeRules', ruleIndex, 'activeWindow'],
        })
      }
    })
  }

  if (variant.scheduledPayoutSupport && !variant.accounts.some((account) => account.id === variant.scheduledPayoutSupport?.accountId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledPayoutSupport.accountId must reference an existing account',
      path: ['scheduledPayoutSupport', 'accountId'],
    })
  }

  variant.scheduledPayoutSupport?.fallbackAccountIds?.forEach((accountId, accountIndex) => {
    if (!variant.accounts.some((account) => account.id === accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scheduledPayoutSupport.fallbackAccountIds must reference existing accounts',
        path: ['scheduledPayoutSupport', 'fallbackAccountIds', accountIndex],
      })
    }
    if (accountId === variant.scheduledPayoutSupport?.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scheduledPayoutSupport.fallbackAccountIds must not repeat the primary account',
        path: ['scheduledPayoutSupport', 'fallbackAccountIds', accountIndex],
      })
    }
  })

  variant.policyStateSupport?.minimumPartialWithdrawalStartPolicyMonthByAccount?.forEach((rule, ruleIndex) => {
    if (!accountIds.has(rule.accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policyStateSupport.minimumPartialWithdrawalStartPolicyMonthByAccount accountId must reference an existing account',
        path: ['policyStateSupport', 'minimumPartialWithdrawalStartPolicyMonthByAccount', ruleIndex, 'accountId'],
      })
    }
  })

  variant.policyStateSupport?.partialWithdrawalMaximumAmountRules?.forEach((rule, ruleIndex) => {
    if (!accountIds.has(rule.accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policyStateSupport.partialWithdrawalMaximumAmountRules accountId must reference an existing account',
        path: ['policyStateSupport', 'partialWithdrawalMaximumAmountRules', ruleIndex, 'accountId'],
      })
    }
  })

  variant.policyStateSupport?.partialWithdrawalMinimumRemainingValueRules?.forEach((rule, ruleIndex) => {
    if (rule.accountId != null && !accountIds.has(rule.accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policyStateSupport.partialWithdrawalMinimumRemainingValueRules accountId must reference an existing account',
        path: ['policyStateSupport', 'partialWithdrawalMinimumRemainingValueRules', ruleIndex, 'accountId'],
      })
    }
  })

  if (variant.distributionSupport) {
    variant.distributionSupport.accountIds.forEach((accountId, accountIndex) => {
      if (!accountIds.has(accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'distributionSupport.accountIds must reference existing accounts',
          path: ['distributionSupport', 'accountIds', accountIndex],
        })
      }
    })

    variant.distributionSupport.cashPayoutWindows?.forEach((window, windowIndex) => {
      if (window.endPolicyYear != null && window.endPolicyYear < window.startPolicyYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'distributionSupport.cashPayoutWindows endPolicyYear must be greater than or equal to startPolicyYear',
          path: ['distributionSupport', 'cashPayoutWindows', windowIndex, 'endPolicyYear'],
        })
      }

      window.accountIds.forEach((accountId, accountIndex) => {
        if (!accountIds.has(accountId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'distributionSupport.cashPayoutWindows accountIds must reference existing accounts',
            path: ['distributionSupport', 'cashPayoutWindows', windowIndex, 'accountIds', accountIndex],
          })
        }

        if (!variant.distributionSupport?.accountIds.includes(accountId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'distributionSupport.cashPayoutWindows accountIds must be included in distributionSupport.accountIds',
            path: ['distributionSupport', 'cashPayoutWindows', windowIndex, 'accountIds', accountIndex],
          })
        }
      })
    })

    if (variant.distributionSupport.cashPayoutWindows) {
      variant.distributionSupport.accountIds.forEach((accountId, accountIndex) => {
        const appearsInWindow = variant.distributionSupport?.cashPayoutWindows?.some((window) => window.accountIds.includes(accountId))
        if (!appearsInWindow) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'distributionSupport.accountIds must be the union of distributionSupport.cashPayoutWindows accountIds when windows are authored',
            path: ['distributionSupport', 'accountIds', accountIndex],
          })
        }
      })

      const windows = variant.distributionSupport.cashPayoutWindows
      for (let leftIndex = 0; leftIndex < windows.length; leftIndex += 1) {
        const leftWindow = windows[leftIndex]
        const leftEnd = leftWindow.endPolicyYear ?? Number.POSITIVE_INFINITY
        for (let rightIndex = leftIndex + 1; rightIndex < windows.length; rightIndex += 1) {
          const rightWindow = windows[rightIndex]
          const rightEnd = rightWindow.endPolicyYear ?? Number.POSITIVE_INFINITY
          const overlaps = leftWindow.startPolicyYear <= rightEnd && rightWindow.startPolicyYear <= leftEnd
          if (overlaps) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'distributionSupport.cashPayoutWindows must not overlap',
              path: ['distributionSupport', 'cashPayoutWindows', rightIndex],
            })
          }
        }
      }
    }
  }

  if (variant.exitChargeBasis === 'initial-single-premium-base' && variant.eecTable.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Variants using initial-single-premium-base exit charges must author an eecTable',
      path: ['eecTable'],
    })
  }

  variant.feeRules.forEach((rule, ruleIndex) => {
    rule.appliesTo.forEach((accountId, accountIndex) => {
      if (!accountIds.has(accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'feeRules appliesTo must reference existing accounts',
          path: ['feeRules', ruleIndex, 'appliesTo', accountIndex],
        })
      }
    })

    rule.assuranceValueAppliesTo?.forEach((accountId, accountIndex) => {
      if (!accountIds.has(accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'feeRules assuranceValueAppliesTo must reference existing accounts',
          path: ['feeRules', ruleIndex, 'assuranceValueAppliesTo', accountIndex],
        })
      }
    })

    rule.assuranceConfig?.tokioProtectionState?.trackedValueAccountIds.forEach((accountId, accountIndex) => {
      if (!accountIds.has(accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'feeRules assuranceConfig.tokioProtectionState trackedValueAccountIds must reference existing accounts',
          path: ['feeRules', ruleIndex, 'assuranceConfig', 'tokioProtectionState', 'trackedValueAccountIds', accountIndex],
        })
      }
    })

    rule.assuranceConfig?.tokioProtectionState?.withdrawalReductionAccountIds.forEach((accountId, accountIndex) => {
      if (!accountIds.has(accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'feeRules assuranceConfig.tokioProtectionState withdrawalReductionAccountIds must reference existing accounts',
          path: ['feeRules', ruleIndex, 'assuranceConfig', 'tokioProtectionState', 'withdrawalReductionAccountIds', accountIndex],
        })
      }
    })

    rule.fallbackAppliesTo?.forEach((accountId, accountIndex) => {
      if (!accountIds.has(accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'feeRules fallbackAppliesTo must reference existing accounts',
          path: ['feeRules', ruleIndex, 'fallbackAppliesTo', accountIndex],
        })
      }
    })

    if (
      mipBasis === 'finite'
      && variant.mipLength != null
      && rule.activeWindow === 'during-mip'
      && rule.assuranceConfig?.accrual
      && rule.assuranceConfig.accrual.settlementPolicyYear > variant.mipLength
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'During-MIP assurance accrual settlementPolicyYear must be within the variant mipLength',
        path: ['feeRules', ruleIndex, 'assuranceConfig', 'accrual', 'settlementPolicyYear'],
      })
    }
  })
})

export const ilpCatalogProductSchema = z.object({
  id: z.string().min(1),
  insurer: z.string().min(1),
  productName: z.string().min(1),
  sourceFileName: z.string().min(1),
  sourceChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceDocumentType: z.enum(['summary', 'brochure']),
  sourceClass: z.enum(['summary', 'brochure-only']),
  supportStatus: z.enum(['supported', 'partial', 'parser-error']),
  structureStatus: z.enum(['structured', 'brochure-partial']),
  economicsStatus: z.enum(['supported', 'partial-modeled-subset', 'metadata-only']),
  modeledEconomics: z.array(z.string().min(1)).max(40),
  coveredElsewhereBehaviors: z.array(z.string().min(1)).max(60).default([]),
  metadataOnlyBehaviors: z.array(z.string().min(1)).max(40),
  warnings: z.array(z.string()),
  archived: z.boolean(),
  variants: z.array(ilpTemplateVariantSchema).max(20),
})

export const ilpCatalogProductsSchema = z.array(ilpCatalogProductSchema)

export const ilpCatalogManifestSchema = z.object({
  catalogVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  parserVersion: z.string().min(1),
  sourceStrategy: z.literal('manual-pdf-corpus'),
  productsCount: z.number().int().min(0),
  supportedCount: z.number().int().min(0),
  partialCount: z.number().int().min(0),
  parserErrorCount: z.number().int().min(0),
  summarySourceCount: z.number().int().min(0),
  brochureOnlySourceCount: z.number().int().min(0),
  brochurePartialEligibleCount: z.number().int().min(0),
})
