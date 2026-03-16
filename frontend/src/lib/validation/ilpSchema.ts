import { z } from 'zod'

const SUM_TOLERANCE = 0.001

export const ilpPolicyEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['premium-holiday', 'partial-withdrawal', 'regular-premium-reduction', 'regular-premium-increase', 'top-up', 'recurring-single-premium', 'recurring-single-premium-resumption', 'assurance-benefit-reduction', 'assurance-benefit-resumption']),
  startPolicyMonth: z.number().int().min(1).max(10_000),
  durationMonths: z.number().int().min(1).max(120),
  amount: z.number().min(0).max(100_000_000).optional(),
  accountId: z.string().min(1).optional(),
  chargeWaived: z.boolean().optional(),
  bonusSuspensionWaived: z.boolean().optional(),
  repayMissedPremiums: z.boolean().optional(),
  repaymentAccountId: z.string().min(1).optional(),
  resultingSumAssured: z.number().min(0).max(100_000_000).optional(),
  resultingWealthAssureValue: z.number().min(0).max(100_000_000).optional(),
}).superRefine((event, ctx) => {
  if (event.type === 'partial-withdrawal' && (event.amount == null || event.amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Partial-withdrawal events must include a positive amount',
      path: ['amount'],
    })
  }

  if (event.type === 'partial-withdrawal' && !event.accountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Partial-withdrawal events must specify the source account',
      path: ['accountId'],
    })
  }

  if (event.type === 'regular-premium-reduction' && (event.amount == null || event.amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Regular-premium-reduction events must include a positive annual reduction amount',
      path: ['amount'],
    })
  }

  if (event.type === 'regular-premium-increase' && (event.amount == null || event.amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Regular-premium-increase events must include a positive annual increase amount',
      path: ['amount'],
    })
  }

  if (event.type === 'top-up' && (event.amount == null || event.amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Top-up events must include a positive amount',
      path: ['amount'],
    })
  }

  if (event.type === 'recurring-single-premium' && (event.amount == null || event.amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recurring-single-premium events must include a positive monthly amount',
      path: ['amount'],
    })
  }

  if (event.type === 'recurring-single-premium-resumption' && event.durationMonths !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recurring-single-premium-resumption events are single-point events and must use durationMonths = 1',
      path: ['durationMonths'],
    })
  }

  if (event.type === 'recurring-single-premium-resumption' && event.amount != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recurring-single-premium-resumption events do not take an amount',
      path: ['amount'],
    })
  }

  if (event.type !== 'premium-holiday' && event.repayMissedPremiums) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Only premium-holiday events can repay missed premiums',
      path: ['repayMissedPremiums'],
    })
  }

  if (event.type !== 'premium-holiday' && event.repaymentAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Only premium-holiday events can specify a repayment account',
      path: ['repaymentAccountId'],
    })
  }

  if (event.type === 'premium-holiday' && event.repayMissedPremiums && !event.repaymentAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-holiday repayment must specify the repayment account',
      path: ['repaymentAccountId'],
    })
  }

  if (event.chargeWaived === true
    && event.type !== 'partial-withdrawal'
    && event.type !== 'premium-holiday'
    && event.type !== 'regular-premium-reduction') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge waiver can only be applied to partial-withdrawal, premium-holiday, or regular-premium-reduction events',
      path: ['chargeWaived'],
    })
  }

  if (event.bonusSuspensionWaived === true
    && event.type !== 'partial-withdrawal'
    && event.type !== 'premium-holiday'
    && event.type !== 'regular-premium-reduction') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bonus-suspension waiver can only be applied to partial-withdrawal, premium-holiday, or regular-premium-reduction events',
      path: ['bonusSuspensionWaived'],
    })
  }

  if ((event.type === 'assurance-benefit-reduction' || event.type === 'assurance-benefit-resumption')
    && event.resultingSumAssured == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Assurance-state events must include the resulting sum assured',
      path: ['resultingSumAssured'],
    })
  }

  if (event.type === 'assurance-benefit-reduction' && event.resultingWealthAssureValue == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Assurance-benefit-reduction events must include the resulting Wealth Assure Value',
      path: ['resultingWealthAssureValue'],
    })
  }

  if ((event.type === 'assurance-benefit-reduction' || event.type === 'assurance-benefit-resumption')
    && event.durationMonths !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Assurance-state events are single-point events and must use durationMonths = 1',
      path: ['durationMonths'],
    })
  }
})

export const ilpScheduledPayoutSupportSchema = z.object({
  mode: z.literal('manual-assumption'),
  accountId: z.string().min(1),
  source: z.literal('policy-redemption'),
})

export const ilpDistributionSupportSchema = z.object({
  mode: z.literal('manual-assumption'),
  accountIds: z.array(z.string().min(1)).min(1).max(10),
  cashPayoutWindows: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    accountIds: z.array(z.string().min(1)).min(1).max(10),
  })).min(1).max(10).optional(),
  defaultMode: z.literal('reinvest'),
  cashPayoutAllowedDuringMip: z.boolean(),
  cashPayoutAllowedAfterMip: z.boolean(),
  source: z.literal('distribution-paying-funds'),
})

