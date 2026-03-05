#!/usr/bin/env bash
set -euo pipefail
REPO="RemarkRemedy/expense"

command -v gh >/dev/null 2>&1 || { echo "ERROR: gh not installed"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated. Run: gh auth login"; exit 1; }

MS1="1.0 Foundation"
MS2="1.0 Planner UX"
MS3="1.0 Desktop Companion"
MS4="1.0 Simulation + CPF + Scenarios"
MS5="1.0 Release Hardening"

ensure_milestone() {
  local title="$1"
  # create if not exists
  if ! gh api "repos/$REPO/milestones" --paginate | python3 - "$title" <<'PY'
import json,sys
title=sys.argv[1]
ms=json.load(sys.stdin)
print("found" if any(m.get("title")==title for m in ms) else "missing")
PY
  then
    :
  fi
  local status
  status="$(gh api "repos/$REPO/milestones" --paginate | python3 - "$title" <<'PY'
import json,sys
title=sys.argv[1]
ms=json.load(sys.stdin)
print("found" if any(m.get("title")==title for m in ms) else "missing")
PY
)"
  if [[ "$status" == "missing" ]]; then
    gh api -X POST "repos/$REPO/milestones" -f title="$title" -f state="open" >/dev/null
    echo "Created milestone: $title"
  else
    echo "Milestone exists: $title"
  fi
}

ensure_milestone "$MS1"
ensure_milestone "$MS2"
ensure_milestone "$MS3"
ensure_milestone "$MS4"
ensure_milestone "$MS5"

labels=(
  "area:bridge"
  "area:planner"
  "area:companion"
  "area:cpf"
  "area:simulation"
  "type:feature"
  "type:refactor"
  "type:bug"
  "type:chore"
  "priority:P0"
  "priority:P1"
  "priority:P2"
)

for l in "${labels[@]}"; do
  gh label create "$l" --repo "$REPO" --force >/dev/null 2>&1 || true
done
echo "Labels ensured."

ms_number() {
  local title="$1"
  gh api "repos/$REPO/milestones" --paginate | python3 - "$title" <<'PY'
import json,sys
title=sys.argv[1]
ms=json.load(sys.stdin)
for m in ms:
  if m.get("title")==title:
    print(m.get("number"))
    raise SystemExit(0)
raise SystemExit(1)
PY
}

MS1N="$(ms_number "$MS1")"
MS2N="$(ms_number "$MS2")"
MS3N="$(ms_number "$MS3")"
MS4N="$(ms_number "$MS4")"
MS5N="$(ms_number "$MS5")"

issue_exists() {
  local title="$1"
  gh issue list --repo "$REPO" --search "$title in:title" --json title --jq '.[] | select(.title=="'"$title"'") | .title' | grep -qx "$title"
}

create_issue() {
  local title="$1"
  local body_file="$2"
  local milestone_number="$3"
  local labels_csv="$4"

  if issue_exists "$title"; then
    echo "Issue exists, skipping: $title"
    return 0
  fi

  local url
  url="$(gh issue create --repo "$REPO" --title "$title" --body-file "$body_file" --milestone "$milestone_number" --label "$labels_csv")"
  echo "Created: $url"
}

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

cat >"$tmpdir/PR01.md" <<'MD'
## Goal
Ship a stable, versioned bridge contract to safely evolve export/import without breaking older payloads.

## Context
- Bridge code: `Application/Sources/Application/SGFirePlannerBridgeUseCase.swift`
- Current import supports bare payload with keys `p_success`, `WR_critical_50`.

## Scope
- Add `PlannerBridgeEnvelope<T>` with fields: `schema`, `version`, `payload`, `inputsHash?`
- Export can output enveloped JSON (keep existing prettyPrinted+sortedKeys style).
- Import accepts both bare + envelope.
- Compute/store `inputsHash` (SHA256 over canonical JSON).
- Unit tests for both parsing paths.

