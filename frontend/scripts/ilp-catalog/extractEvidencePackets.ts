import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  inferInsurer,
  inferProductName,
  isBrochureFile,
  isSummaryFile,
  slugify,
} from './discovery.js'
import type { IlpCatalogSourceDocumentType } from '../../src/lib/ilp-catalog/types.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures')
const PREPARED_DIR = path.join(FIXTURES_DIR, 'prepared')
const PREPARED_MANIFEST_PATH = path.join(FIXTURES_DIR, 'prepared-manifest.json')
const EVIDENCE_DIR = path.join(FIXTURES_DIR, 'evidence')
const EVIDENCE_MANIFEST_PATH = path.join(FIXTURES_DIR, 'evidence-manifest.json')
const SHA256_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/
const MAX_CANDIDATES_PER_FIELD = 3

type CorpusDocumentType = IlpCatalogSourceDocumentType | 'unclassified'
type DetectedSectionId =
  | 'policy-details'
  | 'bonus'
  | 'fees'
  | 'withdrawal-charge'
  | 'eec'
  | 'death-benefit'
  | 'premium-payment'
  | 'maturity-benefit'

type EvidenceFieldId =
  | 'bonus'
  | 'fees-and-charges'
  | 'early-exit-charge'
  | 'partial-withdrawal'
  | 'premium-payment'
  | 'premium-holiday'
  | 'death-benefit'
  | 'maturity-benefit'

type EvidenceFieldStatus = 'candidate-found' | 'not-detected'

interface PreparedDocumentSignals {
  hasBonus: boolean
  hasFeesAndCharges: boolean
  hasEec: boolean
  hasPartialWithdrawal: boolean
  hasPremiumPayment: boolean
  hasDeathBenefit: boolean
  hasMaturityBenefit: boolean
  hasPremiumHoliday: boolean
}

interface PreparedChunkSourceRef {
  page: number
  excerpt: string
}

interface PreparedChunk {
  chunkId: string
  pageStart: number
  pageEnd: number
  sectionId: DetectedSectionId | 'page-body'
  heading: string | null
  text: string
  keywords: string[]
  sourceRefs: PreparedChunkSourceRef[]
}

interface PreparedArtifact {
  sourceFileName: string
  sourceChecksum: string
  preparedAt: string
  documentType: CorpusDocumentType
  insurer: string
  productName: string
  extractedArtifactPath: string
  textQuality: {
    status: 'clean' | 'fallback-cleaned' | 'needs-review'
    notes: string[]
    removedRepeatedLineCount: number
    removedPageNumberLineCount: number
    ligatureFixCount: number
  }
  normalizedPages: Array<{
    pageNumber: number
    text: string
  }>
  detectedSections: DetectedSectionId[]
  documentSignals: PreparedDocumentSignals
  chunks: PreparedChunk[]
  linkedDocuments: Array<{
    sourceFileName: string
    documentType: CorpusDocumentType
    relationship: 'same-product'
  }>
}

interface PreparedManifestEntry {
  sourceFileName: string
  sourceChecksum: string
  documentType: CorpusDocumentType
  insurer: string
  productName: string
  chunkCount: number
  detectedSections: DetectedSectionId[]
  signals: PreparedDocumentSignals
  preparedArtifactPath: string
}

interface PreparedManifest {
  generatedAt: string
  totalPrepared: number
  entries: PreparedManifestEntry[]
}

interface EvidenceCandidate {
  candidateId: string
  chunkId: string
  pageStart: number
  pageEnd: number
  sectionId: DetectedSectionId | 'page-body'
  heading: string | null
  excerpt: string
  matchedPhrases: string[]
  reasonCodes: string[]
  score: number
  sourceRefs: PreparedChunkSourceRef[]
}

interface EvidenceFieldPacket {
  fieldId: EvidenceFieldId
  label: string
  status: EvidenceFieldStatus
  candidateCount: number
  bestCandidate: EvidenceCandidate | null
  candidates: EvidenceCandidate[]
}

interface EvidenceArtifactSummary {
  fieldsWithCandidates: EvidenceFieldId[]
  fieldsWithoutCandidates: EvidenceFieldId[]
  manualReviewRecommended: boolean
  notes: string[]
}

