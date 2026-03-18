import { lookupEecRate } from '@/lib/data/ilpDefaults'

export interface IlpFund {
  name: string
  allocation: number
  ocf: number
  grossReturnLow: number
  grossReturnMid: number
  grossReturnHigh: number
}

export interface IlpAccount {
  id: string
  label: string
  feeRate: number
  currentValue: number
  contributionShare: number
  subjectToEec: boolean
  postMipFeeRate: number | null
}

export interface IlpBonusRule {
  type: 'power-up' | 'loyalty' | 'allocation' | 'sign-up' | 'custom'
  label: string
  mode: 'annual-rate' | 'premium-allocation' | 'one-time'
  rate: number
  amount: number
  appliesTo: string[]
  startPolicyYear: number
  endPolicyYear: number | null
}

export interface IlpLapseMetadataOnlyFlags {
  underwriting: boolean
  exclusionResets: boolean
  claimState: boolean
  backpay: boolean
}

export interface IlpLapseReinstatementRule {
  mode: 'manulife-temporary'
  lapseTrigger: 'policy-value-nonpositive'
  reinstatementWindowMonths: number
  freezeValueDuringLapse: boolean
  freezeChargesDuringLapse: boolean
  manualReinstatementOnly: boolean
  metadataOnly: IlpLapseMetadataOnlyFlags
}

export interface IlpPolicyInput {
  id: string
  name: string
  insurer: string
  currency: 'SGD' | 'USD'
  monthlyContribution: number
  monthsAlreadyPaid: number
  currentPolicyYear: number
  accounts: IlpAccount[]
  mipLength: number
  postMipYears: number
  eecTable: number[]
  funds: IlpFund[]
  bonuses: IlpBonusRule[]
  discountRate: number
  inflationRate: number
  alternativeReturn: number
  lapseReinstatementRule?: IlpLapseReinstatementRule | null
}

export type ReturnScenario = 'low' | 'mid' | 'high'
export type IlpPolicyStatus = 'in-force' | 'lapsed-reinstatable' | 'lapsed-ended'

export interface IlpAccountYearRow {
  accountId: string
  open: number
  grossFee: number
  bonusCredit: number
  netFee: number
  close: number
}

export interface IlpYearRow {
  year: number
  policyYear: number
  annualContribution: number
  accounts: IlpAccountYearRow[]
  combinedValue: number
  eecRate: number
  eecCharge: number
  surrenderValue: number
  cumulativePremiums: number
  cumulativeGrossFees: number
  cumulativeBonuses: number
  policyStatus: IlpPolicyStatus
  reinstatementWindowYearsRemaining: number
}

export interface IlpProjectionResult {
  scenario: ReturnScenario
  blendedNetReturn: number
  rows: IlpYearRow[]
}

export interface IlpNpvExitOption {
  exitYear: number
  policyYear: number
  eecRate: number
  eecCharge: number
  pvEec: number
  npvGrossFees: number
  npvBonuses: number
  totalNpvFees: number
  netSurrenderValue: number
  totalContributions: number
}

export interface IlpNpvAnalysis {
  surrenderNow: {
    eecRate: number
    eecCharge: number
    npvFees: number
    netSurrenderValue: number
  }
  futureExitOptions: IlpNpvExitOption[]
  bestExitYear: number
  bestExitNpvFees: number
  holdToMip: {
    npvGrossFees: number
    npvBonuses: number
    totalNpvFees: number
    finalValue: number
    totalContributions: number
  }
}

export interface IlpOpportunityCost {
  alternativePortfolioValue: number
  ilpValueAtHorizon: number
  difference: number
  atBestExit: {
    exitYear: number
    alternativeValue: number
    ilpValueAtHorizon: number
    difference: number
  }
}

export interface IlpSummaryMetrics {
  totalPremiumsPaid: number
  totalFeesCharged: number
  totalBonusesReceived: number
  netFeeDrag: number
  currentSurrenderValue: number
  cancelNowPenalty: number
}

