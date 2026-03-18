import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { ilpCatalogManifestSchema, ilpCatalogProductsSchema } from '../../src/lib/ilp-catalog/schema.js'
import type { IlpCatalogManifest, IlpCatalogProduct } from '../../src/lib/ilp-catalog/types.js'
import { analyzeStructuredEconomics, discoverManualCatalogSources } from './discovery.js'
import { extractPdfText } from './pdf/extractPdfText.js'
import { parseHsbcWealthAccelerate } from './parsers/hsbcWealthAccelerate.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const GENERATED_DIR = path.join(ROOT_DIR, 'src/lib/data/generated')
const MANIFEST_PATH = path.join(GENERATED_DIR, 'ilpCatalog.manifest.json')
const PRODUCTS_PATH = path.join(GENERATED_DIR, 'ilpCatalog.products.json')
const PARSER_VERSION = '0.1.0'
const CATALOG_VERSION = '0.1.0'
const HSBC_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Accelerate Product Summary.pdf'

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

async function main() {
  const discovery = await discoverManualCatalogSources()
  const extracted = await extractPdfText(HSBC_SOURCE_PATH)
  const checksum = await sha256(HSBC_SOURCE_PATH)
  const brochurePartialProducts = await buildBrochurePartialProducts(discovery.brochureOnlySources)
  const products = [
    parseHsbcWealthAccelerate({
      document: extracted,
      sourceChecksumSha256: checksum,
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

  ilpCatalogProductsSchema.parse(products)
  ilpCatalogManifestSchema.parse(manifest)

  await mkdir(GENERATED_DIR, { recursive: true })
  await writeFile(PRODUCTS_PATH, `${JSON.stringify(products, null, 2)}\n`, 'utf8')
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log(`Wrote catalog manifest to ${MANIFEST_PATH}`)
  console.log(`Wrote ${products.length} catalog product(s) to ${PRODUCTS_PATH}`)
  console.log(`Discovered ${discovery.summarySources.length} summary source(s) and ${discovery.brochureOnlySources.length} brochure-only source(s)`)
  console.log(`Eligible brochure-only partial products: ${brochurePartialProducts.length}`)
}

await main()