interface EvidenceArtifact {
  sourceFileName: string
  sourceChecksum: string
  generatedAt: string
  documentType: CorpusDocumentType
  insurer: string
  productName: string
  preparedArtifactPath: string
  documentSignals: PreparedDocumentSignals
  detectedSections: DetectedSectionId[]
  linkedDocuments: PreparedArtifact['linkedDocuments']
  fieldPackets: Record<EvidenceFieldId, EvidenceFieldPacket>
  summary: EvidenceArtifactSummary
}

interface EvidenceManifestEntry {
  sourceFileName: string
  sourceChecksum: string
  insurer: string
  productName: string
  documentType: CorpusDocumentType
  preparedArtifactPath: string
  evidenceArtifactPath: string
  fieldsWithCandidates: EvidenceFieldId[]
  fieldsWithoutCandidates: EvidenceFieldId[]
  manualReviewRecommended: boolean
}

interface EvidenceManifest {
  generatedAt: string
  totalEvidenceArtifacts: number
  entries: EvidenceManifestEntry[]
}

interface EvidenceFieldDefinition {
  id: EvidenceFieldId
  label: string
  preferredSections: Array<DetectedSectionId | 'page-body'>
  headingPatterns: RegExp[]
  phrasePatterns: RegExp[]
  keywordPhrases: string[]
}

const preparedChunkSourceRefSchema = z.object({
  page: z.number().int().min(1),
  excerpt: z.string().min(1),
})

const preparedArtifactSchema = z.object({
  sourceFileName: z.string().min(1),
  sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
  preparedAt: z.string().min(1),
  documentType: z.enum(['summary', 'brochure', 'unclassified']),
  insurer: z.string().min(1),
  productName: z.string().min(1),
  extractedArtifactPath: z.string().min(1),
  textQuality: z.object({
    status: z.enum(['clean', 'fallback-cleaned', 'needs-review']),
    notes: z.array(z.string()),
    removedRepeatedLineCount: z.number().int().min(0),
    removedPageNumberLineCount: z.number().int().min(0),
    ligatureFixCount: z.number().int().min(0),
  }),
  normalizedPages: z.array(z.object({
    pageNumber: z.number().int().min(1),
    text: z.string(),
  })).min(1),
  detectedSections: z.array(z.enum([
    'policy-details',
    'bonus',
    'fees',
    'withdrawal-charge',
    'eec',
    'death-benefit',
    'premium-payment',
    'maturity-benefit',
  ])),
  documentSignals: z.object({
    hasBonus: z.boolean(),
    hasFeesAndCharges: z.boolean(),
    hasEec: z.boolean(),
    hasPartialWithdrawal: z.boolean(),
    hasPremiumPayment: z.boolean(),
    hasDeathBenefit: z.boolean(),
    hasMaturityBenefit: z.boolean(),
    hasPremiumHoliday: z.boolean(),
  }),
  chunks: z.array(z.object({
    chunkId: z.string().min(1),
    pageStart: z.number().int().min(1),
    pageEnd: z.number().int().min(1),
    sectionId: z.union([
      z.enum([
        'policy-details',
        'bonus',
        'fees',
        'withdrawal-charge',
        'eec',
        'death-benefit',
        'premium-payment',
        'maturity-benefit',
      ]),
      z.literal('page-body'),
    ]),
    heading: z.string().min(1).nullable(),
    text: z.string().min(1),
    keywords: z.array(z.string()),
    sourceRefs: z.array(preparedChunkSourceRefSchema).min(1),
  })).min(1),
  linkedDocuments: z.array(z.object({
    sourceFileName: z.string().min(1),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    relationship: z.literal('same-product'),
  })),
})

const preparedManifestSchema = z.object({
  generatedAt: z.string().min(1),
  totalPrepared: z.number().int().min(0),
  entries: z.array(z.object({
    sourceFileName: z.string().min(1),
    sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    insurer: z.string().min(1),
    productName: z.string().min(1),
    chunkCount: z.number().int().min(0),
    detectedSections: z.array(z.enum([
      'policy-details',
      'bonus',
      'fees',
      'withdrawal-charge',
      'eec',
      'death-benefit',
      'premium-payment',
      'maturity-benefit',
    ])),
    signals: z.object({
      hasBonus: z.boolean(),
      hasFeesAndCharges: z.boolean(),
      hasEec: z.boolean(),
      hasPartialWithdrawal: z.boolean(),
      hasPremiumPayment: z.boolean(),
      hasDeathBenefit: z.boolean(),
      hasMaturityBenefit: z.boolean(),
      hasPremiumHoliday: z.boolean(),
    }),
    preparedArtifactPath: z.string().min(1),
  })),
})

