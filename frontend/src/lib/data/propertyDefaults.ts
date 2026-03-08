/**
 * Property regulatory and market defaults for Singapore.
 *
 * Source: MAS (https://www.mas.gov.sg/regulation/explainers/new-cooling-measures)
 *   - LTV limit: 75% for first housing loan (Aug 2023 cooling measures)
 * Source: HDB (https://www.hdb.gov.sg/residential/buying-a-flat/understanding/lease-and-eligibility)
 *   - Standard HDB lease: 99 years
 * Source: MAS (https://www.mas.gov.sg/monetary-policy/interest-rates)
 *   - Indicative floating mortgage rate: ~3% as of 2026
 *
 * Downloaded: 2026-03-08
 */

/** Maximum loan-to-value ratio for first housing loan. Source: MAS cooling measures (Aug 2023). */
export const DEFAULT_LTV = 0.75

/** Standard HDB lease term in years. Source: HDB. */
export const DEFAULT_HDB_LEASE_YEARS = 99

/** Indicative floating mortgage interest rate (per annum). Market-consensus estimate, 2026. */
export const DEFAULT_MORTGAGE_RATE = 0.03

/** Default HDB room subletting rate (SGD/room/month). Mid-range estimate for 4-room flats. */
export const DEFAULT_HDB_SUBLETTING_RATE = 900
