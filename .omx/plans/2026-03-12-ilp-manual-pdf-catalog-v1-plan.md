# ILP Manual PDF Catalog V1 Plan

## Status

This plan supersedes the automated CompareFIRST-ingestion approach for V1.

V1 source strategy:
- You provide a local corpus of generic ILP product-summary PDFs.
- We parse those local files offline in Node.
- We generate a versioned local product catalog consumed by `/ilp-review`.
- We defer any automated acquisition/sync strategy until legal and operational constraints are resolved.

## Requirements Summary

Build a release-ready ILP product catalog for `/ilp-review` using a manually supplied local PDF corpus.

The product must:
- let users search by insurer/product name instead of uploading PDFs
- derive generic ILP product defaults from locally stored product-summary PDFs
- keep generic product mechanics separate from personal policy fields
- expose support status and warnings for partially modeled products
- ship with deterministic parsing, golden tests, and release-grade validation
- avoid any runtime or CI scraping of CompareFIRST or other external registries

## Why This Direction

The previous registry-ingestion direction is blocked for V1 by:
- unresolved Terms of Use restrictions on automated reproduction/distribution
- uncertainty around CI access and source stability
- the need to establish parser viability on real PDFs before building automation

A manual corpus removes those blockers while preserving the core product experience:
- search by product name
- select variant
- fill only personal policy fields

## Product Goals

1. User does not need to find or upload a PDF.
2. Generic product templates are generated from a vetted local PDF corpus.
3. Personal fields remain explicitly user-entered.
4. Parsing remains deterministic, testable, and reviewable.
5. V1 is releasable without relying on external site automation.

## Non-Goals

- Automated crawling/sync from CompareFIRST or any other registry
- Personalized policy extraction
- OCR support in V1
- Support for image-only/scanned PDFs in V1

## Hard Constraints

1. All parser and PDF extraction code must live in Node-only script paths, not `frontend/src`.
2. The frontend catalog is read-only generated data; do not add a dedicated Zustand store for it.
3. UI work starts only after at least one real PDF has been fully normalized into a proven template shape.
4. Image-based PDFs must fail visibly with `parser-error`; no empty catalog entries.

## Architecture

### High-Level Flow

1. Local PDFs are placed into a versioned source directory in the repo or a local ignored workspace path.
2. A Node-based generation pipeline parses those PDFs into canonical `IlpProductTemplate` objects.
3. The pipeline writes generated JSON artifacts into the frontend data layer.
4. `/ilp-review` loads the generated catalog via module import + validation hook.
5. User searches product name, selects a variant, enters personal fields, and creates an ILP draft.

### Source Layout

Node-only pipeline code:
- `frontend/scripts/ilp-catalog/parserRegistry.ts`
- `frontend/scripts/ilp-catalog/pdf/*`
- `frontend/scripts/ilp-catalog/parsers/*`
- `frontend/scripts/ilp-catalog/common/*`
- `frontend/scripts/ilp-catalog/buildCatalog.ts`

Frontend runtime code:
- `frontend/src/lib/ilp-catalog/types.ts`
- `frontend/src/lib/ilp-catalog/schema.ts`
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts`
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts`
- `frontend/src/lib/ilp-catalog/getIlpCatalog.ts`
- `frontend/src/components/ilp/catalog/*`

Generated data:
- `frontend/src/lib/data/generated/ilpCatalog.manifest.json`
- `frontend/src/lib/data/generated/ilpCatalog.products.json`

Bootstrap requirement:
- commit valid empty seed files for both generated JSON artifacts so fresh clones still build before the catalog pipeline has been run

### Why This Layout

This prevents Node-only parser code and heavy PDF dependencies from leaking into the Vite client bundle.

## Data Model

### Core Types

Add:
- `frontend/src/lib/ilp-catalog/types.ts`
- `frontend/src/lib/ilp-catalog/schema.ts`

Types:
- `IlpCatalogManifest`
  - `catalogVersion`
  - `generatedAt`
  - `parserVersion`
  - `sourceStrategy: 'manual-pdf-corpus'`
  - `productsCount`
  - `supportedCount`
  - `partialCount`
  - `parserErrorCount`
