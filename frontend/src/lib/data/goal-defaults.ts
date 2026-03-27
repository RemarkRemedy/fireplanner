/**
 * Goal calculator defaults and SG-specific price data.
 *
 * Sources:
 * - HDB prices: HDB resale price index + BTO launch prices (2025-2026)
 *   https://www.hdb.gov.sg/residential/buying-a-flat/finding-a-flat/resale-flat-prices
 * - ARF brackets: LTA (https://www.lta.gov.sg/content/ltagov/en/industry_innovations/industry_matters/regulations_licensing/vehicles/vehicle_tax_structure.html)
 * - COE premiums: LTA COE bidding results (Mar 2026 indicative)
 * - Renovation/legal: Industry averages from HomeRenoGuru, Qanvast (2025-2026)
 *
 * Downloaded: 2026-03-27
 */

import type { GoalCategory } from '../types'

/** Data vintage for staleness checks. */
export const GOAL_DATA_VINTAGE = '2026-03-27'

// ============================================================
// HDB Price Ranges
// ============================================================

export interface PriceRange {
  low: number
  high: number
  midpoint: number
}

type HdbFlatType = '3-room' | '4-room' | '5-room' | 'executive'
type HdbTenure = 'new' | 'resale'

const HDB_PRICES: Record<HdbFlatType, Record<HdbTenure, { low: number; high: number }>> = {
  '3-room': { new: { low: 200_000, high: 350_000 }, resale: { low: 300_000, high: 450_000 } },
  '4-room': { new: { low: 300_000, high: 500_000 }, resale: { low: 400_000, high: 600_000 } },
  '5-room': { new: { low: 400_000, high: 600_000 }, resale: { low: 500_000, high: 750_000 } },
  executive: { new: { low: 500_000, high: 700_000 }, resale: { low: 600_000, high: 850_000 } },
}

export function getHdbPriceRange(flatType: HdbFlatType, tenure: HdbTenure): PriceRange {
  const { low, high } = HDB_PRICES[flatType][tenure]
  return { low, high, midpoint: (low + high) / 2 }
}

// ============================================================
// Condo / Landed / EC Brackets
// ============================================================

export function getCondoBrackets(): number[] {
  return [1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 3_500_000]
}

export function getLandedBrackets(): number[] {
  return [3_000_000, 5_000_000, 8_000_000]
}

/**
 * EC launch price brackets (Q1 2026 estimate).
 * Source: HDB / CEA new EC launch data, indicative ranges.
 */
export function getEcBrackets(): number[] {
  return [1_200_000, 1_500_000, 1_800_000, 2_000_000]
}

// ============================================================
// Down Payment Helpers
// ============================================================

export function computeHdbDownPayment(
  price: number,
  loanType: 'hdb-loan' | 'bank-loan',
): number {
  const rate = loanType === 'hdb-loan' ? 0.10 : 0.25
  return price * rate
}

export function computeCondoDownPayment(price: number): {
  total: number
  cashMinimum: number
} {
  return {
    total: price * 0.25,
    cashMinimum: price * 0.05,
  }
}

// ============================================================
// Vehicle: ARF, COE, Purchase Cost
// ============================================================

/**
 * Additional Registration Fee brackets: [bracketSize, rate].
 * Source: LTA vehicle tax structure.
 * - First $20K of OMV at 100%
 * - Next $30K of OMV at 140%
 * - Remainder at 180%
 */
export const ARF_BRACKETS: [number, number][] = [
  [20_000, 1.0],
  [30_000, 1.4],
  [Infinity, 1.8],
]

export function computeArf(omv: number): number {
  let remaining = omv
  let arf = 0
  for (const [bracketSize, rate] of ARF_BRACKETS) {
    if (remaining <= 0) break
    const taxable = Math.min(remaining, bracketSize)
    arf += taxable * rate
    remaining -= taxable
  }
  return arf
}

/**
 * Indicative COE premiums by category.
 * Source: LTA COE bidding results, Mar 2026 indicative.
 * A = Cars up to 1600cc / 97kW, B = Cars above 1600cc / 97kW
 */
