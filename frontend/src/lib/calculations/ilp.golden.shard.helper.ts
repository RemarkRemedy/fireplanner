import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCatalogSnapshot, type IlpCatalogSnapshot } from '../../../scripts/ilp-catalog/catalogSnapshot'
import { buildGoldenFixtureArtifact, type GoldenFixtureArtifact } from './ilpGoldenHarness'
import { buildGoldenIlpFixtureInputs, type GoldenIlpFixtureInput } from './ilpGoldenFixtures'

const FIXTURE_DIR = path.resolve(import.meta.dirname, '__fixtures__/ilp-golden')

export const TOTAL_GOLDEN_FIXTURE_SHARDS = 4

type GoldenFixtureCase = ReturnType<typeof buildGoldenIlpFixtureInputs>[number]

function getGoldenFixtureShard(
  fixtures: readonly GoldenFixtureCase[],
  shardIndex: number,
  shardCount: number,
): GoldenFixtureCase[] {
  const sortedFixtures = [...fixtures].sort((left, right) => left.id.localeCompare(right.id))
  return sortedFixtures.filter((_, index) => index % shardCount === shardIndex)
}

interface GoldenShardContext {
  snapshot: IlpCatalogSnapshot
  fixturesByFileName: Map<string, GoldenIlpFixtureInput>
}

let goldenShardContextPromise: Promise<GoldenShardContext> | null = null

function getGoldenShardContext(): Promise<GoldenShardContext> {
  goldenShardContextPromise ??= (async () => {
    const snapshot = await buildCatalogSnapshot()
    const fixtures = buildGoldenIlpFixtureInputs(snapshot)

    return {
      snapshot,
      fixturesByFileName: new Map(fixtures.map((fixture) => [fixture.fileName, fixture])),
    }
  })()

  return goldenShardContextPromise
}

function getShardFixtureFileNames(shardNumber: number): string[] {
  const fileNames = readdirSync(FIXTURE_DIR)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
  return getGoldenFixtureShard(
    fileNames.map((fileName) => ({ id: fileName, fileName }) as GoldenFixtureCase),
    shardNumber - 1,
    TOTAL_GOLDEN_FIXTURE_SHARDS,
  ).map((fixture) => fixture.fileName)
}

export function registerGoldenFixtureShardTests(shardNumber: number): void {
  if (!Number.isInteger(shardNumber) || shardNumber < 1 || shardNumber > TOTAL_GOLDEN_FIXTURE_SHARDS) {
    throw new Error(`Invalid golden fixture shard number: ${shardNumber}`)
  }

  const shardFileNames = getShardFixtureFileNames(shardNumber)

  describe(`ILP golden fixtures (shard ${shardNumber}/${TOTAL_GOLDEN_FIXTURE_SHARDS})`, () => {
    let shardFixtures: GoldenIlpFixtureInput[] = []
    let snapshot: IlpCatalogSnapshot

    beforeAll(async () => {
      const context = await getGoldenShardContext()
      snapshot = context.snapshot
      shardFixtures = getGoldenFixtureShard(
        Array.from(context.fixturesByFileName.values()),
        shardNumber - 1,
        TOTAL_GOLDEN_FIXTURE_SHARDS,
      )
    }, 300_000)

    it('contains assigned fixtures', () => {
      expect(shardFileNames.length).toBeGreaterThan(0)
    })

    it('matches assigned fixture files to generated inputs', () => {
      expect(shardFixtures.map((fixture) => fixture.fileName).sort()).toStrictEqual(shardFileNames)
    })

    for (const fileName of shardFileNames) {
      it(`matches locked golden output for ${fileName}`, () => {
        const fixturePath = path.join(FIXTURE_DIR, fileName)
        expect(existsSync(fixturePath), `${fileName} fixture file should exist`).toBe(true)

        const fixture = shardFixtures.find((entry) => entry.fileName === fileName)
        expect(fixture, `${fileName} should have a generated fixture input`).toBeDefined()
        const expected = JSON.parse(readFileSync(fixturePath, 'utf8')) as GoldenFixtureArtifact
        const actual = buildGoldenFixtureArtifact(fixture!, snapshot)

        expect(actual).toStrictEqual(expected)
      }, 120_000)
    }
  })
}
