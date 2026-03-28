# FIRE Personality Quiz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a viral "What's Your FIRE Personality?" quiz that acquires Gen Z users via shareable identity cards and funnels them into the planner.

**Architecture:** Standalone /quiz route outside PlannerRouteShell (no sidebar/chrome). Local state via useState/useReducer (no Zustand store). localStorage for persistence. Quiz state included in JSON export/import envelope. 6 personality types with per-type color palettes. Share cards via offscreen html2canvas render. Friend comparison via base64url-encoded URL params.

**Tech Stack:** React, TypeScript, framer-motion (existing), html2canvas (existing), Tailwind + shadcn/ui, Umami analytics, Syne display font (existing), prerender.mjs (existing)

**Source of Truth:**
- Quiz spec: `docs/superpowers/specs/2026-03-28-fire-personality-quiz-design.md`
- CEO plan: `~/.gstack/projects/RemarkRemedy-fireplanner/ceo-plans/2026-03-28-gen-z-engagement.md`
- Test plan: `~/.gstack/projects/RemarkRemedy-fireplanner/tj-main-eng-review-test-plan-20260328-172001.md`

**Branch:** `feat/fire-personality-quiz` (push to `private` only, NOT `origin`)

---

## File Structure

```
frontend/src/
├── pages/
│   ├── QuizPage.tsx                    # CREATE — quiz flow container (splash→Q→result)
│   └── QuizTypePage.tsx                # CREATE — /quiz/:type deep link page
├── components/quiz/
│   ├── QuizSplash.tsx                  # CREATE — entry screen with CTA
│   ├── QuizQuestion.tsx                # CREATE — single question screen
│   ├── QuizResult.tsx                  # CREATE — result card + actions
│   ├── QuizShareCard.tsx               # CREATE — offscreen 1080x1920 render target
│   ├── QuizCompare.tsx                 # CREATE — friend comparison side-by-side (E3)
│   ├── QuizTips.tsx                    # CREATE — 3 personality-specific tips (E4)
│   ├── AllTypesGallery.tsx             # CREATE — 2x3/3x2 grid of all types (E6)
│   └── PersonalityBadge.tsx            # CREATE — dashboard pill badge (E8)
├── lib/
│   ├── data/quiz.ts                    # CREATE — questions, weights, types, tips, palettes
│   ├── calculations/quiz-setup-mapping.ts  # CREATE — answer→setup qualitative defaults (E1) [MOVED from lib/data/ — it's a function, not data]
│   ├── calculations/quiz-scoring.ts    # CREATE — pure scoring function
│   ├── calculations/quiz-url-codec.ts  # CREATE — base64url encode/decode for E3
│   └── calculations/fire-age-delta.ts  # CREATE — pure FIRE age delta computation (E5) [EXTRACTED from hook for testability]
├── hooks/
│   ├── useFireAgeSnapshot.ts           # CREATE — thin hook wrapper calling fire-age-delta.ts (E5)
│   └── useQuizPersonality.ts           # CREATE — shared localStorage reader for quiz state (E8)
├── lib/analytics.ts                    # MODIFY — add quiz event names to AnalyticsEvent union
├── lib/storeRegistry.ts                # MODIFY — include quiz localStorage keys in export/import envelope
├── router.tsx                          # MODIFY — add /quiz and /quiz/:type routes (with lazy() wrapping)
└── scripts/prerender.mjs               # MODIFY — add 7 route entries + per-route og:image replacement logic

Tests:
├── lib/calculations/quiz-scoring.test.ts       # CREATE — 1,024 combo snapshot + priority rules
├── lib/calculations/quiz-url-codec.test.ts     # CREATE — roundtrip + malformed input
├── lib/calculations/quiz-setup-mapping.test.ts # CREATE — mapping validation [MOVED from lib/data/]
├── lib/calculations/fire-age-delta.test.ts     # CREATE — pure delta computation tests
├── components/quiz/QuizRetake.test.tsx         # CREATE — retake logic tests (30-day threshold, before/after)
└── e2e/quiz.spec.ts                            # CREATE — 5 E2E flows (mkdir e2e/ first if not exists)
```

---

## Quiz Persistence Contract (READ BEFORE TASKS 10-15)

All quiz state lives in localStorage (no Zustand store). These keys and shapes are the single source of truth for every task that reads or writes quiz data:

| Key | Shape | Written by | Read by |
|-----|-------|------------|---------|
| `quiz-personality` | `{ typeId: string, scores: { savings, risk, income, property }, timestamp: string, answers: number[] }` | Task 6 (quiz completion) | Tasks 10, 11, 12, 14 |
| `quiz-history` | `Array<{ typeId: string, scores: {...}, timestamp: string }>` | Task 12 (appended on each completion) | Tasks 12, 14 |
| `fire-age-snapshot` | `{ fireAge: number, timestamp: string }` | Task 13 (dashboard visit) | Task 13 |

**Important:** Access `.typeId` (not `.type`). Export/import in Task 14 serializes these raw localStorage keys into the `PortabilityEnvelopeV2.quiz` field.

