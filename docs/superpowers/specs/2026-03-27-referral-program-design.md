# Referral Program with Donation Matching - Design Spec

**Date:** 2026-03-27
**Status:** Approved

## Overview

FirePlanner signs up as an affiliate/referral partner with Singapore brokerages and investment platforms. When users click through from FirePlanner and open an account, the brokerage pays FirePlanner an affiliate fee. Users choose how to allocate that fee: keep it themselves, donate to a community charity pool (matched 1:1 by TJ up to $10K/year), or donate to keep FirePlanner free. This creates a transparent, community-driven referral model where users control the value flow.

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Model | FirePlanner as affiliate partner, passes value to users |
| Tracking | Pre-registration of intent (email + allocation before clicking) |
| Allocation | Preset buttons + custom slider across three destinations |
| Three destinations | Back to user (PayNow/voucher), community charity pool (1:1 matched), FirePlanner support |
| Match cap | $10K/year on charity donations, annual reset, cap is on TJ's match |
| Architecture | Automated capture (D1), manual fulfillment (Approach 3) |
| Page structure | New `/referral` page + banner on `/compare` |
| Charity vote | Quarterly, email-gated, external form (Google Form/Tally) for V1 |
| Tracker | Live aggregates from D1, no individual data shown |
| PII handling | PayNow number collected post-conversion only, encrypted at rest (AES-256-GCM) |
| Admin | New `/admin/referral` for conversion entry and fulfillment |
| Platform tiers | Tier 1 (formal programs, pending approval) go active as agreements confirm, Tier 2 (outreach pending) shown as coming soon |

## Section 1: Page Structure & User Flow

### New route: `/referral`

The page has three zones.

**Zone 1: Hero & Story**

Program explanation with a live community tracker showing:
- Total donated to charity this year + TJ's match amount (progress bar toward $10K)
- Total donated to FirePlanner support
- Number of participants

**Zone 2: Registration & Allocation**

1. User enters email
2. User chooses allocation via preset buttons:
   - "Keep all"
   - "Donate all to charity"
   - "50/50 charity & FirePlanner"
   - "Give all to FirePlanner"
   - "Custom..." (opens three sliders summing to 100%)
3. The three destinations:
   - **Back to me:** user receives FirePlanner's affiliate fee via PayNow or gift voucher
   - **Community charity pool:** goes toward quarterly giving.sg vote, matched 1:1 by TJ (up to $10K/year)
   - **FirePlanner support:** helps cover server/infrastructure costs, keeps the tool free
4. Confirmation state: "You're registered. Click any platform below to get started."
6. Platform cards in Zone 3 unlock

Note: The user always receives the referee bonus directly from the brokerage (free shares, fee waivers, etc.) regardless of their allocation choice. The allocation only controls what happens to FirePlanner's affiliate fee.

Note: PayNow number and payout method are NOT collected at registration. They are collected post-conversion when a user has keep % > 0 and a conversion is confirmed. This reduces registration friction and avoids storing sensitive PII until it's actually needed.

**Zone 3: Platform Cards**

Grid of brokerage/platform cards. Each card shows:
- Platform name + logo
- Type (brokerage, robo-advisor, etc.)
- Referee bonus value (what the user gets directly from the platform)
- "Sign up" button (affiliate link tagged with click ID)

Cards are locked until registration (Zone 2) is complete. Before registration, cards show a soft lock state: "Register above to unlock referral links." Clicking a locked card scrolls to Zone 2 and highlights the email input field.

### Changes to `/compare`

A subtle banner or callout card linking to `/referral`: "Earn referral bonuses and support charity through our community referral program."

## Section 2: Data Model (Cloudflare D1)

### New tables

**`referral_registrations`**

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key |
| email | TEXT | Unique, indexed |
| allocation_preset | TEXT | "keep_all", "donate_charity", "fifty_fifty", "donate_fireplanner", "custom" |
| pct_keep | INTEGER | 0-100 |
| pct_charity | INTEGER | 0-100 |
| pct_fireplanner | INTEGER | 0-100 |
| payout_method | TEXT | NULL at registration. Set to "paynow" / "voucher" post-conversion. |
| paynow_number | TEXT | NULL at registration. Encrypted (AES-256-GCM), collected post-conversion only. |
| ip_hash | TEXT | Rate limiting, same pattern as existing tables |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

