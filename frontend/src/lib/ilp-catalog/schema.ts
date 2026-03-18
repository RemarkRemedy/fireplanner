import { z } from 'zod'

export const ilpCatalogSourceRefSchema = z.object({
  page: z.number().int().min(1),
  section: z.string().min(1),
  excerpt: z.string().min(1),
})

export const ilpTemplateContributionRuleSchema = z.object({
  phase: z.enum(['during-icp', 'after-icp', 'top-up']),
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
  rate: z.number().min(0).max(0.5),
})

export const ilpTemplateBonusSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['power-up', 'loyalty', 'allocation', 'sign-up', 'custom']),
  label: z.string().min(1),
  mode: z.enum(['annual-rate', 'premium-allocation', 'one-time']),
  appliesTo: z.array(z.string().min(1)).max(20),
  startPolicyYear: z.number().int().min(1).max(100),
  endPolicyYear: z.number().int().min(1).max(100).nullable(),
  rate: z.number().min(0).max(0.5).nullable(),
  amount: z.number().min(0).max(100_000_000).nullable(),
  tieredRates: z.array(ilpTemplateBonusTierSchema),
  notes: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateFeeRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  rate: z.number().min(0).max(0.2).nullable(),
  appliesTo: z.array(z.string().min(1)).max(20),
  activeWindow: z.enum(['during-mip', 'after-mip', 'policy-term']),
  notes: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
})

export const ilpTemplateVariantSchema = z.object({
  id: z.string().min(1),
  currency: z.enum(['SGD', 'USD']),
  mipLength: z.number().int().min(5).max(100),
  icpMonths: z.number().int().min(1).max(1_200),
  accounts: z.array(ilpTemplateAccountSchema).min(1).max(10),
  bonuses: z.array(ilpTemplateBonusSchema).max(40),
  feeRules: z.array(ilpTemplateFeeRuleSchema).max(20),
  eecTable: z.array(z.number().min(0).max(1)).min(1).max(100),
  warnings: z.array(z.string()),
  unsupportedItems: z.array(z.string()),
  sourceRefs: z.array(ilpCatalogSourceRefSchema).min(1),
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
