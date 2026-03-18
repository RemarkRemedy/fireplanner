#!/usr/bin/env bash
# Update redirect targets using Page Rules (one per domain zone).
# Requires CF_API_TOKEN with Zone:Read + Page Rules:Edit
# Compatible with macOS bash 3 (no associative arrays)
set -euo pipefail

CF_ACCOUNT_ID="df358a75cf762ef4ee7844ae815131ed"
PRIMARY="sgfireplanner.com"
AUTH="Authorization: Bearer $CF_API_TOKEN"

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "Error: CF_API_TOKEN not set"
  exit 1
fi

get_target() {
  case "$1" in
    sgfirecalculator.com|sgretirementcalculator.com|singaporefirecalculator.com)
      echo "/retirement-calculator" ;;
    sgretirementplanner.com|sgretireplanner.com|singaporeretirementplanner.com)
      echo "/retirement-planner" ;;
    *)
      echo "/" ;;
  esac
}

DOMAINS=(
  sgfirecalculator.com
  sgretirementcalculator.com
  singaporefirecalculator.com
  sgretirementplanner.com
  sgretireplanner.com
  singaporeretirementplanner.com
  cpfretirementplanner.com
  sgfireplanning.com
  sgroboadvisor.com
  thesgfireplanner.com
)

for domain in "${DOMAINS[@]}"; do
  target=$(get_target "$domain")
  echo -n "  $domain -> $target ... "

  zone_id=$(curl -s -H "$AUTH" \
    "https://api.cloudflare.com/client/v4/zones?name=$domain&account.id=$CF_ACCOUNT_ID" \
    | python3 -c "import json,sys; r=json.load(sys.stdin).get('result',[]); print(r[0]['id'] if r else '')" 2>/dev/null)

  if [[ -z "$zone_id" ]]; then
    echo "SKIP (zone not found)"
    continue
  fi

  existing=$(curl -s -H "$AUTH" \
    "https://api.cloudflare.com/client/v4/zones/$zone_id/pagerules")
  rule_count=$(echo "$existing" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('result',[])))" 2>/dev/null)

  rule_json="{\"targets\":[{\"target\":\"url\",\"constraint\":{\"operator\":\"matches\",\"value\":\"*${domain}/*\"}}],\"actions\":[{\"id\":\"forwarding_url\",\"value\":{\"url\":\"https://${PRIMARY}${target}\",\"status_code\":301}}],\"status\":\"active\",\"priority\":1}"

  if [[ "$rule_count" -gt "0" ]]; then
    rule_id=$(echo "$existing" | python3 -c "import json,sys; print(json.load(sys.stdin)['result'][0]['id'])" 2>/dev/null)
    result=$(curl -s -X PUT -H "$AUTH" -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/zones/$zone_id/pagerules/$rule_id" \
      -d "$rule_json")
  else
    result=$(curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/zones/$zone_id/pagerules" \
      -d "$rule_json")
  fi

  success=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  if [[ "$success" == "True" ]]; then
    echo "OK"
  else
    err=$(echo "$result" | python3 -c "import json,sys; errs=json.load(sys.stdin).get('errors',[]); print(errs[0].get('message','?') if errs else '?')" 2>/dev/null)
    echo "FAIL ($err)"
  fi
done

echo ""
echo "Done. Verify with:"
echo "  curl -sI https://sgretirementplanner.com | grep -i location"
echo "  # Expected: location: https://sgfireplanner.com/retirement-planner"
