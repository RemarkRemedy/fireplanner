#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# cf-domain-redirects.sh
#
# Adds secondary domains to Cloudflare and configures 301 redirects to
# sgfireplanner.com. Run once, then update nameservers at your registrar.
#
# Prerequisites:
#   1. Create an API token at https://dash.cloudflare.com/profile/api-tokens
#      with these permissions:
#        - Zone : Zone : Edit
#        - Zone : DNS : Edit
#        - Account : Account Rule Lists : Edit
#   2. Export it:  export CF_API_TOKEN="your-token-here"
#   3. Run:       bash scripts/cf-domain-redirects.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CF_ACCOUNT_ID="df358a75cf762ef4ee7844ae815131ed"
PRIMARY_DOMAIN="sgfireplanner.com"

REDIRECT_DOMAINS=(
  cpfretirementplanner.com
  sgfirecalculator.com
  sgfireplanning.com
  sgretirementcalculator.com
  sgretirementplanner.com
  sgretireplanner.com
  sgroboadvisor.com
  singaporefirecalculator.com
  singaporeretirementplanner.com
  thesgfireplanner.com
)

# Per-domain redirect targets (path on PRIMARY_DOMAIN)
# Domains not listed here default to "/"
get_redirect_path() {
  case "$1" in
    sgfirecalculator.com|sgretirementcalculator.com|singaporefirecalculator.com)
      echo "/retirement-calculator" ;;
    sgretirementplanner.com|sgretireplanner.com|singaporeretirementplanner.com)
      echo "/retirement-planner" ;;
    *)
      echo "/" ;;
  esac
}

# ── Preflight ────────────────────────────────────────────────────────────────
if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "Error: CF_API_TOKEN is not set."
  echo "Create one at https://dash.cloudflare.com/profile/api-tokens"
  echo "Required permissions: Zone:Edit, DNS:Edit, Account Rule Lists:Edit"
  echo ""
  echo "  export CF_API_TOKEN=\"your-token-here\""
  echo "  bash $0"
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $CF_API_TOKEN"

cf_api() {
  local method="$1" endpoint="$2" data="${3:-}"
  local args=(-s -X "$method" "https://api.cloudflare.com/client/v4${endpoint}" -H "$AUTH_HEADER" -H "Content-Type: application/json")
  [[ -n "$data" ]] && args+=(-d "$data")
  curl "${args[@]}"
}

check_success() {
  local response="$1" context="$2"
  local success
  success=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
  if [[ "$success" != "True" ]]; then
    local errors
    errors=$(echo "$response" | python3 -c "import json,sys; errs=json.load(sys.stdin).get('errors',[]); print('; '.join(e.get('message','?') for e in errs))" 2>/dev/null)
    echo "  WARN [$context]: $errors"
    return 1
  fi
  return 0
}

# Verify token works
echo "Verifying API token..."
verify=$(cf_api GET "/user/tokens/verify")
if ! check_success "$verify" "token verify"; then
  echo "API token is invalid or lacks permissions. Exiting."
  exit 1
fi
echo "  Token verified."
echo ""

# ── Step 1: Add zones ───────────────────────────────────────────────────────
echo "═══ Step 1: Adding zones ═══"
# Use a temp file for zone ID lookups (bash 3 compat — no associative arrays)
ZONE_MAP=$(mktemp)
trap "rm -f $ZONE_MAP" EXIT
NAMESERVER_INFO=""
ZONE_COUNT=0

for domain in "${REDIRECT_DOMAINS[@]}"; do
  echo -n "  Adding $domain... "

  # Check if zone already exists
  existing=$(cf_api GET "/zones?name=$domain&account.id=$CF_ACCOUNT_ID")
  existing_count=$(echo "$existing" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('result',[])))" 2>/dev/null)

  if [[ "$existing_count" -gt "0" ]]; then
    zone_id=$(echo "$existing" | python3 -c "import json,sys; print(json.load(sys.stdin)['result'][0]['id'])")
    echo "already exists (zone: $zone_id)"
    echo "$domain $zone_id" >> "$ZONE_MAP"
    ZONE_COUNT=$((ZONE_COUNT + 1))
  else
    result=$(cf_api POST "/zones" "{\"name\":\"$domain\",\"account\":{\"id\":\"$CF_ACCOUNT_ID\"},\"type\":\"full\"}")
    if check_success "$result" "add zone $domain"; then
      zone_id=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['id'])")
      ns=$(echo "$result" | python3 -c "import json,sys; print(', '.join(json.load(sys.stdin)['result']['name_servers']))")
      echo "added (zone: $zone_id)"
      echo "    Nameservers: $ns"
      echo "$domain $zone_id" >> "$ZONE_MAP"
      ZONE_COUNT=$((ZONE_COUNT + 1))
      NAMESERVER_INFO+="  $domain -> $ns"$'\n'
    else
      echo "failed, skipping"
    fi
  fi
