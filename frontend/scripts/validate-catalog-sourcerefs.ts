/**
 * Validate ILP catalog sourceRef quality and optionally strip known-bad refs.
 *
 * Run this after every catalog rebuild, especially when new products are added
 * or parser/sourceRef extraction logic changes.
 *
 * Usage:
 *   npx tsx frontend/scripts/validate-catalog-sourcerefs.ts
 *   npx tsx frontend/scripts/validate-catalog-sourcerefs.ts --fix
 *
 * Detection mode:
 * - Preferred: use docs/codex-prompts/sourceref-quality-issues.json as the
 *   authoritative list of curated bad sourceRefs for this catalog version.
 * - Fallback: when the curated list is unavailable, use label keyword matching
 *   to flag refs whose section/excerpt do not mention a significant rule label
 *   keyword.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type RuleType = 'bonus' | 'event' | 'fee'

interface SourceRef {
  page: number
  section: string
  excerpt: string
}

interface CatalogRule {
  id: string
  label: string
  sourceRefs: SourceRef[]
}

interface CatalogVariant {
  id: string
  bonuses: CatalogRule[]
  eventChargeRules: CatalogRule[]
  feeRules: CatalogRule[]
}

interface CatalogProduct {
  id: string
  productName: string
  variants: CatalogVariant[]
}

interface QualityIssueEntry {
  product: string
  productName: string
  variantId: string
  ruleType: 'bonus' | 'event' | 'fee'
  ruleId: string
  ruleLabel: string
  sourceRefs: SourceRef[]
}

interface RuleContext {
  productId: string
  productName: string
  variantId: string
  ruleType: RuleType
  ruleId: string
  ruleLabel: string
}

interface FlaggedRefDetail extends RuleContext {
  sourceRef: SourceRef
  reason: 'curated-issue-list' | 'keyword-miss'
  keywords: string[]
}

interface RuleSummary {
  totalRules: number
  rulesWithRelevantRefs: number
  rulesWithIrrelevantRefs: number
  rulesWithoutSourceRefs: number
  totalSourceRefs: number
  irrelevantSourceRefs: number
}

interface ValidationReport {
  detectionMode: 'curated-issue-list' | 'keyword-fallback'
  summary: {
    totalRules: number
    rulesWithRelevantRefs: number
    rulesWithIrrelevantRefs: number
    rulesWithoutSourceRefs: number
    totalSourceRefs: number
    irrelevantSourceRefs: number
    byType: Record<RuleType, RuleSummary>
  }
  detail: FlaggedRefDetail[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = resolve(__dirname, '..')
const REPO_ROOT = resolve(FRONTEND_DIR, '..')
const CATALOG_PATH = resolve(FRONTEND_DIR, 'src/lib/data/generated/ilpCatalog.products.json')
const ISSUES_PATH = resolve(REPO_ROOT, 'docs/codex-prompts/sourceref-quality-issues.json')
const STOP_WORDS = new Set([
  'charge',
  'bonus',
  'fees',
  'fee',
  'policy',
  'premium',
  'regular',
  'single',
  'annual',
  'monthly',
  'year',
  'years',
  'during',
  'after',
  'before',
  'through',
  'into',
  'onto',
  'that',
  'this',
  'then',
  'than',
  'from',
  'with',
  'without',
  'within',
  'the',
  'and',
  'for',
  'when',
  'your',
])

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function extractKeywords(label: string): string[] {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim()

  if (!normalized) {
    return []
  }

  const candidates = new Set<string>()

  for (const token of normalized.split(/\s+/)) {
    if (!token) {
      continue
    }

    const collapsed = token.replace(/-/g, '')
    if (collapsed.length > 3 && !STOP_WORDS.has(collapsed)) {
      candidates.add(collapsed)
    }

    for (const part of token.split('-')) {
      if (part.length > 3 && !STOP_WORDS.has(part)) {
        candidates.add(part)
      }
    }
  }

  return [...candidates]
}

function sourceRefContainsKeyword(sourceRef: SourceRef, keywords: string[]): boolean {
  if (keywords.length === 0) {
    return false
  }

  const haystack = normalizeText(`${sourceRef.section} ${sourceRef.excerpt}`)
  const compactHaystack = haystack.replace(/\s+/g, '')

  return keywords.some((keyword) => haystack.includes(keyword) || compactHaystack.includes(keyword))
}

function makeRefKey(context: RuleContext, sourceRef: SourceRef): string {
  return [
    context.productId,
    context.variantId,
    context.ruleType,
    context.ruleId,
    String(sourceRef.page),
    sourceRef.section,
    sourceRef.excerpt,
  ].join('|')
}

function loadCatalog(): CatalogProduct[] {
  return JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as CatalogProduct[]
}

function loadCuratedIssueRefKeys(): Set<string> | null {
  if (!existsSync(ISSUES_PATH)) {
    return null
  }

  const issues = JSON.parse(readFileSync(ISSUES_PATH, 'utf8')) as QualityIssueEntry[]
  const keys = new Set<string>()

  for (const issue of issues) {
    for (const sourceRef of issue.sourceRefs) {
      keys.add(
        makeRefKey(
          {
            productId: issue.product,
            productName: issue.productName,
            variantId: issue.variantId,
            ruleType: issue.ruleType,
            ruleId: issue.ruleId,
            ruleLabel: issue.ruleLabel,
          },
          sourceRef,
        ),
      )
    }
  }

  return keys
}

function emptySummary(): RuleSummary {
  return {
    totalRules: 0,
    rulesWithRelevantRefs: 0,
    rulesWithIrrelevantRefs: 0,
    rulesWithoutSourceRefs: 0,
    totalSourceRefs: 0,
    irrelevantSourceRefs: 0,
  }
}

function buildValidationReport(
  catalog: CatalogProduct[],
  curatedIssueRefKeys: Set<string> | null,
): ValidationReport {
  const detail: FlaggedRefDetail[] = []
  const byType: Record<RuleType, RuleSummary> = {
    bonus: emptySummary(),
    event: emptySummary(),
    fee: emptySummary(),
  }

  for (const product of catalog) {
    for (const variant of product.variants ?? []) {
      const ruleGroups: Array<[RuleType, CatalogRule[]]> = [
        ['bonus', variant.bonuses ?? []],
        ['event', variant.eventChargeRules ?? []],
        ['fee', variant.feeRules ?? []],
      ]

      for (const [ruleType, rules] of ruleGroups) {
        const typeSummary = byType[ruleType]

        for (const rule of rules) {
          typeSummary.totalRules += 1
          typeSummary.totalSourceRefs += rule.sourceRefs.length

          if (rule.sourceRefs.length === 0) {
            typeSummary.rulesWithoutSourceRefs += 1
            continue
          }

          const context: RuleContext = {
            productId: product.id,
            productName: product.productName,
            variantId: variant.id,
            ruleType,
            ruleId: rule.id,
            ruleLabel: rule.label,
          }
          const keywords = extractKeywords(rule.label)
          const irrelevantRefs: FlaggedRefDetail[] = []

          for (const sourceRef of rule.sourceRefs) {
            const isCuratedMismatch = curatedIssueRefKeys?.has(makeRefKey(context, sourceRef)) ?? false
            const keywordMatch = sourceRefContainsKeyword(sourceRef, keywords)
            const isIrrelevant = curatedIssueRefKeys !== null ? isCuratedMismatch : !keywordMatch

            if (!isIrrelevant) {
              continue
            }

            irrelevantRefs.push({
              ...context,
              sourceRef,
              reason: curatedIssueRefKeys !== null ? 'curated-issue-list' : 'keyword-miss',
              keywords,
            })
          }

          if (irrelevantRefs.length > 0) {
            typeSummary.rulesWithIrrelevantRefs += 1
            typeSummary.irrelevantSourceRefs += irrelevantRefs.length
            detail.push(...irrelevantRefs)
          } else {
            typeSummary.rulesWithRelevantRefs += 1
          }
        }
      }
    }
  }

  const summary = {
    totalRules: 0,
    rulesWithRelevantRefs: 0,
    rulesWithIrrelevantRefs: 0,
    rulesWithoutSourceRefs: 0,
    totalSourceRefs: 0,
    irrelevantSourceRefs: 0,
    byType,
  }

  for (const typeSummary of Object.values(byType)) {
    summary.totalRules += typeSummary.totalRules
    summary.rulesWithRelevantRefs += typeSummary.rulesWithRelevantRefs
    summary.rulesWithIrrelevantRefs += typeSummary.rulesWithIrrelevantRefs
    summary.rulesWithoutSourceRefs += typeSummary.rulesWithoutSourceRefs
    summary.totalSourceRefs += typeSummary.totalSourceRefs
    summary.irrelevantSourceRefs += typeSummary.irrelevantSourceRefs
  }

  return {
    detectionMode: curatedIssueRefKeys !== null ? 'curated-issue-list' : 'keyword-fallback',
    summary,
    detail,
  }
}

function applyFixes(catalog: CatalogProduct[], flaggedRefDetails: FlaggedRefDetail[]): CatalogProduct[] {
  const keysToRemove = new Set(flaggedRefDetails.map((detail) => makeRefKey(detail, detail.sourceRef)))

  return catalog.map((product) => ({
    ...product,
    variants: (product.variants ?? []).map((variant) => ({
      ...variant,
      bonuses: (variant.bonuses ?? []).map((rule) =>
        stripRuleSourceRefs(product, variant.id, 'bonus', rule, keysToRemove),
      ),
      eventChargeRules: (variant.eventChargeRules ?? []).map((rule) =>
        stripRuleSourceRefs(product, variant.id, 'event', rule, keysToRemove),
      ),
      feeRules: (variant.feeRules ?? []).map((rule) =>
        stripRuleSourceRefs(product, variant.id, 'fee', rule, keysToRemove),
      ),
    })),
  }))
}

function stripRuleSourceRefs(
  product: CatalogProduct,
  variantId: string,
  ruleType: RuleType,
  rule: CatalogRule,
  keysToRemove: Set<string>,
): CatalogRule {
  const context: RuleContext = {
    productId: product.id,
    productName: product.productName,
    variantId,
    ruleType,
    ruleId: rule.id,
    ruleLabel: rule.label,
  }

  return {
    ...rule,
    sourceRefs: rule.sourceRefs.filter((sourceRef) => !keysToRemove.has(makeRefKey(context, sourceRef))),
  }
}

function printReport(report: ValidationReport, fixApplied: boolean): void {
  console.log(
    JSON.stringify(
      {
        fixApplied,
        detectionMode: report.detectionMode,
        summary: report.summary,
        detail: report.detail,
      },
      null,
      2,
    ),
  )
}

function main(): number {
  const shouldFix = process.argv.includes('--fix')
  const catalog = loadCatalog()
  const curatedIssueRefKeys = loadCuratedIssueRefKeys()
  const initialReport = buildValidationReport(catalog, curatedIssueRefKeys)

  if (!shouldFix) {
    printReport(initialReport, false)
    return initialReport.summary.rulesWithIrrelevantRefs > 0 ? 1 : 0
  }

  const fixedCatalog = applyFixes(catalog, initialReport.detail)
  writeFileSync(CATALOG_PATH, `${JSON.stringify(fixedCatalog, null, 2)}\n`)

  const finalReport = buildValidationReport(fixedCatalog, curatedIssueRefKeys)
  printReport(finalReport, true)
  return finalReport.summary.rulesWithIrrelevantRefs > 0 ? 1 : 0
}

process.exitCode = main()
