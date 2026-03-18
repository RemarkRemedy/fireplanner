# Setup Flow Engagement: Mirror Moments + Age-Adaptive Tone

**Date:** 2026-03-18
**Status:** Draft
**Problem:** Three drop-off points — (A) users get quick estimate and leave, (B) early setup abandonment, (C) mid-flow fatigue at CPF/property/healthcare screens.

---

## 1. Design Summary

Three interlocking systems to increase setup completion:

1. **Quick Estimate Bridge** — Replace single-point FIRE age with a range estimate that creates a curiosity gap, pulling users into the full setup flow.
2. **Mirror Moments** — After every 2-3 setup screens, show a micro-insight about the user's finances. Engine-derived insights always; government benchmark comparisons only when flattering.
3. **Age-Adaptive Tone** — Users under 25 get a gamified presentation layer (confetti, animated progress, casual copy). Users 25+ get the professional mirror-moment experience.

Age is the first setup screen, so the tone pivot happens immediately.

---

## 2. Quick Estimate Bridge (Problem A)

### Current behavior
`computeQuickEstimate()` in `lib/calculations/quickEstimate.ts` returns a single `fireAge` (e.g., "Retire at 55"). Users see an animated result with FIRE number, savings rate, and projected net worth chart. This feels complete enough to leave.

### New behavior
Show a **range** instead of a point estimate:

- **Optimistic bound:** Current calculation with +1% return assumption (represents "things go well")
- **Conservative bound:** Current calculation with -1% return assumption (represents "things go modestly")
- **Display:** "You could retire between **52 and 61**"
- **CTA below range:** "Complete your profile to get a precise year. CPF, property, and healthcare data typically narrow this by 5+ years."

### Framing (avoids looking less accurate)
The range is positioned as *methodological rigor*, not uncertainty:
- Use the word "range" not "estimate"
- Show it as a horizontal bar/slider visualization with the two ages as endpoints
- Subtitle: "Based on income and expenses alone. Your CPF, property, and savings history will sharpen this."

### Implementation notes
- Add `computeQuickEstimateRange()` that calls the existing function twice with adjusted returns
- The spread (optimistic - conservative) is the "uncertainty" the user wants to resolve
- No changes to the existing `computeQuickEstimate()` — the range wraps it
- **Edge case:** If the conservative estimate yields `unreachable` status (e.g., low base return where -1% pushes netRealReturn near zero), show only the optimistic bound with copy: "Could retire as early as {X} with favorable returns. Complete your profile for a fuller picture."

---

## 3. Mirror Moments (Problems B + C)

### Concept
Interstitial insight cards shown between setup screens at natural transition points. Each insight reflects the user's own data back to them in a way that's surprising, motivating, or revealing.

**Scope:** Mirror moments apply to the **primary adult's screens only**. In couple/household plans, partner screens (11-17) do not trigger additional mirror moments. The 5 mirror moments fire based on the primary adult's data entry progression.

### Placement (5 mirror moments across the flow)

| After screen(s) | Mirror moment | Type | Data source |
|-----------------|---------------|------|-------------|
| Age + Income (screens 1-2) | Savings power | Engine | Calculation |
| Expenses (screen 3) | Savings rate context | Benchmark + Engine | MOM salary data |
| CPF (screen 6) | CPF runway | Engine | Calculation |
| Property (screen 7/8) | Net worth composition | Engine | Calculation |
| Review (before confirm) | Full snapshot | Engine | All inputs |

### Mirror moment definitions

**Moment 1: "Savings Power" (after income)**
- Engine-derived: "At your income, every $500/month saved moves your FIRE date forward by ~{X} years."
- Always shown. Always positive framing (saving more = earlier retirement).

**Moment 2: "Savings Rate Context" (after expenses)**
- If savings rate >= median for age band: "Your savings rate of {X}% puts you ahead of most Singaporeans your age." (benchmark from MOM salary + user expenses)
- If savings rate < median: SUPPRESS benchmark. Instead show engine-derived: "You're saving ${X}/month. Over {yearsToGo} years at 5% returns, that alone grows to ${Y}."
- The median savings rate is derived: `1 - (user expenses / MOM median income for age band)`. This is an approximation, not a published stat, so frame as "most Singaporeans" not "the national median."

**Moment 3: "CPF Runway" (after CPF)**
- Engine-derived: "Your CPF balances alone could fund ~{X} years of retirement expenses after 65."
- Calculation: `(cpfOA + cpfSA) / annualExpenses` (simplified, ignoring CPF LIFE payouts for the teaser. Excludes cpfMA because MediSave is earmarked for healthcare, not retirement spending.)
- If X > 5: positive framing. If X < 5: reframe as "Your CPF is a foundation. The projection will show how your other savings fill the gap."

