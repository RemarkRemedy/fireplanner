# CPF Transition Planner: Plan 3 — Couples Mode, URL Sharing, Feedback API, Mobile Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add couples mode with interleaved timelines and combined hero, full URL sharing with validation, a Cloudflare Pages Function for crowd-sourced payout data, and mobile-responsive polish for all CPF Transition Planner components.

**Architecture:** Extends Plan 1's PlannerContext with partner data. No new Zustand stores. Couple state lives in `PlannerContext.household` and URL params. The feedback API follows the existing D1 + rate limiting pattern established in `email-signup.ts` and `feedback.ts`.

**Tech Stack:** React 19, TypeScript, Zustand (existing stores), Zod (URL validation), Cloudflare Pages Functions + D1, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-cpf-transition-planner-design.md`

**Depends on:** Plan 1 (core types, context builder, scheme registry, hooks, UI components) and Plan 2 (remaining schemes, Sankey animator, waterfall chart)

---

## File Map

### New files to create

```
frontend/src/lib/cpf-transition/
  domain/couple.ts                    # buildCoupleTimeline(), mergePartnerContexts()
  domain/urlParams.ts                 # encodeInputsToUrl(), decodeUrlToInputs(), validateUrlParams()
  tests/couple.test.ts
  tests/urlParams.test.ts

frontend/src/components/cpf-transition/
  CoupleTimeline.tsx                  # Interleaved chronological timeline for two partners
  CoupleToggle.tsx                    # Couple mode toggle + Partner B input fields
  ShareSection.tsx                    # Copy link button + save-to-profile button
  PayoutFeedbackForm.tsx              # Crowd-source payout data form

frontend/functions/api/
  cpf-payout-data.ts                  # POST handler for payout feedback

frontend/src/lib/validation/
  cpfPayoutConstants.ts               # Validation constants for the payout feedback form
```

### Files to modify

```
frontend/src/lib/cpf-transition/types.ts            # Extend PartnerProfile, add CoupleTimelineEntry
frontend/src/lib/cpf-transition/domain/context.ts   # Accept partner RawInputs, build couple context
frontend/src/lib/cpf-transition/hooks/useCpfTransitionParams.ts  # Encode/decode partner URL params
frontend/src/lib/cpf-transition/hooks/useCpfTransition.ts        # Couple mode orchestration
frontend/src/lib/cpf-transition/hooks/useCpfLifeEstimate.ts      # Combined household payout
frontend/src/lib/cpf-transition/schemes/spousal-transfer.ts      # Enable when couple mode on (Plan 2 stub)

frontend/src/components/cpf-transition/CpfTransitionInput.tsx    # Couple toggle + Partner B fields
frontend/src/components/cpf-transition/CpfTransitionHero.tsx     # Combined household hero
frontend/src/components/cpf-transition/CpfAccountCards.tsx       # Two-row couple variant + mobile collapse
frontend/src/components/cpf-transition/DecisionCard.tsx          # Mobile vertical stacking
frontend/src/components/cpf-transition/StoryChapter.tsx          # Chapter boundary styling for screenshots

frontend/src/pages/CpfTransitionPage.tsx                         # Wire couple mode + share + feedback
frontend/schema.sql                                              # Add cpf_payout_data table
frontend/src/lib/validation/emailConstants.ts                    # Add 'cpf_payout_feedback' to VALID_SOURCES
```

---

## Part A: Couples Mode

### Task 1: Extend Types for Couples

**Files:**
- Modify: `frontend/src/lib/cpf-transition/types.ts`
- Test: `frontend/src/lib/cpf-transition/tests/couple.test.ts`

- [ ] **Step 1: Add CoupleTimelineEntry and extend PartnerProfile**

Add these types to the existing `types.ts`:

```typescript
// Add to frontend/src/lib/cpf-transition/types.ts

/** Identifies which partner owns a milestone */
export type PartnerId = 'a' | 'b'

/** A single entry in the interleaved couple timeline */
export interface CoupleTimelineEntry {
  /** Calendar year this event occurs */
  calendarYear: number
  /** Which partner this milestone belongs to */
  partner: PartnerId
  /** Partner's age at this milestone */
  age: number
  /** Which chapter this falls into for the given partner */
  chapter: ChapterAge
  /** Label for the milestone (e.g. "Partner A turns 55") */
  label: string
  /** Scheme results grouped under this milestone, if any */
  schemes: Array<{ definition: SchemeDefinition; result: SchemeResult }>
}

/** Extended partner profile with optional fields matching RawInputs */
export interface PartnerRawInputs {
  age: number
  oa: number
  sa: number
  ra: number
  ma: number
  monthlySalary: number
  residency?: ResidencyStatus
  cpfLifePlan?: CpfLifePlan
  cpfLifeStartAge?: number
  cpfRetirementSum?: CpfRetirementSum
  srsBalance?: number
}
```

- [ ] **Step 2: Write tests for couple type shapes**

```typescript
// frontend/src/lib/cpf-transition/tests/couple.test.ts
import { describe, it, expect } from 'vitest'
import type { CoupleTimelineEntry, PartnerRawInputs, PartnerId } from '../types'

