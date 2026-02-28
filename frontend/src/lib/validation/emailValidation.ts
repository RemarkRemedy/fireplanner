import {
  VALID_SOURCES,
  VALID_FEATURES,
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
  type EmailSource,
  type FeatureInterest,
} from './emailConstants'

export type { EmailSource, FeatureInterest }
export { VALID_SOURCES, VALID_FEATURES }

export interface EmailSignupInput {
  email: string
  source: string
  feature_interest?: string
}

interface ValidationSuccess {
  success: true
  data: { email: string; source: EmailSource; feature_interest?: FeatureInterest }
}

interface ValidationFailure {
  success: false
  error: string
}

export type ValidationResult = ValidationSuccess | ValidationFailure

export function validateEmailSignup(input: EmailSignupInput): ValidationResult {
  const email = input.email.trim().toLowerCase()

  if (!email || !EMAIL_RE.test(email)) {
    return { success: false, error: 'Invalid email address' }
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    return { success: false, error: 'Invalid email address (too long)' }
  }

  if (!VALID_SOURCES.includes(input.source as EmailSource)) {
    return { success: false, error: `Invalid source: ${input.source}` }
  }

  if (
    input.feature_interest !== undefined &&
    (input.feature_interest === '' ||
      !VALID_FEATURES.includes(input.feature_interest as FeatureInterest))
  ) {
    return { success: false, error: `Invalid feature_interest: ${input.feature_interest}` }
  }

  return {
    success: true,
    data: {
      email,
      source: input.source as EmailSource,
      feature_interest: input.feature_interest
        ? (input.feature_interest as FeatureInterest)
        : undefined,
    },
  }
}
