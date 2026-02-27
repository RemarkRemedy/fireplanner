# Life Event Stress Tests & Marital Status Expansion

**Date:** 2026-02-27
**Status:** Design approved, pending implementation plan

## Context

User feedback requested:
1. Expanded marital status options (divorced, widowed)
2. Life event stress tests (death of spouse, illness, job loss, etc.)
3. Dividend income input (already exists as "investment" income type)
4. Coast FIRE support (already fully implemented)

Items 3 and 4 are discoverability issues, not missing features.

## Feature 1: Marital Status Expansion

### Current State

```typescript
type MaritalStatus = 'single' | 'married'
```

### Proposed

```typescript
type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'
```

### Calculation Impact

Minimal. In Singapore tax:
- **Divorced** = treated as single (no spouse relief)
- **Widowed** = treated as single (no spouse relief)
- **Separated-but-not-divorced** = still legally married, users select "married"

No changes to tax calculation logic needed. Both new statuses map to the same code path as `'single'` for relief eligibility.

### Files Changed

- `frontend/src/lib/types.ts`: Expand `MaritalStatus` union
- `frontend/src/lib/validation/schemas.ts`: Update Zod enum
- `frontend/src/stores/useProfileStore.ts`: Bump store version (existing values still valid)
- Profile section UI component: Update dropdown options

---

## Feature 2: Life Event Stress Tests

### Architecture Decision

**Phase 1 (this implementation):** Deterministic "what-if" stress tests. User selects a life event, configures trigger age, system runs two projections (baseline vs. with-event) and shows before/after comparison. Probability displayed as informational context badge.

**Phase 2 (future):** Monte Carlo integration. Life events randomly occur in MC paths based on actuarial probabilities stored in the data model. Phase 1 data model includes fields to support this.

### Why Not Extend CrisisScenario?

The existing `CrisisScenario` interface models market crashes via `equityReturnSequence` (year-by-year portfolio returns). Life events modify cash flows (income/expenses), not portfolio returns. Forcing both into one interface would create confusing optional fields and complicate simulation dispatch. Separate types, separate execution paths.

### Data Model

```typescript
interface LifeEventScenario {
  id: string
  name: string
  category: 'family' | 'health' | 'career'
  description: string

  // Probability context (Phase 1: display only, Phase 2: MC sampling)
  probability: number           // cumulative probability (0.25 = 25%)
  probabilityByAge: number      // "by age X" qualifier
  probabilitySource: string     // citation

  // Default trigger age (user adjustable via slider)
  defaultTriggerAge: number

  // Income impact
  incomeChange: {
    percentage: number           // -1.0 = lose 100%, -0.5 = lose 50%
    target: 'primary' | 'spouse' | 'all'
    durationYears: number | null // null = permanent
  }

  // Expense impact
  expenseChange: {
    additionalAnnual: number     // extra yearly cost (medical, care)
    reductionPercent: number     // lifestyle reduction (0.15 = 15% less)
    durationYears: number | null
  }

  // One-time impacts
  lumpSumCost: number
  insurancePayout: number        // default assumption (user overridable)

  // Future MC integration (unused in Phase 1)
  probabilityDistribution?: {
    type: 'uniform' | 'increasing-with-age'
    annualRate?: number
  }
}
```

### Five Scenarios

| Scenario | Category | Income Impact | Expense Impact | Lump Sum | Probability |
|----------|----------|--------------|----------------|----------|-------------|
| **Death of Spouse** | family | Spouse income to 0 (permanent) | -15% lifestyle | $15K funeral | ~3% by age 55 |
| **Critical Illness (Self)** | health | -100% for 6-12 months | +$50K/yr medical (2 yrs) | $20K deductible | ~25% by age 65 |
| **Retrenchment** | career | -100% primary for 6-12 months | No major change | $0 (severance offsets) | ~15% per recession |
| **Dual to Single Income** | career | Spouse income to 0 (permanent) | -10% lifestyle | None | N/A (voluntary) |
| **Permanent Disability** | health | -100% primary (permanent) | +$30K/yr care | Insurance payout | ~5% by age 65 |

All values are editable defaults. Users can adjust trigger age, income loss percentage, expense amounts, durations, and insurance payouts.

### Execution Flow

1. User selects a life event scenario on the Life Events tab
2. User configures trigger age (slider) and optionally adjusts impact parameters
3. System runs two `generateProjection()` calls:
   - **Baseline:** Current plan parameters, no modifications
   - **With event:** Same parameters but income/expenses modified at trigger age
4. Display before/after comparison:
   - Dual-line portfolio trajectory chart (baseline in blue, with-event in orange)
   - Impact summary: FIRE age delay, portfolio shortfall at retirement, years of coverage change

### UI Location

New **"Life Events"** tab on the Stress Test page, alongside existing "Sequence Risk" and "Monte Carlo" tabs.

**Tab layout:**
- Top: Card grid showing 5 scenarios (icon, name, probability badge, one-line description)
- Selecting a card expands configuration panel below:
  - Trigger age slider
  - Editable impact parameters (income %, expense amounts, duration)
  - "Run Analysis" button
- Results section:
  - Before/after portfolio chart
  - Impact metrics table (FIRE age delta, portfolio delta, coverage years delta)

### Projection Modification Strategy

Life events modify inputs to `generateProjection()`, not the engine itself:

- **Income changes:** Filter/modify the `incomeStreams` array at the trigger age. For "spouse income to 0," remove or zero-out income streams flagged as spouse income.
- **Expense changes:** Adjust `annualExpenses` at trigger age (reduce by percentage, add medical costs).
- **Lump sum costs:** Subtract from portfolio value at trigger age.
- **Insurance payouts:** Add to portfolio value at trigger age.

This requires the projection engine to accept age-specific overrides, or the life event runner pre-computes modified parameter sets and calls `generateProjection()` with them.

### Identifying Spouse Income

For "Death of Spouse" and "Dual to Single Income," we need to know which income streams belong to the spouse. Options:

**Recommended:** Add an optional `owner: 'self' | 'spouse'` field to `IncomeStream`. Defaults to `'self'`. Only relevant when marital status is married. Life event scenarios filter by this field.

This also enables the marital status feature to display household vs. individual income breakdowns in the future.

### SG-Specific Data Sources for Probabilities

- Critical illness: Singapore Life Insurance Association (SLIA) reports
- Mortality: Singapore Department of Statistics (DOS) life tables
- Disability: Ministry of Health disability prevalence data
- Retrenchment: MOM Labour Market reports (retrenchment rates)

Exact citations to be researched during implementation. Values stored in a data file (`lib/data/lifeEventScenarios.ts`) consistent with existing data file patterns.

---

## Out of Scope

- Combining market crises with life events simultaneously (Phase 2)
- Monte Carlo integration of life events (Phase 2)
- Child-related reliefs and tax implications
- Detailed insurance product modeling
- Discoverability improvements for existing features (separate UX task)
