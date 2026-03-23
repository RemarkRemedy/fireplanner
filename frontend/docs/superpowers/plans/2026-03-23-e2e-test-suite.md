# E2E Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive Playwright e2e tests covering the income/life-events contract gap (P0), core financial features with zero coverage (P1), and public tools (P2).

**Architecture:** Each test file follows the existing pattern: `goToStart` + onboarding helper, navigate to target page, interact with UI, assert outcomes. Tests use `helpers.ts` shared utilities. Each task produces one independent spec file that can run in isolation.

**Tech Stack:** Playwright, TypeScript, existing `e2e/helpers.ts` utilities

---

## Conventions (read these before writing any test)

- **Base URL:** `http://localhost:5173` (configured in `playwright.config.ts`)
- **Fresh state:** Every `test.beforeEach` calls `goToStart(page)` which clears localStorage and reloads
- **Onboarding helper:** Use the `quickOnboarding` pattern from `navigation.spec.ts` (goal-first, age 30, retirement 55, income 100K, expenses 50K, savings 200K) unless the test needs different values
- **Section access:** Input sections use `page.locator('#section-income')`, `#section-property`, etc. Sections start **expanded** by default. Use `expandSection` helper if needed.
- **Input helpers:** Use `fillCurrencyInput(page, label, value)` and `fillNumberInput(page, label, value)` from `helpers.ts`. These also work for PercentInput fields (same DOM structure).
- **Projection table columns:** The Salary column is **hidden by default** (only `totalIncome` is visible in Simple mode). To read individual income components, switch to Advanced mode first or click the "Income Breakdown" column group toggle. Use `totalIncome` for general income comparisons.
- **Navigation:** Use existing `navigateVia(page, linkText)` + `expectRoute(page, route)` from helpers.ts. Do NOT create duplicate navigation helpers.
- **No localStorage hacks:** Per CLAUDE.md, if a feature can't be reached through normal user actions, that's a bug. Only use `localStorage.clear()` for fresh state.
- **Timeouts:** Default 30s for assertions. Use `test.setTimeout(120_000)` for heavy simulations (MC, backtest).
- **Dollar formatting:** Currency values appear formatted with commas (e.g., "$100,000"). Match with regex: `/\$[\d,]+/`

## File Structure

All files go in `frontend/e2e/`:

| File | Task | Priority |
|------|------|----------|
| `e2e/helpers.ts` | Task 1: Add shared helpers | P0 |
| `e2e/life-events-income.spec.ts` | Task 2: Life events contract tests | P0 |
| `e2e/income-streams.spec.ts` | Task 3: Income streams | P1 |
| `e2e/dashboard-panels.spec.ts` | Task 4: Dashboard panels | P1 |
| `e2e/health-check.spec.ts` | Task 5: Health check | P1 |
| `e2e/backtest-sequence-risk.spec.ts` | Task 6: Backtest + sequence risk | P1 |
| `e2e/allocation.spec.ts` | Task 7: Allocation | P1 |
| `e2e/expenses.spec.ts` | Task 8: Expenses | P1 |
| `e2e/household-couple.spec.ts` | Task 9: Household couple | P1 |
| `e2e/cpf-section.spec.ts` | Task 10: CPF section | P1 |
| `e2e/stamp-duty.spec.ts` | Task 11: Stamp duty calculator | P2 |
| `e2e/srs-calculator.spec.ts` | Task 12: SRS calculator | P2 |
| `e2e/fee-comparison.spec.ts` | Task 13: Fee comparison | P2 |

---

### Task 1: Shared Helpers

**Files:**
- Modify: `e2e/helpers.ts`

Add reusable helpers needed by multiple test files. Keep existing helpers untouched; append new ones.

- [ ] **Step 1: Add `quickOnboarding` helper**

This pattern is repeated in `navigation.spec.ts` and `monte-carlo.spec.ts` but not exported from helpers. Extract it:

