Use [$autopilot-loop](/Users/tj/.agents/skills/autopilot-loop/SKILL.md) for this entire turn.
Use [$ilp-lane-loop](/Users/tj/.codex/skills/ilp-lane-loop/SKILL.md) for this entire turn.

Continue the ILP metadata-only reduction lane in `/Users/tj/TJDevelopment/fireplanner-ilp-lane` on branch `codex/ilp-metadata-only-lane`.

Core objective:
- Reduce `metadataOnlyBehaviors` across already-supported Singapore ILP products.
- This is not the old `partial -> supported` sweep. That lane is complete.
- Work exact repeated metadata-only IDs first, then vendor-family bundles, then broader reusable kernels only when the common mechanic is proven.

Execution policy:
- Persistent loop, not milestone-based.
- Do not stop on commits, green tests, green gates, summaries, checkpoints, or “good handoff” moments.
- Only stop for:
  1. a real hard blocker,
  2. a required human modeling/business-rule decision,
  3. a tool/system failure that actually prevents progress,
  4. an explicit user stop request.

Turn-boundary rule:
- A chat/turn boundary is not a blocker and not a stop condition.
- If the app forces a response because the turn is ending, do not frame that as stopped, blocked, or completed.
- Treat that as non-terminal continuation state only.
- If forced to respond without a real blocker, the first line must be:
  `Non-terminal turn boundary: continue same lane.`
- After that, give only the minimal live cursor needed to resume.

Canonical lane:
- Repo: `/Users/tj/TJDevelopment/fireplanner-ilp-lane`
- Branch: `codex/ilp-metadata-only-lane`
- Market: Singapore ILP catalog only
- Stay in this worktree only.

