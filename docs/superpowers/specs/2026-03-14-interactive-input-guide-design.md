# Interactive Input Guide: TurboTax-Style Guided Inputs

**Date:** 2026-03-14
**Branch:** `main` (fireplanner)
**Review status:** v2 — fixes applied from 3-agent + Codex review

## Problem

The InputsPage has 9 rendered sections with dozens of fields. New users face a wall of accordions with minimal guidance on what to fill, what each field means, or why it matters for their FIRE plan. The existing `(i)` tooltips are sparse and lack context. There's no guided flow: users must navigate sections by instinct.

## Goal

Make the InputsPage feel guided and approachable for first-time users while preserving fast random access for returning users. No LLM required: the guidance is static, well-written content layered with a stepper UX. The AI chat panel remains available as a fallback for genuine confusion.

## Design Overview

Two patterns shipped in Phase 1, with a third deferred:

- **Pattern B: Section Intros** — each section gets a collapsible explainer block
- **Pattern C: Guided Stepper** — a progress bar + one-section-at-a-time flow for new plans
- **Pattern A: Rich Field Tooltips** — deferred to Phase 2 (requires shared input API changes; see Deferred section)

Both B and C read from a single data file (`lib/data/fieldGuide.ts`) so content is maintained in one place and reusable if we later upgrade to per-question Approach 3 or add field-level tooltips.

---

## Architecture

### Data Layer: `lib/data/fieldGuide.ts`

A pure-data file with section guide entries keyed by `RenderedSectionId`:

```ts
import type { SectionId } from '@/lib/household/sectionOrder'

/** The 9 sections that render as standalone accordions on InputsPage. */
type RenderedSectionId = Exclude<SectionId, 'section-goals' | 'section-healthcare'>

interface SectionGuideEntry {
  sectionId: RenderedSectionId
  title: string
  intro: string                  // 1-2 sentences: what this section does
  whatToHave: string             // what documents/info to have handy
  timeEstimate: string           // e.g., "3-5 min"
}

export const SECTION_GUIDE: Record<RenderedSectionId, SectionGuideEntry> = { ... }
```

Also exports a `getSectionGuide(id: RenderedSectionId): SectionGuideEntry | undefined` accessor for clean lookups.

Singapore-specific reference values (MOM salary benchmarks, CPF rates, tax brackets) are imported from existing `lib/data/` files, not hardcoded in guide strings.

### Pattern B: Section Intros

**New component:** `<SectionIntro sectionId="section-income" />`

Rendered as the first child inside each `HouseholdPrototypeSection` accordion content area:
- Shows `intro` text, `whatToHave` list, and `timeEstimate` badge
- Styled as a subtle card (muted background, small text)
- **Null guard:** if `SECTION_GUIDE[sectionId]` is undefined, renders nothing (not even the card wrapper)

**Visibility behavior:**
- **Guided stepper mode:** shown by default (expanded)
- **Accordion mode:** shown at the top of accordion content if not dismissed. Has its own "dismiss" close button (small X) within the card.
- **Dismissible:** once closed, stays closed for that section. Stored in UIStore as `dismissedSectionIntros: RenderedSectionId[]`, similar to existing `dismissedNudges`

**No `HouseholdPrototypeSection` API change needed.** The intro is always a child of accordion content, never in the header. Dismiss control lives inside the `SectionIntro` card itself.

**Relationship to existing section nudges:** Nudges (`useSectionNudge`) are data-driven contextual tips (e.g., "SRS could save you $X"). Section intros are static explainers about what the section is. They coexist: intro at the top, nudges inline where relevant.

### Pattern C: Guided Stepper

**New component:** `<GuidedStepper />`

A wrapper rendered at the top of InputsPage that orchestrates the one-section-at-a-time flow.

#### Visible Sections

