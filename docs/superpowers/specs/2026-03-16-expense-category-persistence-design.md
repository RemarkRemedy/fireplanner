# Expense Category Persistence + Gap Analysis + Retirement Templates

**Date:** 2026-03-16
**Status:** Design approved, pending implementation plan
**Branch:** feat/guided-setup-flow

## Problem

The expense breakdown nudge flow collects 7 monthly category values (housing, food, transport, etc.) but sums them into a single total and discards the categories. This means:

1. Categories don't round-trip (re-opening the flow shows empty fields)
2. The retirement spending adjustment is a single scalar applied uniformly across all categories, which is unrealistic (transport drops, healthcare rises)
3. No feedback about gaps between the breakdown total and the stored expense

## Design

### Data Model Change

Add an optional `categoryBreakdown` field to `ExpenseItem` in `lib/household/types.ts`:

```typescript
categoryBreakdown?: {
  rent?: number       // monthly, only for renters (no property plan)
  food: number        // monthly
  transport: number
  utilities: number
  entertainment: number
  travel: number
  other: number
}
```

This field is **storage only**. The projection engine never reads it. It exists so:
- `seedExpenses` can round-trip category values back into the nudge flow
- The weighted retirement ratio can be recomputed if the user re-enters the flow

### Property-Aware Category List

**If user has a property plan** (any entry in `plan.properties`):
- Show 6 categories: Food, Transport, Utilities, Entertainment, Travel, Other
- Show note at top: "Housing costs are covered by your property plan (mortgage, maintenance). Enter your other monthly spending below."
- `rent` field is omitted from the breakdown

**If user has no property** (renter):
- Show 7 categories: Rent, Food, Transport, Utilities, Entertainment, Travel, Other
- Rent participates in the weighted retirement ratio like any other category

Detection: check `useHouseholdPlanStore.getState().plan.properties.length > 0`.

### Gap Analysis (Screen 1)

Two gap indicators on the category breakdown screen:

**1. Total gap banner**
If the user has an existing stored annual expense, compute the monthly equivalent and compare to the breakdown sum. Show at top of the category list:

- If breakdown > stored: "Your breakdown totals $X/mo but your plan uses $Y/mo. [Update plan to $X/mo]"
- If breakdown < stored: "Your breakdown totals $X/mo. Your plan uses $Y/mo. Some spending may be unaccounted for."
- If within 10%: no banner (close enough)

The "Update" action overwrites the stored expense immediately (converted to annual).

**2. Per-category benchmark hints**
For categories where the user enters $0, show a subtle hint below the field using `SG_EXPENSE_BENCHMARKS` data:

- Food: "Most Singaporeans spend $400-800/mo"
- Transport: "Typical range: $150-400/mo"
- etc.

Only show for $0 fields to avoid being preachy. Use existing benchmark data from `lib/data/expenseBenchmarks.ts`.

### Retirement Templates (Screen 2)

Replace the current single `retirementSpendingRatio` slider with a template selector.

**Three templates** as radio cards:

| Category | Frugal Retiree | Active Retiree | No Change |
|----------|---------------|----------------|-----------|
| Rent* | 0.8 | 1.0 | 1.0 |
| Food | 0.85 | 1.0 | 1.0 |
| Transport | 0.4 | 0.6 | 1.0 |
| Utilities | 0.8 | 0.9 | 1.0 |
| Entertainment | 0.5 | 1.2 | 1.0 |
| Travel | 0.3 | 1.5 | 1.0 |
| Other | 0.7 | 0.9 | 1.0 |

*Rent row only shown when user has no property plan.

**Template descriptions:**
- **Frugal Retiree**: "Minimal spending. Less dining out, public transport, home-based leisure."
- **Active Retiree**: "Travel more, eat well, enjoy hobbies. Cut commuting and work expenses."
- **No Change**: "Keep current spending patterns into retirement."

