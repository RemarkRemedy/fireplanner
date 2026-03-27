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
| PII handling | PayNow number collected upfront, encrypted at rest (AES-256-GCM) |
| Admin | New `/admin/referral` for conversion entry and fulfillment |
| Platform tiers | Tier 1 (formal programs) live at launch, Tier 2 (outreach pending) shown as coming soon |

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
4. If any % allocated to "back to me": user chooses PayNow or gift voucher
   - If PayNow: provide PayNow-linked phone number (stored encrypted)
5. Confirmation state: "You're registered. Click any platform below to get started."
6. Platform cards in Zone 3 unlock

Note: The user always receives the referee bonus directly from the brokerage (free shares, fee waivers, etc.) regardless of their allocation choice. The allocation only controls what happens to FirePlanner's affiliate fee.

**Zone 3: Platform Cards**

Grid of brokerage/platform cards. Each card shows:
- Platform name + logo
- Type (brokerage, robo-advisor, etc.)
- Referee bonus value (what the user gets directly from the platform)
- "Sign up" button (affiliate link tagged with click ID)

Cards are locked until registration (Zone 2) is complete. Before registration, cards show a soft lock state: "Register above to unlock referral links."

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
| payout_method | TEXT | "paynow" / "voucher" / null (if pct_keep = 0) |
| paynow_number | TEXT | Encrypted (AES-256-GCM), nullable, only if payout_method = "paynow" |
| ip_hash | TEXT | Rate limiting, same pattern as existing tables |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

The three pct columns always sum to 100. The preset is stored for analytics but the percentages are the source of truth. Users can update their allocation at any time (updates `updated_at`). When a conversion is recorded, the allocation at the time of conversion entry is used. The `amount_keep/charity/fireplanner` columns on `referral_conversions` are the frozen record of the split applied.

**`referral_clicks`**

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key, used as click_id in affiliate URL |
| registration_id | TEXT | FK to referral_registrations |
| platform | TEXT | "ibkr", "moomoo", "poems", etc. |
| affiliate_url | TEXT | The full tagged URL sent to the user |
| created_at | TEXT | ISO timestamp |

**`referral_conversions`**

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key |
| click_id | TEXT | FK to referral_clicks |
| registration_id | TEXT | FK to referral_registrations |
| platform | TEXT | Denormalized for easy querying |
| affiliate_fee_sgd | REAL | Amount brokerage paid FirePlanner |
| amount_keep | REAL | fee * pct_keep / 100 |
| amount_charity | REAL | fee * pct_charity / 100 |
| amount_fireplanner | REAL | fee * pct_fireplanner / 100 |
| amount_matched | REAL | TJ's 1:1 match on amount_charity (capped at annual $10K) |
| payout_status | TEXT | "pending" / "paid" / "donated" |
| notes | TEXT | Admin notes (brokerage reference, etc.) |
| created_at | TEXT | ISO timestamp |

Tracker numbers are derived from `referral_conversions` via aggregate queries. No separate totals table needed.

### New Pages Functions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/referral/register` | POST | Save registration + allocation |
| `/api/referral/click` | POST | Log a click, return tagged affiliate URL |
| `/api/referral/tracker` | GET | Public aggregate: total charity, total matched, total fireplanner, participant count |
| `/api/admin/referral/conversions` | POST | Admin: record a conversion |
| `/api/admin/referral/conversions` | GET | Admin: list all conversions |

All endpoints follow existing patterns: rate-limited, ip_hash for public endpoints, `x-admin-key` for admin endpoints.

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
  markets: string[];           // ["US", "SG", "HK"]
  cpfSrsEligible: boolean;
  tags: string[];              // ["beginner_friendly", "low_fees"]
  lastUpdated: string;         // ISO date, for maintenance
}
```

### Tier 1: Active affiliate partnerships (live at launch)

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
1. Frontend calls `POST /api/referral/click` with `registration_id` and `platform`
2. Backend creates a `referral_clicks` row, returns the tagged affiliate URL
3. Frontend opens the URL in a new tab

Each platform's tracking parameter format is stored in the config (`trackingParam` field).

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
- Number of participants

No individual names or amounts shown. Privacy-first. Simple fetch on page load, no WebSocket (data changes only on manual conversion entry).

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
A timeline at the bottom of `/referral` showing historical donations:
- Q1 2026: $X,XXX donated to [Charity Name] (matched $X,XXX by TJ) - [giving.sg receipt link]
- Q2 2026: ...

Builds trust and creates visible impact history.

## Section 5: Admin Workflow (Manual Fulfillment)

### Conversion recording flow

1. Brokerage sends a report (email, dashboard export, monthly statement)
2. TJ opens `/admin/referral` (protected by `x-admin-key`)
3. Search by email or browse recent clicks for the platform
4. Enter the conversion:
   - Platform, affiliate fee amount (SGD)
   - System auto-computes the three-way split based on user's allocation
   - System auto-computes the match amount (capped against annual running total)
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

## Out of Scope for V1

- Automated payout processing (PayNow API, voucher API)
- Custom voting UI (using external forms)
- Transactional email service (manual sends)
- User accounts/authentication (email-based identification only)
- Automated conversion tracking via brokerage APIs
- Mobile app integration
