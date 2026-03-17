# Household UX Spec

Date: 2026-03-08
Owner: Codex planning pass
Status: Draft ready for implementation planning

## Requirements Summary

1. Household analysis must be fully modeled per adult, with a household rollup on top.
2. Names become the primary labels after setup; role tags are secondary context only.
3. Healthcare and Goals remain inside Spending as subsections, not separate top-level concepts.
4. Inputs, Projection, and Stress Test must use one consistent scope model.
5. The UI must stop implying per-adult fidelity where runtime behavior is still reference-adult-based.

## Product Decision

The product should move to a household-first model with explicit adult drilldowns:

- Top level: household summary and shared outcomes.
- Second level: adult-specific views for income, CPF, healthcare, retirement timing, and scenario effects.
- Row-level authoring: owner and age basis remain explicit where items are shared or transferable.

This replaces the current mixed model where one hidden adult selection affects some sections while other sections are owner-row based.

## Evidence From Current Implementation

- Inputs uses one shared `selectedAdultId`, but labels it as CPF-only in `frontend/src/pages/InputsPage.tsx:99-179`.
- People exposes raw role language and `Timing Anchor` in `frontend/src/components/household/PeopleSection.tsx:181-387`.
- Income is clearly adult-scoped in `frontend/src/components/household/IncomeSection.tsx:149-233`.
- Spending mixes household rows with adult-based defaults in `frontend/src/components/household/SpendingGoalsSection.tsx:186-340` and `frontend/src/components/household/SpendingGoalsSection.tsx:646-725`.
- Assets and Property are owner-row based in `frontend/src/components/household/AssetsPropertySection.tsx:97-220` and `frontend/src/components/household/AssetsPropertySection.tsx:224-320`.
- Allocation is global but anchored to a primary/reference adult in `frontend/src/components/household/AssumptionsSection.tsx:35-82` and `frontend/src/components/household/AssumptionsSection.tsx:137-147`.
- Projection still presents as generic single-path analysis in `frontend/src/pages/ProjectionPage.tsx:419-579`.
- Stress Test already has household presentation widgets in `frontend/src/pages/StressTestPage.tsx:1040-1129`.
- Household runtime inputs still flatten many values through a reference adult in `frontend/src/hooks/useHouseholdRuntimeInputs.ts:6-22` and `frontend/src/lib/household/runtimeLegacyInputs.ts:346-423`.
- Normalized analysis still derives Monte Carlo ages from one reference adult in `frontend/src/lib/household/toAnalysisInputs.ts:118-255`.

## UX Principles

1. Scope must always be visible.
2. Names first, roles second.
3. Household rollup and person drilldown must agree.
4. Shared rows stay explicit; adult defaults must never feel hidden.
5. Analysis wording must match engine truth.

## Target Information Architecture

### 1. Setup

Keep setup lightweight, but establish the language model early.

- `Plan setup`: `Individual`, `Couple`, `Household`.
- `Adults`: collect names and ages using plain language.
- `Dependents`: optional.
- `Include sections`: CPF, Healthcare, Property.

Clarify at setup time:

- The planner can track shared household items and adult-specific items.
- Results will show a household summary plus per-adult views.

Primary files:

- `frontend/src/pages/StartPage.tsx`
- `frontend/src/components/household/PlanTypeSelector.tsx`
- `frontend/src/components/household/HouseholdSetupWizard.tsx`
- `frontend/src/components/household/PeopleRosterEditor.tsx`

### 2. Inputs

Top-level sections should be:

1. People
2. Income
3. Spending
4. Assets
5. Property
6. CPF
7. FIRE Settings
8. Allocation

Notes:

- Remove standalone `Goals` and `Healthcare` sections from page-level IA.
- Keep `Healthcare` and `Goals` as Spending subsections.
- The section header should always state scope:
  - `Editing adult: Taylor`
  - `Section scope: adult-specific`
  - `Section scope: household rows`
  - `Section scope: shared portfolio assumptions`

### 3. Results

Both Projection and Stress Test should use the same layout:

