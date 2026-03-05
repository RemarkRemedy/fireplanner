import { test, expect } from '@playwright/test'

function shortError(error) {
  if (!error) return 'Unknown error'
  const msg = error instanceof Error ? error.message : String(error)
  return msg.split('\n').slice(0, 4).map((line) => line.trim()).join(' | ')
}

async function completeOnboardingIfNeeded(page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const pathway = page.getByText(/I know when I want to retire/i).first()
  const onStart = await pathway.isVisible().catch(() => false)

  if (!onStart) return

  await pathway.click()
  const numericInputs = page.locator('main input[inputmode="numeric"]')
  await expect(numericInputs).toHaveCount(5, { timeout: 15000 })

  const values = ['30', '55', '120000', '48000', '250000']
  for (let i = 0; i < values.length; i += 1) {
    await numericInputs.nth(i).click()
    await numericInputs.nth(i).fill(values[i])
  }
  await numericInputs.nth(4).blur()

  const continueBtn = page.getByRole('button', { name: /continue to planning|get started|start planning|continue/i }).first()
  await continueBtn.click()
  await expect(page).toHaveURL(/\/inputs/, { timeout: 20000 })
}

async function getRuntimeErrorMessage(page) {
  const errorHeading = page.getByRole('heading', { name: /Unexpected Application Error!/i })
  const visible = await errorHeading.isVisible().catch(() => false)
  if (!visible) return null

  const detail = await page.locator('h3').first().textContent().catch(() => null)
  return detail ? `Unexpected Application Error: ${detail}` : 'Unexpected Application Error'
}

