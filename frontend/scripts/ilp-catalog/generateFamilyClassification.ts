import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { discoverManualCatalogSources } from './discovery.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const AUDIT_PATH = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit/corpus-audit.json')
const CATALOG_PATH = path.join(ROOT_DIR, 'src/lib/data/generated/ilpCatalog.products.json')
const GOLDEN_FIXTURE_DIR = path.join(ROOT_DIR, 'src/lib/calculations/__fixtures__/ilp-golden')
const LOW_CONFIDENCE_QA_PATH = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit/low-confidence-standard-qa.json')
const OUTPUT_JSON_PATH = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit/family-classification.json')
const OUTPUT_MD_PATH = path.join(ROOT_DIR, 'docs/ilp-mechanics-family-classification.md')

type AuditBucket = 'B-extendable' | 'C-major-gap'
type SupportStatus = 'supported' | 'partial' | 'not-in-catalog'
type EconomicsStatus = 'supported' | 'partial-modeled-subset' | 'not-modeled'
type PrimaryFamily =
  | 'standard-2-account-core-cashflow'
  | 'multi-account-special-account'
  | 'protection-heavy-death-benefit'
type OverlayTag =
  | 'ad-hoc-premium-routing'
  | 'assurance-charge'
  | 'bonus-richness'
  | 'distribution-mode'
  | 'dynamic-charge'
  | 'premium-holiday-recovery'
  | 'protection-structure'
type ImplementationCohort =
  | 'generic'
  | 'hsbc-premium-base-recovery'
  | 'prudential-pruvantage-multi-account'
  | 'tokio-shortfall-recurring-single-premium'
  | 'etiqa-rsp-recovery'
  | 'aia-ilp-generic'
  | 'great-eastern-ilp-generic'
  | 'fwd-ilp-generic'
  | 'singlife-ilp-generic'
type V1SupportBoundary = 'supported-now' | 'supported-after-kernel' | 'partial-v1'
type GoldenCoverageStatus = 'full-supported-gate' | 'subset-fixtures' | 'none'
type KernelWorkstream =
  | 'core-cashflow-kernel'
  | 'multi-account-structure-kernel'
  | 'assurance-charge-kernel'
  | 'bonus-richness-kernel'
  | 'distribution-mode-assumption-model'
  | 'protection-structure-kernel'
type KernelTier = '0-workstreams' | '1-workstream' | '2-3-workstreams' | '4-plus-workstreams'

interface AuditFeatureFlags {
  hasIua: boolean
  hasAua: boolean
  hasTopUpAccount: boolean
  hasGrowthAccount: boolean
  hasFlexAccount: boolean
  hasAdditionalInvestmentAccount: boolean
  hasRegularPremiumAccount: boolean
  hasInsuranceCharge: boolean
  hasAdminCharge: boolean
  hasPolicyCharge: boolean
  hasMultiLife: boolean
  hasDeathBenefitOptions: boolean
  hasCapitalGuarantee: boolean
  hasPremiumHoliday: boolean
  hasFreePartialWithdrawal: boolean
  hasPartialWithdrawalCharge: boolean
  hasBonusRecoveryCharge: boolean
  hasDividendOption: boolean
  hasRecurringSinglePremium: boolean
  hasTopUpPremium: boolean
  hasTieredBonus: boolean
  hasTieredFee: boolean
  hasNonGuaranteedCharge: boolean
  hasEec: boolean
}

interface AuditRow {
  fileName: string
  insurer: string
  productName: string
  pageCount: number
  totalCharacters: number
  featureFlags: AuditFeatureFlags
  accountModel: string
  bucket: AuditBucket
  gapTags: string[]
  notes: string[]
}

interface CatalogRule {
  label?: string
  requiresManualInput?: boolean
}

interface CatalogVariant {
  feeRules?: CatalogRule[]
  eventChargeRules?: CatalogRule[]
}

interface CatalogProduct {
  id: string
  insurer: string
  productName: string
  sourceFileName: string
  supportStatus: 'supported' | 'partial'
  economicsStatus: 'supported' | 'partial-modeled-subset'
  modeledEconomics?: string[]
  metadataOnlyBehaviors?: string[]
  warnings?: string[]
  variants: CatalogVariant[]
}

