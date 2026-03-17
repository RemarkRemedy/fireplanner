# Browser AI Full Product Plan

## Objective

Make Fireplanner fully usable with in-browser AI assistants such as Gemini in Chrome, Edge Copilot, and Claude-powered browser assistants without creating a fragmented, vendor-specific experience.

This is not an integration project. It is a product redesign around one principle:

**Planner state must be legible, explainable, and transferable to an AI at every meaningful step of the user journey.**

The end state is a complete, durable product layer, not an MVP patchwork.

## Product Thesis

Browser AIs are now part of the user's browsing environment. Users will naturally:

- ask an assistant which path to choose
- ask what a field means
- ask whether a result is good or bad
- ask how to improve an outcome
- ask the AI to compare scenarios
- ask the AI to help continue later on another device

Fireplanner currently works as a strong direct-manipulation planner, but it assumes the user is the translation layer between the app and the assistant.

That assumption no longer holds.

The full product should make Fireplanner:

- self-describing to humans
- quoteable to assistants
- copyable in structured text
- safe to hand off
- stable across Gemini, Copilot, Claude, and future browser AIs

## Non-Goals

- No assistant-specific API integration as a prerequisite.
- No AI write-back into planner state in the first full release.
- No hidden prompt engineering layer that users cannot inspect.
- No separate "Gemini mode" or "Copilot mode" unless later evidence shows real product need.

## Why A Full Product Plan Is Necessary

If this is built incrementally without a durable model, the likely debt is:

- repeated per-page summary logic
- inconsistent labels between UI and copied context
- duplicated prompt builders
- route-specific hacks around charts and metrics
- privacy and scope inconsistencies
- AI affordances bolted onto the UI instead of integrated into it

The correct approach is to define one durable AI-facing product layer, then wire all surfaces into that layer.

## Current Foundation In The Repo

The current frontend already contains the right primitives:

- route structure in `frontend/src/router.tsx`
- page-level UX surfaces in `frontend/src/pages/*`
- section-aware inputs in `frontend/src/pages/InputsPage.tsx`
- route-aware help in `frontend/src/components/layout/HelpPanel.tsx`
- data portability in `frontend/src/components/layout/Sidebar.tsx`
- share URL transport in `frontend/src/lib/shareUrl.ts`
- import/export transport in `frontend/src/lib/exportImport.ts`
- result surfaces in `frontend/src/pages/DashboardPage.tsx`
- state completion and validation signals in `frontend/src/hooks/useSectionCompletion.ts`

This means the problem is not missing data. The problem is missing product packaging.

## Product Principles

1. Assistant-agnostic
   Everything should work well whether the user uses Gemini, Edge Copilot, Claude, or another browser AI.

2. Text-first parity
   Every important visual state must have a text equivalent.

3. Stable naming
   A section, person, scenario, metric, and warning should have exactly one user-facing label across UI, copied context, and prompts.

4. Explicit scope
   The product must always make clear whether information applies to self, partner, household, or shared values.

5. Reviewable handoff
   Users should be able to see what they are copying or sharing before it leaves the planner.

6. Layered detail
   The system should support short, standard, and detailed summaries from one source of truth.

7. Read-only trust model
   The full release should help users reason better with AI before allowing AI-driven edits.

8. No throwaway abstractions
   Summary generation, prompt generation, and textual chart narration must be built on durable contracts.

## Target Product Experience

### 1. AI-aware onboarding

From the start page, the user can:

- understand which pathway fits their situation
- copy a concise brief for an assistant
- ask a browser AI a structured question like:
  - "Which onboarding path fits me?"
  - "What info should I gather before continuing?"
  - "What assumptions am I implicitly making?"

The app should provide page-state and recommended question prompts without requiring the user to explain the UI manually.

### 2. AI-guided section completion

On Inputs, the user should always know:

- where they are
- who this section applies to
- what is already configured
- what still needs review
- what inputs matter most
- what an assistant should know to help with this section

The user should be able to copy a section-specific context packet in one action.

### 3. AI-readable results

On Dashboard, Projection, Withdrawal, Stress Test, Health Check, and ILP Review, the user should be able to:

- copy a text summary of current results
- ask what changed and why
- compare scenarios in text form
- ask how to improve a metric
- ask whether assumptions are too optimistic or too conservative

