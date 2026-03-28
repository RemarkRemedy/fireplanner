# FIRE Personality Quiz — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Goal:** Standalone viral acquisition tool. Shareable personality quiz that funnels Gen Z users into the main planner.
**Scope:** New route + quiz engine + personality types + result cards + share flow. No changes to existing app surfaces.

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
- Social proof counter: "{N} people have taken this quiz" (stored in localStorage, seeded at a plausible number)
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
- Footer: fireplanner.sg/quiz
- Generated via html2canvas (same pattern as Goal Calculator story)

---

## Scoring Engine

Each answer maps to weighted scores across 4 axes:

| Axis | Range | What it measures |
|------|-------|------------------|
| Savings Discipline | 0-15 | Frugality vs spending comfort |
| Risk Appetite | 0-15 | Conservative vs aggressive |
| Income Focus | 0-15 | Earn more vs spend less |
| Property Focus | 0-15 | Real estate orientation (hidden axis, not displayed to user) |

Each of the 4 answers per question assigns points to each axis. Example for Q3 (bonus season):

| Answer | Savings | Risk | Income |
|--------|---------|------|--------|
| CPF SA top-up | +3 | +0 | +0 |
| DCA into ETFs | +2 | +1 | +0 |
| Property fund | +1 | +1 | +1 |
| YOLO 10x | +0 | +3 | +1 |

After all 5 questions, total scores determine the personality type:

| Type | Selection rule |
|------|---------------|
| Kopi Saver | Savings >= 10, Risk <= 4 |
| Property Mogul | Property >= 8 (highest among all types on this axis) |
| Side Hustle Sultan | Income >= 8 |
| Chill Coaster | All axes moderate (4-7 range), no extreme |
| Moonshot Maverick | Risk >= 10 |
| Steady Compounder | Savings >= 8, Risk 3-6 |

Fallback: if no rule matches cleanly, pick the type whose ideal score vector has the smallest Euclidean distance from the user's actual scores. This guarantees a result for every combination.

---

## Transitions and Animation

- **Between questions:** Slide-left entrance (300ms ease-out), with the selected answer briefly highlighting (border color + subtle scale) before advancing (400ms delay)
- **Progress bar:** Animated gradient fill (blue to purple), smooth width transition on each question
- **Result reveal:** Fade-in with scale-up on the emoji (0.5 to 1.0, 500ms spring). Type name types in letter by letter (80ms per char). Stats fade-in staggered (200ms apart).
- **Share card generation:** Brief shimmer/loading animation while html2canvas renders
- **All animations:** Respect `prefers-reduced-motion` (skip to final state)

---

## Share Mechanic

Same pattern as Goal Calculator story cards (already proven in codebase):

1. **Web Share API** (native share sheet on mobile)
2. **Fallback:** Copy link to clipboard with toast confirmation
3. **Fallback:** html2canvas PNG download

Share card includes the quiz URL (fireplanner.sg/quiz) so recipients can take the quiz themselves.

OG meta tags on `/quiz` route for rich link previews on WhatsApp/Telegram/Twitter:
- `og:title`: "What's Your FIRE Personality?"
- `og:description`: "5 questions. 60 seconds. Find out your Singapore FIRE type."
- `og:image`: Static preview card image (designed for 1200x630 link preview)

---

## Funnel to Main App

After seeing results, the "Plan My FIRE" CTA links to `/setup`. The user's quiz result personality type is passed via URL param (`/setup?personality=kopi-saver`) and stored in localStorage. This enables:

1. **Personalized setup greeting:** "Welcome, Kopi Saver! Let's build your FIRE plan." (displayed on setup splash)
2. **Future:** Pre-fill certain setup defaults based on personality (e.g., Moonshot Maverick gets higher default equity allocation). Not in V1.

---

## Custom Illustrations

Each personality type will have a custom illustrated character/scene. Placeholder emoji used in V1, replaced with Nano Banana illustrations when ready. The design should reserve space for:
- Splash screen: hero illustration
- Result card: personality type illustration (both in-app and share card)
- "See all types" grid: 6 small illustrations

---

## Route and Architecture

- **Route:** `/quiz` (new route in router.tsx)
- **Page component:** `pages/QuizPage.tsx`
- **Components:** `components/quiz/QuizSplash.tsx`, `QuizQuestion.tsx`, `QuizResult.tsx`, `QuizShareCard.tsx`
- **Data:** `lib/data/quiz.ts` (questions, answers, scoring weights, personality type definitions)
- **Engine:** `lib/calculations/quiz-scoring.ts` (pure function: answers array in, personality type out)
- **No Zustand store.** Quiz state is local to QuizPage via useState/useReducer. Results optionally persisted to localStorage for the setup greeting.
- **No Web Worker.** Scoring is trivial arithmetic, runs on main thread.

---

## What This Does NOT Include

- Email capture / lead gen (could be added later as optional post-result)
- Backend analytics (privacy-first, no server contact)
- A/B testing of questions or copy variants
- Gamified onboarding overhaul (that's a separate spec, Phase B)
- Micro-delight polish pass (that's a separate spec, Phase C)