interface FamilyClassificationRow {
  productKey: string
  sourceFileName: string
  insurer: string
  productName: string
  auditBucket: AuditBucket
  gapTags: string[]
  primaryFamily: PrimaryFamily
  overlayTags: OverlayTag[]
  implementationCohort: ImplementationCohort
  v1SupportBoundary: V1SupportBoundary
  currentCatalogStatus: SupportStatus
  economicsStatus: EconomicsStatus
  parserExists: boolean
  goldenCoverageStatus: GoldenCoverageStatus
  kernelWorkstreams: KernelWorkstream[]
  kernelTier: KernelTier
  kernelPrerequisites: string[]
  modeledSubsetAlreadyCovered: string[]
  metadataOnlyBehaviors: string[]
  manualInputRequirements: string[]
  classificationRationale: string
  confidence: number
  evidenceRefs: string[]
}

interface FamilyClassificationOutput {
  corpusSize: number
  primaryFamilies: Record<PrimaryFamily, number>
  overlayCounts: Record<OverlayTag, number>
  v1SupportBoundaries: Record<V1SupportBoundary, number>
  implementationCohorts: Record<ImplementationCohort, number>
  kernelTiers: Record<KernelTier, number>
  rows: FamilyClassificationRow[]
}

interface LowConfidenceQaReviewRow {
  sourceFileName: string
  decision: 'confirmed-standard' | 'needs-manual-review' | 'reclassify-multi-account' | 'reclassify-protection-heavy'
  summary: string
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function hasHardProtectionStructure(row: AuditRow): boolean {
  return (
    row.featureFlags.hasMultiLife
    || row.featureFlags.hasDeathBenefitOptions
    || row.featureFlags.hasCapitalGuarantee
  )
}

function hasProtectionSignals(row: AuditRow): boolean {
  return (
    hasHardProtectionStructure(row)
    || row.gapTags.includes('multi-life')
    || row.gapTags.includes('death-benefit-structure')
  )
}

function hasSpecialAccountStructure(row: AuditRow): boolean {
  const model = row.accountModel.toLowerCase()
  const specialModel =
    model.includes('three')
    || model.includes('growth account')
    || model.includes('flex account')
    || model.includes('additional investment account')
    || model.includes('additional account')

  return (
    row.gapTags.includes('three-plus-account-model')
    || row.featureFlags.hasGrowthAccount
    || row.featureFlags.hasFlexAccount
    || row.featureFlags.hasAdditionalInvestmentAccount
    || specialModel
  )
}

function detectPrimaryFamily(row: AuditRow): PrimaryFamily {
  if (hasHardProtectionStructure(row)) {
    return 'protection-heavy-death-benefit'
  }
  if (hasSpecialAccountStructure(row)) {
    return 'multi-account-special-account'
  }
  return 'standard-2-account-core-cashflow'
}

function detectOverlayTags(row: AuditRow): OverlayTag[] {
  const overlays = new Set<OverlayTag>()

  if (
    row.gapTags.includes('dynamic-charge-model')
    || row.gapTags.includes('non-guaranteed-charges')
    || row.gapTags.includes('tiered-fee')
    || row.featureFlags.hasPolicyCharge
    || row.featureFlags.hasAdminCharge
  ) {
    overlays.add('dynamic-charge')
  }

  if (row.featureFlags.hasInsuranceCharge) {
    overlays.add('assurance-charge')
  }

  if (
    row.gapTags.includes('premium-holiday')
    || row.gapTags.includes('withdrawal-reduction-charges')
    || row.gapTags.includes('free-partial-withdrawal')
    || row.featureFlags.hasPremiumHoliday
    || row.featureFlags.hasFreePartialWithdrawal
    || row.featureFlags.hasPartialWithdrawalCharge
    || row.featureFlags.hasBonusRecoveryCharge
  ) {
    overlays.add('premium-holiday-recovery')
  }

  if (
    row.gapTags.includes('ad-hoc-premium-routing')
    || row.featureFlags.hasTopUpPremium
    || row.featureFlags.hasTopUpAccount
    || row.featureFlags.hasRecurringSinglePremium
    || row.featureFlags.hasRegularPremiumAccount
  ) {
    overlays.add('ad-hoc-premium-routing')
  }

  if (row.gapTags.includes('tiered-bonus') || row.featureFlags.hasTieredBonus) {
    overlays.add('bonus-richness')
  }

  if (row.gapTags.includes('dividend-mode') || row.featureFlags.hasDividendOption) {
    overlays.add('distribution-mode')
  }

  if (hasProtectionSignals(row)) {
    overlays.add('protection-structure')
  }

  return [...overlays].sort((left, right) => left.localeCompare(right))
}

function detectImplementationCohort(row: AuditRow): ImplementationCohort {
  if (row.insurer === 'HSBC Life') return 'hsbc-premium-base-recovery'
  if (row.insurer === 'Prudential' && /pruvantage/i.test(row.productName)) return 'prudential-pruvantage-multi-account'
  if (row.insurer === 'Tokio Marine') return 'tokio-shortfall-recurring-single-premium'
  if (row.insurer === 'Etiqa' && (row.featureFlags.hasTopUpAccount || row.featureFlags.hasRegularPremiumAccount)) return 'etiqa-rsp-recovery'
  if (row.insurer === 'AIA') return 'aia-ilp-generic'
  if (row.insurer === 'Great Eastern') return 'great-eastern-ilp-generic'
  if (row.insurer === 'FWD') return 'fwd-ilp-generic'
  if (row.insurer === 'Singlife') return 'singlife-ilp-generic'
  return 'generic'
}

function detectSupportCeiling(
  _row: AuditRow,
  primaryFamily: PrimaryFamily,
  _overlayTags: OverlayTag[],
  catalogProduct?: CatalogProduct,
): V1SupportBoundary {
  if (catalogProduct?.supportStatus === 'supported') {
    return 'supported-now'
  }

  if (primaryFamily === 'protection-heavy-death-benefit') {
    return 'partial-v1'
  }

  return 'supported-after-kernel'
}

function detectGoldenCoverageStatus(catalogProduct: CatalogProduct | undefined, coveredProductIds: Set<string>): GoldenCoverageStatus {
  if (!catalogProduct) return 'none'
  if (!coveredProductIds.has(catalogProduct.id)) return 'none'
  return catalogProduct.supportStatus === 'supported' ? 'full-supported-gate' : 'subset-fixtures'
}

function gatherManualInputRequirements(product: CatalogProduct | undefined): string[] {
  if (!product) return []

  const requirements = new Set<string>()
  for (const variant of product.variants) {
    for (const rule of variant.feeRules ?? []) {
      if (rule.requiresManualInput && rule.label) {
        requirements.add(rule.label)
      }
    }
    for (const rule of variant.eventChargeRules ?? []) {
      if (rule.requiresManualInput && rule.label) {
        requirements.add(rule.label)
      }
    }
  }
  return [...requirements].sort((left, right) => left.localeCompare(right))
}

function inferKernelPrerequisites(
  primaryFamily: PrimaryFamily,
  overlayTags: OverlayTag[],
  v1SupportBoundary: V1SupportBoundary,
  catalogProduct?: CatalogProduct,
): string[] {
  if (catalogProduct?.supportStatus === 'supported') {
    return []
  }

  const prerequisites = new Set<string>()

  if (primaryFamily === 'multi-account-special-account') {
    prerequisites.add('multi-account-special-account-kernel')
  }
  if (primaryFamily === 'protection-heavy-death-benefit' || v1SupportBoundary === 'partial-v1') {
    prerequisites.add('protection-structure-kernel')
  }
  if (
    overlayTags.includes('dynamic-charge')
    || overlayTags.includes('premium-holiday-recovery')
    || overlayTags.includes('ad-hoc-premium-routing')
  ) {
    prerequisites.add('core-cashflow-kernel')
  }
  if (overlayTags.includes('assurance-charge')) {
    prerequisites.add('assurance-charge-overlay')
  }
  if (overlayTags.includes('bonus-richness')) {
    prerequisites.add('bonus-richness-overlay')
  }
  if (overlayTags.includes('distribution-mode')) {
    prerequisites.add('distribution-mode-assumption-model')
  }

  return [...prerequisites].sort((left, right) => left.localeCompare(right))
}

function inferConfidence(row: AuditRow, catalogProduct: CatalogProduct | undefined, primaryFamily: PrimaryFamily): number {
  if (catalogProduct?.supportStatus === 'supported') return 0.95
  if (catalogProduct?.supportStatus === 'partial') return 0.85
  if (primaryFamily !== 'standard-2-account-core-cashflow') return 0.9
  if (row.accountModel.toLowerCase() === 'unclear') return 0.72
  return 0.84
}

function inferKernelWorkstreams(
  primaryFamily: PrimaryFamily,
  overlayTags: OverlayTag[],
  v1SupportBoundary: V1SupportBoundary,
  catalogProduct?: CatalogProduct,
): KernelWorkstream[] {
  if (catalogProduct?.supportStatus === 'supported') {
    return []
  }

  const workstreams = new Set<KernelWorkstream>()

  if (
    overlayTags.includes('dynamic-charge')
    || overlayTags.includes('premium-holiday-recovery')
    || overlayTags.includes('ad-hoc-premium-routing')
  ) {
    workstreams.add('core-cashflow-kernel')
  }
  if (primaryFamily === 'multi-account-special-account') {
    workstreams.add('multi-account-structure-kernel')
  }
  if (overlayTags.includes('assurance-charge')) {
    workstreams.add('assurance-charge-kernel')
  }
  if (overlayTags.includes('bonus-richness')) {
    workstreams.add('bonus-richness-kernel')
  }
  if (overlayTags.includes('distribution-mode')) {
    workstreams.add('distribution-mode-assumption-model')
  }
  if (primaryFamily === 'protection-heavy-death-benefit' || v1SupportBoundary === 'partial-v1') {
    workstreams.add('protection-structure-kernel')
  }

  return [...workstreams].sort((left, right) => left.localeCompare(right))
}

function inferKernelTier(kernelWorkstreams: KernelWorkstream[]): KernelTier {
  if (kernelWorkstreams.length === 0) return '0-workstreams'
  if (kernelWorkstreams.length === 1) return '1-workstream'
  if (kernelWorkstreams.length <= 3) return '2-3-workstreams'
  return '4-plus-workstreams'
}

function buildRationale(
  row: AuditRow,
  primaryFamily: PrimaryFamily,
  overlayTags: OverlayTag[],
  cohort: ImplementationCohort,
  catalogProduct?: CatalogProduct,
  qaReview?: LowConfidenceQaReviewRow,
): string {
  const parts = [
    `Primary family is ${primaryFamily} based on account model "${row.accountModel}" and gap tags ${row.gapTags.length > 0 ? row.gapTags.join(', ') : 'none'}.`,
  ]

  if (overlayTags.length > 0) {
    parts.push(`Cross-cutting overlays are ${overlayTags.join(', ')}.`)
  }

  if (cohort !== 'generic') {
    parts.push(`Implementation cohort is ${cohort} from insurer/product patterning.`)
  }

  if (catalogProduct) {
    parts.push(`Current catalog status is ${catalogProduct.supportStatus} with economics status ${catalogProduct.economicsStatus}.`)
  } else {
    parts.push('No current parser-backed catalog product exists for this source yet.')
  }

  if (qaReview) {
    parts.push(`QA override status: ${qaReview.decision}. ${qaReview.summary}`)
  }

  return parts.join(' ')
}

function buildEvidenceRefs(
  row: AuditRow,
  productKey: string,
  primaryFamily: PrimaryFamily,
  overlayTags: OverlayTag[],
  cohort: ImplementationCohort,
  catalogProduct?: CatalogProduct,
  qaReview?: LowConfidenceQaReviewRow,
): string[] {
  return uniqueSorted([
    `productKey:${productKey}`,
    `file:${row.fileName}`,
    `bucket:${row.bucket}`,
    `accountModel:${row.accountModel}`,
    `primaryFamily:${primaryFamily}`,
    `cohort:${cohort}`,
    ...overlayTags.map((overlay) => `overlay:${overlay}`),
    ...row.gapTags.map((tag) => `gap:${tag}`),
    ...(catalogProduct ? [`catalog:${catalogProduct.id}`] : []),
    ...(qaReview ? [`qa:${qaReview.decision}`] : []),
  ])
}

function summarizeCounts<T extends string>(values: T[]): Record<T, number> {
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]))) as Record<T, number>
}

