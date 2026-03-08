import { DEFAULT_HEALTHCARE_CONFIG } from '@/lib/data/defaultHealthcareConfig'
import type { HouseholdPlan, PlanningAdult, PropertyPlan } from '@/lib/household/types'

export interface HouseholdSectionToggles {
  cpfEnabled: boolean
  propertyEnabled: boolean
  healthcareEnabled: boolean
}

function hasCpfPlanningData(adult: PlanningAdult): boolean {
  return adult.cpf.balances.oa > 0
    || adult.cpf.balances.sa > 0
    || adult.cpf.balances.ma > 0
    || adult.cpf.balances.ra > 0
    || adult.cpf.annualTopUps.oa > 0
    || adult.cpf.annualTopUps.sa > 0
    || adult.cpf.annualTopUps.ma > 0
    || adult.cpf.lifeActualMonthlyPayout > 0
    || adult.cpf.oaWithdrawals.length > 0
    || adult.cpf.cpfisEnabled
}

function hasHealthcarePlanningData(adult: PlanningAdult): boolean {
  const { healthcare } = adult
  return healthcare.enabled
    || healthcare.ispTier !== DEFAULT_HEALTHCARE_CONFIG.ispTier
    || healthcare.mediSaveTopUpAnnual !== DEFAULT_HEALTHCARE_CONFIG.mediSaveTopUpAnnual
    || healthcare.oopBaseAmount !== DEFAULT_HEALTHCARE_CONFIG.oopBaseAmount
    || healthcare.oopInflationRate !== DEFAULT_HEALTHCARE_CONFIG.oopInflationRate
    || healthcare.oopModel !== DEFAULT_HEALTHCARE_CONFIG.oopModel
    || healthcare.mediShieldLifeEnabled !== DEFAULT_HEALTHCARE_CONFIG.mediShieldLifeEnabled
    || healthcare.careShieldLifeEnabled !== DEFAULT_HEALTHCARE_CONFIG.careShieldLifeEnabled
}

function hasPropertyPlanningData(property: PropertyPlan): boolean {
  return property.ownsProperty
    || property.propertyCount > 0
    || property.existingPropertyValue > 0
    || property.existingMortgageBalance > 0
    || property.existingMonthlyPayment > 0
    || property.mortgageCpfMonthly > 0
    || property.downsizing.scenario !== 'none'
    || property.hdbMonetizationStrategy !== 'none'
    || property.hdbCpfUsedForHousing > 0
}

export function deriveHouseholdSectionToggles(plan: HouseholdPlan): HouseholdSectionToggles {
  return {
    cpfEnabled: plan.adults.some(hasCpfPlanningData),
    propertyEnabled: plan.properties.some(hasPropertyPlanningData),
    healthcareEnabled: plan.adults.some(hasHealthcarePlanningData),
  }
}
