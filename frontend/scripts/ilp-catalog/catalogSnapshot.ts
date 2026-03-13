import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ilpCatalogManifestSchema, ilpCatalogProductsSchema } from '../../src/lib/ilp-catalog/schema.js'
import type { IlpCatalogManifest, IlpCatalogProduct } from '../../src/lib/ilp-catalog/types.js'
import { analyzeStructuredEconomics, discoverManualCatalogSources } from './discovery.js'
import { parseHsbcWealthAccelerate } from './parsers/hsbcWealthAccelerate.js'
import { parseHsbcWealthAbundance } from './parsers/hsbcWealthAbundance.js'
import { parseHsbcWealthFocus } from './parsers/hsbcWealthFocus.js'
import { parseHsbcGoalBuilderIi } from './parsers/hsbcGoalBuilderIi.js'
import { parseHsbcWealthHarvest } from './parsers/hsbcWealthHarvest.js'
import { parseHsbcWealthVoyage } from './parsers/hsbcWealthVoyage.js'
import { parseIncomeInvestFlex } from './parsers/incomeInvestFlex.js'
import { parseIncomeInvestFlexVantage } from './parsers/incomeInvestFlexVantage.js'
import { parseEtiqaInvestFlexPrimeIi } from './parsers/etiqaInvestFlexPrimeIi.js'
import { parseEtiqaInvestFlexPro } from './parsers/etiqaInvestFlexPro.js'
import { parseEtiqaInvestFlexWealthIi } from './parsers/etiqaInvestFlexWealthIi.js'
import { parseEtiqaInvestSmartFlexIi } from './parsers/etiqaInvestSmartFlexIi.js'
import { parseEtiqaInvestStarter } from './parsers/etiqaInvestStarter.js'
import { parseEtiqaInvestWealthPurpose } from './parsers/etiqaInvestWealthPurpose.js'
import { parsePrudentialPruVantageAssureII } from './parsers/prudentialPruVantageAssureII.js'
import { parsePrudentialPruVantageAssureSp } from './parsers/prudentialPruVantageAssureSp.js'
import { parsePrudentialPruVantageProsper } from './parsers/prudentialPruVantageProsper.js'
import { parsePrudentialPruVantageWealthII } from './parsers/prudentialPruVantageWealthII.js'
import { parseTokioMarineWealthMaxIi } from './parsers/tokioMarineWealthMaxIi.js'
import { parseTokioMarineWealthProIi } from './parsers/tokioMarineWealthProIi.js'
import { extractPdfText } from './pdf/extractPdfText.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
export const GENERATED_DIR = path.join(ROOT_DIR, 'src/lib/data/generated')
export const MANIFEST_PATH = path.join(GENERATED_DIR, 'ilpCatalog.manifest.json')
export const PRODUCTS_PATH = path.join(GENERATED_DIR, 'ilpCatalog.products.json')
export const PARSER_VERSION = '0.1.0'
export const CATALOG_VERSION = '0.1.0'
const INCOME_INVEST_FLEX_SOURCE_PATH = '/Users/tj/Downloads/pdfs/VS1_Summary.pdf'
const INCOME_INVEST_FLEX_VANTAGE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/VS2_Summary.pdf'
const ETIQA_INVEST_FLEX_PRIME_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex prime II_Product Summary.pdf'
const ETIQA_INVEST_FLEX_PRO_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex pro_Product Summary.pdf'
const ETIQA_INVEST_FLEX_WEALTH_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex wealth II_Product Summary.pdf'
const ETIQA_INVEST_SMART_FLEX_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest smart flex II_Product Summary.pdf'
const ETIQA_INVEST_STARTER_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest starter_Product Summary.pdf'
const ETIQA_INVEST_WEALTH_PURPOSE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest Wealth Purpose_Product Summary.pdf'
const HSBC_GOAL_BUILDER_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/GBII_Summary.pdf'
const HSBC_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Accelerate Product Summary.pdf'
const HSBC_WEALTH_ABUNDANCE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Abundance Product Summary.pdf'
const HSBC_WEALTH_FOCUS_FLEXI_1_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi1.pdf'
const HSBC_WEALTH_FOCUS_FLEXI_3_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi3.pdf'
const HSBC_WEALTH_FOCUS_FLEXI_5_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi5.pdf'
const HSBC_WEALTH_HARVEST_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Harvest Product Summary.pdf'
const HSBC_WEALTH_VOYAGE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Voyage Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Assure II Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_ASSURE_SP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Assure (SP) Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Prosper Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Wealth II Product Summary.pdf'
const TOKIO_MARINE_WEALTH_MAX_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZV_TPDN_CIZ_Summary.pdf'
const TOKIO_MARINE_WEALTH_PRO_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZS_TPDN_CIZ_Summary.pdf'

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
  const incomeInvestFlexExtracted = await extractPdfText(INCOME_INVEST_FLEX_SOURCE_PATH)
  const incomeInvestFlexChecksum = await sha256(INCOME_INVEST_FLEX_SOURCE_PATH)
  const incomeInvestFlexVantageExtracted = await extractPdfText(INCOME_INVEST_FLEX_VANTAGE_SOURCE_PATH)
  const incomeInvestFlexVantageChecksum = await sha256(INCOME_INVEST_FLEX_VANTAGE_SOURCE_PATH)
  const etiqaInvestFlexPrimeIiExtracted = await extractPdfText(ETIQA_INVEST_FLEX_PRIME_II_SOURCE_PATH)
  const etiqaInvestFlexPrimeIiChecksum = await sha256(ETIQA_INVEST_FLEX_PRIME_II_SOURCE_PATH)
  const etiqaInvestFlexProExtracted = await extractPdfText(ETIQA_INVEST_FLEX_PRO_SOURCE_PATH)
  const etiqaInvestFlexProChecksum = await sha256(ETIQA_INVEST_FLEX_PRO_SOURCE_PATH)
  const etiqaInvestFlexWealthIiExtracted = await extractPdfText(ETIQA_INVEST_FLEX_WEALTH_II_SOURCE_PATH)
  const etiqaInvestFlexWealthIiChecksum = await sha256(ETIQA_INVEST_FLEX_WEALTH_II_SOURCE_PATH)
  const etiqaInvestSmartFlexIiExtracted = await extractPdfText(ETIQA_INVEST_SMART_FLEX_II_SOURCE_PATH)
  const etiqaInvestSmartFlexIiChecksum = await sha256(ETIQA_INVEST_SMART_FLEX_II_SOURCE_PATH)
  const etiqaInvestStarterExtracted = await extractPdfText(ETIQA_INVEST_STARTER_SOURCE_PATH)
  const etiqaInvestStarterChecksum = await sha256(ETIQA_INVEST_STARTER_SOURCE_PATH)
  const etiqaInvestWealthPurposeExtracted = await extractPdfText(ETIQA_INVEST_WEALTH_PURPOSE_SOURCE_PATH)
  const etiqaInvestWealthPurposeChecksum = await sha256(ETIQA_INVEST_WEALTH_PURPOSE_SOURCE_PATH)
  const hsbcGoalBuilderIiExtracted = await extractPdfText(HSBC_GOAL_BUILDER_II_SOURCE_PATH)
  const hsbcGoalBuilderIiChecksum = await sha256(HSBC_GOAL_BUILDER_II_SOURCE_PATH)
  const extracted = await extractPdfText(HSBC_SOURCE_PATH)
  const checksum = await sha256(HSBC_SOURCE_PATH)
  const hsbcAbundanceExtracted = await extractPdfText(HSBC_WEALTH_ABUNDANCE_SOURCE_PATH)
  const hsbcAbundanceChecksum = await sha256(HSBC_WEALTH_ABUNDANCE_SOURCE_PATH)
  const hsbcWealthFocusFlexi1Extracted = await extractPdfText(HSBC_WEALTH_FOCUS_FLEXI_1_SOURCE_PATH)
  const hsbcWealthFocusFlexi1Checksum = await sha256(HSBC_WEALTH_FOCUS_FLEXI_1_SOURCE_PATH)
  const hsbcWealthFocusFlexi3Extracted = await extractPdfText(HSBC_WEALTH_FOCUS_FLEXI_3_SOURCE_PATH)
  const hsbcWealthFocusFlexi3Checksum = await sha256(HSBC_WEALTH_FOCUS_FLEXI_3_SOURCE_PATH)
  const hsbcWealthFocusFlexi5Extracted = await extractPdfText(HSBC_WEALTH_FOCUS_FLEXI_5_SOURCE_PATH)
  const hsbcWealthFocusFlexi5Checksum = await sha256(HSBC_WEALTH_FOCUS_FLEXI_5_SOURCE_PATH)
  const hsbcHarvestExtracted = await extractPdfText(HSBC_WEALTH_HARVEST_SOURCE_PATH)
  const hsbcHarvestChecksum = await sha256(HSBC_WEALTH_HARVEST_SOURCE_PATH)
  const hsbcVoyageExtracted = await extractPdfText(HSBC_WEALTH_VOYAGE_SOURCE_PATH)
  const hsbcVoyageChecksum = await sha256(HSBC_WEALTH_VOYAGE_SOURCE_PATH)
  const prudentialExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH)
  const prudentialChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH)
  const prudentialAssureExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH)
  const prudentialAssureChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH)
  const prudentialAssureSpExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_ASSURE_SP_SOURCE_PATH)
  const prudentialAssureSpChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_ASSURE_SP_SOURCE_PATH)
  const prudentialProsperExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH)
  const prudentialProsperChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH)
  const tokioMarineExtracted = await extractPdfText(TOKIO_MARINE_WEALTH_MAX_II_SOURCE_PATH)
  const tokioMarineChecksum = await sha256(TOKIO_MARINE_WEALTH_MAX_II_SOURCE_PATH)
  const tokioMarineWealthProExtracted = await extractPdfText(TOKIO_MARINE_WEALTH_PRO_II_SOURCE_PATH)
  const tokioMarineWealthProChecksum = await sha256(TOKIO_MARINE_WEALTH_PRO_II_SOURCE_PATH)
  const brochurePartialProducts = await buildBrochurePartialProducts(discovery.brochureOnlySources)

  const products = [
    parseIncomeInvestFlex({
      document: incomeInvestFlexExtracted,
      sourceChecksumSha256: incomeInvestFlexChecksum,
    }),
    parseIncomeInvestFlexVantage({
      document: incomeInvestFlexVantageExtracted,
      sourceChecksumSha256: incomeInvestFlexVantageChecksum,
    }),
    parseEtiqaInvestFlexPrimeIi({
      document: etiqaInvestFlexPrimeIiExtracted,
      sourceChecksumSha256: etiqaInvestFlexPrimeIiChecksum,
    }),
    parseEtiqaInvestFlexPro({
      document: etiqaInvestFlexProExtracted,
      sourceChecksumSha256: etiqaInvestFlexProChecksum,
    }),
    parseEtiqaInvestFlexWealthIi({
      document: etiqaInvestFlexWealthIiExtracted,
      sourceChecksumSha256: etiqaInvestFlexWealthIiChecksum,
    }),
    parseEtiqaInvestSmartFlexIi({
      document: etiqaInvestSmartFlexIiExtracted,
      sourceChecksumSha256: etiqaInvestSmartFlexIiChecksum,
    }),
    parseEtiqaInvestStarter({
      document: etiqaInvestStarterExtracted,
      sourceChecksumSha256: etiqaInvestStarterChecksum,
    }),
    parseEtiqaInvestWealthPurpose({
      document: etiqaInvestWealthPurposeExtracted,
      sourceChecksumSha256: etiqaInvestWealthPurposeChecksum,
    }),
    parseHsbcGoalBuilderIi({
      document: hsbcGoalBuilderIiExtracted,
      sourceChecksumSha256: hsbcGoalBuilderIiChecksum,
    }),
    parseHsbcWealthAccelerate({
      document: extracted,
      sourceChecksumSha256: checksum,
    }),
    parseHsbcWealthAbundance({
      document: hsbcAbundanceExtracted,
      sourceChecksumSha256: hsbcAbundanceChecksum,
    }),
    parseHsbcWealthFocus({
      document: hsbcWealthFocusFlexi1Extracted,
      sourceChecksumSha256: hsbcWealthFocusFlexi1Checksum,
    }),
    parseHsbcWealthFocus({
      document: hsbcWealthFocusFlexi3Extracted,
      sourceChecksumSha256: hsbcWealthFocusFlexi3Checksum,
    }),
    parseHsbcWealthFocus({
      document: hsbcWealthFocusFlexi5Extracted,
      sourceChecksumSha256: hsbcWealthFocusFlexi5Checksum,
    }),
    parseHsbcWealthHarvest({
      document: hsbcHarvestExtracted,
      sourceChecksumSha256: hsbcHarvestChecksum,
    }),
    parseHsbcWealthVoyage({
      document: hsbcVoyageExtracted,
      sourceChecksumSha256: hsbcVoyageChecksum,
    }),
    parsePrudentialPruVantageWealthII({
      document: prudentialExtracted,
      sourceChecksumSha256: prudentialChecksum,
    }),
    parsePrudentialPruVantageAssureII({
      document: prudentialAssureExtracted,
      sourceChecksumSha256: prudentialAssureChecksum,
    }),
    parsePrudentialPruVantageAssureSp({
      document: prudentialAssureSpExtracted,
      sourceChecksumSha256: prudentialAssureSpChecksum,
    }),
    parsePrudentialPruVantageProsper({
      document: prudentialProsperExtracted,
      sourceChecksumSha256: prudentialProsperChecksum,
    }),
    parseTokioMarineWealthMaxIi({
      document: tokioMarineExtracted,
      sourceChecksumSha256: tokioMarineChecksum,
    }),
    parseTokioMarineWealthProIi({
      document: tokioMarineWealthProExtracted,
      sourceChecksumSha256: tokioMarineWealthProChecksum,
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
