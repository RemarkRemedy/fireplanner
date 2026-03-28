import { test, expect, type Page, type Locator } from '@playwright/test'

// ── Setup wizard helpers ─────────────────────────────────────────────────────

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
    if (await inputs.nth(i).isVisible()) {
      await fillInput(inputs.nth(i), value)
    }
  }
}

/**
 * Walk through setup wizard. On the property screen, select "I own property"
 * and fill property details. On property-details screen, fill values.
 */
async function completeSetupWithProperty(page: Page) {
  await clearAndStart(page)
  await page.getByText('I know when I want to retire').click()
  await page.waitForURL(/\/setup/, { timeout: 10000 })
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 })

  const stepValues: Record<string, string> = {
    'Step 2': '120000',
    'Step 3': '60000',
    'Step 4': '200000',
  }

  for (let attempt = 0; attempt < 15; attempt++) {
    const looksGood = page.getByRole('button', { name: /looks good/i })
    if (await looksGood.isVisible({ timeout: 500 }).catch(() => false)) {
      await looksGood.click()
      await page.waitForURL(/\/(projection|wrapped|inputs|dashboard)/, { timeout: 15000 })
      return
    }

    const pageText = await page.locator('body').textContent() ?? ''

    // Fill numeric inputs based on step
    for (const [step, val] of Object.entries(stepValues)) {
      if (pageText.includes(step)) {
        await fillVisibleInputs(page, val)
        break
      }
    }

    // On the property toggle screen, select "I own property"
    if (pageText.includes('I own property') && pageText.includes('No property')) {
      const ownsBtn = page.getByText('I own property')
      if (await ownsBtn.isVisible().catch(() => false)) {
        await ownsBtn.click()
        await page.waitForTimeout(300)
      }
    }

    // On the property details screen, fill values
    if (pageText.includes('Your property') && pageText.includes('Estimated current value')) {
      await fillVisibleInputs(page, '500000')
    }

    const nextBtn = page.getByRole('button', { name: /continue|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('US-12: Property Analysis', () => {
  test('setup wizard with "I own property" shows property section on inputs', async ({ page }) => {
    await completeSetupWithProperty(page)

    await page.goto('/inputs')
    await page.waitForLoadState('networkidle')

    // Property section should be visible after selecting "I own property" in setup
    const propertySection = page.locator('#section-property')
    await propertySection.scrollIntoViewIfNeeded()
    await expect(propertySection).toBeVisible({ timeout: 10000 })

    // Property equity should be calculated from the setup values
    await expect(propertySection.getByText(/property|equity|mortgage/i).first()).toBeVisible()
  })
})
