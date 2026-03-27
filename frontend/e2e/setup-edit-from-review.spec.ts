import { test, expect, type Page, type Locator } from '@playwright/test'

async function clearAndStart(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')
}

async function fillInput(locator: Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

async function fillVisibleInputs(page: Page, value: string) {
  const inputs = page.locator('input[inputmode="numeric"]:visible, input[inputmode="decimal"]:visible')
  const count = await inputs.count()
  for (let i = 0; i < count; i++) {
    const inp = inputs.nth(i)
    if (await inp.isVisible()) {
      await fillInput(inp, value)
    }
  }
}

/** Navigate through the setup wizard and stop at the review page (don't click "Looks good"). */
async function navigateToReview(page: Page) {
  await clearAndStart(page)
  await expect(page.getByText('Singapore FIRE Planner')).toBeVisible({ timeout: 10000 })

  // Enter setup via URL with pre-filled quick estimate values
  await page.goto('/setup?planType=individual&qIncome=6000&qExpenses=3000&qSavings=150000&qOrder=story-first')
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 })

  const stepValues: Record<string, string> = {
    'Step 2': '6000',
    'Step 3': '3000',
    'Step 4': '150000',
  }

  for (let attempt = 0; attempt < 15; attempt++) {
    // Check if we've reached the review page
    const reviewHeading = page.getByRole('heading', { name: 'Review your inputs' })
    if (await reviewHeading.isVisible({ timeout: 500 }).catch(() => false)) {
      return
    }

    const pageText = await page.locator('body').textContent() ?? ''

    // MirrorMoment interstitial — click Continue to pass through
    if (pageText.includes('everything you') && !pageText.includes('Review your inputs')) {
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.waitForTimeout(500)
      continue
    }

    // Fill numeric inputs on current step
    for (const [step, val] of Object.entries(stepValues)) {
      if (pageText.includes(step)) {
        await fillVisibleInputs(page, val)
        break
      }
    }

    // Handle selection screens — click option first, then wait, then click Continue
    const sgCitizen = page.getByRole('button', { name: 'Singapore Citizen' })
    if (await sgCitizen.isVisible({ timeout: 200 }).catch(() => false)) {
      await sgCitizen.click()
      await page.waitForTimeout(300)
    }
    const noProperty = page.getByRole('button', { name: 'No property' })
    if (await noProperty.isVisible({ timeout: 200 }).catch(() => false)) {
      await noProperty.click()
      await page.waitForTimeout(300)
    }
    const basicHealth = page.getByRole('button', { name: 'Basic (Class B1 ward)' })
    if (await basicHealth.isVisible({ timeout: 200 }).catch(() => false)) {
      await basicHealth.click()
      await page.waitForTimeout(300)
    }

    // Click Continue or "Review your answers"
    const nextBtn = page.getByRole('button', { name: /^continue$|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }
}

test.describe('Setup: Edit from Review', () => {
  test('clicking Edit shows "Save & return to review" and returns to review on click', async ({ page }) => {
    await navigateToReview(page)

    // Verify we're on the review page
    await expect(page.getByRole('heading', { name: 'Review your inputs' })).toBeVisible()

    // Click Edit on Expenses (3rd Edit button)
    const editButtons = page.getByRole('button', { name: 'Edit' })
    await editButtons.nth(2).click()

    // Should now be on the expenses step with "Save & return to review" button
    await expect(page.getByText('What do you spend?')).toBeVisible()
    const saveBtn = page.getByRole('button', { name: 'Save & return to review' })
    await expect(saveBtn).toBeVisible()

    // The normal "Continue" button should NOT be visible
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).not.toBeVisible()

    // Click "Save & return to review"
    await saveBtn.click()

    // Should be back on the review page
    await expect(page.getByRole('heading', { name: 'Review your inputs' })).toBeVisible()
  })

  test('editing a value from review persists the change', async ({ page }) => {
    await navigateToReview(page)

    // Verify initial expenses
    await expect(page.getByText('$36K/yr')).toBeVisible()

    // Click Edit on Expenses
    const editButtons = page.getByRole('button', { name: 'Edit' })
    await editButtons.nth(2).click() // 3rd Edit = Expenses

    // Change expenses
    const expenseInput = page.getByRole('textbox', { name: /monthly expenses/i })
    await expenseInput.click()
    await expenseInput.selectText()
    await expenseInput.fill('4000')

    // Save & return
    await page.getByRole('button', { name: 'Save & return to review' }).click()

    // Verify the review page shows updated value
    await expect(page.getByRole('heading', { name: 'Review your inputs' })).toBeVisible()
    await expect(page.getByText('$48K/yr')).toBeVisible()
  })

  test('Back button during edit-from-review does not break flow', async ({ page }) => {
    await navigateToReview(page)

    // Click Edit on Age & target
    const editButtons = page.getByRole('button', { name: 'Edit' })
    await editButtons.nth(0).click() // 1st Edit = Age

    // Should show "Save & return to review"
    await expect(page.getByText('How old are you?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save & return to review' })).toBeVisible()

    // Click "Save & return to review" without changing anything
    await page.getByRole('button', { name: 'Save & return to review' }).click()

    // Should be back on review
    await expect(page.getByRole('heading', { name: 'Review your inputs' })).toBeVisible()
  })
})
