/** Singapore-specific defaults for the guided setup wizard and nudge flows */

// --- Income & Expenses ---
export const DEFAULT_MONTHLY_INCOME = 4800
export const DEFAULT_MONTHLY_EXPENSES = 2500
export const DEFAULT_RETIREMENT_AGE = 55
export const DEFAULT_STARTING_AGE = 30
export const DEFAULT_LIQUID_NET_WORTH = 50000
export const DEFAULT_PARTNER_ANNUAL_INCOME = 72000

// --- Property ---
export const DEFAULT_PURCHASE_PRICE = 1_500_000
export const DEFAULT_LEASE_YEARS = 99
export const DEFAULT_APPRECIATION_RATE = 0.03
export const DEFAULT_RENTAL_YIELD = 0.03
export const DEFAULT_MORTGAGE_RATE = 0.035
export const DEFAULT_MORTGAGE_TERM = 25
export const DEFAULT_LTV = 0.75 // MAS LTV limit for first residential property
export const DEFAULT_HDB_SUBLETTING_RATE = 800
export const DEFAULT_FUNERAL_COSTS = 15_000

// --- Nudge flow defaults ---
export const DEFAULT_CPF_PAYOUT_START_AGE = 65
export const DEFAULT_CPF_LIFE_PLAN = 'standard' as const
export const DEFAULT_EMERGENCY_FUND_MONTHS = 6
export const DEFAULT_REBALANCING_FREQUENCY = 'annual' as const
export const DEFAULT_ISP_TIER = 'basic' as const
export const DEFAULT_CARESHIELD_ENROLLED = true
