# PRUVantage Assure (SP) Parser Implementation Plan

> **Execution target:** `/Users/tj/TJDevelopment/fireplanner-ilp` on branch `codex/ilp-lane`

## Goal

Add `prudential-pruvantage-assure-sp` to the ILP catalog using the current branch architecture and current support contract.

Primary target:
- land the product as `supported`
- expand the catalog from `9` to `10` products
- expand `supportedCount` from `6` to `7`

Fallback target:
- if the assurance-charge path cannot be mapped to a modeled formula/table without unsupported guesswork, land the parser as `partial` and stop there
- do **not** mark the product `supported` while demoting assurance charges to metadata-only

## Current-Branch Contract

This plan must follow the current ILP branch, not the older parser-only catalog shape.

### Parser registration
- Register the parser in `frontend/scripts/ilp-catalog/catalogSnapshot.ts`
- `frontend/scripts/ilp-catalog/buildCatalog.ts` is only the JSON writer wrapper

### Product shape
Every parsed product must satisfy the current `IlpCatalogProduct` contract in:
- `frontend/src/lib/ilp-catalog/types.ts`
- `frontend/src/lib/ilp-catalog/schema.ts`

That means the parser output must include:
- `supportStatus`
- `structureStatus`
- `economicsStatus`
- `modeledEconomics`
- `metadataOnlyBehaviors`
- `warnings`
- `variants[*].feeRules`
- `variants[*].eventChargeRules`

### Supported-product gate
If the product lands as `supported`, this plan must also complete:
- supported-grade fixture coverage in `frontend/src/lib/calculations/ilpGoldenFixtures.ts`
- generated fixture refresh
- `golden:refresh`
- `golden:check`
- catalog + template + page tests

The golden meta gate in the current branch requires at minimum:
- all supported variants covered
- required coverage tags satisfied
- no unsupported fixture targets
- no missing supported variant coverage
- no duplicate fixture ids
- no orphaned fixture files

## Product Analysis

Source PDF:
- `PRUVantage Assure (SP) Product Summary.pdf`

### Structural model
Accounts:
- `iia` = Initial Investment Account
- `aia` = Additional Investment Account

This is a Prudential multi-account structure and should follow the same family conventions already used by:
- `prudential-pruvantage-wealth-ii`
- `prudential-pruvantage-prosper`
- `prudential-pruvantage-assure-ii`

### Mechanics that are in scope in the current branch
The following are already modelable in the current ILP branch and should **not** be demoted to unsupported metadata:
- administration charge via `feeRules`
- top-up premium charge via `eventChargeRules`
- first free withdrawal behavior via existing event-charge / free-withdrawal semantics if the source text is precise enough
- assurance charges, if they can be mapped to an existing Prudential assurance formula/table or added as a new source-backed assurance formula/table

### Mechanics that may remain metadata-only
These can remain metadata-only only if they are outside the current bounded modeled economics:
- Wealth Assure Value / protection-only features
- protection payout mechanics unrelated to accumulation fee drag
- periodic loyalty bonus if it still requires unsupported periodic-bonus semantics

### Assurance-charge decision
This plan must resolve the assurance path explicitly.

Allowed outcomes:
1. **Reuse an existing Prudential assurance formula/table** only if the product summary / appendix aligns with one of the currently modeled formulas:
   - `prudential-prosper-death`
   - `prudential-prosper-accidental-death`
   - `prudential-assure-ii-combined`
2. **Add a new assurance formula/table** in the current runtime if the source is precise enough and the delta is bounded.
3. **Downgrade to `partial`** if neither of the above is possible without guesswork.

Disallowed outcome:
- returning `supportStatus: 'supported'` while treating assurance charge as unsupported metadata

## File Areas

### Required
- Create: `frontend/scripts/ilp-catalog/parsers/pruVantageAssureSp.ts`
- Create: `frontend/scripts/ilp-catalog/parsers/pruVantageAssureSp.test.ts`
- Modify: `frontend/scripts/ilp-catalog/catalogSnapshot.ts`
- Modify: `frontend/src/lib/calculations/ilpGoldenFixtures.ts`
- Modify: `frontend/src/lib/ilp-catalog/templateToPolicy.test.ts`
- Modify: `frontend/src/pages/IlpReviewPage.test.tsx`
- Refresh: `frontend/src/lib/data/generated/*`

