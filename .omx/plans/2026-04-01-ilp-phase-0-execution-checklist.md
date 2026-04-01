# ILP Phase 0 Execution Checklist

## Purpose
This is the operator checklist for `PR 1: catalog honesty`.

It translates the rollout plan and disabled-corridor inventory into:
- exact branch scope
- exact files expected to change
- exact tests to run
- exact acceptance gates
- exact things not to touch

Phase 0 must preserve the truth established by the 92-policy corpus pass:
- all 92 products are currently `supported-now`
- the work here is corridor visibility and family completeness only
- this PR must not turn corridor incompleteness into an implied downgrade of product support

## Branch Posture

### Current repo state
- Repo: `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation`
- Current branch: `codex/ilp-wrapper-subfund-integration`
- Current HEAD at time of writing: `1a87d6d6c84c21eaf0fbb7d3e233fd11604e9c69`
- Merge base vs fee-dashboard branch:
  - `b7070c3f3f1f4a834f167b23c1b788bf084fa59d`

### Current wrapper/subfund merge surface
Files currently changed on `codex/ilp-wrapper-subfund-integration` since the merge base:
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
- `frontend/src/hooks/useIlpMasterData.ts`
- `frontend/src/lib/ilpRoutes.ts`
- `frontend/src/pages/IlpOcfPage.tsx`
- `frontend/src/pages/IlpReturnsPage.tsx`
- `frontend/src/router.tsx`

### Phase 0 conflict posture
Planned Phase 0 files do not directly overlap that current merge surface.

## Recommended Branch Choreography

1. Finish and land the current wrapper/subfund merge first.
2. Start Phase 0 from the post-merge tip of:
   - `codex/ilp-fee-dashboard-consolidation-20260330`
   - or its merged successor if the branches are already unified
3. Create:
   - `codex/ilp-catalog-disabled-corridors`

Do not start Phase 0 from an unrelated stale branch tip.

## PR 1 Goal
Surface confirmed published-but-unmodeled corridors in the catalog as disabled selections without changing executable math support.

## PR 1 Scope

### In scope
- add `publishedUnmodeledCorridors` to catalog types and schema
- populate those corridors through `catalogSnapshot.ts`
- render disabled rows or disabled cards in the picker
- keep executable variants untouched
- add dedup and non-selectability checks

### Out of scope
- no parser math expansion
- no `templateToPolicy` changes
- no runtime calculation changes
- no promotion of any disabled corridor to executable
- no support-status downgrades or wording that implies these products are generally unsupported
- no `PRUActive LinkGuard` selector surfacing
- no uncertain families:
  - `HSBC Wealth Harvest`
  - `Etiqa Invest starter`

## Companion Inputs
- rollout plan:
  - [2026-04-01-ilp-missing-corridor-rollout-plan.md](/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/.omx/plans/2026-04-01-ilp-missing-corridor-rollout-plan.md)
- exact inventory:
  - [2026-04-01-ilp-disabled-corridor-inventory.md](/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/.omx/plans/2026-04-01-ilp-disabled-corridor-inventory.md)

## Expected File Touch Set

### Required
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/ilp-catalog/types.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/ilp-catalog/schema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/catalogSnapshot.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/components/ilp/catalog/ProductPickerDialog.tsx`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/data/generated/ilpCatalog.products.json`

### Likely
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/ilp-catalog/labels.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/pages/IlpFeeDashboardBridge.test.tsx`

### Optional but acceptable
- parser test files, if Phase 0 uses parser-adjacent assertions rather than inventory-only snapshot assertions

### Should not change in PR 1
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/ilp-catalog/templateToPolicy.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/calculations/ilp.ts`
- any fee-story / exit-lens UI files
- any OCF / returns / subfund dashboard files from the wrapper merge lane

## Source Families Included In PR 1

### Disabled corridor rows
- `aia-platinum-wealth-elite-2`
- `aia-platinum-wealth-legacy`
- `aia-pro-achiever-3`
- `fwd-invest-first-summit`
- `fwd-invest-first-max`
- `income-legacy-flex-solitaire`
- `etiqa-invest-flex-wealth-ii`
- `etiqa-invest-wealth-purpose`
- `singlife-legacy-invest`
- `tokio-marine-atlas-wealth`
- `tokio-marine-affluence-atfuture`
- `tokio-marine-goclassic`
- `tokio-marine-goclassic-secure`
- `tokio-marine-goassure`
- `tokio-marine-goaffluence`

