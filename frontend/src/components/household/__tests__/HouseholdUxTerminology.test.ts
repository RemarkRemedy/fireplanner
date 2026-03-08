/**
 * Regression test: enforce household UX terminology rules.
 *
 * Scans UI-facing source files (components, pages) for forbidden raw labels
 * that should have been replaced during the household UX remediation (PR-12+).
 *
 * This test reads source files as text — it does NOT render components.
 * That makes it fast, deterministic, and immune to store setup issues.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const SRC_ROOT = join(__dirname, '..', '..', '..')

/** Recursively collect .tsx files from a directory. */
function collectTsxFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '__tests__' || entry === '__snapshots__') continue
    if (statSync(full).isDirectory()) {
      files.push(...collectTsxFiles(full))
    } else if (extname(full) === '.tsx') {
      files.push(full)
    }
  }
  return files
}

/**
 * Forbidden patterns and why they're banned.
 * Each pattern is a regex that should NOT appear in user-facing JSX strings.
 * We use word boundaries and context to avoid false positives in code identifiers.
 */
const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string; allowlist?: RegExp[] }[] = [
  {
    // Raw "Self" as a standalone label in JSX (not inside identifiers or type literals)
    pattern: /['"`]Self['"`]/,
    reason: 'Use ownerLabel(owner, adults) instead of raw "Self"',
    // Allow type literals and object keys
    allowlist: [
      /owner\s*===?\s*['"]self['"]/,
      /['"]self['"]\s*[?:]/,
      /AdultOwner/,
      /ROLE_LABELS/,
    ],
  },
  {
    pattern: /Timing [Aa]nchor/,
    reason: 'Renamed to "Age based on" per UX spec',
  },
  {
    pattern: /Reference adult/,
    reason: 'Not user-facing — use "Age timeline follows" or omit',
  },
  {
    pattern: /Primary adult/i,
    reason: 'Use "first adult" or dynamic name instead',
    // Allow in admin/dev contexts
    allowlist: [/\/\//], // Allow in comments
  },
  {
    // "Editing CPF for" was renamed to "Editing adult"
    pattern: /Editing CPF for/,
    reason: 'Renamed to "Editing adult" per UX spec',
  },
]

describe('Household UX terminology', () => {
  const uiDirs = [
    join(SRC_ROOT, 'components'),
    join(SRC_ROOT, 'pages'),
  ]

  const files = uiDirs.flatMap((dir) => collectTsxFiles(dir))

  it('scans a meaningful number of UI files', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  for (const { pattern, reason, allowlist } of FORBIDDEN_PATTERNS) {
    it(`no UI file contains forbidden term: ${pattern.source}`, () => {
      const violations: string[] = []

      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (!pattern.test(line)) continue

          // Check if line matches any allowlist pattern
          const isAllowed = allowlist?.some((allow) => allow.test(line))
          if (isAllowed) continue

          const relativePath = file.replace(SRC_ROOT + '/', '')
          violations.push(`${relativePath}:${i + 1}: ${line.trim()}`)
        }
      }

      expect(
        violations,
        `Forbidden term "${pattern.source}" found (${reason}):\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  }
})
