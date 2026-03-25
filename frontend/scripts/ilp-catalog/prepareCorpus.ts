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
const EXTRACTED_MANIFEST_PATH = path.join(FIXTURES_DIR, 'corpus-manifest.json')
const PREPARED_MANIFEST_PATH = path.join(FIXTURES_DIR, 'prepared-manifest.json')

const TARGET_CHUNK_SIZE = 1_400
const MIN_CHUNK_SIZE = 800
const MAX_CHUNK_SIZE = 2_200
const TOP_BOTTOM_SCAN_DEPTH = 3
const MIN_REPEATED_POSITIONAL_LINE_OCCURRENCES = 4
const MIN_REPEATED_POSITIONAL_LINE_RATIO = 0.2
const SHA256_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/
const SUSPICIOUS_CHAR_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u0100-\u024f]/g
const SUSPICIOUS_CHAR_SEQUENCE_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u0100-\u024f]{8,}/
const MINIMUM_SUSPICIOUS_CHAR_COUNT = 24
const MAXIMUM_SUSPICIOUS_CHAR_RATIO = 0.015

const LIGATURE_REPLACEMENTS = new Map<string, string>([
  ['\u00a0', ' '],
  ['\ufb00', 'ff'],
  ['\ufb01', 'fi'],
  ['\ufb02', 'fl'],
  ['\ufb03', 'ffi'],
  ['\ufb04', 'ffl'],
  ['\ufb05', 'ft'],
  ['\ufb06', 'st'],
])

const TOKEN_STOPWORDS = new Set([
  'BROCHURE',
  'PRODUCT',
  'SUMMARY',
  'PDTSUM',
  'SUM',
  'PS',
  'PB',
  'BROC',
  'EN',
  'SG',
  'PDF',
  'VERSION',
  'VER',
  'V',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
  'JAN',
  'FEB',
  'MAR',
  'APR',
])

const INSURER_CODE_TOKENS = new Set([
  'EIP',
  'GEL',
  'TML',
  'WA',
  'WF',
  'PRU',
  'VA',
  'VS',
  'FWD',
])

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

type TextQualityStatus = 'clean' | 'fallback-cleaned' | 'needs-review'

interface ExtractedArtifact {
  sourceFileName: string
  sourceChecksum: string
  extractedAt: string
  insurer: string
  productName: string
  documentType: CorpusDocumentType
  pageCount: number
  totalCharacters: number
  detectedSections: DetectedSectionId[]
  pages: Array<{
    pageNumber: number
    text: string
    characterCount: number
    lines: Array<{
      y: number
      text: string
    }>
  }>
  fullText: string
}

interface ExtractedManifestEntry {
  sourceFileName: string
  sourceChecksum: string
  insurer: string
  productName: string
  documentType: CorpusDocumentType
  pageCount: number
  totalCharacters: number
  detectedSections: DetectedSectionId[]
  artifactPath: string
}

interface ExtractedManifest {
  generatedAt: string
  corpusDir: string
  totalPdfs: number
  extracted: number
  failed: number
  entries: ExtractedManifestEntry[]
  failures: Array<{
    sourceFileName: string
    error: string
  }>
}

interface PreparedNormalizedPage {
  pageNumber: number
  text: string
}

interface PreparedTextQuality {
  status: TextQualityStatus
  notes: string[]
  removedRepeatedLineCount: number
  removedPageNumberLineCount: number
  ligatureFixCount: number
}

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

interface LinkedDocument {
  sourceFileName: string
  documentType: CorpusDocumentType
  relationship: 'same-product'
}

