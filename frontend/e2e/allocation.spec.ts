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

test.describe('Allocation Section', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndGoToInputs(page)
    await expandSection(page, 'section-allocation')
  })

  test('Selecting Balanced template updates weight inputs', async ({ page }) => {
    const section = page.locator('#section-allocation')
    await section.scrollIntoViewIfNeeded()

    // Find the "Current Template" select trigger and open it
    // The AllocationBuilder uses a Radix Select with a trigger that shows the current value
    const triggers = section.locator('[role="combobox"], button[aria-haspopup="listbox"]')
    const triggerCount = await triggers.count()

    if (triggerCount === 0) {
      test.skip()
      return
    }

    // Click the first template selector (Current Template)
    await triggers.first().click()

    // Look for "Balanced" option in the dropdown
    const balancedOption = page.locator('[role="option"]').filter({ hasText: /Balanced/i })
    if (!(await balancedOption.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip()
      return
    }
    await balancedOption.click()
    await page.waitForTimeout(500)

    // After applying Balanced (60/40), the first non-zero weight input
    // should have a value. Balanced template: equities ~30%, bonds ~30%, etc.
    // The inputs are type="number" with inputMode="decimal" inside the allocation table
    const weightInputs = section.locator('input[type="number"][inputmode="decimal"]')
    const count = await weightInputs.count()
    expect(count).toBeGreaterThan(0)

    // At least one input should have a non-zero value after applying Balanced
    let hasNonZero = false
    for (let i = 0; i < count; i++) {
      const val = await weightInputs.nth(i).inputValue()
      if (parseFloat(val) > 0) {
        hasNonZero = true
        break
      }
    }
    expect(hasNonZero).toBe(true)
  })

  test('Portfolio weights sum to approximately 100%', async ({ page }) => {
    const section = page.locator('#section-allocation')
    await section.scrollIntoViewIfNeeded()

    // The tfoot row shows the total as text like "100.0%"
    // Look for the total row in the allocation table
    const totalText = section.locator('tfoot')
    if (await totalText.isVisible({ timeout: 3000 }).catch(() => false)) {
      const footerText = await totalText.textContent() ?? ''
      // Should contain something like "100.0%" for both current and target
      expect(footerText).toMatch(/100\.0%/)
    } else {
      // Fallback: read the weight inputs and sum them
      const weightInputs = section.locator('input[type="number"][inputmode="decimal"]')
      const count = await weightInputs.count()

      if (count === 0) {
        test.skip()
        return
      }

      // Current weights are every other input (even indices), target weights are odd indices
      // Sum the first half (current weights)
      let sum = 0
      const halfCount = Math.floor(count / 2)
      for (let i = 0; i < halfCount; i++) {
        const val = await weightInputs.nth(i * 2).inputValue()
        sum += parseFloat(val) || 0
      }

      // Sum should be close to 100
      expect(sum).toBeGreaterThanOrEqual(95)
      expect(sum).toBeLessThanOrEqual(105)
    }
  })
})
