export const PRUDENTIAL_PROSPER_SUM_AT_RISK_MULTIPLIERS = {
  death: 1.01,
  accidentalDeath: 1.05,
} as const

export const MANULIFE_PROTECTED_BASE_FLOOR_MULTIPLIER = 1.01
export const TOKIO_MPC_PROTECTED_BASE_FLOOR_MULTIPLIER = 1.01

export const PRUDENTIAL_ASSURE_II_MULTIPLIERS = {
  floorRate: 1.03,
  growthRate: 0.03,
  capRate: 1.6,
} as const
