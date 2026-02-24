import { describe, it, expect, beforeEach } from 'vitest'
import { useHouseholdStore, createDefaultPerson } from './useHouseholdStore'

describe('useHouseholdStore', () => {
  beforeEach(() => {
    useHouseholdStore.getState().reset()
  })

  it('creates default person with correct structure', () => {
    const person = createDefaultPerson('test-id', 'Test Person')
    expect(person.profile.id).toBe('test-id')
    expect(person.profile.name).toBe('Test Person')
    expect(person.income.annualSalary).toBeDefined()
    expect(person.cpf.cpfOA).toBeDefined()
    expect(person.healthcare.enabled).toBeDefined()
  })

  it('adds person to household', () => {
    const person = createDefaultPerson('p1', 'Person 1')

    useHouseholdStore.getState().addPerson(person)

    const state = useHouseholdStore.getState()
    expect(state.persons).toHaveLength(1)
    expect(state.persons[0].profile.id).toBe('p1')
  })

  it('removes person from household', () => {
    const person1 = createDefaultPerson('p1', 'Person 1')
    const person2 = createDefaultPerson('p2', 'Person 2')

    useHouseholdStore.getState().addPerson(person1)
    useHouseholdStore.getState().addPerson(person2)

    let state = useHouseholdStore.getState()
    expect(state.persons).toHaveLength(2)

    useHouseholdStore.getState().removePerson('p1')

    state = useHouseholdStore.getState()
    expect(state.persons).toHaveLength(1)
    expect(state.persons[0].profile.id).toBe('p2')
  })

  it('updates person profile', () => {
    const person = createDefaultPerson('p1', 'Person 1')

    useHouseholdStore.getState().addPerson(person)
    useHouseholdStore.getState().updatePersonProfile('p1', { currentAge: 35 })

    const state = useHouseholdStore.getState()
    expect(state.persons[0].profile.currentAge).toBe(35)
  })

  it('updates person income', () => {
    const person = createDefaultPerson('p1', 'Person 1')

    useHouseholdStore.getState().addPerson(person)
    useHouseholdStore.getState().updatePersonIncome('p1', { annualSalary: 80000 })

    const state = useHouseholdStore.getState()
    expect(state.persons[0].income.annualSalary).toBe(80000)
  })

  it('updates person CPF', () => {
    const person = createDefaultPerson('p1', 'Person 1')

    useHouseholdStore.getState().addPerson(person)
    useHouseholdStore.getState().updatePersonCpf('p1', { cpfOA: 60000 })

    const state = useHouseholdStore.getState()
    expect(state.persons[0].cpf.cpfOA).toBe(60000)
  })

  it('validates person ages', () => {
    const person = createDefaultPerson('p1', 'Person 1')
    person.profile.currentAge = 15 // Invalid: below 18

    useHouseholdStore.getState().addPerson(person)

    const state = useHouseholdStore.getState()
    expect(Object.keys(state.validationErrors).length).toBeGreaterThan(0)
    expect(state.validationErrors['person_p1_age']).toBeDefined()
  })

  it('validates retirement age is after current age', () => {
    const person = createDefaultPerson('p1', 'Person 1')
    person.profile.currentAge = 40
    person.profile.retirementAge = 35 // Invalid: before current age

    useHouseholdStore.getState().addPerson(person)

    const state = useHouseholdStore.getState()
    expect(state.validationErrors['person_p1_retirementAge']).toBeDefined()
  })

  it('toggles household mode', () => {
    let state = useHouseholdStore.getState()
    expect(state.householdMode).toBe(false)

    useHouseholdStore.getState().setHouseholdMode(true)
    state = useHouseholdStore.getState()
    expect(state.householdMode).toBe(true)

    useHouseholdStore.getState().setHouseholdMode(false)
    state = useHouseholdStore.getState()
    expect(state.householdMode).toBe(false)
  })

  it('allows single person in household mode', () => {
    const person = createDefaultPerson('p1', 'Person 1')

    useHouseholdStore.getState().setHouseholdMode(true)
    useHouseholdStore.getState().addPerson(person)

    const state = useHouseholdStore.getState()
    // Should not have validation error for having only 1 person
    // (validation removed to allow users to add second person after enabling mode)
    expect(state.validationErrors['household']).toBeUndefined()
  })
})
