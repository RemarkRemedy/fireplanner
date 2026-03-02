import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, fillGoalFirstForm } from './helpers'

/**
 * US-7: Compare Withdrawal Strategies
 *
 * Complete onboarding, navigate to withdrawal page, verify strategies
 * are listed, toggle strategies for comparison, and verify comparison
 * table with withdrawal amounts renders.
 */

async function completeOnboarding(page: import('@playwright/test').Page) {
  await goToStart(page)
  await selectPathway(page, 'goal-first')
  await fillGoalFirstForm(page, {
    age: '30',
    retirementAge: '55',
    income: '100000',
    expenses: '50000',
    savings: '200000',
  })
  await page.getByRole('button', { name: /build my full plan/i }).click()
  await expect(page).toHaveURL(/\/inputs/)
  await page.waitForLoadState('networkidle')
}

test.describe('Withdrawal Strategies', () => {
  test('displays strategy selection buttons', async ({ page }) => {
    await completeOnboarding(page)

    // Navigate to the withdrawal page
    await page.getByRole('link', { name: /withdrawal/i }).first().click()
    await expect(page).toHaveURL(/\/withdrawal/)
    await page.waitForLoadState('networkidle')

    // The page should show the title
    await expect(page.getByText('Withdrawal Strategies').first()).toBeVisible()

    // Strategy Selection card should be visible
    await expect(page.getByText('Strategy Selection & Parameters')).toBeVisible()

    // Check that some strategy names are visible as buttons
    // Default simple mode shows these strategies
    await expect(page.getByRole('button', { name: /Constant Dollar/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /VPW|Variable Percentage/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Guardrails/i }).first()).toBeVisible()
  })

  test('can toggle strategies and see comparison table', async ({ page }) => {
    await completeOnboarding(page)

    // Navigate to the withdrawal page
    await page.getByRole('link', { name: /withdrawal/i }).first().click()
    await expect(page).toHaveURL(/\/withdrawal/)
    await page.waitForLoadState('networkidle')

    // Ensure Constant Dollar strategy is active (it should be by default)
    // Click on VPW to add it to comparison
    const vpwButton = page.getByRole('button', { name: /Variable Percentage \(VPW\)/i }).first()
    await vpwButton.click()

    // Also add Guardrails
    const guardrailsButton = page.getByRole('button', { name: /Guardrails/i }).first()
    await guardrailsButton.click()

    // Wait for the comparison table to render
    // The ComparisonTable card has title "Strategy Comparison Summary"
    await expect(page.getByText('Strategy Comparison Summary')).toBeVisible({ timeout: 5000 })

    // The comparison table should have column headers
    await expect(page.getByText('Avg Withdrawal')).toBeVisible()
    await expect(page.getByText('Terminal Portfolio')).toBeVisible()
    await expect(page.getByText('Survived')).toBeVisible()

    // Withdrawal amounts should show dollar values ($ followed by digits)
    const dollarValues = page.locator('td').filter({ hasText: /^\$[\d,]+/ })
    const count = await dollarValues.count()
    expect(count).toBeGreaterThan(0)
  })

  test('shows withdrawal and portfolio charts', async ({ page }) => {
    await completeOnboarding(page)

    // Navigate to the withdrawal page
    await page.getByRole('link', { name: /withdrawal/i }).first().click()
    await expect(page).toHaveURL(/\/withdrawal/)
    await page.waitForLoadState('networkidle')

    // Make sure at least one strategy is active to trigger chart rendering
    // The default state should have Constant Dollar active
    // Verify charts appear (Recharts containers)
    const charts = page.locator('.recharts-responsive-container')
    // There should be withdrawal and portfolio charts
    await expect(charts.first()).toBeVisible({ timeout: 5000 })
  })
})