interface PreparedArtifact {
  sourceFileName: string
  sourceChecksum: string
  preparedAt: string
  documentType: CorpusDocumentType
  insurer: string
  productName: string
  extractedArtifactPath: string
  textQuality: PreparedTextQuality
  normalizedPages: PreparedNormalizedPage[]
  detectedSections: DetectedSectionId[]
  documentSignals: PreparedDocumentSignals
  chunks: PreparedChunk[]
  linkedDocuments: LinkedDocument[]
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

interface PreparedBlock {
  pageNumber: number
  sectionId: DetectedSectionId | 'page-body'
  heading: string | null
  text: string
}

interface PreparedUnit extends PreparedBlock {
  excerpt: string
}

interface LinkedDocumentContext {
  insurer: string
  documentType: CorpusDocumentType
  linkKey: string
  sourceFileName: string
}

interface PreparedArtifactBuildResult {
  prepared: PreparedArtifact
  wasWritten: boolean
}

interface NormalizationLineStats {
  text: string
  ligatureFixCount: number
}

interface TextQualitySignals {
  suspiciousCharacterCount: number
  nonWhitespaceCharacterCount: number
  suspiciousCharacterRatio: number
  hasSuspiciousRun: boolean
}

const detectedSectionIdSchema = z.enum([
  'policy-details',
  'bonus',
  'fees',
  'withdrawal-charge',
  'eec',
  'death-benefit',
  'premium-payment',
  'maturity-benefit',
])

const extractedArtifactSchema = z.object({
  sourceFileName: z.string().min(1),
  sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
  extractedAt: z.string().min(1),
  insurer: z.string().min(1),
  productName: z.string().min(1),
  documentType: z.enum(['summary', 'brochure', 'unclassified']),
  pageCount: z.number().int().min(1),
  totalCharacters: z.number().int().min(0),
  detectedSections: z.array(detectedSectionIdSchema),
  pages: z.array(z.object({
    pageNumber: z.number().int().min(1),
    text: z.string(),
    characterCount: z.number().int().min(0),
    lines: z.array(z.object({
      y: z.number(),
      text: z.string(),
    })),
  })).min(1),
  fullText: z.string(),
})

const extractedManifestSchema = z.object({
  generatedAt: z.string().min(1),
  corpusDir: z.string().min(1),
  totalPdfs: z.number().int().min(0),
  extracted: z.number().int().min(0),
  failed: z.number().int().min(0),
  entries: z.array(z.object({
    sourceFileName: z.string().min(1),
    sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
    insurer: z.string().min(1),
    productName: z.string().min(1),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    pageCount: z.number().int().min(1),
    totalCharacters: z.number().int().min(0),
    detectedSections: z.array(detectedSectionIdSchema),
    artifactPath: z.string().min(1),
  })),
  failures: z.array(z.object({
    sourceFileName: z.string().min(1),
    error: z.string().min(1),
  })),
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
  detectedSections: z.array(detectedSectionIdSchema),
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
    sectionId: z.union([detectedSectionIdSchema, z.literal('page-body')]),
    heading: z.string().min(1).nullable(),
    text: z.string().min(1),
    keywords: z.array(z.string().min(1)),
    sourceRefs: z.array(z.object({
      page: z.number().int().min(1),
      excerpt: z.string().min(1),
    })).min(1),
  })).min(1),
  linkedDocuments: z.array(z.object({
    sourceFileName: z.string().min(1),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    relationship: z.literal('same-product'),
  })),
})

