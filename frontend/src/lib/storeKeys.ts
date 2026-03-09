export const PROFILE_STORAGE_KEY = 'fireplanner-profile'
export const INCOME_STORAGE_KEY = 'fireplanner-income'
export const ALLOCATION_STORAGE_KEY = 'fireplanner-allocation'
export const SIMULATION_STORAGE_KEY = 'fireplanner-simulation'
export const WITHDRAWAL_STORAGE_KEY = 'fireplanner-withdrawal'
export const PROPERTY_STORAGE_KEY = 'fireplanner-property'
export const HOUSEHOLD_PLAN_STORAGE_KEY = 'fireplanner-household-plan-v1'
export const UI_STORAGE_KEY = 'fireplanner-ui'

export const LEGACY_AUTHORING_STORE_KEYS = [
  PROFILE_STORAGE_KEY,
  INCOME_STORAGE_KEY,
  PROPERTY_STORAGE_KEY,
] as const

export const GLOBAL_PLANNER_STORE_KEYS = [
  ALLOCATION_STORAGE_KEY,
  SIMULATION_STORAGE_KEY,
  WITHDRAWAL_STORAGE_KEY,
] as const

export const PORTABILITY_STORE_KEYS = [
  HOUSEHOLD_PLAN_STORAGE_KEY,
  ...GLOBAL_PLANNER_STORE_KEYS,
] as const

export const ALL_RUNTIME_STORE_KEYS = [
  ...LEGACY_AUTHORING_STORE_KEYS,
  ...PORTABILITY_STORE_KEYS,
] as const

export const COMPANION_BOOTSTRAP_STORE_KEYS = [
  ...ALL_RUNTIME_STORE_KEYS,
  UI_STORAGE_KEY,
] as const
