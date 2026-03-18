# Plan Review: Health Check MoneySense Upgrade (2026-03-17)

Plan file: `docs/superpowers/plans/2026-03-17-health-check-moneysense-upgrade.md`

## Consolidated Findings (Deduplicated)

### BLOCKERs (all fixed in plan)

| # | Finding | Found By | Fix Applied |
|---|---------|----------|-------------|
| B1 | `fee-drag` ratio missing from `healthBenchmarks.ts` — Investments group shows 3 cards not 4 | Architect, Feasibility, Codex, Gemini | Elevated prerequisite to Task 0 with explicit steps |
| B2 | `protectionEnabled` used at line 167 for hiding Protection input section — cannot remove | Architect, Feasibility | Changed Task 4 Step 3 to "DO NOT remove" |
| B3 | `/ilp-review` route doesn't exist in production — link would 404 | Feasibility | Removed link, added comment about re-enabling when route is live |
| B4 | Cherry-pick resets test file to HEAD but tests hardcode 8 ratios — tests break | Codex | Include test file in cherry-pick, don't reset |
| B5 | Goal/acceptance criteria reference ILP cross-link but it was removed | Codex | Updated goal line and visual verification checklist |
| B6 | Plan says "presentation-only" but Task 0 touches calculation layer | Codex | Updated Architecture description |

### WARNINGs (addressed or documented)

| # | Finding | Found By | Resolution |
|---|---------|----------|------------|
| W1 | `currentAge` from `useProfileStore` is always primary adult — wrong in household tab | Architect, Feasibility | Changed to read from selected adult in `useHouseholdPlanStore` |
| W2 | TDSR cap: plan says 55%, MEMORY.md says 60% | Architect | Plan is correct (MAS updated to 55% in 2023). MEMORY.md should be corrected separately. |
| W3 | No test file for `moneySenseGuide.ts` — violates lib/ testing convention | Codex | Added test with `getLifeStageGuide()` tests + exhaustive ratio coverage test |
| W4 | Per-task commits skip lint/test | Codex | All commit steps now run `npm run type-check && npm run lint && npm run test` |
| W5 | Per-file `tsc --noEmit` fails on `@/` aliases | Codex | Replaced with `npm run type-check` everywhere |
| W6 | Overlapping age ranges in `getLifeStageGuide` rely on array order | Gemini | By design — first-match semantics, covered by test |
| W7 | `InsuranceNeedsPanel` always renders (computeInsuranceNeeds always returns result) | Codex | Acceptable — panel shows zeros when no data, which is informative |
| W8 | Cherry-pick may conflict if workspace diverged | Gemini | Added manual resolution note |

### SUGGESTIONs (adopted or noted)

| # | Finding | Found By | Status |
|---|---------|----------|--------|
| S1 | Add exhaustiveness test for ratio-to-area mapping | Codex | Adopted — added to test file |
| S2 | Make `ratioIds` type-safe with union type | Architect | Noted, not adopted (nice-to-have) |
| S3 | Add dev-mode console.warn for unmapped ratioIds | Feasibility | Noted, not adopted (test covers this) |
| S4 | `RatioGroup` abstraction level is appropriate | Architect | Confirmed |
| S5 | `getLifeStageGuide()` placement in `lib/data/` is appropriate | Architect | Confirmed |
| S6 | `ExternalLink` from lucide-react is available (already a dependency) | Feasibility | Confirmed |
| S7 | Lines estimate (~300) is accurate | Feasibility | Confirmed |

## Agent Outputs

### Agent 1 — Code Architect (Opus)
- 2 BLOCKERs: fee-drag missing, protectionEnabled removal breaks compilation
- 3 WARNINGs: household-mode age, TDSR percentage, ratio count
- 5 SUGGESTIONs: all positive (file placement, abstraction, selector pattern correct)

### Agent 2 — Feasibility Reviewer (Opus)
- 2 BLOCKERs: fee-drag missing, /ilp-review route doesn't exist
- 4 WARNINGs: TDSR inconsistency, protectionEnabled misleading, currentAge source, empty Protection UX
- 3 SUGGESTIONs: lines estimate accurate, ExternalLink available, add dev-mode warning

### Agent 3 — Codex
- 3 BLOCKERs: fee-drag scope contradiction, cherry-pick breaks tests, ILP acceptance criteria contradiction
- 4 WARNINGs: insurance always renders, no test file, commits skip checks, per-file tsc fails
- 2 SUGGESTIONs: exhaustiveness test, life-stage precedence

### Agent 4 — Gemini
- 2 BLOCKERs: companion mode concern (false positive — ANALYSIS group is kept), cherry-pick conflicts
- 2 WARNINGs: overlapping age ranges, HealthRatioResult export check (confirmed exported)
- Scope assessment: realistic and well-structured
