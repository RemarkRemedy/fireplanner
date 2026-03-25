## getOriginalInitialSinglePremiumBase
      fallbackAppliesTo: resolveFallbackAccounts(normalized, rule.fallbackAppliesTo),
    }))
    .filter((normalizedRule) => normalizedRule.appliesTo.length > 0)
}

function getOriginalInitialSinglePremiumBase(
  input: Pick<IlpPolicyInput, 'initialSinglePremium'>,
): number {
  return Math.max(0, input.initialSinglePremium ?? 0)
}

function buildInceptionChargeContext(): IlpCashflowYearContext {
  return {

## ilpPolicySchema exitChargeBasis
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