async function readLowConfidenceQaReviews(): Promise<Map<string, LowConfidenceQaReviewRow>> {
  try {
    const raw = await readFile(LOW_CONFIDENCE_QA_PATH, 'utf8')
    const parsed = JSON.parse(raw) as { rows: LowConfidenceQaReviewRow[] }
    return new Map(parsed.rows.map((row) => [row.sourceFileName, row]))
  } catch {
    return new Map()
  }
}

function formatCountTable(label: string, counts: Record<string, number>): string[] {
  return [
    `## ${label}`,
    '',
    '| Key | Count |',
    '| --- | ---: |',
    ...Object.entries(counts)
      .sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1]
        return left[0].localeCompare(right[0])
      })
      .map(([key, count]) => `| \`${key}\` | ${count} |`),
    '',
  ]
}

function buildMarkdown(output: FamilyClassificationOutput): string {
  const lines = [
    '# ILP Mechanics Family Classification',
    '',
    'This file is generated from the corpus audit and the current catalog snapshot.',
    '',
    `Corpus size: ${output.corpusSize}`,
    '',
    '## Classification Contract',
    '',
    '- `primaryFamily` is structural and mutually exclusive.',
    '- `overlayTags` are cross-cutting mechanics that can apply to any primary family.',
    '- `implementationCohort` groups insurer-shaped rollout work without replacing the primary family axis.',
    '- `v1SupportBoundary` is the current V1 planning boundary, not a public support claim by itself.',
    '- `kernelWorkstreams` compress the overlay set into real implementation tracks. The core cashflow kernel intentionally combines dynamic charge, premium-holiday/recovery, and ad-hoc routing.',
    '',
    ...formatCountTable('Primary Families', output.primaryFamilies),
    ...formatCountTable('Overlay Counts', output.overlayCounts),
    ...formatCountTable('Implementation Cohorts', output.implementationCohorts),
    ...formatCountTable('V1 Support Boundaries', output.v1SupportBoundaries),
    ...formatCountTable('Kernel Workstream Tiers', output.kernelTiers),
    '## Product Matrix',
    '',
    '| File | Primary family | Overlays | Cohort | Boundary | Kernel tier | Catalog status | Golden coverage |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...output.rows.map((row) => {
      const overlays = row.overlayTags.length > 0 ? row.overlayTags.join(', ') : '—'
      return `| ${row.sourceFileName.replace(/\|/g, '\\|')} | \`${row.primaryFamily}\` | ${overlays.replace(/\|/g, '\\|')} | \`${row.implementationCohort}\` | \`${row.v1SupportBoundary}\` | \`${row.kernelTier}\` | \`${row.currentCatalogStatus}\` | \`${row.goldenCoverageStatus}\` |`
    }),
    '',
  ]

  return `${lines.join('\n')}\n`
}

