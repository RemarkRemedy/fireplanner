import { test, expect } from '@playwright/test'
import { goToStart, selectPathway } from './helpers'

test.describe('US-12: Property Analysis', () => {
  test('enable property on start page, fill property inputs, verify equity displayed', async ({ page }) => {
    // 1. Go to start page with clean state
    await goToStart(page)

    // 2. Select goal-first pathway
    await selectPathway(page, 'goal-first')

    // 3. Enable Property Analysis toggle on the start page
    // Section toggles: CPF Integration (switch 1), Healthcare (conditionally switch 2), Property Analysis (last switch)
    // Property Analysis text should be visible
    await expect(page.getByText('Property Analysis')).toBeVisible()

    // Find the Property Analysis switch — it's the last switch in the section toggles
    // Since CPF is enabled by default, Healthcare appears as switch 2, Property is switch 3
    // However, healthcare is nested and only shows when CPF is enabled.
    // Let's find the switch closest to "Property Analysis" text
    const propertyToggleRow = page.locator('div').filter({ hasText: /^Property Analysis/ }).first()
    const propertySwitch = propertyToggleRow.locator('button[role="switch"]')

    // Enable it
    const propState = await propertySwitch.getAttribute('data-state')
    if (propState !== 'checked') {
      await propertySwitch.click()
    }
    await expect(propertySwitch).toHaveAttribute('data-state', 'checked')

    // 4. Complete onboarding — click "Build my full plan"
    await page.getByRole('button', { name: /build my full plan/i }).click()
    await expect(page).toHaveURL(/\/inputs/)
    await page.waitForLoadState('networkidle')

    // 5. Navigate to the property section on /inputs
    const propertySection = page.locator('#section-property')
    await propertySection.scrollIntoViewIfNeeded()
    await expect(propertySection).toBeVisible()

    // 6. Select "Own, with mortgage" to enable property fields
    // The property section uses a segmented button control with 3 options
    const withMortgageButton = propertySection.getByText('Own, with mortgage')
    await withMortgageButton.click()

    // 7. Select property type HDB
    // The property type dropdown uses a Select component
    const propertyTypeDropdown = propertySection.locator('button').filter({ hasText: /Condo|HDB|Landed/ }).first()
    await propertyTypeDropdown.click()
    // Select HDB from the dropdown options
    await page.getByRole('option', { name: 'HDB' }).click()

    // 8. Fill in property value = 500000
    const propertyValueInput = propertySection.locator('label, [class*="Label"]')
      .filter({ hasText: 'Current Property Value' })
      .locator('..')
      .locator('input')
    await propertyValueInput.click()
    await propertyValueInput.fill('500000')

    // 9. Fill in mortgage balance = 300000
    const mortgageInput = propertySection.locator('label, [class*="Label"]')
      .filter({ hasText: 'Outstanding Mortgage' })
      .locator('..')
      .locator('input')
    await mortgageInput.click()
    await mortgageInput.fill('300000')

    // 10. Fill in monthly payment = 1500
    const monthlyPaymentInput = propertySection.locator('label, [class*="Label"]')
      .filter({ hasText: 'Monthly Mortgage Payment' })
      .locator('..')
      .locator('input')
    await monthlyPaymentInput.click()
    await monthlyPaymentInput.fill('1500')

    // 11. Verify property equity is calculated and displayed
    // Property Equity = Value - Mortgage = 500000 - 300000 = 200000
    const equityText = propertySection.getByText('Property Equity')
    await expect(equityText).toBeVisible()

    // The equity value should show $200,000
    const equityValue = propertySection.getByText('$200,000')
    await expect(equityValue).toBeVisible()

    // 12. Verify mortgage-related outputs appear
    // "Cash portion" display should be visible (total payment - CPF portion)
    const cashPortion = propertySection.getByText('Cash portion')
    await expect(cashPortion).toBeVisible()
  })
})
