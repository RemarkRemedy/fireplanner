# TODOS

## BLOCKING — Must resolve before implementation

### Verify EHG grant amounts against HDB.gov.sg
**What:** The V1.5 spec's EHG grant table (16 income brackets, families/singles amounts) is based on NDR 2024 announcements and web search results, not the primary HDB source. Verify exact bracket boundaries and amounts against HDB.gov.sg before writing `estimateHousingGrant()`.
**Why:** Wrong grant amounts mean users see incorrect affordability estimates. A $10K-$20K error in grant amount significantly changes the "cash you actually need" number, which is the hero metric of the goal calculator.
**Context:** The spec is at `docs/superpowers/specs/2026-03-27-goal-calculator-v1.5-design.md`, Section 4 (Housing Grant Estimation). The grant table covers household gross income from $0 to $9,000+ in $500 increments. Post-NDR 2024, max EHG increased from $80K to $120K for families.
**Source:** https://www.hdb.gov.sg/residential/buying-a-flat/understanding-your-eligibility-and-housing-loan-options/flat-and-grant-eligibility
**Depends on:** Nothing. Do this first.