**Moment 4: "Net Worth Composition" (after property)**
- Engine-derived: "Your estimated net worth is ${X}. {Y}% is in property, {Z}% in liquid savings{, W% in CPF}."
- This is a pure composition insight — no judgment, just a pie chart moment. Useful because many Singaporeans are asset-rich/cash-poor and don't realize it.
- Show a simple horizontal stacked bar (property | liquid | CPF) with percentages.

**Moment 5: "Full Snapshot" (review screen, before confirm) — DESKTOP ONLY**
- Engine-derived summary: "With everything you've told us: you could retire at ~{fireAge} with ${fireNumber} saved. {topInsight}."
- `topInsight` is the single most impactful finding — e.g., "Your property equity accounts for 60% of your retirement runway" or "Your CPF adds 8 years to your timeline."
- This is the "reward" for completing setup — a rich, personalized insight that the quick estimate couldn't give.
- **Mobile (viewport < 768px): Moment 5 is SKIPPED.** On mobile, after setup confirm, the user is navigated to `/wrapped` (the FIRE Story experience), which delivers the full snapshot more richly across 8-9 animated story cards. The story's summary card replaces Moment 5's function.
- **Desktop (viewport >= 768px): Moment 5 fires as described.** After confirm, the user navigates to `/projection` with a toast. The "See your FIRE Story" button on the projection page provides optional access to the story experience.

### Mirror moment UI component

