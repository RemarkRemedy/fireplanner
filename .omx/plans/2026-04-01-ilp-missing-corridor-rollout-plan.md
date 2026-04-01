# ILP Missing Corridor Rollout Plan

## Objective
Close the known MIP/PPT corridor gaps in the ILP catalog without silently hiding published product variants from users.

The first ship should not be math support. It should be catalog honesty:
- show published-but-unmodeled corridors in the picker as disabled choices
- group them with their modeled siblings
- explain clearly that the corridor exists in the source PDF but is not executable yet

After that, expand support in descending order of value-to-effort while building the shared corridor kernel once.

## Corpus Anchor

The 92-policy summary-backed corpus pass already established that the current catalog is broadly supported:
- `ilpCatalog.manifest.json`
  - `productsCount = 92`
  - `supportedCount = 92`
  - `partialCount = 0`
  - `parserErrorCount = 0`
- `ilp-mechanics-family-classification.md`
  - all 92 products are classified as `supported-now`
  - all 92 currently show `0` remaining kernel blockers

This rollout is therefore not a rescue plan for unsupported products. It is a corridor-completeness plan for already-supported families, using the family/cohort taxonomy from the corpus audit as the execution lens and `outside-current-models.md` / `modeling-roadmap.md` as the boundary on what should remain metadata-only.

## Current Corridor Gaps Within Supported Products

### Confirmed missing corridors
- `AIA Platinum Wealth Elite 2.0`: missing `single-pay`, extended regular-pay beyond `5 years`
- `AIA Platinum Wealth Legacy`: missing `single-pay`
- `AIA Pro Achiever 3.0`: missing `15-year`, `20-year`
- `FWD Invest First Summit`: current seed only `10-year`; published family spans `10-30 years`
- `FWD Invest First Max`: current seed only `10-year`; published family spans longer PPT corridors beyond `10`
- `Legacy Flex Solitaire (VA3S / VA3R)`: missing `single premium / MIP 5`
- `Etiqa Invest flex wealth II`: missing `3-year`, `5-year`
- `Etiqa Invest Wealth Purpose`: missing `3-year`, `5-year`
- `HSBC Wealth Focus`: missing `Flexi 2`, `Flexi 4`
- `Singlife Legacy Invest`: missing `Single Premium`, `3 Years`, `5 Years`
- `TM Atlas Wealth`: published wider term family than current seeded corridor
- `Affluence@Future`: published wider term family than current seeded corridor
- `#goClassic`: published wider term family than current seeded corridor
- `#goClassic Secure`: published wider term family than current seeded corridor
- `#goAssure`: missing wider published term family beyond current seed
- `#goAffluence`: published wider term family than current seeded corridor

### Explicitly out of scope for this corridor rollout
- `PRUActive LinkGuard`
  - its remaining gap is behavioral lock-in / withdrawal-gate modeling, not a missing selectable corridor
  - keep it in the claim-state / behavioral roadmap, not the corridor rollout

### Confirmed clean on corridor coverage only
- `Great Eastern` family
- `Manulife Singapore` family
- `FWD Invest First Horizon`
- `FWD Invest Flexi Elite`
- `FWD Invest Flexi VII`

These families may still carry metadata-only residuals or claim/admin tails. “Clean” here means no confirmed missing corridor variants in this audit.

### Uncertain, do not surface yet
- `HSBC Wealth Harvest`
- `Etiqa Invest starter`

Re-verify these before starting any post-Phase-0 family expansion wave. Do not let them drift into implementation implicitly.

## Phase 0: Catalog Visibility First

### Goal
Show every confirmed published-but-unmodeled corridor in the catalog picker as a greyed-out selection before adding executable support.

