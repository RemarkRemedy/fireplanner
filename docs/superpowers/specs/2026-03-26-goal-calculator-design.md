# Goal Calculator Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Route:** `/goal-calculator`

## Problem

Fresh university graduates find the full FIRE planner intimidating. They don't think in terms of retirement age or withdrawal strategies. They think in terms of goals: "Can I afford a condo by 35?" The current onboarding flow (setup wizard) asks for comprehensive financial details before showing any value.

## Solution

A standalone goal-first calculator at `/goal-calculator` that flips the flow: pick a goal first, enter minimal financial basics second, get an actionable savings plan immediately. Up to 3 goals, with optional transfer into the full planner.

## Target Audience

Young Singaporean professionals (22-30), primarily fresh graduates entering the workforce. They know their salary, have vague spending habits, and want to know if their life goals are achievable.

## User Flow

### Step 1: Goal Selection (Landing)

The landing page IS the goal picker. Headline: "What's your next big goal?"

Visual grid of goal tiles with icons:

| Goal | Icon idea | Type |
|------|-----------|------|
| HDB flat | Building | Smart |
| Condo | City skyline | Smart |
| Landed property | House | Smart |
| Car | Car | Smart |
| Wedding | Rings | Simple |
| Travel / Sabbatical | Plane | Simple |
| Education | Graduation cap | Simple |
| Starting a Business | Rocket | Simple |
| Something Else | Plus | Simple |

Goal tile categories map to existing `GoalCategory` type: HDB/Condo/Landed all map to `'housing'`, Car maps to `'vehicle'`, Starting a Business and Something Else both map to `'other'`. The tile is a UI affordance; the stored category uses the existing enum.

User taps one tile to proceed.

### Step 2: Goal Configuration

**Smart goals (property, car)** show goal-specific sub-questions that auto-compute realistic costs:

**HDB:**
- Flat type: 3-room / 4-room / 5-room / Executive
- New (BTO) vs Resale. For BTO, show a note: "BTO flats typically have a 3-5 year wait. Plan your target age accordingly."
- Auto-computes: price range midpoint, down payment (HDB loan: 10% CPF; bank loan: 25% with 5% cash minimum; rules defined in `goal-defaults.ts` per HDB guidelines since `lib/calculations/hdb.ts` only covers CPF refund/subletting), BSD, legal fees (~$3K), renovation budget estimate (~$30-50K depending on flat type)

**Condo:**
- Price bracket: ~$1M / ~$1.5M / ~$2M+
- New launch vs Resale
- Auto-computes: 25% down payment (5% cash minimum + 20% CPF/cash), BSD, ABSD (0% for first-time Singaporean buyer), legal fees (~$5K), renovation estimate

**Landed:**
- Price bracket: ~$3M / ~$5M / ~$8M+
- Auto-computes: same structure as condo but with higher brackets

**Car:**
- COE category: Cat A (up to 1600cc) / Cat B (above 1600cc)
- New vs Used
- Price range selector
- Auto-computes: purchase cost breakdown (COE + estimated OMV + ARF). OMV is not a user input; `goal-defaults.ts` provides a price-range-to-OMV lookup (e.g., "$30-50K car" maps to estimated OMV ~$20K). Running costs (insurance, road tax, fuel) are out of scope for V1; show purchase cost only, same pattern as property down payment

