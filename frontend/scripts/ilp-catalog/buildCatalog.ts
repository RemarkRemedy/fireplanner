import { buildCatalogSnapshot, writeCatalogSnapshot } from './catalogSnapshot.js'

async function main() {
  const snapshot = await buildCatalogSnapshot()
  await writeCatalogSnapshot(snapshot)

  console.log(`Wrote catalog manifest with ${snapshot.manifest.productsCount} product(s)`)
  console.log(`Discovered ${snapshot.manifest.summarySourceCount} summary source(s) and ${snapshot.manifest.brochureOnlySourceCount} brochure-only source(s)`)
  console.log(`Eligible brochure-only partial products: ${snapshot.manifest.brochurePartialEligibleCount}`)
}

await main()
