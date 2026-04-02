import { z } from 'zod'

const SUM_TOLERANCE = 0.001
const ilpRegularPremiumPaymentFrequencySchema = z.enum(['annual', 'semi-annual', 'quarterly', 'monthly'])
export const ilpVitalityStatusSchema = z.enum(['bronze', 'silver', 'gold', 'platinum'])

export const ilpPolicyEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['premium-holiday', 'partial-withdrawal', 'reinvested-dividend-withdrawal', 'regular-premium-reduction', 'regular-premium-increase', 'policy-repayment', 'top-up', 'recurring-single-premium', 'recurring-single-premium-resumption', 'assurance-benefit-reduction', 'assurance-benefit-resumption', 'lapse']),
  startPolicyMonth: z.number().int().min(1).max(10_000),
  durationMonths: z.number().int().min(1).max(120),
  amount: z.number().min(0).max(100_000_000).optional(),
  accountId: z.string().min(1).optional(),
  fundName: z.string().min(1).optional(),
  chargeWaived: z.boolean().optional(),
  chargeWaiverGrantId: z.string().min(1).optional(),
  chargeRefunded: z.boolean().optional(),
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

  if (event.type === 'reinvested-dividend-withdrawal' && (event.amount == null || event.amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reinvested-dividend-withdrawal events must include a positive amount',
      path: ['amount'],
    })
  }

  if (event.type === 'reinvested-dividend-withdrawal' && !event.accountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reinvested-dividend-withdrawal events must specify the source account',
      path: ['accountId'],
    })
  }

  if (event.type === 'reinvested-dividend-withdrawal' && event.durationMonths !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reinvested-dividend-withdrawal events are single-point events and must use durationMonths = 1',
      path: ['durationMonths'],
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

  if (event.type === 'policy-repayment' && (event.amount == null || event.amount <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Policy-repayment events must include a positive amount',
      path: ['amount'],
    })
  }

  if (event.type === 'policy-repayment' && !event.accountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Policy-repayment events must specify the target account',
      path: ['accountId'],
    })
  }

  if (event.type === 'policy-repayment' && event.durationMonths !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Policy-repayment events are single-point events and must use durationMonths = 1',
      path: ['durationMonths'],
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

  if (event.chargeWaiverGrantId && event.chargeWaived !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge waiver grant id can only be used on charge-waived events',
      path: ['chargeWaiverGrantId'],
    })
  }

  if (event.chargeRefunded === true
    && event.type !== 'partial-withdrawal'
    && event.type !== 'premium-holiday'
    && event.type !== 'regular-premium-reduction') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge refund can only be applied to partial-withdrawal, premium-holiday, or regular-premium-reduction events',
      path: ['chargeRefunded'],
    })
  }

  if (event.chargeWaived === true && event.chargeRefunded === true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'An event cannot be both charge-waived and charge-refunded',
      path: ['chargeRefunded'],
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

  if (event.type === 'lapse' && event.amount != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lapse events do not take an amount',
      path: ['amount'],
    })
  }

  if (event.type === 'lapse' && event.accountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lapse events are policy-level and must not specify an accountId',
      path: ['accountId'],
    })
  }

  if (event.type === 'lapse' && event.repaymentAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lapse events must not specify a repayment account',
      path: ['repaymentAccountId'],
    })
  }

  if (event.type === 'lapse' && event.repayMissedPremiums) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lapse events must not enable missed-premium repayment',
      path: ['repayMissedPremiums'],
    })
  }
})

export const ilpScheduledPayoutStateSchema = z.enum(['secure-income', 'target-income'])

export const ilpScheduledPayoutStateSupportSchema = z.object({
  defaultState: ilpScheduledPayoutStateSchema,
  suppressWhileLapsed: z.boolean(),
  stateAfterPremiumHolidayActivation: ilpScheduledPayoutStateSchema.optional(),
  stateAfterReinstatement: ilpScheduledPayoutStateSchema.optional(),
})

