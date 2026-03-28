# Micro-Delight Polish Pass — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Goal:** Make every interaction across the app feel responsive, alive, and delightful. Retention and engagement play.
**Scope:** Animation, transition, and visual polish enhancements across 5 app surfaces. No new features, no new routes, no data model changes.

---

## Overview

A systematic polish pass that adds micro-interactions, smoother transitions, and celebration moments across the entire fireplanner app. Each surface (A-E) is independently shippable. The work builds on the existing framer-motion and tailwindcss-animate infrastructure.

This is a retention play. Users who arrive via the FIRE personality quiz (or any other channel) should feel that every tap, scroll, and transition is intentional and polished. The goal is "feels like a native app, not a website."

---

## A. Dashboard

### A1. Milestone Celebrations
- **Trigger:** Net worth projection crosses $50K, $100K, $250K, $500K, $1M thresholds
- **Effect:** Confetti burst (reuse existing `canvas-confetti` from SetupConfetti) + a celebratory toast card that slides in from the top
- **Toast content:** "You're projected to hit $100K!" with the milestone amount in large bold type
- **Persistence:** Each threshold shown once per user, tracked in localStorage
- **Dismiss:** Auto-dismiss after 5 seconds, or tap to dismiss

### A2. Stat Card Entrance Animation
- **Trigger:** Dashboard page mount
- **Effect:** Staggered `fade-in-up` on each stat card, 80ms apart
- **Implementation:** framer-motion `variants` with `staggerChildren: 0.08` on the container
- **Numbers:** Continue using existing AnimatedNumber component for count-up

### A3. Lottie Loading States
- **Where:** Simulation run loading (Monte Carlo, Backtest, Sequence Risk)
- **Replace:** Current spinner with themed Lottie animations
- **Animations:** Growing plant (simulation running), stacking coins (calculating). Source from LottieFiles, keep under 5KB each.
- **Dependency:** Add `lottie-react` (~8KB gzipped). This is the only new dependency in the entire polish pass.

### A4. Live Value Transitions
- **Trigger:** Dashboard values change due to input modifications
- **Effect:** Number morphs from old to new value using AnimatedNumber. Brief color flash: green background pulse if value improved, red if worsened. Fade back to normal over 600ms.
- **Scope:** FIRE number, years to FIRE, success rates

---

## B. Setup Flow

### B1. Directional Screen Transitions
- **Current:** Instant screen swap
- **Upgrade:** AnimatePresence wrapper around the active setup screen
- **Forward:** Slide-in from right + fade (250ms ease-out)
- **Backward:** Slide-in from left + fade (250ms ease-out)
- **Implementation:** Track navigation direction in local state (next/prev), pass as `custom` prop to framer variants

### B2. Richer MirrorMoments
- **Current:** fade-in + slide-in-from-bottom with static content
- **Upgrade:**
  - Subtle sparkle particle effect behind the insight card (CSS-only, 4-6 small animated dots with random offsets)
  - Key insight numbers get a brief scale-pulse (1.0 → 1.1 → 1.0, 400ms) after fade-in completes
  - Backdrop blur transition smoothed (0 → 8px over 300ms instead of instant)

### B3. Progress Bar Upgrade
- **Current:** Native `<progress>` with webkit pseudo-element styling
- **Upgrade:** Custom div-based progress bar with:
  - Animated gradient fill (blue → purple, shifting subtly)
  - Smooth width transition (400ms ease-out) on step change
  - Step indicator dots above the bar (filled = completed, outlined = upcoming, pulsing = current)