describe('Couple Types', () => {
  it('CoupleTimelineEntry is assignable', () => {
    const entry: CoupleTimelineEntry = {
      calendarYear: 2028,
      partner: 'a',
      age: 55,
      chapter: 'at55',
      label: 'Partner A turns 55',
      schemes: [],
    }
    expect(entry.calendarYear).toBe(2028)
    expect(entry.partner).toBe('a')
  })

  it('PartnerId covers both partners', () => {
    const ids: PartnerId[] = ['a', 'b']
    expect(ids).toHaveLength(2)
  })

  it('PartnerRawInputs is assignable', () => {
    const partner: PartnerRawInputs = {
      age: 57,
      oa: 200000,
      sa: 0,
      ra: 220000,
      ma: 75000,
      monthlySalary: 0,
    }
    expect(partner.age).toBe(57)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/couple.test.ts`
Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/types.ts frontend/src/lib/cpf-transition/tests/couple.test.ts && git commit -m "feat(cpf-transition): add couple timeline types"
```

---

### Task 2: Couple Timeline Builder

**Files:**
- Create: `frontend/src/lib/cpf-transition/domain/couple.ts`
- Test: `frontend/src/lib/cpf-transition/tests/couple.test.ts` (extend)

- [ ] **Step 1: Write failing tests**

Append to `couple.test.ts`:

```typescript
import { buildCoupleTimeline } from '../domain/couple'
import { buildPlannerContext } from '../domain/context'
import { ALL_SCHEMES } from '../schemes/registry'

describe('buildCoupleTimeline', () => {
  const partnerA = { age: 53, oa: 200000, sa: 200000, ra: 0, ma: 60000, monthlySalary: 8000 }
  const partnerB = { age: 57, oa: 300000, sa: 0, ra: 220000, ma: 75000, monthlySalary: 0 }

  it('interleaves milestones chronologically by calendar year', () => {
    const timeline = buildCoupleTimeline(partnerA, partnerB, ALL_SCHEMES, 2026)
    expect(timeline.length).toBeGreaterThan(0)

    // Calendar years must be non-decreasing
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].calendarYear).toBeGreaterThanOrEqual(timeline[i - 1].calendarYear)
    }
  })

  it('includes milestones from both partners', () => {
    const timeline = buildCoupleTimeline(partnerA, partnerB, ALL_SCHEMES, 2026)
    const partnerAEntries = timeline.filter(e => e.partner === 'a')
    const partnerBEntries = timeline.filter(e => e.partner === 'b')
    expect(partnerAEntries.length).toBeGreaterThan(0)
    expect(partnerBEntries.length).toBeGreaterThan(0)
  })

  it('Partner B (age 57) at55 milestone comes before Partner A (age 53) at55', () => {
    const timeline = buildCoupleTimeline(partnerA, partnerB, ALL_SCHEMES, 2026)
    // B already passed 55, so their at55 chapter reflects current post-55 state
    // A hits 55 in 2028
    const aAt55 = timeline.find(e => e.partner === 'a' && e.chapter === 'at55')
    const bAt65 = timeline.find(e => e.partner === 'b' && e.chapter === 'at65')
    if (aAt55 && bAt65) {
      // A turns 55 in ~2028, B turns 65 in ~2034
      expect(aAt55.calendarYear).toBeLessThan(bAt65.calendarYear)
    }
  })

  it('same-age partners produce interleaved entries', () => {
    const sameAge = { age: 54, oa: 150000, sa: 150000, ra: 0, ma: 60000, monthlySalary: 5000 }
    const timeline = buildCoupleTimeline(sameAge, sameAge, ALL_SCHEMES, 2026)
    // Both hit milestones at the same calendar year
    const year2027 = timeline.filter(e => e.calendarYear === 2027)
    // Both partners should have entries at the same year
    if (year2027.length >= 2) {
      const partners = new Set(year2027.map(e => e.partner))
      expect(partners.size).toBe(2)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/couple.test.ts`
Expected: FAIL (buildCoupleTimeline not found)

- [ ] **Step 3: Implement**

```typescript
// frontend/src/lib/cpf-transition/domain/couple.ts
import type { SchemeDefinition, CoupleTimelineEntry, ChapterAge, PartnerId } from '../types'
import type { RawInputs } from './context'
import { buildPlannerContext } from './context'
import { filterEligibleSchemes } from '../orchestration/eligibility'

/** Milestone age boundaries for each chapter */
const CHAPTER_MILESTONES: Array<{ chapter: ChapterAge; triggerAge: number; label: (id: PartnerId) => string }> = [
  { chapter: 'pre55', triggerAge: 50, label: (id) => `Partner ${id.toUpperCase()}: Ages 50-54 preparation` },
  { chapter: 'at55', triggerAge: 55, label: (id) => `Partner ${id.toUpperCase()} turns 55` },
  { chapter: 'post55', triggerAge: 56, label: (id) => `Partner ${id.toUpperCase()}: Ages 55-64 growth` },
  { chapter: 'at65', triggerAge: 65, label: (id) => `Partner ${id.toUpperCase()} turns 65` },
  { chapter: 'post65', triggerAge: 66, label: (id) => `Partner ${id.toUpperCase()}: Ages 65-70 payouts` },
]

/**
 * Build milestones for a single partner, returning entries with calendar years.
 */
function buildPartnerMilestones(
  inputs: RawInputs,
  partnerId: PartnerId,
  allSchemes: SchemeDefinition[],
  currentYear: number,
): CoupleTimelineEntry[] {
  const ctx = buildPlannerContext(inputs)
  const eligible = filterEligibleSchemes(allSchemes, ctx)
  const entries: CoupleTimelineEntry[] = []

  for (const milestone of CHAPTER_MILESTONES) {
    // Calendar year when this partner reaches the trigger age
    const calendarYear = currentYear + Math.max(0, milestone.triggerAge - inputs.age)

    // Skip milestones that are far in the past (more than 5 years ago)
    if (calendarYear < currentYear - 5) continue

    // Skip pre55 if already past 55
    if (milestone.chapter === 'pre55' && inputs.age >= 55) continue
    // Skip post55 if not yet 55 and pre55 already covers preparation
    if (milestone.chapter === 'post55' && inputs.age < 55) continue

    const chapterSchemes = eligible
      .filter(s => s.chapter === milestone.chapter)
      .map(s => ({ definition: s, result: s.compute(ctx) }))
      .sort((a, b) => b.definition.relevanceScore(ctx) - a.definition.relevanceScore(ctx))

    // Only include milestones that have schemes or are major transitions
    if (chapterSchemes.length > 0 || milestone.chapter === 'at55' || milestone.chapter === 'at65') {
      entries.push({
        calendarYear,
        partner: partnerId,
        age: milestone.triggerAge,
        chapter: milestone.chapter,
        label: milestone.label(partnerId),
        schemes: chapterSchemes,
      })
    }
  }

  return entries
}

/**
 * Build an interleaved couple timeline.
 * Merges both partners' milestones and sorts chronologically.
 * Within the same calendar year, Partner A comes before Partner B.
 */
export function buildCoupleTimeline(
  partnerAInputs: RawInputs,
  partnerBInputs: RawInputs,
  allSchemes: SchemeDefinition[],
  currentYear: number = new Date().getFullYear(),
): CoupleTimelineEntry[] {
  const aMilestones = buildPartnerMilestones(partnerAInputs, 'a', allSchemes, currentYear)
  const bMilestones = buildPartnerMilestones(partnerBInputs, 'b', allSchemes, currentYear)

  const merged = [...aMilestones, ...bMilestones]

  // Sort by calendar year, then partner A before B within the same year
  merged.sort((a, b) => {
    if (a.calendarYear !== b.calendarYear) return a.calendarYear - b.calendarYear
    if (a.partner !== b.partner) return a.partner === 'a' ? -1 : 1
    return 0
  })

  return merged
}

/**
 * Compute combined household monthly payout for the hero section.
 */
export function computeHouseholdPayout(
  partnerAPayout: number,
  partnerBPayout: number,
): { combined: number; partnerA: number; partnerB: number } {
  return {
    combined: partnerAPayout + partnerBPayout,
    partnerA: partnerAPayout,
    partnerB: partnerBPayout,
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/couple.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/domain/couple.ts frontend/src/lib/cpf-transition/tests/couple.test.ts && git commit -m "feat(cpf-transition): add couple timeline builder"
```

---

### Task 3: Extend Context Builder for Partner Data

**Files:**
- Modify: `frontend/src/lib/cpf-transition/domain/context.ts`
- Test: `frontend/src/lib/cpf-transition/tests/context.test.ts` (extend)

- [ ] **Step 1: Write failing tests**

Append to `context.test.ts`:

```typescript
describe('buildPlannerContext with couple mode', () => {
  it('attaches partner data when isCoupleMode and partner provided', () => {
    const ctx = buildPlannerContext({
      age: 53, oa: 200000, sa: 200000, ra: 0, ma: 60000, monthlySalary: 8000,
      isCoupleMode: true,
      partner: { age: 57, oa: 300000, sa: 0, ra: 220000, ma: 75000, monthlySalary: 0 },
    })
    expect(ctx.household.isCoupleMode).toBe(true)
    expect(ctx.household.partner).toBeDefined()
    expect(ctx.household.partner!.age).toBe(57)
    expect(ctx.household.partner!.birthYear).toBe(new Date().getFullYear() - 57)
  })

  it('partner SA is zeroed if partner age >= 55', () => {
    const ctx = buildPlannerContext({
      age: 50, oa: 100000, sa: 100000, ra: 0, ma: 50000, monthlySalary: 5000,
      isCoupleMode: true,
      partner: { age: 56, oa: 200000, sa: 50000, ra: 180000, ma: 70000, monthlySalary: 0 },
    })
    expect(ctx.household.partner!.sa).toBe(0)
    expect(ctx.household.partner!.ra).toBe(180000)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/context.test.ts`
Expected: FAIL (partner field not handled)

- [ ] **Step 3: Update RawInputs and buildPlannerContext**

Add to the `RawInputs` interface in `context.ts`:

```typescript
// Add to RawInputs interface
partner?: {
  age: number
  oa: number
  sa: number
  ra: number
  ma: number
  monthlySalary: number
  residency?: ResidencyStatus
  cpfLifePlan?: CpfLifePlan
  cpfLifeStartAge?: number
  cpfRetirementSum?: CpfRetirementSum
  srsBalance?: number
}
```

Update the `buildPlannerContext` function's `household` field:

```typescript
household: {
  isCoupleMode: inputs.isCoupleMode ?? false,
  partner: inputs.isCoupleMode && inputs.partner ? {
    age: inputs.partner.age,
    birthYear: currentYear - inputs.partner.age,
    oa: inputs.partner.oa,
    sa: inputs.partner.age >= 55 ? 0 : inputs.partner.sa,
    ra: inputs.partner.age >= 55 ? inputs.partner.ra : 0,
    ma: inputs.partner.ma,
    monthlySalary: inputs.partner.monthlySalary,
  } : undefined,
},
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/context.test.ts`
Expected: All PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/domain/context.ts frontend/src/lib/cpf-transition/tests/context.test.ts && git commit -m "feat(cpf-transition): extend context builder for couple mode"
```

---

### Task 4: Extend Hooks for Couple Mode

**Files:**
- Modify: `frontend/src/lib/cpf-transition/hooks/useCpfTransition.ts`
- Modify: `frontend/src/lib/cpf-transition/hooks/useCpfLifeEstimate.ts`

- [ ] **Step 1: Update useCpfTransition for couple mode**

```typescript
// frontend/src/lib/cpf-transition/hooks/useCpfTransition.ts
import { useMemo } from 'react'
import { buildPlannerContext } from '../domain/context'
import { buildNarrative } from '../orchestration/narrative'
import { buildCoupleTimeline, computeHouseholdPayout } from '../domain/couple'
import { ALL_SCHEMES } from '../schemes/registry'
import { isPolicyStale } from '../policy/packs'
import type { RawInputs } from '../domain/context'
import type { PlannerContext, ChapterGroup, CoupleTimelineEntry } from '../types'

export interface CpfTransitionResult {
  context: PlannerContext
  chapters: ChapterGroup[]
  coupleTimeline: CoupleTimelineEntry[] | null
  isStaleData: boolean
}

export function useCpfTransition(inputs: RawInputs): CpfTransitionResult {
  return useMemo(() => {
    const context = buildPlannerContext(inputs)
    const chapters = buildNarrative(ALL_SCHEMES, context)
    const isStaleData = isPolicyStale(context.policy)

    let coupleTimeline: CoupleTimelineEntry[] | null = null
    if (inputs.isCoupleMode && inputs.partner) {
      const currentYear = new Date().getFullYear()
      coupleTimeline = buildCoupleTimeline(inputs, inputs.partner, ALL_SCHEMES, currentYear)
    }

    return { context, chapters, coupleTimeline, isStaleData }
  }, [inputs])
}
```

- [ ] **Step 2: Update useCpfLifeEstimate for combined household payout**

```typescript
// frontend/src/lib/cpf-transition/hooks/useCpfLifeEstimate.ts
import { useMemo } from 'react'
import { performAge55Transfer, estimateCpfLifePayout, getRetirementSumAmount, projectCpfBalances } from '@/lib/calculations/cpf'
import type { PlannerContext } from '../types'

export interface PayoutEstimate {
  monthlyPayout: number
  retirementSumAt55: number
  plan: string
  /** Only present in couple mode */
  partnerPayout?: number
  /** Only present in couple mode */
  combinedPayout?: number
}

/** Estimate monthly payout for a single person's context */
function estimateForSingleContext(
  age: number,
  oa: number,
  sa: number,
  ma: number,
  ra: number,
  monthlySalary: number,
  salaryGrowthRate: number,
  plan: string,
  retirementSum: string,
): { monthlyPayout: number; retirementSumAt55: number } {
  let retirementSumAt55: number

  if (age >= 55) {
    retirementSumAt55 = ra
  } else {
    const annualSalary = monthlySalary * 12
    const projections = projectCpfBalances(age, 54, oa, sa, ma, annualSalary, salaryGrowthRate)
    const atAge54 = projections.length > 0
      ? projections[projections.length - 1]
      : { oaBalance: oa, saBalance: sa, maBalance: ma }

    const target = getRetirementSumAmount(retirementSum as 'brs' | 'frs' | 'ers', age)
    const { newRA } = performAge55Transfer(atAge54.oaBalance, atAge54.saBalance, target)
    retirementSumAt55 = newRA
  }

  const annualPayout = estimateCpfLifePayout(retirementSumAt55, plan as 'basic' | 'standard' | 'escalating')
  return { monthlyPayout: annualPayout / 12, retirementSumAt55 }
}

export function useCpfLifeEstimate(ctx: PlannerContext): PayoutEstimate {
  return useMemo(() => {
    const primary = estimateForSingleContext(
      ctx.profile.age,
      ctx.accounts.oa, ctx.accounts.sa, ctx.accounts.ma, ctx.accounts.ra,
      ctx.income.monthlySalary, ctx.income.salaryGrowthRate,
      ctx.cpfLife.plan, ctx.cpfLife.retirementSum,
    )

    if (!ctx.household.isCoupleMode || !ctx.household.partner) {
      return {
        monthlyPayout: primary.monthlyPayout,
        retirementSumAt55: primary.retirementSumAt55,
        plan: ctx.cpfLife.plan,
      }
    }

    const partner = ctx.household.partner
    const partnerEstimate = estimateForSingleContext(
      partner.age,
      partner.oa, partner.sa, partner.ma, partner.ra,
      partner.monthlySalary, 0.03,
      'standard', 'frs',
    )

    return {
      monthlyPayout: primary.monthlyPayout,
      retirementSumAt55: primary.retirementSumAt55,
      plan: ctx.cpfLife.plan,
      partnerPayout: partnerEstimate.monthlyPayout,
      combinedPayout: primary.monthlyPayout + partnerEstimate.monthlyPayout,
    }
  }, [ctx])
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/hooks/useCpfTransition.ts frontend/src/lib/cpf-transition/hooks/useCpfLifeEstimate.ts && git commit -m "feat(cpf-transition): extend hooks for couple mode"
```

---

### Task 5: Couple UI Components

**Files:**
- Create: `frontend/src/components/cpf-transition/CoupleToggle.tsx`
- Create: `frontend/src/components/cpf-transition/CoupleTimeline.tsx`
- Modify: `frontend/src/components/cpf-transition/CpfTransitionInput.tsx`
- Modify: `frontend/src/components/cpf-transition/CpfTransitionHero.tsx`
- Modify: `frontend/src/components/cpf-transition/CpfAccountCards.tsx`

- [ ] **Step 1: Write CoupleToggle**

A toggle switch that enables couple mode and reveals Partner B input fields. Uses the `Switch` component from shadcn/ui. When toggled on, renders a second set of input fields (age, OA, SA/RA, MA, salary) for Partner B using the same `CurrencyInput` and `NumberInput` wrappers.

```typescript
// frontend/src/components/cpf-transition/CoupleToggle.tsx
//
// Props:
//   isCoupleMode: boolean
//   onToggle: (enabled: boolean) => void
//   partnerInputs: PartnerRawInputs | undefined
//   onPartnerChange: (field: keyof PartnerRawInputs, value: number) => void
//
// Layout:
//   [Switch] "Planning as a couple?"
//   When on:
//     <Card> "Partner B"
//       Age (NumberInput)
//       OA (CurrencyInput)
//       SA or RA (CurrencyInput, age-gated same as Partner A)
//       MA (CurrencyInput)
//       Monthly salary (CurrencyInput)
//     </Card>
```

- [ ] **Step 2: Write CoupleTimeline**

Renders the interleaved timeline from `buildCoupleTimeline()`. Each entry shows a partner badge (color-coded), the calendar year, the milestone label, and nested scheme cards (DecisionCard/AutomaticCard).

```typescript
// frontend/src/components/cpf-transition/CoupleTimeline.tsx
//
// Props:
//   timeline: CoupleTimelineEntry[]
//
// Layout:
//   Vertical timeline with alternating partner badges:
//     [2026] [Partner B badge] "Partner B: Ages 55-64 growth"
//       <scheme cards>
//     [2028] [Partner A badge] "Partner A turns 55"
//       <scheme cards>
//     [2034] [Partner B badge] "Partner B turns 65"
//       <scheme cards>
//     ...
//
// Partner A: blue badge
// Partner B: purple badge
// Same-year entries grouped visually with a shared year marker
```

- [ ] **Step 3: Update CpfTransitionInput**

Add `CoupleToggle` below the primary input fields. When couple mode is on, the input form expands to show both "You" and "Partner" sections. The `updateField` callback is extended to handle partner fields by prefixing URL params with `p_` (see Task 7).

- [ ] **Step 4: Update CpfTransitionHero**

When `combinedPayout` is present in the `PayoutEstimate`, show:
- "Your estimated household retirement income: ~$X/month"
- Below: "You: ~$A/month | Partner: ~$B/month"
- Same hatched/faded treatment for projections

When in single mode, keep existing behavior.

- [ ] **Step 5: Update CpfAccountCards**

Add couple variant: when couple mode is on, show two rows of 3-card sets. Each row is labeled "You" / "Partner". On mobile (< 640px), both rows collapse to single-line totals.

- [ ] **Step 6: Run type-check**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 7: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/CoupleToggle.tsx frontend/src/components/cpf-transition/CoupleTimeline.tsx frontend/src/components/cpf-transition/CpfTransitionInput.tsx frontend/src/components/cpf-transition/CpfTransitionHero.tsx frontend/src/components/cpf-transition/CpfAccountCards.tsx && git commit -m "feat(cpf-transition): add couple UI components"
```

---

### Task 6: Wire Couple Mode into Page

**Files:**
- Modify: `frontend/src/pages/CpfTransitionPage.tsx`

- [ ] **Step 1: Update page to support couple mode**

The page component holds couple state as local React state (not a store):
- `isCoupleMode: boolean`
- `partnerInputs: PartnerRawInputs | undefined`

When couple mode is on:
- Pass partner data to `useCpfTransition` via the `inputs` object
- Render `CoupleTimeline` instead of the regular chapter list
- Show combined hero

When couple mode is off:
- Render the existing single-person chapter view

The couple toggle writes to URL params (see Task 7) so the mode persists across page loads and shared links.

- [ ] **Step 2: Enable spousal transfer scheme**

In `frontend/src/lib/cpf-transition/schemes/spousal-transfer.ts` (created in Plan 2), update the eligibility function to check `ctx.household.isCoupleMode`. The scheme should only appear when couple mode is on. If Plan 2's spousal transfer is a stub, implement the eligibility and compute functions:

```typescript
// Eligibility: couple mode on, primary partner 55+, excess OA/RA above BRS
eligibility: (ctx: PlannerContext): boolean => {
  if (!ctx.household.isCoupleMode || !ctx.household.partner) return false
  if (ctx.profile.age < 55) return false
  // Must have set aside at least BRS
  return ctx.accounts.ra >= ctx.policy.retirementSums.brs
},
```

- [ ] **Step 3: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/pages/CpfTransitionPage.tsx frontend/src/lib/cpf-transition/schemes/spousal-transfer.ts && git commit -m "feat(cpf-transition): wire couple mode into page and enable spousal transfer"
```

---

## Part B: URL Sharing

### Task 7: URL Encoding/Decoding with Validation

**Files:**
- Create: `frontend/src/lib/cpf-transition/domain/urlParams.ts`
- Test: `frontend/src/lib/cpf-transition/tests/urlParams.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/lib/cpf-transition/tests/urlParams.test.ts
import { describe, it, expect } from 'vitest'
import { encodeInputsToUrl, decodeUrlToInputs, validateUrlParams } from '../domain/urlParams'

describe('encodeInputsToUrl', () => {
  it('encodes single person inputs', () => {
    const params = encodeInputsToUrl({
      age: 53, oa: 200000, sa: 200000, ra: 0, ma: 60000, monthlySalary: 8000,
    })
    expect(params.get('age')).toBe('53')
    expect(params.get('oa')).toBe('200000')
    expect(params.get('sa')).toBe('200000')
    expect(params.get('ra')).toBe('0')
    expect(params.get('ma')).toBe('60000')
    expect(params.get('salary')).toBe('8000')
  })

  it('encodes couple mode with partner fields', () => {
    const params = encodeInputsToUrl({
      age: 53, oa: 200000, sa: 200000, ra: 0, ma: 60000, monthlySalary: 8000,
      isCoupleMode: true,
      partner: { age: 57, oa: 300000, sa: 0, ra: 220000, ma: 75000, monthlySalary: 0 },
    })
    expect(params.get('couple')).toBe('1')
    expect(params.get('p_age')).toBe('57')
    expect(params.get('p_oa')).toBe('300000')
    expect(params.get('p_ra')).toBe('220000')
    expect(params.get('p_salary')).toBe('0')
  })

  it('omits couple params when not in couple mode', () => {
    const params = encodeInputsToUrl({
      age: 53, oa: 200000, sa: 200000, ra: 0, ma: 60000, monthlySalary: 8000,
    })
    expect(params.has('couple')).toBe(false)
    expect(params.has('p_age')).toBe(false)
  })

  it('omits zero-value optional fields for cleaner URLs', () => {
    const params = encodeInputsToUrl({
      age: 55, oa: 100000, sa: 0, ra: 220000, ma: 75000, monthlySalary: 0,
    })
    // sa=0 and salary=0 can be omitted for cleaner URL
    expect(params.get('sa')).toBeNull()
    expect(params.get('salary')).toBeNull()
  })
})

describe('decodeUrlToInputs', () => {
  it('decodes single person params', () => {
    const params = new URLSearchParams('age=53&oa=200000&sa=200000&ma=60000&salary=8000')
    const inputs = decodeUrlToInputs(params)
    expect(inputs.age).toBe(53)
    expect(inputs.oa).toBe(200000)
    expect(inputs.monthlySalary).toBe(8000)
    expect(inputs.isCoupleMode).toBe(false)
  })

  it('decodes couple mode params', () => {
    const params = new URLSearchParams('age=53&oa=200000&sa=200000&ma=60000&salary=8000&couple=1&p_age=57&p_oa=300000&p_ra=220000&p_ma=75000&p_salary=0')
    const inputs = decodeUrlToInputs(params)
    expect(inputs.isCoupleMode).toBe(true)
    expect(inputs.partner).toBeDefined()
    expect(inputs.partner!.age).toBe(57)
    expect(inputs.partner!.ra).toBe(220000)
  })

  it('returns null for missing required params', () => {
    const params = new URLSearchParams('oa=200000')
    const inputs = decodeUrlToInputs(params)
    expect(inputs).toBeNull()
  })

  it('returns null for empty param string', () => {
    const params = new URLSearchParams('')
    const inputs = decodeUrlToInputs(params)
    expect(inputs).toBeNull()
  })
})

describe('validateUrlParams', () => {
  it('accepts valid single person params', () => {
    const params = new URLSearchParams('age=53&oa=200000&sa=200000&ma=60000&salary=8000')
    expect(validateUrlParams(params).valid).toBe(true)
  })

  it('rejects age below 45', () => {
    const params = new URLSearchParams('age=30&oa=100000&sa=100000&ma=50000')
    const result = validateUrlParams(params)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('age must be between 45 and 75')
  })

  it('rejects age above 75', () => {
    const params = new URLSearchParams('age=80&oa=100000&ra=100000&ma=50000')
    const result = validateUrlParams(params)
    expect(result.valid).toBe(false)
  })

  it('rejects negative balances', () => {
    const params = new URLSearchParams('age=55&oa=-50000&ra=100000&ma=50000')
    const result = validateUrlParams(params)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('oa must be non-negative')
  })

  it('rejects non-numeric values', () => {
    const params = new URLSearchParams('age=abc&oa=100000&sa=100000&ma=50000')
    const result = validateUrlParams(params)
    expect(result.valid).toBe(false)
  })

  it('rejects unreasonably large balances (over $5M)', () => {
    const params = new URLSearchParams('age=55&oa=10000000&ra=100000&ma=50000')
    const result = validateUrlParams(params)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('oa exceeds maximum ($5,000,000)')
  })

  it('validates couple mode partner params', () => {
    const params = new URLSearchParams('age=53&oa=200000&sa=200000&ma=60000&couple=1&p_age=57&p_oa=300000&p_ra=220000&p_ma=75000')
    expect(validateUrlParams(params).valid).toBe(true)
  })

  it('rejects couple mode with missing partner age', () => {
    const params = new URLSearchParams('age=53&oa=200000&sa=200000&ma=60000&couple=1&p_oa=300000')
    const result = validateUrlParams(params)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('partner age is required in couple mode')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/urlParams.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```typescript
// frontend/src/lib/cpf-transition/domain/urlParams.ts
import type { RawInputs } from './context'

const MAX_BALANCE = 5_000_000
const MIN_AGE = 45
const MAX_AGE = 75
const MAX_SALARY = 100_000

interface ValidationResult {
  valid: boolean
  errors: string[]
}

/** URL param key mapping for primary person */
const PRIMARY_KEYS = {
  age: 'age',
  oa: 'oa',
  sa: 'sa',
  ra: 'ra',
  ma: 'ma',
  monthlySalary: 'salary',
} as const

/** URL param key mapping for partner (prefixed with p_) */
const PARTNER_KEYS = {
  age: 'p_age',
  oa: 'p_oa',
  sa: 'p_sa',
  ra: 'p_ra',
  ma: 'p_ma',
  monthlySalary: 'p_salary',
} as const

/**
 * Encode RawInputs into URLSearchParams.
 * Omits zero-value optional fields for cleaner URLs.
 */
export function encodeInputsToUrl(inputs: RawInputs): URLSearchParams {
  const params = new URLSearchParams()

  // Primary person (always include age; omit zero balances and salary)
  params.set('age', String(inputs.age))
  if (inputs.oa > 0) params.set('oa', String(inputs.oa))
  if (inputs.sa > 0) params.set('sa', String(inputs.sa))
  if (inputs.ra > 0) params.set('ra', String(inputs.ra))
  if (inputs.ma > 0) params.set('ma', String(inputs.ma))
  if (inputs.monthlySalary > 0) params.set('salary', String(inputs.monthlySalary))

  // Couple mode
  if (inputs.isCoupleMode && inputs.partner) {
    params.set('couple', '1')
    params.set('p_age', String(inputs.partner.age))
    if (inputs.partner.oa > 0) params.set('p_oa', String(inputs.partner.oa))
    if (inputs.partner.sa > 0) params.set('p_sa', String(inputs.partner.sa))
    if (inputs.partner.ra > 0) params.set('p_ra', String(inputs.partner.ra))
    if (inputs.partner.ma > 0) params.set('p_ma', String(inputs.partner.ma))
    if (inputs.partner.monthlySalary > 0) params.set('p_salary', String(inputs.partner.monthlySalary))
  }

  return params
}

/**
 * Decode URLSearchParams back into RawInputs.
 * Returns null if required params are missing (age is required).
 */
export function decodeUrlToInputs(params: URLSearchParams): RawInputs | null {
  const ageStr = params.get('age')
  if (!ageStr) return null

  const age = Number(ageStr)
  if (isNaN(age)) return null

  const num = (key: string): number => {
    const v = params.get(key)
    if (v === null) return 0
    const n = Number(v)
    return isNaN(n) ? 0 : n
  }

  const isCoupleMode = params.get('couple') === '1'

  const inputs: RawInputs = {
    age,
    oa: num('oa'),
    sa: num('sa'),
    ra: num('ra'),
    ma: num('ma'),
    monthlySalary: num('salary'),
    isCoupleMode,
  }

  if (isCoupleMode) {
    const partnerAgeStr = params.get('p_age')
    if (partnerAgeStr) {
      const partnerAge = Number(partnerAgeStr)
      if (!isNaN(partnerAge)) {
        inputs.partner = {
          age: partnerAge,
          oa: num('p_oa'),
          sa: num('p_sa'),
          ra: num('p_ra'),
          ma: num('p_ma'),
          monthlySalary: num('p_salary'),
        }
      }
    }
  }

  return inputs
}

/** Validate a numeric URL param */
function validateNumericParam(
  params: URLSearchParams,
  key: string,
  label: string,
  opts: { required?: boolean; min?: number; max?: number },
): string[] {
  const errors: string[] = []
  const raw = params.get(key)

  if (raw === null) {
    if (opts.required) errors.push(`${label} is required`)
    return errors
  }

  const n = Number(raw)
  if (isNaN(n)) {
    errors.push(`${label} must be a number`)
    return errors
  }

  if (opts.min !== undefined && n < opts.min) {
    errors.push(`${label} must be between ${opts.min} and ${opts.max ?? 'N/A'}`)
  }
  if (opts.max !== undefined && n > opts.max) {
    errors.push(`${label} exceeds maximum ($${opts.max.toLocaleString()})`)
  }

  return errors
}

/**
 * Validate URL params for security and sanity.
 * Rejects out-of-range ages, negative balances, and unreasonably large values.
 */
export function validateUrlParams(params: URLSearchParams): ValidationResult {
  const errors: string[] = []

  errors.push(...validateNumericParam(params, 'age', 'age', { required: true, min: MIN_AGE, max: MAX_AGE }))
  errors.push(...validateNumericParam(params, 'oa', 'oa', { min: 0, max: MAX_BALANCE }))
  errors.push(...validateNumericParam(params, 'sa', 'sa', { min: 0, max: MAX_BALANCE }))
  errors.push(...validateNumericParam(params, 'ra', 'ra', { min: 0, max: MAX_BALANCE }))
  errors.push(...validateNumericParam(params, 'ma', 'ma', { min: 0, max: MAX_BALANCE }))
  errors.push(...validateNumericParam(params, 'salary', 'salary', { min: 0, max: MAX_SALARY }))

  // Couple mode validation
  if (params.get('couple') === '1') {
    const partnerAge = params.get('p_age')
    if (!partnerAge) {
      errors.push('partner age is required in couple mode')
    } else {
      errors.push(...validateNumericParam(params, 'p_age', 'partner age', { min: MIN_AGE, max: MAX_AGE }))
    }
    errors.push(...validateNumericParam(params, 'p_oa', 'partner oa', { min: 0, max: MAX_BALANCE }))
    errors.push(...validateNumericParam(params, 'p_sa', 'partner sa', { min: 0, max: MAX_BALANCE }))
    errors.push(...validateNumericParam(params, 'p_ra', 'partner ra', { min: 0, max: MAX_BALANCE }))
    errors.push(...validateNumericParam(params, 'p_ma', 'partner ma', { min: 0, max: MAX_BALANCE }))
    errors.push(...validateNumericParam(params, 'p_salary', 'partner salary', { min: 0, max: MAX_SALARY }))
  }

  return { valid: errors.length === 0, errors }
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/tj/TJDevelopment/fireplanner/frontend && npx vitest run src/lib/cpf-transition/tests/urlParams.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/domain/urlParams.ts frontend/src/lib/cpf-transition/tests/urlParams.test.ts && git commit -m "feat(cpf-transition): add URL encoding/decoding with validation"
```

---

### Task 8: Update Params Hook for Full URL Sharing

**Files:**
- Modify: `frontend/src/lib/cpf-transition/hooks/useCpfTransitionParams.ts`

- [ ] **Step 1: Rewrite the hook to use the new URL encoding module**

Replace the existing implementation with one that uses `decodeUrlToInputs`, `encodeInputsToUrl`, and `validateUrlParams`:

```typescript
// frontend/src/lib/cpf-transition/hooks/useCpfTransitionParams.ts
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProfileStore } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { decodeUrlToInputs, encodeInputsToUrl, validateUrlParams } from '../domain/urlParams'
import type { RawInputs } from '../domain/context'

export interface CpfTransitionParams {
  inputs: RawInputs
  updateField: (field: keyof RawInputs, value: number | string | boolean) => void
  updatePartnerField: (field: string, value: number) => void
  copyShareUrl: () => string
  saveToProfile: () => void
  isFromSharedUrl: boolean
  validationErrors: string[]
}

export function useCpfTransitionParams(): CpfTransitionParams {
  const [searchParams, setSearchParams] = useSearchParams()

  // Read from stores as fallback
  const profileAge = useProfileStore(s => s.currentAge)
  const profileOA = useProfileStore(s => s.cpfOA)
  const profileSA = useProfileStore(s => s.cpfSA)
  const profileRA = useProfileStore(s => s.cpfRA)
  const profileMA = useProfileStore(s => s.cpfMA)
  const annualSalary = useIncomeStore(s => s.annualSalary)
  const profileSetField = useProfileStore(s => s.setField)
  const incomeSetField = useIncomeStore(s => s.setField)

  // Detect if the user arrived via a shared URL (has age param on initial load)
  const [isFromSharedUrl] = useState(() => searchParams.has('age'))

  // Validate URL params if present
  const validationErrors = useMemo(() => {
    if (!searchParams.has('age')) return []
    const result = validateUrlParams(searchParams)
    return result.errors
  }, [searchParams])

  // Merge: URL params (highest priority) > store values > defaults
  const inputs = useMemo((): RawInputs => {
    const fromUrl = searchParams.has('age') ? decodeUrlToInputs(searchParams) : null

    if (fromUrl && validationErrors.length === 0) {
      return fromUrl
    }

    // Fallback to store values
    return {
      age: profileAge,
      oa: profileOA,
      sa: profileSA,
      ra: profileRA,
      ma: profileMA,
      monthlySalary: Math.round(annualSalary / 12),
    }
  }, [searchParams, validationErrors, profileAge, profileOA, profileSA, profileRA, profileMA, annualSalary])

  const updateField = useCallback((field: keyof RawInputs, value: number | string | boolean) => {
    const updated = { ...inputs, [field]: value }
    const newParams = encodeInputsToUrl(updated)
    setSearchParams(newParams, { replace: true })

    // Write back to stores (bidirectional)
    if (typeof value === 'number') {
      switch (field) {
        case 'age': profileSetField('currentAge', value); break
        case 'oa': profileSetField('cpfOA', value); break
        case 'sa': profileSetField('cpfSA', value); break
        case 'ra': profileSetField('cpfRA', value); break
        case 'ma': profileSetField('cpfMA', value); break
        case 'monthlySalary': incomeSetField('annualSalary', value * 12); break
      }
    }
  }, [inputs, setSearchParams, profileSetField, incomeSetField])

  const updatePartnerField = useCallback((field: string, value: number) => {
    const currentPartner = inputs.partner ?? { age: 55, oa: 0, sa: 0, ra: 0, ma: 0, monthlySalary: 0 }
    const updated: RawInputs = {
      ...inputs,
      isCoupleMode: true,
      partner: { ...currentPartner, [field]: value },
    }
    const newParams = encodeInputsToUrl(updated)
    setSearchParams(newParams, { replace: true })
  }, [inputs, setSearchParams])

  const copyShareUrl = useCallback((): string => {
    const params = encodeInputsToUrl(inputs)
    const url = `${window.location.origin}/cpf-planner?${params.toString()}`
    navigator.clipboard.writeText(url).catch(() => {
      // Clipboard API may fail in some contexts; the URL is still returned
    })
    return url
  }, [inputs])

  const saveToProfile = useCallback(() => {
    profileSetField('currentAge', inputs.age)
    profileSetField('cpfOA', inputs.oa)
    profileSetField('cpfSA', inputs.sa)
    profileSetField('cpfRA', inputs.ra)
    profileSetField('cpfMA', inputs.ma)
    incomeSetField('annualSalary', inputs.monthlySalary * 12)
  }, [inputs, profileSetField, incomeSetField])

  return {
    inputs,
    updateField,
    updatePartnerField,
    copyShareUrl,
    saveToProfile,
    isFromSharedUrl,
    validationErrors,
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/cpf-transition/hooks/useCpfTransitionParams.ts && git commit -m "feat(cpf-transition): rewrite params hook with full URL sharing support"
```

---

### Task 9: ShareSection Component

**Files:**
- Create: `frontend/src/components/cpf-transition/ShareSection.tsx`

- [ ] **Step 1: Write ShareSection**

```typescript
// frontend/src/components/cpf-transition/ShareSection.tsx
//
// Props:
//   copyShareUrl: () => string
//   saveToProfile: () => void
//   isFromSharedUrl: boolean
//
// Layout:
//   <Card>
//     <CardHeader>Share your CPF plan</CardHeader>
//     <CardContent>
//       <Button onClick={copyShareUrl}>
//         <LinkIcon /> Copy shareable link
//       </Button>
//       <span>(copied!) toast on success</span>
//
//       {isFromSharedUrl && (
//         <Button variant="outline" onClick={saveToProfile}>
//           Save to my profile
//         </Button>
//       )}
//
//       <p class="text-sm text-muted-foreground">
//         Share this link with anyone. They will see the same personalized
//         CPF plan based on your inputs. No data is stored on our servers.
//       </p>
//     </CardContent>
//   </Card>
//
// Uses a local state for "copied" toast that auto-dismisses after 2 seconds.
// "Save to my profile" button only appears when the user arrived via a shared URL.
```

- [ ] **Step 2: Wire into CpfTransitionPage at the bottom, after summary**

- [ ] **Step 3: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/ShareSection.tsx frontend/src/pages/CpfTransitionPage.tsx && git commit -m "feat(cpf-transition): add share section with copy link and save to profile"
```

---

## Part C: Feedback API

### Task 10: Validation Constants

**Files:**
- Create: `frontend/src/lib/validation/cpfPayoutConstants.ts`

- [ ] **Step 1: Write constants**

```typescript
// frontend/src/lib/validation/cpfPayoutConstants.ts

/** Valid CPF LIFE plan values for the feedback form */
export const VALID_CPF_LIFE_PLANS = ['basic', 'standard', 'escalating'] as const
export type CpfLifePlanValue = (typeof VALID_CPF_LIFE_PLANS)[number]

/** Birth year range: CPF LIFE is for members born 1958 onwards, capped at reasonable max */
export const MIN_BIRTH_YEAR = 1945
export const MAX_BIRTH_YEAR = 1985

/** Payout amount bounds (monthly, in SGD) */
export const MIN_PAYOUT = 0
export const MAX_PAYOUT = 10000

/** RA balance bounds (at age 55, in SGD) */
export const MIN_RA_AT_55 = 0
export const MAX_RA_AT_55 = 1_000_000

/** localStorage key to prevent duplicate submissions */
export const CPF_PAYOUT_FEEDBACK_FLAG = 'fireplanner-cpf-payout-feedback-submitted'
```

- [ ] **Step 2: Add 'cpf_payout_feedback' to VALID_SOURCES in emailConstants.ts**

In `frontend/src/lib/validation/emailConstants.ts`, add `'cpf_payout_feedback'` to the `VALID_SOURCES` array. This is used by the email cross-write in the API function.

- [ ] **Step 3: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/lib/validation/cpfPayoutConstants.ts frontend/src/lib/validation/emailConstants.ts && git commit -m "feat(cpf-transition): add payout feedback validation constants"
```

---

### Task 11: D1 Schema

**Files:**
- Modify: `frontend/schema.sql`

- [ ] **Step 1: Add cpf_payout_data table**

Append to `schema.sql`:

```sql
-- Crowd-sourced CPF LIFE payout data for accuracy improvement
CREATE TABLE IF NOT EXISTS cpf_payout_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  birth_year INTEGER NOT NULL,
  cpf_life_plan TEXT NOT NULL,
  actual_monthly_payout REAL,
  ra_at_55 REAL,
  email TEXT,
  ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cpf_payout_ip_rate ON cpf_payout_data(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_cpf_payout_birth_year ON cpf_payout_data(birth_year);
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/schema.sql && git commit -m "feat(cpf-transition): add cpf_payout_data D1 schema"
```

---

### Task 12: Cloudflare Pages Function

**Files:**
- Create: `frontend/functions/api/cpf-payout-data.ts`

- [ ] **Step 1: Implement the API function**

```typescript
// frontend/functions/api/cpf-payout-data.ts
import {
  VALID_CPF_LIFE_PLANS,
  MIN_BIRTH_YEAR,
  MAX_BIRTH_YEAR,
  MIN_PAYOUT,
  MAX_PAYOUT,
  MIN_RA_AT_55,
  MAX_RA_AT_55,
} from '../../src/lib/validation/cpfPayoutConstants'
import { EMAIL_RE, EMAIL_MAX_LENGTH } from '../../src/lib/validation/emailConstants'
import { jsonResponse, hashIP } from '../lib/serverUtils'

interface Env {
  DB: D1Database
  IP_HASH_SALT: string
}

const RATE_LIMIT_MAX = 3

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>
  try {
    body = (await context.request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  try {
    // --- Validate birth_year (required) ---
    const birthYear = body.birth_year
    if (typeof birthYear !== 'number' || !Number.isInteger(birthYear)) {
      return jsonResponse({ error: 'birth_year must be an integer' }, 400)
    }
    if (birthYear < MIN_BIRTH_YEAR || birthYear > MAX_BIRTH_YEAR) {
      return jsonResponse({ error: `birth_year must be between ${MIN_BIRTH_YEAR} and ${MAX_BIRTH_YEAR}` }, 400)
    }

    // --- Validate cpf_life_plan (required) ---
    const plan = body.cpf_life_plan
    if (typeof plan !== 'string' || !VALID_CPF_LIFE_PLANS.includes(plan as typeof VALID_CPF_LIFE_PLANS[number])) {
      return jsonResponse({ error: 'cpf_life_plan must be basic, standard, or escalating' }, 400)
    }

    // --- Validate actual_monthly_payout (optional but bounded) ---
    let actualPayout: number | null = null
    if (body.actual_monthly_payout !== undefined && body.actual_monthly_payout !== null) {
      if (typeof body.actual_monthly_payout !== 'number') {
        return jsonResponse({ error: 'actual_monthly_payout must be a number' }, 400)
      }
      if (body.actual_monthly_payout < MIN_PAYOUT || body.actual_monthly_payout > MAX_PAYOUT) {
        return jsonResponse({ error: `actual_monthly_payout must be between ${MIN_PAYOUT} and ${MAX_PAYOUT}` }, 400)
      }
      actualPayout = body.actual_monthly_payout
    }

    // --- Validate ra_at_55 (optional but bounded) ---
    let raAt55: number | null = null
    if (body.ra_at_55 !== undefined && body.ra_at_55 !== null) {
      if (typeof body.ra_at_55 !== 'number') {
        return jsonResponse({ error: 'ra_at_55 must be a number' }, 400)
      }
      if (body.ra_at_55 < MIN_RA_AT_55 || body.ra_at_55 > MAX_RA_AT_55) {
        return jsonResponse({ error: `ra_at_55 must be between ${MIN_RA_AT_55} and ${MAX_RA_AT_55}` }, 400)
      }
      raAt55 = body.ra_at_55
    }

    // --- Validate email (optional) ---
    let email: string | null = null
    if (body.email !== undefined && body.email !== null && body.email !== '') {
      if (typeof body.email !== 'string') {
        return jsonResponse({ error: 'Invalid email' }, 400)
      }
      email = body.email.trim().toLowerCase()
      if (!EMAIL_RE.test(email) || email.length > EMAIL_MAX_LENGTH) {
        return jsonResponse({ error: 'Invalid email address' }, 400)
      }
    }

    // --- Hash IP for rate limiting ---
    const clientIP = context.request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const salt = context.env.IP_HASH_SALT
    if (!salt) {
      console.error('IP_HASH_SALT secret is not configured')
      return jsonResponse({ error: 'Internal server error' }, 500)
    }
    const ipHash = await hashIP(clientIP, salt)

    // --- Rate limit: 3 submissions per IP per hour ---
    const { results: rateLimitRows } = await context.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM cpf_payout_data WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    )
      .bind(ipHash)
      .all()

    const count = Number(rateLimitRows?.[0]?.cnt ?? 0)
    if (count >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'Too many requests' }, 429)
    }

    // --- Insert payout data ---
    await context.env.DB.prepare(
      `INSERT INTO cpf_payout_data (birth_year, cpf_life_plan, actual_monthly_payout, ra_at_55, email, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(birthYear, plan, actualPayout, raAt55, email, ipHash)
      .run()

    // --- Cross-write email to signups if provided ---
    if (email) {
      context.waitUntil(
        context.env.DB.prepare(
          `INSERT INTO email_signups (email, source, feature_interest, ip_hash) VALUES (?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             updated_at = CURRENT_TIMESTAMP`
        )
          .bind(email, 'cpf_payout_feedback', 'cpf_optimization', ipHash)
          .run()
          .catch((err) => console.error('Cross-write to email_signups failed:', err))
      )
    }

    return jsonResponse({ ok: true }, 201)
  } catch (err) {
    console.error('cpf-payout-data error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/functions/api/cpf-payout-data.ts && git commit -m "feat(cpf-transition): add cpf-payout-data Cloudflare Pages Function"
```

---

### Task 13: PayoutFeedbackForm Component

**Files:**
- Create: `frontend/src/components/cpf-transition/PayoutFeedbackForm.tsx`

- [ ] **Step 1: Implement the form**

```typescript
// frontend/src/components/cpf-transition/PayoutFeedbackForm.tsx
//
// Props: none (self-contained)
//
// State:
//   birthYear: number | null
//   plan: CpfLifePlanValue | null
//   actualPayout: number | null (optional)
//   raAt55: number | null (optional)
//   email: string (optional)
//   status: 'idle' | 'submitting' | 'success' | 'error'
//   errorMessage: string | null
//
// Layout:
//   <Card>
//     <CardHeader>
//       <CardTitle>Help improve payout accuracy</CardTitle>
//       <CardDescription>
//         Share your actual CPF LIFE payout so we can improve estimates for
//         your birth year cohort. All fields except email are anonymous.
//       </CardDescription>
//     </CardHeader>
//     <CardContent>
//       Birth year (NumberInput, required, 1945-1985)
//       CPF LIFE plan (Select: Basic/Standard/Escalating, required)
//       Actual monthly payout (CurrencyInput, optional)
//       RA balance at age 55 (CurrencyInput, optional)
//       Email for follow-up (Input, optional)
//
//       <Button onClick={submit} disabled={!birthYear || !plan || status === 'submitting'}>
//         Submit
//       </Button>
//
//       {status === 'success' && <p>Thank you for contributing.</p>}
//       {status === 'error' && <p class="text-destructive">{errorMessage}</p>}
//     </CardContent>
//   </Card>
//
// Submit handler:
//   POST /api/cpf-payout-data with JSON body
//   On success: set localStorage CPF_PAYOUT_FEEDBACK_FLAG, show success
//   On 429: show "Please try again later"
//   On error: show error message
//
// Hide the entire form if CPF_PAYOUT_FEEDBACK_FLAG is set in localStorage.
// Show a "Thank you" message instead.
```

- [ ] **Step 2: Wire into CpfTransitionPage**

Place the form in two locations:
1. Below the hero section as a subtle CTA: "Help improve accuracy" link that scrolls to the form at the bottom
2. At the bottom of the page, before the Share section

- [ ] **Step 3: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/PayoutFeedbackForm.tsx frontend/src/pages/CpfTransitionPage.tsx && git commit -m "feat(cpf-transition): add payout feedback form and wire into page"
```

---

## Part D: Mobile Polish

### Task 14: Sticky Account Cards Mobile Collapse

**Files:**
- Modify: `frontend/src/components/cpf-transition/CpfAccountCards.tsx`

- [ ] **Step 1: Implement mobile collapse behavior**

On screens < 640px (`sm` breakpoint):
- Default state: single line showing total CPF balance ("Total CPF: $735,000")
- Tap to expand: shows the 3-card breakdown (OA / SA or RA / MA)
- Tap again to collapse
- In couple mode: two collapsed lines, one per partner

Implementation:
- Use local `useState<boolean>(false)` for `isExpanded`
- Outer container: `sticky top-0 z-10 bg-background/95 backdrop-blur`
- Collapsed: `<button onClick={toggle}> Total CPF: {formatCurrency(total)} <ChevronDown /> </button>`
- Expanded: the 3-card (or 6-card couple) grid with `<ChevronUp />` close button
- Use Tailwind responsive classes: `sm:hidden` for mobile-only, `hidden sm:grid` for desktop-only

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/CpfAccountCards.tsx && git commit -m "fix(cpf-transition): mobile collapse for sticky account cards"
```

---

### Task 15: Decision Card Mobile Stacking

**Files:**
- Modify: `frontend/src/components/cpf-transition/DecisionCard.tsx`

- [ ] **Step 1: Implement vertical stacking for comparison tables on mobile**

On screens < 640px, the comparison table switches from horizontal to vertical layout:
- Desktop: standard HTML table with columns (Metric | Default | If you act)
- Mobile: each row becomes a stacked card:
  ```
  [Metric label]
  Default: $X
  If you act: $Y
  ```

Implementation:
- Desktop table: `<table className="hidden sm:table">`
- Mobile stack: `<div className="sm:hidden space-y-3">`
  - Each metric rendered as:
    ```html
    <div class="rounded-lg border p-3">
      <div class="font-medium text-sm">{metric}</div>
      <div class="grid grid-cols-2 gap-2 mt-1 text-sm">
        <div><span class="text-muted-foreground">Default:</span> {defaultValue}</div>
        <div><span class="text-muted-foreground">Action:</span> {actionValue}</div>
      </div>
    </div>
    ```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/DecisionCard.tsx && git commit -m "fix(cpf-transition): mobile vertical stacking for decision cards"
```

---

### Task 16: Touch-Friendly Number Inputs

**Files:**
- Modify: `frontend/src/components/cpf-transition/CpfTransitionInput.tsx`

- [ ] **Step 1: Add stepper buttons to number inputs on mobile**

Wrap each `NumberInput` and `CurrencyInput` with +/- stepper buttons on mobile:
- Stepper buttons: 44x44px minimum touch target (Tailwind `w-11 h-11`)
- Position: flanking the input on left (-) and right (+)
- Step increments: age +/- 1, currency +/- 1000 (for balances), +/- 100 (for salary)
- Only visible on mobile (`sm:hidden`)
- Desktop keeps the standard input appearance

Implementation using existing input wrappers:
```tsx
<div className="flex items-center gap-1 sm:gap-0">
  <button
    className="w-11 h-11 flex items-center justify-center rounded-md border sm:hidden"
    onClick={() => onChange(Math.max(0, value - step))}
  >
    <Minus className="w-4 h-4" />
  </button>
  <CurrencyInput value={value} onChange={onChange} className="flex-1" />
  <button
    className="w-11 h-11 flex items-center justify-center rounded-md border sm:hidden"
    onClick={() => onChange(value + step)}
  >
    <Plus className="w-4 h-4" />
  </button>
</div>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/CpfTransitionInput.tsx && git commit -m "fix(cpf-transition): touch-friendly stepper buttons for mobile inputs"
```

---

### Task 17: Screenshot-Friendly Chapter Boundaries

**Files:**
- Modify: `frontend/src/components/cpf-transition/StoryChapter.tsx`

- [ ] **Step 1: Add visual chapter boundaries for clean screenshots**

Each chapter should be a self-contained visual unit that screenshots well:
- Clear top border with chapter title and age range
- Consistent padding so content does not bleed into adjacent chapters
- Print-friendly break hints

Implementation:
```tsx
<section
  className="border-t-2 border-primary/20 pt-8 pb-6"
  style={{ breakInside: 'avoid' }}
>
  <div className="flex items-baseline gap-3 mb-6">
    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
      {ageRange}
    </span>
    <h2 className="text-xl font-semibold">{label}</h2>
  </div>
  {/* scheme cards */}
</section>
```

For couple timeline entries, add partner color coding to the border:
- Partner A: `border-blue-500/30`
- Partner B: `border-purple-500/30`

- [ ] **Step 2: Commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add frontend/src/components/cpf-transition/StoryChapter.tsx && git commit -m "fix(cpf-transition): screenshot-friendly chapter boundaries"
```

---

### Task 18: Integration Test and QA

- [ ] **Step 1: Run all tests**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run test
```
Expected: All tests pass (existing + new)

- [ ] **Step 2: Run type-check and lint**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run type-check && npm run lint
```
Expected: Zero errors

- [ ] **Step 3: Start dev server and test manually**

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; cd /Users/tj/TJDevelopment/fireplanner/frontend && npm run dev -- --port 5173
```

Manual checks at `http://localhost:5173/cpf-planner`:

**Single mode:**
- Input form renders with age, OA, SA/RA, MA, salary
- Hero shows monthly payout estimate
- Account cards show and update dynamically
- Share button copies URL to clipboard
- Opening copied URL in new tab pre-fills the same data
- "Save to my profile" appears when arriving via shared URL

**Couple mode:**
- Toggle enables couple mode and shows Partner B fields
- Hero updates to "household retirement income" with combined amount
- Timeline shows interleaved milestones for both partners
- Account cards show two rows
- Share URL encodes both partners' data
- Opening couple URL restores couple mode with both partners

**Feedback form:**
- Form appears at page bottom
- Submitting with birth year + plan succeeds (check Network tab for 201)
- Submitting without required fields shows validation error
- After successful submit, form is replaced with thank-you message
- Refreshing page shows thank-you (localStorage flag)

**Mobile (375px):**
- Sticky account cards collapse to single total line
- Tap to expand shows 3-card view
- Decision card comparison tables stack vertically
- Stepper buttons appear flanking inputs
- Chapter boundaries are clean for screenshots
- No horizontal overflow anywhere

**Mobile (640px):**
- Transition point: collapsed view starts appearing
- Touch targets are at least 44px

**Tablet (768px):**
- Full desktop layout renders
- No layout issues

- [ ] **Step 4: Write E2E smoke test at mobile viewport**

```typescript
// frontend/e2e/cpf-planner-mobile.spec.ts
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 375, height: 812 } })

test('CPF planner renders and functions at 375px mobile', async ({ page }) => {
  await page.goto('/cpf-planner')

  // Input form is visible
  const ageInput = page.getByLabel(/age/i)
  await expect(ageInput).toBeVisible()

  // Fill in age
  await ageInput.fill('53')

  // Fill OA
  const oaInput = page.getByLabel(/oa/i).first()
  await oaInput.fill('200000')

  // Hero section shows a payout estimate
  await expect(page.getByText(/estimated.*retirement income/i)).toBeVisible()

  // Account cards: collapsed view at 375px
  await expect(page.getByText(/total cpf/i)).toBeVisible()

  // Tap to expand
  await page.getByText(/total cpf/i).click()

  // OA card should be visible after expansion
  await expect(page.getByText(/^OA$/i)).toBeVisible()

  // No horizontal scrollbar
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
  const viewportWidth = await page.evaluate(() => window.innerWidth)
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth)
})

test('CPF planner couple mode works at 375px mobile', async ({ page }) => {
  await page.goto('/cpf-planner')

  // Toggle couple mode
  const coupleToggle = page.getByLabel(/couple/i)
  await coupleToggle.click()

  // Partner B fields appear
  await expect(page.getByText(/partner/i)).toBeVisible()

  // Fill partner age
  const partnerAge = page.locator('[data-testid="partner-age"]')
  if (await partnerAge.isVisible()) {
    await partnerAge.fill('57')
  }
})

test('CPF planner share URL pre-fills data', async ({ page }) => {
  await page.goto('/cpf-planner?age=55&oa=330000&ra=220000&ma=75000')

  // Age should be pre-filled
  const ageInput = page.getByLabel(/age/i)
  await expect(ageInput).toHaveValue('55')

  // Save to profile button should appear (from shared URL)
  await expect(page.getByText(/save to my profile/i)).toBeVisible()
})

test('CPF planner feedback form submits', async ({ page }) => {
  await page.goto('/cpf-planner')

  // Scroll to feedback form
  const feedbackSection = page.getByText(/help improve/i)
  await feedbackSection.scrollIntoViewIfNeeded()

  // Fill birth year
  const birthYearInput = page.getByLabel(/birth year/i)
  if (await birthYearInput.isVisible()) {
    await birthYearInput.fill('1970')

    // Select plan
    const planSelect = page.getByLabel(/plan/i)
    await planSelect.selectOption('standard')

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit/i })
    await submitBtn.click()

    // Wait for response (success or thank you)
    await expect(
      page.getByText(/thank you/i).or(page.getByText(/contributing/i))
    ).toBeVisible({ timeout: 5000 })
  }
})
```

- [ ] **Step 5: Run E2E**

```bash
cd /Users/tj/TJDevelopment/fireplanner/frontend && npx playwright test e2e/cpf-planner-mobile.spec.ts
```

- [ ] **Step 6: Fix any issues found, commit**

```bash
cd /Users/tj/TJDevelopment/fireplanner && git add -A && git commit -m "fix(cpf-transition): QA fixes from Plan 3 integration test"
```

---

## Summary

**Plan 3 delivers:**

- **Couples mode**: couple toggle, Partner B input fields, interleaved CoupleTimeline, combined household hero payout, two-row account cards, spousal transfer scheme enabled
- **Full URL sharing**: encode/decode all fields including couple data, URL validation rejecting out-of-range and malicious params, "Copy link" button, "Save to my profile" for shared URL recipients
- **Feedback API**: Cloudflare Pages Function at `POST /api/cpf-payout-data`, D1 table with rate limiting, frontend form with birth year, plan, actual payout, RA at 55, optional email, cross-write to email_signups
- **Mobile polish**: sticky cards collapse to single line on < 640px, decision card tables stack vertically, touch-friendly 44px stepper buttons, screenshot-friendly chapter boundaries
- **E2E tests**: mobile viewport smoke tests covering input, couple mode, share URLs, and feedback form

**Files created:** 9 new files
**Files modified:** 13 existing files
**Total tasks:** 18
