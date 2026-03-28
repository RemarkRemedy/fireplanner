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

/** Fill only visible numeric inputs on the current step */
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

/** Enter setup wizard from start page */
async function enterSetupWizard(page: Page) {
  await clearAndStart(page)
  await expect(page.getByText('Singapore FIRE Planner')).toBeVisible({ timeout: 10000 })
  await page.getByText('I know when I want to retire').click()
  await page.waitForURL(/\/setup/, { timeout: 10000 })
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 })
}

/**
 * Walk through all wizard steps by clicking Continue/Review repeatedly.
 * Fills numeric inputs on each step with sensible defaults.
 * On the property step, selects the specified ownership choice.
 */
async function completeSetupWizard(page: Page, opts?: { ownsProperty?: 'owns' | 'planning' | 'no' }) {
  await enterSetupWizard(page)

  const stepValues: Record<string, string> = {
    'Step 2': '120000',  // income
    'Step 3': '60000',   // expenses
    'Step 4': '200000',  // savings
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    // Check if we've reached the review checkpoint
    const looksGood = page.getByRole('button', { name: /looks good/i })
    if (await looksGood.isVisible({ timeout: 500 }).catch(() => false)) {
      await looksGood.click()
      return
    }

    // Determine current step for filling values
    const pageText = await page.locator('body').textContent() ?? ''
    for (const [step, val] of Object.entries(stepValues)) {
      if (pageText.includes(step)) {
        await fillVisibleInputs(page, val)
        break
      }
    }

    // Handle property step — select ownership (detect by content, not step number)
    if (pageText.includes('Planning to buy') || pageText.includes('I own property')) {
      const propertyChoice = opts?.ownsProperty ?? 'no'
      if (propertyChoice === 'planning') {
        const planBtn = page.getByText('Planning to buy')
        if (await planBtn.isVisible().catch(() => false)) {
          await planBtn.click()
          await page.waitForTimeout(300)
        }
      }
    }

    // Click Continue or "Review your answers"
    const nextBtn = page.getByRole('button', { name: /continue|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }
}

test.describe('P1-P7: Setup Wizard & Nudge Flows', () => {
  test('smoke: start page loads and enters setup wizard', async ({ page }) => {
    await enterSetupWizard(page)
    await expect(page.getByText('How old are you?')).toBeVisible()
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible()
  })

  test('setup wizard completes all steps and navigates away', async ({ page }) => {
    await completeSetupWizard(page, { ownsProperty: 'no' })
    await page.waitForURL(/\/(dashboard|projection|inputs)/, { timeout: 15000 })
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('P5: planning-to-buy creates Property Down Payment goal', async ({ page }) => {
    await completeSetupWizard(page, { ownsProperty: 'planning' })
    await page.waitForURL(/\/(dashboard|projection|inputs)/, { timeout: 15000 })

    const goalData = await page.evaluate(() => {
      const raw = localStorage.getItem('fireplanner-household-plan-v1')
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw)
        const goals = parsed?.state?.plan?.goals ?? []
        return goals.find((g: { label: string }) => g.label === 'Property Down Payment') ?? null
      } catch { return null }
    })

    expect(goalData).not.toBeNull()
    expect(goalData.amount).toBe(375000)  // $1.5M × 25%
    expect(goalData.category).toBe('housing')
  })

  test('P7: protection section shows new fields on Inputs page', async ({ page }) => {
    await completeSetupWizard(page, { ownsProperty: 'no' })
    await page.waitForURL(/\/(dashboard|projection|inputs)/, { timeout: 15000 })

    await page.goto('/inputs')
    await page.waitForLoadState('networkidle')

    // Switch to Advanced mode — Protection section is visible but collapsed in Simple
    const advancedBtn = page.getByRole('button', { name: /advanced/i }).or(page.locator('button').filter({ hasText: 'Advanced' }))
    await advancedBtn.click()
    await page.waitForTimeout(1000)

    // Scroll to the protection section
    const protectionSection = page.locator('#section-protection')
    await protectionSection.scrollIntoViewIfNeeded()
    await expect(protectionSection).toBeVisible({ timeout: 5000 })

    const efTarget = page.getByText('Emergency Fund Target (months)')
    await efTarget.scrollIntoViewIfNeeded()
    await expect(efTarget).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Annual Insurance Premiums')).toBeVisible()
  })

  test('setup values carry through to inputs page and store', async ({ page }) => {
    // Use the standard setup wizard which fills:
    // Step 1: age fields left at defaults (30, 65)
    // Step 2 (income): 120000 monthly take-home
    // Step 3 (expenses): 60000 monthly
    // Step 4 (savings): 200000
    await completeSetupWizard(page, { ownsProperty: 'no' })
    await page.waitForURL(/\/(projection|wrapped|inputs|dashboard)/, { timeout: 15000 })

    await page.goto('/inputs')
    await page.waitForLoadState('networkidle')

    // Verify values landed in the household plan store
    const storeData = await page.evaluate(() => {
      const raw = localStorage.getItem('fireplanner-household-plan-v1')
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw)
        const adult = parsed?.state?.plan?.adults?.[0]
        return {
          currentAge: adult?.currentAge,
          retirementAge: adult?.retirementAge,
          annualIncome: adult?.annualIncome,
          annualExpenses: adult?.annualExpenses,
          liquidNetWorth: adult?.liquidNetWorth,
        }
      } catch { return null }
    })

    expect(storeData).not.toBeNull()

    // Core contract: setup wizard values land in the household plan store
    // Age: Step 1 uses default age (30) since fillVisibleInputs doesn't target specific fields
    expect(storeData!.currentAge).toBe(30)
    expect(storeData!.retirementAge).toBe(55)
    // Income: 120000 monthly take-home → gross-up'd to annual
    expect(storeData!.annualIncome).toBeGreaterThan(1000000)
    // Expenses: 60000 monthly → annualized = 720000
    expect(storeData!.annualExpenses).toBe(720000)
    // Savings: should be populated (non-zero)
    expect(storeData!.liquidNetWorth).toBeGreaterThan(0)

    // Verify the inputs page renders with the setup data
    const personalSection = page.locator('#section-personal')
    await expect(personalSection).toBeVisible({ timeout: 10000 })
    // The "People & Household" section should show the age from setup
    await expect(personalSection.getByText(/Age 30/)).toBeVisible({ timeout: 5000 })
  })

  test('P7: healthcare section shows premium overrides on Inputs page', async ({ page }) => {
    await completeSetupWizard(page, { ownsProperty: 'no' })
    await page.waitForURL(/\/(dashboard|projection|inputs)/, { timeout: 15000 })

    await page.goto('/inputs')
    await page.waitForLoadState('networkidle')

    const customIsp = page.getByText('Custom ISP premium (annual)')
    await customIsp.scrollIntoViewIfNeeded()
    await expect(customIsp).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Use MediSave for premiums')).toBeVisible()
  })
})
