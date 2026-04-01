import manifestJson from '@/lib/data/generated/ilpCatalog.manifest.json'
import productsJson from '@/lib/data/generated/ilpCatalog.products.json'
import { ilpCatalogManifestSchema, ilpCatalogProductsSchema } from '@/lib/ilp-catalog/schema'
import type { IlpCatalogResolvedProduct } from '@/lib/ilp-catalog/types'

const CATALOG_MANIFEST = ilpCatalogManifestSchema.parse(manifestJson)
const CATALOG_PRODUCTS = ilpCatalogProductsSchema.parse(productsJson).map((product) => ({
  ...product,
  publishedUnmodeledCorridors: product.publishedUnmodeledCorridors ?? [],
})) satisfies IlpCatalogResolvedProduct[]

export function getIlpCatalog() {
  return {
    manifest: CATALOG_MANIFEST,
    products: CATALOG_PRODUCTS,
  }
}