Each mirror moment is a **full-width interstitial card** that appears between screens:
- Subtle entrance animation (fade-in + slight slide-up, 300ms)
- Primary insight text in large font
- Supporting detail in smaller muted text
- A "Continue" button (not auto-advance — let the user absorb it)
- No back button on mirror moments (they're not "screens" in the progress bar)
- Mirror moments do NOT increment the step counter — they feel like bonuses, not work
- **Fire-once rule:** Each mirror moment fires at most once per setup session. If the user navigates back past a trigger point and advances again, the mirror does not re-appear. Track shown mirror IDs in local component state (not persisted).

### Benchmark data plan

**Already available:**
- `lib/data/momSalary.ts` — median gross annual income by age group and education level (MOM Labour Force 2025)
- `lib/data/healthBenchmarks.ts` — 9 financial health ratios with thresholds

**Needed:**
- A helper function to derive "median savings rate by age band" from MOM salary data + a reasonable expense assumption. This is approximate by nature — we're comparing the user's actual savings rate against an implied benchmark.
- No new external data files needed for V1. The MOM salary data is sufficient for the one benchmark comparison we show (Moment 2).

**Maintenance:**
- MOM salary data is already tracked in the annual maintenance checklist (`docs/maintenance-checklist.md`)
- No additional maintenance burden beyond what already exists

---

## 4. Age-Adaptive Tone (Under 25)

### Trigger
`currentAge < 25` (set on the first setup screen, immediately available for all subsequent screens).

### What changes for young users

| Element | 25+ (default) | Under 25 |
|---------|---------------|----------|
| **Progress indicator** | "Step 3 of 8" | "Level 3 of 8" with animated fill |
| **Mirror moment copy** | Professional, measured | Casual, encouraging ("You're crushing it!", "Not bad for {age}!") |
| **Milestone celebrations** | Subtle checkmark animation | Confetti burst (canvas-confetti) at moments 2 and 5 |
| **Continue button copy** | "Continue" | "Next level" / "Keep going" |
| **Completion celebration** | Clean summary card | Full confetti + "Achievement unlocked: Financial Clarity" |
| **Review screen** | Green checkmarks | Gold star icons |

### What does NOT change
- Screen order and content (same flow, same questions)
- Input components (same CurrencyInput, NumberInput, etc.)
- Calculation logic (identical engine)
- Mirror moment placement and data (same insights, different copy wrapper)
- The progress bar still exists (just different label)

### Copy variants

Each mirror moment needs two copy variants:

**Moment 1 (Savings Power):**
- 25+: "At your income, every $500/month saved moves your FIRE date forward by ~{X} years."
- <25: "Every extra $500/month you save? That's {X} fewer years of work. Not bad."

**Moment 2 (Savings Rate):**
- 25+: "Your savings rate of {X}% puts you ahead of most Singaporeans your age."
- <25: "Saving {X}% of your income at {age}? You're already ahead of the game."

**Moment 3 (CPF Runway):**
- 25+: "Your CPF balances alone could fund ~{X} years of retirement expenses after 65."
- <25: "Your CPF is already worth {X} years of retirement. And you haven't even hit your peak earning years."

**Moment 4 (Net Worth):**
- 25+: "Your estimated net worth is ${X}. {Y}% property, {Z}% liquid, {W}% CPF."
- <25: "Total net worth: ${X}. Here's how it breaks down:" (same bar chart)

**Moment 5 (Full Snapshot):**
- 25+: "With everything you've told us: retire at ~{fireAge} with ${fireNumber}. {topInsight}."
- <25: "If you keep this up: FIRE by {fireAge}. That's {yearsToGo} years from now. {topInsight} Level complete."

### Confetti specification
- Library: `canvas-confetti` (lightweight, no dependencies, ~5KB gzipped)
- **Dynamic import:** Lazy-load via `import('canvas-confetti')` since it only affects under-25 users. Do not add to the main bundle.
- Trigger: Only for under-25 users, only at Moment 2 (first benchmark win) and Moment 5 (completion)
- Duration: 2 seconds, moderate particle count (50-80), falls from top
- No confetti for below-benchmark users (Moment 2 suppresses benchmark, so confetti also suppresses)

---

## 5. Component Architecture

### New components

| Component | Location | Purpose |
|-----------|----------|---------|
| `MirrorMoment` | `components/setup/MirrorMoment.tsx` | Interstitial insight card with age-adaptive copy |
| `QuickEstimateRange` | `components/shared/QuickEstimateRange.tsx` | Range visualization for the start page |
| `SetupConfetti` | `components/setup/SetupConfetti.tsx` | Thin wrapper around canvas-confetti, only renders for <25 |

### New calculation functions

| Function | Location | Purpose |
|----------|----------|---------|
| `computeQuickEstimateRange()` | `lib/calculations/quickEstimate.ts` | Calls existing calc twice with +/- 1% return |
| `computeMirrorInsights()` | `lib/calculations/mirrorInsights.ts` | Pure function: takes setup state, returns 5 mirror moment data objects |
| `getMedianSavingsRate()` | `lib/calculations/mirrorInsights.ts` | Derives approximate savings rate benchmark from MOM salary data for an age band (imports from `lib/data/momSalary.ts`) |

### State management
- Mirror moments are **stateless** — computed on-the-fly from current setup state when displayed
- No new Zustand store (mirrors are derived, not stored)
- Age-adaptive tone reads `currentAge` from setup state (already available)
- `SetupPage.tsx` manages which mirror moment to show based on current screen index

### Setup flow integration
The mirror moment slots into the existing screen progression in `SetupPage.tsx`:

```
Screen 1 (Age) → Screen 2 (Income) → [Mirror 1] → Screen 3 (Expenses) → [Mirror 2] → ...
```

The `SetupPage` tracks a `mirrorQueue` — after advancing past certain screen indices, the next render shows a `MirrorMoment` instead of the next `SetupScreen`. After the user clicks Continue on the mirror, the normal screen progression resumes.

---

## 6. Edge Cases

| Scenario | Handling |
|----------|----------|
| User changes age after initial entry (goes back) | Tone recalculates. If they change from 23 to 26, confetti stops. If 26 to 23, confetti starts. No jarring transition — the next mirror moment just uses the new tone. |
| User has $0 savings | Moment 1 still works (savings power is forward-looking). Moment 4 composition may show 100% in one category — still valid. |
| User skips CPF (foreigner) | Mirror 3 (CPF Runway) is suppressed. Flow goes from Mirror 2 to Mirror 4. |
| User skips property (doesn't own, not planning) | Mirror 4 (Net Worth) omits property slice. Still shows liquid + CPF if applicable. |
| Expenses exceed income (negative savings) | Mirror 2 suppresses benchmark (savings rate is negative). Shows engine insight: "Your expenses currently exceed your income. The projection will model how this affects your timeline." No judgment. |
| Very high savings rate (>50%) | Benchmark comparison shown with extra encouragement. For <25: confetti on Mirror 2. |
| User is exactly 25 | Gets the 25+ (professional) experience. The threshold is `< 25`, not `<= 25`. |

---

## 7. Testing Requirements

New pure functions in `lib/calculations/` require corresponding `.test.ts` files per CLAUDE.md coverage rules (>= 95%):

- `lib/calculations/quickEstimate.test.ts` — add tests for `computeQuickEstimateRange()` covering: normal range, conservative-unreachable fallback, zero savings, negative savings rate
- `lib/calculations/mirrorInsights.test.ts` — tests for `computeMirrorInsights()` and `getMedianSavingsRate()` covering: all 5 moments, benchmark suppression for below-median users, foreigner (no CPF) path, no-property path, edge values

---

## 8. What This Does NOT Include (YAGNI)

- **No badges or persistent achievement system.** The gamification is ephemeral (confetti during setup only, not tracked).
- **No social sharing.** "Share your FIRE age" is a future consideration, not V1.
- **No A/B testing framework.** We ship one version and iterate based on qualitative feedback.
- **No changes to post-setup experience.** The dashboard, projection, and health check pages are unchanged.
- **No new external data sources.** V1 uses only MOM salary data already in the codebase.

---

## 9. Success Criteria

Since there's no analytics (privacy-first, no PostHog/Sentry), success is measured by:

1. **Qualitative:** User feedback on setup completion experience (Reddit, direct feedback)
2. **Proxy metric:** The `sessionStorage('fireplanner-setup-just-completed')` flag already exists. If we later add optional anonymous usage stats, this is the completion signal.
3. **Self-test:** Walk through the setup flow as a 22-year-old and as a 35-year-old. Both should feel natural, neither should feel patronizing or boring.
