import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetsPropertySection } from '@/components/household/AssetsPropertySection'
import { AssumptionsSection } from '@/components/household/AssumptionsSection'
import {
  HOUSEHOLD_PLAN_STORAGE_KEY,
  useHouseholdPlanStore,
} from '@/stores/useHouseholdPlanStore'
import { useAllocationStore } from '@/stores/useAllocationStore'

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

function resetStores() {
  useHouseholdPlanStore.persist.clearStorage()
  localStorage.removeItem(HOUSEHOLD_PLAN_STORAGE_KEY)
  useHouseholdPlanStore.getState().reset()
  useAllocationStore.getState().reset()
}

function makeCouplePlan() {
  const plan = structuredClone(useHouseholdPlanStore.getState().plan)
  const self = structuredClone(plan.adults[0]!)
  const partner = structuredClone(self)

  self.id = 'adult-self'
  self.owner = 'self'
  self.displayName = 'Taylor'
  self.currentAge = 34
  self.retirementAge = 60
  self.lifeExpectancy = 90

  partner.id = 'adult-partner'
  partner.owner = 'partner'
  partner.displayName = 'Pat'
  partner.currentAge = 32
  partner.retirementAge = 64
  partner.lifeExpectancy = 92

  plan.planType = 'couple'
  plan.adults = [self, partner]
  plan.assets = []
  plan.properties = []

  return plan
}

function setHouseholdPlan(plan = makeCouplePlan()) {
  useHouseholdPlanStore.getState().setPlan(plan, {
    source: 'manual',
    initializedAt: '2026-03-07T00:00:00.000Z',
  })
}

