# Plan Review: expense-category-persistence (2026-03-16)

Plan file: docs/superpowers/specs/2026-03-16-expense-category-persistence-design.md

## Agent 1 — Code Architect (Opus)

No blockers. Architecturally sound.

Warnings:
- W1: expenseBenchmarks.ts has wrong data shape for per-category hints (only life-stage totals, no per-category)
- W2: Template multipliers not persisted — re-entry UX inconsistency (shows "No Change" but stored ratio is 0.72)
- W3: Property-to-rent edge case — user fills rent, later adds property, categoryBreakdown still has rent field

Suggestions:
- S1: Make all categoryBreakdown fields optional (handle partial entry)
- S5: Verify base-living periodicity is 'annual' before * 12 conversion
- S6: Add computeWeightedRetirementRatio tests (CLAUDE.md requires 95% coverage)

## Agent 2 — Feasibility Reviewer (Opus)

Blockers:
- B1: Property detection wrong — plan.properties.length > 0 catches "planning to buy" users who are renting
- B2: SG_EXPENSE_BENCHMARKS has no per-category data (must be created as new data)

Warnings:
- W1: No Zod schema update mentioned for categoryBreakdown
- W2: "Update plan" action overwrites immediately without confirmation
- W3: Template multipliers not persisted, display inconsistency on re-entry
- W4: categoryBreakdown uses "rent" but nudge flow field is "housingExpenses" — naming mismatch
- W5: Gap banner "Update plan" unclear if it respects 2+ threshold

Suggestions:
- S1: computeWeightedRetirementRatio should handle negative values
- S2: Missing multiplier for category not in template should default to 1.0
- S3: "at least 2 non-zero categories" skip for Screen 2 feels arbitrary
- S5: Template selector should be a reusable component in components/setup/

## Agent 3 — Codex

Blockers:
- B1: Property gate wrong (same as above)
- B2: NudgeField/SetupScreen system can't render gap banner, inline hints, running total from metadata alone — needs custom children
- B3: "Update plan" action conflicts with staged-apply model (mid-flow overwrite vs final save)
- B4: Resetting templates to "No Change" breaks round-trip

Warnings:
- W1: Benchmark data assumption wrong (same)
- W2: Travel field is "annualised" in label but code treats as monthly — units confusion
- W3: Missing validation/default plumbing and tests

Suggestions:
- S1: Scope categoryBreakdown to base-living only, not all ExpenseItems
- S2: NudgeDrawer.tsx might be scope creep — expenses flow is container: 'full-page'

## Agent 4 — Gemini

Key findings:
- Property detection flawed (same)
- Multiplier loss on re-entry
- Gap analysis threshold (10%) may be too generous for high spenders
- Rent in retirement contradiction for future buyers
- Missing multiplier validation (cap 0-5x)
- "Update plan" periodicity confusion
- Auto-overwrite vs manual "Update" contradiction

Recommended data model refinement: store multipliers + templateId in categoryBreakdown.
