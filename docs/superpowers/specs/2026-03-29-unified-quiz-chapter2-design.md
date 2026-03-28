# Unified Money Personality Quiz + Chapter 2 Design

**Date:** 2026-03-29
**Status:** Draft
**Scope:** Quiz improvements + post-quiz "Chapter 2" experience + planner transition
**Audience:** Gen Z Singaporeans (22-30), entering via social channels (IG Stories, TikTok, WhatsApp/Telegram group chats)

## Problem Statement

The FIRE Personality Quiz exists as a fun, shareable entry point. But after the quiz result, users hit a tone cliff: "Plan My FIRE" dumps them into a serious planner setup wizard. The quiz audience (curious, social, low-commitment) is not the planner audience (intent-driven, spreadsheet-minded). There is no bridge between personality insight and actionable financial planning.

Meanwhile, the quiz itself has structural issues: the scoring model skews distribution toward the default type, some questions require financial literacy the target audience lacks, certain type names feel judgmental rather than celebratory, and "FIRE" branding limits reach to a niche subculture.

## Solution

A unified flow that evolves the quiz and adds a "Chapter 2" post-quiz experience. Chapter 2 collects minimal inputs (sliders on one screen), runs a personalized calculation, and delivers type-specific financial insights via 2 reveal cards. The flow ends with a shareable result card and a soft transition into the full planner via a "Your Starting Plan" summary view.

The existing goal calculator remains unchanged as the "serious" entry point for STEM/spreadsheet users.

---

## Part 1: Quiz Improvements

### 1.1 Branding

Rename from "FIRE Personality Quiz" to "Money Personality Quiz" on the splash screen and all external-facing surfaces (OG tags, share text, meta descriptions).

- Splash title: "What's Your Money Personality?"
- Splash subtitle: "5 questions. 60 seconds. Zero judgment." (keep)
- Remove "Join thousands of Singaporeans..." social proof line unless backed by real data
- FIRE is introduced in the results layer: "Your FIRE style: Lean FIRE" as one of the 3 stats

### 1.2 Scoring Model

Replace priority-based first-match scoring with dominant-axis model.

**Current (broken):** Priority cascade where first matching rule wins. Moderate users fall through to Chill Coaster (default). Conjunction requirements (savings >= 10 AND risk <= 4) make some types unreachable for balanced answerers.

**Revised:** Assign the type whose axis score is highest. Tiebreaker: the axis that received points from more distinct questions (indicating consistency). If still tied: blended type mapping to the closest match.

Chill Coaster becomes an intentional type, not a catch-all default. Renamed to "Balanced Drifter" (see 1.4). In the dominant-axis model, users who score roughly equally across axes (no single axis dominant by more than 2 points over the next highest) are classified as Balanced Drifter. This replaces the catch-all default with a meaningful classification: someone whose financial personality is genuinely balanced rather than strongly tilted.

### 1.3 Question Revisions

**Q1 (Saturday morning) -- KEEP as warm-up.** Low stakes, relatable, gets users into the flow. Accept that the financial signal is weaker than other questions. Its job is engagement, not differentiation.

**Q2 (split the dinner) -- KEEP, adjust price.** Change $200 to $150 for 4 people (more realistic for 22-30 demographic). The scenario tension stays the same.

**Q3 (bonus season) -- REPLACE.** Current version requires financial literacy (CPF SA top-up, DCA, ETF). Replace with:

> "You just got $2,000 you weren't expecting. What happens to it?"
> - Straight to savings. Don't even think about it. (savings+3)
> - Finally upgrade something I've been putting off. (risk+1, property+1)
> - Invest it somewhere. Money should work. (savings+1, risk+1, income+2)
> - Treat myself AND put some aside. Balance. (savings+1, risk+1)

Tests the same windfall behavior without jargon. All options are defensible choices, reducing social desirability bias.