const SECTION_DEFINITIONS: Array<{
  id: DetectedSectionId
  signalPattern: RegExp
  headingPatterns: RegExp[]
  keywords: string[]
}> = [
  {
    id: 'policy-details',
    signalPattern: /\b(the policy|policy details|plan details|plan at a glance|policy features|key product information)\b/i,
    headingPatterns: [
      /^(?:\d+[\).]?\s*)?(?:the policy|policy details|plan details|plan at a glance|key product information|policy features|how it works|how the plan works)\b[:\s-]*$/i,
    ],
    keywords: ['policy details', 'plan details', 'how it works', 'policy features'],
  },
  {
    id: 'bonus',
    signalPattern: /\b(bonus|bonuses|loyalty bonus|power-up bonus|power up bonus|welcome bonus|start-up bonus|startup bonus|special bonus)\b/i,
    headingPatterns: [
      /^(?:\d+[\).]?\s*)?(?:bonus|bonuses|bonus units|loyalty bonus|power-?up bonus|welcome bonus|start-?up bonus|special bonus)\b[:\s-]*$/i,
      /^(?:\d+[\).]?\s*)?(?:monthly )?loyalty bonus\b[:\s-]*$/i,
    ],
    keywords: ['bonus', 'loyalty bonus', 'start-up bonus', 'welcome bonus', 'special bonus'],
  },
  {
    id: 'fees',
    signalPattern: /\b(policy fees and charges|fees and charges|management fee|policy charge|insurance charge|administration charge|admin charge)\b/i,
    headingPatterns: [
      /^(?:\d+[\).]?\s*)?(?:policy fees? and charges|fees? and charges|charges?|management fee|policy charge|insurance charge|administration charge)\b[:\s-]*$/i,
    ],
    keywords: ['fees and charges', 'management fee', 'policy charge', 'insurance charge', 'administration charge'],
  },
  {
    id: 'withdrawal-charge',
    signalPattern: /\b(withdrawal|partial withdrawal|partial surrender|surrender value|surrender charge|withdrawal charge)\b/i,
    headingPatterns: [
      /^(?:\d+[\).]?\s*)?(?:partial withdrawal|partial surrender|withdrawal charge|withdrawal|surrender(?: value| charge)?)\b[:\s-]*$/i,
    ],
    keywords: ['partial withdrawal', 'partial surrender', 'withdrawal charge', 'surrender charge'],
  },
  {
    id: 'eec',
    signalPattern: /\b(early exit charge|early encashment charge|eec|surrender charge)\b/i,
    headingPatterns: [
      /^(?:\d+[\).]?\s*)?(?:early exit charge|early encashment charge|eec)\b[:\s-]*$/i,
    ],
    keywords: ['early exit charge', 'early encashment charge', 'eec', 'surrender charge'],
  },
  {
    id: 'death-benefit',
    signalPattern: /\b(death benefit|terminal illness benefit|basic death benefit|advanced death benefit|sum assured)\b/i,
    headingPatterns: [
      /^(?:\d+[\).]?\s*)?(?:death benefit|terminal illness benefit|basic death benefit|advanced death benefit|sum assured)\b[:\s-]*$/i,
    ],
    keywords: ['death benefit', 'terminal illness', 'sum assured', 'life insured'],
  },
  {
    id: 'premium-payment',
    signalPattern: /\b(premium payment|regular premium|single premium|top-up premium|top up premium|premium term|payment term|premium holiday)\b/i,
    headingPatterns: [
      /^(?:\d+[\).]?\s*)?(?:premium payment|regular premium|single premium|top-?up premium|premium term|payment term|premium holiday)\b[:\s-]*$/i,
    ],
    keywords: ['premium payment', 'regular premium', 'single premium', 'top-up premium', 'premium holiday'],
  },
  {
    id: 'maturity-benefit',
    signalPattern: /\b(maturity benefit|maturity value|policy maturity|maturity date)\b/i,
    headingPatterns: [
      /^(?:\d+[\).]?\s*)?(?:maturity benefit|maturity value|policy maturity|maturity date)\b[:\s-]*$/i,
    ],
    keywords: ['maturity benefit', 'maturity value', 'policy maturity'],
  },
]

const SIGNAL_PATTERNS: Record<keyof PreparedDocumentSignals, RegExp> = {
  hasBonus: /\b(bonus|bonuses|loyalty bonus|power-up bonus|power up bonus|welcome bonus|start-up bonus|startup bonus|special bonus)\b/i,
  hasFeesAndCharges: /\b(policy fees and charges|fees and charges|management fee|policy charge|insurance charge|administration charge|admin charge)\b/i,
  hasEec: /\b(early exit charge|early encashment charge|eec|surrender charge)\b/i,
  hasPartialWithdrawal: /\b(partial withdrawal|partial surrender|withdrawal charge|surrender value|withdrawal)\b/i,
  hasPremiumPayment: /\b(premium payment|regular premium|single premium|top-up premium|top up premium|premium term|payment term|annual premium)\b/i,
  hasDeathBenefit: /\b(death benefit|terminal illness benefit|basic death benefit|advanced death benefit|sum assured)\b/i,
  hasMaturityBenefit: /\b(maturity benefit|maturity value|policy maturity|maturity date)\b/i,
  hasPremiumHoliday: /\bpremium holiday\b/i,
}

function classifyDocumentType(fileName: string): CorpusDocumentType {
  if (isSummaryFile(fileName)) return 'summary'
  if (isBrochureFile(fileName)) return 'brochure'
  return 'unclassified'
}

function artifactPathInManifest(artifactPath: string): string {
  return path.relative(FIXTURES_DIR, artifactPath).replaceAll(path.sep, '/')
}

function preparedArtifactPathForFileName(fileName: string): string {
  const baseName = fileName.replace(/\.pdf$/i, '')
  return path.join(PREPARED_DIR, `${slugify(baseName)}.json`)
}

function extractedArtifactRelativePath(fileName: string): string {
  const extractedName = `${slugify(fileName.replace(/\.pdf$/i, ''))}.json`
  return path.posix.join('..', 'extracted', extractedName)
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, ' ').trim()
}