- `IlpCatalogProduct`
  - stable internal product ID
  - insurer
  - product name
  - source file name
  - source checksum
  - support status
  - warnings
  - archived flag
  - variants
- `IlpProductTemplate`
  - generic mechanics only
  - supported currencies
  - supported MIP options
  - account model
  - bonus rules
  - fee rules
  - EEC table
  - withdrawal rules
  - unsupported items
  - source refs
- `IlpTemplateVariant`
  - one selectable normalized variant, e.g. `SGD / MIP 25`
- `IlpPolicyCatalogSource`
  - `productId`
  - `variantId`
  - `catalogVersion`

### Policy Provenance

Extend `IlpPolicyInput` with:
- `catalogSource?: { productId: string; variantId: string; catalogVersion: string }`

This field is optional so existing manually created policies remain valid. It is required for archive/tombstone warnings and future re-linking back to the originating catalog template.

### Personal Policy Boundary

Template data must never be treated as a full personal policy.

User-entered fields remain:
- `monthlyContribution`
- `monthsAlreadyPaid`
- `currentPolicyYear`
- `accounts[].currentValue`
- `funds`

### Template-to-Policy Field Partition

Template-derived fields:
- `name`
- `insurer`
- `currency`
- `mipLength`
- `accounts` structure, labels, fee rates, `subjectToEec`, `postMipFeeRate`, and initial `contributionShare`
- `bonuses`
- `eecTable`
- generic withdrawal rule metadata retained in template provenance / warnings
- `catalogSource`

User-required fields:
- `monthlyContribution`
- `currentPolicyYear`
- `monthsAlreadyPaid`
- `accounts[].currentValue`

Defaulted fields:
- `discountRate`
- `inflationRate`
- `alternativeReturn`
- `funds`

## Frontend Runtime Pattern

Do not add `useIlpCatalogStore`.

Add:
- `frontend/src/lib/ilp-catalog/getIlpCatalog.ts`

Pattern:
- import generated JSON
- validate once at module load
- expose catalog data through a plain getter
- keep search/filter state in component-local `useState`

## Parser Strategy

### Release Approach

Use deterministic parsing first, but only after a parser spike on a diverse local corpus.

V1 parser strategy:
- common section/keyword heuristics for product-summary PDFs
- table reconstruction helpers for fee/EEC/bonus schedules
- insurer/product-specific overrides only when generic heuristics fail

This avoids committing prematurely to a large per-insurer parser tree without real corpus evidence.

### Required Parser Spike

Before schema freeze, run a spike on 3-5 diverse PDFs from the local corpus:
- different insurers
- different bonus structures
- at least one multi-MIP product
- at least one product with nontrivial withdrawal language

The spike must answer:
- can text extraction recover enough structure reliably?
- can EEC tables and fee tables be reconstructed accurately?
- what minimum normalized shape survives across real documents?

If the spike fails on core tables, V1 must change approach before UI work starts:
- either introduce assisted extraction
- or switch to manual template entry backed by PDF references

Spike source location:
- keep the initial 3-5 PDFs under a dedicated fixture corpus path used by the pipeline, e.g. `frontend/scripts/ilp-catalog/fixtures/source-pdfs/`

Spike runtime:
- implement the pipeline scripts in TypeScript
- add `tsx` as the runner
- extend `frontend/tsconfig.node.json` to include `scripts/**/*.ts`

Spike pass criteria:
- `buildCatalog.ts` must successfully emit both generated JSON files
- the emitted `ilpCatalog.products.json` must contain at least one product with `supportStatus: 'supported'`
- that supported product must have:
  - at least one variant
  - non-empty `eecTable`
  - at least one fee rule or account fee rate
  - at least one normalized account definition
- failures must be written into warnings/support status, not dropped silently

## Image-Based PDF Policy

V1 explicitly does not support image-only/scanned PDFs.

Behavior:
- parser detects missing/near-empty text layer
- marks product as `parser-error`
- stores a clear failure reason in generated warnings
- excludes the product from normal selection in the UI

## Catalog Artifact Strategy