const evidenceArtifactSchema = z.object({
  sourceFileName: z.string().min(1),
  sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
})

const FIELD_DEFINITIONS: EvidenceFieldDefinition[] = [
  {
    id: 'bonus',
    label: 'Bonus',
    preferredSections: ['bonus', 'policy-details'],
    headingPatterns: [
      /\bbonus\b/i,
      /\bloyalty bonus\b/i,
      /\bstart-?up bonus\b/i,
      /\bwelcome bonus\b/i,
      /\bspecial bonus\b/i,
    ],
    phrasePatterns: [
      /\bloyalty bonus\b/i,
      /\bstart-?up bonus\b/i,
      /\bwelcome bonus\b/i,
      /\bspecial bonus\b/i,
      /\bbonus units?\b/i,
      /\bbonus\b/i,
    ],
    keywordPhrases: ['bonus', 'loyalty bonus', 'start-up bonus', 'welcome bonus', 'special bonus'],
  },
  {
    id: 'fees-and-charges',
    label: 'Fees and Charges',
    preferredSections: ['fees', 'policy-details'],
    headingPatterns: [
      /\bfees? and charges\b/i,
      /\bpolicy fees?\b/i,
      /\bmanagement fee\b/i,
      /\bpolicy charge\b/i,
      /\binsurance charge\b/i,
    ],
    phrasePatterns: [
      /\bpolicy fees? and charges\b/i,
      /\bfees? and charges\b/i,
      /\bmanagement fee\b/i,
      /\bpolicy charge\b/i,
      /\binsurance charge\b/i,
      /\badministration charge\b/i,
      /\badmin charge\b/i,
    ],
    keywordPhrases: ['fees and charges', 'management fee', 'policy charge', 'insurance charge', 'administration charge'],
  },
  {
    id: 'early-exit-charge',
    label: 'Early Exit Charge',
    preferredSections: ['eec', 'withdrawal-charge', 'fees'],
    headingPatterns: [
      /\bearly exit charge\b/i,
      /\bearly encashment charge\b/i,
      /\beec\b/i,
      /\bsurrender charge\b/i,
    ],
    phrasePatterns: [
      /\bearly exit charge\b/i,
      /\bearly encashment charge\b/i,
      /\beec\b/i,
      /\bsurrender charge\b/i,
    ],
    keywordPhrases: ['early exit charge', 'early encashment charge', 'eec', 'surrender charge'],
  },
  {
    id: 'partial-withdrawal',
    label: 'Partial Withdrawal',
    preferredSections: ['withdrawal-charge', 'policy-details'],
    headingPatterns: [
      /\bpartial withdrawal\b/i,
      /\bpartial surrender\b/i,
      /\bwithdrawal\b/i,
      /\bsurrender value\b/i,
    ],
    phrasePatterns: [
      /\bpartial withdrawal\b/i,
      /\bpartial surrender\b/i,
      /\bwithdrawal charge\b/i,
      /\bsurrender value\b/i,
      /\bsurrender\b/i,
    ],
    keywordPhrases: ['partial withdrawal', 'partial surrender', 'withdrawal charge', 'surrender value', 'surrender charge'],
  },
  {
    id: 'premium-payment',
    label: 'Premium Payment',
    preferredSections: ['premium-payment', 'policy-details'],
    headingPatterns: [
      /\bpremium payment\b/i,
      /\bregular premium\b/i,
      /\bsingle premium\b/i,
      /\bpayment term\b/i,
      /\bpremium term\b/i,
    ],
    phrasePatterns: [
      /\bpremium payment\b/i,
      /\bregular premium\b/i,
      /\bsingle premium\b/i,
      /\btop-?up premium\b/i,
      /\bpayment term\b/i,
      /\bpremium term\b/i,
      /\bannual premium\b/i,
    ],
    keywordPhrases: ['premium payment', 'regular premium', 'single premium', 'top-up premium', 'payment term', 'premium term'],
  },
  {
    id: 'premium-holiday',
    label: 'Premium Holiday',
    preferredSections: ['premium-payment', 'withdrawal-charge', 'policy-details'],
    headingPatterns: [
      /\bpremium holiday\b/i,
    ],
    phrasePatterns: [
      /\bpremium holiday\b/i,
      /\bholiday period\b/i,
    ],
    keywordPhrases: ['premium holiday'],
  },
  {
    id: 'death-benefit',
    label: 'Death Benefit',
    preferredSections: ['death-benefit', 'policy-details'],
    headingPatterns: [
      /\bdeath benefit\b/i,
      /\bterminal illness benefit\b/i,
      /\bbasic death benefit\b/i,
      /\badvanced death benefit\b/i,
      /\bsum assured\b/i,
    ],
    phrasePatterns: [
      /\bdeath benefit\b/i,
      /\bterminal illness benefit\b/i,
      /\bbasic death benefit\b/i,
      /\badvanced death benefit\b/i,
      /\bsum assured\b/i,
      /\blife insured\b/i,
    ],
    keywordPhrases: ['death benefit', 'terminal illness', 'sum assured', 'life insured'],
  },
  {
    id: 'maturity-benefit',
    label: 'Maturity Benefit',
    preferredSections: ['maturity-benefit', 'policy-details'],
    headingPatterns: [
      /\bmaturity benefit\b/i,
      /\bmaturity value\b/i,
      /\bpolicy maturity\b/i,
      /\bmaturity date\b/i,
    ],
    phrasePatterns: [
      /\bmaturity benefit\b/i,
      /\bmaturity value\b/i,
      /\bpolicy maturity\b/i,
      /\bmaturity date\b/i,
    ],
    keywordPhrases: ['maturity benefit', 'maturity value', 'policy maturity'],
  },
]

