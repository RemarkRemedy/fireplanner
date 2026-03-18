# Plan Review: CPF Setup Screen Redesign (2026-03-15)

Plan file: `docs/superpowers/plans/2026-03-15-cpf-setup-screen-redesign.md`

## Agent 1 — Code Architect

### BLOCKER 1: `getCpfTotalRate()` does not exist
Use `getCpfRatesForAge(age, residencyStatus, prMonths).totalRate` instead. Must pass residency for PR graduated rates.

### BLOCKER 2: `CPF_HEURISTIC_SPLIT` referenced as existing — needs to be confirmed in worktree
**UPDATE:** Confirmed to exist in worktree at `cpfRates.ts:212`. False positive from reading main repo.

### BLOCKER 3: `SetupScreen` children prop referenced as needing creation
**UPDATE:** Already exists in worktree at `SetupScreen.tsx:31`. False positive.

### BLOCKER 4: Undeclared dependency on parent plan files
**UPDATE:** All files exist in worktree. False positive from reading main repo.

### WARNING 1: Estimate ignores PR graduated rates (0.09 vs 0.37)
### WARNING 2: Post-apply overwrite is fragile — extend SetupDraft with cpfBreakdown
### WARNING 3: Hydration can't distinguish estimate from manual entry
### WARNING 4: Props interface too wide (16 props) — group into sub-objects

### SUGGESTION 1: 0.7 factor should be named constant in lib/data/
### SUGGESTION 2: Estimate should be pure function in lib/
### SUGGESTION 3: MA validation should use MEDISAVE_BHS constant

## Agent 2 — Feasibility Reviewer

### BLOCKER 1-4: All files/functions referenced don't exist
**UPDATE:** All false positives. Reviewer read from main repo, not worktree. Files confirmed to exist in ../fireplanner-setup.

### WARNING 1: 0.7 factor too aggressive for older workers (interest compounds, making balance higher)
### WARNING 2: updateAdult deep-merge pattern is correct but fragile
### WARNING 3: PR graduated rates produce wildly different estimates
### WARNING 4: Hydration detection unreliable (can't distinguish estimate from manual)

### SUGGESTION 1: Use OW ceiling cap ($96K/yr)
### SUGGESTION 2: Work start age should be 25 (NS + university), not 23
### SUGGESTION 3: Tests missing edge cases (age 55+ bracket changes, OW cap, mortgage > OA)
### SUGGESTION 4: Accrued interest on OA housing withdrawals worth a disclaimer

## Agent 3 — Codex

### BLOCKER 1: Plan file path mismatch
Plan exists at main repo path but Codex looked in worktree `docs/superpowers/plans/`. Partial false positive.

### BLOCKER 2: SetupScreen API stale vs actual
**UPDATE:** Plan was written before latest children prop changes. Already updated.

### BLOCKER 3: Current CPF estimate formula is logically unsound
Genuine — ignores OW ceiling, residency, PR rates, contribution history. Plan update addresses this with sum-across-brackets formula.

### WARNING 1: Plan contradicts itself on NudgeFlowScreen typing
### WARNING 2: Plan contradicts itself on useState vs useReducer
### WARNING 3: applySetupDraft is not the CPF estimation boundary — estimation lives in draftFromValues
### WARNING 4: CPF prompt inconsistent for 55+ users (asks OA+SA+MA but splitCpfByAge allocates RA)
### WARNING 5: PR handling under-specified without prMonths collection

### SUGGESTION: Re-scope plan around existing /setup flow, not full rollout

**Verified refs:** getCpfRatesForAge exists (line 224), CPF_HEURISTIC_SPLIT exists (line 212), OW_CEILING_MONTHLY + OW_CEILING_ANNUAL exist (line 103), SetupDraft exists (line 15), splitCpfByAge exists (line 69), children prop exists (line 31).

## Agent 4 — Gemini 3.1 Pro

### BLOCKER 1-3: All files hallucinated
**UPDATE:** All false positives. Gemini read from main repo, not worktree.

### WARNING 1: Estimate uses current-age rate for entire career — drastically wrong for 55+ users
### WARNING 2: Missing OW ceiling produces impossible estimates for high earners
### WARNING 3: Mortgage deduction before split spreads reduction across OA/SA/MA — should be OA only

### SUGGESTION: Use MEDISAVE_BHS constant
