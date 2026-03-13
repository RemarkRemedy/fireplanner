import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { discoverManualCatalogSources } from './discovery.js'
import { extractPdfText } from './pdf/extractPdfText.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const CLASSIFICATION_PATH = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit/family-classification.json')
const OUTPUT_JSON_PATH = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit/low-confidence-standard-qa.json')
const OUTPUT_MD_PATH = path.join(ROOT_DIR, 'docs/ilp-low-confidence-standard-qa.md')

type QaDecision =
  | 'confirmed-standard'
  | 'needs-manual-review'
  | 'reclassify-multi-account'
  | 'reclassify-protection-heavy'

interface ClassificationRow {
  productKey: string
  sourceFileName: string
  insurer: string
  productName: string
  primaryFamily: string
  v1SupportBoundary: string
  confidence: number
  overlayTags: string[]
  gapTags: string[]
}

interface QaRow {
  productKey: string
  sourceFileName: string
  insurer: string
  productName: string
  currentPrimaryFamily: string
  currentV1SupportBoundary: string
  decision: QaDecision
  summary: string
  accountEvidence: string[]
  protectionEvidence: string[]
  routingEvidence: string[]
}

interface QaOutput {
  scope: string
  reviewedProducts: number
  decisionCounts: Record<QaDecision, number>
  rows: QaRow[]
}

const MULTI_ACCOUNT_PATTERNS = [
  /additional investment account/i,
  /growth account/i,
  /flex account/i,
  /regular premium account/i,
  /top[- ]?up account/i,
  /top[- ]?up units account/i,
  /additional account/i,
]

const PROTECTION_PATTERNS = [
  /capital guarantee/i,
  /death benefit option/i,
  /multiple life/i,
  /multi[- ]life/i,
  /change of life assured/i,
]

const ROUTING_PATTERNS = [
  /regular premium/i,
  /single premium/i,
  /top[- ]?up premium/i,
  /premium holiday/i,
  /partial withdrawal/i,
  /withdrawal charge/i,
  /bonus recovery/i,
]

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function extractEvidence(lines: string[], patterns: RegExp[], limit = 4): string[] {
  return unique(
    lines
      .filter((line) => patterns.some((pattern) => pattern.test(line)))
      .map((line) => line.trim())
      .filter(Boolean),
  ).slice(0, limit)
}

function decideQaOutcome(accountEvidence: string[], protectionEvidence: string[]): QaDecision {
  if (protectionEvidence.length > 0) {
    return 'reclassify-protection-heavy'
  }

  const strongMultiAccountEvidence = accountEvidence.some((line) =>
    /additional investment account|growth account|flex account|regular premium account/i.test(line),
  )
  if (strongMultiAccountEvidence) {
    return 'reclassify-multi-account'
  }

  const weakMultiAccountEvidence = accountEvidence.some((line) =>
    /top[- ]?up account|top[- ]?up units account/i.test(line),
  )
  if (weakMultiAccountEvidence) {
    return 'needs-manual-review'
  }

  return 'confirmed-standard'
}

function summarizeDecision(decision: QaDecision, accountEvidence: string[], protectionEvidence: string[]): string {
  switch (decision) {
    case 'reclassify-protection-heavy':
      return `Protection-structure terms appear in the source text (${protectionEvidence[0]}), so the standard-family default should not be accepted without reclassification.`
    case 'reclassify-multi-account':
      return `Special-account structure appears in the source text (${accountEvidence[0]}), so the product should be reviewed as a multi-account candidate.`
    case 'needs-manual-review':
      return `The PDF references top-up account structure (${accountEvidence[0]}), but the source does not yet show enough evidence in this pass to promote it beyond a manual review case.`
    case 'confirmed-standard':
      return 'No hard protection or special-account structure markers were found in the extracted source evidence; the standard-family default remains defensible.'
  }
}

