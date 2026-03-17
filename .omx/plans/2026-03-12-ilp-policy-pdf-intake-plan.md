# ILP Product Summary PDF Intake Plan

## Requirements Summary

Build a complete product for ingesting generic ILP product-summary PDFs and using them to prefill the standalone ILP review tool at `/ilp-review`.

Scope assumptions:
- Input documents are generic policy / product-summary PDFs, not personalized policy schedules.
- The product must extract insurer/product mechanics, not customer-specific holdings.
- The product must support structured review and correction before data is persisted into the ILP store.
- V1 should target CompareFIRST-style Investment-Linked product-summary PDFs first, but the architecture must be designed for multiple insurers and future non-CompareFIRST generic summaries.

Source facts informing this plan:
- CompareFIRST exposes an Investment-Linked products listing and explicitly warns that policy indicators may not be directly comparable across insurers because insurers may use different calculation bases: [compareFIRST product listing](https://www.comparefirst.sg/wap/productsListEvent.action?prodGroup=invst&pageAction=prodlisting), lines 200-207.
- The HSBC sample PDF is text-based, has a stable table of contents, and exposes the sections we need:
  - product type, currency, and MIP options on page 3, lines 70-81: [HSBC sample PDF](https://www.comparefirst.sg/wap/prodSummaryPdf/199903512M/HSBC%20Life%20Wealth%20Accelerate%20Product%20Summary.pdf)
  - bonus definitions and formulas on pages 3-5, lines 92-175: same PDF
  - policy fees and charges on page 14, lines 601-639: same PDF
  - withdrawal / charge details on page 15, lines 645-713: same PDF
  - EEC rates table on page 31, lines 1328-1362: same PDF

Product goal:
- A user uploads a generic ILP product-summary PDF.
- The system extracts a normalized `IlpPolicyDraft`.
- The UI shows extracted sections, confidence flags, missing fields, and source snippets.
- The user confirms / edits the draft.
- The app converts the approved draft into the existing ILP store shape and opens it inside `/ilp-review`.

Non-goals:
- Parsing personalized fund statements, account balances, or transaction histories in V1.
- Inferring the user’s actual current policy year, months already paid, account values, or fund allocations from a generic summary.
- Fully automatic “one-click save” without human review.

## Product Principles

1. Generic product data only. Do not imply the app can infer personalized policy state from a product summary.
2. Deterministic extraction first. Prefer section-aware parsing over LLM-only extraction for stable PDFs.
3. Review before persist. Extracted data is a draft until the user confirms it.
4. Traceability. Every extracted field should retain provenance to the source page/section.
5. Failure tolerance. Partial extraction is acceptable; silent wrong extraction is not.
6. Extensible normalization. Insurer-specific wording must map into one canonical internal model.

## User Experience

### Primary Flow

1. User opens `/ilp-review`.
2. User clicks `Import Product Summary PDF`.
3. User uploads a PDF.
4. System parses the PDF and shows an intake workspace with:
   - document summary
   - extracted product fields
   - extraction confidence / warnings
   - highlighted missing fields that still require user input
   - source references per field
5. User fixes or confirms values.
6. User clicks `Create ILP Draft`.
7. App maps the reviewed draft into the existing ILP policy shape and inserts it into `useIlpStore`.
8. User lands back in the normal ILP review workflow with the imported draft selected.

### Secondary Flows

- Replace source PDF for an existing draft and re-run extraction.
- Compare extracted values against a previous saved draft.
- Duplicate a parsed generic product template and then key in policy-specific values manually.
- Export a normalized generic product template as JSON for reuse in tests / fixtures.

### UX Requirements

- The intake flow must be separate from the main ILP edit form.
- The intake UI must clearly distinguish:
  - extracted generic product defaults
  - user-entered policy-specific values
  - unsupported / unresolved items
- If extraction only partially succeeds, the user should still be able to continue with a partial draft.
- Any field sourced from ambiguous parsing should show a warning badge and an editable form control.
- Each extracted section should support “show source text”.

## Data Model

Introduce a separate intake model instead of writing directly into `IlpPolicyInput`.

### New Types

- `IlpProductDocument`
  - metadata about uploaded file, parse timestamp, checksum, source family, parse version
- `IlpProductDraft`
  - normalized, extracted product-level mechanics
- `IlpExtractionField<T>`
  - `value`
  - `confidence`
  - `status: 'extracted' | 'derived' | 'missing' | 'ambiguous' | 'unsupported'`
  - `sourceRefs: SourceRef[]`
  - `notes: string[]`
- `SourceRef`
  - `page`
  - `section`
  - `snippet`
  - `parserRuleId`
- `IlpImportReviewState`
  - current draft
  - user overrides
  - unresolved issues

### Draft Shape

`IlpProductDraft` should include:
- `insurer`
- `productName`
- `documentCurrencyOptions`
- `mipOptions`
- `defaultAccountModel`
  - account labels like IUA / AUA
  - per-account fee semantics
  - which account receives contributions
  - which account is subject to EEC
- `bonusRulesByMip`
- `feeRulesByMip`
- `eecTablesByMip`
- `withdrawalRules`
- `policyFlags`
  - partial withdrawal restrictions
  - premium holiday notes
  - fee variability flags
- `unsupportedItems`

### Mapping Boundary

Only after user review should the app transform `IlpProductDraft` into `IlpPolicyInput`.

Example mapping responsibilities:
- Choose one currency from supported currency options.
- Choose one MIP from supported MIP options.
- Convert bonus definitions into current bonus modes:
  - startup bonus from premium allocation tables
  - power-up / loyalty from annual-rate bonus formulas
- Populate accounts with canonical `contributionShare`, `subjectToEec`, and `postMipFeeRate`.
- Create placeholder user-editable values for policy-specific inputs:
  - `monthlyContribution`
  - `monthsAlreadyPaid`
  - `currentPolicyYear`
  - `accounts[].currentValue`
  - `funds`

## Architecture Decision

### Recommended Architecture

Client-side deterministic PDF text extraction plus parser-registry normalization.

Why:
- The current app is primarily browser-first and local-data oriented.
- CompareFIRST product summaries are text PDFs with stable section labels, which makes client-side extraction viable.
- Deterministic parsing will be easier to regression test than an LLM pipeline for fee tables and EEC matrices.
- Generic product documents do not require server storage to deliver value.

### Rejected Alternatives

#### 1. LLM-only extraction service

Rejected as the default path because:
- table and rate extraction errors are hard to constrain
- reproducibility is weak
- it introduces network/privacy dependencies unnecessarily
- it is harder to write stable regression tests against

#### 2. Direct parse into `IlpPolicyInput`

Rejected because:
- generic product documents do not contain enough data to produce a valid personal policy object
- mixing extracted defaults and missing personal fields will create invalid persisted state
- review UX becomes harder to reason about

### Optional Fallback

Add an optional server-assisted fallback later for:
- image-based scanned PDFs
- malformed text layers
- unsupported insurer layouts

That fallback should be opt-in and isolated behind an explicit “Try assisted extraction” action.

## Implementation Plan

### Phase 1: Intake Domain and Parser Foundation

Files to add:
- `frontend/src/lib/ilp-import/types.ts`
- `frontend/src/lib/ilp-import/schema.ts`
- `frontend/src/lib/ilp-import/sourceRefs.ts`
- `frontend/src/lib/ilp-import/normalizers.ts`
- `frontend/src/lib/ilp-import/parserRegistry.ts`
- `frontend/src/lib/ilp-import/compareFirst/textSections.ts`
- `frontend/src/lib/ilp-import/compareFirst/hsbcWealthAccelerate.ts`

Work:
- Define draft-domain types separate from the calculator/store model.
- Add Zod schemas for the draft-domain types.
- Define parser registry contracts:
  - `detect(document): DetectionResult`
  - `extract(document): IlpProductDraft`
  - `getCoverage(): ParserCoverage`
- Create a CompareFIRST section extractor:
  - read text spans by page
  - locate section boundaries using headings like `THE POLICY`, `BONUSES`, `POLICY FEES AND CHARGES`, `WITHDRAWAL`, `APPENDIX A`
- Build a normalized source-ref system so all extracted fields can point back to document pages/snippets.

Acceptance criteria:
- Draft types validate independently from `ilpSchema`.
- Registry can choose the correct parser for the HSBC sample.
- Source references are preserved for extracted fields.

### Phase 2: PDF Extraction Engine

Files to add:
- `frontend/src/lib/ilp-import/pdf/extractPdfText.ts`
- `frontend/src/lib/ilp-import/pdf/pdfTypes.ts`
- `frontend/src/lib/ilp-import/pdf/textCleanup.ts`
- `frontend/src/lib/ilp-import/pdf/tableHelpers.ts`

Dependencies:
- Add `pdfjs-dist` or equivalent text-extraction dependency.

Work:
- Extract page text and positional blocks client-side.
- Normalize whitespace, ligatures, wrapped rows, and split line artifacts.
- Preserve page numbers and text order.
- Add helpers for:
  - heading detection
  - table row reconstruction
  - percentage extraction
  - currency token extraction
  - year/range table extraction

Acceptance criteria:
- The HSBC sample can be loaded client-side without server calls.
- Page text and reconstructed lines are deterministic across test runs.
- Table helpers can rebuild the HSBC EEC table and core fee rows.

### Phase 3: CompareFIRST Normalization Layer

Files to add:
- `frontend/src/lib/ilp-import/compareFirst/common.ts`
- `frontend/src/lib/ilp-import/compareFirst/fieldMappers.ts`
- `frontend/src/lib/ilp-import/compareFirst/bonusParsers.ts`
- `frontend/src/lib/ilp-import/compareFirst/feeParsers.ts`
- `frontend/src/lib/ilp-import/compareFirst/eecParsers.ts`
- `frontend/src/lib/ilp-import/compareFirst/withdrawalParsers.ts`

Work:
- Normalize CompareFIRST / insurer wording into canonical concepts:
  - startup / allocation bonuses
  - annual-rate bonuses on account value
  - IUA / AUA account roles
  - AMF / IMF / EEC / PWC / BRC
- Implement a parser for multi-MIP products where tables vary by MIP.
- Add explicit unsupported-item capture when a product contains mechanics outside the current ILP model.
- Add variable-fee flags for charges stated as non-guaranteed or insurer-variable.

Acceptance criteria:
- The sample PDF normalizes into a complete generic draft with:
  - two MIP options
  - account definitions
  - startup bonus tables
  - power-up / loyalty bonus rules
  - AMF / IMF definitions
  - EEC schedule
  - partial withdrawal charge rules
- Unsupported items are preserved as warnings rather than discarded.

### Phase 4: Review Workflow and Store

Files to add:
- `frontend/src/stores/useIlpImportStore.ts`
- `frontend/src/lib/validation/ilpImportReviewSchema.ts`

Files to update:
- `frontend/src/stores/useIlpStore.ts`
- `frontend/src/pages/IlpReviewPage.tsx`

Work:
- Create a dedicated persisted-but-failure-tolerant intake store.
- Persist import state separately from the core ILP policy store.
- Add safe hydration and parser-version invalidation logic.
- Add conversion helpers:
  - `createPolicyFromReviewedDraft`
  - `mergeReviewedDraftIntoPolicy`
- Keep the core ILP store unchanged until the user explicitly confirms import.

Acceptance criteria:
- Corrupt import state does not blank `/ilp-review`.
- Reviewed draft can be converted into a new ILP policy without mutating unrelated ILP state.
- User can discard an in-progress import safely.

### Phase 5: Upload and Review UI

Files to add:
- `frontend/src/components/ilp-import/UploadCard.tsx`
- `frontend/src/components/ilp-import/DocumentSummary.tsx`
- `frontend/src/components/ilp-import/ExtractionStatusBanner.tsx`
- `frontend/src/components/ilp-import/FieldReviewTable.tsx`
- `frontend/src/components/ilp-import/SourceSnippetDialog.tsx`
- `frontend/src/components/ilp-import/MipSelector.tsx`
- `frontend/src/components/ilp-import/AccountModelPanel.tsx`
- `frontend/src/components/ilp-import/BonusRulesPanel.tsx`
- `frontend/src/components/ilp-import/FeeRulesPanel.tsx`
- `frontend/src/components/ilp-import/EecTablePanel.tsx`
- `frontend/src/components/ilp-import/UnsupportedItemsPanel.tsx`
- `frontend/src/components/ilp-import/CreateDraftActions.tsx`

Files to update:
- `frontend/src/pages/IlpReviewPage.tsx`
- `frontend/src/router.tsx` only if a separate sub-route is warranted

Work:
- Add an import entry point near policy creation on `/ilp-review`.
- Create a full intake workspace that:
  - shows extracted fields grouped by domain
  - highlights ambiguous and missing fields
  - lets users override extracted values
  - shows source snippets per field
  - requires explicit user choices for MIP/currency when multiple options exist
- Add a completion checklist before `Create ILP Draft` is enabled.

Acceptance criteria:
- A user can upload the HSBC sample PDF and review all extracted sections in one workspace.
- The UI clearly separates generic extracted defaults from required personal inputs.
- Draft creation is blocked until required user selections are made.

### Phase 6: Mapping into Existing ILP Tool

Files to update:
- `frontend/src/lib/calculations/ilp.ts`
- `frontend/src/lib/data/ilpDefaults.ts`
- `frontend/src/lib/validation/ilpSchema.ts`

Work:
- Add helper constructors for parser-created policy templates.
- Ensure imported drafts map cleanly into:
  - accounts
  - bonuses
  - EEC tables
  - post-MIP logic
- Add explicit placeholder defaults for unknown policy-specific fields.
- Keep the imported draft editable in the existing ILP form immediately after creation.

Acceptance criteria:
- Imported drafts produce valid `IlpPolicyInput` objects once required user choices are made.
- Existing ILP calculations continue to work without branching logic for imported vs manual policies.

### Phase 7: Test Corpus and Verification Harness

Files to add:
- `frontend/src/lib/ilp-import/__fixtures__/...`
- `frontend/src/lib/ilp-import/__tests__/pdfExtraction.test.ts`
- `frontend/src/lib/ilp-import/__tests__/compareFirstNormalization.test.ts`
- `frontend/src/lib/ilp-import/__tests__/draftToPolicy.test.ts`
- `frontend/src/pages/IlpImportFlow.test.tsx`
- `frontend/e2e/ilp-import.spec.ts`

Work:
- Create a fixture corpus of product-summary PDFs and extracted text snapshots.
- Write golden tests for normalized draft output by insurer/product.
- Add UI tests for:
  - upload
  - extraction warnings
  - MIP selection
  - source snippet display
  - draft creation into `useIlpStore`
- Add E2E flows against at least one full sample PDF.

Acceptance criteria:
- Golden tests catch extraction regressions.
- Draft-to-policy mapping is covered with deterministic fixtures.
- E2E verifies the main flow from upload to usable ILP draft.

### Phase 8: Productization and Maintenance

Files to add:
- `frontend/src/lib/ilp-import/parserCoverage.ts`
- `frontend/src/lib/ilp-import/telemetry.ts`
- `frontend/docs/ilp-product-import.md`

Work:
- Add a local parser coverage registry:
  - supported insurers/products
  - supported document families
  - unsupported feature flags
- Add non-sensitive local diagnostics for parse outcomes and unsupported fields.
- Document onboarding steps for adding a new parser.
- Document known unsupported constructs and escalation rules.

Acceptance criteria:
- New parser additions follow a documented template.
- Unsupported constructs are visible in diagnostics and docs.

## Detailed Normalization Rules

### Canonical Concepts

The importer must normalize insurer language into these concepts:
- `IUA` / initial units account -> account with MIP-only charge exposure
- `AUA` / accumulation units account -> ongoing account for post-MIP fees / bonuses
- premium allocation bonus -> `mode: 'premium-allocation'`
- account-value bonus -> `mode: 'annual-rate'`
- flat one-off credit -> `mode: 'one-time'`
- EEC / surrender charge on a specific account -> `eecTable + subjectToEec`

### Ambiguity Rules

- If the document offers multiple MIP options, the draft must preserve each option separately and require user selection before policy creation.
- If the document offers multiple currencies, the draft must preserve all supported currencies and require user selection.
- If a fee is described as variable / non-guaranteed, the draft must store both:
  - the current stated rate, if any
  - a warning flag that the rate is not guaranteed
- If a bonus has eligibility conditions the parser cannot evaluate from a generic document, the rule should still be extracted but marked with `notes` explaining the unresolved conditions.

### Unsupported Constructs

Mark as unsupported rather than forcing them into the ILP model:
- fund-level rider fees not represented in the current ILP schema
- dynamic fee ladders without a stable current rate
- charges triggered by behaviors not modeled in the calculator
- benefit logic that affects surrender economics in ways not captured by current ILP calculations

## Risks and Mitigations

### Risk: Insurer tables use incompatible bases

Evidence:
- CompareFIRST explicitly warns that policy indicators may not be comparable across insurers because different insurers may use different bases: [compareFIRST product listing](https://www.comparefirst.sg/wap/productsListEvent.action?prodGroup=invst&pageAction=prodlisting), lines 204-206.

Mitigation:
- Normalize document mechanics into internal canonical formulas.
- Preserve source refs and notes for every nontrivial field.
- Do not present imported figures as cross-insurer “official comparisons”.

### Risk: Generic summaries omit data required by the ILP calculator

Mitigation:
- Separate generic draft model from the final policy model.
- Require the user to complete missing policy-specific values before saving.

### Risk: PDF text extraction breaks on formatting differences

Mitigation:
- Use a parser registry with per-family detection and targeted extractors.
- Build a fixture corpus and golden tests.
- Treat parser mismatch as a recoverable “unsupported document” state.

### Risk: Silent wrong extraction of fee tables

Mitigation:
- Show source snippets for extracted values.
- Require review for all high-impact fields:
  - MIP
  - currency
  - AMF / IMF
  - EEC table
  - bonus tables
- Add golden tests for parsed rate tables.

### Risk: Future scans / image PDFs

Mitigation:
- Design the architecture so an optional server-assisted OCR path can plug in later without rewriting the review workflow.

## Acceptance Criteria

1. User can upload a CompareFIRST-style ILP product-summary PDF from `/ilp-review`.
2. The app extracts text client-side and detects the correct parser family.
3. The importer produces a normalized `IlpProductDraft` with field-level provenance.
4. The review UI shows extracted fields, warnings, missing fields, and source snippets.
5. The user must explicitly choose any unresolved MIP / currency option before draft creation.
6. The importer never writes directly into `useIlpStore` before review confirmation.
7. The approved draft maps into a valid ILP policy that the existing ILP page can analyze.
8. Unsupported mechanics are surfaced clearly and do not fail silently.
9. Fixture-based parser tests cover at least one full PDF end-to-end and at least three normalization units:
   - bonus parsing
   - fee parsing
   - EEC parsing
10. An E2E test covers upload -> review -> create draft -> analyze.

## Verification Steps

### Unit / Integration

- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run lint`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/ilp-import/__tests__`
- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/pages/IlpImportFlow.test.tsx src/pages/IlpReviewPage.test.tsx src/lib/calculations/ilp.test.ts`

### E2E

- `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run e2e -- ilp-import.spec.ts`

### Manual

- Upload the HSBC sample PDF.
- Confirm that product name, insurer, MIP options, currencies, bonus rules, AMF/IMF, and EEC table are extracted.
- Confirm that personal policy fields remain editable and are not invented.
- Confirm that the created draft opens in the normal ILP review UI and runs the current calculator.

## Rollout Strategy

### Release 1

- CompareFIRST family support
- 1-3 insurer-specific parsers
- review-first flow only
- no OCR

### Release 2

- broader CompareFIRST insurer coverage
- parser coverage diagnostics
- reusable normalized template export/import

### Release 3

- optional assisted extraction path for unsupported PDFs
- scanned PDF support

## What Helps Most From You

The most useful inputs are more generic ILP product-summary PDFs across insurers and product designs, especially where the structure differs from HSBC. I can extract these from CompareFIRST, but a curated set from you would help prioritize:
- products with multiple MIP options
- single-premium ILPs
- products with unusual bonus ladders
- products with non-standard surrender / partial-withdrawal mechanics
- products with different account naming than IUA / AUA

## ADR

### Decision

Use client-side deterministic PDF extraction with a parser-registry and a review-first draft workflow.

### Drivers

- The source documents are text-based and structured.
- The app already prefers local/browser-side processing.
- Financial correctness and testability matter more than “magic” automation.

### Alternatives Considered

- LLM-only extraction service
- direct parse into final ILP policy state
- OCR-first pipeline

### Why Chosen

This design matches the actual document format, minimizes silent errors, preserves privacy for generic documents, and gives the team a testable extension model for new insurers.

### Consequences

- More upfront parser work than a prompt-based prototype
- Better long-term regression control
- Cleaner separation between generic product mechanics and personal policy state

### Follow-ups

- Build the initial CompareFIRST parser corpus
- Decide whether Release 1 needs one insurer or a minimum cross-insurer set
- Decide whether to support template export/import for generic products
