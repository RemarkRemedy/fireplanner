## Task: Audit metadata-only charge/fee items for false negatives

### Context
The ILP catalog has 80 charge/fee-related IDs still marked as `metadataOnlyBehaviors`. After closing the bonus gaps, these are the highest-impact remaining category because missing charges understate fees — making products look better than they are (the opposite direction of missing bonuses).

We need to determine which of these 80 items are:
- **(A) Already captured** through another mechanism (e.g., fund OCF already includes the fund management charge)
- **(B) Genuinely missing** from the projection and should be modeled
- **(C) Correctly informational** (operational/admin fees that don't affect the annual projection)

### Phase 1: Classify the sub-categories (report before implementing anything)

#### Sub-category 1: Fund management charges (~35 items)
Examples: `aia-elite-secure-income-5p-fund-management-charge`, `fwd-invest-first-max-fund-management-charge`, `manuinvest-duo-fund-management-charge`

**Key question:** The seed has `funds[].ocf` (ongoing charge figure) for each fund. Does this already represent the fund management charge? If the fund's published TER/OCF includes the management fee, then adding it as a separate `chargeRule` would double-count.

To answer this:
1. Read `frontend/src/lib/calculations/ilp.ts` — find where `funds[].ocf` is used in the projection. Is it deducted from the gross return to get the net return?
2. Read one product summary PDF (e.g., FWD Invest First Max) — does it list "Fund Management Charge" separately from the ILP policy charges? Is it explicitly described as being deducted from the fund's NAV (i.e., already in the unit price)?
3. If fund management charges are already reflected in fund NAV/unit prices (and therefore in the OCF), these are correctly informational → **(A)**

#### Sub-category 2: Administration charges and insurance risk charges (~5 items)
Examples: `aia-platinum-wealth-elite-2-administration-charge`, `aia-platinum-wealth-elite-2-insurance-risk-charge`, `aia-platinum-wealth-legacy-administration-charge`

**Key question:** Are these the same charges already modeled as `chargeRules` in the parser under different IDs (e.g., `policy-charge`, `cost-of-insurance`), or are they genuinely separate unmodeled charges?

To answer:
1. Read the AIA Platinum Wealth Elite 2 parser — check what `feeRules` are already modeled
2. Read the product summary PDF — compare the listed charges against what's modeled
3. If modeled under a different name → **(A)**. If genuinely separate → **(B)**

#### Sub-category 3: Policy closure charges (~6 items)
Examples: `fwd-invest-first-max-policy-closure-charge`, `fwd-invest-flexi-elite-policy-closure-charge`

**Key question:** Is this the same as the EEC (early exit charge) already modeled in `eecTable`, or a separate flat fee on policy termination?

To answer:
1. Read one FWD product summary — is "policy closure charge" a separate fee from the surrender/exit charge schedule?
2. If it's the same thing → **(A)**. If it's an additional flat fee → **(B)**, but only matters at termination, not annually

#### Sub-category 4: Credit card charges (~8 Tokio items)
Examples: `tokio-atlas-credit-card-charge`, `tokio-goclassic-credit-card-charge`

**Classification guidance:** These are payment-method surcharges (typically 0.5-1% for credit card premium payments). They are operational and payment-method-dependent. Unless the projection assumes credit card payment, these are → **(C)**

#### Sub-category 5: Third-party/fund-level fees (~5 items)
Examples: `tokio-marine-goassure-third-party-charges`, `tokio-marine-goelite-fund-level-and-third-party-charges`

**Same question as sub-category 1:** If these are already in the fund NAV/OCF → **(A)**

#### Sub-category 6: Remaining items (~21 items)
Includes: premium shortfall charge refunds, switching charges, representative management charges, fixed-fee threshold transitions, withdrawal flexibility charge thresholds, top-up charges, etc.

For each: determine if it's already modeled under a different ID, genuinely missing, or correctly informational.

### Phase 2: For any items classified as (B), assess implementability

For each genuinely missing charge:
1. Can it be expressed with the existing `IlpTemplateFeeRule` or `IlpTemplateEventChargeRule` types?
2. What is the annual impact? (e.g., a 0.5% admin charge on a $100K account = $500/year — material. A $10 flat annual fee = immaterial.)
3. Is it worth modeling or should it stay informational with a note about the magnitude?

### Files to read
- `frontend/src/lib/calculations/ilp.ts` — how `funds[].ocf` is used, how `chargeRules` are computed
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateFeeRule`, `IlpTemplateEventChargeRule`
- Product summary PDFs in `/Users/tj/Downloads/pdfs` for representative products (pick one AIA, one FWD, one Tokio)
- Parsers for those same products to compare modeled vs metadata-only charges

### Do NOT
- Implement any charges without reporting the full classification first
- Add fund management charges if they're already in the fund OCF (this would double-count)
- Model credit card charges (payment-method-dependent, not standard)

### Deliverable
A classification table with all 80 items categorized as (A), (B), or (C), with reasoning per sub-category. For any (B) items, include the estimated annual impact and whether the existing template types can express them.
