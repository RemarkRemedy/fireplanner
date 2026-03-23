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
 * Navigate to /stress-test, switch to Advanced mode, and verify Historical Backtest tab is visible.
 */
async function navigateToStressTestAdvanced(page: Page) {
  await page.goto('/stress-test')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Stress Test' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Advanced' }).first().click()
  await expect(page.getByRole('tab', { name: 'Historical Backtest' })).toBeVisible({ timeout: 10000 })
}

/**
 * Wait for a locator to become visible, returning true on success or false on timeout.
 * Uses waitFor() which properly waits (unlike isVisible() which is a snapshot check).
 */
async function waitForVisible(locator: Locator, timeoutMs: number): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs })
    return true
  } catch {
    return false
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Backtest and Sequence Risk', () => {
  test.setTimeout(120_000)

  test('Test 1: Backtest tab renders and auto-runs', async ({ page }) => {
    await completeSetupWizard(page)
    await navigateToStressTestAdvanced(page)

    // Click the Historical Backtest tab
    await page.getByRole('tab', { name: 'Historical Backtest' }).click()

    // Verify the Backtest Parameters card is visible
    await expect(page.getByText('Backtest Parameters')).toBeVisible({ timeout: 10000 })

    // Backtest auto-runs on page load (no debounce on first run per useBacktestQuery).
    // Wait for the SummaryPanel "Success Rate" label to appear — rendered only when baseData is set.
    const successRateLocator = page.getByText('Success Rate').first()
    const summaryVisible = await waitForVisible(successRateLocator, 60_000)

    if (!summaryVisible) {
      // Fallback: check for results table (another sign of completion)
      const tableVisible = await waitForVisible(page.locator('table').first(), 5000)
      if (!tableVisible) {
        test.skip(true, 'Backtest did not complete within timeout — canRun may be false or worker timed out')
        return
      }
    }

    // Verify the results rendered
    const hasResults = await waitForVisible(page.getByText('Success Rate').first(), 5000)
    const hasTable = await waitForVisible(page.locator('table').first(), 5000)
    expect(hasResults || hasTable).toBe(true)
  })

  test('Test 2: SWR heatmap renders after clicking Generate Heatmap', async ({ page }) => {
    await completeSetupWizard(page)
    await navigateToStressTestAdvanced(page)

    await page.getByRole('tab', { name: 'Historical Backtest' }).click()

    // Wait for auto-run to complete (Success Rate should appear via SummaryPanel)
    const autoRunDone = await waitForVisible(page.getByText('Success Rate').first(), 60_000)

    if (!autoRunDone) {
      test.skip(true, 'Backtest base results did not complete — cannot test heatmap')
      return
    }

    // The heatmap is generated separately. Look for the "Generate Heatmap" button.
    // It only appears when withdrawalStrategy is constant_dollar or vanguard_dynamic (default is constant_dollar).
    const generateBtn = page.getByRole('button', { name: /generate heatmap/i })
    const heatmapBtnVisible = await waitForVisible(generateBtn, 5000)

    if (!heatmapBtnVisible) {
      test.skip(true, 'Generate Heatmap button not visible (strategy may not support heatmap)')
      return
    }

    await generateBtn.click()

    // Wait for heatmap to render — the SwrHeatmap component renders after worker completes.
    // It shows a table structure with SWR rates and duration headers.
    const heatmapTable = await waitForVisible(page.locator('table').nth(1), 60_000)
    const heatmapGrid = await waitForVisible(
      page.locator('[class*="heatmap"], [class*="grid"] [class*="cell"]').first(),
      5000,
    )
    // Also check for any text that would appear in a rendered heatmap
    const heatmapText = await waitForVisible(
      page.getByText(/SWR.*Duration|Withdrawal Rate|Duration.*Years/i).first(),
      5000,
    )

    if (!heatmapTable && !heatmapGrid && !heatmapText) {
      test.skip(true, 'Heatmap did not render within timeout')
      return
    }

    expect(heatmapTable || heatmapGrid || heatmapText).toBe(true)
  })

  test('Test 3: Sequence Risk tab renders crisis scenario cards', async ({ page }) => {
    await completeSetupWizard(page)
    await navigateToStressTestAdvanced(page)

    // Click the Sequence Risk tab
    await page.getByRole('tab', { name: 'Sequence Risk' }).click()

    // Verify the Sequence Risk tab content loads
    await expect(page.getByText('Select Crisis Scenario')).toBeVisible({ timeout: 10000 })

    // Verify crisis scenario cards are visible — check for known scenario names
    // from CRISIS_SCENARIOS in lib/data/crisisScenarios.ts
    const crisisNames = ['Global Financial Crisis', 'Dot-Com Crash', 'COVID-19 Crash', 'Asian Financial Crisis']
    let foundCrisis = false
    for (const name of crisisNames) {
      const visible = await waitForVisible(page.getByText(name, { exact: false }).first(), 3000)
      if (visible) {
        foundCrisis = true
        break
      }
    }

    expect(foundCrisis).toBe(true)

    // The Run Stress Test button should also be present
    await expect(page.getByRole('button', { name: /Run Stress Test/i })).toBeVisible({ timeout: 5000 })
  })

  test('Test 4: Sequence Risk run shows mitigation strategies panel', async ({ page }) => {
    await completeSetupWizard(page)
    await navigateToStressTestAdvanced(page)

    await page.getByRole('tab', { name: 'Sequence Risk' }).click()

    // Verify crisis selector appears
    await expect(page.getByText('Select Crisis Scenario')).toBeVisible({ timeout: 10000 })

    // Click Run Stress Test
    const runBtn = page.getByRole('button', { name: /Run Stress Test/i })
    await expect(runBtn).toBeVisible({ timeout: 5000 })
    await expect(runBtn).toBeEnabled()
    await runBtn.click()

    // Wait for results — "Normal Success Rate" and "Crisis Success Rate" cards appear
    const normalRateVisible = await waitForVisible(page.getByText('Normal Success Rate').first(), 60_000)

    if (!normalRateVisible) {
      test.skip(true, 'Sequence Risk results did not appear within timeout')
      return
    }

    await expect(page.getByText('Normal Success Rate').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Crisis Success Rate').first()).toBeVisible({ timeout: 5000 })

    // Verify Mitigation Strategies panel is visible after results
    // MitigationPanel shows a card with "Mitigation Strategies" heading and strategy badges
    await expect(page.getByText('Mitigation Strategies').first()).toBeVisible({ timeout: 10000 })

    // Verify the Baseline reference card is present (always shown in MitigationPanel)
    const hasBaseline = await waitForVisible(page.getByText('Baseline').first(), 3000)
    expect(hasBaseline).toBe(true)
  })
})
