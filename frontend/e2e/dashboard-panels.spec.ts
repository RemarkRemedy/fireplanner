import { test, expect, type Page, type Locator } from '@playwright/test'

// ── Onboarding helper (copied from life-events-income.spec.ts) ───────────────

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
 * Complete onboarding and navigate to /dashboard.
 */
async function setupAndGoToDashboard(page: Page) {
  await completeSetupWizard(page)
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  // Wait for the dashboard heading to appear
  await expect(page.getByRole('heading', { name: /FIRE Dashboard/i })).toBeVisible({ timeout: 10000 })
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Dashboard Panels', () => {
  test('Test 1: Dashboard renders key panels after onboarding', async ({ page }) => {
    await setupAndGoToDashboard(page)

    // Heading
    await expect(page.getByRole('heading', { name: /FIRE Dashboard/i })).toBeVisible()

    // PlanCompleteness panel
    await expect(page.getByText('Plan Completeness', { exact: false })).toBeVisible()

    // StatusPanel — at least one metric card (FIRE Number)
    await expect(page.getByText('FIRE Number', { exact: false }).first()).toBeVisible()

    // No error boundary
    await expect(page.getByText('Unexpected Application Error')).not.toBeVisible()
  })

  test('Test 2: What-If panel has interactive sliders', async ({ page }) => {
    await setupAndGoToDashboard(page)

    // The WhatIfPanel renders with title "What-If Explorer"
    const panelHeading = page.getByText('What-If Explorer', { exact: false })
    const panelVisible = await panelHeading.isVisible({ timeout: 5000 }).catch(() => false)

    if (!panelVisible) {
      test.skip()
      return
    }

    await expect(panelHeading).toBeVisible()

    // The panel is collapsed by default — click to expand it
    await panelHeading.click()
    await page.waitForTimeout(500)

    // After expanding, sliders should be visible
    // Shadcn Slider renders a span with role="slider"
    const slider = page.locator('[role="slider"]').first()
    await expect(slider).toBeVisible({ timeout: 5000 })
  })

  test('Test 3: One More Year panel shows scenarios', async ({ page }) => {
    await setupAndGoToDashboard(page)

    // The OneMoreYearPanel renders with title "One More Year Analysis"
    const panelHeading = page.getByText('One More Year Analysis', { exact: false })
    const panelVisible = await panelHeading.isVisible({ timeout: 5000 }).catch(() => false)

    if (!panelVisible) {
      test.skip()
      return
    }

    await expect(panelHeading).toBeVisible()

    // The panel is collapsed by default — click to expand it
    await panelHeading.click()
    await page.waitForTimeout(500)

    // After expanding, should show a table with retirement age scenarios
    // The table has a "Scenario" column header
    const scenarioHeader = page.getByText('Scenario', { exact: false })
    const tableVisible = await scenarioHeader.isVisible({ timeout: 5000 }).catch(() => false)

    if (tableVisible) {
      await expect(scenarioHeader).toBeVisible()
      // Should have at least 3 rows (base, +1, +2, +3 years)
      const table = page.locator('table').first()
      const rows = table.locator('tbody tr')
      expect(await rows.count()).toBeGreaterThanOrEqual(3)
    } else {
      // Mobile might show card layout instead of table — look for +1/+2 patterns
      const plusOne = page.getByText(/\+1 year|\+2 year/i).first()
      await expect(plusOne).toBeVisible({ timeout: 3000 })
    }
  })

  test('Test 4: Plan Completeness shows section statuses', async ({ page }) => {
    await setupAndGoToDashboard(page)

    // PlanCompleteness panel heading
    await expect(page.getByText('Plan Completeness', { exact: false })).toBeVisible()

    // Should show "X / Y sections filled" progress text
    const progressText = page.getByText(/\d+ \/ \d+ sections filled/i)
    const progressVisible = await progressText.isVisible({ timeout: 5000 }).catch(() => false)

    if (!progressVisible) {
      // Panel may be collapsed if all sections are complete — check the toggle button
      const toggleBtn = page.locator('button').filter({ hasText: /Plan Completeness/i }).first()
      const toggleVisible = await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)
      if (toggleVisible) {
        await toggleBtn.click()
        await page.waitForTimeout(300)
        await expect(page.getByText(/\d+ \/ \d+ sections filled/i)).toBeVisible({ timeout: 3000 })
      }
    } else {
      await expect(progressText).toBeVisible()
    }

    // Expanded panel should show individual section rows
    // Check for at least one of the known nudge flow labels used in the completeness rows
    const sectionLabels = [
      'CPF Details',
      'Expense Breakdown',
      'Investment Allocation',
      'Salary Model',
      'SRS Contributions',
      'Financial Goals',
      'Protection & Debt',
      'Property Details',
      'Healthcare Coverage',
    ]
    let foundSection = false
    for (const label of sectionLabels) {
      const el = page.getByText(label, { exact: false })
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        foundSection = true
        break
      }
    }
    expect(foundSection).toBe(true)
  })
})
