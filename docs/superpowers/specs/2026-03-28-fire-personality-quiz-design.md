# FIRE Personality Quiz — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Goal:** Standalone viral acquisition tool. Shareable personality quiz that funnels Gen Z users into the main planner.
**Scope:** New route + quiz engine + personality types + result cards + share flow. One minor change to existing surface: personalized greeting on SetupPage splash when arriving from quiz.

---

## Overview

A "What's Your FIRE Personality?" quiz that lives at `/quiz`. 5 questions, ~60 seconds, zero signup friction. Results in a shareable personality card optimized for Instagram Stories, TikTok, WhatsApp, and Twitter/X. The CTA after results funnels users into the main fireplanner setup flow.

This is an acquisition play. The quiz is designed to be shared virally and bring new users to the app. It draws inspiration from the vegetal quiz (game-like one-screen-per-question flow, playful transitions, strict portrait layout) and Spotify Wrapped (bold single-stat cards, identity-based results).

---

## Personality Types

6 types, each mapped to a distinct FIRE archetype relevant to Singapore:

| Type | Emoji | Vibe | Description | Traits |
|------|-------|------|-------------|--------|
| The Kopi Saver | ☕ | Frugal optimizer | Tracks every dollar, maxes CPF, knows the cheapest hawker stall | High savings, low risk, lean FIRE |
| The Property Mogul | 🏠 | Real estate-first | BTO is chapter one. Condo upgrade is the plan. Property is the wealth engine | Medium savings, medium risk, property-focused |
| The Side Hustle Sultan | 💼 | Income maximizer | Why cut expenses when you can earn more? Multiple income streams, always building | Low savings focus, medium risk, income-focused |
| The Chill Coaster | 🏖️ | Balanced & relaxed | Saves enough, invests passively, doesn't stress. Living well matters too | Medium savings, low risk, barista FIRE |
| The Moonshot Maverick | 🚀 | Aggressive growth | High-conviction bets, concentrated portfolio. Wants FIRE before 35 | Low savings, high risk, fat FIRE |
| The Steady Compounder | 📈 | Index fund purist | DCA into global ETFs, ignore the noise, let compounding do the work | High savings, low-medium risk, traditional FIRE |

---

## Quiz Flow

7 screens total:

### Screen 1: Splash

- Route: `/quiz`
- Hero: fire emoji + "What's Your FIRE Personality?"
- Subhead: "5 questions. 60 seconds. Zero judgment."
- CTA button: "Let's Go"
- Social proof counter: Hardcoded static number in copy (e.g., "Thousands of Singaporeans have taken this quiz"). Not a live counter. No localStorage tracking, no backend. Purely cosmetic social proof text.
- No signup, no email capture, no friction

### Screens 2-6: Questions

One question per screen. Each question has 4 answer options with emoji prefixes. Playful, conversational copy. No financial jargon.

**Q1: "It's Saturday morning. What are you doing?"** (Lifestyle/values)
- 🏃 Up at 6am, gym then meal prep for the week
- ☕ Sleeping in, then kopi and a good book
- 💻 Working on my side project / freelance gig
- 🎉 Recovering from last night. Worth it.

**Q2: "Your friend asks you to split a $200 dinner. First thought?"** (Spending attitude)
- 🧮 I'll pay my share only. I had the cheaper dish.
- 💳 Sure, split even. Life's too short for calculator math.
- 🤔 $200 dinner? I would've suggested hawker.
- 🎯 I'll cover it. Networking is investing.

**Q3: "It's bonus season. What's the move?"** (Investment style)
- 🏦 Straight into CPF SA top-up. Tax relief secured.
- 📈 DCA into my ETF portfolio, obviously.
- 🏠 Add it to the property downpayment fund.
- 🎰 YOLO into something with 10x potential.

**Q4: "What's your dream home?"** (Property ambition)
- 🏢 A comfortable HDB. Location over luxury.
- 🏙️ Condo with pool and gym. The full package.
- 🏡 Landed property. Go big or go home.
- 🌏 Anywhere. I plan to be location-independent.

**Q5: "You just hit $100K net worth. How do you celebrate?"** (FIRE mindset)
- 📊 Update my spreadsheet. Set the $250K target.
- 🍽️ Nice dinner, then back to the plan.
- 📱 Post it (tastefully) to inspire others.
- 🤷 $100K is just the start. Barely notice.

### Screen 7: Result

Two presentation formats:

**In-app result:**
- Personality type name + emoji + description
- 3-axis stat display: Savings Rate (letter grade), Risk Level (Low/Medium/High), FIRE Style (Lean/Barista/Traditional/Fat)
- Two CTAs: "Share Result" (primary) and "Plan My FIRE" (secondary, links to `/setup`)
- Optional: "See all types" expandable

