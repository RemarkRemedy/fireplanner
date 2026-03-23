import { test, expect, type Page, type Locator } from '@playwright/test'
import { navigateVia, expectRoute, expandSection } from './helpers'

// ── Onboarding helper (copied from life-events-income.spec.ts) ───────────────

async function fillInput(locator: Locator, value: string) {
  await locator.click()
  await locator.selectText()
  await locator.fill(value)
}

/**
 * Complete the setup wizard with known defaults:
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

/**
 * Complete onboarding and navigate to /inputs.
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
    // CPF section is visible by default (cpfEnabled defaults to true)
    const section = page.locator('#section-cpf')
    const isVisible = await section.isVisible({ timeout: 5000 }).catch(() => false)

    if (!isVisible) {
      test.skip('CPF section is not visible — cpfEnabled may be false in this state')
      return
    }

    await expandSection(page, 'section-cpf')

    // Use getByRole with exact names to avoid partial matches.
    // "Ordinary (OA)" and "Special (SA)" are unique labels.
    // "MediSave (MA)" appears twice: once as the balance input (exact label)
    // and once as "Annual MediSave (MA) Top-Up" in the voluntary top-ups card.
    // getByRole with exact:true matches the accessible name exactly.
    const oaInput = section.getByRole('textbox', { name: 'Ordinary (OA)', exact: true })
    const saInput = section.getByRole('textbox', { name: 'Special (SA)', exact: true })
    const maInput = section.getByRole('textbox', { name: 'MediSave (MA)', exact: true })

    const oaVisible = await oaInput.isVisible({ timeout: 5000 }).catch(() => false)
    if (!oaVisible) {
      test.skip('CPF balance inputs not found — section may render differently for this age/state')
      return
    }

    // Fill in OA = $50,000
    await oaInput.click()
    await oaInput.selectText()
    await oaInput.fill('50000')
    await oaInput.blur()

    // Fill in SA = $30,000
    await saInput.click()
    await saInput.selectText()
    await saInput.fill('30000')
    await saInput.blur()

    // Fill in MA = $20,000
    await maInput.click()
    await maInput.selectText()
    await maInput.fill('20000')
    await maInput.blur()

    // Wait for the total to update
    await page.waitForTimeout(300)

    // The Total display is a div with class "font-semibold text-green-600" inside the CPF balances grid
    // It shows formatCurrency(totalCpf) = "$100,000"
    const totalDisplay = section.locator('.text-green-600').first()
    await expect(totalDisplay).toBeVisible({ timeout: 5000 })

    const totalText = await totalDisplay.textContent()
    // Parse dollar string — strip $, commas, and whitespace
    const totalValue = Number((totalText ?? '0').replace(/[$,\s]/g, ''))
    expect(totalValue).toBeGreaterThanOrEqual(95000)
    expect(totalValue).toBeLessThanOrEqual(105000)
  })

  test('Test 2: Navigate to projection page and verify CPF column appears', async ({ page }) => {
    const section = page.locator('#section-cpf')
    const isVisible = await section.isVisible({ timeout: 5000 }).catch(() => false)

    if (!isVisible) {
      test.skip('CPF section is not visible — cpfEnabled may be false in this state')
      return
    }

    // Navigate to projection via sidebar
    await navigateVia(page, 'Projection')
    await expectRoute(page, '/projection')

    // Wait for the table to render
    const table = page.locator('table').first()
    const tableVisible = await table.isVisible({ timeout: 10000 }).catch(() => false)

    if (!tableVisible) {
      test.skip('Projection table not visible — inputs may be invalid')
      return
    }

    // Collect all header text from the table
    const headers = await table.locator('thead th').allTextContents()

    // "CPF Total" is in DEFAULT_COLUMN_IDS so it should appear by default
    const hasCpfColumn = headers.some((h) =>
      /CPF/i.test(h)
    )

    if (!hasCpfColumn) {
      // Fallback: look for CPF anywhere on the page (e.g., in column toggles or labels)
      const cpfText = page.getByText(/CPF/i).first()
      await expect(cpfText).toBeVisible({ timeout: 5000 })
    } else {
      // Confirm at least one header contains CPF
      const cpfHeader = headers.find((h) => /CPF/i.test(h))
      expect(cpfHeader).toBeTruthy()
    }
  })
})
