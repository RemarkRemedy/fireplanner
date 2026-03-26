/**
 * Build script: pre-compute leaderboard values for all catalog products.
 *
 * Usage: npx tsx scripts/ilp-catalog/buildLeaderboard.ts
 *
 * Imports catalog JSON + projection engine, runs standardized projections
 * for all products, writes output to src/lib/data/generated/ilpLeaderboard.json.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IlpPolicyInput } from '../../src/lib/calculations/ilp.js'
import { analyzeIlpPolicy } from '../../src/lib/calculations/ilp.js'
import { templateVariantToPolicySeed } from '../../src/lib/ilp-catalog/templateToPolicy.js'
import type { IlpCatalogManifest, IlpCatalogProduct } from '../../src/lib/ilp-catalog/types.js'
import type { IlpPolicySeed } from '../../src/lib/ilp-catalog/policySeedSchema.js'
import { ilpPolicySchema } from '../../src/lib/validation/ilpSchema.js'
import { createDefaultPolicy } from '../../src/stores/useIlpStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CATALOG_DIR = resolve(__dirname, '../../src/lib/data/generated')
const OUTPUT_PATH = resolve(CATALOG_DIR, 'ilpLeaderboard.json')

// Standardized assumptions
const STANDARD_MONTHLY_PREMIUM = 350
const STANDARD_POLICY_YEAR = 1
const STANDARD_MONTHS_PAID = 0

interface LeaderboardRow {
  productId: string
  insurer: string
  productName: string
  variantId: string
  variantLabel: string
  currency: string
  mipLength: number | null
  mipBasis: string
  premiumType: 'regular' | 'single'
  netFeeDrag: number
  netFeeDragPct: number
  totalPremiumsPaid: number
  totalFeesCharged: number
  totalBonusesReceived: number
  bestExitYear: number
  bonusModellingStatus: 'modelled' | 'metadata-only' | 'none'
}

/**
 * Merge a seed with defaults to produce a valid IlpPolicyInput.
 * Uses createDefaultPolicy for base values, then overrides with seed fields.
 * Mirrors the store's mergePolicySeed logic. Validates via Zod to catch
 * type mismatches at build time rather than letting them reach the engine.
 */
function seedToValidatedPolicy(seed: IlpPolicySeed): IlpPolicyInput {
  const base = createDefaultPolicy()
  const merged = {
    ...base,
    ...seed,
    // Deep-clone nested arrays (same as store's mergePolicySeed)
    eecTable: [...(seed.eecTable ?? base.eecTable)],
    funds: (seed.funds ?? base.funds).map((f) => ({ ...f })),
    accounts: (seed.accounts ?? base.accounts).map((a) => ({ ...a })),
    bonuses: (seed.bonuses ?? base.bonuses).map((b) => ({ ...b })),
    chargeRules: (seed.chargeRules ?? base.chargeRules ?? []).map((r) => ({ ...r })),
    eventChargeRules: (seed.eventChargeRules ?? base.eventChargeRules ?? []).map((r) => ({ ...r })),
    policyEvents: seed.policyEvents?.map((e) => ({ ...e })) ?? [],
  }
  return ilpPolicySchema.parse(merged)
}

function deriveBonusModellingStatus(product: IlpCatalogProduct): 'modelled' | 'metadata-only' | 'none' {
  const hasModelledBonuses = product.variants.some((v) => v.bonuses.length > 0)
  if (hasModelledBonuses) return 'modelled'

  const hasBonusBehaviors = product.metadataOnlyBehaviors.some((behavior) =>
    /bonus|welcome|loyalty|power.?up|booster|achievement|vitality|perpetual|accumulation/i.test(behavior),
  )
  if (hasBonusBehaviors) return 'metadata-only'

  return 'none'
}

async function main() {
  // Load catalog
  const manifestRaw = readFileSync(resolve(CATALOG_DIR, 'ilpCatalog.manifest.json'), 'utf-8')
  const productsRaw = readFileSync(resolve(CATALOG_DIR, 'ilpCatalog.products.json'), 'utf-8')
  const manifest: IlpCatalogManifest = JSON.parse(manifestRaw)
  const products: IlpCatalogProduct[] = JSON.parse(productsRaw)

  console.log(`Processing ${products.length} products...`)

  const rows: LeaderboardRow[] = []
  const errors: string[] = []

  for (const product of products) {
    for (const variant of product.variants) {
      try {
        const seed = templateVariantToPolicySeed(product, variant, manifest)

        // Determine premium type
        const isSinglePremium = (seed.initialSinglePremium ?? 0) > 0 || seed.monthlyContribution === 0
        const premiumType = isSinglePremium ? 'single' as const : 'regular' as const

        // Override with standardized assumptions
        const standardizedSeed = {
          ...seed,
          monthlyContribution: isSinglePremium ? 0 : STANDARD_MONTHLY_PREMIUM,
          currentPolicyYear: STANDARD_POLICY_YEAR,
          monthsAlreadyPaid: STANDARD_MONTHS_PAID,
        }

        const policy = seedToValidatedPolicy(standardizedSeed)
        const analysis = analyzeIlpPolicy(policy)
        const { summary } = analysis

        const variantLabel = [
          variant.currency,
          variant.mipBasis === 'open-ended' ? 'Open-ended' : `MIP ${variant.mipLength}`,
          variant.id.includes('advanced') ? '(Advanced)' : '',
        ].filter(Boolean).join(' / ').trim()

        rows.push({
          productId: product.id,
          insurer: product.insurer,
          productName: product.productName,
          variantId: variant.id,
          variantLabel,
          currency: variant.currency,
          mipLength: variant.mipLength ?? null,
          mipBasis: variant.mipBasis ?? 'finite',
          premiumType,
          netFeeDrag: summary.netFeeDrag,
          netFeeDragPct: summary.totalPremiumsPaid > 0
            ? summary.netFeeDrag / summary.totalPremiumsPaid
            : 0,
          totalPremiumsPaid: summary.totalPremiumsPaid,
          totalFeesCharged: summary.totalFeesCharged,
          totalBonusesReceived: summary.totalBonusesReceived,
          bestExitYear: analysis.npvAnalysis.bestExitYear,
          bonusModellingStatus: deriveBonusModellingStatus(product),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${product.id}/${variant.id}: ${msg}`)
      }
    }
  }

  // Sort by net fee drag % ascending (regular premium first, then single)
  rows.sort((a, b) => {
    if (a.premiumType !== b.premiumType) return a.premiumType === 'regular' ? -1 : 1
    return a.netFeeDragPct - b.netFeeDragPct
  })

  // Write output
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(rows, null, 2))

  console.log(`Wrote ${rows.length} leaderboard rows to ${OUTPUT_PATH}`)
  if (errors.length > 0) {
    console.log(`\n${errors.length} errors:`)
    for (const err of errors) {
      console.log(`  - ${err}`)
    }
  }
}

await main()
