import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, fillGoalFirstForm } from './helpers'

/**
 * US-10: Returning User Detection
 *
 * Complete onboarding (which populates localStorage), then navigate
 * back to "/", look for "Welcome back" text with a continue link,
 * and verify clicking it goes to /inputs.
 */

async function completeOnboarding(page: import('@playwright/test').Page) {
  await goToStart(page)
  await selectPathway(page, 'goal-first')
  await fillGoalFirstForm(page, {
    age: '30',
    retirementAge: '55',
    income: '100000',
    expenses: '50000',
    savings: '200000',
  })
  await page.getByRole('button', { name: /build my full plan/i }).click()
  await expect(page).toHaveURL(/\/inputs/)
  await page.waitForLoadState('networkidle')
}

test.describe('Returning User Detection', () => {
  test('shows welcome back link after onboarding and navigates to /inputs', async ({ page }) => {
    // First, complete onboarding to populate localStorage
    await completeOnboarding(page)

    // Verify localStorage has the profile data
    const hasProfile = await page.evaluate(() => {
      return localStorage.getItem('fireplanner-profile') !== null
    })
    expect(hasProfile).toBe(true)

    // Navigate back to the start page (without clearing state)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The start page should detect the returning user and show the welcome back link
    // StartPage.tsx line 491-496: "Welcome back — continue where you left off"
    const welcomeBack = page.getByText(/welcome back/i)
    await expect(welcomeBack).toBeVisible()

    // Click the "continue where you left off" link
    const continueLink = page.getByRole('link', { name: /welcome back.*continue/i })
    await continueLink.click()

    // Should navigate to /inputs
    await expect(page).toHaveURL(/\/inputs/)
  })

  test('fresh user does NOT see welcome back link', async ({ page }) => {
    // Go to start page with cleared state
    await goToStart(page)

    // There should be no "Welcome back" text
    const welcomeBack = page.getByText(/welcome back/i)
    await expect(welcomeBack).not.toBeVisible()

    // But the pathway cards should be visible
    await expect(page.getByText(/I know when I want to retire/i)).toBeVisible()
    await expect(page.getByText(/Show me what's possible/i)).toBeVisible()
    await expect(page.getByText(/I already have enough/i)).toBeVisible()
  })
})
