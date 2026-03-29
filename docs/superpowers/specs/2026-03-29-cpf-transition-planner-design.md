# CPF Transition Planner: Design Specification

**Date:** 2026-03-29
**Status:** Draft
**Route:** `/cpf-planner`
**Research:** `docs/research/cpf-50-70-schemes-research.md`

---

## Product Concept

A zero-login, mobile-first, single-scroll CPF guide for Singaporeans aged 50-70. It visualizes CPF money flows, account transitions, and available actions across the pre-retirement journey.

**Core promise:** Enter your age and CPF balances, instantly see your estimated monthly retirement income and a personalized walkthrough of every CPF event, decision, and scheme that applies to your situation from now through age 70.

**Entry points:**
- Standalone at `/cpf-planner` with lightweight input form (no setup wizard required)
- If the user has an existing fireplanner profile, inputs pre-fill from profile/income stores
- Shareable via URL with encoded parameters (age, balances, options)

**Audience:**
- Reddit/forum users asking "what happens to my CPF at 55?"
- Adult children helping aging parents plan
- Financially literate planners optimizing CPF strategy
- Couples planning joint retirement

---

## Design Principles (from Expert Panel)

1. **Defaults must be visible.** Every decision point shows "What happens if you do nothing" first, clearly labeled, then alternatives.
2. **Visual uncertainty encoding.** Solid fills for known current values. Hatched/faded styling for projected future values. Universal, no exceptions.
3. **Symmetric framing.** Every trade-off shows both benefit AND cost in concrete terms. Never advocate for a specific choice.
4. **Goals -> Eligibility -> Decision proximity.** Navigate by goal ("Boost retirement income"). Filter by eligibility. Disclose detail as decision approaches in time.
5. **Curate before catalog.** Never show more than 3 options without highlighting 1-2 as "commonly chosen for your situation." Full list always one click away.
6. **Cite every number.** Inline source attribution to cpf.gov.sg. Acknowledge that rules can change.

---

## Page Structure (Single Scroll)

The entire experience is one vertical scroll. No tabs, no separate modes.

### Section 1: Quick Input

**Fields (individual mode):**
- Current age (number)
- OA balance (currency)
- SA balance (currency, hidden if age >= 55)
- RA balance (currency, shown if age >= 55)
- MA balance (currency)
- Monthly salary (currency, 0 if retired/not working)

**Fields (couple mode, toggle):**
- Partner A: age, OA, SA/RA, MA, salary
- Partner B: age, OA, SA/RA, MA, salary

**Additional inputs (progressive, asked within relevant chapters):**
- Property ownership (yes/no, HDB type, remaining lease) -- asked at age-55 chapter
- CPF LIFE plan preference -- asked at age-65 chapter
- Housing refund amount (VHR) -- asked at age 55-64 chapter
- SRS balance -- asked at age 62+ chapter
- Employment status details (for WIS eligibility) -- asked in contributions section
- Household income (for MRSS/Silver Support eligibility) -- asked when relevant

**Pre-fill logic:** If fireplanner profile store has data, pre-fill and show "Using your saved profile" with edit option.

**Dynamic account fields:** The input form shows SA field for users under 55, RA field for users 55+. This reflects the Jan 2025 SA closure policy.

### Section 2: Hero -- Monthly Payout Estimate

Immediately after input, show the headline number:

> **Your estimated monthly retirement income: ~$1,780**
> *Estimate based on current balances and FRS at your age-55 cohort year. Actual CPF LIFE payouts vary by birth year. [How is this calculated?]*

- Uses hatched/faded visual treatment (projected, not guaranteed)
- Below: "Help improve accuracy for your birth year" CTA linking to crowd-source feedback form
- For couples: "Your combined estimated household retirement income: ~$3,200/month"

**Calculation:** `estimateCpfLifePayout(retirementSumAt55, plan)` from existing `lib/calculations/cpf.ts`, using projected RA balance at 55 based on current balances + contributions + interest.

