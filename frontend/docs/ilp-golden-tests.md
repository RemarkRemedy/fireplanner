# ILP Golden Tests

Last updated: 2026-03-13

## Purpose

The ILP golden harness is the release gate for catalog products that are publicly labeled `supported`.

It is intentionally stricter than slice-level unit tests. The gate proves that:
- parser source can build the current catalog snapshot in-process
- generated catalog JSON matches that fresh parser snapshot
- supported products have complete declared golden coverage
- curated seeded scenarios still produce the same normalized economics outputs

This is the release contract for supported products. No further major ILP kernel slices should bypass it.

## Support Semantics

The catalog now distinguishes three separate surfaces:
- `structureStatus`
  what the parser could extract from the source document
- `economicsStatus`
  what the calculator claims to simulate economically
- `metadataOnlyBehaviors`
  known product behavior that is preserved as warnings/metadata but is not part of the supported economic simulation

Public `supportStatus: "supported"` is only allowed when all of the following are true:
- `structureStatus === "structured"`
- `economicsStatus === "supported"`
- every public variant has required golden coverage
- the fixture set covers every declared `modeledEconomics` branch tag
- supported fixtures contain no unresolved required modeled inputs

If any of those conditions fail, the product must be downgraded to `partial`.

## Source Of Truth

Committed fixture JSON is not the truth by itself.

The truth path is:
1. parser source builds a fresh in-process catalog snapshot
2. generated catalog JSON is compared against that fresh snapshot
3. seeded golden artifacts are rebuilt from that fresh snapshot
4. any artifact diff is reviewed as a real economics change

This prevents parser changes from staying green just because committed generated JSON was stale.

## Current Coverage Shape

The current supported golden matrix covers:
- HSBC Life Wealth Accelerate
  baseline variants for all public currency/MIP variants
  event-heavy scenario
  holiday-no-repayment edge case
  higher-OCF stress scenario
- PRUVantage Wealth II
  baseline variants for all public MIP variants
  event-heavy scenario
  holiday-fallback branch-forcing scenario
  higher-OCF stress scenario with a different routing split

Coverage tags are explicit in [ilpGoldenFixtures.ts](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilpGoldenFixtures.ts) and enforced by the meta gate.

## Locked Surface

Each artifact locks:
- normalized seeded policy input
- normalized low/mid/high yearly projections
- normalized summary metrics
- normalized NPV analysis
- normalized opportunity cost
- coverage metadata:
  - catalog version
  - source file name
  - source checksum
  - support status
  - scenario id
  - coverage tags

Strict equality is used for parity checks.

Normalization is deterministic and intentionally limited:
- currency-like numbers are rounded for stable comparison
- rate-like numbers are rounded for stable comparison
- transient metadata such as manifest `generatedAt` is excluded from strict source parity because it is expected to change on every rebuild

## Commands

Use Node 20 from repo-managed tooling:
- [.nvmrc](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/.nvmrc)
- [package.json](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/package.json)

Source parity gate:

```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend
npm run golden:check:source
```

Economics parity gate:

```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend
npm run golden:check:economics
```

Full gate:

```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend
npm run golden:check
```

Intentional refresh:

```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend
npm run golden:refresh
```

## Guardrails

- Do not refresh artifacts casually.
- Any fixture diff is an economics review, not a formatting change.
- Supported products may not rely on unresolved manual modeled inputs.
- Branch-forcing scenarios must assert that the intended branch actually fired.
- Orphaned fixture files and duplicate fixture ids are test failures.
- Refresh must be idempotent for the same parser snapshot.

## File Layout

- Source parity builder:
  - [catalogSnapshot.ts](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/scripts/ilp-catalog/catalogSnapshot.ts)
- Refresh script:
  - [generateFixtures.ts](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/scripts/ilp-golden/generateFixtures.ts)
- Fixture scenarios:
  - [ilpGoldenFixtures.ts](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilpGoldenFixtures.ts)
- Artifact builder and coverage/integrity checks:
  - [ilpGoldenHarness.ts](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilpGoldenHarness.ts)
- Economics parity test:
  - [ilp.golden.test.ts](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.golden.test.ts)
- Source/meta gate:
  - [ilp.golden.meta.test.ts](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.golden.meta.test.ts)
- Locked artifacts:
  - [/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/__fixtures__/ilp-golden](/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/__fixtures__/ilp-golden)

## Remaining Limits

Passing this gate does not mean every document fact is economically modeled.

It only means the product is supported within the explicitly declared modeled-economics boundary. Anything kept in `metadataOnlyBehaviors` still requires user review and must not be treated as covered by the golden gate.