**Share card (9:16 portrait):**
- Dark gradient background (deep indigo/purple)
- Large emoji + type name in bold display font
- One-line description
- 3-axis stats in compact format
- Footer: sgfireplanner.com/quiz
- Generated via html2canvas from a **dedicated offscreen render target** (`position: fixed; top: -9999px; width: 1080px; height: 1920px`). This is NOT the same as the GoalStoryContainer pattern (which captures the visible viewport). The share card is a fixed-dimension hidden DOM element, rendered and captured independently, then cleaned up. Keep CSS minimal for html2canvas reliability: absolute positioning, hex colors, no complex CSS gradients on the captured element. Use inline background-color stops instead.
- **Emoji rendering risk:** html2canvas may render blank squares for native OS emoji on some platforms (especially iOS). Test on real devices early. If unreliable, fall back to text-only type names or use emoji images (Twemoji SVGs).

---

## Scoring Engine

Each answer maps to weighted scores across 4 axes:

| Axis | Range | What it measures |
|------|-------|------------------|
| Savings Discipline | 0-15 | Frugality vs spending comfort |
| Risk Appetite | 0-15 | Conservative vs aggressive |
| Income Focus | 0-15 | Earn more vs spend less |
| Property Focus | 0-15 | Real estate orientation (hidden axis, not displayed to user) |

Each of the 4 answers per question assigns points to each axis. Complete scoring matrix:

**Q1: "It's Saturday morning. What are you doing?"**

| Answer | Savings | Risk | Income | Property |
|--------|---------|------|--------|----------|
| 🏃 Gym + meal prep | +3 | +0 | +1 | +0 |
| ☕ Sleep in, kopi, book | +1 | +0 | +0 | +0 |
| 💻 Side project / freelance | +1 | +1 | +3 | +0 |
| 🎉 Recovering | +0 | +2 | +0 | +0 |

**Q2: "Your friend asks you to split a $200 dinner. First thought?"**

| Answer | Savings | Risk | Income | Property |
|--------|---------|------|--------|----------|
| 🧮 Pay my share only | +3 | +0 | +0 | +0 |
| 💳 Split even, life's short | +0 | +1 | +0 | +0 |
| 🤔 Would've suggested hawker | +3 | +0 | +0 | +1 |
| 🎯 I'll cover it, networking | +0 | +1 | +3 | +0 |

**Q3: "It's bonus season. What's the move?"**

| Answer | Savings | Risk | Income | Property |
|--------|---------|------|--------|----------|
| 🏦 CPF SA top-up | +3 | +0 | +0 | +0 |
| 📈 DCA into ETFs | +2 | +1 | +0 | +0 |
| 🏠 Property downpayment | +1 | +1 | +0 | +3 |
| 🎰 YOLO 10x potential | +0 | +3 | +1 | +0 |

**Q4: "What's your dream home?"**

| Answer | Savings | Risk | Income | Property |
|--------|---------|------|--------|----------|
| 🏢 Comfortable HDB | +2 | +0 | +0 | +1 |
| 🏙️ Condo with pool/gym | +0 | +1 | +1 | +3 |
| 🏡 Landed property | +0 | +2 | +2 | +3 |
| 🌏 Location-independent | +1 | +2 | +2 | +0 |

**Q5: "You just hit $100K net worth. How do you celebrate?"**

| Answer | Savings | Risk | Income | Property |
|--------|---------|------|--------|----------|
| 📊 Update spreadsheet, set $250K target | +3 | +0 | +0 | +0 |
| 🍽️ Nice dinner, back to the plan | +2 | +0 | +0 | +0 |
| 📱 Post it to inspire others | +0 | +1 | +2 | +0 |
| 🤷 $100K is just the start | +0 | +3 | +1 | +0 |

**Axis ranges:** Savings 0-14, Risk 0-11, Income 0-12, Property 0-8.

### Type Selection Rules (evaluated in priority order, first match wins)

| Priority | Type | Rule | Dealbreaker exclusions |
|----------|------|------|----------------------|
| 1 | Moonshot Maverick | Risk >= 8 | - |
| 2 | Property Mogul | Property >= 6 | Risk >= 8 |
| 3 | Kopi Saver | Savings >= 10 AND Risk <= 4 | - |
| 4 | Side Hustle Sultan | Income >= 7 | Savings >= 10 |
| 5 | Steady Compounder | Savings >= 8 AND Risk 3-6 | - |
| 6 | Chill Coaster | (default) | - |

**Resolution logic:** Rules are checked in priority order (1-6). First match wins. Dealbreaker exclusions prevent unintuitive combinations (e.g., a high-risk user cannot be Chill Coaster). Chill Coaster is the catch-all default for balanced profiles that don't trigger any specific rule.

**No Euclidean distance fallback needed.** The priority-ordered rules with Chill Coaster as default guarantee exactly one result for every possible answer combination. This is simpler, more predictable, and avoids the unintuitive results that distance-based matching can produce.

