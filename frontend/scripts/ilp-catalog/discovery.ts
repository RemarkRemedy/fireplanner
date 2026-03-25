import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { IlpCatalogSourceClass, IlpCatalogSourceDocumentType } from '../../src/lib/ilp-catalog/types.js'

export const MANUAL_CORPUS_DIR = '/Users/tj/Downloads/pdfs'

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
  'PDF',
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
  'V',
])

const SPECIAL_MATCH_TOKENS_BY_FILE = new Map<string, string[]>([
  ['WA_Broc_201106386R_IE_Aug2021.pdf', ['IE', 'CPFIE', 'NONCPFIE']],
])

export interface StructuredEconomicsSignals {
  hasCharges: boolean
  hasEec: boolean
  hasBonus: boolean
  hasAccountModel: boolean
  hasWithdrawalRules: boolean
  qualifiesForPartial: boolean
}

export interface DiscoveredCatalogSource {
  productKey: string
  insurer: string
  productName: string
  fileName: string
  filePath: string
  documentType: IlpCatalogSourceDocumentType
  sourceClass: IlpCatalogSourceClass
}

export interface ManualCatalogDiscovery {
  summarySources: DiscoveredCatalogSource[]
  brochureOnlySources: DiscoveredCatalogSource[]
}

export function isBrochureFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return (
    lower.includes('brochure')
    || /\bpb\b/i.test(fileName)
    || lower.startsWith('broc_')
    || lower.includes('_brochure')
    || lower.startsWith('wa_broc_')
  )
}

