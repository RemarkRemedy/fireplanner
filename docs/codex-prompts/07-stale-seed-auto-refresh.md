## Task: Auto-refresh stale policy seeds when catalog version changes

### Problem
When the ILP catalog is rebuilt (e.g., after adding new bonuses to parsers), policies persisted in localStorage retain their old seed data. This causes:
1. The "Metadata-only behaviors still outside the calculator" message to list bonuses that are actually modeled now
2. Bonus rules from the old seed to miss newly added bonuses, showing S$0 bonus credits
3. Users must manually clear localStorage to pick up catalog changes

### Root Cause
`templateVariantToPolicySeed()` embeds a snapshot of `catalogSource` (including `catalogVersion`, `generatedAt`, `modeledEconomics`, `metadataOnlyBehaviors`) and the full `bonuses[]` array into the seed at pick-time. This seed is persisted to localStorage via Zustand persist middleware (key: `fireplanner-ilp`). There is no mechanism to detect or resolve version mismatches when the app loads with an updated catalog.

### Architecture

The relevant lifecycle:
1. User picks product → `IlpReviewPage.tsx:99-101` calls `templateVariantToPolicySeed()`
2. Seed stored → `useIlpStore.ts:289-308` `addPolicyFromSeed()` → Zustand persist to localStorage
3. App reload → `useIlpStore.ts:230-263` `sanitizePersistedData()` validates schema but does NOT check catalog freshness
4. Catalog loaded → `getIlpCatalog.ts` static import of `ilpCatalog.manifest.json` (has `catalogVersion` and `generatedAt`)

### Fix

Add a catalog freshness check in `sanitizePersistedData()` (or a new `refreshStaleCatalogSeeds()` function called during rehydration).

**For each persisted policy with a `catalogSource`:**
1. Compare `policy.catalogSource.catalogVersion` against `getIlpCatalog().manifest.catalogVersion` (or compare `generatedAt` timestamps since `catalogVersion` is currently static at "0.1.0")
2. If stale, look up the matching product+variant in the current catalog using `policy.catalogSource.productId` and `policy.catalogSource.variantId`
3. Generate a fresh seed via `templateVariantToPolicySeed()`
4. Merge: take template-derived fields from the fresh seed, preserve user-edited fields from the persisted policy

**Template-derived fields to refresh (from fresh seed):**
- `catalogSource` (modeledEconomics, metadataOnlyBehaviors, supportStatus, economicsStatus, catalogVersion)
- `bonuses` (full bonus rules array)
- `chargeRules` (fee rules)
- `eventChargeRules`
- `eecTable`, `eecYearBasis`, `exitChargeBasis`
- `accounts` (feeRate, postMipFeeRate, contributionRules — but preserve `currentValue`)
- `policyStateSupport`, `scheduledPayoutSupport`, `distributionSupport`
- `catalogWarnings`
- `icpMonths`, `mipBasis`, `mipLength`

**User-edited fields to preserve (from persisted policy):**
- `name` (user may have renamed)
- `monthlyContribution`, `regularPremiumPaymentFrequency`
- `monthsAlreadyPaid`, `currentAcceptedRegularPremiumMonths`, `currentPolicyYear`
- `initialSinglePremium`
- Account `currentValue` entries (match by account ID, not array index)
- `funds` (user may have changed allocations/OCFs)
- `policyEvents` (user-added withdrawals, premium holidays, etc.)
- `discountRate`, `inflationRate`, `alternativeReturn`
- `assuranceProfile`, `claimProfile`
- `scheduledPayoutAssumption`, `distributionAssumption`

**Edge cases:**
- Product/variant removed from catalog → leave the persisted policy unchanged, add a warning
- Account IDs changed → match by ID; for unmatched accounts, use fresh seed defaults
- User manually created a policy (no catalogSource) → skip, no refresh needed

### Files to modify
- `frontend/src/stores/useIlpStore.ts` — add freshness check in rehydration path
- Optionally create `frontend/src/lib/ilp-catalog/refreshStaleSeed.ts` as a pure merge helper

### Files to read for context
- `frontend/src/stores/useIlpStore.ts` — `sanitizePersistedData()`, `mergePolicySeed()`, persist middleware config
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — `templateVariantToPolicySeed()`
- `frontend/src/lib/ilp-catalog/getIlpCatalog.ts` — catalog singleton loader
- `frontend/src/pages/IlpReviewPage.tsx` — `handleCatalogPick()` for existing seed creation flow
- `frontend/src/components/ilp/PolicyInputForm.tsx:1182-1185` — the metadata-only display that shows stale data

### Testing
- Add a unit test that creates a seed from an older catalog state, persists it, then verifies that rehydration with a newer catalog refreshes template fields while preserving user edits
- Verify that `metadataOnlyBehaviors` in the refreshed policy matches the current catalog
- Verify that bonus rules in the refreshed policy match the current template

### Do NOT
- Change the catalog build script (catalogVersion bump is a separate concern)
- Modify the engine (`ilp.ts`)
- Force-clear all user data — this must be a surgical merge that preserves user customizations
- Add UI elements (toasts, banners) — the refresh should be silent and automatic

### Acceptance criteria
- After a catalog rebuild + app reload, persisted policies automatically pick up new bonuses and updated metadataOnlyBehaviors
- User-edited fields (contribution, events, account values, funds) are preserved across the refresh
- No data loss for manually created policies or policies whose product was removed from the catalog
- Existing tests still pass
