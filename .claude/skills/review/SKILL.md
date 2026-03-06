---
name: review
description: Multi-agent code review of current branch changes
---

# Code Review Skill

Run a structured, multi-agent code review of all changes on the current branch.

## Steps

1. **Identify scope**: Run `git diff main...HEAD --name-only` to list all changed files.
   If no diff (on main), use `git diff HEAD~1 --name-only` for the last commit.
   Read all changed files to build context.

2. **Launch 3 review agents in parallel** (single message, 3 Agent tool calls):

   **Agent 1 — Code Architect** (subagent_type: `feature-dev:code-architect`):
   Review all changed files for architectural concerns: CLAUDE.md convention violations,
   Zustand selector usage, shared helper reuse, file organization rules, dollar basis
   consistency, no hardcoded SG values, no store-to-store imports, component structure,
   and separation of concerns.

   **Agent 2 — Code Reviewer** (subagent_type: `feature-dev:code-reviewer`):
   Review all changed .ts/.tsx files for correctness: TypeScript type errors, `any` usage,
   incorrect type narrowing, missing null checks, logic errors in calculations, off-by-one
   errors, missing test coverage for changed calculation/simulation code, and security issues.

   **Agent 3 — Codex MCP** (use `mcp__codex-cli__codex` tool):
   Send the list of changed files and ask codex to review for bugs, logic errors,
   and improvements. Prompt: "Review these files for bugs, logic errors, type safety
   issues, and convention violations: [file list]. Read each file and report findings."

3. **Consolidate findings**: Collect all 3 agent results, deduplicate, and present as a
   severity-ranked list:
   - CRITICAL: Bugs, type errors, security issues, calculation errors
   - WARNING: Convention violations, missing tests, architectural concerns
   - INFO: Style suggestions, minor improvements

4. **Ask user** which findings to fix. Then apply fixes and run
   `cd frontend && npm run type-check && npm run test` to verify.
