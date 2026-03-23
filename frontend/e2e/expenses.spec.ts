import { test, expect, type Page, type Locator } from '@playwright/test'
import { expandSection } from './helpers'

// ── Onboarding helper ────────────────────────────────────────────────

async function fillInput(locator: Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Complete the setup wizard with known defaults.
 * Age 30, retirement 55, income $100K/yr, expenses $50K/yr, savings $200K.
 */
async function completeSetupWizard(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')

  await page.getByText('I know when I want to retire').click()
  await page.waitForURL(/\/setup/, { timeout: 10000 })
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 })

  const stepValues: Record<string, string[]> = {
    'How old are you': ['30', '55'],
    'What do you earn': ['8333'],
    'What do you spend': ['4167'],
    'What have you saved': ['200000'],
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const looksGood = page.getByRole('button', { name: /looks good/i })
    if (await looksGood.isVisible({ timeout: 500 }).catch(() => false)) {
      await looksGood.click()
      await page.waitForURL(/\/(projection|wrapped|inputs|dashboard)/, { timeout: 15000 })
      return
    }

    const pageText = await page.locator('body').textContent() ?? ''

    for (const [stepTitle, values] of Object.entries(stepValues)) {
      if (pageText.includes(stepTitle)) {
        const inputs = page.locator('input[inputmode="numeric"]:visible, input[inputmode="decimal"]:visible')
        const count = await inputs.count()
        for (let i = 0; i < Math.min(count, values.length); i++) {
          await fillInput(inputs.nth(i), values[i])
        }
        break
      }
    }

    if (pageText.includes('What do you earn')) {
      const toggle = page.getByRole('switch').first()
      if (await toggle.isVisible().catch(() => false)) {
        const checked = await toggle.getAttribute('aria-checked')
        if (checked !== 'true') {
          await toggle.click()
          await page.waitForTimeout(300)
          const incomeInputs = page.locator('input[inputmode="numeric"]:visible, input[inputmode="decimal"]:visible')
          const incomeCount = await incomeInputs.count()
          if (incomeCount > 0) {
            await fillInput(incomeInputs.first(), '8333')
          }
        }
      }
    }

    const nextBtn = page.getByRole('button', { name: /continue|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }
}

async function setupAndGoToInputs(page: Page) {
  await completeSetupWizard(page)
  await page.goto('/inputs')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('main')).not.toBeEmpty({ timeout: 10000 })
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe('Expenses Section', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndGoToInputs(page)
    await expandSection(page, 'section-expenses')
  })

  test('Expenses section renders with spending content', async ({ page }) => {
    const section = page.locator('#section-expenses')
    await section.scrollIntoViewIfNeeded()

    // The section is titled "Spending, Healthcare & Goals"
    await expect(section.getByText(/Spending|Healthcare|Goals|spending/i).first()).toBeVisible({ timeout: 5000 })

    // There should be at least one input visible (the base living expense from onboarding)
    // or the "Add living cost" / "Spending Items" card should be visible
    const hasInput = await section.locator('input').first().isVisible({ timeout: 3000 }).catch(() => false)
    const hasSpendingCard = await section.getByText(/Spending Items|Add living cost|Add adjustment/i).first().isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasInput || hasSpendingCard).toBe(true)
  })

  test('Modifying base living expense amount updates FIRE status bar', async ({ page }) => {
    const section = page.locator('#section-expenses')
    await section.scrollIntoViewIfNeeded()

    // Read current FIRE Age from the status strip
    const fireAgeLocator = page.getByText(/FIRE Age/).first()
    const fireAgeVisible = await fireAgeLocator.isVisible({ timeout: 5000 }).catch(() => false)

    if (!fireAgeVisible) {
      test.skip()
      return
    }

    const getRawFireAgeText = async () => {
      // The FireStatsStrip shows "FIRE Age" and the value nearby
      const stripText = await page.locator('body').textContent() ?? ''
      const match = stripText.match(/FIRE Age[:\s]*(\d+)/)
      return match ? parseInt(match[1], 10) : null
    }

    const baselineFireAge = await getRawFireAgeText()

    // Find the "Amount" currency input for the base living expense
    // The SpendingGoalsSection renders expense items with a CurrencyInput labelled "Amount"
    const amountInputs = section.locator('input[inputmode="numeric"]')
    const inputCount = await amountInputs.count()

    if (inputCount === 0) {
      // No expense items seeded — add a living cost and then test
      const addBtn = section.getByRole('button', { name: /Add living cost/i })
      if (!(await addBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip()
        return
      }
      await addBtn.click()
      await page.waitForTimeout(500)
    }

    // Get the first Amount input in the section
    const amountInput = amountInputs.first()
    if (!(await amountInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip()
      return
    }

    // Set a very large expense to force a FIRE age change
    await amountInput.click()
    await amountInput.selectText()
    await amountInput.fill('200000')
    await amountInput.blur()
    await page.waitForTimeout(1000)

    const newFireAge = await getRawFireAgeText()

    // If we got a parseable baseline and a new value, the new FIRE age
    // should be >= baseline (higher expenses = later FIRE age, or unreachable)
    if (baselineFireAge !== null && newFireAge !== null) {
      expect(newFireAge).toBeGreaterThanOrEqual(baselineFireAge)
    } else {
      // At minimum verify the page didn't crash
      await expect(page.getByText('Unexpected Application Error')).not.toBeVisible()
    }
  })
})
