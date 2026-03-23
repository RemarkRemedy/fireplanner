import { test, expect, type Page, type Locator } from '@playwright/test'
import { navigateVia, expectRoute, expandSection } from './helpers'

// ── Onboarding helper (multi-step setup wizard) ─────────────────────

async function fillInput(locator: Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Complete the setup wizard with known defaults:
 * Age 30, retirement 55, income $100K/yr, expenses $50K/yr, savings $200K.
 * Ends on /projection (desktop).
 */
async function completeSetupWizard(page: Page) {
  // Clear state and navigate to start
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')

  // Select "I know when I want to retire" pathway
  await page.getByText('I know when I want to retire').click()
  await page.waitForURL(/\/setup/, { timeout: 10000 })
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 })

  // Step-specific values to fill on visible numeric/currency inputs
  const stepValues: Record<string, string[]> = {
    'How old are you': ['30', '55'],       // age, retirement age
    'What do you earn': ['8333'],           // monthly income (~$100K/yr)
    'What do you spend': ['4167'],          // monthly expenses (~$50K/yr)
    'What have you saved': ['200000'],      // savings
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    // Check if we've reached the review checkpoint
    const looksGood = page.getByRole('button', { name: /looks good/i })
    if (await looksGood.isVisible({ timeout: 500 }).catch(() => false)) {
      await looksGood.click()
      // After confirmation, wizard navigates to /projection (desktop)
      await page.waitForURL(/\/(projection|wrapped|inputs|dashboard)/, { timeout: 15000 })
      return
    }

    // Get current page content to determine which step we're on
    const pageText = await page.locator('body').textContent() ?? ''

    // Fill inputs based on current step
    for (const [stepTitle, values] of Object.entries(stepValues)) {
      if (pageText.includes(stepTitle)) {
        const inputs = page.locator('input[inputmode="numeric"]:visible, input[inputmode="decimal"]:visible')
        const count = await inputs.count()
        for (let i = 0; i < Math.min(count, values.length); i++) {
          await fillInput(inputs.nth(i), values[i])
        }
        break
      }
    }

    // Handle income toggle - ensure "I earn employment or business income" is enabled
    if (pageText.includes('What do you earn')) {
      const toggle = page.getByRole('switch').first()
      if (await toggle.isVisible().catch(() => false)) {
        const checked = await toggle.getAttribute('aria-checked')
        if (checked !== 'true') {
          await toggle.click()
          await page.waitForTimeout(300)
          // Fill income after toggle appears
          const incomeInputs = page.locator('input[inputmode="numeric"]:visible, input[inputmode="decimal"]:visible')
          const incomeCount = await incomeInputs.count()
          if (incomeCount > 0) {
            await fillInput(incomeInputs.first(), '8333')
          }
        }
      }
    }

    // Click Continue or "Review your answers"
    const nextBtn = page.getByRole('button', { name: /continue|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }
}

/**
 * Complete onboarding and navigate to /inputs.
 */
async function setupAndGoToInputs(page: Page) {
  await completeSetupWizard(page)
  // Navigate to inputs page
  await page.goto('/inputs')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('main')).not.toBeEmpty({ timeout: 10000 })
}

// ── Life events helpers ─────────────────────────────────────────────

/**
 * Enable life events for the selected adult on the Inputs page.
 * Scrolls to the Life Events card and flips the Enabled switch if needed.
 */
async function enableLifeEvents(page: Page) {
  // Find the card containing "Life Events" in its title
  const lifeEventsHeading = page.getByText(/Life Events$/).first()
  await lifeEventsHeading.scrollIntoViewIfNeeded()

  // The switch is near the heading
  const cardArea = lifeEventsHeading.locator('..').locator('..')
  const switchEl = cardArea.getByRole('switch')
  await expect(switchEl).toBeVisible({ timeout: 5000 })
  const checked = await switchEl.getAttribute('aria-checked')
  if (checked !== 'true') {
    await switchEl.click()
  }
  // Wait for the templates section to appear
  await expect(page.getByText('Templates:', { exact: true })).toBeVisible({ timeout: 5000 })
}

/**
 * Click a life event template button by label text.
 * Assumes life events are already enabled.
 */
async function addLifeEventTemplate(page: Page, templateLabel: string) {
  await page.getByRole('button', { name: templateLabel, exact: true }).click()
  // Wait for the event card to appear (has a "Remove" button)
  await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible({ timeout: 5000 })
}

// ── Projection helpers ──────────────────────────────────────────────

