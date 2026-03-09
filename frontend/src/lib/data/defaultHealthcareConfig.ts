import type { HealthcareConfig } from '@/lib/types'

export const DEFAULT_HEALTHCARE_CONFIG: HealthcareConfig = {
  enabled: false,
  mediShieldLifeEnabled: true,
  ispTier: 'none',
  careShieldLifeEnabled: true,
  /**
   * Out-of-pocket healthcare base amount (SGD/year) for a healthy 30-year-old.
   * Source: Bottom-Up Estimate — GP + dental + optical + medications.
   * The age-curve model scales this up with age.
   */
  oopBaseAmount: 1170,
  oopModel: 'age-curve',
  oopInflationRate: 0.03,
  oopReferenceAge: 30,
  oopCurveVariant: 'study-backed',
  mediSaveTopUpAnnual: 0,
}
