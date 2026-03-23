import { test, expect } from '@playwright/test'

/**
 * ILP Analyzer tests.
 *
 * The ILP Review page (IlpReviewPage) exists as a component but has no
 * registered route in src/router.tsx — the route was intentionally removed
 * (see the comment in src/lib/data/moneySenseGuide.ts:
 * "Add the '/ilp-review' link here when the route is re-enabled.").
 *
 * Because the page is unreachable through normal navigation, all tests
 * are skipped with an explanatory message.
 */

test.describe('ILP Analyzer', () => {
  test.skip(true, 'ILP not reachable — /ilp-review route is disabled in router.tsx')

  test('renders ILP page with heading', async ({ page }) => {
    await page.goto('/ilp-review')
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('heading', { name: /ILP|Investment.Linked/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('Add Policy button shows a form', async ({ page }) => {
    await page.goto('/ilp-review')
    await page.waitForLoadState('networkidle')

    const addBtn = page.getByRole('button', { name: /add policy/i }).first()
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click()
      // After clicking Add Policy a second policy tab or form should appear
      await expect(
        page.getByRole('tab').nth(1)
          .or(page.getByLabelText(/policy name/i).nth(1))
      ).toBeVisible({ timeout: 5000 })
    }
  })
})