function classifyDocumentType(fileName: string): CorpusDocumentType {
  if (isSummaryFile(fileName)) return 'summary'
  if (isBrochureFile(fileName)) return 'brochure'
  return 'unclassified'
}

function evidencePathForFileName(fileName: string): string {
  return path.join(EVIDENCE_DIR, `${slugify(fileName.replace(/\.pdf$/i, ''))}.json`)
}

function relativePathFromFixtures(filePath: string): string {
  return path.relative(FIXTURES_DIR, filePath).replaceAll(path.sep, '/')
}

function preparedRelativePath(fileName: string): string {
  return path.posix.join('..', 'prepared', `${slugify(fileName.replace(/\.pdf$/i, ''))}.json`)
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function excerptAroundMatch(text: string, matchIndex: number, matchLength: number, radius = 140): string {
  const compact = normalizeText(text)
  if (compact.length <= 280) {
    return compact
  }

  const start = Math.max(0, matchIndex - radius)
  const end = Math.min(compact.length, matchIndex + matchLength + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < compact.length ? '…' : ''

  return `${prefix}${compact.slice(start, end).trim()}${suffix}`
}

function collectMatchedPhrases(text: string, patterns: RegExp[]): string[] {
  const matched = new Set<string>()

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match?.[0]) {
      matched.add(normalizeText(match[0].toLowerCase()))
    }
  }

  return [...matched]
}

function firstMatchLocation(text: string, patterns: RegExp[]): { index: number, length: number } | null {
  let bestMatch: { index: number, length: number } | null = null

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (!match || match.index === undefined) continue
    const location = { index: match.index, length: match[0].length }
    if (!bestMatch || location.index < bestMatch.index) {
      bestMatch = location
    }
  }

  return bestMatch
}

function keywordMatches(keywords: string[], definition: EvidenceFieldDefinition): string[] {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase())
  return definition.keywordPhrases.filter((phrase) => normalizedKeywords.includes(phrase.toLowerCase()))
}

