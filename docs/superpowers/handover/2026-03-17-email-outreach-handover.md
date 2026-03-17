# Email Outreach System - Handover Context

**Date:** 2026-03-17
**Status:** Spec complete, implementation not started

## What was done

1. Analyzed D1 signup data: 87 total signups (81 expense tracker, 6 general)
2. Designed a personalized email outreach system with preference collection
3. Wrote full spec: `docs/superpowers/specs/2026-03-17-email-outreach-system-design.md`
4. Reviewed by 4 agents (Codex, Gemini Pro, Claude Architect, Claude Feasibility)
5. Fixed all 6 blockers, 12 warnings, 9 suggestions in the spec
6. Committed spec to main

## Key decisions made

- **Email provider:** Resend (user hasn't signed up yet)
- **Tone:** Indie builder, personal but professional (A leaning into C)
- **First email purpose:** Collect engagement preferences + feature requests
- **Preference page:** Standalone HTML at `/email-prefs.html` (not React route)
- **Token design:** HMAC-SHA256, 32 hex chars, reusable until 30-day expiry, fresh per campaign
- **Personalization:** 4 variants by expense_tracking_status, 3 by primary_device
- **Phase 1:** Local script via `npx tsx`, Phase 2: automated CF Pages Function

## Blockers resolved in spec (do not re-introduce)

1. Consent scope: privacy page must be updated before sending
2. Tokens must be reusable (not single-use) for unsubscribe to work
3. No `crypto.randomBytes` in CF Workers: use `crypto.getRandomValues` / `crypto.subtle`
4. D1 writes use batch `--file`, not inline SQL per recipient
5. `updated_at` needs explicit handling (D1 has no triggers)
6. `functions/tsconfig.json` must be updated for new shared imports

## What to do next

### Before sending any email
1. User signs up for Resend, adds `sgfireplanner.com` domain
2. Add DNS records: DKIM (3 CNAMEs from Resend), SPF update, DMARC TXT record
3. Update privacy page + signup copy for broader consent scope
4. Deploy consent updates to production

### Implementation
1. Write implementation plan (invoke `superpowers:writing-plans` skill)
2. Input: the spec at `docs/superpowers/specs/2026-03-17-email-outreach-system-design.md`
3. Build order: D1 migration -> CF Function -> preference page -> send script -> templates
4. Test: send to yourself first, then `stopped` group (13 people), then expand

### Domain redirect updates (separate task, can be done in parallel)
Update Cloudflare Bulk Redirect list to point domains to matching pages:
- sgretirementplanner.com, sgretireplanner.com, singaporeretirementplanner.com -> `/retirement-planner`
- sgfirecalculator.com, sgretirementcalculator.com, singaporefirecalculator.com -> `/retirement-calculator`
- cpfretirementplanner.com -> `/` (or future `/cpf-planner` page)
- sgroboadvisor.com -> `/` (or future `/compare` page)
- sgfireplanning.com, thesgfireplanner.com -> `/`

## D1 database info

- Database name: `sgfire-emails`
- Tables: `email_signups`, `expense_tracker_signups` (existing), plus 3 new tables in spec
- Query expense tracker data from `expense_tracker_signups` (not `email_signups`)

## Signup data snapshot (as of 2026-03-17)

- Total signups: 87 in `email_signups`, 81 in `expense_tracker_signups`
- Biggest day: Mar 16 (40 signups)
- By tracking status: consistent(33), sometimes(26), stopped(13), not_currently(9)
- By device: iPhone(49), Android(25), both(4), unknown(3)
- By source: expense_tracker(~75), landing_page(~5), post_simulation(~5)
