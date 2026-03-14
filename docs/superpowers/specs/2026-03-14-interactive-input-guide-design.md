# Interactive Input Guide: TurboTax-Style Guided Inputs

**Date:** 2026-03-14
**Branch:** `main` (fireplanner)

## Problem

The InputsPage has 9 rendered sections with dozens of fields. New users face a wall of accordions with minimal guidance on what to fill, what each field means, or why it matters for their FIRE plan. The existing `(i)` tooltips are sparse and lack context. There's no guided flow: users must navigate sections by instinct.

## Goal

Make the InputsPage feel guided and approachable for first-time users while preserving fast random access for returning users. No LLM required: the guidance is static, well-written content layered with a stepper UX. The AI chat panel remains available as a fallback for genuine confusion.

## Design Overview

Three layered patterns, each independent but complementary:

- **Pattern A: Rich Field Tooltips** — every field gets a detailed, Singapore-contextualized tooltip
- **Pattern B: Section Intros** — each section gets a collapsible explainer block
- **Pattern C: Guided Stepper** — a progress bar + one-section-at-a-time flow for new plans

All three read from a single data file (`lib/data/fieldGuide.ts`) so content is maintained in one place and reusable if we later upgrade to a per-question Approach 3.

---

## Architecture

### Data Layer: `lib/data/fieldGuide.ts`

A single pure-data file with two maps:

**Per-field entries** keyed by a `FieldGuideId` string using dot-path convention from the household plan structure (e.g., `adult.currentAge`, `adult.retirementAge`, `assumptions.fire.swr`, `income.annualAmount`, `expense.amount`, `property.existingPropertyValue`). For collection entity fields, use the entity prefix without an ID (e.g., `income.annualAmount` not `income.abc123.annualAmount`).

```ts
interface FieldGuideEntry {
  id: string
  label: string
  tooltip: string                // 1-sentence hover summary
  detail?: string                // 2-3 sentence deeper explanation
  example?: string               // concrete example with numbers
  whyItMatters?: string          // how this field affects FIRE calculations
  source?: string                // data source label (e.g., "CPF Board")
  sourceUrl?: string             // link to official source
  formula?: string               // formula notation if applicable
}
```

**Per-section entries** keyed by the 9 rendered `SectionId` values (excluding `section-goals` and `section-healthcare`, which are sub-sections of Expenses and do not get standalone intros):

```ts
type RenderedSectionId = Exclude<SectionId, 'section-goals' | 'section-healthcare'>

interface SectionGuideEntry {
  sectionId: RenderedSectionId
  title: string
  intro: string                  // 1-2 sentences: what this section does
  whatToHave: string             // what documents/info to have handy
  timeEstimate: string           // e.g., "3-5 min"
}
```

Singapore-specific reference values (MOM salary benchmarks, CPF rates, tax brackets) are imported from existing `lib/data/` files, not hardcoded in tooltip strings.

Fields without a `fieldGuide` entry keep their existing tooltip behavior. Migration is incremental.

### Pattern A: Rich Field Tooltips

**New component:** `<FieldTooltip fieldId="adult.retirementAge" />`

Wraps the existing `InfoTooltip` component. On hover/tap:
- Shows the `tooltip` one-liner (same as current behavior)
- Adds an expandable "Learn more" section with `detail`, `example`, `whyItMatters`
- Preserves existing `formula`, `source`, `sourceUrl` support

The component looks up the `fieldGuide` map by ID. If no entry exists, falls back to rendering a plain `InfoTooltip` with whatever `text` prop was passed (backwards compatible).

**Mobile:** Uses the existing `Popover` path from `InfoTooltip` (already mobile-aware). The "Learn more" expandable works within the popover.

### Pattern B: Section Intros

**New component:** `<SectionIntro sectionId="section-income" />`

Rendered as the first child inside each `HouseholdPrototypeSection` accordion content area:
- Shows `intro` text, `whatToHave` list, and `timeEstimate` badge
- Styled as a subtle card (muted background, small text)

**Visibility behavior:**
- **Guided stepper mode:** shown by default (expanded)
- **Accordion mode (returning users):** collapsed by default, expandable via a small `?` icon button in the section header
- **Dismissible:** once closed, stays closed for that section. Stored in UIStore as `dismissedSectionIntros: SectionId[]`, similar to existing `dismissedNudges`

