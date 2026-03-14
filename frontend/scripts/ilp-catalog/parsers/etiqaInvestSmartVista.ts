import type { IlpCatalogProduct } from '../../../src/lib/ilp-catalog/types.js'
import { parseEtiqaInvestSmartFlexIi } from './etiqaInvestSmartFlexIi.js'

interface ParseContext {
  document: Parameters<typeof parseEtiqaInvestSmartFlexIi>[0]['document']
  sourceChecksumSha256: string
}

function replaceSmartVistaId(value: string): string {
  return value.replace(/smart-flex-ii/g, 'smart-vista')
}

function replaceSmartVistaName(value: string): string {
  return value.replace(/Invest smart flex II/g, 'Invest Smart Vista')
}

export function parseEtiqaInvestSmartVista(context: ParseContext): IlpCatalogProduct {
  const baseProduct = parseEtiqaInvestSmartFlexIi(context)

  return {
    ...baseProduct,
    id: 'etiqa-invest-smart-vista',
    productName: 'Invest Smart Vista',
    modeledEconomics: baseProduct.modeledEconomics.map(replaceSmartVistaId),
    metadataOnlyBehaviors: [
      ...baseProduct.metadataOnlyBehaviors.map(replaceSmartVistaId),
      'etiqa-smart-vista-shariah-fund-availability',
    ],
    warnings: [
      ...baseProduct.warnings.map(replaceSmartVistaName),
      'Only Shariah-compliant ILP Sub-Funds are available for subscription, switching, premium redirection, and redemptions under this policy.',
    ],
  }
}