---

## Task 1: Quiz Data Layer

**Files:**
- Create: `frontend/src/lib/data/quiz.ts`

- [ ] **Step 1: Define personality type interfaces and data**

Create `lib/data/quiz.ts` with:
- `PersonalityType` interface: `id`, `name`, `emoji`, `description`, `strength`, `blindSpot`, `gradient` (two hex values), `accent` (hex), `savingsGrade`, `riskLevel`, `fireStyle`
- `QuizQuestion` interface: `id`, `text`, `subtext`, `options` array of `{ emoji, text, weights: { savings, risk, income, property } }`
- `PERSONALITY_TYPES` constant: all 6 types with per-type color palettes from design review:
  - Kopi Saver: `#3E2723` → `#BF360C`, accent gold
  - Property Mogul: `#004D40` → `#1B5E20`, accent emerald
  - Side Hustle Sultan: `#E65100` → `#B71C1C`, accent coral
  - Chill Coaster: `#01579B` → `#0277BD`, accent seafoam
  - Moonshot Maverick: `#311B92` → `#880E4F`, accent neon pink
  - Steady Compounder: `#263238` → `#37474F`, accent mint green
- `QUIZ_QUESTIONS` constant: all 5 questions with complete 4-axis weight matrix from the quiz spec (Section "Scoring Engine")
- `PERSONALITY_TIPS` constant: 3 tips per type (18 total), referencing real SG financial mechanics

Data source for scoring weights: quiz spec lines 111-158 (complete matrix).
Data source for strength/blind spot: office hours design doc strength/blind spot table.

- [ ] **Step 2: Verify no em dashes in any user-facing copy**

Grep all string values in quiz.ts for em dashes (—). Replace with commas or periods. CLAUDE.md rule.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/data/quiz.ts
git commit -m "feat(quiz): add personality types, questions, scoring weights, tips, and palettes"
```

---

## Task 2: Scoring Engine + Tests

**Files:**
- Create: `frontend/src/lib/calculations/quiz-scoring.ts`
- Create: `frontend/src/lib/calculations/quiz-scoring.test.ts`

- [ ] **Step 1: Write failing snapshot test for all 1,024 combos**

Create `quiz-scoring.test.ts`. Import `scoreQuiz` (not yet written). Generate all 4^5 = 1,024 answer combinations programmatically. For each, call `scoreQuiz(answers)` and snapshot the result. This test will fail because `scoreQuiz` doesn't exist.

```typescript
import { describe, it, expect } from 'vitest'
import { scoreQuiz } from './quiz-scoring'

describe('scoreQuiz', () => {
  it('produces a valid type for all 1,024 answer combinations', () => {
    const results: Record<string, string> = {}
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++)
        for (let c = 0; c < 4; c++)
          for (let d = 0; d < 4; d++)
            for (let e = 0; e < 4; e++) {
              const answers = [a, b, c, d, e]
              const result = scoreQuiz(answers)
              results[answers.join(',')] = result.id
              expect(result.id).toBeTruthy()
            }
    expect(results).toMatchSnapshot()
  })
})
```

- [ ] **Step 2: Write priority rule unit tests**

```typescript
it('Moonshot Maverick wins when Risk >= 8', () => {
  // Answers that maximize Risk axis
  const result = scoreQuiz([3, 1, 3, 3, 3]) // high-risk answers
  expect(result.id).toBe('moonshot-maverick')
})

it('Kopi Saver wins when Savings >= 10 and Risk <= 4', () => {
  const result = scoreQuiz([0, 0, 0, 0, 0]) // high-savings, low-risk answers
  expect(result.id).toBe('kopi-saver')
})

it('Chill Coaster is the default for balanced scores', () => {
  const result = scoreQuiz([1, 1, 1, 1, 1]) // moderate everything
  expect(result.id).toBe('chill-coaster')
})

it('falls back to Chill Coaster for empty answers', () => {
  const result = scoreQuiz([])
  expect(result.id).toBe('chill-coaster')
})