**Relationship to existing section nudges:** Nudges (`useSectionNudge`) are data-driven contextual tips (e.g., "SRS could save you $X"). Section intros are static explainers about what the section is. They coexist: intro at the top, nudges inline where relevant.

### Pattern C: Guided Stepper

**New component:** `<GuidedStepper />`

A wrapper rendered at the top of InputsPage that orchestrates the one-section-at-a-time flow.

#### Progress Bar

Horizontal step indicator at the top of InputsPage:
- Shows all sections in the user's pathway order (from `SECTION_ORDERINGS[sectionOrder]`)
- Each step displays: abbreviated section name, completion icon (empty circle / spinner / green check)
- Current section highlighted with active styling
- Clickable: user can jump to any section (not locked)
- Responsive: on mobile, shows current step number + total (e.g., "Step 3 of 9") with left/right arrows

Only shows rendered sections (the 9 from `SECTION_ORDERINGS`, not `section-goals` or `section-healthcare` which are sub-sections of Expenses). Conditional sections (CPF, Protection, Property) only appear if their feature flag is enabled in UIStore.

#### Section Navigation

- Only the current section's accordion is expanded; others are collapsed
- **"Continue" button** at the bottom of each section → collapses current, opens next incomplete section
- **"Back" button** → opens previous section
- **"Skip for now" link** next to Continue → advances without requiring completion
- Keyboard: Enter on Continue, Escape to go Back (optional enhancement)

The stepper uses the new `collapseAllExcept` action on UIStore to atomically control which section is open. It doesn't replace the accordion system: it orchestrates which sections are open.

**Accordion click behavior in stepper mode:** If the user clicks an accordion header to manually expand a different section, the stepper updates `guidedCurrentStep` to match that section's index. This keeps stepper state and accordion state in sync. The stepper observes `collapsedSections` changes and reconciles: if exactly one section is expanded, `guidedCurrentStep` follows it.

**Continue on last section:** When the user is on the last section in the ordering and clicks Continue:
- If all sections are complete → show the completion card
- If some sections are still incomplete → wrap around to the first incomplete section (with a subtle "Revisiting earlier sections" label in the progress bar)

#### State (UIStore additions)

```ts
guidedStepperActive: boolean    // is stepper mode on?
guidedCurrentStep: number       // index into the filtered section ordering
dismissedSectionIntros: string[]  // which section intros the user closed (SectionId values)
```

**Persistence behavior:**
- `guidedStepperActive`: **persisted** — survives page reloads so returning users stay in their chosen mode
- `guidedCurrentStep`: **persisted** — users resume where they left off after closing the tab
- `dismissedSectionIntros`: **persisted** — dismissed intros stay dismissed across sessions

All three are included in the `partialize` output (i.e., NOT excluded like `contextualNudgeActive`).

**UIStore migration:** Bump `version` from 11 to 12. Add migration block:
```ts
if (version < 12) {
  state.guidedStepperActive = true
  state.guidedCurrentStep = 0
  state.dismissedSectionIntros = []
}
```

**New action:** Add `collapseAllExcept(sectionId: string, allSectionIds: string[])` to UIActions for atomic section switching:
```ts
collapseAllExcept: (sectionId, allSectionIds) =>
  set({ collapsedSections: allSectionIds.filter(id => id !== sectionId) })
```

#### Defaults and Transitions

**"New plan" detection:** Uses the `DEFAULT_UI` default value. `guidedStepperActive` defaults to `true` in `DEFAULT_UI`. For existing users, the version 12 migration also sets it to `true` (giving them the guided experience once). After the user completes all sections or manually toggles to accordion mode, `guidedStepperActive` is set to `false` and persisted. A user who clears localStorage gets the stepper again, which is the correct behavior (fresh start).

- **Fresh localStorage (new user):** `guidedStepperActive: true` from `DEFAULT_UI`, start at step 0
- **Existing user (migration from v11):** `guidedStepperActive: true` from migration, start at step 0. If their sections are already complete, the completion card shows immediately and sets `guidedStepperActive: false`.
- **User toggle:** a "Guide me" / "Show all sections" toggle in the InputsPage header switches between modes at any time. Persisted immediately.
- **Auto-transition:** when all rendered sections have `isComplete: true` (from `useSectionCompletion`), show a completion card with CTAs to `/projection` or `/dashboard`. Sets `guidedStepperActive: false` so subsequent visits use accordion mode.