export function isSummaryFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  if (!lower.endsWith('.pdf')) return false
  if (isBrochureFile(fileName)) return false

  return (
    lower.includes('product summary')
    || lower.includes('_summary')
    || lower.includes(' summary')
    || lower.includes('_pdtsum')
    || lower.includes(' pdtsum')
    || /^ps[\(_]/i.test(fileName)
    || /\bps[_\s(]/i.test(fileName)
    || lower.startsWith('wa_sum_')
    || /_ps_/i.test(fileName)
    || lower.endsWith(' ps.pdf')
  )
}

export function inferInsurer(fileName: string): string {
  if (fileName.startsWith('EIP_')) return 'Etiqa'
  if (fileName.startsWith('FWD')) return 'FWD'
  if (fileName.startsWith('HSBC Life')) return 'HSBC Life'
  if (fileName.startsWith('PRU')) return 'Prudential'
  if (fileName.startsWith('Singlife')) return 'Singlife'
  if (fileName.startsWith('TML_')) return 'Tokio Marine'
  if (fileName.startsWith('WA_')) return 'AIA'
  if (fileName.startsWith('VA_') || fileName.startsWith('VA') || fileName.startsWith('VS')) return 'Manulife/AIA-like'
  if (fileName.startsWith('PS(') || fileName.startsWith('PS_') || fileName.startsWith('Broc_GEL_') || fileName.startsWith('GL') || fileName.startsWith('GB')) return 'Great Eastern'
  if (fileName.startsWith('WF')) return 'HSBC Life'
  if (fileName.startsWith('SNACKIV')) return 'Unknown/SNACKIV'
  return 'Unknown'
}

export function inferProductName(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extractMatchTokens(fileName: string): string[] {
  const baseName = fileName.replace(/\.pdf$/i, '')
  const rawTokens = Array.from(baseName.matchAll(/[A-Z][A-Z0-9()/.+-]*/g)).map((match) => match[0])
  const tokens = new Set<string>(SPECIAL_MATCH_TOKENS_BY_FILE.get(fileName) ?? [])

  for (const rawToken of rawTokens) {
    const compactToken = rawToken.replace(/[^A-Z0-9]/g, '')
    if (compactToken.length >= 6 && /\d/.test(compactToken)) {
      continue
    }

    if ((compactToken.length >= 3 || compactToken === 'WF') && !TOKEN_STOPWORDS.has(compactToken)) {
      tokens.add(compactToken)
    }

    const alphaPrefix = compactToken.match(/^[A-Z]+/)?.[0]
    if (alphaPrefix && alphaPrefix.length >= 3 && !TOKEN_STOPWORDS.has(alphaPrefix)) {
      tokens.add(alphaPrefix)
    }
  }

  return [...tokens]
}

function brochureHasMatchingSummary(fileName: string, summaryFiles: string[]): boolean {
  const brochureTokens = extractMatchTokens(fileName)
  if (brochureTokens.length === 0) return false

  return summaryFiles.some((summaryFile) => {
    const summaryTokens = new Set(extractMatchTokens(summaryFile))
    return brochureTokens.some((token) => summaryTokens.has(token))
  })
}

export async function discoverManualCatalogSources(): Promise<ManualCatalogDiscovery> {
  const entries = await readdir(MANUAL_CORPUS_DIR)
  const pdfFiles: string[] = []

  for (const entry of entries) {
    const filePath = path.join(MANUAL_CORPUS_DIR, entry)
    const fileStat = await stat(filePath)
    if (fileStat.isFile() && entry.toLowerCase().endsWith('.pdf')) {
      pdfFiles.push(entry)
    }
  }

  pdfFiles.sort()

  const summaryFiles = pdfFiles.filter(isSummaryFile)
  const brochureFiles = pdfFiles.filter(isBrochureFile)

  const summarySources = summaryFiles.map((fileName) => ({
    productKey: slugify(`${inferInsurer(fileName)}-${inferProductName(fileName)}`),
    insurer: inferInsurer(fileName),
    productName: inferProductName(fileName),
    fileName,
    filePath: path.join(MANUAL_CORPUS_DIR, fileName),
    documentType: 'summary' as const,
    sourceClass: 'summary' as const,
  }))

  const brochureOnlySources = brochureFiles
    .filter((fileName) => !brochureHasMatchingSummary(fileName, summaryFiles))
    .map((fileName) => ({
      productKey: slugify(`${inferInsurer(fileName)}-${inferProductName(fileName)}`),
      insurer: inferInsurer(fileName),
      productName: inferProductName(fileName),
      fileName,
      filePath: path.join(MANUAL_CORPUS_DIR, fileName),
      documentType: 'brochure' as const,
      sourceClass: 'brochure-only' as const,
    }))

  return {
    summarySources,
    brochureOnlySources,
  }
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text)
}

export function analyzeStructuredEconomics(text: string): StructuredEconomicsSignals {
  const normalized = text.toLowerCase()
  const hasCharges = has(normalized, /\bpolicy charge\b|\binsurance charge\b|\bmortality charge\b|\badministration charge\b|\badmin charge\b|\baccount maintenance fee\b|\binvestment management fee\b|\bpremium charge\b|\bbid-offer spread\b|\bbid offer spread\b/)
  const hasEec = has(normalized, /\bearly encashment charge\b|\bearly exit charge\b|\bsurrender charge\b|\beec\b/)
  const hasBonus = has(normalized, /\bbonus\b|\bloyalty\b|\bstart-up\b|\bstartup\b|\bpower-up\b|\ballocation rate\b/)
  const hasAccountModel = has(normalized, /\binitial units account\b|\baccumulation units account\b|\btop-up account\b|\btop up account\b|\bgrowth account\b|\bflex account\b|\badditional investment account\b|\bregular premium account\b/)
  const hasWithdrawalRules = has(normalized, /\bpartial withdrawal\b|\bpremium holiday\b|\bfree partial withdrawal\b|\bbonus recovery charge\b|\bbrc\b|\bpwc\b/)
  const structuredSignalCount = [
    hasCharges,
    hasEec,
    hasBonus,
    hasAccountModel,
  ].filter(Boolean).length

  return {
    hasCharges,
    hasEec,
    hasBonus,
    hasAccountModel,
    hasWithdrawalRules,
    qualifiesForPartial: hasCharges && (hasEec || hasAccountModel) && structuredSignalCount >= 3,
  }
}
