import { test, expect } from '@playwright/test'

test.describe('Fee Comparison Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/compare')
    await page.evaluate(() => localStorage.clear())
    await page.waitForLoadState('networkidle')
  })

  test('page renders with heading and platform comparison table', async ({ page }) => {
    // Page-level h1 heading
    await expect(
      page.getByRole('heading', { name: /robo-advisors manage your money/i }).first()
    ).toBeVisible()

    // Platform comparison card heading
    await expect(
      page.getByText('Singapore robo-advisors at a glance').first()
    ).toBeVisible()

    // Platform names should be visible in the table (Endowus is well-known and always present)
    await expect(page.getByText('Endowus').first()).toBeVisible()
    await expect(page.getByText('StashAway').first()).toBeVisible()

    // Table column headers
    await expect(page.getByText('Management fee').first()).toBeVisible()
    await expect(page.getByText('Min. investment').first()).toBeVisible()
  })

  test('fee impact calculator renders with slider and comparison data', async ({ page }) => {
    // Fee impact section heading
    await expect(
      page.getByText('What platform fees cost over 30 years').first()
    ).toBeVisible()

    // Slider control is present
    await expect(page.getByRole('slider').first()).toBeVisible()

    // Default portfolio size label is shown
    await expect(page.getByText('Portfolio size').first()).toBeVisible()

    // The 30-year fee impact column header should be visible
    await expect(page.getByText('30-year fee impact').first()).toBeVisible()

    // SGFirePlanner row shows $0 fee impact
    await expect(page.getByText('$0').first()).toBeVisible()

    // Dollar basis toggles are present
    await expect(page.getByText('Nominal dollars').first()).toBeVisible()
    await expect(page.getByText(/Today's dollars/i).first()).toBeVisible()
  })
})
