# Codex Prompt: ILP Catalog sourceRef Quality Validation & Fix

## Working tree

```
/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard
Branch: feat/ilp-fee-dashboard
```

## Context

The ILP catalog (`frontend/src/lib/data/generated/ilpCatalog.products.json`) contains
92 products with 711 bonus rules, 748 event charge rules, and 491 charge rules. Every
rule has a `sourceRefs` array with page numbers, section names, and excerpts from the
original policy document PDF.

These sourceRefs are displayed in tooltips in the UI so users can verify where a fee or
bonus comes from. **The problem: ~10% of sourceRefs are attached to the wrong rule.**

### Stats
- Bonus rules: 711 total, **91 have irrelevant sourceRefs** (12.8%)
- Event charge rules: 748 total, **51 have irrelevant sourceRefs** (6.8%)
- Charge rules (feeRules): 491 total (not yet audited but assumed better quality)

### What "irrelevant" means
A sourceRef is irrelevant when its `section` and `excerpt` text do not mention any
significant keyword from the rule's `label`. For example:

- Rule label: "Power-up Bonus"
- sourceRef section: "Secure payout conditions and Target Monthly Income"
- sourceRef excerpt: "The conditions to be satisfied before Secure Monthly Income..."
- **This is about Secure Monthly Income, NOT about the Power-up Bonus.**

The full list of 142 irrelevant sourceRefs is in:
`docs/codex-prompts/sourceref-quality-issues.json`

## Task

### Part 1: Build a validation script

Create `frontend/scripts/validate-catalog-sourcerefs.ts` that:

1. Reads `frontend/src/lib/data/generated/ilpCatalog.products.json`
2. For each bonus rule, event charge rule, and charge rule (feeRule):
   - Extracts significant keywords from the rule's `label` (words > 3 chars, excluding
     common words like "charge", "bonus", "the", "from", "with", "and", "for")
   - Checks if at least one keyword appears in any sourceRef's `section` or `excerpt`
   - If no keyword matches, flags the rule as having an irrelevant sourceRef
3. Outputs a structured report:
   - Summary: total rules, rules with relevant refs, rules with irrelevant refs, by type
   - Detail: each flagged rule with product name, rule label, and the sourceRef section/excerpt
4. Exits with code 1 if any irrelevant sourceRefs are found, code 0 if all pass
5. Accepts a `--fix` flag that **removes** irrelevant sourceRefs from the rules and writes
   the cleaned catalog back to the same file. This is a safe operation because an empty
   sourceRefs array simply means "no citation available" in the tooltip (better than a
   wrong citation).

The script should be runnable with: `npx tsx frontend/scripts/validate-catalog-sourcerefs.ts`

### Part 2: Fix the 142 known bad sourceRefs

Run the script with `--fix` to remove the irrelevant sourceRefs from the catalog JSON.
Verify the fix by re-running the validation (should exit 0).

### Part 3: Add the validation to the catalog update workflow

Add a note to `frontend/scripts/validate-catalog-sourcerefs.ts` header comment explaining
this should be run after every catalog rebuild (when new products are added or parsers
are updated). Do NOT modify package.json or CI config.

## Key files

- `frontend/src/lib/data/generated/ilpCatalog.products.json` — the catalog data (126K lines)
- `frontend/src/lib/ilp-catalog/types.ts` — TypeScript types for catalog products/variants
- `frontend/src/lib/calculations/ilp.ts` — `IlpBonusRule`, `IlpEventChargeRule`, `IlpChargeRule` interfaces
- `docs/codex-prompts/sourceref-quality-issues.json` — pre-computed list of 142 irrelevant sourceRefs

## sourceRef structure

```typescript
interface SourceRef {
  page: number       // Page number in the policy document PDF
  section: string    // Section heading or description
  excerpt: string    // Verbatim excerpt from the document (up to ~200 chars)
}
```

Each rule has: `sourceRefs: SourceRef[]` (always present, 1-3 entries typically)

## Constraints

- The script must be pure Node/TypeScript — no external dependencies beyond `tsx` runner
- Do NOT modify any source code files (components, hooks, lib) — only the catalog JSON
  and the new validation script
- The keyword matching should be case-insensitive
- Consider that some rule labels are generic (e.g., "Partial Withdrawal Charge") — the
  keyword extraction should still work because "withdrawal" is a significant keyword
- Some excerpts start with "Approximate excerpt; keyword ... not found on page" — these
  are definitely irrelevant and should always be flagged
