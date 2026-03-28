import { test, expect } from '@playwright/test'
import { quickOnboarding } from './helpers'

/**
 * Navigate to inputs page and scroll to FIRE Settings section where Cash Reserve lives.
 */
async function goToCashReserve(page: import('@playwright/test').Page) {
  await quickOnboarding(page)

  // Click sidebar "FIRE Settings" to scroll to that section
  const sidebar = page.locator('aside')
  await sidebar.getByText('FIRE Settings', { exact: true }).first().click()
  await page.waitForTimeout(300)
}

/**
 * Find and click the cash reserve switch (next to "Cash Reserve & Retirement Buffers" heading).
 */
async function toggleCashReserve(page: import('@playwright/test').Page) {
  const heading = page.getByText('Cash Reserve & Retirement Buffers')
  await heading.scrollIntoViewIfNeeded()
  const container = heading.locator('..').locator('..')
  const crSwitch = container.getByRole('switch').first()
  await crSwitch.click()
  await page.waitForTimeout(300)
}

test.describe('Cash Reserve & Retirement Buffers', () => {
  test('section is hidden by default, toggle reveals inputs', async ({ page }) => {
    // GIVEN: User is on the FIRE Settings section
    await goToCashReserve(page)

    // THEN: Cash Reserve title should be visible
    await expect(page.getByText('Cash Reserve & Retirement Buffers')).toBeVisible()

    // The mode buttons should NOT be visible (section is collapsed by default)
    await expect(page.getByRole('button', { name: 'Fixed amount' })).not.toBeVisible()

    // WHEN: User toggles cash reserve on
    await toggleCashReserve(page)

    // THEN: Mode buttons and inputs appear
    await expect(page.getByRole('button', { name: 'Fixed amount' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Months of expenses' })).toBeVisible()
    await expect(page.getByText('Cash return')).toBeVisible()
  })

  test('mode selector switches between fixed and months inputs', async ({ page }) => {
    // GIVEN: Cash reserve is enabled
    await goToCashReserve(page)
    await toggleCashReserve(page)

    // THEN: Default mode buttons should be visible
    const monthsBtn = page.getByRole('button', { name: 'Months of expenses' })
    const fixedBtn = page.getByRole('button', { name: 'Fixed amount' })
    await expect(monthsBtn).toBeVisible()
    await expect(fixedBtn).toBeVisible()

    // WHEN: User clicks "Fixed amount"
    await fixedBtn.click()
    await page.waitForTimeout(200)

    // THEN: Should show "Reserve target" label
    await expect(page.getByText('Reserve target').first()).toBeVisible()

    // WHEN: Switch back to "Months of expenses"
    await monthsBtn.click()
    await page.waitForTimeout(200)

    // THEN: Months button should still be visible
    await expect(monthsBtn).toBeVisible()
  })

  test('retirement bucket toggle shows bucket inputs', async ({ page }) => {
    // GIVEN: Cash reserve is enabled
    await goToCashReserve(page)
    await toggleCashReserve(page)

    // THEN: Retirement cash bucket section visible but bucket inputs hidden
    await expect(page.getByText('Retirement cash bucket')).toBeVisible()
    await expect(page.getByText('Bucket size (months)')).not.toBeVisible()

    // WHEN: User enables the retirement bucket
    // The bucket switch is inside the "Retirement cash bucket" container
    const bucketHeading = page.getByText('Retirement cash bucket')
    await bucketHeading.scrollIntoViewIfNeeded()
    const bucketContainer = bucketHeading.locator('..').locator('..')
    const bucketSwitch = bucketContainer.getByRole('switch').first()
    await bucketSwitch.click()
    await page.waitForTimeout(300)

    // THEN: Bucket inputs appear
    await expect(page.getByText('Bucket size (months)')).toBeVisible()
    await expect(page.getByText('Bucket cash return')).toBeVisible()
  })

  test('disabling cash reserve hides mode buttons', async ({ page }) => {
    // GIVEN: Cash reserve enabled
    await goToCashReserve(page)
    await toggleCashReserve(page)

    // Verify inputs are visible
    await expect(page.getByRole('button', { name: 'Fixed amount' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Months of expenses' })).toBeVisible()

    // WHEN: Disable cash reserve (toggle off)
    await toggleCashReserve(page)

    // THEN: Mode buttons are hidden
    await expect(page.getByRole('button', { name: 'Fixed amount' })).not.toBeVisible()
  })

  test('values persist after page reload (localStorage)', async ({ page }) => {
    // GIVEN: User enables cash reserve and switches to fixed mode
    await goToCashReserve(page)
    await toggleCashReserve(page)

    // Switch to fixed mode
    await page.getByRole('button', { name: 'Fixed amount' }).click()
    await page.waitForTimeout(200)

    // Verify fixed mode is active
    await expect(page.getByText('Reserve target').first()).toBeVisible()

    // WHEN: Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Navigate back to FIRE Settings
    const sidebar = page.locator('aside')
    await sidebar.getByText('FIRE Settings', { exact: true }).first().click()
    await page.waitForTimeout(300)

    // Scroll to the cash reserve heading
    const heading = page.getByText('Cash Reserve & Retirement Buffers')
    await heading.scrollIntoViewIfNeeded()

    // THEN: Cash reserve should still be enabled and in fixed mode
    await expect(page.getByRole('button', { name: 'Fixed amount' })).toBeVisible()
    await expect(page.getByText('Reserve target').first()).toBeVisible()
  })
})
