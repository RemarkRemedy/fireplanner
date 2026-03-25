import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures')
const EVIDENCE_MANIFEST_PATH = path.join(FIXTURES_DIR, 'evidence-manifest.json')
const PREPARED_MANIFEST_PATH = path.join(FIXTURES_DIR, 'prepared-manifest.json')
const REVIEW_SET_PATH = path.join(FIXTURES_DIR, 'evidence-review-set.json')
const SHA256_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/

type CorpusDocumentType = 'summary' | 'brochure' | 'unclassified'
type EvidenceFieldId =
  | 'bonus'
  | 'fees-and-charges'
  | 'early-exit-charge'
  | 'partial-withdrawal'
  | 'premium-payment'
  | 'premium-holiday'
  | 'death-benefit'
  | 'maturity-benefit'

interface EvidenceCandidate {
  candidateId: string
  chunkId: string
  pageStart: number
  pageEnd: number
  sectionId: string
  heading: string | null
  excerpt: string
  matchedPhrases: string[]
  reasonCodes: string[]
  score: number
  sourceRefs: Array<{
    page: number
    excerpt: string
  }>
}

interface EvidenceFieldPacket {
  fieldId: EvidenceFieldId
  label: string
  status: 'candidate-found' | 'not-detected'
  candidateCount: number
  bestCandidate: EvidenceCandidate | null
}