function getFieldInput(container: HTMLElement, label: string): HTMLInputElement {
  const labelElement = within(container).getByText(label, { selector: 'label' })
  const input = labelElement.parentElement?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Could not find input for ${label}`)
  }
  return input
}

function getFieldSelect(container: HTMLElement, label: string): HTMLElement {
  const labelElement = within(container).getByText(label, { selector: 'label' })
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

beforeEach(() => {
  resetStores()
})

describe('Household assets, property, and assumptions editors', () => {
  it('edits auto-seeded liquid balances and locked household assets', async () => {
    const user = userEvent.setup()
    setHouseholdPlan()

    render(<AssetsPropertySection mode="assets" />)

    // Liquid balances are auto-seeded per adult — no "Add" button needed
    // Find Taylor's liquid balance input (auto-seeded for each adult)
    const taylorInput = screen.getByLabelText('Taylor (You)')
    setNumericInput(taylorInput as HTMLInputElement, '150000')

    await user.click(screen.getByRole('button', { name: 'Add locked asset' }))

    const lockedCard = screen.getByDisplayValue('Locked asset').closest('div.rounded-lg.border')
    if (!(lockedCard instanceof HTMLElement)) {
      throw new Error('Could not find locked asset card')
    }
    await chooseSelectOption(user, lockedCard, 'Owner', 'Shared')
    setNumericInput(getFieldInput(lockedCard, 'Unlock age'), '46')

    const state = useHouseholdPlanStore.getState()
    const selfLiquid = state.plan.assets.find((asset) => asset.kind === 'liquid-net-worth' && asset.owner === 'self')
    const lockedAsset = state.plan.assets.find((asset) => asset.kind === 'locked-asset')
    const selfAdult = state.plan.adults.find((adult) => adult.owner === 'self')

    expect(selfLiquid?.amount).toBe(150_000)
    expect(lockedAsset?.owner).toBe('shared')
    expect(lockedAsset?.unlockAge).toBe(46)
    expect(selfAdult?.liquidNetWorth).toBe(150_000)
  })

  it('edits per-adult liquid balances and syncs liquidNetWorth on adults', async () => {
    setHouseholdPlan()

    render(<AssetsPropertySection mode="assets" />)

    // Auto-seeded liquid balances: one per adult
    const taylorInput = screen.getByLabelText('Taylor (You)')
    const patInput = screen.getByLabelText('Pat')

    setNumericInput(taylorInput as HTMLInputElement, '80000')
    setNumericInput(patInput as HTMLInputElement, '40000')

    const state = useHouseholdPlanStore.getState()
    const selfAdult = state.plan.adults.find((adult) => adult.owner === 'self')
    const partnerAdult = state.plan.adults.find((adult) => adult.owner === 'partner')

    expect(selfAdult?.liquidNetWorth).toBe(80_000)
    expect(partnerAdult?.liquidNetWorth).toBe(40_000)
  })

  it('edits shared property ownership, HDB monetization, and downsizing fields', async () => {
    const user = userEvent.setup()
    setHouseholdPlan()

    render(<AssetsPropertySection mode="property" />)

    await user.click(screen.getByRole('button', { name: 'Add property' }))

    const propertyCard = screen.getByDisplayValue('Household property').closest('div.rounded-lg.border')
    if (!(propertyCard instanceof HTMLElement)) {
      throw new Error('Could not find property card')
    }

    await chooseSelectOption(user, propertyCard, 'Owner', 'Shared')
    const shareInput = getFieldInput(propertyCard, 'Share (%)')
    expect(shareInput.value).toBe('50')
    setNumericInput(shareInput, '75')
    await chooseSelectOption(user, propertyCard, 'Monetization strategy', 'Sublet room(s)')
    setNumericInput(getFieldInput(propertyCard, 'Rooms to sublet'), '2')
    await chooseSelectOption(user, propertyCard, 'Scenario', 'Sell & rent')
    setNumericInput(getFieldInput(propertyCard, 'Monthly rent'), '2200')

    const property = useHouseholdPlanStore.getState().plan.properties[0]

    expect(property?.owner).toBe('shared')
    expect(property?.ownershipPercent).toBe(0.75)
    expect(property?.hdbMonetizationStrategy).toBe('sublet')
    expect(property?.hdbSublettingRooms).toBe(2)
    expect(property?.downsizing.scenario).toBe('sell-and-rent')
    expect(property?.downsizing.monthlyRent).toBe(2_200)
  })

  it('edits household assumptions without falling back to legacy profile inputs', async () => {
    const user = userEvent.setup()
    setHouseholdPlan()

    render(<AssumptionsSection mode="assumptions" />)

    const fireCard = screen.getByText('Household FIRE Targets').closest('div.rounded-lg.border')
    if (!(fireCard instanceof HTMLElement)) {
      throw new Error('Could not find fire assumptions card')
    }
    await chooseSelectOption(user, fireCard, 'FIRE type', 'Fat')
    setNumericInput(getFieldInput(fireCard, 'Safe withdrawal rate'), '4.0')

    const returnsCard = screen.getByText('Returns & Inflation').closest('div.rounded-lg.border')
    if (!(returnsCard instanceof HTMLElement)) {
      throw new Error('Could not find returns card')
    }
    await user.click(within(returnsCard).getByRole('button', { name: 'Manual' }))
    setNumericInput(getFieldInput(returnsCard, 'Expected nominal return'), '6.5')
    setNumericInput(getFieldInput(returnsCard, 'Inflation rate'), '2.0')
    setNumericInput(getFieldInput(returnsCard, 'Expense ratio'), '0.2')
    await chooseSelectOption(user, returnsCard, 'Rebalancing frequency', 'Quarterly')

    const cashReserveCard = screen.getByText('Cash Reserve & Retirement Buffers').closest('div.rounded-lg.border')
    if (!(cashReserveCard instanceof HTMLElement)) {
      throw new Error('Could not find cash reserve card')
    }
    await user.click(within(cashReserveCard).getAllByRole('switch')[0]!)
    await user.click(within(cashReserveCard).getByRole('button', { name: 'Months of expenses' }))
    setNumericInput(getFieldInput(cashReserveCard, 'Months of expenses'), '9')
    setNumericInput(getFieldInput(cashReserveCard, 'Cash return'), '2.5')
    await user.click(within(cashReserveCard).getAllByRole('switch')[1]!)
    setNumericInput(getFieldInput(cashReserveCard, 'Bucket size (months)'), '24')
    setNumericInput(getFieldInput(cashReserveCard, 'Bucket cash return'), '1.5')

    const assumptions = useHouseholdPlanStore.getState().plan.assumptions

    expect(assumptions.fire.fireType).toBe('fat')
    expect(assumptions.fire.swr).toBe(0.04)
    expect(assumptions.returns.usePortfolioReturn).toBe(false)
    expect(assumptions.returns.expectedReturn).toBe(0.065)
    expect(assumptions.returns.inflation).toBe(0.02)
    expect(assumptions.returns.expenseRatio).toBe(0.002)
    expect(assumptions.returns.rebalanceFrequency).toBe('quarterly')
    expect(assumptions.cashReserve.enabled).toBe(true)
    expect(assumptions.cashReserve.mode).toBe('months')
    expect(assumptions.cashReserve.months).toBe(9)
    expect(assumptions.cashReserve.returnRate).toBe(0.025)
    expect(assumptions.retirementMitigation).toEqual({
      type: 'cash_bucket',
      targetMonths: 24,
      cashReturn: 0.015,
    })
  })

  it('uses household-aware glide path controls in the allocation section', async () => {
    const user = userEvent.setup()
    setHouseholdPlan()

    render(<AssumptionsSection mode="allocation" />)

    const glidePathCard = screen.getByText('Household Glide Path').closest('div.rounded-lg.border')
    if (!(glidePathCard instanceof HTMLElement)) {
      throw new Error('Could not find glide path card')
    }

    await user.click(within(glidePathCard).getByRole('switch'))
    await chooseSelectOption(user, glidePathCard, 'Method', 'Fast start')
    setNumericInput(getFieldInput(glidePathCard, 'Start age'), '58')
    setNumericInput(getFieldInput(glidePathCard, 'End age'), '72')

    expect(useAllocationStore.getState().glidePathConfig).toMatchObject({
      enabled: true,
      method: 'fastStart',
      startAge: 58,
      endAge: 72,
    })
  })
})