export const ilpPolicyStateSupportSchema = z.object({
  automaticLapseOnAccountValueDepletion: z.boolean(),
  accountValueDepletionNonLapseWindows: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100),
  })).max(10).optional(),
  accountValueDepletionNonLapseTerminationRules: z.array(z.union([
    z.object({
      trigger: z.enum(['partial-withdrawal', 'premium-holiday']),
      disqualifyIfAnyFromPolicyYear: z.number().int().min(1).max(100),
      endPolicyYear: z.number().int().min(1).max(100).nullable().optional(),
    }),
    z.object({
      trigger: z.literal('partial-withdrawal'),
      basis: z.literal('cumulative-withdrawals-exceed-open-balance-at-start-policy-year-rate'),
      startPolicyYear: z.number().int().min(1).max(100),
      endPolicyYear: z.number().int().min(1).max(100).nullable(),
      maximumValueRate: z.number().min(0).max(100),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
    }),
  ])).max(10).optional(),
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
  partialWithdrawalMinimumRemainingSelectedFundValueRules: z.array(z.object({
    activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
    accountId: z.string().min(1),
    minimumValue: z.number().min(0).max(100_000_000),
    minimumValueExclusive: z.boolean().optional(),
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
  support.accountValueDepletionNonLapseWindows?.forEach((window, index) => {
    if (window.endPolicyYear < window.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'accountValueDepletionNonLapseWindows endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['accountValueDepletionNonLapseWindows', index, 'endPolicyYear'],
      })
    }
  })

  support.accountValueDepletionNonLapseTerminationRules?.forEach((rule, index) => {
    if (
      'disqualifyIfAnyFromPolicyYear' in rule
      && rule.endPolicyYear != null
      && rule.endPolicyYear < rule.disqualifyIfAnyFromPolicyYear
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'accountValueDepletionNonLapseTerminationRules endPolicyYear must be greater than or equal to disqualifyIfAnyFromPolicyYear',
        path: ['accountValueDepletionNonLapseTerminationRules', index, 'endPolicyYear'],
      })
    }

    if ('startPolicyYear' in rule && rule.endPolicyYear != null && rule.endPolicyYear < rule.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'accountValueDepletionNonLapseTerminationRules endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['accountValueDepletionNonLapseTerminationRules', index, 'endPolicyYear'],
      })
    }
  })

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

export const ilpScheduledPayoutSupportSchema = z.object({
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
  payoutStateSupport: ilpScheduledPayoutStateSupportSchema.optional(),
})

export const ilpDistributionSupportSchema = z.object({
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
    frequency: z.enum(['annual', 'semi-annual', 'quarterly', 'monthly']).optional(),
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
  lifeAssuredMode: z.enum(['single-life', 'multi-life']).optional(),
  currentOldestLifeAgeNextBirthday: z.number().int().min(1).max(120).optional(),
  currentOldestLifeSex: z.enum(['male', 'female']).optional(),
  currentYoungestLifeAgeNextBirthday: z.number().int().min(1).max(120).optional(),
  currentNetRegularPremiumBase: z.number().min(0).max(100_000_000).optional(),
  currentNetRepaymentBase: z.number().min(0).max(100_000_000).optional(),
  currentSumAssured: z.number().min(0).max(100_000_000).optional(),
  currentWealthAssureValue: z.number().min(0).max(100_000_000).optional(),
  currentBasicSumAssured: z.number().min(0).max(100_000_000).optional(),
  initialBasicSumAssuredAtIssue: z.number().min(0).max(100_000_000).optional(),
  currentNetSupplementaryPremiumBase: z.number().min(0).max(100_000_000).optional(),
  currentNetProtectedPremiumBase: z.number().min(0).max(100_000_000).optional(),
  currentAccidentalDeathFloorAmount: z.number().min(0).max(100_000_000).optional(),
  currentLockedInPolicyValue: z.number().min(0).max(100_000_000).optional(),
  currentAdjustedSinglePremium: z.number().min(0).max(100_000_000).optional(),
  currentProtectionAge: z.number().int().min(65).max(99).optional(),
  currentTpdAccelerationRatio: z.number().min(0).max(1).optional(),
  targetRetirementAge: z.number().int().min(1).max(120).optional(),
  currentAmountOwing: z.number().min(0).max(100_000_000).optional(),
  currentDeathBenefitRateTier: z.enum(['net-premium-105', 'net-premium-101']).optional(),
  currentRetainedMultiplierStatus: z.enum(['multiplier-expired', 'multiplier-retained']).optional(),
  currentAcceleratedTiPayoutMode: z.enum(['same-as-death-benefit', 'lower-than-death-benefit']).optional(),
  currentNoLapsePrivilegeMode: z.enum(['not-in-effect', 'expiry-age-85', 'expiry-age-100']).optional(),
})