```typescript
/**
 * Complete goal-first onboarding with standard test values.
 * Age 30, retirement 55, income $100K, expenses $50K, savings $200K.
 * Ends on /inputs page.
 */
export async function quickOnboarding(page: Page, opts?: {
  age?: string
  retirementAge?: string
  income?: string
  expenses?: string
  savings?: string
}) {
  await goToStart(page)
  await selectPathway(page, 'goal-first')

  const formInputs = page.locator('main input[inputmode="numeric"]')
  await expect(formInputs).toHaveCount(5, { timeout: 5000 })

  const v = {
    age: opts?.age ?? '30',
    retirementAge: opts?.retirementAge ?? '55',
    income: opts?.income ?? '100000',
    expenses: opts?.expenses ?? '50000',
    savings: opts?.savings ?? '200000',
  }

  for (const [i, val] of [v.age, v.retirementAge, v.income, v.expenses, v.savings].entries()) {
    await formInputs.nth(i).click()
    await formInputs.nth(i).fill(val)
  }
  await formInputs.nth(4).blur()

  await expect(page.getByText('FIRE Number:').first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /build my full plan/i }).click()
  await expect(page).toHaveURL(/\/inputs/)
  await page.waitForLoadState('networkidle')
}
```

- [ ] **Step 2: Add `expandSection` helper**

```typescript
/**
 * Expand an accordion section on the inputs page by its section ID.
 * Sections start expanded by default; this handles the case where
 * a section was previously collapsed.
 */
export async function expandSection(page: Page, sectionId: string) {
  const section = page.locator(`#${sectionId}`)
  await section.scrollIntoViewIfNeeded()
  // Radix Accordion sets data-state="closed" on collapsed items
  const trigger = section.locator('button[data-state]').first()
  const state = await trigger.getAttribute('data-state').catch(() => 'open')
  if (state === 'closed') {
    await trigger.click()
    // Wait for content to be visible after accordion animation
    await expect(section.locator('input').first()).toBeVisible({ timeout: 2000 })
  }
  return section
}
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `cd frontend && npx playwright test --reporter=list 2>&1 | tail -20`
Expected: Same pass/fail count as before (no new failures).

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers.ts
git commit -m "feat(e2e): add shared helpers for onboarding, section expansion, and input filling"
```

---

### Task 2: Life Events Income Contract Tests (P0)

**Files:**
- Create: `e2e/life-events-income.spec.ts`

This is the highest-priority test file. It verifies the **UI-to-calculation contract** for life events, catching the class of bug where a field's display semantics don't match the calculation semantics.

- [ ] **Step 1: Write the spec file scaffold**

```typescript
import { test, expect } from '@playwright/test'
import { goToStart, quickOnboarding, expandSection, navigateVia, expectRoute } from './helpers'

/**
 * Navigate to the income section and enable life events.
 * Returns the income section locator.
 *
 * NOTE: The Life Events card title includes the adult's display name
 * (e.g., "Me's Life Events"), so we match the CardTitle text broadly.
 */
async function enableLifeEvents(page: import('@playwright/test').Page) {
  const section = await expandSection(page, 'section-income')

  // Find the Life Events card by its CardTitle (contains "Life Events" with adult name prefix)
  const lifeEventsTitle = section.getByRole('heading', { name: /Life Events/i })
  await lifeEventsTitle.scrollIntoViewIfNeeded()

  // The switch is a sibling of the heading inside the CardHeader
  const cardHeader = lifeEventsTitle.locator('..')
  const enabledSwitch = cardHeader.locator('button[role="switch"]')
  const state = await enabledSwitch.getAttribute('data-state')
  if (state !== 'checked') {
    await enabledSwitch.click()
  }
  await expect(enabledSwitch).toHaveAttribute('data-state', 'checked')

  return section
}

/**
 * Click a life event template button by label.
 */
async function addLifeEventTemplate(page: import('@playwright/test').Page, section: import('@playwright/test').Locator, templateLabel: string) {
  await section.getByRole('button', { name: templateLabel }).click()
}

test.describe('Life Events Income Contract', () => {
  test.beforeEach(async ({ page }) => {
    await quickOnboarding(page)
  })

  // Tests go here (Steps 2-7)
})
```

- [ ] **Step 2: Test — Career Break template shows 0% income during event**

```typescript
  test('Career Break template shows 0% in "Income during event" field', async ({ page }) => {
    const section = await enableLifeEvents(page)
    await addLifeEventTemplate(page, section, 'Career Break at 35')

    // The event card should appear with "Income during event" at 0%
    const eventCard = section.locator('.rounded-lg.border').filter({ hasText: 'Career Break' })
    await expect(eventCard).toBeVisible()

    // PercentInput displays the value as a percentage number
    const incomeField = eventCard.locator('label, [class*="Label"]')
      .filter({ hasText: 'Income during event' })
      .locator('..')
      .locator('input')
    await expect(incomeField).toHaveValue('0.0')
  })
