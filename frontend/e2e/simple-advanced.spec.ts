import { test, expect } from '@playwright/test'
import { quickOnboarding } from './helpers'

test.describe('US-13: Simple vs Advanced Mode', () => {
  test('mode toggle on inputs page switches between Simple and Advanced', async ({ page }) => {
    // 1. Complete onboarding
    await quickOnboarding(page)

    // 2. The sidebar has a ModeToggle with "Simple" and "Advanced" buttons
    const sidebar = page.locator('aside').first()
    const simpleModeBtn = sidebar.getByText('Simple', { exact: true })
    const advancedModeBtn = sidebar.getByText('Advanced', { exact: true })

    // Both toggle buttons should be visible
    await expect(simpleModeBtn).toBeVisible()
    await expect(advancedModeBtn).toBeVisible()

    // 3. Click Simple to ensure simple mode
    await simpleModeBtn.click()
    await page.waitForTimeout(300)

    // Simple button should have active styling (font-medium class)
    await expect(simpleModeBtn).toHaveClass(/font-medium/)

    // 4. Toggle to Advanced mode
    await advancedModeBtn.click()
    await page.waitForTimeout(300)

    // Advanced button should now have active styling
    await expect(advancedModeBtn).toHaveClass(/font-medium/)

    // 5. Allocation section should always be visible with Household Glide Path
    const allocationSection = page.locator('#section-allocation')
    await allocationSection.scrollIntoViewIfNeeded()
    await expect(allocationSection.getByText('Household Glide Path')).toBeVisible()
  })

  test('Simple mode shows only Monte Carlo tab on stress test page, Advanced shows all 3', async ({ page }) => {
    // 1. Complete onboarding
    await quickOnboarding(page)

    // 2. Navigate to stress test page
    await page.goto('/stress-test')
    await page.waitForLoadState('networkidle')

    // 3. The stress test page has its own Simple/Advanced toggle
    // Ensure Simple mode first
    const stressSimpleBtn = page.locator('button').filter({ hasText: 'Simple' }).first()
    const stressAdvancedBtn = page.locator('button').filter({ hasText: 'Advanced' }).first()
    await stressSimpleBtn.click()
    await page.waitForTimeout(300)

    // 4. In Simple mode, only Monte Carlo tab should be visible
    const monteCarloTab = page.getByRole('tab', { name: /Monte Carlo/i })
    await expect(monteCarloTab).toBeVisible()

    // Backtest and Sequence Risk tabs should NOT exist
    const backtestTab = page.getByRole('tab', { name: /Historical Backtest/i })
    const sequenceRiskTab = page.getByRole('tab', { name: /Sequence Risk/i })
    await expect(backtestTab).toHaveCount(0)
    await expect(sequenceRiskTab).toHaveCount(0)

    // 5. Toggle to Advanced mode
    await stressAdvancedBtn.click()
    await page.waitForTimeout(300)

    // 6. In Advanced mode, all 3 tabs should be visible
    await expect(page.getByRole('tab', { name: /Monte Carlo/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Historical Backtest/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Sequence Risk/i })).toBeVisible()
  })
})
