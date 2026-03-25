import { createReadStream } from 'node:fs'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { ExtractedPdfDocument } from './pdf/extractPdfText.js'
import { extractPdfText } from './pdf/extractPdfText.js'
import {
  MANUAL_CORPUS_DIR,
  inferInsurer,
  inferProductName,
  isBrochureFile,
  isSummaryFile,
  slugify,
} from './discovery.js'
import type { IlpCatalogSourceDocumentType } from '../../src/lib/ilp-catalog/types.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures')
const EXTRACTED_DIR = path.join(FIXTURES_DIR, 'extracted')
const MANIFEST_PATH = path.join(FIXTURES_DIR, 'corpus-manifest.json')
const MINIMUM_EXTRACTED_CHARACTERS = 500
const SHA256_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/
const SUSPICIOUS_CHAR_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u0100-\u024f]/g
const SUSPICIOUS_CHAR_SEQUENCE_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u0100-\u024f]{8,}/
const MINIMUM_SUSPICIOUS_CHAR_COUNT = 24
const MAXIMUM_SUSPICIOUS_CHAR_RATIO = 0.015

const execFileAsync = promisify(execFile)

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

interface CorpusSource {
  fileName: string
  filePath: string
  artifactPath: string
  insurer: string
  productName: string
  documentType: CorpusDocumentType
}

interface CorpusArtifact {
  sourceFileName: string
  sourceChecksum: string
  extractedAt: string
  insurer: string
  productName: string
  documentType: CorpusDocumentType
  pageCount: number
  totalCharacters: number
  detectedSections: DetectedSectionId[]
  pages: ExtractedPdfDocument['pages']
  fullText: string
}

interface CorpusManifestEntry {
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

interface CorpusFailure {
  sourceFileName: string
  error: string
}

interface CorpusManifest {
  generatedAt: string
  corpusDir: string
  totalPdfs: number
  extracted: number
  failed: number
  entries: CorpusManifestEntry[]
  failures: CorpusFailure[]
}

interface ExtractionPassResult {
  failures: Map<string, CorpusFailure>
  checksums: Map<string, string>
}

interface TextQualitySignals {
  suspiciousCharacterCount: number
  nonWhitespaceCharacterCount: number
  suspiciousCharacterRatio: number
  hasSuspiciousRun: boolean
}

const artifactSchema: z.ZodType<CorpusArtifact> = z.object({
  sourceFileName: z.string().min(1),
  sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
  extractedAt: z.string().min(1),
  insurer: z.string().min(1),
  productName: z.string().min(1),
  documentType: z.enum(['summary', 'brochure', 'unclassified']),
  pageCount: z.number().int().min(1),
  totalCharacters: z.number().int().min(0),
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
}).superRefine((artifact, ctx) => {
  if (artifact.pages.length !== artifact.pageCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'pageCount must match pages length',
      path: ['pageCount'],
    })
  }
})

const SECTION_PATTERNS: Array<{ id: DetectedSectionId, pattern: RegExp }> = [
  { id: 'policy-details', pattern: /\b(the policy|policy details|plan details)\b/i },
  { id: 'bonus', pattern: /\b(bonus|bonuses|loyalty bonus|power-up bonus|welcome bonus)\b/i },
  { id: 'fees', pattern: /\b(policy fees and charges|fees and charges|management fee|policy charge)\b/i },
  { id: 'withdrawal-charge', pattern: /\b(withdrawal|partial withdrawal|surrender)\b/i },
  { id: 'eec', pattern: /\b(early exit charge|eec|surrender charge)\b/i },
  { id: 'death-benefit', pattern: /\b(death benefit|basic death benefit|advanced death benefit|sum assured)\b/i },
  { id: 'premium-payment', pattern: /\b(premium payment|regular premium|single premium|top-up premium|top up premium)\b/i },
  { id: 'maturity-benefit', pattern: /\b(maturity benefit|maturity value)\b/i },
]

function classifyDocumentType(fileName: string): CorpusDocumentType {
  if (isSummaryFile(fileName)) return 'summary'
  if (isBrochureFile(fileName)) return 'brochure'
  return 'unclassified'
}

function artifactPathForFileName(fileName: string): string {
  const baseName = fileName.replace(/\.pdf$/i, '')
  return path.join(EXTRACTED_DIR, `${slugify(baseName)}.json`)
}

function artifactPathInManifest(artifactPath: string): string {
  return path.relative(FIXTURES_DIR, artifactPath).replaceAll(path.sep, '/')
}

