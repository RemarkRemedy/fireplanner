import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, expectRoute } from './helpers'

/**
 * Helper to clear and fill an input field.
 */
async function clearAndFill(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Perform quick onboarding via goal-first pathway with known data.
 */
async function quickOnboarding(page: import('@playwright/test').Page) {
  await goToStart(page)
  await selectPathway(page, 'goal-first')
  await expect(page.getByText('Set your targets')).toBeVisible()

  const formInputs = page.locator('main input[inputmode="numeric"]')
  await expect(formInputs).toHaveCount(5, { timeout: 5000 })

  // Age 30, retire at 50, income 72000, expenses 48000, savings 100000
  await clearAndFill(page, formInputs.nth(0), '30')
  await clearAndFill(page, formInputs.nth(1), '50')
  await clearAndFill(page, formInputs.nth(2), '72000')
  await clearAndFill(page, formInputs.nth(3), '48000')
  await clearAndFill(page, formInputs.nth(4), '100000')
  await formInputs.nth(4).blur()

  await expect(page.getByText('FIRE Number:').first()).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: /build my full plan/i }).click()
  await expectRoute(page, '/inputs')
  await page.waitForLoadState('networkidle')
}

test.describe('US-5: View Year-by-Year Projection', () => {
  test('projection table renders with age rows', async ({ page }) => {
    await quickOnboarding(page)

    // Navigate to projection page
    await page.goto('/projection')
    await page.waitForLoadState('networkidle')

    // Verify the page heading
    await expect(page.getByText('Year-by-Year Projection').first()).toBeVisible({ timeout: 5000 })

    // Verify summary cards are present (FIRE Achieved card)
    await expect(page.getByText('FIRE Achieved', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    // Verify the table is rendered with the default table view
    // The table should have rows with age values (starting from current age 30)
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 5000 })

    // Check for header cells: Age, Income, Expenses, etc.
    await expect(page.getByRole('columnheader', { name: 'Age' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Income' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Expenses' })).toBeVisible()

    // Verify there are data rows (at least a few age entries visible)
    const tableRows = table.locator('tbody tr')
    await expect(tableRows.first()).toBeVisible()
    // The table should have many rows (from age 30 to ~90)
    expect(await tableRows.count()).toBeGreaterThan(5)
  })

  test('dollar basis toggle switches between Real and Nominal', async ({ page }) => {
    await quickOnboarding(page)

    await page.goto('/projection')
    await page.waitForLoadState('networkidle')

    // Wait for table to be visible
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 5000 })

    // The default dollar basis is "real" (today's dollars)
    // Find the "Real $" and "Nominal $" toggle buttons
    const realBtn = page.getByRole('button', { name: 'Real $' })
    const nominalBtn = page.getByRole('button', { name: 'Nominal $' })

    await expect(realBtn).toBeVisible()
    await expect(nominalBtn).toBeVisible()

    // Click "Nominal $" to switch to nominal dollars
    await nominalBtn.click()

    // Verify the table still renders after toggle
    await expect(table).toBeVisible()
    const tableRows = table.locator('tbody tr')
    expect(await tableRows.count()).toBeGreaterThan(5)

    // The description text should now mention "future (nominal) dollars"
    await expect(page.getByText('future (nominal) dollars', { exact: false })).toBeVisible()

    // Switch back to Real $
    await realBtn.click()
    await expect(page.getByText("today's dollars", { exact: false })).toBeVisible()
  })

  test('chart view is available and renders SVG', async ({ page }) => {
    await quickOnboarding(page)

    await page.goto('/projection')
    await page.waitForLoadState('networkidle')

    // Wait for table to be visible first
    await expect(page.locator('table').first()).toBeVisible({ timeout: 5000 })

    // Click the "Chart" toggle button
    const chartBtn = page.getByRole('button', { name: /chart/i }).first()
    await expect(chartBtn).toBeVisible()
    await chartBtn.click()

    // Verify a chart is rendered (Recharts renders SVG inside a wrapper)
    await expect(page.locator('.recharts-wrapper, svg.recharts-surface').first()).toBeVisible({ timeout: 5000 })

    // Switch back to table view
    const tableBtn = page.getByRole('button', { name: /table/i }).first()
    await tableBtn.click()
    await expect(page.locator('table').first()).toBeVisible({ timeout: 5000 })
  })
})
