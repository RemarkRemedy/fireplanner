// exit_intent is accepted by the backend but has no frontend component yet (Phase 2)
export const VALID_SOURCES = ['post_simulation', 'landing_page', 'exit_intent'] as const
export const VALID_FEATURES = ['cpf_optimization', 'couples_planning', 'insurance_gap', 'general'] as const
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const EMAIL_MAX_LENGTH = 254

export type EmailSource = (typeof VALID_SOURCES)[number]
export type FeatureInterest = (typeof VALID_FEATURES)[number]

// localStorage key: set when the full flow completes (feature selected or skipped)
export const SIGNUP_FLAG = 'fireplanner-email-signed-up'
// localStorage key: set when email is submitted (step 1 only)
export const EMAIL_SUBMITTED_FLAG = 'fireplanner-email-submitted'

export const FEATURE_OPTIONS: { value: FeatureInterest; label: string }[] = [
  { value: 'cpf_optimization', label: 'CPF Optimization' },
  { value: 'couples_planning', label: 'Couples / Household Planning' },
  { value: 'insurance_gap', label: 'Insurance Gap Calculator' },
  { value: 'general', label: 'General Updates' },
]