Companion artifact:
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/.omx/plans/2026-04-01-ilp-disabled-corridor-inventory.md`
  - exact product IDs
  - proposed disabled corridor IDs
  - row/card render mode
  - source-backed Phase 0 scope
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/.omx/plans/2026-04-01-ilp-phase-0-execution-checklist.md`
  - exact PR 1 scope
  - branch posture
  - file touch set
  - test matrix
  - review gate
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/.omx/plans/2026-04-02-ilp-family-work-packets.md`
  - post-Phase-0 family packets
  - dependency level per family
  - parser/test ownership
  - suggested landing order

### Why this must ship first
- Stops silently implying the current seed list is the whole product family.
- Gives users an honest catalog of what exists in source PDFs.
- Lets product and parser work land incrementally without hiding demand.
- Creates a clean backlog object per corridor instead of leaving gaps implicit.
- Preserves the `supported-now` truth from the 92-policy corpus instead of downgrading entire product families because one corridor family is incomplete.

### Data model change
Extend the catalog product shape with a sibling list to `variants`, not a replacement for it.

Recommended addition:
- `publishedUnmodeledCorridors: IlpCatalogPublishedCorridor[]`

Recommended type shape:
```ts
interface IlpCatalogPublishedCorridor {
  id: string
  label: string
  paymentStructure: 'mip' | 'ppt' | 'single-pay' | 'flexi'
  behavioralConstraint?: 'lock-in'
  currency?: 'SGD' | 'USD'
  mipLength?: number | null
  premiumPaymentTermYears?: number | null
  contributionMode?: 'regular-pay' | 'single-pay'
  status: 'not-modeled-yet'
  reason: string
  sourceRefs: IlpCatalogSourceRef[]
}
```

### Concrete file touchpoints
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/ilp-catalog/types.ts`
  - add `IlpCatalogPublishedCorridor`
  - add `publishedUnmodeledCorridors` to `IlpCatalogProduct`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/ilp-catalog/schema.ts`
  - add the Zod schema for published unmodeled corridors
  - validate `publishedUnmodeledCorridors`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/data/generated/ilpCatalog.products.json`
  - populate confirmed corridor gaps via the snapshot generation path, not by hand-editing the generated file
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/catalogSnapshot.ts`
  - inject `publishedUnmodeledCorridors` during snapshot generation
  - use an explicit snapshot-side registry seeded from the companion inventory document for PR 1 rather than parser emission
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/*.test.ts`
  - add source-backed assertions for the new disabled corridors where needed
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/components/ilp/catalog/ProductPickerDialog.tsx`
  - render disabled entries under each product beside executable variants
  - use muted styling and explicit copy like `Published in source, not modeled yet`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/ilp-catalog/labels.ts`
  - optionally add a formatter for corridor labels if simple `label` strings are not enough

### UX requirements
- Keep executable `variants` clickable.
- Render `publishedUnmodeledCorridors` in the same product card, visually separated from executable variants.
- Disabled rows should still expose the corridor label, such as:
  - `SGD / PPT 15 years`
  - `SGD / Single Pay`
  - `SGD / Flexi 2`
- Show one short non-alarmist reason:
  - `Published in product summary, not modeled yet`
- If a product has many disabled corridors, cap the initial visible list and add a lightweight reveal control such as `Show more corridors`.
- Do not surface uncertain corridors until source verification is complete.
- For very large families, especially Tokio, the default UI may summarize a range first and expand to the full enumeration on demand. The data model should still retain per-corridor IDs for promotion tracking.

### Phase 0 acceptance criteria
- Confirmed missing corridors are visible in the picker.
- Users cannot select disabled corridors.
- Modeled variants are unchanged.
- Search and insurer grouping still work.
- Products with more than roughly 6 disabled corridors default to a collapsed range summary with an expand control.
- No existing template seeding flow regresses.
- CI asserts that a corridor cannot appear in both `variants` and `publishedUnmodeledCorridors` for the same product.
- When a corridor is promoted to modeled, the snapshot build fails until it is removed from the unmodeled list.
- Phase 0 populates disabled corridors through `catalogSnapshot.ts`, not manual edits to the generated JSON artifact.

## Scope Boundary

This rollout covers corridor variant expansion only:
- new MIP / PPT / payment-mode executable slices inside already-supported product families
- catalog surfacing of published-but-unmodeled family variants

This rollout does not cover:
- metadata-only residuals listed in `outside-current-models.md`
- claim-admission / claim-settlement workflows
- insurer approval or document-processing flows
- fund switching, dividend routing, payout operations, or similar administrative tails unless they are strictly required to express a newly executable corridor

Use the modeling-roadmap operating rules:
1. repeated executable mechanics first
2. shared state kernels second
3. claim/admin workflows after that
4. persistent long-tail metadata-only behavior last

## Shared Kernel Work

These changes should be done once before the broader corridor rollout, because they lower the cost of every later product addition.

### 1. Corridor-aware catalog metadata
The current catalog shape is variant-centric, but several gaps are really about product family coverage.

Add normalized metadata for:
- `premiumPaymentTermYears`
- `minimumInvestmentPeriodYears`
- `contributionMode`
- `flexiTerm`
- `lockInMonths` where relevant

This should live in corridor metadata, not be inferred from `variant.id`.

