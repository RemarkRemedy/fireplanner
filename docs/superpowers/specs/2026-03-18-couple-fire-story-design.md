# Couple FIRE Story Design Spec

**Date:** 2026-03-18
**Status:** Reviewed (3 reviewers: Claude, Codex, Gemini)
**Branch:** `feat/spotify-wrapped-projections` (worktree: `/Users/tj/TJDevelopment/fireplanner-wrapped`)

## Problem

The existing FIRE Story (Wrapped) experience is individual-only. All 8 cards use singular language ("Your net worth", "Your FIRE number") and derive data from single-person metrics. When a couple completes onboarding, they see the same individual story based on the primary user's data. The partner's financial picture is invisible.

## Design Goal

Create a joint couple FIRE Story that feels unified and "together" rather than two individual stories back-to-back. Key constraints:
- Avoid visual patterns that create implicit comparison or make one partner feel inferior.
- Use a horizontal stacked bar (not side-by-side bars) for per-person splits.
- "We/together" language throughout, except the milestone card which shows individual FIRE ages.

## Card Sequence (9 cards for couple, 8 for individual)

The couple story adds one card (Savings Power) and modifies all others to use household-level metrics with "we/together" language. Individual plans continue to use the existing 8-card flow unchanged.

### Card 1: Intro
- **Individual:** "Hey there" / "You're {age} years old."
- **Couple:** "Hey {name} & {partnerName}" / "You're {age} and {partnerAge}. Here's where you're headed as a team."
- Uses both names from the household plan's adult roster.

### Card 2: Household Net Worth
- **Individual:** Single total + breakdown bars (liquid/CPF/property).
- **Couple:** Combined household total as hero number. Below it, two per-person breakdown bars showing each person's contribution (indigo for self, pink for partner). Informational, not comparative.
- **Source:** Constructed per-adult: `adult.liquidNetWorth` + initial CPF balances from `cpfByAdultId` + property equity from `propertiesById` filtered by owner. The hero number is the SUM of the two per-person totals (not `dashMetrics.totalNetWorth`, which excludes property equity). This ensures the hero number always equals the sum of the per-person bars.

### Card 3: Household FIRE Number
- **Individual:** Single FIRE number + "work becomes optional" copy.
- **Couple:** Combined household FIRE number. Copy: "That's what financial freedom costs for both of you. When your combined net worth hits this, work becomes optional."
- **Source:** `dashMetrics.fireNumber` (household-level, already aggregated).

### Card 4: Savings Power (couple-only)
- **Not shown for individual plans.**
- Hero number: combined annual savings ($X/year).
- Horizontal stacked bar showing each person's contribution as segments of one bar. Names and amounts labeled inside or adjacent to segments. No height difference, no side-by-side comparison.
- Savings rate callout: "Together you're putting away {rate}% of your household income. That's the engine driving your FIRE timeline."
- **Source:** Current-year snapshot via `breakdownUtils.sumActiveIncomeByOwner(compiledPlan, owner)` minus `breakdownUtils.sumActiveExpensesByOwner(compiledPlan, owner)` for each adult. This is a point-in-time figure, not a projection-based savings rate. The household savings rate from `dashMetrics.savingsRate` is used for the percentage callout.

### Card 5: Joint Progress
- **Individual:** Single progress ring with percentage.
- **Couple:** Single progress ring showing combined progress (household NW / household FIRE number). Same tier messages, phrased jointly: "You're halfway to financial freedom together."
- **Source:** `dashMetrics.progress` (household-level).

### Card 6: Milestones
- **Individual:** Single FIRE age + years to FIRE.
- **Couple:** Side-by-side per-person FIRE ages (the one card where individual data is shown). Each person gets their name, FIRE age in large type, and years-to-FIRE below. A divider separates them. Joint summary line: "You could both be free in your late 40s." or "{Name} reaches FIRE first at {age}. {Partner} follows at {age}."
- **Source:** Per-adult FIRE ages computed via `buildSplitAdultPlanSlice` (see Data Architecture below).

