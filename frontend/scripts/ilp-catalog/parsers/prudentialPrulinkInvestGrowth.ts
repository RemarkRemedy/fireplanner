import path from 'node:path'
import type { IlpCatalogProduct } from '../../../src/lib/ilp-catalog/types.js'
import { buildPrudentialInvestGrowthVariant, type ParseContext } from './prudentialInvestGrowthShared.js'

export function parsePrudentialPrulinkInvestGrowth(context: ParseContext): IlpCatalogProduct {
  return {
    id: 'prudential-prulink-investgrowth',
    insurer: 'Prudential',
    productName: 'PRULink InvestGrowth',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:prulink-investgrowth-recurring-premium-charge',
      'branch:prulink-investgrowth-premium-assurance-charge',
      'branch:prulink-investgrowth-top-up-charge',
      'branch:prulink-investgrowth-top-up-assurance-charge',
    ],
    metadataOnlyBehaviors: [
      'prulink-investgrowth-death-benefit',
      'prulink-investgrowth-e-top-up-charge',
      'prulink-investgrowth-withdrawals',
      'prulink-investgrowth-fund-switching',
      'prulink-investgrowth-minimum-premium-schedule',
    ],
    warnings: [
      'PRULink InvestGrowth is cataloged as a supported V1 product. The parser captures the published recurring-premium charge and premium-event assurance-charge path for standard premiums and standard top-ups, while e-top-up treatment, withdrawals, fund switching, and minimum-premium schedule enforcement remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildPrudentialInvestGrowthVariant(context.document, 'recurrent-single-premium', 'cash'),
      buildPrudentialInvestGrowthVariant(context.document, 'recurrent-single-premium', 'srs'),
      buildPrudentialInvestGrowthVariant(context.document, 'recurrent-single-premium', 'cpf'),
    ],
  }
}
