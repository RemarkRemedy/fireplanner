## ilp.ts excerpt: original base helper
    premiumHolidayMonths: 0,
    payableMonths: 0,
    paymentHistory: {
      premiumYearAtStart: 0,
      premiumYearAtEnd: 0,
      premiumsPaidUpToDate: true,
    },
  }
}

function computeInitialSinglePremiumState(
  normalized: IlpNormalizedPolicyInput,
): IlpInitialSinglePremiumState {
  const grossContributionByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))
  const chargeByAccount = new Map<string, number>(normalized.input.accounts.map((account) => [account.id, 0]))

## schema.ts excerpt: template exitChargeBasis
  notes: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateFeeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  basis: z.enum(['account-value', 'annual-contribution', 'fixed-annual', 'assurance-sum-at-risk', 'premium-base-mip-multiplier', 'cumulative-paid-regular-premium', 'initial-single-premium', 'initial-single-premium-base']).optional(),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  rate: z.number().min(0).max(0.2).nullable(),
  amount: z.number().min(0).max(100_000_000).nullable().optional(),
  assuranceConfig: z.object({
    formula: z.enum([
      'prudential-prosper-death',
      'prudential-prosper-accidental-death',
      'prudential-assure-ii-combined',
      'hsbc-flexi-choice-death-ti',
      'hsbc-flexi-max-death-ti',
      'manulife-investready-iii-death-ti',
      'manulife-manuinvest-duo-death-ti-tpd',
    ]),
    monthlyModalFactor: z.number().min(0).max(1),
    maxAgeNextBirthday: z.number().int().min(1).max(120).optional(),
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
      rate: z.number().min(0).max(1),
    })).min(1).max(40).optional(),
  }).optional(),
  requiresManualInput: z.boolean().optional(),
  appliesTo: z.array(z.string().min(1)).max(20),
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
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateEventChargeRuleSchema = z.object({

## policySeedSchema.ts excerpt: policy exitChargeBasis
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
  exitChargeBasis: z.enum(['account-value', 'initial-single-premium-base']).optional(),
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

## ilpSchema.ts excerpt: runtime chargeRule + policy exitChargeBasis
  }
})

export const ilpChargeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  basis: z.enum(['account-value', 'annual-contribution', 'fixed-annual', 'assurance-sum-at-risk', 'premium-base-mip-multiplier', 'cumulative-paid-regular-premium', 'initial-single-premium', 'initial-single-premium-base']),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
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
      'manulife-investready-iii-death-ti',
      'manulife-manuinvest-duo-death-ti-tpd',
    ]),
    monthlyModalFactor: z.number().min(0).max(1),
    maxAgeNextBirthday: z.number().int().min(1).max(120).optional(),
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
