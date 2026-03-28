import { test, expect } from '@playwright/test'
import { quickOnboarding } from './helpers'

/**
 * US-9: Export Data (JSON + Excel)
 *
 * Complete onboarding, find the export buttons in the sidebar,
 * and verify that clicking them triggers file downloads.
 */

async function completeOnboarding(page: import('@playwright/test').Page) {
  await quickOnboarding(page)
}

test.describe('Export Data', () => {
  test('JSON export triggers a download', async ({ page }) => {
    await completeOnboarding(page)

    // The Export button is in the sidebar DataActions section
    // It has title="Export data as JSON" and text "Export"
    const exportButton = page.locator('button[title="Export data as JSON"]')
    await expect(exportButton).toBeVisible()

    // Set up download listener before clicking
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ])

    // Verify the download was triggered
    expect(download).toBeTruthy()

    // The filename should match the pattern: fireplanner-export-YYYY-MM-DD.json
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^fireplanner-export-\d{4}-\d{2}-\d{2}\.json$/)
  })

  test('Excel export triggers a download', async ({ page }) => {
    await completeOnboarding(page)

    // The Excel button has title="Export data as Excel spreadsheet" and text "Excel"
    const excelButton = page.locator('button[title="Export data as Excel spreadsheet"]')
    await expect(excelButton).toBeVisible()

    // Set up download listener before clicking
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      excelButton.click(),
    ])

    // Verify the download was triggered
    expect(download).toBeTruthy()

    // The filename should end with .xlsx
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/\.xlsx$/)
  })
})
