import { test, expect } from '@playwright/test'

/**
 * Load demo data for a fully populated plan.
 * Demo loads -> navigates to /projection with all data ready.
 */
async function quickOnboarding(page: import('@playwright/test').Page) {
  // Clear state and go to start
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')
  // Load demo data
  await page.getByText(/explore a demo/i).click()
  await expect(page).toHaveURL(/\/projection/, { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

test.describe('US-5: View Year-by-Year Projection', () => {
  test('projection table renders with age rows', async ({ page }) => {
    await quickOnboarding(page)

    // Verify the page heading
    await expect(page.getByText('Year-by-Year Projection').first()).toBeVisible({ timeout: 5000 })

    // Verify summary cards are present (FIRE Achieved card)
    await expect(page.getByText('FIRE Achieved', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    // Verify the table is rendered with the default table view
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 5000 })

    // Check for header cells: Age, Income, Expenses, etc.
    await expect(page.getByRole('columnheader', { name: 'Age' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Income' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Expenses' })).toBeVisible()

    // Verify there are data rows
    const tableRows = table.locator('tbody tr')
    await expect(tableRows.first()).toBeVisible()
    expect(await tableRows.count()).toBeGreaterThan(5)
  })

  test('dollar basis toggle switches between Real and Nominal', async ({ page }) => {
    await quickOnboarding(page)

    // Wait for table to be visible
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 5000 })

    // Find the dollar basis toggle buttons
    const realBtn = page.getByRole('button', { name: "Today's $" })
    const nominalBtn = page.getByRole('button', { name: 'Future $' })

    await expect(realBtn).toBeVisible()
    await expect(nominalBtn).toBeVisible()

    // Click "Future $" to switch to nominal dollars
    await nominalBtn.click()

    // Verify the table still renders after toggle
    await expect(table).toBeVisible()
    const tableRows = table.locator('tbody tr')
    expect(await tableRows.count()).toBeGreaterThan(5)

    // The description text should now mention "future (nominal) dollars"
    await expect(page.getByText('future (nominal) dollars', { exact: false })).toBeVisible()

    // Switch back to Today's $
    await realBtn.click()
    await expect(page.getByText("today's dollars", { exact: false })).toBeVisible()
  })

  test('net worth chart is rendered with projection data', async ({ page }) => {
    await quickOnboarding(page)

    // Wait for table to be visible (ensures data loaded)
    await expect(page.locator('table').first()).toBeVisible({ timeout: 5000 })

    // The NWChartView is always rendered above the table when data is present
    // It uses Recharts which renders SVG inside a wrapper
    await expect(page.locator('.recharts-wrapper, svg.recharts-surface').first()).toBeVisible({ timeout: 5000 })
  })
})