export const ilpDistributionAssumptionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('disabled'),
  }),
  z.object({
    mode: z.literal('reinvest'),
    source: z.enum(['catalog-default', 'manual-assumption']),
  }),
  z.object({
    mode: z.literal('cash-payout'),
    source: z.literal('manual-assumption'),
    annualYieldRate: z.number().min(0).max(1),
  }),
])

export const ilpScheduledPayoutAssumptionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('disabled'),
  }),
  z.object({
    mode: z.literal('scheduled-redemption'),
    source: z.literal('manual-assumption'),
    accountId: z.string().min(1),
    startPolicyYear: z.number().int().min(1).max(100),
    durationYears: z.number().int().min(1).max(100),
    annualPayoutAmount: z.number().min(0).max(100_000_000),
  }),
])

export const ilpFundSchema = z.object({
  name: z.string().min(1),
  allocation: z.number().min(0).max(1),
  ocf: z.number().min(0).max(0.1),
  grossReturnLow: z.number().min(-0.5).max(1),
  grossReturnMid: z.number().min(-0.5).max(1),
  grossReturnHigh: z.number().min(-0.5).max(1),
}).refine(
  (fund) => fund.grossReturnLow <= fund.grossReturnMid && fund.grossReturnMid <= fund.grossReturnHigh,
  { message: 'Returns must be ordered: low <= mid <= high' },
)

export const ilpAssuranceProfileSchema = z.object({
  currentAgeNextBirthday: z.number().int().min(1).max(120),
  sex: z.enum(['male', 'female']),
  smokerStatus: z.enum(['smoker', 'non-smoker']),
  currentNetRegularPremiumBase: z.number().min(0).max(100_000_000).optional(),
  currentSumAssured: z.number().min(0).max(100_000_000).optional(),
  currentWealthAssureValue: z.number().min(0).max(100_000_000).optional(),
  currentBasicSumAssured: z.number().min(0).max(100_000_000).optional(),
  currentNetSupplementaryPremiumBase: z.number().min(0).max(100_000_000).optional(),
  currentLockedInPolicyValue: z.number().min(0).max(100_000_000).optional(),
  currentAdjustedSinglePremium: z.number().min(0).max(100_000_000).optional(),
})

export const ilpAccountSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  feeRate: z.number().min(0).max(0.2),
  currentValue: z.number().min(0).max(100_000_000),
  contributionShare: z.number().min(0).max(1),
  subjectToEec: z.boolean(),
  postMipFeeRate: z.number().min(0).max(0.2).nullable(),
  contributionRules: z.array(z.object({
    phase: z.enum(['during-icp', 'after-icp', 'after-mip', 'top-up']),
    contributionShare: z.number().min(0).max(1),
  })).max(4).optional(),
})

export const ilpBonusRuleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['power-up', 'loyalty', 'allocation', 'sign-up', 'custom']),
  label: z.string().min(1),
  mode: z.enum(['annual-rate', 'premium-allocation', 'one-time']),
  rate: z.number().min(0).max(1),
  amount: z.number().min(0).max(100_000_000),
  appliesTo: z.array(z.string()).max(20),
  startPolicyYear: z.number().int().min(1).max(100),
  endPolicyYear: z.number().int().min(1).max(100).nullable(),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  cadenceYears: z.number().int().min(1).max(100).optional(),
  requiresPremiumsPaidUpToDate: z.boolean().optional(),
  tieredRates: z.array(z.object({
    currency: z.enum(['SGD', 'USD']),
    minAnnualPremium: z.number().min(0).nullable(),
    maxAnnualPremium: z.number().min(0).nullable(),
    minAccountValue: z.number().min(0).nullable().optional(),
    maxAccountValue: z.number().min(0).nullable().optional(),
    rate: z.number().min(0).max(1),
  })).max(10).optional(),
  suspensionRules: z.array(z.object({
    trigger: z.enum(['premium-holiday', 'partial-withdrawal', 'regular-premium-reduction']),
    suspensionMonths: z.number().int().min(1).max(120),
  })).max(5).optional(),
  restorationRules: z.array(z.object({
    trigger: z.enum(['premium-holiday-repayment']),
    basis: z.enum(['repaid-premium-with-missed-months', 'account-value-plus-repaid-premium-with-missed-months']),
  })).max(5).optional(),
}).superRefine((bonus, ctx) => {
  if (bonus.endPolicyYear != null && bonus.endPolicyYear < bonus.startPolicyYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endPolicyYear must be greater than or equal to startPolicyYear',
      path: ['endPolicyYear'],
    })
  }
})

