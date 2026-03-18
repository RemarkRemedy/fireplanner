#!/usr/bin/env bash
# Quick script to update redirect targets only (zones/DNS already set up).
# Usage: export CF_API_TOKEN="your-token" && bash scripts/update-redirects.sh
set -euo pipefail

CF_ACCOUNT_ID="df358a75cf762ef4ee7844ae815131ed"
PRIMARY="sgfireplanner.com"

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "Error: CF_API_TOKEN not set"
  echo "  export CF_API_TOKEN=\"your-token\""
  exit 1
fi

AUTH="Authorization: Bearer $CF_API_TOKEN"

# Find the existing redirect list
echo "Looking up redirect list..."
list_id=$(curl -s -H "$AUTH" "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/rules/lists" \
  | python3 -c "
import json,sys
for l in json.load(sys.stdin).get('result',[]):
    if l['name'] == 'seo_domain_redirects':
        print(l['id']); break
else:
    print('')
")

if [[ -z "$list_id" ]]; then
  echo "Error: redirect list 'seo_domain_redirects' not found"
  exit 1
fi
echo "  Found list: $list_id"

# Build redirect entries with per-domain targets
echo "Building redirect entries..."
items='['
first=true

add_entry() {
  local src="$1" target="$2"
  [[ "$first" == "true" ]] && first=false || items+=","
  items+="{\"redirect\":{\"source_url\":\"${src}/\",\"target_url\":\"https://${PRIMARY}${target}\",\"status_code\":301,\"include_subdomains\":false,\"subpath_matching\":true,\"preserve_query_string\":true}}"
}

# Calculator domains -> /retirement-calculator
for d in sgfirecalculator.com sgretirementcalculator.com singaporefirecalculator.com; do
  add_entry "$d" "/retirement-calculator"
  add_entry "www.$d" "/retirement-calculator"
  echo "  $d -> /retirement-calculator"
done

# Planner domains -> /retirement-planner
for d in sgretirementplanner.com sgretireplanner.com singaporeretirementplanner.com; do
  add_entry "$d" "/retirement-planner"
  add_entry "www.$d" "/retirement-planner"
  echo "  $d -> /retirement-planner"
done

# Remaining domains -> /
for d in cpfretirementplanner.com sgfireplanning.com sgroboadvisor.com thesgfireplanner.com; do
  add_entry "$d" "/"
  add_entry "www.$d" "/"
  echo "  $d -> /"
done

items+=']'

# Replace all redirect entries
echo ""
echo "Updating Cloudflare Bulk Redirect list..."
result=$(curl -s -X PUT \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/rules/lists/$list_id/items" \
  -d "$items")

success=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
if [[ "$success" == "True" ]]; then
  echo "Done! 20 redirect entries updated."
  echo ""
  echo "Verify with:"
  echo "  curl -sI https://sgretirementplanner.com | grep -i location"
else
  errors=$(echo "$result" | python3 -c "import json,sys; errs=json.load(sys.stdin).get('errors',[]); print('; '.join(e.get('message','?') for e in errs))" 2>/dev/null)
  echo "Failed: $errors"
fi
