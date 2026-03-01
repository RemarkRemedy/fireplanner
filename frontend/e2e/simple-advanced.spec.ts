import { test, expect } from '@playwright/test'
import { goToStart, selectPathway } from './helpers'

test.describe('US-13: Simple vs Advanced Mode', () => {
  test('toggling Simple/Advanced changes visible content on inputs page', async ({ page }) => {
    // 1. Complete onboarding
    await goToStart(page)
    await selectPathway(page, 'goal-first')
    await page.getByRole('button', { name: /build my full plan/i }).click()
    await expect(page).toHaveURL(/\/inputs/)
    await page.waitForLoadState('networkidle')

    // 2. Ensure we're in Simple mode via the sidebar toggle
    // The sidebar has a ModeToggle with "Simple" and "Advanced" buttons
    const sidebar = page.locator('aside').first()
    const simpleModeBtn = sidebar.getByText('Simple', { exact: true })
    const advancedModeBtn = sidebar.getByText('Advanced', { exact: true })

    // Click Simple to make sure we're in simple mode
    await simpleModeBtn.click()
    await page.waitForTimeout(300)

    // 3. In Simple mode, advanced-only elements should NOT be visible
    // Glide Path and Override Return Assumptions in allocation are advanced-only
    const allocationSection = page.locator('#section-allocation')
    await allocationSection.scrollIntoViewIfNeeded()

    // In simple mode, the GlidePathSection Card (with ON/OFF button) should not be rendered
    // The Glide Path card has a button with text "ON" or "OFF" inside the allocation section
    const glidePathToggle = allocationSection.locator('button').filter({ hasText: /^(ON|OFF)$/ })
    await expect(glidePathToggle).toHaveCount(0)

    // Override Default Return Assumptions accordion should also not be rendered
    const overrideAccordion = allocationSection.getByText('Override Default Return Assumptions')
    await expect(overrideAccordion).toHaveCount(0)

    // 4. Toggle to Advanced mode
    await advancedModeBtn.click()
    await page.waitForTimeout(500)

    // 5. Verify more content appears in advanced mode
    // Scroll to allocation section again
    await allocationSection.scrollIntoViewIfNeeded()

    // In advanced mode, Glide Path ON/OFF toggle should be visible
    await expect(allocationSection.locator('button').filter({ hasText: /^(ON|OFF)$/ }).first()).toBeVisible()

    // Override Default Return Assumptions accordion should be visible
    await expect(allocationSection.getByText('Override Default Return Assumptions').first()).toBeVisible()
  })

  test('Simple mode shows only Monte Carlo tab on stress test page, Advanced shows all 3', async ({ page }) => {
    // 1. Complete onboarding
    await goToStart(page)
    await selectPathway(page, 'story-first')
    await page.getByRole('button', { name: /build my full plan/i }).click()
    await expect(page).toHaveURL(/\/inputs/)
    await page.waitForLoadState('networkidle')

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