function detectSections(text: string): DetectedSectionId[] {
  return SECTION_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ id }) => id)
}

function normalizeFallbackLineText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:%\)])/, '$1')
    .replace(/([\(\$])\s+/g, '$1')
    .trim()
}

function buildFallbackExtractedDocument(filePath: string, pageTexts: string[]): ExtractedPdfDocument {
  const pages = pageTexts.map((pageText, index) => {
    const lines = pageText
      .split(/\r?\n/)
      .map((line) => normalizeFallbackLineText(line))
      .filter((line) => line.length > 0)
      .map((line, lineIndex) => ({
        y: 1000 - lineIndex,
        text: line,
      }))
    const text = lines.map((line) => line.text).join('\n')

    return {
      pageNumber: index + 1,
      lines,
      text,
      characterCount: text.replace(/\s+/g, '').length,
    }
  })

  return {
    filePath,
    pageCount: pages.length,
    pages,
    totalCharacters: pages.reduce((sum, page) => sum + page.characterCount, 0),
  }
}

function buildArtifact(source: CorpusSource, extracted: ExtractedPdfDocument, sourceChecksum: string): CorpusArtifact {
  const fullText = extracted.pages.map((page) => page.text).join('\n\n')

  return {
    sourceFileName: source.fileName,
    sourceChecksum,
    extractedAt: new Date().toISOString(),
    insurer: source.insurer,
    productName: source.productName,
    documentType: source.documentType,
    pageCount: extracted.pageCount,
    totalCharacters: extracted.totalCharacters,
    detectedSections: detectSections(fullText),
    pages: extracted.pages,
    fullText,
  }
}

function buildManifestEntry(artifact: CorpusArtifact, artifactPath: string): CorpusManifestEntry {
  return {
    sourceFileName: artifact.sourceFileName,
    sourceChecksum: artifact.sourceChecksum,
    insurer: artifact.insurer,
    productName: artifact.productName,
    documentType: artifact.documentType,
    pageCount: artifact.pageCount,
    totalCharacters: artifact.totalCharacters,
    detectedSections: artifact.detectedSections,
    artifactPath: artifactPathInManifest(artifactPath),
  }
}