V1 uses exactly two generated artifacts:
- `ilpCatalog.manifest.json`
- `ilpCatalog.products.json`

No separate search/support files in V1.

Rationale:
- expected corpus size is small enough for in-memory filtering
- fewer artifacts reduce generation and debugging complexity

## Store and Mapping Integration

### `useIlpStore` Changes

Update:
- `frontend/src/stores/useIlpStore.ts`

Add:
- `addPolicyFromSeed(seed)`

Behavior:
- calls `createDefaultPolicy()`
- overlays normalized template fields
- preserves required user-entered personal fields from the seed form
- validates the merged result with the full `ilpPolicySchema`
- returns a discriminated union:
  - `{ success: true; policyId: string }`
  - `{ success: false; errors: string[] }`

Rationale:
- the seed form needs pre-navigation validation feedback
- this avoids depending on the page shell alone to surface seed-creation failures

### Seed Schema

Add:
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts`

Rule:
- use a lightweight schema that validates only seed-form fields
- do not rely on `ilpPolicySchema.pick()` for safety because `.pick()` drops `superRefine` cross-field checks
- final safety check happens only after merge, by validating the full policy object against `ilpPolicySchema`

## Tombstone / Archive Policy

V1 must support removed or retired products without breaking existing user drafts.

Rules:
- never hard-delete a product template ID once released
- mark removed products as `archived: true`
- preserve enough metadata for existing drafts to render source and warnings
- hide archived products from default picker results unless explicitly requested
- `buildCatalog.ts` must read the prior `ilpCatalog.products.json` when present so removed products can be tombstoned instead of omitted

## Detailed Phase Plan

### Phase 0: Corpus, Legal Boundary, and Parser Viability Spike

Deliverables:
- local PDF corpus directory established
- documented source strategy for V1: user-supplied local files only
- parser viability spike on 3-5 representative PDFs
- explicit report on:
  - text-layer availability
  - fee/EEC table extraction success
  - unsupported document classes

Gate:
- No generation pipeline or frontend picker work starts until this spike proves at least one fully normalized real product.

Files:
- `frontend/scripts/ilp-catalog/spike/*`
- `frontend/docs/ilp-catalog-spike.md`

### Phase 1: Schema + Parser Foundation

Deliverables:
- finalized template-domain types based on real PDFs
- Node-only parser registry and extraction helpers
- initial heuristics + override pattern

Files:
- `frontend/src/lib/ilp-catalog/types.ts`
- `frontend/src/lib/ilp-catalog/schema.ts`
- `frontend/scripts/ilp-catalog/parserRegistry.ts`
- `frontend/scripts/ilp-catalog/pdf/*`
- `frontend/scripts/ilp-catalog/parsers/*`

### Phase 2: Generation Pipeline

Deliverables:
- local build command to parse corpus and generate catalog JSON
- checksum support
- diff reporting between catalog versions
- archived/tombstone handling
- committed empty generated JSON seed files for fresh clones

Files:
- `frontend/scripts/ilp-catalog/buildCatalog.ts`
- `frontend/scripts/ilp-catalog/writeArtifacts.ts`
- `frontend/scripts/ilp-catalog/reportDiff.ts`
- `frontend/package.json` scripts
- `frontend/tsconfig.node.json`

### Phase 3: Frontend Picker + Policy Seeding

Deliverables:
- catalog getter using generated JSON
- searchable picker UI
- variant selection
- personal policy seed form
- `useIlpStore` integration through `addPolicyFromSeed`
- picker launched as a modal/dialog from `/ilp-review`, adding a new policy rather than replacing an existing draft implicitly

Files:
- `frontend/src/lib/ilp-catalog/getIlpCatalog.ts`
- `frontend/src/components/ilp/catalog/ProductPickerDialog.tsx`
- `frontend/src/components/ilp/catalog/ProductSearchInput.tsx`
- `frontend/src/components/ilp/catalog/ProductResultsTable.tsx`
- `frontend/src/components/ilp/catalog/ProductVariantSelector.tsx`
- `frontend/src/components/ilp/catalog/ProductSupportBadge.tsx`
- `frontend/src/components/ilp/catalog/ProductTemplateSummary.tsx`
- `frontend/src/components/ilp/catalog/TemplateWarningsPanel.tsx`
- `frontend/src/components/ilp/catalog/PolicySeedForm.tsx`
- `frontend/src/components/ilp/catalog/SourceDetailsDialog.tsx`
- `frontend/src/pages/IlpReviewPage.tsx`
- `frontend/src/stores/useIlpStore.ts`

### Phase 4: Release Hardening

Deliverables:
- golden tests for normalized products
- UI tests for picker and seeding flow
- E2E flow from product search to ILP analysis
- operator docs for adding/updating local PDFs

Files:
- `frontend/src/lib/ilp-catalog/__tests__/*`
- `frontend/src/components/ilp/catalog/__tests__/ProductPickerDialog.test.tsx`
- `frontend/src/pages/IlpReviewPage.catalog.test.tsx`
- `frontend/e2e/ilp-catalog.spec.ts`
- `frontend/docs/ilp-catalog.md`

## Acceptance Criteria

1. A manually supplied local PDF corpus can be parsed into a generated ILP catalog.
2. All parser and PDF extraction code lives under `frontend/scripts/ilp-catalog/`, not `frontend/src/`.
3. The runtime catalog is loaded without a dedicated Zustand store.
4. At least one real PDF is fully normalized into emitted catalog JSON before the picker UI is built.
5. Image-based PDFs are explicitly marked `parser-error` and excluded from normal product selection.
6. The generated catalog uses only `manifest` and `products` JSON artifacts.
7. Fresh clones build successfully because empty generated JSON seed files are committed.
8. `useIlpStore` exposes `addPolicyFromSeed(seed)` for template-driven draft creation and returns explicit success/error results.
9. Created policies retain `catalogSource` provenance.
10. Released product IDs are never hard-deleted; retired products are archived.
11. Users can search by product name, select a variant, enter personal fields, and create a valid ILP draft.
12. The resulting draft works with the existing ILP calculator and comparison UI without a separate calculation path.

## Verification Steps

### Repo Checks

- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run lint`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run test`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run catalog:build`

### Focused Checks

- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/ilp-catalog/__tests__`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/pages/IlpCatalogPicker.test.tsx src/pages/IlpReviewPage.catalog.test.tsx`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run e2e -- ilp-catalog.spec.ts`

### Manual Checks

- place sample PDFs into the local corpus
- generate the catalog
- confirm a fresh clone with only the committed empty seed files still builds
- verify support statuses and warnings
- search for a product in `/ilp-review`
- create an ILP draft from the selected variant
- confirm the existing ILP analysis renders

## Risks and Mitigations

### Risk: Table reconstruction is too brittle

Mitigation:
- treat the spike as a hard gate
- test across diverse real PDFs before schema freeze
- fall back to manual template entry if deterministic parsing proves insufficient

### Risk: Corpus evolves and product names/files change

Mitigation:
- checksum every source file
- keep stable internal IDs
- archive retired products instead of deleting them

### Risk: Runtime picker complexity grows

Mitigation:
- keep catalog runtime shape simple
- use local filtering over generated products JSON
- defer hosted-catalog infrastructure until real scale demands it

### Risk: Existing untracked ILP feature files create unstable baseline

Mitigation:
- get the current ILP implementation staged/committed and green before layering catalog work on top

## ADR

### Decision

Ship V1 as a manual-curated local PDF catalog, not an automated registry-sync product.

### Drivers

- removes the immediate legal/acquisition blocker
- preserves the intended search-by-name UX
- fits the repo’s current architecture and avoids premature pipeline complexity

### Alternatives Considered

- automated CompareFIRST sync
- upload-first PDF parsing
- runtime client scraping

### Why Chosen

This is the fastest path to a release-grade product without taking unresolved external dependency and Terms-of-Use risk into the critical path.

### Consequences

- corpus refresh is manual in V1
- parser quality can be established before any automation work
- future automation can be added later without changing the frontend product model

### Follow-Ups

- once legal/source strategy is resolved, revisit automated acquisition as a separate project
- if the parser spike fails, replace parsing with manual template authoring backed by the same catalog domain
