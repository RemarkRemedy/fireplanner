import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { inferInsurer, inferProductName, isBrochureFile, isSummaryFile, slugify } from './discovery.js'
import type { IlpCatalogSourceDocumentType } from '../../src/lib/ilp-catalog/types.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures')
const EVIDENCE_DIR = path.join(FIXTURES_DIR, 'evidence')
const FACTS_DIR = path.join(FIXTURES_DIR, 'facts')
const EVIDENCE_MANIFEST_PATH = path.join(FIXTURES_DIR, 'evidence-manifest.json')
const FACTS_MANIFEST_PATH = path.join(FIXTURES_DIR, 'facts-manifest.json')
const SHA256_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/

type CorpusDocumentType = IlpCatalogSourceDocumentType | 'unclassified'
type EvidenceFieldId =
  | 'bonus'
  | 'fees-and-charges'
  | 'early-exit-charge'
  | 'partial-withdrawal'
  | 'premium-payment'
  | 'premium-holiday'
  | 'death-benefit'
  | 'maturity-benefit'

type FactStatus = 'normalized' | 'not-detected'
type PremiumMode = 'regular-premium' | 'single-premium' | 'mixed' | 'unclear'
type BonusType = 'loyalty-bonus' | 'welcome-bonus' | 'start-up-bonus' | 'special-bonus' | 'premium-bonus' | 'bonus'
type ChargeType = 'premium-charge' | 'policy-charge' | 'management-fee' | 'insurance-charge' | 'administration-charge' | 'surrender-charge' | 'early-exit-charge'
type WithdrawalMarker = 'partial-withdrawal' | 'partial-surrender' | 'full-surrender' | 'surrender-value'
type DeathBenefitMarker = 'death-benefit' | 'terminal-illness-benefit' | 'sum-assured' | 'account-value'
type MaturityMarker = 'maturity-benefit' | 'maturity-value' | 'policy-maturity'

interface EvidenceCandidate {
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
  candidates?: EvidenceCandidate[]
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
  evidenceArtifactPath: string
}

interface EvidenceManifest {
  generatedAt: string
  totalEvidenceArtifacts: number
  entries: EvidenceManifestEntry[]
}

interface FactEvidenceRef {
  chunkId: string
  pageStart: number
  pageEnd: number
  excerpt: string
}

interface BooleanFact {
  status: FactStatus
  value: boolean | null
  evidence: FactEvidenceRef | null
}

interface EnumFact<T extends string> {
  status: FactStatus
  value: T | null
  evidence: FactEvidenceRef | null
}

interface MultiValueFact<T extends string> {
  status: FactStatus
  values: T[]
  evidence: FactEvidenceRef[]
}

interface NormalizedFactPacket {
  premiumMode: EnumFact<PremiumMode>
  hasPremiumHoliday: BooleanFact
  hasEarlyExitCharge: BooleanFact
  hasPartialWithdrawal: BooleanFact
  hasMaturityBenefit: BooleanFact
  bonusTypes: MultiValueFact<BonusType>
  chargeTypes: MultiValueFact<ChargeType>
  withdrawalMarkers: MultiValueFact<WithdrawalMarker>
  deathBenefitMarkers: MultiValueFact<DeathBenefitMarker>
  maturityMarkers: MultiValueFact<MaturityMarker>
}

interface FactsArtifact {
  sourceFileName: string
  sourceChecksum: string
  generatedAt: string
  documentType: CorpusDocumentType
  insurer: string
  productName: string
  evidenceArtifactPath: string
  linkedDocuments: EvidenceArtifact['linkedDocuments']
  facts: NormalizedFactPacket
  summary: {
    normalizedFactCount: number
    missingFactCount: number
    manualReviewRecommended: boolean
    notes: string[]
  }
}

interface FactsManifestEntry {
  sourceFileName: string
  sourceChecksum: string
  insurer: string
  productName: string
  documentType: CorpusDocumentType
  normalizedFactCount: number
  manualReviewRecommended: boolean
  factsArtifactPath: string
}

interface FactsManifest {
  generatedAt: string
  totalFactsArtifacts: number
  entries: FactsManifestEntry[]
}

