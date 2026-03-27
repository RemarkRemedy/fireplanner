import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import type { IlpFeeBreakdownResult } from '@/lib/calculations/ilpFeeBreakdown'
import { DATA_VINTAGE } from '@/lib/data/changelog'
import { INDEX_FUND_NET_RETURN } from '@/lib/data/ilpReceiptConstants'

export interface ReceiptData {
  productLabel: string
  currency: IlpPolicyInput['currency']
  youPay: number
  grossFees: number
  bonusesReceived: number
  whatTheyKeep: number
  feeDragPercent: number
  indexFundValue: number
  ilpValueAtHorizon: number
  leavingOnTable: number
  dataFreshness: string
  includesOcf: boolean
}

function formatDataVintage(vintage: string): string {
  const date = new Date(vintage + 'T12:00:00')
  return date.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })
}

function buildProductLabel(policy: IlpPolicyInput): string {
  const isSinglePremium =
    (policy.initialSinglePremium ?? 0) > 0 && policy.monthlyContribution === 0
  if (isSinglePremium) {
    return 'Major Insurer, Single Premium ILP'
  }
  if (policy.mipLength != null) {
    return `Major Insurer, ${policy.mipLength}-Year ILP`
  }
  return 'Major Insurer, ILP'
}

export function computeIndexFundValue(
  monthlyContribution: number,
  initialSinglePremium: number,
  years: number,
): number {
  if (monthlyContribution === 0 && initialSinglePremium === 0) return 0

  let total = 0

  if (initialSinglePremium > 0) {
    total += initialSinglePremium * Math.pow(1 + INDEX_FUND_NET_RETURN, years)
  }

  if (monthlyContribution > 0) {
    const monthlyRate = Math.pow(1 + INDEX_FUND_NET_RETURN, 1 / 12) - 1
    const months = years * 12
    total += monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
  }

  return total
}

export function computeReceiptData(
  policy: IlpPolicyInput,
  analysis: IlpProjectedPolicyAnalysis,
  feeBreakdown: IlpFeeBreakdownResult,
  includeOcf: boolean,
): ReceiptData {
  const { summary } = analysis
  const horizonRows = analysis.projections.mid.rows
  if (horizonRows.length === 0) {
    throw new Error('computeReceiptData: projection has no rows')
  }
  const horizonYears = horizonRows.length
  const ilpValueAtHorizon = horizonRows[horizonRows.length - 1].combinedValue

  const grossFees = includeOcf
    ? summary.totalFeesCharged + feeBreakdown.totals.implicitFundFee
    : summary.totalFeesCharged
  const bonusesReceived = summary.totalBonusesReceived
  const whatTheyKeep = Math.max(0, grossFees - bonusesReceived)
  const youPay = summary.totalPremiumsPaid
  const feeDragPercent = youPay > 0 ? whatTheyKeep / youPay : 0

  const indexFundValue = computeIndexFundValue(
    policy.monthlyContribution,
    policy.initialSinglePremium ?? 0,
    horizonYears,
  )
  const leavingOnTable = Math.max(0, indexFundValue - ilpValueAtHorizon)

  return {
    productLabel: buildProductLabel(policy),
    currency: policy.currency,
    youPay,
    grossFees,
    bonusesReceived,
    whatTheyKeep,
    feeDragPercent,
    indexFundValue,
    ilpValueAtHorizon,
    leavingOnTable,
    dataFreshness: formatDataVintage(DATA_VINTAGE),
    includesOcf: includeOcf,
  }
}
