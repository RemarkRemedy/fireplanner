# Expense Category Persistence + Gap Analysis + Retirement Templates

**Date:** 2026-03-16
**Status:** Design approved, pending implementation plan
**Branch:** feat/guided-setup-flow
**Review:** 4-agent review completed. All blockers and warnings addressed in v2.

## Problem

The expense breakdown nudge flow collects 7 monthly category values (housing, food, transport, etc.) but sums them into a single total and discards the categories. This means:

1. Categories don't round-trip (re-opening the flow shows empty fields)
2. The retirement spending adjustment is a single scalar applied uniformly across all categories, which is unrealistic (transport drops, healthcare rises)
3. No feedback about gaps between the breakdown total and the stored expense

## Design

### Data Model Change

Add an optional `categoryBreakdown` field to `ExpenseItem` in `lib/household/types.ts`.
This field is scoped to `base-living` expense items only (other kinds ignore it).

```typescript
categoryBreakdown?: {
  rent?: number           // monthly, only for renters (no owned property)
  food?: number           // monthly — all fields optional for partial entry
  transport?: number
  utilities?: number
  entertainment?: number
  travel?: number         // monthly (NOT annualised — see "Units" below)
  other?: number
  templateId?: 'frugal' | 'active' | 'none' | 'custom'
  multipliers?: Record<string, number>  // per-category retirement multipliers
}
```

All amount fields are optional to support partial entry (user fills 3 of 7 categories).

This field serves three purposes:
- `seedExpenses` can round-trip category values back into the nudge flow
- The weighted retirement ratio can be recomputed if the user re-enters the flow
- `templateId` and `multipliers` persist so re-entry shows the correct template and custom overrides

**Backward compatibility:** The field is optional. Existing `ExpenseItem` records without
`categoryBreakdown` continue working with the scalar `retirementSpendingAdjustment`. No migration
needed. The Zustand persist middleware passes the plan object through as-is from localStorage.

### Units Convention

**All category amounts are monthly.** The existing nudge flow field labeled "Travel (annualised)"
must be renamed to "Travel" and treated as monthly, consistent with all other categories. The
apply logic multiplies the monthly total by 12 to produce the annual `ExpenseItem.amount`.

### Property-Aware Category List

**If user owns property** (`plan.properties.some(p => p.ownsProperty)`):
- Show 6 categories: Food, Transport, Utilities, Entertainment, Travel, Other
- Show note at top: "Housing costs are covered by your property plan (mortgage, maintenance). Enter your other monthly spending below."
- `rent` field is omitted from the breakdown
- If a previously-stored `categoryBreakdown` contains `rent` (user added a property after filling expenses), `seedExpenses` suppresses the rent value on re-entry

**If user does not own property** (renter, or only "planning to buy"):
- Show 7 categories: Rent, Food, Transport, Utilities, Entertainment, Travel, Other
- Rent participates in the weighted retirement ratio like any other category
- Note for "planning to buy" users: "Once you own property, housing costs will be tracked in your property plan instead."

**Detection:** `plan.properties.some(p => p.ownsProperty)` — this correctly excludes
"planning to buy" entries (which have `ownsProperty: false`) so renters who plan to
buy in the future still see the Rent field.

### Gap Analysis (Screen 1)