```

- [ ] **Step 3: Test — Part-time template shows 50%, projection salary is ~50% of base**

```typescript
  test('Part-time Work template: 50% income during event, projection confirms ~50% total income', async ({ page }) => {
    const section = await enableLifeEvents(page)
    await addLifeEventTemplate(page, section, 'Part-time 40-45')

    // Verify field shows 50%
    const eventCard = section.locator('.rounded-lg.border').filter({ hasText: 'Part-time Work' })
    const incomeField = eventCard.locator('label, [class*="Label"]')
      .filter({ hasText: 'Income during event' })
      .locator('..')
      .locator('input')
    await expect(incomeField).toHaveValue('50.0')

    // Navigate to projection — totalIncome column is visible by default (Salary is hidden)
    await navigateVia(page, 'Projection')
    await expectRoute(page, '/projection')

    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })

    // Helper to find a row by age (match first cell exactly)
    const rowByAge = (age: number) =>
      table.locator('tr').filter({ has: page.locator('td:first-child', { hasText: String(age) }) })

    // Parse dollar values (remove $ and commas)
    const parse = (s: string | null) => Number((s ?? '0').replace(/[$,]/g, ''))

    // Compare totalIncome at age 38 (before event) vs 42 (during 40-45 event)
    // totalIncome is the "Total Income" column — find its index by header text
    const headers = await table.locator('thead th').allTextContents()
    const incomeColIdx = headers.findIndex(h => /total income/i.test(h))
    expect(incomeColIdx).toBeGreaterThan(-1)

    const income38 = parse(await rowByAge(38).locator('td').nth(incomeColIdx).textContent())
    const income42 = parse(await rowByAge(42).locator('td').nth(incomeColIdx).textContent())

    // Income at 42 should be roughly 40-60% of income at 38 (50% retention + growth variance)
    expect(income42).toBeLessThan(income38 * 0.65)
    expect(income42).toBeGreaterThan(income38 * 0.35)
  })
```

- [ ] **Step 4: Test — Setting income during event to 80% gives ~80% salary in projection**

```typescript
  test('manually setting 80% income during event gives ~80% income in projection', async ({ page }) => {
    const section = await enableLifeEvents(page)

    // Add Part-time template (starts at age 40)
    await addLifeEventTemplate(page, section, 'Part-time 40-45')

    // Change income during event from 50% to 80%
    const eventCard = section.locator('.rounded-lg.border').filter({ hasText: 'Part-time Work' })
    const incomeField = eventCard.locator('label, [class*="Label"]')
      .filter({ hasText: 'Income during event' })
      .locator('..')
      .locator('input')
    await incomeField.click()
    await incomeField.fill('80')
    await incomeField.blur()

    // Navigate to projection — use totalIncome column (visible by default)
    await navigateVia(page, 'Projection')
    await expectRoute(page, '/projection')

    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })

    const parse = (s: string | null) => Number((s ?? '0').replace(/[$,]/g, ''))
    const rowByAge = (age: number) =>
      table.locator('tr').filter({ has: page.locator('td:first-child', { hasText: String(age) }) })

    const headers = await table.locator('thead th').allTextContents()
    const incomeColIdx = headers.findIndex(h => /total income/i.test(h))

    const income38 = parse(await rowByAge(38).locator('td').nth(incomeColIdx).textContent())
    const income42 = parse(await rowByAge(42).locator('td').nth(incomeColIdx).textContent())

    // 80% retention: income should be 70-90% of pre-event income
    expect(income42).toBeLessThan(income38 * 0.95)
    expect(income42).toBeGreaterThan(income38 * 0.65)
  })
