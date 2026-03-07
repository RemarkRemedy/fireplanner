import { useState } from 'react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeopleSection } from '@/components/household/PeopleSection'
import { IncomeSection } from '@/components/household/IncomeSection'
import { SpendingGoalsSection } from '@/components/household/SpendingGoalsSection'
import {
  HOUSEHOLD_PLAN_STORAGE_KEY,
  useHouseholdPlanStore,
} from '@/stores/useHouseholdPlanStore'

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true,
      value: () => false,
    })
  }

  if (!HTMLElement.prototype.setPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: () => {},
    })
  }

  if (!HTMLElement.prototype.releasePointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: () => {},
    })
  }

  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    })
  }
})

function resetHouseholdStore() {
  useHouseholdPlanStore.persist.clearStorage()
  localStorage.removeItem(HOUSEHOLD_PLAN_STORAGE_KEY)
  useHouseholdPlanStore.getState().reset()
}

function makeHouseholdPlan(options?: { includePartner?: boolean; planType?: 'household' | 'couple' }) {
  const plan = structuredClone(useHouseholdPlanStore.getState().plan)
  const self = structuredClone(plan.adults[0]!)

  self.id = 'adult-self'
  self.owner = 'self'
  self.displayName = 'Taylor'
  self.currentAge = 34
  self.retirementAge = 60
  self.lifeExpectancy = 90
  self.annualIncome = 95_000
  self.lifeEventsEnabled = false
  self.lifeEvents = []
  self.taxProfile = {
    ...self.taxProfile,
    reliefBasisAge: 34,
    personalReliefs: 0,
  }
  self.srs = {
    ...self.srs,
    balance: 0,
    annualContribution: 0,
    drawdownStartAge: 63,
    postFireEnabled: false,
  }
  self.healthcare = {
    ...self.healthcare,
    enabled: false,
    oopBaseAmount: 0,
  }

  const adults = [self]
  if (options?.includePartner) {
    const partner = structuredClone(self)
    partner.id = 'adult-partner'
    partner.owner = 'partner'
    partner.displayName = 'Pat'
    partner.currentAge = 32
    partner.retirementAge = 64
    partner.lifeExpectancy = 92
    partner.annualIncome = 68_000
    partner.taxProfile = {
      ...partner.taxProfile,
      reliefBasisAge: 32,
    }
    adults.push(partner)
  }

  plan.id = 'household-test-plan'
  plan.planType = options?.planType ?? (options?.includePartner ? 'couple' : 'household')
  plan.adults = adults
  plan.dependents = []
  plan.income = []
  plan.expenses = []
  plan.goals = []

  return plan
}

function setHouseholdPlan(plan = makeHouseholdPlan()) {
  useHouseholdPlanStore.getState().setPlan(plan, {
    source: 'manual',
    initializedAt: '2026-03-07T00:00:00.000Z',
  })
}

function getCardByText(text: string): HTMLElement {
  const element = screen.getByText(text)
  const card = element.closest('div.rounded-lg.border')
  if (!card) {
    throw new Error(`Could not find card for ${text}`)
  }
  return card as HTMLElement
}

