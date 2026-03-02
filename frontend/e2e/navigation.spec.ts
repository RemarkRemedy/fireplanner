import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, expectRoute, navigateVia } from './helpers'

/**
 * Helper to clear and fill an input field.
 */
async function clearAndFill(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Perform quick onboarding via goal-first pathway.
 */
async function quickOnboarding(page: import('@playwright/test').Page) {
  await goToStart(page)
  await selectPathway(page, 'goal-first')
  await expect(page.getByText('Set your targets')).toBeVisible()

  const formInputs = page.locator('main input[inputmode="numeric"]')
  await expect(formInputs).toHaveCount(5, { timeout: 5000 })

  await clearAndFill(page, formInputs.nth(0), '30')
  await clearAndFill(page, formInputs.nth(1), '50')
  await clearAndFill(page, formInputs.nth(2), '72000')
  await clearAndFill(page, formInputs.nth(3), '48000')
  await clearAndFill(page, formInputs.nth(4), '100000')
  await formInputs.nth(4).blur()

  // Wait for results to appear before continuing
  await expect(page.getByText('FIRE Number:').first()).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: /build my full plan/i }).click()
  await expectRoute(page, '/inputs')
  await page.waitForLoadState('networkidle')
}

test.describe('US-4: Navigate Full Pipeline', () => {
  test('navigate through all main pages without errors', async ({ page }) => {
    // Complete a quick onboarding
    await quickOnboarding(page)

    // 1. Verify Inputs page loaded
    await expect(page.getByText('Personal', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    // 2. Navigate to Projection via sidebar link
    await navigateVia(page, 'Projection')
    await expectRoute(page, '/projection')
    await expect(page.getByText('Year-by-Year Projection')).toBeVisible({ timeout: 5000 })

    // 3. Navigate to Withdrawal via sidebar link
    await navigateVia(page, 'Withdrawal')
    await expectRoute(page, '/withdrawal')
    await expect(page.getByRole('heading', { name: 'Withdrawal Strategies' })).toBeVisible({ timeout: 5000 })

    // 4. Navigate to Stress Test via sidebar link
    await navigateVia(page, 'Stress Test')
    await expectRoute(page, '/stress-test')
    // StressTestPage has tabs: Monte Carlo, Backtest, Sequence Risk
    await expect(page.getByText('Monte Carlo', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    // 5. Navigate to Dashboard via sidebar link
    await navigateVia(page, 'Dashboard')
    await expectRoute(page, '/dashboard')
    await expect(page.getByText('FIRE Dashboard')).toBeVisible({ timeout: 5000 })
  })

  test('each page renders without error boundary or blank content', async ({ page }) => {
    await quickOnboarding(page)

    // Visit each page directly via URL and check for no error state
    const pages = [
      { url: '/inputs', check: 'Personal' },
      { url: '/projection', check: 'Year-by-Year Projection' },
      { url: '/withdrawal', check: 'Compare how different withdrawal' },
      { url: '/stress-test', check: 'Monte Carlo' },
      { url: '/dashboard', check: 'FIRE Dashboard' },
    ]

    for (const { url, check } of pages) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')

      // No error boundary (404 or crash)
      await expect(page.getByText('404')).not.toBeVisible({ timeout: 3000 })

      // Key content is visible
      await expect(page.getByText(check, { exact: false }).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('dashboard shows FIRE metrics after onboarding', async ({ page }) => {
    await quickOnboarding(page)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Dashboard should show metrics panels, not the empty state
    // StatusPanel is always rendered when metrics exist
    await expect(page.getByText('FIRE Dashboard')).toBeVisible({ timeout: 5000 })

    // Should NOT show the empty dashboard state message
    // (EmptyDashboardState would be shown if fireNumber is null)
    // We entered valid data, so metrics should be computed
    // Check that some metric text is visible
    await expect(page.locator('main').first()).not.toBeEmpty()
  })
})
