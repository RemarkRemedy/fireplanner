import type { HealthcareConfig } from '@/lib/types'

export const DEFAULT_HEALTHCARE_CONFIG: HealthcareConfig = {
  enabled: false,
  mediShieldLifeEnabled: true,
  ispTier: 'none',
  careShieldLifeEnabled: true,
  oopBaseAmount: 1200,
  oopModel: 'age-curve',
  oopInflationRate: 0.03,
  oopReferenceAge: 30,
  oopCurveVariant: 'study-backed',
  mediSaveTopUpAnnual: 0,
}