export interface IlpPolicyAnalysis {
  policyId: string
  policyName: string
  insurer: string
  currency: IlpPolicyInput['currency']
  projections: Record<ReturnScenario, IlpProjectionResult>
  npvAnalysis: IlpNpvAnalysis
  opportunityCost: IlpOpportunityCost
  summary: IlpSummaryMetrics
}

export interface IlpComparisonRow {
  metric: string
  unit: 'currency' | 'percent' | 'years' | 'text'
  values: Record<string, number | string>
  lowerIsBetter: boolean | null
}

export interface IlpFullAnalysis {
  policies: IlpPolicyAnalysis[]
  comparison: IlpComparisonRow[]
}

const CONTRIBUTION_TOLERANCE = 0.001
const MONTHS_PER_PROJECTION_YEAR = 12
const DEFAULT_MANULIFE_REINSTATEMENT_WINDOW_MONTHS = 36

export const MANULIFE_TEMPORARY_LAPSE_REINSTATEMENT_RULE: IlpLapseReinstatementRule = {
  mode: 'manulife-temporary',
  lapseTrigger: 'policy-value-nonpositive',
  reinstatementWindowMonths: DEFAULT_MANULIFE_REINSTATEMENT_WINDOW_MONTHS,
  freezeValueDuringLapse: true,
  freezeChargesDuringLapse: true,
  manualReinstatementOnly: true,
  metadataOnly: {
    underwriting: true,
    exclusionResets: true,
    claimState: true,
    backpay: true,
  },
}

function assertBeforeMip(input: IlpPolicyInput) {
  if (input.currentPolicyYear >= input.mipLength) {
    throw new Error(
      `Cannot analyze ILP policy "${input.name}": current policy year ${input.currentPolicyYear} is already at or past MIP ${input.mipLength}.`,
    )
  }
}

function getScenarioGrossReturn(fund: IlpFund, scenario: ReturnScenario): number {
  switch (scenario) {
    case 'low':
      return fund.grossReturnLow
    case 'high':
      return fund.grossReturnHigh
    default:
      return fund.grossReturnMid
  }
}

function getTargetAccountIds(bonus: IlpBonusRule, allAccountIds: string[]): string[] {
  return bonus.appliesTo.length > 0 ? bonus.appliesTo : allAccountIds
}

function computeBonusCredit(
  bonuses: IlpBonusRule[],
  allAccountIds: string[],
  accountId: string,
  policyYear: number,
  accountOpenBalance: number,
  annualContribution: number,
): number {
  let total = 0

  for (const bonus of bonuses) {
    const targetIds = getTargetAccountIds(bonus, allAccountIds)
    if (!targetIds.includes(accountId)) continue
    if (policyYear < bonus.startPolicyYear) continue
    if (bonus.endPolicyYear != null && policyYear > bonus.endPolicyYear) continue

    const splitCount = Math.max(targetIds.length, 1)

    switch (bonus.mode) {
      case 'annual-rate':
        total += accountOpenBalance * bonus.rate
        break
      case 'premium-allocation':
        total += (annualContribution * bonus.rate) / splitCount
        break
      case 'one-time':
        if (policyYear === bonus.startPolicyYear) {
          total += bonus.amount / splitCount
        }
        break
    }
  }

  return total
}

function isManulifeProduct(input: IlpPolicyInput): boolean {
  return /\bmanulife\b/i.test(input.insurer)
}

function getEffectiveLapseReinstatementRule(
  input: IlpPolicyInput,
): IlpLapseReinstatementRule | null {
  if (!isManulifeProduct(input)) {
    return null
  }

  return input.lapseReinstatementRule ?? MANULIFE_TEMPORARY_LAPSE_REINSTATEMENT_RULE
}

