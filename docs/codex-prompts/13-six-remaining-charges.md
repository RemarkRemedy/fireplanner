## Task: Screen and classify 6 remaining charge gaps that may need engine extensions

### Context
The charge/fee audit identified 8 genuinely missing charges. Two parser-only quick wins are done. The remaining 6 all appeared to need engine extensions, but that assessment was based on a high-level audit. Before committing to engine work, do a detailed screen of each to confirm whether it truly needs new engine support or can be approximated with existing types.

### The 6 gaps

| # | ID | Product | Initial assessment |
|---|---|---|---|
| 1 | `aia-platinum-wealth-elite-2-administration-charge` | AIA Platinum Wealth Elite 2 | Needs insured-amount-based fee support |
| 2 | `aia-platinum-wealth-elite-2-insurance-risk-charge` | AIA Platinum Wealth Elite 2 | Needs AIA-specific assurance charge formula |
| 3 | `aia-platinum-wealth-legacy-administration-charge` | AIA Platinum Wealth Legacy | Same pattern as #1 |
| 4 | `aia-platinum-wealth-legacy-insurance-risk-charge` | AIA Platinum Wealth Legacy | Same pattern as #2 |
| 5 | `etiqa-invest-starter-policy-charge-refund-every-3-years` | Etiqa Invest Starter | Rolling 36-month qualification for periodic refund |
| 6 | `tokio-marine-goassure-monthly-protection-charge` | Tokio Marine #goAssure | Protection-side recurring charge, needs Tokio formula |

### Phase 1: Detailed classification (do ALL 6 before implementing anything)

For each gap:

1. **Read the product summary PDF** in `/Users/tj/Downloads/pdfs` to find the exact charge mechanics: rate, basis, frequency, conditions, age-dependence
2. **Read the existing parser** to see what's already modeled and why this was left metadata-only
3. **Read the engine** (`frontend/src/lib/calculations/ilp.ts`) to check:
   - Does `IlpChargeRule` already support the needed `basis`?
   - Does the assurance charge framework already have a formula slot for this product?
   - Can the charge be expressed as a `requiresManualInput` fee rule with a user-provided rate?
4. **Read the template types** (`frontend/src/lib/ilp-catalog/types.ts`) — `IlpTemplateFeeRule` basis options

Classify each as:
- **(A) Parser-only** — existing types can express it (we missed this in the audit)
- **(B) Small engine extension** — needs 1-2 new fields, formula slots, or basis types
- **(C) Manual-input approximation** — can't compute the rate automatically, but can add a `requiresManualInput: true` fee rule where the user enters their actual charge rate from their policy illustration
- **(D) Keep metadata-only** — too complex, needs rolling state, or impact too small to justify

**Report all 6 classifications with reasoning before implementing.**

### Classification hints

**For #1 and #3 (AIA admin charges):**
The admin charge is based on insured amount, not account value. Check if `basis: 'assurance-sum-at-risk'` or a similar existing basis can express "X% of sum assured" rather than "X% of (sum assured - account value)". If the charge is on gross sum assured (not net-at-risk), a new basis may be needed — or it could use `requiresManualInput` with the user's actual monthly admin charge from their illustration.

**For #2 and #4 (AIA insurance risk charges):**
These are mortality charges similar to cost-of-insurance. Check if the existing `assuranceConfig` framework (which already models COI for many products) has a formula slot for AIA PWE2/PWL, or if one can be added. Also check if these are the SAME charge as the already-modeled COI under a different name.

**For #5 (Invest Starter refund):**
This is a credit, not a charge — it refunds policy charges every 3 years. The engine already has product-specific Invest Starter refund logic (search for `investStarter` in ilp.ts). Check if the existing refund path already covers this or if the metadata-only item is a residual gap in that path.

**For #6 (Tokio goAssure MPC):**
Monthly Protection Charge is a mortality/coverage charge. The engine already models MPC for other Tokio products (search for `tokio-mpc` in ilp.ts). Check if goAssure's MPC uses the same framework or needs a new formula.

### Phase 2: Implement (after classification is approved)

For each gap classified as A, B, or C:

**Allowed changes:**
1. Parser files — add charge/fee rules
2. Template types (`types.ts`) — add new optional fields or basis values if needed
3. Engine types and charge computation (`ilp.ts`) — add formula slots, basis types, or charge paths
4. Mapper (`templateToPolicy.ts`) — extend mapping for new fields
5. Schema files (`policySeedSchema.ts`, `ilpSchema.ts`) — update if new seed fields needed

**For manual-input approximations (C):**
- Set `requiresManualInput: true` on the fee rule
- Use a sensible default (e.g., 0 or the published maximum rate)
- Add a note explaining the user should enter their actual rate from their policy illustration
- The dashboard already conditionally shows manual-input fields for `requiresManualInput` rules

**For each charge implemented:**
- Remove the ID from `metadataOnlyBehaviors`, add to `modeledEconomics` with `branch:` prefix
- Add parser test, seed proof, runtime charge proof
- Rebuild catalog: `npm run -s catalog:build`
- Run focused tests

### Files to read
- `frontend/src/lib/calculations/ilp.ts` — search for `investStarter`, `tokio-mpc`, `assurance-sum-at-risk`, existing assurance formula slots
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateFeeRule` basis options, `assuranceConfig` formula list
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — fee rule mapping
- Product summary PDFs for AIA PWE2, AIA PWL, Etiqa Invest Starter, Tokio goAssure
- Existing parsers for these products

### Do NOT
- Build rolling 36-month state tracking for the Invest Starter refund if the existing engine path already covers it
- Add mortality rate tables without confirming they're needed (check if `requiresManualInput` is sufficient)
- Skip the Phase 1 classification — report all 6 before implementing

### Acceptance criteria
- All 6 classified with reasoning before any code changes
- Each implemented charge produces correct values in the projection
- Manual-input charges show the input field in the dashboard
- All focused tests pass
- Catalog rebuilds cleanly
