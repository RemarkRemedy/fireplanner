# Email Outreach System Design

**Date:** 2026-03-17
**Status:** Draft (reviewed by 4 agents: Codex, Gemini Pro, Claude Architect, Claude Feasibility)

## Overview

An email outreach system for SGFirePlanner to engage the 87 existing signups and future signups. Two phases:

- **Phase 1 (now):** Local Node script sends personalized preference-collection emails via Resend API. Standalone landing page collects engagement preferences and feature requests.
- **Phase 2 (later):** Automated CF Pages Function sends the preference email on every new signup.

## Prerequisites (before any email is sent)

### Consent Scope Update (BLOCKER from review)

The current privacy page (`PrivacyPage.tsx`) and signup copy (`LandingEmailSection.tsx`) promise emails only for "major feature launches." This spec expands scope to tester outreach, progress updates, and feature requests. **Before sending the first email:**

1. Update `PrivacyPage.tsx` email section to say: "product updates, feature progress, feedback requests, and launch announcements"
2. Update `LandingEmailSection.tsx` disclosure copy to match
3. Deploy the updated pages to production

This is a PDPA (Singapore Personal Data Protection Act) compliance requirement. Do not send emails until consent language is updated.

### DNS Setup

Complete the Email Deliverability Prerequisites section (DKIM, SPF, DMARC) and verify in Resend dashboard before first send.

## Flow

```
Phase 1 (manual):
[Local script] → queries D1 for recipients
    → generates HMAC tokens, inserts into email_tokens table
    → builds personalized email per recipient (by tracking_status + device)
    → sends via Resend API
    → recipient clicks preference link
    → lands on /email-prefs.html?t=<opaque-token>&pref=tester
    → page calls GET /api/email-pref?t=xxx to resolve token
    → page shows preference pre-selected, option to change + free-text field
    → form submits to POST /api/email-pref
    → CF Function validates token, saves to email_preferences table

Phase 2 (automated):
[User signs up] → existing signup CF Function
    → generates token, inserts into email_tokens
    → calls Resend API to send preference email
    → same landing page flow as above
```

## Email Personalization

### Segments

| Segment | Query source | Count | Template |
|---------|-------------|-------|----------|
| Expense tracker signups | `expense_tracker_signups` table (has `expense_tracking_status`, `primary_device`) | ~81 | Personalized by tracking_status + device |
| General signups | `email_signups WHERE source NOT IN ('expense_tracker')` | ~6 | Generic opener |

**Note:** The `expense_tracker_signups` table is the source of truth for personalization fields. The `email_signups` table only has `email`, `source`, and `feature_interest` (no tracking status or device). The send script must JOIN or query `expense_tracker_signups` directly for the expense tracker segment.

### Opening line by `expense_tracking_status`

| Status | Count | Opening |
|--------|-------|---------|
| `consistent` | 33 | "You mentioned you're already tracking expenses consistently. That's great, and honestly rare. I'm building something that takes the manual work out of it so you can spend that discipline on decisions, not data entry." |
| `sometimes` | 26 | "You mentioned you track expenses sometimes. I get it, most apps make it feel like homework. I'm building something that works even when you forget to log things for a week." |
| `stopped` | 13 | "You mentioned you used to track expenses but stopped. You're not alone, that's the most common answer I got. I'm building this specifically for people like you, something low-effort enough that it sticks." |
| `not_currently` | 9 | "You mentioned you're not currently tracking expenses. That's actually a fine starting point. I'm building something that does the heavy lifting so you don't have to change your habits." |

### Device mention by `primary_device`

| Device | Count | Line |
|--------|-------|------|
| `iphone` | 49 | "You said iPhone is your main device, so that's where I'm starting." |
| `android` | 25 | "You said Android is your main device, so that's where I'm starting." |
| `both` | 4 | "You use both iOS and Android, so I'm planning to support both from day one." |
| `unknown` | 3 | *(omitted entirely)* |

### Full email template (expense tracker)

```
Subject: Quick question before I build this

Hi,

[Opening by tracking_status]

[Device mention]

But before I go heads-down building, I want to make sure I'm
building the right thing. I have a quick question for you:

-> [Link: "I want to test early builds and give feedback"]
-> [Link: "Send me progress updates"]
-> [Link: "Just let me know when it launches"]

Pick whichever fits and helps me prioritize.

Thanks for signing up early,
TJ
SGFirePlanner

[Unsubscribe link]
```

### Full email template (general signups)

