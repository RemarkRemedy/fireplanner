import { beforeAll, describe, expect, it } from 'vitest'
import manifestJson from '@/lib/data/generated/ilpCatalog.manifest.json'
import productsJson from '@/lib/data/generated/ilpCatalog.products.json'
import { buildCatalogSnapshot } from '../../../scripts/ilp-catalog/catalogSnapshot'
import {
  buildGoldenFixtureArtifact,
  collectGoldenIntegrityFailures,
  collectGoldenCoverageReport,
  type GoldenFixtureArtifact,
} from './ilpGoldenHarness'
import { buildGoldenIlpFixtureInputs } from './ilpGoldenFixtures'

describe('ILP golden harness meta gate', () => {
  let snapshot: Awaited<ReturnType<typeof buildCatalogSnapshot>>
  let fixtures: ReturnType<typeof buildGoldenIlpFixtureInputs>
  let artifacts: GoldenFixtureArtifact[]

  beforeAll(async () => {
    snapshot = await buildCatalogSnapshot()
    fixtures = buildGoldenIlpFixtureInputs(snapshot)
    artifacts = fixtures.map((fixture) => buildGoldenFixtureArtifact(fixture, snapshot))
  }, 30_000)

  it('keeps generated catalog JSON in sync with parser sources', async () => {
    const { generatedAt: expectedGeneratedAt, ...expectedManifest } = manifestJson
    const { generatedAt: actualGeneratedAt, ...actualManifest } = snapshot.manifest

    expect(typeof expectedGeneratedAt).toBe('string')
    expect(typeof actualGeneratedAt).toBe('string')
    expect(actualManifest).toStrictEqual(expectedManifest)
    expect(snapshot.products).toStrictEqual(productsJson)
  })

  it('enforces full golden coverage for every supported product variant', () => {
    const report = collectGoldenCoverageReport(snapshot, fixtures)

    expect(report.missingSupportedVariantCoverage).toStrictEqual([])
    expect(report.unsupportedFixtureTargets).toStrictEqual([])
    expect(report.missingFixtureTargets).toStrictEqual([])
    expect(report.missingRequiredProductCoverageTags).toStrictEqual([])
  })

  it('requires explicit support semantics for supported products', () => {
    const supportedProducts = snapshot.products.filter((product) => product.supportStatus === 'supported')

    expect(supportedProducts.length).toBeGreaterThan(0)
    for (const product of supportedProducts) {
      expect(product.structureStatus).toBe('structured')
      expect(product.economicsStatus).toBe('supported')
      expect(product.modeledEconomics.length).toBeGreaterThan(0)
      expect(Array.isArray(product.metadataOnlyBehaviors)).toBe(true)
    }
  })

  it('rejects orphaned fixture files and duplicate fixture ids', () => {
    const report = collectGoldenCoverageReport(snapshot, fixtures)

    expect(report.duplicateFixtureIds).toStrictEqual([])
    expect(report.orphanedFixtureFiles).toStrictEqual([])
    expect(fixtures.length).toBeGreaterThan(0)
  })

  it('locks opportunity-cost output in the golden artifact', () => {
    const [artifact] = artifacts

    expect(artifact.expected.opportunityCost).toBeDefined()
  }, 20_000)

  it('writes strict golden artifacts without unresolved manual inputs for supported fixtures', () => {
    const supportedFixture = fixtures.find((fixture) => fixture.fixtureClass === 'supported')

    expect(supportedFixture).toBeDefined()
    expect(() => buildGoldenFixtureArtifact(supportedFixture!, snapshot)).not.toThrow()
  })

  it('refresh is idempotent for the same parser snapshot', () => {
    const firstPass = fixtures.map((fixture) => buildGoldenFixtureArtifact(fixture, snapshot))
    const secondPass = fixtures.map((fixture) => buildGoldenFixtureArtifact(fixture, snapshot))

    expect(secondPass).toStrictEqual(firstPass)
  }, 20_000)

  it('fires the intended branch-integrity assertions for curated scenarios', () => {
    expect(collectGoldenIntegrityFailures(fixtures, artifacts)).toStrictEqual([])
  })

  it('uses strict artifact equality semantics', () => {
    const [artifact] = artifacts
    const clone = structuredClone(artifact) as GoldenFixtureArtifact

    delete (clone.policyInput as { catalogWarnings?: string[] }).catalogWarnings
    ;(artifact.policyInput as { catalogWarnings?: string[] }).catalogWarnings = undefined

    expect(clone).not.toStrictEqual(artifact)
  })
})