### Disabled product cards
- `hsbc-life-wealth-focus-flexi-2`
- `hsbc-life-wealth-focus-flexi-4`

## Product-Family Test Surface

Relevant parser tests that should at least be reviewed when touching source-backed corridor inventory:
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthElite2.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthLegacy.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/aiaProAchiever3.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/etiqaInvestFlexWealthIi.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/etiqaInvestWealthPurpose.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/fwdInvestFirstMax.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/fwdInvestFirstSummit.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/incomeLegacyFlexSolitaire.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/singlifeLegacyInvest.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineAffluenceAtFuture.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineAtlasWealth.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoAffluence.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoAssure.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassic.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/parsers/tokioMarineGoClassicSecure.test.ts`

UI regression surface:
- `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/pages/IlpFeeDashboardBridge.test.tsx`

## Phase 0 Test Matrix

### Must pass
1. Type/schema build
   - `npm run type-check`
2. Catalog snapshot regeneration
   - `npm run catalog:build`
3. Source golden ratchet
   - `npm run golden:check:source`
4. Picker/UI regression
   - targeted vitest for:
     - `src/pages/IlpFeeDashboardBridge.test.tsx`

### Should be added as tests if missing
1. Disabled corridor rows render under the correct existing product card.
2. Disabled product cards render for `HSBC Wealth Focus (Flexi 2)` and `Flexi 4`.
3. Disabled entries are visibly non-selectable.
4. Executable variants remain selectable.
5. Searching for a product still returns the card even when disabled corridors are present.
6. A corridor cannot exist in both:
   - `variants`
   - `publishedUnmodeledCorridors`
7. Promotion failure ratchet:
   - if a corridor is added as executable but still remains in `publishedUnmodeledCorridors`, snapshot validation fails

## Implementation Order Inside PR 1

1. Add types in `types.ts`
2. Add schema support in `schema.ts`
3. Add snapshot-generation support in `catalogSnapshot.ts`
4. Populate confirmed inventory from the companion document
5. Update picker rendering in `ProductPickerDialog.tsx`
6. Add UI test coverage for disabled rows/cards and non-selectability
7. Run build and golden checks

## UX Rules For PR 1
- Disabled entries must read as honest product availability, not as errors.
- Preferred reason string:
  - `Published in product summary, not modeled yet`
- If a product has many disabled corridors, initial list should be capped and expandable.
- Do not mix executable and disabled entries without visual separation.
- `HSBC Wealth Focus` must preserve the existing product-card split by flexi term.

## Snapshot Authoring Rules
- The generated file:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/lib/data/generated/ilpCatalog.products.json`
  must not be hand-authored as the source of truth.
- Authoring path must flow through:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/scripts/ilp-catalog/catalogSnapshot.ts`
- Inventory values should come from the companion inventory document, not ad hoc in the PR.
- PR 1 should use an explicit snapshot-side registry for `publishedUnmodeledCorridors`, seeded from the companion inventory document. Do not attempt parser-emitted disabled corridors in this first ship.

## Review Checklist

Before merge, reviewer should verify:
- only Phase 0 files changed
- no runtime fee or benefit math files changed
- no parser economics changed
- no product `supportStatus` changed away from `supported`
- `PRUActive LinkGuard` is absent from selector surfacing
- uncertain families are absent
- `HSBC Wealth Focus` is surfaced as disabled cards, not disabled corridor rows
- `FWD Invest First Summit` and `FWD Invest First Max` labels say `Premium Payment Term`, not generic `MIP`
- `Singlife Legacy Invest` labels include both premium payment term and policy term

## Rollback Posture
If Phase 0 causes picker noise or catalog confusion:
1. keep the type/schema additions
2. reduce surfaced families to the highest-confidence set:
   - `FWD Invest First Summit`
   - `FWD Invest First Max`
   - `AIA Pro Achiever 3.0`
   - `HSBC Wealth Focus`
3. leave the full inventory document intact for later re-expansion

## Ready-For-Implementation Gate
Phase 0 is ready to code when all of these are true:
- current wrapper/subfund merge lane is out of the way
- branch starts from the correct post-merge base
- the companion inventory doc is accepted as the source list
- reviewer agrees that `PRUActive LinkGuard` stays out of selector surfacing