function scoreChunkForField(
  chunk: PreparedChunk,
  definition: EvidenceFieldDefinition,
): EvidenceCandidate | null {
  const haystack = normalizeText(`${chunk.heading ?? ''}\n${chunk.text}`)
  const headingText = chunk.heading ?? ''
  const phraseMatches = collectMatchedPhrases(haystack, definition.phrasePatterns)
  const headingMatches = collectMatchedPhrases(headingText, definition.headingPatterns)
  const keywordHits = keywordMatches(chunk.keywords, definition)

  if (phraseMatches.length === 0 && headingMatches.length === 0) {
    return null
  }

  let score = 0
  const reasonCodes: string[] = []

  const sectionIndex = definition.preferredSections.indexOf(chunk.sectionId)
  if (sectionIndex >= 0) {
    score += Math.max(18, 36 - (sectionIndex * 8))
    reasonCodes.push(`section:${chunk.sectionId}`)
  }

  if (headingMatches.length > 0) {
    score += 18 + Math.min(headingMatches.length, 2) * 4
    reasonCodes.push('heading-match')
  }

  if (phraseMatches.length > 0) {
    score += Math.min(phraseMatches.length, 4) * 8
    reasonCodes.push(`phrase-match:${phraseMatches[0]}`)
  }

  if (keywordHits.length > 0) {
    score += Math.min(keywordHits.length, 3) * 3
    reasonCodes.push(`keyword:${keywordHits[0]}`)
  }

  if (chunk.pageEnd === chunk.pageStart) {
    score += 2
    reasonCodes.push('page-local')
  }

  const matchedPhrases = [...new Set([
    ...headingMatches,
    ...phraseMatches,
    ...keywordHits.map((keyword) => keyword.toLowerCase()),
  ])]

  const matchLocation = firstMatchLocation(haystack, definition.phrasePatterns)
  const excerpt = matchLocation
    ? excerptAroundMatch(haystack, matchLocation.index, matchLocation.length)
    : chunk.sourceRefs[0]?.excerpt ?? excerptAroundMatch(haystack, 0, 0)

  return {
    candidateId: `${chunk.chunkId}:${definition.id}`,
    chunkId: chunk.chunkId,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    sectionId: chunk.sectionId,
    heading: chunk.heading,
    excerpt,
    matchedPhrases,
    reasonCodes,
    score,
    sourceRefs: chunk.sourceRefs,
  }
}

function buildFieldPacket(prepared: PreparedArtifact, definition: EvidenceFieldDefinition): EvidenceFieldPacket {
  const candidates = prepared.chunks
    .map((chunk) => scoreChunkForField(chunk, definition))
    .filter((candidate): candidate is EvidenceCandidate => candidate !== null)
    .sort((left, right) => (
      right.score - left.score
      || left.pageStart - right.pageStart
      || left.chunkId.localeCompare(right.chunkId)
    ))

  const topCandidates = candidates.slice(0, MAX_CANDIDATES_PER_FIELD)

  return {
    fieldId: definition.id,
    label: definition.label,
    status: topCandidates.length > 0 ? 'candidate-found' : 'not-detected',
    candidateCount: candidates.length,
    bestCandidate: topCandidates[0] ?? null,
    candidates: topCandidates,
  }
}

function buildSummary(
  prepared: PreparedArtifact,
  fieldPackets: Record<EvidenceFieldId, EvidenceFieldPacket>,
): EvidenceArtifactSummary {
  const fieldsWithCandidates = FIELD_DEFINITIONS
    .map((definition) => definition.id)
    .filter((fieldId) => fieldPackets[fieldId].status === 'candidate-found')
  const fieldsWithoutCandidates = FIELD_DEFINITIONS
    .map((definition) => definition.id)
    .filter((fieldId) => fieldPackets[fieldId].status === 'not-detected')
  const notes: string[] = []
  let manualReviewRecommended = false

  if (prepared.textQuality.status === 'needs-review') {
    manualReviewRecommended = true
    notes.push('Prepared corpus layer flagged this document as needs-review.')
  }

  const coreFieldIds: EvidenceFieldId[] = [
    'premium-payment',
    'fees-and-charges',
    'partial-withdrawal',
    'death-benefit',
  ]
  const missingCoreFields = coreFieldIds.filter((fieldId) => fieldPackets[fieldId].status === 'not-detected')

  if (prepared.documentType === 'summary' && missingCoreFields.length >= 2) {
    manualReviewRecommended = true
    notes.push(`Summary document is missing evidence candidates for core fields: ${missingCoreFields.join(', ')}.`)
  } else if (prepared.documentType === 'brochure' && fieldsWithCandidates.length === 0) {
    manualReviewRecommended = true
    notes.push('Brochure document did not yield any evidence candidates.')
  }

  if (prepared.linkedDocuments.length === 0) {
    notes.push('No sibling prepared document was linked for cross-document corroboration.')
  }

  return {
    fieldsWithCandidates,
    fieldsWithoutCandidates,
    manualReviewRecommended,
    notes,
  }
}

