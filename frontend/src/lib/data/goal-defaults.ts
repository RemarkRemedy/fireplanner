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
// Condo / Landed Brackets
// ============================================================

export function getCondoBrackets(): number[] {
  return [1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 3_500_000]
}

export function getLandedBrackets(): number[] {
  return [3_000_000, 5_000_000, 8_000_000]
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

type PropertyType = 'hdb' | 'condo' | 'landed'

const RENOVATION_ESTIMATES: Record<PropertyType, number> = {
  hdb: 40_000,
  condo: 60_000,
  landed: 100_000,
}

export function getRenovationEstimate(propertyType: PropertyType): number {
  return RENOVATION_ESTIMATES[propertyType]
}

const LEGAL_FEES: Record<PropertyType, number> = {
  hdb: 3_000,
  condo: 5_000,
  landed: 5_000,
}

export function getLegalFees(propertyType: PropertyType): number {
  return LEGAL_FEES[propertyType]
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
  | 'hdb' | 'condo' | 'landed' | 'car'
  | 'wedding' | 'travel' | 'education' | 'business' | 'custom'

export interface GoalTile {
  id: GoalTileId
  label: string
  /** Lucide icon name */
  icon: string
  category: GoalCategory
  type: 'smart' | 'simple'
}

export const GOAL_TILES: GoalTile[] = [
  { id: 'hdb', label: 'HDB Flat', icon: 'Building2', category: 'housing', type: 'smart' },
  { id: 'condo', label: 'Condo', icon: 'Building', category: 'housing', type: 'smart' },
  { id: 'landed', label: 'Landed', icon: 'Home', category: 'housing', type: 'smart' },
  { id: 'car', label: 'Car', icon: 'Car', category: 'vehicle', type: 'smart' },
  { id: 'wedding', label: 'Wedding', icon: 'Heart', category: 'wedding', type: 'simple' },
  { id: 'travel', label: 'Travel', icon: 'Plane', category: 'travel', type: 'simple' },
  { id: 'education', label: 'Education', icon: 'GraduationCap', category: 'education', type: 'simple' },
  { id: 'business', label: 'Business', icon: 'Briefcase', category: 'other', type: 'simple' },
  { id: 'custom', label: 'Custom Goal', icon: 'Target', category: 'other', type: 'simple' },
]
