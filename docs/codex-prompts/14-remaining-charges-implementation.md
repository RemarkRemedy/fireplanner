## Approved classifications

- #1 (AIA PWE2 admin): B — approved, implement in batch with #2/#4/#6
- #2 (AIA PWE2 IRC): B — approved, implement in batch
- #3 (AIA PWL admin): C — approved, implement now as manual-input approximation
- #4 (AIA PWL IRC): B — approved, implement in batch with #1/#2/#6
- #5 (Etiqa Invest Starter refund): D — approved, keep metadata-only
- #6 (Tokio goAssure MPC): B — approved, implement in batch with #1/#2/#4

---

## Implement #3 first (manual-input approximation, no engine changes)

Implement `aia-platinum-wealth-legacy-administration-charge` as a `requiresManualInput: true` fee rule:

1. Add an `IlpTemplateFeeRule` to the AIA Platinum Wealth Legacy parser with:
   - `basis: 'account-value'` (as a proxy — the actual basis is gross insured amount, but since we can't compute that, the user enters a flat monthly dollar amount from their illustration)
   - Actually, check if `basis: 'fixed-amount'` or `basis: 'manual'` exists in the template types. If so, use that. If not, use `requiresManualInput: true` with `basis: 'account-value'` and rate 0 as default, with a note that the user must enter their actual admin charge from their policy illustration.
   - `requiresManualInput: true`
   - Default rate: 0 (user must provide)
   - Applicable first 10 policy years per the PDF
2. Remove `aia-platinum-wealth-legacy-administration-charge` from `metadataOnlyBehaviors`, add to `modeledEconomics` with `branch:` prefix
3. Add note in the charge explaining: "Rate depends on entry age and insured amount — enter the monthly administration charge from your policy illustration. The published summary does not include rate tables."
4. Parser test, seed proof, catalog rebuild
5. Run focused tests

---

## Then implement the 4 (B) items as a batch engine extension

These 4 share two engine gaps. Implement them together:

### Engine Gap A: Gross-insured-amount fee basis

**Needed by:** #1 (AIA PWE2 admin charge), and partially #3/#4 for context

The engine needs a new fee rule basis that charges based on the sum assured at issue (or per-layer sum assured), not account value or sum-at-risk. This is different from `assurance-sum-at-risk` which is `sum assured - account value`.

**Implementation:**
1. Add a new basis value to `IlpTemplateFeeRule` in `types.ts`: `'insured-amount-at-issue'` (or `'gross-sum-assured'`)
2. In `ilp.ts`, add a branch in the fee computation that resolves this basis from `assuranceProfile.sumAssuredAtIssue` (or equivalent seed field)
3. In `templateToPolicy.ts`, map the new basis through to the seed

### Engine Gap B: Assurance formula slots for AIA and Tokio

**Needed by:** #2 (AIA PWE2 IRC), #4 (AIA PWL IRC), #6 (Tokio goAssure MPC)

The engine's assurance charge framework needs formula slots for:
- **AIA PWE2/PWL IRC:** Monthly charge on (Current Insured Amount - policy value), with Free Legacy Cover waiver for first-layer IRC for 3 years. Age-band rates from the PDF.
- **Tokio goAssure MPC:** Monthly charge on basic sum-at-risk and TPD sum-at-risk, with sum-assured-band discounts.

**Implementation options (evaluate which is cleaner):**

**Option 1: Product-specific formula functions**
Add formula functions like `computeAiaPweInsuranceRiskCharge()` and `computeTokioGoAssureMpc()` in the engine, following the pattern of existing product-specific charge functions.

**Option 2: Generic manual-rate assurance charge**
Add a `requiresManualInput` mode to the assurance charge framework where the user enters their actual monthly IRC/MPC from their illustration. Less precise but covers all three products without building rate tables.

**Option 3: Hybrid**
For #6 (Tokio goAssure MPC), add a formula slot since Tokio MPC patterns already exist in the engine. For #2 and #4 (AIA IRC), use manual-input since AIA rates are illustration-dependent.

**Recommended: Option 3** — reuse existing Tokio MPC infrastructure for #6, manual-input for #2/#4.

### For each charge implemented:
- Remove from `metadataOnlyBehaviors`, add to `modeledEconomics` with `branch:` prefix
- Parser test, seed proof, runtime charge proof
- Rebuild catalog: `npm run -s catalog:build`
- Run focused tests, then full suite

### Files to modify
- `frontend/src/lib/ilp-catalog/types.ts` — new fee basis value
- `frontend/src/lib/calculations/ilp.ts` — fee basis resolution, assurance formula slots
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — new basis mapping
- `frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthElite2.ts` — admin + IRC charges
- `frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthLegacy.ts` — IRC charge
- `frontend/scripts/ilp-catalog/parsers/tokioMarineGoAssure.ts` — MPC charge
- Schema files if new seed fields needed

### Do NOT
- Build rolling 36-month state for Invest Starter (#5 is D, skip it)
- Add full mortality rate tables if manual-input is sufficient for AIA IRC
- Change existing formula slots for other products

### Acceptance criteria
- #3 (C): manual-input fee rule shows in dashboard, user can enter rate, default is 0
- #1 (B): gross-insured-amount basis works for PWE2 admin charge with age-band rates
- #2 (B): AIA PWE2 IRC produces charges in projection (manual-input or formula)
- #4 (B): AIA PWL IRC produces charges in projection (manual-input or formula)
- #6 (B): Tokio goAssure MPC produces charges using existing Tokio MPC framework
- All focused tests pass
- Catalog rebuilds cleanly