The stepper computes its own `visibleSections` list by filtering `SECTION_ORDERINGS[sectionOrder]` against active feature flags (`cpfEnabled`, `propertyEnabled`, `protectionEnabled`, `healthcareEnabled`). This is the single source of truth for step count, progress, and navigation. It does NOT use `useSectionCompletion.totalSections` (which is 11, including sub-sections).

#### Progress Bar

Horizontal step indicator at the top of InputsPage:
- Shows all `visibleSections` in the user's pathway order
- Each step displays: abbreviated section name, status icon:
  - Empty circle = unreviewed
  - Checkmark = reviewed (user clicked Continue or Skip)
  - Green filled dot = customized (has non-default values, from `useSectionCompletion`)
  - Red circle = has validation errors
- Current section highlighted with active styling
- Clickable: user can jump to any section (not locked)
- Responsive: on mobile, shows current step number + total (e.g., "Step 3 of 9") with left/right arrows

#### Section Navigation

- Only the current section's accordion is expanded; others are collapsed
- **"Continue" button** at the bottom of each section → marks section as reviewed, opens next unreviewed section
- **"Back" button** → opens previous section
- **"Skip for now" link** next to Continue → marks as reviewed, advances without requiring changes
- Keyboard: Enter on Continue, Escape to go Back (optional enhancement)

**Continue on last section:** When the user is on the last section:
- If all sections are reviewed → show the completion card
- If some sections are still unreviewed → wrap around to the first unreviewed section (with a subtle "Revisiting earlier sections" label)

#### Data Flow: Stepper Owns Section State (Unidirectional)

**The stepper is the single source of truth for which section is active in stepper mode.** This eliminates bidirectional sync between `guidedActiveSectionId` and `collapsedSections`.

Flow:
1. Stepper stores `guidedActiveSectionId: RenderedSectionId | null` in UIStore
2. When `guidedActiveSectionId` changes, stepper calls `collapseAllExcept(guidedActiveSectionId, visibleSections)` to update accordion state
3. When user clicks an accordion header in stepper mode, `HouseholdPrototypeSection`'s `toggleSection` is intercepted: instead of toggling `collapsedSections` directly, it sets `guidedActiveSectionId` to the clicked section (which triggers step 2)
4. In accordion mode (`guidedStepperActive: false`), `toggleSection` works normally with no interception

This is strictly unidirectional: `guidedActiveSectionId` → `collapsedSections`. Never the reverse.

**Feature flag toggle mid-flow:** When `visibleSections` changes (user enables/disables CPF, Property, etc.), the stepper re-runs `collapseAllExcept` with the updated list. If the current `guidedActiveSectionId` was removed from `visibleSections`, fall back to the first unreviewed visible section.

#### Reviewed vs Complete: Two Separate Concepts

The stepper needs to track "has the user seen this section?" separately from "has the user changed values from defaults?" These are different:

- **Reviewed** (`reviewedSections` in UIStore): the user clicked Continue or Skip on this section. Means they've seen it and made a conscious choice, even if they accepted defaults.
- **Customized** (`useSectionCompletion.isComplete`): the section has non-default values. A section can be customized but not reviewed (user imported a plan), or reviewed but not customized (user accepted defaults).

The progress bar shows both states. The "next section" logic uses `reviewedSections`. The "all done" completion card appears when all `visibleSections` are in `reviewedSections`.

#### State (UIStore additions)

New fields in `UIState` interface AND `DEFAULT_UI`:

```ts
// UIState additions
guidedStepperActive: boolean              // is stepper mode on?
guidedActiveSectionId: RenderedSectionId | null  // current section in stepper mode
reviewedSections: RenderedSectionId[]     // sections the user has reviewed (Continue/Skip)
dismissedSectionIntros: RenderedSectionId[]  // which section intros the user closed

// DEFAULT_UI additions
guidedStepperActive: true,                // new users start in guided mode
guidedActiveSectionId: null,              // stepper sets this on first render
reviewedSections: [],
dismissedSectionIntros: [],
```