Same structure, but opening line is: "You signed up for updates on SGFirePlanner. I've been heads-down building and wanted to check in before I send you things you don't care about."

No device mention for general signups (data not available in `email_signups` table).

## Preference Landing Page

**URL:** `sgfireplanner.com/email-prefs.html?t=<token>&pref=<preset>`

**Page:** Standalone HTML file in `frontend/public/email-prefs.html` with inline CSS/JS. Not a React route. Matches SGFirePlanner branding (dark navy, clean, minimal).

**Branding note:** Since this page is outside the React/Vite pipeline, Tailwind classes and CSS custom properties from the main app are not available. The implementer must manually inline the relevant design tokens (colors, fonts, spacing). Document the specific hex values used so future theme changes can be synced. Set `Referrer-Policy: no-referrer` meta tag to prevent token leakage via HTTP referrer headers.

### Behavior

1. Page loads, calls `GET /api/email-pref?t=xxx`
2. API returns masked email (`t****n@gmail.com`) and whether the token has already been used. Does not return device or segment (not needed for page UX, reduces data exposure).
3. `pref` query param pre-selects one of the three preference cards
4. User can click a different card to change selection
5. Free-text field below: "Anything specific you'd like to see built? (optional)"
6. Submit button posts to `POST /api/email-pref`
7. Confirmation message: "Got it, thanks! You'll hear from me [based on selection]."

### Preference tiers

| Label | Value | Meaning |
|-------|-------|---------|
| "I want to test early builds and give feedback" | `tester` | Alpha testers, high engagement |
| "Send me progress updates" | `updates` | Interested but passive |
| "Just let me know when it launches" | `launch_only` | Minimal contact |
| "Remove me from the list" | `unsubscribed` | Opt-out, never email again |

### Token design

- Token = 32 hex chars of HMAC-SHA256(`email + random_nonce`, `TOKEN_SECRET`). The random nonce uses `crypto.getRandomValues(new Uint8Array(16))` (Web Crypto API, works in both Node 19+ and CF Workers). **Do not use `crypto.randomBytes`** (Node-only, breaks in CF Workers).
- Stored in `email_tokens` table with 30-day expiry
- **Reusable until expiry:** Users can revisit the link and change their preference at any time within 30 days. This is intentional: locking users out after one click causes support requests and prevents them from unsubscribing. The POST rate limit (5/IP/hour) prevents abuse.
- **Fresh token per campaign:** Every outbound email generates a new token. Old tokens remain valid until they expire. This ensures every email has a working preference/unsubscribe link, even if the user didn't act on the first email.
- After expiry, page shows: "This link has expired. Email hello@sgfireplanner.com to update your preferences."
- Token is opaque. Email is never in the URL.

### Error states on the landing page

| State | UX |
|-------|-----|
| Valid token | Show preference cards, pre-select from `pref` param |
| Expired token | "This link has expired. Email hello@sgfireplanner.com to update your preferences." |
| Invalid/unknown token | "This link isn't valid. Email hello@sgfireplanner.com for help." |
| Network error | "Something went wrong. Please try again in a moment." with retry button |

## D1 Schema Changes

### New table: `email_tokens`

```sql
CREATE TABLE IF NOT EXISTS email_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  campaign TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
CREATE INDEX idx_email_tokens_email ON email_tokens(email);
```

The `campaign` column tracks which send batch created the token (e.g. `preference_2026-03-17`). This supports the idempotency mechanism (see below).

**Cleanup:** The send script's `--report` command purges tokens expired more than 1 day ago (`DELETE FROM email_tokens WHERE expires_at < datetime('now', '-1 day')`). The 1-day buffer avoids a race condition where a user clicks a link just as cleanup runs.

### New table: `email_preferences`

```sql
CREATE TABLE IF NOT EXISTS email_preferences (
  email TEXT PRIMARY KEY,
  preference TEXT NOT NULL CHECK(preference IN ('tester', 'updates', 'launch_only', 'unsubscribed')),
  feature_request TEXT CHECK(length(feature_request) <= 2000),
  primary_device TEXT,
  source_segment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Upsert SQL for POST handler:**
```sql
INSERT INTO email_preferences (email, preference, feature_request, primary_device, source_segment)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(email) DO UPDATE SET
  preference = excluded.preference,
  feature_request = excluded.feature_request,
  updated_at = CURRENT_TIMESTAMP