1. Household summary bar
2. View toggle: `Household`, `Taylor`, `Jordan`, `Shared`
3. Result cards that restate subject in the label
4. Timeline / milestones with filters
5. Driver / breakdown panel with ranked contributors
6. Scenario comparison surface

Primary files:

- `frontend/src/pages/ProjectionPage.tsx`
- `frontend/src/pages/StressTestPage.tsx`
- `frontend/src/components/household/HouseholdOverviewBar.tsx`
- `frontend/src/components/household/HouseholdMilestoneTimeline.tsx`
- `frontend/src/components/household/HouseholdBreakdownPanel.tsx`
- `frontend/src/components/household/ScenarioLab.tsx`
- `frontend/src/components/simulation/MCProjectionTable.tsx`

## Terminology Spec

### Keep

- `Cost owner`
- `Shared`
- `Healthcare`
- `Goals`
- `Projection`
- `Stress Test`

### Replace

- `Editing CPF for` -> `Editing adult`
- `Self` -> `{Name} (You)` in setup-adjacent UI, then `{Name}` as primary label elsewhere
- `Partner` -> `{Name} (Partner)` where relationship context is useful, then `{Name}` as primary label elsewhere
- `Timing Anchor` -> `Age based on`
- `Reference adult` -> not user-facing
- `Primary adult` -> only use in technical/admin contexts, not core UX
- `Scenario` in percentile-path UI -> `Representative path`
- `Retirement balance` -> `Household balance at retirement` or `{Name}'s balance at retirement` depending on view

### Labeling Rules

- Post-setup, no raw `self` / `partner` tokens should appear in primary UI.
- Role tags may appear only as secondary badges or helper text.
- If a row depends on one adult's age, the control label must say so plainly.

## Section-Level UX Rules

### People

- Show adult cards using names first.
- Keep an explicit `Editing adult` selector or tabs for adult-scoped sections.
- Dependent rows must use:
  - `Cost owner`
  - `Age based on`
  - `Support start age`
  - `Support end age`

Primary files:

- `frontend/src/components/household/PeopleSection.tsx`

### Income

- Fully adult-scoped.
- All salary, tax, SRS, and life-event authoring should clearly target the active adult by name.
- Shared income should be explicit as shared, not silently inherited from the active adult.

Primary files:

- `frontend/src/components/household/IncomeSection.tsx`

### Spending

Subsections:

1. Living costs
2. Parent support
3. Healthcare
4. Retirement withdrawals
5. Goals

Rules:

- Each subsection should begin with a scope note.
- Each row uses `Cost owner` and `Age based on` where timing is person-relative.
- Adult-specific healthcare must be keyed to the chosen adult view, not a hidden fallback.

Primary files:

- `frontend/src/components/household/SpendingGoalsSection.tsx`

### Assets and Property

- Stay row-owner based.
- No hidden active-adult effects.
- Shared assets should explain how they contribute to the household rollup and adult drilldowns.

Primary files:

- `frontend/src/components/household/AssetsPropertySection.tsx`

### CPF

- Adult-scoped.
- The page should present CPF as another adult-specific section, not as a special case.
- The active adult label must be consistent with Income and Healthcare.

Primary files:

- `frontend/src/components/household/adapters/useHouseholdCpfAdapter.ts`
- `frontend/src/components/profile/CpfSection.tsx`

### FIRE Settings and Allocation

- Household-global.
- Any adult age used for defaults must be disclosed.
- Long term, glide path should support either household retirement sequencing or explicit adult basis selection.

Primary files:

- `frontend/src/components/household/AssumptionsSection.tsx`

## Results UX Spec

### Household Summary

Must show:

- household savings today
- household retirement gap
- first adult retirement
- final household outcome

Labels must restate scope. Avoid mixing household and individual concepts without naming the subject.

### Adult Drilldown

Each adult view should show:

- current age
- retirement age
- income path
- CPF path
- healthcare path
- personal milestones
- contribution to household savings and retirement gap

### Shared View

Show:

- shared costs
- shared assets
- shared property effects
- shared goals

### Scenario Comparison

Promote `ScenarioLab` into main results flow.

- compare base vs modified household
- compare adult retirement timing changes
- compare shared expense changes
- summarize who moved the result and by how much

## Engine Alignment Requirements

This is not optional if the product goal is truly per-adult analysis.

### Phase 1: Honest UX over current runtime

- Make current scope explicit in the UI.
- Remove misleading single-adult phrasing from household pages.
- Surface any remaining reference-adult behavior as a temporary limitation.

### Phase 2: Runtime decomposition

- Reduce reliance on `buildHouseholdRuntimeLegacyInputs()` for household analysis.
- Stop deriving projection and simulation ages from one reference adult in `toAnalysisInputs()`.
- Carry adult-specific timing, healthcare, CPF, and withdrawal inputs into analysis outputs.
- Produce result selectors that can back household and person views without relabeling the same aggregated output.

Primary files:

- `frontend/src/hooks/useHouseholdRuntimeInputs.ts`
- `frontend/src/lib/household/runtimeLegacyInputs.ts`
- `frontend/src/lib/household/toAnalysisInputs.ts`

## Acceptance Criteria

1. No post-setup primary UI uses raw `Self`, `Partner`, `Timing Anchor`, or `Reference adult`.
2. Inputs page no longer presents `Goals` and `Healthcare` as separate top-level sections.
3. Every major input section displays its scope explicitly.
4. Projection and Stress Test share one household information architecture.
5. Results support household and per-adult views using consistent labels.
6. Life events, healthcare, CPF, and adult timing edits visibly target a named adult.
7. Shared rows remain explicit and understandable in both authoring and results.
8. Runtime-backed result labels do not overstate per-adult fidelity.

## Implementation Phases

### Phase A: Copy and IA

- rename core labels
- collapse Goals and Healthcare into Spending navigation
- add section-scope copy
- add `Editing adult` shell

### Phase B: Results shell

- add household shell to Projection
- add view toggle to Projection and Stress Test
- revise summary cards and table labels
- promote ScenarioLab or equivalent comparison panel

### Phase C: Engine-backed fidelity

- refactor household runtime inputs away from reference-adult collapse
- expose adult-level analysis outputs
- align result views with true per-adult data

### Phase D: Validation and polish

- rewrite validation errors in household language
- review import flow vocabulary
- run responsive and accessibility pass

## Risks and Mitigations

- Risk: UX improves faster than engine fidelity. Mitigation: gate per-adult result views behind true adult-level selectors, not relabeled household aggregates.
- Risk: Users lose track of shared vs adult rows. Mitigation: keep owner badges and scope text visible.
- Risk: Inputs page becomes longer. Mitigation: use subsections and sticky navigation inside Spending instead of adding top-level pages.

## Verification Steps

1. Setup a couple plan and verify names replace role tokens after setup.
2. Add shared and adult-owned rows and confirm scope language stays correct in Inputs.
3. Confirm Healthcare and Goals are discoverable only inside Spending.
4. Confirm Projection and Stress Test both show household shell plus adult drilldowns.
5. Compare household vs adult views and verify labels match actual underlying data.
6. Run household test fixtures to confirm no regression in owner/timing behavior.

## ADR

### Decision

Adopt a fully modeled per-adult household UX with names-first labeling and Spending-owned Healthcare/Goals subsections.

### Drivers

- Current scope model is confusing.
- User explicitly wants real per-adult analysis.
- Results pages currently diverge in household framing.

### Alternatives Considered

- Keep a household-only rollup with lighter adult context.
- Keep current mixed model and only improve copy.

### Why Chosen

The chosen direction matches the product goal and removes the biggest mental-model errors instead of papering over them.

### Consequences

- Requires both UX and engine work.
- Forces a clearer contract between authoring scope and analysis scope.

### Follow-ups

- Convert this spec into an execution plan by phase.
- Decide whether to ship the UX shell first or pair it with engine refactors behind a feature flag.