export const COE_ESTIMATES: Record<'A' | 'B', number> = {
  A: 90_000,
  B: 110_000,
}

/**
 * Estimated OMV by price range (keys in dollars, not thousands).
 * Used to approximate ARF from a user-selected price bracket.
 */
const OMV_LOOKUP: Record<number, number> = {
  20_000: 15_000,
  30_000: 20_000,
  40_000: 28_000,
  50_000: 35_000,
  60_000: 42_000,
  80_000: 55_000,
}

export interface CarCostBreakdown {
  coe: number
  omv: number
  arf: number
  total: number
}

/**
 * Compute estimated car purchase cost breakdown.
 * For used cars, COE is assumed already included in the price (set to 0).
 */
export function getCarPurchaseCost(
  coeCategory: 'A' | 'B',
  condition: 'new' | 'used',
  priceRange: number,
): CarCostBreakdown {
  const coe = condition === 'new' ? COE_ESTIMATES[coeCategory] : 0
  const omv = OMV_LOOKUP[priceRange] ?? 0
  const arf = computeArf(omv)
  return { coe, omv, arf, total: coe + omv + arf }
}

// ============================================================
// Property Ancillary Costs
// ============================================================

export type PropertyType = 'hdb' | 'condo' | 'landed' | 'ec'

const RENOVATION_ESTIMATES: Record<PropertyType, number> = {
  hdb: 40_000,
  condo: 60_000,
  ec: 60_000,
  landed: 100_000,
}

export function getRenovationEstimate(propertyType: PropertyType): number {
  return RENOVATION_ESTIMATES[propertyType]
}

const LEGAL_FEES: Record<PropertyType, number> = {
  hdb: 3_000,
  condo: 5_000,
  ec: 5_000,
  landed: 5_000,
}

export function getLegalFees(propertyType: PropertyType): number {
  return LEGAL_FEES[propertyType]
}

// ============================================================
// Vehicle: Hire Purchase Down Payment
// ============================================================

/**
 * MAS minimum down payment for vehicle hire purchase: 40% of purchase price.
 * Applies to both new and used cars. The remaining 60% is financed
 * via hire purchase (max 7-year tenure).
 */
export const CAR_DOWN_PAYMENT_RATE = 0.40

/** Typical HP interest rate (flat rate, ~2.8% p.a.) */
export const CAR_HP_RATE = 0.028

/** Standard HP max tenure in years */
export const CAR_HP_TENURE_YEARS = 7

/**
 * Compute total hire purchase repayment (principal + interest).
 * Uses flat rate calculation (SG convention for car loans).
 * Flat rate total = principal + (principal * rate * years).
 */
export function computeCarHpTotal(financedAmount: number, rate: number = CAR_HP_RATE, years: number = CAR_HP_TENURE_YEARS): number {
  return financedAmount + (financedAmount * rate * years)
}

// ============================================================
// Simple Goal Defaults
// ============================================================

export const SIMPLE_GOAL_DEFAULTS: Record<'wedding' | 'travel' | 'education' | 'business', number> = {
  wedding: 50_000,
  travel: 30_000,
  education: 300_000,
  business: 100_000,
}

// ============================================================
// Goal Tiles
// ============================================================

export type GoalTileId =
  | 'hdb' | 'condo' | 'landed' | 'ec' | 'car'
  | 'wedding' | 'travel' | 'education' | 'business' | 'custom'

export interface GoalTile {
  id: GoalTileId
  label: string
  /** Lucide icon name */
  icon: string
  category: GoalCategory
  type: 'smart' | 'simple'
  hint?: string
}

