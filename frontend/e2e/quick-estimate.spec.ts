import { test, expect } from '@playwright/test'
import { goToStart } from './helpers'

test.describe('Quick Estimate Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await goToStart(page)
  })

  test('new user sees quick estimate form with 4 inputs', async ({ page }) => {
    await expect(page.getByText('Quick estimate (10 seconds)')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /monthly take-home pay/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /monthly expenses/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /current savings/i })).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: /current age/i })).toBeVisible()
  })

  test('entering values shows FIRE age result and chart', async ({ page }) => {
    await page.getByRole('textbox', { name: /monthly take-home pay/i }).fill('7000')
    await page.getByRole('textbox', { name: /monthly expenses/i }).fill('4000')
    await page.getByRole('textbox', { name: /current savings/i }).fill('100000')

    // Should show retirement range (optimistic/conservative) or "Could retire as early as"
    await expect(
      page.getByText(/your retirement range|could retire as early as/i)
    ).toBeVisible()
    await expect(page.getByText(/FIRE Number/i).first()).toBeVisible()
    await expect(page.getByText(/Savings Rate/i).first()).toBeVisible()
    await expect(page.getByText(/Annual Savings/i).first()).toBeVisible()

    // Chart should render (SVG with Growing/Spending legend)
    await expect(page.getByText('Growing', { exact: true })).toBeVisible()
    await expect(page.getByText('Spending', { exact: true })).toBeVisible()
  })

  test('pathway cards hide when calculator has results', async ({ page }) => {
    // Before input: pathway cards visible
    await expect(page.getByText(/I know when I want to retire/i)).toBeVisible()

    // Enter values to trigger results
    await page.getByRole('textbox', { name: /monthly take-home pay/i }).fill('7000')
    await page.getByRole('textbox', { name: /monthly expenses/i }).fill('4000')

    // Pathway cards should be hidden when calculator has results
    await expect(page.getByText(/I know when I want to retire/i)).not.toBeVisible()
  })

  test('already-FIRE shows emerald celebration card', async ({ page }) => {
    await page.getByRole('textbox', { name: /monthly take-home pay/i }).fill('7000')
    await page.getByRole('textbox', { name: /monthly expenses/i }).fill('4000')
    await page.getByRole('textbox', { name: /current savings/i }).fill('1500000')

    await expect(page.getByText(/you've already reached fire/i)).toBeVisible()
  })

  test('negative savings shows warning', async ({ page }) => {
    await page.getByRole('textbox', { name: /monthly take-home pay/i }).fill('3000')
    await page.getByRole('textbox', { name: /monthly expenses/i }).fill('5000')

    await expect(page.getByText(/spending more than you earn/i)).toBeVisible()
  })

  test('100+ years shows unreachable warning', async ({ page }) => {
    await page.getByRole('textbox', { name: /monthly take-home pay/i }).fill('5000')
    await page.getByRole('textbox', { name: /monthly expenses/i }).fill('4900')

    await expect(page.getByText(/100\+ years away/i)).toBeVisible()
  })
})

test.describe('Demo Mode', () => {
  test('new user can load demo and see projection', async ({ page }) => {
    await goToStart(page)

    // Click "Or explore a demo first"
    await page.getByRole('button', { name: /explore a demo/i }).click()

    // Should navigate to /projection
    await expect(page).toHaveURL(/\/projection/)

    // Orange toast should show "You are viewing demo data"
    await expect(page.getByText('You are viewing demo data')).toBeVisible()

    // DEMO badge appears after page reload (localStorage flag set in same tab)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button').filter({ hasText: /^DEMO$/ })).toBeVisible()
  })

  test('demo badge expands and "Start your own plan" clears data', async ({ page }) => {
    await goToStart(page)
    await page.getByRole('button', { name: /explore a demo/i }).click()
    await expect(page).toHaveURL(/\/projection/)

    // Reload to pick up the demo flag in the DemoBadge component
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Click DEMO badge to expand
    await page.locator('button').filter({ hasText: /^DEMO$/ }).click()

    // Should show expanded panel with "Start your own plan"
    await expect(page.getByText('Viewing demo data')).toBeVisible()
    const startPlanButton = page.getByRole('button', { name: /start your own plan/i }).first()
    await expect(startPlanButton).toBeVisible()

    // Click "Start your own plan" — should clear data and go to /setup
    await startPlanButton.click()
    await expect(page).toHaveURL(/\/setup/)
  })
})
