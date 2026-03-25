import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures')
const FACTS_MANIFEST_PATH = path.join(FIXTURES_DIR, 'facts-manifest.json')
const FACTS_REVIEW_QUEUE_PATH = path.join(FIXTURES_DIR, 'facts-review-queue.json')
const SHA256_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/

type CorpusDocumentType = 'summary' | 'brochure' | 'unclassified'

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

interface LinkedDocument {
  sourceFileName: string
  documentType: CorpusDocumentType
  relationship: 'same-product'
}

interface FactsArtifact {
  sourceFileName: string
  sourceChecksum: string
  generatedAt: string
  documentType: CorpusDocumentType
  insurer: string
  productName: string
  evidenceArtifactPath: string
  linkedDocuments: LinkedDocument[]
  facts: {
    premiumMode: {
      status: 'normalized' | 'not-detected'
      value: 'regular-premium' | 'single-premium' | 'mixed' | 'unclear' | null
    }
    hasPremiumHoliday: {
      status: 'normalized' | 'not-detected'
      value: boolean | null
    }
    hasEarlyExitCharge: {
      status: 'normalized' | 'not-detected'
      value: boolean | null
    }
    hasPartialWithdrawal: {
      status: 'normalized' | 'not-detected'
      value: boolean | null
    }
    hasMaturityBenefit: {
      status: 'normalized' | 'not-detected'
      value: boolean | null
    }
    bonusTypes: {
      status: 'normalized' | 'not-detected'
      values: string[]
    }
    chargeTypes: {
      status: 'normalized' | 'not-detected'
      values: string[]
    }
    withdrawalMarkers: {
      status: 'normalized' | 'not-detected'
      values: string[]
    }
    deathBenefitMarkers: {
      status: 'normalized' | 'not-detected'
      values: string[]
    }
    maturityMarkers: {
      status: 'normalized' | 'not-detected'
      values: string[]
    }
  }
  summary: {
    normalizedFactCount: number
    missingFactCount: number
    manualReviewRecommended: boolean
    notes: string[]
  }
}

interface ReviewQueueItem {
  priority: 'high' | 'medium'
  sourceFileName: string
  insurer: string
  productName: string
  documentType: CorpusDocumentType
  factsArtifactPath: string
  normalizedFactCount: number
  reasons: string[]
  recommendedChecks: string[]
  linkedDocuments: LinkedDocument[]
}

interface FactsReviewQueue {
  generatedAt: string
  totalItems: number
  highPriority: number
  mediumPriority: number
  items: ReviewQueueItem[]
}

const factsManifestSchema = z.object({
  generatedAt: z.string().min(1),
  totalFactsArtifacts: z.number().int().min(0),
  entries: z.array(z.object({
    sourceFileName: z.string().min(1),
    sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
    insurer: z.string().min(1),
    productName: z.string().min(1),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    normalizedFactCount: z.number().int().min(0),
    manualReviewRecommended: z.boolean(),
    factsArtifactPath: z.string().min(1),
  })),
})

