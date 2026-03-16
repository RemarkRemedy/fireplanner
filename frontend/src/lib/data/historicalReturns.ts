// Historical Return Data — Summary Statistics for 8 Asset Classes
// Sources:
//   US Equities (S&P 500): Damodaran/NYU Stern, 1928-2024 (Academic/free)
//   SG Equities (STI): SGX + MAS, 1987-2024 (SG Open Data License)
//   Intl Equities (MSCI World): MSCI, 1970-2024 (Free for personal use, attribute MSCI)
//   Bonds (10-yr Treasury): FRED, 1928-2024 (Public domain)
//   REITs (FTSE NAREIT): 1972-2024 (Free with attribution)
//   Gold: World Gold Council / LBMA, 1968-2024 (Free non-commercial)
//   Cash (3-month T-Bill): FRED, 1928-2024 (Public domain)
//   CPF (OA+SA blend): CPF Board published rates (Public)
// Downloaded: 2024-12-01
// Note: Default expected returns are forward-looking estimates (not full historical averages).
//   Standard deviations from historical data. Full time series stays in historicalReturnsFull.ts.

import type { AssetClass, AssetClassData, AllocationTemplate } from '@/lib/types'

export const ASSET_CLASSES: AssetClassData[] = [
  { key: 'usEquities',   label: 'US Equities (S&P 500)',     expectedReturn: 0.070, stdDev: 0.155 },
  { key: 'sgEquities',   label: 'SG Equities (STI)',         expectedReturn: 0.070, stdDev: 0.180 },
  { key: 'intlEquities', label: 'Intl Equities (MSCI World)', expectedReturn: 0.071, stdDev: 0.160 },
  { key: 'bonds',        label: 'Bonds (10-yr Treasury)',     expectedReturn: 0.030, stdDev: 0.055 },
  { key: 'reits',        label: 'REITs',                      expectedReturn: 0.050, stdDev: 0.185 },
  { key: 'gold',         label: 'Gold',                       expectedReturn: 0.030, stdDev: 0.150 },
  { key: 'cash',         label: 'Cash (T-Bills)',             expectedReturn: 0.014, stdDev: 0.010 },
  { key: 'cpf',          label: 'CPF (OA+SA Blend)',          expectedReturn: 0.030, stdDev: 0.000 },
]

/**
 * 8×8 correlation matrix for the asset classes.
 * Order matches ASSET_CLASSES: US Eq, SG Eq, Intl Eq, Bonds, REITs, Gold, Cash, CPF.
 * Estimated from overlapping historical data periods.
 * Diagonal is always 1.00. CPF has 0 correlation with all risky assets (guaranteed rate).
 */
export const CORRELATION_MATRIX: number[][] = [
  // US Eq   SG Eq   Intl    Bonds   REITs   Gold    Cash    CPF
  [  1.00,   0.55,   0.85,  -0.05,   0.60,   0.05,   0.02,   0.00 ], // US Equities
  [  0.55,   1.00,   0.65,  -0.10,   0.50,   0.10,   0.02,   0.00 ], // SG Equities
  [  0.85,   0.65,   1.00,  -0.03,   0.55,   0.08,   0.02,   0.00 ], // Intl Equities
  [ -0.05,  -0.10,  -0.03,   1.00,   0.15,   0.20,   0.30,   0.00 ], // Bonds
  [  0.60,   0.50,   0.55,   0.15,   1.00,   0.10,   0.05,   0.00 ], // REITs
  [  0.05,   0.10,   0.08,   0.20,   0.10,   1.00,   0.05,   0.00 ], // Gold
  [  0.02,   0.02,   0.02,   0.30,   0.05,   0.05,   1.00,   0.00 ], // Cash
  [  0.00,   0.00,   0.00,   0.00,   0.00,   0.00,   0.00,   1.00 ], // CPF
]

/**
 * 5 pre-built allocation templates.
 * Weights are percentages (0-1) in asset class order, must sum to 1.0.
 * Order: US Eq, SG Eq, Intl Eq, Bonds, REITs, Gold, Cash, CPF
 * CPF is always 0 — CPF balances are tracked separately in the CPF section.
 */
export const ALLOCATION_TEMPLATES: Record<Exclude<AllocationTemplate, 'custom'>, number[]> = {
  conservative:     [0.15, 0.05, 0.05, 0.50, 0.05, 0.05, 0.15, 0.00],
  balanced:         [0.30, 0.10, 0.10, 0.30, 0.05, 0.05, 0.10, 0.00],
  aggressive:       [0.50, 0.15, 0.15, 0.10, 0.05, 0.05, 0.00, 0.00],
  allWeather:       [0.30, 0.00, 0.00, 0.40, 0.00, 0.15, 0.15, 0.00],
  singaporeCentric: [0.15, 0.30, 0.10, 0.20, 0.10, 0.05, 0.10, 0.00],
}

/** Very conservative glide path end allocation (~10% equity, ~90% bonds/cash).
 * Not a named AllocationTemplate (too conservative for general use), but used
 * as a glide path end-state option in the nudge flow. */
export const VERY_CONSERVATIVE_WEIGHTS = [0.05, 0.03, 0.02, 0.60, 0.10, 0.05, 0.15, 0.00] as const

/** Risk-free rate proxy (Cash return) used for Sharpe ratio calculation */
export const RISK_FREE_RATE = 0.014

/** Get asset class data by key */
export function getAssetClass(key: AssetClass): AssetClassData {
  const found = ASSET_CLASSES.find((ac) => ac.key === key)
  if (!found) throw new Error(`Unknown asset class: ${key}`)
  return found
}

/** Template display labels */
export const TEMPLATE_LABELS: Record<AllocationTemplate, string> = {
  conservative: 'Conservative (30/70)',
  balanced: 'Balanced (60/40)',
  aggressive: 'Aggressive (80/20)',
  allWeather: 'All-Weather',
  singaporeCentric: 'Singapore-Centric',
  custom: 'Custom',
}