Standing unrelated dirt to ignore unless the active slice truly requires it:
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/docs/ilp-mechanics-family-classification.md`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/fixtures/audit/family-classification.json`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/__fixtures__/ilp-golden/prudential-pruvantage-assure-sp-sgd-mip-8-baseline.json`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/__fixtures__/ilp-golden/prudential-pruvantage-assure-sp-sgd-mip-8-event-heavy.json`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/__fixtures__/ilp-golden/prudential-pruvantage-assure-sp-sgd-mip-8-ocf-stress.json`
- `.codex-tmp/`
- `.omx/*`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/ILP_LANE_AUTOPILOT_PROMPT.md`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/.codex-tmp-tokio-secure-keys.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/.codex-tmp-tokio-secure.ts`

Agent policy:
- Keep the blocking implementation step local.
- Use subagents only as narrow sidecars.
- After the pool has ever hit the limit, reuse existing relevant agents first.
- Keep at most 1-2 live sidecars at a time.
- Reuse briefly, then close decisively after integrating the result.
- Do not leave idle agents alive.
- Do not claim an agent is gone just because an old ID is `not_found` if the UI still shows background agents.
- Treat the UI background-agent count as authoritative for saturation risk.
- If UI and agent API disagree, avoid unnecessary new spawns and keep moving locally.

Claude review policy:
- Use Claude only for the active staged diff when a kernel/runtime slice or risky behavior change warrants review.
- Give Claude only:
  - the staged diff,
  - the minimum touched human-authored source files,
  - one short paragraph on intent,
  - one short note on what remains unsupported.
- Do not send large repo context, generated files, or broad background unless truly needed.
- If Claude is required and cannot be obtained, that is a real stop condition.

Behavior-family-first policy:
- Do not pick the next slice by smallest policy count alone.
- Prefer:
  1. exact repeated metadata-only IDs,
  2. then vendor-family reuse,
  3. then cross-vendor kernels.
- If 2-3 candidate policies in the current bundle fail for the same missing mechanic, switch to a kernel slice on that mechanic.
- Do not create a new kernel just because one policy has many metadata-only behaviors.

Current source of truth:
- `/tmp/fireplanner-ilp-lane-metadata-only-ranking.md`
- `/tmp/fireplanner-ilp-lane-metadata-only-backlog.md`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/data/generated/ilpCatalog.products.json`

Current live slice:
- HSBC Wealth Harvest / Wealth Abundance / Wealth Voyage regular-withdrawal support
- Mechanic: model regular withdrawal via existing manual scheduled-payout support and make loyalty-bonus suspension honor scheduled payouts
- This is the current honest kernel+parser family slice

Current files in play:
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilp.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilp.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilpGoldenFixtures.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/validation/ilpSchema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/ilp-catalog/schema.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/ilp-catalog/types.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/ilp-catalog/templateToPolicy.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/hsbcWealthHarvest.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/hsbcWealthHarvest.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/hsbcWealthAbundance.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/hsbcWealthAbundance.test.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/hsbcWealthVoyage.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/hsbcWealthVoyage.test.ts`

Current slice status:
- Runtime/schema/parser/template changes are already implemented locally.
- `scheduled-payout` is added as a valid bonus-suspension trigger.
- Harvest / Abundance / Voyage now model regular withdrawal through `scheduledPayoutSupport`.
- The corresponding metadata-only behaviors were removed where honestly modeled.
- Goldens were refreshed and `golden:check` is green.
- Claude review found one real gap: parser tests did not explicitly assert `suspensionRules`.
- That test gap has already been patched locally and must be rerun/validated before commit.

Immediate next steps:
1. Rerun the focused test set after the new parser-test assertions:
   - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npx vitest run src/lib/calculations/ilp.test.ts scripts/ilp-catalog/parsers/hsbcWealthHarvest.test.ts scripts/ilp-catalog/parsers/hsbcWealthAbundance.test.ts scripts/ilp-catalog/parsers/hsbcWealthVoyage.test.ts src/lib/ilp-catalog/templateToPolicy.test.ts`
2. Stage the updated HSBC parser test files.
3. Refresh the staged diff file if needed.
4. Run one tight Claude re-review on the staged diff only, with just these human-authored context files:
   - `frontend/src/lib/calculations/ilp.ts`
   - `frontend/src/lib/calculations/ilpGoldenFixtures.ts`
   - `frontend/scripts/ilp-catalog/parsers/hsbcWealthHarvest.ts`
   - `frontend/scripts/ilp-catalog/parsers/hsbcWealthAbundance.ts`
   - `frontend/scripts/ilp-catalog/parsers/hsbcWealthVoyage.ts`
   - optionally the 3 parser test files if the review is specifically about the new assertions
5. If Claude has no real blocking finding, commit only the active slice.

Expected commit shape:
- one logical feature commit only
- conventional commit subject
- likely subject:
  - `feat(ilp): model hsbc regular withdrawal loyalty suspension`

After this slice lands:
- Resume the metadata backlog from the next honest repeated family.
- Best follow-on candidates after HSBC should be chosen from the backlog and current catalog, not from the stale old Tokio cursor.
- Prefer exact repeated payout-threshold / dividend / bonus / withdrawal families before any large option-framework work.

Verification policy for this lane:
- For parser/runtime metadata-reduction slices, run:
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run catalog:build`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run catalog:family-classification`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run type-check`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npx vitest run [touched tests] src/lib/ilp-catalog/templateToPolicy.test.ts`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run golden:check`
- For kernel slices, additionally include:
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npx vitest run src/lib/calculations/ilp.test.ts [touched tests] src/lib/ilp-catalog/templateToPolicy.test.ts`

What to avoid:
- Do not restart the old support-expansion lane.
- Do not stop for summaries.
- Do not spend time reconciling stale UI-agent slots unless it actually blocks the active slice.
- Do not spawn new sidecars casually when the UI still shows a saturated pool.
- Do not stage unrelated dirt or the known excluded files.

Resume expectation:
- If resumed in a fresh session, continue from the active HSBC regular-withdrawal slice immediately.
- Do not jump back to `tokio-multiple-life-and-capital-guarantee-options`.
- Finish the HSBC slice first, then move to the next honest metadata-only family from the backlog.
