import type { HealthcareConfig } from '@/lib/types'

export const DEFAULT_HEALTHCARE_CONFIG: HealthcareConfig = {
  enabled: false,
  mediShieldLifeEnabled: true,
  ispTier: 'none',
  careShieldLifeEnabled: true,
  /**
   * Out-of-pocket healthcare base amount (SGD/year) for a healthy 30-year-old.
   * Source: MOH household health expenditure survey (2021/22) — median OOP
   * spending for 25-34 age band ~$1,000-1,400/yr. We use $1,200 as a
   * conservative mid-point. The age-curve model scales this up with age.
   */
  oopBaseAmount: 1200,
  oopModel: 'age-curve',
  oopInflationRate: 0.03,
  oopReferenceAge: 30,
  oopCurveVariant: 'study-backed',
  mediSaveTopUpAnnual: 0,
}
