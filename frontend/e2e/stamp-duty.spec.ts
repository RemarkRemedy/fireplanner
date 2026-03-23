import { test, expect } from '@playwright/test'

test.describe('Stamp Duty Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stamp-duty-calculator')
    await page.evaluate(() => localStorage.clear())
    await page.waitForLoadState('networkidle')
  })

  test('Singapore Citizen first property shows BSD and ABSD at 0%', async ({ page }) => {
    // Verify the page heading is visible
    await expect(page.getByRole('heading', { name: /stamp duty calculator/i }).first()).toBeVisible()

    // Set purchase price to $1,000,000
    const priceInput = page.locator('input[inputmode="numeric"], input[type="text"]').first()
    await priceInput.click()
    await priceInput.fill('1000000')
    await priceInput.blur()

    // Verify defaults visible: Singapore Citizen, 1st property
    await expect(page.getByText('Singapore Citizen').first()).toBeVisible()
    await expect(page.getByText('1st property').first()).toBeVisible()

    // BSD for $1M = $24,600
    await expect(page.getByText(/\$24,600/).first()).toBeVisible()

    // ABSD should show 0% for citizen first property
    await expect(page.getByText(/ABSD \(0%\)/)).toBeVisible()

    // Total stamp duty should be visible
    await expect(page.getByText(/total stamp duty/i).first()).toBeVisible()
  })

  test('Foreigner status shows non-zero ABSD amount', async ({ page }) => {
    // Verify the page heading is visible
    await expect(page.getByRole('heading', { name: /singapore stamp duty calculator/i })).toBeVisible()

    // Set purchase price to $1,000,000
    const priceInput = page.locator('input[inputmode="numeric"], input[type="text"]').first()
    await priceInput.click()
    await priceInput.fill('1000000')
    await priceInput.blur()

    // Change buyer profile to Foreigner
    await page.getByRole('combobox').filter({ hasText: 'Singapore Citizen' }).click()
    await page.getByRole('option', { name: 'Foreigner' }).click()

    // ABSD rate should update to 60%
    await expect(page.getByText(/ABSD \(60%\)/)).toBeVisible()

    // ABSD amount for $1M at 60% = $600,000
    await expect(page.getByText(/\$600,000/)).toBeVisible()

    // The amber ABSD warning note should appear
    await expect(page.getByText(/ABSD of 60% applies/i)).toBeVisible()

    // Total stamp duty label should be visible
    await expect(page.getByText('Total stamp duty', { exact: true })).toBeVisible()
  })
})
