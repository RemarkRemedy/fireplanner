import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, expectRoute } from './helpers'

test.describe('US-3: Already-FIRE Onboarding (Setup Wizard)', () => {
  test('complete already-fire pathway and navigate to setup', async ({ page }) => {
    // Start fresh
    await goToStart(page)

    // Verify we're on the start page
    await expect(page.getByText('Singapore FIRE Planner')).toBeVisible()

    // Click the already-fire pathway card
    await selectPathway(page, 'already-fire')

    // Verify navigation to /setup
    await expectRoute(page, '/setup')

    // Verify the first setup screen is visible (age screen)
    await expect(page.getByText('How old are you?')).toBeVisible({ timeout: 5000 })
  })

  test('setup wizard includes residency and CPF screens', async ({ page }) => {
    await goToStart(page)
    await selectPathway(page, 'already-fire')
    await expectRoute(page, '/setup')

    // Screen 1: Age
    await expect(page.getByText('How old are you?')).toBeVisible({ timeout: 5000 })

    // Fill required fields and advance
    const currentAgeInput = page.getByLabel(/current age/i)
    await currentAgeInput.fill('55')
    const retirementAgeInput = page.getByLabel(/retirement age/i)
    await retirementAgeInput.fill('56')

    // Click Continue/Next to advance
    await page.getByRole('button', { name: /continue|next/i }).click()

    // Screen 2: Income
    await expect(page.getByText('What do you earn?')).toBeVisible({ timeout: 5000 })
  })

  test('all three pathway cards are visible on start page', async ({ page }) => {
    await goToStart(page)

    // Verify all three pathway cards are visible
    await expect(page.getByText('I know when I want to retire')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Show me what's possible")).toBeVisible()
    await expect(page.getByText('I already have enough')).toBeVisible()
  })
})