function buildEvidenceArtifact(prepared: PreparedArtifact): EvidenceArtifact {
  const fieldPackets = Object.fromEntries(
    FIELD_DEFINITIONS.map((definition) => [definition.id, buildFieldPacket(prepared, definition)]),
  ) as Record<EvidenceFieldId, EvidenceFieldPacket>

  return {
    sourceFileName: prepared.sourceFileName,
    sourceChecksum: prepared.sourceChecksum,
    generatedAt: new Date().toISOString(),
    documentType: classifyDocumentType(prepared.sourceFileName),
    insurer: inferInsurer(prepared.sourceFileName),
    productName: inferProductName(prepared.sourceFileName),
    preparedArtifactPath: preparedRelativePath(prepared.sourceFileName),
    documentSignals: prepared.documentSignals,
    detectedSections: prepared.detectedSections,
    linkedDocuments: prepared.linkedDocuments,
    fieldPackets,
    summary: buildSummary(prepared, fieldPackets),
  }
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  const temporaryPath = `${targetPath}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, targetPath)
}

async function readPreparedManifest(): Promise<PreparedManifest> {
  const raw = await readFile(PREPARED_MANIFEST_PATH, 'utf8')
  return preparedManifestSchema.parse(JSON.parse(raw)) as PreparedManifest
}

async function readPreparedArtifact(preparedPath: string): Promise<PreparedArtifact> {
  const raw = await readFile(preparedPath, 'utf8')
  return preparedArtifactSchema.parse(JSON.parse(raw)) as PreparedArtifact
}

async function readCachedEvidenceChecksum(evidencePath: string): Promise<string | null> {
  try {
    const raw = await readFile(evidencePath, 'utf8')
    const parsed = evidenceArtifactSchema.parse(JSON.parse(raw)) as Pick<EvidenceArtifact, 'sourceChecksum'>
    return parsed.sourceChecksum
  } catch {
    return null
  }
}

async function buildEvidenceManifest(entries: PreparedManifestEntry[]): Promise<EvidenceManifest> {
  const evidenceEntries: EvidenceManifestEntry[] = []

  for (const entry of entries) {
    const evidencePath = evidencePathForFileName(entry.sourceFileName)
    const raw = await readFile(evidencePath, 'utf8')
    const evidence = JSON.parse(raw) as EvidenceArtifact

    if (evidence.sourceChecksum !== entry.sourceChecksum) {
      continue
    }

    evidenceEntries.push({
      sourceFileName: evidence.sourceFileName,
      sourceChecksum: evidence.sourceChecksum,
      insurer: evidence.insurer,
      productName: evidence.productName,
      documentType: evidence.documentType,
      preparedArtifactPath: entry.preparedArtifactPath,
      evidenceArtifactPath: relativePathFromFixtures(evidencePath),
      fieldsWithCandidates: evidence.summary.fieldsWithCandidates,
      fieldsWithoutCandidates: evidence.summary.fieldsWithoutCandidates,
      manualReviewRecommended: evidence.summary.manualReviewRecommended,
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    totalEvidenceArtifacts: evidenceEntries.length,
    entries: evidenceEntries,
  }
}

async function main() {
  await mkdir(EVIDENCE_DIR, { recursive: true })

  const preparedManifest = await readPreparedManifest()
  let writtenCount = 0

  for (const [index, entry] of preparedManifest.entries.entries()) {
    const progressPrefix = `[${index + 1}/${preparedManifest.entries.length}]`
    const evidencePath = evidencePathForFileName(entry.sourceFileName)
    const cachedChecksum = await readCachedEvidenceChecksum(evidencePath)

    if (cachedChecksum === entry.sourceChecksum) {
      console.log(`${progressPrefix} Skipping (cached): ${path.basename(evidencePath)}`)
      continue
    }

    console.log(`${progressPrefix} Extracting evidence: ${path.basename(evidencePath)}`)

    const prepared = await readPreparedArtifact(path.join(FIXTURES_DIR, entry.preparedArtifactPath))
    const evidence = buildEvidenceArtifact(prepared)
    await writeJson(evidencePath, evidence)
    writtenCount += 1
  }

  const evidenceManifest = await buildEvidenceManifest(preparedManifest.entries)
  await writeJson(EVIDENCE_MANIFEST_PATH, evidenceManifest)

  console.log(`Built ${evidenceManifest.totalEvidenceArtifacts} evidence artifacts in ${EVIDENCE_DIR}`)
  console.log(`Wrote ${writtenCount} evidence artifacts in this run`)
  console.log(`Wrote evidence manifest to ${EVIDENCE_MANIFEST_PATH}`)
}

await main()
