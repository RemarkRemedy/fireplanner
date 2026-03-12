import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ilpCatalogManifestSchema, ilpCatalogProductsSchema } from '../../src/lib/ilp-catalog/schema.js'
import type { IlpCatalogManifest, IlpCatalogProduct } from '../../src/lib/ilp-catalog/types.js'
import { analyzeStructuredEconomics, discoverManualCatalogSources } from './discovery.js'
import { parseHsbcWealthAccelerate } from './parsers/hsbcWealthAccelerate.js'
import { parsePrudentialPruVantageAssureII } from './parsers/prudentialPruVantageAssureII.js'
import { parsePrudentialPruVantageProsper } from './parsers/prudentialPruVantageProsper.js'
import { parsePrudentialPruVantageWealthII } from './parsers/prudentialPruVantageWealthII.js'
import { extractPdfText } from './pdf/extractPdfText.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
export const GENERATED_DIR = path.join(ROOT_DIR, 'src/lib/data/generated')
export const MANIFEST_PATH = path.join(GENERATED_DIR, 'ilpCatalog.manifest.json')
export const PRODUCTS_PATH = path.join(GENERATED_DIR, 'ilpCatalog.products.json')
export const PARSER_VERSION = '0.1.0'
export const CATALOG_VERSION = '0.1.0'
const HSBC_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Accelerate Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Assure II Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Prosper Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Wealth II Product Summary.pdf'

export interface IlpCatalogSnapshot {
  manifest: IlpCatalogManifest
  products: IlpCatalogProduct[]
}

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function brochureOnlyProductId(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function buildBrochurePartialProducts(
  brochureOnlySources: Awaited<ReturnType<typeof discoverManualCatalogSources>>['brochureOnlySources'],
): Promise<IlpCatalogProduct[]> {
  const products: IlpCatalogProduct[] = []

  for (const source of brochureOnlySources) {
    const extracted = await extractPdfText(source.filePath)
    const checksum = await sha256(source.filePath)
    const combinedText = extracted.pages.map((page) => page.text).join('\n')
    const signals = analyzeStructuredEconomics(combinedText)

    if (!signals.qualifiesForPartial) {
      continue
    }

    products.push({
      id: brochureOnlyProductId(source.fileName),
      insurer: source.insurer,
      productName: source.productName,
      sourceFileName: source.fileName,
      sourceChecksumSha256: checksum,
      sourceDocumentType: 'brochure',
      sourceClass: 'brochure-only',
      supportStatus: 'partial',
      structureStatus: 'brochure-partial',
      economicsStatus: 'partial-modeled-subset',
      modeledEconomics: [],
      metadataOnlyBehaviors: [
        'brochure-only-structured-economics',
      ],
      warnings: [
        'This entry was created from a brochure-only source.',
        'Structured economics were detected, but the brochure does not provide enough detail for full ILP review modeling.',
        'Use this only as a partial/manual seed until a matching product summary is available.',
      ],
      archived: false,
      variants: [],
    })
  }

  return products
}

export async function buildCatalogSnapshot(): Promise<IlpCatalogSnapshot> {
  const discovery = await discoverManualCatalogSources()
  const extracted = await extractPdfText(HSBC_SOURCE_PATH)
  const checksum = await sha256(HSBC_SOURCE_PATH)
  const prudentialExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH)
  const prudentialChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH)
  const prudentialAssureExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH)
  const prudentialAssureChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH)
  const prudentialProsperExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH)
  const prudentialProsperChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH)
  const brochurePartialProducts = await buildBrochurePartialProducts(discovery.brochureOnlySources)

  const products = [
    parseHsbcWealthAccelerate({
      document: extracted,
      sourceChecksumSha256: checksum,
    }),
    parsePrudentialPruVantageWealthII({
      document: prudentialExtracted,
      sourceChecksumSha256: prudentialChecksum,
    }),
    parsePrudentialPruVantageAssureII({
      document: prudentialAssureExtracted,
      sourceChecksumSha256: prudentialAssureChecksum,
    }),
    parsePrudentialPruVantageProsper({
      document: prudentialProsperExtracted,
      sourceChecksumSha256: prudentialProsperChecksum,
    }),
    ...brochurePartialProducts,
  ]

  const manifest: IlpCatalogManifest = {
    catalogVersion: CATALOG_VERSION,
    generatedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
    sourceStrategy: 'manual-pdf-corpus',
    productsCount: products.length,
    supportedCount: products.filter((product) => product.supportStatus === 'supported').length,
    partialCount: products.filter((product) => product.supportStatus === 'partial').length,
    parserErrorCount: products.filter((product) => product.supportStatus === 'parser-error').length,
    summarySourceCount: discovery.summarySources.length,
    brochureOnlySourceCount: discovery.brochureOnlySources.length,
    brochurePartialEligibleCount: brochurePartialProducts.length,
  }

  const normalizedProducts = ilpCatalogProductsSchema.parse(JSON.parse(JSON.stringify(products)))
  const normalizedManifest = ilpCatalogManifestSchema.parse(JSON.parse(JSON.stringify(manifest)))

  return { manifest: normalizedManifest, products: normalizedProducts }
}

export async function writeCatalogSnapshot(snapshot: IlpCatalogSnapshot): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  await writeFile(PRODUCTS_PATH, `${JSON.stringify(snapshot.products, null, 2)}\n`, 'utf8')
  await writeFile(MANIFEST_PATH, `${JSON.stringify(snapshot.manifest, null, 2)}\n`, 'utf8')
}