### Conditional if new assurance formula/table is required
- Modify: `frontend/src/lib/data/ilpAssuranceTables.ts`
- Modify: `frontend/src/lib/data/ilpAssuranceTables.test.ts`
- Modify: `frontend/src/lib/ilp-catalog/types.ts`
- Modify: `frontend/src/lib/ilp-catalog/schema.ts`
- Modify: `frontend/src/lib/validation/ilpSchema.ts`
- Modify: `frontend/src/lib/calculations/ilp.ts`

## Implementation Tasks

### Task 1: Build the parser against the current catalog contract
- Parse the product summary into one catalog product with one variant
- Return the full current product shape, including:
  - `structureStatus`
  - `economicsStatus`
  - `modeledEconomics`
  - `metadataOnlyBehaviors`
  - `eventChargeRules`
- Do not use stale snippets that omit those fields

Expected direction:
- `supportStatus: 'supported'` only if the assurance path is resolved and supported-grade coverage is added
- otherwise `supportStatus: 'partial'`

### Task 2: Resolve the assurance-charge path first
Before promoting the product to `supported`, determine which of these is true:
- it matches an existing Prudential assurance formula/table already in the branch
- it needs a new bounded Prudential assurance formula/table addition
- it cannot be modeled safely enough and must remain `partial`

If a new formula/table is required:
- add it in the same plan execution
- add table tests
- wire it through current runtime/schema/catalog paths

### Task 3: Register in `catalogSnapshot.ts`
- Add the source PDF constant in `frontend/scripts/ilp-catalog/catalogSnapshot.ts`
- Extract the PDF there
- compute checksum there
- add `parsePruVantageAssureSp(...)` to the `products` array there
- do **not** treat `buildCatalog.ts` as the parser registry target

### Task 4: Add supported-grade fixtures if the product is promoted
If `supported`:
- add baseline fixture(s)
- add event-heavy fixture(s)
- add OCF-stress fixture(s)
- ensure the single variant has full required coverage tags
- refresh generated golden artifacts

If `partial`:
- do not try to satisfy the supported-product golden meta gate for this product
- add only the coverage appropriate for partial/manual seed confidence if needed

### Task 5: Add tests beyond the parser unit test
Required tests for the current branch:
- parser unit test in `scripts/ilp-catalog/parsers/pruVantageAssureSp.test.ts`
- template mapping assertions in `frontend/src/lib/ilp-catalog/templateToPolicy.test.ts`
- page/picker seed assertions in `frontend/src/pages/IlpReviewPage.test.tsx`
- assurance-table test coverage if a new formula/table is added

## Modeling Notes

### In-scope modeled subset for a `supported` landing
At minimum, a `supported` landing must include modeled handling for:
- multi-account routing shape
- administration charge
- top-up premium charge
- assurance charge
- exit / withdrawal charge schedule
- any free-withdrawal rule that is already representable by the current event-charge model and is stated precisely enough in the source

### Likely metadata-only / unsupported items
Unless the current branch can represent them precisely without extension:
- periodic loyalty bonus that recurs every N years
- protection-only payout mechanics
- product options not affecting the bounded accumulation / fee-drag path

## Verification

Required verification:
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run scripts/ilp-catalog/parsers/pruVantageAssureSp.test.ts`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run catalog:build`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run golden:refresh`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run golden:check`

Expected post-build manifest if product lands as supported:
- `productsCount: 10`
- `supportedCount: 7`

Expected post-build manifest if product lands as partial:
- `productsCount: 10`
- `supportedCount: 6`
- `partialCount: 4`

## Acceptance Criteria

The plan is complete only when all of the following are true:
- parser is registered through `catalogSnapshot.ts`
- product shape matches the current catalog schema exactly
- assurance-charge path is explicitly resolved, not hand-waved
- supported-grade golden coverage is added if and only if the product is promoted to `supported`
- generated catalog files are refreshed
- manifest counts match the actual landing state
- no stale references remain to the older `buildCatalog.ts` registry flow or the older 2-supported-product era
