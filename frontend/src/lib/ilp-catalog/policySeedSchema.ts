import { z } from 'zod'
import {
  ilpAccountSchema,
  ilpAssuranceProfileSchema,
  ilpBonusRuleSchema,
  ilpChargeRuleSchema,
  ilpDistributionAssumptionSchema,
  ilpDistributionSupportSchema,
  ilpFundSchema,
  ilpScheduledPayoutAssumptionSchema,
  ilpScheduledPayoutSupportSchema,
} from '@/lib/validation/ilpSchema'

export const ilpPolicySeedSchema = z.object({
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
  policyEvents: z.array(z.object({
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
  })).max(20).optional(),
  accounts: z.array(ilpAccountSchema).min(1).max(10),
  mipLength: z.number().int().min(5).max(100).nullable().optional(),
  postMipYears: z.number().int().min(0).max(50),
  eecTable: z.array(z.number().min(0).max(1)).max(100),
  eecYearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  funds: z.array(ilpFundSchema).min(1).max(20),
  bonuses: z.array(ilpBonusRuleSchema).max(20),
  chargeRules: z.array(ilpChargeRuleSchema).max(30).optional(),
  eventChargeRules: z.array(z.object({
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
  })).max(20).optional(),
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
  const mipBasis = policy.mipBasis ?? 'finite'
  const accountIds = new Set(policy.accounts.map((account) => account.id))

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

  if (policy.scheduledPayoutAssumption && !policy.scheduledPayoutSupport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledPayoutAssumption requires scheduledPayoutSupport',
      path: ['scheduledPayoutAssumption'],
    })
  }

  if (policy.scheduledPayoutSupport && !accountIds.has(policy.scheduledPayoutSupport.accountId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledPayoutSupport.accountId must reference an existing account',
      path: ['scheduledPayoutSupport', 'accountId'],
    })
  }

  policy.distributionSupport?.accountIds.forEach((accountId, accountIndex) => {
    if (!accountIds.has(accountId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'distributionSupport.accountIds must reference existing accounts',
        path: ['distributionSupport', 'accountIds', accountIndex],
      })
    }
  })

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
    && !policy.distributionSupport.cashPayoutAllowedDuringMip
    && !policy.distributionSupport.cashPayoutAllowedAfterMip
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cash-payout distribution assumptions require at least one payout-eligible phase',
      path: ['distributionAssumption', 'mode'],
    })
  }

  if (
    policy.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && !accountIds.has(policy.scheduledPayoutAssumption.accountId)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scheduledPayoutAssumption.accountId must reference an existing account',
      path: ['scheduledPayoutAssumption', 'accountId'],
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

export type IlpPolicySeed = z.infer<typeof ilpPolicySeedSchema>