**Note on property axis:** The original Q3 had a property+3 option ("property downpayment fund") that is removed here. Q4 remains the primary property differentiator (HDB = property+1, Condo = property+3, Landed = property+3). The "upgrade something" option above gets property+1 as a weak signal. Verify during scoring model calibration that the BTO Warrior type is still reachable with these weights.

**Q4 (dream home) -- KEEP, replace location-independent option.** The fantasy "anywhere, location-independent" option doesn't map to a money personality. Replace with:

> "Rent forever, invest the difference." (savings+2, risk+1, income+1)

This is an actual financial stance some SG Gen Z hold. More controversial = more shareable.

**Q5 ($100K celebration) -- KEEP for now.** Consider replacing in a future iteration with a BTO tradeoff question or a question involving family financial dynamics (parental involvement, ang bao money, contributing to household expenses). These are uniquely Singaporean and currently absent from the quiz.

**Future consideration (not in this spec):** Add a family/parents money dynamic to at least one question. "Your parents offer to help with your BTO down payment. Your reaction?" This captures a massive SG Gen Z money behavior that no question currently addresses.

### 1.4 Type Revisions

| Current Name | Issue | Revised Name | Revised Emoji |
|---|---|---|---|
| Kopi Saver | Strong, keep | The Kopi Saver | ☕ |
| Property Mogul | Generic | The BTO Warrior | 🏠 |
| Side Hustle Sultan | "Sultan" potentially culturally insensitive in multiracial SG | The Side Hustler | 💼 |
| Chill Coaster | Pejorative, catch-all default | The Balanced Drifter | 🏖️ |
| Moonshot Maverick | "Maverick" is American, C grade is a punishment | The All-In Ace | 🚀 |
| Steady Compounder | "Compounder" is finance jargon | The Steady Builder | 📈 |

**Grading system revision:** Replace letter grades (A+/A/B/C) with attribute bars or a radar chart. Every type must feel like a win. No type should have a "bad" grade. Each type gets a "flex angle":

- Kopi Saver: flexes discipline
- BTO Warrior: flexes ambition and planning
- Side Hustler: flexes drive and income growth
- Balanced Drifter: flexes self-awareness and balance
- All-In Ace: flexes boldness and conviction
- Steady Builder: flexes consistency and patience

### 1.5 Result Screen Restructure

Replace the current everything-at-once layout with a sequential reveal:

1. **The Reveal (0-2s):** Full-screen character illustration + personality type name. Animation: illustration scales up with a spring animation. This IS the dopamine hit. Nothing else competes.
2. **Identity scroll (scroll 1):** Strength card + Blind Spot card. The "that's so me" moment that triggers sharing.
3. **Stats scroll (scroll 2):** 3-axis radar/bars (replaces letter grades). Satisfies the analytical user.
4. **Action scroll (scroll 3):** Primary share button (prominent), Download card, Compare with Friend. Plus the Chapter 2 CTA (see 2.1). Graceful exit: "Share and go" option alongside the Chapter 2 CTA. Acknowledging they can leave increases likelihood of continuing.
5. **Discovery scroll (scroll 4):** Accordion with 3 action items + All Types gallery.

### 1.6 Animation Timing

Reduce answer highlight animation from 400ms to 250ms. By Q4-Q5, 400ms feels sluggish.

### 1.7 Retake Cooldown

Reduce from 30 days to 14 days. Without a trigger mechanism (push notification, email), 30 days is too long for users to remember the quiz exists.

### 1.8 Compare Mechanic

- Rename "Compare with Friend" to "Challenge a Friend" for competitive framing
- Improve share text: "I'm a [Type]. What are you? 60 seconds to find out: [URL]"
- Ensure URL preview (OG tags) is optimized for WhatsApp/Telegram since clipboard copy is more common in SG than Web Share API
- **Future consideration (not in this spec):** Couple comparison mode ("Take with your BTO partner"), group comparison mechanic (friend group distribution)

---

## Part 2: Chapter 2 -- Post-Quiz Experience

### 2.1 Entry CTA

Appears on the quiz result screen (Action scroll, alongside share buttons).