The three pct columns always sum to 100. The preset is stored for analytics but the percentages are the source of truth. **Allocation is locked after registration.** To change it, users must explicitly enter edit mode on the /referral page (only allowed before any conversion is marked "paid"). When a conversion is recorded, the admin panel reads the current allocation. The `amount_keep/charity/fireplanner` columns on `referral_conversions` are the frozen record of the split applied.

**`referral_clicks`**

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key, used as click_id in affiliate URL |
| registration_id | TEXT | FK to referral_registrations |
| platform | TEXT | "ibkr", "moomoo", "poems", etc. |
| affiliate_url | TEXT | The full tagged URL sent to the user |
| pct_keep | INTEGER | Snapshot of allocation at click time (audit trail) |
| pct_charity | INTEGER | Snapshot of allocation at click time (audit trail) |
| pct_fireplanner | INTEGER | Snapshot of allocation at click time (audit trail) |
| created_at | TEXT | ISO timestamp |

**`referral_conversions`**

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key |
| click_id | TEXT | FK to referral_clicks |
| registration_id | TEXT | FK to referral_registrations |
| platform | TEXT | Denormalized for easy querying |
| conversion_date | TEXT | ISO date, when user actually signed up at brokerage (admin enters). Used for match cap year calculation. |
| affiliate_fee_sgd | REAL | Amount brokerage paid FirePlanner |
| amount_keep | REAL | fee * pct_keep / 100 |
| amount_charity | REAL | fee * pct_charity / 100 |
| amount_fireplanner | REAL | fee * pct_fireplanner / 100 |
| amount_matched | REAL | TJ's 1:1 match on amount_charity (capped at annual $10K) |
| payout_status | TEXT | Lifecycle: "pending" (awaiting holding period) / "approved" (holding period passed, ready for payout) / "paid" (PayNow/voucher sent) / "clawed_back" (brokerage reversed commission) / "no_payout" (pct_keep = 0). Tracks keep-portion only. Charity portion is always implicitly "pooled until quarterly vote." FirePlanner portion requires no action. |
| notes | TEXT | Admin notes (brokerage reference, etc.) |
| created_at | TEXT | ISO timestamp |

Tracker numbers are derived from `referral_conversions` via aggregate queries. No separate totals table needed.

**`referral_payout_tokens`** (for post-conversion PayNow/voucher collection)

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key, used as token in payout URL |
| conversion_id | TEXT | FK to referral_conversions |
| registration_id | TEXT | FK to referral_registrations |
| expires_at | TEXT | ISO timestamp, 7 days from creation |
| used_at | TEXT | NULL until submitted, ISO timestamp when used |
| created_at | TEXT | ISO timestamp |

Token is generated when admin records a conversion with pct_keep > 0. Only one active (unused, unexpired) token per conversion at a time. Re-triggering the email invalidates the old token and creates a new one.

### New Pages Functions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/referral/register` | POST | Create or update registration + allocation (upsert by email) |
| `/api/referral/click` | POST | Log a click, return tagged affiliate URL |
| `/api/referral/tracker` | GET | Public aggregate: total charity, total matched, total fireplanner, participant count |
| `/api/admin/referral/conversions` | POST | Admin: record a conversion |
| `/api/admin/referral/conversions` | GET | Admin: list all conversions |
| `/api/referral/payout-info` | POST | Collect PayNow number or voucher preference post-conversion (email-gated link) |

All endpoints follow existing patterns: rate-limited, ip_hash for public endpoints, `x-admin-key` for admin endpoints.

**Rate limits:** `/api/referral/register`: 5 requests per IP per hour. `/api/referral/click`: 20 requests per IP per hour. `/api/referral/tracker`: no rate limit (public, cached). `/api/referral/payout-info`: 5 requests per IP per hour.

**Tracker caching:** `GET /api/referral/tracker` returns `Cache-Control: public, max-age=300` (5 minutes). Data only changes on manual admin entry.

## Section 3: Platform Catalog & Affiliate Link Management

### Platform data structure

