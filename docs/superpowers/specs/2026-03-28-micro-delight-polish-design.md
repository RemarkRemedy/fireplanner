# Micro-Delight Polish Pass — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Goal:** Make every interaction across the app feel responsive, alive, and delightful. Retention and engagement play.
**Scope:** Animation, transition, and visual polish enhancements across 5 app surfaces. No new routes. Sections A-D are pure polish. Section E4 (new card types) crosses into new feature territory and requires new data derivation logic. E4 may be split out or shipped last.

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
- **Dedupe rule:** On dashboard mount, check which thresholds are newly crossed (projection >= threshold AND threshold not in localStorage `milestones-seen` array). Show only the **highest** unseen milestone, not all of them. A returning user whose projection is already above $1M should see one "$1M" celebration, not five stacked celebrations.
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
- **Current:** Three distinct MirrorMoment variants exist:
  1. `InlineMirrorInsight` (inline below form, no overlay)
  2. `AutoDismissMirror` (full-screen overlay, backdrop-blur-sm [4px], auto-dismisses after 2s)
  3. `MirrorMoment` (blocking interstitial with continue button, sparkles icon)
- **Upgrades per variant:**
  - `InlineMirrorInsight`: Add subtle sparkle particle effect behind the insight card (CSS-only, 4-6 small animated dots with random offsets)
  - `AutoDismissMirror`: Smooth backdrop blur transition (0 → 4px over 300ms via `transition: backdrop-filter 300ms` instead of instant class application). Key insight numbers get a brief scale-pulse (1.0 → 1.1 → 1.0, 400ms) after fade-in completes.
  - `MirrorMoment`: Same number scale-pulse treatment. Sparkles icon gets a slow rotation animation (360deg over 3s, infinite, ease-in-out).

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
- **Implementation:** Recharts `animationDuration={800}` and `animationEasing="ease-out"` props. However, Recharts does not natively distinguish "first render" from "data update" animations. Use a `useState(true)` + `useEffect` pattern: set `isAnimationActive={true}` initially, then flip to `false` after 800ms so subsequent data updates render instantly.
- **Constraint:** Only on first render, not on every data update (to avoid motion sickness on frequent changes)

### C2. Data Transition Animation
- **Trigger:** Switching withdrawal strategies, toggling inflation adjustment, changing parameters
- **Effect:** Chart lines morph smoothly between old and new data points (300ms)
- **Implementation:** Recharts built-in `isAnimationActive` with `animationDuration={300}` on data change. The library interpolates between old and new data points automatically.