function summarizeCounts(rows: QaRow[]): Record<QaDecision, number> {
  const counts: Record<QaDecision, number> = {
    'confirmed-standard': 0,
    'needs-manual-review': 0,
    'reclassify-multi-account': 0,
    'reclassify-protection-heavy': 0,
  }

  for (const row of rows) {
    counts[row.decision] += 1
  }

  return counts
}

function buildMarkdown(output: QaOutput): string {
  const lines = [
    '# ILP Low-Confidence Standard QA',
    '',
    output.scope,
    '',
    `Reviewed products: ${output.reviewedProducts}`,
    '',
    '## Decision Counts',
    '',
    '| Decision | Count |',
    '| --- | ---: |',
    ...Object.entries(output.decisionCounts).map(([decision, count]) => `| \`${decision}\` | ${count} |`),
    '',
    '## Reviewed Products',
    '',
    '| File | Decision | Account evidence | Protection evidence |',
    '| --- | --- | --- | --- |',
    ...output.rows.map((row) => {
      const account = row.accountEvidence[0] ?? '—'
      const protection = row.protectionEvidence[0] ?? '—'
      return `| ${row.sourceFileName.replace(/\|/g, '\\|')} | \`${row.decision}\` | ${account.replace(/\|/g, '\\|')} | ${protection.replace(/\|/g, '\\|')} |`
    }),
    '',
  ]

  return `${lines.join('\n')}\n`
}

async function main() {
  const [classification, discovery] = await Promise.all([
    readFile(CLASSIFICATION_PATH, 'utf8').then((value) => JSON.parse(value) as { rows: ClassificationRow[] }),
    discoverManualCatalogSources(),
  ])

  const lowConfidenceRows = classification.rows.filter((row) =>
    row.primaryFamily === 'standard-2-account-core-cashflow' && row.confidence === 0.72,
  )

  const sourceByFileName = new Map(discovery.summarySources.map((source) => [source.fileName, source]))
  const rows: QaRow[] = []

  for (const classificationRow of lowConfidenceRows) {
    const source = sourceByFileName.get(classificationRow.sourceFileName)
    if (!source) {
      throw new Error(`Missing source file for ${classificationRow.sourceFileName}`)
    }

    const document = await extractPdfText(source.filePath)
    const lines = document.pages.flatMap((page) => page.lines.map((line) => line.text))
    const accountEvidence = extractEvidence(lines, MULTI_ACCOUNT_PATTERNS)
    const protectionEvidence = extractEvidence(lines, PROTECTION_PATTERNS)
    const routingEvidence = extractEvidence(lines, ROUTING_PATTERNS)
    const decision = decideQaOutcome(accountEvidence, protectionEvidence)

    rows.push({
      productKey: classificationRow.productKey,
      sourceFileName: classificationRow.sourceFileName,
      insurer: classificationRow.insurer,
      productName: classificationRow.productName,
      currentPrimaryFamily: classificationRow.primaryFamily,
      currentV1SupportBoundary: classificationRow.v1SupportBoundary,
      decision,
      summary: summarizeDecision(decision, accountEvidence, protectionEvidence),
      accountEvidence,
      protectionEvidence,
      routingEvidence,
    })
  }

  rows.sort((left, right) => left.sourceFileName.localeCompare(right.sourceFileName))

  const output: QaOutput = {
    scope: 'QA pass over the 45 low-confidence products currently classified as `standard-2-account-core-cashflow` with `confidence = 0.72`.',
    reviewedProducts: rows.length,
    decisionCounts: summarizeCounts(rows),
    rows,
  }

  await mkdir(path.dirname(OUTPUT_JSON_PATH), { recursive: true })
  await mkdir(path.dirname(OUTPUT_MD_PATH), { recursive: true })
  await writeFile(OUTPUT_JSON_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(OUTPUT_MD_PATH, buildMarkdown(output), 'utf8')

  console.log(`Wrote low-confidence QA JSON to ${OUTPUT_JSON_PATH}`)
  console.log(`Wrote low-confidence QA markdown to ${OUTPUT_MD_PATH}`)
}

await main()