function toProjectionWindowYears(reinstatementWindowMonths: number): number {
  return Math.max(1, Math.ceil(reinstatementWindowMonths / MONTHS_PER_PROJECTION_YEAR))
}

function getRemainingMipYears(input: IlpPolicyInput): number {
  return Math.max(0, input.mipLength - input.currentPolicyYear)
}

export function computeTotalProjectionYears(input: IlpPolicyInput): number {
  return getRemainingMipYears(input) + input.postMipYears
}

export function getMipEndProjectionIndex(input: IlpPolicyInput): number {
  const remainingMipYears = getRemainingMipYears(input)
  if (remainingMipYears <= 0) {
    throw new Error(`Cannot resolve MIP end row for policy "${input.name}" because it is already mature.`)
  }
  return remainingMipYears - 1
}

export function computeBlendedReturn(
  funds: IlpFund[],
  scenario: ReturnScenario,
): number {
  return funds.reduce((sum, fund) => (
    sum + fund.allocation * (getScenarioGrossReturn(fund, scenario) - fund.ocf)
  ), 0)
}

export function projectIlpPolicy(
  input: IlpPolicyInput,
  scenario: ReturnScenario,
): IlpProjectionResult {
  assertBeforeMip(input)

  const blendedNetReturn = computeBlendedReturn(input.funds, scenario)
  const annualContribution = input.monthlyContribution * 12
  const totalYears = computeTotalProjectionYears(input)
  const accountIds = input.accounts.map((account) => account.id)
  const previousClose = new Map(input.accounts.map((account) => [account.id, account.currentValue]))
  const lapseRule = getEffectiveLapseReinstatementRule(input)
  const rows: IlpYearRow[] = []

  let cumulativeGrossFees = 0
  let cumulativeBonuses = 0
  let lapseWindowYearsRemaining = 0

  for (let year = 1; year <= totalYears; year += 1) {
    const policyYear = input.currentPolicyYear + year
    const isPostMip = policyYear > input.mipLength
    const isLapsed = lapseWindowYearsRemaining > 0
    const contributionForYear = isPostMip || isLapsed ? 0 : annualContribution
    const eecRate = isPostMip || isLapsed ? 0 : lookupEecRate(policyYear, input.eecTable)

    const accountRows: IlpAccountYearRow[] = []
    let combinedValue = 0
    let eecCharge = 0

    for (const account of input.accounts) {
      const open = previousClose.get(account.id) ?? account.currentValue
      if (isLapsed) {
        combinedValue += open
        previousClose.set(account.id, open)
        accountRows.push({
          accountId: account.id,
          open,
          grossFee: 0,
          bonusCredit: 0,
          netFee: 0,
          close: open,
        })
        continue
      }

      const activeFeeRate = isPostMip && account.postMipFeeRate != null
        ? account.postMipFeeRate
        : account.feeRate
      const grossFee = open * activeFeeRate
      const bonusCredit = computeBonusCredit(
        input.bonuses,
        accountIds,
        account.id,
        policyYear,
        open,
        contributionForYear,
      )
      const netFee = grossFee - bonusCredit
      const accountContribution = contributionForYear * account.contributionShare
      const close = (open - netFee) * (1 + blendedNetReturn) + accountContribution

      cumulativeGrossFees += grossFee
      cumulativeBonuses += bonusCredit
      combinedValue += close

      if (account.subjectToEec) {
        eecCharge += close * eecRate
      }

      previousClose.set(account.id, close)
      accountRows.push({
        accountId: account.id,
        open,
        grossFee,
        bonusCredit,
        netFee,
        close,
      })
    }

    let policyStatus: IlpPolicyStatus = isLapsed
      ? (lapseWindowYearsRemaining > 1 ? 'lapsed-reinstatable' : 'lapsed-ended')
      : 'in-force'
    let reinstatementWindowYearsRemaining = isLapsed
      ? Math.max(lapseWindowYearsRemaining - 1, 0)
      : 0

    if (!isLapsed && lapseRule && combinedValue <= 0) {
      combinedValue = 0
      eecCharge = 0
      lapseWindowYearsRemaining = toProjectionWindowYears(lapseRule.reinstatementWindowMonths)
      reinstatementWindowYearsRemaining = lapseWindowYearsRemaining
      policyStatus = 'lapsed-reinstatable'

      for (const accountRow of accountRows) {
        accountRow.close = 0
        previousClose.set(accountRow.accountId, 0)
      }
    } else if (isLapsed) {
      lapseWindowYearsRemaining = Math.max(lapseWindowYearsRemaining - 1, 0)
    }

    const contributionYears = Math.min(year, getRemainingMipYears(input))
    rows.push({
      year,
      policyYear,
      annualContribution: contributionForYear,
      accounts: accountRows,
      combinedValue,
      eecRate,
      eecCharge,
      surrenderValue: combinedValue - eecCharge,
      cumulativePremiums: input.monthlyContribution * (input.monthsAlreadyPaid + contributionYears * 12),
      cumulativeGrossFees: cumulativeGrossFees,
      cumulativeBonuses: cumulativeBonuses,
      policyStatus,
      reinstatementWindowYearsRemaining,
    })
  }

  return {
    scenario,
    blendedNetReturn,
    rows,
  }
}

