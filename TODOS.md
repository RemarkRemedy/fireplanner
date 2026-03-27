# TODOS

## RESOLVED

### ~~Verify EHG grant amounts against HDB.gov.sg~~
**Status:** DONE (2026-03-27). Rewritten with official post-NDR Aug 2024 amounts. Split into separate family (16 brackets, $500 steps) and single (16 brackets, $250 steps) tables. Verified against HDB.gov.sg, DollarsAndSense, and Sethisfy.

## V2 — Future Enhancements

### Executive Condominium (EC) property type
**What:** Add EC as a distinct property type in the goal calculator alongside HDB, Condo, and Landed. EC is a hybrid: HDB-subsidized but bank-loan-only, with unique rules.
**Key differences from Condo:** income ceiling $16K/mo, eligible for Family Grant (not EHG), no ABSD for first-timer citizens, 5-year MOP then open market, fully privatizes after 10 years.
**Key differences from HDB:** bank loan only (TDSR 55%, not MSR 30%), 25% down payment (not 10%), no HDB loan option.
**Scope:** New `SmartGoalInputs` kind `'ec'`, new tile in GoalPicker, grant logic (Family Grant only), loan qualification (TDSR path), income ceiling check ($16K).
**Workaround for now:** Users can use the Condo tile as closest approximation.

### Per-goal parking recommendation
**What:** Replace the current single blanket "where to park savings" recommendation (hidden in V1.5) with per-goal recommendations based on each goal's timeline.
**Why:** A user with a wedding in 2 years and a property in 8 years needs different parking advice for each goal, not a single recommendation based on the shortest timeline.
