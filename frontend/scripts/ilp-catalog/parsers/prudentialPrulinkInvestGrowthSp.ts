import path from 'node:path'
import type { IlpCatalogProduct } from '../../../src/lib/ilp-catalog/types.js'
import { buildPrudentialInvestGrowthVariant, type ParseContext } from './prudentialInvestGrowthShared.js'

export function parsePrudentialPrulinkInvestGrowthSp(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'prudential-prulink-investgrowth-sp',
    insurer: 'Prudential',
    productName: 'PRULink InvestGrowth (SP)',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'partial',
    structureStatus: 'structured',
    economicsStatus: 'partial-modeled-subset',
    modeledEconomics: [
      'branch:prulink-investgrowth-sp-single-premium-charge',
      'branch:prulink-investgrowth-sp-premium-assurance-charge',
      'branch:prulink-investgrowth-sp-top-up-charge',
      'branch:prulink-investgrowth-sp-top-up-assurance-charge',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'prulink-investgrowth-sp-death-benefit',
      'prulink-investgrowth-sp-single-premium-principal-tracking',
      'prulink-investgrowth-sp-e-top-up-charge',
      'prulink-investgrowth-sp-withdrawals',
      'prulink-investgrowth-sp-fund-switching',
    ],
    warnings: [
      'PRULink InvestGrowth (SP) is cataloged as a partial modeled subset in V1. The parser captures the published premium-charge and premium-event assurance-charge path for initial and standard top-up premiums, plus cash-corridor Direct Income distribution support through the manual distribution-mode kernel, while e-top-up treatment, withdrawals, and single-premium principal tracking remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildPrudentialInvestGrowthVariant(context.document, 'single-premium', 'cash'),
      buildPrudentialInvestGrowthVariant(context.document, 'single-premium', 'srs'),
      buildPrudentialInvestGrowthVariant(context.document, 'single-premium', 'cpf'),
    ],
  }
}