const evidenceCandidateSchema = z.object({
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
    bestCandidate: evidenceCandidateSchema.nullable(),
    candidates: z.array(evidenceCandidateSchema).optional(),
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

const evidenceManifestSchema = z.object({
  generatedAt: z.string().min(1),
  totalEvidenceArtifacts: z.number().int().min(0),
  entries: z.array(z.object({
    sourceFileName: z.string().min(1),
    sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
    insurer: z.string().min(1),
    productName: z.string().min(1),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    evidenceArtifactPath: z.string().min(1),
  })),
})

const factsArtifactSchema = z.object({
  sourceFileName: z.string().min(1),
  sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
})

const BONUS_PATTERNS: Array<{ value: BonusType, pattern: RegExp }> = [
  { value: 'loyalty-bonus', pattern: /\bloyalty bonus\b/i },
  { value: 'welcome-bonus', pattern: /\bwelcome bonus\b/i },
  { value: 'start-up-bonus', pattern: /\bstart-?up bonus\b/i },
  { value: 'special-bonus', pattern: /\bspecial bonus\b/i },
  { value: 'premium-bonus', pattern: /\bpremium bonus\b/i },
  { value: 'bonus', pattern: /\bbonus\b/i },
]

const CHARGE_PATTERNS: Array<{ value: ChargeType, pattern: RegExp }> = [
  { value: 'premium-charge', pattern: /\bpremium charge\b/i },
  { value: 'policy-charge', pattern: /\bpolicy charge\b/i },
  { value: 'management-fee', pattern: /\bmanagement fee\b/i },
  { value: 'insurance-charge', pattern: /\binsurance charge\b/i },
  { value: 'administration-charge', pattern: /\badministration charge\b|\badmin charge\b/i },
  { value: 'surrender-charge', pattern: /\bsurrender charge\b/i },
  { value: 'early-exit-charge', pattern: /\bearly exit charge\b|\bearly encashment charge\b|\beec\b/i },
]

const WITHDRAWAL_PATTERNS: Array<{ value: WithdrawalMarker, pattern: RegExp }> = [
  { value: 'partial-withdrawal', pattern: /\bpartial withdrawal\b/i },
  { value: 'partial-surrender', pattern: /\bpartial surrender\b/i },
  { value: 'full-surrender', pattern: /\bfull surrender\b/i },
  { value: 'surrender-value', pattern: /\bsurrender value\b/i },
]

const DEATH_PATTERNS: Array<{ value: DeathBenefitMarker, pattern: RegExp }> = [
  { value: 'death-benefit', pattern: /\bdeath benefit\b/i },
  { value: 'terminal-illness-benefit', pattern: /\bterminal illness benefit\b|\bterminal illness\b/i },
  { value: 'sum-assured', pattern: /\bsum assured\b/i },
  { value: 'account-value', pattern: /\baccount value\b/i },
]

const MATURITY_PATTERNS: Array<{ value: MaturityMarker, pattern: RegExp }> = [
  { value: 'maturity-benefit', pattern: /\bmaturity benefit\b/i },
  { value: 'maturity-value', pattern: /\bmaturity value\b/i },
  { value: 'policy-maturity', pattern: /\bpolicy maturity\b|\bmaturity date\b/i },
]

function classifyDocumentType(fileName: string): CorpusDocumentType {
  if (isSummaryFile(fileName)) return 'summary'
  if (isBrochureFile(fileName)) return 'brochure'
  return 'unclassified'
}

function factsPathForFileName(fileName: string): string {
  return path.join(FACTS_DIR, `${slugify(fileName.replace(/\.pdf$/i, ''))}.json`)
}

function evidenceRelativePath(fileName: string): string {
  return path.posix.join('..', 'evidence', `${slugify(fileName.replace(/\.pdf$/i, ''))}.json`)
}

function toEvidenceRef(candidate: EvidenceCandidate | null): FactEvidenceRef | null {
  if (!candidate) return null
  return {
    chunkId: candidate.chunkId,
    pageStart: candidate.pageStart,
    pageEnd: candidate.pageEnd,
    excerpt: candidate.excerpt,
  }
}

function extractListValues<T extends string>(
  packet: EvidenceFieldPacket,
  patterns: Array<{ value: T, pattern: RegExp }>,
): MultiValueFact<T> {
  const candidates = packet.candidates ?? (packet.bestCandidate ? [packet.bestCandidate] : [])
  const values = new Set<T>()
  const evidence: FactEvidenceRef[] = []

  for (const candidate of candidates) {
    const haystack = `${candidate.heading ?? ''}\n${candidate.excerpt}\n${candidate.sourceRefs.map((ref) => ref.excerpt).join('\n')}`
    const matchedValues = patterns
      .filter(({ pattern }) => pattern.test(haystack))
      .map(({ value }) => value)

    if (matchedValues.length === 0) continue

    for (const value of matchedValues) {
      values.add(value)
    }

    evidence.push({
      chunkId: candidate.chunkId,
      pageStart: candidate.pageStart,
      pageEnd: candidate.pageEnd,
      excerpt: candidate.excerpt,
    })
  }

  return {
    status: values.size > 0 ? 'normalized' : 'not-detected',
    values: [...values],
    evidence,
  }
}

function normalizePremiumMode(packet: EvidenceFieldPacket): EnumFact<PremiumMode> {
  const candidate = packet.bestCandidate
  if (!candidate) {
    return {
      status: 'not-detected',
      value: null,
      evidence: null,
    }
  }

  const haystack = `${candidate.heading ?? ''}\n${candidate.excerpt}\n${candidate.sourceRefs.map((ref) => ref.excerpt).join('\n')}`
  const hasRegular = /\bregular premium\b/i.test(haystack)
  const hasSingle = /\bsingle premium\b/i.test(haystack)

  let value: PremiumMode = 'unclear'
  if (hasRegular && hasSingle) {
    value = 'mixed'
  } else if (hasRegular) {
    value = 'regular-premium'
  } else if (hasSingle) {
    value = 'single-premium'
  }

  return {
    status: value === 'unclear' ? 'not-detected' : 'normalized',
    value: value === 'unclear' ? null : value,
    evidence: value === 'unclear' ? null : toEvidenceRef(candidate),
  }
}

function normalizeBoolean(packet: EvidenceFieldPacket): BooleanFact {
  return {
    status: packet.bestCandidate ? 'normalized' : 'not-detected',
    value: packet.bestCandidate ? true : null,
    evidence: toEvidenceRef(packet.bestCandidate),
  }
}

function buildFacts(evidence: EvidenceArtifact): NormalizedFactPacket {
  return {
    premiumMode: normalizePremiumMode(evidence.fieldPackets['premium-payment']),
    hasPremiumHoliday: normalizeBoolean(evidence.fieldPackets['premium-holiday']),
    hasEarlyExitCharge: normalizeBoolean(evidence.fieldPackets['early-exit-charge']),
    hasPartialWithdrawal: normalizeBoolean(evidence.fieldPackets['partial-withdrawal']),
    hasMaturityBenefit: normalizeBoolean(evidence.fieldPackets['maturity-benefit']),
    bonusTypes: extractListValues(evidence.fieldPackets.bonus, BONUS_PATTERNS),
    chargeTypes: extractListValues(
      {
        ...evidence.fieldPackets['fees-and-charges'],
        candidates: [
          ...(evidence.fieldPackets['fees-and-charges'].candidates ?? []),
          ...(evidence.fieldPackets['early-exit-charge'].candidates ?? []),
        ],
      },
      CHARGE_PATTERNS,
    ),
    withdrawalMarkers: extractListValues(evidence.fieldPackets['partial-withdrawal'], WITHDRAWAL_PATTERNS),
    deathBenefitMarkers: extractListValues(evidence.fieldPackets['death-benefit'], DEATH_PATTERNS),
    maturityMarkers: extractListValues(evidence.fieldPackets['maturity-benefit'], MATURITY_PATTERNS),
  }
}

function summarizeFacts(facts: NormalizedFactPacket, evidence: EvidenceArtifact): FactsArtifact['summary'] {
  const allFacts = [
    facts.premiumMode.status,
    facts.hasPremiumHoliday.status,
    facts.hasEarlyExitCharge.status,
    facts.hasPartialWithdrawal.status,
    facts.hasMaturityBenefit.status,
    facts.bonusTypes.status,
    facts.chargeTypes.status,
    facts.withdrawalMarkers.status,
    facts.deathBenefitMarkers.status,
    facts.maturityMarkers.status,
  ]
  const normalizedFactCount = allFacts.filter((status) => status === 'normalized').length
  const missingFactCount = allFacts.length - normalizedFactCount
  const notes = [...evidence.summary.notes]
  let manualReviewRecommended = evidence.summary.manualReviewRecommended

  if (evidence.documentType === 'summary' && normalizedFactCount < 5) {
    manualReviewRecommended = true
    notes.push('Summary document yielded fewer normalized facts than expected.')
  }

  return {
    normalizedFactCount,
    missingFactCount,
    manualReviewRecommended,
    notes,
  }
}

function buildFactsArtifact(evidence: EvidenceArtifact): FactsArtifact {
  const facts = buildFacts(evidence)

  return {
    sourceFileName: evidence.sourceFileName,
    sourceChecksum: evidence.sourceChecksum,
    generatedAt: new Date().toISOString(),
    documentType: classifyDocumentType(evidence.sourceFileName),
    insurer: inferInsurer(evidence.sourceFileName),
    productName: inferProductName(evidence.sourceFileName),
    evidenceArtifactPath: evidenceRelativePath(evidence.sourceFileName),
    linkedDocuments: evidence.linkedDocuments,
    facts,
    summary: summarizeFacts(facts, evidence),
  }
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

async function readEvidenceArtifact(evidencePath: string): Promise<EvidenceArtifact> {
  const raw = await readFile(evidencePath, 'utf8')
  return evidenceArtifactSchema.parse(JSON.parse(raw)) as EvidenceArtifact
}

async function readCachedFactsChecksum(factsPath: string): Promise<string | null> {
  try {
    const raw = await readFile(factsPath, 'utf8')
    const parsed = factsArtifactSchema.parse(JSON.parse(raw)) as Pick<FactsArtifact, 'sourceChecksum'>
    return parsed.sourceChecksum
  } catch {
    return null
  }
}

async function buildFactsManifest(entries: EvidenceManifestEntry[]): Promise<FactsManifest> {
  const manifestEntries: FactsManifestEntry[] = []

  for (const entry of entries) {
    const factsPath = factsPathForFileName(entry.sourceFileName)
    const raw = await readFile(factsPath, 'utf8')
    const facts = JSON.parse(raw) as FactsArtifact
    if (facts.sourceChecksum !== entry.sourceChecksum) {
      continue
    }

    manifestEntries.push({
      sourceFileName: facts.sourceFileName,
      sourceChecksum: facts.sourceChecksum,
      insurer: facts.insurer,
      productName: facts.productName,
      documentType: facts.documentType,
      normalizedFactCount: facts.summary.normalizedFactCount,
      manualReviewRecommended: facts.summary.manualReviewRecommended,
      factsArtifactPath: path.relative(FIXTURES_DIR, factsPath).replaceAll(path.sep, '/'),
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    totalFactsArtifacts: manifestEntries.length,
    entries: manifestEntries,
  }
}

async function main() {
  await mkdir(FACTS_DIR, { recursive: true })
  const evidenceManifest = await readEvidenceManifest()
  let writtenCount = 0

  for (const [index, entry] of evidenceManifest.entries.entries()) {
    const progressPrefix = `[${index + 1}/${evidenceManifest.entries.length}]`
    const factsPath = factsPathForFileName(entry.sourceFileName)
    const cachedChecksum = await readCachedFactsChecksum(factsPath)

    if (cachedChecksum === entry.sourceChecksum) {
      console.log(`${progressPrefix} Skipping (cached): ${path.basename(factsPath)}`)
      continue
    }

    console.log(`${progressPrefix} Normalizing facts: ${path.basename(factsPath)}`)
    const evidence = await readEvidenceArtifact(path.join(FIXTURES_DIR, entry.evidenceArtifactPath))
    const factsArtifact = buildFactsArtifact(evidence)
    await writeJson(factsPath, factsArtifact)
    writtenCount += 1
  }

  const factsManifest = await buildFactsManifest(evidenceManifest.entries)
  await writeJson(FACTS_MANIFEST_PATH, factsManifest)

  console.log(`Built ${factsManifest.totalFactsArtifacts} facts artifacts in ${FACTS_DIR}`)
  console.log(`Wrote ${writtenCount} facts artifacts in this run`)
  console.log(`Wrote facts manifest to ${FACTS_MANIFEST_PATH}`)
}

await main()
