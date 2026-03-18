import path from 'node:path'
import type { ExtractedPdfDocument, ExtractedPdfPage } from '../pdf/extractPdfText.js'
import type { SpikeTarget } from './targets.js'

const SECTION_PATTERNS: Array<{ label: string, pattern: RegExp }> = [
  { label: 'Policy section', pattern: /\b(the policy|policy details|plan details)\b/i },
  { label: 'Bonus section', pattern: /\b(bonus|bonuses|loyalty bonus|power-up bonus|welcome bonus)\b/i },
  { label: 'Fees section', pattern: /\b(policy fees and charges|fees and charges|management fee|policy charge)\b/i },
  { label: 'Withdrawal section', pattern: /\b(withdrawal|partial withdrawal|surrender)\b/i },
  { label: 'EEC section', pattern: /\b(early exit charge|eec|surrender charge)\b/i },
]

export interface SpikeSummary {
  id: string
  insurer: string
  productName: string
  sourceFile: string
  pageCount: number
  totalCharacters: number
  hasTextLayer: boolean
  detectedSections: string[]
  feeTableLikely: boolean
  eecTableLikely: boolean
  bonusRulesLikely: boolean
  notes: string[]
}

function detectSections(text: string): string[] {
  return SECTION_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label)
}

function pageHasTableSignal(text: string, keywords: string[]): boolean {
  const lines = text.split('\n')
  return lines.some((line) => (
    keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase()))
      && /\d/.test(line)
      && /[%$]/.test(line)
  ))
}

function pageHasRepeatedRowSignal(text: string, keywords: string[]): boolean {
  const lines = text.split('\n')
  const matchedLines = lines.filter((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())))
  return matchedLines.length > 0 || lines.some((line) => /\b\d{1,2}\b/.test(line) && /%/.test(line))
}

export function summarizeExtraction(target: SpikeTarget, extracted: ExtractedPdfDocument): SpikeSummary {
  const combinedText = extracted.pages.map((page: ExtractedPdfPage) => page.text).join('\n')
  const detectedSections = detectSections(combinedText)
  const notes: string[] = []
  const hasTextLayer = extracted.totalCharacters >= 500

  if (!hasTextLayer) {
    notes.push('Text layer is too sparse for deterministic parsing. This PDF is likely image-based or structurally unusable.')
  }

  const feeTableLikely = extracted.pages.some((page: ExtractedPdfPage) => pageHasTableSignal(page.text, [
    'management fee',
    'policy fee',
    'charge',
    'annual management fee',
    'insurance charge',
  ]))

  const eecTableLikely = extracted.pages.some((page: ExtractedPdfPage) => pageHasRepeatedRowSignal(page.text, [
    'early exit charge',
    'eec',
    'policy year',
    'surrender charge',
  ]))

  const bonusRulesLikely = /\bbonus\b/i.test(combinedText)
    && extracted.pages.some((page: ExtractedPdfPage) => pageHasTableSignal(page.text, [
      'bonus',
      'loyalty',
      'power-up',
      'allocation',
    ]))

  if (!feeTableLikely) {
    notes.push('No obvious fee table reconstruction signal found from raw text. This may still be parseable, but the table layout needs manual review.')
  }

  if (!eecTableLikely) {
    notes.push('No obvious EEC row structure found from raw text.')
  }

  if (!bonusRulesLikely) {
    notes.push('Bonus wording is not obviously table-structured from raw text.')
  }

  return {
    id: target.id,
    insurer: target.insurer,
    productName: target.productName,
    sourceFile: path.basename(target.sourcePath),
    pageCount: extracted.pageCount,
    totalCharacters: extracted.totalCharacters,
    hasTextLayer,
    detectedSections,
    feeTableLikely,
    eecTableLikely,
    bonusRulesLikely,
    notes,
  }
}

export function renderExtractedText(extracted: ExtractedPdfDocument): string {
  return extracted.pages.map((page: ExtractedPdfPage) => (
    `# Page ${page.pageNumber}\n\n${page.text || '[No extractable text]'}`
  )).join('\n\n')
}

export function renderSpikeReport(summaries: SpikeSummary[]): string {
  const generatedAt = new Date().toISOString()
  const lines: string[] = [
    '# ILP Catalog Spike Report',
    '',
    `Generated at: ${generatedAt}`,
    '',
    '## Corpus',
    '',
    'This report covers the 5 initial product-summary PDFs selected for the manual-corpus parser spike.',
    '',
    '## Results',
    '',
  ]

  for (const summary of summaries) {
    lines.push(`### ${summary.insurer} — ${summary.productName}`)
    lines.push('')
    lines.push(`- Source file: \`${summary.sourceFile}\``)
    lines.push(`- Pages: ${summary.pageCount}`)
    lines.push(`- Extracted character count: ${summary.totalCharacters}`)
    lines.push(`- Text layer present: ${summary.hasTextLayer ? 'yes' : 'no'}`)
    lines.push(`- Sections detected: ${summary.detectedSections.length > 0 ? summary.detectedSections.join(', ') : 'none'}`)
    lines.push(`- Fee tables look reconstructable: ${summary.feeTableLikely ? 'yes' : 'no'}`)
    lines.push(`- EEC rows look reconstructable: ${summary.eecTableLikely ? 'yes' : 'no'}`)
    lines.push(`- Bonus rules look structured: ${summary.bonusRulesLikely ? 'yes' : 'no'}`)
    if (summary.notes.length > 0) {
      lines.push('- Notes:')
      for (const note of summary.notes) {
        lines.push(`  - ${note}`)
      }
    }
    lines.push('')
  }

  lines.push('## Initial Read')
  lines.push('')
  lines.push('- PDFs with clear text layers should proceed to structured extraction next.')
  lines.push('- PDFs flagged as sparse or image-heavy should be marked unsupported for deterministic parsing in V1 until proven otherwise.')

  return lines.join('\n')
}