**Simple goals (everything else):**
- Amount (in today's dollars)
- Target age ("By when?")
- For "Something Else": also a custom label field (free text, e.g. "Engagement ring")

### Step 3: Your Basics

Single form, 4 fields. Framed as: "To calculate your plan, we need a few details."

- **Age** (number input)
- **Monthly take-home pay** (currency input, labeled "Monthly take-home pay (after CPF)" so user enters net income, not gross. This avoids overstating savings capacity by ~20% for SG employees without requiring CPF engine integration.)
- **Monthly expenses** (currency input)
- **Existing savings** (currency input, liquid savings + investments)

**Validation rules:** Age: 18-70, required. Monthly income: > 0, required. Monthly expenses: >= 0, must be < monthly income (otherwise no savings capacity). Existing savings: >= 0. Target age (in goal config): must be > current age. Use inline error display matching the shared `CurrencyInput`/`NumberInput` error convention. Calculate button is disabled until all fields pass validation.

### Step 4: Results

The headline answer: **"Save $X/month to reach your goal by age Y."**

Supporting details:
- Visual bar: current monthly savings vs required monthly savings
- Feasibility indicator: green (comfortable), amber (tight), red (not feasible at current income/expenses)
- Cost breakdown for smart goals (e.g., "Down payment: $125K, BSD: $24.6K, Legal: $5K, Reno: $40K = Total: $194.6K")
- If not feasible: "You'd need to save $X more per month, or push the timeline to age Z"
- Subtle retirement callout at the bottom: "This goal would shift your estimated retirement age by ~N years" (small text, not a headline). If annual savings with goals is <= 0, show "Your savings are fully committed to goals" instead of a year count.

**Error states:** If calculation produces degenerate results (e.g., time horizon <= 0, division by zero), show an inline error message rather than NaN. Calculation functions must guard against these and return an error result object.

### Step 5: Add Another Goal (Optional)

"Want to plan for something else too?" button. Returns to the goal picker (Step 1). Basics are remembered and can be re-edited via an "Edit basics" link on the results screen (navigates back to step 3, recalculates on return). A "Start over" button resets all state. Up to 3 goals total.

When multiple goals exist, the results view shows:
- Each goal's individual savings requirement
- Combined monthly savings needed
- Whether the combination is feasible together
- Priority suggestion if not all are feasible: goals are sorted by target age (earliest first); cumulative monthly savings are added sequentially; the first goal whose addition makes the total exceed available savings is flagged as the infeasible one. E.g., "You could afford Goals 1 and 2, but adding Goal 3 would require $X more/month"

Note: Steps 5 and 6 are in-results CTAs, not separate route states. The state machine has 4 states (`pick | config | basics | results`). Step 5 resets `step` to `'pick'` while preserving `basics` and existing `goals[]`.

### Step 6: Continue to Full Planner (Optional)

CTA: "Want the full picture? Continue to the planner."

Transfers all data into the planner stores and redirects to `/inputs` (the full inputs page) with a confirmation toast. Do not redirect to `/setup` since the setup wizard may not have skip-already-filled-fields logic.

## Data Model

### Goal Calculator State (component-local, not Zustand)

```typescript
interface GoalCalcState {
  step: 'pick' | 'config' | 'basics' | 'results'
  goals: GoalCalcGoal[]          // up to 3
  activeGoalIndex: number
  basics: GoalCalcBasics | null
}

interface GoalCalcBasics {
  age: number
  monthlyIncome: number
  monthlyExpenses: number
  existingSavings: number
}

interface GoalCalcGoal {
  id: string
  category: GoalCategory         // reuse existing GoalCategory type
  label: string
  targetAge: number
  smartInputs?: SmartGoalInputs  // for property/car
  totalCostToday: number         // the computed number
  breakdown: CostBreakdown       // itemized costs
  monthlySavingsNeeded: number   // the headline answer
  feasible: boolean
  shortfallPerMonth: number      // 0 if feasible
}

interface CostBreakdown {
  items: { label: string; amount: number }[]
  total: number
}

// Smart goal input variants
type SmartGoalInputs =
  | { type: 'hdb'; flatType: HdbFlatType; newOrResale: 'new' | 'resale' }
  | { type: 'condo'; priceBracket: number; newOrResale: 'new' | 'resale' }
  | { type: 'landed'; priceBracket: number }
  | { type: 'car'; coeCategory: 'A' | 'B'; newOrUsed: 'new' | 'used'; priceRange: number }

type HdbFlatType = '3-room' | '4-room' | '5-room' | 'executive'
```

### State lives locally until transfer

The goal calculator uses `useReducer` for its multi-step state. No Zustand store. This keeps the calculator standalone and avoids polluting planner stores for casual visitors.

On "Continue to full planner," state is mapped to existing stores (see Transfer section).

## Calculations

All in real (today's dollar) terms. Consistent with the main planner's steady-state metric context.

### Core math

1. **Available monthly savings** = monthlyTakeHomePay - monthlyExpenses
2. **Time horizon** = (targetAge - age) in months
3. **Future value of existing savings** = existingSavings * (1 + r)^years, where r = 0.036 (conservative 3.6% real return)
4. **Gap** = totalCostToday - futureValueOfSavings (floored at 0)
5. **Monthly savings needed** = PMT formula to accumulate the gap over the time horizon at 3.6% real return
6. **Feasible** = monthlySavingsNeeded <= availableMonthlySavings
7. **Shortfall** = max(0, monthlySavingsNeeded - availableMonthlySavings)

### Multi-goal stacking

When multiple goals exist, savings capacity is allocated sequentially by target age (earliest first). Each subsequent goal's available savings is reduced by prior goals' requirements.

### Retirement impact estimate

Simplified FIRE calculation:
- Annual expenses = monthlyExpenses * 12
- Required nest egg = annualExpenses * 28 (3.6% SWR rule)
- Annual savings without goals = (monthlyIncome - monthlyExpenses) * 12
- Annual savings with goals = annual savings - (sum of all goals' monthlySavingsNeeded * 12)
- Adjusted portfolio base = existingSavings - (sum of existing savings allocated toward goals). This prevents double-counting savings that are earmarked for goals.
- Years to FIRE without goals = `calculateYearsToFire(0.036, annualSavingsWithoutGoals, existingSavings, requiredNestEgg)` from `lib/calculations/fire.ts`
- Years to FIRE with goals = `calculateYearsToFire(0.036, annualSavingsWithGoals, adjustedPortfolioBase, requiredNestEgg)` from `lib/calculations/fire.ts`
- Impact = difference in years

This is intentionally simplified and does NOT use the full planner's FIRE calculation engine (which accounts for CPF, Monte Carlo, withdrawal strategies, etc.). The goal calculator uses back-of-envelope math only. Accuracy is not the goal here; the "aha moment" nudge toward the full planner is.

## Smart Goal Data

### New file: `lib/data/goal-defaults.ts`

Contains price ranges, cost estimates, and computation helpers for smart goals.

**HDB price ranges** (median prices by flat type, updated periodically):

| Flat type | BTO range | Resale range |
|-----------|-----------|-------------|
| 3-room | $200-350K | $300-450K |
| 4-room | $300-500K | $400-600K |
| 5-room | $400-600K | $500-750K |
| Executive | $500-700K | $600-850K |

Uses midpoint of range for calculations.

**Condo brackets:** $1M, $1.5M, $2M as selector options.

**Landed brackets:** $3M, $5M, $8M as selector options.

**Car estimates:**
- COE Cat A: ~$90K estimate (volatile, noted as approximate with vintage date)
- COE Cat B: ~$110K estimate
- New car base prices by segment (OMV ranges)
- ARF calculation (100% of first $20K OMV, 140% of next $30K, 180% above $50K). Note: ARF OMV bracket thresholds are statutory nominal figures; do not inflation-adjust them.

**BSD rates:** Reuse existing `lib/data/stampDutyRates.ts` (exports `BSD_BRACKETS`; calculation via `lib/calculations/property.ts`).

**Renovation estimates:** Structured constants by property type in `goal-defaults.ts`, tagged with `GOAL_DATA_VINTAGE` like all other data. Source: HDB renovation guides, industry averages.

**COE estimates:** Static estimates tagged with `GOAL_DATA_VINTAGE`. Must be noted in the UI as "estimate as of [date]" since COE premiums fluctuate monthly.

All data in `goal-defaults.ts` tagged with `GOAL_DATA_VINTAGE` date for maintenance tracking.

## Transfer to Full Planner

### Mapping

| Goal calc field | Target | Store |
|----------------|--------|-------|
| basics.age | `currentAge` | `useProfileStore` |
| basics.monthlyTakeHomePay * 12 | `annualIncome` | `useProfileStore` (note: this is take-home, not gross. The full planner's income section expects gross salary with CPF computed automatically. The user will need to adjust this when they fill in the Income tab.) |
| basics.monthlyExpenses * 12 | `annualExpenses` | `useProfileStore` |
| basics.existingSavings | `liquidNetWorth` | `useProfileStore` |
| Each goal | `financialGoals[]` entry | `useProfileStore` |

### Property pre-population

If any goal is HDB/condo/landed, also pre-populate:
- Property type in property store
- Estimated property value
- Loan amount (property value - down payment)

### Transfer UX

1. User clicks "Continue to full planner"
2. Confirmation: "This will set up your planner profile with the details you entered. You can always change them later."
3. Write to stores (only the 4 mapped fields + goals; all other store fields remain at their Zustand defaults, no zeroing or resetting of existing planner data). Note: `useIncomeStore` is NOT seeded; the user will see income details at defaults on the Income tab and is expected to fill them in. This is an acceptable limitation for V1.
4. Redirect to `/inputs`
5. Toast: "Profile pre-filled from goal calculator"

## Technical Architecture

### Files to create

| File | Purpose |
|------|---------|
| `pages/GoalCalculatorPage.tsx` | Page component, orchestrates multi-step flow |
| `components/goal-calculator/GoalPicker.tsx` | Goal tile grid |
| `components/goal-calculator/GoalConfig.tsx` | Smart + simple goal configuration |
| `components/goal-calculator/BasicsForm.tsx` | 4-field basics input |
| `components/goal-calculator/Results.tsx` | Results display with breakdown |
| `components/goal-calculator/MultiGoalResults.tsx` | Stacked results for 2-3 goals |
| `lib/calculations/goal-calculator.ts` | Pure calculation functions |
| `lib/data/goal-defaults.ts` | Price ranges, cost estimates, data vintage |

### Files to modify

| File | Change |
|------|--------|
| `router.tsx` | Add `/goal-calculator` route, lazy-loaded |

### Architectural decisions

- **No new Zustand store.** Local `useReducer` state until explicit transfer.
- **No web worker.** Simple arithmetic, main thread is fine.
- **Outside PlannerRouteShell.** Standalone page with its own minimal header (logo + "Full Planner" link). No sidebar, no planner navigation.
- **Lazy-loaded.** The goal calculator bundle doesn't inflate the main planner's initial load.
- **Reuses existing UI components.** CurrencyInput, NumberInput from `components/shared/`. Card/CardContent for layout.
- **SEO-friendly.** Own `<title>`, meta description. Designed as a standalone entry point that can be linked/shared.

## Testing

- `lib/calculations/goal-calculator.test.ts` must maintain >= 95% coverage (per CLAUDE.md `lib/calculations/` rule)
- `lib/data/goal-defaults.test.ts` must maintain >= 90% coverage (per CLAUDE.md `lib/data/` convention)
- Test cases must cover: smart goal cost computation (HDB, condo, car), PMT savings calculation, multi-goal stacking allocation, retirement impact estimate, edge cases (zero savings, targetAge == currentAge + 1, expenses == income)
- Property-based tests via `fast-check` for the PMT formula (savings + growth should reach goal amount)

## Out of Scope

- CPF integration in the calculator (full planner handles this)
- Mortgage amortization schedules (full planner property section)
- Multiple adults / couple mode (full planner household feature)
- Saving calculator state to localStorage (it's ephemeral until transferred)
- ABSD for second property / non-citizen buyers (assume first-time SC buyer)
- Car 10-year total cost of ownership / running costs (V1 shows purchase cost only)
- Editing basics after initial entry (use "Start over" to reset)
