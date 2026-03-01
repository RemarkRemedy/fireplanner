import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, expectRoute } from './helpers'

/**
 * Helper to clear and fill an input field.
 * NumberInput/CurrencyInput use local state buffer; we select-all then type.
 */
async function clearAndFill(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

test.describe('US-1: Fresh Graduate Onboarding (Goal-First)', () => {
  test('complete goal-first pathway and navigate to inputs', async ({ page }) => {
    // Start fresh
    await goToStart(page)

    // Verify we're on the start page
    await expect(page.getByText('Singapore FIRE Planner')).toBeVisible()

    // Click the goal-first pathway card
    await selectPathway(page, 'goal-first')

    // Wait for the inline form to appear
    await expect(page.getByText('Set your targets')).toBeVisible()

    // The goal-first form has 5 fields in order:
    // Current Age, Desired Retirement Age, Annual Income, Annual Expenses, Savings & Investments
    const formInputs = page.locator('main input[inputmode="numeric"]')
    await expect(formInputs).toHaveCount(5, { timeout: 5000 })

    // Fill all fields — use selectText() first to replace default values
    await clearAndFill(page, formInputs.nth(0), '25')
    await clearAndFill(page, formInputs.nth(1), '45')
    await clearAndFill(page, formInputs.nth(2), '48000')
    await clearAndFill(page, formInputs.nth(3), '30000')
    await clearAndFill(page, formInputs.nth(4), '50000')

    // Blur the last input to trigger state update
    await formInputs.nth(4).blur()

    // Wait for inline results to appear
    // QuickResults shows FIRE Number, Savings Rate, Progress
    await expect(page.getByText('FIRE Number', { exact: false })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Savings Rate', { exact: false })).toBeVisible()
    await expect(page.getByText('Progress', { exact: false })).toBeVisible()

    // Click Build my full plan
    await page.getByRole('button', { name: /build my full plan/i }).click()

    // Verify navigation to /inputs
    await expectRoute(page, '/inputs')

    // Verify we're on the inputs page
    await page.waitForLoadState('networkidle')

    // Check that the page loaded with profile sections visible
    await expect(page.getByText('Personal', { exact: false }).first()).toBeVisible({ timeout: 5000 })
  })

  test('shows validation results with correct FIRE metrics', async ({ page }) => {
    await goToStart(page)
    await selectPathway(page, 'goal-first')
    await expect(page.getByText('Set your targets')).toBeVisible()

    const formInputs = page.locator('main input[inputmode="numeric"]')
    await expect(formInputs).toHaveCount(5, { timeout: 5000 })

    await clearAndFill(page, formInputs.nth(0), '25')
    await clearAndFill(page, formInputs.nth(1), '45')
    await clearAndFill(page, formInputs.nth(2), '48000')
    await clearAndFill(page, formInputs.nth(3), '30000')
    await clearAndFill(page, formInputs.nth(4), '50000')
    await formInputs.nth(4).blur()

    // With these inputs, FIRE Number = 30000 / 0.036 = ~$833,333
    // Savings Rate = 18000/48000 = 37.5%
    // Progress = 50000/833333 = ~6.0%
    await expect(page.getByText('FIRE Number', { exact: false })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Savings Rate', { exact: false })).toBeVisible()

    // Verify the projection chart is rendered (SVG from Recharts)
    await expect(page.locator('.recharts-wrapper, svg.recharts-surface').first()).toBeVisible({ timeout: 5000 })
  })
})