### 2. Term-keyed schedule support
Several products change economics by corridor, not just by MIP length.

Shared schedule helpers should support corridor-dependent:
- Booster Bonus tables
- Loyalty Bonus phase windows
- Perpetual Bonus start years
- premium reduction charge windows
- surrender charge schedules
- minimum premium thresholds

### 3. Contribution-lane split
A real portion of the backlog is not “more MIPs”; it is missing payment modes.

The engine should make an explicit distinction between:
- `regular-pay`
- `single-pay`
- `flexi`
- fixed lock-in structures that are not really MIP families

### 4. Family completeness tests
Add a verification harness that checks:
- published corridor families are either executable or explicitly surfaced as disabled
- every executed corridor has at least one product-summary-backed test
- every disabled corridor has at least one PDF source reference

### 5. Parser/corpus workflow
Support adding corridor rows without requiring a new product entry every time.

Target outcome:
- one product family
- many executable and non-executable corridor entries
- no fake duplication across seeds

## Kernel Split

The kernel work should not land as one broad refactor PR.

### PR 2a: Corridor metadata and schedule lookup for table-expansion families
Scope only what the easy-win products need:
- corridor metadata fields needed by:
  - `HSBC Wealth Focus`
  - `Etiqa Invest flex wealth II`
  - `Etiqa Invest Wealth Purpose`
  - `AIA Pro Achiever 3.0`
- helper lookup for corridor-keyed schedules:
  - fee windows
  - bonus tables
  - surrender schedules
- completeness and dedup tests for executable vs disabled corridors

Do not attempt contribution-lane abstractions here.

### PR 2b: Contribution-lane support for mixed-lane families
Scope only what the harder families need:
- explicit `single-pay` vs `regular-pay` modeling
- flexi lane distinctions where materially different
- shared lane metadata consumed by the mixed-lane family packets

This split avoids turning corridor expansion for easy families into a speculative engine rewrite.

## Easy Wins

These are mostly table expansions on top of structures we already understand.

### Tier 1 easy wins
- `HSBC Wealth Focus`
  - add `Flexi 2`, `Flexi 4`
- `Etiqa Invest flex wealth II`
  - add `3-year`, `5-year`
- `Etiqa Invest Wealth Purpose`
  - add `3-year`, `5-year`
- `AIA Pro Achiever 3.0`
  - add `15-year`, `20-year`

### Tier 2 medium-but-clean
- `FWD Invest First Summit`
  - add longer PPT corridors beyond `10-year`
  - requires corridor-specific bonus and charge tables, but stays within one family and one already-audited structure

## Highest-Risk Corridor Additions

These are riskier because they are not pure table expansions.

### Mixed payment-mode or single-pay lane additions
- `Singlife Legacy Invest`
  - current support only covers one regular-pay lane
  - needs `Single Premium`, `3 Years`, `5 Years`
- `AIA Platinum Wealth Elite 2.0`
  - needs `single-pay` plus wider regular-pay family
- `AIA Platinum Wealth Legacy`
  - needs `single-pay`
- `Legacy Flex Solitaire (VA3S / VA3R)`
  - missing `single premium / MIP 5`

### Structurally trickier product families
- `FWD Invest First Max`
  - longer PPT corridors plus existing layered mechanics make this more complex than Summit

### Batch-family expansion risk
- `TM Atlas Wealth`
- `Affluence@Future`
- `#goClassic`
- `#goClassic Secure`
- `#goAssure`
- `#goAffluence`

The Tokio batch is tractable, but there are enough similar families that it should be handled as a dedicated program after the shared kernel is proven on smaller wins.

## Suggested Landing Order

### PR 1: Catalog honesty
Ship Phase 0 only.

Scope:
- type/schema support for `publishedUnmodeledCorridors`
- generated catalog population for confirmed gaps
- disabled picker rendering
- tests around visibility and non-selectability

Reason:
- highest trust win
- lowest actuarial and kernel risk

### PR 2: Corridor kernel prep
Scope:
- PR 2a only:
  - normalized corridor metadata required for easy table-expansion families
  - schedule lookup helpers
  - family completeness tests

### PR 2b: Contribution-lane prep
Scope:
- explicit contribution-lane abstraction for the mixed-lane backlog
- shared lane metadata helpers
- targeted tests for single-pay / regular-pay separation

Reason:
- lowers risk for later product work without blocking the easy corridor expansions on mixed-lane design work