done
echo ""

# Helper: look up zone ID from the temp file
get_zone_id() {
  grep "^$1 " "$ZONE_MAP" 2>/dev/null | awk '{print $2}'
}

# ── Step 2: Add DNS records (dummy A + www CNAME) ───────────────────────────
echo "═══ Step 2: Adding DNS records ═══"

for domain in "${REDIRECT_DOMAINS[@]}"; do
  zone_id=$(get_zone_id "$domain")
  [[ -z "$zone_id" ]] && continue

  echo "  $domain:"

  # Root A record (192.0.2.1 is RFC 5737 documentation address, proxied)
  existing_a=$(cf_api GET "/zones/$zone_id/dns_records?type=A&name=$domain")
  a_count=$(echo "$existing_a" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('result',[])))" 2>/dev/null)

  if [[ "$a_count" -gt "0" ]]; then
    echo "    @ A record exists, skipping"
  else
    result=$(cf_api POST "/zones/$zone_id/dns_records" \
      "{\"type\":\"A\",\"name\":\"@\",\"content\":\"192.0.2.1\",\"proxied\":true,\"ttl\":1}")
    if check_success "$result" "A record $domain"; then
      echo "    @ A -> 192.0.2.1 (proxied)"
    fi
  fi

  # www CNAME
  existing_cname=$(cf_api GET "/zones/$zone_id/dns_records?type=CNAME&name=www.$domain")
  cname_count=$(echo "$existing_cname" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('result',[])))" 2>/dev/null)

  if [[ "$cname_count" -gt "0" ]]; then
    echo "    www CNAME exists, skipping"
  else
    result=$(cf_api POST "/zones/$zone_id/dns_records" \
      "{\"type\":\"CNAME\",\"name\":\"www\",\"content\":\"$domain\",\"proxied\":true,\"ttl\":1}")
    if check_success "$result" "CNAME www.$domain"; then
      echo "    www CNAME -> $domain (proxied)"
    fi
  fi
done
echo ""

# ── Step 3: Create Bulk Redirect List + Rule ─────────────────────────────────
echo "═══ Step 3: Creating Bulk Redirect List ═══"

# Check if list already exists
existing_lists=$(cf_api GET "/accounts/$CF_ACCOUNT_ID/rules/lists")
list_id=$(echo "$existing_lists" | python3 -c "
import json,sys
for l in json.load(sys.stdin).get('result',[]):
    if l['name'] == 'seo_domain_redirects':
        print(l['id'])
        break
else:
    print('')
" 2>/dev/null)

if [[ -n "$list_id" ]]; then
  echo "  List 'seo_domain_redirects' already exists (id: $list_id)"
else
  result=$(cf_api POST "/accounts/$CF_ACCOUNT_ID/rules/lists" \
    "{\"name\":\"seo_domain_redirects\",\"kind\":\"redirect\",\"description\":\"SEO redirect domains to sgfireplanner.com\"}")
  if check_success "$result" "create list"; then
    list_id=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['id'])")
    echo "  Created list: $list_id"
  else
    echo "  Failed to create list. You may need to create Bulk Redirects manually."
    echo ""
    echo "═══ Summary ═══"
    echo "Zones and DNS records have been configured."
    echo "Bulk Redirect list creation failed (check API token permissions)."
    [[ -n "$NAMESERVER_INFO" ]] && echo "" && echo "Update nameservers at your registrar:" && echo "$NAMESERVER_INFO"
    exit 1
  fi
fi

# Build redirect items JSON with per-domain targets
echo "  Adding redirect entries..."
redirect_items="["
first=true
for domain in "${REDIRECT_DOMAINS[@]}"; do
  target_path=$(get_redirect_path "$domain")
  echo "    $domain -> https://$PRIMARY_DOMAIN$target_path"
  # Add root and www variants
  for prefix in "" "www."; do
    [[ "$first" == "true" ]] && first=false || redirect_items+=","
    redirect_items+="{\"redirect\":{\"source_url\":\"${prefix}${domain}/\",\"target_url\":\"https://$PRIMARY_DOMAIN${target_path}\",\"status_code\":301,\"include_subdomains\":false,\"subpath_matching\":true,\"preserve_query_string\":true}}"
  done