export function computeNpvAnalysis(
  input: IlpPolicyInput,
  projection: IlpProjectionResult,
): IlpNpvAnalysis {
  assertBeforeMip(input)

  const remainingMipYears = getRemainingMipYears(input)
  if (remainingMipYears <= 0) {
    throw new Error(
      `Cannot compute NPV analysis: policy "${input.name}" is already at or past MIP.`,
    )
  }

  const eecRateNow = lookupEecRate(input.currentPolicyYear, input.eecTable)
  const totalCurrentValue = input.accounts.reduce((sum, account) => sum + account.currentValue, 0)
  const eecChargeNow = input.accounts
    .filter((account) => account.subjectToEec)
    .reduce((sum, account) => sum + account.currentValue * eecRateNow, 0)

  const surrenderNow = {
    eecRate: eecRateNow,
    eecCharge: eecChargeNow,
    npvFees: eecChargeNow,
    netSurrenderValue: totalCurrentValue - eecChargeNow,
  }

  let cumulativeNpvGrossFees = 0
  let cumulativeNpvBonuses = 0
  const futureExitOptions: IlpNpvExitOption[] = []

  for (const row of projection.rows) {
    const discountFactor = Math.pow(1 + input.discountRate, row.year)
    const previousRow = projection.rows[row.year - 2]
    const grossFeesThisYear = row.cumulativeGrossFees - (previousRow?.cumulativeGrossFees ?? 0)
    const bonusesThisYear = row.cumulativeBonuses - (previousRow?.cumulativeBonuses ?? 0)

    cumulativeNpvGrossFees += grossFeesThisYear / discountFactor
    cumulativeNpvBonuses += bonusesThisYear / discountFactor

    const pvEec = row.eecCharge / discountFactor
    futureExitOptions.push({
      exitYear: row.year,
      policyYear: row.policyYear,
      eecRate: row.eecRate,
      eecCharge: row.eecCharge,
      pvEec,
      npvGrossFees: cumulativeNpvGrossFees,
      npvBonuses: cumulativeNpvBonuses,
      totalNpvFees: cumulativeNpvGrossFees - cumulativeNpvBonuses + pvEec,
      netSurrenderValue: row.surrenderValue,
      totalContributions: row.cumulativePremiums,
    })
  }

  const scanLimit = Math.min(remainingMipYears, futureExitOptions.length)
  if (scanLimit <= 0) {
    throw new Error(`Cannot compute best exit year for policy "${input.name}" because it has no pre-MIP rows.`)
  }

  let bestIndex = 0
  for (let index = 1; index < scanLimit; index += 1) {
    if (futureExitOptions[index].totalNpvFees < futureExitOptions[bestIndex].totalNpvFees) {
      bestIndex = index
    }
  }

  const mipEndIndex = getMipEndProjectionIndex(input)
  const mipEndRow = projection.rows[mipEndIndex]
  const mipEndOption = futureExitOptions[mipEndIndex]

  return {
    surrenderNow,
    futureExitOptions,
    bestExitYear: futureExitOptions[bestIndex].exitYear,
    bestExitNpvFees: futureExitOptions[bestIndex].totalNpvFees,
    holdToMip: {
      npvGrossFees: mipEndOption.npvGrossFees,
      npvBonuses: mipEndOption.npvBonuses,
      totalNpvFees: mipEndOption.npvGrossFees - mipEndOption.npvBonuses,
      finalValue: mipEndRow.combinedValue,
      totalContributions: mipEndRow.cumulativePremiums,
    },
  }
}

