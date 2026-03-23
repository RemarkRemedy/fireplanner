import { test, expect } from '@playwright/test'

test.describe('SRS Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/srs-calculator')
    await page.evaluate(() => localStorage.clear())
    await page.waitForLoadState('networkidle')
  })

  test('page renders heading and calculator input fields', async ({ page }) => {
    // Page-level h1 heading
    await expect(
      page.getByRole('heading', { name: /srs tax savings calculator/i }).first()
    ).toBeVisible()

    // Input fields are visible
    await expect(page.getByText('Annual Income').first()).toBeVisible()
    await expect(page.getByText('Current Age').first()).toBeVisible()
    await expect(page.getByText('SRS Contribution').first()).toBeVisible()

    // Residency selector
    await expect(page.getByRole('combobox').first()).toBeVisible()

    // Calculate button is present
    await expect(
      page.getByRole('button', { name: /calculate tax savings/i })
    ).toBeVisible()
  })

  test('entering annual income and clicking Calculate shows tax savings estimate', async ({ page }) => {
    // Clear and set annual income to $100,000
    const inputs = page.locator('input[inputmode="numeric"], input[type="text"]')
    const annualIncomeInput = inputs.nth(0)
    await annualIncomeInput.click()
    await annualIncomeInput.fill('100000')
    await annualIncomeInput.blur()

    // Click calculate
    await page.getByRole('button', { name: /calculate tax savings/i }).click()

    // Annual tax saved section should appear
    await expect(page.getByText('Annual tax saved').first()).toBeVisible()

    // The result value should be visible (a formatted SGD amount)
    await expect(page.getByText('Tax without SRS').first()).toBeVisible()
    await expect(page.getByText('Tax with SRS').first()).toBeVisible()

    // Projected balance at 63 section should appear
    await expect(page.getByText('Balance at 63').first()).toBeVisible()

    // SRS vs RSTU comparison section should appear
    await expect(
      page.getByText(/SRS vs CPF SA Top-Up/i).first()
    ).toBeVisible()
  })
})
