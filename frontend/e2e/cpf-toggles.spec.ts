import { test, expect } from '@playwright/test'
import { goToStart, selectPathway } from './helpers'

test.describe('US-11: CPF Section Toggles', () => {
  test('CPF section visibility toggles with cpfEnabled switch on start page', async ({ page }) => {
    // 1. Go to start page with clean state
    await goToStart(page)

    // 2. Select the goal-first pathway
    await selectPathway(page, 'goal-first')

    // 3. The pathway form should appear with section toggles
    // By default cpfEnabled is true in the UI store. Find the CPF Integration toggle.
    const cpfToggleLabel = page.getByText('CPF Integration', { exact: false })
    await expect(cpfToggleLabel).toBeVisible()

    // 4. Ensure CPF Integration is enabled (default is true).
    // The Switch component uses role="switch"
    const cpfSwitch = page.locator('button[role="switch"]').first()
    // Check if it's already checked
    const isChecked = await cpfSwitch.getAttribute('data-state')
    if (isChecked !== 'checked') {
      await cpfSwitch.click()
    }
    await expect(cpfSwitch).toHaveAttribute('data-state', 'checked')

    // 5. Click "Build my full plan"
    await page.getByRole('button', { name: /build my full plan/i }).click()

    // 6. Should be on /inputs
    await expect(page).toHaveURL(/\/inputs/)
    await page.waitForLoadState('networkidle')

    // 7. Verify CPF section is visible on the inputs page
    // The CPF section has id="section-cpf" and title "CPF"
    const cpfSection = page.locator('#section-cpf')
    await expect(cpfSection).toBeVisible()

    // Also check sidebar has CPF link
    const sidebarCpfButton = page.locator('aside').getByText('CPF', { exact: true }).first()
    await expect(sidebarCpfButton).toBeVisible()
  })

  test('disabling CPF on start page hides CPF section on inputs page', async ({ page }) => {
    // 1. Go to start page with clean state
    await goToStart(page)

    // 2. Select story-first pathway
    await selectPathway(page, 'story-first')

    // 3. Find the CPF Integration switch and disable it
    // There are multiple switches: CPF Integration is the first one
    const switches = page.locator('button[role="switch"]')

    // CPF Integration is the first switch in the section toggles
    const cpfSwitch = switches.first()

    // Ensure it's unchecked (toggle off if currently on)
    const isChecked = await cpfSwitch.getAttribute('data-state')
    if (isChecked === 'checked') {
      await cpfSwitch.click()
    }
    await expect(cpfSwitch).toHaveAttribute('data-state', 'unchecked')

    // 4. Click "Build my full plan"
    await page.getByRole('button', { name: /build my full plan/i }).click()

    // 5. Should be on /inputs
    await expect(page).toHaveURL(/\/inputs/)
    await page.waitForLoadState('networkidle')

    // 6. Verify CPF section is NOT visible on the inputs page
    const cpfSection = page.locator('#section-cpf')
    await expect(cpfSection).toHaveCount(0)

    // Sidebar should also not have CPF link
    // The sidebar buttons for INPUTS section should not include CPF
    const sidebarButtons = page.locator('aside button')
    const cpfButtons = sidebarButtons.filter({ hasText: /^CPF$/ })
    await expect(cpfButtons).toHaveCount(0)
  })
})
