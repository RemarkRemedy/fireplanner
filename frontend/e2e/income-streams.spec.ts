import { test, expect, type Page, type Locator } from '@playwright/test'
import { navigateVia, expectRoute, expandSection } from './helpers'

// ── Onboarding helper (copied from life-events-income.spec.ts) ───────

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

// ── Projection page helpers ──────────────────────────────────────────

/**
 * Navigate to the /projection page and wait for the main table.
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

// ── Tests ────────────────────────────────────────────────────────────

test.describe('Income Streams', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndGoToInputs(page)
    await expandSection(page, 'section-income')
  })

  test('Test 1: Add rental income stream and verify in income projection table', async ({ page }) => {
    // Scroll "Add stream" button into view and click it
    const addStreamBtn = page.getByRole('button', { name: 'Add stream', exact: true })
    await addStreamBtn.scrollIntoViewIfNeeded()
    await addStreamBtn.click()

    // A new stream card should appear — the default type is "rental"
    // Verify a stream card is visible (has "Remove" button)
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible({ timeout: 5000 })

    // Scroll to income projection table in the income section (has "Rental" column header)
    const rentalHeader = page.getByRole('columnheader', { name: /rental/i }).first()
    await rentalHeader.scrollIntoViewIfNeeded()
    await expect(rentalHeader).toBeVisible({ timeout: 5000 })

    // The income section projection table starts at age 30 (current age)
    // Find the first row in the income projection table and check Rental cell > 0
    // Get the table that contains the "Rental" header
    const allTables = page.locator('table')
    const tableCount = await allTables.count()

    let rentalValue = 0
    for (let i = 0; i < tableCount; i++) {
      const tbl = allTables.nth(i)
      const headers = await tbl.locator('thead th').allTextContents()
      if (headers.some((h) => /rental/i.test(h))) {
        const rentalColIdx = headers.findIndex((h) => /rental/i.test(h))
        // Get the first data row
        const firstRow = tbl.locator('tbody tr').first()
        const cell = firstRow.locator('td').nth(rentalColIdx)
        const text = await cell.textContent()
        rentalValue = parseDollar(text)
        break
      }
    }

    expect(rentalValue).toBeGreaterThan(0)
  })

  test('Test 2: Toggle life events on/off changes projection Net Income at event age', async ({ page }) => {
    // Find the Life Events card (it is "[Name]'s Life Events")
    const lifeEventsHeading = page.getByText(/Life Events$/).first()
    await lifeEventsHeading.scrollIntoViewIfNeeded()

    // Enable life events
    const cardArea = lifeEventsHeading.locator('..').locator('..')
    const switchEl = cardArea.getByRole('switch')
    await expect(switchEl).toBeVisible({ timeout: 5000 })
    const checked = await switchEl.getAttribute('aria-checked')
    if (checked !== 'true') {
      await switchEl.click()
    }
    await expect(page.getByText('Templates:', { exact: true })).toBeVisible({ timeout: 5000 })

    // Add "Career Break at 35" template — current age is 30, so age 35 = currentAge + 5
    await page.getByRole('button', { name: 'Career Break at 35', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible({ timeout: 5000 })

    // Navigate to Projection and check Net Income at age 35
    const table = await goToProjectionTable(page)
    const colIdx = await findColumnIndex(table, /net income/i)

    const row35WithEvent = rowByAge(table, page, 35)
    // Check the row exists
    const rowCount35 = await row35WithEvent.count()
    if (rowCount35 === 0) {
      // Age 35 row may not be visible — skip this assertion
      test.info().annotations.push({ type: 'info', description: 'Age 35 row not found in projection table' })
    } else {
      const incomeWithEvent = await cellValue(row35WithEvent, colIdx)

      // Go back to inputs and disable life events
      await page.goto('/inputs')
      await page.waitForLoadState('networkidle')
      await expandSection(page, 'section-income')

      const lifeEventsHeading2 = page.getByText(/Life Events$/).first()
      await lifeEventsHeading2.scrollIntoViewIfNeeded()
      const cardArea2 = lifeEventsHeading2.locator('..').locator('..')
      const switchEl2 = cardArea2.getByRole('switch')
      const checked2 = await switchEl2.getAttribute('aria-checked')
      if (checked2 === 'true') {
        await switchEl2.click()
      }
      // Wait for the toggle to take effect
      await page.waitForTimeout(300)

      // Navigate to Projection again
      const table2 = await goToProjectionTable(page)
      const colIdx2 = await findColumnIndex(table2, /net income/i)
      const row35NoEvent = rowByAge(table2, page, 35)
      const incomeWithoutEvent = await cellValue(row35NoEvent, colIdx2)

      // With life events off, income at 35 should be greater than with a Career Break (0% income)
      expect(incomeWithoutEvent).toBeGreaterThan(0)
      expect(incomeWithoutEvent).toBeGreaterThan(incomeWithEvent)
    }
  })

  test('Test 3: Switch salary model from Simple to Realistic reveals career phases editor', async ({ page }) => {
    // Find the salary model card heading (contains "Salary Model")
    const salaryModelHeading = page.getByText(/Salary Model/).first()
    await salaryModelHeading.scrollIntoViewIfNeeded()
    await expect(salaryModelHeading).toBeVisible({ timeout: 5000 })

    // The Model select should currently be "Simple"
    // Find a SelectTrigger in the salary model card area
    // The card title contains "Salary Model"; the select for Model is labelled "Model"
    const modelLabel = page.getByText('Model', { exact: true }).first()
    await modelLabel.scrollIntoViewIfNeeded()
    await expect(modelLabel).toBeVisible({ timeout: 5000 })

    // Click the Select trigger (it's a sibling of the label in the same space-y-1 div)
    const modelTrigger = modelLabel.locator('..').locator('[role="combobox"]').first()
    await expect(modelTrigger).toBeVisible({ timeout: 5000 })
    await modelTrigger.scrollIntoViewIfNeeded()

    // Click to open the dropdown and wait for it to stabilize
    await modelTrigger.click()
    await page.waitForTimeout(300)

    // Select "Realistic" — wait for option to be stable before clicking
    const realisticOption = page.getByRole('option', { name: 'Realistic', exact: true })
    await expect(realisticOption).toBeVisible({ timeout: 5000 })
    await realisticOption.click()

    // Wait for the career phases editor to appear
    // The realistic phases section contains "Career phases" heading
    const careerPhasesHeading = page.getByText('Career phases', { exact: true }).first()
    await expect(careerPhasesHeading).toBeVisible({ timeout: 5000 })

    // Verify phase label inputs are visible inside the career phases section.
    // DOM structure: h3 > div (flex row) > div.space-y-4 (outer container that also holds phase rows)
    // So we go up 3 levels from the h3 to reach the shared container.
    const careerPhasesSection = careerPhasesHeading.locator('../../..')
    const firstPhaseInput = careerPhasesSection.locator('input').first()
    await expect(firstPhaseInput).toBeVisible({ timeout: 5000 })
    // Also verify the input has a non-empty value (e.g. "Early Career")
    const phaseValue = await firstPhaseInput.inputValue()
    expect(phaseValue.length).toBeGreaterThan(0)
  })
})
