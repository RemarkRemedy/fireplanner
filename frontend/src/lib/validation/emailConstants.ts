// exit_intent is accepted by the backend but has no frontend component yet (Phase 2)
export const VALID_SOURCES = ['post_simulation', 'landing_page', 'exit_intent', 'contextual_nudge', 'expense_tracker'] as const
export const VALID_FEATURES = ['cpf_optimization', 'couples_planning', 'insurance_gap', 'general', 'expense_tracker'] as const
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

// --- Expense Tracker Early Access ---

export const EXPENSE_TRACKER_SIGNED_UP_FLAG = 'fireplanner-expense-tracker-signed-up'
export const EXPENSE_TRACKER_MODAL_DISMISSED_KEY = 'fireplanner-expense-tracker-modal-dismissed'
export const EXPENSE_TRACKER_MODAL_SESSION_KEY = 'fireplanner-expense-tracker-modal-shown-session'
export const EXPENSE_TRACKER_BANNER_SESSION_KEY = 'fireplanner-expense-tracker-banner-dismissed'

export const VALID_EXPENSE_TRACKING_STATUSES = ['consistent', 'sometimes', 'stopped', 'not_currently'] as const
export type ExpenseTrackingStatus = (typeof VALID_EXPENSE_TRACKING_STATUSES)[number]

export const VALID_PRIMARY_DEVICES = ['iphone', 'android', 'both', 'unknown'] as const
export type PrimaryDevice = (typeof VALID_PRIMARY_DEVICES)[number]

export const VALID_SOURCE_SURFACES = ['banner', 'card', 'modal', 'footer'] as const
export type SourceSurface = (typeof VALID_SOURCE_SURFACES)[number]

export const EXPENSE_TRACKING_OPTIONS: { value: ExpenseTrackingStatus; label: string }[] = [
  { value: 'consistent', label: 'I track consistently' },
  { value: 'sometimes', label: 'I track sometimes' },
  { value: 'stopped', label: 'I used to, but stopped' },
  { value: 'not_currently', label: "I don't currently track" },
]

export const PRIMARY_DEVICE_OPTIONS: { value: PrimaryDevice; label: string }[] = [
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android' },
  { value: 'both', label: 'Both' },
  { value: 'unknown', label: 'Not sure' },
]
