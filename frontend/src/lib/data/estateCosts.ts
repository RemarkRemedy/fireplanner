/**
 * Singapore-specific estate cost defaults.
 * Used by the Net Estate at Death Projection (Advisory Gap Feature 7).
 *
 * Sources:
 * - Funeral costs: Singapore Funeral Services industry average (2024)
 * - Legal/admin: Probate filing fees + lawyer costs for simple estates
 */

/** Default funeral costs in SGD. Range: $8K-$25K depending on type. */
export const DEFAULT_FUNERAL_COSTS = 15_000

/** Default legal and administrative costs for estate settlement in SGD.
 *  Covers: probate application (~$250), lawyer fees (~$3K-$5K for simple estate),
 *  misc admin (bank closure, property transfer fees). */
export const DEFAULT_LEGAL_ADMIN_COSTS = 5_000