/**
 * Navigate to the projection page and wait for the table.
 */
async function goToProjectionTable(page: Page): Promise<Locator> {
  await navigateVia(page, 'Projection')
  await expectRoute(page, '/projection')
  const table = page.locator('table').first()
  await expect(table).toBeVisible({ timeout: 10000 })
  return table
}

/**
 * Find column index by matching header text with a regex.
 */
async function findColumnIndex(table: Locator, pattern: RegExp): Promise<number> {
  const headers = await table.locator('thead th').allTextContents()
  const idx = headers.findIndex((h) => pattern.test(h))
  if (idx === -1) {
    throw new Error(`Column matching ${pattern} not found. Headers: ${JSON.stringify(headers)}`)
  }
  return idx
}

/**
 * Get the row for a given age (matches first cell exactly).
 */
function rowByAge(table: Locator, page: Page, age: number): Locator {
  return table.locator('tbody tr').filter({
    has: page.locator('td:first-child', { hasText: new RegExp(`^${age}$`) }),
  })
}

/**
 * Parse a dollar string like "$72,000" into a number.
 */
function parseDollar(s: string | null): number {
  return Number((s ?? '0').replace(/[$,]/g, ''))
}

/**
 * Read a numeric cell value from a row at a given column index.
 */
async function cellValue(row: Locator, colIdx: number): Promise<number> {
  const cell = row.locator('td').nth(colIdx)
  await expect(cell).toBeVisible({ timeout: 3000 })
  const text = await cell.textContent()
  return parseDollar(text)
}

// ── Tests ───────────────────────────────────────────────────────────

