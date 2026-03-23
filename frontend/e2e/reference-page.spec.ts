import { test, expect } from '@playwright/test'

/**
 * Reference page (/reference) tests.
 * No onboarding required — the page is accessible to all visitors.
 */

test.describe('Reference Page', () => {
  test('renders heading and key section names', async ({ page }) => {
    await page.goto('/reference')
    await page.waitForLoadState('networkidle')

    // The page title heading should be visible
    await expect(page.getByRole('heading', { name: /Reference Guide/i }).first()).toBeVisible({ timeout: 10000 })

    // Accordion triggers (section titles) are always visible regardless of open/closed state.
    // These are the accordion button labels for each section.
    await expect(page.getByRole('button', { name: /Withdrawal Strategies/i }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Singapore Considerations/i }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Monte Carlo/i }).first()).toBeVisible({ timeout: 5000 })

    // Open the Singapore section to confirm CPF/SRS/ABSD content is accessible
    await page.getByRole('button', { name: /Singapore Considerations/i }).first().click()
    await page.waitForTimeout(400)
    await expect(page.getByText('CPF').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('SRS').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('ABSD').first()).toBeVisible({ timeout: 5000 })
  })

  test('expanding the Withdrawal Strategies accordion reveals strategy content', async ({ page }) => {
    await page.goto('/reference')
    await page.waitForLoadState('networkidle')

    // The "Withdrawal Strategies" accordion trigger
    const withdrawalTrigger = page.getByText('Withdrawal Strategies').first()
    await expect(withdrawalTrigger).toBeVisible({ timeout: 10000 })

    // Click to expand (it may already be open if defaultValue includes it)
    await withdrawalTrigger.click()
    await page.waitForTimeout(500)

    // After expanding, strategy content should be visible
    // The section mentions "4% Rule", "VPW", or "Constant Dollar"
    await expect(
      page.getByText(/4% Rule|VPW|Constant Dollar|Guyton/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})