export const GOAL_TILES: GoalTile[] = [
  { id: 'hdb', label: 'HDB Flat', icon: 'Building2', category: 'housing', type: 'smart', hint: 'BTO or resale' },
  { id: 'condo', label: 'Condo', icon: 'Building', category: 'housing', type: 'smart', hint: 'With ABSD' },
  { id: 'landed', label: 'Landed', icon: 'Home', category: 'housing', type: 'smart', hint: 'Semi-D, terrace' },
  { id: 'ec', label: 'EC', icon: 'Landmark', category: 'housing', type: 'smart', hint: 'Executive Condo' },
  { id: 'car', label: 'Car', icon: 'Car', category: 'vehicle', type: 'smart', hint: 'COE included' },
  { id: 'wedding', label: 'Wedding', icon: 'Heart', category: 'wedding', type: 'simple', hint: 'SG average' },
  { id: 'travel', label: 'Travel', icon: 'Plane', category: 'travel', type: 'simple', hint: 'Set your budget' },
  { id: 'education', label: 'Education', icon: 'GraduationCap', category: 'education', type: 'simple', hint: 'Degree, masters' },
  { id: 'business', label: 'Business', icon: 'Briefcase', category: 'other', type: 'simple', hint: 'Seed capital' },
  { id: 'custom', label: 'Custom Goal', icon: 'Target', category: 'other', type: 'simple', hint: 'Your own goal' },
]

/** Section groupings for the GoalPicker grid */
export const GOAL_TILE_SECTIONS: { label: string; tileIds: GoalTileId[] }[] = [
  { label: 'Property', tileIds: ['hdb', 'condo', 'landed', 'ec'] },
  { label: 'Lifestyle', tileIds: ['car', 'wedding', 'travel'] },
  { label: 'Growth', tileIds: ['education', 'business', 'custom'] },
]

// ============================================================
// Goal Calculator V1.5 Data (SG-specific)
// Vintage: GOAL_DATA_VINTAGE
// Source: HDB.gov.sg (grants), IRAS (tax), CPF Board (rates), MOM (benchmarks)
// NOTE: EHG amounts need verification against HDB.gov.sg before production
// ============================================================

// ---- Enhanced CPF Housing Grant (post-NDR Aug 2024) ----
// Source: HDB.gov.sg + DollarsAndSense/Sethisfy verified tables
// Family: 16 brackets at $500 steps, ceiling $9,000
// Single: 16 brackets at $250 steps, ceiling $4,500

export interface EhgBracket {
  maxIncome: number
  grant: number
}

export const EHG_FAMILY_TABLE: EhgBracket[] = [
  { maxIncome: 1_500, grant: 120_000 },
  { maxIncome: 2_000, grant: 110_000 },
  { maxIncome: 2_500, grant: 105_000 },
  { maxIncome: 3_000, grant: 95_000 },
  { maxIncome: 3_500, grant: 90_000 },
  { maxIncome: 4_000, grant: 80_000 },
  { maxIncome: 4_500, grant: 70_000 },
  { maxIncome: 5_000, grant: 65_000 },
  { maxIncome: 5_500, grant: 55_000 },
  { maxIncome: 6_000, grant: 50_000 },
  { maxIncome: 6_500, grant: 40_000 },
  { maxIncome: 7_000, grant: 30_000 },
  { maxIncome: 7_500, grant: 25_000 },
  { maxIncome: 8_000, grant: 20_000 },
  { maxIncome: 8_500, grant: 10_000 },
  { maxIncome: 9_000, grant: 5_000 },
]

export const EHG_SINGLE_TABLE: EhgBracket[] = [
  { maxIncome: 750, grant: 60_000 },
  { maxIncome: 1_000, grant: 55_000 },
  { maxIncome: 1_250, grant: 52_500 },
  { maxIncome: 1_500, grant: 47_500 },
  { maxIncome: 1_750, grant: 45_000 },
  { maxIncome: 2_000, grant: 40_000 },
  { maxIncome: 2_250, grant: 35_000 },
  { maxIncome: 2_500, grant: 32_500 },
  { maxIncome: 2_750, grant: 27_500 },
  { maxIncome: 3_000, grant: 25_000 },
  { maxIncome: 3_250, grant: 20_000 },
  { maxIncome: 3_500, grant: 15_000 },
  { maxIncome: 3_750, grant: 12_500 },
  { maxIncome: 4_000, grant: 10_000 },
  { maxIncome: 4_250, grant: 5_000 },
  { maxIncome: 4_500, grant: 2_500 },
]

