#!/usr/bin/env bash
# Quick check of email signups in production D1
# Usage: ./scripts/check-emails.sh [count]
#   count  - number of recent entries to show (default: 20)

set -euo pipefail
cd "$(dirname "$0")/.."

LIMIT="${1:-20}"

echo "=== Email Signups (latest $LIMIT) ==="
npx wrangler d1 execute sgfire-emails --remote \
  --command "SELECT id, email, source, feature_interest, created_at, updated_at FROM email_signups ORDER BY id DESC LIMIT $LIMIT;" \
  --json 2>/dev/null | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const rows = data[0]?.results ?? [];
if (!rows.length) { console.log('No signups found.'); process.exit(0); }
console.table(rows);
console.log('\nTotal shown:', rows.length);
"

echo ""
echo "=== Summary ==="
npx wrangler d1 execute sgfire-emails --remote \
  --command "SELECT COUNT(*) as total_signups, COUNT(feature_interest) as with_feature, COUNT(*) - COUNT(feature_interest) as without_feature, MIN(created_at) as first_signup, MAX(created_at) as latest_signup FROM email_signups;" \
  --json 2>/dev/null | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const row = data[0]?.results?.[0];
if (!row) { console.log('No data.'); process.exit(0); }
for (const [k,v] of Object.entries(row)) console.log('  ' + k.padEnd(20) + v);
"