Static config file at `lib/data/referralPlatforms.ts`:

```typescript
interface ReferralPlatform {
  id: string;                  // "moomoo", "ibkr", etc.
  name: string;                // Display name
  type: PlatformType;          // "brokerage" | "robo_advisor" | "crypto" | "insurance" | "cash_mgmt" | "alternative"
  logo: string;                // "/logos/moomoo.svg"
  description: string;         // One-line description
  refereeBonus: string;        // What the user gets from the platform
  affiliateProgram: AffiliateType; // "affiliate" | "ambassador" | "user_referral" | "outreach_pending"
  affiliateBaseUrl: string;    // Base affiliate link (partner tracking ID baked in)
  trackingParam: string;       // Platform-specific sub-tracking param name (e.g., "sub_id", "referrer")
  status: PlatformStatus;      // "active" | "coming_soon" | "paused"
  featured: boolean;           // Controls sort order
  markets: string[];           // ["US", "SG", "HK"] — displayed on card as market badges
  cpfSrsEligible: boolean;     // displayed as "CPF/SRS eligible" badge on card
  tags: PlatformTag[];         // V2: used for filtering. Union type locks valid values now.
  // type PlatformTag = "beginner_friendly" | "low_fees" | "cpf_srs" | "us_stocks" | "sg_stocks" | "crypto" | "robo_managed"
  lastUpdated: string;         // ISO date, for maintenance
}
```

### Tier 1: Planned partnerships (pending affiliate approval)

| Platform | Program Type | Estimated Payout |
|----------|-------------|-----------------|
| Interactive Brokers | CPC Publisher + Influencer | Custom CPC rates, paid monthly |
| moomoo | Ambassador Program | S$88/referral + custom terms |
| POEMS (Phillip Securities) | Formal Affiliate | S$10 coupon + S$50 cash/referral |
| IG Markets | Marketing Partnership | Up to S$1,000/qualified client |
| Saxo Markets | Broker Referral | S$88-250/referral tier |

### Tier 2: Outreach pending (shown as "coming soon")

| Platform | Type | Notes |
|----------|------|-------|
| Endowus | Robo-advisor | CPF/SRS eligible, high FIRE alignment |
| StashAway | Robo-advisor | SRS eligible, large SG base |
| Syfe | Robo-advisor + brokerage | Double opportunity |
| Tiger Brokers | Brokerage | Biggest SG marketing spend |
| Webull | Brokerage | Aggressively growing |
| Longbridge | Brokerage | Newer entrant |
| AutoWealth | Robo-advisor | CPFIS eligible |
| uSMART | Brokerage | |
| Singlife | Insurance savings | |
| Chocolate Finance | Cash management | |
| Coinbase SG | Crypto | Accredited investors only |
| Gemini | Crypto | |

### Affiliate link flow

When a registered user clicks a platform card:
1. Frontend generates a UUID click_id client-side
2. Frontend constructs the affiliate URL directly from the static platform config: `{affiliateBaseUrl}?{trackingParam}={click_id}`
3. Frontend opens the affiliate URL in a new tab immediately (no server hop, preserves affiliate attribution)
4. Frontend fires a fire-and-forget `POST /api/referral/click` with `{email, platform, click_id, affiliate_url, pct_keep, pct_charity, pct_fireplanner}` to log the click asynchronously
5. If the async POST fails, the click is untracked but the user is not blocked

Each platform's tracking parameter format is stored in the config (`trackingParam` field). URL assembly: `{affiliateBaseUrl}?{trackingParam}={click_id}`. If `affiliateBaseUrl` already contains query params, append with `&` instead of `?`. Example: `https://www.interactivebrokers.com/referral?ref=fireplanner&sub_id=click_abc123`. **V1 assumption:** all platforms use query-param tracking. If a platform requires path-based sub-IDs, add an `assemblyMode` field to the config as an extension point.

**Error handling:** If `POST /api/referral/click` fails (network error, D1 down), the frontend falls back to opening the `affiliateBaseUrl` directly (untracked). The click is lost but the user is not blocked. A toast notification says "Click tracking unavailable, link opened directly."

### Logo assets

