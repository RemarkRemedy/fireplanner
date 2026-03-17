# Browser AI Full Product Plan v2

## Objective

Make Fireplanner agent-operable in the browser while staying local-first, privacy-preserving, and compatible with future browser-agent standards without depending on them today.

The target is no longer primarily:

- generate a good snapshot
- render a good prompt
- hand the user something to paste into an AI

The revised target is:

- expose a canonical structured read model
- expose a canonical typed local tool/action model
- let browser AI or assistant-like browser capabilities inspect and operate the planner through structured capabilities
- require preview and explicit confirmation for material state changes

This is still a full-product plan, not an MVP.

## Product Framing

### What "agent-operable" means for Fireplanner

For Fireplanner, agent-operable means:

- a local browser assistant can inspect planner state through typed read capabilities
- a local browser assistant can request planner operations through typed action capabilities
- the app can preview the effect of an operation before it mutates durable state
- the user remains in control of commits through explicit confirmation
- all of this works without assuming Fireplanner sends planner data to Fireplanner servers or becomes backend-orchestrated SaaS

### How this differs from the previous handoff-first model

The previous handoff-first model treated the browser AI primarily as a conversational endpoint:

- Fireplanner builds a snapshot
- Fireplanner renders a prompt or summary
- the user copies it into an assistant

That remains useful as a fallback UX, but it should no longer be the primary architecture.

The revised model treats the assistant as a local tool consumer:

- Fireplanner exposes structured state
- Fireplanner exposes typed capabilities
- assistants or assistant-like browser mediators can call those capabilities locally
- Fireplanner returns typed results, previews, warnings, and confirmations

### Problems this solves for users

This direction reduces:

- manual translation of planner state into prompts
- brittle screenshot-only workflows
- ambiguous scope in household mode
- accidental cross-basis reasoning between real and nominal values
- UI automation fragility from DOM-driven assistants

It improves:

- explainability
- reversibility
- safety
- future browser-agent interoperability
- reuse of planner calculations instead of re-deriving intent from the UI

## Core Architectural Decision

Do not build a disconnected AI domain model.

Instead, extend the existing companion-layer foundation and add a typed local tool model on top of it.

The feature should build on:

- `frontend/src/lib/companion/types.ts`
- `frontend/src/lib/companion/resultsPayload.ts`
- `frontend/src/lib/companion/actionImpacts.ts`
- `frontend/src/hooks/useCompanionPlannerBridge.ts`

The companion layer already contains:

- normalized planner payloads
- scenario/result comparison patterns
- pure calculation-oriented helpers
- local bridge patterns for planner state and results

The revised product should share companion types and result-shape patterns, but most of the browser-agent tool/action layer is genuinely new code.

### Honest reuse boundary

What is reused:

- `PlannerResultsPayload` structure and schema discipline
- scenario/result comparison patterns
- freshness-signature thinking
- pure helper style
- selected bridge concepts from companion mode

What is new:

- planner-context snapshot assembly for non-companion routes
- typed local tool registry
- preview-versus-commit runtime model
- structured diff format
- confirmation UX and state
- transport preview/apply split

The plan should therefore frame this as:

- share companion types where useful
- build a new browser-agent layer alongside companion integration

not as "the companion layer already is the local tool framework."

### File placement decision

Keep `frontend/src/lib/companion/` scoped to phone/companion integration.

Create a sibling browser-agent layer, for example:

- `frontend/src/lib/agent-tools/types.ts`
- `frontend/src/lib/agent-tools/snapshotBuilder.ts`
- `frontend/src/lib/agent-tools/renderers.ts`
- `frontend/src/lib/agent-tools/adapters/`
- `frontend/src/lib/agent-tools/tools/`
- `frontend/src/lib/agent-tools/executors/`

This new layer should import shared companion result types where needed rather than relocating companion files or giving `lib/companion/` dual responsibility.

It should not reuse these companion files as if they were already the browser-agent runtime:

