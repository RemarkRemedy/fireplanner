# Browser Agent Reference Slice Execution Plan

## Purpose

This document translates the reference-slice spec into an execution plan with concrete batches, dependencies, and test gates.

Scope of this execution plan:

- Dashboard + Projection canonical snapshot assembly
- one deterministic preview path
- one real confirmed commit path
- one Monte Carlo execution wrapper
- contract tests that prove read, preview, commit, and scenario-aware behavior

Explicitly deferred from this execution plan:

- transport preview refactors for shared links / imports
- AI drawer or other human-facing UI surfaces
- analytics beyond any minimal event additions that become unavoidable during implementation

This plan assumes these documents are the source of truth:

- [browser-ai-full-product-plan-v2](/Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-12-browser-ai-full-product-plan-v2.md)
- [browser-agent-reference-slice-spec](/Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-12-browser-agent-reference-slice-spec.md)

## Execution Principles

1. Keep the slice honest: prove the local read/action model before transport or UI work.
2. Compose existing derived hooks instead of re-deriving route state from raw stores.
3. Keep pure builders and executors in `lib/agent-tools/`.
4. Pass precomputed route/runtime deps into executors from hook land.
5. Validate before mutation because `updateAdult()` does not provide rollback.
6. Treat Projection display-basis parity as a first-class contract, not a polish task.

## Planned File Areas

### New files

- `frontend/src/lib/agent-tools/types.ts`
- `frontend/src/lib/agent-tools/snapshotBuilder.ts`
- `frontend/src/lib/agent-tools/toolRegistry.ts`
- `frontend/src/lib/agent-tools/adapters/dashboardAdapter.ts`
- `frontend/src/lib/agent-tools/adapters/projectionAdapter.ts`
- `frontend/src/lib/agent-tools/executors/previewRetirementAge.ts`
- `frontend/src/lib/agent-tools/executors/commitRetirementAge.ts`
- `frontend/src/lib/agent-tools/executors/runSimulation.ts`
- `frontend/src/hooks/usePlannerAgentContext.ts`
- `frontend/src/hooks/usePlannerAgentTools.ts`

### Existing files likely touched

- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/hooks/useDashboardMetrics.ts`
- `frontend/src/hooks/useAdjustedFireNumber.ts`
- `frontend/src/hooks/useProjection.ts`
- `frontend/src/hooks/usePerAdultBreakdown.ts`
- `frontend/src/hooks/useHouseholdRuntimeInputs.ts`
- `frontend/src/hooks/useIncomeProjection.ts`
- `frontend/src/hooks/useMonteCarloWorkerQuery.ts`
- `frontend/src/hooks/useSectionCompletion.ts`
- `frontend/src/pages/ProjectionPage.tsx`
- `frontend/src/stores/useHouseholdPlanStore.ts`
- `frontend/src/stores/useSimulationStore.ts`
- `frontend/src/stores/useWithdrawalStore.ts`

### Existing foundations intentionally reused

- `frontend/src/lib/companion/types.ts`
- `frontend/src/lib/companion/resultsPayload.ts`
- `frontend/src/lib/household/scenarios.ts`
- `frontend/src/lib/household/normalizedAnalysisCache.ts`

## Workstream 1: Contracts And Route Adapters

### Goal

Create the canonical type system and route overlay contracts, including the projection display adapter that matches the actual page view.

### Batch 1.1: base types and revision model

Files:

- `frontend/src/lib/agent-tools/types.ts`

Deliverables:

- `PlannerContextSnapshot`
- `PlannerContextSnapshotCore`
- `SnapshotRevisions` using:
  - `householdPlanRevision: number`
  - `householdRevision: string`
- `SnapshotValidation`
- `SnapshotMetric`
- `SnapshotWarning`
- `SnapshotQuestion`
- `MonteCarloSummary`
- `PlannerToolDefinition<TInput, TOutput, TDeps>`

Specific requirements:

- no `householdRevisionKey` field
- no `deps: unknown`
- stale / commit token is `householdPlanRevision`

Test gate:

- type-only compile passes
- no phantom revision fields remain in contracts

### Batch 1.2: status mapping and snapshot identity

Files:

- `frontend/src/lib/agent-tools/types.ts`
- `frontend/src/lib/agent-tools/snapshotBuilder.ts`

Deliverables:

- `useSectionCompletion()` mapping helper:
  - `default` -> `needs_review`
  - `customized` -> `configured`
  - `error` -> `error`
- deterministic snapshot id helper derived from:
  - route
  - view state
  - `householdPlanRevision`
  - `scenarioOverrideHash`
  - other relevant revisions

Test gate:

- unit tests for status mapping
- deterministic snapshot identity test

### Batch 1.3: dashboard adapter

Files:

- `frontend/src/lib/agent-tools/adapters/dashboardAdapter.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/lib/agent-tools/types.ts`

Deliverables:

- dashboard overlay builder from already-derived hook outputs
- explicit page-to-hook handoff for Dashboard `selectedView`
- support for MC-absent path
- support for `perAdultSummary === null` on single-adult plans

Test gate:

- adapter unit tests using mock hook-equivalent inputs
- Dashboard visible-state parity covered for joint vs per-adult selection
- single-adult null path covered
- couple path with explicit owner attribution covered

### Batch 1.4: projection adapter with page-display parity

Files:

- `frontend/src/lib/agent-tools/adapters/projectionAdapter.ts`
- `frontend/src/pages/ProjectionPage.tsx`
- `frontend/src/lib/agent-tools/types.ts`

Deliverables:

- projection overlay builder
- extracted or mirrored display-basis transform from `ProjectionPage.tsx`
- extracted or mirrored joint vs per-adult display logic from `ProjectionPage.tsx`

Test gate:

- unit tests for nominal vs real visible-basis cases
- unit tests for joint vs per-adult view
- adapter output matches current page display semantics for the same fixture

## Workstream 2: Snapshot Assembly And Read Tool

### Goal

Build the read model using real route-derived inputs and expose it through `get_planner_snapshot`.

### Batch 2.1: core snapshot builder

Files:

- `frontend/src/lib/agent-tools/snapshotBuilder.ts`
- `frontend/src/lib/agent-tools/types.ts`

Deliverables:

- pure `buildPlannerContextSnapshotCore()`
- pure `buildPlannerContextSnapshot()`

Test gate:

- unit tests for core snapshot assembly using mock revision and validation input

### Batch 2.2: thin React assembly hook

Files:

- `frontend/src/hooks/usePlannerAgentContext.ts`

Deliverables:

- route-aware assembly hook
- explicit page-provided Dashboard view input from `DashboardPage.tsx`
- explicit composition of:
  - `useNormalizedLegacyAnalysisContext()`
  - `useHouseholdRuntimeInputs()`
  - `useDashboardMetrics()`
  - `useAdjustedFireNumber()`
  - `useProjection()`
  - `usePerAdultBreakdown()`
  - `useSectionCompletion()`
  - `useWithdrawalStore()`
- no raw-store-only reconstruction of Dashboard or Projection state

Test gate:

- hook test proving the assembled snapshot matches derived hook outputs for the same fixture

### Batch 2.3: read tool wiring and companion-boundary contract test

Files:

- `frontend/src/lib/agent-tools/toolRegistry.ts`
- test under `frontend/src/lib/agent-tools/` or `frontend/src/hooks/`

Deliverables:

- `get_planner_snapshot`
- required scenario-aware contract test with concrete assertions:
  - snapshot assembly does not mutate stores
  - scenario-adjusted state does not silently flatten to baseline raw-store values
  - couple plans preserve member shape and `referenceAdultId`
  - revision tokens change when inputs change

Test gate:

- contract test must pass before preview / commit implementation starts

## Workstream 3: Deterministic Preview And Real Commit

### Goal

Prove the safety model end to end with one deterministic previewable mutation and one real commit path.

### Batch 3.1: preview retirement age change

Files:

- `frontend/src/lib/agent-tools/executors/previewRetirementAge.ts`
- `frontend/src/hooks/usePlannerAgentTools.ts`
- `frontend/src/lib/agent-tools/toolRegistry.ts`

Deliverables:

- `PreviewRetirementAgeDeps` contract
- deterministic preview executor
- hook-layer assembly of preview deps from already-computed route/runtime inputs
- scenario-aware blocking when active scenario overrides cannot be safely committed

Specific requirements:

- executor must not call hooks
- deps must include actual scenario override state, not only `scenarioOverrideHash`
- preview diffs must use baseline metrics already assembled by the hook layer

Test gate:

- unit tests for:
  - valid preview
  - invalid age bounds
  - missing adult
  - scenario-adjusted blocking case
  - diff structure
  - no state mutation

### Batch 3.2: commit retirement age change

Files:

- `frontend/src/lib/agent-tools/executors/commitRetirementAge.ts`
- `frontend/src/hooks/usePlannerAgentTools.ts`
- `frontend/src/lib/agent-tools/toolRegistry.ts`

Deliverables:

- explicit confirm-required commit path
- stale confirmation rejection using both `expectedHouseholdPlanRevision` and `baseSnapshotId`
- pre-commit validation before calling `updateAdult(...)`
- post-commit snapshot re-read
- linked-field warning when retirement-age changes may require manual review of other timing fields

Grounded mutation:

- `useHouseholdPlanStore.getState().updateAdult(...)`

Test gate:

- unit / integration tests for:
  - successful commit
  - stale revision rejection
  - stale snapshot identity rejection
  - invalid input rejected before mutation
  - revision bump after commit
  - snapshot changes after commit
  - linked-field warning path

### Batch 3.3: end-to-end reference mutation test

Files:

- integration test under `frontend/src/lib/agent-tools/` or `frontend/src/hooks/`

Deliverables:

- test proving:
  - snapshot
  - preview
  - confirm
  - commit
  - re-read snapshot

Test gate:

- required pass before simulation work can be considered done

## Workstream 4: Simulation Wrapper

### Goal

Wrap the existing Monte Carlo worker pipeline in a typed tool without coupling the executor to raw store types.

### Batch 4.1: simulation deps contract and summary adapter

Files:

- `frontend/src/lib/agent-tools/executors/runSimulation.ts`
- `frontend/src/lib/agent-tools/types.ts`

Deliverables:

- `RunSimulationDeps` contract with:
  - `route`
  - `viewScope`
  - `householdPlanRevision`
  - `householdRevision`
  - `scenarioOverrideHash`
  - `buildEngineParams(...)`
  - `runWorker(...)`
- `MonteCarloSummary` adapter from `PlannerResultsPayload`

Specific requirements:

- no `ReturnType<typeof useAllocationStore.getState>`
- no `ReturnType<typeof useSimulationStore.getState>`
- no raw store state objects passed into the pure executor
- Projection per-adult view must return `unsupported_context` in this slice rather than silently switching to per-adult Monte Carlo semantics

Test gate:

- unit tests for MC payload adaptation
- stale / current-state comparison test

### Batch 4.2: simulation hook wiring

Files:

- `frontend/src/hooks/usePlannerAgentTools.ts`
- `frontend/src/lib/agent-tools/toolRegistry.ts`

Deliverables:

- pass simulation-ready deps from the hook layer into the executor
- use the existing worker pipeline concepts from `useMonteCarloWorkerQuery`
- no hidden store reconstruction inside the executor

Test gate:

- integration test around `run_simulation` using route-derived dependencies
- explicit unsupported-context test for Projection per-adult view

## Workstream 5: Hardening And Acceptance Gates

### Goal

Close the slice with the tests that prove the architecture, not with new UI or transport scope.

### Batch 5.1: basis and ownership parity tests

Files:

- tests under `frontend/src/lib/agent-tools/`

Deliverables:

- Dashboard basis / owner assertions
- Projection visible-basis assertions
- MC summary owner assertions (`household`)

Test gate:

- field-level basis table in the spec is matched by tests for the first slice

### Batch 5.2: reference-slice acceptance pass

Scenarios:

- Dashboard without MC run
- Dashboard with couple plan and per-adult summary
- Dashboard single-adult null per-adult path
- Projection in nominal basis
- Projection in real basis
- Projection joint view
- Projection per-adult view
- preview retirement age change
- stale commit rejection
- stale snapshot identity rejection
- commit then re-read snapshot
- run simulation through typed wrapper
- run simulation rejected from Projection per-adult view

Deliverables:

- one acceptance checklist tied directly to the spec

## Dependency Order

1. Workstream 1
2. Workstream 2
3. Workstream 3 and Workstream 4 in parallel once Workstream 2 is stable
4. Workstream 5

Real parallelism window:

- Workstream 4 can proceed after the shared contracts and read assembly are stable
- Workstream 3 and Workstream 4 should not start before the scenario-aware read contract is proven

## Hard Gates

The following are stop-the-line gates:

1. No phantom revision contract fields remain.
2. Snapshot assembly must match route-derived state, including Projection display basis.
3. Companion-boundary contract test must pass before mutation work is accepted.
4. Preview must not mutate state.
5. Commit must validate before mutation, require confirmation, and reject stale confirmation from either the plan revision or the snapshot identity.
6. Simulation wrapper must not depend on raw store return types inside the pure executor.

## Acceptance Criteria For This Slice

### Product

1. Dashboard and Projection can produce a canonical planner snapshot.
2. The user can preview and commit one real deterministic change safely.
3. The user can run one typed simulation action through the existing Monte Carlo worker path.

### Technical

1. The browser-agent layer lives outside `lib/companion/`.
2. Snapshot assembly composes existing route-derived hooks instead of re-deriving from stores.
3. `householdPlanRevision` is the commit / stale token.
4. `householdRevision` is used only as the derived normalized-analysis identity where needed.
5. `RunSimulationDeps` is narrow and executor-safe.

### Safety

1. Preview does not mutate state.
2. Commit requires confirmation.
3. Stale revision is rejected.
4. Bounds are validated before `updateAdult(...)` is called.
5. Basis and owner metadata remain explicit in snapshot and preview outputs.

## Deferred To V2

- shared-plan / import preview refactor
- any changes to `frontend/src/lib/storeRegistry.ts`, `frontend/src/lib/shareUrl.ts`, or `frontend/src/lib/exportImport.ts`
- AI drawer, sidebar actions, preview dialogs, and current-state banners
- analytics additions unless the implementation unexpectedly requires them
