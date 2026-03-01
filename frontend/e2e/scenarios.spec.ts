import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, fillGoalFirstForm } from './helpers'

/**
 * US-8: Save and Load Scenarios
 *
 * Complete onboarding, set known store values via localStorage,
 * save a scenario, change values, save a second scenario, load the first,
 * and verify original values are restored.
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

/** Set a known expenses value directly in the profile store. */
async function setExpenses(page: import('@playwright/test').Page, value: number) {
  await page.evaluate((v) => {
    const raw = localStorage.getItem('fireplanner-profile')
    if (raw) {
      const data = JSON.parse(raw)
      data.state.annualExpenses = v
      localStorage.setItem('fireplanner-profile', JSON.stringify(data))
    }
  }, value)
  await page.reload()
  await page.waitForLoadState('networkidle')
}

/** Read the expenses value from the profile store in localStorage. */
async function getExpenses(page: import('@playwright/test').Page): Promise<number | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fireplanner-profile')
    if (!raw) return null
    return JSON.parse(raw).state?.annualExpenses ?? null
  })
}

test.describe('Scenarios', () => {
  test('save, modify, save again, and load original scenario', async ({ page }) => {
    await completeOnboarding(page)

    // Set a known expenses value (50000) directly in the store
    await setExpenses(page, 50000)

    // Verify it's set
    expect(await getExpenses(page)).toBe(50000)

    // Step 1: Open the scenario manager in the sidebar
    const scenariosButton = page.getByRole('button', { name: /scenarios/i }).first()
    await scenariosButton.click()

    const nameInput = page.getByPlaceholder('Scenario name...')
    await expect(nameInput).toBeVisible()

    // Step 2: Save scenario "Base Case"
    await nameInput.fill('Base Case')
    const saveButton = page.locator('button[title="Save current state"]')
    await saveButton.click()

    // Verify the scenario appears in the list
    await expect(page.locator('button[title="Load \\"Base Case\\""]')).toBeVisible()

    // Step 3: Change expenses to 80000 and reload
    await setExpenses(page, 80000)
    expect(await getExpenses(page)).toBe(80000)

    // Step 4: Re-open scenario manager and save "High Expense"
    const scenariosButton2 = page.getByRole('button', { name: /scenarios/i }).first()
    await scenariosButton2.click()

    const nameInput2 = page.getByPlaceholder('Scenario name...')
    await nameInput2.fill('High Expense')
    const saveButton2 = page.locator('button[title="Save current state"]')
    await saveButton2.click()

    // Verify both scenarios are listed
    await expect(page.locator('button[title="Load \\"Base Case\\""]')).toBeVisible()
    await expect(page.locator('button[title="Load \\"High Expense\\""]')).toBeVisible()

    // Step 5: Load "Base Case"
    const baseCaseLoad = page.locator('button[title="Load \\"Base Case\\""]')
    await baseCaseLoad.click()

    // Wait for stores to rehydrate
    await page.waitForTimeout(500)

    // Step 6: Verify expenses restored to 50000
    expect(await getExpenses(page)).toBe(50000)
  })

  test('can delete a saved scenario', async ({ page }) => {
    await completeOnboarding(page)

    // Open scenario manager
    const scenariosButton = page.getByRole('button', { name: /scenarios/i }).first()
    await scenariosButton.click()

    // Save a scenario
    const nameInput = page.getByPlaceholder('Scenario name...')
    await nameInput.fill('Delete Me')
    const saveButton = page.locator('button[title="Save current state"]')
    await saveButton.click()

    // Verify the scenario exists with its load button
    const loadButton = page.locator('button[title="Load \\"Delete Me\\""]')
    await expect(loadButton).toBeVisible()

    // Delete it
    const deleteButton = page.locator('button[title="Delete \\"Delete Me\\""]')
    await deleteButton.click({ force: true })

    // Wait for deletion
    await page.waitForTimeout(300)

    // Verify the load button for this scenario is gone
    await expect(loadButton).not.toBeVisible()

    // The scenario list should show "No saved scenarios"
    await expect(page.getByText('No saved scenarios')).toBeVisible()
  })
})