## Acceptance Criteria
- Backwards compatible with current payloads.
- Enveloped import/export works.
- `inputsHash` persisted with planner results.
MD

cat >"$tmpdir/PR02.md" <<'MD'
## Goal
Export a planner-grade snapshot JSON so FIRE simulations can be accurate.

## Scope
- Add `PlannerSnapshotV1` + encode via `PlannerBridgeEnvelope<PlannerSnapshotV1>`.
- Include:
  - asOfISO8601, monthKey
  - structuralMode, safetyPreference, sustainabilityLens
  - cashflow averages + observationWindowDays
  - balances (cash, investments, optional CPF OA/SA/MA)
- Add `exportPlannerSnapshotJSON(asOfDate:)` in `SGFirePlannerBridgeUseCase`.

## Acceptance Criteria
- No raw transactions in snapshot export.
- Averages are deterministic.
MD

cat >"$tmpdir/PR03.md" <<'MD'
## Goal
Ensure investable assets and withdrawal assumptions are first-class and consistent.

## Scope
- Wire persistence + UI to set investable assets and (if needed) annual withdrawal.
- Ensure snapshot export uses a single source of truth for investments balance.

## Acceptance Criteria
- User can set investable assets; export includes correct value.
MD

cat >"$tmpdir/PR04.md" <<'MD'
## Goal
Add CPF balances (OA/SA/MA) as first-class local persisted values and include them in exports.

## Acceptance Criteria
- CPF balances persist.
- Snapshot export includes CPF balances.
- SGD labels everywhere.
MD

cat >"$tmpdir/PR05.md" <<'MD'
## Goal
Support richer import results + freshness metadata.

## Scope
- Extend import payload with optional fields: wrCritical10/90, fireAge, portfolioAtFire, computedAt, inputsHash.
- Persist lastPlannerResultAt + lastPlannerInputsHash.

## Acceptance Criteria
- Still accepts old payload shape.
- Planner screen can show freshness.
MD

cat >"$tmpdir/PR06.md" <<'MD'
## Goal
Add a first-class mobile Planner screen + home card.

## Acceptance Criteria
- After import, user sees p_success / WR_critical_50 / horizon / allocation + timestamps.
- Clear connected/stale/not connected states.
MD

cat >"$tmpdir/PR07.md" <<'MD'
## Goal
Desktop companion must display SGD (currently hardcoded USD) and ideally be config-driven.

## Acceptance Criteria
- Desktop shows SGD everywhere.
- No regressions.
MD

cat >"$tmpdir/PR08.md" <<'MD'
## Goal
Expose planner status/export/import via Desktop Companion API.

## Scope
- Extend Companion API bridging to expose sgfpStatus/export/import.
- Add routes: GET /sgfp/status, GET /sgfp/export, POST /sgfp/import.

## Acceptance Criteria
- Token-protected, respects TTL.
- Matches mobile results/snapshot.
MD

cat >"$tmpdir/PR09.md" <<'MD'
## Goal
Desktop companion UI: add a FIRE Planner panel (copy snapshot, paste result, view metrics).

## Acceptance Criteria
- Entire planner loop doable on desktop.
- Friendly errors for expired session.
MD

cat >"$tmpdir/PR12.md" <<'MD'
## Goal
Deterministic projection engine (instant deltas).

## Acceptance Criteria
- Runs instantly, stable, provides "spend -$X => retire ~Y earlier".
MD

cat >"$tmpdir/PR13.md" <<'MD'
## Goal
Monte Carlo engine in Swift for full offline 1.0.

## Acceptance Criteria
- 5k-10k sims in background, no UI freeze.
- Produces p_success and WR_critical_50 within tolerance vs web.
MD

cat >"$tmpdir/PR14.md" <<'MD'
## Goal
CPF Engine v1 + CPF LIFE income integration.

## Acceptance Criteria
- CPF projections + CPF LIFE payout estimate visible.
- Retirement simulation incorporates CPF LIFE income.
MD

