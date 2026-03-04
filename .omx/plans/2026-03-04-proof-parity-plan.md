# Proof Feature Parity Plan (SG FIRE Planner)

Date: 2026-03-04
Owner: Codex planning pass
Status: Draft ready for implementation

## Requirements Summary

Locked scope from user:
1. Representative paths: `P10/P25/P50/P75/P90 + best/worst`.
2. Historical mode uses calibrated `SG <- US` proxy when SG history is missing.
3. Per-point provenance required (`actual`, `proxy`, `mixed`) in chart tooltip and export.
4. SG mode permanently hides LTCG in all Proof views.
5. Full drilldown required for both historical cycles and MC representative paths.
6. Proof lives inside the existing Stress Test page/tab system.
7. CSV export and compare workspace are included in the same implementation phase (not deferred).

## Current-State Anchors (Code Evidence)

1. Stress Test tabs currently expose `monte-carlo`, optional `mc-projection`, `backtest`, `sequence-risk`, but no Proof tab/workspace.
   - `frontend/src/pages/StressTestPage.tsx:616-653`
2. MC projection already uses representative paths, but only 5 percentile options.
   - `frontend/src/components/simulation/MCProjectionTable.tsx:26-32`
   - `frontend/src/components/simulation/MCProjectionTable.tsx:47-50`
3. MC engine extracts representative paths only for `[10,25,50,75,90]`.
   - `frontend/src/lib/simulation/monteCarlo.ts:815-869`
4. Backtest has dataset modes (`us_only`, `sg_only`, `blended`) and currently drops years where SG equity is null.
   - `frontend/src/lib/simulation/backtest.ts:101-106`
   - `frontend/src/lib/simulation/backtest.ts:116-124`
5. Backtest detailed window currently returns only balances/withdrawals/returns/inflation arrays, not full account/tax/event detail rows.
   - `frontend/src/lib/simulation/backtest.ts:276-284`
   - `frontend/src/lib/simulation/backtest.ts:345-421`
6. Projection engine already supports replay with externally supplied yearly returns + offset.
   - `frontend/src/lib/calculations/projection.ts:110-115`
   - `frontend/src/lib/calculations/projection.ts:487-489`
7. Projection row model is SG-tax-centric (`sgTax`) and has no LTCG field.
   - `frontend/src/lib/types.ts:895-977`
8. SG historical equity starts at 1988 in current data.
   - `frontend/src/lib/data/historicalReturnsFull.ts:170`
   - `frontend/src/lib/simulation/backtest.test.ts:205-220`

## Architecture Decision (Recommended)

Use a **shared Proof data model** and keep existing Backtest behavior stable.

- Build a new Proof data orchestration layer that produces a unified `ProofCycle[]` from:
  1. MC representative paths (7 paths).
  2. Historical blended cycles with proxy augmentation and provenance.
- Reuse `generateProjection()` replay for both sources to power drilldown rows (account/tax/event fields), instead of building separate per-source UI models.
- Keep existing Backtest tabs/semantics intact (avoid regressions in current backtest results and tests).

Rationale:
- Minimizes risk to current stress-test behavior.
- Reuses existing projection row richness for the full drilldown ask.
- Gives one UI for cycle/year interaction regardless of source.

## Implementation Steps

### Phase 1: Data Contracts + Store Plumbing (1-2 days)

1. Extend proof/simulation types.
   - File: `frontend/src/lib/types.ts`
   - Add:
     - `ProofSource = 'mc' | 'historical_blended'`
     - `ProofChartType = 'minmaxmean' | 'time_series' | 'individual_cycles' | 'spending_vs_returns'`
     - `ProofMetricType = 'portfolio' | 'spending'`
     - `ProofProvenance = 'actual' | 'proxy' | 'mixed'`
     - representative path label/type support (percentile/best/worst)
2. Persist Proof UI state in simulation store.
   - File: `frontend/src/stores/useSimulationStore.ts`
   - Add fields with migrations (bump persisted version): source, metric, chart type, outlier visibility, selected cycle index, selected simulation year.

Acceptance criteria:
- Store rehydrates with safe defaults for existing users.
- New type contracts compile cleanly with no downstream breakage.

### Phase 2: Monte Carlo Representative Path Parity (1-2 days)

1. Extend MC representative extraction from 5 to 7 paths.
   - File: `frontend/src/lib/simulation/monteCarlo.ts`
   - Keep percentile picks `10/25/50/75/90`.
   - Add explicit `best` and `worst` path picks (by selection metric aligned with existing logic).
2. Update MC path consumers.
   - File: `frontend/src/components/simulation/MCProjectionTable.tsx`
   - Include best/worst in selector labels.
3. Update tests.
   - File: `frontend/src/lib/simulation/monteCarlo.test.ts`
   - Validate path count=7, labels/types present, ordering stable.

Acceptance criteria:
- MC output always includes 7 representative paths when extraction is enabled.
- Existing percentile path behavior remains unchanged.

### Phase 3: Historical Blended + Calibrated Proxy + Provenance (3-5 days)

1. Create historical proof builder module.
   - New file: `frontend/src/lib/simulation/proofHistorical.ts`
   - Input: allocation weights, duration, blend settings, projection params.
   - Output: normalized `ProofCycle[]` with yearly returns + provenance arrays.
2. Implement SG proxy calibration over overlap window.
   - Regression model: `r_sg = alpha + beta * r_us + residual` (fit on overlap years where SG and US both exist).
   - For missing SG years, infer SG via calibrated mapping and residual policy.