- **Accessibility:** `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### B4. Input Micro-Feedback
- **Switches:** Subtle scale bounce on toggle (1.0 → 1.02 → 1.0, 150ms)
- **Radio cards:** Brief border-glow (box-shadow pulse from transparent to primary/20% and back, 300ms) on selection
- **Currency inputs:** Gentle green pulse on valid entry confirmation
- **Implementation:** CSS transitions where possible, framer-motion only for the scale bounce

---

## C. Charts & Projections

### C1. Animated Chart Entry
- **Trigger:** Chart first render on page
- **Effect:** Lines/areas draw in from left to right over 800ms ease-out
- **Implementation:** Recharts `animationDuration={800}` and `animationEasing="ease-out"` props (built-in, no custom code needed)
- **Constraint:** Only on first render, not on every data update (to avoid motion sickness on frequent changes)

### C2. Data Transition Animation
- **Trigger:** Switching withdrawal strategies, toggling inflation adjustment, changing parameters
- **Effect:** Chart lines morph smoothly between old and new data points (300ms)
- **Implementation:** Recharts built-in `isAnimationActive` with `animationDuration={300}` on data change. The library interpolates between old and new data points automatically.

### C3. Hover Enrichment
- **Tooltip:** Spring-based entrance animation (framer-motion `spring` with `stiffness: 300, damping: 20`)
- **Active dot:** Scale up to 1.5x on hover via Recharts `activeDot` prop
- **Crosshair:** Vertical reference line fades in (opacity 0 → 0.3) at the hovered x-position
- **Non-active points:** Slight opacity reduction (1.0 → 0.6) on neighboring series to focus attention

### C4. FIRE Threshold Markers
- **Where:** Projection chart, Monte Carlo fan chart
- **Pulsing dot:** Animated dot (scale pulse 1.0 → 1.3 → 1.0, repeating 2s) at the year FIRE is achieved
- **Dashed reference line:** Horizontal dashed line at the FIRE number with a label
- **Implementation:** Recharts `ReferenceLine` and `ReferenceDot` components with custom animated SVG

---

## D. Navigation & Layout

### D1. Page Transitions
- **Wrap:** Route outlet in framer-motion AnimatePresence
- **Enter:** Fade in + translate Y (8px → 0, 300ms ease-out)
- **Exit:** Fade out (150ms)
- **Key:** Use `location.pathname` as the AnimatePresence key
- **Constraint:** Exit animation must be fast (150ms) to avoid feeling sluggish

### D2. Animated Nav Indicator
- **Current:** Active nav item has `bg-primary text-primary-foreground` class swap
- **Upgrade:** Add framer-motion `layoutId="nav-indicator"` to the active background element
- **Effect:** The highlight pill smoothly slides between nav items on route change (200ms spring)
- **Sidebar collapsed state:** Indicator animates to the icon-only position

### D3. Save Indicator Upgrade
- **Current:** Green pill with fade-in, 2s timeout
- **Upgrade:** Slide-down from top (translate Y: -20px → 0) + subtle bounce (spring). Replace static checkmark with a tiny Lottie checkmark that plays once (400ms).
- **Timeout:** Keep at 2000ms

### D4. Theme Toggle Animation
- **Current:** Instant icon swap (Sun/Moon/Monitor)
- **Upgrade:** Icon morphs with rotation (180deg) + scale (0.8 → 1.0) transition, 300ms
- **Theme application:** CSS custom property transition already handled by Tailwind dark mode. Add `transition: background-color 200ms, color 200ms` to the root to smooth the color change.

---

## E. Wrapped & Story Cards

### E1. Card Visual Upgrade
- **Gradients:** Each card type gets a distinct, bolder gradient palette. Deeper colors, more contrast.
- **Grain texture:** Animate the existing SVG grain by slowly shifting the `baseFrequency` or applying a subtle CSS translate animation (creates a film-like shimmer)
- **Numbers:** Oversized display font (existing Syne font) for key stats. Minimum 36px on mobile.

### E2. Animated Stat Reveals
- **Sequence:** When a card enters:
  1. Title fades in (200ms)
  2. Key number counts up from 0 (AnimatedNumber, 600ms)
  3. Progress ring animates fill (existing SVG strokeDashoffset animation)
  4. Description fades in (200ms)
- **Stagger:** 150ms between each step
- **Implementation:** framer-motion variants with `staggerChildren`

### E3. Swipe Physics Upgrade
- **Current:** `x: +/-300, opacity, scale` transitions with 0.3s easeOut
- **Upgrade:** framer-motion `drag="x"` with:
  - `dragElastic={0.2}` (rubber-band at edges)
  - Velocity-aware snap: fast swipe advances, slow swipe snaps back
  - `dragConstraints` based on card index (first/last get rubber-band, not advance)
- **Threshold:** Drag > 30% of card width OR velocity > 500px/s to advance

### E4. New Card Types
Two new story card templates (data sources already exist in the app):

**Peer comparison card:**
- "You're ahead of X% of Singaporeans your age"
- Visual: horizontal bar showing user's position in the distribution
- Data source: Derived from Singapore median income/savings data already in `lib/data/`
- Note: Uses aggregate statistical benchmarks, not individual user data

**Year-over-year delta card:**
- "Your projected FIRE age improved by X years since last check"
- Visual: large delta number with up/down arrow
- Data source: Compare current projection against last-saved scenario timestamp in localStorage

---

## Cross-Cutting Concerns

### Accessibility
- **All animations** check `prefers-reduced-motion` media query. When set to `reduce`, animations skip to final state (no motion, just instant appearance).
- **Implementation:** framer-motion's `useReducedMotion()` hook. Set `transition: { duration: 0 }` when true.
- **Lottie:** Use `autoplay={!prefersReducedMotion}` and show static first frame when motion is reduced.

### Performance
- **Prefer composited properties.** Animate `transform` and `opacity` wherever possible. For progress bars (B3), use `transform: scaleX()` with `transform-origin: left` instead of animating `width`.
- **Chart animations:** Use Recharts built-in SVG animations, not JS-driven layout recalculations.
- **Lottie files:** Maximum 5KB each. Use simple, looping animations. No complex multi-layer compositions.
- **Stagger limits:** Maximum 8 items in any stagger group. Beyond that, batch-fade remaining items.

### Dependencies
- **lottie-react** (~8KB gzipped): Only new dependency. Used for loading states (A3) and save indicator (D3).
- Everything else uses framer-motion (already installed), tailwindcss-animate (already installed), or pure CSS transitions.

### Incremental Delivery
Each section (A through E) is independently shippable. No cross-dependencies between sections. Recommended order:

1. **D (Navigation)** — Page transitions set the foundation, everything else feels better on top of smooth routing
2. **B (Setup)** — High-visibility for new users arriving from the quiz
3. **A (Dashboard)** — Returning user delight
4. **C (Charts)** — Visual polish on the core data views
5. **E (Wrapped)** — Deepest engagement layer

---

## What This Does NOT Include

- New features or routes (no quiz, no new pages)
- Data model changes (no new stores, no schema changes)
- Copy/content changes (no personality-driven copy rewrite)
- Gamification mechanics (streaks, badges, levels) — that's Phase B
- Custom illustrations (Nano Banana scope)
- Sound effects or haptic feedback (web platform limitations)