function normalizeLineText(text: string): NormalizationLineStats {
  let normalized = text.replace(/\r/g, '')
  let ligatureFixCount = 0

  for (const [raw, replacement] of LIGATURE_REPLACEMENTS.entries()) {
    const matches = normalized.match(new RegExp(raw, 'g')) ?? []
    ligatureFixCount += matches.length
    normalized = normalized.replaceAll(raw, replacement)
  }

  normalized = normalizeWhitespace(normalized)

  return {
    text: normalized,
    ligatureFixCount,
  }
}

function analyzeTextQuality(text: string): TextQualitySignals {
  const suspiciousCharacterCount = (text.match(SUSPICIOUS_CHAR_PATTERN) ?? []).length
  const nonWhitespaceCharacterCount = text.replace(/\s+/g, '').length

  return {
    suspiciousCharacterCount,
    nonWhitespaceCharacterCount,
    suspiciousCharacterRatio: nonWhitespaceCharacterCount === 0 ? 0 : suspiciousCharacterCount / nonWhitespaceCharacterCount,
    hasSuspiciousRun: SUSPICIOUS_CHAR_SEQUENCE_PATTERN.test(text),
  }
}

function hasSuspiciousText(text: string): boolean {
  const signals = analyzeTextQuality(text)

  if (signals.hasSuspiciousRun) {
    return true
  }

  return (
    signals.suspiciousCharacterCount >= MINIMUM_SUSPICIOUS_CHAR_COUNT
    && signals.suspiciousCharacterRatio > MAXIMUM_SUSPICIOUS_CHAR_RATIO
  )
}

function detectSections(text: string): DetectedSectionId[] {
  return SECTION_DEFINITIONS
    .filter(({ signalPattern }) => signalPattern.test(text))
    .map(({ id }) => id)
}

function detectDocumentSignals(text: string): PreparedDocumentSignals {
  return {
    hasBonus: SIGNAL_PATTERNS.hasBonus.test(text),
    hasFeesAndCharges: SIGNAL_PATTERNS.hasFeesAndCharges.test(text),
    hasEec: SIGNAL_PATTERNS.hasEec.test(text),
    hasPartialWithdrawal: SIGNAL_PATTERNS.hasPartialWithdrawal.test(text),
    hasPremiumPayment: SIGNAL_PATTERNS.hasPremiumPayment.test(text),
    hasDeathBenefit: SIGNAL_PATTERNS.hasDeathBenefit.test(text),
    hasMaturityBenefit: SIGNAL_PATTERNS.hasMaturityBenefit.test(text),
    hasPremiumHoliday: SIGNAL_PATTERNS.hasPremiumHoliday.test(text),
  }
}

function looksLikeHeading(line: string): boolean {
  if (line.length === 0 || line.length > 120) return false
  if (/[.!?]$/.test(line) && line.length > 50) return false

  const wordCount = line.split(/\s+/).length
  return wordCount <= 16
}

function matchSectionHeading(line: string): { id: DetectedSectionId, heading: string } | null {
  if (!looksLikeHeading(line)) return null

  for (const definition of SECTION_DEFINITIONS) {
    if (definition.headingPatterns.some((pattern) => pattern.test(line))) {
      return {
        id: definition.id,
        heading: line,
      }
    }
  }

  return null
}

function isPageCounterLine(line: string, pageNumber: number, pageCount: number, lineIndex: number, lineCount: number): boolean {
  const atPageEdge = lineIndex < 2 || lineIndex >= lineCount - 2
  if (!atPageEdge) return false

  if (/^page\s+\d+(?:\s+of\s+\d+)?$/i.test(line)) return true
  if (/^\d+\s*\/\s*\d+$/.test(line)) return true

  if (/^\d+$/.test(line)) {
    return Number.parseInt(line, 10) === pageNumber || Number.parseInt(line, 10) === pageCount
  }

  return false
}

function excerptForText(text: string, maxLength = 240): string {
  const singleLine = text.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= maxLength) return singleLine
  return `${singleLine.slice(0, maxLength - 1).trimEnd()}…`
}

function buildRepeatedPositionalLineSet(extracted: ExtractedArtifact): Set<string> {
  const occurrenceByLine = new Map<string, Set<number>>()

  for (const page of extracted.pages) {
    const normalizedLines = page.lines
      .map((line) => normalizeLineText(line.text).text)
      .filter((line) => line.length > 0)
    const candidateLines = [
      ...normalizedLines.slice(0, TOP_BOTTOM_SCAN_DEPTH),
      ...normalizedLines.slice(-TOP_BOTTOM_SCAN_DEPTH),
    ]

    for (const line of candidateLines) {
      if (line.length < 5) continue
      if (/^\d+$/.test(line)) continue

      const pages = occurrenceByLine.get(line) ?? new Set<number>()
      pages.add(page.pageNumber)
      occurrenceByLine.set(line, pages)
    }
  }

  const minimumOccurrences = Math.max(
    MIN_REPEATED_POSITIONAL_LINE_OCCURRENCES,
    Math.ceil(extracted.pageCount * MIN_REPEATED_POSITIONAL_LINE_RATIO),
  )

  return new Set(
    [...occurrenceByLine.entries()]
      .filter(([, pageNumbers]) => pageNumbers.size >= minimumOccurrences)
      .map(([line]) => line),
  )
}

