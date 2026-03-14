# ILP Open-Ended / No-MIP Kernel Execution Spec

Last updated: 2026-03-14

## Goal

Add one bounded kernel slice for ILP products that do **not** publish a finite MIP / surrender-charge horizon and therefore cannot honestly be represented by the current required `mipLength` contract.

This slice exists because the next truthful parser-throughput corridor is blocked by one shared mechanic:

- `PS(EN)_GREAT Invest Advantage (SP)_(SG)_v3.0.pdf`
- `PS(EN)_GREAT Invest Advantage 2 (SP)_(SG)_v2.0.pdf`
- `PS(EN)_Prestige Portfolio_(SG)_v5.0.pdf`

All three are whole-life / open-ended structures with no published surrender-charge horizon to map into a finite MIP number.

The current engine can model:
- finite MIP products with explicit exit-charge tables
- charges on annual contribution
- top-up premium charges
- account-value fees that run throughout the policy term

It cannot honestly model:
- products whose regular-premium commitment does not end at a published MIP
- products whose partial / full surrender charge is explicitly zero throughout the policy term
- products whose UI/policy seed should not imply a fake finite MIP just to satisfy schema validation

## Why This Is Next

Parser throughput continued until the next 3 viable Great Eastern products all depended on the same missing mechanic.

This is the trigger for kernel mode:
- same blocker across multiple parser-ready products
- the blocker is structural, not product-specific
- faking a finite `mipLength` would violate the lane rule against forcing parsers onto products that do not fit the current engine honestly

## Proof Products

This slice must prove itself on one parser immediately and should unlock the adjacent corridor.

### Mandatory proof target

1. `great-eastern-great-invest-advantage-sp`
- cleanest proof target
- simple one-account structure
- source-explicit premium charge
- source-explicit zero partial / full surrender charge
- no premium-holiday or bonus state needed for the first proof

### Immediate follow-on corridor after the proof parser is green

2. `great-eastern-great-invest-advantage-2-sp`
- same open-ended single-premium structure
- same no-surrender-charge issue
- should fit immediately if the kernel is correct

3. `great-eastern-prestige-portfolio`
- open-ended structure with premium-charge / wrap-fee style economics
- still partial because protection overlays remain outside the slice

### Out-of-scope proof targets for this slice

4. `great-eastern-great-invest-advantage-rsp`
5. `great-eastern-great-invest-advantage-2-rsp`

These are expected to benefit from the same basis, but the kernel acceptance gate only requires one proof parser. They can follow in parser mode once the new basis lands.

## Source-Backed Contract

### GREAT Invest Advantage (SP)

Published mechanics:
- whole-life single-premium ILP
- premium charge applies to single premium and single premium top-up
- no surrender charge on partial or full surrender
- no published MIP / exit-charge horizon

### GREAT Invest Advantage 2 (SP)

Published mechanics:
- same open-ended single-premium structure
- same premium-charge pattern
- same explicit no-surrender-charge rule
- no published MIP / exit-charge horizon

### Prestige Portfolio

Published mechanics:
- whole-life ILP with regular / recurrent-single / single-premium modes
- premium charge and monthly wrap fee
- no published surrender-charge horizon
- no source basis for forcing a finite MIP

These products do not need a new protection-state kernel to enter the catalog truthfully as `partial`.
They need a truthful way to express "no finite MIP" and "policy-term zero exit charge."

## Scope

This slice includes exactly:

1. one authored/runtime way to represent a product with no finite MIP
2. one authored/runtime way to express open-ended regular-premium / recurrent-premium contribution flow without a fake after-MIP transition
3. zero-regression handling for all existing finite-MIP products
4. direct calculator proof that open-ended products behave correctly
5. one Great Eastern parser consuming the new basis end-to-end

This slice does **not** include:

- protection-structure work
- assurance-charge expansion
- distribution-mode assumptions
- bonus-richness extensions
- single-premium principal tracking beyond current partial boundaries
- product promotion to `supported`

## Keep vs Replace

### Keep

Keep these current concepts:
- finite `mipLength` behavior for existing products
- current account / charge / event-charge authored surfaces where they already fit
- current policy-term fee behavior
- current top-up event-charge behavior

### Add

Add one explicit MIP basis on the authored/runtime contract:
- `mipBasis: 'finite' | 'open-ended'`

When `mipBasis === 'finite'`:
- existing `mipLength` behavior remains unchanged

When `mipBasis === 'open-ended'`:
- no finite MIP boundary exists
- regular or recurrent premium flow is not auto-stopped by a fake MIP cutoff
- `isPostMip`-style behavior must stay false for the whole projection
- any charge or event rule authored with `activeWindow: 'after-mip'` is invalid for this basis

### Do Not Replace

