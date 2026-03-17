# Browser Agent Reference Slice Spec

## Purpose

This document turns the browser-agent product plan into an implementation-grade spec for the first local tool slice.

This slice is intentionally narrow. It proves:

- canonical read snapshots for Dashboard and Projection
- one deterministic previewable mutation
- one real confirmed commit path
- one Monte Carlo execution wrapper
- companion-boundary and safety contract tests

It does **not** try to prove transport preview, UI surfaces, or broad mutation coverage in the same slice.

## Grounding In The Current Codebase

Primary read-side sources:

- `frontend/src/hooks/useDashboardMetrics.ts`
- `frontend/src/hooks/useAdjustedFireNumber.ts`
- `frontend/src/hooks/useProjection.ts`
- `frontend/src/hooks/usePerAdultBreakdown.ts`
- `frontend/src/hooks/useHouseholdRuntimeInputs.ts`
- `frontend/src/hooks/useIncomeProjection.ts` via `useNormalizedLegacyAnalysisContext`
- `frontend/src/hooks/useSectionCompletion.ts`
- `frontend/src/hooks/useMonteCarloWorkerQuery.ts`

Primary mutation and scenario foundations:

- `frontend/src/stores/useHouseholdPlanStore.ts`
- `frontend/src/stores/useSimulationStore.ts`
- `frontend/src/lib/household/scenarios.ts`
- `frontend/src/lib/household/normalizedAnalysisCache.ts`

Companion types reused across the boundary:

- `frontend/src/lib/companion/types.ts`
- `frontend/src/lib/companion/resultsPayload.ts`

## Reference Slice Scope

Routes:

- Dashboard
- Projection

Tools in scope:

- `get_planner_snapshot`
- `preview_retirement_age_change`
- `commit_parameter_change`
- `run_simulation`

Required proof points:

- read snapshots must work before any Monte Carlo run
- read assembly must stay scenario-aware and must not fall back to raw baseline store state
- preview must be deterministic and non-mutating
- commit must require confirmation and reject stale revisions
- simulation execution must use the existing worker pipeline without giving `lib/` executors raw store access

Deferred from this slice:

- shared-plan / import preview tooling
- human-facing AI drawer and confirmation dialogs
- rendered text summaries beyond basic debug/test output
- route coverage beyond Dashboard and Projection

## Directory / Layering Decision

Keep phone / companion integration in:

- `frontend/src/lib/companion/`

Create the local browser-agent layer in:

- `frontend/src/lib/agent-tools/types.ts`
- `frontend/src/lib/agent-tools/snapshotBuilder.ts`
- `frontend/src/lib/agent-tools/toolRegistry.ts`
- `frontend/src/lib/agent-tools/adapters/dashboardAdapter.ts`
- `frontend/src/lib/agent-tools/adapters/projectionAdapter.ts`
- `frontend/src/lib/agent-tools/executors/previewRetirementAge.ts`
- `frontend/src/lib/agent-tools/executors/commitRetirementAge.ts`
- `frontend/src/lib/agent-tools/executors/runSimulation.ts`

Thin React wiring:

- `frontend/src/hooks/usePlannerAgentContext.ts`
- `frontend/src/hooks/usePlannerAgentTools.ts`

## Core Snapshot Model

## Design choice

Use a composable model:

- `PlannerContextSnapshotCore`
- one route overlay
- optional `mcResults`

This keeps the canonical read model stable without pretending every route exposes the same fields.

## Types