export function computeOpportunityCost(
  input: IlpPolicyInput,
  projection: IlpProjectionResult,
  npv: IlpNpvAnalysis,
): IlpOpportunityCost {
  const remainingMipYears = getRemainingMipYears(input)
  const annualContribution = input.monthlyContribution * 12
  const horizonRow = projection.rows[getMipEndProjectionIndex(input)]
  const ilpValueAtHorizon = horizonRow.combinedValue
  const growthRate = input.alternativeReturn

  let alternativePortfolioValue = npv.surrenderNow.netSurrenderValue * Math.pow(1 + growthRate, remainingMipYears)
  for (let year = 1; year <= remainingMipYears; year += 1) {
    alternativePortfolioValue += annualContribution * Math.pow(1 + growthRate, remainingMipYears - year)
  }

  const bestExit = npv.futureExitOptions.find((option) => option.exitYear === npv.bestExitYear)
  if (!bestExit) {
    throw new Error(`Best exit year ${npv.bestExitYear} could not be found for policy "${input.name}".`)
  }

  const yearsAfterBestExit = Math.max(remainingMipYears - bestExit.exitYear, 0)
  let alternativeAtBestExit = bestExit.netSurrenderValue * Math.pow(1 + growthRate, yearsAfterBestExit)
  for (let year = 1; year <= yearsAfterBestExit; year += 1) {
    alternativeAtBestExit += annualContribution * Math.pow(1 + growthRate, yearsAfterBestExit - year)
  }

  return {
    alternativePortfolioValue,
    ilpValueAtHorizon,
    difference: alternativePortfolioValue - ilpValueAtHorizon,
    atBestExit: {
      exitYear: bestExit.exitYear,
      alternativeValue: alternativeAtBestExit,
      ilpValueAtHorizon,
      difference: alternativeAtBestExit - ilpValueAtHorizon,
    },
  }
}

export function computeSummaryMetrics(
  input: IlpPolicyInput,
  projection: IlpProjectionResult,
): IlpSummaryMetrics {
  const mipEndRow = projection.rows[getMipEndProjectionIndex(input)]
  const eecRateNow = lookupEecRate(input.currentPolicyYear, input.eecTable)
  const totalCurrentValue = input.accounts.reduce((sum, account) => sum + account.currentValue, 0)
  const cancelNowPenalty = input.accounts
    .filter((account) => account.subjectToEec)
    .reduce((sum, account) => sum + account.currentValue * eecRateNow, 0)

  return {
    totalPremiumsPaid: mipEndRow.cumulativePremiums,
    totalFeesCharged: mipEndRow.cumulativeGrossFees,
    totalBonusesReceived: mipEndRow.cumulativeBonuses,
    netFeeDrag: mipEndRow.cumulativeGrossFees - mipEndRow.cumulativeBonuses,
    currentSurrenderValue: totalCurrentValue - cancelNowPenalty,
    cancelNowPenalty,
  }
}

