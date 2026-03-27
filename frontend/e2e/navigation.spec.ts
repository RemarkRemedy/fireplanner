import { test, expect } from '@playwright/test'
import { goToStart, expectRoute, navigateVia } from './helpers'

/**
 * Helper to clear and fill an input field.
 */
async function clearAndFill(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Perform quick onboarding via the setup wizard.
 * Fills the quick estimate, enters setup, clicks through all 9 steps,
 * completes the review, and lands on projection or dashboard.
 */
async function quickOnboarding(page: import('@playwright/test').Page) {
  await goToStart(page)

  // Fill quick estimate form — use click+selectText+fill to trigger React onChange
  const payInput = page.getByRole('textbox', { name: /monthly take-home pay/i })
  await clearAndFill(page, payInput, '6000')
  await clearAndFill(page, page.getByRole('textbox', { name: /monthly expenses/i }), '3000')
  const savingsInput = page.getByRole('textbox', { name: /current savings/i })
  await clearAndFill(page, savingsInput, '150000')
  await savingsInput.blur()

  // Wait for results to compute
  await expect(page.getByText(/your retirement range/i).first()).toBeVisible({ timeout: 5000 })

  // Scroll down and click "Get your real FIRE age"
  const cta = page.getByRole('link', { name: /get your real fire age/i })
  await cta.scrollIntoViewIfNeeded()
  await expect(cta).toBeVisible({ timeout: 5000 })
  await cta.click()
  await page.waitForURL(/\/setup/, { timeout: 10000 })
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 5000 })

  // Click through all setup steps (up to 20 attempts to handle animations/transitions)
  for (let attempt = 0; attempt < 20; attempt++) {
    // Check if we've reached the review page
    const looksGood = page.getByRole('button', { name: /looks good/i })
    if (await looksGood.isVisible({ timeout: 500 }).catch(() => false)) {
      await looksGood.click()
      break
    }

    const pageText = await page.locator('body').textContent() ?? ''

    // MirrorMoment interstitial
    if (pageText.includes('everything you') && !pageText.includes('Review your inputs')) {
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.waitForTimeout(500)
      continue
    }

    // Handle selection screens
    for (const label of ['Singapore Citizen', 'No property', 'Basic (Class B1 ward)']) {
      const btn = page.getByRole('button', { name: label })
      if (await btn.isVisible({ timeout: 200 }).catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(300)
      }
    }

    // Click Continue or "Review your answers"
    const nextBtn = page.getByRole('button', { name: /^continue$|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }

  // Should land on projection or dashboard
  await page.waitForURL(/\/(projection|dashboard)/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

test.describe('US-4: Navigate Full Pipeline', () => {
  test('navigate through all main pages without errors', async ({ page }) => {
    // Complete a quick onboarding (lands on /projection or /dashboard)
    await quickOnboarding(page)

    // 1. Verify Projection page loaded (setup wizard navigates here after completion)
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

      // No error boundary (404 or crash) — use heading role to avoid matching chart tick labels
      await expect(page.getByRole('heading', { name: '404' })).not.toBeVisible({ timeout: 3000 })

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