```ts
type MoneyBasis = 'real' | 'nominal' | 'mixed_derived'
type SubjectScope = 'self' | 'partner' | 'shared' | 'household'
type SnapshotStatus = 'ready' | 'incomplete' | 'invalid' | 'stale'

interface PlannerContextSnapshot {
  schemaVersion: 1
  snapshotId: string
  createdAtUtc: string
  core: PlannerContextSnapshotCore
  routeOverlay: DashboardRouteOverlay | ProjectionRouteOverlay
  mcResults: MonteCarloSummary | null
  warnings: SnapshotWarning[]
  nextQuestions: SnapshotQuestion[]
}

interface PlannerContextSnapshotCore {
  route: '/dashboard' | '/projection'
  pageLabel: 'Dashboard' | 'Projection'
  activeSectionId?: string
  activeSectionLabel?: string
  planType: 'individual' | 'couple' | 'household'
  pathway?: 'goal-first' | 'story-first' | 'already-fire'
  status: SnapshotStatus
  revisions: SnapshotRevisions
  uiContext: {
    mode: 'simple' | 'advanced'
    dollarBasis: 'real' | 'nominal'
  }
  viewState: {
    dashboardView?: 'joint' | string
    projectionView?: 'joint' | string
    activeTabId?: string
  }
  scenarioContext: {
    hasScenarioOverrides: boolean
    scenarioOverrideHash: string
  }
  subjectContext: {
    selectedScope: SubjectScope
    selectedAdultId?: string
    selectedAdultLabel?: string
    referenceAdultId: string
    referenceAdultLabel: string
  }
  validation: SnapshotValidation
}

interface SnapshotRevisions {
  householdPlanRevision: number
  householdRevision: string
  allocationRevision: number
  simulationRevision: number
  withdrawalRevision: number
}

interface SnapshotValidation {
  hasAnyErrors: boolean
  sectionStatuses: SnapshotSectionStatus[]
}

interface SnapshotSectionStatus {
  sectionId: string
  sectionLabel: string
  sourceStatus: 'default' | 'customized' | 'error'
  snapshotStatus: 'needs_review' | 'configured' | 'error'
  errorCount: number
}

interface SnapshotWarning {
  code: string
  label: string
  severity: 'info' | 'warning' | 'blocking'
  ownerScope?: SubjectScope
  moneyBasis?: MoneyBasis
  message: string
}

interface SnapshotQuestion {
  id: string
  label: string
  prompt: string
}
```

## Snapshot identity / revision semantics

`snapshotId` must be deterministic and derived from:

- route
- `viewState`
- `householdPlanRevision`
- `scenarioContext.scenarioOverrideHash`
- `allocationRevision`
- `simulationRevision`
- `withdrawalRevision`

Use `householdPlanRevision` as the stale / commit token. Use `householdRevision` only as a derived cache identity string where existing normalized-analysis helpers require it.

Important distinction:

- `householdPlanRevision` is the write-safety token for plan mutations
- `snapshotId` is the preview-confirmation token for the full visible state, including view state and non-plan revisions

## Route overlays

## Dashboard overlay

Use already-derived data from:

- `useDashboardMetrics()`
- `useAdjustedFireNumber()`
- `useProjection()`
- `usePerAdultBreakdown()` when available

```ts
interface DashboardRouteOverlay {
  kind: 'dashboard'
  summaryCards: DashboardSummaryCard[]
  portfolioSummary: {
    totalNetWorth: SnapshotMetric | null
    lifeExpectancy: SnapshotMetric
    fireAge: SnapshotMetric | null
    yearsToFire: SnapshotMetric | null
    portfolioDepletedAge: SnapshotMetric | null
  }
  fireTargetSummary: {
    fireNumber: SnapshotMetric | null
    projectionFireNumber: SnapshotMetric | null
    progress: SnapshotMetric | null
    savingsRate: SnapshotMetric | null
    deviationPct: SnapshotMetric | null
    deviationFactors: string[]
  }
  projectionSummary: {
    fireAchievedAge: SnapshotMetric | null
    peakTotalNW: SnapshotMetric | null
    peakTotalNWAge: SnapshotMetric | null
    terminalLiquidNW: SnapshotMetric | null
    terminalTotalNW: SnapshotMetric | null
  } | null
  perAdultSummary: DashboardPerAdultSummary[] | null
}

interface DashboardSummaryCard {
  id: string
  label: string
  ownerScope: SubjectScope
  valueType: 'money' | 'percent' | 'integer'
  value: number | null
  moneyBasis?: MoneyBasis
  source: string
}

interface DashboardPerAdultSummary {
  adultId: string
  displayName: string
  ownerScope: 'self' | 'partner'
  annualIncome: SnapshotMetric
  annualExpenses: SnapshotMetric
  totalNetWorth: SnapshotMetric
  incomeSharePct: SnapshotMetric
  netWorthSharePct: SnapshotMetric
}
```

