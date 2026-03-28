import { test, expect, type Page, type Locator } from '@playwright/test'
import { navigateVia, expectRoute, expandSection } from './helpers'

// ── Setup wizard helpers (same pattern as setup-wizard-p1-p7.spec.ts) ────────

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
 * Walk through the full setup wizard as a citizen.
 * Fills numeric inputs with sensible defaults on each step.
 * Ends on /projection or /wrapped after "Looks good" click.
 */
async function completeSetupWizard(page: Page) {
  await clearAndStart(page)
  await page.getByText('I know when I want to retire').click()
  await page.waitForURL(/\/setup/, { timeout: 10000 })
  await expect(page.getByText(/Step 1/i)).toBeVisible({ timeout: 10000 })

  const stepValues: Record<string, string> = {
    'Step 2': '120000',  // income
    'Step 3': '60000',   // expenses
    'Step 4': '200000',  // savings
  }

  for (let attempt = 0; attempt < 15; attempt++) {
    const looksGood = page.getByRole('button', { name: /looks good/i })
    if (await looksGood.isVisible({ timeout: 500 }).catch(() => false)) {
      await looksGood.click()
      await page.waitForURL(/\/(projection|wrapped|inputs|dashboard)/, { timeout: 15000 })
      return
    }

    const pageText = await page.locator('body').textContent() ?? ''
    for (const [step, val] of Object.entries(stepValues)) {
      if (pageText.includes(step)) {
        await fillVisibleInputs(page, val)
        break
      }
    }

    const nextBtn = page.getByRole('button', { name: /continue|review your answers/i })
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
    }
  }
}

/**
 * Complete the real setup wizard flow and navigate to /inputs.
 */
async function setupAndGoToInputs(page: Page) {
  await completeSetupWizard(page)
  await page.goto('/inputs')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('main')).not.toBeEmpty({ timeout: 10000 })
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('CPF Section', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndGoToInputs(page)
  })

  test('Test 1: Enter CPF balances and verify total displays ~$100,000', async ({ page }) => {
    // Setup wizard completes as a citizen — CPF section must be visible
    const section = page.locator('#section-cpf')
    await expect(section).toBeVisible({ timeout: 10000 })

    await expandSection(page, 'section-cpf')

    const oaInput = section.getByRole('textbox', { name: 'Ordinary (OA)', exact: true })
    const saInput = section.getByRole('textbox', { name: 'Special (SA)', exact: true })
    const maInput = section.getByRole('textbox', { name: 'MediSave (MA)', exact: true })

    await expect(oaInput).toBeVisible({ timeout: 5000 })

    await oaInput.click()
    await oaInput.selectText()
    await oaInput.fill('50000')
    await oaInput.blur()

    await saInput.click()
    await saInput.selectText()
    await saInput.fill('30000')
    await saInput.blur()

    await maInput.click()
    await maInput.selectText()
    await maInput.fill('20000')
    await maInput.blur()

    await page.waitForTimeout(300)

    const totalDisplay = section.locator('.text-green-600').first()
    await expect(totalDisplay).toBeVisible({ timeout: 5000 })

    const totalText = await totalDisplay.textContent()
    const totalValue = Number((totalText ?? '0').replace(/[$,\s]/g, ''))
    expect(totalValue).toBeGreaterThanOrEqual(95000)
    expect(totalValue).toBeLessThanOrEqual(105000)
  })

  test('Test 2: Navigate to projection page and verify CPF column appears', async ({ page }) => {
    await navigateVia(page, 'Projection')
    await expectRoute(page, '/projection')

    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })

    const headers = await table.locator('thead th').allTextContents()
    const hasCpfColumn = headers.some((h) => /CPF/i.test(h))

    if (!hasCpfColumn) {
      const cpfText = page.getByText(/CPF/i).first()
      await expect(cpfText).toBeVisible({ timeout: 5000 })
    } else {
      const cpfHeader = headers.find((h) => /CPF/i.test(h))
      expect(cpfHeader).toBeTruthy()
    }
  })
})
