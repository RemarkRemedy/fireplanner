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
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateBonusTierSchema = z.object({
  currency: z.enum(['SGD', 'USD']),
  minAnnualPremium: z.number().min(0).nullable(),
  maxAnnualPremium: z.number().min(0).nullable(),
  minAccountValue: z.number().min(0).nullable().optional(),
  maxAccountValue: z.number().min(0).nullable().optional(),
  rate: z.number().min(0).max(1),
})

export const ilpTemplateBonusSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['power-up', 'loyalty', 'allocation', 'sign-up', 'custom']),
  label: z.string().min(1),
  mode: z.enum(['annual-rate', 'premium-allocation', 'one-time']),
  appliesTo: z.array(z.string().min(1)).max(20),
  startPolicyYear: z.number().int().min(1).max(100),
  endPolicyYear: z.number().int().min(1).max(100).nullable(),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  cadenceYears: z.number().int().min(1).max(100).optional(),
  requiresPremiumsPaidUpToDate: z.boolean().optional(),
  rate: z.number().min(0).max(1).nullable(),
  amount: z.number().min(0).max(100_000_000).nullable(),
  tieredRates: z.array(ilpTemplateBonusTierSchema),
  suspensionRules: z.array(z.object({
    trigger: z.enum(['premium-holiday', 'partial-withdrawal', 'regular-premium-reduction']),
    suspensionMonths: z.number().int().min(1).max(120),
  })).max(5).optional(),
  restorationRules: z.array(z.object({
    trigger: z.enum(['premium-holiday-repayment']),
    basis: z.enum(['repaid-premium-with-missed-months', 'account-value-plus-repaid-premium-with-missed-months']),
  })).max(5).optional(),
  notes: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateFeeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  basis: z.enum(['account-value', 'annual-contribution', 'fixed-annual', 'assurance-sum-at-risk', 'premium-base-mip-multiplier', 'cumulative-paid-regular-premium']).optional(),
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
  id: z.string().min(1),
  label: z.string().min(1),
  trigger: z.enum(['partial-withdrawal', 'regular-premium-reduction', 'premium-holiday', 'premium-holiday-repayment', 'top-up', 'recurring-single-premium']),
  basis: z.enum(['event-amount', 'account-value', 'premium-reduction-with-startup-recovery', 'premium-reduction-tiered-startup-recovery', 'repaid-premium-with-missed-months', 'annual-premium-with-overlap-months', 'committed-annual-premium-with-overlap-months', 'premium-holiday-charge-refund', 'event-amount-with-overlap-months', 'annual-reduction-with-active-months']),
  yearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  appliesTo: z.array(z.string().min(1)).max(20),
  fallbackAppliesTo: z.array(z.string().min(1)).max(20).optional(),
  freeLifetimeMonths: z.number().int().min(1).max(240).optional(),
  freeEventCount: z.number().int().min(1).max(10).optional(),
  freeEventStartPolicyYear: z.number().int().min(1).max(100).optional(),
  freeEventMaxAmountRate: z.number().min(0).max(1).optional(),
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
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateScheduledPayoutSupportSchema = z.object({
  mode: z.literal('manual-assumption'),
  accountId: z.string().min(1),
  source: z.literal('policy-redemption'),
  notes: z.array(z.string()).min(1),
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateDistributionSupportSchema = z.object({
  mode: z.literal('manual-assumption'),
  accountIds: z.array(z.string().min(1)).min(1).max(10),
  defaultMode: z.literal('reinvest'),
  cashPayoutAllowedDuringMip: z.boolean(),
  cashPayoutAllowedAfterMip: z.boolean(),
  source: z.literal('distribution-paying-funds'),
  notes: z.array(z.string()).min(1),
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateVariantSchema = z.object({
  id: z.string().min(1),
  currency: z.enum(['SGD', 'USD']),
  mipBasis: z.enum(['finite', 'open-ended']).optional(),
  mipLength: z.number().int().min(5).max(100).nullable().optional(),
  icpMonths: z.number().int().min(1).max(1_200),
  accounts: z.array(ilpTemplateAccountSchema).min(1).max(10),
  bonuses: z.array(ilpTemplateBonusSchema).max(40),
  feeRules: z.array(ilpTemplateFeeRuleSchema).max(20),
  eventChargeRules: z.array(ilpTemplateEventChargeRuleSchema).max(20),
  scheduledPayoutSupport: ilpTemplateScheduledPayoutSupportSchema.optional(),
  distributionSupport: ilpTemplateDistributionSupportSchema.optional(),
  eecTable: z.array(z.number().min(0).max(1)).max(100),
  eecYearBasis: z.enum(['policy-year', 'premium-year']).optional(),
  warnings: z.array(z.string()),
  unsupportedItems: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
}).superRefine((variant, ctx) => {
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

  if (variant.distributionSupport) {
    variant.distributionSupport.accountIds.forEach((accountId, accountIndex) => {
      if (!variant.accounts.some((account) => account.id === accountId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'distributionSupport.accountIds must reference existing accounts',
          path: ['distributionSupport', 'accountIds', accountIndex],
        })
      }
    })
  }
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
