# Goal Calculator V1.5: Simplify + Share

**Route:** `/goal-calculator` (same as V1)
**Branch:** `feat/goal-calculator`
**Date:** 2026-03-27

## Goal

Reduce friction to first result, add smart disclaimers that drive users to the full planner, and make results shareable. No new calculation complexity. The goal calculator stays a fun front door, not a second planner.

## Changes from V1

### 1. Result-First Flow (Preview Before Basics)

**Current V1 flow:**
```
Pick goal → Configure → Basics form (4 fields, required) → Results
```

**V1.5 flow:**
```
Pick goal → Configure → Preview result (SG median defaults) →
  "This is for a typical fresh grad. Adjust your details for a personalized plan."
  [Adjust my details] → Basics form (4 fields) → Personalized results
```

**How it works:**

After goal configuration, instead of going to BasicsForm, the user sees a preview result card using hardcoded SG median fresh-grad defaults:

```typescript
const PREVIEW_DEFAULTS: GoalCalcBasics = {
  age: 25,
  monthlyIncome: 3_500,   // Median fresh grad take-home (after CPF)
  monthlyExpenses: 2_000,  // ~57% of income
  existingSavings: 0,
}
```

The preview result uses the same Results component but with two differences:
- A banner at the top: "Quick estimate for a typical fresh grad earning $3,500/mo"
- The "Edit basics" button is replaced with a prominent "Personalize your plan" CTA
- The "Continue to planner" button is hidden (only shown after personalization)

**State machine change:**

Add a `'preview'` step between `'config'` and `'basics'`:

```
type Step = 'pick' | 'config' | 'preview' | 'basics' | 'results'
```

- `COMPLETE_CONFIG` now transitions to `'preview'` (not `'basics'`) when basics are null
- If basics already exist (adding a second goal), skip preview and go to `'results'` as before
- New action `PERSONALIZE` transitions from `'preview'` to `'basics'`
- New action `SKIP_PERSONALIZE` transitions from `'preview'` to `'results'` (keeps defaults)

**Why preview defaults instead of skipping basics entirely:** Users who earn $6K see a result based on $3,500 and immediately want to correct it. The "wrong" default creates urgency to personalize. Users who just want a quick answer can skip personalization entirely.

### 2. Smart Disclaimers

Add contextual disclaimers to results that acknowledge the calculator's intentional simplifications and drive users to the full planner.

**Property goals (HDB, condo, landed):**
```
"This is a cash-only estimate. Your CPF OA contributions could cover a significant
portion of the down payment and monthly mortgage. First-time buyers may also qualify
for housing grants of up to $80,000. The full planner accounts for both."
```

**All goals (retirement impact callout):**
```
"This quick estimate uses a simplified model. The full planner includes CPF LIFE
payouts, income growth, investment returns, and tax optimization for a more
accurate retirement picture."
```

**Implementation:** Add a `disclaimers` section to the Results component, rendered below the retirement impact callout and above the action buttons. Disclaimer text varies based on goal categories present (check for `housing` category in goals array).

**Copy rules:**
- No em dashes (per CLAUDE.md)
- Keep to 2-3 sentences max per disclaimer
- End with a value proposition for the full planner, not just "this is inaccurate"
- Use "could" and "may" language (grants are not guaranteed)

### 3. Shareability

**3a. Copy as Image**

Add a "Share your plan" button to the results page that generates a shareable card image.

The card is a styled HTML element rendered to canvas via `html2canvas` (or similar lightweight library). No server needed.

**Card content:**
```
┌──────────────────────────────────────┐
│         SG FIRE Planner              │
│      Goal Calculator Results         │
│                                      │
│  🏠 HDB 4-Room (BTO)                │
│  $354/mo for 10 years                │
│  Feasibility: Comfortable ✓         │
│                                      │
│  Freedom Age: 52                     │
│                                      │
│  sgfireplanner.com/goal-calculator   │
└──────────────────────────────────────┘
```