function normalizePages(extracted: ExtractedArtifact): {
  normalizedPages: PreparedNormalizedPage[]
  textQuality: PreparedTextQuality
} {
  const repeatedPositionalLines = buildRepeatedPositionalLineSet(extracted)
  const normalizedPages: PreparedNormalizedPage[] = []
  let removedRepeatedLineCount = 0
  let removedPageNumberLineCount = 0
  let ligatureFixCount = 0

  for (const page of extracted.pages) {
    const normalizedLines: string[] = []

    for (const [lineIndex, line] of page.lines.entries()) {
      const normalized = normalizeLineText(line.text)
      const normalizedText = normalized.text
      ligatureFixCount += normalized.ligatureFixCount
      if (normalizedText.length === 0) continue

      if (isPageCounterLine(normalizedText, page.pageNumber, extracted.pageCount, lineIndex, page.lines.length)) {
        removedPageNumberLineCount += 1
        continue
      }

      const atPageEdge = lineIndex < TOP_BOTTOM_SCAN_DEPTH || lineIndex >= page.lines.length - TOP_BOTTOM_SCAN_DEPTH
      if (atPageEdge && repeatedPositionalLines.has(normalizedText)) {
        removedRepeatedLineCount += 1
        continue
      }

      normalizedLines.push(normalizedText)
    }

    const normalizedText = normalizedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    normalizedPages.push({
      pageNumber: page.pageNumber,
      text: normalizedText,
    })
  }

  const normalizedFullText = normalizedPages.map((page) => page.text).join('\n\n')
  const notes: string[] = []
  let status: TextQualityStatus = 'clean'

  if (removedPageNumberLineCount > 0) {
    notes.push(`Removed ${removedPageNumberLineCount} page counter lines.`)
  }
  if (removedRepeatedLineCount > 0) {
    notes.push(`Removed ${removedRepeatedLineCount} repeated header/footer lines.`)
  }
  if (ligatureFixCount > 0) {
    notes.push(`Normalized ${ligatureFixCount} ligature or spacing artifacts.`)
  }

  if (hasSuspiciousText(normalizedFullText)) {
    status = 'needs-review'
    notes.push('Suspicious character patterns remain after normalization.')
  } else if (notes.length > 0) {
    status = 'fallback-cleaned'
  }

  if (normalizedPages.some((page) => page.text.length === 0)) {
    if (status === 'clean') {
      status = 'fallback-cleaned'
    }
    notes.push('At least one page is empty after conservative cleanup.')
  }

  return {
    normalizedPages,
    textQuality: {
      status,
      notes,
      removedRepeatedLineCount,
      removedPageNumberLineCount,
      ligatureFixCount,
    },
  }
}

function splitOversizedText(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) {
    return [text]
  }

  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  const pieces: string[] = []
  let current: string[] = []
  let currentLength = 0

  const pushCurrent = () => {
    if (current.length === 0) return
    pieces.push(current.join('\n'))
    current = []
    currentLength = 0
  }

  for (const line of lines) {
    if (line.length > MAX_CHUNK_SIZE) {
      pushCurrent()
      let remaining = line
      while (remaining.length > MAX_CHUNK_SIZE) {
        let splitIndex = remaining.lastIndexOf(' ', MAX_CHUNK_SIZE)
        if (splitIndex < MIN_CHUNK_SIZE) {
          splitIndex = MAX_CHUNK_SIZE
        }
        pieces.push(remaining.slice(0, splitIndex).trim())
        remaining = remaining.slice(splitIndex).trim()
      }
      if (remaining.length > 0) {
        current = [remaining]
        currentLength = remaining.length
      }
      continue
    }

    const additionalLength = currentLength === 0 ? line.length : currentLength + 1 + line.length
    if (additionalLength > MAX_CHUNK_SIZE && currentLength >= MIN_CHUNK_SIZE) {
      pushCurrent()
    }

    current.push(line)
    currentLength = currentLength === 0 ? line.length : currentLength + 1 + line.length

    if (currentLength >= TARGET_CHUNK_SIZE) {
      pushCurrent()
    }
  }

  pushCurrent()
  return pieces.filter((piece) => piece.length > 0)
}