**CTA copy:** Type-specific, names the artifact being unlocked. Primary recommendation:
- "See your [Type] numbers"

Avoid "scorecard" (evaluative), "See What This Means" (vague), or anything that sounds like starting a new task.

**Graceful exit:** "Share and go" as a secondary option. The paradox of opt-outs: acknowledging they can leave makes them more likely to stay.

### 2.2 Input Screen (1 screen, ~15-20 seconds)

**Header:** Type-specific, one line. Examples:
- Kopi Saver: "Let's see what your discipline is worth"
- All-In Ace: "Let's see what bold looks like in numbers"
- Balanced Drifter: "Let's see where your pace takes you"

**Character illustration:** Small avatar of their type in the header area, maintaining personality presence.

**Privacy message:** Prominent, not a tooltip. "Your data stays on your phone. Nothing leaves this browser."

**6 inputs, all on one screen:**

| Input | Control | Default | Notes |
|---|---|---|---|
| Age | Number stepper or slider | None (required) | Range 22-65 |
| Monthly income | Range slider | Age-bracket median (e.g., $4,200 for 28yo) | Label: "What lands in your account each month (after CPF)". This is net take-home. Helper: "A rough number is fine". The planner can derive gross from net + residency + age for CPF calculations. |
| Monthly expenses | Range slider | Income-based estimate (~60% of income) | Anchor points on slider: "$1,500 - pretty frugal" / "$2,500 - comfortable" / "$4,000+" |
| Current savings | Range slider with labeled stops | Age-bracket median | Labeled stops: "$0" / "$25K" / "$50K" / "$100K" / "$200K+" but continuous between them. Users who don't know their exact balance pick the nearest stop. |
| Target retirement age | Slider | 62 (SG statutory re-employment age) | Range 40-70 |
| Residency status | 3-option segmented control | Citizen | Citizen / PR / Foreigner |

**Design patterns:**
- Animate slider defaults into position on load (300ms staggered cascade). Pre-positioned sliders feel "computed for you," not "empty form."
- Frame as "tuning" not "filling in." The artifact already exists; they are refining it.
- If a user doesn't know their savings, they can leave the default. Better an approximate answer than a bounced user.

**CTA:** "Show me" or "Calculate" at bottom of screen.

### 2.3 "Crunching" Interstitial (2.0-2.5 seconds)

Appears after input submission, before reveal cards.

**Animation:** Type-themed (kopi cup filling for Kopi Saver, blueprint drawing for BTO Warrior, rocket trajectory for All-In Ace, etc.).

**Narrated computation steps** (each appearing at ~0.7s intervals):
- "Projecting your savings trajectory..."
- "Modeling retirement scenarios..."
- "Generating your [Type] report..."

This is the IKEA effect: perceived effort increases perceived value. The narration primes users for what the reveal cards will show.

**Important:** If actual computation takes <500ms, the interstitial still runs for 2.0-2.5s. The perceived computation time is what matters, not the actual time. The animation must feel purposeful, not decorative.

### 2.4 Reveal Card 1: The Surprise

Full-screen card. The single most emotionally impactful number for each type.

**Structure:**
- Line 1: The number (large, type accent color)
- Line 2: The reframe (peer comparison or expectation contrast)
- Line 3: One sentence of type-specific meaning

**Per-type content:**

**Kopi Saver -- "The Grade"**
- Number: Savings rate as a visual grade (but not letter grades, use a percentile bar or similar)
- Reframe: "You save [X]% of your income. That puts you ahead of [Y]% of Singaporeans your age."
- Meaning: "Your discipline is already doing the heavy lifting."

**BTO Warrior -- "The Cash Number"**
- Number: Cash needed for their target property (after CPF OA and grants)
- Reframe: Animated breakdown: price -> minus CPF OA -> minus grants -> cash needed
- Meaning: "That's [daily equivalent] per day in savings to get there by [age]."