```

- [ ] **Step 5: Test — Career break at future age doesn't make FIRE unreachable**

```typescript
  test('career break at future age delays FIRE but does not make it unreachable', async ({ page }) => {
    // First check dashboard FIRE age without any events
    await navigateVia(page, 'Dashboard')
    await expectRoute(page, '/dashboard')

    // Record the base FIRE age number from the status panel
    const fireAgeEl = page.getByText(/FIRE Age/i).first()
    await expect(fireAgeEl).toBeVisible({ timeout: 5000 })
    const baseText = await fireAgeEl.locator('..').textContent() ?? ''
    const baseAgeMatch = baseText.match(/(\d+)/)
    const baseFIREAge = baseAgeMatch ? Number(baseAgeMatch[1]) : null

    // Go back and add a career break
    await navigateVia(page, 'Inputs')
    await expectRoute(page, '/inputs')
    const section = await enableLifeEvents(page)
    await addLifeEventTemplate(page, section, 'Career Break at 35')

    // Check dashboard again
    await navigateVia(page, 'Dashboard')
    await expectRoute(page, '/dashboard')

    // FIRE age should still be visible (not unreachable/infinity)
    const fireAgeAfter = page.getByText(/FIRE Age/i).first()
    await expect(fireAgeAfter).toBeVisible({ timeout: 5000 })

    // If we could parse the base FIRE age, verify the new one is >= base (delayed)
    if (baseFIREAge) {
      const afterText = await fireAgeAfter.locator('..').textContent() ?? ''
      const afterMatch = afterText.match(/(\d+)/)
      if (afterMatch) {
        expect(Number(afterMatch[1])).toBeGreaterThanOrEqual(baseFIREAge)
      }
    }
  })
```

- [ ] **Step 6: Test — Expense reduction 20% reduces projection expenses**

```typescript
  test('expense reduction 20% reduces expenses in projection during event', async ({ page }) => {
    const section = await enableLifeEvents(page)

    // Use Retrenchment template which has 20% expense reduction
    await addLifeEventTemplate(page, section, 'Retrenchment at 50')

    // Navigate to projection
    await navigateVia(page, 'Projection')
    await expectRoute(page, '/projection')

    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })

    const parse = (s: string | null) => Number((s ?? '0').replace(/[$,]/g, ''))
    const rowByAge = (age: number) =>
      table.locator('tr').filter({ has: page.locator('td:first-child', { hasText: String(age) }) })

    // Find Expenses column index by header text
    const headers = await table.locator('thead th').allTextContents()
    const expenseColIdx = headers.findIndex(h => /expense/i.test(h))
    expect(expenseColIdx).toBeGreaterThan(-1)

    // Compare expenses at age 49 (before) vs 50 (during retrenchment with 20% reduction)
    const expenses49 = parse(await rowByAge(49).locator('td').nth(expenseColIdx).textContent())
    const expenses50 = parse(await rowByAge(50).locator('td').nth(expenseColIdx).textContent())

    // Expenses at 50 should be less than at 49 (20% reduction)
    expect(expenses50).toBeLessThan(expenses49)
  })
```

- [ ] **Step 7: Test — Overlapping life events don't crash**

```typescript
  test('overlapping life events render without crashing', async ({ page }) => {
    const section = await enableLifeEvents(page)

    // Add two events that overlap in age range
    await addLifeEventTemplate(page, section, 'Career Break at 35')
    await addLifeEventTemplate(page, section, 'Part-time 40-45')

    // Both event cards should be visible
    const events = section.locator('.rounded-lg.border').filter({ hasText: /Career Break|Part-time/ })
    await expect(events).toHaveCount(2)

    // Navigate to projection — should render without error
    await navigateVia(page, 'Projection')
    await expectRoute(page, '/projection')
    await expect(page.getByText('Year-by-Year Projection')).toBeVisible({ timeout: 5000 })

    // No error boundary
    await expect(page.getByText('Unexpected Application Error')).not.toBeVisible()
  })
```

- [ ] **Step 8: Test — Removing a life event restores projection income**

```typescript
  test('removing a life event restores income to baseline in projection', async ({ page }) => {
    const section = await enableLifeEvents(page)
    await addLifeEventTemplate(page, section, 'Part-time 40-45')

    // Verify event card exists
    const eventCard = section.locator('.rounded-lg.border').filter({ hasText: 'Part-time Work' })
    await expect(eventCard).toBeVisible()

    // Remove the event
    await eventCard.getByRole('button', { name: /remove/i }).click()

    // Event card should be gone
    await expect(eventCard).not.toBeVisible()

    // Navigate to projection — income at age 42 should be full (no reduction)
    await navigateVia(page, 'Projection')
    await expectRoute(page, '/projection')

    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })

    const parse = (s: string | null) => Number((s ?? '0').replace(/[$,]/g, ''))
    const rowByAge = (age: number) =>
      table.locator('tr').filter({ has: page.locator('td:first-child', { hasText: String(age) }) })

    const headers = await table.locator('thead th').allTextContents()
    const incomeColIdx = headers.findIndex(h => /total income/i.test(h))

    const income38 = parse(await rowByAge(38).locator('td').nth(incomeColIdx).textContent())
    const income42 = parse(await rowByAge(42).locator('td').nth(incomeColIdx).textContent())

    // Without life event, income at 42 should be >= income at 38 (growth only)
    expect(income42).toBeGreaterThanOrEqual(income38 * 0.95)
  })
