Use [$autopilot-loop](/Users/tj/.agents/skills/autopilot-loop/SKILL.md) for this entire turn.

Continue the ILP execution loop in `/Users/tj/TJDevelopment/fireplanner-ilp-lane` on branch `codex/ilp-lane`.

Execution policy:
- Persistent loop, not milestone-based.
- Do not stop on commits, green tests, green gates, summaries, checkpoints, or “good handoff” moments.
- Only stop for:
  1. a real hard blocker,
  2. a required human modeling/business-rule decision,
  3. a tool/system failure that actually prevents progress,
  4. an explicit user stop request.

Critical non-stop rule:
- A chat/turn boundary is not a blocker and not a stop condition.
- If the app forces you to emit a response because the turn is ending, do not frame that as stopped, blocked, or completed.
- Treat that as non-terminal continuation state only.
- If forced to respond at turn end without a real blocker, the first line must be:
  `Non-terminal turn boundary: continue same lane.`
- After that, give only the minimal live cursor needed to resume and do not present it as a stop reason.

Canonical lane:
- Repo: `/Users/tj/TJDevelopment/fireplanner-ilp-lane`
- Branch: `codex/ilp-lane`
- Stay in this worktree only.

Current standing unrelated dirt:
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/docs/ilp-mechanics-family-classification.md`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/scripts/ilp-catalog/fixtures/audit/family-classification.json`
- `.codex-tmp/`
- `.omx/*`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/.codex-tmp-tokio-secure-keys.ts`
- `/Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend/.codex-tmp-tokio-secure.ts`
- Do not touch or revert that unrelated dirt unless the active slice truly requires it.

Lane objective:
- Real ILP support expansion, parser slice first, then kernel only when repeated honest promotion failures point to the same missing mechanic.
- Do not spend the lane on page-proofing or `frontend/src/pages/IlpReviewPage.test.tsx` unless a real parser/kernel slice directly requires it.
- Do not let test-only commits define the cursor.

Latest repo state:
- latest landed commits:
  - `b4070560 feat(ilp): promote income invest flex`
  - `747bb909 feat(ilp): promote income invest flex trivantage`
- current catalog state: `92 products / 21 supported / 71 partial / 0 parser-error / 92 summary sources`
- live cursor: `income-invest-flex-vantage`

Operating mode:
1. Verify branch and status in `/Users/tj/TJDevelopment/fireplanner-ilp-lane`.
2. Inspect the current live parser/support cursor with real file reads.
3. Finish the active cheap honest slice first.
4. Run the required gate for that slice.
5. Commit the active slice if policy requires it.
6. Immediately start the next real candidate in the same turn.

Primary lane priority:
1. Screen close-to-supported parser candidates first.
2. Prefer honest promotion work on products with no remaining kernel blockers.
3. If 2-3 candidates fail for the same missing mechanic, switch to kernel mode on that mechanic.

Current best parser-first direction:
- Continue screening and promoting the close-to-supported partials before creating another kernel.
- The current highest-leverage family is the Income `Invest Flex` cohort.
- Recent landed parser promotions in this family are:
  - `b4070560 feat(ilp): promote income invest flex`
  - `747bb909 feat(ilp): promote income invest flex trivantage`
- Do not reopen `income-invest-flex` or `income-invest-flex-trivantage` unless a real regression appears.
- Live cursor is `income-invest-flex-vantage`.
- Current source proof for `income-invest-flex-vantage` already supports the same general promotion shape as the two landed Income slices:
  - policy fee is published,
  - death / TI insurance cover charge starts from policy year 3,
  - sum at risk is based on `101% of net premium(s) paid - policy value`,
  - the life-events withdrawal benefit waives withdrawal charge and preserves loyalty-bonus eligibility,
  - the current parser still lacks those fee rules and still omits regular-premium routing on the policy account.
- Treat `income-invest-flex-vantage` as the next cheap honest parser-promotion candidate, not as a kernel candidate by default.
- If `income-invest-flex-vantage` proves honestly promotable, implement the promotion, refresh supported golden fixtures, gate it, and commit it.
- If it fails for a materially different reason than the prior Income slices, move to the next close-to-supported candidate instead of grinding.

Kernel fallback rule:
- Only enter kernel mode when repeated parser screens fail for the same missing mechanic.
- The dominant remaining kernel themes are:
  - `distribution-mode-assumption-model`
  - `protection-structure-kernel`
  - `payment-history-kernel`

Verification policy:
- For parser/support slices, run:
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run catalog:build`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run catalog:family-classification`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run type-check`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npx vitest run [touched parser tests] src/lib/ilp-catalog/templateToPolicy.test.ts`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run golden:check`
- For kernel slices, run:
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run catalog:build`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run catalog:family-classification`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run type-check`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npx vitest run src/lib/calculations/ilp.test.ts [touched parser tests] src/lib/ilp-catalog/templateToPolicy.test.ts`
  - `cd /Users/tj/TJDevelopment/fireplanner-ilp-lane/frontend && npm run golden:check`

Kernel commit rule:
- Stage only the active slice.
- Run Claude review on the staged diff.
- Commit only if the kernel gate is green and Claude is clear.
- Gemini may be skipped if Claude is clear.

Commit-and-continue rule:
- A commit is not a completion event.
- After any successful commit, the very next action must be another concrete tool action on the next live candidate.
- “Next I would…” is not enough; actually open the next parser or source in the same turn.

What to avoid:
- Do not call a turn boundary a blocker.
- Do not stop for summaries.
- Do not stop because enough progress has been made for one message.
- Do not drift back into `IlpReviewPage.test.tsx` throughput.
- Do not treat seeded-page proofs as meaningful lane progress by themselves.

Current resume expectation:
- If resumed after a non-terminal turn boundary, continue from `income-invest-flex-vantage` immediately without re-planning the lane from scratch.
