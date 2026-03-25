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
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:prulink-investgrowth-sp-single-premium-charge',
      'branch:prulink-investgrowth-sp-premium-assurance-charge',
      'branch:prulink-investgrowth-sp-top-up-charge',
      'branch:prulink-investgrowth-sp-top-up-assurance-charge',
      'kernel:top-up-amount-gate-block',
      'kernel:partial-withdrawal-minimum-remaining-value-block',
      'kernel:current-death-benefit-estimate',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'prulink-investgrowth-sp-e-top-up-charge',
      'prulink-investgrowth-sp-withdrawals',
      'prulink-investgrowth-sp-fund-switching',
    ],
    warnings: [
      'PRULink InvestGrowth (SP) is cataloged as a supported V1 product. The parser captures the published initial single-premium charge, premium-event assurance-charge path for initial and standard top-up premiums, the published S$2,000 one-off top-up minimum, the published S$1,000 one-off withdrawal minimum and residual-account floor, the current-state death benefit as the higher of policy value or 110% of total premiums plus top-ups less withdrawals, and cash-corridor Direct Income support through the manual distribution-mode kernel, while e-top-up treatment, broader withdrawal administration, fund-switching, and cash Direct Income payout history in death-benefit calculations remain outside the current engine.',
    ],
    archived: false,
    variants: [
      buildPrudentialInvestGrowthVariant(context.document, 'single-premium', 'cash'),
      buildPrudentialInvestGrowthVariant(context.document, 'single-premium', 'srs'),
      buildPrudentialInvestGrowthVariant(context.document, 'single-premium', 'cpf'),
    ],
  }
}
