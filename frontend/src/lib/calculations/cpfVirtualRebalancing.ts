import { FRS_BASE, BRS_GROWTH_RATE, RETIREMENT_SUM_BASE_YEAR } from '@/lib/data/cpfRates'

export interface VirtualRebalancingInput {
  weights: number[]
  liquidNW: number
  cpfOA: number
  cpfSA: number
  cpfRA: number
  cpfisOA: number
  cpfisSA: number
  age: number
  currentYear: number
  mode: 'from55' | 'always'
  includeSA: boolean
}

export interface VirtualRebalancingResult {
  adjustedWeights: number[]
  cpfCountedAsBonds: number
}

// Asset class indices matching the 8-class allocation model
const BOND_INDICES = [3]   // Bonds
const CASH_INDICES = [6]   // Cash
const CPF_INDICES = [7]    // CPF (OA+SA blend — CPFIS-invested)
const CONSERVATIVE_INDICES = [...BOND_INDICES, ...CASH_INDICES, ...CPF_INDICES]
// Equity/growth indices: US Eq(0), SG Eq(1), Intl Eq(2), REITs(4), Gold(5)
const GROWTH_INDICES = [0, 1, 2, 4, 5]

/**
 * Compute virtual rebalancing that counts uninvested CPF as bond allocation.
 *
 * When a retiree has uninvested CPF earning guaranteed 2.5%/4%, that CPF
 * functions like bonds. This function reduces the conservative (bond/cash/CPF)
 * weights in the liquid portfolio and proportionally increases growth weights,
 * so the overall combined portfolio (liquid + CPF) still matches the user's
 * target allocation.
 *
 * CPFIS-invested CPF is already counted in the CPF asset class (equity-like)
 * and is excluded from the bond count.
 */
export function computeVirtualRebalancing(input: VirtualRebalancingInput): VirtualRebalancingResult {
  const noChange: VirtualRebalancingResult = {
    adjustedWeights: input.weights,
    cpfCountedAsBonds: 0,
  }

  // Before age 55 in 'from55' mode, CPF is locked — no virtual rebalancing
  if (input.mode === 'from55' && input.age < 55) return noChange

  // No liquid portfolio to rebalance
  if (input.liquidNW <= 0) return noChange

  // Project the FRS for the year this person turns 55
  const yearsUntil55 = Math.max(0, 55 - input.age)
  const yearsSinceBase = Math.max(0, input.currentYear - RETIREMENT_SUM_BASE_YEAR)
  const frs = FRS_BASE * Math.pow(1 + BRS_GROWTH_RATE, yearsUntil55 + yearsSinceBase)

  // RA must meet FRS before OA is available for withdrawal
  const raGapToFRS = Math.max(0, frs - input.cpfRA)

  // Only uninvested CPF counts as bonds (CPFIS-invested is equity-like)
  const uninvestedOA = Math.max(0, input.cpfOA - input.cpfisOA)
  const uninvestedSA = input.includeSA ? Math.max(0, input.cpfSA - input.cpfisSA) : 0

  // OA must first fill any RA gap to FRS before it's "withdrawable"
  const withdrawableOA = Math.max(0, uninvestedOA - raGapToFRS)
  const totalCpfAsBonds = withdrawableOA + uninvestedSA

  if (totalCpfAsBonds <= 0) return noChange

  // Determine what fraction of the total investable portfolio CPF bonds represent
  const totalInvestable = input.liquidNW + totalCpfAsBonds
  const cpfBondShare = totalCpfAsBonds / totalInvestable

  // Current conservative target in user's allocation
  const conservativeTarget = CONSERVATIVE_INDICES.reduce(
    (sum, i) => sum + (input.weights[i] ?? 0),
    0,
  )

  // Reduce conservative target by the CPF bond share (floored at 0)
  const liquidConservativeTarget = Math.max(0, conservativeTarget - cpfBondShare)
  const freedAllocation = conservativeTarget - liquidConservativeTarget

  if (freedAllocation <= 0) return noChange

  // Current growth target in user's allocation
  const growthWeightTotal = GROWTH_INDICES.reduce(
    (sum, i) => sum + (input.weights[i] ?? 0),
    0,
  )

  const adjusted = [...input.weights]

  // Scale down conservative weights proportionally
  const conservativeScale = liquidConservativeTarget / conservativeTarget
  for (const i of CONSERVATIVE_INDICES) {
    adjusted[i] = (input.weights[i] ?? 0) * conservativeScale
  }

  // Scale up growth weights proportionally to absorb freed allocation
  if (growthWeightTotal > 0) {
    const growthScale = (growthWeightTotal + freedAllocation) / growthWeightTotal
    for (const i of GROWTH_INDICES) {
      adjusted[i] = (input.weights[i] ?? 0) * growthScale
    }
  }

  return {
    adjustedWeights: adjusted,
    cpfCountedAsBonds: totalCpfAsBonds,
  }
}
