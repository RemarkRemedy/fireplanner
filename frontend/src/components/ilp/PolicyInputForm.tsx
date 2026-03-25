import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import {
  computeBlendedReturn,
  computeTotalProjectionYears,
  type IlpChargeRule,
  type IlpEventChargeRule,
  type IlpPolicyEvent,
  type IlpPolicyInput,
} from '@/lib/calculations/ilp'
import { EEC_PRESETS } from '@/lib/data/ilpDefaults'
import { useIlpStore } from '@/stores/useIlpStore'
import { cn } from '@/lib/utils'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatIlpPercent } from './formatters'
import { Badge } from '@/components/ui/badge'

const USE_TOP_UP_ROUTING_VALUE = '__top-up-routing__'

interface PolicyInputFormProps {
  policy: IlpPolicyInput | null
  issues: string[]
}

function createDraftId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function humanizeCatalogTag(value: string): string {
  return value
    .replace(/^branch:/, '')
    .replace(/-/g, ' ')
}

function requiresWealthAssureValue(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'prudential-assure-ii-combined'
}

function requiresCurrentSumAssured(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'prudential-assure-ii-combined'
    || rule.assuranceConfig?.formula === 'prudential-linkguard-combined'
    || rule.assuranceConfig?.formula === 'great-eastern-pla-death-ti'
    || rule.assuranceConfig?.formula === 'income-legacy-flex-solitaire-death-ti'
}

function requiresCurrentNetRegularPremiumBase(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'prudential-prosper-death'
    || rule.assuranceConfig?.formula === 'prudential-prosper-accidental-death'
    || rule.assuranceConfig?.formula === 'prudential-assure-ii-combined'
    || rule.assuranceConfig?.formula === 'great-eastern-wa4-death-ti'
    || rule.assuranceConfig?.formula === 'fwd-invest-flexi-elite-death'
    || rule.assuranceConfig?.formula === 'fwd-invest-repayment-inclusive-death'
    || rule.assuranceConfig?.formula === 'tokio-mpc-net-premium-floor'
}

function requiresCurrentBasicSumAssured(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'hsbc-flexi-choice-death-ti'
    || rule.assuranceConfig?.formula === 'hsbc-flexi-max-death-ti'
    || rule.assuranceConfig?.formula === 'great-eastern-gla4-death-ti'
}

function requiresCurrentNetSupplementaryPremiumBase(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'hsbc-flexi-choice-death-ti'
    || rule.assuranceConfig?.formula === 'great-eastern-wa4-death-ti'
    || rule.assuranceConfig?.formula === 'great-eastern-gla4-death-ti'
    || rule.assuranceConfig?.formula === 'fwd-invest-flexi-elite-death'
    || rule.assuranceConfig?.formula === 'fwd-invest-repayment-inclusive-death'
}

function requiresCurrentNetRepaymentBase(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'fwd-invest-repayment-inclusive-death'
}

function requiresCurrentLockedInPolicyValue(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'tokio-mpc-locked-in-policy-value'
    || rule.assuranceConfig?.formula === 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
}

function requiresCurrentAdjustedSinglePremium(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
}

function supportsTokioCurrentLifeState(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'tokio-mpc-net-premium-floor'
    || rule.assuranceConfig?.formula === 'tokio-mpc-locked-in-policy-value'
    || rule.assuranceConfig?.formula === 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium'
}

function supportsCurrentTiClaimSnapshot(rule: IlpChargeRule): boolean {
  return rule.assuranceConfig?.formula === 'hsbc-flexi-choice-death-ti'
    || rule.assuranceConfig?.formula === 'hsbc-flexi-max-death-ti'
}

function supportsGoalBuilderTiClaimSnapshot(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-harvest'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-abundance'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-voyage'
    || policy.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
    || policy.catalogSource?.productId === 'fwd-invest-first-horizon'
    || policy.catalogSource?.productId === 'fwd-invest-flexi-vii'
    || policy.catalogSource?.productId === 'etiqa-invest-starter'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-wealth-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-prime-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-pro'
    || policy.catalogSource?.productId === 'etiqa-invest-vista'
    || policy.catalogSource?.productId === 'etiqa-invest-smart-flex-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-smart-vista'
    || policy.catalogSource?.productId === 'etiqa-invest-wealth-purpose'
    || policy.catalogSource?.productId === 'manulife-investready-growth'
    || policy.catalogSource?.productId === 'manulife-investready-iii'
    || policy.catalogSource?.productId === 'manulife-investready-iii-sep-2025'
    || policy.catalogSource?.productId === 'manulife-manuinvest-duo'
    || policy.catalogSource?.productId === 'manulife-manulink-investor-ii'
    || policy.catalogSource?.productId === 'etiqa-tiq-invest'
    || policy.catalogSource?.productId === 'etiqa-dash-pet-plus'
    || policy.catalogSource?.productId === 'aia-platinum-wealth-elite-2'
    || policy.catalogSource?.productId === 'aia-platinum-wealth-legacy'
    || policy.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
    || policy.catalogSource?.productId === 'great-eastern-prestige-legacy-advantage'
}

function supportsOptionalCurrentTiClaimIndebtednessOverride(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'hsbc-life-wealth-harvest'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-abundance'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-voyage'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-accelerate'
    || policy.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
    || policy.catalogSource?.productId === 'manulife-investready-growth'
    || policy.catalogSource?.productId === 'manulife-investready-iii'
    || policy.catalogSource?.productId === 'manulife-investready-iii-sep-2025'
}

function supportsProductTpdClaimSnapshot(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
    || policy.catalogSource?.productId === 'income-astralink-va2'
    || policy.catalogSource?.productId === 'great-eastern-great-life-advantage-4'
    || policy.catalogSource?.productId === 'great-eastern-wealth-advantage-4'
    || policy.catalogSource?.productId === 'manulife-manuinvest-duo'
    || policy.catalogSource?.productId === 'tokio-marine-goassure'
}

function supportsCurrentTpdSettlementMode(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'prudential-pruactive-linkguard'
}

function supportsCurrentTpdContinuationEventStatus(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'great-eastern-great-life-advantage-4'
}

function supportsCurrentTiClaimStatus(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'hsbc-life-wealth-harvest'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-abundance'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-voyage'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-accelerate'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-focus-flexi-1'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-focus-flexi-3'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-focus-flexi-5'
    || policy.catalogSource?.productId === 'hsbc-life-flexi-protector'
    || policy.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-invest-cash-srs'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-invest-cpf'
    || policy.catalogSource?.productId === 'etiqa-tiq-invest'
    || policy.catalogSource?.productId === 'etiqa-dash-pet-plus'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-prime-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-pro'
    || policy.catalogSource?.productId === 'etiqa-invest-vista'
    || policy.catalogSource?.productId === 'etiqa-invest-smart-flex-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-smart-vista'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-wealth-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-wealth-purpose'
    || policy.catalogSource?.productId === 'etiqa-invest-starter'
    || policy.catalogSource?.productId === 'tokio-marine-goassure'
    || policy.catalogSource?.productId === 'great-eastern-wealth-advantage-4'
    || policy.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
    || policy.catalogSource?.productId === 'great-eastern-prestige-legacy-advantage'
    || policy.catalogSource?.productId === 'aia-platinum-wealth-elite-2'
    || policy.catalogSource?.productId === 'aia-platinum-wealth-legacy'
    || policy.catalogSource?.productId === 'aia-elite-secure-income-5-pay'
    || policy.catalogSource?.productId === 'aia-elite-secure-income-single-premium'
    || policy.catalogSource?.productId === 'aia-platinum-retirement-elite'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-sp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-rsp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-sp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-rsp'
    || policy.catalogSource?.productId === 'manulife-manuinvest-duo'
    || policy.catalogSource?.productId === 'manulife-manulink-investor-ii'
    || policy.catalogSource?.productId === 'manulife-investready-growth'
    || policy.catalogSource?.productId === 'manulife-investready-iii'
    || policy.catalogSource?.productId === 'manulife-investready-iii-sep-2025'
    || policy.catalogSource?.productId === 'singlife-legacy-invest'
    || policy.catalogSource?.productId === 'singlife-savvy-invest-ii'
    || policy.catalogSource?.productId === 'income-invest-flex'
    || policy.catalogSource?.productId === 'income-invest-flex-vantage'
    || policy.catalogSource?.productId === 'income-invest-flex-trivantage'
    || policy.catalogSource?.productId === 'income-legacy-flex-solitaire'
}

function supportsRemainingAggregateTiCiCap(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'manulife-investready-growth'
    || policy.catalogSource?.productId === 'manulife-investready-iii'
    || policy.catalogSource?.productId === 'manulife-investready-iii-sep-2025'
}

function supportsCurrentResidualDeathBenefitAfterTiClaim(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'hsbc-life-wealth-harvest'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-abundance'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-voyage'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-accelerate'
    || policy.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
    || policy.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
    || policy.catalogSource?.productId === 'etiqa-tiq-invest'
    || policy.catalogSource?.productId === 'etiqa-dash-pet-plus'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-prime-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-pro'
    || policy.catalogSource?.productId === 'etiqa-invest-vista'
    || policy.catalogSource?.productId === 'etiqa-invest-smart-flex-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-smart-vista'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-wealth-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-wealth-purpose'
    || policy.catalogSource?.productId === 'tokio-marine-goassure'
    || policy.catalogSource?.productId === 'great-eastern-prestige-legacy-advantage'
    || policy.catalogSource?.productId === 'aia-platinum-wealth-elite-2'
    || policy.catalogSource?.productId === 'aia-platinum-wealth-legacy'
    || policy.catalogSource?.productId === 'manulife-manuinvest-duo'
    || policy.catalogSource?.productId === 'manulife-manulink-investor-ii'
    || policy.catalogSource?.productId === 'manulife-investready-growth'
    || policy.catalogSource?.productId === 'manulife-investready-iii'
    || policy.catalogSource?.productId === 'manulife-investready-iii-sep-2025'
}

function supportsCurrentTiClaimBenefitAmount(policy: IlpPolicyInput): boolean {
  return supportsCurrentResidualDeathBenefitAfterTiClaim(policy)
    || policy.catalogSource?.productId === 'hsbc-life-wealth-invest-cash-srs'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-invest-cpf'
    || policy.catalogSource?.productId === 'etiqa-invest-starter'
    || policy.catalogSource?.productId === 'great-eastern-wealth-advantage-4'
    || policy.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
    || policy.catalogSource?.productId === 'aia-elite-secure-income-5-pay'
    || policy.catalogSource?.productId === 'aia-elite-secure-income-single-premium'
    || policy.catalogSource?.productId === 'aia-platinum-retirement-elite'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-sp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-rsp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-sp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-rsp'
    || policy.catalogSource?.productId === 'singlife-legacy-invest'
    || policy.catalogSource?.productId === 'singlife-savvy-invest-ii'
    || policy.catalogSource?.productId === 'income-invest-flex'
    || policy.catalogSource?.productId === 'income-invest-flex-vantage'
    || policy.catalogSource?.productId === 'income-invest-flex-trivantage'
    || policy.catalogSource?.productId === 'income-legacy-flex-solitaire'
}

function supportsCurrentTpdClaimBenefitAmount(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'great-eastern-great-life-advantage-4'
    || policy.catalogSource?.productId === 'manulife-manuinvest-duo'
    || policy.catalogSource?.productId === 'great-eastern-wealth-advantage-4'
    || policy.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
}

function supportsCurrentTpdClaimStatus(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'great-eastern-great-life-advantage-4'
    || policy.catalogSource?.productId === 'great-eastern-wealth-advantage-4'
    || policy.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
    || policy.catalogSource?.productId === 'manulife-manuinvest-duo'
}

function supportsCurrentTpdPayoutStage(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'prudential-pruactive-linkguard'
    || policy.catalogSource?.productId === 'hsbc-life-flexi-protector'
}

function supportsCurrentAccidentalDisabilityPayoutStage(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'prudential-pruvantage-assure-ii'
    || policy.catalogSource?.productId === 'prudential-pruvantage-assure-sp'
    || policy.catalogSource?.productId === 'prudential-pruvantage-wealth-ii'
}

function supportsCurrentAccidentalDeathMode(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'income-astralink-va2'
}

function supportsCurrentAgeAccidentalDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'tokio-marine-goaffluence'
}

function supportsCurrentExcludedClaimBonusValueDeathBenefit(policy: IlpPolicyInput): boolean {
  return (
    policy.catalogSource?.productId === 'income-invest-flex'
    || policy.catalogSource?.productId === 'income-invest-flex-vantage'
    || policy.catalogSource?.productId === 'income-invest-flex-trivantage'
  ) && policy.monthsAlreadyPaid < 12
}

function supportsCurrentAcceptedRegularPremiumMonths(policy: IlpPolicyInput): boolean {
  return policy.monthsAlreadyPaid > 0
    && policy.monthlyContribution > 0
    && (
      policy.catalogSource?.productId === 'aia-elite-secure-income-5-pay'
      || policy.catalogSource?.productId === 'aia-platinum-retirement-elite'
      || policy.catalogSource?.productId === 'aia-pro-lifetime-protector-ii'
      || policy.catalogSource?.productId === 'aia-wealth-venture'
      || policy.catalogSource?.productId === 'aia-platinum-wealth-venture-2'
    )
}

function supportsInitialBasicSumAssuredAtIssueBonus(policy: IlpPolicyInput): boolean {
  return policy.bonuses.some((bonus) => bonus.annualPremiumTierBasis === 'initial-basic-sum-assured-at-issue')
}

function isSmartRetireDeathBenefitProduct(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'manulife-smartretire-v-income'
    || policy.catalogSource?.productId === 'manulife-smartretire-v-sum'
}

function supportsSmartRetireCoiRefund(policy: IlpPolicyInput): boolean {
  return isSmartRetireDeathBenefitProduct(policy)
}

function supportsInvestStarterCurrentPolicyChargeRefund(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'etiqa-invest-starter'
    && policy.monthsAlreadyPaid >= 36
}

function supportsInvestPlusSpCurrentPowerUpBonus(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'etiqa-invest-plus-sp'
    && policy.monthsAlreadyPaid >= 36
}

function supportsInvestPlusSpObservedInitialAverage(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'etiqa-invest-plus-sp'
    && policy.monthsAlreadyPaid > 0
    && (policy.monthsAlreadyPaid % 36) !== 0
}

function supportsInvestPlusSpRepresentativeManagementChargeRate(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'etiqa-invest-plus-sp'
}

function supportsCurrentAmountOwingDeathBenefit(policy: IlpPolicyInput): boolean {
  return isSmartRetireDeathBenefitProduct(policy)
    || policy.catalogSource?.productId === 'manulife-investready-growth'
    || policy.catalogSource?.productId === 'manulife-investready-iii'
    || policy.catalogSource?.productId === 'manulife-investready-iii-sep-2025'
    || policy.catalogSource?.productId === 'tokio-marine-goassure'
    || policy.catalogSource?.productId === 'prudential-pruactive-linkguard'
    || policy.catalogSource?.productId === 'prudential-pruvantage-prosper'
    || policy.catalogSource?.productId === 'prudential-pruvantage-wealth-ii'
    || policy.catalogSource?.productId === 'prudential-pruvantage-assure-sp'
    || policy.catalogSource?.productId === 'prudential-pruvantage-assure-ii'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-accelerate'
    || policy.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-abundance'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-voyage'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-harvest'
    || policy.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
    || policy.catalogSource?.productId === 'tokio-marine-gowealth-enrich'
    || policy.catalogSource?.productId === 'tokio-marine-goelite'
    || policy.catalogSource?.productId === 'etiqa-invest-starter'
    || policy.catalogSource?.productId === 'etiqa-tiq-invest'
    || policy.catalogSource?.productId === 'etiqa-dash-pet-plus'
    || policy.catalogSource?.productId === 'etiqa-invest-smart-flex-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-smart-vista'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-wealth-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-prime-ii'
    || policy.catalogSource?.productId === 'etiqa-invest-flex-pro'
    || policy.catalogSource?.productId === 'etiqa-invest-vista'
    || policy.catalogSource?.productId === 'etiqa-invest-wealth-purpose'
    || policy.catalogSource?.productId === 'singlife-legacy-invest'
    || policy.catalogSource?.productId === 'singlife-savvy-invest-ii'
    || policy.catalogSource?.productId === 'great-eastern-great-life-advantage-4'
    || policy.catalogSource?.productId === 'great-eastern-wealth-advantage-4'
    || policy.catalogSource?.productId === 'great-eastern-investment-linked-insurance-plan-2'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-sp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-rsp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-sp'
    || policy.catalogSource?.productId === 'great-eastern-great-invest-advantage-2-rsp'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-invest-cpf'
    || policy.catalogSource?.productId === 'hsbc-life-wealth-invest-cash-srs'
    || policy.catalogSource?.productId === 'aia-platinum-wealth-legacy'
}

function supportsCurrentNetProtectedPremiumBaseDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'aia-elite-secure-income-single-premium'
    || policy.catalogSource?.productId === 'aia-elite-secure-income-5-pay'
    || policy.catalogSource?.productId === 'aia-pro-achiever-3'
    || (
      (
        policy.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
        || policy.catalogSource?.productId === 'hsbc-life-wealth-abundance'
        || policy.catalogSource?.productId === 'hsbc-life-wealth-voyage'
      )
      && policy.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
      && policy.scheduledPayoutAssumption.startPolicyYear <= policy.currentPolicyYear
    )
}

function supportsCurrentAccidentalDeathFloorAmount(policy: IlpPolicyInput): boolean {
  return (
    (
      policy.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-')
      || policy.catalogSource?.productId === 'hsbc-life-wealth-abundance'
      || policy.catalogSource?.productId === 'hsbc-life-wealth-voyage'
      || policy.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
    )
    && policy.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
    && policy.scheduledPayoutAssumption.startPolicyYear <= policy.currentPolicyYear
  )
}

function getCurrentAccidentalDeathFloorAmountLabel(policy: IlpPolicyInput): string {
  return policy.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
    ? `Current Accidental-Death Sum Insured (${policy.currency})`
    : `Current Accidental-Death Regular-Premium Floor (${policy.currency})`
}

function supportsCurrentSumAssuredDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'aia-platinum-wealth-elite-2'
    || policy.catalogSource?.productId === 'aia-platinum-wealth-legacy'
    || policy.catalogSource?.productId === 'aia-pro-lifetime-protector-ii'
    || (
      policy.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
      && policy.scheduledPayoutAssumption?.mode === 'scheduled-redemption'
      && policy.scheduledPayoutAssumption.startPolicyYear <= policy.currentPolicyYear
    )
}

function supportsCurrentNoLapsePrivilegeModeDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'aia-platinum-wealth-legacy'
}

function supportsCurrentBasicSumAssuredDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'tokio-marine-goassure'
}

function supportsCurrentBasicSumAssuredAccidentalDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'great-eastern-prestige-portfolio'
}

function supportsCurrentProtectionAgeDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'tokio-marine-goassure'
}

function supportsCurrentTpdAccelerationRatio(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'tokio-marine-goassure'
}

function supportsCurrentRetainedMultiplierStatusDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'prudential-pruactive-linkguard'
}

function supportsCurrentAcceleratedTiPayoutMode(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'prudential-pruactive-linkguard'
}

function supportsCurrentDeathBenefitRateTierDeathBenefit(policy: IlpPolicyInput): boolean {
  return policy.catalogSource?.productId === 'income-wealthlink-gl3'
}

function currentSumAssuredLabel(policy: IlpPolicyInput): string {
  return policy.catalogSource?.productId === 'income-legacy-flex-solitaire'
    ? `Current Adjusted Sum Assured (${policy.currency})`
    : `Current Sum Assured (${policy.currency})`
}