**Testing:** All 4^5 = 1,024 answer combinations must be covered by snapshot tests to verify deterministic, sensible results. The scoring function is pure (answers in, type out), making exhaustive testing trivial.

---

## Transitions and Animation

- **Between questions:** Slide-left entrance (300ms ease-out), with the selected answer briefly highlighting (border color + subtle scale) before advancing (400ms delay)
- **Progress bar:** Animated gradient fill (blue to purple), smooth width transition on each question
- **Result reveal:** Fade-in with scale-up on the emoji (0.5 to 1.0, 500ms spring). Type name types in letter by letter (80ms per char). Stats fade-in staggered (200ms apart).
- **Share card generation:** Brief shimmer/loading animation while html2canvas renders
- **All animations:** Respect `prefers-reduced-motion` (skip to final state)

---

## Share Mechanic

3-tier fallback (same tier structure as Goal Calculator, different capture approach):

1. **Web Share API** (native share sheet on mobile) with the captured PNG blob
2. **Fallback:** Copy quiz URL to clipboard with toast confirmation
3. **Fallback:** html2canvas PNG download (from the offscreen 1080x1920 render target)

Share card includes the quiz URL (sgfireplanner.com/quiz) so recipients can take the quiz themselves.

### OG Meta Tags (Server-Side via Prerender)

Social crawlers (WhatsApp, Telegram, Twitter) do not execute JavaScript. React-injected meta tags are invisible to them. The quiz route **must be added to `scripts/prerender.mjs`** to inject static OG tags into the pre-rendered HTML:

- `og:title`: "What's Your FIRE Personality?"
- `og:description`: "5 questions. 60 seconds. Find out your Singapore FIRE type."
- `og:image`: Static preview card image (1200x630, designed and committed to `public/images/quiz-og.png`)

**Deliverable:** The 1200x630 OG preview image must be designed and committed as a static asset. This is a required V1 deliverable, not optional. Without it, link previews on all social platforms will show the generic site card, undermining the viral sharing mechanic.

---

## Funnel to Main App

After seeing results, the "Plan My FIRE" CTA links to `/setup`. The user's quiz result personality type is passed via URL param (`/setup?personality=kopi-saver`) and stored in localStorage. This enables:

1. **Personalized setup greeting (V1):** "Welcome, Kopi Saver! Let's build your FIRE plan." displayed on the setup splash (screen 1, age screen). This requires a small change to `SetupPage.tsx`: read `personality` from URL params or localStorage, and conditionally render a greeting banner above the age input. This is the only change to an existing app surface.
2. **Future:** Pre-fill certain setup defaults based on personality (e.g., Moonshot Maverick gets higher default equity allocation). Not in V1.

---

## Custom Illustrations

Each personality type will have a custom illustrated character/scene. Placeholder emoji used in V1, replaced with Nano Banana illustrations when ready. The design should reserve space for:
- Splash screen: hero illustration
- Result card: personality type illustration (both in-app and share card)
- "See all types" grid: 6 small illustrations

---

## Route and Architecture

- **Route:** `/quiz` as a **top-level standalone route** in `router.tsx`, parallel to `/goal-calculator`. NOT nested inside `PlannerRouteShell`. The quiz has its own full-screen layout with no sidebar, no FireStatsStrip, no AppLayout chrome. Example placement:
  ```
  { path: '/quiz', element: page(QuizPage) }
  ```
- **Page component:** `pages/QuizPage.tsx`
- **Components:** `components/quiz/QuizSplash.tsx`, `QuizQuestion.tsx`, `QuizResult.tsx`, `QuizShareCard.tsx`
- **Data:** `lib/data/quiz.ts` (questions, answers, complete scoring weight matrix, personality type definitions, ideal display metadata per type)
- **Engine:** `lib/calculations/quiz-scoring.ts` (pure function: answers array in, personality type out). Must include exhaustive snapshot tests for all 1,024 answer combinations.
- **Prerender:** Add `/quiz` entry to `scripts/prerender.mjs` with quiz-specific OG tags and `og:image` pointing to `public/images/quiz-og.png`
- **No Zustand store.** Quiz state is local to QuizPage via useState/useReducer. Results persisted to localStorage key `quiz-personality` for the setup greeting.
- **No Web Worker.** Scoring is trivial arithmetic, runs on main thread.
- **Quiz handles its own screen transitions internally** (framer-motion AnimatePresence within QuizPage). It does not rely on any app-level page transition wrapper.

---

## What This Does NOT Include

- Email capture / lead gen (could be added later as optional post-result)
- Backend analytics (privacy-first, no server contact)
- A/B testing of questions or copy variants
- Gamified onboarding overhaul (that's a separate spec, Phase B)
- Micro-delight polish pass (that's a separate spec, Phase C)
