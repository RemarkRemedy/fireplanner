#!/usr/bin/env bash
set -euo pipefail
REPO="RemarkRemedy/fireplanner"

command -v gh >/dev/null 2>&1 || { echo "ERROR: gh not installed"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated. Run: gh auth login"; exit 1; }

MS="Bridge Integration"

if [[ "$(gh api "repos/$REPO/milestones" --paginate | python3 - <<'PY'
import json,sys
ms=json.load(sys.stdin)
print("found" if any(m.get("title")=="Bridge Integration" for m in ms) else "missing")
PY
)" == "missing" ]]; then
  gh api -X POST "repos/$REPO/milestones" -f title="$MS" -f state="open" >/dev/null
  echo "Created milestone: $MS"
else
  echo "Milestone exists: $MS"
fi

gh label create "area:bridge" --repo "$REPO" --force >/dev/null 2>&1 || true
gh label create "type:feature" --repo "$REPO" --force >/dev/null 2>&1 || true
gh label create "priority:P0" --repo "$REPO" --force >/dev/null 2>&1 || true

MSN="$(gh api "repos/$REPO/milestones" --paginate | python3 - <<'PY'
import json,sys
ms=json.load(sys.stdin)
for m in ms:
  if m.get("title")=="Bridge Integration":
    print(m.get("number"))
    break
PY
)"

issue_exists() {
  local title="$1"
  gh issue list --repo "$REPO" --search "$title in:title" --json title --jq '.[] | select(.title=="'"$title"'") | .title' | grep -qx "$title"
}

create_issue() {
  local title="$1"
  local body="$2"
  if issue_exists "$title"; then
    echo "Issue exists, skipping: $title"
    return 0
  fi
  gh issue create --repo "$REPO" --title "$title" --body "$body" --milestone "$MSN" --label "area:bridge,type:feature,priority:P0"
}

create_issue "Bridge: Import PlannerSnapshot JSON + Export Result JSON" \
"## Goal
Add a Bridge panel to paste PlannerSnapshot JSON (from expense app), map to inputs, run sim, and export results JSON.

## Export keys (minimum)
- p_success
- WR_critical_50
Optional: horizonYears, allocationSummary, wrCritical10/90, fireAge, portfolioAtFire, computedAt, inputsHash

## Acceptance
Copy/paste roundtrip works with RemarkRemedy/expense."

create_issue "Bridge: Canonical WR_critical_50 computation for export" \
"## Goal
Define and implement one canonical computation for WR_critical_50 and export it consistently.

## Context
MC engine computes withdrawal bands and percentiles; bridge export must use a single function.

## Acceptance
Stable WR_critical_50 with fixed seed, exported exactly as 'WR_critical_50'."

echo "✅ Done creating issues in $REPO"