- `PlannerSnapshotResponse` remains a remote DTO for phone/companion flows
- `companionBridge.ts` remains a remote snapshot import bridge
- `actionImpacts.ts` remains a Monte Carlo-oriented analysis helper, not the generic local preview runtime

## Canonical Contracts

## 1. Canonical read contract: `PlannerContextSnapshot`

`PlannerContextSnapshot` remains the canonical structured read model.

It should be the single source of truth for:

- AI-readable current state
- AI-readable page summaries
- preview diffs
- rendered text summaries and prompts
- future browser-agent tool responses

It should extend the companion payload family rather than replace it.

### Relationship to existing companion types

- `PlannerResultsPayload` remains the normalized result payload seed for result-heavy routes
- `PlannerContextSnapshot` composes planner/page/scope/validation metadata around result payload fragments
- `PlannerResultsPayload` must be treated as Monte Carlo-specific output, not as a required base snapshot shape
- rendered summaries and prompts are output views over `PlannerContextSnapshot`

This matters because Dashboard and Projection must work before any Monte Carlo run exists.

The canonical model should therefore treat MC output as optional:

- the raw companion boundary remains `PlannerResultsPayload | null`
- the snapshot-level field should be an adapted camelCase view, for example `mcResults: MonteCarloSummary | null`

and define an explicit MC-absent narration path for routes where no simulation has been run yet.

### Suggested field structure

```ts
type MoneyBasis = 'real' | 'nominal' | 'mixed_derived'
type SubjectScope = 'self' | 'partner' | 'shared' | 'household'
type SnapshotStatus = 'ready' | 'incomplete' | 'invalid' | 'stale'

interface PlannerContextSnapshot {
  schemaVersion: number
  snapshotId: string
  createdAtUtc: string
  route: string
  pageLabel: string
  activeSectionId?: string
  activeSectionLabel?: string
  planType: string
  pathway?: string
  status: SnapshotStatus
  structuralRevision: string
  uiContext: {
    mode: 'simple' | 'advanced'
    dollarBasis: 'real' | 'nominal'
  }
  viewState: {
    projectionView?: string
    simulationView?: string
    dashboardView?: 'joint' | string
    activeTabId?: string
    expandedPanelIds?: string[]
  }
  subjectContext: {
    selectedScope: SubjectScope
    selectedAdultId?: string
    selectedAdultLabel?: string
  }
  keyInputs: SnapshotField[]
  validation: SnapshotValidation
  mcResults?: MonteCarloSummary | null
  outputs?: SnapshotOutputBlock[]
  warnings: SnapshotWarning[]
  nextQuestions: SnapshotQuestion[]
}

interface MonteCarloSummary {
  source: 'planner_results_payload'
  available: boolean
  pSuccess?: number
  wrSafe95?: number
  wrSafe90?: number
  wrSafe85?: number
  wrSafe50?: number
  projectedFireAgeP50?: number
  requiredPortfolio?: number
  annualExpensesTargetReal?: number
}

interface SnapshotField {
  id: string
  label: string
  ownerScope: SubjectScope
  valueType: 'money' | 'percent' | 'integer' | 'text' | 'enum' | 'boolean'
  value: unknown
  moneyBasis?: MoneyBasis
  source: string
}

interface SnapshotOutputBlock {
  id: string
  label: string
  ownerScope: SubjectScope
  moneyBasis?: MoneyBasis
  source: string
  summary: string
  metrics: SnapshotMetric[]
}

interface SnapshotMetric {
  id: string
  label: string
  ownerScope: SubjectScope
  value: unknown
  valueType: 'money' | 'percent' | 'integer' | 'text'
  moneyBasis?: MoneyBasis
  source: string
}

interface SnapshotValidation {
  sectionStatuses: Array<{
    sectionId: string
    sectionLabel: string
    status: 'configured' | 'needs_review' | 'error' | 'hidden'
    errorCount?: number
  }>
  hasAnyErrors: boolean
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

`snapshotId` should be deterministic for materially identical planner/view state, using the same general philosophy as freshness signatures in companion-mode code rather than a random identifier.

The companion boundary may continue to use snake_case payloads internally.

The browser-agent snapshot should adapt those values into camelCase before embedding them in `PlannerContextSnapshot`, so consumers do not navigate mixed naming conventions inside one logical object.

Display vocabulary may still use "joint" in some UI surfaces, but the canonical contract should align to the existing codebase vocabulary and map:

- `shared` contract scope -> "joint" display label where that is the established user-facing term

### Required invariants

1. Any per-adult or household-sensitive field must include explicit `ownerScope`.
2. Any narrated or returned money value that could be compared across pages must include `moneyBasis`.
3. Any output block must identify its source domain so the app never silently merges incompatible derived contexts.
4. MC outputs should default to `ownerScope: 'household'` unless a route-specific per-adult derived summary explicitly provides narrower attribution.
5. `mixed_derived` values must be treated as non-comparable to pure `real` or pure `nominal` values unless a route adapter explicitly defines a safe comparison rule.

### Basis interpretation rules

- `real`: safe to compare against other `real` values in the same semantic domain
- `nominal`: safe to compare against other `nominal` values in the same semantic domain
- `mixed_derived`: displayable and explainable, but not safe for generic numeric comparison against pure `real` or `nominal` values

Any route adapter that emits `mixed_derived` output must provide explicit comparison guidance or suppress cross-basis comparison language.

Implementation planning must include a field-level basis mapping table for any reused result payload fields and narrated route outputs. Generic basis tagging is not sufficient on its own.

## 2. Canonical action/tool contract

On top of the read model, define a typed local tool/action contract.

Suggested working name:

- `PlannerToolDefinition`
- `PlannerToolCall`
- `PlannerToolResult`

The internal architecture should not assume a specific transport such as WebMCP, but the contracts should be shaped so they can later be exposed through browser-mediated capability systems cleanly.

### Tool categories

1. Context reads
2. Page summaries
3. Scenario reads
4. Parameter mutation tools
5. Simulation execution tools
6. Preview/commit transport tools

### Suggested field structure

```ts
type PlannerToolCategory =
  | 'context_read'
  | 'page_summary'
  | 'scenario_read'
  | 'parameter_mutation'
  | 'simulation_execution'
  | 'transport_preview'
  | 'transport_commit'