**Side Hustler -- "The Side Income Effect"**
- Number: Freedom age drop from adding $1,500/mo side income
- Reframe: Animated counter ticking down (e.g., 52 -> 48 -> 44)
- Meaning: "Every $500/mo of additional income is [X] fewer years of mandatory work."

**Balanced Drifter -- "The Small Shift"**
- Number: Difference between current pace and current pace + $200/mo
- Reframe: Side-by-side wealth at retirement age, gap growing over time
- Meaning: "That's [daily equivalent]. [Relatable anchor: skipping one Grab ride a week]."

**All-In Ace -- "The Spread"**
- Number: Three-scenario fan (conservative 5%, expected 7%, aggressive 12%)
- Reframe: Freedom age range: "somewhere between [X] and [Y]"
- Meaning: "The gap between your best and worst case is [Z] years. That's the price of volatility."

**Steady Builder -- "The Hockey Stick"**
- Number: The inflection year (when investment returns exceed annual savings contributions)
- Reframe: Animated curve showing the bend
- Meaning: "In [X] years, your money earns more than you save. After that, every year accelerates."

### 2.5 Reveal Card 2: The Cliffhanger

Full-screen card. Opens an unresolved tension about their own result. This is NOT a rhetorical question. It shows something incomplete about their projection that they naturally want to resolve.

**Structure:**
- Line 1: Statement showing incompleteness
- Line 2: Visual hint of what's missing (grayed-out element, partial chart)
- CTA: Directly references what gets resolved ("See the full picture" / "Get the real number")

**Per-type content:**

**Kopi Saver:**
- "Your grade doesn't account for CPF optimization. That could change everything."
- Grayed-out CPF bar beneath their savings rate
- CTA: "See your optimized number"

**BTO Warrior:**
- "This assumes today's property prices. Here's what changes with a timeline shift."
- Grayed-out timeline with multiple property price points
- CTA: "See your property roadmap"

**Side Hustler:**
- "This shows one income level. Your trajectory changes with every raise."
- Fading income growth curve
- CTA: "See your income scenarios"

**Balanced Drifter:**
- "This covers the next 10 years. The picture at 55 looks different."
- Partial wealth curve that fades out
- CTA: "See your full timeline"

**All-In Ace:**
- "This doesn't include your safety net. CPF alone gives you $[X]/mo from 65."
- Grayed-out CPF LIFE bar beneath the spread
- CTA: "See your floor and your ceiling"

**Steady Builder:**
- "This is your current trajectory. Three optimization moves could shift the curve."
- Dotted alternate curve above the current one
- CTA: "See your optimization moves"

### 2.6 Shareable Result Card

One screen. Designed AS the shareable asset (Spotify Wrapped energy).

**Layout:**
- Character illustration (circular, top center)
- Personality type name
- Hero number: Freedom age (universal across all types)
- Type-specific framing line beneath:
  - Kopi Saver: "On track for freedom at [age]"
  - BTO Warrior: "Building toward freedom at [age]"
  - Side Hustler: "Hustling toward freedom at [age]"
  - Balanced Drifter: "Drifting toward freedom at [age]"
  - All-In Ace: "Aiming for freedom at [age]"
  - Steady Builder: "Compounding toward freedom at [age]"
- One grayed-out secondary metric: "3 optimization moves available in your plan" (keeps the loop open)
- Watermark: sgfireplanner.com/quiz

**Share actions:**
- "Share" (Web Share API + clipboard fallback, clipboard prominent)
- "Download" (1080x1920 PNG for IG Stories)
- "Challenge a Friend" (quiz URL with encoded result for side-by-side comparison)

**The card must be beautiful.** Clean background using type's gradient, large typography readable at IG Story viewing distance. This card is your ad creative. Every share is an impression.

### 2.7 Email Capture (Optional)

Inline on the same screen as the share card, positioned below the share actions and above the "Open My Plan" CTA. Not a separate screen. Never a modal.

