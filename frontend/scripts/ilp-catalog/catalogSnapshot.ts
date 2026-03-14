import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ilpCatalogManifestSchema, ilpCatalogProductsSchema } from '../../src/lib/ilp-catalog/schema.js'
import type { IlpCatalogManifest, IlpCatalogProduct } from '../../src/lib/ilp-catalog/types.js'
import { analyzeStructuredEconomics, discoverManualCatalogSources } from './discovery.js'
import { parseAiaEliteSecureIncome5Pay } from './parsers/aiaEliteSecureIncome5Pay.js'
import { parseAiaEliteSecureIncomeSp } from './parsers/aiaEliteSecureIncomeSp.js'
import { parseAiaInvestEasyCashSrs } from './parsers/aiaInvestEasyCashSrs.js'
import { parseAiaInvestEasyCpf } from './parsers/aiaInvestEasyCpf.js'
import { parseAiaProAchiever3 } from './parsers/aiaProAchiever3.js'
import { parseAiaPlatinumRetirementElite } from './parsers/aiaPlatinumRetirementElite.js'
import { parseAiaPlatinumWealthElite2 } from './parsers/aiaPlatinumWealthElite2.js'
import { parseAiaPlatinumWealthLegacy } from './parsers/aiaPlatinumWealthLegacy.js'
import { parseAiaPlatinumWealthVenture2 } from './parsers/aiaPlatinumWealthVenture2.js'
import { parseAiaWealthVenture } from './parsers/aiaWealthVenture.js'
import { parseHsbcWealthAccelerate } from './parsers/hsbcWealthAccelerate.js'
import { parseHsbcWealthAbundance } from './parsers/hsbcWealthAbundance.js'
import { parseHsbcWealthFocus } from './parsers/hsbcWealthFocus.js'
import { parseHsbcGoalBuilderIi } from './parsers/hsbcGoalBuilderIi.js'
import { parseHsbcWealthInvestCpf } from './parsers/hsbcWealthInvestCpf.js'
import { parseHsbcWealthInvestCashSrs } from './parsers/hsbcWealthInvestCashSrs.js'
import { parseGreatEasternInvestAdvantage2Rsp } from './parsers/greatEasternInvestAdvantage2Rsp.js'
import { parseGreatEasternInvestAdvantage2Sp } from './parsers/greatEasternInvestAdvantage2Sp.js'
import { parseGreatEasternInvestAdvantageRsp } from './parsers/greatEasternInvestAdvantageRsp.js'
import { parseGreatEasternInvestAdvantageSp } from './parsers/greatEasternInvestAdvantageSp.js'
import { parseGreatEasternGreatLifeAdvantage4 } from './parsers/greatEasternGreatLifeAdvantage4.js'
import { parseGreatEasternPrestigeLegacyAdvantage } from './parsers/greatEasternPrestigeLegacyAdvantage.js'
import { parseHsbcWealthHarvest } from './parsers/hsbcWealthHarvest.js'
import { parseHsbcWealthVoyage } from './parsers/hsbcWealthVoyage.js'
import { parseGreatEasternInvestmentLinkedInsurancePlan2 } from './parsers/greatEasternInvestmentLinkedInsurancePlan2.js'
import { parseGreatEasternWealthAdvantage4 } from './parsers/greatEasternWealthAdvantage4.js'
import { parseIncomeInvestFlex } from './parsers/incomeInvestFlex.js'
import { parseIncomeAstralinkVa2 } from './parsers/incomeAstralinkVa2.js'
import { parseIncomeInvestFlexTriVantage } from './parsers/incomeInvestFlexTriVantage.js'
import { parseIncomeInvestFlexVantage } from './parsers/incomeInvestFlexVantage.js'
import { parseIncomeLegacyFlexSolitaire } from './parsers/incomeLegacyFlexSolitaire.js'
import { parseIncomeSnackInvestment } from './parsers/incomeSnackInvestment.js'
import { parseIncomeWealthLinkGl3 } from './parsers/incomeWealthLinkGl3.js'
import { parseManulifeInvestreadyIii } from './parsers/manulifeInvestreadyIii.js'
import { parseManulifeManuinvestDuo } from './parsers/manulifeManuinvestDuo.js'
import { parseManulifeManulinkInvestorIi } from './parsers/manulifeManulinkInvestorIi.js'
import { parseEtiqaInvestFlexPrimeIi } from './parsers/etiqaInvestFlexPrimeIi.js'
import { parseEtiqaInvestFlexPro } from './parsers/etiqaInvestFlexPro.js'
import { parseEtiqaInvestFlexWealthIi } from './parsers/etiqaInvestFlexWealthIi.js'
import { parseEtiqaDashPetPlus } from './parsers/etiqaDashPetPlus.js'
import { parseEtiqaInvestSmartFlexIi } from './parsers/etiqaInvestSmartFlexIi.js'
import { parseEtiqaInvestSmartVista } from './parsers/etiqaInvestSmartVista.js'
import { parseEtiqaInvestStarter } from './parsers/etiqaInvestStarter.js'
import { parseEtiqaInvestPlusSp } from './parsers/etiqaInvestPlusSp.js'
import { parseEtiqaInvestVista } from './parsers/etiqaInvestVista.js'
import { parseEtiqaTiqInvest } from './parsers/etiqaTiqInvest.js'
import { parseEtiqaInvestWealthPurpose } from './parsers/etiqaInvestWealthPurpose.js'
import { parsePrudentialPruActiveLinkGuard } from './parsers/prudentialPruActiveLinkGuard.js'
import { parsePrudentialPruVantageAssureII } from './parsers/prudentialPruVantageAssureII.js'
import { parsePrudentialPruVantageAssureSp } from './parsers/prudentialPruVantageAssureSp.js'
import { parsePrudentialPrulinkInvestGrowth } from './parsers/prudentialPrulinkInvestGrowth.js'
import { parsePrudentialPrulinkInvestGrowthSp } from './parsers/prudentialPrulinkInvestGrowthSp.js'
import { parsePrudentialPruVantageProsper } from './parsers/prudentialPruVantageProsper.js'
import { parsePrudentialPruVantageWealthII } from './parsers/prudentialPruVantageWealthII.js'
import { parseTokioMarineWealthEnhancerCpfis } from './parsers/tokioMarineWealthEnhancerCpfis.js'
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
const INCOME_ASTRALINK_VA2_SOURCE_PATH = '/Users/tj/Downloads/pdfs/VA2_Summary.pdf'
const INCOME_INVEST_FLEX_TRIVANTAGE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/VS3_Summary.pdf'
const INCOME_INVEST_FLEX_VANTAGE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/VS2_Summary.pdf'
const INCOME_LEGACY_FLEX_SOLITAIRE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/VA3R_VA3S_Summary.pdf'
const INCOME_WEALTHLINK_GL3_SOURCE_PATH = '/Users/tj/Downloads/pdfs/GL3_Summary.pdf'
const INCOME_SNACK_INVESTMENT_SOURCE_PATH = '/Users/tj/Downloads/pdfs/SNACKIV_Summary.pdf'
const MANULIFE_INVESTREADY_III_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MIR03_PdtSum.pdf'
const MANULIFE_MANUINVEST_DUO_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MID01_PdtSum.pdf'
const MANULIFE_MANULINK_INVESTOR_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_MI2_ILP_PdtSum.pdf'
const ETIQA_INVEST_FLEX_PRIME_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex prime II_Product Summary.pdf'
const ETIQA_INVEST_FLEX_PRO_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex pro_Product Summary.pdf'
const ETIQA_INVEST_FLEX_WEALTH_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest flex wealth II_Product Summary.pdf'
const ETIQA_DASH_PET_PLUS_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Dash PET Plus_Summary.pdf'
const ETIQA_INVEST_SMART_FLEX_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest smart flex II_Product Summary.pdf'
const ETIQA_INVEST_SMART_VISTA_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest Smart Vista_Product Summary.pdf'
const ETIQA_INVEST_STARTER_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest starter_Product Summary.pdf'
const ETIQA_INVEST_PLUS_SP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest plus SP_Summary.pdf'
const ETIQA_INVEST_VISTA_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest vista_Product Summary.pdf'
const ETIQA_TIQ_INVEST_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Tiq_Invest_Summary.pdf'
const ETIQA_INVEST_WEALTH_PURPOSE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/EIP_Invest Wealth Purpose_Product Summary.pdf'
const GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_2_RSP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Invest Advantage2(RSP)_v2.0.pdf'
const GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_2_SP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Invest Advantage 2 (SP)_(SG)_v2.0.pdf'
const GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_RSP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Invest Advantage (RSP)_(SG)_v3.0.pdf'
const GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_SP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Invest Advantage (SP)_(SG)_v3.0.pdf'
const GREAT_EASTERN_GREAT_LIFE_ADVANTAGE_4_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Life Advantage 4_(SG)_v2.0.pdf'
const GREAT_EASTERN_PRESTIGE_LEGACY_ADVANTAGE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_Prestige Legacy Advantage_(SG)_v2.0.pdf'
const GREAT_EASTERN_INVESTMENT_LINKED_INSURANCE_PLAN_2_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS_GEL_Investment Linked Insurance Plan 2_v3.0.pdf'
const GREAT_EASTERN_WEALTH_ADVANTAGE_4_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PS(EN)_GREAT Wealth Advantage 4_(SG)_v2.0.pdf'
const HSBC_GOAL_BUILDER_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/GBII_Summary.pdf'
const HSBC_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Accelerate Product Summary.pdf'
const HSBC_WEALTH_ABUNDANCE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Abundance Product Summary.pdf'
const HSBC_WEALTH_FOCUS_FLEXI_1_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi1.pdf'
const HSBC_WEALTH_FOCUS_FLEXI_3_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi3.pdf'
const HSBC_WEALTH_FOCUS_FLEXI_5_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WF PS v1.51_MIP10Flexi5.pdf'
const HSBC_WEALTH_HARVEST_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Harvest Product Summary.pdf'
const HSBC_WEALTH_INVEST_CPF_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Invest (CPF) Product Summary.pdf'
const HSBC_WEALTH_INVEST_CASH_SRS_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Invest (Cash_SRS) PS.pdf'
const HSBC_WEALTH_VOYAGE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/HSBC Life Wealth Voyage Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Assure II Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_ASSURE_SP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Assure (SP) Product Summary.pdf'
const PRUDENTIAL_PRUACTIVE_LINKGUARD_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUActive LinkGuard Product Summary.pdf'
const PRUDENTIAL_PRULINK_INVESTGROWTH_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRULink InvestGrowth Product Summary.pdf'
const PRUDENTIAL_PRULINK_INVESTGROWTH_SP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRULink InvestGrowth (SP) Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Prosper Product Summary.pdf'
const PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/PRUVantage Wealth II Product Summary.pdf'
const TOKIO_MARINE_WEALTH_ENHANCER_CPFIS_SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UL4_TPDN_CIZ_Summary.pdf'
const TOKIO_MARINE_WEALTH_MAX_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZV_TPDN_CIZ_Summary.pdf'
const TOKIO_MARINE_WEALTH_PRO_II_SOURCE_PATH = '/Users/tj/Downloads/pdfs/TML_UNZS_TPDN_CIZ_Summary.pdf'
const AIA_PRO_ACHIEVER_3_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_APA3.0_Oct2024.pdf'
const AIA_ELITE_SECURE_INCOME_5_PAY_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_ESI5P_Jul2025.pdf'
const AIA_ELITE_SECURE_INCOME_SP_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_ESISP_Jul2025.pdf'
const AIA_INVEST_EASY_CASH_SRS_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_NonCPFIE_Oct2024.pdf'
const AIA_INVEST_EASY_CPF_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_CPFIE_Oct2024.pdf'
const AIA_PLATINUM_RETIREMENT_ELITE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_PRE_Jul2025.pdf'
const AIA_PLATINUM_WEALTH_ELITE_2_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_PWE2.0_Jul2025.pdf'
const AIA_PLATINUM_WEALTH_LEGACY_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_PWL_Jul2025.pdf'
const AIA_PLATINUM_WEALTH_VENTURE_2_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_PWV2.0_Apr2025.pdf'
const AIA_WEALTH_VENTURE_SOURCE_PATH = '/Users/tj/Downloads/pdfs/WA_Sum_201106386R_AWV_Jan2026.pdf'

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
  const aiaEliteSecureIncome5PayExtracted = await extractPdfText(AIA_ELITE_SECURE_INCOME_5_PAY_SOURCE_PATH)
  const aiaEliteSecureIncome5PayChecksum = await sha256(AIA_ELITE_SECURE_INCOME_5_PAY_SOURCE_PATH)
  const aiaEliteSecureIncomeSpExtracted = await extractPdfText(AIA_ELITE_SECURE_INCOME_SP_SOURCE_PATH)
  const aiaEliteSecureIncomeSpChecksum = await sha256(AIA_ELITE_SECURE_INCOME_SP_SOURCE_PATH)
  const aiaInvestEasyCashSrsExtracted = await extractPdfText(AIA_INVEST_EASY_CASH_SRS_SOURCE_PATH)
  const aiaInvestEasyCashSrsChecksum = await sha256(AIA_INVEST_EASY_CASH_SRS_SOURCE_PATH)
  const aiaInvestEasyCpfExtracted = await extractPdfText(AIA_INVEST_EASY_CPF_SOURCE_PATH)
  const aiaInvestEasyCpfChecksum = await sha256(AIA_INVEST_EASY_CPF_SOURCE_PATH)
  const aiaPlatinumRetirementEliteExtracted = await extractPdfText(AIA_PLATINUM_RETIREMENT_ELITE_SOURCE_PATH)
  const aiaPlatinumRetirementEliteChecksum = await sha256(AIA_PLATINUM_RETIREMENT_ELITE_SOURCE_PATH)
  const aiaPlatinumWealthElite2Extracted = await extractPdfText(AIA_PLATINUM_WEALTH_ELITE_2_SOURCE_PATH)
  const aiaPlatinumWealthElite2Checksum = await sha256(AIA_PLATINUM_WEALTH_ELITE_2_SOURCE_PATH)
  const aiaPlatinumWealthLegacyExtracted = await extractPdfText(AIA_PLATINUM_WEALTH_LEGACY_SOURCE_PATH)
  const aiaPlatinumWealthLegacyChecksum = await sha256(AIA_PLATINUM_WEALTH_LEGACY_SOURCE_PATH)
  const aiaPlatinumWealthVenture2Extracted = await extractPdfText(AIA_PLATINUM_WEALTH_VENTURE_2_SOURCE_PATH)
  const aiaPlatinumWealthVenture2Checksum = await sha256(AIA_PLATINUM_WEALTH_VENTURE_2_SOURCE_PATH)
  const aiaWealthVentureExtracted = await extractPdfText(AIA_WEALTH_VENTURE_SOURCE_PATH)
  const aiaWealthVentureChecksum = await sha256(AIA_WEALTH_VENTURE_SOURCE_PATH)
  const incomeInvestFlexExtracted = await extractPdfText(INCOME_INVEST_FLEX_SOURCE_PATH)
  const incomeInvestFlexChecksum = await sha256(INCOME_INVEST_FLEX_SOURCE_PATH)
  const incomeAstralinkVa2Extracted = await extractPdfText(INCOME_ASTRALINK_VA2_SOURCE_PATH)
  const incomeAstralinkVa2Checksum = await sha256(INCOME_ASTRALINK_VA2_SOURCE_PATH)
  const incomeInvestFlexTriVantageExtracted = await extractPdfText(INCOME_INVEST_FLEX_TRIVANTAGE_SOURCE_PATH)
  const incomeInvestFlexTriVantageChecksum = await sha256(INCOME_INVEST_FLEX_TRIVANTAGE_SOURCE_PATH)
  const incomeInvestFlexVantageExtracted = await extractPdfText(INCOME_INVEST_FLEX_VANTAGE_SOURCE_PATH)
  const incomeInvestFlexVantageChecksum = await sha256(INCOME_INVEST_FLEX_VANTAGE_SOURCE_PATH)
  const incomeLegacyFlexSolitaireExtracted = await extractPdfText(INCOME_LEGACY_FLEX_SOLITAIRE_SOURCE_PATH)
  const incomeLegacyFlexSolitaireChecksum = await sha256(INCOME_LEGACY_FLEX_SOLITAIRE_SOURCE_PATH)
  const incomeWealthLinkGl3Extracted = await extractPdfText(INCOME_WEALTHLINK_GL3_SOURCE_PATH)
  const incomeWealthLinkGl3Checksum = await sha256(INCOME_WEALTHLINK_GL3_SOURCE_PATH)
  const incomeSnackInvestmentExtracted = await extractPdfText(INCOME_SNACK_INVESTMENT_SOURCE_PATH)
  const incomeSnackInvestmentChecksum = await sha256(INCOME_SNACK_INVESTMENT_SOURCE_PATH)
  const manulifeInvestreadyIiiExtracted = await extractPdfText(MANULIFE_INVESTREADY_III_SOURCE_PATH)
  const manulifeInvestreadyIiiChecksum = await sha256(MANULIFE_INVESTREADY_III_SOURCE_PATH)
  const manulifeManuinvestDuoExtracted = await extractPdfText(MANULIFE_MANUINVEST_DUO_SOURCE_PATH)
  const manulifeManuinvestDuoChecksum = await sha256(MANULIFE_MANUINVEST_DUO_SOURCE_PATH)
  const manulifeManulinkInvestorIiExtracted = await extractPdfText(MANULIFE_MANULINK_INVESTOR_II_SOURCE_PATH)
  const manulifeManulinkInvestorIiChecksum = await sha256(MANULIFE_MANULINK_INVESTOR_II_SOURCE_PATH)
  const etiqaInvestFlexPrimeIiExtracted = await extractPdfText(ETIQA_INVEST_FLEX_PRIME_II_SOURCE_PATH)
  const etiqaInvestFlexPrimeIiChecksum = await sha256(ETIQA_INVEST_FLEX_PRIME_II_SOURCE_PATH)
  const etiqaInvestFlexProExtracted = await extractPdfText(ETIQA_INVEST_FLEX_PRO_SOURCE_PATH)
  const etiqaInvestFlexProChecksum = await sha256(ETIQA_INVEST_FLEX_PRO_SOURCE_PATH)
  const etiqaInvestFlexWealthIiExtracted = await extractPdfText(ETIQA_INVEST_FLEX_WEALTH_II_SOURCE_PATH)
  const etiqaInvestFlexWealthIiChecksum = await sha256(ETIQA_INVEST_FLEX_WEALTH_II_SOURCE_PATH)
  const etiqaDashPetPlusExtracted = await extractPdfText(ETIQA_DASH_PET_PLUS_SOURCE_PATH)
  const etiqaDashPetPlusChecksum = await sha256(ETIQA_DASH_PET_PLUS_SOURCE_PATH)
  const etiqaInvestSmartFlexIiExtracted = await extractPdfText(ETIQA_INVEST_SMART_FLEX_II_SOURCE_PATH)
  const etiqaInvestSmartFlexIiChecksum = await sha256(ETIQA_INVEST_SMART_FLEX_II_SOURCE_PATH)
  const etiqaInvestSmartVistaExtracted = await extractPdfText(ETIQA_INVEST_SMART_VISTA_SOURCE_PATH)
  const etiqaInvestSmartVistaChecksum = await sha256(ETIQA_INVEST_SMART_VISTA_SOURCE_PATH)
  const etiqaInvestStarterExtracted = await extractPdfText(ETIQA_INVEST_STARTER_SOURCE_PATH)
  const etiqaInvestStarterChecksum = await sha256(ETIQA_INVEST_STARTER_SOURCE_PATH)
  const etiqaInvestPlusSpExtracted = await extractPdfText(ETIQA_INVEST_PLUS_SP_SOURCE_PATH)
  const etiqaInvestPlusSpChecksum = await sha256(ETIQA_INVEST_PLUS_SP_SOURCE_PATH)
  const etiqaInvestVistaExtracted = await extractPdfText(ETIQA_INVEST_VISTA_SOURCE_PATH)
  const etiqaInvestVistaChecksum = await sha256(ETIQA_INVEST_VISTA_SOURCE_PATH)
  const etiqaTiqInvestExtracted = await extractPdfText(ETIQA_TIQ_INVEST_SOURCE_PATH)
  const etiqaTiqInvestChecksum = await sha256(ETIQA_TIQ_INVEST_SOURCE_PATH)
  const etiqaInvestWealthPurposeExtracted = await extractPdfText(ETIQA_INVEST_WEALTH_PURPOSE_SOURCE_PATH)
  const etiqaInvestWealthPurposeChecksum = await sha256(ETIQA_INVEST_WEALTH_PURPOSE_SOURCE_PATH)
  const greatEasternGreatInvestAdvantage2RspExtracted = await extractPdfText(GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_2_RSP_SOURCE_PATH)
  const greatEasternGreatInvestAdvantage2RspChecksum = await sha256(GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_2_RSP_SOURCE_PATH)
  const greatEasternGreatInvestAdvantage2SpExtracted = await extractPdfText(GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_2_SP_SOURCE_PATH)
  const greatEasternGreatInvestAdvantage2SpChecksum = await sha256(GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_2_SP_SOURCE_PATH)
  const greatEasternGreatInvestAdvantageRspExtracted = await extractPdfText(GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_RSP_SOURCE_PATH)
  const greatEasternGreatInvestAdvantageRspChecksum = await sha256(GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_RSP_SOURCE_PATH)
  const greatEasternGreatInvestAdvantageSpExtracted = await extractPdfText(GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_SP_SOURCE_PATH)
  const greatEasternGreatInvestAdvantageSpChecksum = await sha256(GREAT_EASTERN_GREAT_INVEST_ADVANTAGE_SP_SOURCE_PATH)
  const greatEasternGreatLifeAdvantage4Extracted = await extractPdfText(GREAT_EASTERN_GREAT_LIFE_ADVANTAGE_4_SOURCE_PATH)
  const greatEasternGreatLifeAdvantage4Checksum = await sha256(GREAT_EASTERN_GREAT_LIFE_ADVANTAGE_4_SOURCE_PATH)
  const greatEasternPrestigeLegacyAdvantageExtracted = await extractPdfText(GREAT_EASTERN_PRESTIGE_LEGACY_ADVANTAGE_SOURCE_PATH)
  const greatEasternPrestigeLegacyAdvantageChecksum = await sha256(GREAT_EASTERN_PRESTIGE_LEGACY_ADVANTAGE_SOURCE_PATH)
  const greatEasternInvestmentLinkedInsurancePlan2Extracted = await extractPdfText(GREAT_EASTERN_INVESTMENT_LINKED_INSURANCE_PLAN_2_SOURCE_PATH)
  const greatEasternInvestmentLinkedInsurancePlan2Checksum = await sha256(GREAT_EASTERN_INVESTMENT_LINKED_INSURANCE_PLAN_2_SOURCE_PATH)
  const greatEasternWealthAdvantage4Extracted = await extractPdfText(GREAT_EASTERN_WEALTH_ADVANTAGE_4_SOURCE_PATH)
  const greatEasternWealthAdvantage4Checksum = await sha256(GREAT_EASTERN_WEALTH_ADVANTAGE_4_SOURCE_PATH)
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
  const hsbcWealthInvestCpfExtracted = await extractPdfText(HSBC_WEALTH_INVEST_CPF_SOURCE_PATH)
  const hsbcWealthInvestCpfChecksum = await sha256(HSBC_WEALTH_INVEST_CPF_SOURCE_PATH)
  const hsbcWealthInvestCashSrsExtracted = await extractPdfText(HSBC_WEALTH_INVEST_CASH_SRS_SOURCE_PATH)
  const hsbcWealthInvestCashSrsChecksum = await sha256(HSBC_WEALTH_INVEST_CASH_SRS_SOURCE_PATH)
  const hsbcVoyageExtracted = await extractPdfText(HSBC_WEALTH_VOYAGE_SOURCE_PATH)
  const hsbcVoyageChecksum = await sha256(HSBC_WEALTH_VOYAGE_SOURCE_PATH)
  const prudentialExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH)
  const prudentialChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_WEALTH_II_SOURCE_PATH)
  const prudentialAssureExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH)
  const prudentialAssureChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_ASSURE_II_SOURCE_PATH)
  const prudentialAssureSpExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_ASSURE_SP_SOURCE_PATH)
  const prudentialAssureSpChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_ASSURE_SP_SOURCE_PATH)
  const prudentialPruActiveLinkGuardExtracted = await extractPdfText(PRUDENTIAL_PRUACTIVE_LINKGUARD_SOURCE_PATH)
  const prudentialPruActiveLinkGuardChecksum = await sha256(PRUDENTIAL_PRUACTIVE_LINKGUARD_SOURCE_PATH)
  const prudentialPrulinkInvestGrowthExtracted = await extractPdfText(PRUDENTIAL_PRULINK_INVESTGROWTH_SOURCE_PATH)
  const prudentialPrulinkInvestGrowthChecksum = await sha256(PRUDENTIAL_PRULINK_INVESTGROWTH_SOURCE_PATH)
  const prudentialPrulinkInvestGrowthSpExtracted = await extractPdfText(PRUDENTIAL_PRULINK_INVESTGROWTH_SP_SOURCE_PATH)
  const prudentialPrulinkInvestGrowthSpChecksum = await sha256(PRUDENTIAL_PRULINK_INVESTGROWTH_SP_SOURCE_PATH)
  const prudentialProsperExtracted = await extractPdfText(PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH)
  const prudentialProsperChecksum = await sha256(PRUDENTIAL_PRUVANTAGE_PROSPER_SOURCE_PATH)
  const tokioMarineWealthEnhancerCpfisExtracted = await extractPdfText(TOKIO_MARINE_WEALTH_ENHANCER_CPFIS_SOURCE_PATH)
  const tokioMarineWealthEnhancerCpfisChecksum = await sha256(TOKIO_MARINE_WEALTH_ENHANCER_CPFIS_SOURCE_PATH)
  const tokioMarineExtracted = await extractPdfText(TOKIO_MARINE_WEALTH_MAX_II_SOURCE_PATH)
  const tokioMarineChecksum = await sha256(TOKIO_MARINE_WEALTH_MAX_II_SOURCE_PATH)
  const tokioMarineWealthProExtracted = await extractPdfText(TOKIO_MARINE_WEALTH_PRO_II_SOURCE_PATH)
  const tokioMarineWealthProChecksum = await sha256(TOKIO_MARINE_WEALTH_PRO_II_SOURCE_PATH)
  const aiaProAchiever3Extracted = await extractPdfText(AIA_PRO_ACHIEVER_3_SOURCE_PATH)
  const aiaProAchiever3Checksum = await sha256(AIA_PRO_ACHIEVER_3_SOURCE_PATH)
  const brochurePartialProducts = await buildBrochurePartialProducts(discovery.brochureOnlySources)

  const products = [
    parseAiaEliteSecureIncome5Pay({
      document: aiaEliteSecureIncome5PayExtracted,
      sourceChecksumSha256: aiaEliteSecureIncome5PayChecksum,
    }),
    parseAiaEliteSecureIncomeSp({
      document: aiaEliteSecureIncomeSpExtracted,
      sourceChecksumSha256: aiaEliteSecureIncomeSpChecksum,
    }),
    parseAiaInvestEasyCashSrs({
      document: aiaInvestEasyCashSrsExtracted,
      sourceChecksumSha256: aiaInvestEasyCashSrsChecksum,
    }),
    parseAiaInvestEasyCpf({
      document: aiaInvestEasyCpfExtracted,
      sourceChecksumSha256: aiaInvestEasyCpfChecksum,
    }),
    parseAiaPlatinumRetirementElite({
      document: aiaPlatinumRetirementEliteExtracted,
      sourceChecksumSha256: aiaPlatinumRetirementEliteChecksum,
    }),
    parseAiaPlatinumWealthElite2({
      document: aiaPlatinumWealthElite2Extracted,
      sourceChecksumSha256: aiaPlatinumWealthElite2Checksum,
    }),
    parseAiaPlatinumWealthLegacy({
      document: aiaPlatinumWealthLegacyExtracted,
      sourceChecksumSha256: aiaPlatinumWealthLegacyChecksum,
    }),
    parseAiaPlatinumWealthVenture2({
      document: aiaPlatinumWealthVenture2Extracted,
      sourceChecksumSha256: aiaPlatinumWealthVenture2Checksum,
    }),
    parseAiaWealthVenture({
      document: aiaWealthVentureExtracted,
      sourceChecksumSha256: aiaWealthVentureChecksum,
    }),
    parseIncomeInvestFlex({
      document: incomeInvestFlexExtracted,
      sourceChecksumSha256: incomeInvestFlexChecksum,
    }),
    parseIncomeAstralinkVa2({
      document: incomeAstralinkVa2Extracted,
      sourceChecksumSha256: incomeAstralinkVa2Checksum,
    }),
    parseIncomeInvestFlexTriVantage({
      document: incomeInvestFlexTriVantageExtracted,
      sourceChecksumSha256: incomeInvestFlexTriVantageChecksum,
    }),
    parseIncomeInvestFlexVantage({
      document: incomeInvestFlexVantageExtracted,
      sourceChecksumSha256: incomeInvestFlexVantageChecksum,
    }),
    parseIncomeLegacyFlexSolitaire({
      document: incomeLegacyFlexSolitaireExtracted,
      sourceChecksumSha256: incomeLegacyFlexSolitaireChecksum,
    }),
    parseIncomeWealthLinkGl3({
      document: incomeWealthLinkGl3Extracted,
      sourceChecksumSha256: incomeWealthLinkGl3Checksum,
    }),
    parseIncomeSnackInvestment({
      document: incomeSnackInvestmentExtracted,
      sourceChecksumSha256: incomeSnackInvestmentChecksum,
    }),
    parseManulifeInvestreadyIii({
      document: manulifeInvestreadyIiiExtracted,
      sourceChecksumSha256: manulifeInvestreadyIiiChecksum,
    }),
    parseManulifeManuinvestDuo({
      document: manulifeManuinvestDuoExtracted,
      sourceChecksumSha256: manulifeManuinvestDuoChecksum,
    }),
    parseManulifeManulinkInvestorIi({
      document: manulifeManulinkInvestorIiExtracted,
      sourceChecksumSha256: manulifeManulinkInvestorIiChecksum,
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
    parseEtiqaDashPetPlus({
      document: etiqaDashPetPlusExtracted,
      sourceChecksumSha256: etiqaDashPetPlusChecksum,
    }),
    parseEtiqaInvestSmartFlexIi({
      document: etiqaInvestSmartFlexIiExtracted,
      sourceChecksumSha256: etiqaInvestSmartFlexIiChecksum,
    }),
    parseEtiqaInvestSmartVista({
      document: etiqaInvestSmartVistaExtracted,
      sourceChecksumSha256: etiqaInvestSmartVistaChecksum,
    }),
    parseEtiqaInvestStarter({
      document: etiqaInvestStarterExtracted,
      sourceChecksumSha256: etiqaInvestStarterChecksum,
    }),
    parseEtiqaInvestPlusSp({
      document: etiqaInvestPlusSpExtracted,
      sourceChecksumSha256: etiqaInvestPlusSpChecksum,
    }),
    parseEtiqaInvestVista({
      document: etiqaInvestVistaExtracted,
      sourceChecksumSha256: etiqaInvestVistaChecksum,
    }),
    parseEtiqaTiqInvest({
      document: etiqaTiqInvestExtracted,
      sourceChecksumSha256: etiqaTiqInvestChecksum,
    }),
    parseEtiqaInvestWealthPurpose({
      document: etiqaInvestWealthPurposeExtracted,
      sourceChecksumSha256: etiqaInvestWealthPurposeChecksum,
    }),
    parseGreatEasternInvestAdvantage2Rsp({
      document: greatEasternGreatInvestAdvantage2RspExtracted,
      sourceChecksumSha256: greatEasternGreatInvestAdvantage2RspChecksum,
    }),
    parseGreatEasternInvestAdvantage2Sp({
      document: greatEasternGreatInvestAdvantage2SpExtracted,
      sourceChecksumSha256: greatEasternGreatInvestAdvantage2SpChecksum,
    }),
    parseGreatEasternInvestAdvantageRsp({
      document: greatEasternGreatInvestAdvantageRspExtracted,
      sourceChecksumSha256: greatEasternGreatInvestAdvantageRspChecksum,
    }),
    parseGreatEasternInvestAdvantageSp({
      document: greatEasternGreatInvestAdvantageSpExtracted,
      sourceChecksumSha256: greatEasternGreatInvestAdvantageSpChecksum,
    }),
    parseGreatEasternGreatLifeAdvantage4({
      document: greatEasternGreatLifeAdvantage4Extracted,
      sourceChecksumSha256: greatEasternGreatLifeAdvantage4Checksum,
    }),
    parseGreatEasternPrestigeLegacyAdvantage({
      document: greatEasternPrestigeLegacyAdvantageExtracted,
      sourceChecksumSha256: greatEasternPrestigeLegacyAdvantageChecksum,
    }),
    parseGreatEasternInvestmentLinkedInsurancePlan2({
      document: greatEasternInvestmentLinkedInsurancePlan2Extracted,
      sourceChecksumSha256: greatEasternInvestmentLinkedInsurancePlan2Checksum,
    }),
    parseGreatEasternWealthAdvantage4({
      document: greatEasternWealthAdvantage4Extracted,
      sourceChecksumSha256: greatEasternWealthAdvantage4Checksum,
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
    parseHsbcWealthInvestCpf({
      document: hsbcWealthInvestCpfExtracted,
      sourceChecksumSha256: hsbcWealthInvestCpfChecksum,
    }),
    parseHsbcWealthInvestCashSrs({
      document: hsbcWealthInvestCashSrsExtracted,
      sourceChecksumSha256: hsbcWealthInvestCashSrsChecksum,
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
    parsePrudentialPruActiveLinkGuard({
      document: prudentialPruActiveLinkGuardExtracted,
      sourceChecksumSha256: prudentialPruActiveLinkGuardChecksum,
    }),
    parsePrudentialPrulinkInvestGrowth({
      document: prudentialPrulinkInvestGrowthExtracted,
      sourceChecksumSha256: prudentialPrulinkInvestGrowthChecksum,
    }),
    parsePrudentialPrulinkInvestGrowthSp({
      document: prudentialPrulinkInvestGrowthSpExtracted,
      sourceChecksumSha256: prudentialPrulinkInvestGrowthSpChecksum,
    }),
    parsePrudentialPruVantageProsper({
      document: prudentialProsperExtracted,
      sourceChecksumSha256: prudentialProsperChecksum,
    }),
    parseTokioMarineWealthEnhancerCpfis({
      document: tokioMarineWealthEnhancerCpfisExtracted,
      sourceChecksumSha256: tokioMarineWealthEnhancerCpfisChecksum,
    }),
    parseTokioMarineWealthMaxIi({
      document: tokioMarineExtracted,
      sourceChecksumSha256: tokioMarineChecksum,
    }),
    parseTokioMarineWealthProIi({
      document: tokioMarineWealthProExtracted,
      sourceChecksumSha256: tokioMarineWealthProChecksum,
    }),
    parseAiaProAchiever3({
      document: aiaProAchiever3Extracted,
      sourceChecksumSha256: aiaProAchiever3Checksum,
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