Do not reinterpret open-ended products as:
- `mipLength: 5` placeholder products
- finite-MIP products with all-zero EEC tables
- brochure-only partials when the source summary is detailed enough for a parser-backed partial

Those would silently introduce false structure into the model.

## Runtime Definition

For each projection year:

1. resolve whether the policy has a finite MIP boundary
2. if the basis is finite:
   - preserve current `policyYear <= mipLength` behavior
   - preserve current `isPostMip` transitions
3. if the basis is open-ended:
   - treat the policy as never entering post-MIP state
   - keep premium-bearing contribution phases active unless separately stopped by explicit events or input changes
   - treat exit-charge horizon as absent, not as a zero-valued finite table

Important runtime decisions:

1. **Open-ended basis**
- no post-MIP transition occurs
- `yearsToMipEnd` or equivalent helpers should not fabricate a countdown

2. **Charges**
- `policy-term` charges continue to work unchanged
- `during-mip` charges on an open-ended product are invalid unless the source truly publishes a bounded introductory period
- `after-mip` charges are invalid for open-ended products

3. **Regular premium flow**
- existing finite-MIP products still stop regular premiums after MIP
- open-ended products continue premium flow after year N unless the user changes the contribution or a separate event suppresses it

4. **Validation**
- open-ended products must still be analyzable from policy year 1 onward
- current finite-MIP validation guard must not reject an open-ended product because there is no MIP countdown to compare against

## Layer Contract

Schema/runtime impact is expected in:
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/types.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/schema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/validation/ilpSchema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/ilp-catalog/templateToPolicy.ts`

Required implementation approach:
- add the new basis without regressing finite-MIP products
- keep `mipLength` for finite products
- allow parser-authored open-ended variants to omit or bypass finite-MIP semantics honestly
- reject impossible authored combinations early rather than papering over them in product-specific code

## Acceptance Criteria

This slice is complete only if all are true:

1. The authored/runtime contract can represent both finite and open-ended products explicitly.
2. Existing finite-MIP products behave identically after the refactor.
3. Open-ended products no longer need a fake `mipLength` to enter the catalog.
4. Direct calculator tests prove uninterrupted open-ended premium flow.
5. Direct calculator tests prove premium-holiday freeze / resume still works on the new basis.
6. Direct calculator tests prove no regression for existing finite basis types.
7. At least one Great Eastern parser consumes the new basis and passes.
8. `npm run golden:check` remains green.

## Direct Calculator Proof Requirements

At minimum, add direct calculator tests for:

1. uninterrupted payment baseline on an open-ended product
2. freeze during missed-premium / premium-free-period on an open-ended product
3. resume after premium restart on an open-ended product
4. no regression of existing finite basis types

These tests must sit in the calculator layer, not only parser tests.

## Continuous Invariants

These remain true throughout implementation:
- finite-MIP products keep current outputs
- supported-product outputs remain stable
- open-ended products are not silently promoted to `supported`
- no fake finite MIP appears in parser-authored catalog data for open-ended proof products

## Implementation Sequence

### Step 1. Add an explicit MIP basis contract

Add the minimum authored/runtime type and schema support for:
- finite MIP products
- open-ended products

### Step 2. Normalize runtime MIP checks

Route current validation and runtime helpers through one normalized MIP-state layer so:
- finite products keep their current countdown / post-MIP behavior
- open-ended products never enter post-MIP state

### Step 3. Add direct calculator proof

Extend:
- `/Users/tj/TJDevelopment/fireplanner-ilp/frontend/src/lib/calculations/ilp.test.ts`

The tests must prove:
- open-ended uninterrupted contributions
- premium-free / missed-premium freeze
- restart/resume
- finite-basis no-regression

### Step 4. Add the proof parser

Implement:
- `GREAT Invest Advantage (SP)`

as a parser-backed `partial` using the open-ended basis.

### Step 5. Return to parser throughput

After the kernel slice is green and reviewed:
- commit the kernel slice
- resume parser throughput with `GREAT Invest Advantage 2 (SP)` and the adjacent Great Eastern corridor

## Verification Plan

Minimum verification for the completed slice:
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run catalog:build`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run catalog:family-classification`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run type-check`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npx vitest run src/lib/calculations/ilp.test.ts [touched parser test files] src/lib/ilp-catalog/templateToPolicy.test.ts src/pages/IlpReviewPage.test.tsx`
- `cd /Users/tj/TJDevelopment/fireplanner-ilp/frontend && npm run golden:check`

## Review Gate

Before the kernel commit is considered ready:

1. review this spec in the main thread
2. review the implemented kernel + proof parser in the main thread
3. complete the approval gate with a Claude-style MCP review step in place of human pre-commit approval

The approval gate itself does not change:
- isolated calculator tests are still mandatory
- proof-parser coverage is still mandatory
- golden/type-check must still pass
- staged diff reporting is still mandatory
