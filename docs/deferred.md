# Deferred Findings — Companion Mode Phase 1B

Findings from Codex MCP and Code Architect reviews that were not addressed in the current PR.

## ESLint no-restricted-imports for bootstrap files
**Source:** Architect #1 (MEDIUM)
**Files:** `src/lib/companion/isCompanionMode.ts`, `src/lib/companion/companionBootstrap.ts`
Add an ESLint `no-restricted-imports` rule preventing `@/stores/` imports in these two files. The bootstrap timing guarantee (localStorage cleared before store hydration) is currently enforced only by a code comment. A lint rule would make it a tooling-enforced constraint.

## E2E text mismatch: 'Saved to phone' checkmark
**Source:** Codex #3 (MEDIUM)
**File:** `e2e/monte-carlo.spec.ts:158`
E2E expects `'Saved to phone ✓'` but UI renders `'Saved to phone'`. Pre-existing issue, not introduced by companion mode fixes. Verify the actual rendered text and update the assertion.

## Mobile nav array deduplication
**Source:** Architect #5 (MEDIUM)
**File:** `src/components/layout/Sidebar.tsx`
The companion and non-companion mobile bottom nav arrays share 3 identical items (`Inputs`, `Plan`, `Test`). Could be deduplicated by starting with a common base array and conditionally appending extras. Code quality, not correctness.

## fire_age fallback ambiguity
**Source:** Architect #8 (MEDIUM)
**File:** `src/lib/companion/resultsPayload.ts`
When the median portfolio never crosses the required threshold, `fire_age` silently defaults to `retirementAge` (the user's target). The phone app has no way to distinguish "FIRE age found" from "defaulted to target." Consider adding a `fire_age_achieved: boolean` field to the payload schema.

## Additional test edge cases
**Source:** Architect #10-12 (LOW)
- `isCompanionMode.test.ts`: Assert `replaceState` was called and companion/token params are absent from URL after init (security-sensitive scrub coverage)
- `resultsPayload.test.ts`: Test the `fire_age` fallback-to-retirementAge case when median never crosses threshold
- `scenarios.test.ts`: Test `resolveScenarioInputs` when `maxRetirementAge === minRetirementAge` (collapsed constraint edge case)
