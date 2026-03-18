import { test, expect } from '@playwright/test'
import { goToStart } from './helpers'

/**
 * Returning User Detection — adaptive StartPage
 *
 * Tests the returning user view: sidebar visible, adaptive CTA,
 * progress bar, two-tier actions, and "Start fresh" reset.
 */

/** Simulate a returning user by loading demo data */
async function loadDemoAsReturningUser(page: import('@playwright/test').Page) {
  await goToStart(page)
  await page.getByRole('button', { name: /explore a demo/i }).click()
  await expect(page).toHaveURL(/\/projection/)
  await page.waitForLoadState('networkidle')
}

test.describe('Returning User Detection', () => {
  test('shows welcome back with sidebar after demo load', async ({ page }) => {
    await loadDemoAsReturningUser(page)

    // Navigate back to start page
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Should see "Welcome back" text
    await expect(page.getByText(/welcome back/i)).toBeVisible()

    // Sidebar should be visible (complementary landmark)
    await expect(page.getByRole('complementary')).toBeVisible()

    // Sidebar should have Plan Setup highlighted
    await expect(page.getByRole('link', { name: /plan setup/i })).toBeVisible()
  })

  test('shows adaptive CTA based on completeness stage', async ({ page }) => {
    await loadDemoAsReturningUser(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Demo data has setupCompleted but no refined sections
    // Should show Stage A CTA: "View your projection"
    const cta = page.getByRole('link', { name: /view your projection/i })
    await expect(cta).toBeVisible()

    // CTA should link to /projection
    await expect(cta).toHaveAttribute('href', '/projection')
  })

  test('shows progress bar when sections are not fully refined', async ({ page }) => {
    await loadDemoAsReturningUser(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Progress bar should be visible (not all sections refined)
    await expect(page.getByText(/plan completeness/i)).toBeVisible()
    await expect(page.getByRole('progressbar')).toBeVisible()
  })

  test('shows tier 1 action buttons (Health Check, View projection, Dashboard)', async ({ page }) => {
    await loadDemoAsReturningUser(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('link', { name: 'Health Check' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View projection' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  })

  test('shows tier 2 reset actions (Redo setup, Start fresh)', async ({ page }) => {
    await loadDemoAsReturningUser(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /redo setup/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /start fresh/i })).toBeVisible()
  })

  test('start fresh shows confirmation dialog and resets data', async ({ page }) => {
    await loadDemoAsReturningUser(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click "Start fresh"
    await page.getByRole('button', { name: /start fresh/i }).click()

    // AlertDialog should appear
    await expect(page.getByText('Reset all data?')).toBeVisible()
    await expect(page.getByText(/permanently delete/i)).toBeVisible()

    // Cancel should dismiss
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Reset all data?')).not.toBeVisible()
  })

  test('fresh user does NOT see welcome back', async ({ page }) => {
    await goToStart(page)

    // No "Welcome back" text
    await expect(page.getByText(/welcome back/i)).not.toBeVisible()

    // No sidebar (hidden for new users)
    await expect(page.getByRole('complementary')).not.toBeVisible()

    // Pathway cards should be visible
    await expect(page.getByText(/I know when I want to retire/i)).toBeVisible()
    await expect(page.getByText(/Show me what's possible/i)).toBeVisible()
    await expect(page.getByText(/I already have enough/i)).toBeVisible()
  })

  test('fresh user sees quick estimate form', async ({ page }) => {
    await goToStart(page)

    await expect(page.getByText('Quick estimate (10 seconds)')).toBeVisible()
    await expect(page.getByText(/explore a demo/i)).toBeVisible()
  })
})