### PR 3: Easy corridor expansions
Scope:
- `HSBC Wealth Focus`
- `Etiqa Invest flex wealth II`
- `Etiqa Invest Wealth Purpose`
- `AIA Pro Achiever 3.0`

Reason:
- clean wins with limited lane complexity

### PR 4: FWD Invest First Summit expansion
Scope:
- implement longer PPT corridors beyond `10-year`
- wire corridor-aware booster / loyalty / reduction / surrender tables
- validate against the actual FWD summary

Reason:
- high user value
- already well-understood family

### PR 5: FWD Invest First Max expansion
Scope:
- longer PPT corridors
- family-specific validations

Reason:
- next highest value after Summit, but more branching

### PR 6: Tokio corridor batch
Scope:
- corridor families for the confirmed Tokio products

Reason:
- shared implementation cohort makes a batch approach efficient once `PR 2a` is proven

### PR 7: Mixed-lane additions
Scope:
- `Singlife Legacy Invest`
- `AIA Platinum Wealth Elite 2.0`
- `AIA Platinum Wealth Legacy`
- `Legacy Flex Solitaire`

Reason:
- requires explicit contribution-lane modeling and should wait for `PR 2b`

Use the detailed mixed-lane ordering in:
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/.omx/plans/2026-04-02-ilp-family-work-packets.md`

## Rollback Posture

- `PR 1`
  - revert by removing the added catalog field and picker rendering; no engine impact
- `PR 2a`
  - revert by removing corridor metadata helpers without changing already-modeled product math
- `PR 2b`
  - keep isolated from table-expansion work so mixed-lane experiments can be reverted independently
- `PR 3+`
  - each product-family expansion should be independently revertible by removing that family's executable corridor entries and related parser expectations

## Suggested Verification Strategy

### Phase 0 tests
- Product picker shows disabled published corridors.
- Disabled corridors are not selectable.
- Search results include products with disabled corridors.
- Existing executable variant labels stay unchanged.

### Corridor implementation tests
Per family:
- one source-backed corridor schedule assertion
- one template seeding smoke test per newly executable corridor
- one UI visibility test that the corridor moves from disabled to executable when implemented

### Audit artifacts
For each family expansion, keep:
- source PDF path
- exact table page references
- a narrow checklist of `exact`, `partial`, `not-modeled`

## Notes
- Do not surface uncertain corridors until source verification is complete.
- Keep `PRUActive LinkGuard` in the behavioral / claim-state roadmap rather than reopening it under corridor work.
- Do not treat `single-pay` as just another MIP row; it is often a different contribution lane.
- Do not overload the current `variant.id` parsing more than it already is; corridor metadata should become first-class.
- Do not touch unrelated local artifacts such as `.wrangler/` while doing this rollout.

## Merge-Prep Appendix

### Current merge posture
- Current integration branch:
  - `codex/ilp-wrapper-subfund-integration`
- Current fee-dashboard baseline:
  - `codex/ilp-fee-dashboard-consolidation-20260330`
- Verified merge base:
  - `b7070c3f3f1f4a834f167b23c1b788bf084fa59d`

This is good news. The current wrapper/subfund branch is cleanly based on the fee-dashboard baseline rather than diverging through a messy partial merge.

### Current wrapper/subfund branch file surface
Changed since the fee-dashboard baseline:
- `frontend/public/data/ilp-master-v1.json`
- `frontend/scripts/prerender.mjs`
- `frontend/src/components/ilp/IlpOcfDashboard.tsx`
- `frontend/src/components/ilp/IlpReturnsDashboard.tsx`
- `frontend/src/components/ilp/IlpSubfundDetailSheet.tsx`
- `frontend/src/components/ilp/ilpDetailUtils.ts`
- `frontend/src/components/ilp/types.ts`
- `frontend/src/components/layout/AppLayout.test.tsx`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/shared/MobileShareFab.tsx`
- `frontend/src/pages/IlpOcfPage.tsx`
- `frontend/src/pages/IlpReturnsPage.tsx`
- `frontend/src/router.tsx`

### Phase 0 corridor surfacing file surface
Expected files for the disabled-corridor catalog ship:
- `frontend/src/lib/ilp-catalog/types.ts`
- `frontend/src/lib/ilp-catalog/schema.ts`
- `frontend/src/lib/ilp-catalog/labels.ts`
- `frontend/src/lib/data/generated/ilpCatalog.products.json`
- `frontend/scripts/ilp-catalog/catalogSnapshot.ts`
- `frontend/src/components/ilp/catalog/ProductPickerDialog.tsx`

