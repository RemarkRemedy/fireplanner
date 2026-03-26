# Codex Prompt: Backfill Empty sourceRefs From Prepared Chunks

## Working tree

```
/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard
Branch: feat/ilp-fee-dashboard
```

## Context

After stripping 226 irrelevant sourceRefs (prompt 12), 142 bonus/event rules now have
`sourceRefs: []`. These rules need correct citations recovered from the prepared chunk
corpora that already exist in the repo.

### Data pipeline

```
PDF (in /Users/tj/Downloads/pdfs/)
  -> extracted text (fixtures/extracted/*.json)
  -> prepared chunks (fixtures/prepared/*.json)   <-- we search here
  -> evidence packets (fixtures/evidence/*.json)  <-- also useful
  -> parser output -> ilpCatalog.products.json
```

### Prepared chunk structure (`fixtures/prepared/*.json`)

```typescript
{
  sourceFileName: string          // e.g. "WA_Sum_201106386R_ESI5P_Jul2025.pdf"
  chunks: Array<{
    chunkId: string
    pageStart: number
    pageEnd: number
    sectionId: string             // e.g. "bonus", "fees", "withdrawal-charge"
    heading: string | null
    text: string                  // full text of the chunk (100-2000 chars)
    keywords: string[]
    sourceRefs: Array<{
      page: number
      excerpt: string             // ~200 char excerpt from that page
    }>
  }>
}
```

### Evidence packet structure (`fixtures/evidence/*.json`)

```typescript
{
  sourceFileName: string
  fieldPackets: Record<string, {
    fieldId: string               // e.g. "bonus", "partial-withdrawal"
    label: string
    status: "detected" | "not-detected"
    candidateCount: number
    bestCandidate: {
      candidateId: string
      chunkId: string
      pageStart: number
      pageEnd: number
      sectionId: string
      heading: string | null
      excerpt: string
      matchedPhrases: string[]
      score: number               // 0-100
      sourceRefs: Array<{ page: number; excerpt: string }>
    } | null
    candidates: Array<...same shape as bestCandidate>
  }>
}
```

### Product-to-file mapping

Each product in `ilpCatalog.products.json` has a `sourceFileName` field (e.g.,
`"WA_Sum_201106386R_ESI5P_Jul2025.pdf"`). The prepared/evidence file name is derived by
lowercasing, replacing non-alphanumeric chars with hyphens, and dropping the `.pdf` extension.

Example: `WA_Sum_201106386R_ESI5P_Jul2025.pdf` -> `wa-sum-201106386r-esi5p-jul2025.json`

**Important:** The match must be exact on the full normalized name, not a prefix match.
Some products share similar prefixes (e.g., PWE2.0 vs PWL).

### Affected rules

The full list of 142 rules with empty sourceRefs is in:
`docs/codex-prompts/sourceref-quality-issues.json`

Each entry has: `product` (product ID), `productName`, `variantId`, `ruleType`
("bonus" or "event"), `ruleId`, `ruleLabel`, and `sourceRefs` (the OLD bad refs that
were stripped).

## Task

Create `frontend/scripts/backfill-catalog-sourcerefs.ts` that:

### Step 1: Identify rules needing backfill

Read `ilpCatalog.products.json` and find all bonus rules, event charge rules, and charge
rules (feeRules) where `sourceRefs` is an empty array `[]`.

### Step 2: For each empty rule, search the prepared chunks

1. Resolve the product's `sourceFileName` to its prepared chunk file:
   - Normalize: lowercase, replace `[^a-z0-9]+` with `-`, drop trailing `-json` suffix confusion
   - Look in `frontend/scripts/ilp-catalog/fixtures/prepared/`
   - Also check the evidence file in `fixtures/evidence/` for pre-scored candidates
   - If no prepared file exists, skip the rule (log as "no-source")

2. Extract keywords from the rule label (same logic as validate script):
   - Split on whitespace, lowercase, remove words <= 3 chars
   - Remove stop words: charge, bonus, fee, fees, policy, premium, regular, single,
     annual, monthly, year, years, the, and, for, from, with, without, your, etc.

