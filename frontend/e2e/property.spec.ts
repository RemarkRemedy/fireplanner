import { test, expect } from '@playwright/test'
import { quickOnboarding } from './helpers'

test.describe('US-12: Property Analysis', () => {
  test('property section visible in demo with existing home fields', async ({ page }) => {
    // Load demo data and navigate to /inputs
    await quickOnboarding(page)

    // Navigate to the property section on /inputs
    const propertySection = page.locator('#section-property')
    await propertySection.scrollIntoViewIfNeeded()
    await expect(propertySection).toBeVisible()

    // Demo data has ownsProperty=true, so "Existing Home & Mortgage" heading should appear
    await expect(propertySection.getByText('Existing Home & Mortgage')).toBeVisible()

    // "Existing property value" field should be visible (demo sets 500k)
    await expect(propertySection.getByText('Existing property value')).toBeVisible()

    // "Mortgage balance" field should be visible (demo sets 200k)
    await expect(propertySection.getByText('Mortgage balance')).toBeVisible()

    // HDB-specific section should be visible (demo property type is HDB)
    await expect(propertySection.getByText('HDB Monetization')).toBeVisible()
  })
})
