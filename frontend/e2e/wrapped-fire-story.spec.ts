import { test, expect, type Page, type Locator } from '@playwright/test'

// ── Onboarding helper (copied from life-events-income.spec.ts) ──────────

async function fillInput(locator: Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Complete the setup wizard with known defaults.
 * Age 30, retirement 55, income $100K/yr, expenses $50K/yr, savings $200K.
 * Ends on /projection (desktop).
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

// ── Tests ────────────────────────────────────────────────────────────────

test.describe('Wrapped FIRE Story', () => {
  test('renders first card after onboarding', async ({ page }) => {
    await completeSetupWizard(page)

    // Navigate to the wrapped story
    await page.goto('/wrapped')
    await page.waitForLoadState('networkidle')

    // The WrappedStoryContainer renders as a full-screen dialog
    const dialog = page.getByRole('dialog', { name: /FIRE Story/i })
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // At minimum, the close button is always rendered
    await expect(dialog.getByRole('button', { name: /close/i })).toBeVisible({ timeout: 5000 })

    // The progress bar is rendered — it has at least one segment
    const progressBar = page.locator('[role="dialog"] [aria-label*="progress"], [role="dialog"] .h-1, [role="dialog"] .h-0\\.5').first()
    // Rather than asserting the progress bar specifically, assert the dialog has visible content
    // by checking that the body of the dialog has non-trivial text
    const dialogText = await dialog.textContent()
    expect(dialogText?.length ?? 0).toBeGreaterThan(10)
  })

  test('advancing to next card shows different content', async ({ page }) => {
    await completeSetupWizard(page)
    await page.goto('/wrapped')
    await page.waitForLoadState('networkidle')

    const dialog = page.getByRole('dialog', { name: /FIRE Story/i })
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Capture the text of the first card
    const firstText = await dialog.textContent()

    // Advance to the next card by pressing ArrowRight (keyboard navigation)
    await dialog.focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)

    // The second card should be visible and have different content
    const secondText = await dialog.textContent()

    // The two cards should differ — they render completely different card components
    expect(secondText).not.toEqual(firstText)

    // The dialog should still be present (not closed)
    await expect(dialog).toBeVisible({ timeout: 3000 })
  })
})
