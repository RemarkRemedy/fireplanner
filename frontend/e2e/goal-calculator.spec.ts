import { test, expect } from '@playwright/test'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the goal calculator with a clean state. */
async function goToGoalCalculator(page: import('@playwright/test').Page) {
  await page.goto('/goal-calculator')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')
}

/**
 * Clear and fill a NumberInput or CurrencyInput by clicking, selecting all,
 * then typing the value. Required because these inputs use buffered local state.
 */
async function fillInput(
  locator: import('@playwright/test').Locator,
  value: string,
) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Fill the BasicsForm fields (age, monthly income, monthly expenses,
 * existing savings) and click Calculate.
 */
async function fillBasicsAndCalculate(
  page: import('@playwright/test').Page,
  opts: {
    age: string
    monthlyIncome: string
    monthlyExpenses: string
    existingSavings: string
  },
) {
  // The BasicsForm renders four inputs in order:
  // 1. Your age (NumberInput, inputmode="numeric")
  // 2. Monthly take-home pay (CurrencyInput, inputmode="numeric")
  // 3. Monthly expenses (CurrencyInput, inputmode="numeric")
  // 4. Existing savings (CurrencyInput, inputmode="numeric")
  const inputs = page.locator('input[inputmode="numeric"]')
  await expect(inputs).toHaveCount(4, { timeout: 5000 })

  await fillInput(inputs.nth(0), opts.age)
  await fillInput(inputs.nth(1), opts.monthlyIncome)
  await fillInput(inputs.nth(2), opts.monthlyExpenses)
  await fillInput(inputs.nth(3), opts.existingSavings)

  await page.getByRole('button', { name: 'Calculate' }).click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Goal Calculator', () => {
  test('HDB goal: full flow shows monthly savings and down payment breakdown', async ({
    page,
  }) => {
    await goToGoalCalculator(page)

    // Step 1: Verify picker heading and pick HDB Flat
    await expect(
      page.getByText("What's your next big goal?"),
    ).toBeVisible()
    await page.getByText('HDB Flat').click()

    // Step 2: GoalConfig - HDB Flat is shown, select 4-Room and Resale
    await expect(page.getByText('HDB Flat').first()).toBeVisible()
    await page.getByRole('button', { name: '4-Room' }).click()
    await page.getByRole('button', { name: 'Resale' }).click()

    // The breakdown should show "Down payment" in the config cost breakdown
    await expect(page.getByText('Down payment', { exact: false })).toBeVisible()

    // Set target age (default is currentAge + 5, but currentAge is null so 35)
    // We need target age > 25 (our basics age), so 35 is fine
    // Click Continue
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3: BasicsForm
    await expect(page.getByText('Your basics')).toBeVisible()
    await fillBasicsAndCalculate(page, {
      age: '25',
      monthlyIncome: '4000',
      monthlyExpenses: '2000',
      existingSavings: '30000',
    })

    // Step 4: Results - should show monthly savings needed and cost breakdown
    await expect(page.getByText('Monthly savings needed')).toBeVisible({
      timeout: 5000,
    })
    // The result card should contain a "/mo" savings amount
    await expect(page.getByText('/mo', { exact: false }).first()).toBeVisible()

    // The cost breakdown section in the result card should include "Down payment"
    await expect(
      page.getByText('Down payment', { exact: false }),
    ).toBeVisible()
  })

  test('Wedding goal: simple flow shows savings result', async ({ page }) => {
    await goToGoalCalculator(page)

    // Pick Wedding tile
    await expect(
      page.getByText("What's your next big goal?"),
    ).toBeVisible()
    await page.getByText('Wedding').click()

    // GoalConfig: simple goal shows "Total amount needed" input
    await expect(page.getByText('Wedding').first()).toBeVisible()
    await expect(page.getByText('Total amount needed')).toBeVisible()

    // The target age input defaults to currentAge + 5 (null -> 35)
    // We want target age 30, but need current age first (set in basics)
    // Default target age is 35 which is > our basics age of 28, so leave it
    // Update target age to 30
    const targetAgeInput = page
      .locator('label')
      .filter({ hasText: 'Target age' })
      .locator('..')
      .locator('input')
    await fillInput(targetAgeInput, '30')

    await page.getByRole('button', { name: 'Continue' }).click()

    // BasicsForm
    await expect(page.getByText('Your basics')).toBeVisible()
    await fillBasicsAndCalculate(page, {
      age: '25',
      monthlyIncome: '5000',
      monthlyExpenses: '2500',
      existingSavings: '10000',
    })

    // Results: should show monthly savings needed
    await expect(page.getByText('Monthly savings needed')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByText('Wedding').first()).toBeVisible()
    // Savings amount shown as X/mo or "Already covered"
    const hasMonthlySavings =
      (await page.getByText('/mo', { exact: false }).count()) > 0
    const hasCovered =
      (await page
        .getByText('Already covered by existing savings')
        .count()) > 0
    expect(hasMonthlySavings || hasCovered).toBeTruthy()
  })

  test('Multi-goal: wedding then car shows combined summary', async ({
    page,
  }) => {
    await goToGoalCalculator(page)

    // ── Goal 1: Wedding ──────────────────────────────────────────────────────
    await page.getByText('Wedding').click()
    await expect(page.getByText('Total amount needed')).toBeVisible()

    // Set target age to 30
    const targetAgeInput1 = page
      .locator('label')
      .filter({ hasText: 'Target age' })
      .locator('..')
      .locator('input')
    await fillInput(targetAgeInput1, '30')
    await page.getByRole('button', { name: 'Continue' }).click()

    // BasicsForm (first time)
    await expect(page.getByText('Your basics')).toBeVisible()
    await fillBasicsAndCalculate(page, {
      age: '25',
      monthlyIncome: '6000',
      monthlyExpenses: '2500',
      existingSavings: '20000',
    })

    // Results for first goal
    await expect(page.getByText('Monthly savings needed')).toBeVisible({
      timeout: 5000,
    })

    // ── Add second goal: Car ─────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Plan for another goal' }).click()

    // Back on picker - Wedding tile's category is 'wedding', Car is 'vehicle'
    // so Car should be enabled
    await expect(
      page.getByText("What's your next big goal?"),
    ).toBeVisible()
    await page.getByText('Car').click()

    // GoalConfig for Car
    await expect(page.getByText('Car').first()).toBeVisible()
    // Car config already has COE category defaults set; leave target age at default and continue
    await page.getByRole('button', { name: 'Continue' }).click()

    // After second goal config, basics already exist so we go straight to results
    // Results page now shows both goals + combined summary
    await expect(
      page.getByText('Combined goal summary'),
    ).toBeVisible({ timeout: 5000 })

    // Both goal labels should be visible
    await expect(page.getByText('Wedding').first()).toBeVisible()
    await expect(page.getByText('Car', { exact: false }).first()).toBeVisible()

    // Combined summary shows total monthly savings needed
    await expect(
      page.getByText('Total monthly savings needed', { exact: false }),
    ).toBeVisible()
  })

  test('Transfer to planner: clicking "Continue to the planner" navigates to /inputs', async ({
    page,
  }) => {
    await goToGoalCalculator(page)

    // Quick path: wedding goal (simplest)
    await page.getByText('Wedding').click()
    await expect(page.getByText('Total amount needed')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    // BasicsForm
    await expect(page.getByText('Your basics')).toBeVisible()
    await fillBasicsAndCalculate(page, {
      age: '28',
      monthlyIncome: '5000',
      monthlyExpenses: '2000',
      existingSavings: '15000',
    })

    // Results page is shown
    await expect(page.getByText('Monthly savings needed')).toBeVisible({
      timeout: 5000,
    })

    // Click the "Continue to the planner" button
    await page.getByRole('button', { name: /Continue to the planner/i }).click()

    // Should navigate to /inputs
    await expect(page).toHaveURL(/\/inputs/, { timeout: 10000 })
  })
})
