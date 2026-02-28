export const VALID_SOURCES = ['post_simulation', 'landing_page', 'exit_intent'] as const
export const VALID_FEATURES = ['cpf_optimization', 'couples_planning', 'insurance_gap', 'general'] as const
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const EMAIL_MAX_LENGTH = 254

export type EmailSource = (typeof VALID_SOURCES)[number]
export type FeatureInterest = (typeof VALID_FEATURES)[number]