it('falls back to Chill Coaster for out-of-range answers', () => {
  const result = scoreQuiz([99, -1, 4, 0, 0])
  expect(result.id).toBe('chill-coaster')
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd frontend && npm run test -- quiz-scoring.test.ts
```

Expected: FAIL (scoreQuiz not defined)

- [ ] **Step 4: Implement scoreQuiz**

Create `quiz-scoring.ts`:
- Import `QUIZ_QUESTIONS` and `PERSONALITY_TYPES` from `@/lib/data/quiz`
- `scoreQuiz(answers: number[]): PersonalityType`
  - Validate answers: clamp each to 0-3 range. If array length < 5, return Chill Coaster immediately (do NOT pad with zeros, because [0,0,0,0,0] maps to Kopi Saver via high savings scores, not the intended "no data" fallback)
  - Sum 4-axis scores from weight matrix
  - Apply priority-ordered rules (from spec):
    1. Risk >= 8 → Moonshot Maverick
    2. Property >= 6 AND Risk < 8 → Property Mogul
    3. Savings >= 10 AND Risk <= 4 → Kopi Saver
    4. Income >= 7 AND Savings < 10 → Side Hustle Sultan
    5. Savings >= 8 AND Risk 3-6 → Steady Compounder
    6. Default → Chill Coaster
  - Return the matched `PersonalityType` object

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && npm run test -- quiz-scoring.test.ts
```

Expected: PASS. Update snapshot with `npm run test -- quiz-scoring.test.ts -u`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/calculations/quiz-scoring.ts frontend/src/lib/calculations/quiz-scoring.test.ts
git commit -m "feat(quiz): scoring engine with priority rules + 1,024-combo snapshot test"
```

---

## Task 3: URL Codec for Friend Comparison (E3)

**Files:**
- Create: `frontend/src/lib/calculations/quiz-url-codec.ts`
- Create: `frontend/src/lib/calculations/quiz-url-codec.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { encodeQuizResult, decodeQuizResult } from './quiz-url-codec'

describe('quiz URL codec', () => {
  it('roundtrips all 6 types', () => {
    const result = { typeId: 'kopi-saver', scores: { savings: 12, risk: 2, income: 3, property: 1 } }
    const encoded = encodeQuizResult(result)
    const decoded = decodeQuizResult(encoded)
    expect(decoded).toEqual(result)
  })

  it('returns null for malformed base64url', () => {
    expect(decodeQuizResult('not-valid!!!')).toBeNull()
  })

  it('returns null for valid base64url with invalid JSON', () => {
    const encoded = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    expect(decodeQuizResult(encoded)).toBeNull()
  })

  it('returns null for valid JSON with out-of-range scores', () => {
    const data = { typeId: 'kopi-saver', scores: { savings: 999, risk: -1, income: 0, property: 0 } }
    const encoded = btoa(JSON.stringify(data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    expect(decodeQuizResult(encoded)).toBeNull()
  })
})
```

- [ ] **Step 2: Implement codec**

Create `quiz-url-codec.ts`:
- `encodeQuizResult(result)`: JSON.stringify → base64url encode. Use `btoa()` then replace `+` with `-`, `/` with `_`, and strip `=` padding. This is the standard base64url approach and is safe for URL params.
- `decodeQuizResult(encoded)`: try/catch → base64url decode → JSON.parse → validate schema (typeId must be one of 6 valid IDs, all scores must be numbers 0-15) → return result or null.

- [ ] **Step 3: Run tests, verify pass, commit**

```bash
cd frontend && npm run test -- quiz-url-codec.test.ts
git add frontend/src/lib/calculations/quiz-url-codec.ts frontend/src/lib/calculations/quiz-url-codec.test.ts
git commit -m "feat(quiz): base64url codec for friend comparison with validation"
```

---

## Task 4: Quiz Setup Mapping + Tests (E1)

**Files:**
- Create: `frontend/src/lib/calculations/quiz-setup-mapping.ts`
- Create: `frontend/src/lib/calculations/quiz-setup-mapping.test.ts`

- [ ] **Step 1: Write failing tests**

Test that quiz answers map to qualitative setup defaults (NOT dollar amounts):
- Property Mogul → property toggle ON
- Moonshot Maverick → higher risk allocation preset
- Kopi Saver → conservative allocation preset
- Chill Coaster → balanced defaults (no change from standard)

- [ ] **Step 2: Implement mapping**

`mapQuizTypeToSetupDefaults(typeId: string): Partial<SetupDefaults>` where `SetupDefaults` includes boolean toggles and enum values (NOT numeric financial fields):
- `includeProperty: boolean` (true for Property Mogul)
- `riskProfile: 'conservative' | 'balanced' | 'aggressive'`
- `investmentStyle: 'passive' | 'active'`

- [ ] **Step 3: Run tests, verify pass, commit**

---

## Task 5: Quiz Page + Routing

**Files:**
- Create: `frontend/src/pages/QuizPage.tsx`
- Create: `frontend/src/pages/QuizTypePage.tsx`
- Modify: `frontend/src/router.tsx`

- [ ] **Step 1: Create QuizPage shell**

`QuizPage.tsx`:
- `useReducer` for quiz state: `{ screen: 'splash' | 'question' | 'result' | 'compare', questionIndex: number, answers: number[], result: PersonalityType | null }`
- Hash-based navigation: use `useNavigate()` to update hash (e.g., `navigate({ hash: '#q2' }, { replace: false })`), NOT raw `window.location.hash`. Use `useLocation().hash` as the source of truth for current question. This routes back-button presses through React Router's history stack rather than raw DOM events. On quiz exit/completion, strip the hash before navigating away to prevent Sidebar's section anchor handler from misreading quiz hashes like `#q3`.
- Background: `bg-[#FAFAF5]` (warm cream from design review)
- Full viewport height, centered container `max-w-[520px]`
- `AnimatePresence` wrapping the active screen component for slide transitions
- Check URL for `?compare=` param to enter comparison mode

- [ ] **Step 2: Create QuizTypePage shell**

`QuizTypePage.tsx`:
- Read `:type` param from URL
- Look up personality type by slug in `PERSONALITY_TYPES`
- If not found, redirect to `/quiz`
- Render type card with emoji, name, description, strength, blind spot
- CTA: "Take the quiz yourself" → links to `/quiz`

- [ ] **Step 3: Add routes to router.tsx**

First add lazy imports at the top of router.tsx (matching existing named-export pattern):
```typescript
const QuizPage = lazy(() => import('@/pages/QuizPage').then(m => ({ default: m.QuizPage })))
const QuizTypePage = lazy(() => import('@/pages/QuizTypePage').then(m => ({ default: m.QuizTypePage })))
```

Then add as top-level standalone routes (NOT inside `PlannerRouteShell`), same pattern as `/goal-calculator`:
```typescript
{ path: '/quiz', element: page(QuizPage) },
{ path: '/quiz/:type', element: page(QuizTypePage) },
```

**Important:** QuizPage.tsx and QuizTypePage.tsx must use named exports (`export function QuizPage`), not default exports. All 31 existing pages use named exports.

- [ ] **Step 4: Verify routes load in dev server**

```bash
cd frontend && npm run dev -- --port 5173
```

Open `http://localhost:5173/quiz` — should show QuizPage shell.
Open `http://localhost:5173/quiz/kopi-saver` — should show QuizTypePage.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/QuizPage.tsx frontend/src/pages/QuizTypePage.tsx frontend/src/router.tsx
git commit -m "feat(quiz): add quiz page shell + type deep link pages + routes"
```

---

## Task 6: Quiz UI Components

**Files:**
- Create: `frontend/src/components/quiz/QuizSplash.tsx`
- Create: `frontend/src/components/quiz/QuizQuestion.tsx`
- Create: `frontend/src/components/quiz/QuizResult.tsx`
- Create: `frontend/src/components/quiz/QuizTips.tsx` (E4)
- Create: `frontend/src/components/quiz/AllTypesGallery.tsx` (E6)

- [ ] **Step 1: Build QuizSplash**

- Fire emoji (large, centered) or illustration placeholder `<div>`
- Title: "What's Your FIRE Personality?" in Syne bold
- Subhead: "5 questions. 60 seconds. Zero judgment."
- shadcn/ui `<Button size="lg">` "Let's Go"
- Social proof: "Thousands of Singaporeans have taken this quiz" (small, muted text)
- `onClick` calls parent's `dispatch({ type: 'START' })`

- [ ] **Step 2: Build QuizQuestion**

- Progress bar: custom div, `transform: scaleX()` with `transform-origin: left`, animated gradient (blue → purple)
- Step indicator: "3 of 5" text
- Question text in bold, subtext in muted
- 4 answer options: vertical stack, `border-2 rounded-xl p-4 cursor-pointer`
- Selected state: border changes to type's accent color, brief scale (1.02x, 150ms)
- `isTransitioning` debounce guard (prevents double-tap advance)
- On select: 400ms delay (highlight), then advance to next question
- Hash update: `window.location.hash = '#q' + (questionIndex + 1)`

- [ ] **Step 3: Build QuizResult**

Progressive disclosure layout (from CEO/design review):
**Above fold:**
- Personality type emoji (scale-up entrance, 0.5 → 1.0, 500ms spring)
- Type name in Syne bold (letter-by-letter reveal, 80ms/char) — use type's gradient as text color via `background-clip: text`
- Strength + Blind spot (fade-in staggered)
- 3-axis stats: Savings Grade | Risk Level | FIRE Style
- Action buttons: Share (primary, type's accent color), Compare with Friend, Plan My FIRE → `/setup?personality={typeId}`

**Below fold (collapsible):**
- `QuizTips` component (3 tips)
- `AllTypesGallery` component

- [ ] **Step 4: Build QuizTips (E4)**

- Collapsible section using framer-motion height animation (`animate: { height: 'auto' }`) or existing shadcn/ui `Accordion`. Note: `@radix-ui/react-collapsible` is NOT installed. Use Accordion (already available) or framer-motion AnimatePresence with height animation. Do NOT add a new Radix dependency for this.
- 3 tips from `PERSONALITY_TIPS[typeId]`
- Each tip: numbered, actionable copy referencing real SG financial action

- [ ] **Step 5: Build AllTypesGallery (E6)**

- 2x3 grid on mobile, 3x2 on tablet/desktop
- Each cell: emoji + type name + one-liner
- Border in type's accent color (subtle)
- Tap → expand to show full description + strength + blind spot (inline expand or modal)

- [ ] **Step 6: Wire components into QuizPage**

Connect all components to the reducer state. Verify the full flow works: splash → 5 questions → result.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/quiz/
git commit -m "feat(quiz): splash, question, result, tips, and gallery components"
```

---

## Task 7: Share Card

**Files:**
- Create: `frontend/src/components/quiz/QuizShareCard.tsx`

- [ ] **Step 1: Build offscreen render target**

`QuizShareCard.tsx`:
- Hidden div: `position: fixed; top: -9999px; width: 1080px; height: 1920px`
- Dark gradient background using the personality type's gradient colors
- Large emoji + type name in Syne bold (white text)
- One-line description
- Strength + blind spot
- 3-axis stats compact
- Footer: "sgfireplanner.com/quiz"
- Use inline styles for html2canvas reliability (no Tailwind classes on the capture target, use inline `style` props with hex colors)
- Load Syne via inline `@font-face` in the render target's style

- [ ] **Step 1.5: Ensure Syne font loads on standalone quiz route**

Since `/quiz` is outside AppLayout, the Syne font may not be auto-loaded. Add an explicit `<link>` or `@font-face` declaration in the QuizPage component (or verify Syne is loaded globally in index.html). Without this, the share card may render in system font.

- [ ] **Step 2: Implement share flow (with font.ready guard)**

Share flow sequence: always capture PNG first, then use it in the share tier:
1. `await document.fonts.ready` then `html2canvas` capture → PNG blob
2. If Web Share API available: share PNG blob via native share sheet
3. Else: copy quiz URL to clipboard + toast "Link copied!"
4. Always show a "Download" button that saves the already-captured PNG

The existing pattern in `GoalStoryContainer.tsx` does URL share first and capture last. The quiz inverts this because the share card IS the viral mechanic.

Wrap html2canvas call in try/catch. On failure, fall back to pre-generated static PNG per type (if available) or URL-only share.

- [ ] **Step 3: Test on dev server**

Manual test: complete quiz, click Share, verify card renders. Check browser console for html2canvas errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/quiz/QuizShareCard.tsx
git commit -m "feat(quiz): share card with offscreen 1080x1920 render + 3-tier fallback"
```

---

## Task 8: Friend Comparison (E3)

**Files:**
- Create: `frontend/src/components/quiz/QuizCompare.tsx`
- Modify: `frontend/src/pages/QuizPage.tsx`

- [ ] **Step 1: Build QuizCompare component**

- Reads friend's result from `decodeQuizResult(searchParams.get('compare'))`
- If decode fails → show fresh quiz (no compare mode)
- Desktop (> 640px): side-by-side cards (CSS grid, 2 columns)
- Mobile: stacked (your result on top, friend's below, "vs" divider)
- Each side shows: emoji + type name + strength + stats
- Share comparison button (generates a comparison share card)

- [ ] **Step 2: Add compare link generation to QuizResult**

"Compare with Friend" button:
- `encodeQuizResult({ typeId, scores })` → append as `?compare=` param to quiz URL
- Copy comparison link to clipboard with toast
- Or trigger Web Share API with the comparison URL

- [ ] **Step 3: Wire into QuizPage**

QuizPage checks for `?compare=` param on mount. If present and valid, after quiz completion show QuizCompare instead of standard QuizResult.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/quiz/QuizCompare.tsx frontend/src/pages/QuizPage.tsx
git commit -m "feat(quiz): friend comparison via base64url-encoded URL params"
```

---

## Task 9: Prerender + OG Tags

**Files:**
- Modify: `frontend/scripts/prerender.mjs`
- Create: `frontend/public/images/quiz-og.png` (placeholder)

- [ ] **Step 1: Add per-route og:image support to prerender.mjs**

The current prerender.mjs replaces title, description, and canonical per route, but does NOT replace `og:image`. It uses regex replacements on the HTML template. Add a new replacement step:

```javascript
// After the existing og:description replacement
if (route.ogImage) {
  html = html.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${route.ogImage}$2`
  )
}
```

Then add the quiz route entry with the new field:
```javascript
{
  path: '/quiz',
  title: "What's Your FIRE Personality? | SG FIRE Planner",
  description: '5 questions. 60 seconds. Find out your Singapore FIRE type.',
  ogImage: '/images/quiz-og.png'
}
```

- [ ] **Step 2: Add 6 type deep link routes**

For each personality type, add:
```javascript
{
  path: '/quiz/kopi-saver',
  title: 'The Kopi Saver — FIRE Personality | SG FIRE Planner',
  description: 'Tracks every dollar, maxes CPF, knows the cheapest hawker stall.',
  ogImage: '/images/quiz-og.png' // Same placeholder for now
}
```

- [ ] **Step 3: Create placeholder OG image**

Create a simple 1200x630 text-only PNG with:
- "What's Your FIRE Personality?" title
- "sgfireplanner.com/quiz" URL
- Dark background, white text
- Can be generated with html2canvas or a simple canvas script, or manually created.

- [ ] **Step 4: Build and verify**

```bash
cd frontend && npm run build
```

Check that `dist/quiz/index.html` contains the quiz-specific OG tags.

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/prerender.mjs frontend/public/images/quiz-og.png
git commit -m "feat(quiz): prerender.mjs with OG tags for /quiz + 6 type deep links"
```

---

## Task 10: Setup Integration (E1 + Greeting)

**Files:**
- Modify: `frontend/src/pages/SetupPage.tsx`

- [ ] **Step 1: Read quiz personality from URL param or localStorage**

At the top of SetupPage, read personality type:
```typescript
const [searchParams] = useSearchParams()
const personalityParam = searchParams.get('personality')
const storedPersonality = localStorage.getItem('quiz-personality')
const quizType = personalityParam
  ? PERSONALITY_TYPES.find(t => t.id === personalityParam)
  : storedPersonality
    ? PERSONALITY_TYPES.find(t => t.id === JSON.parse(storedPersonality)?.typeId)
    : null
// Note: Task 12 stores { typeId, scores, timestamp }, so read .typeId not .type
```

- [ ] **Step 2: Show personalized greeting on screen 1 (age screen)**

If `quizType` exists, render a greeting banner above the age input:
```
"Welcome, {emoji} {Type Name}! Let's build your FIRE plan."
```

Styled as a subtle info banner (shadcn/ui Alert or custom div with type's accent color border).

- [ ] **Step 3: Apply qualitative defaults from quiz via Hydrate dispatch**

Import `mapQuizTypeToSetupDefaults` from `@/lib/calculations/quiz-setup-mapping`. On initial setup load (no existing data), apply the qualitative defaults **through the existing Hydrate dispatch pattern** inside SetupPage's existing `useEffect` block (around line 657), NOT as a raw localStorage read outside the reducer:

```typescript
// Inside the existing useEffect that handles initial hydration:
if (quizType && !hasExistingData) {
  const defaults = mapQuizTypeToSetupDefaults(quizType.id)
  dispatch({ type: 'HYDRATE', values: defaults })
}
```

- Toggle property section on/off based on type
- Set risk profile preset
- These are toggles and enums only. NEVER pre-fill dollar amounts.
- **Guard condition:** Only apply defaults when the relevant field has never been set (fresh setup). If the user has an existing plan and retakes the quiz, do NOT overwrite their existing settings.

- [ ] **Step 4: Verify graceful fallback**

If no quiz personality exists (direct /setup visit), SetupPage shows default non-personalized greeting. No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SetupPage.tsx
git commit -m "feat(quiz): personalized setup greeting + qualitative defaults from quiz type"
```

---

## Task 11: Dashboard Badge (E8)

**Files:**
- Create: `frontend/src/components/quiz/PersonalityBadge.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Build PersonalityBadge component**

Small pill/badge: `emoji + type name` (e.g., "☕ Kopi Saver"). Clickable → navigates to `/quiz`. Reads from `quiz-personality` localStorage key. Returns null if no quiz result exists (no placeholder shown).

- [ ] **Step 2: Add to DashboardPage**

Place PersonalityBadge near the user's age/profile info area on the dashboard. Position it as a subtle pill, not a prominent element.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/quiz/PersonalityBadge.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat(quiz): dashboard personality badge from quiz result"
```

---

## Task 12: Evolving Personality (E2)

**Files:**
- Modify: `frontend/src/pages/QuizPage.tsx`

- [ ] **Step 1: Store quiz history in localStorage**

On quiz completion, append to `quiz-history` localStorage key:
```typescript
const history = JSON.parse(localStorage.getItem('quiz-history') || '[]')
history.push({ typeId: result.id, scores, timestamp: new Date().toISOString() })
localStorage.setItem('quiz-history', JSON.stringify(history))
```

- [ ] **Step 2: Retake prompt**

On QuizPage mount, check if 30+ days since last quiz completion (from quiz-history). If yes, show a retake prompt: "Your last quiz was {N} days ago. See how you've changed?"

- [ ] **Step 3: Before/after comparison on retake result**

After retake, show previous type alongside new type:
"You were a {Old Type}. Now you're a {New Type}."
If type changed: highlight the change with a visual transition.
If same type: "Still a {Type}! Your money personality is consistent."

- [ ] **Step 4: Write unit tests for retake logic in a dedicated test file**

Create `frontend/src/components/quiz/QuizRetake.test.tsx` (NOT quiz-scoring.test.ts, which tests the scoring engine only):

Test 30-day threshold, before/after type comparison, same-type handling, no-history first-time behavior.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/QuizPage.tsx frontend/src/components/quiz/QuizRetake.test.tsx
git commit -m "feat(quiz): evolving personality with retake prompt + before/after comparison"
```

---

## Task 13: Monthly FIRE Digest (E5)

**Files:**
- Create: `frontend/src/lib/calculations/fire-age-delta.ts` — pure delta computation (testable without React)
- Create: `frontend/src/lib/calculations/fire-age-delta.test.ts`
- Create: `frontend/src/hooks/useFireAgeSnapshot.ts` — thin hook wrapper
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Write failing tests for pure delta function**

Create `fire-age-delta.test.ts`:
```typescript
import { computeFireAgeDelta } from './fire-age-delta'

it('returns no delta when no previous snapshot exists', () => {
  const result = computeFireAgeDelta(52, null)
  expect(result).toEqual({ hasHistory: false, deltaMonths: 0 })
})

it('returns correct delta when previous snapshot exists', () => {
  const result = computeFireAgeDelta(51, { fireAge: 53, timestamp: '2026-02-01' })
  expect(result).toEqual({ hasHistory: true, deltaMonths: -24, previousFireAge: 53, currentFireAge: 51 })
})

it('handles same age gracefully', () => {
  const result = computeFireAgeDelta(52, { fireAge: 52, timestamp: '2026-02-01' })
  expect(result).toEqual({ hasHistory: true, deltaMonths: 0, previousFireAge: 52, currentFireAge: 52 })
})
```

- [ ] **Step 2: Implement pure `computeFireAgeDelta` in lib/calculations/**

```typescript
export function computeFireAgeDelta(currentFireAge: number, previousSnapshot: { fireAge: number; timestamp: string } | null) {
  if (!previousSnapshot) return { hasHistory: false, deltaMonths: 0 }
  const deltaMonths = (currentFireAge - previousSnapshot.fireAge) * 12
  return { hasHistory: true, deltaMonths, previousFireAge: previousSnapshot.fireAge, currentFireAge }
}
```

- [ ] **Step 3: Implement thin `useFireAgeSnapshot` hook**

The hook calls `useDashboardMetrics` (explicitly, not a vague "derived hook") for the current FIRE age, reads localStorage for the previous snapshot, calls `computeFireAgeDelta`, and writes the new snapshot to localStorage. Wraps the localStorage write in try/catch for QuotaExceededError.

- [ ] **Step 3: Show digest cards on dashboard**

If `hasHistory` and 30+ days since last snapshot:
- Show 3-4 mini story cards (reuse Wrapped card visual patterns):
  1. "Your FIRE age this month: {N}"
  2. "That's {delta} months {closer/further}" (green/red)
  3. Personality-type-colored card with encouragement
- Use personality type's gradient for card backgrounds
- Shareable via existing share patterns

- [ ] **Step 4: Run tests, commit**

```bash
cd frontend && npm run test -- useFireAgeSnapshot.test.ts
git add frontend/src/hooks/useFireAgeSnapshot.ts frontend/src/hooks/useFireAgeSnapshot.test.ts frontend/src/pages/DashboardPage.tsx
git commit -m "feat(quiz): monthly FIRE digest with story cards + fire age snapshot hook"
```

---

## Task 14: Quiz State in Export/Import

**Files:**
- Modify: `frontend/src/lib/storeRegistry.ts` (contains `buildPortabilityEnvelope` and `resolvePortabilityData`)

**Important:** `PlanUrlHandler.tsx` is the URL-import dialog only. The actual JSON export/import system is in `storeRegistry.ts`. The portability envelope (`PortabilityEnvelopeV2`) serializes registered Zustand stores via `ALL_RUNTIME_STORE_KEYS`. Quiz state lives in raw localStorage keys, not Zustand stores.

- [ ] **Step 1: Extend `buildPortabilityEnvelope` to include quiz state**

In `storeRegistry.ts`, after the existing store serialization loop, read quiz localStorage keys and add them to the envelope:

```typescript
// Inside buildPortabilityEnvelope(), after stores are serialized:
const quizPersonality = localStorage.getItem('quiz-personality')
const quizHistory = localStorage.getItem('quiz-history')
if (quizPersonality || quizHistory) {
  envelope.quiz = {
    personality: quizPersonality ? JSON.parse(quizPersonality) : null,
    history: quizHistory ? JSON.parse(quizHistory) : null,
  }
}
```

- [ ] **Step 2: Extend `resolvePortabilityData` to restore quiz state on import**

In the import path (after resolving stores), check for the `quiz` key:

```typescript
// Inside resolvePortabilityData() or applyResolvedPortabilityData():
if (input.quiz) {
  if (input.quiz.personality) {
    localStorage.setItem('quiz-personality', JSON.stringify(input.quiz.personality))
  }
  if (input.quiz.history) {
    localStorage.setItem('quiz-history', JSON.stringify(input.quiz.history))
  }
}
```

- [ ] **Step 3: Update the PortabilityEnvelopeV2 type** to include the optional `quiz` field.

- [ ] **Step 4: Test export → import roundtrip**

Manual test: take quiz, export plan, clear localStorage, import plan, verify dashboard badge shows correct personality type.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/storeRegistry.ts
git commit -m "feat(quiz): include quiz personality in plan JSON export/import envelope"
```

---

## Task 15: Umami Instrumentation

**Files:**
- Modify: `frontend/src/pages/QuizPage.tsx`
- Modify: `frontend/src/components/quiz/QuizResult.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 0: Update AnalyticsEvent union in lib/analytics.ts**

The `trackEvent` function uses a closed `AnalyticsEvent` union type. Add all 10 quiz event names to the union before using them. Without this, TypeScript will reject the `trackEvent` calls and Task 17's type-check will fail.

```typescript
// Add to the AnalyticsEvent union in lib/analytics.ts:
| 'quiz_start' | 'quiz_question' | 'quiz_complete'
| 'share_click' | 'share_export' | 'cta_to_setup'
| 'compare_start' | 'retake_start' | 'type_page_view' | 'digest_shown'
```

- [ ] **Step 1: Add quiz-specific Umami events**

The quiz page sits outside AppLayout, so it needs its own funnel instrumentation (per eng review finding #5). Add these Umami events:

| Event | Trigger | Data |
|-------|---------|------|
| `quiz_start` | User clicks "Let's Go" | `{ source: 'direct' / 'compare' / 'deeplink' }` |
| `quiz_question` | User answers a question | `{ question: 1-5 }` |
| `quiz_complete` | Result screen renders | `{ type: 'kopi-saver' }` |
| `share_click` | User taps Share | `{ method: 'native' / 'clipboard' / 'download' }` |
| `share_export` | PNG successfully generated | `{ type: 'kopi-saver' }` |
| `cta_to_setup` | User clicks "Plan My FIRE" | `{ type: 'kopi-saver' }` |
| `compare_start` | User opens comparison link | `{ friendType: 'steady-compounder' }` |
| `retake_start` | User retakes quiz | `{ previousType: 'moonshot-maverick' }` |
| `type_page_view` | User lands on /quiz/:type | `{ type: 'kopi-saver' }` |
| `digest_shown` | Monthly digest fires | `{ deltaMonths: -6 }` |

- [ ] **Step 2: Add page_navigated for quiz pages**

Since QuizPage is outside AppLayout (which normally handles page tracking), add a `useEffect` that fires `page_navigated` on mount.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/QuizPage.tsx frontend/src/components/quiz/QuizResult.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat(quiz): Umami analytics instrumentation for all quiz events"
```

---

## Task 16: E2E Tests

**Files:**
- Create: `frontend/e2e/quiz.spec.ts`

- [ ] **Step 1: Write 5 E2E tests**

```typescript
test('complete quiz flow', async ({ page }) => {
  await page.goto('/quiz')
  await page.click('text=Let\'s Go')
  // Answer 5 questions
  for (let i = 0; i < 5; i++) {
    await page.click('[data-testid="quiz-option-0"]') // first option each time
    await page.waitForTimeout(500) // transition delay
  }
  // Verify result screen
  await expect(page.locator('[data-testid="quiz-result"]')).toBeVisible()
  await expect(page.locator('[data-testid="share-button"]')).toBeVisible()
})

test('browser back returns to previous question', async ({ page }) => { ... })
test('friend comparison URL shows side-by-side', async ({ page }) => { ... })
test('quiz to setup handoff shows greeting', async ({ page }) => { ... })
test('share button copies URL to clipboard', async ({ page }) => { ... })
```

- [ ] **Step 2: Run E2E tests**

```bash
cd frontend && npx playwright test e2e/quiz.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/quiz.spec.ts
git commit -m "test(quiz): E2E tests for quiz flow, comparison, setup handoff, and sharing"
```

---

## Task 17: Type Check + Lint + Final Verification

- [ ] **Step 1: Type check**

```bash
cd frontend && npm run type-check
```

Fix any errors.

- [ ] **Step 2: Lint**

```bash
cd frontend && npm run lint
```

Fix any errors.

- [ ] **Step 3: Run all tests**

```bash
cd frontend && npm run test
```

Verify no regressions.

- [ ] **Step 4: Run E2E**

```bash
cd frontend && npx playwright test
```

Verify all E2E tests pass (including existing ones).

- [ ] **Step 5: Build**

```bash
cd frontend && npm run build
```

Verify clean build with no errors.

- [ ] **Step 6: Final commit if any fixes**

```bash
git add -A && git commit -m "fix(quiz): type-check and lint fixes"
```

---

## Task 18: Accessibility + Reduced Motion

- [ ] **Step 1: Add keyboard navigation to quiz**

Quiz answer options: arrow keys cycle focus, Enter selects. Use `onKeyDown` handler on the options container.

- [ ] **Step 2: Add prefers-reduced-motion**

Wrap all framer-motion transitions in the quiz with `useReducedMotion()`. When true, set `transition: { duration: 0 }` to skip animations.

- [ ] **Step 3: Add ARIA attributes**

- Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="5"`
- Quiz options: `role="radiogroup"`, each option `role="radio"`, `aria-checked`
- Share card alt text: "Your FIRE personality: {Type Name}"

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/quiz/ frontend/src/pages/QuizPage.tsx
git commit -m "feat(quiz): keyboard navigation, reduced motion, ARIA attributes"
```

---

## Parallelization Strategy

These tasks can be split across worktrees:

**Lane A (core, sequential):** Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
**Lane B (independent):** Task 9 (prerender) — no shared files with Lane A until merge
**Lane C (depends on A):** Tasks 10 → 11 → 12 → 13 → 14 → 15 → 16

Merge order: Lane A first, then B, then C. Run E2E (Task 16) after all merges.
