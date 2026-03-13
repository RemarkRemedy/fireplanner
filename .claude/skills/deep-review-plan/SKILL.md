---
name: deep-review-plan
description: 4-agent deep review of an implementation plan for feasibility, CLAUDE.md compliance, and scope analysis. Only for reviewing plans, NOT for reviewing code. ALSO invoke proactively after fixing BLOCKER-level issues found in a prior review — see Step 6 for the targeted re-review protocol.
---

# Deep Plan Review Skill

Run a structured, multi-agent review of an implementation plan before execution.

## Scope Guard

This skill reviews plan files only (`.md` files in `.claude/plans/`, `docs/plans/`,
or a plan presented in the current conversation). It does NOT review:
- Source code (`.ts`, `.tsx`) — use `/deep-review` instead
- Config files, skills, or documentation

If invoked and there is no plan to review, ask the user which plan file to review and stop.

## Steps

1. **Identify the plan**: Check for a plan file referenced in the current conversation.
   If none, run `ls -t ~/.claude/plans/ | head -5` and `ls -t docs/plans/ | head -5`
   to find recent plans. Ask the user to confirm which plan to review.
   Read the full plan file.

2. **Read project rules**: Read `/Users/tj/TJDevelopment/fireplanner/CLAUDE.md` to have
   the full project rules in context for compliance checking.

3. **Launch 4 review agents in parallel** (single message, 4 tool calls):

   **Agent 1 — Code Architect** (subagent_type: `feature-dev:code-architect`):
   Review the plan for architectural soundness:
   - Does the plan target the correct files and modules?
   - Are the proposed abstractions appropriate (not over-engineered)?
   - Does the file organization follow CLAUDE.md rules (pure functions in `lib/`,
     hooks only if they call React hooks, data in `lib/data/`)?
   - Does the plan reuse existing shared helpers or duplicate logic?
   - Are there hidden dependencies between plan steps that aren't acknowledged?
   - Does it respect the two computation contexts (nominal vs real dollar basis)?

   **Agent 2 — Feasibility Reviewer** (subagent_type: `feature-dev:code-reviewer`):
   Review the plan for correctness and feasibility:
   - Do the referenced files, functions, and APIs actually exist in the codebase?
   - Are the proposed function signatures compatible with existing callers?
   - Does the plan violate any CLAUDE.md "Do Not" rules?
   - Are there any dollar basis mixing risks in the proposed calculations?
   - Is the scope realistic (does the plan underestimate complexity)?
   - Are edge cases acknowledged (empty states, zero values, missing data)?

   **Agent 3 — Codex MCP** (use `mcp__codex-cli__codex` tool):
   Send the plan content and ask codex to review for issues. Prompt:
   "Review this implementation plan for a Singapore FIRE retirement planner.
   Check for: logical flaws in the approach, missing steps, incorrect assumptions
   about existing code, scope creep, and any steps that contradict each other.
   The plan: [plan content]"

   **Agent 4 — Gemini** (use `mcp__gemini-cli__ask-gemini` tool, model: `gemini-3-flash-preview`):
   Send the plan content to Gemini for an independent review. Prompt:
   "Review this implementation plan for a TypeScript/React retirement planner app.
   Look for: logical flaws, missing steps, contradictions between steps, unrealistic
   scope estimates, and assumptions that might not hold. Also check if any step
   could introduce bugs or regressions in adjacent features.
   The plan: [plan content]"

4. **Consolidate findings**: Collect all 4 agent results, deduplicate, and present as a
   severity-ranked list:
   - BLOCKER: Plan violates CLAUDE.md rules, targets nonexistent APIs, or has logical flaws
   - WARNING: Missing edge cases, hidden dependencies, scope underestimated
   - SUGGESTION: Alternative approaches, simplification opportunities

5. **Present revised plan** if blockers were found. Otherwise confirm the plan is ready
   for execution and ask the user how to proceed.

6. **Post-fix targeted re-review** (invoked automatically after fixing BLOCKERs):

   When BLOCKER-level issues are found in Step 4 and then fixed in the plan,
   classify each fix before deciding whether to re-review:

   **Skip re-review when the fix is:**
   - A mechanical typo (wrong variable name, off-by-one line number)
   - Self-evidently correct (adding a missing import, fixing a string literal)
   - Applied verbatim from the reviewer's suggested fix

   **Run targeted re-review when the fix:**
   - Changes structural assumptions (e.g., switching which field/API to assert against)
   - Involves type compatibility across multiple interfaces (e.g., matching 20+ fields)
   - Has cascading effects on other parts of the plan (e.g., reordering shared constants)

   Rule of thumb: **re-review when you can't verify correctness by inspection alone.**
   If you need to read source code to confirm the fix is right, dispatch a reviewer.

   **How to run:** Launch a single `feature-dev:code-reviewer` agent with a focused prompt
   listing ONLY the specific fixes to verify. Do NOT re-run the full 4-agent review.
   The agent should read the relevant source files and confirm each fix as OK or BLOCKER.

   **If no fixes warrant re-review:** State that explicitly and proceed to execution.
   **If re-review finds new issues:** Fix them and re-classify. Do not loop more than
   2 times — surface to the user if issues persist after 2 targeted re-reviews.