interface EvidenceArtifact {
  sourceFileName: string
  sourceChecksum: string
  generatedAt: string
  documentType: CorpusDocumentType
  insurer: string
  productName: string
  preparedArtifactPath: string
  linkedDocuments: Array<{
    sourceFileName: string
    documentType: CorpusDocumentType
    relationship: 'same-product'
  }>
  fieldPackets: Record<EvidenceFieldId, EvidenceFieldPacket>
  summary: {
    fieldsWithCandidates: EvidenceFieldId[]
    fieldsWithoutCandidates: EvidenceFieldId[]
    manualReviewRecommended: boolean
    notes: string[]
  }
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

interface PreparedManifestEntry {
  sourceFileName: string
  sourceChecksum: string
  documentType: CorpusDocumentType
  insurer: string
  productName: string
  chunkCount: number
  preparedArtifactPath: string
}

interface PreparedManifest {
  generatedAt: string
  totalPrepared: number
  entries: PreparedManifestEntry[]
}

interface ReviewSetEntry {
  sourceFileName: string
  insurer: string
  productName: string
  documentType: CorpusDocumentType
  preparedArtifactPath: string
  evidenceArtifactPath: string
  chunkCount: number
  fieldsWithCandidates: EvidenceFieldId[]
  fieldsWithoutCandidates: EvidenceFieldId[]
  linkedDocumentCount: number
  manualReviewRecommended: boolean
  whyIncluded: string[]
  reviewQuestions: string[]
  fieldSnapshots: Array<{
    fieldId: EvidenceFieldId
    status: 'candidate-found' | 'not-detected'
    candidateCount: number
    bestCandidate: {
      chunkId: string
      pageStart: number
      pageEnd: number
      heading: string | null
      score: number
      matchedPhrases: string[]
      excerpt: string
    } | null
  }>
}

interface EvidenceReviewSet {
  generatedAt: string
  totalEntries: number
  selectionRules: string[]
  coverageSummary: {
    byDocumentType: Record<CorpusDocumentType, number>
    byField: Record<EvidenceFieldId, number>
  }
  entries: ReviewSetEntry[]
}

interface ReviewCandidate {
  manifestEntry: EvidenceManifestEntry
  preparedEntry: PreparedManifestEntry
  evidence: EvidenceArtifact
  candidateFieldCount: number
  missingFieldCount: number
}

const evidenceManifestSchema = z.object({
  generatedAt: z.string().min(1),
  totalEvidenceArtifacts: z.number().int().min(0),
  entries: z.array(z.object({
    sourceFileName: z.string().min(1),
    sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
    insurer: z.string().min(1),
    productName: z.string().min(1),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    preparedArtifactPath: z.string().min(1),
    evidenceArtifactPath: z.string().min(1),
    fieldsWithCandidates: z.array(z.enum([
      'bonus',
      'fees-and-charges',
      'early-exit-charge',
      'partial-withdrawal',
      'premium-payment',
      'premium-holiday',
      'death-benefit',
      'maturity-benefit',
    ])),
    fieldsWithoutCandidates: z.array(z.enum([
      'bonus',
      'fees-and-charges',
      'early-exit-charge',
      'partial-withdrawal',
      'premium-payment',
      'premium-holiday',
      'death-benefit',
      'maturity-benefit',
    ])),
    manualReviewRecommended: z.boolean(),
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
    preparedArtifactPath: z.string().min(1),
  })),
})

const evidenceArtifactSchema = z.object({
  sourceFileName: z.string().min(1),
  sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
  generatedAt: z.string().min(1),
  documentType: z.enum(['summary', 'brochure', 'unclassified']),
  insurer: z.string().min(1),
  productName: z.string().min(1),
  preparedArtifactPath: z.string().min(1),
  linkedDocuments: z.array(z.object({
    sourceFileName: z.string().min(1),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    relationship: z.literal('same-product'),
  })),
  fieldPackets: z.record(z.object({
    fieldId: z.enum([
      'bonus',
      'fees-and-charges',
      'early-exit-charge',
      'partial-withdrawal',
      'premium-payment',
      'premium-holiday',
      'death-benefit',
      'maturity-benefit',
    ]),
    label: z.string().min(1),
    status: z.enum(['candidate-found', 'not-detected']),
    candidateCount: z.number().int().min(0),
    bestCandidate: z.object({
      candidateId: z.string().min(1),
      chunkId: z.string().min(1),
      pageStart: z.number().int().min(1),
      pageEnd: z.number().int().min(1),
      sectionId: z.string().min(1),
      heading: z.string().min(1).nullable(),
      excerpt: z.string().min(1),
      matchedPhrases: z.array(z.string()),
      reasonCodes: z.array(z.string()),
      score: z.number(),
      sourceRefs: z.array(z.object({
        page: z.number().int().min(1),
        excerpt: z.string().min(1),
      })).min(1),
    }).nullable(),
  })),
  summary: z.object({
    fieldsWithCandidates: z.array(z.enum([
      'bonus',
      'fees-and-charges',
      'early-exit-charge',
      'partial-withdrawal',
      'premium-payment',
      'premium-holiday',
      'death-benefit',
      'maturity-benefit',
    ])),
    fieldsWithoutCandidates: z.array(z.enum([
      'bonus',
      'fees-and-charges',
      'early-exit-charge',
      'partial-withdrawal',
      'premium-payment',
      'premium-holiday',
      'death-benefit',
      'maturity-benefit',
    ])),
    manualReviewRecommended: z.boolean(),
    notes: z.array(z.string()),
  }),
})

const PRIORITY_SUMMARY_INSURERS = [
  'Etiqa',
  'HSBC Life',
  'AIA',
  'Great Eastern',
  'Tokio Marine',
]

const PRIORITY_BROCHURE_INSURERS = [
  'AIA',
  'Etiqa',
  'Great Eastern',
  'Prudential',
  'Tokio Marine',
]

const REVIEW_QUESTIONS = [
  'Is the best candidate actually on-topic for the field, not just nearby context?',
  'Would you trust this candidate as the source fact anchor for later normalization?',
  'If the best candidate is weak, is there a better alternate candidate in the same packet?',
]

function compareCandidates(left: ReviewCandidate, right: ReviewCandidate): number {
  return (
    right.candidateFieldCount - left.candidateFieldCount
    || left.missingFieldCount - right.missingFieldCount
    || right.preparedEntry.chunkCount - left.preparedEntry.chunkCount
    || left.manifestEntry.sourceFileName.localeCompare(right.manifestEntry.sourceFileName)
  )
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  const temporaryPath = `${targetPath}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, targetPath)
}

async function readEvidenceManifest(): Promise<EvidenceManifest> {
  const raw = await readFile(EVIDENCE_MANIFEST_PATH, 'utf8')
  return evidenceManifestSchema.parse(JSON.parse(raw)) as EvidenceManifest
}

async function readPreparedManifest(): Promise<PreparedManifest> {
  const raw = await readFile(PREPARED_MANIFEST_PATH, 'utf8')
  return preparedManifestSchema.parse(JSON.parse(raw)) as PreparedManifest
}

async function readEvidenceArtifact(evidencePath: string): Promise<EvidenceArtifact> {
  const raw = await readFile(evidencePath, 'utf8')
  return evidenceArtifactSchema.parse(JSON.parse(raw)) as EvidenceArtifact
}

function fieldSnapshots(evidence: EvidenceArtifact): ReviewSetEntry['fieldSnapshots'] {
  return (Object.values(evidence.fieldPackets) as EvidenceFieldPacket[])
    .map((packet) => ({
      fieldId: packet.fieldId,
      status: packet.status,
      candidateCount: packet.candidateCount,
      bestCandidate: packet.bestCandidate
        ? {
            chunkId: packet.bestCandidate.chunkId,
            pageStart: packet.bestCandidate.pageStart,
            pageEnd: packet.bestCandidate.pageEnd,
            heading: packet.bestCandidate.heading,
            score: packet.bestCandidate.score,
            matchedPhrases: packet.bestCandidate.matchedPhrases,
            excerpt: packet.bestCandidate.excerpt,
          }
        : null,
    }))
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId))
}

function buildCoverageSummary(entries: EvidenceManifestEntry[]): EvidenceReviewSet['coverageSummary'] {
  const byDocumentType: Record<CorpusDocumentType, number> = {
    summary: 0,
    brochure: 0,
    unclassified: 0,
  }
  const byField: Record<EvidenceFieldId, number> = {
    bonus: 0,
    'fees-and-charges': 0,
    'early-exit-charge': 0,
    'partial-withdrawal': 0,
    'premium-payment': 0,
    'premium-holiday': 0,
    'death-benefit': 0,
    'maturity-benefit': 0,
  }

  for (const entry of entries) {
    byDocumentType[entry.documentType] += 1
    for (const fieldId of entry.fieldsWithCandidates) {
      byField[fieldId] += 1
    }
  }

  return { byDocumentType, byField }
}

function addUnique(
  selected: ReviewCandidate[],
  seen: Set<string>,
  candidate: ReviewCandidate | undefined,
  whyIncluded: Map<string, string[]>,
  reason: string,
): void {
  if (!candidate || seen.has(candidate.manifestEntry.sourceFileName)) {
    return
  }

  selected.push(candidate)
  seen.add(candidate.manifestEntry.sourceFileName)
  whyIncluded.set(candidate.manifestEntry.sourceFileName, [reason])
}

function appendReason(whyIncluded: Map<string, string[]>, sourceFileName: string, reason: string): void {
  const reasons = whyIncluded.get(sourceFileName)
  if (!reasons || reasons.includes(reason)) return
  reasons.push(reason)
}

async function main() {
  const evidenceManifest = await readEvidenceManifest()
  const preparedManifest = await readPreparedManifest()
  const preparedByFileName = new Map(preparedManifest.entries.map((entry) => [entry.sourceFileName, entry]))
  const candidates: ReviewCandidate[] = []

  for (const manifestEntry of evidenceManifest.entries) {
    const preparedEntry = preparedByFileName.get(manifestEntry.sourceFileName)
    if (!preparedEntry) {
      continue
    }

    const evidence = await readEvidenceArtifact(path.join(FIXTURES_DIR, manifestEntry.evidenceArtifactPath))
    candidates.push({
      manifestEntry,
      preparedEntry,
      evidence,
      candidateFieldCount: manifestEntry.fieldsWithCandidates.length,
      missingFieldCount: manifestEntry.fieldsWithoutCandidates.length,
    })
  }

  const summaries = candidates.filter((candidate) => candidate.manifestEntry.documentType === 'summary').sort(compareCandidates)
  const brochures = candidates.filter((candidate) => candidate.manifestEntry.documentType === 'brochure').sort(compareCandidates)
  const unclassified = candidates.filter((candidate) => candidate.manifestEntry.documentType === 'unclassified').sort(compareCandidates)
  const selected: ReviewCandidate[] = []
  const seen = new Set<string>()
  const whyIncluded = new Map<string, string[]>()

  for (const insurer of PRIORITY_SUMMARY_INSURERS) {
    addUnique(
      selected,
      seen,
      summaries.find((candidate) => candidate.manifestEntry.insurer === insurer),
      whyIncluded,
      `Top evidence-rich summary for ${insurer}.`,
    )
  }

  for (const insurer of PRIORITY_BROCHURE_INSURERS) {
    addUnique(
      selected,
      seen,
      brochures.find((candidate) => candidate.manifestEntry.insurer === insurer),
      whyIncluded,
      `Top evidence-rich brochure for ${insurer}.`,
    )
  }

  const highestChunk = [...candidates].sort((left, right) => (
    right.preparedEntry.chunkCount - left.preparedEntry.chunkCount
    || compareCandidates(left, right)
  ))[0]
  addUnique(
    selected,
    seen,
    highestChunk,
    whyIncluded,
    'Highest chunk-count document to stress-test dense evidence packets.',
  )

  for (const candidate of brochures.slice().reverse()) {
    if (selected.length >= 13) break
    if (candidate.candidateFieldCount <= 3) {
      addUnique(
        selected,
        seen,
        candidate,
        whyIncluded,
        'Low-coverage brochure edge case for recall calibration.',
      )
    }
  }

  for (const candidate of unclassified) {
    addUnique(
      selected,
      seen,
      candidate,
      whyIncluded,
      'Unclassified filename heuristic edge case.',
    )
  }

  if (highestChunk && seen.has(highestChunk.manifestEntry.sourceFileName)) {
    appendReason(whyIncluded, highestChunk.manifestEntry.sourceFileName, 'Highest chunk-count document to stress-test dense evidence packets.')
  }

  const reviewSet: EvidenceReviewSet = {
    generatedAt: new Date().toISOString(),
    totalEntries: selected.length,
    selectionRules: [
      'Include evidence-rich summaries across major insurers.',
      'Include evidence-rich brochures across major insurers.',
      'Include at least one dense, high chunk-count packet.',
      'Include low-coverage brochures as recall edge cases.',
      'Include unclassified documents when present.',
    ],
    coverageSummary: buildCoverageSummary(evidenceManifest.entries),
    entries: selected
      .sort((left, right) => left.manifestEntry.sourceFileName.localeCompare(right.manifestEntry.sourceFileName))
      .map((candidate) => ({
        sourceFileName: candidate.manifestEntry.sourceFileName,
        insurer: candidate.manifestEntry.insurer,
        productName: candidate.manifestEntry.productName,
        documentType: candidate.manifestEntry.documentType,
        preparedArtifactPath: candidate.manifestEntry.preparedArtifactPath,
        evidenceArtifactPath: candidate.manifestEntry.evidenceArtifactPath,
        chunkCount: candidate.preparedEntry.chunkCount,
        fieldsWithCandidates: candidate.manifestEntry.fieldsWithCandidates,
        fieldsWithoutCandidates: candidate.manifestEntry.fieldsWithoutCandidates,
        linkedDocumentCount: candidate.evidence.linkedDocuments.length,
        manualReviewRecommended: candidate.manifestEntry.manualReviewRecommended,
        whyIncluded: whyIncluded.get(candidate.manifestEntry.sourceFileName) ?? [],
        reviewQuestions: REVIEW_QUESTIONS,
        fieldSnapshots: fieldSnapshots(candidate.evidence),
      })),
  }

  await writeJson(REVIEW_SET_PATH, reviewSet)
  console.log(`Wrote ${reviewSet.totalEntries} review-set entries to ${REVIEW_SET_PATH}`)
}

await main()