```

`primary_device` and `source_segment` are populated server-side by the POST handler. The handler resolves the token to an email, then looks up `primary_device` from `expense_tracker_signups` and derives `source_segment` from which table the email exists in. These are set on first INSERT only (not overwritten on UPDATE) since they don't change.

### New table: `campaign_sends` (idempotency)

```sql
CREATE TABLE IF NOT EXISTS campaign_sends (
  campaign TEXT NOT NULL,
  email TEXT NOT NULL,
  resend_id TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (campaign, email)
);
```

Before sending, the script checks `campaign_sends` for the `(campaign, email)` pair. If it exists, skip that recipient. After a successful Resend API call, insert the row with the Resend message ID. This makes re-running the script safe after partial failures.

## Files to Create

### Local send script (Phase 1)

| File | Purpose |
|------|---------|
| `scripts/email/resend-client.ts` | Resend API wrapper with rate limiting, dry-run mode |
| `scripts/email/templates.ts` | HTML + plain-text email builders with personalization logic |
| `scripts/email/segments.ts` | Segment definitions, D1 query builders per segment |
| `scripts/email/tokens.ts` | HMAC token generation (Node crypto) |
| `scripts/send-email.ts` | CLI entry point: parse args, query D1, generate tokens, send |

All scripts run via `npx tsx` (TypeScript execution without build step). Add `tsx` as a dev dependency.

### Preference landing page

| File | Purpose |
|------|---------|
| `frontend/public/email-prefs.html` | Standalone HTML page with inline CSS/JS |

### CF Pages Functions

| File | Purpose |
|------|---------|
| `frontend/functions/api/email-pref.ts` | Exports `onRequestGet` (resolve token, return masked email) and `onRequestPost` (validate token, save preference + feature request, populate `primary_device`/`source_segment` server-side from signup tables). Follows existing CF Pages Function pattern. Rate-limited: 10 requests per IP per hour on GET, 5 per IP per hour on POST. Both use `IP_HASH_SALT` with null check matching existing pattern. POST validates `feature_request` length <= 2000 chars and `preference` against `VALID_PREFERENCES` from `emailConstants.ts`. |

### D1 migration

| File | Purpose |
|------|---------|
| `scripts/email/migrate.sql` | CREATE TABLE statements for `email_tokens`, `email_preferences`, and `campaign_sends` |

## CLI Interface

```bash
# Preview expense tracker segment (shows recipients + personalized subject)
npx tsx scripts/send-email.ts --segment expense_tracker --dry-run

# Send to just the "stopped" group first (13 people, good test batch)
npx tsx scripts/send-email.ts --segment expense_tracker --tracking-status stopped

# Send to all expense tracker signups (prints warning if >20 recipients, requires --confirm)
npx tsx scripts/send-email.ts --segment expense_tracker --confirm

# Send to general signups
npx tsx scripts/send-email.ts --segment general