// ---- Resale Flat Family Grant ----

export const FAMILY_GRANT = {
  fourRoomOrSmaller: 80_000,  // 2-room, 3-room, 4-room
  fiveRoomOrLarger: 50_000,   // 5-room, executive
}

// ---- HDB BTO Income Ceilings ----

export const HDB_INCOME_CEILING = {
  single: 7_000,   // $7,000/mo gross
  couple: 14_000,   // $14,000/mo gross
}

// ---- EC Income Ceilings ----
// Source: HDB.gov.sg — EC eligibility criteria (as at 2026)

export const EC_INCOME_CEILING = {
  single: 8_000,   // $8,000/mo gross (singles not eligible for new EC; used for reference)
  couple: 16_000,  // $16,000/mo gross household ceiling
}

// ---- CPF LIFE Estimated Monthly Payouts ----

export interface CpfLifeBand {
  minIncome: number
  maxIncome: number
  estimatedPayout: number  // monthly
}

export const CPF_LIFE_ESTIMATES: CpfLifeBand[] = [
  { minIncome: 0, maxIncome: 3_000, estimatedPayout: 500 },
  { minIncome: 3_000, maxIncome: 4_000, estimatedPayout: 800 },
  { minIncome: 4_000, maxIncome: 5_000, estimatedPayout: 1_000 },
  { minIncome: 5_000, maxIncome: 6_000, estimatedPayout: 1_200 },
  { minIncome: 6_000, maxIncome: 8_000, estimatedPayout: 1_500 },
  { minIncome: 8_000, maxIncome: Infinity, estimatedPayout: 1_800 },
]

// ---- Peer Savings Rate Benchmarks ----

export interface PeerBenchmark {
  minAge: number
  maxAge: number
  percentiles: { rate: number; percentile: number }[]  // sorted ascending by rate
}

export const PEER_BENCHMARKS: PeerBenchmark[] = [
  {
    minAge: 18,
    maxAge: 29,
    percentiles: [
      { rate: 0.10, percentile: 25 },
      { rate: 0.20, percentile: 40 },
      { rate: 0.30, percentile: 55 },
      { rate: 0.40, percentile: 70 },
      { rate: 0.50, percentile: 85 },
    ],
  },
  {
    minAge: 30,
    maxAge: 39,
    percentiles: [
      { rate: 0.10, percentile: 25 },
      { rate: 0.20, percentile: 40 },
      { rate: 0.30, percentile: 55 },
      { rate: 0.40, percentile: 70 },
      { rate: 0.50, percentile: 85 },
    ],
  },
  {
    minAge: 40,
    maxAge: 49,
    percentiles: [
      { rate: 0.10, percentile: 25 },
      { rate: 0.20, percentile: 40 },
      { rate: 0.30, percentile: 55 },
      { rate: 0.40, percentile: 70 },
      { rate: 0.50, percentile: 85 },
    ],
  },
]

// ---- Mortgage Interest Rates ----

export const MORTGAGE_RATES = {
  hdb: 0.026,    // 2.6% HDB concessionary
  bank: 0.03,    // 3.0% conservative market rate
}

/** Standard loan tenures in years */
export const LOAN_TENURE_YEARS = {
  hdb: 25,
  bank: 30,
}

/** LTV ratios by loan type */
export const LTV_RATIOS = {
  'hdb-loan': 0.90,
  'bank-loan': 0.75,
}

/**
 * Compute total mortgage repayment (principal + interest) using PMT formula.
 * Returns the total amount paid over the full tenure.
 */
export function computeMortgageTotal(
  loanAmount: number,
  annualRate: number,
  tenureYears: number,
): number {
  if (loanAmount <= 0) return 0
  const monthlyRate = annualRate / 12
  const totalPayments = tenureYears * 12
  if (monthlyRate < 1e-10) return loanAmount

  const factor = Math.pow(1 + monthlyRate, totalPayments)
  const monthlyPayment = loanAmount * (monthlyRate * factor) / (factor - 1)
  return monthlyPayment * totalPayments
}
