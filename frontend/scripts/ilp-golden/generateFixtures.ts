import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildCatalogSnapshot, writeCatalogSnapshot } from '../ilp-catalog/catalogSnapshot.js'
import { buildGoldenFixtureArtifact, collectGoldenCoverageReport } from '../../src/lib/calculations/ilpGoldenHarness.js'
import { buildGoldenIlpFixtureInputs } from '../../src/lib/calculations/ilpGoldenFixtures.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const OUTPUT_DIR = path.join(ROOT_DIR, 'src/lib/calculations/__fixtures__/ilp-golden')

async function main() {
  const snapshot = await buildCatalogSnapshot()
  await writeCatalogSnapshot(snapshot)
  const fixtures = buildGoldenIlpFixtureInputs(snapshot)
  const coverage = collectGoldenCoverageReport(snapshot, fixtures)

  if (
    coverage.missingSupportedVariantCoverage.length > 0
    || coverage.unsupportedFixtureTargets.length > 0
    || coverage.missingFixtureTargets.length > 0
    || coverage.duplicateFixtureIds.length > 0
  ) {
    throw new Error(`Cannot refresh ILP golden fixtures with coverage gaps: ${JSON.stringify(coverage, null, 2)}`)
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  const expectedFiles = new Set<string>(fixtures.map((fixture) => fixture.fileName))
  const existingFiles = await readdir(OUTPUT_DIR)

  for (const fileName of existingFiles) {
    if (fileName.endsWith('.json') && !expectedFiles.has(fileName)) {
      await unlink(path.join(OUTPUT_DIR, fileName))
      console.log(`Removed orphaned ${path.join(OUTPUT_DIR, fileName)}`)
    }
  }

  for (const fixture of fixtures) {
    const artifact = buildGoldenFixtureArtifact(fixture, snapshot)
    const outputPath = path.join(OUTPUT_DIR, fixture.fileName)
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${outputPath}`)
  }
}

await main()