### 4. AI-friendly transport and recovery

Sharing and import/export should support:

- URL-based continuation
- structured snapshot handoff
- preview before overwrite
- clear explanation of what was imported, replaced, or skipped

### 5. Consistent AI surfaces everywhere

The AI-related affordances should feel like one coherent product capability, not scattered feature buttons.

## Core Product Concept: The AI Handoff Layer

The full product should be built around a shared read-only domain model called `AI Context`.

This is not a UI component. It is a product contract that can describe the planner state in a way that both humans and assistants can use.

### AI Context responsibilities

- summarize current planner state for the current route
- summarize active section state when applicable
- expose stable labels and scope
- expose high-signal inputs only
- expose result summaries only when relevant
- expose warnings, caveats, and unresolved validation state
- expose suggested next questions
- support multiple output formats

### AI Context output levels

1. `compact`
   Small enough for quick paste into Gemini/Copilot/Claude.

2. `standard`
   Default conversational summary for most copy flows.

3. `detailed`
   Richer explanation with assumptions, caveats, and relevant metrics.

### AI Context output modes

1. `summary`
   Plain-language state report.

2. `prompt`
   A framed request the user can send to an assistant.

3. `snapshot`
   Structured, AI-readable representation for more advanced reuse.

## Durable Information Architecture

The planner should expose the same conceptual objects everywhere:

- page
- section
- subject
- state
- assumptions
- outputs
- gaps
- next questions

### Canonical domain labels

The following concepts need canonical display names:

- Pathway
- Plan Type
- Page Name
- Section Name
- Subject Scope
- Scenario Name
- Metric Name
- Warning Name

These labels should be shared between:

- screen UI
- copied AI summaries
- prompt templates
- import/share preview text

This prevents the current likely failure mode where the UI says one thing and the copied context says another.

## Full Product Surface Inventory

### A. Global surfaces

These appear across most of the planner.

1. `AI Context` action group
   Replace ad hoc AI entry points with a consistent grouped surface across desktop and mobile.

2. `Current State Banner`
   A compact textual explanation of the current page/section/scope/result state.

3. `AI Panel` or `AI Drawer`
   A unified review-and-copy surface where users can inspect, copy, and tailor what they want to send to an assistant.

4. `AI-aware Help`
   The existing help panel becomes both explanatory and handoff-capable.

### B. Start / onboarding surfaces

Add:

- pathway guidance summary
- "ask AI about this choice" prompts
- preparation checklist for the chosen path
- onboarding context packet

### C. Inputs surfaces

Every major section should expose:

- section summary
- section scope
- section completion state
- top unresolved questions
- copyable AI packet

For household mode, the section summary must explicitly describe:

- selected adult
- whether values are personal or shared
- who is affected by edits

### D. Result surfaces

Each result page needs:

- text summary above or beside key charts
- "what this means" narration
- "why this looks like this" explanation
- "what to ask an AI next" suggestions
- copyable summaries for individual metrics and entire result pages

### E. Data transport surfaces

Sharing, importing, and URL-loaded plans should all include:

- explicit preview
- scope of overwrite
- reviewable summary
- AI snapshot option separate from raw transport

## Page-by-Page Product Requirements

### Start

Needs:

- current path explanation
- AI guidance for pathway selection
- per-pathway prompt suggestions
- clear textual description of enabled toggles such as CPF, property, healthcare

### Inputs

Needs:

- persistent current-state banner
- per-section AI summary
- shared/person/household scope narration
- completion-aware prompts
- validation-aware prompts

### Projection

Needs:

- year-by-year summary in text
- plain explanation of projection assumptions
- explanation of why a target is or is not reached
- AI comparison packet for planned versus adjusted assumptions

### Withdrawal

Needs:

- strategy summary in text
- explanation of strategy differences
- copyable summary of chosen strategy and key tradeoffs

### Stress Test

Needs:

- simulation assumptions summary
- scenario comparison narration
- explanation of success rates and limitations
- AI prompts focused on robustness and downside risk

### Dashboard

Needs:

- concise overall summary
- per-card text summaries
- interpretation layer for metrics
- recommended next questions

### Health Check

Needs:

- summary of health/insurance gaps
- AI prompts around adequacy and tradeoffs

### ILP Review

Needs:

- policy comparison summary
- fee/opportunity-cost narration
- AI prompts that frame decision analysis safely

### Reference

Needs:

- AI-aware citation handoff
- prompt templates for asking an assistant to explain a concept using planner terminology

## Platform Compatibility Strategy

The product should assume browser assistants vary in:

- DOM awareness
- screenshot understanding
- clipboard behavior
- sidebar or overlay interaction patterns
- tolerance for long pasted context

Therefore the product should avoid depending on:

- extension-only APIs
- hidden integrations
- long raw JSON by default
- chart-only communication

The compatibility strategy should be:

- concise text first
- markdown-friendly output
- user-visible copied payloads
- labels and bullets that survive any chat UI

## Durable Architecture

### 1. Shared AI Context builder

Create a single domain service that can derive route-aware and section-aware context from:

- route and location
- active section
- section completion
- relevant stores
- latest results and summaries
- current toggles and mode

This builder should be the only source of truth for AI-facing summaries.

### 2. Page adapters

Each major route should provide an adapter that defines:

- which fields matter
- which results matter
- which warnings matter
- which suggested questions to surface

This keeps the core model stable while letting pages express route-specific relevance cleanly.

### 3. Output renderers

Use dedicated renderers for:

- compact markdown summary
- standard markdown summary
- detailed markdown summary
- prompt template output
- structured snapshot output

### 4. Visual narration layer

Charts and dense result panels should have companion narrators that convert computed outputs into stable explanatory text.

This should not scrape the DOM. It should consume the same computed data already used to render the charts.

### 5. Preview and review layer

Any outbound AI handoff should pass through a reviewable presentation layer so the user can confirm what is being copied.

## Data Contract Design

The system should define durable contracts for:

- `AIContext`
- `AISubjectScope`
- `AIInputSummary`
- `AIOutputSummary`
- `AIWarning`
- `AINextQuestion`
- `AIHandoffPacket`

The goal is to avoid stringly-typed ad hoc summaries scattered across the app.

### Example contract categories

- identity:
  - page
  - section
  - plan type
  - pathway

- scope:
  - individual
  - selected adult
  - shared
  - household

- status:
  - complete
  - needs review
  - missing
  - invalid

- summary blocks:
  - key inputs
  - active assumptions
  - notable outputs
  - warnings
  - next questions

## Privacy And Safety Design

The full product must establish explicit safety rules for copied context.

### Copy policy

Every AI handoff action should state:

- what is included
- what is omitted
- whether the payload is compact, standard, or detailed

### Privacy defaults

Default copied content should prefer:

- summaries over full raw values when detail is not necessary
- route-relevant state only
- no unrelated sections

### Safety language

Any result summary that could be over-trusted should retain planner caveats where relevant, especially on:

- withdrawal safety
- Monte Carlo success interpretation
- insurance adequacy
- ILP decisions

## UX Guardrails

1. No raw JSON as the default user-facing copy format.
2. No unlabeled AI buttons.
3. No page-specific prompt formats invented independently.
4. No chart without a textual explanation path.
5. No ambiguous scope in household mode.
6. No overwrite/import action without a human-readable preview.
7. No assistant-specific branding in the shared product layer.

## Accessibility Requirements

The full product should improve not only AI use, but general usability.

Requirements:

- copied summaries must be screen-reader sensible
- state banners must use semantic labels
- AI drawer or panel must be keyboard-accessible
- text summaries must not rely on color
- warnings and completion states must be readable without icons alone

## Observability And Success Measurement

The full release should include instrumentation for:

- AI context generation frequency
- copy action usage by page and output level
- prompt action usage by page
- import/share preview opens and completions
- whether AI handoff features correlate with deeper plan completion

Qualitative signals to watch:

- reduced user need to explain what page they are on
- reduced screenshot-driven support behavior
- more focused AI questions from users

## Workstreams For Delivery

This is not an MVP sequence. It is a dependency-aware build plan for the full product.

### Workstream 1: Domain model and contracts

Deliver:

- canonical labels
- `AIContext` contract
- output-level contract
- route adapter contract
- scope and warning taxonomy

This workstream must complete before UI work spreads, or the product will accumulate summary debt.

### Workstream 2: Shared generation and rendering

Deliver:

- shared context builder
- renderers for summary/prompt/snapshot
- chart/result narration utilities
- preview presentation layer