### Section 3: Sticky Account Cards

Persistent at top of viewport as user scrolls through story chapters.

**Before age 55:** Three cards -- OA, SA, MA
**At age 55 transition:** Animation showing SA closing, RA appearing
**After age 55:** Three cards -- OA, RA, MA

**Mobile:** Collapsed to single total balance line. Tap to expand into 3-card view.

**Styling:** Solid background for current/known balances. Hatched/pattern background when showing projected future values. Cards update live as user scrolls through age chapters.

### Section 4: Story Chapters

Each chapter covers an age range and contains:

1. **What happens automatically** -- events that require no action, labeled as such
2. **What you can do** -- optional decisions, each as a Decision Card (see pattern below)
3. **Inline visualizations** -- mini stacked bar showing account snapshot, or Sankey animation at major transitions

Chapters are age-gated to the user's current age. A 52-year-old lands on the "50-54" chapter. A 58-year-old lands on "55-64". Users can scroll forward/backward through all chapters.

**Chapter structure:**

#### Chapter: Ages 50-54 (Pre-Transition)

**Automatic:** Contribution rates (37% total, declining allocation to OA, increasing to SA/MA). Table showing employee/employer/total rates.

**Decisions:**
- SA top-up via RSTU (tax relief up to $8K self + $8K family). Comparison: top up vs don't.
- VHR -- refund housing OA usage back to SA before 55 (flows to higher-interest SA). Comparison: refund now vs at 55.
- "Preparing for 55" summary: what to do before the transition.

**Eligibility-gated:**
- WIS (if monthly income < $3,000): automatic CPF top-up, show expected amount.

#### Chapter: Age 55 Transition