export const ilpChargeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  basis: z.enum(['account-value', 'annual-contribution', 'fixed-annual', 'assurance-sum-at-risk', 'premium-base-mip-multiplier', 'cumulative-paid-regular-premium', 'initial-single-premium', 'initial-single-premium-base']),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  requiresPremiumsPaidUpToDate: z.boolean().optional(),
  startPolicyYear: z.number().int().min(1).max(100).optional(),
  endPolicyYear: z.number().int().min(1).max(100).nullable().optional(),
  appliesTo: z.array(z.string().min(1)).min(1).max(10),
  assuranceValueAppliesTo: z.array(z.string().min(1)).min(1).max(10).optional(),
  fallbackAppliesTo: z.array(z.string().min(1)).min(1).max(10).optional(),
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
  rate: z.number().min(0).max(1),
  amount: z.number().min(0).max(100_000_000),
  assuranceConfig: z.object({
    formula: z.enum([
      'prudential-prosper-death',
      'prudential-prosper-accidental-death',
      'prudential-assure-ii-combined',
      'hsbc-flexi-choice-death-ti',
      'hsbc-flexi-max-death-ti',
      'great-eastern-wa4-death-ti',
      'income-invest-flex-death-ti',
      'manulife-investready-iii-death-ti',
      'manulife-manuinvest-duo-death-ti-tpd',
      'tokio-mpc-net-premium-floor',
      'tokio-mpc-locked-in-policy-value',
      'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium',
    ]),
    rateTable: z.enum([
      'tokio-mpc-unzo-death',
    ]).optional(),
    monthlyModalFactor: z.number().min(0).max(1),
    maxAgeNextBirthday: z.number().int().min(1).max(120).optional(),
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
  premiumBaseConfig: z.object({
    useHigherOfCommencementAndPrevailing: z.boolean(),
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
      rate: z.number().min(0).max(5),
    })).max(40).optional(),
  }).optional(),
  requiresManualInput: z.boolean().optional(),
  allocation: z.enum(['pro-rata-by-value', 'pro-rata-by-contribution-share', 'equal-split']),
}).superRefine((rule, ctx) => {
  if (rule.startPolicyYear != null && rule.endPolicyYear != null && rule.endPolicyYear < rule.startPolicyYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge rule endPolicyYear must be greater than or equal to startPolicyYear',
      path: ['endPolicyYear'],
    })
  }

  rule.amountSchedule?.forEach((tier, index) => {
    if (tier.endPolicyYear != null && tier.endPolicyYear < tier.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule amount schedule endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['amountSchedule', index, 'endPolicyYear'],
      })
    }
  })

  rule.rateSchedule?.forEach((tier, index) => {
    if (tier.endPolicyYear != null && tier.endPolicyYear < tier.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule rate schedule endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['rateSchedule', index, 'endPolicyYear'],
      })
    }
  })

  if ((rule.rateSchedule?.length ?? 0) > 0 && !(rule.basis === 'account-value' || rule.basis === 'annual-contribution' || rule.basis === 'cumulative-paid-regular-premium' || rule.basis === 'premium-base-mip-multiplier' || rule.basis === 'initial-single-premium-base')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge rule rate schedules can only be used with account-value, annual-contribution, cumulative-paid-regular-premium, premium-base-mip-multiplier, or initial-single-premium-base basis',
      path: ['rateSchedule'],
    })
  }

  if ((rule.amountSchedule?.length ?? 0) > 0 && rule.basis !== 'fixed-annual') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge rule amount schedules can only be used with fixed-annual basis',
      path: ['amountSchedule'],
    })
  }

  if (rule.basis === 'assurance-sum-at-risk' && !rule.assuranceConfig) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Assurance charge rules must include an assurance configuration',
      path: ['assuranceConfig'],
    })
  }

  if (rule.basis !== 'assurance-sum-at-risk' && rule.assuranceConfig) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Assurance configuration can only be used on assurance-sum-at-risk charge rules',
      path: ['assuranceConfig'],
    })
  }

  if (rule.basis !== 'assurance-sum-at-risk' && rule.assuranceValueAppliesTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'assuranceValueAppliesTo can only be used on assurance-sum-at-risk charge rules',
      path: ['assuranceValueAppliesTo'],
    })
  }

  if (
    rule.assuranceConfig?.tokioProtectionState
    && rule.assuranceConfig.formula !== 'tokio-mpc-locked-in-policy-value'
    && rule.assuranceConfig.formula !== 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'tokioProtectionState can only be used on Tokio locked-in-policy-value assurance formulas',
      path: ['assuranceConfig', 'tokioProtectionState'],
    })
  }

  rule.premiumBaseConfig?.multiplierSchedule.forEach((tier, index) => {
    if (tier.endPolicyYear != null && tier.endPolicyYear < tier.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Premium-base multiplier schedule endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['premiumBaseConfig', 'multiplierSchedule', index, 'endPolicyYear'],
      })
    }

    if (tier.mode === 'fixed' && tier.multiplier == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fixed premium-base multiplier tiers must include a multiplier value',
        path: ['premiumBaseConfig', 'multiplierSchedule', index, 'multiplier'],
      })
    }

    if (tier.mode === 'policy-year' && tier.multiplier != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Policy-year premium-base multiplier tiers cannot include an explicit multiplier value',
        path: ['premiumBaseConfig', 'multiplierSchedule', index, 'multiplier'],
      })
    }
  })

  if (rule.basis === 'premium-base-mip-multiplier' && !rule.premiumBaseConfig) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-base charge rules must include a premium-base configuration',
      path: ['premiumBaseConfig'],
    })
  }

  if (rule.basis !== 'premium-base-mip-multiplier' && rule.premiumBaseConfig) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-base configuration can only be used on premium-base-mip-multiplier charge rules',
      path: ['premiumBaseConfig'],
    })
  }

  rule.cumulativePaidPremiumConfig?.countRateSchedule?.forEach((tier, index, tiers) => {
    if (tier.maxAnnualisedPremiumsPaid != null && tier.maxAnnualisedPremiumsPaid < tier.minAnnualisedPremiumsPaid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cumulative-paid premium count tier maxAnnualisedPremiumsPaid must be greater than or equal to minAnnualisedPremiumsPaid',
        path: ['cumulativePaidPremiumConfig', 'countRateSchedule', index, 'maxAnnualisedPremiumsPaid'],
      })
    }

    if (index > 0) {
      const previous = tiers[index - 1]
      const previousMaximum = previous.maxAnnualisedPremiumsPaid ?? previous.minAnnualisedPremiumsPaid
      const expectedNextMinimum = previousMaximum + 1
      if (tier.minAnnualisedPremiumsPaid <= previousMaximum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cumulative-paid premium count tiers must be strictly ordered with no overlaps',
          path: ['cumulativePaidPremiumConfig', 'countRateSchedule', index, 'minAnnualisedPremiumsPaid'],
        })
      }
      if (tier.minAnnualisedPremiumsPaid > expectedNextMinimum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cumulative-paid premium count tiers must not skip annualised-premium counts',
          path: ['cumulativePaidPremiumConfig', 'countRateSchedule', index, 'minAnnualisedPremiumsPaid'],
        })
      }
    }
  })

  if (rule.basis === 'cumulative-paid-regular-premium' && rule.cumulativePaidPremiumConfig?.annualisedPremiumAtIssue != null && rule.cumulativePaidPremiumConfig.annualisedPremiumAtIssue <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cumulative-paid premium charge rules must use a positive annualised premium at issue when overridden',
      path: ['cumulativePaidPremiumConfig', 'annualisedPremiumAtIssue'],
    })
  }

  if (rule.basis !== 'cumulative-paid-regular-premium' && rule.cumulativePaidPremiumConfig) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cumulative-paid premium configuration can only be used on cumulative-paid-regular-premium charge rules',
      path: ['cumulativePaidPremiumConfig'],
    })
  }

  if (
    rule.assuranceConfig
    && (
      rule.assuranceConfig.formula === 'tokio-mpc-net-premium-floor'
      || rule.assuranceConfig.formula === 'tokio-mpc-locked-in-policy-value'
      || rule.assuranceConfig.formula === 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
    )
    && !rule.assuranceConfig.rateTable
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tokio MPC assurance rules must declare a rateTable',
      path: ['assuranceConfig', 'rateTable'],
    })
  }

  if (rule.assuranceConfig?.accrual) {
    if (
      rule.assuranceConfig.formula !== 'tokio-mpc-net-premium-floor'
      && rule.assuranceConfig.formula !== 'tokio-mpc-locked-in-policy-value'
      && rule.assuranceConfig.formula !== 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assurance accrual is only supported for Tokio MPC assurance rules',
        path: ['assuranceConfig', 'accrual'],
      })
    }

    const { startPolicyYear, endPolicyYear, settlementPolicyYear } = rule.assuranceConfig.accrual

    if (endPolicyYear < startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assurance accrual endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['assuranceConfig', 'accrual', 'endPolicyYear'],
      })
    }

    if (settlementPolicyYear !== endPolicyYear + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assurance accrual settlementPolicyYear must be exactly one policy year after accrual endPolicyYear',
        path: ['assuranceConfig', 'accrual', 'settlementPolicyYear'],
      })
    }
  }
})

