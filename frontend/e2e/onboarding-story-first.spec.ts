import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, expectRoute } from './helpers'

test.describe('US-2: Story-First Onboarding (Setup Wizard)', () => {
  test('complete story-first pathway and navigate to setup', async ({ page }) => {
    // Start fresh
    await goToStart(page)

    // Verify we're on the start page
    await expect(page.getByText('Singapore FIRE Planner')).toBeVisible()

    // Click the story-first pathway card
    await selectPathway(page, 'story-first')

    // Verify navigation to /setup
    await expectRoute(page, '/setup')

    // Verify the first setup screen is visible (age screen)
    await expect(page.getByText('How old are you?')).toBeVisible({ timeout: 5000 })
  })

  test('setup wizard shows income and expense screens', async ({ page }) => {
    await goToStart(page)
    await selectPathway(page, 'story-first')
    await expectRoute(page, '/setup')

    // Screen 1: Age
    await expect(page.getByText('How old are you?')).toBeVisible({ timeout: 5000 })

    // Fill required fields and advance
    const currentAgeInput = page.getByLabel(/current age/i)
    await currentAgeInput.fill('35')
    const retirementAgeInput = page.getByLabel(/retirement age/i)
    await retirementAgeInput.fill('55')

    // Click Continue/Next to advance to screen 2
    await page.getByRole('button', { name: /continue|next/i }).click()

    // Screen 2: Income
    await expect(page.getByText('What do you earn?')).toBeVisible({ timeout: 5000 })

    // Advance past income screen
    await page.getByRole('button', { name: /continue|next/i }).click()

    // Screen 3: Expenses
    await expect(page.getByText('What do you spend?')).toBeVisible({ timeout: 5000 })
  })
})