test.describe('Life Events Income Contract', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndGoToInputs(page)
    await expandSection(page, 'section-income')
  })

  test('Test 1: Career Break template shows 0% income', async ({ page }) => {
    await enableLifeEvents(page)
    await addLifeEventTemplate(page, 'Career Break at 35')

    // Find the event card by the name input value
    const eventCard = page.locator('.rounded-lg.border').filter({
      has: page.locator('input[value="Career Break"]'),
    }).first()
    await expect(eventCard).toBeVisible()

    // "Income during event" field should show 0.0 (stored as 0 decimal = 0%)
    const incomeField = eventCard.getByLabel('Income during event')
    await expect(incomeField).toHaveValue('0.0')
  })

  test('Test 2: Part-time 50% income — verify in projection', async ({ page }) => {
    await enableLifeEvents(page)
    await addLifeEventTemplate(page, 'Part-time 40-45')

    // Verify "Income during event" shows 50.0
    const eventCard = page.locator('.rounded-lg.border').filter({
      has: page.locator('input[value="Part-time Work"]'),
    }).first()
    await expect(eventCard).toBeVisible()
    const incomeField = eventCard.getByLabel('Income during event')
    await expect(incomeField).toHaveValue('50.0')

    // Navigate to Projection
    const table = await goToProjectionTable(page)
    const colIdx = await findColumnIndex(table, /net income/i)

    // Compare income at age 38 (before event) vs age 42 (during 40-45 event)
    const income38 = await cellValue(rowByAge(table, page, 38), colIdx)
    const income42 = await cellValue(rowByAge(table, page, 42), colIdx)

    // Income at 42 should be 35-65% of income at 38
    // (50% template, but CPF and tax may shift the net ratio)
    expect(income38).toBeGreaterThan(0)
    const ratio = income42 / income38
    expect(ratio).toBeGreaterThanOrEqual(0.35)
    expect(ratio).toBeLessThanOrEqual(0.65)
  })

  test('Test 3: Manually set 80% — verify in projection', async ({ page }) => {
    await enableLifeEvents(page)
    await addLifeEventTemplate(page, 'Part-time 40-45')

    // Change "Income during event" from 50.0 to 80
    const eventCard = page.locator('.rounded-lg.border').filter({
      has: page.locator('input[value="Part-time Work"]'),
    }).first()
    const incomeField = eventCard.getByLabel('Income during event')
    await incomeField.click()
    await incomeField.fill('80')
    await incomeField.blur()

    // Navigate to Projection
    const table = await goToProjectionTable(page)
    const colIdx = await findColumnIndex(table, /net income/i)

    const income38 = await cellValue(rowByAge(table, page, 38), colIdx)
    const income42 = await cellValue(rowByAge(table, page, 42), colIdx)

    // Income at 42 should be 65-95% of income at 38
    expect(income38).toBeGreaterThan(0)
    const ratio = income42 / income38
    expect(ratio).toBeGreaterThanOrEqual(0.65)
    expect(ratio).toBeLessThanOrEqual(0.95)
  })

  test('Test 4: Career break delays FIRE but does not make it unreachable', async ({ page }) => {
    // Read baseline FIRE Age from the bottom status bar (always visible)
    // Format: "FIRE Age:  50" in the status bar
    const fireAgeText = page.getByText(/FIRE Age:\s*\d+/).first()
    await expect(fireAgeText).toBeVisible({ timeout: 10000 })
    const baselineRaw = await fireAgeText.textContent()
    const baselineMatch = baselineRaw?.match(/FIRE Age:\s*(\d+)/)
    const baselineAge = baselineMatch ? parseInt(baselineMatch[1], 10) : null

    // Enable life events, add Career Break (already on /inputs with income section expanded)
    await enableLifeEvents(page)
    await addLifeEventTemplate(page, 'Career Break at 35')

    // Wait for recalculation to propagate to the status bar
    await page.waitForTimeout(1000)

    // FIRE Age should still be visible (not infinity/unreachable)
    const newFireAgeText = page.getByText(/FIRE Age:\s*\d+/).first()
    await expect(newFireAgeText).toBeVisible({ timeout: 10000 })

    // If parseable, verify FIRE age increased (delayed) or stayed the same
    if (baselineAge != null) {
      const newRaw = await newFireAgeText.textContent()
      const newMatch = newRaw?.match(/FIRE Age:\s*(\d+)/)
      const newAge = newMatch ? parseInt(newMatch[1], 10) : null
      if (newAge != null) {
        expect(newAge).toBeGreaterThanOrEqual(baselineAge)
      }
    }
  })

  test('Test 5: Expense reduction reduces projection expenses', async ({ page }) => {
    await enableLifeEvents(page)
    await addLifeEventTemplate(page, 'Retrenchment at 50')

    // Navigate to Projection
    const table = await goToProjectionTable(page)
    const colIdx = await findColumnIndex(table, /daily expenses/i)

    // Expenses at age 50 should be less than at age 49
    const expenses49 = await cellValue(rowByAge(table, page, 49), colIdx)
    const expenses50 = await cellValue(rowByAge(table, page, 50), colIdx)

    expect(expenses49).toBeGreaterThan(0)
    expect(expenses50).toBeLessThan(expenses49)
  })

  test('Test 6: Overlapping life events do not crash', async ({ page }) => {
    await enableLifeEvents(page)
    await addLifeEventTemplate(page, 'Career Break at 35')
    await addLifeEventTemplate(page, 'Part-time 40-45')

    // Verify both event cards visible
    const careerBreakCard = page.locator('.rounded-lg.border').filter({
      has: page.locator('input[value="Career Break"]'),
    })
    const partTimeCard = page.locator('.rounded-lg.border').filter({
      has: page.locator('input[value="Part-time Work"]'),
    })
    await expect(careerBreakCard.first()).toBeVisible()
    await expect(partTimeCard.first()).toBeVisible()

    // Navigate to Projection — should render without error boundary
    const table = await goToProjectionTable(page)
    const rows = table.locator('tbody tr')
    expect(await rows.count()).toBeGreaterThan(5)

    // No error boundary visible
    await expect(page.getByText('Unexpected Application Error')).not.toBeVisible()
  })

  test('Test 7: Removing a life event restores income', async ({ page }) => {
    await enableLifeEvents(page)
    await addLifeEventTemplate(page, 'Part-time 40-45')

    // Verify the event card is visible
    const eventCard = page.locator('.rounded-lg.border').filter({
      has: page.locator('input[value="Part-time Work"]'),
    }).first()
    await expect(eventCard).toBeVisible()

    // Click Remove
    await eventCard.getByRole('button', { name: 'Remove' }).click()

    // Verify card is gone
    await expect(eventCard).not.toBeVisible({ timeout: 3000 })

    // Navigate to Projection — income at age 42 should be >= 95% of income at 38
    const table = await goToProjectionTable(page)
    const colIdx = await findColumnIndex(table, /net income/i)

    const income38 = await cellValue(rowByAge(table, page, 38), colIdx)
    const income42 = await cellValue(rowByAge(table, page, 42), colIdx)

    expect(income38).toBeGreaterThan(0)
    const ratio = income42 / income38
    // Without the life event, income should be nearly equal (within normal growth)
    expect(ratio).toBeGreaterThanOrEqual(0.95)
  })
})