#### What stays the same

- All section content components are unchanged
- `HouseholdPrototypeSection` accordion behavior preserved
- Pathway ordering (`sectionOrder`) drives step order
- `useSectionCompletion` provides completion state (no new completion logic)
- `useActiveSection` scroll tracking: in stepper mode, the Sidebar reads `guidedCurrentStep` from UIStore instead of scroll-detected section (since collapsed sections have near-zero height, scroll detection would be unreliable). In accordion mode, scroll detection works as before.

---

## Approach 3 Upgrade Path

If we later want per-question stepper (TurboTax full depth):
- `fieldGuide.ts` content carries over directly (it's already per-field)
- `GuidedStepper` component becomes the orchestrator for field-group rendering
- Progress bar, step state, and completion tracking all reuse
- Only the rendering layer changes: "one accordion at a time" → "one field group at a time"

The data and state layers are designed to support this without rework.

---

## Files Summary

| File | Change | Type |
|------|--------|------|
| `lib/data/fieldGuide.ts` | New: field + section guide data | Data |
| `components/shared/FieldTooltip.tsx` | New: rich tooltip wrapper | Component |
| `components/inputs/SectionIntro.tsx` | New: section intro card | Component |
| `components/inputs/GuidedStepper.tsx` | New: progress bar + nav buttons | Component |
| `pages/InputsPage.tsx` | Modify: integrate stepper, section intros | Page |
| `stores/useUIStore.ts` | Modify: add stepper state fields | Store |
| `components/shared/InfoTooltip.tsx` | No change (FieldTooltip wraps it) | - |
| `hooks/useSectionCompletion.ts` | No change (stepper reads it) | - |

## Accessibility

- Progress bar uses `role="navigation"` with `aria-label="Form progress"`
- Each step uses `aria-current="step"` for the active step
- Continue/Back buttons manage focus: advancing moves focus to the newly opened section's first focusable element
- Section intros use `role="note"` for screen reader clarity
- Completion status icons have `aria-label` text (e.g., "Complete", "Needs review", "Has errors")

## Content Authoring Strategy

The `fieldGuide.ts` data file will be large (50-80+ field entries across 9 sections). Writing quality tooltips, examples, and "why it matters" content is a significant authoring effort.

**Incremental approach:** Ship with the 4 highest-impact sections first: Personal, Income, Expenses, FIRE Settings. These cover the fields most new users struggle with. Backfill remaining sections (Net Worth, CPF, Property, Allocation, Protection) in a follow-up pass. Fields without guide entries keep their existing tooltip behavior.

## Non-Goals

- No LLM-powered guidance (the AI panel already handles that)
- No changes to calculation logic, validation, or stores beyond UIStore
- No changes to StartPage or other routes
- No per-question breakdown (Approach 3) in this iteration
- No animated page transitions between steps
- No changes to the section content components themselves (just wrapping)

## Edge Cases

- **Conditional sections (CPF, Protection, Property):** The stepper filters the section ordering to only include sections whose feature flags are enabled. If a user enables CPF mid-flow, the section appears in the progress bar at its pathway-defined position.
- **All sections already complete on first visit:** Can happen if user went through `HouseholdSetupWizard` (couple/household plans pre-fill data). Show the completion card immediately with option to review sections.
- **User toggles from stepper to accordion mid-flow:** Current step is preserved. Toggling back resumes from where they left off.
- **Section has validation errors:** The progress bar shows an error icon (red) instead of a green check. The Continue button still works (errors don't block progress; the user can come back).
- **Mobile viewport:** Progress bar collapses to "Step N of M" with arrow buttons. Section intros stay full-width.

## Testing

- Stepper activates for new plans, deactivates for loaded plans
- Progress bar reflects correct section ordering per pathway
- Continue/Back navigate correctly, Skip advances without completion
- Section intros show/hide based on mode and dismissal state
- FieldTooltip falls back gracefully for fields without guide entries
- Conditional sections appear/disappear in stepper when toggled
- Completion card shows when all sections are done
- Mode toggle preserves current step position