**Copy:** "Get your full [Type] report by email"
**Control:** Single email input + "Send it" button
**Rules:**
- Never gates "Open My Plan." The planner button is always visible and tappable.
- On mobile: dismissible bottom sheet, not full-screen overlay
- Expected capture rate: 8-15% of users who reach this screen
- Uses existing D1/Cloudflare email-signup function

### 2.8 "Open My Plan" Transition

**CTA copy:** References Card 2's cliffhanger (type-specific). Plus reassurance copy beneath:
- "No signup needed. Your data stays on your phone."
- "Takes 2 minutes to explore."

**What happens on click:** Navigates to a new "Your Starting Plan" summary view (see Part 3). Does NOT navigate to the full planner configuration.

---

## Part 3: Planner Transition

### 3.1 "Your Starting Plan" Summary View

A new read-only page that serves as the landing after Chapter 2. Not the full planner.

**Layout:**

**Section 1: "What we know"** -- displays the 6 inputs from Chapter 2 as confirmed facts (age, income, expenses, savings, retirement age, residency). Each shown as a labeled value, not an editable field. "Edit" link takes them back to Chapter 2.

**Section 2: "What this means"** -- 3-4 derived projections computed from the 6 inputs using the existing calculation engine (`buildProjectionParams` + `computeMetrics`):
- Freedom age (hero metric, large)
- Projected retirement corpus
- Monthly retirement income (from drawdown + CPF LIFE estimate)
- Current savings rate

Each metric shows the number and one line of context. The personality type's accent color and illustration appear on this page.

**Section 3: CTA** -- "Customize Your Plan" button opens the full planner with all 6 inputs pre-filled. The planner behaves normally from here (all fields editable, Monte Carlo available, etc.).

**What this page does NOT show:**
- Monte Carlo simulation options
- Withdrawal strategy selection
- Allocation configuration
- Any advanced planner features

These are for engaged users who click "Customize." The summary view is for first impressions.

### 3.2 Data Transfer

Chapter 2 inputs map to planner stores via `applySetupDraft` (same mechanism as the setup wizard and goal calculator bridge):

| Chapter 2 input | Planner store | Field |
|---|---|---|
| Age | profileStore | currentAge |
| Income (net take-home) | incomeStore | monthlyIncome (store accepts net; gross derived from net + CPF rate for residency/age) |
| Expenses | profileStore | monthlyExpenses |
| Savings | profileStore | currentSavings |
| Retirement age | profileStore | retirementAge |
| Residency | profileStore | residencyStatus |

Personality type is persisted to `localStorage['quiz-personality']` (already implemented).

### 3.3 Return Visit Behavior

If a user who completed Chapter 2 returns to the site:
- Skip the quiz
- Show their last result or the "Your Starting Plan" summary with data loaded
- "Retake Quiz" option available

Persist personality type + Chapter 2 completion flag in localStorage. Do not persist partial slider positions (if they abandoned the input screen, pre-filled defaults serve them just as well on return).

---

## Part 4: Viral Mechanics

### 4.1 Two Share Moments

1. **Primary (quiz result):** Personality type, no numbers. Identity-driven. This is the viral engine. Optimized for IG Stories (1080x1920).
2. **Secondary (Chapter 2 result):** One hero number (freedom age) + personality. Lower volume, higher quality. Brings in users curious about numbers.

The two cards should be visually distinct so the secondary doesn't feel like a repeat.

### 4.2 Deep Link Support

When a friend clicks a shared Chapter 2 result link:
- Show the sharer's personality type (no financial numbers)
- "Discover your type" CTA -> quiz splash

### 4.3 Compare Mechanic

Rename to "Challenge a Friend." Improve share text for WhatsApp/Telegram clipboard. Optimize OG preview tags.

**Future (not in this spec):** Couple comparison ("Financial compatibility"), group comparison (friend group distribution).

---

## Part 5: Navigation & Positioning

### 5.1 Entry Points

| Entry | Audience | Channel |
|---|---|---|
| Quiz ("Money Personality") | Curious, social, low commitment | IG, TikTok, WhatsApp, Telegram |
| Goal Calculator | Intent-driven, specific goal | SEO, search, direct |
| Full Planner (setup wizard) | Serious planners, spreadsheet minds | Direct, returning users |

