import { test, expect } from '@playwright/test'
import { goToStart, selectPathway } from './helpers'

test.describe('US-14: Mobile Navigation', () => {
  test('mobile hamburger menu and bottom nav work correctly', async ({ page }) => {
    // 1. Complete onboarding on mobile viewport
    await goToStart(page)
    await selectPathway(page, 'goal-first')
    await page.getByRole('button', { name: /build my full plan/i }).click()
    await expect(page).toHaveURL(/\/inputs/)
    await page.waitForLoadState('networkidle')

    // 2. Verify hamburger menu button is visible (desktop sidebar should be hidden)
    const hamburgerButton = page.getByLabel('Open navigation menu')
    await expect(hamburgerButton).toBeVisible()

    // Desktop sidebar should not be visible at mobile viewport
    const desktopSidebar = page.locator('aside.hidden.md\\:flex')
    await expect(desktopSidebar).not.toBeVisible()

    // 3. Click hamburger to open the mobile drawer
    await hamburgerButton.click()

    // The drawer is an aside with role="dialog"
    const drawer = page.locator('aside[role="dialog"]')
    await expect(drawer).toBeVisible()

    // Drawer should have navigation links
    await expect(drawer.getByText('FIRE Planner')).toBeVisible()

    // 4. Navigate to a page via the mobile menu
    // Click "Projection" link in the drawer
    const projectionLink = drawer.getByText('Projection', { exact: true })
    await projectionLink.click()

    // Drawer should close after navigation
    await expect(drawer).not.toBeVisible()

    // Should have navigated to /projection
    await expect(page).toHaveURL(/\/projection/)

    // 5. Verify bottom navigation bar is visible with quick links
    const bottomNav = page.locator('nav.fixed.bottom-0')
    await expect(bottomNav).toBeVisible()

    // Bottom nav should have 5 items: Inputs, Plan, Test, Dash, Guide
    await expect(bottomNav.getByText('Inputs')).toBeVisible()
    await expect(bottomNav.getByText('Plan')).toBeVisible()
    await expect(bottomNav.getByText('Test')).toBeVisible()
    await expect(bottomNav.getByText('Dash')).toBeVisible()
    await expect(bottomNav.getByText('Guide')).toBeVisible()

    // 6. Click a bottom nav link and verify navigation works
    await bottomNav.getByText('Dash').click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/dashboard/)

    // Navigate to Test via bottom nav
    await bottomNav.getByText('Test').click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/stress-test/)
  })

  test('hamburger drawer close button works', async ({ page }) => {
    // 1. Navigate to inputs
    await goToStart(page)
    await selectPathway(page, 'story-first')
    await page.getByRole('button', { name: /build my full plan/i }).click()
    await expect(page).toHaveURL(/\/inputs/)
    await page.waitForLoadState('networkidle')

    // 2. Open the drawer
    const hamburgerButton = page.getByLabel('Open navigation menu')
    await hamburgerButton.click()

    const drawer = page.locator('aside[role="dialog"]')
    await expect(drawer).toBeVisible()

    // 3. Close the drawer via the close button
    const closeButton = page.getByLabel('Close navigation menu')
    await closeButton.click()

    // Drawer should close
    await expect(drawer).not.toBeVisible()
  })
})