3. Search strategy (in priority order):

   **a) Evidence packet candidates (highest confidence):**
   Check the evidence file's `fieldPackets` for a matching field:
   - Bonus rules -> check `fieldPackets.bonus.candidates`
   - Event rules -> check `fieldPackets['partial-withdrawal']`, `fieldPackets['premium-holiday']`,
     etc. based on the rule's trigger/label
   - Score each candidate by counting how many of the rule's label keywords appear
     in the candidate's `excerpt`, `heading`, or `matchedPhrases`
   - Candidates with `score >= 70` AND at least one keyword match are high-confidence

   **b) Prepared chunk text search (medium confidence):**
   For each chunk in the prepared file:
   - Count how many label keywords appear in the chunk's `text` field
   - Prefer chunks whose `sectionId` matches the rule type (e.g., `sectionId: "bonus"`
     for bonus rules, `sectionId: "withdrawal-charge"` for withdrawal event rules)
   - A chunk is a match if >= 50% of the rule's keywords appear in its text

4. From matched chunks/candidates, build a sourceRef:
   ```typescript
   {
     page: chunk.pageStart,  // or candidate.pageStart
     section: chunk.heading ?? chunk.sectionId,
     excerpt: // extract a ~200 char excerpt from chunk.text that contains the
              // matched keywords, centered on the first keyword occurrence
   }
   ```
   Take the best 1-2 sourceRefs per rule (highest keyword overlap score).

### Step 3: Classify results

For each rule, classify the backfill result:

- **high-confidence**: Evidence candidate with score >= 70 and 2+ keyword matches,
  OR prepared chunk with section match and 2+ keyword matches.
  -> Write these automatically to the catalog.

- **low-confidence**: Only 1 keyword match, or no section match.
  -> Include in the review file but do NOT write to the catalog.

- **no-source**: No prepared file found for this product.
  -> Log and skip.

### Step 4: Output

1. **Write high-confidence sourceRefs** back to `ilpCatalog.products.json` automatically.
   Match by product ID + variant ID + rule type + rule ID.

2. **Generate a review file** at `docs/codex-prompts/sourceref-backfill-review.json`:
   ```typescript
   {
     summary: {
       totalEmpty: number
       highConfidence: number    // auto-written
       lowConfidence: number     // needs manual review
       noSource: number          // no prepared file
     },
     autoWritten: Array<{
       product: string
       ruleType: string
       ruleId: string
       ruleLabel: string
       sourceRefs: SourceRef[]
       confidence: number
       matchSource: "evidence" | "prepared-chunk"
     }>,
     needsReview: Array<{
       product: string
       ruleType: string
       ruleId: string
       ruleLabel: string
       bestCandidates: Array<{
         page: number
         excerpt: string
         score: number
         source: string
       }>
       reason: string
     }>,
     noSource: Array<{
       product: string
       ruleLabel: string
     }>
   }
   ```

### Step 5: Verify

After writing, run the validation script to confirm no NEW irrelevant refs were introduced:
```bash
npx tsx frontend/scripts/validate-catalog-sourcerefs.ts
```

## Usage

```bash
npx tsx frontend/scripts/backfill-catalog-sourcerefs.ts
```

Add `--dry-run` flag to generate the review file without writing to the catalog.

## Constraints

- Pure Node/TypeScript, no external dependencies beyond `tsx`
- Do NOT modify any source code (components, hooks, lib) -- only the catalog JSON
  and the new script
- The excerpt in recovered sourceRefs must be verbatim text from the chunk, not
  generated or paraphrased
- When extracting a ~200 char excerpt, include enough context around the keyword
  for the reader to understand the clause (don't cut mid-sentence if possible)
- For sourceRef.section: use the chunk's `heading` if available, otherwise use
  `sectionId` with hyphens replaced by spaces and title-cased

## Key files

- `frontend/src/lib/data/generated/ilpCatalog.products.json` -- catalog to update
- `frontend/scripts/ilp-catalog/fixtures/prepared/*.json` -- chunk corpora (search here)
- `frontend/scripts/ilp-catalog/fixtures/evidence/*.json` -- pre-scored evidence packets
- `docs/codex-prompts/sourceref-quality-issues.json` -- list of 142 affected rules
- `frontend/scripts/validate-catalog-sourcerefs.ts` -- validation to run after backfill