SVG logos stored in `public/logos/`. Used under editorial/informational fair use.

### Maintenance

Platform data (bonus amounts, URLs, status) changes frequently as promotions rotate. The static config makes updates a simple code change. Each platform entry has a `lastUpdated` field. Add a review date comment at the top of the file.

## Section 4: Community Tracker & Quarterly Charity Vote

### Community Tracker

Appears in two places:
- **Primary:** Zone 1 of `/referral` page (prominent, full-width)
- **Secondary:** Optional smaller widget on landing page (social proof)

Data displayed (all from `GET /api/referral/tracker`):
- Total donated to charity this year
- TJ's match amount + progress bar toward $10K
- Total donated to FirePlanner support
- Number of participants (= `COUNT(DISTINCT registration_id) FROM referral_clicks`, i.e., users who clicked at least one platform link, not just registered)

No individual names or amounts shown. Privacy-first. Simple fetch on page load, no WebSocket (data changes only on manual conversion entry). Response cached for 5 minutes (see rate limits above).

### Quarterly Charity Vote

**Flow:**
1. End of each quarter, TJ posts a vote
2. All registered users with `pct_charity > 0` receive an email with a link to vote
3. Vote page shows 3-5 curated giving.sg charities (TJ pre-selects)
4. Each eligible user gets one vote
5. Voting open for 7 days
6. Charity with the most votes receives the pooled donations + TJ's match
7. TJ makes the donation on giving.sg manually, posts screenshot/receipt

**V1 implementation:**
- Vote is a Google Form or Tally form linked from the email
- Charity curation is manual each quarter
- No custom voting UI needed

**Past Donations section:**
A timeline at the bottom of `/referral` showing historical donations. Empty at launch with placeholder: "No donations yet. The first quarterly vote will happen once the community pool has its first contributions." Example format after first vote:
- Q2 2026: $X,XXX donated to [Charity Name] (matched $X,XXX by TJ) - [giving.sg receipt link]

**Vote integrity (V1 known limitation):** Google Forms does not tie votes to FirePlanner registrations. A user could theoretically vote multiple times with different emails. Accepted for V1 given low volume. V2 option: generate one-time vote tokens per eligible registration, emailed individually.

Builds trust and creates visible impact history.

## Section 5: Admin Workflow (Manual Fulfillment)

### Conversion recording flow

1. Brokerage sends a report (email, dashboard export, monthly statement)
2. TJ opens `/admin/referral` (protected by `x-admin-key`)
3. Search by email or browse recent clicks for the platform
4. Enter the conversion:
   - Platform, affiliate fee amount (SGD)
   - System auto-computes the three-way split based on user's allocation
   - System auto-computes the match amount using: `SELECT COALESCE(SUM(amount_matched), 0) FROM referral_conversions WHERE conversion_date >= '{year}-01-01'` (calendar year based on conversion_date, not created_at). If remaining cap < charity amount, match is capped at remaining. Example: $9,800 matched YTD, $500 charity portion, match = $200 (cap reached).
   - The admin panel reads the user's CURRENT allocation at time of conversion entry (latest-allocation-wins model). The frozen amounts on the conversion record are the source of truth after entry.
   - Review and confirm
5. Fulfill the payout:
   - **Keep portion:** Send PayNow or purchase voucher, mark as "paid"
   - **Charity portion:** Accumulates in pool for quarterly vote
   - **FirePlanner portion:** No action needed
   - **Match portion:** Accumulates alongside charity pool

### Admin dashboard displays:

- Pending conversions (entered but not yet paid out)
- Year-to-date totals: charity pool, match used/remaining, FirePlanner support
- Upcoming quarterly vote date
- Quick stats: registrations, clicks, conversion rate by platform

### Email notifications (manual for V1)

Templated but manually triggered:
- **On conversion:** "Your referral to [platform] converted! Here's how your $X was allocated."
- **On payout:** "Your $X has been sent via PayNow/voucher."
- **Quarterly vote:** "Time to vote! The community pool has $X,XXX."
- **Post-vote:** "The community chose [Charity]. $X,XXX donated + $X,XXX matched. Here's the receipt."

## Section 6: Outreach Plan for Tier 2 Platforms

