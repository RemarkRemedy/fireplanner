

## MANUAL
ILP lane process rule: one canonical worktree per lane. If vitest/session/turn is interrupted, audit diff first, inspect exact touched blocks, rerun touched tests, rerun full gate, then continue. Treat interruption as a high-risk state, not a checkpoint.


Agent lifecycle rule for Codex lanes: reuse existing subagents for nearby sidecar work, and close them immediately after their result is consumed. Do not leave idle agents alive and saturate the pool.
User directive: always reuse existing agents if the max thread limit has already been hit; do not keep spawning new agents into saturation. Reuse relevant agents first and close them after use.
Agent-memory update: reuse existing agents first after any max-limit hit; keep only 1-2 sidecars live; keep the blocking edit local; reuse briefly then close after integrating. Never claim an agent is gone just because an old ID is not_found if the UI still shows background agents. Treat the UI count as authoritative for saturation risk and avoid unnecessary new spawns under UI/tool mismatch.
## PRIORITY
Agent handling: reuse first after saturation, max 1-2 live sidecars, close after integration, and trust UI occupancy over stale not_found IDs when judging spawn capacity.
