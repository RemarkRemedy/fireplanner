import { test, expect, type Page, type Locator } from '@playwright/test'

// ── Onboarding helper (copied from life-events-income.spec.ts) ──────────

async function fillInput(locator: Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Complete the setup wizard with known defaults.
 * Age 30, retirement 55, income $100K/yr, expenses $50K/yr, savings $200K.
 * Ends on /projection (desktop).
 */
async function completeSetupWizard(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')

  await page.getByText('I know when I want to retire').click()
  await page.waitForURL(/\/setup/, { timeout: 10000 })
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 })

  const stepValues: Record<string, string[]> = {
    'How old are you': ['30', '55'],
    'What do you earn': ['8333'],
    'What do you spend': ['4167'],
    'What have you saved': ['200000'],
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const looksGood = page.getByRole('button', { name: /looks good/i })
    if (await looksGood.isVisible({ timeout: 500 }).catch(() => false)) {
      await looksGood.click()
      await page.waitForURL(/\/(projection|wrapped|inputs|dashboard)/, { timeout: 15000 })
      return
    }

    const pageText = await page.locator('body').textContent() ?? ''

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

    if (pageText.includes('What do you earn')) {
      const toggle = page.getByRole('switch').first()
      if (await toggle.isVisible().catch(() => false)) {
        const checked = await toggle.getAttribute('aria-checked')
        if (checked !== 'true') {
          await toggle.click()
          await page.waitForTimeout(300)
          const incomeInputs = page.locator('input[inputmode="numeric"]:visible, input[inputmode="decimal"]:visible')
          const incomeCount = await incomeInputs.count()
          if (incomeCount > 0) {
            await fillInput(incomeInputs.first(), '8333')
          }
        }
      }
    }

    const nextBtn = page.getByRole('button', { name: /continue|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

test.describe('Dollar Basis Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await completeSetupWizard(page)
    // Ensure we land on /projection
    if (!page.url().includes('/projection')) {
      await page.goto('/projection')
      await page.waitForLoadState('networkidle')
    }
    // Wait for the projection table to be visible
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  })

  test('dollar basis toggle is visible on the projection page', async ({ page }) => {
    // The toggle is rendered as two sibling buttons inside a .bg-muted container.
    // Buttons have title attributes for accessibility.
    const todayBtn = page.getByTitle("Show values in today's purchasing power").first()
    const futureBtn = page.getByTitle('Show actual future dollar amounts').first()

    await expect(todayBtn).toBeVisible({ timeout: 10000 })
    await expect(futureBtn).toBeVisible({ timeout: 5000 })
  })

  test('switching between real and nominal changes table values without crashing', async ({ page }) => {
    const todayBtn = page.getByTitle("Show values in today's purchasing power").first()
    const futureBtn = page.getByTitle('Show actual future dollar amounts').first()

    // Ensure we start in "Today's $" (real) mode — click it if needed
    await todayBtn.click()
    await page.waitForTimeout(300)

    // Capture a sample cell value from the last row of the table in real mode
    const table = page.locator('table').first()
    const lastRow = table.locator('tbody tr').last()
    const cellsReal = await lastRow.locator('td').allTextContents()

    // Switch to "Future $" (nominal) mode
    await futureBtn.click()
    await page.waitForTimeout(300)

    // No error boundary should appear
    await expect(page.getByText('Unexpected Application Error')).not.toBeVisible()

    // The table should still be present with rows
    await expect(table).toBeVisible({ timeout: 5000 })
    const rowCount = await table.locator('tbody tr').count()
    expect(rowCount).toBeGreaterThan(5)

    // Capture the same last row in nominal mode
    const lastRowNominal = table.locator('tbody tr').last()
    const cellsNominal = await lastRowNominal.locator('td').allTextContents()

    // The values in the last row should differ between real and nominal
    // (nominal values are always >= real values because of accumulated inflation)
    // We check that at least one numeric cell differs between the two modes.
    const diffFound = cellsReal.some((realVal, i) => {
      const nomVal = cellsNominal[i] ?? ''
      const realNum = Number(realVal.replace(/[^0-9.-]/g, ''))
      const nomNum = Number(nomVal.replace(/[^0-9.-]/g, ''))
      return !isNaN(realNum) && !isNaN(nomNum) && realNum !== nomNum && realNum > 0
    })
    expect(diffFound).toBe(true)
  })
})
