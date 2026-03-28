import { test, expect } from '@playwright/test'
import { quickOnboarding } from './helpers'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

/**
 * Robust JSON Import/Export E2E Tests
 *
 * Tests the full import pipeline: parse -> detect format -> migrate -> validate -> write -> reload
 * Plus export round-trip and scenario save/load with migration.
 */

async function completeOnboarding(page: import('@playwright/test').Page) {
  await quickOnboarding(page)
}

/** Read a profile store field from localStorage. */
async function getProfileField(page: import('@playwright/test').Page, field: string): Promise<unknown> {
  return page.evaluate((f) => {
    const raw = localStorage.getItem('fireplanner-profile')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.state?.[f] ?? null
  }, field)
}

/** Read the full raw profile store from localStorage. */
async function getProfileRaw(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fireplanner-profile')
    return raw ? JSON.parse(raw) : null
  })
}

/** Read the first adult's annualExpenses from the household plan store. */
async function getHouseholdExpenses(page: import('@playwright/test').Page): Promise<number | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fireplanner-household-plan-v1')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const adults = parsed.state?.plan?.adults
    if (!adults || adults.length === 0) return null
    return adults[0].annualExpenses ?? null
  })
}

/** Set the first adult's annualExpenses in the household plan store and reload. */
async function setHouseholdExpenses(page: import('@playwright/test').Page, value: number) {
  await page.evaluate((v) => {
    const raw = localStorage.getItem('fireplanner-household-plan-v1')
    if (raw) {
      const data = JSON.parse(raw)
      const adults = data.state?.plan?.adults
      if (adults && adults.length > 0) {
        adults[0].annualExpenses = v
      }
      localStorage.setItem('fireplanner-household-plan-v1', JSON.stringify(data))
    }
  }, value)
  await page.reload()
  await page.waitForLoadState('networkidle')
}

/**
 * Trigger a file import via the hidden file input.
 * The Import button (title="Import data from JSON") triggers a hidden <input type="file">.
 */
async function triggerImport(page: import('@playwright/test').Page, filePath: string) {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('button[title="Import data from JSON"]').click(),
  ])
  await fileChooser.setFiles(filePath)
}

/**
 * Trigger import and wait for the page to reload (successful imports call window.location.reload()).
 * Sets up a navigation listener before triggering import, then waits for load state.
 */
async function triggerImportAndWaitForReload(page: import('@playwright/test').Page, filePath: string) {
  // Set up navigation listener BEFORE triggering the import
  const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle' })

  await triggerImport(page, filePath)

  // Wait for the reload navigation to complete
  await navigationPromise
}