export function analyzeIlpPolicy(input: IlpPolicyInput): IlpPolicyAnalysis {
  const projections: Record<ReturnScenario, IlpProjectionResult> = {
    low: projectIlpPolicy(input, 'low'),
    mid: projectIlpPolicy(input, 'mid'),
    high: projectIlpPolicy(input, 'high'),
  }
  const npvAnalysis = computeNpvAnalysis(input, projections.mid)
  const opportunityCost = computeOpportunityCost(input, projections.mid, npvAnalysis)
  const summary = computeSummaryMetrics(input, projections.mid)

  return {
    policyId: input.id,
    policyName: input.name,
    insurer: input.insurer,
    currency: input.currency,
    projections,
    npvAnalysis,
    opportunityCost,
    summary,
  }
}

export function buildComparisonTable(
  analyses: IlpPolicyAnalysis[],
  policyCurrencies: Record<string, IlpPolicyInput['currency']>,
): IlpComparisonRow[] {
  if (analyses.length < 2) return []

  const sameCurrency = new Set(Object.values(policyCurrencies)).size === 1
  const currencyRule = (lowerIsBetter: boolean): boolean | null => (sameCurrency ? lowerIsBetter : null)
  const valuesFor = (picker: (analysis: IlpPolicyAnalysis) => number | string): Record<string, number | string> =>
    Object.fromEntries(analyses.map((analysis) => [analysis.policyId, picker(analysis)]))

  return [
    { metric: 'Insurer', unit: 'text', lowerIsBetter: null, values: valuesFor((analysis) => analysis.insurer || 'Unknown') },
    { metric: 'Projection Horizon', unit: 'years', lowerIsBetter: null, values: valuesFor((analysis) => analysis.projections.mid.rows.length) },
    { metric: 'Total Premiums Paid (to MIP)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.totalPremiumsPaid) },
    { metric: 'Total Fees Charged (gross, to MIP)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.totalFeesCharged) },
    { metric: 'Bonuses Received (to MIP)', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.summary.totalBonusesReceived) },
    { metric: 'Net Fee Drag (to MIP)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.netFeeDrag) },
    {
      metric: 'Fee Drag % of Premiums',
      unit: 'percent',
      lowerIsBetter: true,
      values: valuesFor((analysis) => (
        analysis.summary.totalPremiumsPaid > CONTRIBUTION_TOLERANCE
          ? analysis.summary.netFeeDrag / analysis.summary.totalPremiumsPaid
          : 0
      )),
    },
    { metric: 'Cancel-Now Penalty', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.summary.cancelNowPenalty) },
    { metric: 'Surrender Value Today', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.summary.currentSurrenderValue) },
    { metric: 'NPV Fees (Surrender Now)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.npvAnalysis.surrenderNow.npvFees) },
    { metric: 'Best Exit Year', unit: 'years', lowerIsBetter: null, values: valuesFor((analysis) => analysis.npvAnalysis.bestExitYear) },
    { metric: 'NPV Fees (Best Exit)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.npvAnalysis.bestExitNpvFees) },
    { metric: 'NPV Fees (Hold to MIP)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.npvAnalysis.holdToMip.totalNpvFees) },
    { metric: 'Final Value (MIP end, mid)', unit: 'currency', lowerIsBetter: currencyRule(false), values: valuesFor((analysis) => analysis.npvAnalysis.holdToMip.finalValue) },
    { metric: 'Opportunity Cost (vs surrender now)', unit: 'currency', lowerIsBetter: currencyRule(true), values: valuesFor((analysis) => analysis.opportunityCost.difference) },
  ]
}

export function analyzeAllPolicies(inputs: IlpPolicyInput[]): IlpFullAnalysis {
  const policies = inputs.map(analyzeIlpPolicy)
  const policyCurrencies = Object.fromEntries(inputs.map((policy) => [policy.id, policy.currency]))
  return {
    policies,
    comparison: buildComparisonTable(policies, policyCurrencies),
  }
}