Two gap indicators, both rendered as **custom children** in the expenses flow (not via
NudgeField metadata, since SetupScreen can't render banners above fields or inline hints).

**1. Total gap banner**
If the user has an existing stored annual expense, compute the monthly equivalent and compare
to the breakdown sum. Show above the category fields:

- If gap > 10% either direction: "Your breakdown totals $X/mo. Your plan currently uses $Y/mo."
- If within 10%: no banner (close enough)

The banner is **informational only**. It does NOT have an "Update plan" action that overwrites
immediately. The total is updated via `applyFlowValues` on final save, consistent with the
staged-apply model used by all nudge flows. This prevents mid-flow data loss if the user cancels.

**2. Per-category benchmark hints**
For categories where the user enters $0, show a subtle hint below the field.

These hints come from a **new** `EXPENSE_CATEGORY_BENCHMARKS` export in `lib/data/expenseBenchmarks.ts`
(the existing `SG_EXPENSE_BENCHMARKS` only has life-stage totals, not per-category ranges):

```typescript
export const EXPENSE_CATEGORY_BENCHMARKS: Record<string, { label: string; range: string }> = {
  rent:          { label: 'Rent',          range: '$800-2,500/mo' },
  food:          { label: 'Food & dining', range: '$400-800/mo' },
  transport:     { label: 'Transport',     range: '$150-400/mo' },
  utilities:     { label: 'Utilities',     range: '$100-250/mo' },
  entertainment: { label: 'Entertainment', range: '$100-400/mo' },
  travel:        { label: 'Travel',        range: '$100-500/mo' },
  other:         { label: 'Other',         range: '$100-300/mo' },
}
```

Source: SingStat Household Expenditure Survey + MoneySense guidelines. Ranges are approximate
for a middle-income Singapore household.

**3. Running total**
Show at the bottom of the category list: "Total: $X/mo ($Y/yr)"

### Retirement Templates (Screen 2)

Replace the current single `retirementSpendingRatio` slider with a template selector.
Screen 2 is shown if screen 1 had at least **1 non-zero category** (previously 2).

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

*Rent row only shown when user does not own property.

**Template descriptions:**
- **Frugal Retiree**: "Minimal spending. Less dining out, public transport, home-based leisure."
- **Active Retiree**: "Travel more, eat well, enjoy hobbies. Cut commuting and work expenses."
- **No Change**: "Keep current spending patterns into retirement."

**Advanced toggle:** Reveals per-category multiplier inputs (capped 0.0 to 5.0) so users can
customize individual categories. Each shows the category name, current monthly amount,
multiplier input, and computed retirement amount.

**Live weighted ratio display:** Below the template/editor, show:
"Estimated retirement spending: ~$X/mo (Y% of current)" computed from the weighted formula.

### Weighted Ratio Computation

A pure function in `lib/calculations/expenses.ts`:

```
computeWeightedRetirementRatio(
  breakdown: Record<string, number>,   // category -> monthly amount
  multipliers: Record<string, number>  // category -> retirement multiplier
): number
```

Logic:
1. Filter out categories with amount <= 0 (ignore negatives and zeros)
2. Sum filtered amounts to get `total`
3. If `total === 0`, return 1.0 (no data, no adjustment)
4. For each category with amount > 0: look up multiplier (default 1.0 if missing), compute `weighted += (amount / total) * Math.min(5.0, Math.max(0, multiplier))`
5. Return `weighted` (e.g., 0.82)

The result writes to `ExpenseItem.retirementSpendingAdjustment`. No projection engine changes.

**Tests required** in `expenses.test.ts` (CLAUDE.md mandates 95% coverage on `lib/calculations/`):
- All zero categories → 1.0
- Single category → returns that category's multiplier
- Uniform multipliers → returns that multiplier
- Missing multiplier for a category → defaults to 1.0
- Negative amounts → ignored
- Multiplier > 5.0 → clamped to 5.0

### Nudge Flow Changes

The expenses flow uses `container: 'full-page'`, so custom children go in `RefineFlowPage.tsx`
only (NOT `NudgeDrawer.tsx`).

**Screen 1: Monthly Expense Categories** (existing, enhanced via custom children)
- Property-aware category list (6 or 7 fields)
- Gap banner above fields (custom child, not a NudgeField)
- Benchmark hints for $0 fields (custom child below each field)
- Running total at bottom (custom child)

**Screen 2: Retirement Spending** (redesigned via custom children)
- Template selector (radio cards): Frugal / Active / No Change
- Advanced toggle for per-category multipliers (capped 0-5x)
- Live weighted ratio + monthly amount display
- Only shown if screen 1 had at least 1 non-zero category (otherwise skip, keep existing scalar)

**Screen 3: Goals** (unchanged)

### Seed/Apply Changes

**`seedExpenses`** (seedFlowValues.ts):
- Read `categoryBreakdown` from the stored base-living `ExpenseItem`
- Populate `rentExpenses`, `foodExpenses`, etc. from the breakdown
- If property now exists but `categoryBreakdown` has `rent`, suppress the rent value
- Seed `templateId` and `multipliers` if present (so re-entry shows correct template)
- If no breakdown stored, leave fields empty (existing behavior)

**`applyFlowValues`** (applyFlowValues.ts):
- Write `categoryBreakdown` to the base-living `ExpenseItem`:
  - Category amounts (monthly)
  - `templateId` (which template was selected)
  - `multipliers` (the per-category multipliers, including custom overrides)
- Compute weighted retirement ratio from categories + multipliers
- Write to `retirementSpendingAdjustment`
- Overwrite `amount` with `total * 12` if 2+ categories are non-zero (existing threshold)
- The base-living `ExpenseItem.periodicity` is `'annual'`, so the `* 12` conversion is correct

### Field Naming Convention

The `categoryBreakdown` field names (`rent`, `food`, `transport`, etc.) are the canonical keys.
The nudge flow field names (`rentExpenses`, `foodExpenses`, etc.) are UI-level names that map
to the canonical keys in the seed/apply layer. The mapping is explicit:

| Nudge flow field | categoryBreakdown key |
|------------------|----------------------|
| rentExpenses | rent |
| foodExpenses | food |
| transportExpenses | transport |
| utilitiesExpenses | utilities |
| entertainmentExpenses | entertainment |
| travelExpenses | travel |
| otherExpenses | other |

### Files to Modify

1. `lib/household/types.ts` — add `categoryBreakdown` to `ExpenseItem`
2. `lib/calculations/expenses.ts` — add `computeWeightedRetirementRatio()`
3. `lib/calculations/expenses.test.ts` — tests for the weighted ratio function
4. `lib/data/nudgeFlows.ts` — update expenses flow (rename "Travel (annualised)" to "Travel", property-aware showWhen)
5. `lib/data/expenseBenchmarks.ts` — add NEW `EXPENSE_CATEGORY_BENCHMARKS` export (per-category ranges)
6. `lib/data/retirementTemplates.ts` — NEW: template multiplier definitions + descriptions
7. `lib/household/seedFlowValues.ts` — seed categories + templateId + multipliers from `categoryBreakdown`
8. `lib/household/applyFlowValues.ts` — write `categoryBreakdown` + weighted ratio
9. `pages/RefineFlowPage.tsx` — custom children for gap banner, benchmark hints, running total, template selector
10. `components/setup/RetirementTemplateSelector.tsx` — NEW: reusable template selector + advanced multiplier editor

### What This Does NOT Change

- The projection engine (`projection.ts`) — reads `retirementSpendingAdjustment` as before
- The setup wizard (`SetupPage.tsx`) — setup collects a single total, not categories
- Existing expense items without `categoryBreakdown` — they continue working with the scalar ratio
- The "Expenses Breakdown" columns in the projection table — those show engine-computed breakdowns, not input categories
- `NudgeDrawer.tsx` — expenses flow is `container: 'full-page'`, drawer is not used

### Review Fixes Applied (v2)

| Issue | Source | Fix |
|-------|--------|-----|
| B1: Property detection catches "planning to buy" | All 4 agents | Changed to `plan.properties.some(p => p.ownsProperty)` |
| B2: Per-category benchmarks don't exist | 3 agents | Documented as new data to create (`EXPENSE_CATEGORY_BENCHMARKS`) |
| B3: "Update plan" conflicts with staged-apply | Codex + Gemini | Removed immediate overwrite, gap banner is informational only |
| B4: Custom children needed for gap/hints/total | Codex | Explicitly noted as custom children, not NudgeField metadata |
| W1: Template multipliers lost on re-entry | 3 agents | Persisted `templateId` and `multipliers` in `categoryBreakdown` |
| W2: Travel units ambiguity | Codex | All categories are monthly, "Travel (annualised)" renamed to "Travel" |
| W3: NudgeDrawer not needed | Codex | Removed from files list, expenses is full-page only |
| W4: Field naming mismatch | Feasibility | Added explicit mapping table between nudge flow and canonical keys |
| S: All fields optional | Architect | Changed to all-optional for partial entry |
| S: Missing multiplier default | Feasibility | Default to 1.0 if multiplier not in map |
| S: Multiplier caps | Gemini | Capped 0.0 to 5.0 |
| S: Tests required | Architect | Listed test cases for `computeWeightedRetirementRatio` |
| S: Threshold for screen 2 | Feasibility | Changed from 2+ to 1+ non-zero categories |
| S: Negative amount handling | Feasibility | Filter out amounts <= 0 in weighted ratio |
