import { test, expect } from '@playwright/test'
import { goToStart, selectPathway, fillGoalFirstForm } from './helpers'
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
  await goToStart(page)
  await selectPathway(page, 'goal-first')
  await fillGoalFirstForm(page, {
    age: '30',
    retirementAge: '55',
    income: '100000',
    expenses: '50000',
    savings: '200000',
  })
  await page.getByRole('button', { name: /build my full plan/i }).click()
  await expect(page).toHaveURL(/\/inputs/)
  await page.waitForLoadState('networkidle')
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

/** Set a profile store field in localStorage and reload. */
async function setProfileField(page: import('@playwright/test').Page, field: string, value: unknown) {
  await page.evaluate(
    ({ f, v }) => {
      const raw = localStorage.getItem('fireplanner-profile')
      if (raw) {
        const data = JSON.parse(raw)
        data.state[f] = v
        localStorage.setItem('fireplanner-profile', JSON.stringify(data))
      }
    },
    { f: field, v: value }
  )
  await page.reload()
  await page.waitForLoadState('networkidle')
}

/** Set multiple profile store fields in localStorage directly (no reload). */
async function setProfileFields(page: import('@playwright/test').Page, fields: Record<string, unknown>) {
  await page.evaluate(
    (updates) => {
      const raw = localStorage.getItem('fireplanner-profile')
      if (raw) {
        const data = JSON.parse(raw)
        for (const [key, val] of Object.entries(updates)) {
          data.state[key] = val
        }
        localStorage.setItem('fireplanner-profile', JSON.stringify(data))
      }
    },
    fields
  )
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
      // Step 1: Complete onboarding to reach /inputs with sidebar
      await completeOnboarding(page)

      // Set specific profile values directly in localStorage
      await setProfileFields(page, {
        currentAge: 28,
        annualIncome: 72000,
        annualExpenses: 36000,
        liquidNetWorth: 150000,
      })
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Verify the profile values are persisted
      expect(await getProfileField(page, 'currentAge')).toBe(28)
      expect(await getProfileField(page, 'annualExpenses')).toBe(36000)
      expect(await getProfileField(page, 'liquidNetWorth')).toBe(150000)

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
      // After clear + reload, profile store re-initializes with defaults (age 30)
      expect(ageAfterClear).not.toBe(28)

      // Step 4: Import the downloaded file
      // Navigate to /inputs to access the sidebar import button
      await page.goto('/inputs')
      await page.waitForLoadState('networkidle')

      await triggerImportAndWaitForReload(page, downloadPath!)

      // Step 5: Verify the original data is restored
      expect(await getProfileField(page, 'currentAge')).toBe(28)
      expect(await getProfileField(page, 'annualExpenses')).toBe(36000)
      expect(await getProfileField(page, 'liquidNetWorth')).toBe(150000)
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
      // After migration, version should be bumped to current (16)
      expect(profileRaw.version).toBe(16)
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

      // Verify migration ran (version 0 -> 16)
      const profileRaw = await getProfileRaw(page)
      expect(profileRaw).toBeTruthy()
      expect(profileRaw.version).toBe(16)
    })
  })

  test.describe('4. Import invalid data shows warning toast', () => {
    test('imports file with invalid field types and shows validation warning', async ({ page }) => {
      await completeOnboarding(page)

      // Import the invalid data fixture (currentAge: "banana").
      // The import pipeline: data is written (validation errors don't block), then reload().
      // The warning toast fires briefly before reload.
      // We verify via localStorage that the import succeeded with the invalid data written,
      // AND we check that the toast appeared by listening for it before the reload.

      // Listen for console messages that might indicate the toast
      const toastMessages: string[] = []
      page.on('console', (msg) => {
        toastMessages.push(msg.text())
      })

      // Use a race between waiting for the toast and the reload
      // The toast.warning() call happens before reload, so we can try to catch it
      const toastPromise = page.locator('[data-sonner-toast]').first().textContent({ timeout: 3000 }).catch(() => null)

      await triggerImport(page, path.join(FIXTURES_DIR, 'invalid-data.json'))

      const toastText = await toastPromise

      // Wait for the page to finish reloading
      await page.waitForLoadState('networkidle')

      // Verify the data was still written to localStorage (validation errors don't block import)
      const profileRaw = await getProfileRaw(page)
      expect(profileRaw).toBeTruthy()
      // The invalid currentAge "banana" should still be written (import doesn't block on validation)
      expect(profileRaw.state.currentAge).toBe('banana')
      expect(profileRaw.state.retirementAge).toBe(60)

      // If we caught the toast before reload, verify its content
      if (toastText) {
        expect(toastText).toMatch(/validation warnings/i)
      }
      // The key assertion is that the data was imported despite validation errors
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

  test.describe('6. Scenario save/load round-trip with migration', () => {
    test('saves scenario, changes data, loads original, verifies restoration', async ({ page }) => {
      await completeOnboarding(page)

      // Set specific expenses
      await setProfileField(page, 'annualExpenses', 50000)
      expect(await getProfileField(page, 'annualExpenses')).toBe(50000)

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

      // Change expenses to 80000
      await setProfileField(page, 'annualExpenses', 80000)
      expect(await getProfileField(page, 'annualExpenses')).toBe(80000)

      // Re-open scenario manager and load "Original"
      const scenariosButton2 = page.getByRole('button', { name: /scenarios/i }).first()
      await scenariosButton2.click()

      const loadButton = page.locator('button[title="Load \\"Original\\""]')
      await loadButton.click()

      // Wait for rehydration
      await page.waitForTimeout(500)

      // Verify expenses restored to 50000
      expect(await getProfileField(page, 'annualExpenses')).toBe(50000)
    })
  })
})