function getFieldInput(container: HTMLElement, label: string): HTMLInputElement {
  const labelElement = within(container).getByText(label)
  const input = labelElement.parentElement?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Could not find input for ${label}`)
  }
  return input
}

function getFieldSelect(container: HTMLElement, label: string): HTMLElement {
  const labelElement = within(container).getByText(label)
  const trigger = labelElement.parentElement?.querySelector('[role="combobox"]')
  if (!(trigger instanceof HTMLElement)) {
    throw new Error(`Could not find select for ${label}`)
  }
  return trigger
}

function setNumericInput(input: HTMLInputElement, value: string) {
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

async function chooseSelectOption(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  label: string,
  option: string,
) {
  const trigger = getFieldSelect(container, label)
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  await user.click(await screen.findByRole('option', { name: option }))
}

function PeopleSectionHarness() {
  const defaultAdultId = useHouseholdPlanStore.getState().plan.adults[0]?.id ?? null
  const [selectedAdultId, setSelectedAdultId] = useState<string | null>(defaultAdultId)

  return (
    <PeopleSection
      selectedAdultId={selectedAdultId}
      onSelectedAdultIdChange={setSelectedAdultId}
    />
  )
}

beforeEach(() => {
  resetHouseholdStore()
})

describe('Household editors', () => {
  it('supports two-adult people editing and dependent setup in the household roster', async () => {
    const user = userEvent.setup()
    setHouseholdPlan(makeHouseholdPlan({ includePartner: false, planType: 'household' }))

    render(<PeopleSectionHarness />)

    await user.click(screen.getByRole('switch', { name: 'Include partner' }))
    fireEvent.change(screen.getByLabelText('Partner name'), { target: { value: 'Pat' } })

    const partnerCard = getCardByText('Pat')
    setNumericInput(getFieldInput(partnerCard, 'Retirement Age'), '64')

    await user.click(screen.getByRole('button', { name: 'Add dependent' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Avery' } })

    const state = useHouseholdPlanStore.getState()
    const selfAdult = state.plan.adults.find((adult) => adult.owner === 'self')
    const partnerAdult = state.plan.adults.find((adult) => adult.owner === 'partner')

    expect(state.plan.adults).toHaveLength(2)
    expect(selfAdult?.retirementAge).toBe(60)
    expect(partnerAdult?.displayName).toBe('Pat')
    expect(partnerAdult?.retirementAge).toBe(64)
    expect(state.plan.dependents).toHaveLength(1)
    expect(state.plan.dependents[0]?.label).toBe('Avery')
  })

  it('edits partner salary, income ownership, tax reliefs, SRS, and life events from the household income section', async () => {
    const user = userEvent.setup()
    setHouseholdPlan(makeHouseholdPlan({ includePartner: true, planType: 'couple' }))

    render(<IncomeSection selectedAdultId="adult-partner" />)

    await user.click(screen.getByRole('button', { name: 'Create salary model' }))

    const salaryCard = getCardByText("Pat's Salary Model")
    setNumericInput(getFieldInput(salaryCard, 'Annual salary'), '72000')

    await user.click(screen.getByRole('button', { name: 'Add stream' }))
    const streamCard = screen.getByDisplayValue('Income stream').closest('div.rounded-lg.border')
    if (!(streamCard instanceof HTMLElement)) {
      throw new Error('Could not find income stream card')
    }
    await chooseSelectOption(user, streamCard, 'Owner', 'Shared')
    await chooseSelectOption(user, streamCard, 'Timing Anchor', 'Self')
    setNumericInput(getFieldInput(streamCard, 'Annual amount'), '24000')

    const taxCard = getCardByText("Pat's Tax & SRS Settings")
    setNumericInput(getFieldInput(taxCard, 'Personal reliefs'), '12000')
    setNumericInput(getFieldInput(taxCard, 'SRS balance'), '5000')

    const lifeEventsCard = getCardByText("Pat's Life Events")
    await user.click(within(lifeEventsCard).getByRole('switch'))
    await user.click(within(lifeEventsCard).getByRole('button', { name: 'Add life event' }))

    const eventCard = screen.getByDisplayValue('Life event').closest('div.rounded-lg.border')
    if (!(eventCard instanceof HTMLElement)) {
      throw new Error('Could not find life event card')
    }
    fireEvent.change(screen.getByDisplayValue('Life event'), { target: { value: 'Sabbatical' } })
    setNumericInput(getFieldInput(eventCard, 'Annual extra expense'), '4000')

    const state = useHouseholdPlanStore.getState()
    const partnerAdult = state.plan.adults.find((adult) => adult.id === 'adult-partner')
    const salaryModel = state.plan.income.find((entry) => entry.kind === 'salary-model' && entry.owner === 'partner')
    const stream = state.plan.income.find((entry) => entry.kind === 'income-stream')

    expect(partnerAdult?.annualIncome).toBe(72_000)
    expect(partnerAdult?.taxProfile.personalReliefs).toBe(12_000)
    expect(partnerAdult?.srs.balance).toBe(5_000)
    expect(partnerAdult?.lifeEventsEnabled).toBe(true)
    expect(partnerAdult?.lifeEvents[0]?.name).toBe('Sabbatical')
    expect(partnerAdult?.lifeEvents[0]?.additionalAnnualExpense).toBe(4_000)
    expect(salaryModel?.annualAmount).toBe(72_000)
    expect(stream?.owner).toBe('shared')
    expect(stream?.timing.owner).toBe('self')
    expect(stream?.annualAmount).toBe(24_000)
  })

  it('edits ownership-scoped spending, healthcare, withdrawals, and goals from the household spending section', async () => {
    const user = userEvent.setup()
    setHouseholdPlan(makeHouseholdPlan({ includePartner: true, planType: 'couple' }))

    render(<SpendingGoalsSection selectedAdultId="adult-partner" />)

    await user.click(screen.getByRole('button', { name: 'Add living cost' }))
    await user.click(screen.getByRole('button', { name: 'Add parent support' }))
    await user.click(screen.getByRole('button', { name: 'Add withdrawal' }))
    await user.click(screen.getByRole('button', { name: 'Add goal' }))

    const livingCostCard = screen.getByDisplayValue('Shared living costs').closest('div.rounded-lg.border')
    if (!(livingCostCard instanceof HTMLElement)) {
      throw new Error('Could not find living cost card')
    }
    await chooseSelectOption(user, livingCostCard, 'Owner', 'Partner')
    await chooseSelectOption(user, livingCostCard, 'Timing Anchor', 'Self')
    setNumericInput(getFieldInput(livingCostCard, 'Amount'), '3600')

    const parentSupportCard = screen.getByDisplayValue('Parent support').closest('div.rounded-lg.border')
    if (!(parentSupportCard instanceof HTMLElement)) {
      throw new Error('Could not find parent support card')
    }
    setNumericInput(getFieldInput(parentSupportCard, 'Amount'), '900')

    const healthcareCard = getCardByText("Pat's Healthcare")
    await user.click(within(healthcareCard).getByRole('switch'))
    setNumericInput(getFieldInput(healthcareCard, 'OOP base amount'), '1500')

    const withdrawalCard = screen.getByDisplayValue('Retirement withdrawal').closest('div.rounded-lg.border')
    if (!(withdrawalCard instanceof HTMLElement)) {
      throw new Error('Could not find withdrawal card')
    }
    setNumericInput(getFieldInput(withdrawalCard, 'Amount'), '45000')

    const goalCard = screen.getByDisplayValue('Household goal').closest('div.rounded-lg.border')
    if (!(goalCard instanceof HTMLElement)) {
      throw new Error('Could not find goal card')
    }
    await chooseSelectOption(user, goalCard, 'Owner', 'Self')
    setNumericInput(getFieldInput(goalCard, 'Amount'), '80000')

    const state = useHouseholdPlanStore.getState()
    const partnerAdult = state.plan.adults.find((adult) => adult.id === 'adult-partner')
    const baseLivingExpense = state.plan.expenses.find((expense) => expense.kind === 'base-living')
    const parentSupportExpense = state.plan.expenses.find((expense) => expense.kind === 'parent-support')
    const withdrawalExpense = state.plan.expenses.find((expense) => expense.kind === 'retirement-withdrawal')
    const goal = state.plan.goals[0]

    expect(baseLivingExpense?.owner).toBe('partner')
    expect(baseLivingExpense?.timing.owner).toBe('self')
    expect(baseLivingExpense?.amount).toBe(3_600)
    expect(parentSupportExpense?.amount).toBe(900)
    expect(withdrawalExpense?.amount).toBe(45_000)
    expect(partnerAdult?.healthcare.enabled).toBe(true)
    expect(partnerAdult?.healthcare.oopBaseAmount).toBe(1_500)
    expect(goal?.owner).toBe('self')
    expect(goal?.amount).toBe(80_000)
  })
})