### Card 7: Household Trajectory
- **Individual:** Area chart with FIRE reference line.
- **Couple:** Single combined household portfolio area chart. FIRE reference line uses the later of the two per-adult FIRE ages (the point when BOTH are free). Label: "Both free" if both ages available, "Retire" as fallback.
- **Source:** `accumulationData` from `useDashboardCharts` (household-level approximation, not compiled cashflow). Note: this is a simplified synthetic curve, adequate for the story format.

### Card 8: Peak Household Wealth
- **Individual:** Peak value + age.
- **Couple:** Combined peak household wealth. Age shown relative to both adults: "at age {selfAge} / {partnerAge}" using the age delta between adults (partner age = peak age - (selfAge - partnerAge)).
- Same mountain summit SVG animation.

### Card 9: Summary
- **Individual:** 6-stat grid + CTAs.
- **Couple:** 6-stat grid with household variants:
  - "Household NW" (combined)
  - "FIRE Number" (household)
  - "Combined Savings" ($X/yr)
  - "Both free by" (the later of the two FIRE ages)
  - "Peak NW" (household)
  - "Savings Rate" (household)
- Same two CTAs: "Refine your plan" and "View full projection".

## Data Architecture

### Detection
`useWrappedData` detects couple mode via Zustand selector: `useHouseholdPlanStore((s) => s.plan.adults)`. Look up by semantic role, not array index:
```
const selfAdult = adults.find(a => a.owner === 'self')
const partnerAdult = adults.find(a => a.owner === 'partner')
const isCoupleMode = partnerAdult != null && partnerAdult.currentAge > 0
```
Do NOT use `adults[0]`/`adults[1]` — the array has no guaranteed ordering. Always use `owner` field for lookup (consistent with the rest of the codebase: `breakdownUtils`, `useIncomeProjection`, etc.).

### Per-Adult Net Worth (constructed, not a pre-existing field)
For each adult, sum:
1. `adult.liquidNetWorth` (from `PlanningAdult`)
2. Initial CPF (null-guard for foreigners/CPF-disabled): `cpfByAdultId[adultId]?.rows[0]?.oaBalance ?? 0` + same for SA/MA/RA. Note: `cpfByAdultId` is keyed by `adult.id` (UUID), not `adult.owner` string.
3. Property equity (no pre-computed field, must compute): `Math.max(0, property.existingPropertyValue - property.existingMortgageBalance) * (property.ownershipPercent ?? 1)` for each property in `compiledPlan.propertiesById` where `owner` matches the adult. Reference: `useWhatIfMetrics.ts:84-88` for the canonical pattern.
3. Property equity: filter `compiledPlan.propertiesById` by `owner` matching the adult, sum equity values

This requires access to the compiled plan. `useWrappedData` will call `useNormalizedLegacyAnalysisContext()` to get `compiledPlan`. Note: this hook has a side effect (sets active cache key in the analysis store). Safe because `/wrapped` is a full-page route, not an overlay. Add a code comment explaining this.

**CPF null guard:** `cpfByAdultId[adultId]` is keyed by UUID (not owner string) and may be undefined for CPF-disabled adults or foreigners. Always null-guard before accessing `.rows[0]`.

**Allocation dependency:** `useWrappedData` must also read from `useAllocationStore` (via selector) because per-adult FIRE ages depend on portfolio allocation. Include in `useMemo` dependency array.

### Per-Adult Savings (current-year snapshot)
For each adult, compute three categories each for both income AND expenses:
```
// Income (including shared income split 50/50)
selfIncome = sumActiveIncomeByOwner(compiledPlan, 'self')
partnerIncome = sumActiveIncomeByOwner(compiledPlan, 'partner')
sharedIncome = sumActiveIncomeByOwner(compiledPlan, 'shared')

selfTotalIncome = selfIncome + sharedIncome * 0.5
partnerTotalIncome = partnerIncome + sharedIncome * 0.5

// Expenses (including shared expenses split 50/50)
selfExpenses = sumActiveExpensesByOwner(compiledPlan, 'self')
partnerExpenses = sumActiveExpensesByOwner(compiledPlan, 'partner')
sharedExpenses = sumActiveExpensesByOwner(compiledPlan, 'shared')

selfTotalExpenses = selfExpenses + sharedExpenses * 0.5
partnerTotalExpenses = partnerExpenses + sharedExpenses * 0.5

// Savings
selfSavings = selfTotalIncome - selfTotalExpenses
partnerSavings = partnerTotalIncome - partnerTotalExpenses
```

