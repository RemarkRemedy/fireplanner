# Plan Review: Advisory Gap Features (2026-03-17)

Plan file: `docs/superpowers/plans/2026-03-17-advisory-gap-features.md`

## Agent 1 — Code Architect (Opus)

### BLOCKERS
- **B1**: Store count is 10 (not 7 as CLAUDE.md states). Plan should acknowledge actual count.
- **B2**: `components/inputs/IncomeSection.tsx` does not exist. Actual path: `components/household/IncomeSection.tsx`. Similarly `CpfSection.tsx` is at `components/profile/CpfSection.tsx`.
- **B3**: `PlanAssumptions` type does not exist. Actual type: `HouseholdAssumptions`.
- **B4**: `RSTU_TAX_RELIEF_CAP` is in `cpfRates.ts`, not `taxBrackets.ts`.
- **B5**: Feature 1 mixes dollar bases. `capitalNeededForItem` produces nominal FIRE number alongside existing real-basis dashboard FIRE number.

### WARNINGS
- **W1**: Feature 2 adds `guaranteedIncomeStreams` to `useProfileStore` — store bloat. Consider `useIncomeStore`.
- **W2**: Feature 2 must handle both single-adult and household code paths in `useIncomeProjection`.
- **W3**: Feature 5 dependency on Feature 2 types is understated.
- **W4**: Feature 9 references stale line numbers in `projection.ts`.
- **W5**: Feature 8 `ANNUAL_REVIEW_ITEMS` data array should be in `lib/data/` per CLAUDE.md.
- **W6**: Feature 6 guardrail zone naming is confusing (inverted relative to code).
- **W7**: Feature 7 hardcodes SG-specific defaults ($5K legal, $15K funeral) in hook instead of `lib/data/`.
- **W8**: Features 1 and 2 both modify `useProfileStore` — merge conflict risk with parallel agents.

### SUGGESTIONS
- **S2**: Missing Zod validation schemas for new types.
- **S4**: Feature 9 should reference `monteCarloParams.ts` specifically.
- **S5**: 9-hour wall-clock estimate is optimistic; expect 20-30 hours.

## Agent 2 — Feasibility Reviewer (Opus)

### BLOCKERS
- **F-B1**: Feature 1 dollar basis mixing (same as Architect B5).
- **F-B2**: Feature 3 Tax Optimizer based on incorrect premise. SRS, RSTU, and CPF employee are separate line-item deductions in `calculateChargeableIncome`. The $80K cap only applies to `personalReliefs`. The optimizer's headroom formula is wrong.
- **F-B3**: Feature 4 Survivor Model description of expense loop is factually wrong. No `livingAdultIds` concept. Loop iterates per-adult with `window.owner` filtering. Shared expenses are resolved to a specific adult's owner by the timing system.

### WARNINGS
- **F-W1**: Feature 1 `effectiveBlendedSwr` treats fixed-term items as perpetuities.
- **F-W2**: Feature 2 creates parallel income system instead of extending existing `IncomeSource`.
- **F-W3**: Feature 2 `buildGuaranteedIncomeArray` includes CPF LIFE which is already in `postRetirementIncome`.
- **F-W4**: Feature 3 relief headroom formula incorrectly includes CPF employee in $80K cap.
- **F-W5**: Feature 4 references non-existent type `PlanAssumptions` (should be `HouseholdAssumptions`).
- **F-W6**: Feature 6 guardrail zone naming confusing but technically correct.
- **F-W7**: Feature 9 complexity underestimated (~70 lines + tests for per-sim CPF state).
- **F-W8**: Total scope estimate unrealistic (20-30 hours, not 9).

### SUGGESTIONS
- **F-S1**: Feature 7 should specify which projection row to read for `portfolioAtDeath`.
- **F-S2**: Parallel branches bumping `useProfileStore` version will cause merge conflicts.

## Agent 3 — Codex

### BLOCKERS
- **C-B1**: Features 1 & 2 bypass the household compilation pipeline. Adding data to `useProfileStore` creates shadow state that household-mode calculations never read. Data should go through `useHouseholdPlanStore`.
- **C-B2**: Feature 1 dollar basis mixing (same as others).
- **C-B3**: Feature 2 double-counts CPF LIFE. `buildGuaranteedIncomeArray` re-adds CPF LIFE which compiler already includes. Step 7 patches `useIncomeProjection` (wrong layer) and misses the real-term FIRE-number path.
- **C-B4**: Feature 4 misreads household compiler. No `livingAdultIds` loop. Targets non-existent `PlanAssumptions`. Ignores survivor-portfolio-transfer variant.
- **C-B5**: Feature 9 CPF fallback diverges from deterministic rules. Live fallback preserves FRS, excludes CPFIS-invested balances, changes once CPF LIFE starts. Option A's simplified model will make MC and projection disagree about the same feature.

### WARNINGS
- **C-W1**: Feature 3 needs per-adult scoping. HealthCheckPage is already tabbed by adult. CLAUDE.md forbids aggregating multi-entity inputs.
- **C-W2**: Feature 7 uses wrong upstream output. `generateIncomeProjection` is the income engine, not portfolio/property projection. "Portfolio at death from last row" is incorrect.
- **C-W3**: Feature 8 spec contradictions. Banner says "Dismiss snoozes 30 days" but no `snoozeUntil` field. Links to `/inputs#section-profile` but actual IDs are `section-personal` and `section-fire-settings`.
- **C-W4**: Missing Zod validation schemas for new persisted fields (same as Architect S2).

### SUGGESTIONS
- **C-S1**: Feature 6 should source "current portfolio" from projection/simulation outputs, not starting `liquidNetWorth`.

## Agent 4 — Gemini

### BLOCKERS
- **G-B1**: Feature 1 dollar basis inconsistency. Must respect `fireNumberBasis` setting ('today' vs nominal).

### WARNINGS
- **G-W1**: Feature 2 income floor double-counting risk with existing `postRetirementIncome` scalar.
- **G-W2**: Feature 6 terminology inversion (ceiling/floor vs upper/lower guardrail).
- **G-W3**: Feature 9 simplified MC assumption may overstate success when CPF OA also funds property.

### SUGGESTIONS
- **G-S1**: Merge conflict risk from parallelism — consider a "groundwork" step for shared types.
- **G-S2**: Feature 7 estate projection should offer "Today's Dollars" toggle.