const factsArtifactSchema = z.object({
  sourceFileName: z.string().min(1),
  sourceChecksum: z.string().regex(SHA256_CHECKSUM_PATTERN),
  generatedAt: z.string().min(1),
  documentType: z.enum(['summary', 'brochure', 'unclassified']),
  insurer: z.string().min(1),
  productName: z.string().min(1),
  evidenceArtifactPath: z.string().min(1),
  linkedDocuments: z.array(z.object({
    sourceFileName: z.string().min(1),
    documentType: z.enum(['summary', 'brochure', 'unclassified']),
    relationship: z.literal('same-product'),
  })),
  facts: z.object({
    premiumMode: z.object({
      status: z.enum(['normalized', 'not-detected']),
      value: z.enum(['regular-premium', 'single-premium', 'mixed', 'unclear']).nullable(),
    }),
    hasPremiumHoliday: z.object({
      status: z.enum(['normalized', 'not-detected']),
      value: z.boolean().nullable(),
    }),
    hasEarlyExitCharge: z.object({
      status: z.enum(['normalized', 'not-detected']),
      value: z.boolean().nullable(),
    }),
    hasPartialWithdrawal: z.object({
      status: z.enum(['normalized', 'not-detected']),
      value: z.boolean().nullable(),
    }),
    hasMaturityBenefit: z.object({
      status: z.enum(['normalized', 'not-detected']),
      value: z.boolean().nullable(),
    }),
    bonusTypes: z.object({
      status: z.enum(['normalized', 'not-detected']),
      values: z.array(z.string()),
    }),
    chargeTypes: z.object({
      status: z.enum(['normalized', 'not-detected']),
      values: z.array(z.string()),
    }),
    withdrawalMarkers: z.object({
      status: z.enum(['normalized', 'not-detected']),
      values: z.array(z.string()),
    }),
    deathBenefitMarkers: z.object({
      status: z.enum(['normalized', 'not-detected']),
      values: z.array(z.string()),
    }),
    maturityMarkers: z.object({
      status: z.enum(['normalized', 'not-detected']),
      values: z.array(z.string()),
    }),
  }),
  summary: z.object({
    normalizedFactCount: z.number().int().min(0),
    missingFactCount: z.number().int().min(0),
    manualReviewRecommended: z.boolean(),
    notes: z.array(z.string()),
  }),
})

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  const temporaryPath = `${targetPath}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, targetPath)
}

async function readFactsManifest(): Promise<FactsManifest> {
  const raw = await readFile(FACTS_MANIFEST_PATH, 'utf8')
  return factsManifestSchema.parse(JSON.parse(raw)) as FactsManifest
}

async function readFactsArtifact(factsPath: string): Promise<FactsArtifact> {
  const raw = await readFile(factsPath, 'utf8')
  return factsArtifactSchema.parse(JSON.parse(raw)) as FactsArtifact
}

function factsArtifactPathRelative(filePath: string): string {
  return path.relative(FIXTURES_DIR, filePath).replaceAll(path.sep, '/')
}

function compareQueueItems(left: ReviewQueueItem, right: ReviewQueueItem): number {
  const priorityScore = { high: 0, medium: 1 }
  return (
    priorityScore[left.priority] - priorityScore[right.priority]
    || left.normalizedFactCount - right.normalizedFactCount
    || left.sourceFileName.localeCompare(right.sourceFileName)
  )
}

async function main() {
  const manifest = await readFactsManifest()
  const bySource = new Map<string, { entry: FactsManifestEntry, doc: FactsArtifact, path: string }>()

  for (const entry of manifest.entries) {
    const filePath = path.join(FIXTURES_DIR, entry.factsArtifactPath)
    const doc = await readFactsArtifact(filePath)
    bySource.set(entry.sourceFileName, { entry, doc, path: filePath })
  }

  const items = new Map<string, ReviewQueueItem>()

  const upsert = (
    sourceFileName: string,
    priority: 'high' | 'medium',
    reason: string,
    recommendedCheck: string,
  ) => {
    const candidate = bySource.get(sourceFileName)
    if (!candidate) return

    const existing = items.get(sourceFileName)
    if (!existing) {
      items.set(sourceFileName, {
        priority,
        sourceFileName,
        insurer: candidate.doc.insurer,
        productName: candidate.doc.productName,
        documentType: candidate.doc.documentType,
        factsArtifactPath: factsArtifactPathRelative(candidate.path),
        normalizedFactCount: candidate.doc.summary.normalizedFactCount,
        reasons: [reason],
        recommendedChecks: [recommendedCheck],
        linkedDocuments: candidate.doc.linkedDocuments,
      })
      return
    }

    if (priority === 'high') {
      existing.priority = 'high'
    }
    if (!existing.reasons.includes(reason)) {
      existing.reasons.push(reason)
    }
    if (!existing.recommendedChecks.includes(recommendedCheck)) {
      existing.recommendedChecks.push(recommendedCheck)
    }
  }

  for (const { entry, doc } of bySource.values()) {
    if (doc.summary.manualReviewRecommended) {
      upsert(
        entry.sourceFileName,
        'high',
        'Facts layer already marked this document for manual review.',
        'Verify whether the weak or missing normalized facts are caused by corpus gaps or extraction rules.',
      )
    }

    if (doc.documentType === 'summary' && doc.summary.normalizedFactCount <= 5) {
      upsert(
        entry.sourceFileName,
        'high',
        `Summary normalized only ${doc.summary.normalizedFactCount} facts.`,
        'Inspect premium mode, charge types, and death/maturity markers against the evidence packet.',
      )
    }

    if (doc.documentType === 'brochure' && doc.summary.normalizedFactCount <= 3) {
      upsert(
        entry.sourceFileName,
        'medium',
        `Brochure normalized only ${doc.summary.normalizedFactCount} facts.`,
        'Check whether brochure language should remain sparse or whether evidence matching is missing obvious fields.',
      )
    }

    if (doc.facts.premiumMode.status === 'not-detected' && doc.documentType !== 'brochure') {
      upsert(
        entry.sourceFileName,
        'medium',
        'Premium mode could not be normalized.',
        'Review premium-payment evidence and confirm whether the document is single, regular, or mixed premium.',
      )
    }

    if (doc.facts.chargeTypes.values.length === 0 && doc.facts.hasEarlyExitCharge.value === true) {
      upsert(
        entry.sourceFileName,
        'medium',
        'Early-exit charge detected but no charge types were normalized.',
        'Check whether surrender or early-exit wording should map into chargeTypes.',
      )
    }

    if (doc.linkedDocuments.length === 0 && doc.summary.normalizedFactCount <= 4) {
      upsert(
        entry.sourceFileName,
        'medium',
        'Low-coverage document has no linked sibling for corroboration.',
        'Decide whether the filename-linking heuristic should be widened for this product family.',
      )
    }
  }

  const comparedPairs = new Set<string>()
  for (const { doc } of bySource.values()) {
    for (const linked of doc.linkedDocuments) {
      const other = bySource.get(linked.sourceFileName)
      if (!other) continue

      const pairKey = [doc.sourceFileName, linked.sourceFileName].sort().join('::')
      if (comparedPairs.has(pairKey)) continue
      comparedPairs.add(pairKey)

      const mismatches: string[] = []

      if (
        doc.facts.premiumMode.value
        && other.doc.facts.premiumMode.value
        && doc.facts.premiumMode.value !== other.doc.facts.premiumMode.value
      ) {
        mismatches.push(`premiumMode (${doc.facts.premiumMode.value} vs ${other.doc.facts.premiumMode.value})`)
      }

      if (
        doc.facts.hasPremiumHoliday.value !== null
        && other.doc.facts.hasPremiumHoliday.value !== null
        && doc.facts.hasPremiumHoliday.value !== other.doc.facts.hasPremiumHoliday.value
      ) {
        mismatches.push('hasPremiumHoliday')
      }

      if (
        doc.facts.hasEarlyExitCharge.value !== null
        && other.doc.facts.hasEarlyExitCharge.value !== null
        && doc.facts.hasEarlyExitCharge.value !== other.doc.facts.hasEarlyExitCharge.value
      ) {
        mismatches.push('hasEarlyExitCharge')
      }

      if (mismatches.length === 0) continue

      for (const sourceFileName of [doc.sourceFileName, other.doc.sourceFileName]) {
        upsert(
          sourceFileName,
          'high',
          `Linked-document mismatch with sibling: ${mismatches.join(', ')}.`,
          'Compare the paired summary/brochure fact packets and decide whether the mismatch is real or caused by weak normalization.',
        )
      }
    }
  }

  const queueItems = [...items.values()].sort(compareQueueItems)
  const queue: FactsReviewQueue = {
    generatedAt: new Date().toISOString(),
    totalItems: queueItems.length,
    highPriority: queueItems.filter((item) => item.priority === 'high').length,
    mediumPriority: queueItems.filter((item) => item.priority === 'medium').length,
    items: queueItems,
  }

  await writeJson(FACTS_REVIEW_QUEUE_PATH, queue)
  console.log(`Wrote ${queue.totalItems} review-queue items to ${FACTS_REVIEW_QUEUE_PATH}`)
}

await main()
