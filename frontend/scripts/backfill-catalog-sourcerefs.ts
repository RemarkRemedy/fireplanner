/**
 * Recover empty ILP catalog sourceRefs from prepared chunks / evidence packets.
 *
 * Usage:
 *   npx tsx frontend/scripts/backfill-catalog-sourcerefs.ts
 *   npx tsx frontend/scripts/backfill-catalog-sourcerefs.ts --dry-run
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type RuleType = 'bonus' | 'event' | 'fee'
type MatchSource = 'evidence' | 'prepared-chunk'
type BackfillClassification = 'high-confidence' | 'low-confidence' | 'no-source'

interface SourceRef {
  page: number
  section: string
  excerpt: string
}

interface CatalogRule {
  id: string
  label: string
  sourceRefs: SourceRef[]
  trigger?: string
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
  sourceFileName: string
  variants: CatalogVariant[]
}

interface PreparedChunk {
  chunkId: string
  pageStart: number
  pageEnd: number
  sectionId: string
  heading: string | null
  text: string
  keywords: string[]
  sourceRefs: Array<{
    page: number
    excerpt: string
  }>
}

interface PreparedArtifact {
  sourceFileName: string
  chunks: PreparedChunk[]
}

interface EvidenceCandidate {
  candidateId: string
  chunkId: string
  pageStart: number
  pageEnd: number
  sectionId: string
  heading: string | null
  excerpt: string
  matchedPhrases: string[]
  score: number
  sourceRefs: Array<{
    page: number
    excerpt: string
  }>
}

interface EvidenceFieldPacket {
  fieldId: string
  label: string
  status: 'candidate-found' | 'not-detected'
  candidateCount: number
  bestCandidate: EvidenceCandidate | null
  candidates?: EvidenceCandidate[]
}

interface EvidenceArtifact {
  sourceFileName: string
  fieldPackets: Record<string, EvidenceFieldPacket>
}

interface RuleContext {
  productId: string
  productName: string
  sourceFileName: string
  variantId: string
  ruleType: RuleType
  ruleId: string
  ruleLabel: string
  trigger?: string
}

interface MatchCandidate {
  source: MatchSource
  page: number
  section: string
  excerpt: string
  confidence: number
  keywordMatches: number
  keywordCoverage: number
  phraseMatches: number
  labelAnchorMatches: number
  sectionLabelAnchorMatches: number
  anchorOffset: number
  sectionMatch: boolean
  evidenceScore?: number
  chunkId: string
}

interface AutoWrittenEntry {
  product: string
  variantId: string
  ruleType: RuleType
  ruleId: string
  ruleLabel: string
  sourceRefs: SourceRef[]
  confidence: number
  matchSource: MatchSource
}

interface NeedsReviewEntry {
  product: string
  variantId: string
  ruleType: RuleType
  ruleId: string
  ruleLabel: string
  bestCandidates: Array<{
    page: number
    excerpt: string
    score: number
    source: MatchSource
  }>
  reason: string
}

interface NoSourceEntry {
  product: string
  variantId: string
  ruleType: RuleType
  ruleId: string
  ruleLabel: string
}

interface ReviewFile {
  summary: {
    totalEmpty: number
    highConfidence: number
    lowConfidence: number
    noSource: number
  }
  autoWritten: AutoWrittenEntry[]
  needsReview: NeedsReviewEntry[]
  noSource: NoSourceEntry[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = resolve(__dirname, '..')
const REPO_ROOT = resolve(FRONTEND_DIR, '..')
const CATALOG_PATH = resolve(FRONTEND_DIR, 'src/lib/data/generated/ilpCatalog.products.json')
const PREPARED_DIR = resolve(FRONTEND_DIR, 'scripts/ilp-catalog/fixtures/prepared')
const EVIDENCE_DIR = resolve(FRONTEND_DIR, 'scripts/ilp-catalog/fixtures/evidence')
const REVIEW_PATH = resolve(REPO_ROOT, 'docs/codex-prompts/sourceref-backfill-review.json')

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
  'cash',
  'srs',
  'cpf',
  'paid',
  'payable',
  'amount',
  'plan',
])

const GENERIC_LABEL_TAIL_WORDS = new Set(['charge', 'bonus', 'fee', 'fees'])

const artifactCache = new Map<string, { prepared: PreparedArtifact | null, evidence: EvidenceArtifact | null }>()

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compactText(value: string): string {
  return normalizeText(value).replace(/\s+/g, '')
}

function normalizeArtifactStem(fileName: string): string {
  return fileName
    .replace(/\.(pdf|json)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-json$/i, '')
    .replace(/^-+|-+$/g, '')
}

function titleCaseSection(sectionId: string): string {
  return sectionId
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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

function extractSearchPhrases(label: string, ruleId: string): string[] {
  const rawTokens = label
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const phrases = new Set<string>()

  if (rawTokens.length > 0) {
    const exact = rawTokens.join(' ')
    phrases.add(exact)
    phrases.add(exact.replace(/-/g, ' '))
    phrases.add(exact.replace(/-/g, ''))

    let trimmed = [...rawTokens]
    while (trimmed.length > 0 && GENERIC_LABEL_TAIL_WORDS.has(trimmed[trimmed.length - 1].replace(/-/g, ''))) {
      trimmed = trimmed.slice(0, -1)
    }

    if (trimmed.length > 0) {
      const significant = trimmed.join(' ')
      phrases.add(significant)
      phrases.add(significant.replace(/-/g, ' '))
      phrases.add(significant.replace(/-/g, ''))
    }
  }

  const ruleIdPhrase = ruleId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  if (ruleIdPhrase) {
    phrases.add(ruleIdPhrase)
  }

  return [...phrases].filter((phrase) => phrase.length >= 4)
}

function extractLabelAnchorPhrases(label: string): string[] {
  const withoutParenthetical = label.replace(/\([^)]*\)/g, ' ')
  const normalized = withoutParenthetical
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim()

  if (!normalized) {
    return []
  }

  const phrases = new Set<string>()
  phrases.add(normalized)
  phrases.add(normalized.replace(/-/g, ' '))
  phrases.add(normalized.replace(/-/g, ''))

  return [...phrases].filter((phrase) => phrase.length >= 4)
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function countKeywordMatches(text: string, keywords: string[]): number {
  if (keywords.length === 0) {
    return 0
  }

  const normalized = normalizeText(text)
  const compact = normalized.replace(/\s+/g, '')

  return keywords.filter((keyword) => normalized.includes(keyword) || compact.includes(keyword)).length
}

function countPhraseMatches(text: string, phrases: string[]): number {
  if (phrases.length === 0) {
    return 0
  }

  const normalized = normalizeText(text)
  const compact = normalized.replace(/\s+/g, '')

  return phrases.filter((phrase) => {
    const normalizedPhrase = normalizeText(phrase)
    const compactPhrase = normalizedPhrase.replace(/\s+/g, '')
    return normalized.includes(normalizedPhrase) || compact.includes(compactPhrase)
  }).length
}

function findFirstAnchorOffset(text: string, phrases: string[]): number {
  const normalized = normalizeText(text)
  let best = Number.POSITIVE_INFINITY

  for (const phrase of phrases) {
    const idx = normalized.indexOf(normalizeText(phrase))
    if (idx >= 0 && idx < best) {
      best = idx
    }
  }

  return Number.isFinite(best) ? best : -1
}

function buildSectionText(sectionId: string, heading: string | null): string {
  return `${sectionId} ${heading ?? ''}`.trim()
}

function getEventFieldIds(rule: CatalogRule): string[] {
  switch (rule.trigger) {
    case 'partial-withdrawal':
      return ['partial-withdrawal', 'early-exit-charge', 'fees-and-charges']
    case 'premium-holiday':
      return ['premium-holiday', 'premium-payment', 'fees-and-charges']
    case 'top-up':
      return ['premium-payment', 'fees-and-charges']
    case 'premium-holiday-repayment':
      return ['premium-payment', 'premium-holiday', 'fees-and-charges']
    case 'regular-premium-reduction':
      return ['bonus', 'premium-payment', 'fees-and-charges']
    default:
      return ['fees-and-charges', 'premium-payment', 'bonus', 'partial-withdrawal', 'premium-holiday', 'early-exit-charge']
  }
}

function getEvidenceFieldIds(ruleType: RuleType, rule: CatalogRule): string[] {
  if (ruleType === 'bonus') {
    return ['bonus']
  }
  if (ruleType === 'event') {
    return getEventFieldIds(rule)
  }
  return ['fees-and-charges']
}

function isSectionMatch(ruleType: RuleType, rule: CatalogRule, chunk: PreparedChunk): boolean {
  const sectionText = normalizeText(buildSectionText(chunk.sectionId, chunk.heading))

  if (ruleType === 'bonus') {
    return sectionText.includes('bonus')
  }

  if (ruleType === 'event') {
    switch (rule.trigger) {
      case 'partial-withdrawal':
        return sectionText.includes('withdrawal')
          || sectionText.includes('partial')
          || sectionText.includes('early exit')
        case 'premium-holiday':
        return sectionText.includes('holiday')
          || sectionText.includes('premium holiday')
        case 'top-up':
          return sectionText.includes('top up')
            || sectionText.includes('topup')
            || sectionText.includes('premium charge')
            || sectionText.includes('fees')
        case 'premium-holiday-repayment':
          return sectionText.includes('premium')
            || sectionText.includes('holiday')
            || sectionText.includes('repayment')
        case 'regular-premium-reduction':
          return sectionText.includes('bonus')
            || sectionText.includes('reduction')
            || sectionText.includes('premium')
        default:
          return sectionText.includes('fees')
            || sectionText.includes('charges')
      }
  }

  return sectionText.includes('fees') || sectionText.includes('charges')
}

function buildExcerpt(text: string, keywords: string[], phrases: string[]): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  if (normalizedText.length <= 220) {
    return normalizedText
  }

  const lowerText = normalizedText.toLowerCase()
  const searchTerms = unique([
    ...phrases.map((phrase) => phrase.toLowerCase()),
    ...keywords.map((keyword) => keyword.toLowerCase()),
  ]).filter(Boolean)

  let anchorIndex = -1
  for (const term of searchTerms) {
    anchorIndex = lowerText.indexOf(term)
    if (anchorIndex >= 0) {
      break
    }
  }

  if (anchorIndex < 0) {
    return `${normalizedText.slice(0, 217).trim()}...`
  }

  const radius = 100
  let start = Math.max(0, anchorIndex - radius)
  let end = Math.min(normalizedText.length, anchorIndex + radius)

  while (start > 0 && normalizedText[start] !== ' ') {
    start -= 1
  }
  while (end < normalizedText.length && normalizedText[end] !== ' ') {
    end += 1
  }

  const excerpt = normalizedText.slice(start, end).trim()
  const prefixed = start > 0 ? `...${excerpt}` : excerpt
  const suffixed = end < normalizedText.length ? `${prefixed}...` : prefixed

  return suffixed.length <= 240 ? suffixed : `${suffixed.slice(0, 237).trim()}...`
}

function loadCatalog(): CatalogProduct[] {
  return JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as CatalogProduct[]
}

function loadArtifactBundle(sourceFileName: string): { prepared: PreparedArtifact | null, evidence: EvidenceArtifact | null } {
  const stem = normalizeArtifactStem(sourceFileName)
  const cached = artifactCache.get(stem)
  if (cached) {
    return cached
  }

  const preparedPath = resolve(PREPARED_DIR, `${stem}.json`)
  const evidencePath = resolve(EVIDENCE_DIR, `${stem}.json`)
  const bundle = {
    prepared: existsSync(preparedPath)
      ? JSON.parse(readFileSync(preparedPath, 'utf8')) as PreparedArtifact
      : null,
    evidence: existsSync(evidencePath)
      ? JSON.parse(readFileSync(evidencePath, 'utf8')) as EvidenceArtifact
      : null,
  }

  artifactCache.set(stem, bundle)
  return bundle
}

function scoreEvidenceCandidates(
  context: RuleContext,
  rule: CatalogRule,
  prepared: PreparedArtifact,
  evidence: EvidenceArtifact | null,
  keywords: string[],
  phrases: string[],
  labelAnchors: string[],
): MatchCandidate[] {
  if (!evidence) {
    return []
  }

  const chunkById = new Map(prepared.chunks.map((chunk) => [chunk.chunkId, chunk]))
  const candidates: MatchCandidate[] = []

  for (const fieldId of getEvidenceFieldIds(context.ruleType, rule)) {
    const packet = evidence.fieldPackets[fieldId]
    if (!packet || packet.status !== 'candidate-found') {
      continue
    }

    for (const candidate of packet.candidates ?? []) {
      const chunk = chunkById.get(candidate.chunkId)
      if (!chunk) {
        continue
      }

      const corpusText = [
        candidate.heading ?? '',
        candidate.excerpt,
        candidate.matchedPhrases.join(' '),
        chunk.text,
      ].join(' ')

      const keywordMatches = countKeywordMatches(corpusText, keywords)
      const phraseMatches = countPhraseMatches(corpusText, phrases)
      const labelAnchorMatches = countPhraseMatches(corpusText, labelAnchors)
      const sectionLabelAnchorMatches = countPhraseMatches(buildSectionText(chunk.sectionId, chunk.heading), labelAnchors)
      const anchorOffset = findFirstAnchorOffset(chunk.text, labelAnchors)
      const keywordCoverage = keywords.length > 0 ? keywordMatches / keywords.length : phraseMatches > 0 ? 1 : 0
      const sectionMatch = isSectionMatch(context.ruleType, rule, chunk)

      if (keywordMatches === 0 && phraseMatches === 0 && labelAnchorMatches === 0) {
        continue
      }

      const confidence = Math.min(
        100,
        candidate.score
          + keywordMatches * 12
          + phraseMatches * 10
          + labelAnchorMatches * 14
          + sectionLabelAnchorMatches * 20
          + (anchorOffset >= 0 && anchorOffset < 180 ? 10 : 0)
          + (sectionMatch ? 8 : 0),
      )

      candidates.push({
        source: 'evidence',
        page: candidate.pageStart,
        section: chunk.heading ?? titleCaseSection(chunk.sectionId),
        excerpt: buildExcerpt(chunk.text, keywords, phrases),
        confidence,
        keywordMatches,
        keywordCoverage,
        phraseMatches,
        labelAnchorMatches,
        sectionLabelAnchorMatches,
        anchorOffset,
        sectionMatch,
        evidenceScore: candidate.score,
        chunkId: chunk.chunkId,
      })
    }
  }

  return candidates
}

function scorePreparedChunks(
  context: RuleContext,
  rule: CatalogRule,
  prepared: PreparedArtifact,
  keywords: string[],
  phrases: string[],
  labelAnchors: string[],
): MatchCandidate[] {
  const matches: MatchCandidate[] = []

  for (const chunk of prepared.chunks) {
    const sectionText = buildSectionText(chunk.sectionId, chunk.heading)
    const corpusText = [sectionText, chunk.text, chunk.keywords.join(' ')].join(' ')
    const keywordMatches = countKeywordMatches(corpusText, keywords)
    const phraseMatches = countPhraseMatches(corpusText, phrases)
    const labelAnchorMatches = countPhraseMatches(corpusText, labelAnchors)
    const sectionLabelAnchorMatches = countPhraseMatches(sectionText, labelAnchors)
    const anchorOffset = findFirstAnchorOffset(chunk.text, labelAnchors)
    const keywordCoverage = keywords.length > 0 ? keywordMatches / keywords.length : phraseMatches > 0 ? 1 : 0
    const sectionMatch = isSectionMatch(context.ruleType, rule, chunk)

    const isMatch = keywordCoverage >= 0.5 || phraseMatches > 0 || labelAnchorMatches > 0
    if (!isMatch) {
      continue
    }

    const confidence = Math.min(
      100,
      40
        + keywordMatches * 18
        + phraseMatches * 12
        + labelAnchorMatches * 14
        + sectionLabelAnchorMatches * 20
        + (anchorOffset >= 0 && anchorOffset < 180 ? 10 : 0)
        + (sectionMatch ? 15 : 0),
    )

    matches.push({
      source: 'prepared-chunk',
      page: chunk.pageStart,
      section: chunk.heading ?? titleCaseSection(chunk.sectionId),
      excerpt: buildExcerpt(chunk.text, keywords, phrases),
      confidence,
      keywordMatches,
      keywordCoverage,
      phraseMatches,
      labelAnchorMatches,
      sectionLabelAnchorMatches,
      anchorOffset,
      sectionMatch,
      chunkId: chunk.chunkId,
    })
  }

  return matches
}

function requiredKeywordMatches(keywords: string[], phrases: string[]): number {
  if (keywords.length >= 2) {
    return 2
  }
  if (keywords.length === 1) {
    return 1
  }
  return phrases.length > 0 ? 1 : 99
}

function isHighConfidenceCandidate(match: MatchCandidate, keywords: string[], phrases: string[]): boolean {
  const needed = requiredKeywordMatches(keywords, phrases)
  const hasStrongTextMatch = match.keywordMatches >= needed || (needed === 1 && match.phraseMatches > 0)
  const namesRuleDirectly = match.labelAnchorMatches > 0
  const namesRuleInSection = match.sectionLabelAnchorMatches > 0
  const namesRuleEarlyInChunk = match.anchorOffset >= 0 && match.anchorOffset < 180

  if (match.source === 'evidence') {
    return (match.evidenceScore ?? 0) >= 70
      && hasStrongTextMatch
      && namesRuleDirectly
      && (match.sectionMatch || namesRuleInSection || namesRuleEarlyInChunk)
  }

  return (match.sectionMatch || namesRuleInSection || namesRuleEarlyInChunk)
    && hasStrongTextMatch
    && namesRuleDirectly
}

function dedupeMatches(matches: MatchCandidate[]): MatchCandidate[] {
  const bestByKey = new Map<string, MatchCandidate>()

  for (const match of matches) {
    const key = `${match.page}|${match.section}|${compactText(match.excerpt)}`
    const existing = bestByKey.get(key)
    if (!existing || match.confidence > existing.confidence) {
      bestByKey.set(key, match)
    }
  }

  return [...bestByKey.values()].sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence
    }
    if (b.sectionLabelAnchorMatches !== a.sectionLabelAnchorMatches) {
      return b.sectionLabelAnchorMatches - a.sectionLabelAnchorMatches
    }
    if (Number(b.anchorOffset >= 0 && b.anchorOffset < 180) !== Number(a.anchorOffset >= 0 && a.anchorOffset < 180)) {
      return Number(b.anchorOffset >= 0 && b.anchorOffset < 180) - Number(a.anchorOffset >= 0 && a.anchorOffset < 180)
    }
    if (b.labelAnchorMatches !== a.labelAnchorMatches) {
      return b.labelAnchorMatches - a.labelAnchorMatches
    }
    if (Number(b.sectionMatch) !== Number(a.sectionMatch)) {
      return Number(b.sectionMatch) - Number(a.sectionMatch)
    }
    if (b.keywordMatches !== a.keywordMatches) {
      return b.keywordMatches - a.keywordMatches
    }
    if (b.phraseMatches !== a.phraseMatches) {
      return b.phraseMatches - a.phraseMatches
    }
    return a.page - b.page
  })
}

function classifyMatches(matches: MatchCandidate[], keywords: string[], phrases: string[]): BackfillClassification {
  if (matches.length === 0) {
    return 'low-confidence'
  }

  if (matches.some((match) => isHighConfidenceCandidate(match, keywords, phrases))) {
    return 'high-confidence'
  }

  return 'low-confidence'
}

function collectEmptyRules(catalog: CatalogProduct[]): Array<{ context: RuleContext, rule: CatalogRule }> {
  const emptyRules: Array<{ context: RuleContext, rule: CatalogRule }> = []

  for (const product of catalog) {
    for (const variant of product.variants ?? []) {
      for (const rule of variant.bonuses ?? []) {
        if (rule.sourceRefs.length === 0) {
          emptyRules.push({
            context: {
              productId: product.id,
              productName: product.productName,
              sourceFileName: product.sourceFileName,
              variantId: variant.id,
              ruleType: 'bonus',
              ruleId: rule.id,
              ruleLabel: rule.label,
            },
            rule,
          })
        }
      }

      for (const rule of variant.eventChargeRules ?? []) {
        if (rule.sourceRefs.length === 0) {
          emptyRules.push({
            context: {
              productId: product.id,
              productName: product.productName,
              sourceFileName: product.sourceFileName,
              variantId: variant.id,
              ruleType: 'event',
              ruleId: rule.id,
              ruleLabel: rule.label,
              trigger: rule.trigger,
            },
            rule,
          })
        }
      }

      for (const rule of variant.feeRules ?? []) {
        if (rule.sourceRefs.length === 0) {
          emptyRules.push({
            context: {
              productId: product.id,
              productName: product.productName,
              sourceFileName: product.sourceFileName,
              variantId: variant.id,
              ruleType: 'fee',
              ruleId: rule.id,
              ruleLabel: rule.label,
            },
            rule,
          })
        }
      }
    }
  }

  return emptyRules
}

function writeSourceRefsToCatalog(catalog: CatalogProduct[], autoWritten: AutoWrittenEntry[]): CatalogProduct[] {
  const sourceRefMap = new Map(
    autoWritten.map((entry) => [
      `${entry.product}|${entry.variantId}|${entry.ruleType}|${entry.ruleId}`,
      entry.sourceRefs,
    ]),
  )

  return catalog.map((product) => ({
    ...product,
    variants: (product.variants ?? []).map((variant) => ({
      ...variant,
      bonuses: (variant.bonuses ?? []).map((rule) => ({
        ...rule,
        sourceRefs: sourceRefMap.get(`${product.id}|${variant.id}|bonus|${rule.id}`) ?? rule.sourceRefs,
      })),
      eventChargeRules: (variant.eventChargeRules ?? []).map((rule) => ({
        ...rule,
        sourceRefs: sourceRefMap.get(`${product.id}|${variant.id}|event|${rule.id}`) ?? rule.sourceRefs,
      })),
      feeRules: (variant.feeRules ?? []).map((rule) => ({
        ...rule,
        sourceRefs: sourceRefMap.get(`${product.id}|${variant.id}|fee|${rule.id}`) ?? rule.sourceRefs,
      })),
    })),
  }))
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run')
  const catalog = loadCatalog()
  const emptyRules = collectEmptyRules(catalog)

  const autoWritten: AutoWrittenEntry[] = []
  const needsReview: NeedsReviewEntry[] = []
  const noSource: NoSourceEntry[] = []

  for (const { context, rule } of emptyRules) {
    const { prepared, evidence } = loadArtifactBundle(context.sourceFileName)
    if (!prepared) {
      noSource.push({
        product: context.productId,
        variantId: context.variantId,
        ruleType: context.ruleType,
        ruleId: context.ruleId,
        ruleLabel: context.ruleLabel,
      })
      continue
    }

    const keywords = extractKeywords(rule.label)
    const phrases = extractSearchPhrases(rule.label, rule.id)
    const labelAnchors = extractLabelAnchorPhrases(rule.label)
    const matches = dedupeMatches([
      ...scoreEvidenceCandidates(context, rule, prepared, evidence, keywords, phrases, labelAnchors),
      ...scorePreparedChunks(context, rule, prepared, keywords, phrases, labelAnchors),
    ])

    const classification = classifyMatches(matches, keywords, phrases)

    if (classification === 'high-confidence') {
      const chosen = matches
        .filter((match) => isHighConfidenceCandidate(match, keywords, phrases))
        .slice(0, 2)
      autoWritten.push({
        product: context.productId,
        variantId: context.variantId,
        ruleType: context.ruleType,
        ruleId: context.ruleId,
        ruleLabel: context.ruleLabel,
        sourceRefs: chosen.map((match) => ({
          page: match.page,
          section: match.section,
          excerpt: match.excerpt,
        })),
        confidence: chosen[0]?.confidence ?? 0,
        matchSource: chosen[0]?.source ?? 'prepared-chunk',
      })
      continue
    }

    needsReview.push({
      product: context.productId,
      variantId: context.variantId,
      ruleType: context.ruleType,
      ruleId: context.ruleId,
      ruleLabel: context.ruleLabel,
      bestCandidates: matches.slice(0, 5).map((match) => ({
        page: match.page,
        excerpt: match.excerpt,
        score: match.confidence,
        source: match.source,
      })),
      reason: matches.length === 0
        ? 'No prepared/evidence candidate matched the rule keywords.'
        : 'Only low-confidence matches were found; manual review required.',
    })
  }

  const reviewFile: ReviewFile = {
    summary: {
      totalEmpty: emptyRules.length,
      highConfidence: autoWritten.length,
      lowConfidence: needsReview.length,
      noSource: noSource.length,
    },
    autoWritten,
    needsReview,
    noSource,
  }

  writeFileSync(REVIEW_PATH, `${JSON.stringify(reviewFile, null, 2)}\n`)

  if (!dryRun && autoWritten.length > 0) {
    const updatedCatalog = writeSourceRefsToCatalog(catalog, autoWritten)
    writeFileSync(CATALOG_PATH, `${JSON.stringify(updatedCatalog, null, 2)}\n`)
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        reviewPath: REVIEW_PATH,
        summary: reviewFile.summary,
      },
      null,
      2,
    ),
  )
}

main()