**Advanced toggle:** Reveals per-category multiplier inputs so users can customize individual categories. Each shows the category name, current monthly amount, multiplier input, and computed retirement amount.

**Live weighted ratio display:** Below the template/editor, show: "Estimated retirement spending: ~$X/mo (Y% of current)" computed from the weighted formula.

### Weighted Ratio Computation

A pure function in `lib/calculations/expenses.ts`:

```
computeWeightedRetirementRatio(
  breakdown: Record<string, number>,   // category -> monthly amount
  multipliers: Record<string, number>  // category -> retirement multiplier
): number
```

Logic:
1. Sum all category amounts to get `total`
2. If `total === 0`, return 1.0 (no data, no adjustment)
3. For each category: `weighted += (amount / total) * multiplier`
4. Return `weighted` (e.g., 0.82)

The result writes to `ExpenseItem.retirementSpendingAdjustment`. No projection engine changes.

### Nudge Flow Changes

**Screen 1: Monthly Expense Categories** (existing, enhanced)
- Property-aware category list (6 or 7 fields)
- Gap banner at top
- Benchmark hints for $0 fields
- Running total at bottom: "Total: $X/mo ($Y/yr)"

**Screen 2: Retirement Spending** (redesigned)
- Template selector (radio cards): Frugal / Active / No Change
- Advanced toggle for per-category multipliers
- Live weighted ratio + monthly amount display
- Only shown if screen 1 had at least 2 non-zero categories (otherwise skip, keep existing scalar)

**Screen 3: Goals** (unchanged)

### Seed/Apply Changes

**`seedExpenses`** (seedFlowValues.ts):
- Read `categoryBreakdown` from the stored `ExpenseItem`
- Populate `housingExpenses` (rent), `foodExpenses`, etc. from the breakdown
- If no breakdown stored, leave fields empty (existing behavior)

**`applyFlowValues`** (applyFlowValues.ts):
- Write `categoryBreakdown` to the `ExpenseItem` (the 6-7 monthly values)
- Compute weighted retirement ratio from categories + selected template multipliers
- Write to `retirementSpendingAdjustment`
- Overwrite `amount` if 2+ categories are non-zero (existing behavior)

### Template Multipliers Storage

Store the selected template name and any custom overrides in the nudge flow values. On apply, the multipliers are used to compute the weighted ratio but are **not persisted** to the `ExpenseItem` — only the resulting `retirementSpendingAdjustment` scalar is stored.

If the user re-enters the flow, the template selection resets to "No Change" (safe default) and they can re-select. The category amounts round-trip via `categoryBreakdown`.

**Rationale:** Storing multipliers adds fields to the domain model for data that's only meaningful in the context of the nudge flow. The weighted ratio captures the intent. Users who want to fine-tune can re-enter the flow.

### Files to Modify

1. `lib/household/types.ts` — add `categoryBreakdown` to `ExpenseItem`
2. `lib/calculations/expenses.ts` — add `computeWeightedRetirementRatio()`
3. `lib/data/nudgeFlows.ts` — update expenses flow definition (property-aware fields, templates)
4. `lib/data/expenseBenchmarks.ts` — add per-category benchmark ranges (may already exist)
5. `lib/data/retirementTemplates.ts` — NEW: template multiplier definitions
6. `lib/household/seedFlowValues.ts` — seed categories from `categoryBreakdown`
7. `lib/household/applyFlowValues.ts` — write `categoryBreakdown` + weighted ratio
8. `components/projection/NudgeDrawer.tsx` — custom children for template selector + gap UI
9. `pages/RefineFlowPage.tsx` — same custom children for full-page flow

### What This Does NOT Change

- The projection engine (`projection.ts`) — reads `retirementSpendingAdjustment` as before
- The setup wizard (`SetupPage.tsx`) — setup collects a single total, not categories
- Existing expense items without `categoryBreakdown` — they continue working with the scalar ratio
- The "Expenses Breakdown" columns in the projection table — those show engine-computed breakdowns, not input categories