**Persistence behavior:**
- `guidedStepperActive`: **persisted** — survives page reloads
- `guidedActiveSectionId`: **persisted** — users resume where they left off
- `reviewedSections`: **persisted** — reviewed state survives across sessions
- `dismissedSectionIntros`: **persisted** — dismissed intros stay dismissed

All four are included in the `partialize` output (i.e., NOT excluded). The existing `partialize` exclusion list (`contextualNudgeActive`, `quickModeActive`, `simulationView`) remains unchanged.

**New actions in UIActions:**

```ts
collapseAllExcept: (sectionId: string, allSectionIds: string[]) => void
markSectionReviewed: (sectionId: RenderedSectionId) => void
dismissSectionIntro: (sectionId: RenderedSectionId) => void
```

**UIStore migration:** Bump `version` from 11 to 12:
```ts
if (version < 12) {
  state.guidedStepperActive = false  // existing users keep accordion mode
  state.guidedActiveSectionId = null
  state.reviewedSections = []
  state.dismissedSectionIntros = []
}
```

Note: migration sets `guidedStepperActive: false` for existing users (not `true`). Only fresh installs get `true` from `DEFAULT_UI`. This avoids re-onboarding power users. A dismissable "Try guided mode?" banner is shown to existing users on first visit after upgrade.

#### Defaults and Transitions

- **Fresh localStorage (new user):** `guidedStepperActive: true` from `DEFAULT_UI`, stepper sets `guidedActiveSectionId` to first visible section on mount
- **Existing user (migration from v11):** `guidedStepperActive: false`, accordion view. Dismissable banner offers guided mode.
- **User toggle:** "Guide me" / "Show all sections" toggle in InputsPage header. Persisted immediately.
- **Exiting stepper mode:** When `guidedStepperActive` transitions from `true` to `false`, reset `collapsedSections` to `[]` (expand all) so the user doesn't land in accordion mode with 8 collapsed sections.
- **All sections reviewed:** Show a completion card with CTAs to `/projection`, `/dashboard`, or `/stress-test`. Does NOT auto-deactivate stepper — user can review sections, toggle mode manually, or navigate away.

#### Sidebar Integration

`useActiveSection` uses IntersectionObserver to detect which section is in the viewport. In stepper mode, collapsed sections have near-zero height, making scroll detection unreliable.

**Branch point: `useActiveSection` hook.** When `guidedStepperActive` is `true`, the hook returns `guidedActiveSectionId` from UIStore instead of the observer-detected section. `useActiveSection` already reads UIStore (for feature flags), so this is a natural extension. When `guidedStepperActive` is `false`, the existing observer logic runs unchanged.

This covers both Sidebar and HelpPanel, which both consume `useActiveSection`.

#### What stays the same

- All section content components are unchanged
- `HouseholdPrototypeSection` accordion rendering preserved (stepper controls it via store actions)
- Pathway ordering (`sectionOrder`) drives step order
- `useSectionCompletion` provides customization state (separate from reviewed state)
- Existing `toggleSection` and `expandSection` actions remain (used in accordion mode)

---

## Approach 3 Upgrade Path

If we later want per-question stepper (TurboTax full depth):
- `fieldGuide.ts` section content carries over directly
- Add per-field entries to `fieldGuide.ts` (the `FieldGuideEntry` interface is designed for this)
- `GuidedStepper` component becomes the orchestrator for field-group rendering
- Progress bar, step state, and review tracking all reuse
- Only the rendering layer changes: "one accordion at a time" → "one field group at a time"

## Deferred: Pattern A (Rich Field Tooltips) — Phase 2

Field-level tooltips are deferred because:

1. **Shared input API gap:** `NumberInput`, `CurrencyInput`, and `PercentInput` accept `tooltip?: string`, not a guide ID or custom tooltip node. Adding `FieldTooltip` requires changing the shared input interface.
2. **Desktop interaction model:** The current `InfoTooltip` uses Radix `Tooltip` (hover-triggered, non-interactive). An expandable "Learn more" section needs Radix `Popover` or `HoverCard` on desktop, which is a different component path.
3. **Content authoring:** 50-80+ field entries is a significant effort that should follow the stepper UX, not gate it.