```

- [ ] **Step 9: Run tests**

Run: `cd frontend && npx playwright test life-events-income --reporter=list`
Expected: All 7 tests pass.

- [ ] **Step 10: Commit**

```bash
git add e2e/life-events-income.spec.ts
git commit -m "test(e2e): add life events income contract tests (P0)"
```

---

### Task 3: Income Streams Tests (P1)

**Files:**
- Create: `e2e/income-streams.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **Add rental income stream** — on income section, click "Add Stream", select "Rental", fill amount, verify it appears in projection's rental income column.
2. **Toggle life events on/off** — add a career break, navigate to projection, note salary. Go back, toggle life events off, check projection salary restored to full.
3. **Switch salary model** — toggle from Simple to Realistic, verify career phases editor appears with phase rows.

Follow the same locator patterns as Task 2: `expandSection('section-income')`, find buttons/inputs by label text, navigate to projection to verify.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test income-streams --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/income-streams.spec.ts
git commit -m "test(e2e): add income streams tests (P1)"
```

---

### Task 4: Dashboard Panels Tests (P1)

**Files:**
- Create: `e2e/dashboard-panels.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **What-If panel renders sliders** — navigate to dashboard, verify "What-if Scenarios" heading visible, slider inputs exist.
2. **One More Year panel** — verify 4 scenario rows render with retirement ages (planned, +1, +2, +3).
3. **Plan Completeness** — with minimal onboarding, verify some sections show as incomplete (yellow/red indicators).
4. **Disruption preview** — click a disruption template on the What-If panel, verify disrupted FIRE age displayed.
5. **Per-adult tabs for couple plan** — this requires couple onboarding; skip if too complex, just verify "Joint" tab exists when couple plan is active.

Pattern: `quickOnboarding` then `navigateToPage(page, 'Dashboard', '/dashboard')`. Each panel is a Card with a heading.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test dashboard-panels --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/dashboard-panels.spec.ts
git commit -m "test(e2e): add dashboard panels tests (P1)"
```

---

### Task 5: Health Check Tests (P1)

**Files:**
- Create: `e2e/health-check.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **Ratio cards render** — navigate to `/health-check`, verify at least 3 ratio card headings are visible (Savings Rate, Emergency Fund, TDSR or similar).
2. **Cards show colored status** — verify cards have green/yellow/red class indicators or status text.
3. **Tax optimization panel visible** — verify "Tax Optimization" heading exists.
4. **Insurance panel visible** — verify "Insurance" heading exists.

Pattern: `quickOnboarding` then `page.goto('/health-check')`. Health check should render with the default onboarding values.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test health-check --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/health-check.spec.ts
git commit -m "test(e2e): add health check tests (P1)"
```

---

### Task 6: Backtest & Sequence Risk Tests (P1)

**Files:**
- Create: `e2e/backtest-sequence-risk.spec.ts`

- [ ] **Step 1: Write test file**

These require Advanced mode to access all stress test tabs. Use `test.setTimeout(120_000)` for simulation time.

Tests to include:
1. **Backtest tab renders** — switch to Advanced mode, click Historical Backtest tab, click Run, verify cohort results table appears.
2. **SWR heatmap renders** — after running backtest, verify heatmap SVG or colored grid is visible.
3. **Sequence Risk tab renders** — click Sequence Risk tab, verify crisis comparison chart is visible with at least one crisis label (e.g., "GFC", "Dot-com").
4. **Mitigation options visible** — on sequence risk tab, verify mitigation toggles exist (bond tent, cash buffer).

Pattern: `quickOnboarding` then navigate to `/stress-test`, switch to Advanced, interact with tabs.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test backtest-sequence-risk --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/backtest-sequence-risk.spec.ts
git commit -m "test(e2e): add backtest and sequence risk tests (P1)"
```

---

### Task 7: Allocation Tests (P1)

**Files:**
- Create: `e2e/allocation.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **Template selection** — expand allocation section, click "Balanced" template, verify equities/bonds/cash weights update.
2. **Manual weight edit** — change equities weight, verify total is displayed.
3. **Validation error for sum != 100%** — set weights that don't sum to 100%, verify error message.
4. **Return override** — override expected return for equities, verify portfolio expected return updates.

Pattern: `quickOnboarding` then `expandSection(page, 'section-allocation')`.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test allocation --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/allocation.spec.ts
git commit -m "test(e2e): add allocation section tests (P1)"
```