function buildBlocks(normalizedPages: PreparedNormalizedPage[], detectedSections: DetectedSectionId[]): PreparedBlock[] {
  const blocks: PreparedBlock[] = []
  let currentSection: DetectedSectionId | 'page-body' = detectedSections[0] ?? 'page-body'
  let currentHeading: string | null = null

  for (const page of normalizedPages) {
    const lines = page.text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
    if (lines.length === 0) {
      continue
    }

    let buffer: string[] = []
    let pageSection: DetectedSectionId | 'page-body' = currentSection
    let pageHeading: string | null = currentHeading

    const flushBuffer = () => {
      if (buffer.length === 0) return
      blocks.push({
        pageNumber: page.pageNumber,
        sectionId: pageSection,
        heading: pageHeading,
        text: buffer.join('\n'),
      })
      buffer = []
    }

    for (const line of lines) {
      const headingMatch = matchSectionHeading(line)
      if (headingMatch) {
        flushBuffer()
        pageSection = headingMatch.id
        pageHeading = headingMatch.heading
        buffer.push(line)
        continue
      }

      buffer.push(line)
    }

    flushBuffer()
    currentSection = pageSection
    currentHeading = pageHeading
  }

  return blocks.length > 0
    ? blocks
    : normalizedPages
      .filter((page) => page.text.length > 0)
      .map((page) => ({
        pageNumber: page.pageNumber,
        sectionId: 'page-body' as const,
        heading: null,
        text: page.text,
      }))
}

function buildUnits(blocks: PreparedBlock[]): PreparedUnit[] {
  const units: PreparedUnit[] = []

  for (const block of blocks) {
    for (const piece of splitOversizedText(block.text)) {
      units.push({
        ...block,
        text: piece,
        excerpt: excerptForText(piece),
      })
    }
  }

  return units
}

function keywordsForChunk(text: string, sectionId: DetectedSectionId | 'page-body'): string[] {
  const normalized = text.toLowerCase()
  const matches = new Set<string>()
  const definition = SECTION_DEFINITIONS.find((entry) => entry.id === sectionId)

  for (const keyword of definition?.keywords ?? []) {
    if (normalized.includes(keyword.toLowerCase())) {
      matches.add(keyword)
    }
  }

  for (const entry of SECTION_DEFINITIONS) {
    for (const keyword of entry.keywords) {
      if (matches.size >= 6) {
        return [...matches]
      }
      if (normalized.includes(keyword.toLowerCase())) {
        matches.add(keyword)
      }
    }
  }

  return [...matches]
}

function buildChunks(fileSlug: string, units: PreparedUnit[]): PreparedChunk[] {
  const chunks: PreparedChunk[] = []
  const ordinalBySection = new Map<string, number>()

  let currentUnits: PreparedUnit[] = []
  let currentSection: DetectedSectionId | 'page-body' | null = null
  let currentLength = 0

  const pushChunk = () => {
    if (currentUnits.length === 0 || currentSection === null) return

    const pageStart = currentUnits[0].pageNumber
    const pageEnd = currentUnits[currentUnits.length - 1].pageNumber
    const ordinal = (ordinalBySection.get(currentSection) ?? 0) + 1
    ordinalBySection.set(currentSection, ordinal)
    const text = currentUnits.map((unit) => unit.text).join('\n\n')
    const pageLabel = pageStart === pageEnd ? `p${pageStart}` : `p${pageStart}-${pageEnd}`

    chunks.push({
      chunkId: `${fileSlug}:${pageLabel}:${currentSection}:${String(ordinal).padStart(2, '0')}`,
      pageStart,
      pageEnd,
      sectionId: currentSection,
      heading: currentUnits.find((unit) => unit.heading)?.heading ?? null,
      text,
      keywords: keywordsForChunk(text, currentSection),
      sourceRefs: currentUnits.map((unit) => ({
        page: unit.pageNumber,
        excerpt: unit.excerpt,
      })),
    })

    currentUnits = []
    currentSection = null
    currentLength = 0
  }

  for (const unit of units) {
    const nextSection = unit.sectionId
    const nextLength = currentLength === 0 ? unit.text.length : currentLength + 2 + unit.text.length
    const sectionChanged = currentSection !== null && nextSection !== currentSection
    const wouldOverflow = nextLength > MAX_CHUNK_SIZE
    const currentIsReady = currentLength >= MIN_CHUNK_SIZE

    if (sectionChanged || (wouldOverflow && currentIsReady)) {
      pushChunk()
    }

    if (currentSection === null) {
      currentSection = nextSection
    }

    currentUnits.push(unit)
    currentLength = currentLength === 0 ? unit.text.length : currentLength + 2 + unit.text.length

    if (currentLength >= TARGET_CHUNK_SIZE) {
      pushChunk()
    }
  }

  pushChunk()
  return chunks
}