export const ilpEventChargeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  trigger: z.enum(['partial-withdrawal', 'regular-premium-reduction', 'premium-holiday', 'premium-holiday-repayment', 'top-up', 'recurring-single-premium']),
  basis: z.enum(['event-amount', 'account-value', 'premium-reduction-with-startup-recovery', 'premium-reduction-tiered-startup-recovery', 'repaid-premium-with-missed-months', 'annual-premium-with-overlap-months', 'committed-annual-premium-with-overlap-months', 'premium-holiday-charge-refund', 'event-amount-with-overlap-months', 'annual-reduction-with-active-months']),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']).optional(),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  appliesTo: z.array(z.string().min(1)).min(1).max(10),
  fallbackAppliesTo: z.array(z.string().min(1)).min(1).max(10).optional(),
  freeLifetimeMonths: z.number().int().min(1).max(240).optional(),
  freeEventCount: z.number().int().min(1).max(10).optional(),
  freeEventStartPolicyYear: z.number().int().min(1).max(100).optional(),
  freeEventMaxAmountRate: z.number().min(0).max(1).optional(),
  rate: z.number().min(0).max(5),
  rateSchedule: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    rate: z.number().min(0).max(5),
  })).max(40).optional(),
  amount: z.number().min(0).max(100_000_000),
  sourceChargeRuleId: z.string().min(1).optional(),
  sourceBonusId: z.string().min(1).optional(),
  requiresManualInput: z.boolean().optional(),
  exclusiveGroup: z.string().min(1).optional(),
  groupResolution: z.enum(['max-total-charge']).optional(),
  allocation: z.enum(['pro-rata-by-value', 'pro-rata-by-contribution-share', 'equal-split']),
}).superRefine((rule, ctx) => {
  rule.rateSchedule?.forEach((tier, index) => {
    if (tier.endPolicyYear != null && tier.endPolicyYear < tier.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Event charge rate schedule endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['rateSchedule', index, 'endPolicyYear'],
      })
    }
  })

  if (rule.trigger === 'premium-holiday'
    && rule.basis !== 'annual-premium-with-overlap-months'
    && rule.basis !== 'committed-annual-premium-with-overlap-months') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-holiday event charges must use annual-premium-with-overlap-months or committed-annual-premium-with-overlap-months basis',
      path: ['basis'],
    })
  }

  if (rule.freeLifetimeMonths != null && rule.trigger !== 'premium-holiday') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'freeLifetimeMonths can only be used on premium-holiday event charge rules',
      path: ['freeLifetimeMonths'],
    })
  }

  if (rule.basis === 'premium-holiday-charge-refund' && rule.trigger !== 'premium-holiday-repayment') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-holiday charge refund rules must trigger on premium-holiday-repayment',
      path: ['trigger'],
    })
  }

  if (rule.basis === 'premium-holiday-charge-refund' && !rule.sourceChargeRuleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-holiday charge refund rules must reference a source holiday charge rule',
      path: ['sourceChargeRuleId'],
    })
  }

  if (rule.basis === 'event-amount-with-overlap-months' && rule.trigger !== 'recurring-single-premium') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event-amount-with-overlap-months rules must trigger on recurring-single-premium',
      path: ['trigger'],
    })
  }

  if (rule.basis === 'annual-reduction-with-active-months' && rule.trigger !== 'regular-premium-reduction') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Annual-reduction-with-active-months rules must trigger on regular-premium-reduction',
      path: ['trigger'],
    })
  }

  if (rule.groupResolution && !rule.exclusiveGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event charge groupResolution requires an exclusiveGroup',
      path: ['exclusiveGroup'],
    })
  }

  if ((rule.freeEventCount != null || rule.freeEventStartPolicyYear != null || rule.freeEventMaxAmountRate != null)
    && !(rule.trigger === 'partial-withdrawal' && rule.basis === 'event-amount')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Free-event withdrawal settings can only be used on partial-withdrawal event-amount rules',
      path: ['freeEventCount'],
    })
  }

  if (rule.basis === 'premium-reduction-tiered-startup-recovery' && rule.trigger !== 'regular-premium-reduction') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tiered startup-recovery rules must trigger on regular-premium-reduction',
      path: ['trigger'],
    })
  }

  if (rule.basis === 'premium-reduction-tiered-startup-recovery' && !rule.sourceBonusId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tiered startup-recovery rules must reference a startup bonus rule ID',
      path: ['sourceBonusId'],
    })
  }
})

