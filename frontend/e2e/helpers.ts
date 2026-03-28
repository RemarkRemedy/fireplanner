import { type Page, expect } from '@playwright/test'

/**
 * Clear all localStorage to start fresh (no returning-user detection).
 */
export async function clearAppState(page: Page) {
  await page.evaluate(() => localStorage.clear())
}

/**
 * Navigate to start page with fresh state.
 */
export async function goToStart(page: Page) {
  await page.goto('/')
  await clearAppState(page)
  await page.reload()
  await page.waitForLoadState('networkidle')
}

/**
 * Select a pathway on the start page.
 */
export async function selectPathway(page: Page, pathway: 'goal-first' | 'story-first' | 'already-fire') {
  const labels: Record<string, string> = {
    'goal-first': 'I know when I want to retire',
    'story-first': 'Show me what\'s possible',
    'already-fire': 'I already have enough',
  }
  await page.getByText(labels[pathway], { exact: false }).click()
}

/**
 * Fill a currency input by label text (partial match).
 * Currency inputs typically have a formatted wrapper — click then type.
 */
export async function fillCurrencyInput(page: Page, label: string, value: string) {
  const field = page.locator(`label, [class*="Label"]`).filter({ hasText: label }).locator('..').locator('input')
  await field.click()
  await field.fill(value)
}

/**
 * Fill a number input by its associated label.
 */
export async function fillNumberInput(page: Page, label: string, value: string) {
  const field = page.locator(`label, [class*="Label"]`).filter({ hasText: label }).locator('..').locator('input')
  await field.click()
  await field.fill(value)
}

/**
 * Wait for navigation to a specific route.
 */
export async function expectRoute(page: Page, route: string) {
  await expect(page).toHaveURL(new RegExp(route))
}

/**
 * Click the Continue / Get Started button on the start page.
 */
export async function clickContinue(page: Page) {
  const btn = page.getByRole('button', { name: /continue|get started|start planning/i })
  await btn.click()
}

/**
 * Navigate to a page via sidebar link text.
 */
export async function navigateVia(page: Page, linkText: string) {
  await page.getByRole('link', { name: new RegExp(linkText, 'i') }).first().click()
  await page.waitForLoadState('networkidle')
}

/**
 * Check that a metric value is visible on screen.
 */
export async function expectMetricVisible(page: Page, label: string) {
  await expect(page.getByText(label, { exact: false }).first()).toBeVisible()
}

/**
 * Fill the start page quick form for goal-first pathway.
 */
export async function fillGoalFirstForm(page: Page, opts: {
  age: string
  retirementAge: string
  income: string
  expenses: string
  savings: string
}) {
  // The start page uses input fields within the pathway form
  const form = page.locator('main')
  const inputs = form.locator('input[type="text"], input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"]')

  // Fill fields in order: Current Age, Retirement Age, Income, Expenses, Savings
  const allInputs = await inputs.all()
  if (allInputs.length >= 5) {
    await allInputs[0].fill(opts.age)
    await allInputs[1].fill(opts.retirementAge)
    await allInputs[2].fill(opts.income)
    await allInputs[3].fill(opts.expenses)
    await allInputs[4].fill(opts.savings)
  }
}

/**
 * Fill the start page quick form for story-first pathway (no retirement age).
 */
export async function fillStoryFirstForm(page: Page, opts: {
  age: string
  income: string
  expenses: string
  savings: string
}) {
  const form = page.locator('main')
  const inputs = form.locator('input[type="text"], input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"]')

  const allInputs = await inputs.all()
  if (allInputs.length >= 4) {
    await allInputs[0].fill(opts.age)
    await allInputs[1].fill(opts.income)
    await allInputs[2].fill(opts.expenses)
    await allInputs[3].fill(opts.savings)
  }
}

/**
 * Fill the start page quick form for already-fire pathway.
 */
export async function fillAlreadyFireForm(page: Page, opts: {
  age: string
  income: string
  expenses: string
  savings: string
}) {
  const form = page.locator('main')
  const inputs = form.locator('input[type="text"], input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"]')

  const allInputs = await inputs.all()
  if (allInputs.length >= 4) {
    await allInputs[0].fill(opts.age)
    await allInputs[1].fill(opts.income)
    await allInputs[2].fill(opts.expenses)
    await allInputs[3].fill(opts.savings)
  }
}

/**
 * Complete onboarding by loading demo data.
 * Demo gives a fully populated plan with setupCompleted=true.
 * Ends on /inputs page.
 */
export async function quickOnboarding(page: Page) {
  await goToStart(page)
  await page.getByRole('button', { name: /explore a demo/i }).click()
  await expect(page).toHaveURL(/\/projection/, { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  await page.goto('/inputs')
  await page.waitForLoadState('networkidle')
}

/**
 * Expand an accordion section on the inputs page by its section ID.
 * Sections start expanded by default; this handles the case where
 * a section was previously collapsed.
 */
export async function expandSection(page: Page, sectionId: string) {
  const section = page.locator(`#${sectionId}`)
  await section.scrollIntoViewIfNeeded()
  // Radix Accordion sets data-state="closed" on collapsed items
  const trigger = section.locator('button[data-state]').first()
  const state = await trigger.getAttribute('data-state').catch(() => 'open')
  if (state === 'closed') {
    await trigger.click()
    // Wait for content to be visible after accordion animation
    await expect(section.locator('input').first()).toBeVisible({ timeout: 2000 })
  }
  return section
}