`perAdultSummary` must be `null` for single-adult plans because `usePerAdultBreakdown()` already returns `null` in that case.

## Projection overlay

Use:

- `useProjection()`
- `useUIStore().projectionView`
- `useUIStore().dollarBasis`
- display-basis transforms that currently live in `frontend/src/pages/ProjectionPage.tsx`

The adapter must match the visible page state, not just the raw hook output. That means it must mirror or extract the page-local:

- joint vs per-adult slicing
- real-vs-nominal display transforms
- display summary adaptation

```ts
interface ProjectionRouteOverlay {
  kind: 'projection'
  visibleBasis: 'real' | 'nominal'
  projectionView: 'joint' | string
  summary: {
    fireAchievedAge: SnapshotMetric | null
    peakTotalNW: SnapshotMetric | null
    peakTotalNWAge: SnapshotMetric | null
    terminalLiquidNW: SnapshotMetric | null
    terminalTotalNW: SnapshotMetric | null
    portfolioDepletedAge: SnapshotMetric | null
    totalGoalShortfall: SnapshotMetric | null
    totalRetirementWithdrawalShortfall: SnapshotMetric | null
    mediSaveDepletionAge: SnapshotMetric | null
  } | null
  rowStats: {
    rowCount: number
    startAge: number | null
    endAge: number | null
  }
  activeStrategy: {
    strategyId: string
    strategyLabel: string
  }
}
```

## Shared metric shape

```ts
interface SnapshotMetric {
  id: string
  label: string
  ownerScope: SubjectScope
  valueType: 'money' | 'percent' | 'integer' | 'text'
  value: number | string | null
  moneyBasis?: MoneyBasis
  source: string
  comparableTo?: string[]
  notes?: string[]
}
```

## `MonteCarloSummary` adapter

This is a snapshot-layer camelCase adapter over the existing `PlannerResultsPayload`.

```ts
interface MonteCarloSummary {
  source: 'planner_results_payload'
  available: boolean
  ownerScope: 'household'
  pSuccess?: number
  wrSafe95?: number
  wrSafe90?: number
  wrSafe85?: number
  wrSafe50?: number
  projectedFireAgeP50?: number
  requiredPortfolio?: number
  annualExpensesTargetReal?: number
  horizonYears?: number
  simulationMethod?: 'parametric' | 'bootstrap' | 'fat_tail'
}
```

Adapter rules:

- `null` means no Monte Carlo result is available
- field values come from `PlannerResultsPayload`
- snake_case is transformed once at this boundary
- all MC output fields are household-level, not per-adult

## Tool Contracts

The registry stays typed, but the first slice only locks four tools.

```ts
type PlannerToolId =
  | 'get_planner_snapshot'
  | 'preview_retirement_age_change'
  | 'commit_parameter_change'
  | 'run_simulation'

type PlannerToolEffect = 'read_only' | 'preview_only' | 'commit'

interface PlannerToolDefinition<TInput, TOutput, TDeps> {
  id: PlannerToolId
  effect: PlannerToolEffect
  title: string
  inputSchemaVersion: 1
  outputSchemaVersion: 1
  inputGuard: (input: unknown) => input is TInput
  execute: (input: TInput, deps: TDeps) => Promise<TOutput> | TOutput
}
```

## Tool 1: `get_planner_snapshot`

Purpose:

- return the canonical `PlannerContextSnapshot` for the current route and visible view state

Input:

```ts
interface GetPlannerSnapshotInput {
  route: '/dashboard' | '/projection'
  detail: 'standard' | 'detailed'
}
```

Output:

```ts
type GetPlannerSnapshotOutput = PlannerContextSnapshot
```

Assembly rule:

- `usePlannerAgentContext` must compose existing derived hooks
- it must not try to rebuild Dashboard or Projection calculations from raw stores or from `useHouseholdRuntimeInputs()` alone
- for Dashboard, it must receive the page-local `selectedView` from `DashboardPage.tsx` because that state is currently local component state rather than store-backed

Required hook composition:

- `useNormalizedLegacyAnalysisContext()`
- `useHouseholdRuntimeInputs()`
- `useDashboardMetrics()` when route is Dashboard
- `useAdjustedFireNumber()` when route is Dashboard
- `useProjection()` when route is Dashboard or Projection
- `usePerAdultBreakdown()` when route is Dashboard
- `useSectionCompletion()`
- `useWithdrawalStore()` for `withdrawalRevision`
- `useUIStore()` for visible view state

First-slice Dashboard rule:

- `dashboardView` is passed explicitly from `DashboardPage.tsx` into the snapshot assembly hook
- this slice does not assume Dashboard visible state can be inferred from `useUIStore()`

## Tool 2: `preview_retirement_age_change`

Purpose:

- compute a non-mutating deterministic preview of changing one adult's retirement age

This tool does **not** run Monte Carlo.

It should use:

- `applyHouseholdScenarioOverrides()` from `frontend/src/lib/household/scenarios.ts`
- the same normalized-analysis inputs already assembled in the hook layer
- the same deterministic projection / metric paths already used by Dashboard and Projection

Input:

```ts
interface PreviewRetirementAgeChangeInput {
  baseSnapshotId: string
  householdPlanRevision: number
  adultId: string
  nextRetirementAge: number
}
```

Pure executor deps:

```ts
interface PreviewRetirementAgeDeps {
  householdPlanRevision: number
  householdRevision: string
  baseSnapshot: PlannerContextSnapshot
  currentPlan: HouseholdPlan
  referenceAdultId: string
  baselineSummary: {
    fireAge: number | null
    yearsToFire: number | null
    peakTotalNW: number | null
    terminalLiquidNW: number | null
    terminalTotalNW: number | null
  }
  runtimeInputs: PreviewRuntimeInputs
  projectionInputs: {
    visibleBasis: 'real' | 'nominal'
    projectionView: 'joint' | string
  }
  scenarioContext: {
    hasScenarioOverrides: boolean
    scenarioOverrideHash: string
    scenarioOverrides: HouseholdScenarioOverrides | null
  }
}
```

```ts
interface PreviewRuntimeInputs {
  profile: ProfileState
  income: IncomeState
  property: PropertyState
  normalized: ReturnType<typeof useNormalizedLegacyAnalysisContext>
  householdPlanRevision: number
  hasValidationErrors: boolean
}
```

Important rule:

- the pure executor in `lib/agent-tools/executors/previewRetirementAge.ts` must not call hooks
- `usePlannerAgentTools` is responsible for passing these already-computed deps into the executor

Output:

```ts
interface PreviewRetirementAgeChangeOutput {
  baseSnapshotId: string
  baseHouseholdPlanRevision: number
  previewSignature: string
  mutation: {
    parameterId: 'adult.retirementAge'
    adultId: string
    ownerScope: 'self' | 'partner'
    before: number
    after: number
  }
  summaryDiff: {
    fireAgeDelta: number | null
    yearsToFireDelta: number | null
    peakTotalNWDelta: number | null
    terminalLiquidNWDelta: number | null
    terminalTotalNWDelta: number | null
  }
  warnings: SnapshotWarning[]
  validation: {
    status: 'valid' | 'invalid'
    issues: ToolValidationIssue[]
  }
}
```

Preview rules:

- if `adultId` is missing or unknown, return `invalid`
- if `nextRetirementAge` is outside valid bounds, return `invalid`
- if target adult is ambiguous, require explicit `adultId`
- if the active context is scenario-adjusted in a way the commit path cannot safely preserve, return a blocking issue instead of silently flattening the scenario

Existing code reuse:

- scenario override application should use `applyHouseholdScenarioOverrides()`
- deterministic delta computation should reuse the same pure projection / metric builders used behind current Dashboard and Projection hooks

## Tool 3: `commit_parameter_change`

Purpose:

- apply one real deterministic parameter mutation after explicit confirmation

First-slice restriction:

- only `adult.retirementAge`

Input:

```ts
interface CommitParameterChangeInput {
  baseSnapshotId: string
  expectedHouseholdPlanRevision: number
  parameterId: 'adult.retirementAge'
  adultId: string
  nextRetirementAge: number
  confirmed: true
}
```

Output:

```ts
interface CommitParameterChangeOutput {
  applied: boolean
  previousHouseholdPlanRevision: number
  nextHouseholdPlanRevision: number
  changedField: {
    parameterId: 'adult.retirementAge'
    adultId: string
    ownerScope: 'self' | 'partner'
    before: number
    after: number
  }
  postCommitSnapshot: PlannerContextSnapshot
  warnings: SnapshotWarning[]
}
```

Commit rules:

- compare `expectedHouseholdPlanRevision` to current `useHouseholdPlanStore.getState().householdPlanRevision` before apply
- compare `baseSnapshotId` to the current pre-commit snapshot identity before apply
- reject if stale
- require explicit `confirmed: true`
- reject if target adult is ambiguous or missing
- perform bounds / existence validation **before** calling `updateAdult()` because the current store mutation path has no rollback

Stale-confirmation rule:

- `expectedHouseholdPlanRevision` protects the write target itself
- `baseSnapshotId` protects the full confirmed preview context, including `allocationRevision`, `simulationRevision`, `withdrawalRevision`, `scenarioOverrideHash`, and visible view state
- if either check fails, the commit must reject as stale

Current code path:

```ts
useHouseholdPlanStore.getState().updateAdult(adultId, {
  retirementAge: nextRetirementAge,
})
```

Linked-field rule for V1:

- this slice does not promise automatic adjustment of linked timing fields such as CPF Life or SRS drawdown configuration
- if the preview or commit path detects likely linked-review implications, it must return a warning requiring manual review

Required proof:

1. snapshot before preview
2. deterministic preview result
3. explicit confirm
4. validated store mutation via `updateAdult`
5. `householdPlanRevision` increment
6. re-read snapshot
7. stale rejection when either the plan revision or full snapshot identity changes between preview and commit

## Tool 4: `run_simulation`

Purpose:

- run Monte Carlo through the existing worker pipeline and return `MonteCarloSummary`

Architectural rule:

- the tool registry must not rebuild simulation params from raw stores
- the React assembly layer must pass a simulation-ready dependency contract into the pure executor

Input:

```ts
interface RunSimulationInput {
  overrides?: {
    annualExpenses?: number
    retirementAge?: number
  }
}
```

Runtime deps:

```ts
interface RunSimulationDeps {
  route: '/dashboard' | '/projection'
  viewScope: 'joint' | string
  householdPlanRevision: number
  householdRevision: string
  scenarioOverrideHash: string
  buildEngineParams: (
    overrides?: RunSimulationInput['overrides']
  ) => MonteCarloEngineParams
  runWorker: (
    params: MonteCarloEngineParams
  ) => Promise<MonteCarloResult>
}
```

Output:

```ts
interface RunSimulationOutput {
  mcResults: MonteCarloSummary
  rawResultAvailable: boolean
  staleAgainstCurrentState: boolean
}
```

Current code path:

- `useMonteCarloWorkerQuery`
- `buildMonteCarloEngineParams`
- `runMonteCarloWorker`

First-slice simulation rule:

- `run_simulation` is supported only for joint / household-visible contexts
- if Projection is in a per-adult view, the tool must return `unsupported_context` rather than silently choosing between joint and sliced-adult Monte Carlo inputs
- per-adult Monte Carlo already exists as a code path in `useMonteCarloWorkerQuery`, but it is out of scope for this slice until the result ownership contract expands beyond household-level MC summaries

## Validation / Error Model

```ts
interface ToolValidationIssue {
  code: string
  severity: 'info' | 'warning' | 'blocking'
  message: string
  ownerScope?: SubjectScope
  moneyBasis?: MoneyBasis
}

interface PlannerToolError {
  code:
    | 'invalid_input'
    | 'stale_revision'
    | 'blocked_confirmation'
    | 'unsupported_context'
    | 'simulation_failed'
  message: string
  retryable: boolean
}
```

## Snapshot assembly rules

## Primary assembly sources

For read snapshots, prefer:

- `useNormalizedLegacyAnalysisContext()`
- `useHouseholdRuntimeInputs()`
- existing route-derived hooks

Do not rebuild visible route state from raw stores when a route already exposes a derived hook.

## Dashboard source map

- `planType`: `useHouseholdPlanStore((s) => s.plan.planType)`
- `revisions.withdrawalRevision`: `useWithdrawalStore((s) => s.withdrawalRevision)`
- `uiContext.mode`: `useUIStore((s) => s.mode)`
- `uiContext.dollarBasis`: `useUIStore((s) => s.dollarBasis)`
- `viewState.dashboardView`: explicit page-provided `selectedView` from `DashboardPage.tsx`
- `scenarioContext`: `useNormalizedLegacyAnalysisContext()`
- `subjectContext`: derive from selected view and `usePerAdultBreakdown()`
- `validation`: adapt from `useSectionCompletion()`
- dashboard metrics: `useDashboardMetrics()`
- adjusted FIRE metrics: `useAdjustedFireNumber()`
- projection summary: `useProjection().summary`

## Projection source map

- `revisions.withdrawalRevision`: `useWithdrawalStore((s) => s.withdrawalRevision)`
- `uiContext.dollarBasis`: `useUIStore((s) => s.dollarBasis)`
- `viewState.projectionView`: `useUIStore((s) => s.projectionView)`
- `subjectContext.selectedScope`: based on `projectionView`
- `routeOverlay.summary`: use a Projection-page-equivalent display adapter, not raw nominal-only `useProjection().summary`
- `activeStrategy`: selected strategy plus label from existing simulation state

## Validation mapping

Map `useSectionCompletion()` statuses exactly:

- `default` -> `needs_review`
- `customized` -> `configured`
- `error` -> `error`

## Field-level basis mapping table

This table applies only to the first slice.

## Dashboard

| Field | Source | Owner | Basis | Notes |
|---|---|---|---|---|
| `fireNumber` | `useDashboardMetrics().fireNumber` | `household` | `mixed_derived` | Compare only with fields already normalized to the same basis. |
| `projectionFireNumber` | `useAdjustedFireNumber().projectionFireNumber` | `household` | `mixed_derived` | Comparable to `fireNumber`, not to generic balance values. |
| `progress` | `useDashboardMetrics().progress` | `household` | n/a | Ratio. |
| `yearsToFire` | `useDashboardMetrics().yearsToFire` | `household` | n/a | Age delta. |
| `fireAge` | `useDashboardMetrics().fireAge` | `household` | n/a | Age output. |
| `savingsRate` | `useDashboardMetrics().savingsRate` | `household` | n/a | Percent. |
| `totalNetWorth` | `useDashboardMetrics().totalNetWorth` | `household` | `nominal` | Present-day stored balances. |
| `portfolioDepletedAge` | `useDashboardMetrics().portfolioDepletedAge` | `household` | n/a | Age output. |
| `peakTotalNW` | display-adapted projection summary | `household` | visible UI basis | Must come from the same display adapter used by Projection. |
| `terminalLiquidNW` | display-adapted projection summary | `household` | visible UI basis | Same display-basis rule. |
| `terminalTotalNW` | display-adapted projection summary | `household` | visible UI basis | Same display-basis rule. |
| `perAdult.annualIncome` | `usePerAdultBreakdown()` | `self` / `partner` | `nominal` | Null-path safe for single-adult plans. |
| `perAdult.annualExpenses` | `usePerAdultBreakdown()` | `self` / `partner` | `nominal` | Personal-only expenses. |
| `perAdult.totalNetWorth` | `usePerAdultBreakdown()` | `self` / `partner` | `nominal` | Present-day balances. |