cat >"$tmpdir/PR15.md" <<'MD'
## Goal
Housing model v1 (mortgage + CPF OA usage impact).

## Acceptance Criteria
- Housing plan changes retirement outputs predictably.
MD

cat >"$tmpdir/PR16.md" <<'MD'
## Goal
Scenarios + comparison UX (A vs B).

## Acceptance Criteria
- Duplicate scenario, tweak knob, compare p_success/WR/fireAge.
MD

cat >"$tmpdir/PR17.md" <<'MD'
## Goal
Release QA hardening.

## Acceptance Criteria
- Bridge parsing tests, companion auth tests, determinism tests, migration tests.
MD

cat >"$tmpdir/PR18.md" <<'MD'
## Goal
Release packaging: SG-only distribution + privacy/trust polish.

## Acceptance Criteria
- SGD everywhere, disclaimers, privacy labels accurate.
MD

create_issue "PR01: Bridge Contract v1 (Envelope + inputsHash + backwards-compatible import)" "$tmpdir/PR01.md" "$MS1N" "area:bridge,type:refactor,priority:P0"
create_issue "PR02: PlannerSnapshot v1 export (planner-grade snapshot JSON)" "$tmpdir/PR02.md" "$MS1N" "area:bridge,area:planner,type:feature,priority:P0"
create_issue "PR03: Investable assets + withdrawal assumptions wired as single source of truth" "$tmpdir/PR03.md" "$MS1N" "area:planner,type:feature,priority:P0"
create_issue "PR04: CPF balances persisted + exported (OA/SA/MA)" "$tmpdir/PR04.md" "$MS4N" "area:cpf,area:planner,type:feature,priority:P0"
create_issue "PR05: Import payload v1 richer results + freshness metadata" "$tmpdir/PR05.md" "$MS2N" "area:bridge,area:planner,type:feature,priority:P0"
create_issue "PR06: Mobile Planner screen + home card" "$tmpdir/PR06.md" "$MS2N" "area:planner,type:feature,priority:P0"
create_issue "PR07: Desktop Companion currency fix (USD->SGD) + config-driven currency" "$tmpdir/PR07.md" "$MS3N" "area:companion,type:bug,priority:P0"
create_issue "PR08: Desktop Companion planner endpoints (/sgfp/status|export|import)" "$tmpdir/PR08.md" "$MS3N" "area:companion,area:bridge,type:feature,priority:P0"
create_issue "PR09: Desktop Companion FIRE Planner panel UI" "$tmpdir/PR09.md" "$MS3N" "area:companion,type:feature,priority:P0"
create_issue "PR12: Deterministic projection engine (instant FIRE deltas)" "$tmpdir/PR12.md" "$MS4N" "area:simulation,area:planner,type:feature,priority:P1"
create_issue "PR13: Monte Carlo engine in Swift (offline 1.0)" "$tmpdir/PR13.md" "$MS4N" "area:simulation,type:feature,priority:P1"
create_issue "PR14: CPF Engine v1 + CPF LIFE income integration" "$tmpdir/PR14.md" "$MS4N" "area:cpf,area:simulation,type:feature,priority:P1"
create_issue "PR15: Housing model v1 (mortgage + CPF OA impact)" "$tmpdir/PR15.md" "$MS4N" "area:planner,type:feature,priority:P2"
create_issue "PR16: Scenarios + comparison UX" "$tmpdir/PR16.md" "$MS4N" "area:planner,type:feature,priority:P1"
create_issue "PR17: Release QA hardening (tests, migrations, determinism)" "$tmpdir/PR17.md" "$MS5N" "type:chore,priority:P0"
create_issue "PR18: App Store release packaging (SG-only) + privacy/trust polish" "$tmpdir/PR18.md" "$MS5N" "type:chore,priority:P0"

echo "✅ Done creating issues in $REPO"
