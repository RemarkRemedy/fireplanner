import { z } from 'zod'

const SUM_TOLERANCE = 0.001

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

export const ilpAccountSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  feeRate: z.number().min(0).max(0.2),
  currentValue: z.number().min(0).max(100_000_000),
  contributionShare: z.number().min(0).max(1),
  subjectToEec: z.boolean(),
  postMipFeeRate: z.number().min(0).max(0.2).nullable(),
})

export const ilpBonusRuleSchema = z.object({
  type: z.enum(['power-up', 'loyalty', 'allocation', 'sign-up', 'custom']),
  label: z.string().min(1),
  mode: z.enum(['annual-rate', 'premium-allocation', 'one-time']),
  rate: z.number().min(0).max(0.5),
  amount: z.number().min(0).max(100_000_000),
  appliesTo: z.array(z.string()).max(20),
  startPolicyYear: z.number().int().min(1).max(100),
  endPolicyYear: z.number().int().min(1).max(100).nullable(),
}).superRefine((bonus, ctx) => {
  if (bonus.endPolicyYear != null && bonus.endPolicyYear < bonus.startPolicyYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endPolicyYear must be greater than or equal to startPolicyYear',
      path: ['endPolicyYear'],
    })
  }
})

export const ilpLapseMetadataOnlyFlagsSchema = z.object({
  underwriting: z.boolean(),
  exclusionResets: z.boolean(),
  claimState: z.boolean(),
  backpay: z.boolean(),
})

export const ilpLapseReinstatementRuleSchema = z.object({
  mode: z.literal('manulife-temporary'),
  lapseTrigger: z.literal('policy-value-nonpositive'),
  reinstatementWindowMonths: z.number().int().min(1).max(120),
  freezeValueDuringLapse: z.boolean(),
  freezeChargesDuringLapse: z.boolean(),
  manualReinstatementOnly: z.boolean(),
  metadataOnly: ilpLapseMetadataOnlyFlagsSchema,
})

export const ilpPolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  insurer: z.string().max(100),
  currency: z.enum(['SGD', 'USD']),
  monthlyContribution: z.number().min(0).max(100_000),
  monthsAlreadyPaid: z.number().int().min(0).max(1_200),
  currentPolicyYear: z.number().int().min(1).max(100),
  accounts: z.array(ilpAccountSchema).min(1).max(10),
  mipLength: z.number().int().min(5).max(100),
  postMipYears: z.number().int().min(0).max(50),
  eecTable: z.array(z.number().min(0).max(1)).min(1).max(100),
  funds: z.array(ilpFundSchema).min(1).max(20),
  bonuses: z.array(ilpBonusRuleSchema).max(20),
  discountRate: z.number().min(0).max(0.3),
  inflationRate: z.number().min(0).max(0.15),
  alternativeReturn: z.number().min(-0.1).max(0.3),
  lapseReinstatementRule: ilpLapseReinstatementRuleSchema.nullable().optional(),
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

  const contributionShareSum = policy.accounts.reduce((sum, account) => sum + account.contributionShare, 0)
  if (policy.monthlyContribution > 0) {
    if (Math.abs(contributionShareSum - 1) > SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'If monthlyContribution > 0, account contributionShares must sum to 1.0',
        path: ['accounts'],
      })
    }
  } else if (Math.abs(contributionShareSum) > SUM_TOLERANCE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'If monthlyContribution = 0, account contributionShares must sum to 0',
      path: ['accounts'],
    })
  }

  const validAccountIds = new Set(accountIds)
  policy.bonuses.forEach((bonus, index) => {
    if (bonus.appliesTo.some((accountId) => !validAccountIds.has(accountId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bonus appliesTo must reference valid account IDs',
        path: ['bonuses', index, 'appliesTo'],
      })
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