export function PolicyInputForm({ policy, issues }: PolicyInputFormProps) {
  const updatePolicy = useIlpStore((state) => state.updatePolicy)
  const setFund = useIlpStore((state) => state.setFund)
  const addFund = useIlpStore((state) => state.addFund)
  const removeFund = useIlpStore((state) => state.removeFund)
  const setAccount = useIlpStore((state) => state.setAccount)
  const addAccount = useIlpStore((state) => state.addAccount)
  const removeAccount = useIlpStore((state) => state.removeAccount)
  const setBonus = useIlpStore((state) => state.setBonus)
  const addBonus = useIlpStore((state) => state.addBonus)
  const removeBonus = useIlpStore((state) => state.removeBonus)
  const [showCatalogChargeRules, setShowCatalogChargeRules] = useState(false)
  const [showCatalogEventChargeRules, setShowCatalogEventChargeRules] = useState(false)
  const [showCatalogEec, setShowCatalogEec] = useState(false)
  const [showCatalogBonuses, setShowCatalogBonuses] = useState(false)

  if (!policy) return null

  const isCatalogSeeded = policy.catalogSource != null

  const contributionShareTotal = policy.accounts.reduce((sum, account) => sum + account.contributionShare, 0)
  const contributionShareTarget = policy.monthlyContribution > 0 ? 1 : 0
  const contributionShareValid = Math.abs(contributionShareTotal - contributionShareTarget) < 0.001
  const fundAllocationTotal = policy.funds.reduce((sum, fund) => sum + fund.allocation, 0)
  const fundAllocationValid = Math.abs(fundAllocationTotal - 1) < 0.001
  const assuranceRules = (policy.chargeRules ?? []).filter((rule) => rule.basis === 'assurance-sum-at-risk')
  const initialSinglePremiumRules = (policy.chargeRules ?? []).filter((rule) => rule.basis === 'initial-single-premium')
  const originalBaseSinglePremiumRules = (policy.chargeRules ?? []).filter((rule) => rule.basis === 'initial-single-premium-base')
  const usesPersistedInitialSinglePremiumBase = originalBaseSinglePremiumRules.length > 0 || policy.exitChargeBasis === 'initial-single-premium-base'
  const needsInitialSinglePremiumInput = initialSinglePremiumRules.length > 0
    || usesPersistedInitialSinglePremiumBase
    || (policy.initialSinglePremium ?? 0) > 0
  const assuranceProfile = policy.assuranceProfile
  const claimProfile = policy.claimProfile
  const currentClaimHistory = claimProfile?.currentClaimHistory
  const smartRetireClaimFamily = currentClaimHistory?.family
    ?? (claimProfile?.currentWopOnTpdClaimStatus != null ? 'tpd-waiver' : undefined)
  const smartRetireClaimAdmissionStatus = currentClaimHistory?.admissionStatus
    ?? (
      claimProfile?.currentWopOnTpdClaimStatus === 'not-triggered'
        ? 'not-admitted'
        : claimProfile?.currentWopOnTpdClaimStatus === 'admitted'
          ? 'admitted'
          : claimProfile?.currentWopOnTpdClaimStatus === 'admitted-and-settled'
            ? 'admitted-and-settled'
            : undefined
    )
  const smartRetireRefundGateStatus = currentClaimHistory?.refundGateStatus
    ?? claimProfile?.currentSmartRetireRefundGateStatus
  const smartRetireRemainingWaiverMonths = currentClaimHistory?.remainingWaivedPremiumMonths
    ?? claimProfile?.currentRemainingWopPremiumWaiverMonths
  const currentStagedTpdRemainingBalance = currentClaimHistory?.remainingStagedBenefitBalance
    ?? claimProfile?.currentTpdRemainingBalance
  const currentStagedAccidentalDisabilityRemainingBalance = (
    currentClaimHistory?.family === 'accidental-disability-staged-payout'
      ? currentClaimHistory.remainingStagedBenefitBalance
      : undefined
  ) ?? claimProfile?.currentAccidentalDisabilityRemainingBalance
  const tokioLifeAssuredMode = assuranceProfile?.lifeAssuredMode ?? 'single-life'
  const supportsSmartRetireDeathBenefit = isSmartRetireDeathBenefitProduct(policy)
  const supportsSmartRetireCoiRefundInput = supportsSmartRetireCoiRefund(policy)
  const supportsCurrentAmountOwing = supportsCurrentAmountOwingDeathBenefit(policy)
  const supportsCurrentNetProtectedPremiumBase = supportsCurrentNetProtectedPremiumBaseDeathBenefit(policy)
  const supportsCurrentAccidentalDeathFloorAmountInput = supportsCurrentAccidentalDeathFloorAmount(policy)
  const supportsCurrentSumAssuredDeathBenefitInput = supportsCurrentSumAssuredDeathBenefit(policy)
  const supportsCurrentBasicSumAssuredDeathBenefitInput = supportsCurrentBasicSumAssuredDeathBenefit(policy)
  const supportsCurrentBasicSumAssuredAccidentalDeathBenefitInput = supportsCurrentBasicSumAssuredAccidentalDeathBenefit(policy)
  const supportsCurrentProtectionAge = supportsCurrentProtectionAgeDeathBenefit(policy)
  const supportsCurrentTpdAccelerationRatioInput = supportsCurrentTpdAccelerationRatio(policy)
  const supportsCurrentRetainedMultiplierStatus = supportsCurrentRetainedMultiplierStatusDeathBenefit(policy)
  const supportsCurrentAcceleratedTiMode = supportsCurrentAcceleratedTiPayoutMode(policy)
  const supportsCurrentDeathBenefitRateTier = supportsCurrentDeathBenefitRateTierDeathBenefit(policy)
  const supportsCurrentNoLapsePrivilegeMode = supportsCurrentNoLapsePrivilegeModeDeathBenefit(policy)
  const supportsCurrentTpdContinuationStatus = supportsCurrentTpdContinuationEventStatus(policy)
  const supportsCurrentTiClaimStatusInput = supportsCurrentTiClaimStatus(policy)
  const supportsRemainingAggregateTiCiCapInput = supportsRemainingAggregateTiCiCap(policy)
  const supportsCurrentTiClaimBenefitAmountInput = supportsCurrentTiClaimBenefitAmount(policy)
    && (
      claimProfile?.currentTiClaimStatus === 'triggered'
      || claimProfile?.currentTiClaimStatus === 'admitted'
    )
  const supportsCurrentClaimHistoryProtectedDeathCoverBaseInput = (
    policy.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-') ?? false
  ) && (
    claimProfile?.currentTiClaimStatus === 'triggered'
    || claimProfile?.currentTiClaimStatus === 'admitted'
  )
  const supportsCurrentResidualDeathBenefitAfterTiClaimInput = supportsCurrentResidualDeathBenefitAfterTiClaim(policy)
    && (
      claimProfile?.currentTiClaimStatus === 'triggered'
      || claimProfile?.currentTiClaimStatus === 'admitted'
      || claimProfile?.currentTiClaimStatus === 'admitted-and-settled'
    )
    && !supportsCurrentClaimHistoryProtectedDeathCoverBaseInput
  const supportsCurrentTpdClaimStatusInput = supportsCurrentTpdClaimStatus(policy)
  const supportsCurrentTpdClaimBenefitAmountInput = supportsCurrentTpdClaimBenefitAmount(policy)
    && (
      claimProfile?.currentTpdClaimStatus === 'triggered'
      || claimProfile?.currentTpdClaimStatus === 'admitted'
    )
  const supportsCurrentTpdSettlement = supportsCurrentTpdSettlementMode(policy)
  const supportsCurrentTpdStage = supportsCurrentTpdPayoutStage(policy)
  const supportsCurrentAccidentalDisabilityStage = supportsCurrentAccidentalDisabilityPayoutStage(policy)
  const supportsCurrentAccidentalDeathModeInput = supportsCurrentAccidentalDeathMode(policy)
  const supportsCurrentAgeAccidentalDeathBenefitInput = supportsCurrentAgeAccidentalDeathBenefit(policy)
  const supportsCurrentExcludedClaimBonusValue = supportsCurrentExcludedClaimBonusValueDeathBenefit(policy)
  const supportsGoalBuilderHistoricalExcludedSupplementaryPremiumCohorts = policy.catalogSource?.productId === 'hsbc-life-goal-builder-ii'
  const supportsWealthFocusHistoricalExcludedRepaymentCohorts = policy.catalogSource?.productId?.startsWith('hsbc-life-wealth-focus-flexi-') ?? false
  const supportsAiaCurrentPowerUpBonusAdjustmentFactor = (
    policy.catalogSource?.productId === 'aia-elite-secure-income-5-pay'
    || policy.catalogSource?.productId === 'aia-elite-secure-income-single-premium'
    || policy.catalogSource?.productId === 'aia-platinum-retirement-elite'
  )
  const goalBuilderHistoricalExcludedSupplementaryPremiumCohorts = (claimProfile?.currentExcludedValueCohorts ?? [])
    .filter((cohort) => cohort.bonusId === 'loyalty-bonus' && cohort.accountId === 'policy')
  const wealthFocusHistoricalExcludedRepaymentCohorts = (claimProfile?.currentExcludedValueCohorts ?? [])
    .filter((cohort) => cohort.bonusId === 'loyalty-bonus' && cohort.accountId === 'regular')
  const currentPowerUpBonusAdjustmentFactor = claimProfile?.currentBonusAdjustmentFactors
    ?.find((entry) => entry.bonusId === 'power-up-bonus')
    ?.factor
    ?? 1
  const supportsInitialBasicSumAssuredAtIssueInput = supportsInitialBasicSumAssuredAtIssueBonus(policy)
  const supportsAssuranceRuleTiClaimSnapshot = assuranceRules.some(supportsCurrentTiClaimSnapshot)
  const supportsCurrentTiClaimIndebtedness = supportsAssuranceRuleTiClaimSnapshot
    || supportsOptionalCurrentTiClaimIndebtednessOverride(policy)
  const supportsTiClaimSnapshot = supportsAssuranceRuleTiClaimSnapshot || supportsGoalBuilderTiClaimSnapshot(policy)
  const supportsTpdClaimSnapshot = supportsAssuranceRuleTiClaimSnapshot || supportsProductTpdClaimSnapshot(policy)
  const supportsCurrentTpdRemainingBalance = supportsCurrentTpdStage
    && claimProfile?.currentTpdPayoutStage === 'balance-lump-sum-payable-now'
  const supportsCurrentAccidentalDisabilityRemainingBalance = supportsCurrentAccidentalDisabilityStage
    && claimProfile?.currentAccidentalDisabilityPayoutStage === 'balance-lump-sum-payable-now'
  const supportsRemainingAggregateTpdCapInput = supportsTpdClaimSnapshot && !(
    policy.catalogSource?.productId === 'tokio-marine-goassure'
    && assuranceProfile?.currentProtectionAge != null
    && assuranceProfile?.currentAgeNextBirthday != null
    && assuranceProfile.currentAgeNextBirthday >= assuranceProfile.currentProtectionAge
  )
  const supportsSmartRetireLaterDeathBenefit = supportsSmartRetireDeathBenefit
    && policy.mipBasis !== 'open-ended'
    && policy.mipLength != null
    && policy.currentPolicyYear > policy.mipLength
  const supportsSmartRetireWopClaimState = supportsSmartRetireCoiRefundInput
    && assuranceProfile?.targetRetirementAge != null
    && assuranceProfile?.currentAgeNextBirthday != null
    && policy.mipBasis !== 'open-ended'
    && policy.mipLength != null
    && policy.monthsAlreadyPaid < (policy.mipLength * 12)
  const supportsSmartRetireClaimAdmissionStatus = supportsSmartRetireWopClaimState
    && smartRetireClaimFamily === 'tpd-waiver'
  const supportsSmartRetireWopRunway = supportsSmartRetireWopClaimState
    && smartRetireClaimFamily === 'tpd-waiver'
    && smartRetireClaimAdmissionStatus === 'admitted'
  const supportsInvestPlusSpPastDuePowerUpBonus = supportsInvestPlusSpCurrentPowerUpBonus(policy)
  const supportsInvestPlusSpPastDuePowerUpBonusAmounts = supportsInvestPlusSpPastDuePowerUpBonus
    && claimProfile?.currentInvestPlusSpPowerUpBonusStatus === 'due-and-uncredited'
  const supportsInvestPlusSpObservedInitialAverageInput = supportsInvestPlusSpObservedInitialAverage(policy)
  const supportsInvestPlusSpRepresentativeManagementChargeRateInput = supportsInvestPlusSpRepresentativeManagementChargeRate(policy)
  const supportsInvestStarterPastDuePolicyChargeRefund = supportsInvestStarterCurrentPolicyChargeRefund(policy)
  const supportsInvestStarterPastDuePolicyChargeRefundAverageAccountValue = supportsInvestStarterPastDuePolicyChargeRefund
    && claimProfile?.currentInvestStarterPolicyChargeRefundStatus === 'due-and-uncredited'
  const supportsSmartRetireCurrentOrFutureCoiRefund = supportsSmartRetireCoiRefundInput
    && assuranceProfile?.targetRetirementAge != null
    && assuranceProfile?.currentAgeNextBirthday != null
    && supportsSmartRetireLaterDeathBenefit
  const supportsSmartRetireRefundGate = supportsSmartRetireCurrentOrFutureCoiRefund
  const supportsSmartRetirePastDueCoiRefund = supportsSmartRetireCurrentOrFutureCoiRefund
    && assuranceProfile.currentAgeNextBirthday >= assuranceProfile.targetRetirementAge
  const smartRetireCurrentAgeNextBirthday = assuranceProfile?.currentAgeNextBirthday ?? 35
  const smartRetireNeedsBasicSumAssured = supportsSmartRetireLaterDeathBenefit
    && assuranceProfile?.targetRetirementAge != null
    && smartRetireCurrentAgeNextBirthday < assuranceProfile.targetRetirementAge
  const needsAssuranceInputs = assuranceRules.length > 0
    || supportsCurrentAmountOwing
    || supportsCurrentNetProtectedPremiumBase
    || supportsCurrentSumAssuredDeathBenefitInput
    || supportsCurrentBasicSumAssuredDeathBenefitInput
    || supportsCurrentBasicSumAssuredAccidentalDeathBenefitInput
    || supportsCurrentProtectionAge
    || supportsCurrentTpdAccelerationRatioInput
    || supportsCurrentRetainedMultiplierStatus
    || supportsCurrentAcceleratedTiMode
    || supportsCurrentDeathBenefitRateTier
    || supportsCurrentNoLapsePrivilegeMode
    || supportsInitialBasicSumAssuredAtIssueInput
    || supportsCurrentTiClaimStatusInput
    || supportsCurrentTiClaimBenefitAmountInput
    || supportsCurrentResidualDeathBenefitAfterTiClaimInput
    || supportsCurrentTpdClaimStatusInput
    || supportsCurrentTpdClaimBenefitAmountInput
    || supportsCurrentTpdContinuationStatus
    || supportsCurrentTpdSettlement
    || supportsCurrentTpdStage
    || supportsCurrentTpdRemainingBalance
    || supportsCurrentAccidentalDeathModeInput
    || supportsCurrentAgeAccidentalDeathBenefitInput
    || supportsCurrentExcludedClaimBonusValue
    || supportsCurrentAccidentalDisabilityStage
    || supportsCurrentAccidentalDisabilityRemainingBalance
    || supportsInvestPlusSpPastDuePowerUpBonus
    || supportsInvestPlusSpObservedInitialAverageInput
    || supportsInvestPlusSpRepresentativeManagementChargeRateInput
    || supportsInvestStarterPastDuePolicyChargeRefund
    || supportsTiClaimSnapshot
    || supportsRemainingAggregateTiCiCapInput
    || supportsRemainingAggregateTpdCapInput
  const missingAssuranceProfile = assuranceRules.some((rule) => rule.requiresManualInput) && !assuranceProfile
  const missingRegularPremiumBase = assuranceRules.some((rule) => rule.requiresManualInput && requiresCurrentNetRegularPremiumBase(rule))
    && assuranceProfile?.currentNetRegularPremiumBase == null
  const missingWealthAssureValue = assuranceRules.some((rule) => rule.requiresManualInput && requiresWealthAssureValue(rule))
    && assuranceProfile?.currentWealthAssureValue == null
  const missingCurrentSumAssured = assuranceRules.some((rule) => rule.requiresManualInput && requiresCurrentSumAssured(rule))
    && assuranceProfile?.currentSumAssured == null
  const missingCurrentSumAssuredDeathBenefit = supportsCurrentSumAssuredDeathBenefitInput
    && assuranceProfile?.currentSumAssured == null
  const missingCurrentBasicSumAssured = assuranceRules.some((rule) => rule.requiresManualInput && requiresCurrentBasicSumAssured(rule))
    && assuranceProfile?.currentBasicSumAssured == null
  const missingCurrentBasicSumAssuredDeathBenefit = supportsCurrentBasicSumAssuredDeathBenefitInput
    && assuranceProfile?.currentAgeNextBirthday != null
    && assuranceProfile?.currentProtectionAge != null
    && assuranceProfile.currentAgeNextBirthday >= assuranceProfile.currentProtectionAge
    && assuranceProfile?.currentBasicSumAssured == null
  const missingCurrentBasicSumAssuredAccidentalDeathBenefit = supportsCurrentBasicSumAssuredAccidentalDeathBenefitInput
    && assuranceProfile?.currentAgeNextBirthday != null
    && assuranceProfile.currentAgeNextBirthday < 80
    && assuranceProfile?.currentBasicSumAssured == null
  const missingCurrentNetSupplementaryPremiumBase = assuranceRules.some((rule) => rule.requiresManualInput && requiresCurrentNetSupplementaryPremiumBase(rule))
    && assuranceProfile?.currentNetSupplementaryPremiumBase == null
  const missingCurrentNetProtectedPremiumBase = supportsCurrentNetProtectedPremiumBase
    && assuranceProfile?.currentNetProtectedPremiumBase == null
  const missingCurrentAccidentalDeathFloorAmount = supportsCurrentAccidentalDeathFloorAmountInput
    && assuranceProfile?.currentAccidentalDeathFloorAmount == null
  const missingCurrentNetRepaymentBase = assuranceRules.some((rule) => rule.requiresManualInput && requiresCurrentNetRepaymentBase(rule))
    && assuranceProfile?.currentNetRepaymentBase == null
  const missingCurrentLockedInPolicyValue = assuranceRules.some((rule) => rule.requiresManualInput && requiresCurrentLockedInPolicyValue(rule))
    && assuranceProfile?.currentLockedInPolicyValue == null
  const missingCurrentAdjustedSinglePremium = assuranceRules.some((rule) => rule.requiresManualInput && requiresCurrentAdjustedSinglePremium(rule))
    && assuranceProfile?.currentAdjustedSinglePremium == null
  const supportsTokioLifeState = assuranceRules.some((rule) => rule.requiresManualInput && supportsTokioCurrentLifeState(rule))
  const missingCurrentOldestLifeAgeNextBirthday = supportsTokioLifeState
    && tokioLifeAssuredMode === 'multi-life'
    && assuranceProfile?.currentOldestLifeAgeNextBirthday == null
  const missingCurrentOldestLifeSex = supportsTokioLifeState
    && tokioLifeAssuredMode === 'multi-life'
    && assuranceProfile?.currentOldestLifeSex == null
  const missingCurrentYoungestLifeAgeNextBirthday = supportsTokioLifeState
    && tokioLifeAssuredMode === 'multi-life'
    && assuranceProfile?.currentYoungestLifeAgeNextBirthday == null
  const missingTargetRetirementAge = supportsSmartRetireLaterDeathBenefit
    && assuranceProfile?.targetRetirementAge == null
  const missingCurrentAmountOwing = supportsCurrentAmountOwing
    && assuranceProfile?.currentAmountOwing == null
  const missingCurrentProtectionAge = supportsCurrentProtectionAge
    && assuranceProfile?.currentProtectionAge == null
  const missingCurrentTpdAccelerationRatio = supportsCurrentTpdAccelerationRatioInput
    && assuranceProfile?.currentProtectionAge != null
    && assuranceProfile?.currentAgeNextBirthday != null
    && assuranceProfile.currentAgeNextBirthday < assuranceProfile.currentProtectionAge
    && assuranceProfile?.currentTpdAccelerationRatio == null
  const missingCurrentRetainedMultiplierStatus = supportsCurrentRetainedMultiplierStatus
    && assuranceProfile?.currentAgeNextBirthday != null
    && assuranceProfile.currentAgeNextBirthday >= 50
    && assuranceProfile?.currentRetainedMultiplierStatus == null
  const missingCurrentAcceleratedTiMode = supportsCurrentAcceleratedTiMode
    && assuranceProfile?.currentAcceleratedTiPayoutMode == null
  const missingCurrentTpdSettlementMode = supportsCurrentTpdSettlement
    && claimProfile?.currentTpdSettlementMode == null
  const missingCurrentTiClaimStatus = supportsCurrentTiClaimStatusInput
    && claimProfile?.currentTiClaimStatus == null
  const missingCurrentTiClaimBenefitAmount = supportsCurrentTiClaimBenefitAmountInput
    && claimProfile?.currentTiClaimBenefitAmount == null
  const missingCurrentClaimHistoryProtectedDeathCoverBase = supportsCurrentClaimHistoryProtectedDeathCoverBaseInput
    && currentClaimHistory?.remainingProtectedDeathCoverBase == null
  const missingCurrentResidualDeathBenefitAfterTiClaim = supportsCurrentResidualDeathBenefitAfterTiClaimInput
    && claimProfile?.currentResidualDeathBenefitAfterTiClaim == null
  const missingCurrentTpdClaimStatus = supportsCurrentTpdClaimStatusInput
    && claimProfile?.currentTpdClaimStatus == null
  const missingCurrentTpdClaimBenefitAmount = supportsCurrentTpdClaimBenefitAmountInput
    && claimProfile?.currentTpdClaimBenefitAmount == null
  const missingCurrentTpdContinuationStatus = supportsCurrentTpdContinuationStatus
    && claimProfile?.currentTpdContinuationEventStatus == null
  const missingCurrentTpdPayoutStage = supportsCurrentTpdStage
    && claimProfile?.currentTpdPayoutStage == null
  const missingCurrentTpdRemainingBalance = supportsCurrentTpdRemainingBalance
    && currentStagedTpdRemainingBalance == null
  const missingCurrentAccidentalDisabilityPayoutStage = supportsCurrentAccidentalDisabilityStage
    && claimProfile?.currentAccidentalDisabilityPayoutStage == null
  const missingCurrentAccidentalDisabilityRemainingBalance = supportsCurrentAccidentalDisabilityRemainingBalance
    && currentStagedAccidentalDisabilityRemainingBalance == null
  const missingCurrentAccidentalDeathMode = supportsCurrentAccidentalDeathModeInput
    && assuranceProfile?.currentAgeNextBirthday != null
    && assuranceProfile.currentAgeNextBirthday < 70
    && claimProfile?.currentAccidentalDeathMode == null
  const missingCurrentAgeAccidentalDeathBenefit = supportsCurrentAgeAccidentalDeathBenefitInput
    && assuranceProfile?.currentAgeNextBirthday == null
  const missingCurrentExcludedClaimBonusValue = supportsCurrentExcludedClaimBonusValue
    && claimProfile?.currentExcludedClaimBonusValue == null
  const missingCurrentInvestPlusSpPowerUpBonusStatus = supportsInvestPlusSpPastDuePowerUpBonus
    && claimProfile?.currentInvestPlusSpPowerUpBonusStatus == null
  const missingCurrentInvestPlusSpInitialPowerUpBonusAmount = supportsInvestPlusSpPastDuePowerUpBonusAmounts
    && claimProfile?.currentInvestPlusSpInitialPowerUpBonusAmount == null
  const missingCurrentInvestPlusSpTopUpPowerUpBonusAmount = supportsInvestPlusSpPastDuePowerUpBonusAmounts
    && claimProfile?.currentInvestPlusSpTopUpPowerUpBonusAmount == null
  const missingCurrentInvestPlusSpObservedInitialAverage = supportsInvestPlusSpObservedInitialAverageInput
    && claimProfile?.currentInvestPlusSpObservedInitialAccountValueAverage == null
  const missingCurrentInvestStarterPolicyChargeRefundAverageAccountValue = supportsInvestStarterPastDuePolicyChargeRefundAverageAccountValue
    && claimProfile?.currentInvestStarterPolicyChargeRefundAverageAccountValue == null
  const missingCurrentInvestStarterPolicyChargeRefundStatus = supportsInvestStarterPastDuePolicyChargeRefund
    && claimProfile?.currentInvestStarterPolicyChargeRefundStatus == null
  const missingCurrentRefundEligibleDeathCoiCollected = supportsSmartRetireCurrentOrFutureCoiRefund
    && claimProfile?.currentRefundEligibleDeathCoiCollected == null
  const missingCurrentSmartRetireRefundGateStatus = supportsSmartRetireRefundGate
    && smartRetireRefundGateStatus == null
  const missingCurrentWopOnTpdClaimStatus = supportsSmartRetireWopClaimState
    && smartRetireClaimFamily == null
  const missingCurrentSmartRetireClaimAdmissionStatus = supportsSmartRetireClaimAdmissionStatus
    && smartRetireClaimAdmissionStatus == null
  const missingCurrentRemainingWopPremiumWaiverMonths = supportsSmartRetireWopRunway
    && smartRetireRemainingWaiverMonths == null
  const missingCurrentDeathCoiRefundStatus = supportsSmartRetirePastDueCoiRefund
    && claimProfile?.currentDeathCoiRefundStatus == null
  const missingCurrentDeathBenefitRateTier = supportsCurrentDeathBenefitRateTier
    && assuranceProfile?.currentAgeNextBirthday === 66
    && assuranceProfile?.currentDeathBenefitRateTier == null
  const missingInitialBasicSumAssuredAtIssue = supportsInitialBasicSumAssuredAtIssueInput
    && assuranceProfile?.initialBasicSumAssuredAtIssue == null
  const missingCurrentNoLapsePrivilegeMode = supportsCurrentNoLapsePrivilegeMode
    && assuranceProfile?.currentNoLapsePrivilegeMode == null
  const missingSmartRetireBasicSumAssured = smartRetireNeedsBasicSumAssured
    && assuranceProfile?.currentBasicSumAssured == null
  const missingCurrentIndebtedness = supportsAssuranceRuleTiClaimSnapshot
    && claimProfile?.currentIndebtedness == null
  const missingRemainingAggregateTiCap = supportsTiClaimSnapshot
    && claimProfile?.remainingAggregateTiCap == null
  const missingRemainingAggregateTiCiCap = supportsRemainingAggregateTiCiCapInput
    && claimProfile?.remainingAggregateTiCiCap == null
  const missingRemainingAggregateTpdCap = supportsRemainingAggregateTpdCapInput
    && claimProfile?.remainingAggregateTpdCap == null
  const missingInitialSinglePremium = (initialSinglePremiumRules.length > 0 || usesPersistedInitialSinglePremiumBase)
    && policy.currentPolicyYear === 1
    && policy.monthsAlreadyPaid === 0
    && (policy.initialSinglePremium ?? 0) <= 0
  const missingPersistedInitialSinglePremium = usesPersistedInitialSinglePremiumBase
    && (policy.initialSinglePremium ?? 0) <= 0
    && (policy.currentPolicyYear !== 1 || policy.monthsAlreadyPaid !== 0)
  const initialSinglePremiumOutsideInception = initialSinglePremiumRules.length > 0
    && !usesPersistedInitialSinglePremiumBase
    && (policy.initialSinglePremium ?? 0) > 0
    && (policy.currentPolicyYear !== 1 || policy.monthsAlreadyPaid !== 0)
  const assuranceAgeBoundaryWarning = assuranceProfile
    ? assuranceRules
      .map((rule) => {
        const maxAge = rule.assuranceConfig?.maxAgeNextBirthday
        if (maxAge == null) return null

        const currentCoverageAge = supportsTokioCurrentLifeState(rule) && tokioLifeAssuredMode === 'multi-life'
          ? assuranceProfile.currentYoungestLifeAgeNextBirthday ?? assuranceProfile.currentAgeNextBirthday
          : assuranceProfile.currentAgeNextBirthday
        const finalProjectedAge = currentCoverageAge + computeTotalProjectionYears(policy) - 1
        if (currentCoverageAge > maxAge) {
          return `${rule.label} no longer applies from the current projection start because the covered life is already beyond age next birthday ${maxAge}.`
        }
        if (finalProjectedAge > maxAge) {
          return `${rule.label} is only modeled through age next birthday ${maxAge}. Later projection years still need manual review.`
        }
        return null
      })
      .filter((value): value is string => value != null)
    : []
  const manualChargeWarnings = [
    ...(policy.chargeRules ?? [])
    .filter((rule) => (
      rule.basis === 'fixed-annual'
      && rule.requiresManualInput
      && rule.amount === 0
      && (rule.amountSchedule?.length ?? 0) === 0
    ))
    .map((rule) => `${rule.label} is still zero. Enter an annualized estimate before trusting the analysis.`),
    ...(missingAssuranceProfile
      ? ['Assurance-charge modeling still needs life-assured inputs before the charge math can be trusted.']
      : []),
    ...(missingRegularPremiumBase
      ? ['This product also needs the current net regular premium base before the assurance charge can be trusted.']
      : []),
    ...(missingWealthAssureValue
      ? ['This product also needs the current Wealth Assure Value before the assurance charge can be trusted.']
      : []),
    ...(missingCurrentSumAssured
      ? ['This product also needs the current sum assured before the assurance charge can be trusted.']
      : []),
    ...(missingCurrentSumAssuredDeathBenefit
      ? ['This product also needs the current insured amount before the current death-benefit estimate can be trusted.']
      : []),
    ...(missingCurrentBasicSumAssured
      ? ['This product also needs the current basic sum assured before the assurance charge can be trusted.']
      : []),
    ...(missingCurrentBasicSumAssuredDeathBenefit
      ? ['This product also needs the current basic sum assured before the post-Protection-Age current death-benefit estimate can be trusted.']
      : []),
    ...(missingCurrentBasicSumAssuredAccidentalDeathBenefit
      ? ['This product also needs the current basic sum assured before the current accidental-death estimate can be trusted.']
      : []),
    ...(missingCurrentNetSupplementaryPremiumBase
      ? ['This product also needs the current net supplementary / top-up base before the assurance charge can be trusted.']
      : []),
    ...(missingCurrentNetProtectedPremiumBase
      ? ['This product also needs the current net protected premium base before the current death-benefit estimate can be trusted.']
      : []),
    ...(missingCurrentAccidentalDeathFloorAmount
      ? ['This product also needs the current accidental-death floor amount before the current accidental-death estimate can be trusted.']
      : []),
    ...(missingCurrentNetRepaymentBase
      ? ['This product also needs the current net repayment base before the assurance charge can be trusted.']
      : []),
    ...(missingCurrentLockedInPolicyValue
      ? ['This product also needs the current Locked-in Policy Value before the Tokio secure-product Monthly Protection Charge can be trusted.']
      : []),
    ...(missingCurrentAdjustedSinglePremium
      ? ['This product also needs the current Adjusted Single Premium before the Tokio secure-product Monthly Protection Charge can be trusted.']
      : []),
    ...(missingCurrentOldestLifeAgeNextBirthday
      ? ['This Tokio multi-life corridor also needs the current oldest life age next birthday before the Monthly Protection Charge can be trusted.']
      : []),
    ...(missingCurrentOldestLifeSex
      ? ['This Tokio multi-life corridor also needs the current oldest life sex before the Monthly Protection Charge can be trusted.']
      : []),
    ...(missingCurrentYoungestLifeAgeNextBirthday
      ? ['This Tokio multi-life corridor also needs the current youngest life age next birthday before the rider age-gating and death-benefit corridor can be trusted.']
      : []),
    ...(missingTargetRetirementAge
      ? ['This product also needs the target retirement age before the later SmartRetire death-benefit corridor can be trusted.']
      : []),
    ...(missingCurrentAmountOwing
      ? ['This product also needs the current amount owing before the current death-benefit estimate can be trusted.']
      : []),
    ...(missingCurrentProtectionAge
      ? ['This product also needs the current Protection Age before the current death-benefit estimate can be trusted.']
      : []),
    ...(missingCurrentTpdAccelerationRatio
      ? ['This product also needs the current TPD acceleration ratio before the current TPD snapshot can be trusted.']
      : []),
    ...(missingCurrentRetainedMultiplierStatus
      ? ['This product also needs the current retained Multiplier benefit status before the post-age-50 current death-benefit estimate can be trusted.']
      : []),
    ...(missingCurrentAcceleratedTiMode
      ? ['This product also needs the current Accelerated TI payout mode before the TI snapshot can be trusted.']
      : []),
    ...(missingCurrentTpdSettlementMode
      ? ['This product also needs the current TPD settlement mode before the payable-now TPD snapshot can be trusted.']
      : []),
    ...(missingCurrentTiClaimStatus
      ? ['This product also needs the current TI claim status before the admitted-state post-TI snapshot can be trusted.']
      : []),
    ...(missingCurrentTiClaimBenefitAmount
      ? ['This product also needs the current admitted TI claim benefit amount before the admitted-state TI snapshot can be trusted.']
      : []),
    ...(missingCurrentClaimHistoryProtectedDeathCoverBase
      ? ['This product also needs the current remaining protected death-cover base after the admitted TI claim before the admitted-state death snapshot can be trusted.']
      : []),
    ...(missingCurrentResidualDeathBenefitAfterTiClaim
      ? ['This product also needs the current residual death benefit after the admitted TI claim before the admitted-state death snapshot can be trusted.']
      : []),
    ...(missingCurrentTpdClaimStatus
      ? ['This product also needs the current TPD claim status before the admitted-state post-TPD snapshot can be trusted.']
      : []),
    ...(missingCurrentTpdClaimBenefitAmount
      ? ['This product also needs the current admitted TPD claim benefit amount before the admitted-state TPD snapshot can be trusted.']
      : []),
    ...(missingCurrentTpdContinuationStatus
      ? ['This product also needs the current TPD Continuation Event status before the residual death-after-TPD snapshot can be trusted.']
      : []),
    ...(missingCurrentTpdPayoutStage
      ? ['This product also needs the current TPD payout stage before the payable-now TPD snapshot can be trusted.']
      : []),
    ...(missingCurrentTpdRemainingBalance
      ? ['This product also needs the current TPD remaining balance before the later staged TPD snapshot can be trusted.']
      : []),
    ...(missingCurrentAccidentalDisabilityPayoutStage
      ? ['This product also needs the current accidental-disability payout stage before the payable-now accidental-disability snapshot can be trusted.']
      : []),
    ...(missingCurrentAccidentalDeathMode
      ? ['This product also needs the current accidental-claim mode before the current accidental-death estimate can be trusted.']
      : []),
    ...(missingCurrentAgeAccidentalDeathBenefit
      ? ['This product also needs the current age next birthday before the current accidental-death estimate can be trusted.']
      : []),
    ...(missingCurrentExcludedClaimBonusValue
      ? ['This product also needs the current excluded claim bonus value before the first-year current death-benefit estimate can be trusted.']
      : []),
    ...(missingCurrentInvestPlusSpPowerUpBonusStatus
      ? ['This product also needs the current Power-up Bonus status once at least one three-year Invest plus SP bonus cycle has been completed.']
      : []),
    ...(missingCurrentInvestPlusSpInitialPowerUpBonusAmount
      ? ['This product also needs the current due Initial Account Power-up Bonus amount before the Invest plus SP current snapshot can be trusted.']
      : []),
    ...(missingCurrentInvestPlusSpTopUpPowerUpBonusAmount
      ? ['This product also needs the current due Top-up Account Power-up Bonus amount before the Invest plus SP current snapshot can be trusted.']
      : []),
    ...(missingCurrentInvestPlusSpObservedInitialAverage
      ? ['This product also needs the observed monthly Initial Account Value average for the current incomplete three-year Power-up Bonus block before the next projected Invest plus SP initial-account bonus can be trusted.']
      : []),
    ...(missingCurrentInvestStarterPolicyChargeRefundAverageAccountValue
      ? ['This product also needs the current trailing 36-month average account value before the due Invest starter policy-charge refund can be trusted.']
      : []),
    ...(missingCurrentInvestStarterPolicyChargeRefundStatus
      ? ['This product also needs the current policy-charge refund status once at least one three-year refund cycle has already been completed.']
      : []),
    ...(missingCurrentRefundEligibleDeathCoiCollected
      ? ['This product also needs the current refund-eligible death COI collected before the SmartRetire COI refund handling can be trusted.']
      : []),
    ...(missingCurrentSmartRetireRefundGateStatus
      ? ['This product also needs the current SmartRetire refund-gate status before the SmartRetire COI refund handling can be trusted.']
      : []),
    ...(missingCurrentWopOnTpdClaimStatus
      ? ['This product also needs the current SmartRetire claim family before the broader SmartRetire claim-history handling can be trusted.']
      : []),
    ...(missingCurrentSmartRetireClaimAdmissionStatus
      ? ['This product also needs the current SmartRetire claim admission status before the broader SmartRetire claim-history handling can be trusted.']
      : []),
    ...(missingCurrentRemainingWopPremiumWaiverMonths
      ? ['This product also needs the current remaining WOP premium-waiver runway before the SmartRetire WOP handling can be trusted.']
      : []),
    ...(missingCurrentDeathCoiRefundStatus
      ? ['This product also needs the current death-COI refund status once target retirement age has already been reached.']
      : []),
    ...(missingCurrentAccidentalDisabilityRemainingBalance
      ? ['This product also needs the current accidental-disability remaining balance before the later staged accidental-disability snapshot can be trusted.']
      : []),
    ...(missingCurrentDeathBenefitRateTier
      ? ['This product also needs the current ordinary death-benefit tier before the age-66 WealthLink current death-benefit estimate can be trusted.']
      : []),
    ...(missingInitialBasicSumAssuredAtIssue
      ? ['This product also needs the initial basic sum assured at issue before the commencement-band bonus rates can be trusted.']
      : []),
    ...(missingCurrentNoLapsePrivilegeMode
      ? ['This product also needs the current No Lapse Privilege mode before the current death-benefit estimate can be trusted.']
      : []),
    ...(missingSmartRetireBasicSumAssured
      ? ['This product also needs the current basic sum assured before the pre-retirement SmartRetire death-benefit corridor can be trusted.']
      : []),
    ...(missingCurrentIndebtedness
      ? ['This product also needs the current indebtedness / outstanding charges before the TI snapshot can be trusted.']
      : []),
    ...(missingRemainingAggregateTiCap
      ? ['This product also needs the remaining aggregate TI cap before the TI snapshot can be trusted.']
      : []),
    ...(missingRemainingAggregateTiCiCap
      ? ['This product also needs the remaining aggregate TI + CI cap before the TI snapshot can be trusted.']
      : []),
    ...(missingRemainingAggregateTpdCap
      ? ['This product also needs the remaining aggregate TPD cap for the current claim stage before the TPD snapshot can be trusted.']
      : []),
    ...(missingInitialSinglePremium
      ? ['This product uses the gross initial single premium as an inception seed and/or continuing charge base. Enter the one-time gross commencement lump sum before trusting the seeded starting value, establishment charges, or surrender penalties.']
      : []),
    ...(missingPersistedInitialSinglePremium
      ? ['This product still needs the original gross initial single premium because recurring establishment charges and/or surrender penalties are based on that commencement lump sum.']
      : []),
    ...(initialSinglePremiumOutsideInception
      ? ['Initial single premium seeding only applies when Current Policy Year = 1 and Months Already Paid = 0. Clear the field or move the policy back to inception if you want the upfront charge to be applied.']
      : []),
    ...assuranceAgeBoundaryWarning,
  ]
  const eecChartData = policy.eecTable.map((rate, index) => ({ year: index + 1, rate: rate * 100 }))
  const updateChargeRules = (chargeRules: IlpChargeRule[]) => updatePolicy(policy.id, { chargeRules })
  const upsertAssuranceProfile = (patch: Partial<NonNullable<IlpPolicyInput['assuranceProfile']>>) => updatePolicy(policy.id, {
    assuranceProfile: {
      currentAgeNextBirthday: assuranceProfile?.currentAgeNextBirthday ?? 35,
      sex: assuranceProfile?.sex ?? 'male',
      smokerStatus: assuranceProfile?.smokerStatus ?? 'non-smoker',
      lifeAssuredMode: assuranceProfile?.lifeAssuredMode ?? 'single-life',
      currentOldestLifeAgeNextBirthday: assuranceProfile?.currentOldestLifeAgeNextBirthday,
      currentOldestLifeSex: assuranceProfile?.currentOldestLifeSex,
      currentYoungestLifeAgeNextBirthday: assuranceProfile?.currentYoungestLifeAgeNextBirthday,
      currentNetRegularPremiumBase: assuranceProfile?.currentNetRegularPremiumBase,
      currentNetRepaymentBase: assuranceProfile?.currentNetRepaymentBase,
      currentSumAssured: assuranceProfile?.currentSumAssured,
      currentWealthAssureValue: assuranceProfile?.currentWealthAssureValue,
      currentBasicSumAssured: assuranceProfile?.currentBasicSumAssured,
      initialBasicSumAssuredAtIssue: assuranceProfile?.initialBasicSumAssuredAtIssue,
      currentNetSupplementaryPremiumBase: assuranceProfile?.currentNetSupplementaryPremiumBase,
      currentNetProtectedPremiumBase: assuranceProfile?.currentNetProtectedPremiumBase,
      currentAccidentalDeathFloorAmount: assuranceProfile?.currentAccidentalDeathFloorAmount,
      currentLockedInPolicyValue: assuranceProfile?.currentLockedInPolicyValue,
      currentAdjustedSinglePremium: assuranceProfile?.currentAdjustedSinglePremium,
      currentProtectionAge: assuranceProfile?.currentProtectionAge,
      currentTpdAccelerationRatio: assuranceProfile?.currentTpdAccelerationRatio,
      targetRetirementAge: assuranceProfile?.targetRetirementAge,
      currentAmountOwing: assuranceProfile?.currentAmountOwing,
      currentDeathBenefitRateTier: assuranceProfile?.currentDeathBenefitRateTier,
      currentRetainedMultiplierStatus: assuranceProfile?.currentRetainedMultiplierStatus,
      currentAcceleratedTiPayoutMode: assuranceProfile?.currentAcceleratedTiPayoutMode,
      currentNoLapsePrivilegeMode: assuranceProfile?.currentNoLapsePrivilegeMode,
      ...patch,
    },
  })
  const upsertClaimProfile = (patch: Partial<NonNullable<IlpPolicyInput['claimProfile']>>) => updatePolicy(policy.id, {
    claimProfile: {
      currentClaimHistory: claimProfile?.currentClaimHistory,
      currentIndebtedness: claimProfile?.currentIndebtedness,
      remainingAggregateTiCap: claimProfile?.remainingAggregateTiCap,
      remainingAggregateTiCiCap: claimProfile?.remainingAggregateTiCiCap,
      currentTiClaimStatus: claimProfile?.currentTiClaimStatus,
      currentTiClaimBenefitAmount: claimProfile?.currentTiClaimBenefitAmount,
      currentResidualDeathBenefitAfterTiClaim: claimProfile?.currentResidualDeathBenefitAfterTiClaim,
      currentTpdClaimStatus: claimProfile?.currentTpdClaimStatus,
      currentTpdClaimBenefitAmount: claimProfile?.currentTpdClaimBenefitAmount,
      remainingAggregateTpdCap: claimProfile?.remainingAggregateTpdCap,
      currentExcludedClaimBonusValue: claimProfile?.currentExcludedClaimBonusValue,
      currentExcludedValueCohorts: claimProfile?.currentExcludedValueCohorts,
      currentBonusAdjustmentFactors: claimProfile?.currentBonusAdjustmentFactors,
      currentInvestPlusSpPowerUpBonusStatus: claimProfile?.currentInvestPlusSpPowerUpBonusStatus,
      currentInvestPlusSpInitialPowerUpBonusAmount: claimProfile?.currentInvestPlusSpInitialPowerUpBonusAmount,
      currentInvestPlusSpTopUpPowerUpBonusAmount: claimProfile?.currentInvestPlusSpTopUpPowerUpBonusAmount,
      currentInvestPlusSpObservedInitialAccountValueAverage: claimProfile?.currentInvestPlusSpObservedInitialAccountValueAverage,
      currentInvestPlusSpRepresentativeManagementChargeRate: claimProfile?.currentInvestPlusSpRepresentativeManagementChargeRate,
      currentInvestStarterPolicyChargeRefundAverageAccountValue: claimProfile?.currentInvestStarterPolicyChargeRefundAverageAccountValue,
      currentInvestStarterPolicyChargeRefundStatus: claimProfile?.currentInvestStarterPolicyChargeRefundStatus,
      currentRefundEligibleDeathCoiCollected: claimProfile?.currentRefundEligibleDeathCoiCollected,
      currentDeathCoiRefundStatus: claimProfile?.currentDeathCoiRefundStatus,
      currentSmartRetireRefundGateStatus: claimProfile?.currentSmartRetireRefundGateStatus,
      currentSmartRetireDeathClaimStatus: claimProfile?.currentSmartRetireDeathClaimStatus,
      currentAccidentalDeathMode: claimProfile?.currentAccidentalDeathMode,
      currentWopOnTpdClaimStatus: claimProfile?.currentWopOnTpdClaimStatus,
      currentRemainingWopPremiumWaiverMonths: claimProfile?.currentRemainingWopPremiumWaiverMonths,
      currentTpdContinuationEventStatus: claimProfile?.currentTpdContinuationEventStatus,
      currentTpdSettlementMode: claimProfile?.currentTpdSettlementMode,
      currentTpdPayoutStage: claimProfile?.currentTpdPayoutStage,
      currentTpdRemainingBalance: claimProfile?.currentTpdRemainingBalance,
      currentAccidentalDisabilityPayoutStage: claimProfile?.currentAccidentalDisabilityPayoutStage,
      currentAccidentalDisabilityRemainingBalance: claimProfile?.currentAccidentalDisabilityRemainingBalance,
      ...patch,
    },
  })
  const upsertCurrentClaimHistory = (
    patch: Partial<NonNullable<NonNullable<IlpPolicyInput['claimProfile']>['currentClaimHistory']>>,
  ) => upsertClaimProfile({
    currentClaimHistory: {
      family: currentClaimHistory?.family,
      admissionStatus: currentClaimHistory?.admissionStatus,
      remainingWaivedPremiumMonths: currentClaimHistory?.remainingWaivedPremiumMonths,
      remainingProtectedDeathCoverBase: currentClaimHistory?.remainingProtectedDeathCoverBase,
      remainingStagedBenefitBalance: currentClaimHistory?.remainingStagedBenefitBalance,
      refundGateStatus: currentClaimHistory?.refundGateStatus,
      ...patch,
    },
  })
  const updateExcludedValueCohorts = (
    target: { bonusId: string, accountId: string },
    cohorts: Array<{ amount: number, remainingMonths: number | null }>,
  ) => {
    const otherCohorts = (claimProfile?.currentExcludedValueCohorts ?? []).filter((cohort) => !(
      cohort.bonusId === target.bonusId && cohort.accountId === target.accountId
    ))

    upsertClaimProfile({
      currentExcludedValueCohorts: [
        ...otherCohorts,
        ...cohorts.map((cohort) => ({
          bonusId: target.bonusId,
          accountId: target.accountId,
          amount: cohort.amount,
          remainingMonths: cohort.remainingMonths,
        })),
      ],
    })
  }
  const updateGoalBuilderHistoricalExcludedSupplementaryPremiumCohorts = (
    cohorts: Array<{ amount: number, remainingMonths: number | null }>,
  ) => updateExcludedValueCohorts({ bonusId: 'loyalty-bonus', accountId: 'policy' }, cohorts)
  const updateWealthFocusHistoricalExcludedRepaymentCohorts = (
    cohorts: Array<{ amount: number, remainingMonths: number | null }>,
  ) => updateExcludedValueCohorts({ bonusId: 'loyalty-bonus', accountId: 'regular' }, cohorts)
  const updateCurrentBonusAdjustmentFactor = (bonusId: string, factor: number) => {
    const otherFactors = (claimProfile?.currentBonusAdjustmentFactors ?? []).filter((entry) => entry.bonusId !== bonusId)

    upsertClaimProfile({
      currentBonusAdjustmentFactors: [
        ...otherFactors,
        { bonusId, factor },
      ],
    })
  }
  const updatePolicyEvents = (policyEvents: IlpPolicyEvent[]) => updatePolicy(policy.id, { policyEvents })
  const updateEventChargeRules = (eventChargeRules: IlpEventChargeRule[]) => updatePolicy(policy.id, { eventChargeRules })

  return (
    <div className="space-y-4">
      {policy.catalogSource && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Seeded from catalog template</AlertTitle>
          <AlertDescription className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant={policy.catalogSource.supportStatus === 'supported' ? 'default' : 'secondary'}>
                {policy.catalogSource.supportStatus === 'supported' ? 'Supported template' : 'Partial template'}
              </Badge>
              <Badge variant="outline">
                {policy.catalogSource.economicsStatus === 'supported' ? 'Modeled economics' : 'Modeled subset'}
              </Badge>
            </div>
            <p>
              {policy.catalogSource.productName} ({policy.catalogSource.variantLabel}) from catalog version {policy.catalogSource.catalogVersion}.
              Review personal fields before trusting the analysis: monthly contribution, months already paid, current policy year, and current account values.
            </p>
            <p>
              {policy.catalogSource.supportStatus === 'supported'
                ? 'This template is release-gated only for the modeled economics listed in the catalog. Anything outside that boundary still requires document review.'
                : 'This template is only partially modeled. Use the analysis as a subset view and verify all remaining product mechanics against the source documents.'}
            </p>
            {policy.catalogSource.metadataOnlyBehaviors.length > 0 && (
              <p>
                Metadata-only behaviors still outside the calculator: {policy.catalogSource.metadataOnlyBehaviors.map(humanizeCatalogTag).join(', ')}.
              </p>
            )}
            {policy.catalogWarnings && policy.catalogWarnings.length > 0 && (
              <ul className="list-disc pl-5">
                {policy.catalogWarnings.slice(0, 4).map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            )}
            {manualChargeWarnings.length > 0 && (
              <ul className="list-disc pl-5 text-amber-700 dark:text-amber-300">
                {manualChargeWarnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {issues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Policy needs attention before analysis updates</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {issues.slice(0, 6).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Accordion type="multiple" defaultValue={['policy', 'accounts', 'eec', 'funds', 'bonuses', 'charges', 'events', 'settings']} className="rounded-lg border bg-card px-4">
        <AccordionItem value="policy">
          <AccordionTrigger>Policy Details</AccordionTrigger>
          <AccordionContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="ilp-name">Policy Name</Label>
              <Input
                id="ilp-name"
                className="border-blue-300"
                value={policy.name}
                onChange={(event) => updatePolicy(policy.id, { name: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ilp-insurer">Insurer</Label>
              <Input
                id="ilp-insurer"
                className="border-blue-300"
                value={policy.insurer}
                onChange={(event) => updatePolicy(policy.id, { insurer: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select
                value={policy.currency}
                onValueChange={(value) => updatePolicy(policy.id, { currency: value as IlpPolicyInput['currency'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SGD">SGD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CurrencyInput
              label={`Monthly Contribution (${policy.currency})`}
              value={policy.monthlyContribution}
              onChange={(value) => updatePolicy(policy.id, { monthlyContribution: value })}
            />
            <div className="space-y-1">
              <Label>Regular Premium Payment Frequency</Label>
              <Select
                value={policy.regularPremiumPaymentFrequency ?? 'monthly'}
                onValueChange={(value) => updatePolicy(policy.id, {
                  regularPremiumPaymentFrequency: value as NonNullable<IlpPolicyInput['regularPremiumPaymentFrequency']>,
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsInitialSinglePremiumInput && (
              <CurrencyInput
                label={`Initial Single Premium (Gross Lump Sum, ${policy.currency})`}
                value={policy.initialSinglePremium ?? 0}
                onChange={(value) => updatePolicy(policy.id, { initialSinglePremium: value })}
              />
            )}
            <NumberInput
              label="Months Already Paid"
              value={policy.monthsAlreadyPaid}
              onChange={(value) => updatePolicy(policy.id, { monthsAlreadyPaid: value })}
              integer
              min={0}
            />
            {supportsCurrentAcceptedRegularPremiumMonths(policy) && (
              <NumberInput
                label="Current Accepted Regular Premium Months"
                value={policy.currentAcceptedRegularPremiumMonths ?? 0}
                onChange={(value) => updatePolicy(policy.id, { currentAcceptedRegularPremiumMonths: value })}
                integer
                min={0}
                max={policy.monthsAlreadyPaid}
              />
            )}
            <NumberInput
              label="Current Policy Year"
              value={policy.currentPolicyYear}
              onChange={(value) => updatePolicy(policy.id, { currentPolicyYear: value })}
              integer
              min={1}
            />
            {needsAssuranceInputs && (
              <>
                {supportsTokioLifeState && (
                  <div className="space-y-1">
                    <Label>Life Assured Mode</Label>
                    <Select
                      value={tokioLifeAssuredMode}
                      onValueChange={(value) => upsertAssuranceProfile({ lifeAssuredMode: value as 'single-life' | 'multi-life' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single-life">Single Life</SelectItem>
                        <SelectItem value="multi-life">Multiple Lives (Current / Static)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {tokioLifeAssuredMode === 'multi-life' && supportsTokioLifeState ? (
                  <>
                    <NumberInput
                      label="Current Oldest Life Age Next Birthday"
                      value={assuranceProfile?.currentOldestLifeAgeNextBirthday ?? assuranceProfile?.currentAgeNextBirthday ?? 35}
                      onChange={(value) => upsertAssuranceProfile({ currentOldestLifeAgeNextBirthday: value })}
                      integer
                      min={1}
                    />
                    <div className="space-y-1">
                      <Label>Current Oldest Life Sex</Label>
                      <Select
                        value={assuranceProfile?.currentOldestLifeSex ?? assuranceProfile?.sex ?? 'male'}
                        onValueChange={(value) => upsertAssuranceProfile({ currentOldestLifeSex: value as 'male' | 'female' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <NumberInput
                      label="Current Youngest Life Age Next Birthday"
                      value={assuranceProfile?.currentYoungestLifeAgeNextBirthday ?? assuranceProfile?.currentAgeNextBirthday ?? 35}
                      onChange={(value) => upsertAssuranceProfile({ currentYoungestLifeAgeNextBirthday: value })}
                      integer
                      min={1}
                    />
                  </>
                ) : (
                  <>
                    <NumberInput
                      label="Age Next Birthday"
                      value={assuranceProfile?.currentAgeNextBirthday ?? 35}
                      onChange={(value) => upsertAssuranceProfile({ currentAgeNextBirthday: value })}
                      integer
                      min={1}
                    />
                    <div className="space-y-1">
                      <Label>Life Assured Sex</Label>
                      <Select
                        value={assuranceProfile?.sex ?? 'male'}
                        onValueChange={(value) => upsertAssuranceProfile({ sex: value as 'male' | 'female' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label>Smoker Status</Label>
                  <Select
                    value={assuranceProfile?.smokerStatus ?? 'non-smoker'}
                    onValueChange={(value) => upsertAssuranceProfile({ smokerStatus: value as 'smoker' | 'non-smoker' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non-smoker">Non-Smoker</SelectItem>
                      <SelectItem value="smoker">Smoker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {assuranceRules.some(requiresCurrentNetRegularPremiumBase) && (
                  <CurrencyInput
                    label={`Current Net Regular Premium Base (${policy.currency})`}
                    value={assuranceProfile?.currentNetRegularPremiumBase ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentNetRegularPremiumBase: value })}
                  />
                )}
                {assuranceRules.some(requiresCurrentSumAssured) && (
                  <CurrencyInput
                    label={currentSumAssuredLabel(policy)}
                    value={assuranceProfile?.currentSumAssured ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentSumAssured: value })}
                  />
                )}
                {supportsCurrentSumAssuredDeathBenefitInput && (
                  <CurrencyInput
                    label={`Current Insured Amount (${policy.currency})`}
                    value={assuranceProfile?.currentSumAssured ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentSumAssured: value })}
                  />
                )}
                {assuranceRules.some(requiresWealthAssureValue) && (
                  <CurrencyInput
                    label={`Current Wealth Assure Value (${policy.currency})`}
                    value={assuranceProfile?.currentWealthAssureValue ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentWealthAssureValue: value })}
                  />
                )}
                {assuranceRules.some(requiresCurrentBasicSumAssured) && (
                  <CurrencyInput
                    label={`Current Basic Sum Assured (${policy.currency})`}
                    value={assuranceProfile?.currentBasicSumAssured ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentBasicSumAssured: value })}
                  />
                )}
                {supportsSmartRetireLaterDeathBenefit && (
                  <CurrencyInput
                    label={`Current Basic Sum Assured (${policy.currency})`}
                    value={assuranceProfile?.currentBasicSumAssured ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentBasicSumAssured: value })}
                  />
                )}
                {supportsCurrentBasicSumAssuredDeathBenefitInput && (
                  <CurrencyInput
                    label={`Current Basic Sum Assured (${policy.currency})`}
                    value={assuranceProfile?.currentBasicSumAssured ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentBasicSumAssured: value })}
                  />
                )}
                {supportsCurrentBasicSumAssuredAccidentalDeathBenefitInput && (
                  <CurrencyInput
                    label={`Current Basic Sum Assured (${policy.currency})`}
                    value={assuranceProfile?.currentBasicSumAssured ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentBasicSumAssured: value })}
                  />
                )}
                {supportsInitialBasicSumAssuredAtIssueInput && (
                  <CurrencyInput
                    label={`Initial Basic Sum Assured At Issue (${policy.currency})`}
                    value={assuranceProfile?.initialBasicSumAssuredAtIssue ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ initialBasicSumAssuredAtIssue: value })}
                  />
                )}
                {assuranceRules.some(requiresCurrentNetSupplementaryPremiumBase) && (
                  <CurrencyInput
                    label={`Current Net RSP + Top-up Base (${policy.currency})`}
                    value={assuranceProfile?.currentNetSupplementaryPremiumBase ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentNetSupplementaryPremiumBase: value })}
                  />
                )}
                {supportsCurrentNetProtectedPremiumBase && (
                  <CurrencyInput
                    label={`Current Net Protected Premium Base (${policy.currency})`}
                    value={assuranceProfile?.currentNetProtectedPremiumBase ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentNetProtectedPremiumBase: value })}
                  />
                )}
                {supportsCurrentAccidentalDeathFloorAmountInput && (
                  <CurrencyInput
                    label={getCurrentAccidentalDeathFloorAmountLabel(policy)}
                    value={assuranceProfile?.currentAccidentalDeathFloorAmount ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentAccidentalDeathFloorAmount: value })}
                  />
                )}
                {assuranceRules.some(requiresCurrentNetRepaymentBase) && (
                  <CurrencyInput
                    label={`Current Net Repayment Base (${policy.currency})`}
                    value={assuranceProfile?.currentNetRepaymentBase ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentNetRepaymentBase: value })}
                  />
                )}
                {assuranceRules.some(requiresCurrentLockedInPolicyValue) && (
                  <CurrencyInput
                    label={`Current Locked-in Policy Value (${policy.currency})`}
                    value={assuranceProfile?.currentLockedInPolicyValue ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentLockedInPolicyValue: value })}
                  />
                )}
                {assuranceRules.some(requiresCurrentAdjustedSinglePremium) && (
                  <CurrencyInput
                    label={`Current Adjusted Single Premium (${policy.currency})`}
                    value={assuranceProfile?.currentAdjustedSinglePremium ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentAdjustedSinglePremium: value })}
                  />
                )}
                {supportsSmartRetireLaterDeathBenefit && (
                  <NumberInput
                    label="Target Retirement Age"
                    value={assuranceProfile?.targetRetirementAge ?? 65}
                    onChange={(value) => upsertAssuranceProfile({ targetRetirementAge: value })}
                    integer
                    min={1}
                  />
                )}
                {supportsCurrentProtectionAge && (
                  <NumberInput
                    label="Current Protection Age"
                    value={assuranceProfile?.currentProtectionAge ?? 65}
                    onChange={(value) => upsertAssuranceProfile({ currentProtectionAge: value })}
                    integer
                    min={65}
                  />
                )}
                {supportsCurrentTpdAccelerationRatioInput
                  && assuranceProfile?.currentProtectionAge != null
                  && (assuranceProfile?.currentAgeNextBirthday ?? 0) < assuranceProfile.currentProtectionAge && (
                  <NumberInput
                    label="Current TPD Acceleration Ratio"
                    value={assuranceProfile?.currentTpdAccelerationRatio ?? 1}
                    onChange={(value) => upsertAssuranceProfile({ currentTpdAccelerationRatio: value })}
                    min={0}
                    max={1}
                    step={0.01}
                  />
                )}
                {supportsCurrentAmountOwing && (
                  <CurrencyInput
                    label={`Current Amount Owing (${policy.currency})`}
                    value={assuranceProfile?.currentAmountOwing ?? 0}
                    onChange={(value) => upsertAssuranceProfile({ currentAmountOwing: value })}
                  />
                )}
                {supportsCurrentDeathBenefitRateTier && assuranceProfile?.currentAgeNextBirthday === 66 && (
                  <div className="space-y-1">
                    <Label>Current Death Benefit Tier</Label>
                    <Select
                      value={assuranceProfile?.currentDeathBenefitRateTier ?? 'net-premium-105'}
                      onValueChange={(value) => upsertAssuranceProfile({
                        currentDeathBenefitRateTier: value as 'net-premium-105' | 'net-premium-101',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net-premium-105">105% Of Net Premiums Paid</SelectItem>
                        <SelectItem value="net-premium-101">101% Of Net Premiums Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentRetainedMultiplierStatus && (assuranceProfile?.currentAgeNextBirthday ?? 35) >= 50 && (
                  <div className="space-y-1">
                    <Label>Current Multiplier Benefit Status</Label>
                    <Select
                      value={assuranceProfile?.currentRetainedMultiplierStatus ?? 'multiplier-expired'}
                      onValueChange={(value) => upsertAssuranceProfile({
                        currentRetainedMultiplierStatus: value as 'multiplier-expired' | 'multiplier-retained',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiplier-expired">Multiplier Expired</SelectItem>
                        <SelectItem value="multiplier-retained">Multiplier Retained</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentAcceleratedTiMode && (
                  <div className="space-y-1">
                    <Label>Current Accelerated TI Payout Mode</Label>
                    <Select
                      value={assuranceProfile?.currentAcceleratedTiPayoutMode ?? 'same-as-death-benefit'}
                      onValueChange={(value) => upsertAssuranceProfile({
                        currentAcceleratedTiPayoutMode: value as 'same-as-death-benefit' | 'lower-than-death-benefit',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same-as-death-benefit">Same As Death Benefit (Includes Account Value)</SelectItem>
                        <SelectItem value="lower-than-death-benefit">Lower Than Death Benefit (Sum Assured Only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentTpdSettlement && (
                  <div className="space-y-1">
                    <Label>Current TPD Settlement Mode</Label>
                    <Select
                      value={claimProfile?.currentTpdSettlementMode ?? 'same-as-death-benefit'}
                      onValueChange={(value) => upsertClaimProfile({
                        currentTpdSettlementMode: value as 'same-as-death-benefit' | 'lower-than-death-benefit',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same-as-death-benefit">Same As Death Benefit (Also Pays Account Value)</SelectItem>
                        <SelectItem value="lower-than-death-benefit">Lower Than Death Benefit (Sum Assured Only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentTpdContinuationStatus && (
                  <div className="space-y-1">
                    <Label>Current TPD Continuation Event Status</Label>
                    <Select
                      value={claimProfile?.currentTpdContinuationEventStatus ?? 'not-triggered'}
                      onValueChange={(value) => upsertClaimProfile({
                        currentTpdContinuationEventStatus: value as 'triggered' | 'not-triggered',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-triggered">No Continuation Event (Policy Terminates On TPD)</SelectItem>
                        <SelectItem value="triggered">Continuation Event Triggered (Residual Death Cover Is Account Value)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentTpdStage && (
                  <div className="space-y-1">
                    <Label>Current TPD Payout Stage</Label>
                    <Select
                      value={claimProfile?.currentTpdPayoutStage ?? (
                        policy.catalogSource?.productId === 'hsbc-life-flexi-protector'
                          ? 'full-benefit-payable-now'
                          : 'initial-lump-sum-payable-now'
                      )}
                      onValueChange={(value) => upsertClaimProfile({
                        currentTpdPayoutStage: value as 'full-benefit-payable-now' | 'initial-lump-sum-payable-now' | 'balance-lump-sum-payable-now',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {policy.catalogSource?.productId === 'hsbc-life-flexi-protector' && (
                          <SelectItem value="full-benefit-payable-now">Full Benefit Payable Now</SelectItem>
                        )}
                        <SelectItem value="initial-lump-sum-payable-now">Initial Lump Sum Payable Now</SelectItem>
                        <SelectItem value="balance-lump-sum-payable-now">Balance Lump Sum Payable Now</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentTpdRemainingBalance && (
                  <CurrencyInput
                    label={`Current TPD Remaining Balance (${policy.currency})`}
                    value={currentStagedTpdRemainingBalance ?? 0}
                    onChange={(value) => upsertClaimProfile({
                      currentTpdRemainingBalance: value,
                      currentClaimHistory: {
                        family: 'tpd-staged-payout',
                        admissionStatus: currentClaimHistory?.admissionStatus,
                        remainingWaivedPremiumMonths: currentClaimHistory?.remainingWaivedPremiumMonths,
                        remainingProtectedDeathCoverBase: currentClaimHistory?.remainingProtectedDeathCoverBase,
                        remainingStagedBenefitBalance: value,
                        refundGateStatus: currentClaimHistory?.refundGateStatus,
                      },
                    })}
                  />
                )}
                {supportsCurrentAccidentalDisabilityStage && (
                  <div className="space-y-1">
                    <Label>Current Accidental Disability Payout Stage</Label>
                    <Select
                      value={claimProfile?.currentAccidentalDisabilityPayoutStage ?? 'initial-lump-sum-payable-now'}
                      onValueChange={(value) => upsertClaimProfile({
                        currentAccidentalDisabilityPayoutStage: value as 'initial-lump-sum-payable-now' | 'balance-lump-sum-payable-now',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="initial-lump-sum-payable-now">Initial Lump Sum Payable Now</SelectItem>
                        <SelectItem value="balance-lump-sum-payable-now">Balance Lump Sum Payable Now</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentAccidentalDisabilityRemainingBalance && (
                  <CurrencyInput
                    label={`Current Accidental Disability Remaining Balance (${policy.currency})`}
                    value={currentStagedAccidentalDisabilityRemainingBalance ?? 0}
                    onChange={(value) => upsertClaimProfile({
                      currentAccidentalDisabilityRemainingBalance: value,
                      currentClaimHistory: {
                        family: 'accidental-disability-staged-payout',
                        admissionStatus: currentClaimHistory?.admissionStatus,
                        remainingWaivedPremiumMonths: currentClaimHistory?.remainingWaivedPremiumMonths,
                        remainingProtectedDeathCoverBase: currentClaimHistory?.remainingProtectedDeathCoverBase,
                        remainingStagedBenefitBalance: value,
                        refundGateStatus: currentClaimHistory?.refundGateStatus,
                      },
                    })}
                  />
                )}
                {supportsCurrentAccidentalDeathModeInput && (
                  <div className="space-y-1">
                    <Label>Current Accidental Claim Mode</Label>
                    <Select
                      value={claimProfile?.currentAccidentalDeathMode ?? 'standard-accident'}
                      onValueChange={(value) => upsertClaimProfile({
                        currentAccidentalDeathMode: value as 'standard-accident' | 'restricted-activity-accident',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard-accident">Standard Accident (100% Of Sum Assured Uplift)</SelectItem>
                        <SelectItem value="restricted-activity-accident">Restricted Activity Accident (30% Of Sum Assured Uplift)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentExcludedClaimBonusValue && (
                  <CurrencyInput
                    label={`Current Excluded Claim Bonus Value (${policy.currency})`}
                    value={claimProfile?.currentExcludedClaimBonusValue ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentExcludedClaimBonusValue: value })}
                  />
                )}
                {supportsAiaCurrentPowerUpBonusAdjustmentFactor && (
                  <PercentInput
                    label="Current Power-up Bonus Adjustment Factor"
                    value={currentPowerUpBonusAdjustmentFactor}
                    onChange={(value) => updateCurrentBonusAdjustmentFactor('power-up-bonus', value)}
                  />
                )}
                {supportsGoalBuilderHistoricalExcludedSupplementaryPremiumCohorts && (
                  <div className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Current Excluded Supplementary-Premium Cohorts</Label>
                        <p className="text-sm text-muted-foreground">
                          Enter any net Top-up or Recurrent Single Premium amounts from before the current projection start that should
                          still be excluded from Goal Builder II Loyalty Bonus within the remaining 24-month lookback.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateGoalBuilderHistoricalExcludedSupplementaryPremiumCohorts([
                          ...goalBuilderHistoricalExcludedSupplementaryPremiumCohorts.map((cohort) => ({
                            amount: cohort.amount,
                            remainingMonths: cohort.remainingMonths,
                          })),
                          { amount: 0, remainingMonths: 24 },
                        ])}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Cohort
                      </Button>
                    </div>
                    {goalBuilderHistoricalExcludedSupplementaryPremiumCohorts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Leave empty if there are no historical excluded supplementary-premium amounts still inside the lookback window.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {goalBuilderHistoricalExcludedSupplementaryPremiumCohorts.map((cohort, index) => (
                          <div key={`goal-builder-excluded-cohort-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_220px_auto]">
                            <CurrencyInput
                              label={`Excluded Net Supplementary Premium (${policy.currency})`}
                              value={cohort.amount}
                              onChange={(value) => {
                                const nextCohorts = goalBuilderHistoricalExcludedSupplementaryPremiumCohorts.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? { amount: value, remainingMonths: entry.remainingMonths }
                                    : { amount: entry.amount, remainingMonths: entry.remainingMonths }
                                ))
                                updateGoalBuilderHistoricalExcludedSupplementaryPremiumCohorts(nextCohorts)
                              }}
                            />
                            <NumberInput
                              label="Remaining Exclusion Runway (Months)"
                              value={cohort.remainingMonths}
                              onChange={(value) => {
                                const nextCohorts = goalBuilderHistoricalExcludedSupplementaryPremiumCohorts.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? { amount: entry.amount, remainingMonths: value }
                                    : { amount: entry.amount, remainingMonths: entry.remainingMonths }
                                ))
                                updateGoalBuilderHistoricalExcludedSupplementaryPremiumCohorts(nextCohorts)
                              }}
                              integer
                              min={1}
                              max={24}
                            />
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove excluded supplementary premium cohort ${index + 1}`}
                                onClick={() => {
                                  const nextCohorts = goalBuilderHistoricalExcludedSupplementaryPremiumCohorts
                                    .filter((_, entryIndex) => entryIndex !== index)
                                    .map((entry) => ({
                                      amount: entry.amount,
                                      remainingMonths: entry.remainingMonths,
                                    }))
                                  updateGoalBuilderHistoricalExcludedSupplementaryPremiumCohorts(nextCohorts)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {supportsWealthFocusHistoricalExcludedRepaymentCohorts && (
                  <div className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Current Excluded Repaid-Premium Cohorts</Label>
                        <p className="text-sm text-muted-foreground">
                          Enter any repaid missed regular-premium amounts from before the current projection start that should still stay
                          excluded from future Wealth Focus Loyalty Bonus calculations.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateWealthFocusHistoricalExcludedRepaymentCohorts([
                          ...wealthFocusHistoricalExcludedRepaymentCohorts.map((cohort) => ({
                            amount: cohort.amount,
                            remainingMonths: cohort.remainingMonths,
                          })),
                          { amount: 0, remainingMonths: null },
                        ])}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Cohort
                      </Button>
                    </div>
                    {wealthFocusHistoricalExcludedRepaymentCohorts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Leave empty if there are no historical repaid-premium balances that should remain excluded from the Loyalty Bonus base.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {wealthFocusHistoricalExcludedRepaymentCohorts.map((cohort, index) => (
                          <div key={`wealth-focus-excluded-repayment-cohort-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_240px_220px_auto]">
                            <CurrencyInput
                              label={`Excluded Repaid Premium (${policy.currency})`}
                              value={cohort.amount}
                              onChange={(value) => {
                                const nextCohorts = wealthFocusHistoricalExcludedRepaymentCohorts.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? { amount: value, remainingMonths: entry.remainingMonths }
                                    : { amount: entry.amount, remainingMonths: entry.remainingMonths }
                                ))
                                updateWealthFocusHistoricalExcludedRepaymentCohorts(nextCohorts)
                              }}
                            />
                            <div className="space-y-2">
                              <Label>Exclusion Runway</Label>
                              <Select
                                value={cohort.remainingMonths == null ? 'permanent' : 'expiring'}
                                onValueChange={(value) => {
                                  const nextCohorts = wealthFocusHistoricalExcludedRepaymentCohorts.map((entry, entryIndex) => {
                                    if (entryIndex !== index) {
                                      return entry
                                    }

                                    return {
                                      amount: entry.amount,
                                      remainingMonths: value === 'permanent'
                                        ? null
                                        : (entry.remainingMonths ?? 12),
                                    }
                                  })
                                  updateWealthFocusHistoricalExcludedRepaymentCohorts(nextCohorts)
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose runway" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="permanent">Permanent exclusion</SelectItem>
                                  <SelectItem value="expiring">Expires after remaining months</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <NumberInput
                              label="Remaining Exclusion Runway (Months)"
                              value={cohort.remainingMonths ?? 12}
                              onChange={(value) => {
                                const nextCohorts = wealthFocusHistoricalExcludedRepaymentCohorts.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? { amount: entry.amount, remainingMonths: value }
                                    : { amount: entry.amount, remainingMonths: entry.remainingMonths }
                                ))
                                updateWealthFocusHistoricalExcludedRepaymentCohorts(nextCohorts)
                              }}
                              integer
                              min={1}
                              max={120}
                              disabled={cohort.remainingMonths == null}
                            />
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove excluded repaid premium cohort ${index + 1}`}
                                onClick={() => {
                                  const nextCohorts = wealthFocusHistoricalExcludedRepaymentCohorts
                                    .filter((_, entryIndex) => entryIndex !== index)
                                    .map((entry) => ({
                                      amount: entry.amount,
                                      remainingMonths: entry.remainingMonths,
                                    }))
                                  updateWealthFocusHistoricalExcludedRepaymentCohorts(nextCohorts)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {supportsSmartRetireCurrentOrFutureCoiRefund && (
                  <CurrencyInput
                    label={`Current Refund-Eligible Death COI Collected (${policy.currency})`}
                    value={claimProfile?.currentRefundEligibleDeathCoiCollected ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentRefundEligibleDeathCoiCollected: value })}
                  />
                )}
                {supportsInvestPlusSpPastDuePowerUpBonus && (
                  <div className="space-y-1">
                    <Label>Current Power-up Bonus Status</Label>
                    <Select
                      value={claimProfile?.currentInvestPlusSpPowerUpBonusStatus ?? 'due-and-uncredited'}
                      onValueChange={(value) => upsertClaimProfile({
                        currentInvestPlusSpPowerUpBonusStatus: value as 'due-and-uncredited' | 'already-credited-or-not-payable',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="due-and-uncredited">Power-up Bonus Due And Not Yet Credited</SelectItem>
                        <SelectItem value="already-credited-or-not-payable">Already Credited Or Not Yet Payable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsInvestPlusSpPastDuePowerUpBonusAmounts && (
                  <CurrencyInput
                    label={`Current Due Initial-Account Power-up Bonus (${policy.currency})`}
                    value={claimProfile?.currentInvestPlusSpInitialPowerUpBonusAmount ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentInvestPlusSpInitialPowerUpBonusAmount: value })}
                  />
                )}
                {supportsInvestPlusSpPastDuePowerUpBonusAmounts && (
                  <CurrencyInput
                    label={`Current Due Top-up-Account Power-up Bonus (${policy.currency})`}
                    value={claimProfile?.currentInvestPlusSpTopUpPowerUpBonusAmount ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentInvestPlusSpTopUpPowerUpBonusAmount: value })}
                  />
                )}
                {supportsInvestPlusSpObservedInitialAverageInput && (
                  <CurrencyInput
                    label={`Observed Initial-Account Monthly Average In Current 3-Year Power-up Bonus Block (${policy.currency})`}
                    value={claimProfile?.currentInvestPlusSpObservedInitialAccountValueAverage ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentInvestPlusSpObservedInitialAccountValueAverage: value })}
                  />
                )}
                {supportsInvestPlusSpRepresentativeManagementChargeRateInput && (
                  <PercentInput
                    label="Representative Management Charge (Annual Rate For Future New Top-up Power-up Bonus Qualification)"
                    value={claimProfile?.currentInvestPlusSpRepresentativeManagementChargeRate ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentInvestPlusSpRepresentativeManagementChargeRate: value })}
                  />
                )}
                {supportsInvestStarterPastDuePolicyChargeRefund && (
                  <div className="space-y-1">
                    <Label>Current Policy-Charge Refund Status</Label>
                    <Select
                      value={claimProfile?.currentInvestStarterPolicyChargeRefundStatus ?? 'due-and-uncredited'}
                      onValueChange={(value) => upsertClaimProfile({
                        currentInvestStarterPolicyChargeRefundStatus: value as 'due-and-uncredited' | 'already-credited-or-not-payable',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="due-and-uncredited">Refund Due And Not Yet Credited</SelectItem>
                        <SelectItem value="already-credited-or-not-payable">Already Credited Or Not Yet Payable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsInvestStarterPastDuePolicyChargeRefundAverageAccountValue && (
                  <CurrencyInput
                    label={`Current Trailing 36-Month Average Account Value (${policy.currency})`}
                    value={claimProfile?.currentInvestStarterPolicyChargeRefundAverageAccountValue ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentInvestStarterPolicyChargeRefundAverageAccountValue: value })}
                  />
                )}
                {supportsSmartRetireRefundGate && (
                  <div className="space-y-1">
                    <Label>Current SmartRetire Death-COI Refund Gate</Label>
                    <Select
                      value={smartRetireRefundGateStatus ?? 'intact'}
                      onValueChange={(value) => upsertCurrentClaimHistory({
                        refundGateStatus: value as 'intact' | 'broken',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="intact">Refund Gate Still Intact</SelectItem>
                        <SelectItem value="broken">Refund Gate Already Broken By Earlier Death Or WOP Claim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsSmartRetireWopClaimState && (
                  <div className="space-y-1">
                    <Label>Current SmartRetire Claim Family</Label>
                    <Select
                      value={smartRetireClaimFamily ?? 'none'}
                      onValueChange={(value) => upsertCurrentClaimHistory({
                        family: value as 'none' | 'tpd-waiver',
                        admissionStatus: value === 'tpd-waiver'
                          ? currentClaimHistory?.admissionStatus
                          : undefined,
                        remainingWaivedPremiumMonths: value === 'tpd-waiver'
                          ? currentClaimHistory?.remainingWaivedPremiumMonths
                          : undefined,
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Broader SmartRetire Claim Before Target Retirement Age</SelectItem>
                        <SelectItem value="tpd-waiver">WOP-on-TPD Claim Family</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsSmartRetireClaimAdmissionStatus && (
                  <div className="space-y-1">
                    <Label>Current SmartRetire Claim Admission Status</Label>
                    <Select
                      value={smartRetireClaimAdmissionStatus ?? 'not-admitted'}
                      onValueChange={(value) => upsertCurrentClaimHistory({
                        admissionStatus: value as 'not-admitted' | 'admitted' | 'admitted-and-settled',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-admitted">No Admitted WOP-on-TPD Claim Before Target Retirement Age</SelectItem>
                        <SelectItem value="admitted">WOP-on-TPD Claim Admitted And Still Active</SelectItem>
                        <SelectItem value="admitted-and-settled">WOP-on-TPD Claim Already Admitted And Settled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsSmartRetireWopRunway && (
                  <NumberInput
                    label="Current Remaining WOP Premium-Waiver Runway (Months)"
                    value={smartRetireRemainingWaiverMonths ?? 0}
                    onChange={(value) => upsertCurrentClaimHistory({ remainingWaivedPremiumMonths: value })}
                    integer
                    min={0}
                  />
                )}
                {supportsSmartRetirePastDueCoiRefund && (
                  <div className="space-y-1">
                    <Label>Current Death-COI Refund Status</Label>
                    <Select
                      value={claimProfile?.currentDeathCoiRefundStatus ?? 'due-and-uncredited'}
                      onValueChange={(value) => upsertClaimProfile({
                        currentDeathCoiRefundStatus: value as 'due-and-uncredited' | 'already-credited-or-not-payable',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="due-and-uncredited">Refund Due And Not Yet Credited</SelectItem>
                        <SelectItem value="already-credited-or-not-payable">Already Credited Or No Longer Payable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentNoLapsePrivilegeMode && (
                  <div className="space-y-1">
                    <Label>Current No Lapse Privilege Mode</Label>
                    <Select
                      value={assuranceProfile?.currentNoLapsePrivilegeMode ?? 'not-in-effect'}
                      onValueChange={(value) => upsertAssuranceProfile({
                        currentNoLapsePrivilegeMode: value as 'not-in-effect' | 'expiry-age-85' | 'expiry-age-100',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-in-effect">Not In Effect</SelectItem>
                        <SelectItem value="expiry-age-85">In Force To Age 85</SelectItem>
                        <SelectItem value="expiry-age-100">In Force To Age 100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentTiClaimIndebtedness && (
                  <CurrencyInput
                    label={supportsAssuranceRuleTiClaimSnapshot
                      ? `Current Indebtedness / Outstanding Charges (${policy.currency})`
                      : `Current Claim-Time Amount Owing / Outstanding Charges (${policy.currency})`}
                    value={claimProfile?.currentIndebtedness ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentIndebtedness: value })}
                  />
                )}
                {supportsCurrentTiClaimStatusInput && (
                  <div className="space-y-1">
                    <Label>Current TI Claim Status</Label>
                    <Select
                      value={claimProfile?.currentTiClaimStatus === 'triggered'
                        ? 'admitted'
                        : (claimProfile?.currentTiClaimStatus ?? 'not-triggered')}
                      onValueChange={(value) => upsertClaimProfile({
                        currentTiClaimStatus: value as 'not-triggered' | 'admitted' | 'admitted-and-settled',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-triggered">No Admitted TI Claim</SelectItem>
                        <SelectItem value="admitted">Admitted TI Claim (Post-Claim State Active)</SelectItem>
                        <SelectItem value="admitted-and-settled">Admitted TI Claim Already Settled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentTiClaimBenefitAmountInput && (
                  <CurrencyInput
                    label={`Current Admitted TI Claim Benefit Amount (${policy.currency})`}
                    value={claimProfile?.currentTiClaimBenefitAmount ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentTiClaimBenefitAmount: value })}
                  />
                )}
                {supportsCurrentClaimHistoryProtectedDeathCoverBaseInput && (
                  <CurrencyInput
                    label={`Current Remaining Protected Death-Cover Base After TI Claim (${policy.currency})`}
                    value={currentClaimHistory?.remainingProtectedDeathCoverBase ?? 0}
                    onChange={(value) => upsertCurrentClaimHistory({
                      family: 'ti-advancement',
                      admissionStatus: currentClaimHistory?.admissionStatus,
                      remainingProtectedDeathCoverBase: value,
                    })}
                  />
                )}
                {supportsCurrentResidualDeathBenefitAfterTiClaimInput && (
                  <CurrencyInput
                    label={`Current Residual Death Benefit After TI Claim (${policy.currency})`}
                    value={claimProfile?.currentResidualDeathBenefitAfterTiClaim ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentResidualDeathBenefitAfterTiClaim: value })}
                  />
                )}
                {supportsCurrentTpdClaimStatusInput && (
                  <div className="space-y-1">
                    <Label>Current TPD Claim Status</Label>
                    <Select
                      value={claimProfile?.currentTpdClaimStatus === 'triggered'
                        ? 'admitted'
                        : (claimProfile?.currentTpdClaimStatus ?? 'not-triggered')}
                      onValueChange={(value) => upsertClaimProfile({
                        currentTpdClaimStatus: value as 'not-triggered' | 'admitted' | 'admitted-and-settled',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-triggered">No Admitted TPD Claim</SelectItem>
                        <SelectItem value="admitted">Admitted TPD Claim (Current Benefits Use The Post-TPD Surface)</SelectItem>
                        <SelectItem value="admitted-and-settled">Admitted TPD Claim Already Settled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supportsCurrentTpdClaimBenefitAmountInput && (
                  <CurrencyInput
                    label={`Current Admitted TPD Claim Benefit Amount (${policy.currency})`}
                    value={claimProfile?.currentTpdClaimBenefitAmount ?? 0}
                    onChange={(value) => upsertClaimProfile({ currentTpdClaimBenefitAmount: value })}
                  />
                )}
                {supportsTiClaimSnapshot && (
                  <CurrencyInput
                    label={`Remaining Aggregate TI Cap (${policy.currency})`}
                    value={claimProfile?.remainingAggregateTiCap ?? 0}
                    onChange={(value) => upsertClaimProfile({ remainingAggregateTiCap: value })}
                  />
                )}
                {supportsRemainingAggregateTiCiCapInput && (
                  <CurrencyInput
                    label={`Remaining Aggregate TI + CI Cap (${policy.currency})`}
                    value={claimProfile?.remainingAggregateTiCiCap ?? 0}
                    onChange={(value) => upsertClaimProfile({ remainingAggregateTiCiCap: value })}
                  />
                )}
                {supportsRemainingAggregateTpdCapInput && (
                  <CurrencyInput
                    label={supportsCurrentTpdStage
                      ? `Remaining Aggregate TPD Cap (Current Claim Stage, ${policy.currency})`
                      : `Remaining Aggregate TPD Cap (${policy.currency})`}
                    value={claimProfile?.remainingAggregateTpdCap ?? 0}
                    onChange={(value) => upsertClaimProfile({ remainingAggregateTpdCap: value })}
                  />
                )}
              </>
            )}
            <NumberInput
              label={policy.mipBasis === 'open-ended' ? 'Review Horizon (Years)' : 'Post-MIP Years'}
              value={policy.postMipYears}
              onChange={(value) => updatePolicy(policy.id, { postMipYears: value })}
              integer
              min={policy.mipBasis === 'open-ended' ? 1 : 0}
            />
            {policy.mipBasis !== 'open-ended' && (
              <NumberInput
                label="MIP Length"
                value={policy.mipLength ?? 1}
                onChange={(value) => updatePolicy(policy.id, { mipLength: value })}
                integer
                min={1}
              />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="accounts">
          <AccordionTrigger>Accounts</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span>
                Contribution share total: <span className={cn('font-semibold', contributionShareValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                  {formatIlpPercent(contributionShareTotal)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Expected {formatIlpPercent(contributionShareTarget)}
              </span>
            </div>

            {policy.accounts.map((account, index) => (
              <Card key={account.id}>
                <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Account ID</Label>
                    <Input
                      className="border-blue-300"
                      value={account.id}
                      onChange={(event) => setAccount(policy.id, index, { ...account, id: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Label</Label>
                    <Input
                      className="border-blue-300"
                      value={account.label}
                      onChange={(event) => setAccount(policy.id, index, { ...account, label: event.target.value })}
                    />
                  </div>
                  <PercentInput
                    label="Fee Rate"
                    value={account.feeRate}
                    onChange={(value) => setAccount(policy.id, index, { ...account, feeRate: value })}
                  />
                  <CurrencyInput
                    label={`Current Value (${policy.currency})`}
                    value={account.currentValue}
                    onChange={(value) => setAccount(policy.id, index, { ...account, currentValue: value })}
                  />
                  <PercentInput
                    label="Contribution Share"
                    value={account.contributionShare}
                    onChange={(value) => setAccount(policy.id, index, { ...account, contributionShare: value })}
                  />
                  <div className="space-y-2">
                    <Label className="text-sm">Subject to EEC</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={account.subjectToEec}
                        onChange={(event) => setAccount(policy.id, index, { ...account, subjectToEec: event.target.checked })}
                      />
                      Apply EEC to this account on surrender
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Post-MIP Fee Override</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={account.postMipFeeRate != null}
                        onChange={(event) => setAccount(policy.id, index, {
                          ...account,
                          postMipFeeRate: event.target.checked ? account.feeRate : null,
                        })}
                      />
                      Override fee after MIP ends
                    </label>
                  </div>
                  {account.postMipFeeRate != null && (
                    <PercentInput
                      label="Post-MIP Fee Rate"
                      value={account.postMipFeeRate}
                      onChange={(value) => setAccount(policy.id, index, { ...account, postMipFeeRate: value })}
                    />
                  )}
                  <div className="flex items-end justify-end">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      onClick={() => removeAccount(policy.id, index)}
                      disabled={policy.accounts.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={() => addAccount(policy.id)}>
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="eec">
          <AccordionTrigger>EEC Table</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {isCatalogSeeded ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{policy.eecTable.length}-year early exit charge schedule from catalog template.</span>
                </div>
                <div className="h-44 rounded-md border p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={eecChartData}>
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value: number) => `${value.toFixed(0)}%`} />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Line type="monotone" dataKey="rate" stroke="hsl(var(--chart-danger))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCatalogEec(!showCatalogEec)}
                >
                  {showCatalogEec ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {showCatalogEec ? 'Hide rates' : 'Show rates (read-only)'}
                </button>
                {showCatalogEec && (
                  <div className="overflow-auto rounded-md border opacity-75">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Policy Year</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">EEC Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policy.eecTable.map((rate, index) => (
                          <tr key={index} className="border-b last:border-0">
                            <td className="px-3 py-2">{index + 1}</td>
                            <td className="px-3 py-2">{formatIlpPercent(rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
            <>
            <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
              <div className="space-y-2">
                <Label>Load Preset</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    const preset = EEC_PRESETS[value as keyof typeof EEC_PRESETS]
                    if (!preset) return
                    updatePolicy(policy.id, {
                      eecTable: [...preset],
                      mipLength: preset.length,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a common schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(EEC_PRESETS).map((presetName) => (
                      <SelectItem key={presetName} value={presetName}>{presetName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Presets are just a starting point. Edit each year to match your policy document.
                </p>
              </div>

              <div className="h-44 rounded-md border p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={eecChartData}>
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value: number) => `${value.toFixed(0)}%`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--chart-danger))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Policy Year</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">EEC Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {policy.eecTable.map((rate, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">
                        <PercentInput
                          value={rate}
                          onChange={(value) => {
                            const eecTable = [...policy.eecTable]
                            eecTable[index] = value
                            updatePolicy(policy.id, { eecTable })
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="funds">
          <AccordionTrigger>Fund Allocations</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span className={cn('font-medium', fundAllocationValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                  Allocation total: {formatIlpPercent(fundAllocationTotal)}
                </span>
                <span className="text-muted-foreground">Low: {formatIlpPercent(computeBlendedReturn(policy.funds, 'low'))}</span>
                <span className="text-muted-foreground">Mid: {formatIlpPercent(computeBlendedReturn(policy.funds, 'mid'))}</span>
                <span className="text-muted-foreground">High: {formatIlpPercent(computeBlendedReturn(policy.funds, 'high'))}</span>
              </div>
            </div>

            {policy.funds.map((fund, index) => (
              <Card key={`${fund.name}-${index}`}>
                <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Fund Name</Label>
                    <Input
                      className="border-blue-300"
                      value={fund.name}
                      onChange={(event) => setFund(policy.id, index, { ...fund, name: event.target.value })}
                    />
                  </div>
                  <PercentInput
                    label="Allocation"
                    value={fund.allocation}
                    onChange={(value) => setFund(policy.id, index, { ...fund, allocation: value })}
                  />
                  <PercentInput
                    label="OCF"
                    value={fund.ocf}
                    onChange={(value) => setFund(policy.id, index, { ...fund, ocf: value })}
                  />
                  <PercentInput
                    label="Gross Return Low"
                    value={fund.grossReturnLow}
                    onChange={(value) => setFund(policy.id, index, { ...fund, grossReturnLow: value })}
                  />
                  <PercentInput
                    label="Gross Return Mid"
                    value={fund.grossReturnMid}
                    onChange={(value) => setFund(policy.id, index, { ...fund, grossReturnMid: value })}
                  />
                  <PercentInput
                    label="Gross Return High"
                    value={fund.grossReturnHigh}
                    onChange={(value) => setFund(policy.id, index, { ...fund, grossReturnHigh: value })}
                  />
                  <div className="flex items-end justify-end">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      onClick={() => removeFund(policy.id, index)}
                      disabled={policy.funds.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove Fund
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={() => addFund(policy.id)}>
              <Plus className="h-4 w-4" />
              Add Fund
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="bonuses">
          <AccordionTrigger>Bonus Rules</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {isCatalogSeeded ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{policy.bonuses.length} bonus {policy.bonuses.length === 1 ? 'rule' : 'rules'} from catalog template. These reflect the product's published bonus schedule.</span>
                </div>
                {policy.bonuses.length > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCatalogBonuses(!showCatalogBonuses)}
                  >
                    {showCatalogBonuses ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {showCatalogBonuses ? 'Hide details' : 'Show details (read-only)'}
                  </button>
                )}
                {showCatalogBonuses && policy.bonuses.map((bonus, index) => (
                  <Card key={`${bonus.label}-${index}`} className="opacity-75">
                    <CardContent className="py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-medium">{bonus.label}</span>
                        <Badge variant="outline">{bonus.type}</Badge>
                        <Badge variant="secondary">{bonus.mode}</Badge>
                        {bonus.rate > 0 && <span>{formatIlpPercent(bonus.rate)}</span>}
                        <span>PY {bonus.startPolicyYear}{bonus.endPolicyYear != null ? `–${bonus.endPolicyYear}` : '+'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
            <>
            <p className="text-sm text-muted-foreground">
              `premium-allocation` and `one-time` bonuses are split evenly across targeted accounts so the bonus dollars are not accidentally duplicated.
            </p>

            {policy.bonuses.map((bonus, index) => (
              <Card key={`${bonus.label}-${index}`}>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Label</Label>
                      <Input
                        className="border-blue-300"
                        value={bonus.label}
                        onChange={(event) => setBonus(policy.id, index, { ...bonus, label: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select
                        value={bonus.type}
                        onValueChange={(value) => setBonus(policy.id, index, { ...bonus, type: value as typeof bonus.type })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="power-up">Power-up</SelectItem>
                          <SelectItem value="loyalty">Loyalty</SelectItem>
                          <SelectItem value="allocation">Allocation</SelectItem>
                          <SelectItem value="sign-up">Sign-up</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Mode</Label>
                      <Select
                        value={bonus.mode}
                        onValueChange={(value) => setBonus(policy.id, index, { ...bonus, mode: value as typeof bonus.mode })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual-rate">Annual Rate</SelectItem>
                          <SelectItem value="premium-allocation">Premium Allocation</SelectItem>
                          <SelectItem value="one-time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {bonus.mode !== 'one-time' ? (
                      <PercentInput
                        label="Rate"
                        value={bonus.rate}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, rate: value })}
                      />
                    ) : (
                      <CurrencyInput
                        label={`Amount (${policy.currency})`}
                        value={bonus.amount}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, amount: value })}
                      />
                    )}
                    {bonus.mode === 'one-time' && (
                      <PercentInput
                        label="Rate (unused)"
                        value={bonus.rate}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, rate: value })}
                      />
                    )}
                    {bonus.mode !== 'one-time' && (
                      <CurrencyInput
                        label={`Amount (${policy.currency}, optional)`}
                        value={bonus.amount}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, amount: value })}
                      />
                    )}
                    <NumberInput
                      label="Start Policy Year"
                      value={bonus.startPolicyYear}
                      onChange={(value) => setBonus(policy.id, index, { ...bonus, startPolicyYear: value })}
                      integer
                      min={1}
                    />
                    <div className="space-y-2">
                      <Label className="text-sm">Open-ended</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={bonus.endPolicyYear == null}
                          onChange={(event) => setBonus(policy.id, index, {
                            ...bonus,
                            endPolicyYear: event.target.checked ? null : bonus.startPolicyYear,
                          })}
                        />
                        No end year
                      </label>
                    </div>
                    {bonus.endPolicyYear != null && (
                      <NumberInput
                        label="End Policy Year"
                        value={bonus.endPolicyYear}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, endPolicyYear: value })}
                        integer
                        min={bonus.startPolicyYear}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Applies To Accounts</Label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={bonus.appliesTo.length === 0}
                          onChange={(event) => setBonus(policy.id, index, {
                            ...bonus,
                            appliesTo: event.target.checked ? [] : bonus.appliesTo,
                          })}
                        />
                        All accounts
                      </label>
                      {policy.accounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={bonus.appliesTo.length === 0}
                            checked={bonus.appliesTo.includes(account.id)}
                            onChange={(event) => setBonus(policy.id, index, {
                              ...bonus,
                              appliesTo: event.target.checked
                                ? [...bonus.appliesTo, account.id]
                                : bonus.appliesTo.filter((accountId) => accountId !== account.id),
                            })}
                          />
                          {account.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" className="text-destructive" onClick={() => removeBonus(policy.id, index)}>
                      <Trash2 className="h-4 w-4" />
                      Remove Bonus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={() => addBonus(policy.id)}>
              <Plus className="h-4 w-4" />
              Add Bonus
            </Button>
            </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="charges">
          <AccordionTrigger>Charge Rules</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {isCatalogSeeded ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{policy.chargeRules?.length ?? 0} recurring charge {(policy.chargeRules?.length ?? 0) === 1 ? 'rule' : 'rules'} from catalog template. These reflect the product's published fee schedule.</span>
                </div>
                {(policy.chargeRules?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCatalogChargeRules(!showCatalogChargeRules)}
                  >
                    {showCatalogChargeRules ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {showCatalogChargeRules ? 'Hide details' : 'Show details (read-only)'}
                  </button>
                )}
                {showCatalogChargeRules && (policy.chargeRules ?? []).map((rule) => (
                  <Card key={rule.id} className="opacity-75">
                    <CardContent className="py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-medium">{rule.label}</span>
                        <Badge variant="outline">{rule.basis ?? 'account-value'}</Badge>
                        <Badge variant="secondary">{rule.activeWindow}</Badge>
                        {rule.rate > 0 && <span>{formatIlpPercent(rule.rate)}/yr</span>}
                        {(rule.amount ?? 0) > 0 && <span>${rule.amount}/yr</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
            <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Recurring Charge Rules</h3>
                <p className="text-sm text-muted-foreground">
                  Use this for modeled annual charges that are not captured by the base account fee rates, including fixed annual assurance-charge placeholders and fallback deduction accounts.
                </p>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => updateChargeRules([
                  ...(policy.chargeRules ?? []),
                  {
                    id: createDraftId('charge'),
                    label: `Charge Rule ${(policy.chargeRules?.length ?? 0) + 1}`,
                    basis: 'fixed-annual',
                    activeWindow: 'policy-term',
                    appliesTo: policy.accounts[0] ? [policy.accounts[0].id] : [],
                    fallbackAppliesTo: [],
                    rateSchedule: undefined,
                    amountSchedule: [],
                    rate: 0,
                    amount: 0,
                    premiumBaseConfig: undefined,
                    allocation: 'equal-split',
                  },
                ])}
              >
                <Plus className="h-4 w-4" />
                Add Charge Rule
              </Button>
            </div>

            {(policy.chargeRules ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  No recurring charge rules configured.
                </CardContent>
              </Card>
            ) : (policy.chargeRules ?? []).map((rule, index) => (
              <Card key={rule.id}>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Label</Label>
                      <Input
                        className="border-blue-300"
                        value={rule.label}
                        onChange={(event) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, label: event.target.value }
                          updateChargeRules(nextRules)
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Basis</Label>
                      <Select
                        value={rule.basis}
                        onValueChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = {
                            ...rule,
                            basis: value as IlpChargeRule['basis'],
                            assuranceConfig: value === 'assurance-sum-at-risk'
                              ? (rule.assuranceConfig ?? {
                                  formula: 'prudential-prosper-death',
                                  monthlyModalFactor: 0.0834,
                                })
                              : undefined,
                            premiumBaseConfig: value === 'premium-base-mip-multiplier'
                              ? (rule.premiumBaseConfig ?? {
                                  useHigherOfCommencementAndPrevailing: true,
                                  multiplierSchedule: [
                                    {
                                      startPolicyYear: 1,
                                      endPolicyYear: null,
                                      mode: 'policy-year',
                                    },
                                  ],
                                })
                              : undefined,
                            allocation: value === 'initial-single-premium' ? 'pro-rata-by-value' : rule.allocation,
                            rateSchedule: value === 'account-value' || value === 'annual-contribution' || value === 'initial-single-premium-base'
                              ? (rule.rateSchedule ?? [])
                              : undefined,
                            amountSchedule: value === 'fixed-annual' ? (rule.amountSchedule ?? []) : undefined,
                          }
                          updateChargeRules(nextRules)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed-annual">Fixed Annual</SelectItem>
                          <SelectItem value="account-value">Account Value</SelectItem>
                          <SelectItem value="annual-contribution">Annual Contribution</SelectItem>
                          <SelectItem value="initial-single-premium">Initial Single Premium</SelectItem>
                          <SelectItem value="initial-single-premium-base">Initial Single Premium Base</SelectItem>
                          <SelectItem value="assurance-sum-at-risk">Assurance Sum-at-Risk</SelectItem>
                          <SelectItem value="premium-base-mip-multiplier">Premium-Base AMF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Active Window</Label>
                      <Select
                        value={rule.activeWindow}
                        onValueChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, activeWindow: value as IlpChargeRule['activeWindow'] }
                          updateChargeRules(nextRules)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="during-mip">During MIP</SelectItem>
                          <SelectItem value="after-mip">After MIP</SelectItem>
                          <SelectItem value="policy-term">Policy Term</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Allocation</Label>
                      <Select
                        value={rule.allocation}
                        onValueChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, allocation: value as IlpChargeRule['allocation'] }
                          updateChargeRules(nextRules)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equal-split">Equal Split</SelectItem>
                          <SelectItem value="pro-rata-by-value">Pro-rata by Value</SelectItem>
                          <SelectItem value="pro-rata-by-contribution-share">Pro-rata by Contribution Share</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {rule.basis === 'fixed-annual' ? (
                      <CurrencyInput
                        label={`Base Amount (${policy.currency})`}
                        value={rule.amount}
                        onChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, amount: value }
                          updateChargeRules(nextRules)
                        }}
                      />
                    ) : rule.basis === 'assurance-sum-at-risk' ? (
                      <>
                        <div className="space-y-1">
                          <Label>Assurance Formula</Label>
                          <Select
                            value={rule.assuranceConfig?.formula ?? 'prudential-prosper-death'}
                            onValueChange={(value) => {
                              const nextRules = [...(policy.chargeRules ?? [])]
                              nextRules[index] = {
                                ...rule,
                                assuranceConfig: {
                                  formula: value as NonNullable<IlpChargeRule['assuranceConfig']>['formula'],
                                  monthlyModalFactor: rule.assuranceConfig?.monthlyModalFactor ?? 0.0834,
                                },
                              }
                              updateChargeRules(nextRules)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prudential-prosper-death">Prudential Prosper Death</SelectItem>
                              <SelectItem value="prudential-prosper-accidental-death">Prudential Prosper Accidental Death</SelectItem>
                              <SelectItem value="prudential-assure-ii-combined">Prudential Assure II Combined</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <NumberInput
                          label="Monthly Modal Factor"
                          value={rule.assuranceConfig?.monthlyModalFactor ?? 0.0834}
                          onChange={(value) => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              assuranceConfig: {
                                formula: rule.assuranceConfig?.formula ?? 'prudential-prosper-death',
                                monthlyModalFactor: value,
                              },
                            }
                            updateChargeRules(nextRules)
                          }}
                          min={0}
                        />
                      </>
                    ) : (
                      <PercentInput
                        label="Rate"
                        value={rule.rate}
                        onChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, rate: value }
                          updateChargeRules(nextRules)
                        }}
                      />
                    )}

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Start Year Gate</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={rule.startPolicyYear != null}
                          onChange={(event) => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              startPolicyYear: event.target.checked ? (rule.startPolicyYear ?? 1) : undefined,
                            }
                            updateChargeRules(nextRules)
                          }}
                        />
                        Only start charging from a specific policy year
                      </label>
                    </div>

                    {rule.startPolicyYear != null && (
                      <NumberInput
                        label="Start Policy Year"
                        value={rule.startPolicyYear}
                        onChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, startPolicyYear: value }
                          updateChargeRules(nextRules)
                        }}
                        integer
                        min={1}
                      />
                    )}

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Open-ended</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={rule.endPolicyYear == null}
                          onChange={(event) => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              endPolicyYear: event.target.checked ? null : (rule.startPolicyYear ?? 1),
                            }
                            updateChargeRules(nextRules)
                          }}
                        />
                        No end year
                      </label>
                    </div>

                    {rule.endPolicyYear != null && (
                      <NumberInput
                        label="End Policy Year"
                        value={rule.endPolicyYear}
                        onChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, endPolicyYear: value }
                          updateChargeRules(nextRules)
                        }}
                        integer
                        min={rule.startPolicyYear ?? 1}
                      />
                    )}
                  </div>

                  {(rule.basis === 'account-value' || rule.basis === 'annual-contribution') && (
                    <div className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Rate Schedule</h4>
                          <p className="text-sm text-muted-foreground">
                            Override the base rate by policy-year range for dynamic or non-guaranteed charges.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              rateSchedule: [
                                ...(rule.rateSchedule ?? []),
                                {
                                  startPolicyYear: rule.startPolicyYear ?? 1,
                                  endPolicyYear: null,
                                  rate: rule.rate,
                                },
                              ],
                            }
                            updateChargeRules(nextRules)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Add Rate Tier
                        </Button>
                      </div>

                      {(rule.rateSchedule?.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No rate tiers configured. The base rate above applies for the whole active window.
                        </p>
                      ) : rule.rateSchedule?.map((tier, tierIndex) => (
                        <Card key={`${rule.id}-rate-tier-${tierIndex}`}>
                          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                            <NumberInput
                              label="Start Policy Year"
                              value={tier.startPolicyYear}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextSchedule = [...(rule.rateSchedule ?? [])]
                                nextSchedule[tierIndex] = { ...tier, startPolicyYear: value }
                                nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                updateChargeRules(nextRules)
                              }}
                              integer
                              min={1}
                            />
                            <NumberInput
                              label="End Policy Year"
                              value={tier.endPolicyYear ?? tier.startPolicyYear}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextSchedule = [...(rule.rateSchedule ?? [])]
                                nextSchedule[tierIndex] = { ...tier, endPolicyYear: value }
                                nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                updateChargeRules(nextRules)
                              }}
                              integer
                              min={tier.startPolicyYear}
                            />
                            <PercentInput
                              label="Rate"
                              value={tier.rate}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextSchedule = [...(rule.rateSchedule ?? [])]
                                nextSchedule[tierIndex] = { ...tier, rate: value }
                                nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                updateChargeRules(nextRules)
                              }}
                              step={0.0001}
                            />
                            <div className="flex items-end justify-end">
                              <Button
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                  const nextRules = [...(policy.chargeRules ?? [])]
                                  nextRules[index] = {
                                    ...rule,
                                    rateSchedule: (rule.rateSchedule ?? []).filter((_, candidateIndex) => candidateIndex !== tierIndex),
                                  }
                                  updateChargeRules(nextRules)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove Tier
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Applies To Accounts</Label>
                    <div className="flex flex-wrap gap-3">
                      {policy.accounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rule.appliesTo.includes(account.id)}
                            onChange={(event) => {
                              const nextRules = [...(policy.chargeRules ?? [])]
                              nextRules[index] = {
                                ...rule,
                                appliesTo: event.target.checked
                                  ? [...rule.appliesTo, account.id]
                                  : rule.appliesTo.filter((accountId) => accountId !== account.id),
                              }
                              updateChargeRules(nextRules)
                            }}
                          />
                          {account.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Fallback Deduction Accounts</Label>
                    <div className="flex flex-wrap gap-3">
                      {policy.accounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rule.fallbackAppliesTo?.includes(account.id) ?? false}
                            onChange={(event) => {
                              const nextRules = [...(policy.chargeRules ?? [])]
                              const nextFallback = event.target.checked
                                ? [...(rule.fallbackAppliesTo ?? []), account.id]
                                : (rule.fallbackAppliesTo ?? []).filter((accountId) => accountId !== account.id)
                              nextRules[index] = {
                                ...rule,
                                fallbackAppliesTo: nextFallback,
                              }
                              updateChargeRules(nextRules)
                            }}
                          />
                          {account.label}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When the primary deduction accounts are exhausted, the remaining charge can fall through to these accounts.
                    </p>
                  </div>

                  {rule.basis === 'assurance-sum-at-risk' && (
                    <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      This rule uses the policy-level assurance inputs above. Keep this product partial until the insured-life fields and any required Wealth Assure Value are reviewed against the source document.
                    </p>
                  )}

                  {rule.basis === 'premium-base-mip-multiplier' && (
                    <div className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Premium-Base Multiplier Schedule</h4>
                          <p className="text-sm text-muted-foreground">
                            This annual charge uses the higher of committed and prevailing annual regular premium, then applies the schedule below as the policy-year multiplier.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              premiumBaseConfig: {
                                useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig?.useHigherOfCommencementAndPrevailing ?? true,
                                multiplierSchedule: [
                                  ...(rule.premiumBaseConfig?.multiplierSchedule ?? []),
                                  {
                                    startPolicyYear: rule.startPolicyYear ?? 1,
                                    endPolicyYear: null,
                                    mode: 'policy-year',
                                  },
                                ],
                              },
                            }
                            updateChargeRules(nextRules)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Add Multiplier Tier
                        </Button>
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={rule.premiumBaseConfig?.useHigherOfCommencementAndPrevailing ?? true}
                          onChange={(event) => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              premiumBaseConfig: {
                                useHigherOfCommencementAndPrevailing: event.target.checked,
                                multiplierSchedule: rule.premiumBaseConfig?.multiplierSchedule ?? [],
                              },
                            }
                            updateChargeRules(nextRules)
                          }}
                        />
                        Use the higher of committed and prevailing annual regular premium
                      </label>

                      {(rule.premiumBaseConfig?.multiplierSchedule.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No premium-base multiplier tiers configured.
                        </p>
                      ) : rule.premiumBaseConfig?.multiplierSchedule.map((tier, tierIndex) => (
                        <Card key={`${rule.id}-premium-base-tier-${tierIndex}`}>
                          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-5">
                            <NumberInput
                              label="Start Policy Year"
                              value={tier.startPolicyYear}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextConfig = {
                                  useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig?.useHigherOfCommencementAndPrevailing ?? true,
                                  multiplierSchedule: [...(rule.premiumBaseConfig?.multiplierSchedule ?? [])],
                                }
                                nextConfig.multiplierSchedule[tierIndex] = { ...tier, startPolicyYear: value }
                                nextRules[index] = { ...rule, premiumBaseConfig: nextConfig }
                                updateChargeRules(nextRules)
                              }}
                              integer
                              min={1}
                            />
                            <NumberInput
                              label="End Policy Year"
                              value={tier.endPolicyYear ?? tier.startPolicyYear}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextConfig = {
                                  useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig?.useHigherOfCommencementAndPrevailing ?? true,
                                  multiplierSchedule: [...(rule.premiumBaseConfig?.multiplierSchedule ?? [])],
                                }
                                nextConfig.multiplierSchedule[tierIndex] = { ...tier, endPolicyYear: value }
                                nextRules[index] = { ...rule, premiumBaseConfig: nextConfig }
                                updateChargeRules(nextRules)
                              }}
                              integer
                              min={tier.startPolicyYear}
                            />
                            <div className="space-y-1">
                              <Label>Multiplier Mode</Label>
                              <Select
                                value={tier.mode}
                                onValueChange={(value) => {
                                  const nextRules = [...(policy.chargeRules ?? [])]
                                  const nextConfig = {
                                    useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig?.useHigherOfCommencementAndPrevailing ?? true,
                                    multiplierSchedule: [...(rule.premiumBaseConfig?.multiplierSchedule ?? [])],
                                  }
                                  nextConfig.multiplierSchedule[tierIndex] = {
                                    ...tier,
                                    mode: value as 'policy-year' | 'fixed',
                                    multiplier: value === 'fixed' ? (tier.multiplier ?? tier.startPolicyYear) : undefined,
                                  }
                                  nextRules[index] = { ...rule, premiumBaseConfig: nextConfig }
                                  updateChargeRules(nextRules)
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="policy-year">Policy Year</SelectItem>
                                  <SelectItem value="fixed">Fixed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {tier.mode === 'fixed' && (
                              <NumberInput
                                label="Fixed Multiplier"
                                value={tier.multiplier ?? 0}
                                onChange={(value) => {
                                  const nextRules = [...(policy.chargeRules ?? [])]
                                  const nextConfig = {
                                    useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig?.useHigherOfCommencementAndPrevailing ?? true,
                                    multiplierSchedule: [...(rule.premiumBaseConfig?.multiplierSchedule ?? [])],
                                  }
                                  nextConfig.multiplierSchedule[tierIndex] = { ...tier, multiplier: value }
                                  nextRules[index] = { ...rule, premiumBaseConfig: nextConfig }
                                  updateChargeRules(nextRules)
                                }}
                                min={0}
                              />
                            )}
                            <div className="flex items-end justify-end">
                              <Button
                                variant="outline"
                                className="text-destructive"
                                type="button"
                                onClick={() => {
                                  const nextRules = [...(policy.chargeRules ?? [])]
                                  const nextConfig = {
                                    useHigherOfCommencementAndPrevailing: rule.premiumBaseConfig?.useHigherOfCommencementAndPrevailing ?? true,
                                    multiplierSchedule: (rule.premiumBaseConfig?.multiplierSchedule ?? []).filter((_, currentIndex) => currentIndex !== tierIndex),
                                  }
                                  nextRules[index] = { ...rule, premiumBaseConfig: nextConfig }
                                  updateChargeRules(nextRules)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove Tier
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {rule.basis === 'fixed-annual' && (
                    <div className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Amount Schedule</h4>
                          <p className="text-sm text-muted-foreground">
                            Optional year-specific fixed amounts. Outside these tiers, the base amount above is used.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              amountSchedule: [
                                ...(rule.amountSchedule ?? []),
                                {
                                  startPolicyYear: rule.startPolicyYear ?? 1,
                                  endPolicyYear: null,
                                  amount: rule.amount,
                                },
                              ],
                            }
                            updateChargeRules(nextRules)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Add Tier
                        </Button>
                      </div>

                      {(rule.amountSchedule?.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No year-specific amount tiers configured.
                        </p>
                      ) : rule.amountSchedule?.map((tier, tierIndex) => (
                        <Card key={`${rule.id}-tier-${tierIndex}`}>
                          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                            <NumberInput
                              label="Tier Start Year"
                              value={tier.startPolicyYear}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextSchedule = [...(rule.amountSchedule ?? [])]
                                nextSchedule[tierIndex] = { ...tier, startPolicyYear: value }
                                nextRules[index] = { ...rule, amountSchedule: nextSchedule }
                                updateChargeRules(nextRules)
                              }}
                              integer
                              min={1}
                            />

                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Open-ended Tier</Label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={tier.endPolicyYear == null}
                                  onChange={(event) => {
                                    const nextRules = [...(policy.chargeRules ?? [])]
                                    const nextSchedule = [...(rule.amountSchedule ?? [])]
                                    nextSchedule[tierIndex] = {
                                      ...tier,
                                      endPolicyYear: event.target.checked ? null : tier.startPolicyYear,
                                    }
                                    nextRules[index] = { ...rule, amountSchedule: nextSchedule }
                                    updateChargeRules(nextRules)
                                  }}
                                />
                                No end year
                              </label>
                            </div>

                            {tier.endPolicyYear != null && (
                              <NumberInput
                                label="Tier End Year"
                                value={tier.endPolicyYear}
                                onChange={(value) => {
                                  const nextRules = [...(policy.chargeRules ?? [])]
                                  const nextSchedule = [...(rule.amountSchedule ?? [])]
                                  nextSchedule[tierIndex] = { ...tier, endPolicyYear: value }
                                  nextRules[index] = { ...rule, amountSchedule: nextSchedule }
                                  updateChargeRules(nextRules)
                                }}
                                integer
                                min={tier.startPolicyYear}
                              />
                            )}

                            <CurrencyInput
                              label={`Tier Amount (${policy.currency})`}
                              value={tier.amount}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextSchedule = [...(rule.amountSchedule ?? [])]
                                nextSchedule[tierIndex] = { ...tier, amount: value }
                                nextRules[index] = { ...rule, amountSchedule: nextSchedule }
                                updateChargeRules(nextRules)
                              }}
                            />

                            <div className="flex items-end justify-end">
                              <Button
                                variant="outline"
                                className="text-destructive"
                                type="button"
                                onClick={() => {
                                  const nextRules = [...(policy.chargeRules ?? [])]
                                  nextRules[index] = {
                                    ...rule,
                                    amountSchedule: (rule.amountSchedule ?? []).filter((_, candidateIndex) => candidateIndex !== tierIndex),
                                  }
                                  updateChargeRules(nextRules)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove Tier
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      type="button"
                      onClick={() => updateChargeRules((policy.chargeRules ?? []).filter((_, chargeIndex) => chargeIndex !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove Charge Rule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="events">
          <AccordionTrigger>Policy Events & Event Charges</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Policy Events</h3>
                  <p className="text-sm text-muted-foreground">
                    Use policy-month timing for premium holidays, withdrawals, and premium reductions that affect contribution flow, event charges, or bonus eligibility.
                  </p>
                </div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => updatePolicyEvents([
                    ...(policy.policyEvents ?? []),
                    {
                      id: createDraftId('event'),
                      type: 'premium-holiday',
                      startPolicyMonth: policy.monthsAlreadyPaid + 1,
                      durationMonths: 1,
                    },
                  ])}
                >
                  <Plus className="h-4 w-4" />
                  Add Event
                </Button>
              </div>

              {(policy.policyEvents ?? []).length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No policy events configured.
                  </CardContent>
                </Card>
              ) : (policy.policyEvents ?? []).map((event, index) => (
                <Card key={event.id}>
                  <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Event Type</Label>
                      <Select
                      value={event.type}
                      onValueChange={(value) => {
                        const nextEvents = [...(policy.policyEvents ?? [])]
                        nextEvents[index] = {
                          ...event,
                          type: value as IlpPolicyEvent['type'],
                          amount: value === 'partial-withdrawal' || value === 'reinvested-dividend-withdrawal'
                            ? (event.amount ?? 1_000)
                            : (value === 'regular-premium-reduction'
                              ? (event.amount ?? 1_200)
                              : (value === 'regular-premium-increase'
                                ? (event.amount ?? 1_200)
                                : ((value === 'policy-repayment' || value === 'top-up' || value === 'recurring-single-premium') ? (event.amount ?? 1_000) : undefined))),
                          accountId: value === 'partial-withdrawal' || value === 'reinvested-dividend-withdrawal'
                            ? (event.accountId ?? policy.accounts[0]?.id)
                            : ((value === 'policy-repayment' || value === 'top-up' || value === 'recurring-single-premium')
                              ? (event.accountId ?? policy.accounts[0]?.id)
                              : undefined),
                          chargeWaived: value === 'partial-withdrawal'
                            || value === 'premium-holiday'
                            || value === 'regular-premium-reduction'
                            ? (event.chargeWaived ?? false)
                            : undefined,
                          chargeRefunded: value === 'partial-withdrawal'
                            || value === 'premium-holiday'
                            || value === 'regular-premium-reduction'
                            ? (event.chargeRefunded ?? false)
                            : undefined,
                          bonusSuspensionWaived: value === 'partial-withdrawal'
                            || value === 'premium-holiday'
                            || value === 'regular-premium-reduction'
                            ? (event.bonusSuspensionWaived ?? false)
                            : undefined,
                          repayMissedPremiums: value === 'premium-holiday' ? (event.repayMissedPremiums ?? false) : undefined,
                          repaymentAccountId: value === 'premium-holiday' ? event.repaymentAccountId : undefined,
                          resultingSumAssured: value === 'assurance-benefit-reduction' || value === 'assurance-benefit-resumption'
                            ? (event.resultingSumAssured ?? policy.assuranceProfile?.currentSumAssured ?? 0)
                            : undefined,
                          resultingWealthAssureValue: value === 'assurance-benefit-reduction'
                            ? (event.resultingWealthAssureValue ?? policy.assuranceProfile?.currentWealthAssureValue ?? 0)
                            : undefined,
                          durationMonths: value === 'assurance-benefit-reduction' || value === 'assurance-benefit-resumption' || value === 'recurring-single-premium-resumption'
                            || value === 'reinvested-dividend-withdrawal'
                            ? 1
                            : value === 'policy-repayment'
                            ? 1
                            : event.durationMonths,
                        }
                        updatePolicyEvents(nextEvents)
                      }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="premium-holiday">Premium Holiday</SelectItem>
                          <SelectItem value="partial-withdrawal">Partial Withdrawal</SelectItem>
                          <SelectItem value="reinvested-dividend-withdrawal">Reinvested Dividend Withdrawal</SelectItem>
                          <SelectItem value="regular-premium-reduction">Regular Premium Reduction</SelectItem>
                          <SelectItem value="regular-premium-increase">Regular Premium Increase</SelectItem>
                          <SelectItem value="policy-repayment">Policy Repayment</SelectItem>
                          <SelectItem value="top-up">Top-up</SelectItem>
                          <SelectItem value="recurring-single-premium">Recurring Single Premium</SelectItem>
                          <SelectItem value="recurring-single-premium-resumption">Recurring Single Premium Resumption</SelectItem>
                          <SelectItem value="assurance-benefit-reduction">Assurance Benefit Reduction</SelectItem>
                          <SelectItem value="assurance-benefit-resumption">Assurance Benefit Resumption</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <NumberInput
                      label="Start Policy Month"
                      value={event.startPolicyMonth}
                      onChange={(value) => {
                        const nextEvents = [...(policy.policyEvents ?? [])]
                        nextEvents[index] = { ...event, startPolicyMonth: value }
                        updatePolicyEvents(nextEvents)
                      }}
                      integer
                      min={1}
                    />

                    {event.type === 'assurance-benefit-reduction' || event.type === 'assurance-benefit-resumption' || event.type === 'recurring-single-premium-resumption' || event.type === 'policy-repayment' || event.type === 'reinvested-dividend-withdrawal' ? (
                      <div className="space-y-1">
                        <Label>Duration (months)</Label>
                        <Input value="1" disabled />
                      </div>
                    ) : (
                      <NumberInput
                        label="Duration (months)"
                        value={event.durationMonths}
                        onChange={(value) => {
                          const nextEvents = [...(policy.policyEvents ?? [])]
                          nextEvents[index] = { ...event, durationMonths: value }
                          updatePolicyEvents(nextEvents)
                        }}
                        integer
                        min={1}
                      />
                    )}

                    {event.type === 'partial-withdrawal' ? (
                      <>
                        <CurrencyInput
                          label={`Withdrawal Amount (${policy.currency})`}
                          value={event.amount ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, amount: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="space-y-1">
                          <Label>Source Account</Label>
                          <Select
                            value={event.accountId ?? policy.accounts[0]?.id ?? ''}
                            onValueChange={(value) => {
                              const nextEvents = [...(policy.policyEvents ?? [])]
                              nextEvents[index] = { ...event, accountId: value }
                              updatePolicyEvents(nextEvents)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {policy.accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-3 xl:col-span-2">
                          <Label className="text-sm font-medium">Charge Waiver</Label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.chargeWaived ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  chargeWaived: inputEvent.target.checked,
                                  chargeRefunded: inputEvent.target.checked ? false : (event.chargeRefunded ?? false),
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Insurer-approved charge waiver applies
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.chargeRefunded ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  chargeRefunded: inputEvent.target.checked,
                                  chargeWaived: inputEvent.target.checked ? false : (event.chargeWaived ?? false),
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Already deducted charge was later refunded
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.bonusSuspensionWaived ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  bonusSuspensionWaived: inputEvent.target.checked,
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Ignore this withdrawal for bonus-suspension rules
                          </label>
                        </div>
                      </>
                    ) : event.type === 'reinvested-dividend-withdrawal' ? (
                      <>
                        <CurrencyInput
                          label={`Reinvested Dividend Withdrawal Amount (${policy.currency})`}
                          value={event.amount ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, amount: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="space-y-1">
                          <Label>Source Account</Label>
                          <Select
                            value={event.accountId ?? policy.accounts[0]?.id ?? ''}
                            onValueChange={(value) => {
                              const nextEvents = [...(policy.policyEvents ?? [])]
                              nextEvents[index] = { ...event, accountId: value }
                              updatePolicyEvents(nextEvents)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {policy.accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2 xl:col-span-2 text-xs text-muted-foreground self-end">
                          Use this for insurer-approved withdrawals of accumulated reinvested dividends. The calculator treats it as a one-time account-value withdrawal without partial-withdrawal or surrender charges.
                        </div>
                      </>
                    ) : event.type === 'premium-holiday' ? (
                      <>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Repay Missed Premiums</Label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.repayMissedPremiums ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  repayMissedPremiums: inputEvent.target.checked,
                                  repaymentAccountId: inputEvent.target.checked
                                    ? (event.repaymentAccountId ?? policy.accounts.find((account) => account.id === 'aua')?.id ?? policy.accounts[0]?.id)
                                    : undefined,
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Full back-pay immediately after the latest holiday period
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.chargeWaived ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  chargeWaived: inputEvent.target.checked,
                                  chargeRefunded: inputEvent.target.checked ? false : (event.chargeRefunded ?? false),
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Insurer-approved charge waiver applies
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.chargeRefunded ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  chargeRefunded: inputEvent.target.checked,
                                  chargeWaived: inputEvent.target.checked ? false : (event.chargeWaived ?? false),
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Already deducted charge was later refunded
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.bonusSuspensionWaived ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  bonusSuspensionWaived: inputEvent.target.checked,
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Ignore this holiday for bonus-suspension rules
                          </label>
                        </div>
                        <div className="space-y-1">
                          <Label>Repayment Account</Label>
                          <Select
                            value={event.repaymentAccountId ?? policy.accounts.find((account) => account.id === 'aua')?.id ?? policy.accounts[0]?.id ?? ''}
                            disabled={!(event.repayMissedPremiums ?? false)}
                            onValueChange={(value) => {
                              const nextEvents = [...(policy.policyEvents ?? [])]
                              nextEvents[index] = { ...event, repaymentAccountId: value }
                              updatePolicyEvents(nextEvents)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {policy.accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : event.type === 'regular-premium-reduction' ? (
                      <>
                        <CurrencyInput
                          label={`Annual Reduction Amount (${policy.currency})`}
                          value={event.amount ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, amount: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Charge Waiver</Label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.chargeWaived ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  chargeWaived: inputEvent.target.checked,
                                  chargeRefunded: inputEvent.target.checked ? false : (event.chargeRefunded ?? false),
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Insurer-approved charge waiver applies
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.chargeRefunded ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  chargeRefunded: inputEvent.target.checked,
                                  chargeWaived: inputEvent.target.checked ? false : (event.chargeWaived ?? false),
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Already deducted charge was later refunded
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.bonusSuspensionWaived ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  bonusSuspensionWaived: inputEvent.target.checked,
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Ignore this reduction for bonus-suspension rules
                          </label>
                        </div>
                      </>
                    ) : event.type === 'regular-premium-increase' ? (
                      <CurrencyInput
                        label={`Annual Increase Amount (${policy.currency})`}
                        value={event.amount ?? 0}
                        onChange={(value) => {
                          const nextEvents = [...(policy.policyEvents ?? [])]
                          nextEvents[index] = { ...event, amount: value }
                          updatePolicyEvents(nextEvents)
                        }}
                      />
                    ) : event.type === 'policy-repayment' ? (
                      <>
                        <CurrencyInput
                          label={`Repayment Amount (${policy.currency})`}
                          value={event.amount ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, amount: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="space-y-1">
                          <Label>Target Account</Label>
                          <Select
                            value={event.accountId ?? policy.accounts[0]?.id ?? ''}
                            onValueChange={(value) => {
                              const nextEvents = [...(policy.policyEvents ?? [])]
                              nextEvents[index] = { ...event, accountId: value }
                              updatePolicyEvents(nextEvents)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {policy.accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2 xl:col-span-2 text-xs text-muted-foreground">
                          Use this for explicit insurer-accepted repayments that should be credited back into a policy account. It does not automatically infer FIFO allocation across missed premiums, prior withdrawals, or prior premium reductions.
                        </div>
                      </>
                    ) : event.type === 'top-up' || event.type === 'recurring-single-premium' ? (
                      <>
                        <CurrencyInput
                          label={`${event.type === 'top-up' ? 'Top-up' : 'Recurring Single Premium'} Amount (${policy.currency})`}
                          value={event.amount ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, amount: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="space-y-1">
                          <Label>Target Account</Label>
                          <Select
                            value={event.accountId ?? USE_TOP_UP_ROUTING_VALUE}
                            onValueChange={(value) => {
                              const nextEvents = [...(policy.policyEvents ?? [])]
                              nextEvents[index] = {
                                ...event,
                                accountId: value === USE_TOP_UP_ROUTING_VALUE ? undefined : value,
                              }
                              updatePolicyEvents(nextEvents)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={USE_TOP_UP_ROUTING_VALUE}>Use top-up routing rules</SelectItem>
                              {policy.accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Leave this on routing rules to follow any seeded top-up account split from the catalog template.
                          </p>
                        </div>
                        {event.type === 'recurring-single-premium' ? (
                          <div className="md:col-span-2 xl:col-span-4 text-xs text-muted-foreground">
                            Model this as the amount paid for each scheduled premium mode period. The calculator applies it once per policy month across the event duration and deducts any recurring-single-premium premium charge before crediting the routed account.
                          </div>
                        ) : null}
                      </>
                    ) : event.type === 'recurring-single-premium-resumption' ? (
                      <div className="md:col-span-2 xl:col-span-4 text-xs text-muted-foreground">
                        Use this as the explicit administrative restart month for a recurring single premium stream after it was stopped by a premium holiday. The stream stays blocked until this event occurs.
                      </div>
                    ) : event.type === 'assurance-benefit-reduction' ? (
                      <>
                        <CurrencyInput
                          label={`Resulting Sum Assured (${policy.currency})`}
                          value={event.resultingSumAssured ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, resultingSumAssured: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <CurrencyInput
                          label={`Resulting Wealth Assure Value (${policy.currency})`}
                          value={event.resultingWealthAssureValue ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, resultingWealthAssureValue: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="md:col-span-2 xl:col-span-4 text-xs text-muted-foreground">
                          Use the accepted post-reduction values from Prudential’s revised certificate. The 3% sum-assured increase and Wealth Assure progression stay frozen until a later resumption event.
                        </div>
                      </>
                    ) : event.type === 'assurance-benefit-resumption' ? (
                      <>
                        <CurrencyInput
                          label={`Resumed Sum Assured (${policy.currency})`}
                          value={event.resultingSumAssured ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, resultingSumAssured: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="md:col-span-2 xl:col-span-3 text-xs text-muted-foreground self-end">
                          Enter the restored sum assured from the revised certificate. The engine resumes automatic growth from the next policy anniversary and continues Wealth Assure calculation from the carried state.
                        </div>
                      </>
                    ) : (
                      <div className="flex items-end justify-end">
                        <Button
                          variant="outline"
                          className="text-destructive"
                          type="button"
                          onClick={() => updatePolicyEvents((policy.policyEvents ?? []).filter((_, eventIndex) => eventIndex !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Event
                        </Button>
                      </div>
                    )}

                    {(event.type === 'partial-withdrawal'
                      || event.type === 'reinvested-dividend-withdrawal'
                      || event.type === 'regular-premium-reduction'
                      || event.type === 'regular-premium-increase'
                      || event.type === 'policy-repayment'
                      || event.type === 'top-up'
                      || event.type === 'recurring-single-premium'
                      || event.type === 'recurring-single-premium-resumption'
                      || event.type === 'assurance-benefit-reduction'
                      || event.type === 'assurance-benefit-resumption') && (
                      <div className="flex items-end justify-end xl:col-span-4">
                        <Button
                          variant="outline"
                          className="text-destructive"
                          type="button"
                          onClick={() => updatePolicyEvents((policy.policyEvents ?? []).filter((_, eventIndex) => eventIndex !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Event
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {isCatalogSeeded ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{policy.eventChargeRules?.length ?? 0} event charge {(policy.eventChargeRules?.length ?? 0) === 1 ? 'rule' : 'rules'} from catalog template. These reflect the product's published event charge schedule.</span>
                </div>
                {(policy.eventChargeRules?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCatalogEventChargeRules(!showCatalogEventChargeRules)}
                  >
                    {showCatalogEventChargeRules ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {showCatalogEventChargeRules ? 'Hide details' : 'Show details (read-only)'}
                  </button>
                )}
                {showCatalogEventChargeRules && (policy.eventChargeRules ?? []).map((rule) => (
                  <Card key={rule.id} className="opacity-75">
                    <CardContent className="py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-medium">{rule.label}</span>
                        <Badge variant="outline">{rule.trigger}</Badge>
                        <Badge variant="secondary">{rule.basis}</Badge>
                        {rule.rate > 0 && <span>{formatIlpPercent(rule.rate)}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Event Charge Rules</h3>
                  <p className="text-sm text-muted-foreground">
                    Model one-time charges that fire when a partial withdrawal happens, such as withdrawal or bonus recovery charges.
                  </p>
                </div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => updateEventChargeRules([
                    ...(policy.eventChargeRules ?? []),
                    {
                      id: createDraftId('event-charge'),
                      label: `Event Charge ${(policy.eventChargeRules?.length ?? 0) + 1}`,
                      trigger: 'partial-withdrawal',
                      basis: 'event-amount',
                      appliesTo: policy.accounts.map((account) => account.id),
                      rate: 0,
                      rateSchedule: [],
                      amount: 0,
                      allocation: 'equal-split',
                    },
                  ])}
                >
                  <Plus className="h-4 w-4" />
                  Add Event Charge
                </Button>
              </div>

              {(policy.eventChargeRules ?? []).length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No event charge rules configured.
                  </CardContent>
                </Card>
              ) : (policy.eventChargeRules ?? []).map((rule, index) => (
                <Card key={rule.id}>
                  <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Label</Label>
                        <Input
                          className="border-blue-300"
                          value={rule.label}
                          onChange={(event) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, label: event.target.value }
                            updateEventChargeRules(nextRules)
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>Basis</Label>
                        <Select
                          value={rule.basis}
                          onValueChange={(value) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, basis: value as IlpEventChargeRule['basis'] }
                            updateEventChargeRules(nextRules)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="premium-reduction-with-startup-recovery">Premium Reduction Recovery</SelectItem>
                            <SelectItem value="repaid-premium-with-missed-months">Repaid Premium with Missed Months</SelectItem>
                            <SelectItem value="annual-premium-with-overlap-months">Annual Premium During Holiday</SelectItem>
                            <SelectItem value="premium-holiday-charge-refund">Premium Holiday Charge Refund</SelectItem>
                            <SelectItem value="event-amount">Event Amount</SelectItem>
                            <SelectItem value="account-value">Account Value</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Trigger</Label>
                        <Select
                          value={rule.trigger}
                          onValueChange={(value) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, trigger: value as IlpEventChargeRule['trigger'] }
                            updateEventChargeRules(nextRules)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="partial-withdrawal">Partial Withdrawal</SelectItem>
                            <SelectItem value="regular-premium-reduction">Regular Premium Reduction</SelectItem>
                            <SelectItem value="premium-holiday">Premium Holiday</SelectItem>
                            <SelectItem value="premium-holiday-repayment">Premium Holiday Repayment</SelectItem>
                            <SelectItem value="top-up">Top-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <PercentInput
                        label="Rate"
                        value={rule.rate}
                        onChange={(value) => {
                          const nextRules = [...(policy.eventChargeRules ?? [])]
                          nextRules[index] = { ...rule, rate: value }
                          updateEventChargeRules(nextRules)
                        }}
                      />

                      <CurrencyInput
                        label={`Fixed Charge (${policy.currency})`}
                        value={rule.amount}
                        onChange={(value) => {
                          const nextRules = [...(policy.eventChargeRules ?? [])]
                          nextRules[index] = { ...rule, amount: value }
                          updateEventChargeRules(nextRules)
                        }}
                      />

                      {rule.trigger === 'premium-holiday' && (
                        <NumberInput
                          label="Free Lifetime Holiday Months"
                          value={rule.freeLifetimeMonths ?? 24}
                          onChange={(value) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, freeLifetimeMonths: value }
                            updateEventChargeRules(nextRules)
                          }}
                          integer
                          min={1}
                        />
                      )}

                      {rule.basis === 'premium-holiday-charge-refund' && (
                        <div className="space-y-1">
                          <Label>Refund Source Rule</Label>
                          <Select
                            value={rule.sourceChargeRuleId ?? ''}
                            onValueChange={(value) => {
                              const nextRules = [...(policy.eventChargeRules ?? [])]
                              nextRules[index] = { ...rule, sourceChargeRuleId: value }
                              updateEventChargeRules(nextRules)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a premium holiday charge rule" />
                            </SelectTrigger>
                            <SelectContent>
                              {(policy.eventChargeRules ?? [])
                                .filter((candidate) => candidate.id !== rule.id && candidate.trigger === 'premium-holiday')
                                .map((candidate) => (
                                  <SelectItem key={candidate.id} value={candidate.id}>{candidate.label}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label>Allocation</Label>
                        <Select
                          value={rule.allocation}
                          onValueChange={(value) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, allocation: value as IlpEventChargeRule['allocation'] }
                            updateEventChargeRules(nextRules)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equal-split">Equal Split</SelectItem>
                            <SelectItem value="pro-rata-by-value">Pro-rata by Value</SelectItem>
                            <SelectItem value="pro-rata-by-contribution-share">Pro-rata by Contribution Share</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Rate Schedule</Label>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              rateSchedule: [
                                ...(rule.rateSchedule ?? []),
                                {
                                  startPolicyYear: 1,
                                  endPolicyYear: null,
                                  rate: rule.rate,
                                },
                              ],
                            }
                            updateEventChargeRules(nextRules)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Add Rate Tier
                        </Button>
                      </div>

                      {(rule.rateSchedule ?? []).length > 0 && (
                        <div className="space-y-3">
                          {(rule.rateSchedule ?? []).map((tier, tierIndex) => (
                            <Card key={`${rule.id}-tier-${tierIndex}`}>
                              <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
                                <NumberInput
                                  label="Start Policy Year"
                                  value={tier.startPolicyYear}
                                  onChange={(value) => {
                                    const nextRules = [...(policy.eventChargeRules ?? [])]
                                    const nextSchedule = [...(rule.rateSchedule ?? [])]
                                    nextSchedule[tierIndex] = { ...tier, startPolicyYear: value }
                                    nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                    updateEventChargeRules(nextRules)
                                  }}
                                  integer
                                  min={1}
                                />
                                <NumberInput
                                  label="End Policy Year"
                                  value={tier.endPolicyYear ?? 0}
                                  onChange={(value) => {
                                    const nextRules = [...(policy.eventChargeRules ?? [])]
                                    const nextSchedule = [...(rule.rateSchedule ?? [])]
                                    nextSchedule[tierIndex] = { ...tier, endPolicyYear: value <= 0 ? null : value }
                                    nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                    updateEventChargeRules(nextRules)
                                  }}
                                  integer
                                  min={0}
                                />
                                <PercentInput
                                  label="Tier Rate"
                                  value={tier.rate}
                                  onChange={(value) => {
                                    const nextRules = [...(policy.eventChargeRules ?? [])]
                                    const nextSchedule = [...(rule.rateSchedule ?? [])]
                                    nextSchedule[tierIndex] = { ...tier, rate: value }
                                    nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                    updateEventChargeRules(nextRules)
                                  }}
                                />
                                <div className="flex items-end justify-end">
                                  <Button
                                    variant="outline"
                                    className="text-destructive"
                                    type="button"
                                    onClick={() => {
                                      const nextRules = [...(policy.eventChargeRules ?? [])]
                                      nextRules[index] = {
                                        ...rule,
                                        rateSchedule: (rule.rateSchedule ?? []).filter((_, scheduleIndex) => scheduleIndex !== tierIndex),
                                      }
                                      updateEventChargeRules(nextRules)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Remove Tier
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Apply Charge To</Label>
                      <div className="flex flex-wrap gap-3">
                        {policy.accounts.map((account) => (
                          <label key={account.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={rule.appliesTo.includes(account.id)}
                              onChange={(event) => {
                                const nextRules = [...(policy.eventChargeRules ?? [])]
                                nextRules[index] = {
                                  ...rule,
                                  appliesTo: event.target.checked
                                    ? [...rule.appliesTo, account.id]
                                    : rule.appliesTo.filter((accountId) => accountId !== account.id),
                                }
                                updateEventChargeRules(nextRules)
                              }}
                            />
                            {account.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        className="text-destructive"
                        type="button"
                        onClick={() => updateEventChargeRules((policy.eventChargeRules ?? []).filter((_, ruleIndex) => ruleIndex !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove Event Charge
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="settings">
          <AccordionTrigger>Analysis Settings</AccordionTrigger>
          <AccordionContent className="grid gap-4 md:grid-cols-3">
            <PercentInput
              label="Discount Rate"
              value={policy.discountRate}
              onChange={(value) => updatePolicy(policy.id, { discountRate: value })}
            />
            <PercentInput
              label="Inflation Rate"
              value={policy.inflationRate}
              onChange={(value) => updatePolicy(policy.id, { inflationRate: value })}
            />
            <PercentInput
              label="Alternative Return"
              value={policy.alternativeReturn}
              onChange={(value) => updatePolicy(policy.id, { alternativeReturn: value })}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