function sparseTextFailure(extracted: ExtractedPdfDocument): string | null {
  if (extracted.pageCount === 0) {
    return 'No pages were extracted from the PDF.'
  }

  if (extracted.totalCharacters < MINIMUM_EXTRACTED_CHARACTERS) {
    return `Text layer too sparse (${extracted.totalCharacters} chars across ${extracted.pageCount} pages; minimum ${MINIMUM_EXTRACTED_CHARACTERS})`
  }

  return null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown extraction error'
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

function documentHasSuspiciousText(extracted: ExtractedPdfDocument): boolean {
  return extracted.pages.some((page) => hasSuspiciousText(page.text))
}

async function extractWithPdfToText(filePath: string): Promise<ExtractedPdfDocument | null> {
  try {
    const { stdout } = await execFileAsync('pdftotext', ['-layout', filePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    const pageTexts = stdout
      .split('\f')
      .map((pageText) => pageText.replace(/\r/g, '').trim())
      .filter((pageText) => pageText.length > 0)

    if (pageTexts.length === 0) {
      return null
    }

    return buildFallbackExtractedDocument(filePath, pageTexts)
  } catch {
    return null
  }
}

async function extractBestAvailableText(filePath: string): Promise<ExtractedPdfDocument> {
  const extracted = await extractPdfText(filePath)
  if (!documentHasSuspiciousText(extracted)) {
    return extracted
  }

  const fallback = await extractWithPdfToText(filePath)
  if (!fallback) {
    return extracted
  }

  if (hasSuspiciousText(fallback.pages.map((page) => page.text).join('\n\n'))) {
    return extracted
  }

  return fallback
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256')

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => {
      hash.update(chunk)
    })
    stream.on('end', () => {
      resolve()
    })
    stream.on('error', (error) => {
      reject(error)
    })
  })

  return `sha256:${hash.digest('hex')}`
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  const temporaryPath = `${targetPath}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, targetPath)
}

async function readArtifact(artifactPath: string): Promise<CorpusArtifact | null> {
  try {
    const raw = await readFile(artifactPath, 'utf8')
    return artifactSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

async function readCachedArtifactChecksum(artifactPath: string): Promise<string | null> {
  const artifact = await readArtifact(artifactPath)
  if (!artifact) return null
  if (hasSuspiciousText(artifact.fullText)) return null
  return artifact.sourceChecksum
}

async function listCorpusSources(): Promise<CorpusSource[]> {
  const entries = await readdir(MANUAL_CORPUS_DIR, { withFileTypes: true })
  const sources = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => ({
      fileName: entry.name,
      filePath: path.join(MANUAL_CORPUS_DIR, entry.name),
      artifactPath: artifactPathForFileName(entry.name),
      insurer: inferInsurer(entry.name),
      productName: inferProductName(entry.name),
      documentType: classifyDocumentType(entry.name),
    }))
    .sort((left, right) => left.fileName.localeCompare(right.fileName))

  const seenArtifactPaths = new Map<string, string>()
  for (const source of sources) {
    const existing = seenArtifactPaths.get(source.artifactPath)
    if (existing) {
      throw new Error(`Artifact filename collision between "${existing}" and "${source.fileName}"`)
    }
    seenArtifactPaths.set(source.artifactPath, source.fileName)
  }

  return sources
}

async function extractArtifacts(sources: CorpusSource[]): Promise<ExtractionPassResult> {
  const failures = new Map<string, CorpusFailure>()
  const checksums = new Map<string, string>()

  for (const [index, source] of sources.entries()) {
    const progressPrefix = `[${index + 1}/${sources.length}]`
    const sourceChecksum = await sha256(source.filePath)
    checksums.set(source.fileName, sourceChecksum)
    const cachedChecksum = await readCachedArtifactChecksum(source.artifactPath)

    if (cachedChecksum === sourceChecksum) {
      console.log(`${progressPrefix} Skipping (cached): ${source.fileName}`)
      continue
    }

    console.log(`${progressPrefix} Extracting: ${source.fileName}`)

    try {
      const extracted = await extractBestAvailableText(source.filePath)
      const sparseReason = sparseTextFailure(extracted)
      if (sparseReason) {
        failures.set(source.fileName, {
          sourceFileName: source.fileName,
          error: sparseReason,
        })
        console.log(`${progressPrefix} Failed: ${source.fileName} (${sparseReason})`)
        continue
      }

      const artifact = buildArtifact(source, extracted, sourceChecksum)
      await writeJson(source.artifactPath, artifact)
    } catch (error) {
      const message = errorMessage(error)
      failures.set(source.fileName, {
        sourceFileName: source.fileName,
        error: message,
      })
      console.log(`${progressPrefix} Failed: ${source.fileName} (${message})`)
    }
  }

  return { failures, checksums }
}

async function buildManifest(
  sources: CorpusSource[],
  checksums: Map<string, string>,
  failures: Map<string, CorpusFailure>,
): Promise<CorpusManifest> {
  const entries: CorpusManifestEntry[] = []

  for (const source of sources) {
    const sourceChecksum = checksums.get(source.fileName)
    if (!sourceChecksum) {
      if (!failures.has(source.fileName)) {
        failures.set(source.fileName, {
          sourceFileName: source.fileName,
          error: 'Missing checksum for source PDF',
        })
      }
      continue
    }

    const artifact = await readArtifact(source.artifactPath)

    if (!artifact || artifact.sourceChecksum !== sourceChecksum) {
      if (!failures.has(source.fileName)) {
        failures.set(source.fileName, {
          sourceFileName: source.fileName,
          error: 'Missing or stale extraction artifact',
        })
      }
      continue
    }

    entries.push(buildManifestEntry(artifact, source.artifactPath))
  }

  const failureList = [...failures.values()].sort((left, right) => left.sourceFileName.localeCompare(right.sourceFileName))

  return {
    generatedAt: new Date().toISOString(),
    corpusDir: MANUAL_CORPUS_DIR,
    totalPdfs: sources.length,
    extracted: entries.length,
    failed: failureList.length,
    entries,
    failures: failureList,
  }
}

async function main() {
  await mkdir(EXTRACTED_DIR, { recursive: true })

  const sources = await listCorpusSources()
  const { failures, checksums } = await extractArtifacts(sources)
  const manifest = await buildManifest(sources, checksums, failures)

  await writeJson(MANIFEST_PATH, manifest)

  console.log(`Processed ${manifest.totalPdfs} PDFs`)
  console.log(`Extracted ${manifest.extracted} artifacts to ${EXTRACTED_DIR}`)
  console.log(`Recorded ${manifest.failed} failures`)
  console.log(`Wrote corpus manifest to ${MANIFEST_PATH}`)
}

await main()