done
redirect_items+="]"

result=$(cf_api PUT "/accounts/$CF_ACCOUNT_ID/rules/lists/$list_id/items" "$redirect_items")
if check_success "$result" "add redirect items"; then
  item_count=$(echo "$result" | python3 -c "import json,sys; r=json.load(sys.stdin).get('result',{}); print(r.get('operation_id','done'))" 2>/dev/null)
  echo "  Added ${#REDIRECT_DOMAINS[@]} domains (root + www = $((${#REDIRECT_DOMAINS[@]} * 2)) entries)"
else
  echo "  Failed to add items to redirect list"
fi

# Create the Bulk Redirect Rule that references this list
echo ""
echo "═══ Step 4: Creating Bulk Redirect Rule ═══"

existing_rulesets=$(cf_api GET "/accounts/$CF_ACCOUNT_ID/rulesets")
redirect_ruleset_id=$(echo "$existing_rulesets" | python3 -c "
import json,sys
for r in json.load(sys.stdin).get('result',[]):
    if r.get('phase') == 'http_request_redirect':
        print(r['id'])
        break
else:
    print('')
" 2>/dev/null)

rule_payload="{\"rules\":[{\"expression\":\"http.request.full_uri in \\\$seo_domain_redirects\",\"description\":\"SEO domain 301 redirects to sgfireplanner.com\",\"action\":\"redirect\",\"action_parameters\":{\"from_list\":{\"name\":\"seo_domain_redirects\",\"key\":\"http.request.full_uri\"}}}]}"

if [[ -n "$redirect_ruleset_id" ]]; then
  echo "  Redirect phase ruleset exists ($redirect_ruleset_id), adding rule..."
  # Get existing rules to avoid duplicating
  existing_rules=$(cf_api GET "/accounts/$CF_ACCOUNT_ID/rulesets/$redirect_ruleset_id")
  has_rule=$(echo "$existing_rules" | python3 -c "
import json,sys
for r in json.load(sys.stdin).get('result',{}).get('rules',[]):
    if 'seo_domain_redirects' in r.get('expression',''):
        print('yes')
        break
else:
    print('no')
" 2>/dev/null)

  if [[ "$has_rule" == "yes" ]]; then
    echo "  Rule already exists, skipping"
  else
    result=$(cf_api POST "/accounts/$CF_ACCOUNT_ID/rulesets/$redirect_ruleset_id/rules" \
      "{\"expression\":\"http.request.full_uri in \\\$seo_domain_redirects\",\"description\":\"SEO domain 301 redirects to sgfireplanner.com\",\"action\":\"redirect\",\"action_parameters\":{\"from_list\":{\"name\":\"seo_domain_redirects\",\"key\":\"http.request.full_uri\"}}}")
    if check_success "$result" "create redirect rule"; then
      echo "  Redirect rule created."
    fi
  fi
else
  echo "  Creating redirect phase ruleset..."
  result=$(cf_api PUT "/accounts/$CF_ACCOUNT_ID/rulesets/phases/http_request_redirect/entrypoint" "$rule_payload")
  if check_success "$result" "create redirect ruleset"; then
    echo "  Redirect ruleset + rule created."
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Done! Summary:"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Zones added:      ${ZONE_COUNT}/${#REDIRECT_DOMAINS[@]}"
echo "DNS records:      A (192.0.2.1 proxied) + www CNAME per domain"
echo "Bulk redirects:   $((${#REDIRECT_DOMAINS[@]} * 2)) entries -> https://$PRIMARY_DOMAIN (per-domain paths)"
echo ""

if [[ -n "$NAMESERVER_INFO" ]]; then
  echo "MANUAL STEP REQUIRED: Update nameservers at your registrar"
  echo "for newly added domains:"
  echo ""
  echo "$NAMESERVER_INFO"
  echo "Go to your registrar (Namecheap, etc.) and replace the"
  echo "existing nameservers with the Cloudflare ones listed above."
  echo ""
fi

echo "After nameservers propagate (up to 24h), verify with:"
echo "  curl -sI https://sgfirecalculator.com | grep -i location"
echo "  # Should show: location: https://sgfireplanner.com/"