function canonicalizeLinkStem(fileName: string): string {
  const baseName = fileName.replace(/\.pdf$/i, '')
  const normalized = baseName
    .replace(/[()]/g, ' ')
    .replace(/[_/.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = normalized
    .split(' ')
    .map((token) => token.toUpperCase())
    .map((token) => token.replace(/[^A-Z0-9]/g, ''))
    .filter((token) => token.length > 0)
    .filter((token) => !TOKEN_STOPWORDS.has(token))
    .filter((token) => !INSURER_CODE_TOKENS.has(token))
    .filter((token) => !/^V?\d+(?:\d{4,}|(?:\.\d+)*)$/.test(token))

  return slugify(tokens.join(' '))
}

function buildLinkKey(entry: ExtractedManifestEntry): string {
  const canonicalStem = canonicalizeLinkStem(entry.sourceFileName)
  if (canonicalStem.length > 0) {
    return canonicalStem
  }

  return slugify(`${inferInsurer(entry.sourceFileName)} ${inferProductName(entry.sourceFileName)}`)
}

function buildLinkedDocumentMap(entries: ExtractedManifestEntry[]): Map<string, LinkedDocument[]> {
  const contextByFileName = new Map<string, LinkedDocumentContext>()
  const grouped = new Map<string, LinkedDocumentContext[]>()

  for (const entry of entries) {
    const context: LinkedDocumentContext = {
      insurer: entry.insurer,
      documentType: entry.documentType,
      linkKey: buildLinkKey(entry),
      sourceFileName: entry.sourceFileName,
    }
    contextByFileName.set(entry.sourceFileName, context)

    const groupKey = `${entry.insurer}::${context.linkKey}`
    const group = grouped.get(groupKey) ?? []
    group.push(context)
    grouped.set(groupKey, group)
  }

  const linkedDocumentMap = new Map<string, LinkedDocument[]>()

  for (const context of contextByFileName.values()) {
    const siblings = grouped.get(`${context.insurer}::${context.linkKey}`) ?? []
    linkedDocumentMap.set(
      context.sourceFileName,
      siblings
        .filter((sibling) => sibling.sourceFileName !== context.sourceFileName)
        .filter((sibling) => sibling.documentType !== context.documentType)
        .map((sibling) => ({
          sourceFileName: sibling.sourceFileName,
          documentType: sibling.documentType,
          relationship: 'same-product' as const,
        }))
        .sort((left, right) => left.sourceFileName.localeCompare(right.sourceFileName)),
    )
  }

  return linkedDocumentMap
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  const temporaryPath = `${targetPath}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, targetPath)
}

async function readExtractedManifest(): Promise<ExtractedManifest> {
  const raw = await readFile(EXTRACTED_MANIFEST_PATH, 'utf8')
  return extractedManifestSchema.parse(JSON.parse(raw)) as ExtractedManifest
}

async function readExtractedArtifact(artifactPath: string): Promise<ExtractedArtifact> {
  const raw = await readFile(artifactPath, 'utf8')
  return extractedArtifactSchema.parse(JSON.parse(raw)) as ExtractedArtifact
}

async function readPreparedArtifact(preparedPath: string): Promise<PreparedArtifact | null> {
  try {
    const raw = await readFile(preparedPath, 'utf8')
    return preparedArtifactSchema.parse(JSON.parse(raw)) as PreparedArtifact
  } catch {
    return null
  }
}

async function readPreparedChecksum(preparedPath: string): Promise<string | null> {
  const prepared = await readPreparedArtifact(preparedPath)
  return prepared?.sourceChecksum ?? null
}

function buildPreparedArtifact(
  entry: ExtractedManifestEntry,
  extracted: ExtractedArtifact,
  linkedDocuments: LinkedDocument[],
): PreparedArtifact {
  const { normalizedPages, textQuality } = normalizePages(extracted)
  const normalizedFullText = normalizedPages.map((page) => page.text).join('\n\n')
  const detectedSections = detectSections(normalizedFullText)
  const blocks = buildBlocks(normalizedPages, detectedSections)
  const units = buildUnits(blocks)
  const fileSlug = slugify(entry.sourceFileName.replace(/\.pdf$/i, ''))

  return {
    sourceFileName: entry.sourceFileName,
    sourceChecksum: entry.sourceChecksum,
    preparedAt: new Date().toISOString(),
    documentType: classifyDocumentType(entry.sourceFileName),
    insurer: inferInsurer(entry.sourceFileName),
    productName: inferProductName(entry.sourceFileName),
    extractedArtifactPath: extractedArtifactRelativePath(entry.sourceFileName),
    textQuality,
    normalizedPages,
    detectedSections,
    documentSignals: detectDocumentSignals(normalizedFullText),
    chunks: buildChunks(fileSlug, units),
    linkedDocuments,
  }
}

async function prepareArtifact(
  entry: ExtractedManifestEntry,
  total: number,
  index: number,
  linkedDocumentMap: Map<string, LinkedDocument[]>,
): Promise<PreparedArtifactBuildResult> {
  const progressPrefix = `[${index + 1}/${total}]`
  const preparedPath = preparedArtifactPathForFileName(entry.sourceFileName)
  const cachedChecksum = await readPreparedChecksum(preparedPath)

  if (cachedChecksum === entry.sourceChecksum) {
    console.log(`${progressPrefix} Skipping (cached): ${path.basename(preparedPath)}`)
    const prepared = await readPreparedArtifact(preparedPath)
    if (!prepared) {
      throw new Error(`Prepared artifact became unreadable while cached: ${preparedPath}`)
    }
    return {
      prepared,
      wasWritten: false,
    }
  }

  console.log(`${progressPrefix} Preparing: ${path.basename(preparedPath)}`)

  const extracted = await readExtractedArtifact(path.join(FIXTURES_DIR, entry.artifactPath))
  const prepared = buildPreparedArtifact(entry, extracted, linkedDocumentMap.get(entry.sourceFileName) ?? [])
  await writeJson(preparedPath, prepared)

  return {
    prepared,
    wasWritten: true,
  }
}

function buildPreparedManifestEntry(prepared: PreparedArtifact, preparedPath: string): PreparedManifestEntry {
  return {
    sourceFileName: prepared.sourceFileName,
    sourceChecksum: prepared.sourceChecksum,
    documentType: prepared.documentType,
    insurer: prepared.insurer,
    productName: prepared.productName,
    chunkCount: prepared.chunks.length,
    detectedSections: prepared.detectedSections,
    signals: prepared.documentSignals,
    preparedArtifactPath: artifactPathInManifest(preparedPath),
  }
}

async function buildPreparedManifest(entries: ExtractedManifestEntry[]): Promise<PreparedManifest> {
  const preparedEntries: PreparedManifestEntry[] = []

  for (const entry of entries) {
    const preparedPath = preparedArtifactPathForFileName(entry.sourceFileName)
    const prepared = await readPreparedArtifact(preparedPath)
    if (!prepared || prepared.sourceChecksum !== entry.sourceChecksum) {
      continue
    }
    preparedEntries.push(buildPreparedManifestEntry(prepared, preparedPath))
  }

  return {
    generatedAt: new Date().toISOString(),
    totalPrepared: preparedEntries.length,
    entries: preparedEntries,
  }
}

async function main() {
  await mkdir(PREPARED_DIR, { recursive: true })

  const extractedManifest = await readExtractedManifest()
  const linkedDocumentMap = buildLinkedDocumentMap(extractedManifest.entries)
  let writtenCount = 0

  for (const [index, entry] of extractedManifest.entries.entries()) {
    const result = await prepareArtifact(entry, extractedManifest.entries.length, index, linkedDocumentMap)
    if (result.wasWritten) {
      writtenCount += 1
    }
  }

  const preparedManifest = await buildPreparedManifest(extractedManifest.entries)
  await writeJson(PREPARED_MANIFEST_PATH, preparedManifest)

  console.log(`Prepared ${preparedManifest.totalPrepared} artifacts to ${PREPARED_DIR}`)
  console.log(`Wrote ${writtenCount} prepared artifacts in this run`)
  console.log(`Wrote prepared manifest to ${PREPARED_MANIFEST_PATH}`)
}

await main()