---

### Task 8: Expenses Tests (P1)

**Files:**
- Create: `e2e/expenses.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **Expense adjustment** — expand spending section, add an expense adjustment (e.g., child education age 40-55), verify it appears in the list.
2. **Retirement spending adjustment** — set to 80%, navigate to dashboard, verify FIRE number decreased compared to 100%.
3. **Guaranteed income entry** — add a guaranteed income stream (e.g., annuity $12K/yr), verify it appears.

Pattern: `quickOnboarding` then `expandSection(page, 'section-expenses')`.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test expenses --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/expenses.spec.ts
git commit -m "test(e2e): add expenses section tests (P1)"
```

---

### Task 9: Household Couple Tests (P1)

**Files:**
- Create: `e2e/household-couple.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **Create couple plan** — on start page or inputs, switch plan type to "Couple", verify partner section appears.
2. **Per-adult tabs on inputs** — verify adult selector/tabs appear in income section.
3. **Projection shows combined** — navigate to projection, verify table renders with data from both adults.

This test requires understanding how the couple plan toggle works in the UI. Read the household plan store's `planType` to understand the flow.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test household-couple --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/household-couple.spec.ts
git commit -m "test(e2e): add household couple plan tests (P1)"
```

---

### Task 10: CPF Section Tests (P1)

**Files:**
- Create: `e2e/cpf-section.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **Enter CPF balances** — expand CPF section, fill OA/SA/MA balances, verify total CPF displayed.
2. **CPF projection table** — navigate to projection, verify CPF columns appear (OA, SA, MA).
3. **CPF LIFE payout** — set CPF LIFE start age, verify payout appears in projection at that age.

Pattern: CPF section is `#section-cpf` on the inputs page. CPF must be enabled (it's on by default from onboarding).

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test cpf-section --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/cpf-section.spec.ts
git commit -m "test(e2e): add CPF section tests (P1)"
```

---

### Task 11: Stamp Duty Calculator Tests (P2)

**Files:**
- Create: `e2e/stamp-duty.spec.ts`

- [ ] **Step 1: Write test file**

These are standalone public pages that don't require onboarding.

Tests to include:
1. **BSD only for citizen first property** — go to `/stamp-duty-calculator`, enter $1M, select Citizen, First Property. Verify BSD shown, ABSD = $0.
2. **ABSD for citizen second property** — select Second Property, verify ABSD appears (20% of $1M = $200K).
3. **ABSD for foreigner** — select Foreigner, verify ABSD 60%.

Pattern: `page.goto('/stamp-duty-calculator')` directly. No onboarding needed.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test stamp-duty --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/stamp-duty.spec.ts
git commit -m "test(e2e): add stamp duty calculator tests (P2)"
```

---

### Task 12: SRS Calculator Tests (P2)

**Files:**
- Create: `e2e/srs-calculator.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **Tax savings estimate** — go to `/srs-calculator`, enter income, verify tax savings figure appears.
2. **Contribution cap displayed** — verify the SRS contribution cap is shown ($15,300 for citizens).

Pattern: `page.goto('/srs-calculator')` directly.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test srs-calculator --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/srs-calculator.spec.ts
git commit -m "test(e2e): add SRS calculator tests (P2)"
```

---

### Task 13: Fee Comparison Tests (P2)

**Files:**
- Create: `e2e/fee-comparison.spec.ts`

- [ ] **Step 1: Write test file**

Tests to include:
1. **Comparison table renders** — go to `/compare`, enter portfolio size, verify platform comparison table appears with multiple rows.
2. **Values update on input change** — change portfolio size, verify fee numbers update.

Pattern: `page.goto('/compare')` directly.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx playwright test fee-comparison --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/fee-comparison.spec.ts
git commit -m "test(e2e): add fee comparison tests (P2)"
```

---

## Execution Notes

- Tasks 1-2 must run sequentially (Task 2 depends on helpers from Task 1).
- Tasks 3-13 are independent and can run in parallel.
- After all tasks: run `npx playwright test --reporter=list` to verify no cross-test interference.
- If a test is flaky due to timing, prefer `await expect(...).toBeVisible({ timeout: 10000 })` over arbitrary `waitForTimeout`.