### Priority order (by FIRE audience alignment)

**Priority 1: Robo-advisors**
1. Endowus - CPF/SRS eligible, core FIRE overlap
2. StashAway - Large SG base, SRS eligible
3. Syfe - Managed portfolios + brokerage arm

**Priority 2: Brokerages**
4. Tiger Brokers - Biggest SG marketing spend
5. Webull - Aggressively growing
6. Longbridge - Newer entrant, hungry for distribution

**Priority 3: Niche/specialty**
7. AutoWealth - CPFIS eligible
8. Singlife - Insurance savings
9. Chocolate Finance - Cash management
10. Crypto platforms (Coinbase SG, Gemini) - lower FIRE alignment

### Outreach pitch points

- What FirePlanner is: free, privacy-first retirement planner for Singapore residents
- Audience quality: high-intent, financially literate users actively planning CPF/SRS allocation, portfolio construction, and withdrawal strategies
- Monthly traffic/user numbers (share when available)
- Differentiator: portion of referral fees goes to charity, matched 1:1 by the founder
- Ask: affiliate/partner agreement with tracked referral links and conversion reporting

### Outreach channels

| Platform | Channel |
|----------|---------|
| Endowus | partnerships@endowus.com or LinkedIn |
| StashAway | Partner page or LinkedIn |
| Syfe | partnerships@syfe.com or LinkedIn |
| Tiger Brokers | Affiliate form on SG site |
| Webull | Affiliate/partner page on SG site |
| Others | LinkedIn outreach to SG country head or partnerships team |

### Timeline

- **Week 1:** Apply to Tier 1 formal programs (IBKR, moomoo, POEMS, IG, Saxo)
- **Week 2-3:** Outreach to Priority 1 robo-advisors
- **Week 4+:** Priority 2 and 3 as capacity allows
- **Ongoing:** Update platform cards from "coming_soon" to "active" as partnerships confirm

## Encryption Key Management

The PayNow encryption key is stored as a **Cloudflare Pages Secret** (not a plain environment variable). Accessed via `env.PAYNOW_ENCRYPTION_KEY` in Pages Functions. No key rotation in V1 (intentional, noted as future work). If the key is lost, all stored PayNow numbers become unrecoverable (acceptable for V1 since manual PayNow transfers are the fallback, admin can re-request the number). The admin panel decrypts server-side. The decrypted PayNow number IS returned to the authenticated admin browser over HTTPS (admin is verified via `x-admin-key`), but it is never logged, cached, or stored in plaintext in D1. The admin uses the displayed number to initiate a manual PayNow transfer, then marks the conversion as "paid."

**Post-conversion PayNow collection flow:** When admin records a conversion with keep % > 0, the system sends a templated email with a unique, time-limited link to `/referral/payout?token={uuid}`. The user visits this page, enters their PayNow number or voucher preference, and submits via `POST /api/referral/payout-info`. The token expires after 7 days. If expired, admin can re-trigger the email.

## Legal Prerequisites (must clear before launch)

**MAS anti-inducement compliance:** Gemini flagged that sharing affiliate commissions with users ("keep" option) may violate MAS anti-inducement guidelines or brokerage TOS. Research needed before launching the "keep" option. The "donate to charity" and "donate to FirePlanner" paths have no regulatory concern. If legal review blocks the "keep" option, launch with donate-only and add "keep" later.

## Security Mitigations

**Bearer token hardening (payout page):** The payout token link is a bearer credential. To prevent hijacking, the payout page requires the user to re-enter their registered email before the form is shown. Token + email match = identity verified without user accounts.

**Disposable email mitigation:** Add basic disposable email domain blocking at registration (maintain a blocklist of known throwaway domains like 10minutemail, guerrillamail, etc.). Not foolproof but raises the bar. Users who donate 100% have less incentive to use real emails, but the quarterly vote email is the incentive (they want to participate in charity selection).

## Out of Scope for V1

- Automated payout processing (PayNow API, voucher API)
- Custom voting UI (using external forms)
- Transactional email service (manual sends)
- User accounts/authentication (email-based identification only)
- Automated conversion tracking via brokerage APIs
- Mobile app integration
- Encryption key rotation