**Phase 2 scope (future):**
- Extend shared inputs to accept `fieldGuideId?: string` prop
- Create `FieldTooltip` component using `Popover` (click-triggered) on both desktop and mobile for interactive "Learn more" content
- Add per-field entries to `fieldGuide.ts` incrementally (4 sections first: Personal, Income, Expenses, FIRE Settings)

---

## Files Summary

| File | Change | Type |
|------|--------|------|
| `lib/data/fieldGuide.ts` | New: section guide data + accessor | Data |
| `components/inputs/SectionIntro.tsx` | New: section intro card | Component |
| `components/inputs/GuidedStepper.tsx` | New: progress bar + nav buttons | Component |
| `pages/InputsPage.tsx` | Modify: integrate stepper, section intros, mode toggle, stepper intercept for toggleSection | Page |
| `stores/useUIStore.ts` | Modify: add 4 state fields, 3 actions, bump to v12 | Store |
| `hooks/useActiveSection.ts` | Modify: stepper-mode branch (return `guidedActiveSectionId` when active) | Hook |
| `components/shared/InfoTooltip.tsx` | No change | - |
| `hooks/useSectionCompletion.ts` | No change | - |

## Accessibility

- Progress bar uses `role="navigation"` with `aria-label="Form progress"`
- Each step uses `aria-current="step"` for the active step
- Continue/Back buttons manage focus: advancing moves focus to the newly opened section's first focusable element
- Section intros use `role="note"` for screen reader clarity
- Completion status icons have `aria-label` text (e.g., "Complete", "Needs review", "Has errors")

## Non-Goals

- No LLM-powered guidance (the AI panel already handles that)
- No changes to calculation logic, validation, or stores beyond UIStore
- No changes to StartPage or other routes
- No per-question breakdown (Approach 3) in this iteration
- No animated page transitions between steps
- No changes to section content components themselves
- No field-level tooltips (deferred to Phase 2)

## Edge Cases

- **Conditional sections (CPF, Protection, Property):** `visibleSections` filters by feature flags. If a user enables CPF mid-flow, the section appears in the progress bar at its pathway-defined position and `collapseAllExcept` re-runs.
- **Feature flag toggle removes current section:** If the user disables the section they're currently on, `guidedActiveSectionId` falls back to the first unreviewed visible section.
- **All sections already reviewed on first visit:** Can happen if user went through `HouseholdSetupWizard`. Show the completion card immediately with option to re-review sections.
- **Section has validation errors:** Progress bar shows error icon (red). Continue still works (errors don't block progress).
- **Mobile viewport:** Progress bar collapses to "Step N of M" with arrow buttons. Section intros stay full-width.
- **Existing InputsPage footer card:** The stepper completion card is shown above the existing footer card in stepper mode. In accordion mode, only the existing footer card renders (no duplication).
- **`guidedActiveSectionId` out-of-bounds:** If the persisted section ID is no longer in `visibleSections` (e.g., CPF disabled since last visit), fall back to the first unreviewed visible section.

## Testing

- Stepper activates for new users (fresh localStorage), not for existing users (migration)
- Progress bar reflects correct section ordering per pathway
- Continue marks section as reviewed and advances to next unreviewed
- Skip marks section as reviewed without requiring changes
- Back navigates to previous section
- Section intros show/hide based on mode and dismissal state
- Conditional sections appear/disappear in stepper when toggled
- Completion card shows when all visible sections are reviewed
- Mode toggle resets `collapsedSections` to `[]` when switching to accordion
- Accordion click in stepper mode updates `guidedActiveSectionId`
- `useActiveSection` returns `guidedActiveSectionId` in stepper mode, observer value in accordion mode
- `SectionIntro` renders nothing for sections without guide entries
- Banner shown to existing v11→v12 users offering guided mode
