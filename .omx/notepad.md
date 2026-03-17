

## PRIORITY
ILP lane runs a parser/kernel/promotion loop in /Users/tj/TJDevelopment/fireplanner-ilp on codex/ilp-lane. Parser until shared blocker; then spec->review->kernel impl->review->verify->approval->commit; then resume parser throughput. Stop only at real blocker.


## WORKING MEMORY
[2026-03-13T14:34:38.319Z] ILP execution loop for compaction resilience: work in /Users/tj/TJDevelopment/fireplanner-ilp on branch codex/ilp-lane. Current state after 2026-03-13 work: 13 catalog products, 6 supported, 7 partial. Latest parser commit in-progress corridor switched from Income to Etiqa; Etiqa flex cohort committed as 86dc91c. Real blocker identified for next Etiqa products (Invest smart flex II, Invest flex wealth II, Invest Wealth Purpose): missing cumulative-paid-regular-premium policy-charge basis. Execution spec written at frontend/docs/ilp-cumulative-paid-premium-charge-kernel-execution-spec.md. Loop rules: parser throughput for products fitting current kernels; if 2-3 viable products fail for same missing mechanic, switch to kernel mode; for kernel mode, write/review spec, implement kernel, direct calculator tests, proof parser, code review, full verification gate, stage and wait for human approval before commit; after approval/commit return to parser throughput. Parser commits may commit autonomously after verification. Ignore unrelated .omx files and CODEX_PROMPT_ILP_LANE.md.


## MANUAL
Repeated root-cause claim rule: if I say I fixed the root cause, but the same behavior happens 2-3 more times, stop treating notes/reminders as fixes. Escalate to a structural control-flow fix, persist it, and do not claim the issue is solved unless behavior changed or an external guard exists.