### Verified overlap risk
Direct overlap between the current wrapper/subfund branch and the planned Phase 0 corridor work:
- none

That means the first corridor surfacing PR is a good post-merge follow-up, because it should not materially collide with the subfund/dashboard integration slice.

## Parser Ownership Map

This is the concrete parser surface for the missing families.

### AIA
- `frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthElite2.ts`
- `frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthElite2.test.ts`
- `frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthLegacy.ts`
- `frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthLegacy.test.ts`
- `frontend/scripts/ilp-catalog/parsers/aiaProAchiever3.ts`
- `frontend/scripts/ilp-catalog/parsers/aiaProAchiever3.test.ts`

### FWD
- `frontend/scripts/ilp-catalog/parsers/fwdInvestFirstSummit.ts`
- `frontend/scripts/ilp-catalog/parsers/fwdInvestFirstSummit.test.ts`
- `frontend/scripts/ilp-catalog/parsers/fwdInvestFirstMax.ts`
- `frontend/scripts/ilp-catalog/parsers/fwdInvestFirstMax.test.ts`

### Income
- `frontend/scripts/ilp-catalog/parsers/incomeLegacyFlexSolitaire.ts`
- `frontend/scripts/ilp-catalog/parsers/incomeLegacyFlexSolitaire.test.ts`

### Etiqa
- `frontend/scripts/ilp-catalog/parsers/etiqaInvestFlexWealthIi.ts`
- `frontend/scripts/ilp-catalog/parsers/etiqaInvestFlexWealthIi.test.ts`
- `frontend/scripts/ilp-catalog/parsers/etiqaInvestWealthPurpose.ts`
- `frontend/scripts/ilp-catalog/parsers/etiqaInvestWealthPurpose.test.ts`

### HSBC
- `frontend/scripts/ilp-catalog/parsers/hsbcWealthFocus.ts`
- `frontend/scripts/ilp-catalog/parsers/hsbcWealthFocus.test.ts`

### Prudential
- `frontend/scripts/ilp-catalog/parsers/prudentialPruActiveLinkGuard.ts`
- `frontend/scripts/ilp-catalog/parsers/prudentialPruActiveLinkGuard.test.ts`

### Singlife
- `frontend/scripts/ilp-catalog/parsers/singlifeLegacyInvest.ts`
- `frontend/scripts/ilp-catalog/parsers/singlifeLegacyInvest.test.ts`

### Tokio Marine
- `frontend/scripts/ilp-catalog/parsers/tokioMarineAtlasWealth.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineAtlasWealth.test.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineAffluenceAtFuture.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineAffluenceAtFuture.test.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassic.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassic.test.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassicSecure.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassicSecure.test.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoAssure.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoAssure.test.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoAffluence.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoAffluence.test.ts`

## Command Checklist

### Catalog build and validation
Run from:
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend`

Commands:
```bash
npm run catalog:build
npm run type-check
npm run test -- ProductPickerDialog
```

### Parser-focused validation
Use the relevant parser test file, for example:
```bash
node node_modules/vitest/vitest.mjs run scripts/ilp-catalog/parsers/fwdInvestFirstSummit.test.ts
```

### Golden guard after executable corridor additions
```bash
npm run golden:check:source
```

For full economics validation on a real corridor-implementation PR:
```bash
npm run golden:check:economics
```

## Recommended Branch Choreography

### Immediate next landing sequence
1. Finish the current wrapper/subfund integration merge.
2. Land the Phase 0 catalog honesty PR.
3. Land `PR 2a` corridor metadata and schedule helpers.
4. Land the easy family corridor expansions.
5. Land `FWD Invest First Summit`.
6. Land the harder mixed-lane families only after `PR 2b`.

### Branch hygiene guidance
- Keep Phase 0 on a fresh branch off the merged wrapper/subfund baseline.
- Keep `PR 2a` and `PR 2b` separate.
- Do not let mixed-lane work piggyback into easy table-expansion families.
- Keep one product family per executable corridor PR unless two families share the exact same parser helper and test surface.

## Ready-Now Non-Code Tasks

These can be done before any implementation starts:
- finalize the disabled-corridor label set for the picker
- enumerate exact corridor labels for each confirmed missing family
- decide the collapse threshold for too many disabled entries per product card
- assign product-family ownership by insurer
- decide whether the Phase 0 PR should include only disabled picker UI, or also the product-card notes explaining why corridors are greyed out
