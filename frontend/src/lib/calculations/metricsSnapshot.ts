export interface MetricsSnapshot {
  fireAge: number | null
  fireNumber: number | null
  /** Key input drivers for generating delta explanations */
  drivers?: {
    annualIncome: number
    annualExpenses: number
    annualSavings: number
    savingsRate: number
    totalNetWorth: number
    swr: number
    monthlyDebtPayments: number
  }
}

export interface DriverDelta {
  label: string
  before: number
  after: number
  /** Pre-formatted change description */
  change: string
}

export interface DeltaSummary {
  label: string
  deltas: Array<{
    metric: string
    before: number
    after: number
    formatted: string
  }>
  explanation: string
  /** Dynamic explanation of what drove the FIRE metric changes */
  driverExplanation: string | null
  /** Individual driver changes for detailed display */
  driverDeltas: DriverDelta[]
  isSignificant: boolean
}

/** Normalize a snapshot value: round to integer, convert non-finite to null */
function normalize(value: number | null): number | null {
  if (value === null || !isFinite(value)) return null
  return Math.round(value)
}

const fmtDollar = (v: number) => `$${Math.abs(Math.round(v)).toLocaleString()}`
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

function buildDriverExplanation(
  before: MetricsSnapshot,
  after: MetricsSnapshot,
): { explanation: string | null; driverDeltas: DriverDelta[] } {
  const b = before.drivers
  const a = after.drivers
  if (!b || !a) return { explanation: null, driverDeltas: [] }

  const driverDeltas: DriverDelta[] = []
  const reasons: string[] = []

  // Income change
  const incomeDiff = a.annualIncome - b.annualIncome
  if (Math.abs(incomeDiff) >= 100) {
    const dir = incomeDiff > 0 ? 'increased' : 'decreased'
    driverDeltas.push({
      label: 'Annual income',
      before: b.annualIncome,
      after: a.annualIncome,
      change: `${dir} by ${fmtDollar(incomeDiff)}/yr`,
    })
    reasons.push(`income ${dir} by ${fmtDollar(incomeDiff)}/yr`)
  }

  // Expenses change
  const expDiff = a.annualExpenses - b.annualExpenses
  if (Math.abs(expDiff) >= 100) {
    const dir = expDiff > 0 ? 'increased' : 'decreased'
    driverDeltas.push({
      label: 'Annual expenses',
      before: b.annualExpenses,
      after: a.annualExpenses,
      change: `${dir} by ${fmtDollar(expDiff)}/yr`,
    })
    reasons.push(`expenses ${dir} by ${fmtDollar(expDiff)}/yr`)
  }

  // Debt payments change
  const debtDiff = a.monthlyDebtPayments - b.monthlyDebtPayments
  if (Math.abs(debtDiff) >= 10) {
    const annual = Math.abs(debtDiff) * 12
    const dir = debtDiff > 0 ? 'added' : 'removed'
    driverDeltas.push({
      label: 'Monthly debt payments',
      before: b.monthlyDebtPayments,
      after: a.monthlyDebtPayments,
      change: `${dir} ${fmtDollar(debtDiff)}/mo (${fmtDollar(annual)}/yr)`,
    })
    reasons.push(`debt payments ${dir}: ${fmtDollar(Math.abs(debtDiff))}/mo`)
  }

  // Savings rate change
  const srDiff = a.savingsRate - b.savingsRate
  if (Math.abs(srDiff) >= 0.005) {
    const dir = srDiff > 0 ? 'improved' : 'dropped'
    driverDeltas.push({
      label: 'Savings rate',
      before: b.savingsRate,
      after: a.savingsRate,
      change: `${dir} from ${fmtPct(b.savingsRate)} to ${fmtPct(a.savingsRate)}`,
    })
    reasons.push(`savings rate ${dir} to ${fmtPct(a.savingsRate)}`)
  }

  // Net worth change
  const nwDiff = a.totalNetWorth - b.totalNetWorth
  if (Math.abs(nwDiff) >= 1000) {
    const dir = nwDiff > 0 ? 'increased' : 'decreased'
    driverDeltas.push({
      label: 'Net worth',
      before: b.totalNetWorth,
      after: a.totalNetWorth,
      change: `${dir} by ${fmtDollar(nwDiff)}`,
    })
  }

  // SWR change
  const swrDiff = a.swr - b.swr
  if (Math.abs(swrDiff) >= 0.001) {
    const dir = swrDiff > 0 ? 'increased' : 'decreased'
    driverDeltas.push({
      label: 'Withdrawal rate',
      before: b.swr,
      after: a.swr,
      change: `${dir} from ${fmtPct(b.swr)} to ${fmtPct(a.swr)}`,
    })
    reasons.push(`withdrawal rate ${dir} to ${fmtPct(a.swr)}`)
  }

  if (reasons.length === 0) return { explanation: null, driverDeltas }

  return {
    explanation: reasons.join('. ') + '.',
    driverDeltas,
  }
}

export function computeDelta(
  before: MetricsSnapshot,
  after: MetricsSnapshot,
  label: string,
  explanation: string
): DeltaSummary {
  const deltas: DeltaSummary['deltas'] = []

  const bAge = normalize(before.fireAge)
  const aAge = normalize(after.fireAge)

  if (bAge !== null && aAge !== null) {
    const diff = aAge - bAge
    deltas.push({
      metric: 'FIRE age',
      before: bAge,
      after: aAge,
      formatted: diff === 0
        ? 'No change'
        : diff < 0
          ? `${Math.abs(diff)} year${Math.abs(diff) !== 1 ? 's' : ''} earlier`
          : `${diff} year${diff !== 1 ? 's' : ''} later`,
    })
  }

  const bNum = normalize(before.fireNumber)
  const aNum = normalize(after.fireNumber)

  if (bNum !== null && aNum !== null) {
    const diff = aNum - bNum
    const sign = diff >= 0 ? '+' : '-'
    deltas.push({
      metric: 'FIRE number',
      before: bNum,
      after: aNum,
      formatted: `${sign}$${Math.abs(diff).toLocaleString()}`,
    })
  }

  const isSignificant = deltas.some(d => d.before !== d.after)

  const { explanation: driverExplanation, driverDeltas } = buildDriverExplanation(before, after)

  return { label, deltas, explanation, driverExplanation, driverDeltas, isSignificant }
}