### Workstream 3: Global product surfaces

Deliver:

- AI action group
- AI panel/drawer
- help panel integration
- mobile parity

### Workstream 4: Onboarding and inputs integration

Deliver:

- pathway AI guidance
- current-state banners
- per-section handoff packets
- household scope narration

### Workstream 5: Results integration

Deliver:

- dashboard summaries
- projection summaries
- withdrawal summaries
- stress-test summaries
- health check summaries
- ILP review summaries

### Workstream 6: Transport and recovery

Deliver:

- share preview
- import preview
- URL-import preview
- AI snapshot handoff

### Workstream 7: QA and hardening

Deliver:

- cross-route consistency review
- content-quality review
- household-mode edge-case coverage
- mobile and desktop review
- accessibility review
- analytics validation

## Build Sequence

Because the user asked to avoid tech debt, the sequence should prioritize durable layers before surface expansion.

1. Domain model and contracts
2. Shared generation and rendering
3. Global surfaces
4. Inputs and onboarding integration
5. Results integration
6. Transport/recovery integration
7. Hardening and consistency pass

The important point is that the product should not ship page-specific AI behavior that bypasses the shared model.

## Acceptance Criteria For The Full Product

### Product acceptance

1. A user can hand their current planner state to Gemini, Copilot, or Claude from any major page without manually translating the UI.
2. The assistant usually has enough context that it does not need to first ask what page, section, or scope the user is on.
3. Results pages can be understood by an assistant without relying on screenshots alone.
4. Share/import flows explain what will change before state is replaced.
5. Household mode is unambiguous in copied summaries.

### UX acceptance

1. AI affordances are consistent across the app.
2. Section labels, metric labels, and scenario labels match between UI and copied text.
3. All major charts and result blocks have text equivalents.
4. The experience remains usable for non-AI users and does not feel like an assistant-only app.

### Technical acceptance

1. All AI-facing outputs are derived from one shared context layer.
2. No page owns a one-off prompt system outside the shared model.
3. The system supports compact, standard, and detailed outputs without duplicating logic.
4. Preview and copy behavior works on desktop and mobile.

### Safety acceptance

1. Users can review copied or imported context before committing to the action.
2. AI handoff defaults avoid unnecessary overexposure of unrelated planner data.
3. Planner caveats remain visible where over-trust is likely.

## Risks

### Risk: over-scoping the language layer

If summaries become essay-length, they will become less useful.

Mitigation:

- define compact/standard/detailed levels early
- enforce route relevance

### Risk: fragmented result narration

If each page invents its own narration style, the product will feel inconsistent.

Mitigation:

- central summary style guide
- shared renderer templates

### Risk: assistant bias

If one assistant becomes the implicit design target, the experience may degrade elsewhere.

Mitigation:

- vendor-neutral naming
- markdown-first payloads
- no assistant-specific UI assumptions in the core layer

### Risk: clutter

Adding too many AI controls could degrade usability.

Mitigation:

- central AI action group
- contextual secondary actions
- one AI drawer/panel instead of many modal variants

## ADR

### Decision

Build a full, assistant-agnostic AI handoff layer as a first-class product capability across Fireplanner.

### Drivers

- browser AI usage is a core user behavior, not an edge case
- existing planner state is rich but not explicitly transferable
- an MVP-style patch would create duplicated summary and prompt logic
- the user explicitly wants to avoid tech debt and build the complete product properly

### Alternatives considered

1. Gemini-specific integration first
   Rejected because it creates vendor lock-in and does not solve Copilot or Claude use.

2. Minimal copy buttons without shared contracts
   Rejected because it would accumulate content and architecture debt quickly.

3. Dedicated AI mode first
   Rejected because it splits the product too early and is unnecessary before the shared handoff model exists.

### Why chosen

The shared full-product AI handoff layer solves the underlying problem once, preserves product coherence, and provides a durable base for future assistant-specific enhancements if they ever become necessary.

### Consequences

- this requires product-contract work before UI expansion
- content design becomes part of the architecture
- release scope is larger, but the long-term system is cleaner

### Follow-ups

- define exact `AIContext` schema
- define route adapters per page
- define summary style guide
- define preview UX and mobile behavior
- then turn this plan into an implementation work plan