type PlannerToolEffect = 'read_only' | 'preview_only' | 'commit'

interface PlannerToolDefinition {
  id: string
  category: PlannerToolCategory
  effect: PlannerToolEffect
  title: string
  description: string
  requiresConfirmation: boolean
  requiresPreviewToken: boolean
  inputSchemaVersion: number
  outputSchemaVersion: number
}

interface PlannerToolCall<TInput = unknown> {
  toolId: string
  callId: string
  requestedAtUtc: string
  baseSnapshotId?: string
  previewToken?: string
  input: TInput
}

interface PlannerToolResult<TOutput = unknown> {
  ok: boolean
  callId: string
  toolId: string
  effect: PlannerToolEffect
  output?: TOutput
  validation?: ToolValidationResult
  warnings?: SnapshotWarning[]
  error?: PlannerToolError
}

interface ToolValidationResult {
  status: 'valid' | 'invalid' | 'blocked_confirmation' | 'stale_preview'
  issues: ToolValidationIssue[]
}

interface ToolValidationIssue {
  code: string
  severity: 'info' | 'warning' | 'blocking'
  message: string
  ownerScope?: SubjectScope
  moneyBasis?: MoneyBasis
}

interface PlannerToolError {
  code: string
  message: string
  retryable: boolean
}
```

### Suggested tool families

#### Read-only tools

- `get_current_context`
- `get_page_summary`
- `get_section_summary`
- `get_dashboard_summary`
- `get_projection_summary`
- `get_stress_test_summary`
- `list_scenarios`
- `get_scenario_comparison`
- `get_transport_preview`

#### Preview tools

- `preview_parameter_change`
- `preview_retirement_age_change`
- `preview_expense_change`
- `preview_allocation_change`
- `preview_withdrawal_strategy_change`
- `preview_import_json`
- `preview_import_shared_plan`

#### Commit/apply tools

- `apply_parameter_change`
- `apply_allocation_change`
- `apply_withdrawal_strategy_change`
- `run_simulation`
- `apply_import_json`
- `apply_import_shared_plan`

`run_simulation` is not destructive, but it is stateful and potentially expensive enough to treat as a controlled action rather than a casual read.

## Error model and validation model

All tools should return:

- structured validation state
- structured warnings
- structured errors

This avoids forcing assistants to infer failure from prose.

Tool failures should be classified as:

- invalid input
- blocked by confirmation
- stale preview
- unsupported route/state
- internal calculation failure

## Safety / Confirmation Model

The revised plan introduces a first-class confirmation model.

### Tool classes

#### Class A: read-only tools

No planner mutation.

Examples:

- context reads
- page summaries
- scenario reads

Requirements:

- no confirmation required
- no preview token required
- still return warnings and basis/scope metadata

#### Class B: preview-only tools

No persistent mutation, but computes a prospective change.

Examples:

- preview expense change
- preview retirement age change
- preview allocation change
- preview import

Requirements:

- no commit
- returns a typed diff
- returns a `previewToken`
- returns the `baseSnapshotId` or equivalent revision anchor

#### Class C: commit/apply tools

Persistent or material change to planner state.

Examples:

- apply parameter change
- apply import
- save scenario or overwrite scenario
- any destructive replace flow

Requirements:

- requires matching `previewToken` for material changes
- requires explicit user confirmation
- rejects stale preview if planner state has changed since preview
- returns applied diff summary

### Confirmation policy

Require explicit confirmation for:

- cross-person changes
- household-wide changes
- imports or overwrite flows
- strategy changes with broad downstream impact
- any change where owner scope or basis could be ambiguous

### Diff / preview representation

Preview results should return structured diffs rather than freeform prose.

Suggested shape:

```ts
interface PlannerActionPreview {
  previewToken: string
  baseSnapshotId: string
  effectType: 'parameter_change' | 'simulation_run' | 'import_replace' | 'import_merge_like'
  changedFields: Array<{
    fieldId: string
    label: string
    ownerScope: SubjectScope
    moneyBasis?: MoneyBasis
    before: unknown
    after: unknown
  }>
  downstreamImpacts?: SnapshotOutputBlock[]
  warnings: SnapshotWarning[]
}
```

### Preventing silent mistakes

To avoid silent cross-person or cross-basis mistakes:

1. Every changed field in a preview must include `ownerScope`.
2. Any downstream metric in a preview must include `moneyBasis`.
3. Commit tools must reject ambiguous inputs where scope or basis cannot be determined.
4. The confirmation UI must repeat the affected scope and basis in human-readable form.

## Integration With Current Code

## Existing foundation to build on

### `frontend/src/lib/companion/types.ts`

Use as the seed for:

- shared snapshot/result schemas
- planner result payload reuse
- durable schema-versioning patterns

The revised plan should share compatible result types across the boundary, but broader planner-context and tool contracts should live in the new `lib/agent-tools/` layer rather than being appended into `lib/companion/`.

### `frontend/src/lib/companion/resultsPayload.ts`

Use as the seed for:

- result-heavy output normalization
- summary-ready metric blocks for Dashboard / Projection / Stress Test-like surfaces

Do not re-derive equivalent result payloads in a separate AI layer.

### `frontend/src/lib/companion/actionImpacts.ts`

Use as the pattern for:

- pure typed action helpers
- clearly defined input/output contracts
- mutation preview logic for action levers

This is the closest existing shape to a local typed tool/action helper.

However, it should not be treated as the general preview engine for parameter-change tools. It is Monte Carlo-specific and lever-specific.

For non-mutating preview semantics, the closer foundation is the existing scenario/override pattern in:

- `frontend/src/lib/scenarios.ts`

### `frontend/src/hooks/useCompanionPlannerBridge.ts`

Use as the pattern for:

- local bridge thinking
- scenario/result coordination
- snapshot/result synchronization concepts

The browser-agent architecture should generalize the idea of a planner bridge locally rather than invent a totally separate runtime model.

This should be read as a runtime-pattern reference, not as evidence that the companion bridge already solves local tool orchestration.

### Assembly hook rule

Any React assembly hook, including a potential `useAIContext`, must be formatting/assembly-oriented only.

It must:

- accept already-computed page outputs and companion-aware results as parameters where relevant
- use existing derived hooks/selectors as inputs
- avoid independently reconstructing scenario state from raw stores when a page already has overridden or bridged state

It must not:

- re-read raw stores and assume they represent the same scenario-adjusted state visible in companion-aware flows
- duplicate the scenario override logic already coordinated by `useCompanionPlannerBridge`

## Existing selectors/hooks/stores to reuse

Primary sources:

- `useHouseholdRuntimeInputs`
- `useAllocationStore`
- `useSimulationStore`
- `useWithdrawalStore`
- `useUIStore`
- `useSectionCompletion`

Derived read sources where possible:

- route/page-specific metric hooks
- projection hooks
- dashboard metric hooks
- scenario comparison hooks
- `usePerAdultBreakdown` for explicit non-MC per-adult attribution

Rule:

- reuse derived hooks for summaries when they already express the planner's intended logic
- do not make the AI layer recalculate business logic that already exists elsewhere
- include route-specific stores only where the active route needs them

Use `useHouseholdPlanStore` primarily for commit/apply actions and structural metadata, not as the first source for read summaries when `useHouseholdRuntimeInputs` or route-derived hooks already compile the runtime planner inputs.

Route-scoping note:

- retirement-planning routes should not pull `useIlpStore`
- ILP Review can define its own route adapter later if and when that route is included in the supported AI/tool surface

## Minimum refactors required

### 1. Resolve-vs-apply split for transport flows

Current flows:

- `importFromJson()` resolves, validates, applies, and reloads in one path
- shared-plan URL flow resolves then immediately offers replace/apply

Required refactor:

- split transport into resolve/validate/summarize and apply/commit phases

This affects:

- `frontend/src/lib/exportImport.ts`
- `frontend/src/lib/shareUrl.ts`
- `frontend/src/components/shared/PlanUrlHandler.tsx`

This should be treated as a medium refactor, not a minimum wrapper change, because current helpers apply immediately and some flows reload the page inside the helper path.

Safer migration path:

- add a validation-and-summary helper first
- hold the resolved import/share preview in caller state
- keep final apply logic separate until preview UX is verified

### 2. Structured preview pipeline

Parameter changes and imports need a preview token pipeline:

- build preview against current snapshot revision
- return typed diff
- commit only against matching preview

`preview_parameter_change` should mean a lightweight deterministic preview using existing route-derived calculations and scenario-style non-mutating overrides.

Monte Carlo remains a separate tool via `run_simulation`, not an implicit part of every preview path.

Section-status mapping is also required here.

`useSectionCompletion` currently reports:

- `default`
- `customized`
- `error`

The browser-agent layer must include an explicit adapter mapping from those values into snapshot-facing validation language.

### 3. Thin React wiring over pure builders

Pure builders stay in `lib/`.

React wiring should only:

- gather route/store/hook data
- open UI
- invoke tool registry
- coordinate confirmation dialogs

This thin layer should prefer receiving precomputed route models rather than rebuilding them from raw store state.

For simulation execution specifically, the tool registry should not secretly reconstruct full Monte Carlo inputs from every store itself.

Instead, route/runtime assembly should pass:

- prebuilt Monte Carlo engine params
- or a route-approved simulation request object that the existing pipeline converts into engine params

### 4. Existing UI store extension

AI drawer open/closed state, selected detail level, and pending confirmation dialog state should be added to `useUIStore`.

No new Zustand store.

Persistence decision must be explicit:

- if AI panel state is persisted, `useUIStore` persist version must be bumped from 11 to 12 with a migration path
- if AI panel state is transient, it must be excluded via the existing `partialize` pattern

Do not add persisted UI fields silently.

## Runtime Model

The product should be designed so the same internal tool registry can be consumed by:

1. Fireplanner's own AI drawer/panel
2. a browser-mediated assistant bridge
3. future WebMCP- or MCP-style environments
4. testing/dev harnesses

without changing the planner's internal contracts.

### Vendor-neutral local access model

Do not assume a specific browser standard today.

Instead, structure the system as:

- internal canonical snapshot builders
- internal canonical tool registry
- thin runtime adapters

The runtime adapters can later expose tools through:

- in-app UI
- browser-injected bridges
- WebMCP-style transports
- other browser capability layers

The core contracts should remain useful even if browser-agent standards change.

### Why not DOM-driving as the primary architecture

DOM-driving or click-driving should not be the primary plan because it:

- is brittle
- misses planner semantics
- obscures scope and basis
- cannot guarantee safe previews and confirmation discipline

DOM-level automation can remain a fallback or accessibility aid, but not the core architecture.

### Why typed store/calculation actions are preferred

Typed actions:

- operate on planner semantics directly
- can return structured diffs
- can reuse existing calculation layers
- can enforce preview and confirmation
- are transport-agnostic

## UX Surfaces

The UI changes because the assistant can now act, not just read.

### 1. AI drawer/panel

This becomes the primary orchestration surface.

Responsibilities:

- display current `PlannerContextSnapshot`
- expose available tools for the current route
- show standard vs detailed summaries
- show tool previews
- mediate confirmation
- show structured success/failure results

State ownership:

- `useUIStore`

### 2. AI action group

This replaces ad hoc "copy prompt" thinking with a capabilities-oriented surface.

Example actions:

- inspect current context
- summarize this page
- preview change
- run simulation
- preview import
- copy summary as fallback

### 3. Preview dialogs

Preview dialogs become first-class because local actionability requires them.

Use them for:

- parameter mutations
- strategy changes
- import/share overwrites
- household-wide changes

Dialogs should emphasize:

- affected scope
- affected fields
- basis tags where relevant
- downstream changes

### 4. Current-state banners

Still valuable, but now they support both:

- human orientation
- AI action framing

They should make explicit:

- current page
- current section
- selected scope
- completion/error status

### 5. Transport previews

Import/share UX becomes a controlled operation rather than a blunt replace action.

The UI must expose:

- what will change
- what will not change
- validation warnings
- confirmation affordance

### 6. Copy/export fallback

Copyable summaries and prompts remain part of the product, but as fallback and interoperability helpers, not the primary architecture.

## Rollout Plan

This remains a full-product program, but the build should validate the read/action model through a reference slice before broad expansion.

### Reference slice first

The first architecture-proving slice should cover:

1. read-only context tool
2. one preview mutation tool
3. one commit/apply tool with confirmation
4. one simulation execution tool
5. one transport preview flow

Recommended first workflow pair:

- Dashboard + Projection
- plus one transport flow

Reason:

- they already have rich derived outputs
- they exercise both read and result semantics
- they force money-basis discipline
- they provide a good place to validate previews before moving to Inputs and Stress Test

The reference slice must also prove companion-boundary compatibility.

If Stress Test is not included directly in the first slice, add explicit contract tests against companion-boundary inputs and outputs so snapshot/tool assembly cannot diverge from scenario-aware planner state.

This should be a required gate, not an optional hedge.

### Recommended first routes/workflows

1. `get_current_context` on Dashboard
2. `get_projection_summary`
3. `preview_retirement_age_change`
4. `commit_parameter_change` for one real deterministic change path
5. `run_simulation` for a controlled scenario
6. `preview_import_shared_plan`

The concrete commit path for the reference slice should be a single deterministic field mutation with visible downstream impact, for example:

- preview retirement age change on Projection
- confirm and apply retirement age change
- re-read updated snapshot
- verify stale-preview rejection if the underlying planner revision changes before commit

This proves:

- snapshot building
- tool registry
- preview tokens
- confirmation model
- transport resolve-vs-apply split
- companion-boundary compatibility, either through Stress Test inclusion or required contract tests

### What to defer until the model is validated

Defer:

- wide route coverage
- large prompt/template inventory
- assistant-specific adapters
- richer scenario-editing actions
- complex ILP Review integration if the page is not yet stable

This is not because those are out of scope forever, but because they should build on a validated read/action model, not precede it.

### Sequencing note

The transport resolve-vs-apply refactor is foundation work for the action model, not late polish.

Recommended order inside implementation planning:

1. canonical snapshot + tool contracts
2. transport resolve/preview/apply split
3. reference slice on Dashboard + Projection
4. companion-boundary validation via Stress Test or required contract tests
5. broader route expansion

## Acceptance Criteria

## Product

1. A browser AI or assistant-like browser mediator can inspect planner state through typed local read capabilities without requiring Fireplanner to send planner data to Fireplanner servers.
2. A browser AI can request planner operations through typed local actions rather than DOM-driving as the primary method.
3. The planner remains assistant-agnostic and does not fork by vendor.

## Technical

1. `PlannerContextSnapshot` is the canonical structured read model.
2. The action/tool contract is canonical and typed.
3. The action model is a new browser-agent layer that shares companion result types and patterns rather than creating a disconnected domain.
4. Pure builders and renderers live in `lib/`; React wiring remains thin.
5. AI UI state lives in `useUIStore`.
6. Observability remains within `trackEvent()` and the existing analytics plumbing.

## UX

1. Users can inspect current state, preview changes, and confirm commits through coherent AI-oriented surfaces.
2. Current-state banners and preview dialogs clearly communicate scope and basis.
3. The non-AI flow remains usable and is not replaced by agent-only UX.

## Safety

1. Read-only tools never mutate planner state.
2. Preview tools never mutate planner state and always return typed diffs.
3. Commit/apply tools require explicit confirmation for material changes.
4. Material commits reject stale previews.
5. Cross-person and cross-basis ambiguity is surfaced as a validation issue, not silently applied.

## ADR

### Decision

Revise the browser-AI product plan from handoff-first to snapshot-plus-typed-local-tools with explicit preview and confirmation semantics.

### Drivers

- Fireplanner is a local-first browser app
- the user wants agent-operability for UX reasons, not server-side orchestration
- structured local capabilities are safer and more durable than prompt-only handoff
- existing companion types and pure action helpers provide a strong foundation
- browser-agent interoperability is likely to evolve, so internal abstractions should be transport-agnostic

### Alternatives considered

1. Keep the handoff-only model
   Rejected because it leaves too much value on the table and keeps the user as the translation layer.

2. Build a backend-first or SaaS orchestration model
   Rejected because it conflicts with the app's local-first and privacy-preserving direction.

3. Use DOM automation as the main architecture
   Rejected because it is brittle and loses planner semantics.

4. Build a generic MCP server answer
   Rejected because the goal is a real local product architecture first, not protocol theater.

### Consequences

- the product now requires a typed tool/action layer, not just read summaries
- preview and confirmation become core architectural features
- transport flows need real refactors
- future browser-agent transports become easier because the internal contracts are already well-defined

### Follow-ups

- define `PlannerContextSnapshot` precisely against existing companion types
- define the first tool registry and preview token model
- define Dashboard/Projection reference slice in detail
- define a field-level basis mapping table for reused metrics and narrated outputs
- define the minimal new analytics events to add to `AnalyticsEvent`, if any