# View preference responses + purge expired tokens
npx tsx scripts/send-email.ts --report
```

**CLI guards:**
- `--tracking-status` is only valid with `--segment expense_tracker`. Using it with `--segment general` exits with an error (general signups have no tracking status field).
- Sending to >20 recipients requires `--confirm` flag. Without it, the script prints the recipient list and exits.
- Script checks `TOKEN_SECRET` and `RESEND_API_KEY` at startup. Aborts if missing.

## Environment / Secrets

| Variable | Where | Purpose |
|----------|-------|---------|
| `RESEND_API_KEY` | Local `.env` only (never committed) | Resend API authentication |
| `TOKEN_SECRET` | CF Pages secret + local `.env` | HMAC token generation |
| `IP_HASH_SALT` | Already exists in CF Pages | Not reused, kept separate |

### D1 access from local script (revised after review)

**Do not** use `wrangler d1 execute --remote --command "..."` with inline SQL per recipient. This is slow (one subprocess per query) and leaks PII (emails, tokens) in the process list.

Instead, the send script uses two approaches:
1. **Reads:** `wrangler d1 execute --remote --command "SELECT ..."` for bulk queries (no PII in SELECT queries for recipient lists)
2. **Writes (token inserts):** Generate a temporary SQL file with all INSERT statements, then run `wrangler d1 execute --remote --file /tmp/tokens-XXXXX.sql`. Delete the temp file immediately after. This batches 87 inserts into one subprocess call.

The temp SQL file uses parameterized-style escaping (single quotes escaped, no string interpolation of user input). The script validates all email values against `EMAIL_RE` before generating SQL.

**Alternative for Phase 2:** The CF Pages Function has direct `context.env.DB` access (D1 binding), so no wrangler CLI needed.

**Startup guard:** The script checks `TOKEN_SECRET` and `RESEND_API_KEY` from `.env` at startup. If either is missing or empty, abort before querying D1 or generating tokens.

## Phase 2: Automated Sending (Future)

When ready to automate, add to **both** existing signup CF Pages Functions:

**`expense-tracker-signup.ts`:**
1. After successful signup, check `email_preferences` for `preference = 'unsubscribed'`. If unsubscribed, skip email.
2. Generate token using `crypto.subtle` (Web Crypto, NOT Node `crypto`) and insert into `email_tokens`
3. Call Resend API via `context.waitUntil()` (fire-and-forget). A Resend failure must NOT cause the signup to return 500.
4. `RESEND_API_KEY` and `TOKEN_SECRET` added as CF Pages environment secrets

**`email-signup.ts`:**
Same pattern. Both signup paths should send the preference email so no signups are missed.

Same template structure as Phase 1. Token generation uses `crypto.subtle.sign('HMAC', ...)` instead of Node's `crypto.createHmac`.

**Module sharing strategy (revised after review):**

Crypto APIs differ across runtimes, so **do not share token generation code** between the local script and CF Functions. Instead:

| What | Where | Why |
|------|-------|-----|
| Constants (preference values, validation regexes) | `frontend/src/lib/validation/emailConstants.ts` (extend existing file) | Already shared between React app and CF Functions. Add `VALID_PREFERENCES` array. |
| Token generation (Phase 1) | `scripts/email/tokens.ts` using Node `crypto` | Local script only |
| Token generation (Phase 2) | `frontend/functions/lib/serverUtils.ts` using `crypto.subtle` (Web Crypto) | CF Workers runtime only |
| Email templates | `scripts/email/templates.ts` (Phase 1) | For Phase 2, re-implement or compile to JS and import. Templates are pure string builders with no runtime-specific APIs, so sharing is feasible if both use `tsx`. |

The local send scripts use `.ts` files run via `npx tsx`. This avoids the `.mjs` vs TypeScript mismatch.

**`functions/tsconfig.json` update:** If any new shared imports are added from `src/lib/`, the `include` array in `frontend/functions/tsconfig.json` must be updated to include them. Currently it includes `../src/lib/validation/emailConstants.ts` explicitly.

**CLAUDE.md note:** This adds a third CF Pages Function endpoint (`/api/email-pref`) for lead engagement, extending the existing exception pattern documented for `/api/email-signup` and `/api/expense-tracker-signup`. No financial data is involved.

## Tone

Indie builder, personal but professional. First person. Respects the reader's time. No em dashes in user-facing copy (per project conventions).

## Email Format

- **From:** `TJ <hello@sgfireplanner.com>` (must match authenticated domain for DMARC alignment)
- **Format:** Both HTML and plain-text parts (multipart/alternative). The Resend API accepts both `html` and `text` fields. Always include both for deliverability and accessibility.
- **List-Unsubscribe header:** Enable via Resend's built-in support. Points to the preference page with `pref=unsubscribed`.

## Unsubscribe

- Primary mechanism: the "Remove me from the list" option on the preference page
- Every email includes an unsubscribe link that goes to the same preference page with `pref=unsubscribed`
- Send script filters out any email with `preference = 'unsubscribed'` in `email_preferences`
- Resend also provides a built-in unsubscribe header (List-Unsubscribe) which we should enable

## Email Deliverability Prerequisites

Before sending, the following DNS records must be configured for `sgfireplanner.com`:

1. **DKIM:** 3 CNAME records from Resend setup
2. **SPF update:** Add Resend's SPF include to existing SPF record (confirm exact value from Resend's DNS setup docs, likely `include:amazonses.com`). Keep `~all` (soft fail) initially. Move to `-all` only after DMARC monitoring confirms no legitimate sending sources are being missed.
3. **DMARC:** Add `_dmarc.sgfireplanner.com` TXT record: `v=DMARC1; p=none; rua=mailto:dmarc@sgfireplanner.com`. Start with `p=none` (monitor), then upgrade to `p=quarantine` after 2-4 weeks of clean reports, then `p=reject` once confident.

Verify all three in Resend dashboard before first send.

## Warm-up Strategy

1. Send test email to yourself first
2. Send to `stopped` group (13 people) as first real batch
3. Wait 24 hours, check deliverability
4. Send to `not_currently` group (9 people)
5. Send to `sometimes` group (26 people)
6. Send to `consistent` group (33 people)
7. Send to general signups (~6 people)

Space batches 24 hours apart to build domain sending reputation gradually.
