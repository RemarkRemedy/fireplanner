# Agent-Friendly Feature Checklist

Use this checklist for any new page or feature that should be operable by a browser agent or in-browser AI.

This checklist complements:

- [browser AI full product plan v2](/Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-12-browser-ai-full-product-plan-v2.md)
- [browser agent reference slice spec](/Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-12-browser-agent-reference-slice-spec.md)
- [browser agent reference slice execution plan](/Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-12-browser-agent-reference-slice-execution-plan.md)

## Read Model

- Define a route-level read model or adapter shape for the page. Do not leave the page understandable only through JSX.
- Keep calculations in pure functions or derived hooks. Do not trap important business logic inside render-only code.
- Make current visible state explicit. If the page uses local UI state that changes what the user sees, surface it to the snapshot/adapter layer.
- Prefer extending `PlannerContextSnapshot` with a route overlay instead of inventing one-off page summaries.

## State And Semantics

- Tag money fields with the correct basis: `real`, `nominal`, or `mixed_derived`.
- Tag values with owner scope where relevant: `self`, `partner`, `shared`, or `household`.
- Keep per-adult and household outputs explicit. Do not silently flatten person-specific data into one unlabeled value.
- Use real revision and identity signals when state freshness matters. Do not invent ad hoc stale checks.

## Actions

- Model meaningful actions as typed tools or typed executors, not DOM-driving.
- Split actions into read-only, preview, and commit/apply behavior where appropriate.
- Require preview plus explicit confirmation before destructive or material state changes.
- Validate before mutation if the underlying store action has no rollback path.

## React Boundary

- Keep pure builders/executors in `frontend/src/lib/agent-tools/`.
- Keep React wiring thin in hooks such as `usePlannerAgentContext` or `usePlannerAgentTools`.
- Compose existing derived hooks before reaching for raw store reconstruction.
- Prefer page-to-hook handoff for local visible state over hidden implicit coupling.

## Result Quality

- Ensure charts and visual summaries have an equivalent structured representation.
- Keep visible page summaries consistent with the actual display basis and active view.
- If a feature is unsupported in the first slice, return an explicit `unsupported_context` or warning instead of silently guessing.

## Done Criteria

A feature is agent-friendly when:

- the current page state can be read through a stable structured contract
- important actions can be previewed or applied through typed capabilities
- stale confirmation can be detected reliably
- scope and basis attribution remain explicit
- the agent path uses app state and calculation contracts, not UI scraping