### C3. Hover Enrichment
- **Tooltip:** Spring-based entrance animation via a **custom Recharts tooltip component** (Recharts' built-in Tooltip does not accept framer-motion props). Use Recharts' `content` prop to render a `motion.div` wrapper with `spring` transition (`stiffness: 300, damping: 20`).
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
- **Approach:** Fade-only transitions (no directional slides, to avoid motion fatigue; slides are reserved for Setup B1 where spatial progression is meaningful)
- **Enter:** Fade in (200ms ease-out). No translate, just opacity.
- **Exit:** Fade out (150ms)
- **Structural requirement (React Router v6 + createBrowserRouter):** React Router v6 unmounts old route components immediately on URL change. For AnimatePresence exit animations to work, the implementation must:
  1. Create an `AnimatedOutlet` wrapper component that uses `useLocation()` and `useOutlet()` to capture the current outlet element
  2. Wrap the captured element in `<AnimatePresence mode="wait">` keyed by `location.pathname` (NOT `location.key` or full location)
  3. Each page component returns a `motion.div` as its root with enter/exit variants
  4. Place `AnimatedOutlet` inside `AppLayout.tsx` where `<Outlet />` currently renders
  5. Apply independently to both `AppLayout` (planner routes) and `SetupLayout` (setup routes) outlets
- **Scope:** Only routes inside `PlannerRouteShell` and `SetupLayout`. Standalone routes (`/quiz`, `/goal-calculator`) manage their own transitions.
- **Constraint:** Exit animation must be fast (150ms max) to avoid feeling sluggish. Do NOT key by full `location` object or hash, as that would cause remounts that regress save/import behavior.

### D2. Animated Nav Indicator
- **Current:** Active nav item has `bg-primary text-primary-foreground` applied directly to the NavLink/button element via className. There is no separate background element.
- **Structural change required:** Each nav item must be restructured to:
  1. Wrap in a `relative` container
  2. Add an absolutely-positioned `motion.div` behind the text with `layoutId="nav-indicator"`
  3. Only render this `motion.div` on the currently active item
  4. framer-motion automatically animates it between positions on route change
- **Complication:** Sidebar mixes route-based nav (NavLink) with section-anchor nav (useActiveSection scroll spy). The `layoutId` indicator should only apply to **route-based** nav items. Section-anchor items keep the existing class-swap highlighting to avoid conflicts between the two systems.
- **Effect:** The highlight pill smoothly slides between route nav items (200ms spring)
- **Sidebar collapsed state:** Indicator animates to the icon-only position

### D3. Save Indicator Upgrade
- **Current:** Green pill with fade-in, 2s timeout. Component returns `null` when not visible.
- **Upgrade:** Slide-down from top (translate Y: -20px → 0) + subtle bounce (spring). Replace static checkmark with a tiny Lottie checkmark that plays once (400ms).
- **Lifecycle change:** Current `if (!visible) return null` pattern must be refactored to support exit animations. Use framer-motion AnimatePresence around the indicator so it can animate out before unmounting. The visibility state drives the AnimatePresence key, not conditional rendering.
- **Timeout:** Keep at 2000ms

### D4. Theme Toggle Animation
- **Current:** Three-button row (Sun/Moon/Monitor) where all icons are always visible. Clicking one activates it via class change. This is NOT a single icon that morphs.
- **Upgrade:** Selected button gets a scale-pulse (0.9 → 1.1 → 1.0, 200ms spring) and a brief background glow on click. Non-selected buttons stay static. No morphing between icons (they're all visible simultaneously).
- **Theme application:** Add `transition: background-color 200ms, color 200ms` to the root element to smooth the color change across the entire page.

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
- **Current:** WrappedStoryContainer uses raw pointer events (`onPointerDown`/`onPointerUp`) with custom swipe detection (50px threshold, 500ms time limit). WrappedCard handles animation variants separately.
- **Upgrade:** **Replace** the existing pointer event handler system entirely with framer-motion `drag="x"`:
  - `dragElastic={0.2}` (rubber-band at edges)
  - Velocity-aware snap: fast swipe advances, slow swipe snaps back
  - `dragConstraints` based on card index (first/last get rubber-band, not advance)
  - Remove `onPointerDown`/`onPointerUp`/`onPointerCancel` handlers from the container
- **Preserve:** Keyboard navigation (ArrowLeft/ArrowRight), the no-navigate zone on summary card's last 40%, and the `isTransitioning` debounce guard must all be retained.
- **Threshold:** Drag > 30% of card width OR velocity > 500px/s to advance

### E4. New Card Types (NOTE: This is a new feature, not pure polish)

This section crosses the "no new features" boundary stated in the spec scope. It requires new data derivation logic and is more complex than pure animation work. **Ship E4 last, or split it into a separate mini-spec if it delays the rest of the polish pass.**

**Peer comparison card:**
- "Your savings rate beats X% of Singaporeans your age"
- Visual: horizontal bar showing user's position in the distribution
- Data source: `PEER_BENCHMARKS` in `lib/data/goal-defaults.ts` provides savings-rate percentiles by age band. This is savings rate data, NOT net worth or income distribution. Card copy must match: compare savings rate, not net worth.
- If net-worth comparison is desired, a new data file with net-worth percentiles by age must be sourced and added to `lib/data/`.
- Note: Uses aggregate statistical benchmarks, not individual user data

**Year-over-year delta card:**
- "Your projected FIRE age improved by X years since last check"
- Visual: large delta number with up/down arrow
- **New data requirement:** `ScenarioMetadata` currently stores only `id`, `name`, and `createdAt`. There is no "last-checked projection" baseline. Implementation requires:
  1. Add a new localStorage key (e.g., `fire-age-snapshot`) that records `{ fireAge: number, timestamp: string }` each time the user visits the dashboard
  2. Delta compares current projection against the last snapshot
  3. This is new persistence logic, not derived from existing data

---

## Cross-Cutting Concerns

### Accessibility
- **All NEW animations** check `prefers-reduced-motion` media query. When set to `reduce`, animations skip to final state (no motion, just instant appearance).
- **Implementation:** framer-motion's `useReducedMotion()` hook. Set `transition: { duration: 0 }` when true.
- **Lottie:** Use `autoplay={!prefersReducedMotion}` and show static first frame when motion is reduced.
- **Note on existing animations:** Many existing framer-motion transitions, chart animations, and confetti effects do NOT currently respect `prefers-reduced-motion`. A full retrofit of all existing animations is out of scope for this polish pass. New animations added by this spec MUST respect it. Retrofitting existing animations is a follow-up task.

### Performance
- **Prefer composited properties.** Animate `transform` and `opacity` wherever possible. For progress bars (B3), use `transform: scaleX()` with `transform-origin: left` instead of animating `width`.
- **Chart animations:** Use Recharts built-in SVG animations, not JS-driven layout recalculations.
- **Lottie files:** Maximum 8KB each (relaxed from initial 5KB to allow for branded animations). Use simple, looping animations. No complex multi-layer compositions. Define a static PNG fallback for reduced-motion and low-end devices.
- **Stagger limits:** Maximum 8 items in any stagger group. Beyond that, batch-fade remaining items.
- **Motion budget:** On a single page load, no more than 3 independent animation systems should fire simultaneously. Page transitions (D1) must complete before dashboard stagger (A2) begins. Milestone celebrations (A1) should be deferred until after stat card entrance completes. On mid-range Android devices, profile with Chrome DevTools Performance tab to verify animation frame rates stay above 30fps.

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

- New routes (no quiz, no new pages)
- New Zustand stores or schema changes
- Copy/content changes (no personality-driven copy rewrite)
- Full retrofit of `prefers-reduced-motion` on all existing animations (only new animations are covered)
- Gamification mechanics (streaks, badges, levels) — that's Phase B
- Custom illustrations (Nano Banana scope)
- Sound effects or haptic feedback (web platform limitations)
