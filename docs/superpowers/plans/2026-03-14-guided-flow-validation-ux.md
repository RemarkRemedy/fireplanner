# Guided Setup Flow — Validation + Post-Setup Validity + UX Polish

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 interconnected issues: (1) guided flows accept any input without validation, (2) `applySetupDraft` produces plans that fail projection validation, (3) UX interaction polish.

**Spec:** `docs/superpowers/specs/2026-03-14-guided-setup-flow-design.md`
**Branch:** `feat/guided-setup-flow` in worktree `../fireplanner-setup`

**CRITICAL: Every plan that creates a user flow MUST include an end-to-end Playwright test as a required task, not optional polish.**

---

## Workstream 1: Post-Setup Plan Validity (HIGHEST PRIORITY)

The setup flow produces a couple plan that fails projection validation. Fix this first — it's the most visible user-facing bug.

### Task 1.1: Reproduce and diagnose validation failures

- [ ] Write a test in `setupDraft.test.ts` that creates a couple plan via `applySetupDraft` with typical values, then runs the household validation against it
- [ ] Identify which fields are missing or invalid. Likely candidates:
  - Allocation weights not initialized (couple plans may not inherit individual defaults)
  - Income entry missing `salaryModel` or other required fields
  - Partner adult missing `lifeExpectancy` or other derived fields
  - Property entry created but incomplete
- [ ] Read `useProjection` to trace what `hasErrors` checks — follow the validation chain from store → hooks → projection

### Task 1.2: Fix applySetupDraft to produce valid plans

- [ ] For each failing field identified in 1.1, add the correct initialization in `applySetupDraft`
- [ ] Ensure `initializeManualPlan` already sets sane defaults for fields NOT covered by setup (allocation, withdrawal strategy, life expectancy, etc.)
- [ ] If `initializeManualPlan` doesn't set them, add explicit defaults in `applySetupDraft`
- [ ] Read `frontend/src/lib/household/types.ts` for all required `PlanningAdult` fields — verify each one has a value after setup

### Task 1.3: Add end-to-end validation test

- [ ] Test: apply fresh individual draft → run household validation → assert 0 errors
- [ ] Test: apply fresh couple draft → run household validation → assert 0 errors
- [ ] Test: apply fresh couple draft → run `useProjection` equivalent logic → assert `hasErrors === false`

---

## Workstream 2: Field-Level Validation in Guided Flows

Map existing validation schemas to guided flow screens so invalid values are caught before submission.

### Task 2.1: Create field validation mapping

- [ ] Read `frontend/src/lib/validation/schemas.ts` — extract all field schemas into a lookup by field name
- [ ] `validateProfileField` already exists (line 178) — maps field name → Zod schema
- [ ] Create `frontend/src/lib/validation/setupFieldValidation.ts`:

```typescript
import { validateProfileField } from './schemas'
import { MEDISAVE_BHS } from '@/lib/data/healthcarePremiums'

// Map nudge flow field names to validation functions
export function validateSetupField(
  fieldName: string,
  value: unknown,
  context?: { currentAge?: number }
): string | null {
  // Direct matches to profile field validators
  const profileFieldMap: Record<string, string> = {
    currentAge: 'currentAge',
    retirementAge: 'retirementAge',
    annualIncome: 'annualIncome',
    annualExpenses: 'annualExpenses',
    liquidNetWorth: 'liquidNetWorth',
    cpfOa: 'cpfOA',
    cpfSa: 'cpfSA',
    cpfMa: 'cpfMA',
    cpfRa: 'cpfRA',
    // ... map all fields
  }

  // Age-conditional rules
  if (fieldName === 'cpfRa' && context?.currentAge && context.currentAge < 55) {
    if (typeof value === 'number' && value > 0) {
      return 'RA only exists from age 55'
    }
  }

  if (fieldName === 'cpfMa' && typeof value === 'number' && value > MEDISAVE_BHS) {
    return `MA cannot exceed BHS ($${MEDISAVE_BHS.toLocaleString()})`
  }

  // Fall through to profile schema
  const profileField = profileFieldMap[fieldName]
  if (profileField) return validateProfileField(profileField, value)

  return null
}
```

### Task 2.2: Integrate validation into SetupScreen

- [ ] Add `validate` prop to `NudgeField` interface:
```typescript
validate?: (value: unknown, values: Record<string, unknown>) => string | null
```
- [ ] OR: Add a `validationFieldName` prop that maps to `validateSetupField`
- [ ] Show inline error text below fields that fail validation
- [ ] Block "Continue" when validation errors exist (same pattern as `required` fields)

### Task 2.3: Add context-aware validation rules

CPF validation needs the user's age (from the values object):

- [ ] RA field: hidden entirely when age < 55 (use `showWhen` with a computed condition, or a custom `hideWhen` callback)
- [ ] MA field: cap at BHS ($79,000 for 2026)
- [ ] SA top-up: cap at $8,000/yr (RSTU_TAX_RELIEF_CAP)
- [ ] OA top-up: cap at CPF_ANNUAL_LIMIT
- [ ] Mortgage balance: must be < property value
- [ ] Retirement age: must be > current age (unless already-FIRE)
- [ ] SRS annual contribution: cap at $15,300

### Task 2.4: Validation in nudge flows (RefineFlowPage + NudgeDrawer)

- [ ] Same validation applies to `/refine/cpf`, `/refine/property`, etc.
- [ ] Read the flow's field names from `nudgeFlows.ts`, map each to `validateSetupField`
- [ ] Show errors inline, block "Done" when errors exist

---

## Workstream 3: UX Polish

### Task 3.1: Playwright end-to-end smoke test

**This is NOT optional. Do this before any visual polish.**

- [ ] Create `frontend/src/pages/__tests__/SetupFlow.e2e.test.ts` (or equivalent Playwright test)
- [ ] Test individual flow: navigate `/setup` → fill all screens → confirm → assert `/projection` with no error banner
- [ ] Test couple flow: same with partner data
- [ ] Test returning user: complete flow → go to `/` → verify "Continue to Dashboard" appears
- [ ] Test redo: click "Redo setup" → verify fields pre-populated → confirm → no errors

### Task 3.2: UX review via multi-model panel

- [ ] Run Playwright to screenshot every setup screen
- [ ] Send screenshots to Gemini 3.1 Pro + Claude for UX heuristic review
- [ ] Consolidate findings, triage, fix accepted items

### Task 3.3: Known UX fixes from this session

- [ ] Verify all toggle-controlled fields use `showWhen` (CPF done, dependents done — check property mortgage, rental, healthcare fields in nudge flows)
- [ ] Review all select options have descriptive labels (ISP tiers done — check others)
- [ ] Verify helper text on all non-obvious fields

---

## Execution Order

```
1.1 → 1.2 → 1.3 (post-setup validity — highest priority, unblocks Playwright test)
  ↓
3.1 (Playwright smoke test — catches regressions from all other work)
  ↓
2.1 → 2.2 → 2.3 → 2.4 (field validation — parallel with 3.2/3.3 after 3.1 passes)
  ↓
3.2 → 3.3 (UX polish — last, informed by Playwright + model review)
```

---

## Lesson Learned

This plan exists because 11 rounds of code review failed to catch that `applySetupDraft` produces invalid plans. The root cause: no reviewer ran the actual user flow. **Every future plan that creates a user-facing flow must include Task 3.1 (Playwright smoke test) as a REQUIRED task in the first chunk, not as polish at the end.**