async function ensureStressAdvanced(page) {
  await page.goto('/stress-test')
  await page.waitForLoadState('networkidle')

  const runtimeError = await getRuntimeErrorMessage(page)
  if (runtimeError) throw new Error(runtimeError)

  await expect(page.getByRole('heading', { name: 'Stress Test' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Advanced' }).first().click()
  await expect(page.getByRole('tab', { name: 'Historical Backtest' })).toBeVisible({ timeout: 10000 })
}

async function openLifeEventSheet(page) {
  const addBtn = page.getByRole('button', { name: /Add Life Event/i }).first()
  await expect(addBtn).toBeVisible()
  await expect(addBtn).toBeEnabled()
  await addBtn.click()

  const sheet = page.getByRole('dialog').filter({ hasText: 'Life Event Scenarios' })
  await expect(sheet).toBeVisible({ timeout: 10000 })
  return sheet
}

async function addLifeEventFromTemplate(page, templateName) {
  const sheet = await openLifeEventSheet(page)
  await sheet.getByRole('button', { name: new RegExp(templateName, 'i') }).click()
  await sheet.getByRole('button', { name: 'Add to My Plan' }).click()
  await expect(sheet).toBeHidden({ timeout: 10000 })
}

async function expectLifeEventCount(page, count) {
  await expect(page.getByText(new RegExp(`Life Events \\(${count}/4\\):`))).toBeVisible()
}

async function removeFirstLifeEvent(page) {
  const removeButtons = page.locator('button[aria-label^="Remove "]')
  const count = await removeButtons.count()
  expect(count).toBeGreaterThan(0)
  await removeButtons.first().click()
}

async function ensureExpensesSectionExpanded(page) {
  const section = page.locator('main section#section-expenses')
  await expect(section).toBeVisible({ timeout: 10000 })

  const expandedMarker = section.getByRole('heading', { name: 'Withdrawal Strategy' }).first()
  const isExpanded = await expandedMarker.isVisible().catch(() => false)
  if (!isExpanded) {
    await section.getByRole('button', { name: /Expenses & Withdrawal/i }).first().click()
    await expect(expandedMarker).toBeVisible({ timeout: 10000 })
  }

  return section
}

function markBlocked(results, names, reason) {
  for (const name of names) {
    results.push({ name, status: 'FAIL', detail: `Blocked: ${reason}` })
  }
}

test.describe('feat/life-events-stress verification', () => {
  test.setTimeout(12 * 60 * 1000)

  test('runs comprehensive verification and reports pass/fail clearly', async ({ page }) => {
    const results = []

    const record = async (name, fn) => {
      try {
        await fn()
        results.push({ name, status: 'PASS' })
        return true
      } catch (error) {
        results.push({ name, status: 'FAIL', detail: shortError(error) })
        return false
      }
    }

    await record('Setup: complete initial onboarding / start flow (if shown)', async () => {
      await completeOnboardingIfNeeded(page)
    })

    const stressLoadOk = await record('Navigation & Layout: navigate to /stress-test without runtime error', async () => {
      await page.goto('/stress-test')
      await page.waitForLoadState('networkidle')
      const runtimeError = await getRuntimeErrorMessage(page)
      if (runtimeError) throw new Error(runtimeError)
      await expect(page.getByRole('heading', { name: 'Stress Test' })).toBeVisible({ timeout: 10000 })
    })

    if (stressLoadOk) {
      await record('Navigation & Layout: Advanced mode shows 3 tabs (Monte Carlo, Historical Backtest, Sequence Risk) and not 4', async () => {
        await ensureStressAdvanced(page)
        const tabList = page.locator('[role="tablist"]').first()
        await expect(tabList.getByRole('tab')).toHaveCount(3)
        await expect(tabList.getByRole('tab', { name: 'Monte Carlo' })).toBeVisible()
        await expect(tabList.getByRole('tab', { name: 'Historical Backtest' })).toBeVisible()
        await expect(tabList.getByRole('tab', { name: 'Sequence Risk' })).toBeVisible()
        await expect(tabList.getByRole('tab', { name: /Life Events/i })).toHaveCount(0)
      })

      await record('Navigation & Layout: Active Life Events bar is visible above tabs in Advanced mode', async () => {
        const tabList = page.locator('[role="tablist"]').first()
        const barLabel = page.getByText(/Life Events \(\d\/4\):/).first()
        await expect(barLabel).toBeVisible()

        const barBox = await barLabel.boundingBox()
        const tabsBox = await tabList.boundingBox()
        expect(barBox).not.toBeNull()
        expect(tabsBox).not.toBeNull()
        expect(barBox.y).toBeLessThan(tabsBox.y)
      })

      await record('Life Events Bar & Sheet: sheet opens, categories/probabilities/link visible, tier toggle works, Critical Illness costs swap, slider and add button present, chip add/remove works', async () => {
        const sheet = await openLifeEventSheet(page)

        await expect(sheet.getByText('Career & Income')).toBeVisible()
        await expect(sheet.getByText('Health')).toBeVisible()
        await expect(sheet.getByText('Family')).toBeVisible()
        await expect(sheet.getByText(/~\d+%/).first()).toBeVisible()
        await expect(sheet.getByRole('link', { name: 'How are these estimates calculated?' })).toBeVisible()

        const tierGroup = sheet.getByRole('radiogroup', { name: 'Healthcare cost tier' })
        const subsidised = sheet.getByRole('radio', { name: 'Subsidised (B2/C)' })
        const privateTier = sheet.getByRole('radio', { name: 'Private (A/B1)' })

        await expect(tierGroup).toBeVisible()
        await expect(subsidised).toBeVisible()
        await expect(privateTier).toBeVisible()

        await sheet.getByRole('button', { name: /Critical Illness/i }).click()
        await subsidised.click()
        await expect(sheet.getByText(/Additional expenses:\s*\$15,000\/yr/i)).toBeVisible()

        await privateTier.click()
        await expect(sheet.getByText(/Additional expenses:\s*\$50,000\/yr/i)).toBeVisible()

        await expect(sheet.getByRole('slider').first()).toBeVisible()
        await expect(sheet.getByRole('button', { name: 'Add to My Plan' })).toBeVisible()

        await sheet.getByRole('button', { name: 'Add to My Plan' }).click()
        await expect(sheet).toBeHidden({ timeout: 10000 })
        await expectLifeEventCount(page, 1)

        await expect(page.getByText(/Critical Illness age \d+/).first()).toBeVisible()
        const criticalRemove = page.getByRole('button', { name: /Remove Critical Illness/i }).first()
        await expect(criticalRemove).toBeVisible()
        await criticalRemove.click()
        await expectLifeEventCount(page, 0)
      })

      await record('Life Events Bar: add multiple events up to 4 and count label updates correctly', async () => {
        const templates = ['Job Loss (6 months)', 'Critical Illness', 'Parent Care', 'Partial Disability']
        for (let i = 0; i < templates.length; i += 1) {
          await addLifeEventFromTemplate(page, templates[i])
          await expectLifeEventCount(page, i + 1)
        }
        await expect(page.getByRole('button', { name: /Add Life Event/i }).first()).toBeDisabled()
      })

      await record('Monte Carlo: runs successfully with life events active', async () => {
        await ensureStressAdvanced(page)
        await expect(page.getByText(/Life Events \((1|2|3|4)\/4\):/)).toBeVisible()

        await page.getByRole('tab', { name: 'Monte Carlo' }).click()
        const runSimulation = page.getByRole('button', { name: 'Run Simulation' }).first()
        await expect(runSimulation).toBeVisible()
        await runSimulation.click()

        await expect(page.getByRole('heading', { name: 'Simulation Results' })).toBeVisible({ timeout: 180000 })
        await expect(page.getByText(/Simulation failed:/)).toHaveCount(0)
      })

      await record('Stale detection: Monte Carlo marks results outdated after life event change', async () => {
        await removeFirstLifeEvent(page)
        await expect(page.getByText(/Results may be outdated/i)).toBeVisible({ timeout: 15000 })
      })

      await record('Sequence Risk: runs successfully with life events active', async () => {
        await page.getByRole('tab', { name: 'Sequence Risk' }).click()
        const runStress = page.getByRole('button', { name: 'Run Stress Test' })
        await expect(runStress).toBeVisible()
        await runStress.click()

        await expect(page.getByText('Normal Success Rate')).toBeVisible({ timeout: 180000 })
        await expect(page.getByText('Crisis Success Rate')).toBeVisible({ timeout: 180000 })
        await expect(page.getByText(/Fix validation errors before running stress tests\./)).toHaveCount(0)
      })

      await record('Stale detection: Sequence Risk marks results outdated after life event change', async () => {
        await removeFirstLifeEvent(page)
        await expect(page.getByText(/Results may be outdated/i)).toBeVisible({ timeout: 15000 })
      })

      await record('Simple Mode Life Events Indicator: shows text indicator when life events exist', async () => {
        await page.getByRole('button', { name: 'Simple' }).first().click()
        await expect(page.getByText(/\d+ life event(s)? active/i)).toBeVisible()
      })
    } else {
      const blockedReason = 'Stress Test route crashed at runtime (AnalysisModeToggle is not defined)'
      markBlocked(results, [
        'Navigation & Layout: Advanced mode shows 3 tabs (Monte Carlo, Historical Backtest, Sequence Risk) and not 4',
        'Navigation & Layout: Active Life Events bar is visible above tabs in Advanced mode',
        'Life Events Bar & Sheet: sheet opens, categories/probabilities/link visible, tier toggle works, Critical Illness costs swap, slider and add button present, chip add/remove works',
        'Life Events Bar: add multiple events up to 4 and count label updates correctly',
        'Monte Carlo: runs successfully with life events active',
        'Stale detection: Monte Carlo marks results outdated after life event change',
        'Sequence Risk: runs successfully with life events active',
        'Stale detection: Sequence Risk marks results outdated after life event change',
        'Simple Mode Life Events Indicator: shows text indicator when life events exist',
      ], blockedReason)
    }

    await record('Expenses Section: Advanced Expenses includes Life Events (Expense Impact), enable checkbox works, and expense event can be added', async () => {
      await page.goto('/inputs#section-expenses')
      await page.waitForLoadState('networkidle')
      const runtimeError = await getRuntimeErrorMessage(page)
      if (runtimeError) throw new Error(runtimeError)

      await expect(page.getByRole('heading', { name: 'Plan Your FIRE' })).toBeVisible({ timeout: 15000 })
      const section = await ensureExpensesSectionExpanded(page)

      await page.getByRole('button', { name: 'Advanced' }).first().click()

      const expenseLifeEventsHeading = section.getByText('Life Events (Expense Impact)').first()
      await expenseLifeEventsHeading.scrollIntoViewIfNeeded()
      await expect(expenseLifeEventsHeading).toBeVisible({ timeout: 10000 })

      const enableCheckbox = section.getByRole('checkbox', { name: /^Enable$/ }).first()
      await expect(enableCheckbox).toBeVisible()
      const initial = await enableCheckbox.getAttribute('aria-checked')
      await enableCheckbox.click()
      const afterFirst = initial === 'true' ? 'false' : 'true'
      await expect(enableCheckbox).toHaveAttribute('aria-checked', afterFirst)
      if (afterFirst !== 'true') {
        await enableCheckbox.click()
      }
      await expect(enableCheckbox).toHaveAttribute('aria-checked', 'true')

      await section.getByRole('button', { name: 'Medical Emergency' }).click()
      await expect(section.locator('input[value="Medical Emergency"]').first()).toBeVisible()
    })

    await record('Reference Page: Life Event Cost Benchmarks exists, deep link works, and subsidised/private tables are present', async () => {
      await page.goto('/reference')
      await page.waitForLoadState('networkidle')
      const runtimeError = await getRuntimeErrorMessage(page)
      if (runtimeError) throw new Error(runtimeError)

      await expect(page.getByRole('heading', { name: 'Reference Guide' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('button', { name: 'Life Event Cost Benchmarks' })).toBeVisible()

      await page.goto('/reference#life-event-costs')
      await expect(page).toHaveURL(/\/reference#life-event-costs/)

      const costsItem = page.locator('#ref-life-event-costs')
      await expect(costsItem).toBeVisible()
      await expect(costsItem.getByRole('button', { name: 'Life Event Cost Benchmarks' })).toHaveAttribute('data-state', 'open')
      await expect(costsItem.getByText(/Subsidised OOP \(B2\/C \+ MediShield Life\)/)).toBeVisible()
      await expect(costsItem.getByText(/Private OOP \(A\/B1 \+ ISP\)/)).toBeVisible()
    })

    console.log('\n=== Verification Results ===')
    for (const result of results) {
      if (result.status === 'PASS') {
        console.log(`[PASS] ${result.name}`)
      } else {
        console.log(`[FAIL] ${result.name} -- ${result.detail}`)
      }
    }

    const failed = results.filter((r) => r.status === 'FAIL')
    console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed`)

    const failureSummary = failed.map((r) => `- ${r.name}: ${r.detail}`).join('\n')
    expect(failed.length, failureSummary || 'All checks passed').toBe(0)
  })
})
