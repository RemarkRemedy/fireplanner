import type { IlpProjectionResult, IlpYearRow, ReturnScenario } from '@/lib/calculations/ilp'

export interface IlpFeeBreakdownRow {
  policyYear: number
  year: number
  contribution: number
  accountFee: number
  additionalCharges: number
  assuranceCharges: number
  eventCharges: number
  grossFee: number
  bonusCredits: number
  netFee: number
  eecCharge: number
  withdrawals: number
  closingValue: number
  cumulativeGrossFees: number
  cumulativeBonuses: number
  cumulativeNetFees: number
}

export interface IlpFeeBreakdownResult {
  rows: IlpFeeBreakdownRow[]
  totals: {
    accountFee: number
    additionalCharges: number
    assuranceCharges: number
    eventCharges: number
    grossFee: number
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

export function buildFeeBreakdown(
  projection: IlpProjectionResult,
): IlpFeeBreakdownResult {
  let cumulativeGrossFees = 0
  let cumulativeBonuses = 0

  const totals = {
    accountFee: 0,
    additionalCharges: 0,
    assuranceCharges: 0,
    eventCharges: 0,
    grossFee: 0,
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

    cumulativeGrossFees += grossFee
    cumulativeBonuses += bonusCredits

    totals.accountFee += accountFee
    totals.additionalCharges += additionalCharges
    totals.assuranceCharges += assuranceCharges
    totals.eventCharges += eventCharges
    totals.grossFee += grossFee
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
      grossFee,
      bonusCredits,
      netFee,
      eecCharge: yearRow.eecCharge,
      withdrawals: yearRow.annualWithdrawals,
      closingValue: yearRow.combinedValue,
      cumulativeGrossFees,
      cumulativeBonuses,
      cumulativeNetFees: cumulativeGrossFees - cumulativeBonuses,
    }
  })

  return { rows, totals }
}

export function pickProjection(
  projections: Record<ReturnScenario, IlpProjectionResult>,
  scenario: ReturnScenario,
): IlpProjectionResult {
  return projections[scenario]
}
