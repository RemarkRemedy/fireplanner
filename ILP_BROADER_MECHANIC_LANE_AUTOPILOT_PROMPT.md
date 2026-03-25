Use [$autopilot-loop](/Users/tj/.agents/skills/autopilot-loop/SKILL.md) for this entire turn.
Use [$ilp-lane-loop](/Users/tj/.codex/skills/ilp-lane-loop/SKILL.md) for this entire turn.

Continue the ILP broader mechanic-support lane in `/Users/tj/TJDevelopment/fireplanner-ilp-lane` on branch `codex/ilp-broader-mechanic-lane`.

Core objective:
- Expand honest support for repeated Singapore ILP mechanic families that remain metadata-only after the metadata-reduction lane is exhausted.
- The parser-only narrowing phase on this branch is exhausted.
- Do not chase wording cleanup here. Every slice must either add real executable state support or prove that the next step is a different kernel/program.
- Prefer reuse of existing kernel/runtime primitives before inventing new ones.

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
- Branch: `codex/ilp-broader-mechanic-lane`
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
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/ILP_METADATA_ONLY_LANE_AUTOPILOT_PROMPT.md`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/.codex-tmp-tokio-secure-keys.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/.codex-tmp-tokio-secure.ts`

Agent policy:
- Keep the blocking implementation step local.
- Use subagents only as narrow sidecars.
- Keep at most 1-2 live sidecars at a time.
- Reuse briefly, then close decisively after integrating the result.
- Do not leave idle agents alive.
- If the UI still shows background agents, treat that as the real saturation signal and avoid casual spawns.

Claude review policy:
- Use Claude for staged kernel/runtime slices before commit.
- Give Claude only:
  - the staged diff,
  - the minimum touched human-authored source files,
  - one short paragraph on intent,
  - one short note on what intentionally remains metadata-only.
- Do not send large repo context, generated files, or broad background unless truly needed.
- If Claude is required and cannot be obtained, that is a real stop condition.

Mechanic-family-first policy:
- Do not pick the next slice by smallest product count alone.
- Prefer:
  1. exact repeated mechanic families with shared source structure,
  2. then vendor-family reuse,
  3. then cross-vendor kernels.
- Reuse existing formula/runtime branches first.
- The next work on this branch is a kernel/state program, not more parser cleanup.
- Keep admin workflows, claim handling, and underwriting state metadata-only unless the slice explicitly includes them.

Current source of truth:
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/data/generated/ilpCatalog.products.json`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/fixtures/audit/outside-current-models.csv`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/fixtures/audit/modeling-roadmap.md`

Current lane state:
- Recent broader-lane work proved the cheap narrowing path is exhausted.
- Latest landed commit on this branch:
  - `714440ab feat(ilp): narrow smartretire lapse metadata`
- That SmartRetire slice split the stale broad reinstatement bucket into:
  - lapse / cover termination
  - reinstatement underwriting / exclusion resets
- Source screening confirmed the next honest work is not more parser slicing:
  - SmartRetire resets exclusion windows on reinstatement.
  - AIA payout products change payout-state after reinstatement.
  - HSBC Life Flexi Protector combines premium-holiday lapse/no-claim state with reinstatement/backpay.

Current repeated broader-mechanic frontier:
- shared lapse / reinstatement / payout-state kernel
- first consumer family:
  - `aia-elite-secure-income-5p-reinstatement-target-income`
  - `aia-elite-secure-income-sp-reinstatement-payout-continuity`
  - `aia-platinum-retirement-elite-premium-holiday-and-reinstatement-payout-continuity`
- second-wave consumers after the kernel exists:
  - `manulife-smartretire-v-income-lapse-and-cover-termination`
  - `manulife-smartretire-v-income-reinstatement-underwriting-and-exclusion-resets`
  - `manulife-smartretire-v-sum-lapse-and-cover-termination`
  - `manulife-smartretire-v-sum-reinstatement-underwriting-and-exclusion-resets`
- later/heavier consumer:
  - `hsbc-life-flexi-protector-premium-holiday-lapse-and-no-claim-state`
  - `hsbc-life-flexi-protector-reinstatement-and-backpay`

Current live slice:
- Dedicated kernel-discovery and first implementation path for lapse / reinstatement / payout-state
- Active first-consumer set:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/aiaEliteSecureIncome5Pay.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/aiaEliteSecureIncomeSp.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/aiaPlatinumRetirementElite.ts`
- Active kernel/runtime files:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilp.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilp.test.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/validation/ilpSchema.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/ilp-catalog/types.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/ilp-catalog/templateToPolicy.test.ts`
- Reference/second-wave files:
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/manulifeSmartRetireIncome.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/manulifeSmartRetireSum.ts`
  - `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/parsers/hsbcLifeFlexiProtector.ts`

