import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { discoverManualCatalogSources, inferProductName } from './discovery.js'
import { extractPdfText, type ExtractedPdfDocument } from './pdf/extractPdfText.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const OUTPUT_PATH = path.join(ROOT_DIR, 'docs/ilp-catalog-file-policy-map.md')

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function significantTokens(value: string): string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !['product', 'summary', 'policy', 'life', 'version'].includes(token))
}

function fallbackPolicyName(fileName: string): string {
  return inferProductName(fileName)
    .replace(/\bProduct Summary\b/gi, '')
    .replace(/\bSummary\b/gi, '')
    .replace(/\bPS\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isUsablePolicyName(value: string): boolean {
  const normalized = normalizeWhitespace(value)
  if (normalized.length < 4 || normalized.length > 100) return false

  const disallowedPhrases = [
    'is for general information only',
    'note:',
    'details of product provider',
    'the main plan',
    'the relevant fund',
    'simplified description of the key product features',
    'comprises this product',
    'important note',
    'product at-a-glance',
    'group policy owner',
    'singtel dash customer',
    '.com',
  ]

  return !disallowedPhrases.some((phrase) => normalized.toLowerCase().includes(phrase))
}

function extractPolicyName(document: ExtractedPdfDocument): string {
  const fallbackName = fallbackPolicyName(path.basename(document.filePath))
  const fallbackTokens = new Set(significantTokens(fallbackName))
  const firstPage = document.pages[0]
  if (!firstPage) {
    return fallbackName
  }

  const pageText = firstPage.lines.map((line) => normalizeWhitespace(line.text)).filter(Boolean).join('\n')

  const explicitPatterns = [
    /Product Summary for ([^\n]+)/i,
    /^([^\n]+?) Product Summary$/im,
    /PRODUCT SUMMARY\s+([^\n]+)/i,
  ]

  for (const pattern of explicitPatterns) {
    const match = pageText.match(pattern)
    if (match?.[1] && isUsablePolicyName(match[1])) {
      const candidate = normalizeWhitespace(match[1]).replace(/^product summary:\s*/i, '').trim()
      const overlap = significantTokens(candidate).some((token) => fallbackTokens.has(token))
      if (overlap) {
        return candidate
      }
    }
  }

  const ignoredLines = [
    'PRODUCT SUMMARY',
    'Product Summary',
    'Important Note',
    'Please keep this copy for reference.',
  ]

  for (const line of firstPage.lines.map((entry) => normalizeWhitespace(entry.text)).slice(0, 20)) {
    if (!line) continue
    if (ignoredLines.includes(line)) continue
    if (/^version\b/i.test(line)) continue
    if (/^\d+(\.\d+)?\b/.test(line)) continue
    if (line.length < 4) continue
    if (line.length > 100) continue
    if (/\.$/.test(line)) continue

    const candidate = line
      .replace(/^product summary:\s*/i, '')
      .replace(/\s+Product Summary$/i, '')
      .trim()
    if (isUsablePolicyName(candidate)) {
      const overlap = significantTokens(candidate).some((token) => fallbackTokens.has(token))
      if (!overlap) {
        continue
      }
      return candidate
    }
  }

  return fallbackName
}

async function main() {
  const discovery = await discoverManualCatalogSources()
  const rows: Array<{ fileName: string, policyName: string }> = []

  for (const source of discovery.summarySources) {
    const document = await extractPdfText(source.filePath)
    rows.push({
      fileName: source.fileName,
      policyName: extractPolicyName(document),
    })
  }

  rows.sort((left, right) => left.fileName.localeCompare(right.fileName))

  const lines = [
    '# ILP Catalog File / Policy Map',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    `Summary sources: ${rows.length}`,
    '',
    '| File Name | Policy Name |',
    '| --- | --- |',
    ...rows.map((row) => `| ${row.fileName.replace(/\|/g, '\\|')} | ${row.policyName.replace(/\|/g, '\\|')} |`),
    '',
  ]

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8')
  console.log(`Wrote ILP file/policy map to ${OUTPUT_PATH}`)
}

await main()
