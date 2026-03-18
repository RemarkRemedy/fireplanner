export type IlpCatalogSupportStatus = 'supported' | 'partial' | 'parser-error'
export type IlpCatalogCurrency = 'SGD' | 'USD'
export type IlpCatalogSourceDocumentType = 'summary' | 'brochure'
export type IlpCatalogSourceClass = 'summary' | 'brochure-only'

export interface IlpCatalogSourceRef {
  page: number
  section: string
  excerpt: string
}

export interface IlpTemplateContributionRule {
  phase: 'during-icp' | 'after-icp' | 'top-up'
  targetAccountId: string
  contributionShare: number
}

export interface IlpTemplateAccount {
  id: string
  label: string
  feeRate: number | null
  postMipFeeRate: number | null
  subjectToEec: boolean
  contributionRules: IlpTemplateContributionRule[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateBonusTier {
  currency: IlpCatalogCurrency
  minAnnualPremium: number | null
  maxAnnualPremium: number | null
  rate: number
}

export interface IlpTemplateBonus {
  id: string
  type: 'power-up' | 'loyalty' | 'allocation' | 'sign-up' | 'custom'
  label: string
  mode: 'annual-rate' | 'premium-allocation' | 'one-time'
  appliesTo: string[]
  startPolicyYear: number
  endPolicyYear: number | null
  rate: number | null
  amount: number | null
  tieredRates: IlpTemplateBonusTier[]
  notes: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateFeeRule {
  id: string
  label: string
  rate: number | null
  appliesTo: string[]
  activeWindow: 'during-mip' | 'after-mip' | 'policy-term'
  notes: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpTemplateVariant {
  id: string
  currency: IlpCatalogCurrency
  mipLength: number
  icpMonths: number
  accounts: IlpTemplateAccount[]
  bonuses: IlpTemplateBonus[]
  feeRules: IlpTemplateFeeRule[]
  eecTable: number[]
  warnings: string[]
  unsupportedItems: string[]
  sourceRefs: IlpCatalogSourceRef[]
}

export interface IlpCatalogProduct {
  id: string
  insurer: string
  productName: string
  sourceFileName: string
  sourceChecksumSha256: string
  sourceDocumentType: IlpCatalogSourceDocumentType
  sourceClass: IlpCatalogSourceClass
  supportStatus: IlpCatalogSupportStatus
  warnings: string[]
  archived: boolean
  variants: IlpTemplateVariant[]
}

export interface IlpCatalogManifest {
  catalogVersion: string
  generatedAt: string
  parserVersion: string
  sourceStrategy: 'manual-pdf-corpus'
  productsCount: number
  supportedCount: number
  partialCount: number
  parserErrorCount: number
  summarySourceCount: number
  brochureOnlySourceCount: number
  brochurePartialEligibleCount: number
}
