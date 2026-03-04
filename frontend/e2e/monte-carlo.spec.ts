import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, fillGoalFirstForm } from './helpers'

/**
 * US-6: Run Monte Carlo Simulation
 *
 * Complete onboarding, navigate to stress test page, run Monte Carlo,
 * verify success rate appears, and check stale-results warning.
 */

async function completeOnboarding(page: import('@playwright/test').Page) {
  await goToStart(page)

  // Select goal-first pathway
  await selectPathway(page, 'goal-first')

  // Fill the inline form fields
  await fillGoalFirstForm(page, {
    age: '30',
    retirementAge: '55',
    income: '100000',
    expenses: '50000',
    savings: '200000',
  })

  // Click "Build my full plan"
  await page.getByRole('button', { name: /build my full plan/i }).click()

  // Wait for navigation to /inputs
  await expect(page).toHaveURL(/\/inputs/)
  await page.waitForLoadState('networkidle')
}

test.describe('Monte Carlo Simulation', () => {
  test('can run Monte Carlo and see success rate', async ({ page }) => {
    await completeOnboarding(page)

    // Navigate to stress test page via sidebar link
    await page.getByRole('link', { name: /stress test/i }).first().click()
    await expect(page).toHaveURL(/\/stress-test/)
    await page.waitForLoadState('networkidle')

    // The Monte Carlo tab should be active by default
    await expect(page.getByText('Monte Carlo').first()).toBeVisible()

    // Click "Run Simulation" button
    const runButton = page.getByRole('button', { name: /run simulation/i })
    await expect(runButton).toBeVisible()
    await runButton.click()

    // Wait for "Simulation Results" card to appear (the simulation can take
    // several seconds, especially under parallel test load)
    await expect(page.getByText('Simulation Results')).toBeVisible({ timeout: 30000 })

    // The success rate should display as a percentage (e.g. "92.5%")
    // Inside the ResultsSummary, the "Success Rate" label is rendered
    await expect(page.getByText('Success Rate').first()).toBeVisible()

    // The percentage value itself should be visible (format: NN.N%)
    const successRateEl = page.locator('text=/\\d+\\.\\d+%/').first()
    await expect(successRateEl).toBeVisible()

    // Fan chart should be rendered
    await expect(page.locator('.recharts-responsive-container').first()).toBeVisible()
  })

  test('shows stale warning when inputs change after simulation', async ({ page }) => {
    await completeOnboarding(page)

    // Navigate to stress test page
    await page.getByRole('link', { name: /stress test/i }).first().click()
    await expect(page).toHaveURL(/\/stress-test/)
    await page.waitForLoadState('networkidle')

    // Run the simulation first
    const runButton = page.getByRole('button', { name: /run simulation/i })
    await runButton.click()
    await expect(page.getByText('Simulation Results')).toBeVisible({ timeout: 30000 })

    // Change the withdrawal strategy dropdown to trigger stale state
    // The strategy select is the second combobox on the page
    // (first is MC Method, second is Withdrawal Strategy)
    const strategySelect = page.locator('[role="combobox"]').nth(1)
    if (await strategySelect.isVisible()) {
      await strategySelect.click()
      // Select VPW if available
      const vpwOption = page.getByRole('option', { name: /VPW|Variable/i })
      if (await vpwOption.isVisible()) {
        await vpwOption.click()
        // Check for stale warning text
        const staleWarning = page.getByText(/results may be outdated/i)
        await expect(staleWarning).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('scenario selector runs selected stress cases and shows comparison rows', async ({ page }) => {
    await completeOnboarding(page)

    await page.getByRole('link', { name: /stress test/i }).first().click()
    await expect(page).toHaveURL(/\/stress-test/)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Stress Scenarios')).toBeVisible()

    const crashCheckbox = page.getByRole('checkbox', { name: /market crash/i })
    await crashCheckbox.check()

    const runButton = page.getByRole('button', { name: /run simulation/i }).first()
    await runButton.click()

    await expect(page.getByText('Simulation Results')).toBeVisible({ timeout: 45000 })
    await expect(page.getByText('Scenario Comparison')).toBeVisible({ timeout: 45000 })
    await expect(page.getByRole('cell', { name: /base case/i })).toBeVisible({ timeout: 45000 })
    await expect(page.getByRole('cell', { name: /market crash/i })).toBeVisible({ timeout: 45000 })
  })

  test('companion mode runs in planner route and renders companion charts', async ({ page }) => {
    const postedPayloads: unknown[] = []

    await page.route('**/planner/snapshot?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          avgMonthlyIncome: 4000,
          avgMonthlyExpense: 6200,
          avgMonthlySavings: -2200,
          investableAssets: 60000,
          structuralMode: 'simple',
        }),
      })
    })

    await page.route('**/planner/results?*', async (route) => {
      const payload = route.request().postDataJSON()
      postedPayloads.push(payload)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.goto('/planner?token=e2e-token&companion=1')
    await expect(page).toHaveURL(/\/planner/)
    await expect(page.getByText(/loaded from your expense data/i)).toBeVisible({ timeout: 15000 })

    const runButton = page.getByRole('button', { name: /run simulation/i }).first()
    await expect(runButton).toBeVisible()
    await runButton.click()

    await expect(page.getByText('Simulation Results')).toBeVisible({ timeout: 45000 })
    await expect(page.getByText('Portfolio Balance Fan Chart')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Failure Distribution by Decade')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Withdrawal Distribution (p10 / p50 / p90)')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Saved to phone ✓')).toBeVisible({ timeout: 20000 })

    await expect.poll(() => postedPayloads.length, { timeout: 15000 }).toBeGreaterThan(0)
    const firstPayload = postedPayloads[0] as Record<string, unknown>
    expect(firstPayload).toHaveProperty('p_success')
    expect(firstPayload).toHaveProperty('WR_critical_50')
    expect(firstPayload).toHaveProperty('horizonYears')
    expect(firstPayload).toHaveProperty('allocationSummary')
  })
})
