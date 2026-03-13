import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { discoverManualCatalogSources } from './discovery.js'
import { extractPdfText } from './pdf/extractPdfText.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const CLASSIFICATION_PATH = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit/family-classification.json')
const OUTPUT_JSON_PATH = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit/non-standard-family-qa-packet.json')
const OUTPUT_MD_PATH = path.join(ROOT_DIR, 'docs/ilp-non-standard-family-qa-packet.md')

interface ClassificationRow {
  productKey: string
  sourceFileName: string
  insurer: string
  productName: string
  primaryFamily: string
  v1SupportBoundary: string
  overlayTags: string[]
  gapTags: string[]
}

interface QaPacketRow {
  productKey: string
  sourceFileName: string
  insurer: string
  productName: string
  primaryFamily: string
  v1SupportBoundary: string
  overlayTags: string[]
  gapTags: string[]
  accountEvidence: string[]
  protectionEvidence: string[]
  clampCandidateEvidence: string[]
  reviewQuestion: string
}

interface QaPacketOutput {
  reviewedProducts: number
  rows: QaPacketRow[]
}

const ACCOUNT_PATTERNS = [
  /initial units account/i,
  /accumulation units account/i,
  /top[- ]?up account/i,
  /top[- ]?up units account/i,
  /growth account/i,
  /flex account/i,
  /additional investment account/i,
  /regular premium account/i,
]

const PROTECTION_PATTERNS = [
  /death benefit/i,
  /life assured/i,
  /multi[- ]life/i,
  /multiple life/i,
  /capital guarantee/i,
  /change of life assured/i,
]

const CLAMP_PATTERNS = [
  /higher of/i,
  /greater of/i,
  /total premiums paid/i,
  /account value/i,
  /cash value/i,
  /surrender value/i,
]

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function extractEvidence(lines: string[], patterns: RegExp[], limit = 5): string[] {
  return unique(
    lines
      .filter((line) => patterns.some((pattern) => pattern.test(line)))
      .map((line) => line.trim())
      .filter(Boolean),
  ).slice(0, limit)
}

function buildReviewQuestion(row: ClassificationRow): string {
  if (row.primaryFamily === 'multi-account-special-account') {
    return 'Is the dominant blocker truly multi-account routing/deduction structure, or should this remain standard-family plus overlays?'
  }

  return 'Is this genuinely protection-primary, or is the protection behavior narrow enough to be modeled later as a simple death-benefit clamp on top of the cashflow kernel?'
}

function buildMarkdown(output: QaPacketOutput): string {
  const lines = [
    '# ILP Non-Standard Family QA Packet',
    '',
    'This packet covers the 5 multi-account / special-account products and the 27 protection-heavy / death-benefit products from the current classifier.',
    '',
    `Reviewed products: ${output.reviewedProducts}`,
    '',
    '| File | Primary family | Account evidence | Protection evidence | Clamp candidate evidence |',
    '| --- | --- | --- | --- | --- |',
    ...output.rows.map((row) => `| ${row.sourceFileName.replace(/\|/g, '\\|')} | \`${row.primaryFamily}\` | ${(row.accountEvidence[0] ?? '—').replace(/\|/g, '\\|')} | ${(row.protectionEvidence[0] ?? '—').replace(/\|/g, '\\|')} | ${(row.clampCandidateEvidence[0] ?? '—').replace(/\|/g, '\\|')} |`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

async function main() {
  const [classification, discovery] = await Promise.all([
    readFile(CLASSIFICATION_PATH, 'utf8').then((value) => JSON.parse(value) as { rows: ClassificationRow[] }),
    discoverManualCatalogSources(),
  ])

  const targetRows = classification.rows.filter((row) =>
    row.primaryFamily === 'multi-account-special-account' || row.primaryFamily === 'protection-heavy-death-benefit',
  )

  const sourceByFileName = new Map(discovery.summarySources.map((source) => [source.fileName, source]))
  const rows: QaPacketRow[] = []

  for (const classificationRow of targetRows) {
    const source = sourceByFileName.get(classificationRow.sourceFileName)
    if (!source) {
      throw new Error(`Missing source file for ${classificationRow.sourceFileName}`)
    }

    const document = await extractPdfText(source.filePath)
    const lines = document.pages.flatMap((page) => page.lines.map((line) => line.text))

    rows.push({
      productKey: classificationRow.productKey,
      sourceFileName: classificationRow.sourceFileName,
      insurer: classificationRow.insurer,
      productName: classificationRow.productName,
      primaryFamily: classificationRow.primaryFamily,
      v1SupportBoundary: classificationRow.v1SupportBoundary,
      overlayTags: classificationRow.overlayTags,
      gapTags: classificationRow.gapTags,
      accountEvidence: extractEvidence(lines, ACCOUNT_PATTERNS),
      protectionEvidence: extractEvidence(lines, PROTECTION_PATTERNS),
      clampCandidateEvidence: extractEvidence(lines, CLAMP_PATTERNS),
      reviewQuestion: buildReviewQuestion(classificationRow),
    })
  }

  rows.sort((left, right) => left.sourceFileName.localeCompare(right.sourceFileName))

  const output: QaPacketOutput = {
    reviewedProducts: rows.length,
    rows,
  }

  await mkdir(path.dirname(OUTPUT_JSON_PATH), { recursive: true })
  await mkdir(path.dirname(OUTPUT_MD_PATH), { recursive: true })
  await writeFile(OUTPUT_JSON_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(OUTPUT_MD_PATH, buildMarkdown(output), 'utf8')

  console.log(`Wrote non-standard QA packet JSON to ${OUTPUT_JSON_PATH}`)
  console.log(`Wrote non-standard QA packet markdown to ${OUTPUT_MD_PATH}`)
}

await main()