**Inline Sankey Animation:** Shows SA -> RA transfer (up to FRS), excess SA -> OA, OA -> RA (if SA didn't fill FRS). Personalized with user's actual numbers. Dollar amounts on each flow band.

**Automatic:**
- RA creation. SA permanently closes. Show before/after account state.
- Retirement sum applied: BRS ($110,200) / FRS ($220,400) / ERS ($440,800) for 2026, with growth rate note.

**Decisions:**
- **BRS vs FRS vs ERS target:** Comparison table showing monthly payout at 65 for each tier.
- **Property pledge:** If property owner, option to pledge property and reduce locked RA from FRS to BRS. Comparison: pledge vs don't (withdrawable amount changes).
- **OA withdrawal:** Show withdrawable amount (OA above FRS). Comparison: withdraw vs leave at 2.5%. Include opportunity cost over 10 years.
- **OA to RA transfer:** Voluntary, irreversible. Comparison: keep in OA (2.5%, withdrawable) vs transfer to RA (4-6%, locked). Show monthly payout impact.
- **RSTU cash top-up to RA:** Tax relief up to ERS. Comparison: top up vs invest externally (need X% to match 4% guaranteed).

**Eligibility-gated:**
- MRSS matching (if RA < BRS, income < $4K): dollar-for-dollar match up to $2K/year, $20K lifetime. Show match amount.
- Spousal RA transfer (if couple, after BRS set aside): can transfer excess OA/RA to spouse's RA up to ERS.

#### Chapter: Ages 55-64 (Growth Phase)

**Automatic:**
- Contribution rates decline by age band (34% at 55-60, 25% at 60-65). Post-55 SA allocation goes to RA.
- Interest accumulation with tiered rates table (RA first $30K at 6%, next $30K at 5%, above at 4%; OA first $20K at 5.5%, above at 2.5%). Note: OA extra interest credited to RA, not OA.
- MA BHS overflow: contributions above BHS ($79,000 in 2026) flow to RA (up to retirement sum target), then OA.
- Healthcare deductions: MediShield Life and CareShield Life premiums from MA.

**Decisions:**
- **Ongoing OA to RA transfers:** Can set up automatic monthly transfers. Show impact on payout.
- **Ongoing RSTU top-ups:** Annual tax relief opportunity. Note: MRSS-matching top-ups no longer eligible for RSTU relief (from YA 2026).
- **VHR (housing refund):** Refund OA housing usage. Post-55: flows to RA first (up to FRS), excess to OA. Show interest gain.

**Eligibility-gated:**
- MRSS matching (ongoing, if still eligible)
- MMSS MediSave matching (ages 55-70, if MA < half BHS): up to $1K/year matching on MA top-ups
- WIS (if working, income < $3K)

**At age 62-64: SRS sidebar**
- SRS withdrawal window opens at statutory retirement age
- 50% tax concession. 10-year window.
- Strategy: ~$40K/year = $0 tax over 10 years.
- Show user's SRS balance and optimal withdrawal schedule if SRS balance provided.

#### Chapter: Age 65 Transition

**Inline Sankey Animation:** RA -> CPF LIFE premium conversion. Show premium deducted, bequest estimate, monthly payout.

**Automatic:**
- CPF LIFE enrollment (if RA >= $60K, born 1958+). Default: Standard Plan if no choice made.
- BHS freezes permanently at age-65 cohort value.

**Decisions:**
- **CPF LIFE plan selection:** Three-plan comparison table.

  |  | Standard | Escalating | Basic |
  |--|----------|------------|-------|
  | Monthly payout | $X (flat) | $Y (grows 2%/yr) | $Z (lower) |
  | At age 75 | $X | $Y' (higher) | $Z' (declining) |
  | At age 85 | $X | $Y'' (much higher) | $Z'' (lower) |
  | Bequest if pass at 75 | $A | $B | $C (highest) |

- **Deferral (65 to 70):** +7% per year. Comparison table showing payout at each start age (65, 66, 67, 68, 69, 70). Show cumulative income to age 85 for each option.
- **20% RA lump sum withdrawal:** Up to 20% of RA (inclusive of $5K at 55). Comparison: withdraw vs leave for higher payout.

**Eligibility-gated:**
- Lease Buyback Scheme (if HDB owner, 65+, income < $14K): proceeds flow to RA (single: FRS, joint: BRS each), cash up to $100K. LBS bonus up to $30K. Show full breakdown.
- Silver Support (if 65+, lower income, lower CPF history): quarterly cash payouts up to $1,080. Show estimated quarterly amount.
- GST Voucher MediSave: $150-$450 annually to MA.

#### Chapter: Ages 65-70 (Payout Phase)

**Automatic:**
- CPF LIFE monthly payouts (show monthly and annual)
- Contribution rates if still working (16.5% at 65-70, 12.5% above 70)
- Healthcare premium deductions continue from MA
- At 70: CPF LIFE auto-starts if not yet chosen (Standard Plan)

**Decisions:**
- Deferral continuation (if not yet started): show remaining deferral bonus
- SRS withdrawal strategy (if in 10-year window): optimal annual withdrawal amount

**View:**
- Year-by-year table showing: CPF LIFE payout, contributions (if working), MA deductions, net CPF flow, running account balances

#### Cross-Cutting (Shown Contextually)

These appear as expandable cards within relevant chapters, not as standalone sections:

- **Nomination/bequest:** Appears in age-65 chapter. CPF bypasses will. Reminder to nominate. Marriage revokes nomination.
- **Pioneer/Merdeka Generation:** If applicable (birth year), surface MediSave top-ups and premium subsidies in healthcare sections.
- **Interest rate details:** Expandable "How is interest calculated?" within any chapter showing interest growth.

### Section 5: Transition Animator (Inline Sankey)

Appears at two points in the story:

**Age 55 Transition:**
- Left side: SA box + OA box + MA box (with dollar amounts)
- Animated flows: SA -> RA (thick band, up to FRS), excess SA -> OA (thinner band), OA -> RA shortfall (if any)
- Right side: OA box + RA box + MA box (with new dollar amounts)
- Annotation: "Withdrawable: $X" and "Locked in RA: $Y"

**Age 65 Transition:**
- Left side: RA box (with balance)
- Animated flow: RA -> CPF LIFE (premium deducted)
- Right side: "Monthly payout: $X" + "Bequest value: $Y"

**Implementation:** Simple CSS/Framer Motion animation with SVG boxes and paths. Not a full d3-sankey. Personalized to user's actual numbers.

### Section 6: Summary + Share

At the bottom of the scroll:

- **Mini waterfall chart:** Stacked bar chart showing account balances at ages 50, 55, 60, 65, 70. Uses Recharts ComposedChart. Color-coded: OA (blue), SA/RA (purple/red), MA (green). Milestone markers.
- **Key numbers summary:** Monthly payout, total CPF at 70, total interest earned, actions taken.
- **Share:** Copy URL button (encodes all inputs). URL auto-fills the input form for the recipient.
- **Feedback form:** "Help us improve payout accuracy for your birth year" -- collects birth year, actual CPF LIFE payout (if receiving), plan type. Uses existing email signup API pattern.
- **CTA to full planner:** "Want a comprehensive retirement plan? Try the full FirePlanner" link.

---

## Decision Card Pattern

Every optional action follows this structure:

```
[ACTION TYPE badge: AUTOMATIC | OPTIONAL | REVIEW]
[Goal-oriented title]

[1-2 sentence plain English explanation]
[What happens if you do nothing -- the default]

COMPARE OUTCOMES:
| Metric        | Default    | If you act  |
|---------------|------------|-------------|
| Withdrawable  | $X         | $Y          |
| Monthly payout| ~$A        | ~$B         |
| Locked until  | age Z      | age Z       |

[Source: cpf.gov.sg | Estimate only disclaimer]
[Expandable: "How is this calculated?" with formula and cited rates]
```

Projected values use hatched/italic styling. Current values use solid styling.

---

## Couples Mode

When couple toggle is on:

**Input:** Both partners enter age + CPF balances + salary independently.

**Combined timeline:** The story interleaves both partners' milestones chronologically. If Partner A is 53 and Partner B is 57, the timeline shows:
1. Partner B's current post-55 state
2. Partner A's pre-55 chapter
3. Partner A's age-55 transition (2 years from now)
4. Both partners' 55-64 growth phase
5. Partner B's age-65 transition (in 8 years)
6. Partner A's age-65 transition (in 12 years)

**Couple-specific schemes:**
- Spousal RA transfer (after setting aside BRS, transfer excess to spouse's RA up to ERS)
- RSTU for spouse (additional $8K tax relief)
- Joint LBS (each owner tops up to BRS, not FRS)
- Combined nomination considerations

**Hero number:** "Your combined estimated household retirement income: ~$X/month"

**Account cards:** Two rows of 3-card sets (one per partner), or a combined view with partner toggle.

---

## Scheme Registry Architecture

All 15+ schemes are modeled as metadata + rules:

```typescript
interface SchemeDefinition<TParams = unknown> {
  id: string                               // e.g., 'age55-transition'
  title: string                            // Goal-oriented: "Your SA merges into RA"
  goalLabel: string                        // "Boost retirement income"
  chapter: ChapterAge                      // 'pre55' | 'at55' | 'post55' | 'at65' | 'post65'
  actionType: 'automatic' | 'optional' | 'review'
  eligibility: (ctx: PlannerContext) => boolean
  relevanceScore: (ctx: PlannerContext) => number  // 0-100, higher = show earlier
  compute: (ctx: PlannerContext, params: TParams) => SchemeResult
}

interface SchemeResult {
  headline: string                         // "Your SA $330K moves to RA"
  summary: string                          // Plain English explanation
  defaultOutcome: string                   // "If you do nothing: ..."
  metrics: ComparisonRow[]                 // For decision card table
  deltas: DeltaMetric[]                    // What changes
  citations: Citation[]                    // { label, url, asOfDate }
  confidence: 'known' | 'estimated'        // Drives solid vs hatched styling
  caveats: string[]                        // Warnings, edge cases
  whyShown?: string                        // "Shown because your RA is below BRS"
}

interface PlannerContext {
  profile: { age: number; birthYear: number; residency: ResidencyStatus }
  accounts: { oa: number; sa: number; ra: number; ma: number }
  income: { monthlySalary: number; annualBonus: number }
  property: { owns: boolean; hdbType?: string; remainingLease?: number; pledged: boolean }
  household: { isCoupleMode: boolean; partner?: PartnerProfile }
  policy: PolicyPack
}

interface PolicyPack {
  asOfDate: string                         // '2026-03-29'
  retirementSums: { brs: number; frs: number; ers: number; cohortYear: number }
  bhs: number
  cpfLifeRates: { basic: number; standard: number; escalating: number }
  interestRates: { oa: number; sa: number; ra: number; ma: number }
  owCeiling: number
  awCeiling: number
  contributionRates: CpfRateEntry[]
  citations: CitationRegistry
}
```

**Narrative orchestrator:** Evaluates all registered schemes against the PlannerContext. Filters by `eligibility()`. Sorts by chapter, then by `relevanceScore()`. Renders each as a Decision Card within the appropriate story chapter.

**Adding a new scheme:** Create one file in `lib/cpf-transition/schemes/`, register it. No page-level changes needed.

---

## Technical Architecture

### File Structure

```
lib/cpf-transition/
  policy/
    packs.ts                 # PolicyPack for current year, with asOfDate
    citations.ts             # Citation registry (URLs, labels, verification dates)
  domain/
    context.ts               # PlannerContext builder
    metrics.ts               # Metric definitions and comparison logic
    compare.ts               # Scenario diff engine
    confidence.ts            # Known vs estimated classification
  schemes/
    age55-transition.ts
    retirement-sum-target.ts
    oa-to-ra-transfer.ts
    rstu-topup.ts
    cpf-life-plan.ts
    cpf-life-deferral.ts
    post55-contributions.ts
    interest-growth.ts
    ma-bhs-overflow.ts
    vhr-housing-refund.ts
    lease-buyback.ts
    mrss-matching.ts
    mmss-medisave.ts
    srs-withdrawal.ts
    property-pledge.ts
    silver-support.ts
    wis-workfare.ts
    spousal-transfer.ts
    nomination.ts
    registry.ts              # All schemes registered here
  orchestration/
    eligibility.ts           # Filter schemes by context
    narrative.ts             # Order and group schemes into chapters
  hooks/
    useCpfTransition.ts      # Main hook: context + orchestration
    useCpfLifeEstimate.ts    # Hero payout number
  tests/
    *.test.ts

components/cpf-transition/
  CpfTransitionInput.tsx     # Quick input form
  CpfTransitionHero.tsx      # Monthly payout estimate
  CpfAccountCards.tsx        # Sticky dynamic account cards
  StoryChapter.tsx           # Chapter container
  DecisionCard.tsx           # Comparison table card
  TransitionAnimator.tsx     # Inline Sankey for age 55/65
  CpfMiniWaterfall.tsx       # Summary stacked bar chart
  ShareSection.tsx           # URL share + feedback form
  CoupleTimeline.tsx         # Interleaved couple timeline

pages/CpfTransitionPage.tsx  # Route component
```

### Key Implementation Details

**Reuses existing engine:** The scheme computation functions delegate to existing `lib/calculations/cpf.ts` functions (`performAge55Transfer`, `allocatePostAge55Contribution`, `capMaAtBhs`, `estimateCpfLifePayout`, `calculateBrsFrsErs`, etc.). No duplication.

**Data files:** Existing `lib/data/cpfRates.ts` provides rates, ceilings, and retirement sums. PolicyPack wraps these with `asOfDate` and citation metadata.

**State management:** Inputs stored in URL search params (for shareability) and parsed via a custom hook (`useCpfTransitionParams`). No new Zustand store. Derived hooks read from parsed URL params to compute scheme results. This follows the existing pattern of URL params for view state and derived hooks for computation.

**Rendering:** Plain React for the story flow. Recharts for the mini waterfall summary. Framer Motion for the transition animations. No d3 dependency needed.

**Performance:** All computation is synchronous and cheap (annual steps, ~20 years). No Web Worker needed. Use `React.memo` on chapter components and `useDeferredValue` on input changes to keep scroll smooth.

**Mobile:** Vertical scroll only. Sticky header collapses to single line on small screens. Decision card tables stack vertically below 640px. Touch-friendly steppers instead of drag sliders.

**Shareable URL:** Encode inputs as URL search params: `?age=55&oa=330000&ra=220000&ma=75000&salary=0&couple=0`. Recipient sees the same personalized view.

---

## Feedback / Crowd-Source Payout Data

At the bottom of the page and within the hero section:

**Form fields:**
- Birth year
- CPF LIFE plan (Standard/Basic/Escalating)
- Actual monthly payout amount (if receiving)
- RA balance at age 55 (if known)
- Optional email for follow-up

**Backend:** Reuses existing Cloudflare Pages Functions + D1 pattern (like `/api/email-signup`). New endpoint: `POST /api/cpf-payout-data`.

**Usage:** Over time, aggregated crowd-sourced data can improve payout estimates by birth year cohort. Privacy-first: no PII beyond optional email, stored in D1, not exposed publicly.

---

## Data Freshness

- PolicyPack includes `asOfDate` field
- Stale-data banner appears if `asOfDate` is more than 6 months old
- BRS/FRS/ERS values use existing `calculateBrsFrsErs()` with growth projection
- BHS uses existing `getBhsAtAge()` with growth projection
- Annual data maintenance follows existing `docs/maintenance-checklist.md` pattern
- All cited URLs verified at build time (or flagged for manual check)

---

## Scope: All Schemes Included

No phasing. All schemes ship together. Progressive disclosure via eligibility filtering ensures users only see what's relevant. The scheme registry architecture makes this manageable.

**Full scheme list (19 schemes):**

| # | Scheme | Chapter | Action Type |
|---|--------|---------|-------------|
| 1 | SA-to-RA transfer | at55 | automatic |
| 2 | Retirement sum target (BRS/FRS/ERS) | at55 | review |
| 3 | Property pledge | at55 | optional |
| 4 | OA withdrawal at 55 | at55 | optional |
| 5 | OA-to-RA voluntary transfer | at55/post55 | optional |
| 6 | RSTU cash top-up | pre55/at55/post55 | optional |
| 7 | Post-55 contribution routing | post55 | automatic |
| 8 | Interest growth (tiered rates) | post55 | automatic |
| 9 | MA BHS overflow | post55 | automatic |
| 10 | VHR (housing refund) | pre55/post55 | optional |
| 11 | MRSS matching | at55/post55 | optional |
| 12 | MMSS MediSave matching | post55 | optional |
| 13 | CPF LIFE plan selection | at65 | review |
| 14 | CPF LIFE deferral | at65/post65 | optional |
| 15 | 20% RA lump sum at 65 | at65 | optional |
| 16 | Lease Buyback Scheme | at65 | optional |
| 17 | Silver Support | at65 | automatic |
| 18 | SRS withdrawal | post55 | optional |
| 19 | Spousal RA transfer | at55/post55 | optional |
| -- | Nomination/bequest | at65 | review |
| -- | WIS/Workfare | pre55/post55 | automatic |
| -- | Pioneer/Merdeka generation | post55 | automatic |
| -- | Healthcare deductions | post55 | automatic |
| -- | GST Voucher MediSave | at65 | automatic |

---

## What This Is NOT

- Not a CPF calculator that replaces cpf.gov.sg -- it's a personalized guide
- Not financial advice -- it presents outcomes, never advocates
- Not a backend service -- all computation is client-side
- Not a data collection tool -- feedback form is voluntary, minimal fields
