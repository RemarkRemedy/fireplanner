# Browser AI UX Plan

## Goal

Make Fireplanner work well with in-browser AI assistants such as Gemini in Chrome, Edge Copilot, and Claude-powered browser assistants without building separate product flows for each assistant.

The target outcome is not "integrate with Gemini." The target outcome is "make planner state, results, and next steps legible enough that any browser AI can help the user effectively."

## Why This Matters

Today the app already has strong planning functionality, but the user must manually translate UI state into prompts for an assistant. That breaks down on:

- multi-section inputs
- hidden or derived state
- charts and visual summaries
- ambiguous section ownership in household mode
- share/import flows that move state but do not explain it

The repo already contains the right underlying primitives:

- structured routes and sections in `frontend/src/router.tsx` and `frontend/src/pages/InputsPage.tsx`
- context-aware help in `frontend/src/components/layout/HelpPanel.tsx`
- import/export/share controls in `frontend/src/components/layout/Sidebar.tsx`
- result surfaces in `frontend/src/pages/DashboardPage.tsx`
- portable state via `frontend/src/lib/shareUrl.ts`

## Product Principles

1. Assistant-agnostic
   The UX should work with Gemini, Copilot, Claude, and future in-browser assistants.

2. Text-first
   Every important visual or hidden state should have a human-readable text form.

3. Stable language
   The user and the AI should be able to refer to the same page, section, person, scenario, and metric names.

4. Explicit handoff
   The app should intentionally package context for an AI instead of relying on screenshots or guesswork.

5. Read-only first
   Phase 1 should help users ask better questions and share better context. It should not let AI mutate planner state.

6. Privacy-aware by default
   AI-exported context should be reviewable and scoped. Users should know what they are copying out of the app.

## Current-State Observations

### Start and onboarding

- The app has pathway selection with clear user intent choices in `frontend/src/pages/StartPage.tsx:270`.
- It already distinguishes new versus returning users in `frontend/src/pages/StartPage.tsx:368`.
- It does not yet help a user ask an AI, "Which pathway should I choose?" or "What should I fill in next?"

### Inputs flow

- Inputs are already sectioned and status-aware in `frontend/src/pages/InputsPage.tsx:81`.
- Household sections include person/shared scope switching in `frontend/src/pages/InputsPage.tsx:50`.
- This is powerful for direct use, but difficult for a browser AI to infer from a screenshot or partial DOM.

### Help flow

- Help is route-aware and section-aware in `frontend/src/components/layout/HelpPanel.tsx:17`.
- It already has high-quality educational content and page-specific sources.
- It is reference-oriented, not handoff-oriented. It answers questions but does not package AI prompts.

### Data portability

- Export/import/share actions already exist in `frontend/src/components/layout/Sidebar.tsx:314`.
- Share URLs already package state in `frontend/src/lib/shareUrl.ts:35`.
- These flows transport data, but they do not explain that data in plain language for an AI or for the user.

### Results surfaces

- The dashboard is already a summary layer in `frontend/src/pages/DashboardPage.tsx:34`.
- The app has metrics, charts, simulations, and what-if views.
- Many of these are visually useful but not yet conversation-friendly.

## Target User Journeys

### Journey 1: "Help me fill this section"

User is on Inputs, opens Gemini/Copilot/Claude in the browser, and asks what to do next.

The app should provide:

- current page and section name
- who the section applies to
- what is already configured
- what still needs review
- a prompt template for the assistant

### Journey 2: "Explain these results"

User reaches Dashboard, Projection, or Stress Test and wants an assistant to explain the meaning of the output.

The app should provide:

- text summary of current results
- assumptions that materially affect the result
- missing validation steps
- a question template such as "stress test my assumptions"

### Journey 3: "Compare scenarios with an AI"

User wants to paste scenario A versus B into an AI and ask which lever matters most.

The app should provide:

- a compact structured comparison
- key deltas only
- plain names for scenario and metric labels

### Journey 4: "Recover or continue on another device"

User moves between browser, device, or assistant session.

The app should provide:

- safe share/import with preview
- AI-readable snapshot option
- clarity on what will be replaced and what will be copied

## Proposed UX Layer: AI Handoff

Introduce a first-class concept called `AI Context`.

This is not a new page. It is a shared read-only model that powers multiple surfaces.

### AI Context should contain

- route and page label
- active section label
- plan type and mode
- subject/scope
  - self
  - selected adult
  - shared
  - household
- high-signal inputs
- completion and validation state
- latest results relevant to the route
- known caveats
- suggested next questions

### AI Context output formats

1. Short summary
   For quick copy/paste into a browser assistant.

2. Prompt template
   For "ask AI about this page/section/result."

3. Structured snapshot
   For richer future use, debugging, and consistent downstream formatting.

## Proposed Surfaces

### Phase 1 surfaces

1. Sidebar action
   Add `Copy AI Context` alongside the existing actions in `frontend/src/components/layout/Sidebar.tsx:314`.

