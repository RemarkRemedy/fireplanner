---
name: review-plan
description: Multi-agent review of an implementation plan for feasibility, CLAUDE.md compliance, and scope analysis. Only for reviewing plans, NOT for reviewing code.
---

# Plan Review Skill

Run a structured, multi-agent review of an implementation plan before execution.

## Scope Guard

This skill reviews plan files only (`.md` files in `.claude/plans/`, `docs/plans/`,
or a plan presented in the current conversation). It does NOT review:
- Source code (`.ts`, `.tsx`) — use `/review` instead
- Config files, skills, or documentation

If invoked and there is no plan to review, ask the user which plan file to review and stop.

## Steps

1. **Identify the plan**: Check for a plan file referenced in the current conversation.
   If none, run `ls -t ~/.claude/plans/ | head -5` and `ls -t docs/plans/ | head -5`
   to find recent plans. Ask the user to confirm which plan to review.
   Read the full plan file.

2. **Read project rules**: Read `/Users/tj/TJDevelopment/fireplanner/CLAUDE.md` to have
   the full project rules in context for compliance checking.

3. **Launch 3 review agents in parallel** (single message, 3 Agent tool calls):

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

4. **Consolidate findings**: Collect all 3 agent results, deduplicate, and present as a
   severity-ranked list:
   - BLOCKER: Plan violates CLAUDE.md rules, targets nonexistent APIs, or has logical flaws
   - WARNING: Missing edge cases, hidden dependencies, scope underestimated
   - SUGGESTION: Alternative approaches, simplification opportunities

5. **Present revised plan** if blockers were found. Otherwise confirm the plan is ready
   for execution and ask the user how to proceed.
