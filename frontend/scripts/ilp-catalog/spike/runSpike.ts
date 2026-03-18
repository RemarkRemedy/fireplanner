import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { extractPdfText } from '../pdf/extractPdfText.js'
import { renderExtractedText, renderSpikeReport, summarizeExtraction } from './analysis.js'
import { SPIKE_TARGETS } from './targets.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../../..')
const EXTRACTED_TEXT_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/extracted-text')
const REPORT_PATH = path.join(ROOT_DIR, 'docs/ilp-catalog-spike.md')
const SUMMARY_JSON_PATH = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/extracted-text/spike-summary.json')

interface SpikeArtifactSummary {
  id: string
  insurer: string
  productName: string
  sourceFile: string
  sourcePath: string
  sourceChecksumSha256: string
  sourceFileSizeBytes: number
  outputPath: string
}

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

async function main() {
  await mkdir(EXTRACTED_TEXT_DIR, { recursive: true })

  const summaries = []
  const artifacts: SpikeArtifactSummary[] = []

  for (const target of SPIKE_TARGETS) {
    const extracted = await extractPdfText(target.sourcePath)
    const renderedText = renderExtractedText(extracted)
    const outputPath = path.join(EXTRACTED_TEXT_DIR, `${target.id}.txt`)
    const sourceStats = await stat(target.sourcePath)
    const sourceChecksumSha256 = await sha256(target.sourcePath)

    await writeFile(outputPath, renderedText, 'utf8')

    summaries.push(summarizeExtraction(target, extracted))
    artifacts.push({
      id: target.id,
      insurer: target.insurer,
      productName: target.productName,
      sourceFile: path.basename(target.sourcePath),
      sourcePath: target.sourcePath,
      sourceChecksumSha256,
      sourceFileSizeBytes: sourceStats.size,
      outputPath,
    })
  }

  await writeFile(REPORT_PATH, renderSpikeReport(summaries), 'utf8')
  await writeFile(SUMMARY_JSON_PATH, JSON.stringify({ summaries, artifacts }, null, 2), 'utf8')

  console.log(`Wrote ${summaries.length} extracted text artifacts to ${EXTRACTED_TEXT_DIR}`)
  console.log(`Wrote spike report to ${REPORT_PATH}`)
}

await main()