2. Help panel actions
   Add:
   - `Copy prompt for AI`
   - `Ask AI about this section`

   The current `contentKey` routing in `frontend/src/components/layout/HelpPanel.tsx:35` is the correct hook.

3. Inputs state banner
   Add a compact in-page summary to Inputs that states:
   - where the user is
   - whose data they are editing
   - whether the section is configured or still needs review

4. Dashboard text summaries
   Each key result area should have a compact textual explanation suitable for copy/paste.

### Phase 2 surfaces

1. Onboarding prompts
   On Start, add prompts like:
   - "Help me choose a pathway"
   - "What should I gather before I continue?"

2. Scenario comparison summaries
   Add AI-friendly summaries for dashboard what-if views and stress-test scenarios.

3. Import/share previews
   Before replacing data from a shared URL or import, show what will change in plain language.

### Phase 3 surfaces

1. Assistant-specific prompt variants only if needed
   Keep the base UX vendor-neutral unless real usage shows a measurable need.

2. Deep links to exact state
   Extend current sharing/deep-linking so copied AI context can point back into exact screens and sections.

3. Optional assistant mode
   Only if the generic affordances begin to clutter the main app.

## MVP Scope Recommendation

The smallest valuable release is:

1. Shared AI context model
2. `Copy AI Context` in sidebar
3. `Copy prompt for AI` in help panel
4. Inputs current-state banner
5. Dashboard text summary blocks

This is enough to materially improve Gemini/Copilot/Claude workflows without changing the planner's core logic.

## Non-Goals for v1

- no direct API integration with Gemini/Copilot/Claude
- no AI write-back into stores
- no auto-filled prompts that execute actions on behalf of the user
- no assistant-specific UI forks unless proven necessary

## Risks and Mitigations

### Risk: prompt bloat

Too much copied context will be noisy and reduce AI usefulness.

Mitigation:

- support short and long formats
- only include route-relevant fields
- prefer deltas and summaries over raw store dumps

### Risk: privacy overexposure

Users may copy more personal information than intended.

Mitigation:

- preview copied content
- clearly label what is included
- default to summary-level fields first

### Risk: false confidence from AI explanations

The assistant may sound correct while misreading the planner.

Mitigation:

- keep stable product labels in the copied text
- include caveats and data-source context where relevant
- keep the planner's own help and source links visible

### Risk: UX clutter

Adding too many AI affordances can overwhelm users who do not use assistants.

Mitigation:

- keep Phase 1 entry points small and contextual
- reuse existing surfaces instead of adding a large new assistant panel

## Acceptance Criteria

### Product acceptance

1. A user on Inputs can copy a section-specific AI context block without needing to explain the page manually.
2. A user on Dashboard can copy a summary that an assistant can interpret without relying on chart screenshots.
3. A user can clearly tell what will be copied or shared.
4. The feature works similarly regardless of whether the user uses Gemini, Copilot, or Claude.

### UX acceptance

1. All AI-related actions use stable, human-readable labels.
2. Household and per-person scope are explicit in copied summaries.
3. Route-specific help can generate a route-specific AI prompt.
4. Result summaries are concise enough for chat use and do not require raw JSON.

### Technical acceptance

1. AI context is derived from existing route/store/completion state, not duplicated ad hoc per component.
2. The same source model can power at least two output formats.
3. Phase 1 requires no write access from AI into planner state.

## Suggested Success Metrics

Use analytics only if you want to measure adoption after rollout.

- usage rate of `Copy AI Context`
- usage rate of `Copy prompt for AI`
- follow-through rate from copy action to deeper page completion
- reduction in incomplete sections before dashboard usage
- qualitative feedback that users no longer need screenshots to ask for help

## Recommended Sequence

1. Define the shared AI context model and its output formats.
2. Choose the first route/page summaries to support.
3. Ship sidebar and help-panel entry points.
4. Add Inputs and Dashboard summaries.
5. Evaluate real usage before expanding to assistant-specific variants.

## ADR

### Decision

Make Fireplanner AI-hand-off native through a shared, assistant-agnostic AI context layer.

### Drivers

- multiple browser assistants are in scope
- existing UI already contains structured context but does not expose it cleanly
- the user wants planning support, not a one-off Gemini integration

### Alternatives considered

1. Build Gemini-specific integration first
   Rejected because it would not improve Copilot/Claude usage and would lock UX decisions too early.

2. Build a dedicated assistant mode first
   Rejected because it is heavier than needed for the current problem and risks fragmenting the main UX.

3. Do nothing and rely on help text plus share URLs
   Rejected because it still forces the user to manually translate planner state for the AI.

### Why chosen

The shared AI-context approach improves all supported assistant workflows at once, reuses current architecture, and stays low-risk by remaining read-only in the first phase.

### Consequences

- some new UX primitives will be introduced across existing screens
- summary design quality matters as much as implementation quality
- future assistant-specific work becomes easier because the common context layer already exists

### Follow-ups

- turn this into a narrower MVP spec
- define exact context fields by route
- decide whether copied context should have short and long versions in v1 or v1.1