const ilpExcludedValueCohortInputSchema = z.object({
  bonusId: z.string().min(1),
  accountId: z.string().min(1),
  amount: z.number().min(0).max(100_000_000),
  remainingMonths: z.number().int().min(1).max(120).nullable(),
})

const ilpBonusAdjustmentFactorInputSchema = z.object({
  bonusId: z.string().min(1),
  factor: z.number().min(0).max(1),
})

const ilpCurrentClaimHistorySchema = z.object({
  family: z.enum(['none', 'ti-advancement', 'tpd-waiver', 'tpd-staged-payout', 'accidental-disability-staged-payout']).optional(),
  admissionStatus: z.enum(['not-admitted', 'admitted', 'admitted-and-settled']).optional(),
  remainingWaivedPremiumMonths: z.number().int().min(0).max(1_200).optional(),
  remainingProtectedDeathCoverBase: z.number().min(0).max(100_000_000).optional(),
  remainingStagedBenefitBalance: z.number().min(0).max(100_000_000).optional(),
  refundGateStatus: z.enum(['intact', 'broken']).optional(),
})

export const ilpClaimProfileSchema = z.object({
  currentClaimHistory: ilpCurrentClaimHistorySchema.optional(),
  currentIndebtedness: z.number().min(0).max(100_000_000).optional(),
  remainingAggregateTiCap: z.number().min(0).max(100_000_000).optional(),
  remainingAggregateTiCiCap: z.number().min(0).max(100_000_000).optional(),
  currentTiClaimStatus: z.enum(['not-triggered', 'triggered', 'admitted', 'admitted-and-settled']).optional(),
  currentTiClaimBenefitAmount: z.number().min(0).max(100_000_000).optional(),
  currentResidualDeathBenefitAfterTiClaim: z.number().min(0).max(100_000_000).optional(),
  currentTpdClaimStatus: z.enum(['not-triggered', 'triggered', 'admitted', 'admitted-and-settled']).optional(),
  currentTpdClaimBenefitAmount: z.number().min(0).max(100_000_000).optional(),
  remainingAggregateTpdCap: z.number().min(0).max(100_000_000).optional(),
  currentExcludedClaimBonusValue: z.number().min(0).max(100_000_000).optional(),
  currentExcludedValueCohorts: z.array(ilpExcludedValueCohortInputSchema).optional(),
  currentBonusAdjustmentFactors: z.array(ilpBonusAdjustmentFactorInputSchema).optional(),
  currentInvestPlusSpPowerUpBonusStatus: z.enum(['due-and-uncredited', 'already-credited-or-not-payable']).optional(),
  currentInvestPlusSpInitialPowerUpBonusAmount: z.number().min(0).max(100_000_000).optional(),
  currentInvestPlusSpTopUpPowerUpBonusAmount: z.number().min(0).max(100_000_000).optional(),
  currentInvestPlusSpObservedInitialAccountValueAverage: z.number().min(0).max(100_000_000).optional(),
  currentInvestPlusSpRepresentativeManagementChargeRate: z.number().min(0).max(1).optional(),
  currentInvestStarterPolicyChargeRefundAverageAccountValue: z.number().min(0).max(100_000_000).optional(),
  currentInvestStarterPolicyChargeRefundStatus: z.enum(['due-and-uncredited', 'already-credited-or-not-payable']).optional(),
  currentRefundEligibleDeathCoiCollected: z.number().min(0).max(100_000_000).optional(),
  currentDeathCoiRefundStatus: z.enum(['due-and-uncredited', 'already-credited-or-not-payable']).optional(),
  currentSmartRetireRefundGateStatus: z.enum(['intact', 'broken']).optional(),
  currentSmartRetireDeathClaimStatus: z.enum(['not-triggered', 'admitted-and-settled']).optional(),
  currentAccidentalDeathMode: z.enum(['standard-accident', 'restricted-activity-accident']).optional(),
  currentWopOnTpdClaimStatus: z.enum(['not-triggered', 'admitted', 'admitted-and-settled']).optional(),
  currentRemainingWopPremiumWaiverMonths: z.number().int().min(0).max(1_200).optional(),
  currentTpdContinuationEventStatus: z.enum(['triggered', 'not-triggered']).optional(),
  currentTpdSettlementMode: z.enum(['same-as-death-benefit', 'lower-than-death-benefit']).optional(),
  currentTpdPayoutStage: z.enum(['full-benefit-payable-now', 'initial-lump-sum-payable-now', 'balance-lump-sum-payable-now']).optional(),
  currentTpdRemainingBalance: z.number().min(0).max(100_000_000).optional(),
  currentAccidentalDisabilityPayoutStage: z.enum(['initial-lump-sum-payable-now', 'balance-lump-sum-payable-now']).optional(),
  currentAccidentalDisabilityRemainingBalance: z.number().min(0).max(100_000_000).optional(),
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
  mode: z.enum(['annual-rate', 'monthly-rate', 'premium-allocation', 'one-time']),
  oneTimePayoutBasis: z.enum(['fixed-amount', 'committed-annual-premium-at-issue', 'initial-single-premium-at-issue', 'step-up-booster-delta']).optional(),
  annualPremiumTierBasis: z.enum([
    'projected-paid-regular-premium-this-year',
    'committed-annual-premium-at-issue',
    'initial-basic-sum-assured-at-issue',
    'initial-basic-sum-assured-multiple-at-issue',
    'initial-single-premium-at-issue',
  ]).optional(),
  rate: z.number().min(0).max(1),
  amount: z.number().min(0).max(100_000_000),
  appliesTo: z.array(z.string()).max(20),
  startPolicyYear: z.number().int().min(1).max(100),
  endPolicyYear: z.number().int().min(1).max(100).nullable(),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  cadenceYears: z.number().int().min(1).max(100).optional(),
  requiresPremiumsPaidUpToDate: z.boolean().optional(),
  requiredRegularPremiumPaymentFrequency: ilpRegularPremiumPaymentFrequencySchema.optional(),
  tieredRates: z.array(z.object({
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
  })).max(20).optional(),
  policyYearRateSchedule: z.array(z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100).nullable(),
    rate: z.number().min(0).max(5),
  })).max(25).optional(),
  vitalityStatusRateSchedule: z.array(z.object({
    status: ilpVitalityStatusSchema,
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
    includePolicyRepaymentsInPaidRegularPremium: z.boolean().optional(),
    countFromPolicyYear: z.number().int().min(1).max(100).optional(),
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
      endPolicyYear: z.number().int().min(1).max(100).nullable().optional(),
    }),
    z.object({
      trigger: z.literal('partial-withdrawal'),
      basis: z.literal('cumulative-withdrawals-exceed-open-balance-at-start-policy-year-rate'),
      startPolicyYear: z.number().int().min(1).max(100),
      endPolicyYear: z.number().int().min(1).max(100).nullable(),
      maximumValueRate: z.number().min(0).max(100),
      accountIds: z.array(z.string().min(1)).min(1).max(10).optional(),
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
      includeReinvestedDividendWithdrawals: z.literal(true).optional(),
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
  sourceRefs: z.array(z.object({
    page: z.number().int().min(1),
    section: z.string(),
    excerpt: z.string(),
  })).max(5).optional(),
  notes: z.array(z.string()).max(10).optional(),
}).superRefine((bonus, ctx) => {
  if (bonus.endPolicyYear != null && bonus.endPolicyYear < bonus.startPolicyYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endPolicyYear must be greater than or equal to startPolicyYear',
      path: ['endPolicyYear'],
    })
  }

  if (bonus.mode !== 'one-time' && bonus.oneTimePayoutBasis != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'oneTimePayoutBasis is only valid for one-time bonuses',
      path: ['oneTimePayoutBasis'],
    })
  }

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

