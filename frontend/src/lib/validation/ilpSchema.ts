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
  basis: z.enum(['account-value', 'annual-contribution', 'fixed-annual', 'assurance-sum-at-risk', 'premium-base-mip-multiplier']),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
  startPolicyYear: z.number().int().min(1).max(100).optional(),
  endPolicyYear: z.number().int().min(1).max(100).nullable().optional(),
  appliesTo: z.array(z.string().min(1)).min(1).max(10),
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
    ]),
    monthlyModalFactor: z.number().min(0).max(1),
    maxAgeNextBirthday: z.number().int().min(1).max(120).optional(),
  }).optional(),
  premiumBaseConfig: z.object({
    useHigherOfCommencementAndPrevailing: z.boolean(),
    multiplierSchedule: z.array(z.object({
      startPolicyYear: z.number().int().min(1).max(100),
      endPolicyYear: z.number().int().min(1).max(100).nullable(),
      mode: z.enum(['policy-year', 'fixed']),
      multiplier: z.number().min(0).max(100).optional(),
    })).min(1).max(20),
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

  if ((rule.rateSchedule?.length ?? 0) > 0 && !(rule.basis === 'account-value' || rule.basis === 'annual-contribution')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Charge rule rate schedules can only be used with account-value or annual-contribution basis',
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
})

export const ilpEventChargeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  trigger: z.enum(['partial-withdrawal', 'regular-premium-reduction', 'premium-holiday', 'premium-holiday-repayment', 'top-up', 'recurring-single-premium']),
  basis: z.enum(['event-amount', 'account-value', 'premium-reduction-with-startup-recovery', 'premium-reduction-tiered-startup-recovery', 'repaid-premium-with-missed-months', 'annual-premium-with-overlap-months', 'committed-annual-premium-with-overlap-months', 'premium-holiday-charge-refund', 'event-amount-with-overlap-months', 'annual-reduction-with-active-months']),
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
  monthsAlreadyPaid: z.number().int().min(0).max(1_200),
  currentPolicyYear: z.number().int().min(1).max(100),
  icpMonths: z.number().int().min(0).max(1_200).optional(),
  assuranceProfile: ilpAssuranceProfileSchema.optional(),
  policyEvents: z.array(ilpPolicyEventSchema).max(20).optional(),
  accounts: z.array(ilpAccountSchema).min(1).max(10),
  mipLength: z.number().int().min(5).max(100),
  postMipYears: z.number().int().min(0).max(50),
  eecTable: z.array(z.number().min(0).max(1)).min(1).max(100),
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
  if (Math.abs(fundAllocationSum - 1) > SUM_TOLERANCE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Fund allocations must sum to 100%',
      path: ['funds'],
    })
  }

  if (policy.currentPolicyYear >= policy.mipLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current policy year must be less than MIP length. Mature policies are not supported in V1.',
      path: ['currentPolicyYear'],
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
  } else if (!hasContributionRules && Math.abs(contributionShareSum) > SUM_TOLERANCE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'If monthlyContribution = 0, account contributionShares must sum to 0',
      path: ['accounts'],
    })
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

      if (policy.monthlyContribution === 0 && Math.abs(phaseShareSum) > SUM_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `If monthlyContribution = 0, ${phase} contributionRules must sum to 0`,
          path: ['accounts'],
        })
      }
    }

    const hasAfterMipRules = policy.accounts.some((account) => (
      account.contributionRules?.some((rule) => rule.phase === 'after-mip')
    ))

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
    if (rule.appliesTo.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule appliesTo must reference valid account IDs',
        path: ['chargeRules', index, 'appliesTo'],
      })
    }

    if (rule.fallbackAppliesTo?.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge rule fallbackAppliesTo must reference valid account IDs',
        path: ['chargeRules', index, 'fallbackAppliesTo'],
      })
    }
  })

  policy.eventChargeRules?.forEach((rule, index) => {
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

  if (policy.eecTable.length < policy.mipLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'EEC table must have at least mipLength entries',
      path: ['eecTable'],
    })
  }
})

export const ilpPoliciesSchema = z.array(ilpPolicySchema)
