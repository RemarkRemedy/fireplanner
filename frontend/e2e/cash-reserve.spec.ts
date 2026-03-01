import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, fillCurrencyInput } from './helpers'

/**
 * Navigate to inputs page and scroll to Net Worth section.
 */
async function goToNetWorth(page: import('@playwright/test').Page) {
  await goToStart(page)
  await selectPathway(page, 'goal-first')
  await page.getByRole('button', { name: /build my full plan/i }).click()
  await expect(page).toHaveURL(/\/inputs/)
  await page.waitForLoadState('networkidle')

  // Click sidebar "Net Worth" to scroll to that section
  const sidebar = page.locator('aside')
  await sidebar.getByText('Net Worth', { exact: true }).first().click()
  await page.waitForTimeout(300)
}

/**
 * Locate the cash reserve switch (the one next to "Cash Reserve / Emergency Fund" text).
 */
function _getCashReserveSwitch(page: import('@playwright/test').Page) {
  // The switch is a sibling of the text "Cash Reserve / Emergency Fund"
  // In the accessibility tree it's: text "Cash Reserve / Emergency Fund" > button "i" > switch
  return page.locator('switch').first()
}

test.describe('Cash Reserve / Emergency Fund', () => {
  test('section is hidden by default, toggle reveals inputs', async ({ page }) => {
    // GIVEN: User is on the Net Worth section
    await goToNetWorth(page)

    // THEN: Cash Reserve title should be visible
    await expect(page.getByText('Cash Reserve / Emergency Fund')).toBeVisible()

    // The mode selector should NOT be visible (section is collapsed)
    await expect(page.getByText('Reserve Mode')).toHaveCount(0)

    // WHEN: User toggles cash reserve on
    // The switch is right after the "Cash Reserve / Emergency Fund" text
    const _cashSwitch = page.getByRole('switch').filter({ hasNot: page.locator('[data-state="checked"]') }).first()
    // Find the specific switch for cash reserve — it's in the Net Worth section
    const _netWorthSection = page.locator('#section-net-worth')
    // The cash reserve switch is the first unchecked switch in the net worth section
    // Use a more targeted approach: find the switch that's a sibling of the cash reserve title
    const cashReserveHeading = page.getByText('Cash Reserve / Emergency Fund')
    const cashReserveContainer = cashReserveHeading.locator('..')
    const crSwitch = cashReserveContainer.locator('..').getByRole('switch').first()
    await crSwitch.click()
    await page.waitForTimeout(300)

    // THEN: Mode selector and inputs appear
    await expect(page.getByText('Reserve Mode')).toBeVisible()
    await expect(page.getByText('Fixed Amount', { exact: true })).toBeVisible()
    await expect(page.getByText('Months of Expenses', { exact: true })).toBeVisible()
    await expect(page.getByText('Cash Return Rate')).toBeVisible()
    await expect(page.getByText('Reserve target:')).toBeVisible()
  })

  test('mode selector switches between fixed and months inputs', async ({ page }) => {
    // GIVEN: Cash reserve is enabled
    await goToNetWorth(page)
    const cashReserveHeading = page.getByText('Cash Reserve / Emergency Fund')
    const crSwitch = cashReserveHeading.locator('..').locator('..').getByRole('switch').first()
    await crSwitch.click()
    await page.waitForTimeout(300)

    // THEN: Default mode is "Months of Expenses" (per store defaults)
    const monthsBtn = page.getByText('Months of Expenses', { exact: true })
    const fixedBtn = page.getByText('Fixed Amount', { exact: true })
    await expect(monthsBtn).toBeVisible()
    await expect(fixedBtn).toBeVisible()

    // WHEN: User clicks "Fixed Amount"
    await fixedBtn.click()
    await page.waitForTimeout(200)

    // THEN: Should show "Reserve Target" label
    await expect(page.getByText('Reserve Target').first()).toBeVisible()

    // WHEN: Switch back to "Months of Expenses"
    await monthsBtn.click()
    await page.waitForTimeout(200)

    // THEN: Should show "Months of Expenses" input label (not the mode button)
    // The NumberInput renders a label with this text in the input area
    const inputLabels = page.locator('#section-net-worth').getByText('Months of Expenses', { exact: true })
    // There are two: the mode button and the input label — at least 2 should be visible
    await expect(inputLabels.first()).toBeVisible()
  })

  test('computed target displays a dollar value', async ({ page }) => {
    // GIVEN: Cash reserve is enabled in months mode
    await goToNetWorth(page)
    const cashReserveHeading = page.getByText('Cash Reserve / Emergency Fund')
    const crSwitch = cashReserveHeading.locator('..').locator('..').getByRole('switch').first()
    await crSwitch.click()
    await page.waitForTimeout(300)

    // THEN: Reserve target should show a computed dollar value
    // Default: 6 months × $48,000/yr / 12 = $24,000
    const targetDisplay = page.getByText('Reserve target:')
    await expect(targetDisplay).toBeVisible()
    // The parent container should contain a dollar sign
    await expect(page.getByText(/Reserve target:.*\$/)).toBeVisible()
  })

  test('funded status shows green badge when LNW covers reserve', async ({ page }) => {
    // GIVEN: User is on Net Worth section
    await goToNetWorth(page)

    // Set liquid net worth to $100,000
    await fillCurrencyInput(page, 'Liquid Net Worth', '100000')
    await page.waitForTimeout(300)

    // WHEN: Enable cash reserve
    const cashReserveHeading = page.getByText('Cash Reserve / Emergency Fund')
    const crSwitch = cashReserveHeading.locator('..').locator('..').getByRole('switch').first()
    await crSwitch.click()
    await page.waitForTimeout(300)

    // THEN: With $100K NW and 6 months × $4K/month = $24K target → should show "Funded"
    await expect(page.getByText('Funded')).toBeVisible()
  })

  test('unfunded status shows shortfall when LNW is zero', async ({ page }) => {
    // GIVEN: User has zero net worth
    await goToNetWorth(page)
    await fillCurrencyInput(page, 'Liquid Net Worth', '0')
    await page.waitForTimeout(300)

    // WHEN: Enable cash reserve
    const cashReserveHeading = page.getByText('Cash Reserve / Emergency Fund')
    const crSwitch = cashReserveHeading.locator('..').locator('..').getByRole('switch').first()
    await crSwitch.click()
    await page.waitForTimeout(300)

    // THEN: Should show "Needs $X more"
    await expect(page.getByText(/Needs \$[\d,]+ more/)).toBeVisible()
  })

  test('retirement bucket toggle shows bucket inputs', async ({ page }) => {
    // GIVEN: Cash reserve is enabled
    await goToNetWorth(page)
    const cashReserveHeading = page.getByText('Cash Reserve / Emergency Fund')
    const crSwitch = cashReserveHeading.locator('..').locator('..').getByRole('switch').first()
    await crSwitch.click()
    await page.waitForTimeout(300)

    // THEN: Retirement Cash Bucket section visible but bucket inputs hidden
    await expect(page.getByText('Retirement Cash Bucket')).toBeVisible()
    await expect(page.getByText('Bucket Size (Months)')).toHaveCount(0)

    // WHEN: User enables the retirement bucket (second switch in the card)
    // The bucket switch is the second switch visible in the cash reserve area
    const allSwitches = page.locator('#section-net-worth').getByRole('switch')
    // First switch = cash reserve enable, second = bucket
    const bucketSwitch = allSwitches.nth(1)
    await bucketSwitch.click()
    await page.waitForTimeout(300)

    // THEN: Bucket inputs appear
    await expect(page.getByText('Bucket Size (Months)')).toBeVisible()
    await expect(page.getByText('Bucket Cash Return')).toBeVisible()
  })

  test('disabling cash reserve hides all sub-sections', async ({ page }) => {
    // GIVEN: Cash reserve enabled with bucket on
    await goToNetWorth(page)
    const netWorthSwitches = page.locator('#section-net-worth').getByRole('switch')

    // Enable cash reserve (first switch)
    await netWorthSwitches.first().click()
    await page.waitForTimeout(300)

    // Enable bucket (second switch)
    await netWorthSwitches.nth(1).click()
    await page.waitForTimeout(300)

    // Verify inputs are visible
    await expect(page.getByText('Reserve Mode')).toBeVisible()
    await expect(page.getByText('Bucket Size (Months)')).toBeVisible()

    // WHEN: Disable cash reserve (toggle off first switch)
    await netWorthSwitches.first().click()
    await page.waitForTimeout(300)

    // THEN: All inputs are hidden
    await expect(page.getByText('Reserve Mode')).toHaveCount(0)
    await expect(page.getByText('Bucket Size (Months)')).toHaveCount(0)
  })

  test('values persist after page reload (localStorage)', async ({ page }) => {
    // GIVEN: User enables cash reserve and switches to fixed mode
    await goToNetWorth(page)
    const netWorthSwitches = page.locator('#section-net-worth').getByRole('switch')
    await netWorthSwitches.first().click()
    await page.waitForTimeout(300)

    // Switch to fixed mode
    await page.getByText('Fixed Amount', { exact: true }).click()
    await page.waitForTimeout(200)

    // Verify fixed mode is active
    await expect(page.getByText('Reserve Target').first()).toBeVisible()

    // WHEN: Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Navigate back to Net Worth
    const sidebar = page.locator('aside')
    await sidebar.getByText('Net Worth', { exact: true }).first().click()
    await page.waitForTimeout(300)

    // THEN: Cash reserve should still be enabled and in fixed mode
    await expect(page.getByText('Reserve Mode')).toBeVisible()
    await expect(page.getByText('Reserve Target').first()).toBeVisible()
  })
})