test.describe('Robust JSON Import/Export', () => {
  test.describe('1. Export then re-import (round-trip)', () => {
    test('exports data, clears state, re-imports, and verifies original values', async ({ page }) => {
      // Step 1: Complete onboarding (demo data gives a full plan)
      await completeOnboarding(page)

      // Record the initial profile values from demo data
      const initialAge = await getProfileField(page, 'currentAge')
      const initialExpenses = await getProfileField(page, 'annualExpenses')
      expect(initialAge).toBeTruthy()
      expect(initialExpenses).toBeTruthy()

      // Step 2: Export the data
      const exportButton = page.locator('button[title="Export data as JSON"]')
      await expect(exportButton).toBeVisible()

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ])

      // Save the downloaded file to a temp path
      const downloadPath = await download.path()
      expect(downloadPath).toBeTruthy()

      // Verify the filename pattern
      const filename = download.suggestedFilename()
      expect(filename).toMatch(/^fireplanner-export-\d{4}-\d{2}-\d{2}\.json$/)

      // Step 3: Clear localStorage
      await page.evaluate(() => localStorage.clear())
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Verify state is cleared (profile should have defaults)
      const ageAfterClear = await getProfileField(page, 'currentAge')
      expect(ageAfterClear).not.toBe(initialAge)

      // Step 4: Import the downloaded file
      // Navigate to /inputs to access the sidebar import button
      await page.goto('/inputs')
      await page.waitForLoadState('networkidle')

      await triggerImportAndWaitForReload(page, downloadPath!)

      // Step 5: Verify the original data is restored
      expect(await getProfileField(page, 'currentAge')).toBe(initialAge)
      expect(await getProfileField(page, 'annualExpenses')).toBe(initialExpenses)
    })
  })

  test.describe('2. Import old-version file', () => {
    test('imports a file with old store version and migrates fields', async ({ page }) => {
      // Go through onboarding first so we have an /inputs page with the sidebar
      await completeOnboarding(page)

      // Import the old-version fixture (version: 1, missing newer fields)
      await triggerImportAndWaitForReload(page, path.join(FIXTURES_DIR, 'old-version.json'))

      // Verify the profile loaded with age 30 from the fixture
      expect(await getProfileField(page, 'currentAge')).toBe(30)
      expect(await getProfileField(page, 'retirementAge')).toBe(55)
      expect(await getProfileField(page, 'annualExpenses')).toBe(50000)
      expect(await getProfileField(page, 'liquidNetWorth')).toBe(200000)

      // Verify migration added defaults for fields that were missing
      const profileRaw = await getProfileRaw(page)
      expect(profileRaw).toBeTruthy()
      // After migration, version should be bumped to current (23)
      expect(profileRaw.version).toBe(23)
      // Migration should have added default values for newer fields
      expect(profileRaw.state.cpfLifeStartAge).toBe(65)
      expect(profileRaw.state.cpfLifePlan).toBe('standard')
      expect(profileRaw.state.financialGoals).toEqual([])
    })
  })

  test.describe('3. Import legacy format (no state/version wrapper)', () => {
    test('imports a file with raw state blob (no {state, version} wrapper)', async ({ page }) => {
      await completeOnboarding(page)

      // Import the legacy fixture (no state/version wrapper, treated as version 0)
      await triggerImportAndWaitForReload(page, path.join(FIXTURES_DIR, 'legacy-no-wrapper.json'))

      // Verify the profile loaded with the legacy data
      expect(await getProfileField(page, 'currentAge')).toBe(35)
      expect(await getProfileField(page, 'retirementAge')).toBe(60)
      expect(await getProfileField(page, 'annualExpenses')).toBe(60000)
      expect(await getProfileField(page, 'liquidNetWorth')).toBe(500000)

      // Verify migration ran (version 0 -> 23)
      const profileRaw = await getProfileRaw(page)
      expect(profileRaw).toBeTruthy()
      expect(profileRaw.version).toBe(23)
    })
  })

  test.describe('4. Import invalid data shows error toast', () => {
    test('imports file with invalid field types and shows error toast', async ({ page }) => {
      await completeOnboarding(page)

      // Import the invalid data fixture (currentAge: "banana").
      // The import pipeline now validates and rejects invalid data (no reload).
      await triggerImport(page, path.join(FIXTURES_DIR, 'invalid-data.json'))

      // Should show an error toast (no reload since validation failed)
      const toast = page.locator('[data-sonner-toast]').first()
      await expect(toast).toBeVisible({ timeout: 5000 })

      const toastText = await toast.textContent()
      expect(toastText).toBeTruthy()
      expect(toastText!.length).toBeGreaterThan(0)
    })
  })

  test.describe('5. Import invalid JSON shows error toast', () => {
    test('imports non-JSON file and shows error toast', async ({ page }) => {
      await completeOnboarding(page)

      // Import the not-json fixture -- this will fail JSON.parse(), caught by try/catch.
      // importFromJson returns { success: false, error: "<parse error message>" }
      // The Sidebar calls toast.error(result.error ?? '...') -- NO reload happens on failure.
      await triggerImport(page, path.join(FIXTURES_DIR, 'not-json.json'))

      // Should show an error toast (no reload since import failed)
      const toast = page.locator('[data-sonner-toast]').first()
      await expect(toast).toBeVisible({ timeout: 5000 })

      const toastText = await toast.textContent()
      expect(toastText).toBeTruthy()
      expect(toastText!.length).toBeGreaterThan(0)
    })
  })

  test.describe('6. Scenario save/load round-trip', () => {
    test('saves scenario, changes data, loads original, verifies restoration', async ({ page }) => {
      await completeOnboarding(page)

      // Record initial household expenses from demo data
      const initialExpenses = await getHouseholdExpenses(page)
      expect(initialExpenses).toBeTruthy()

      // Open scenario manager
      const scenariosButton = page.getByRole('button', { name: /scenarios/i }).first()
      await scenariosButton.click()

      // Save scenario "Original"
      const nameInput = page.getByPlaceholder('Scenario name...')
      await expect(nameInput).toBeVisible()
      await nameInput.fill('Original')
      const saveButton = page.locator('button[title="Save current state"]')
      await saveButton.click()

      // Verify scenario appears
      await expect(page.locator('button[title="Load \\"Original\\""]')).toBeVisible()

      // Change expenses to a different value
      await setHouseholdExpenses(page, 80000)
      expect(await getHouseholdExpenses(page)).toBe(80000)

      // Re-open scenario manager and load "Original"
      const scenariosButton2 = page.getByRole('button', { name: /scenarios/i }).first()
      await scenariosButton2.click()

      const loadButton = page.locator('button[title="Load \\"Original\\""]')
      await loadButton.click()

      // Wait for rehydration
      await page.waitForTimeout(500)

      // Verify expenses restored to original value
      expect(await getHouseholdExpenses(page)).toBe(initialExpenses)
    })
  })
})