Current mechanic hypothesis:
- The engine already has `premium-holiday`, repayment, synthetic `premium-holiday-repayment`, and scheduled-payout support.
- The missing mechanic is explicit policy-state semantics, not another charge rule:
  - in-force vs lapsed
  - reinstated/resumed state after lapse
  - payout suppression or continuity while lapsed
  - payout-state transition after reinstatement where the product specifies it
- The first honest kernel slice should be narrow:
  - add explicit lapse/reinstatement state support sufficient for AIA payout-state transitions
  - keep underwriting approval, exclusion resets, claim timing, and admin workflows metadata-only
- Do not begin with HSBC Life Flexi Protector. It is too heavy for the first consumer because it bundles no-claim state, reinstatement backpay, and claim continuation.

Immediate next steps:
1. Re-read the three AIA parser/source files and isolate the smallest common executable state change after reinstatement.
2. Design the minimum schema/input extension in `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/validation/ilpSchema.ts`.
3. Add failing kernel tests first in `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilp.test.ts` for:
   - lapse when value cannot support ongoing deductions or product state is treated as lapsed,
   - no payout while lapsed where the active consumer requires it,
   - reinstatement resuming coverage/state,
   - AIA payout-state switching to the post-reinstatement target-income corridor where published.
4. Implement the smallest honest runtime support in `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/src/lib/calculations/ilp.ts`.
5. Wire the first AIA consumers onto that kernel and narrow their metadata-only behaviors only where honestly supported.
6. Run the kernel gate.
7. Stage only the active slice.
8. Run tight Claude review on the staged diff.
9. Commit the slice if green, then immediately reassess whether SmartRetire can consume the same kernel or whether SmartRetire still keeps underwriting/exclusion-reset metadata-only.

Expected first-kernel boundaries:
- In scope:
  - explicit lapse/reinstatement state primitive,
  - payout-state continuity/switching for the first AIA consumers,
  - kernel tests and template/parser updates required by those AIA products.
- Out of scope for the first slice:
  - underwriting approval workflows,
  - pre-existing-condition / suicide exclusion resets,
  - claim adjudication timing,
  - Life Replacement Option or GIO administration,
  - HSBC no-claim / backpay complexity unless it falls out directly from the narrow kernel.

Verification policy for this lane:
- For kernel/state slices, run:
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run catalog:build`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run catalog:family-classification`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run type-check`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npx vitest run src/lib/calculations/ilp.test.ts [touched parser tests] src/lib/ilp-catalog/templateToPolicy.test.ts`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run golden:refresh`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run golden:check`

What to avoid:
- Do not reopen the metadata-only lane.
- Do not keep doing parser-only narrowing on this branch.
- Do not spend time re-proving that SmartRetire or AIA are kernel-shaped; that has already been established.
- Do not treat underwriting/exclusion resets as part of the first kernel unless the active slice explicitly implements them.
- Do not silently claim support for admin or claim-state behavior that the engine still cannot execute.
- Do not stage unrelated dirt or the known excluded files.

Resume expectation:
- If resumed in a fresh session, continue from the AIA lapse/reinstatement/payout-state kernel immediately.
- Do not jump back to the old Tokio family.
- Use SmartRetire only as the already-proven blocker reference and later second-wave consumer.
