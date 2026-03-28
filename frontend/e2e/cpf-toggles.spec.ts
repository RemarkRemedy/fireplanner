import { test, expect } from '@playwright/test'
import { quickOnboarding } from './helpers'

test.describe('US-11: CPF Section Toggles', () => {
  test('CPF section visible after setup as citizen', async ({ page }) => {
    // Load demo data (demo user is a citizen) and navigate to /inputs
    await quickOnboarding(page)

    // Verify CPF section is visible on the inputs page
    const cpfSection = page.locator('#section-cpf')
    await expect(cpfSection).toBeVisible()
  })

  test('CPF sidebar link exists for citizen user', async ({ page }) => {
    // Load demo data (demo user is a citizen) and navigate to /inputs
    await quickOnboarding(page)

    // Sidebar should have CPF link
    const sidebarCpfButton = page.locator('aside').getByText('CPF', { exact: true }).first()
    await expect(sidebarCpfButton).toBeVisible()
  })
})
