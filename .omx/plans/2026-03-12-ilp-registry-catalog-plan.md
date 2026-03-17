# ILP Registry Catalog Product Plan

## Status

This plan supersedes the upload-first intake direction for release planning.

New product direction:
- Use CompareFIRST as the source registry for generic ILP product summaries.
- Pre-ingest and normalize product-summary PDFs into a searchable product catalog.
- Let users search by product name and create a prefilled ILP draft without manually finding/uploading a PDF.

## Requirements Summary

Build a release-ready CompareFIRST-backed ILP product catalog for `/ilp-review` that:
- regularly syncs generic ILP product-summary PDFs from the CompareFIRST investment-linked registry
- parses and normalizes them into canonical product templates
- exposes a searchable frontend catalog
- creates ILP drafts from selected templates
- keeps personal policy state separate from generic product defaults
- detects and safely handles source drift, parser failures, and unsupported constructs

This product must be shippable, maintainable, and operationally safe. It is not an MVP and should include release-level ingestion, QA, diagnostics, versioning, and regression coverage.

## Source Facts

- The app is a Vite + React Router + Zustand frontend deployed to Cloudflare Pages, with only two existing Pages Functions and no general backend job system today: [frontend/package.json](/Users/tj/TJDevelopment/fireplanner/frontend/package.json), [frontend/functions/api/email-signup.ts](/Users/tj/TJDevelopment/fireplanner/frontend/functions/api/email-signup.ts), [frontend/functions/api/expense-tracker-signup.ts](/Users/tj/TJDevelopment/fireplanner/frontend/functions/api/expense-tracker-signup.ts).
- CI already runs on GitHub Actions with Node 22, which is the cleanest place to host a scheduled sync/generation workflow: [.github/workflows/ci.yml](/Users/tj/TJDevelopment/fireplanner/.github/workflows/ci.yml).
- `/ilp-review` already exists as a standalone route with its own store and page shell, which is the correct integration surface for this feature: [frontend/src/router.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/router.tsx), [frontend/src/pages/IlpReviewPage.tsx](/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/IlpReviewPage.tsx), [frontend/src/stores/useIlpStore.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useIlpStore.ts).
- The current ILP data model is personal-policy shaped and assumes user-entered values like `monthlyContribution`, `currentPolicyYear`, `accounts[].currentValue`, and `funds`, so generic product templates cannot be written into it directly: [frontend/src/lib/calculations/ilp.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/calculations/ilp.ts), [frontend/src/lib/validation/ilpSchema.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/validation/ilpSchema.ts), [frontend/src/stores/useIlpStore.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useIlpStore.ts).
- CompareFIRST exposes a dedicated investment-linked listing and states that policy indicators may be computed on different insurer bases, so normalized internal modeling is required rather than raw field-copying: [CompareFIRST investment-linked listing](https://www.comparefirst.sg/wap/productsListEvent.action?prodGroup=invst&pageAction=prodlisting).
- The HSBC sample product summary is text-based and includes the product mechanics needed for ILP modeling, including MIP options, bonuses, fee schedules, withdrawal rules, and an appendix EEC table: [HSBC Life Wealth Accelerate Product Summary](https://www.comparefirst.sg/wap/prodSummaryPdf/199903512M/HSBC%20Life%20Wealth%20Accelerate%20Product%20Summary.pdf).

## Product Goals

1. User can type a product name instead of sourcing a PDF manually.
2. Generic product mechanics come from a curated, versioned internal catalog.
3. Product defaults are normalized into the ILP model with clear provenance and support status.
4. Personal policy fields remain user-entered and clearly separated from generic defaults.
5. Catalog refreshes safely as CompareFIRST updates products over time.
6. Parser regressions and source drift are caught before release.

## Non-Goals

- Parsing personalized statements, holdings, or transaction histories.
- Live scraping CompareFIRST in the user’s browser at runtime.
- One-click fully personalized policy creation from a generic product summary.
- Silent fallback from unsupported documents/products into guessed policy values.

## Principles

1. Registry-backed, not user-scraped.
2. Deterministic normalization over prompt-only extraction.
3. Generic template first, personal policy second.
4. Release safety requires catalog versioning and parser QA.
5. Unsupported cases must degrade visibly, not silently.

## Decision Drivers

1. UX: product-name search is materially better than upload-and-parse for end users.
2. Correctness: generic product PDFs do not contain personal policy state.
3. Operability: source documents will change over time, so ingestion must be testable and monitored.

## Viable Options

### Option A: Prebuilt Static Catalog Generated in CI

Pros:
- simplest release architecture for this repo
- aligns with current static Pages deployment
- easy to version, diff, and regression test
- no runtime dependency on CompareFIRST

Cons:
- catalog freshness depends on scheduled sync cadence
- bundle size can grow if all parsed artifacts ship to the client

### Option B: Hosted Catalog API Backed by Cloudflare Storage/DB

Pros:
- smaller frontend payloads
- easier incremental updates
- easier server-side filtering and analytics

Cons:
- materially more infrastructure
- runtime availability becomes part of core UX
- bigger release surface than the current repo architecture supports today

### Decision

Choose Option A for the first release-ready implementation, but structure the catalog format and loader so it can move to Option B later without rewriting the parser or UI domain.

## Architecture

### High-Level Flow

1. Scheduled ingestion job discovers CompareFIRST ILP product entries.
2. Job fetches product-summary PDFs and metadata.
3. Parser registry converts each PDF into a canonical `IlpProductTemplate`.
4. Validation and golden tests run against the normalized outputs.
5. A generated versioned catalog artifact is written into the frontend data layer.
6. Frontend loads the catalog and powers a product picker inside `/ilp-review`.
7. User selects a product, chooses unresolved options like MIP/currency, and creates a personal ILP draft in `useIlpStore`.

### Why Not Runtime Scraping

Runtime scraping in the browser is rejected because it creates:
- external availability dependency on CompareFIRST for every user
- CORS/network fragility
- inconsistent results across users
- no stable regression baseline
- more difficult debugging and release validation

### Recommended Runtime Shape

- Catalog artifact checked into the repo or generated during build under `frontend/src/lib/data/generated/`.
- Loader hook reads the static catalog locally.
- Personal policy creation stays in the client-side ILP store.

## Data Model

### New Core Types

Add a separate template domain instead of overloading `IlpPolicyInput`.

Files:
- `frontend/src/lib/ilp-catalog/types.ts`
- `frontend/src/lib/ilp-catalog/schema.ts`

Types:
- `IlpCatalogManifest`
  - `catalogVersion`
  - `generatedAt`
  - `source`
  - `parserVersion`
  - `products`
- `IlpCatalogProduct`
  - stable internal product ID
  - insurer
  - product name
  - product group
  - source page URL
  - source PDF URL
  - source checksum
  - fetch timestamp
  - support status
  - warnings
  - template variants
- `IlpProductTemplate`
  - generic policy mechanics only
  - supported currencies
  - supported MIP variants
  - account model
  - bonus rules
  - fee rules
  - EEC tables
  - withdrawal rules
  - unsupported items
  - source refs
- `IlpTemplateVariant`
  - one normalized selectable variant, e.g. `SGD / MIP 25`
- `IlpTemplateToPolicyInput`
  - mapping helper output that still requires user-entered personal fields

### Mapping Boundary

`IlpProductTemplate` must not be persisted into `useIlpStore` directly.

Instead:
- template selection -> `IlpDraftSeed`
- user fills personal fields
- seed maps into valid `IlpPolicyInput`

User-entered fields remain:
- `monthlyContribution`
- `monthsAlreadyPaid`
- `currentPolicyYear`
- `accounts[].currentValue`
- `funds`

## Backend / Automation Architecture

### Recommended Sync Location

Use GitHub Actions, not Pages Functions, for scheduled catalog generation.

Reason:
- this repo already has CI on GitHub Actions with Node 22
- Pages Functions are request-time handlers, not a durable batch pipeline
- scheduled ingestion and artifact generation fit cleanly in Actions

### New Workflow

Add:
- `.github/workflows/ilp-catalog-sync.yml`

Responsibilities:
- run on schedule and manually
- crawl CompareFIRST ILP listing
- fetch/refresh PDFs
- run parsers
- validate outputs
- open a PR or commit generated artifacts on success
- fail loudly on parser drift or unsupported changes

### Ingestion Script Layer

Add:
- `frontend/scripts/ilp-catalog/sync.ts`
- `frontend/scripts/ilp-catalog/discoverProducts.ts`
- `frontend/scripts/ilp-catalog/fetchPdf.ts`
- `frontend/scripts/ilp-catalog/buildCatalog.ts`
- `frontend/scripts/ilp-catalog/writeArtifacts.ts`
- `frontend/scripts/ilp-catalog/reportDiff.ts`

Responsibilities:
- discover product entries from CompareFIRST listing
- canonicalize source metadata
- checksum PDFs
- skip unchanged artifacts when possible
- emit diff reports for added/changed/removed products

### Artifact Storage

Recommended generated outputs:
- `frontend/src/lib/data/generated/ilpCatalog.manifest.json`
- `frontend/src/lib/data/generated/ilpCatalog.products.json`
- `frontend/src/lib/data/generated/ilpCatalog.search.json`
- `frontend/src/lib/data/generated/ilpCatalog.support.json`

Optional local fixtures for parser QA:
- `frontend/src/lib/ilp-catalog/__fixtures__/pdf/`
- `frontend/src/lib/ilp-catalog/__fixtures__/parsed/`

## Parser Architecture

### Parser Registry

Add:
- `frontend/src/lib/ilp-catalog/parserRegistry.ts`
- `frontend/src/lib/ilp-catalog/compareFirst/detect.ts`
- `frontend/src/lib/ilp-catalog/compareFirst/common.ts`
- `frontend/src/lib/ilp-catalog/compareFirst/sectionExtractor.ts`
- `frontend/src/lib/ilp-catalog/compareFirst/normalizers.ts`

Each parser contract:
- `detect(document): DetectionScore`
- `extract(document): RawParsedProduct`
- `normalize(raw): IlpProductTemplate`
- `validate(template): ValidationReport`

### Insurer/Product Parsers

Add:
- `frontend/src/lib/ilp-catalog/parsers/hsbcWealthAccelerate.ts`
- more insurer/product parsers as needed

Pattern:
- common CompareFIRST section extraction
- insurer/product-specific mappers for non-uniform wording

### PDF Extraction

Add:
- `frontend/src/lib/ilp-catalog/pdf/extractPdfText.ts`
- `frontend/src/lib/ilp-catalog/pdf/textCleanup.ts`
- `frontend/src/lib/ilp-catalog/pdf/tableReconstruction.ts`

Use deterministic text extraction via `pdfjs-dist` or equivalent.

### Canonical Normalization Rules

Normalize insurer wording into internal ILP concepts:
- contribution-routing accounts like IUA/AUA
- annual management fee and account-level fee rates
- premium-allocation bonuses
- annual-rate bonuses on account values
- one-time bonuses
- EEC table by policy year
- post-MIP rules
- partial withdrawal charges / rules

Unsupported mechanics must be preserved in `unsupportedItems`, not dropped.

## Frontend Product Experience

### New UX Flow on `/ilp-review`

1. User clicks `Choose Product`.
2. Modal or side panel opens searchable product catalog.
3. User filters by insurer or product name.
4. User selects a product.
5. If the product has multiple variants, user selects:
   - currency
   - MIP option
6. App shows a structured summary of imported generic defaults.
7. User fills personal fields required to create the draft.
8. App creates an ILP policy in `useIlpStore` and returns to the normal ILP review workspace.

### Required UI Components

Add:
- `frontend/src/components/ilp-catalog/ProductPickerDialog.tsx`
- `frontend/src/components/ilp-catalog/ProductSearchInput.tsx`
- `frontend/src/components/ilp-catalog/ProductResultsTable.tsx`
- `frontend/src/components/ilp-catalog/ProductVariantSelector.tsx`
- `frontend/src/components/ilp-catalog/ProductSupportBadge.tsx`
- `frontend/src/components/ilp-catalog/ProductTemplateSummary.tsx`
- `frontend/src/components/ilp-catalog/TemplateWarningsPanel.tsx`
- `frontend/src/components/ilp-catalog/PolicySeedForm.tsx`
- `frontend/src/components/ilp-catalog/SourceDetailsDialog.tsx`

Update:
- `frontend/src/pages/IlpReviewPage.tsx`
- possibly `frontend/src/components/ilp/PolicyTabs.tsx`

### UX Requirements

- Search results must be fast and client-local.
- Unsupported or partially supported products must be clearly labeled.
- User must see whether a product template is fully supported, partially supported, or blocked.
- The create-draft flow must clearly separate:
  - imported generic defaults
  - user-entered personal values
- User must be able to inspect source metadata for trust and debugging.

## Store and Mapping Architecture

### New Store

Add:
- `frontend/src/stores/useIlpCatalogStore.ts`

Responsibilities:
- load manifest/products
- search/filter catalog
- hold selected product/template variant
- track template warnings and support status

### Seed/Mapper Layer

Add:
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts`
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts`

Responsibilities:
- convert selected template variant plus user-entered personal fields into `IlpPolicyInput`
- preserve failure-tolerant handling for malformed stored selection state
- ensure final policy passes `ilpPolicySchema`

### Existing Store Integration

Update:
- `frontend/src/stores/useIlpStore.ts`

Add actions:
- `createPolicyFromTemplateSeed`
- `replacePolicyWithTemplateSeed`

Do not merge template catalog concerns into the existing ILP store.

## Validation and Support States

Add:
- `frontend/src/lib/validation/ilpCatalogSchema.ts`

Support states:
- `supported`
- `partial`
- `unsupported`
- `stale-source`
- `parser-error`

Rules:
- `supported` can create drafts normally
- `partial` can create drafts with warnings
- `unsupported` cannot create drafts
- `stale-source` is hidden from normal users until regenerated or explicitly allowed
- `parser-error` is excluded from the picker

## Operations and Release Management

### Scheduled Refresh

Run a scheduled GitHub Action daily or weekly.

Workflow stages:
1. Discover products
2. Fetch changed PDFs
3. Parse and normalize
4. Run validation
5. Run golden tests
6. Generate diff report
7. Open PR with generated artifacts and support-status summary

### Diff Reporting

Every sync should produce:
- newly added products
- removed products
- changed checksums
- parser status changes
- unsupported-item deltas

### Drift Handling

If source drift breaks a parser:
- mark product `parser-error`
- fail the sync PR if it affects supported products above a defined threshold
- keep last known good released catalog until parser fix lands

### Release Gate

Do not publish a refreshed catalog if:
- manifest validation fails
- supported-product count regresses unexpectedly
- golden tests fail
- parser support downgrades exceed threshold without explicit approval

## Testing Strategy

### Unit Tests

Add:
- `frontend/src/lib/ilp-catalog/__tests__/sectionExtractor.test.ts`
- `frontend/src/lib/ilp-catalog/__tests__/tableReconstruction.test.ts`
- `frontend/src/lib/ilp-catalog/__tests__/normalizers.test.ts`
- `frontend/src/lib/ilp-catalog/__tests__/templateToPolicy.test.ts`

Cover:
- listing discovery parsing
- PDF section extraction
- rate table reconstruction
- variant normalization
- template-to-policy mapping

### Golden Parser Tests

Add:
- `frontend/src/lib/ilp-catalog/__tests__/golden/*.test.ts`

Golden outputs should lock:
- product identity
- currency options
- MIP variants
- account model
- bonus rules
- fee rates
- EEC table
- warnings/support status

### UI Tests

Add:
- `frontend/src/pages/IlpCatalogPicker.test.tsx`
- `frontend/src/pages/IlpReviewPage.catalog.test.tsx`

Cover:
- product search
- variant selection
- blocked draft creation when required personal fields are missing
- warnings for partial support
- creating an ILP draft into the existing page flow

### E2E Tests

Add:
- `frontend/e2e/ilp-catalog.spec.ts`

Cover:
- open `/ilp-review`
- search product
- select variant
- fill required personal fields
- create draft
- confirm analysis renders

### Sync-Pipeline Tests

Add:
- script tests for discovery and diff generation
- fixture-driven tests for checksum and manifest generation

## Security and Compliance Considerations

- Treat CompareFIRST as an external dependency and avoid hammering it.
- Cache fetched PDFs during sync runs.
- Respect robots/legal constraints before automating sustained crawling.
- Do not transmit user personal policy data to CompareFIRST or any third-party source.
- Keep runtime product selection fully local once the catalog is generated.

## Detailed Implementation Phases

### Phase 1: Catalog Domain and Generation Pipeline

Files:
- `frontend/src/lib/ilp-catalog/types.ts`
- `frontend/src/lib/ilp-catalog/schema.ts`
- `frontend/scripts/ilp-catalog/*`
- `.github/workflows/ilp-catalog-sync.yml`

Deliverables:
- versioned catalog manifest
- discovery/fetch/generate pipeline
- checksum and diff reporting

### Phase 2: PDF Extraction and CompareFIRST Registry Discovery

Files:
- `frontend/src/lib/ilp-catalog/pdf/*`
- `frontend/src/lib/ilp-catalog/compareFirst/*`

Deliverables:
- deterministic PDF text extraction
- section extraction
- listing discovery
- source metadata retention

### Phase 3: Template Normalization and Parser Registry

Files:
- `frontend/src/lib/ilp-catalog/parserRegistry.ts`
- `frontend/src/lib/ilp-catalog/parsers/*`

Deliverables:
- normalized product templates
- insurer/product parser contracts
- support-state assignment

### Phase 4: Frontend Catalog Picker and Policy Seeding

Files:
- `frontend/src/components/ilp-catalog/*`
- `frontend/src/stores/useIlpCatalogStore.ts`
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts`
- `frontend/src/pages/IlpReviewPage.tsx`

Deliverables:
- searchable product picker
- variant selection
- policy seed form
- create-draft integration with `useIlpStore`

### Phase 5: Release Hardening

Files:
- tests across `frontend/src/lib/ilp-catalog/__tests__`
- `frontend/e2e/ilp-catalog.spec.ts`
- `frontend/docs/ilp-catalog.md`

Deliverables:
- golden tests
- E2E coverage
- operator docs
- failure-mode handling

## Acceptance Criteria

1. CompareFIRST investment-linked products can be discovered and versioned by the sync pipeline.
2. Changed PDFs are detected via checksum, and unchanged products are not needlessly reprocessed.
3. Supported products are normalized into canonical product templates with source metadata and support status.
4. The frontend exposes a fast searchable product picker inside `/ilp-review`.
5. Users can create an ILP draft from a selected product template without uploading a PDF.
6. Personal policy fields remain explicitly user-entered and are not guessed from generic documents.
7. Unsupported or partial products are clearly labeled and handled according to support-state rules.
8. Parser drift is caught by validation/golden tests before release.
9. Catalog refreshes are operationalized through automation, diff reporting, and release gates.
10. The resulting draft works with the existing ILP calculator and comparison UI without forking the calculation path.

## Verification Steps

### Repo Checks

- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run lint`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run test`

### Focused Catalog Checks

- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/ilp-catalog/__tests__`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/pages/IlpCatalogPicker.test.tsx src/pages/IlpReviewPage.catalog.test.tsx`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run e2e -- ilp-catalog.spec.ts`

### Sync Verification

- run the catalog sync workflow locally or in CI against a fixed fixture set
- verify diff report generation
- verify manifest schema validation
- verify changed-product handling

## Pre-Mortem

### Failure Scenario 1: CompareFIRST changes page structure or PDF naming

Impact:
- discovery misses products or fetches wrong URLs

Mitigation:
- isolate listing discovery
- add fixture snapshots for discovery output
- fail sync with a clear diff report when support count drops unexpectedly

### Failure Scenario 2: Parser silently misreads a fee/EEC table

Impact:
- wrong product templates create misleading ILP analyses

Mitigation:
- golden tests for parsed outputs
- support status and warnings
- source metadata and internal review of changed outputs in sync PRs

### Failure Scenario 3: Catalog grows and slows frontend search/load

Impact:
- degraded `/ilp-review` UX

Mitigation:
- generate a compact search index
- split manifest/search data from full product templates if needed
- lazy-load full template details after selection

## Expanded Test Plan

### Unit

- text cleanup
- section extraction
- table reconstruction
- variant normalization
- template-to-policy mapping

### Integration

- build catalog from fixture PDFs into manifest/products/search artifacts
- load catalog into store and create policy seed

### E2E

- user creates policy draft from catalog search
- partial-support product warning path
- supported product path into analysis

### Observability / Diagnostics

- sync diff report includes product counts and support-state changes
- generated manifest includes parser/catalog version metadata
- parser failures are attributable to specific source URLs and checksums

## ADR

### Decision

Ship a release-ready CompareFIRST-backed prebuilt ILP product catalog generated by scheduled automation and consumed locally by `/ilp-review`.

### Drivers

- best UX is search-by-name, not manual PDF upload
- generic product docs need normalization before they can seed policy state
- the repo’s current architecture favors generated static artifacts over runtime backend dependencies

### Alternatives Considered

- upload-first PDF parsing UX
- live runtime scraping from the client
- hosted catalog API as the initial release architecture

### Why Chosen

This design gives the cleanest user flow, strongest regression control, and most reliable operational model for the current repo and deployment architecture.

### Consequences

- more upfront ingestion/ops work
- cleaner product semantics and easier scale across many insurers/products
- a clear path to future hosted-catalog extraction if size or refresh cadence demands it

### Follow-Ups

- decide initial support threshold for release, e.g. top N insurers/products or complete CompareFIRST ILP coverage
- confirm legal/operational stance on scheduled automated fetching of CompareFIRST PDFs
- decide whether generated catalog artifacts live in git or are published by a release workflow
