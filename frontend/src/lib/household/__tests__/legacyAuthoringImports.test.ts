/// <reference types="node" />

import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = path.resolve(TEST_DIR, '../../../../')
const SRC_ROOT = path.resolve(FRONTEND_ROOT, 'src')
const ALLOWED_IMPORTERS = [
  path.resolve(FRONTEND_ROOT, 'src/lib/household/fromLegacyIndividual.ts'),
  path.resolve(FRONTEND_ROOT, 'src/lib/storeRegistry.ts'),
  // StartPage imports DEFAULT_PROFILE constant (not a store subscription) for
  // canonical default values used in the onboarding calculator.
  path.resolve(FRONTEND_ROOT, 'src/pages/StartPage.tsx'),
].sort()
const LEGACY_STORE_IMPORT_PATTERN = /from\s+['"][^'"]*use(Profile|Income|Property)Store['"]/m

function collectLegacyAuthoringImporters(root: string): string[] {
  const matches: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === '__mocks__') continue
        walk(fullPath)
        continue
      }

      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue

      const text = readFileSync(fullPath, 'utf8')
      if (LEGACY_STORE_IMPORT_PATTERN.test(text)) {
        matches.push(fullPath)
      }
    }
  }

  walk(root)
  return matches.sort()
}

describe('legacy authoring runtime imports', () => {
  it('limits runtime legacy-store imports to migration and portability helpers', () => {
    expect(collectLegacyAuthoringImporters(SRC_ROOT)).toEqual(ALLOWED_IMPORTERS)
  })
})