async function main() {
  const [auditRows, catalogProducts, discovery, fixtureFiles] = await Promise.all([
    readFile(AUDIT_PATH, 'utf8').then((value) => JSON.parse(value) as AuditRow[]),
    readFile(CATALOG_PATH, 'utf8').then((value) => JSON.parse(value) as CatalogProduct[]),
    discoverManualCatalogSources(),
    readdir(GOLDEN_FIXTURE_DIR),
  ])
  const lowConfidenceQaByFile = await readLowConfidenceQaReviews()

  const catalogBySourceFile = new Map(catalogProducts.map((product) => [product.sourceFileName, product]))
  const sourceByFileName = new Map(discovery.summarySources.map((source) => [source.fileName, source]))

  const coveredProductIds = new Set<string>()
  for (const fileName of fixtureFiles) {
    for (const product of catalogProducts) {
      if (fileName.startsWith(`${product.id}-`)) {
        coveredProductIds.add(product.id)
      }
    }
  }

  const rows = auditRows
    .map((row) => {
      const catalogProduct = catalogBySourceFile.get(row.fileName)
      const source = sourceByFileName.get(row.fileName)
      const qaReview = lowConfidenceQaByFile.get(row.fileName)
      const productKey = source?.productKey ?? catalogProduct?.id ?? slugify(`${row.insurer}-${row.productName}`)
      const inferredPrimaryFamily = detectPrimaryFamily(row)
      const primaryFamily =
        qaReview?.decision === 'reclassify-protection-heavy'
          ? 'protection-heavy-death-benefit'
          : qaReview?.decision === 'reclassify-multi-account'
            ? 'multi-account-special-account'
            : inferredPrimaryFamily
      const overlayTags = uniqueSorted([
        ...detectOverlayTags(row),
        ...(qaReview?.decision === 'reclassify-protection-heavy' ? ['protection-structure'] : []),
      ]) as OverlayTag[]
      const implementationCohort = detectImplementationCohort(row)
      const v1SupportBoundary = detectSupportCeiling(row, primaryFamily, overlayTags, catalogProduct)
      const manualInputRequirements = gatherManualInputRequirements(catalogProduct)
      const kernelWorkstreams = inferKernelWorkstreams(primaryFamily, overlayTags, v1SupportBoundary, catalogProduct)
      const confidence =
        qaReview?.decision === 'confirmed-standard'
          ? 0.9
          : qaReview?.decision === 'reclassify-protection-heavy' || qaReview?.decision === 'reclassify-multi-account'
            ? 0.92
            : inferConfidence(row, catalogProduct, primaryFamily)

      return {
        productKey,
        sourceFileName: row.fileName,
        insurer: row.insurer,
        productName: row.productName,
        auditBucket: row.bucket,
        gapTags: row.gapTags,
        primaryFamily,
        overlayTags,
        implementationCohort,
        v1SupportBoundary,
        currentCatalogStatus: catalogProduct?.supportStatus ?? 'not-in-catalog',
        economicsStatus: catalogProduct?.economicsStatus ?? 'not-modeled',
        parserExists: Boolean(catalogProduct),
        goldenCoverageStatus: detectGoldenCoverageStatus(catalogProduct, coveredProductIds),
        kernelWorkstreams,
        kernelTier: inferKernelTier(kernelWorkstreams),
        kernelPrerequisites: inferKernelPrerequisites(primaryFamily, overlayTags, v1SupportBoundary, catalogProduct),
        modeledSubsetAlreadyCovered: catalogProduct?.modeledEconomics ?? [],
        metadataOnlyBehaviors: catalogProduct?.metadataOnlyBehaviors ?? [],
        manualInputRequirements,
        classificationRationale: buildRationale(row, primaryFamily, overlayTags, implementationCohort, catalogProduct, qaReview),
        confidence,
        evidenceRefs: buildEvidenceRefs(row, productKey, primaryFamily, overlayTags, implementationCohort, catalogProduct, qaReview),
      } satisfies FamilyClassificationRow
    })
    .sort((left, right) => left.sourceFileName.localeCompare(right.sourceFileName))

  const output: FamilyClassificationOutput = {
    corpusSize: rows.length,
    primaryFamilies: summarizeCounts(rows.map((row) => row.primaryFamily)),
    overlayCounts: summarizeCounts(rows.flatMap((row) => row.overlayTags)),
    v1SupportBoundaries: summarizeCounts(rows.map((row) => row.v1SupportBoundary)),
    implementationCohorts: summarizeCounts(rows.map((row) => row.implementationCohort)),
    kernelTiers: summarizeCounts(rows.map((row) => row.kernelTier)),
    rows,
  }

  await mkdir(path.dirname(OUTPUT_JSON_PATH), { recursive: true })
  await mkdir(path.dirname(OUTPUT_MD_PATH), { recursive: true })
  await writeFile(OUTPUT_JSON_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(OUTPUT_MD_PATH, buildMarkdown(output), 'utf8')

  console.log(`Wrote family classification JSON to ${OUTPUT_JSON_PATH}`)
  console.log(`Wrote family classification markdown to ${OUTPUT_MD_PATH}`)
}

await main()