3. Build blended returns with provenance tags.
   - Years with full SG data: `actual`.
   - Years with inferred SG component: `proxy`.
   - Cycle-level or point-level blend with mixed composition: `mixed` where applicable.
4. Add unit tests.
   - New test file: `frontend/src/lib/simulation/proofHistorical.test.ts`
   - Cases: overlap calibration validity, no-NaN outputs, provenance coverage, deterministic reproducibility.

Acceptance criteria:
- Historical blended cycles extend before 1988 while exposing provenance clearly.
- No silent fallback; every inferred year is marked.

### Phase 4: Proof Workspace UI + Chart Controls (3-4 days)

1. Add Proof tab in Stress Test.
   - File: `frontend/src/pages/StressTestPage.tsx`
   - Add tab trigger/content and mount Proof container.
2. Build Proof controls panel.
   - New file: `frontend/src/components/proof/ProofControls.tsx`
   - Controls:
     - Metric Type (`Portfolio`/`Spending`)
     - Chart Type (`Min/Max/Mean`, `Time Series`, `Individual Cycles`, `Spending vs Returns`)
     - Outliers toggle (for Min/Max mode)
     - Source switch (`Monte Carlo`, `Historical Blended`)
3. Build chart renderer.
   - New file: `frontend/src/components/proof/ProofChart.tsx`
   - Modes:
     - Min/Max/Mean bands
     - Time Series (all cycles)
     - Individual cycle focus
     - Spending vs Returns (bar/dual-series layout)
4. Add “How to read Proof” helper content.
   - New file: `frontend/src/components/proof/ProofHelp.tsx`

Acceptance criteria:
- All four chart modes function for both sources.
- Outlier toggle only affects Min/Max rendering.
- Tooltips show provenance for historical/proxy points.

### Phase 5: Full Drilldown (Cycle + Simulation Year) (3-4 days)

1. Build unified drilldown modal/sheet.
   - New file: `frontend/src/components/proof/ProofDrilldown.tsx`
2. Two-slider interaction.
   - Cycle slider: chooses cycle/path.
   - Simulation-year slider: chooses year within selected cycle.
3. Drilldown data source unification.
   - For both MC and historical cycles, replay `generateProjection()` with selected cycle yearly returns and proper offset.
   - Reuse projection rows for:
     - account changes table (liquid NW/CPF/property slices)
     - yearly events list
     - tax panel (SG income tax only)
     - allocation donut/snapshot
4. Wire drilldown launch from Proof page (`Analyze Year-by-year data`).

Acceptance criteria:
- Drilldown works identically for MC and historical sources.
- Selected cycle/year updates all panels consistently.
- Provenance visible in drilldown header/tooltip.

### Phase 6: SG Tax Parity + Export Hardening (1-2 days)

1. Ensure Proof summary schema excludes LTCG permanently.
   - Files: Proof summary/table components (new), any shared summary components used by Proof.
2. Ensure exports and tooltips never reference LTCG in SG mode.
3. Add/extend Proof CSV export payload:
   - include selected source, cycle id, simulation year, and per-point provenance.
   - ensure tax columns remain SG-only (no LTCG).

Acceptance criteria:
- No LTCG labels/fields in Proof UI or exports.
- Table metrics include only SG-relevant tax metrics.
- CSV export includes provenance and is consistent with on-screen Proof data.

### Phase 7: Compare Workspace (In-scope) (2-3 days)

1. Add compare panel over saved scenarios in Stress Test Proof context.
   - Reuse scenario storage in `frontend/src/lib/scenarios.ts` and manager UI.
2. Allow loading one/many scenarios into compare rows with per-row Proof summary cards.
3. Support row-level actions (remove row, open in Proof context).

## Risks and Mitigations

1. Risk: regressions in existing backtest semantics.
   - Mitigation: isolate proxy logic in Proof-specific module; avoid changing `runBacktest()` defaults.
2. Risk: performance for Time Series with many cycles.
   - Mitigation: pre-sample and cap rendered lines, memoize transformed chart datasets.
3. Risk: user confusion around proxy years.
   - Mitigation: strong provenance badges in legend + tooltip + drilldown header + export columns.
4. Risk: mismatch between projection replay and simulation path assumptions.
   - Mitigation: explicit replay tests that compare selected MC path balances with projection replay within tolerance.

## Verification Steps

1. Unit tests:
   - `frontend/src/lib/simulation/monteCarlo.test.ts`
   - `frontend/src/lib/simulation/proofHistorical.test.ts` (new)
2. Component tests (targeted):
   - Proof controls state transitions
   - Source switching and chart mode switching
   - Drilldown slider interactions
3. Manual QA script:
   - MC source → all chart modes
   - Historical blended source → all chart modes
   - Drilldown open/close and cycle/year sync
   - Provenance visibility in tooltip and export
   - Compare workspace: add/remove scenarios and verify row-by-row parity values
   - Confirm no LTCG anywhere in Proof
4. Commands:
   - `cd frontend && npm run type-check`
   - `cd frontend && npm run test`
   - `cd frontend && npm run lint`

## Delivery Estimate

1. Core parity + export + compare (Phases 1-7): **15-22 engineering days**.
2. With additional UX polish and regression buffer: **16-24 days**.

## Definition of Done

1. Proof tab supports both sources (MC representative + historical blended proxy).
2. Full chart controls parity delivered.
3. Full drilldown delivered with cycle/year sliders and year detail panels.
4. Provenance present in chart/tooltips/export.
5. LTCG absent from SG Proof UI and outputs.
6. Compare workspace works inside Stress Test and shows multi-scenario rows.
7. All tests and checks pass.