Note: Both `sumActiveIncomeByOwner` and `sumActiveExpensesByOwner` filter by exact owner match. Shared entries (owner: 'shared') must be fetched separately and split manually. This is a point-in-time snapshot, not a projection.

### Per-Adult FIRE Ages (via `buildSplitAdultPlanSlice`)
`buildSplitAdultPlanSlice` already exists in `lib/household/planSlice.ts:203` (exported, no extraction needed). It returns `PlanSliceResult | null` with `{ slice: HouseholdPlan, adultAges: AdultAges }`.

**Important:** The slice output cannot be fed directly to `calculateAllFireMetrics` (which takes flat scalar params). It must go through the full adapter pipeline, matching the pattern used in `ProjectionPage.tsx:276-300`:

Create a pure function `computePerAdultFireAge` in `lib/household/` (not inline in the hook):
```
function computePerAdultFireAge(
  plan: HouseholdPlan,
  adultId: string,
  allocation: AllocationState
): number | null {
  const sliceResult = buildSplitAdultPlanSlice(plan, adultId, 0.5)
  if (!sliceResult) return null
  const { slice, adultAges } = sliceResult
  const runtime = buildHouseholdRuntimeLegacyInputs(slice)
  const { profile, income, property } = runtime
  const inputs = getBaseInputs(profile, income, allocation, property, adultAges)
  const { fireMetrics } = computeMetricSnapshot(inputs)
  return fireMetrics.fireAge ?? null
}
```

The 50/50 split is an approximation. When per-adult expense attribution ships (noted as a remaining gap in CLAUDE.md), the split can use actual attribution instead.

Inside `useWrappedData`, call this pure function for each adult in couple mode. Cache via `useMemo` with `compiledPlan` AND `allocation` as dependencies (allocation affects per-adult FIRE ages via portfolio returns).

### Data Sources Summary (couple mode)
| Metric | Source | Status |
|--------|--------|--------|
| Both names + ages | `adults.find(a => a.owner === 'self'\|'partner')` via selector | Ready |
| Per-person net worth | Constructed: liquid + CPF + property by owner | Needs implementation |
| Household net worth | `dashMetrics.totalNetWorth` | Ready (aggregated) |
| Household FIRE number | `dashMetrics.fireNumber` | Ready (aggregated) |
| Per-person savings | `breakdownUtils` current-year snapshot | Needs implementation |
| Household savings rate | `dashMetrics.savingsRate` | Ready |
| Per-person FIRE age | `buildSplitAdultPlanSlice` + `calculateAllFireMetrics` | Needs extraction + wiring |
| Household progress | `dashMetrics.progress` | Ready |
| Household trajectory | `accumulationData` from `useDashboardCharts` | Ready (approximation) |
| Household peak | Scan `accumulationData` | Ready |

### Known data limitations
1. **Dashboard metrics for couples may undercount partner healthcare costs** in the FIRE number/progress calculation. This is a pre-existing issue in `useFireCalculations`, not caused by this feature. The story uses whatever the dashboard provides.
2. **Trajectory chart is a simplified synthetic curve**, not compiled household cashflow. Adequate for the story format.
3. **Per-adult FIRE ages use 50/50 shared expense split.** This will be upgraded when per-adult expense attribution ships.
4. **Multiple properties may break per-adult FIRE age.** `toLegacyIndividual` returns null when `plan.properties.length > 1`. If the sliced plan inherits multiple properties, the legacy pipeline will fail. Fallback: if `computePerAdultFireAge` returns null, the milestone card shows the household-level `dashMetrics.fireAge` for both adults (degraded but safe).
5. **Per-adult net worth mixes authored values with compiled values.** `adult.liquidNetWorth` is raw state while CPF `rows[0]` is after year-0 contributions. Acceptable for story-level accuracy but not exact.
6. **Peak card "partner has passed" edge case.** Detecting if a partner is alive at peak wealth age requires comparing peak year against `adult.lifeExpectancy`. If peak occurs after a partner's life expectancy, show only the living partner's age.
7. **Dependents dropped in per-adult FIRE age slices.** `buildSplitAdultPlanSlice` returns `dependents: []` in the sliced plan. Per-adult FIRE ages will be slightly optimistic for families with dependent-related costs. Acceptable for the story format; the household-level FIRE number (from `dashMetrics`) correctly includes dependents.