### 5.2 Navigation

- Top-level nav: "Planner", "Quiz", "Goal Calculator"
- Quiz flow never mentions goal calculator
- Goal calculator has a small link at bottom: "Not sure where to start? Take the Money Personality Quiz"
- After both Quiz+Chapter 2 and Goal Calculator, users land in the same planner

---

## Part 6: Technical Notes

### 6.1 Calculation Engine

Chapter 2 reveal cards need:
- Freedom age computation (existing: `computeMetrics` via `calculateAllFireMetrics`)
- CPF OA accumulation (existing: year-by-year loop in `goal-calculator-sg.ts`)
- Property affordability (existing: `calculateLoanQualification`, `calculateCashNeeded`)
- Savings rate (trivial: `(income - expenses) / income`)
- Peer percentile benchmarks (new: static lookup tables based on DOS/CPF Board published statistics)

The "Your Starting Plan" summary view uses `buildProjectionParams` + `computeMetrics` with sensible defaults for allocation, withdrawal strategy, and other advanced fields.

### 6.2 New Components

- `QuizChapter2Page` -- orchestrates input screen, interstitial, reveals, share card
- `Chapter2InputScreen` -- 6 sliders/controls on one screen
- `Chapter2Interstitial` -- type-themed animation with narrated steps
- `Chapter2RevealCard` -- reusable card component for surprise + cliffhanger
- `Chapter2ShareCard` -- shareable result with download/share actions
- `StartingPlanSummary` -- read-only planner summary (new page or route)

### 6.3 Routes

| Route | Component | Purpose |
|---|---|---|
| `/quiz` | QuizPage (existing) | Quiz flow |
| `/quiz/chapter-2` | QuizChapter2Page (new) | Post-quiz Chapter 2 |
| `/quiz/:type` | QuizTypePage (existing) | Deep-link type pages |
| `/my-plan` | StartingPlanSummary (new) | Post-Chapter-2 planner landing |

### 6.4 localStorage Keys

| Key | Content | Lifecycle |
|---|---|---|
| `quiz-personality` | Type, scores, answers, timestamp (existing) | Overwritten each take |
| `quiz-history` | Array of past results (existing) | Up to 5 entries (reduced from 20) |
| `quiz-chapter2` | Chapter 2 completion flag + freedom age result | Set on Chapter 2 completion |

---

## Scope Boundaries

**In scope:**
- Quiz scoring model revision (dominant-axis)
- Q3 replacement, Q4 option swap
- Type renaming and grade removal
- Result screen sequential reveal
- Chapter 2 full flow (input, interstitial, 2 reveals, share, email capture)
- 6 type-specific reveal content
- "Your Starting Plan" summary view
- Data transfer via applySetupDraft
- Deep link support for share cards

**Out of scope (future work):**
- Couple/partner comparison mode
- Group comparison mechanic
- Family/parents question addition
- Animated share card (MP4) for IG Stories
- Push notification or email trigger for retake
- Q5 replacement with BTO tradeoff question
- "Anonymous mode" toggle (percentile ranks instead of numbers)
- Timer/speedrun mechanic on quiz

---

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Quiz completion rate | >85% | Umami: quiz_complete / quiz_start |
| Type distribution uniformity | No type >30% or <10% | Umami: quiz_complete by type |
| Chapter 2 entry rate | >65% of quiz completers | Umami: chapter2_start / quiz_complete |
| Chapter 2 completion rate | >55% of chapter2_start | Umami: chapter2_share / chapter2_start |
| Share rate (primary) | >25% of quiz completers | Umami: share_click events |
| Share rate (secondary) | >8% of chapter2 completers | Umami: chapter2_share_click events |
| Planner open rate | >25% of chapter2 completers | Umami: plan_open / chapter2_share |
| Email capture rate | 8-15% of users reaching share card | Umami: email_signup / chapter2_share |