## Projection

| Field | Source | Owner | Basis | Notes |
|---|---|---|---|---|
| `fireAchievedAge` | Projection display adapter | `household` or active adult view | n/a | Age output. |
| `peakTotalNW` | Projection display adapter | `household` or active adult view | visible UI basis | Must match current page display transform. |
| `peakTotalNWAge` | Projection display adapter | `household` or active adult view | n/a | Age output. |
| `terminalLiquidNW` | Projection display adapter | `household` or active adult view | visible UI basis | Deflated when UI basis is real. |
| `terminalTotalNW` | Projection display adapter | `household` or active adult view | visible UI basis | Same rule. |
| `portfolioDepletedAge` | Projection display adapter | `household` or active adult view | n/a | Age output. |
| `totalGoalShortfall` | Projection display adapter | `household` or active adult view | visible UI basis | Never expose raw nominal value while the UI is in real basis. |
| `totalRetirementWithdrawalShortfall` | Projection display adapter | `household` or active adult view | visible UI basis | Same rule. |
| `mediSaveDepletionAge` | Projection display adapter | active owner or household context | n/a | Age output. |

## `mixed_derived` example

First-slice example:

- Dashboard `projectionFireNumber` is derived from projection output and normalized by `useAdjustedFireNumber()` into the same basis as the formula-side FIRE number.

Therefore it is:

- safe to compare to `fireNumber`
- not safe to compare to unrelated nominal balance fields

## Required tests for the reference slice

1. `PlannerContextSnapshot` builds for Dashboard without MC results.
2. `PlannerContextSnapshot` builds for Projection in both nominal and real visible-basis views.
3. Projection snapshot output matches the page-level display transform for joint and per-adult views.
4. `perAdultSummary` is `null` and does not throw for single-adult plans.
5. `MonteCarloSummary` correctly adapts an existing `PlannerResultsPayload`.
6. `preview_retirement_age_change` produces deterministic deltas without mutating state.
7. `commit_parameter_change` validates before mutation, mutates via `updateAdult`, and rejects stale confirmation when either the plan revision or snapshot identity changed.
8. companion-boundary contract test:
  - snapshot assembly does not mutate stores
  - scenario-adjusted context does not silently flatten to baseline raw-store state
  - couple plans preserve member shape and `referenceAdultId`
  - revision tokens change when inputs change
9. `run_simulation` rejects Projection per-adult view as `unsupported_context` in the first slice.

## Minimum analytics additions

Use existing `trackEvent()` only if this slice ends up exposing human-triggered entry points.

Potential event names:

- `agent_preview_generated`
- `agent_commit_confirmed`
- `agent_commit_rejected_stale`
- `agent_simulation_run`

These are optional for the reference slice.

## Implementation order

1. Add shared types in `lib/agent-tools/types.ts`
2. Implement snapshot builders and route adapters
3. Implement `get_planner_snapshot`
4. Implement deterministic preview executor
5. Implement commit executor using `updateAdult`
6. Implement simulation executor wrapper using hook-provided deps
7. Add contract tests

## Out of scope for this spec

- transport preview / import preview
- AI drawer, preview dialog, or sidebar surfaces
- broad generic mutation tooling beyond `adult.retirementAge`
- full route coverage beyond Dashboard + Projection
- ILP route integration
- assistant-specific bridges
- protocol-specific browser adapters such as WebMCP bindings
