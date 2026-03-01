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

test.describe('US-2: Mid-Career Onboarding (Story-First)', () => {
  test('complete story-first pathway and navigate to inputs', async ({ page }) => {
    // Start fresh
    await goToStart(page)

    // Verify we're on the start page
    await expect(page.getByText('Singapore FIRE Planner')).toBeVisible()

    // Click the story-first pathway card
    await selectPathway(page, 'story-first')

    // Wait for the inline form to appear
    await expect(page.getByText('Tell us about your finances')).toBeVisible()

    // The story-first form has 4 fields:
    // Current Age, Annual Income, Annual Expenses, Savings & Investments
    const formInputs = page.locator('main input[inputmode="numeric"]')
    await expect(formInputs).toHaveCount(4, { timeout: 5000 })

    // Fill Current Age = 35
    await clearAndFill(page, formInputs.nth(0), '35')

    // Fill Annual Income = 180000
    await clearAndFill(page, formInputs.nth(1), '180000')

    // Fill Annual Expenses = 96000
    await clearAndFill(page, formInputs.nth(2), '96000')

    // Fill Savings & Investments = 800000
    await clearAndFill(page, formInputs.nth(3), '800000')

    // Blur the last input to trigger state update
    await formInputs.nth(3).blur()

    // Wait for inline results to appear
    // QuickResults: "You could retire at Age XX" or "You're on track"
    await expect(page.getByText('FIRE Number:').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Savings Rate:').first()).toBeVisible()
    await expect(page.getByText('Progress:').first()).toBeVisible()

    // Click Build my full plan
    await page.getByRole('button', { name: /build my full plan/i }).click()

    // Verify navigation to /inputs
    await expectRoute(page, '/inputs')

    // Verify we're on the inputs page
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Personal', { exact: false }).first()).toBeVisible({ timeout: 5000 })
  })

  test('shows correct hero message for mid-career professional', async ({ page }) => {
    await goToStart(page)
    await selectPathway(page, 'story-first')
    await expect(page.getByText('Tell us about your finances')).toBeVisible()

    const formInputs = page.locator('main input[inputmode="numeric"]')
    await expect(formInputs).toHaveCount(4, { timeout: 5000 })

    await clearAndFill(page, formInputs.nth(0), '35')
    await clearAndFill(page, formInputs.nth(1), '180000')
    await clearAndFill(page, formInputs.nth(2), '96000')
    await clearAndFill(page, formInputs.nth(3), '800000')
    await formInputs.nth(3).blur()

    // Should show some form of hero text about retirement projection
    // "You could retire at Age XX" or "You're on track"
    const heroSection = page.locator('.text-2xl.font-bold').first()
    await expect(heroSection).toBeVisible({ timeout: 5000 })

    // Verify chart is rendered
    await expect(page.locator('.recharts-wrapper, svg.recharts-surface').first()).toBeVisible({ timeout: 5000 })
  })
})
