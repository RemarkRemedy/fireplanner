import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCatalogSnapshot } from '../../../scripts/ilp-catalog/catalogSnapshot'
import { buildGoldenFixtureArtifact, type GoldenFixtureArtifact } from './ilpGoldenHarness'
import { buildGoldenIlpFixtureInputs } from './ilpGoldenFixtures'

const FIXTURE_DIR = path.resolve(import.meta.dirname, '__fixtures__/ilp-golden')

describe('ILP golden fixtures', () => {
  it('matches locked golden outputs for every declared fixture', async () => {
    const snapshot = await buildCatalogSnapshot()
    const fixtureInputs = buildGoldenIlpFixtureInputs(snapshot)

    expect(fixtureInputs.length).toBeGreaterThan(0)

    for (const { fileName, ...fixture } of fixtureInputs) {
      const fixturePath = path.join(FIXTURE_DIR, fileName)
      expect(existsSync(fixturePath), `${fixture.id} fixture file should exist`).toBe(true)

      const expected = JSON.parse(readFileSync(fixturePath, 'utf8')) as GoldenFixtureArtifact
      const actual = buildGoldenFixtureArtifact({ fileName, ...fixture }, snapshot)

      expect(actual).toStrictEqual(expected)
    }
  }, 120_000)
})
