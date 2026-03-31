import type { IlpFund, IlpPolicyInput, IlpProjectionResult, IlpYearRow, ReturnScenario } from '@/lib/calculations/ilp'

export interface IlpFeeBreakdownRow {
  policyYear: number
  year: number
  contribution: number
  accountFee: number
  additionalCharges: number
  assuranceCharges: number
  eventCharges: number
  /** Implicit fund management fee (OCF applied to opening account values). Not charged as a line item but reduces investment returns. */
  implicitFundFee: number
  grossFee: number
  /** Gross fee including the implicit fund management fee. */
  totalGrossFee: number
  bonusCredits: number
  netFee: number
  eecCharge: number
  withdrawals: number
  closingValue: number
  surrenderValue: number
  cumulativeGrossFees: number
  cumulativeBonuses: number
  cumulativeNetFees: number
  cumulativeImplicitFundFees: number
}

export interface IlpInceptionCharge {
  label: string
  amount: number
}

export interface IlpFeeBreakdownResult {
  rows: IlpFeeBreakdownRow[]
  blendedOcf: number
  inceptionCharges: IlpInceptionCharge[]
  totals: {
    accountFee: number
    additionalCharges: number
    assuranceCharges: number
    eventCharges: number
    implicitFundFee: number
    grossFee: number
    totalGrossFee: number
    bonusCredits: number
    netFee: number
  }
}

function aggregateAccountField(
  yearRow: IlpYearRow,
  field: 'accountFee' | 'additionalCharges' | 'assuranceCharges' | 'eventCharges' | 'grossFee' | 'bonusCredit',
): number {
  return yearRow.accounts.reduce((sum, account) => sum + account[field], 0)
}

function computeBlendedOcf(funds: IlpFund[]): number {
  return funds.reduce((sum, fund) => sum + fund.allocation * fund.ocf, 0)
}

function computeInceptionCharges(policy?: IlpPolicyInput): IlpInceptionCharge[] {
  if (!policy) return []
  const isp = policy.initialSinglePremium ?? 0
  if (isp <= 0) return []
  return (policy.chargeRules ?? [])
    .filter((rule) => 'basis' in rule && rule.basis === 'initial-single-premium' && rule.rate > 0)
    .map((rule) => ({
      label: 'label' in rule && typeof rule.label === 'string' ? rule.label : 'Single Premium Charge',
      amount: isp * rule.rate,
    }))
}

export function buildFeeBreakdown(
  projection: IlpProjectionResult,
  funds?: IlpFund[],
  policy?: IlpPolicyInput,
): IlpFeeBreakdownResult {
  let cumulativeGrossFees = 0
  let cumulativeBonuses = 0
  let cumulativeImplicitFundFees = 0
  const blendedOcf = funds ? computeBlendedOcf(funds) : 0
  const inceptionCharges = computeInceptionCharges(policy)

  const totals = {
    accountFee: 0,
    additionalCharges: 0,
    assuranceCharges: 0,
    eventCharges: 0,
    implicitFundFee: 0,
    grossFee: 0,
    totalGrossFee: 0,
    bonusCredits: 0,
    netFee: 0,
  }

  const rows = projection.rows.map((yearRow) => {
    const accountFee = aggregateAccountField(yearRow, 'accountFee')
    const additionalCharges = aggregateAccountField(yearRow, 'additionalCharges')
    const assuranceCharges = aggregateAccountField(yearRow, 'assuranceCharges')
    const eventCharges = aggregateAccountField(yearRow, 'eventCharges')
    const grossFee = aggregateAccountField(yearRow, 'grossFee')
    const bonusCredits = aggregateAccountField(yearRow, 'bonusCredit')
    const netFee = grossFee - bonusCredits

    // Implicit fund fee: OCF applied to opening account values for the year
    const openingValue = yearRow.accounts.reduce((sum, account) => sum + account.open, 0)
    const implicitFundFee = openingValue * blendedOcf

    cumulativeGrossFees += grossFee
    cumulativeBonuses += bonusCredits
    cumulativeImplicitFundFees += implicitFundFee

    totals.accountFee += accountFee
    totals.additionalCharges += additionalCharges
    totals.assuranceCharges += assuranceCharges
    totals.eventCharges += eventCharges
    totals.implicitFundFee += implicitFundFee
    totals.grossFee += grossFee
    totals.totalGrossFee += grossFee + implicitFundFee
    totals.bonusCredits += bonusCredits
    totals.netFee += netFee

    return {
      policyYear: yearRow.policyYear,
      year: yearRow.year,
      contribution: yearRow.annualContribution,
      accountFee,
      additionalCharges,
      assuranceCharges,
      eventCharges,
      implicitFundFee,
      grossFee,
      totalGrossFee: grossFee + implicitFundFee,
      bonusCredits,
      netFee,
      eecCharge: yearRow.eecCharge,
      withdrawals: yearRow.annualWithdrawals,
      closingValue: yearRow.combinedValue,
      surrenderValue: yearRow.surrenderValue,
      cumulativeGrossFees,
      cumulativeBonuses,
      cumulativeNetFees: cumulativeGrossFees - cumulativeBonuses,
      cumulativeImplicitFundFees,
    }
  })

  return { rows, blendedOcf, inceptionCharges, totals }
}

export function pickProjection(
  projections: Record<ReturnScenario, IlpProjectionResult>,
  scenario: ReturnScenario,
): IlpProjectionResult {
  return projections[scenario]
}