export const ilpChargeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  basis: z.enum(['account-value', 'annual-contribution', 'fixed-annual', 'assurance-sum-at-risk', 'insured-amount-at-issue', 'premium-base-mip-multiplier', 'premium-base-mip-multiplier-capped-account-value', 'cumulative-paid-regular-premium', 'initial-single-premium', 'initial-single-premium-base']),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  requiresPremiumsPaidUpToDate: z.boolean().optional(),
  suspensionRules: z.array(z.object({
    trigger: z.literal('premium-holiday'),
    basis: z.literal('prorate-by-overlap-months'),
  })).max(5).optional(),
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
      rate: z.number().min(0).max(5),
    })).max(40).optional(),
  }).optional(),
  carryForwardOnInsufficientDeductionWithinPolicyYears: z.object({
    startPolicyYear: z.number().int().min(1).max(100),
    endPolicyYear: z.number().int().min(1).max(100),
  }).optional(),
  requiresManualInput: z.boolean().optional(),
  allocation: z.enum(['pro-rata-by-value', 'pro-rata-by-contribution-share', 'equal-split']),
  /** Source references from the policy document (page, section, excerpt). Display-only metadata. */
  sourceRefs: z.array(z.object({
    page: z.number().int().min(1),
    section: z.string(),
    excerpt: z.string(),
  })).optional(),
  /** Parser notes describing the charge rule. Display-only metadata. */
  notes: z.array(z.string()).optional(),
}).superRefine((rule, ctx) => {
  if (rule.startPolicyYear != null && rule.endPolicyYear != null && rule.endPolicyYear < rule.startPolicyYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge rule endPolicyYear must be greater than or equal to startPolicyYear',
      path: ['endPolicyYear'],
    })
  }

  if (
    rule.carryForwardOnInsufficientDeductionWithinPolicyYears != null
    && rule.carryForwardOnInsufficientDeductionWithinPolicyYears.endPolicyYear
      < rule.carryForwardOnInsufficientDeductionWithinPolicyYears.startPolicyYear
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge rule carryForwardOnInsufficientDeductionWithinPolicyYears endPolicyYear must be greater than or equal to startPolicyYear',
      path: ['carryForwardOnInsufficientDeductionWithinPolicyYears', 'endPolicyYear'],
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

  if ((rule.rateSchedule?.length ?? 0) > 0 && !(rule.basis === 'account-value' || rule.basis === 'annual-contribution' || rule.basis === 'cumulative-paid-regular-premium' || rule.basis === 'premium-base-mip-multiplier' || rule.basis === 'premium-base-mip-multiplier-capped-account-value' || rule.basis === 'initial-single-premium-base')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge rule rate schedules can only be used with account-value, annual-contribution, cumulative-paid-regular-premium, premium-base-mip-multiplier, premium-base-mip-multiplier-capped-account-value, or initial-single-premium-base basis',
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

  rule.issueAgeRateTiers?.forEach((tier, index) => {
    if (tier.maxIssueAgeNextBirthday != null && tier.maxIssueAgeNextBirthday < tier.minIssueAgeNextBirthday) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issue-age rate tiers must have maxIssueAgeNextBirthday greater than or equal to minIssueAgeNextBirthday',
        path: ['issueAgeRateTiers', index, 'maxIssueAgeNextBirthday'],
      })
    }
  })

  if (rule.issueAgeRateTiers && rule.basis !== 'insured-amount-at-issue') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'issueAgeRateTiers can only be used with insured-amount-at-issue charge rules',
      path: ['issueAgeRateTiers'],
    })
  }

  if (rule.basis === 'insured-amount-at-issue' && (rule.issueAgeRateTiers?.length ?? 0) === 0 && rule.rate <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'insured-amount-at-issue charge rules must define a positive rate or issueAgeRateTiers',
      path: ['issueAgeRateTiers'],
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

  if (
    (rule.basis === 'premium-base-mip-multiplier' || rule.basis === 'premium-base-mip-multiplier-capped-account-value')
    && !rule.premiumBaseConfig
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-base charge rules must include a premium-base configuration',
      path: ['premiumBaseConfig'],
    })
  }

  if (
    rule.basis !== 'premium-base-mip-multiplier'
    && rule.basis !== 'premium-base-mip-multiplier-capped-account-value'
    && rule.premiumBaseConfig
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-base configuration can only be used on premium-base-mip-multiplier charge rules',
      path: ['premiumBaseConfig'],
    })
  }

  if (rule.basis === 'premium-base-mip-multiplier-capped-account-value' && rule.premiumBaseConfig?.capRate == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Capped premium-base charge rules must include premiumBaseConfig.capRate',
      path: ['premiumBaseConfig', 'capRate'],
    })
  }

  if (rule.basis !== 'premium-base-mip-multiplier-capped-account-value' && rule.premiumBaseConfig?.capRate != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'premiumBaseConfig.capRate can only be used on premium-base-mip-multiplier-capped-account-value rules',
      path: ['premiumBaseConfig', 'capRate'],
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

  for (const [index, tier] of (rule.assuranceConfig?.policyYearRateMultiplierSchedule ?? []).entries()) {
    if (tier.endPolicyYear != null && tier.endPolicyYear < tier.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assurance policy-year rate multiplier endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['assuranceConfig', 'policyYearRateMultiplierSchedule', index, 'endPolicyYear'],
      })
    }
  }

  for (const [index, tier] of (rule.assuranceConfig?.sumAssuredRateMultiplierTiers ?? []).entries()) {
    if (tier.maxSumAssured != null && tier.maxSumAssured < tier.minSumAssured) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assurance sum-assured rate multiplier maxSumAssured must be greater than or equal to minSumAssured',
        path: ['assuranceConfig', 'sumAssuredRateMultiplierTiers', index, 'maxSumAssured'],
      })
    }
  }
})