Shows goal name, monthly savings, feasibility, and Freedom Age. Multi-goal shows all goals stacked. URL at bottom for organic traffic.

**Button:** "Share your plan" with a Share2 icon, placed after "Edit basics" and before "Continue to planner." On click, generates the image and triggers the Web Share API (mobile) or copies to clipboard (desktop). Falls back to download as PNG.

**3b. Shareable URL (deferred)**

Encoding state in URL params (goals, basics) adds complexity and creates long URLs. Defer to V2. The image share covers the viral use case.

### 4. Lifestyle Translation

Add a single line below the "Monthly savings needed" headline in each goal result card:

```
Monthly savings needed
$354/mo
That's about $12/day
```

**Implementation:** Simple division: `Math.round(monthlySavings / 30)`. Only show when monthlySavingsNeeded > 0. Rendered as a `text-sm text-muted-foreground` line below the monthly amount.

No "Grab rides" or "coffees" equivalent. Just the daily amount. Clean, universal, no assumptions about lifestyle.

### 5. Freedom Age

Replace the current retirement impact callout text with a single prominent number.

**Current (V1):**
```
"These goals would shift your estimated retirement age by ~5 years
(estimate based on 3.6% real return and 28x annual expenses)."
```

**V1.5:**
```
┌─────────────────────────────────────┐
│  Your estimated Freedom Age: 52     │
│                                     │
│  Without these goals: 47            │
│  Quick estimate based on 3.6% real  │
│  return and 28x annual expenses.    │
└─────────────────────────────────────┘
```

**Implementation:** Compute both `yearsWithGoals` and `yearsWithoutGoals` from `computeRetirementImpact()` (already available). Display as `basics.age + yearsWithGoals` and `basics.age + yearsWithoutGoals`. Only show when both values are finite.

**"Freedom Age" not "Retirement Age":** Reframing retirement as freedom resonates better with fresh grads who don't identify with "retirement." The number is the same, the framing is different.

## Files Changed

| File | Change |
|------|--------|
| `GoalCalculatorPage.tsx` | Add `'preview'` step to state machine, `PERSONALIZE` and `SKIP_PERSONALIZE` actions, `PREVIEW_DEFAULTS` constant |
| `Results.tsx` | Add `isPreview` prop, preview banner, disclaimers section, lifestyle translation line, Freedom Age display, share button |
| `ShareCard.tsx` (new) | Shareable image card component, html2canvas rendering |
| `goal-calculator.ts` | No changes (all computation stays the same) |
| `goal-defaults.ts` | No changes |

## What This Does NOT Include

- CPF OA calculations (full planner feature)
- Housing grant calculations (full planner feature)
- Couple mode (full planner feature)
- Income growth (full planner feature)
- Wealth curve visualization (V2)
- What-if sliders (V2)
- Shareable URLs (V2)
- Life-path generator (V3, maybe never)

These are deliberately excluded. They belong in the full planner or future versions. The goal calculator stays simple.

## Testing

- E2E: Add test for preview flow (goal config → preview → personalize → results)
- E2E: Add test for skip personalization (goal config → preview → skip → results with defaults)
- Unit: No new calculation logic, existing tests cover computation
- Manual: Verify share card renders correctly on iOS Safari and Chrome Android
- Manual: Verify Web Share API fallback to clipboard copy on desktop

## Dependencies

- `html2canvas` or equivalent for share card rendering (evaluate bundle size, ~40KB gzipped)
- Alternative: use canvas API directly for simpler card layout (no dependency)

## Success Metrics

- **Time to first result:** Should be < 30 seconds (2 clicks + zero typing in preview flow)
- **Share rate:** Track via "Share your plan" button clicks (PostHog event, if added later)
- **Personalization rate:** What % of users click "Personalize" vs skip with defaults
- **Transfer rate:** What % continue to full planner (same as V1, should improve with disclaimers)