export const ilpPolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  insurer: z.string().max(100),
  currency: z.enum(['SGD', 'USD']),
  monthlyContribution: z.number().min(0).max(100_000),
  initialSinglePremium: z.number().min(0).max(100_000_000).optional(),
  monthsAlreadyPaid: z.number().int().min(0).max(1_200),
  currentPolicyYear: z.number().int().min(1).max(100),
  icpMonths: z.number().int().min(0).max(1_200).optional(),
  mipBasis: z.enum(['finite', 'open-ended']).optional(),
  assuranceProfile: ilpAssuranceProfileSchema.optional(),
  scheduledPayoutSupport: ilpScheduledPayoutSupportSchema.optional(),
  scheduledPayoutAssumption: ilpScheduledPayoutAssumptionSchema.optional(),
  distributionSupport: ilpDistributionSupportSchema.optional(),
  distributionAssumption: ilpDistributionAssumptionSchema.optional(),
  policyEvents: z.array(ilpPolicyEventSchema).max(20).optional(),
  accounts: z.array(ilpAccountSchema).min(1).max(10),
  mipLength: z.number().int().min(5).max(100).nullable().optional(),
  postMipYears: z.number().int().min(0).max(50),
  eecTable: z.array(z.number().min(0).max(1)).max(100),
  eecYearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  exitChargeBasis: z.enum(['account-value', 'initial-single-premium-base']).optional(),
  funds: z.array(ilpFundSchema).min(1).max(20),
  bonuses: z.array(ilpBonusRuleSchema).max(20),
  chargeRules: z.array(ilpChargeRuleSchema).max(30).optional(),
  eventChargeRules: z.array(ilpEventChargeRuleSchema).max(20).optional(),
  catalogSource: z.object({
    productId: z.string().min(1),
    productName: z.string().min(1),
    variantId: z.string().min(1),
    variantLabel: z.string().min(1),
    catalogVersion: z.string().min(1),
    supportStatus: z.enum(['supported', 'partial', 'parser-error']),
    economicsStatus: z.enum(['supported', 'partial-modeled-subset', 'metadata-only']),
    structureStatus: z.enum(['structured', 'brochure-partial']),
    modeledEconomics: z.array(z.string().min(1)).max(40),
    metadataOnlyBehaviors: z.array(z.string().min(1)).max(40),
  }).optional(),
  catalogWarnings: z.array(z.string().min(1)).max(20).optional(),
  discountRate: z.number().min(0).max(0.3),
  inflationRate: z.number().min(0).max(0.15),
  alternativeReturn: z.number().min(-0.1).max(0.3),
}).superRefine((policy, ctx) => {
  const fundAllocationSum = policy.funds.reduce((sum, fund) => sum + fund.allocation, 0)
  const mipBasis = policy.mipBasis ?? 'finite'

  if (Math.abs(fundAllocationSum - 1) > SUM_TOLERANCE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Fund allocations must sum to 100%',
      path: ['funds'],
    })
  }

  if (mipBasis === 'finite' && policy.mipLength == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Finite policies must define mipLength',
      path: ['mipLength'],
    })
  }

  if (mipBasis === 'open-ended' && policy.mipLength != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Open-ended policies must not define mipLength',
      path: ['mipLength'],
    })
  }

  if (mipBasis === 'finite' && policy.mipLength != null && policy.currentPolicyYear >= policy.mipLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current policy year must be less than MIP length. Mature policies are not supported in V1.',
      path: ['currentPolicyYear'],
    })
  }

  if (mipBasis === 'open-ended' && policy.postMipYears < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Open-ended policies must define a positive review horizon in postMipYears',
      path: ['postMipYears'],
    })
  }

  const accountIds = policy.accounts.map((account) => account.id)
  if (new Set(accountIds).size !== accountIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Account IDs must be unique within a policy',
      path: ['accounts'],
    })
  }

  const eventIds = policy.policyEvents?.map((event) => event.id) ?? []
  if (new Set(eventIds).size !== eventIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Policy event IDs must be unique within a policy',
      path: ['policyEvents'],
    })
  }

  policy.accounts.forEach((account, index) => {
    const phases = account.contributionRules?.map((rule) => rule.phase) ?? []
    if (new Set(phases).size !== phases.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each account can only define one contribution rule per phase',
        path: ['accounts', index, 'contributionRules'],
      })
    }
  })

  const contributionShareSum = policy.accounts.reduce((sum, account) => sum + account.contributionShare, 0)
  const hasContributionRules = policy.accounts.some((account) => (account.contributionRules?.length ?? 0) > 0)
  const hasInitialSinglePremiumContributionRules = policy.accounts.some((account) => (
    account.contributionRules?.some((rule) => rule.phase === 'during-icp' && rule.contributionShare > 0)
  ))
  const supportsInitialSinglePremiumRouting = (policy.initialSinglePremium ?? 0) > 0 || (
    policy.chargeRules?.some((rule) => (
      rule.basis === 'initial-single-premium'
      || rule.basis === 'initial-single-premium-base'
    )) ?? false
  ) || policy.exitChargeBasis === 'initial-single-premium-base'
    || hasInitialSinglePremiumContributionRules
  if (policy.monthlyContribution > 0) {
    if (!hasContributionRules && Math.abs(contributionShareSum - 1) > SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'If monthlyContribution > 0, account contributionShares must sum to 1.0',
        path: ['accounts'],
      })
    }
  } else if (!hasContributionRules) {
    const expectedContributionShareSum = supportsInitialSinglePremiumRouting ? 1 : 0
    if (Math.abs(contributionShareSum - expectedContributionShareSum) > SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: supportsInitialSinglePremiumRouting
          ? 'If monthlyContribution = 0 with initial-single-premium routing, account contributionShares must sum to 1.0'
          : 'If monthlyContribution = 0, account contributionShares must sum to 0',
        path: ['accounts'],
      })
    }
  }

  if (hasContributionRules) {
    for (const phase of ['during-icp', 'after-icp'] as const) {
      const phaseShareSum = policy.accounts.reduce(
        (sum, account) => sum + (
          account.contributionRules?.find((rule) => rule.phase === phase)?.contributionShare
          ?? account.contributionShare
        ),
        0,
      )

      if (policy.monthlyContribution > 0 && Math.abs(phaseShareSum - 1) > SUM_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `If monthlyContribution > 0, ${phase} contributionRules must sum to 1.0`,
          path: ['accounts'],
        })
      }

      if (policy.monthlyContribution === 0) {
        const expectedPhaseShareSum = phase === 'during-icp' && supportsInitialSinglePremiumRouting ? 1 : 0
        if (Math.abs(phaseShareSum - expectedPhaseShareSum) > SUM_TOLERANCE) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: expectedPhaseShareSum === 1
              ? 'If monthlyContribution = 0 with initial-single-premium routing, during-icp contributionRules must sum to 1.0'
              : `If monthlyContribution = 0, ${phase} contributionRules must sum to 0`,
            path: ['accounts'],
          })
        }
      }
    }

    const hasAfterMipRules = policy.accounts.some((account) => (
      account.contributionRules?.some((rule) => rule.phase === 'after-mip')
    ))

    if (mipBasis === 'open-ended' && hasAfterMipRules) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Open-ended policies cannot define after-mip contributionRules',
        path: ['accounts'],
      })
    }

    if (hasAfterMipRules) {
      const afterMipShareSum = policy.accounts.reduce(
        (sum, account) => sum + (
          account.contributionRules?.find((rule) => rule.phase === 'after-mip')?.contributionShare
          ?? 0
        ),
        0,
      )

      if (policy.monthlyContribution > 0 && Math.abs(afterMipShareSum - 1) > SUM_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'If monthlyContribution > 0, after-mip contributionRules must sum to 1.0 when defined',
          path: ['accounts'],
        })
      }

      if (policy.monthlyContribution === 0 && Math.abs(afterMipShareSum) > SUM_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'If monthlyContribution = 0, after-mip contributionRules must sum to 0 when defined',
          path: ['accounts'],
        })
      }
    }

    const hasTopUpRules = policy.accounts.some((account) => (
      account.contributionRules?.some((rule) => rule.phase === 'top-up')
    ))

    if (hasTopUpRules) {
      const topUpShareSum = policy.accounts.reduce(
        (sum, account) => sum + (
          account.contributionRules?.find((rule) => rule.phase === 'top-up')?.contributionShare
          ?? 0
        ),
        0,
      )

      if (Math.abs(topUpShareSum - 1) > SUM_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Top-up contributionRules must sum to 1.0 when defined',
          path: ['accounts'],
        })
      }
    }
  }

  const validAccountIds = new Set(accountIds)
  policy.policyEvents?.forEach((event, index) => {
    if (event.accountId && !validAccountIds.has(event.accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Policy event accountId must reference a valid account ID',
        path: ['policyEvents', index, 'accountId'],
      })
    }

    if (event.repaymentAccountId && !validAccountIds.has(event.repaymentAccountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Policy event repaymentAccountId must reference a valid account ID',
        path: ['policyEvents', index, 'repaymentAccountId'],
      })
    }

    if ((event.type === 'top-up' || event.type === 'recurring-single-premium') && !event.accountId) {
      const hasTopUpRouting = policy.accounts.some((account) => (
        account.contributionRules?.some((rule) => rule.phase === 'top-up')
      ))

      if (!hasTopUpRouting) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${event.type === 'top-up' ? 'Top-up' : 'Recurring-single-premium'} events must specify a target account or the policy must define top-up contributionRules`,
          path: ['policyEvents', index, 'accountId'],
        })
      }
    }
  })

  policy.bonuses.forEach((bonus, index) => {
    if (bonus.appliesTo.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bonus appliesTo must reference valid account IDs',
        path: ['bonuses', index, 'appliesTo'],
      })
    }

    if (bonus.tieredRates && bonus.tieredRates.length > 0 && bonus.mode === 'one-time') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'One-time bonuses cannot use tiered rates',
        path: ['bonuses', index, 'tieredRates'],
      })
    }
  })

  policy.chargeRules?.forEach((rule, index) => {
    if (mipBasis === 'open-ended' && rule.activeWindow === 'after-mip') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Open-ended policies cannot define after-mip charge rules',
        path: ['chargeRules', index, 'activeWindow'],
      })
    }

    if (rule.appliesTo.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule appliesTo must reference valid account IDs',
        path: ['chargeRules', index, 'appliesTo'],
      })
    }

    if (rule.assuranceValueAppliesTo?.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule assuranceValueAppliesTo must reference valid account IDs',
        path: ['chargeRules', index, 'assuranceValueAppliesTo'],
      })
    }

    if (rule.assuranceConfig?.tokioProtectionState?.trackedValueAccountIds.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule tokioProtectionState trackedValueAccountIds must reference valid account IDs',
        path: ['chargeRules', index, 'assuranceConfig', 'tokioProtectionState', 'trackedValueAccountIds'],
      })
    }

    if (rule.assuranceConfig?.tokioProtectionState?.withdrawalReductionAccountIds.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule tokioProtectionState withdrawalReductionAccountIds must reference valid account IDs',
        path: ['chargeRules', index, 'assuranceConfig', 'tokioProtectionState', 'withdrawalReductionAccountIds'],
      })
    }

    if (rule.fallbackAppliesTo?.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule fallbackAppliesTo must reference valid account IDs',
        path: ['chargeRules', index, 'fallbackAppliesTo'],
      })
    }

    if (
      mipBasis === 'finite'
      && policy.mipLength != null
      && rule.activeWindow === 'during-mip'
      && rule.assuranceConfig?.accrual
      && rule.assuranceConfig.accrual.settlementPolicyYear > policy.mipLength
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'During-MIP assurance accrual settlementPolicyYear must be within the policy mipLength',
        path: ['chargeRules', index, 'assuranceConfig', 'accrual', 'settlementPolicyYear'],
      })
    }

    if (
      rule.assuranceConfig?.accrual
      && (policy.currentPolicyYear > 1 || policy.monthsAlreadyPaid > 0)
      && policy.currentPolicyYear < rule.assuranceConfig.accrual.settlementPolicyYear
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Accrued assurance rules currently require inception-state inputs; mid-policy entry before settlement is not supported',
        path: ['currentPolicyYear'],
      })
    }
  })

  policy.eventChargeRules?.forEach((rule, index) => {
    if (mipBasis === 'open-ended' && rule.activeWindow === 'after-mip') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Open-ended policies cannot define after-mip event charge rules',
        path: ['eventChargeRules', index, 'activeWindow'],
      })
    }

    if (rule.appliesTo.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Event charge rule appliesTo must reference valid account IDs',
        path: ['eventChargeRules', index, 'appliesTo'],
      })
    }

    if (rule.fallbackAppliesTo?.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Event charge rule fallbackAppliesTo must reference valid account IDs',
        path: ['eventChargeRules', index, 'fallbackAppliesTo'],
      })
    }

    if (rule.sourceChargeRuleId) {
      const sourceRule = policy.eventChargeRules?.find((candidate) => candidate.id === rule.sourceChargeRuleId)
      if (!sourceRule) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Event charge rule sourceChargeRuleId must reference another valid event charge rule ID',
          path: ['eventChargeRules', index, 'sourceChargeRuleId'],
        })
      }
    }

    if (rule.sourceBonusId) {
      const sourceBonus = policy.bonuses.find((candidate) => candidate.id === rule.sourceBonusId)
      if (!sourceBonus) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Event charge rule sourceBonusId must reference a valid bonus rule ID',
          path: ['eventChargeRules', index, 'sourceBonusId'],
        })
      }
    }
  })

  if (mipBasis === 'finite' && policy.mipLength != null && policy.eecTable.length > 0 && policy.eecTable.length < policy.mipLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'EEC table must have at least mipLength entries',
      path: ['eecTable'],
    })
  }

  if (policy.exitChargeBasis === 'initial-single-premium-base' && policy.eecTable.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Policies using initial-single-premium-base exit charges must define an eecTable',
      path: ['eecTable'],
    })
  }

  if (policy.scheduledPayoutSupport && !accountIds.includes(policy.scheduledPayoutSupport.accountId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledPayoutSupport.accountId must reference an existing account',
      path: ['scheduledPayoutSupport', 'accountId'],
    })
  }

  policy.distributionSupport?.accountIds.forEach((accountId, accountIndex) => {
    if (!accountIds.includes(accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'distributionSupport.accountIds must reference existing accounts',
        path: ['distributionSupport', 'accountIds', accountIndex],
      })
    }
  })

  policy.distributionSupport?.cashPayoutWindows?.forEach((window, windowIndex) => {
    if (window.endPolicyYear != null && window.endPolicyYear < window.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'distributionSupport.cashPayoutWindows endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['distributionSupport', 'cashPayoutWindows', windowIndex, 'endPolicyYear'],
      })
    }

    window.accountIds.forEach((accountId, accountIndex) => {
      if (!accountIds.includes(accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'distributionSupport.cashPayoutWindows accountIds must reference existing accounts',
          path: ['distributionSupport', 'cashPayoutWindows', windowIndex, 'accountIds', accountIndex],
        })
      }

      if (!policy.distributionSupport?.accountIds.includes(accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'distributionSupport.cashPayoutWindows accountIds must be included in distributionSupport.accountIds',
          path: ['distributionSupport', 'cashPayoutWindows', windowIndex, 'accountIds', accountIndex],
        })
      }
    })
  })

  if (policy.distributionSupport?.cashPayoutWindows) {
    policy.distributionSupport.accountIds.forEach((accountId, accountIndex) => {
      const appearsInWindow = policy.distributionSupport?.cashPayoutWindows?.some((window) => window.accountIds.includes(accountId))
      if (!appearsInWindow) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'distributionSupport.accountIds must be the union of distributionSupport.cashPayoutWindows accountIds when windows are authored',
          path: ['distributionSupport', 'accountIds', accountIndex],
        })
      }
    })

    const windows = policy.distributionSupport.cashPayoutWindows
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

  if (policy.distributionAssumption && !policy.distributionSupport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'distributionAssumption requires distributionSupport',
      path: ['distributionAssumption'],
    })
  }

  if (
    policy.distributionAssumption?.mode === 'cash-payout'
    && policy.distributionSupport
    && !(
      policy.distributionSupport.cashPayoutWindows?.length
      || policy.distributionSupport.cashPayoutAllowedDuringMip
      || policy.distributionSupport.cashPayoutAllowedAfterMip
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cash-payout distribution assumptions require at least one payout-eligible phase',
      path: ['distributionAssumption', 'mode'],
    })
  }

  if (
    policy.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && !accountIds.includes(policy.scheduledPayoutAssumption.accountId)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledPayoutAssumption.accountId must reference an existing account',
      path: ['scheduledPayoutAssumption', 'accountId'],
    })
  }

  if (policy.scheduledPayoutAssumption && !policy.scheduledPayoutSupport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledPayoutAssumption requires scheduledPayoutSupport',
      path: ['scheduledPayoutAssumption'],
    })
  }

  if (
    policy.scheduledPayoutSupport
    && policy.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && policy.scheduledPayoutSupport.accountId !== policy.scheduledPayoutAssumption.accountId
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledPayoutAssumption.accountId must match scheduledPayoutSupport.accountId',
      path: ['scheduledPayoutAssumption', 'accountId'],
    })
  }
})

export const ilpPoliciesSchema = z.array(ilpPolicySchema)