export const ilpEventChargeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  trigger: z.enum(['partial-withdrawal', 'regular-premium-reduction', 'premium-holiday', 'premium-holiday-repayment', 'top-up', 'recurring-single-premium']),
  basis: z.enum(['event-amount', 'account-value', 'premium-reduction-with-startup-recovery', 'premium-reduction-tiered-startup-recovery', 'repaid-premium-with-missed-months', 'annual-premium-with-overlap-months', 'committed-annual-premium-with-overlap-months', 'premium-holiday-charge-refund', 'source-event-charge-refund', 'event-amount-with-overlap-months', 'annual-reduction-with-active-months', 'fixed-amount-with-overlap-months']),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']).optional(),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  appliesTo: z.array(z.string().min(1)).min(1).max(10),
  fallbackAppliesTo: z.array(z.string().min(1)).min(1).max(10).optional(),
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
  sourceRefs: z.array(z.object({
    page: z.number().int().min(1),
    section: z.string(),
    excerpt: z.string(),
  })).max(5).optional(),
  notes: z.array(z.string()).max(10).optional(),
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
    && rule.basis !== 'committed-annual-premium-with-overlap-months'
    && rule.basis !== 'source-event-charge-refund'
    && rule.basis !== 'fixed-amount-with-overlap-months') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Premium-holiday event charges must use annual-premium-with-overlap-months, committed-annual-premium-with-overlap-months, source-event-charge-refund, or fixed-amount-with-overlap-months basis',
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

  if (rule.freeLifetimeMonthsStartPolicyYear != null && rule.trigger !== 'premium-holiday') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'freeLifetimeMonthsStartPolicyYear can only be used on premium-holiday event charge rules',
      path: ['freeLifetimeMonthsStartPolicyYear'],
    })
  }

  rule.freeLifetimeMonthsSchedule?.forEach((tier, index) => {
    if (tier.endPolicyYear != null && tier.endPolicyYear < tier.startPolicyYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'freeLifetimeMonthsSchedule endPolicyYear must be greater than or equal to startPolicyYear',
        path: ['freeLifetimeMonthsSchedule', index, 'endPolicyYear'],
      })
    }
  })

  if (rule.freeLifetimeMonthsSchedule != null && rule.trigger !== 'premium-holiday') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'freeLifetimeMonthsSchedule can only be used on premium-holiday event charge rules',
      path: ['freeLifetimeMonthsSchedule'],
    })
  }

  if (rule.freeLifetimeMonthsResetOnRepayment === true && rule.trigger !== 'premium-holiday') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'freeLifetimeMonthsResetOnRepayment can only be used on premium-holiday event charge rules',
      path: ['freeLifetimeMonthsResetOnRepayment'],
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

  if (rule.basis === 'source-event-charge-refund'
    && rule.trigger !== 'partial-withdrawal'
    && rule.trigger !== 'premium-holiday'
    && rule.trigger !== 'regular-premium-reduction') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source-event charge refund rules must trigger on partial-withdrawal, premium-holiday, or regular-premium-reduction',
      path: ['trigger'],
    })
  }

  if (rule.basis === 'source-event-charge-refund' && !rule.sourceChargeRuleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source-event charge refund rules must reference a source event charge rule',
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

  if (rule.freeEventMaxAmountBasis && rule.freeEventMaxAmountRate == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Free-event max-amount basis requires freeEventMaxAmountRate',
      path: ['freeEventMaxAmountBasis'],
    })
  }

  if (rule.manualWaiverMode === 'capped-free-event' && !(rule.trigger === 'partial-withdrawal' && rule.basis === 'event-amount')) {
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

  if (hasFreeAmountPool) {
    if (rule.freeAmountPoolRate == null || rule.freeAmountPoolBasis == null || rule.freeAmountPoolReferencePolicyYear == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Free amount pools must define rate, basis, and reference policy year together',
        path: ['freeAmountPoolRate'],
      })
    }

    if (!(rule.trigger === 'partial-withdrawal' && rule.basis === 'event-amount')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Free amount pools can only be used on partial-withdrawal event-amount rules',
        path: ['freeAmountPoolRate'],
      })
    }

    if (rule.freeEventCount != null || rule.freeEventMaxAmountRate != null || rule.freeEventMaxAmountBasis != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Free amount pools cannot be combined with first-N free event settings on the same rule',
        path: ['freeAmountPoolRate'],
      })
    }
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
  regularPremiumPaymentFrequency: ilpRegularPremiumPaymentFrequencySchema.optional(),
  initialSinglePremium: z.number().min(0).max(100_000_000).optional(),
  monthsAlreadyPaid: z.number().int().min(0).max(1_200),
  currentAcceptedRegularPremiumMonths: z.number().int().min(0).max(1_200).optional(),
  currentPolicyYear: z.number().int().min(1).max(100),
  vitalityStatus: ilpVitalityStatusSchema.optional(),
  icpMonths: z.number().int().min(0).max(1_200).optional(),
  mipBasis: z.enum(['finite', 'open-ended']).optional(),
  assuranceProfile: ilpAssuranceProfileSchema.optional(),
  claimProfile: ilpClaimProfileSchema.optional(),
  policyStateSupport: ilpPolicyStateSupportSchema.optional(),
  scheduledPayoutSupport: ilpScheduledPayoutSupportSchema.optional(),
  scheduledPayoutAssumption: ilpScheduledPayoutAssumptionSchema.optional(),
  distributionSupport: ilpDistributionSupportSchema.optional(),
  distributionAssumption: ilpDistributionAssumptionSchema.optional(),
  policyEvents: z.array(ilpPolicyEventSchema).max(20).optional(),
  accounts: z.array(ilpAccountSchema).min(1).max(10),
  mipLength: z.number().int().min(1).max(100).nullable().optional(),
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
    paymentStructure: z.enum(['mip', 'ppt', 'single-pay', 'flexi', 'iip']).optional(),
    premiumPaymentTermYears: z.number().int().min(0).nullable().optional(),
    policyTermYears: z.number().int().min(0).nullable().optional(),
    flexiTerm: z.number().int().min(0).nullable().optional(),
    contributionMode: z.enum(['regular-pay', 'single-pay']).optional(),
    catalogVersion: z.string().min(1),
    generatedAt: z.string().min(1).optional(),
    supportStatus: z.enum(['supported', 'partial', 'parser-error']),
    economicsStatus: z.enum(['supported', 'partial-modeled-subset', 'metadata-only']),
    structureStatus: z.enum(['structured', 'brochure-partial']),
    modeledEconomics: z.array(z.string().min(1)).max(40),
    coveredElsewhereBehaviors: z.array(z.string().min(1)).max(60).default([]),
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

  if (mipBasis === 'open-ended' && policy.postMipYears < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Open-ended policies must define a positive review horizon in postMipYears',
      path: ['postMipYears'],
    })
  }

  if (
    policy.currentAcceptedRegularPremiumMonths != null
    && policy.currentAcceptedRegularPremiumMonths > policy.monthsAlreadyPaid
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current accepted regular premium months cannot exceed monthsAlreadyPaid',
      path: ['currentAcceptedRegularPremiumMonths'],
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
  if (policy.monthlyContribution > 0) {
    if (!hasContributionRules && Math.abs(contributionShareSum - 1) > SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'If monthlyContribution > 0, account contributionShares must sum to 1.0',
        path: ['accounts'],
      })
    }
  } else if (!hasContributionRules) {
    const supportsDormantContributionRouting = Math.abs(contributionShareSum - 1) <= SUM_TOLERANCE
    const supportsDisabledContributionRouting = Math.abs(contributionShareSum) <= SUM_TOLERANCE
    if (!supportsDormantContributionRouting && !supportsDisabledContributionRouting) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'If monthlyContribution = 0, account contributionShares must sum to 0 or 1.0',
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
        const supportsDormantPhaseRouting = Math.abs(phaseShareSum - 1) <= SUM_TOLERANCE
        const supportsDisabledPhaseRouting = Math.abs(phaseShareSum) <= SUM_TOLERANCE
        if (!supportsDormantPhaseRouting && !supportsDisabledPhaseRouting) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `If monthlyContribution = 0, ${phase} contributionRules must sum to 0 or 1.0`,
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

      if (
        policy.monthlyContribution === 0
        && Math.abs(afterMipShareSum) > SUM_TOLERANCE
        && Math.abs(afterMipShareSum - 1) > SUM_TOLERANCE
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'If monthlyContribution = 0, after-mip contributionRules must sum to 0 or 1.0 when defined',
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

  const selectedFundFloorRules = policy.policyStateSupport?.partialWithdrawalMinimumRemainingSelectedFundValueRules ?? []
  const validFundNames = new Set(policy.funds.map((fund) => fund.name))
  const hasSelectedFundRules = selectedFundFloorRules.length > 0
  if (hasSelectedFundRules) {
    const duplicateFundNames = new Set<string>()
    for (const fund of policy.funds) {
      if (policy.funds.filter((candidate) => candidate.name === fund.name).length > 1) {
        duplicateFundNames.add(fund.name)
      }
    }
    if (duplicateFundNames.size > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Policies using selected-fund withdrawal floors must have unique fund names',
        path: ['funds'],
      })
    }
  }

  policy.policyEvents?.forEach((event, index) => {
    if (event.fundName != null && !validFundNames.has(event.fundName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Policy event fundName must reference an existing fund name',
        path: ['policyEvents', index, 'fundName'],
      })
    }

    const requiresSelectedFund = event.type === 'partial-withdrawal'
      && event.accountId != null
      && selectedFundFloorRules.some((rule) => rule.accountId === event.accountId)
    if (requiresSelectedFund && !event.fundName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Partial-withdrawal events must specify a selected fund when the product models a remaining selected-fund floor on that account',
        path: ['policyEvents', index, 'fundName'],
      })
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

  policy.scheduledPayoutSupport?.fallbackAccountIds?.forEach((accountId, accountIndex) => {
    if (!accountIds.includes(accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scheduledPayoutSupport.fallbackAccountIds must reference existing accounts',
        path: ['scheduledPayoutSupport', 'fallbackAccountIds', accountIndex],
      })
    }
    if (accountId === policy.scheduledPayoutSupport?.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scheduledPayoutSupport.fallbackAccountIds must not repeat the primary account',
        path: ['scheduledPayoutSupport', 'fallbackAccountIds', accountIndex],
      })
    }
  })

  policy.policyStateSupport?.minimumPartialWithdrawalStartPolicyMonthByAccount?.forEach((rule, ruleIndex) => {
    if (!accountIds.includes(rule.accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policyStateSupport.minimumPartialWithdrawalStartPolicyMonthByAccount accountId must reference an existing account',
        path: ['policyStateSupport', 'minimumPartialWithdrawalStartPolicyMonthByAccount', ruleIndex, 'accountId'],
      })
    }
  })

  policy.policyStateSupport?.accountValueDepletionNonLapseTerminationRules?.forEach((rule, ruleIndex) => {
    if ('accountIds' in rule) {
      rule.accountIds?.forEach((accountId, accountIndex) => {
        if (!accountIds.includes(accountId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'policyStateSupport.accountValueDepletionNonLapseTerminationRules accountIds must reference existing accounts',
            path: ['policyStateSupport', 'accountValueDepletionNonLapseTerminationRules', ruleIndex, 'accountIds', accountIndex],
          })
        }
      })
    }
  })

  policy.policyStateSupport?.partialWithdrawalMaximumAmountRules?.forEach((rule, ruleIndex) => {
    if (!accountIds.includes(rule.accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policyStateSupport.partialWithdrawalMaximumAmountRules accountId must reference an existing account',
        path: ['policyStateSupport', 'partialWithdrawalMaximumAmountRules', ruleIndex, 'accountId'],
      })
    }
  })

  policy.policyStateSupport?.partialWithdrawalMinimumRemainingValueRules?.forEach((rule, ruleIndex) => {
    if (rule.accountId != null && !accountIds.includes(rule.accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policyStateSupport.partialWithdrawalMinimumRemainingValueRules accountId must reference an existing account',
        path: ['policyStateSupport', 'partialWithdrawalMinimumRemainingValueRules', ruleIndex, 'accountId'],
      })
    }
  })

  policy.policyStateSupport?.partialWithdrawalMinimumRemainingSelectedFundValueRules?.forEach((rule, ruleIndex) => {
    if (!accountIds.includes(rule.accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policyStateSupport.partialWithdrawalMinimumRemainingSelectedFundValueRules accountId must reference an existing account',
        path: ['policyStateSupport', 'partialWithdrawalMinimumRemainingSelectedFundValueRules', ruleIndex, 'accountId'],
      })
    }
  })

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
