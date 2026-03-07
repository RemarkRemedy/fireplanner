---
name: deep-review
description: 5-agent deep code review of TypeScript/TSX source code changes on the current branch. Only for reviewing code, NOT for reviewing plans, docs, or markdown files.
---

# Deep Code Review Skill

Run a structured, multi-agent code review of all **code** changes on the current branch.

## Scope Guard

This skill reviews `.ts` and `.tsx` source files only. It does NOT review:
- Plan files (`.md` in `.claude/plans/` or `docs/plans/`)
- Documentation (`.md`, `CLAUDE.md`, `SKILL.md`)
- Config files (`.json`, `.toml`, `.yaml`)
- Skill definitions

If invoked and there are no `.ts`/`.tsx` changes, say "No code changes to review" and stop.

## Steps

1. **Identify scope**: Run `git diff main...HEAD --name-only` to list all changed files.
   If no diff (on main), use `git diff HEAD~1 --name-only` for the last commit.
   **Filter to only `.ts` and `.tsx` files.** Exclude test files (`*.test.ts`) from
   the architectural review but include them in the correctness review.
   If no `.ts`/`.tsx` files remain after filtering, stop — nothing to review.
   Read all code files to build context.

2. **Launch 5 review agents in parallel** (single message, 5 tool calls):

   **Agent 1 — Code Architect** (subagent_type: `feature-dev:code-architect`):
   Review all changed files for architectural concerns: CLAUDE.md convention violations,
   Zustand selector usage, shared helper reuse, file organization rules, dollar basis
   consistency, no hardcoded SG values, no store-to-store imports, component structure,
   and separation of concerns.

   **Agent 2 — Code Reviewer** (subagent_type: `feature-dev:code-reviewer`):
   Review all changed .ts/.tsx files for correctness: TypeScript type errors, `any` usage,
   incorrect type narrowing, missing null checks, logic errors in calculations, off-by-one
   errors, missing test coverage for changed calculation/simulation code, and security issues.

   **Agent 3 — Plan Compliance** (subagent_type: `superpowers:code-reviewer`):
   Review the implementation against the original plan (if one exists in `.claude/plans/`
   or `docs/plans/`) and project coding standards in CLAUDE.md. Check: does the code
   match what the plan specified? Are there deviations, missing steps, or extras that
   weren't planned? If no plan file exists, focus on CLAUDE.md coding standards only.

   **Agent 4 — Codex MCP** (use `mcp__codex-cli__codex` tool):
   Send the list of changed files and ask codex to review for bugs, logic errors,
   and improvements. Prompt: "Review these files for bugs, logic errors, type safety
   issues, and convention violations: [file list]. Read each file and report findings."

   **Agent 5 — Gemini** (use `mcp__gemini-cli__ask-gemini` tool, model: `gemini-3-flash-preview`):
   Send the list of changed files using @ syntax for file inclusion. Prompt:
   "Review these changed files for bugs, logic errors, missed edge cases, and
   potential regressions. Focus on issues the other reviewers might miss —
   subtle logic flaws, implicit assumptions, and cross-file interaction bugs:
   @file1.ts @file2.ts ..."

3. **Consolidate findings**: Collect all 5 agent results, deduplicate, and present as a
   severity-ranked list:
   - CRITICAL: Bugs, type errors, security issues, calculation errors
   - WARNING: Convention violations, missing tests, architectural concerns
   - INFO: Style suggestions, minor improvements

4. **Ask user** which findings to fix. Then apply fixes and run
   `cd frontend && npm run type-check && npm run test` to verify.
