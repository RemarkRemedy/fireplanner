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
 * Walk through setup wizard. On the residency screen, select the given status.
 */
async function completeSetupAs(page: Page, residency: 'citizen' | 'pr' | 'foreigner') {
  await clearAndStart(page)
  await page.getByText('I know when I want to retire').click()
  await page.waitForURL(/\/setup/, { timeout: 10000 })
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 })

  const residencyLabels: Record<string, string> = {
    citizen: 'Singapore Citizen',
    pr: 'Permanent Resident',
    foreigner: 'Foreigner',
  }

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

    // Select residency on the residency screen
    if (pageText.includes('Singapore Citizen') && pageText.includes('Foreigner')) {
      const choice = page.getByText(residencyLabels[residency])
      if (await choice.isVisible().catch(() => false)) {
        await choice.click()
        await page.waitForTimeout(300)
      }
    }

    const nextBtn = page.getByRole('button', { name: /continue|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('US-11: CPF Section Toggles', () => {
  test('citizen setup wizard produces visible CPF section on inputs page', async ({ page }) => {
    await completeSetupAs(page, 'citizen')

    await page.goto('/inputs')
    await page.waitForLoadState('networkidle')

    // Citizen → CPF section should be visible
    const cpfSection = page.locator('#section-cpf')
    await expect(cpfSection).toBeVisible({ timeout: 10000 })

    // Sidebar should have CPF link
    const sidebarCpf = page.locator('aside').getByText('CPF', { exact: true }).first()
    await expect(sidebarCpf).toBeVisible()
  })

  test('foreigner setup wizard hides CPF section on inputs page', async ({ page }) => {
    await completeSetupAs(page, 'foreigner')

    await page.goto('/inputs')
    await page.waitForLoadState('networkidle')

    // Foreigner → CPF section should NOT be visible
    const cpfSection = page.locator('#section-cpf')
    await expect(cpfSection).toHaveCount(0)

    // Sidebar should not have CPF link
    const sidebarButtons = page.locator('aside button')
    const cpfButtons = sidebarButtons.filter({ hasText: /^CPF$/ })
    await expect(cpfButtons).toHaveCount(0)
  })
})