## Component Architecture

### Approach: Separate couple card components (not conditional branching)
Rather than adding `if (mode === 'couple')` branches to every existing card, create dedicated couple card components: `CoupleIntroCard`, `CoupleNetWorthCard`, `CoupleSavingsPowerCard`, etc. This keeps the individual story completely untouched (zero regression risk) and avoids polluting clean single-purpose components with dual-mode logic.

`WrappedPage.tsx` selects which set of `cardRenderers` to use based on `mode`. The `WrappedStoryContainer` remains unchanged — it just receives a different renderer list.

### New types added to `WrappedData`
```typescript
interface WrappedData {
  // ... existing fields unchanged for individual mode ...
  mode: 'individual' | 'couple'
  couple?: {
    names: [string, string]
    ages: [number, number]
    perPersonNW: [number, number]
    perPersonSavings: [number, number]
    perPersonFireAge: [number | null, number | null]
    combinedSavings: number
    ageDelta: number  // selfAge - partnerAge, for peak card age conversion
  }
}
```

Field named `couple` (not `household`) to avoid collision with the `'household'` string literal used in `breakdownUtils`.

### `buildCardSequence` changes
- Add `savingsPower` key and gradient to `WRAPPED_GRADIENTS`
- `buildCardSequence(mode: 'individual' | 'couple')` returns 8 cards for individual (excluding savingsPower), 9 for couple (including savingsPower)
- Update existing test to handle the mode parameter

### Card rendering changes
- `WrappedPage.tsx`: `cardRenderers` becomes a function of `mode` (computed inside the component, not a module-level constant). Includes `SavingsPowerCard` renderer only when `mode === 'couple'`.
- Each existing card component receives the `couple` prop and conditionally renders the couple variant when present.
- New component: `SavingsPowerCard.tsx` in `components/wrapped/cards/`.

## Color Coding
- Person 1 (self): `#818cf8` (indigo-400)
- Person 2 (partner): `#f0abfc` (fuchsia-300)
- Used consistently on Card 2 (NW bars), Card 4 (savings bar), and Card 6 (milestone names).

## Copy Guidelines
- Use "together", "as a team", "both of you", "household" instead of "your".
- Never compare partners explicitly ("TJ saves more than Sarah").
- The milestone card is the only place individual data appears, framed as a timeline ("TJ reaches FIRE first. Sarah follows."), not a comparison.
- No em dashes in any user-facing copy.

## Edge Cases
- **One partner has zero income:** Savings power bar shows the earning partner as 100% of the bar. Copy: "Together you're putting away {rate}%..." still works.
- **FIRE ages diverge by 20+ years:** Milestone card shows both ages. Summary "Both free by" uses the later age. Copy adapts: "{Name} could be free at {age}. {Partner} follows at {age}."
- **One partner never reaches FIRE:** Their FIRE age is null. Milestone shows "{Name} reaches FIRE at {age}" for the one who does, and "Keep building" for the other. Summary "Both free by" becomes the single achievable FIRE age with a note.
- **Partner stub with no data:** Detection requires `adults[1].currentAge > 0`, preventing empty partner from triggering couple mode.
- **Peak age conversion for partner:** Peak age from `accumulationData` is anchored to self's current age. Partner's age at peak = peakAge - ageDelta.
- **One partner has passed (in projection):** If household rows show a null age for one adult at peak time, show only the living partner's age.

## Out of Scope
- Survivor spending model. Separate feature per CLAUDE.md.
- Proper per-adult expense attribution (currently 50/50 for shared). Will upgrade when available.
- Dependent-specific cards. Dependents affect the FIRE number but don't get their own story card.
- Fixing the pre-existing healthcare gap in `useFireCalculations` for couples. The story uses whatever the dashboard provides.
