# Referral Program with Donation Matching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a referral program where FirePlanner acts as affiliate partner with SG brokerages. Users choose how to allocate the affiliate fee: keep it, donate to charity (1:1 matched up to $10K/year), or support FirePlanner.

**Architecture:** Cloudflare D1 + Pages Functions for backend (same pattern as existing email/feedback endpoints). React frontend with shadcn/ui components. New `/referral` page with 4 sections (hero, platform cards, registration, tracker). New `/admin/referral` page for conversion management. Token-gated `/referral/payout` page for PayNow collection.

**Tech Stack:** TypeScript, React, Tailwind, shadcn/ui, Cloudflare Pages Functions, Cloudflare D1, Web Crypto API (AES-256-GCM)

**Spec:** `docs/superpowers/specs/2026-03-27-referral-program-design.md`

**Parallelization:** Tasks 1-4 (backend) and Tasks 5-8 (frontend data + components) can run in parallel worktrees. Tasks 9-12 (pages + integration) depend on both.

---

## File Map

```
NEW FILES:
  frontend/schema-referral.sql                    — D1 migration for 4 referral tables
  frontend/functions/api/referral/register.ts      — POST registration endpoint
  frontend/functions/api/referral/click.ts         — POST click logging endpoint
  frontend/functions/api/referral/tracker.ts       — GET public aggregate endpoint
  frontend/functions/api/referral/payout-info.ts   — POST PayNow/voucher collection
  frontend/functions/api/admin/referral/conversions.ts — GET+POST admin conversion CRUD
  frontend/functions/lib/crypto.ts                 — AES-256-GCM encrypt/decrypt helpers
  frontend/functions/lib/referralConfig.ts          — Lean constants for worker-side (IDs, match cap)
  frontend/src/lib/data/referralPlatforms.ts       — Platform catalog + types
  frontend/src/lib/data/disposableEmails.ts        — Disposable email domain blocklist
  frontend/src/lib/validation/referralConstants.ts — Referral-specific validation constants
  frontend/src/components/referral/HeroSection.tsx
  frontend/src/components/referral/PlatformCard.tsx
  frontend/src/components/referral/PlatformGrid.tsx
  frontend/src/components/referral/RegistrationForm.tsx
  frontend/src/components/referral/AllocationPicker.tsx
  frontend/src/components/referral/StatusCard.tsx
  frontend/src/components/referral/MirrorMoment.tsx
  frontend/src/components/referral/TrackerCard.tsx
  frontend/src/components/referral/PastDonations.tsx
  frontend/src/components/referral/CompareBanner.tsx
  frontend/src/pages/ReferralPage.tsx
  frontend/src/pages/PayoutPage.tsx
  frontend/src/pages/AdminReferralPage.tsx
  frontend/public/logos/*.svg                      — Platform logo SVGs

MODIFIED FILES:
  frontend/schema.sql                              — Reference only (new file is separate migration)
  frontend/src/router.tsx                          — Add 3 new routes
  frontend/src/pages/ComparePage.tsx               — Add referral banner
  frontend/src/lib/validation/emailConstants.ts    — Add 'referral_page' to VALID_SOURCES

TEST FILES:
  frontend/src/lib/data/referralPlatforms.test.ts  — Platform catalog integrity tests
  frontend/src/lib/data/disposableEmails.test.ts   — Blocklist tests
  frontend/src/components/referral/__tests__/AllocationPicker.test.tsx
  frontend/src/components/referral/__tests__/PlatformCard.test.tsx
  frontend/src/components/referral/__tests__/RegistrationForm.test.tsx
  frontend/e2e/referral.spec.ts                    — E2E registration + click flow
```

---

### Task 1: D1 Schema Migration

**Files:**
- Create: `frontend/schema-referral.sql`

- [ ] **Step 1: Write the schema migration file**

```sql
-- Referral program schema for D1
-- Run with: wrangler d1 execute fireplanner-db --file=schema-referral.sql

-- User registrations with allocation preferences
CREATE TABLE IF NOT EXISTS referral_registrations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  allocation_preset TEXT NOT NULL,
  pct_keep INTEGER NOT NULL DEFAULT 0,
  pct_charity INTEGER NOT NULL DEFAULT 0,
  pct_fireplanner INTEGER NOT NULL DEFAULT 0,
  payout_method TEXT,
  paynow_number TEXT,
  ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  CHECK (pct_keep + pct_charity + pct_fireplanner = 100),
  CHECK (pct_keep >= 0 AND pct_keep <= 100),
  CHECK (pct_charity >= 0 AND pct_charity <= 100),
  CHECK (pct_fireplanner >= 0 AND pct_fireplanner <= 100),
  CHECK (allocation_preset IN ('keep_all', 'donate_charity', 'fifty_fifty', 'donate_fireplanner', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_referral_reg_ip_rate ON referral_registrations(ip_hash, created_at);

-- Click tracking with allocation snapshot for audit trail
CREATE TABLE IF NOT EXISTS referral_clicks (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  pct_keep INTEGER NOT NULL,
  pct_charity INTEGER NOT NULL,
  pct_fireplanner INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES referral_registrations(id)
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_reg ON referral_clicks(registration_id);
-- Note: referral_clicks intentionally has no ip_hash column. Rate limiting for
-- clicks is not needed (registration is already rate-limited, and clicks are
-- fire-and-forget). IDs are TEXT (UUID) not INTEGER AUTOINCREMENT — intentional
-- divergence from schema.sql to prevent enumeration of referral/token IDs.

-- Admin-entered conversions with frozen allocation splits
CREATE TABLE IF NOT EXISTS referral_conversions (
  id TEXT PRIMARY KEY,
  click_id TEXT,
  registration_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  conversion_date TEXT NOT NULL,
  affiliate_fee_sgd REAL NOT NULL,
  amount_keep REAL NOT NULL,
  amount_charity REAL NOT NULL,
  amount_fireplanner REAL NOT NULL,
  amount_matched REAL NOT NULL DEFAULT 0,
  payout_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (payout_status IN ('pending', 'approved', 'paid', 'clawed_back', 'no_payout')),
  FOREIGN KEY (click_id) REFERENCES referral_clicks(id),
  FOREIGN KEY (registration_id) REFERENCES referral_registrations(id)
);

CREATE INDEX IF NOT EXISTS idx_referral_conv_reg ON referral_conversions(registration_id);
CREATE INDEX IF NOT EXISTS idx_referral_conv_date ON referral_conversions(conversion_date);

-- Payout tokens for post-conversion PayNow/voucher collection
CREATE TABLE IF NOT EXISTS referral_payout_tokens (
  id TEXT PRIMARY KEY,
  conversion_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversion_id) REFERENCES referral_conversions(id),
  FOREIGN KEY (registration_id) REFERENCES referral_registrations(id)
);

CREATE INDEX IF NOT EXISTS idx_payout_tokens_conv ON referral_payout_tokens(conversion_id);
```

- [ ] **Step 2: Verify SQL syntax**

Run: `cd frontend && cat schema-referral.sql | sqlite3 :memory: && echo "Schema valid"`
Expected: "Schema valid" (no errors)

- [ ] **Step 3: Commit**

```bash
git add frontend/schema-referral.sql
git commit -m "feat(referral): add D1 schema migration for referral program"
```

---

### Task 2: Referral Validation Constants + Disposable Email Blocklist

**Files:**
- Create: `frontend/src/lib/validation/referralConstants.ts`
- Create: `frontend/src/lib/data/disposableEmails.ts`
- Create: `frontend/src/lib/data/disposableEmails.test.ts`
- Modify: `frontend/src/lib/validation/emailConstants.ts`

- [ ] **Step 1: Add 'referral_page' to VALID_SOURCES**

In `frontend/src/lib/validation/emailConstants.ts`, add `'referral_page'` to the VALID_SOURCES array:

```typescript
export const VALID_SOURCES = ['post_simulation', 'landing_page', 'exit_intent', 'contextual_nudge', 'expense_tracker', 'cpf_planner', 'compare_page', 'feedback', 'referral_page'] as const
```

Then verify the existing email validation test still passes (it iterates VALID_SOURCES dynamically, so the new value is automatically covered):
Run: `cd frontend && npm run test -- src/lib/validation/emailValidation.test.ts`
Expected: All tests pass (including the "accepts all valid sources" test which loops VALID_SOURCES)

- [ ] **Step 2: Create referral validation constants**

```typescript
// frontend/src/lib/validation/referralConstants.ts
// Co-locates validation types, presets, and display constants for the referral feature.
// Normally data would go in lib/data/, but these constants are small (~30 lines) and
// exclusively consumed by referral validation + UI — splitting would add indirection
// for no benefit. Worker-side constants live in functions/lib/referralConfig.ts.

export const VALID_ALLOCATION_PRESETS = ['keep_all', 'donate_charity', 'fifty_fifty', 'donate_fireplanner', 'custom'] as const
export type AllocationPreset = (typeof VALID_ALLOCATION_PRESETS)[number]

export const ALLOCATION_PRESET_LABELS: Record<AllocationPreset, string> = {
  keep_all: 'Keep all',
  donate_charity: 'Donate all to charity',
  fifty_fifty: '50/50 charity and FirePlanner',
  donate_fireplanner: 'Give all to FirePlanner',
  custom: 'Custom',
}

export const ALLOCATION_PRESET_VALUES: Record<AllocationPreset, { keep: number; charity: number; fireplanner: number }> = {
  keep_all: { keep: 100, charity: 0, fireplanner: 0 },
  donate_charity: { keep: 0, charity: 100, fireplanner: 0 },
  fifty_fifty: { keep: 0, charity: 50, fireplanner: 50 },
  donate_fireplanner: { keep: 0, charity: 0, fireplanner: 100 },
  custom: { keep: 34, charity: 33, fireplanner: 33 }, // default starting values
}

export const VALID_PAYOUT_METHODS = ['paynow', 'voucher'] as const
export type PayoutMethod = (typeof VALID_PAYOUT_METHODS)[number]

export const VALID_PAYOUT_STATUSES = ['pending', 'approved', 'paid', 'clawed_back', 'no_payout'] as const
export type PayoutStatus = (typeof VALID_PAYOUT_STATUSES)[number]

// localStorage keys
export const REFERRAL_EMAIL_KEY = 'fireplanner-referral-email'
export const REFERRAL_REGISTERED_KEY = 'fireplanner-referral-registered'
export const REFERRAL_CLICKS_KEY = 'fireplanner-referral-clicks' // JSON: { [platformId]: dateString }

// Match cap
export const ANNUAL_MATCH_CAP_SGD = 10_000

// Average affiliate fee estimate for mirror moment display
export const AVG_AFFILIATE_FEE_SGD = 88
```

- [ ] **Step 3: Create disposable email blocklist**

```typescript
// frontend/src/lib/data/disposableEmails.ts

// Blocklist of known disposable/temporary email domains.
// Not exhaustive — raises the bar, not a wall.
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  '10minutemail.com', 'guerrillamail.com', 'guerrillamail.info',
  'tempmail.com', 'throwaway.email', 'mailinator.com',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'dispostable.com', 'trashmail.com', 'trashmail.me',
  'temp-mail.org', 'tempail.com', 'fakeinbox.com',
  'mailnesia.com', 'maildrop.cc', 'discard.email',
  'getnada.com', 'emailondeck.com', 'mintemail.com',
  'mohmal.com', 'burpcollaborator.net', 'mailsac.com',
])

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return DISPOSABLE_DOMAINS.has(domain)
}
```

- [ ] **Step 4: Write disposable email test**

```typescript
// frontend/src/lib/data/disposableEmails.test.ts
import { describe, it, expect } from 'vitest'
import { isDisposableEmail } from './disposableEmails'

describe('isDisposableEmail', () => {
  it('blocks known disposable domains', () => {
    expect(isDisposableEmail('test@10minutemail.com')).toBe(true)
    expect(isDisposableEmail('test@guerrillamail.com')).toBe(true)
    expect(isDisposableEmail('test@mailinator.com')).toBe(true)
  })

  it('allows legitimate email domains', () => {
    expect(isDisposableEmail('user@gmail.com')).toBe(false)
    expect(isDisposableEmail('user@hotmail.com')).toBe(false)
    expect(isDisposableEmail('user@company.sg')).toBe(false)
  })

  it('is case insensitive on domain', () => {
    expect(isDisposableEmail('test@MAILINATOR.COM')).toBe(true)
  })

  it('returns false for invalid email format', () => {
    expect(isDisposableEmail('not-an-email')).toBe(false)
    expect(isDisposableEmail('')).toBe(false)
  })
})
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npm run test -- src/lib/data/disposableEmails.test.ts`
Expected: All 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/validation/referralConstants.ts frontend/src/lib/data/disposableEmails.ts frontend/src/lib/data/disposableEmails.test.ts frontend/src/lib/validation/emailConstants.ts
git commit -m "feat(referral): add validation constants and disposable email blocklist"
```

---

### Task 3: Platform Catalog Data

**Files:**
- Create: `frontend/src/lib/data/referralPlatforms.ts`
- Create: `frontend/src/lib/data/referralPlatforms.test.ts`

- [ ] **Step 1: Create platform catalog with types**

```typescript
// frontend/src/lib/data/referralPlatforms.ts
// Platform catalog last reviewed: 2026-03-27
// Next review: 2026-04-27 (promotions rotate monthly)

export type PlatformType = 'brokerage' | 'robo_advisor' | 'crypto' | 'insurance' | 'cash_mgmt' | 'alternative'
export type AffiliateType = 'affiliate' | 'ambassador' | 'user_referral' | 'outreach_pending'
export type PlatformStatus = 'active' | 'coming_soon' | 'paused'
export type PlatformTag = 'beginner_friendly' | 'low_fees' | 'cpf_srs' | 'us_stocks' | 'sg_stocks' | 'crypto' | 'robo_managed'

export interface ReferralPlatform {
  id: string
  name: string
  type: PlatformType
  logo: string
  description: string
  refereeBonus: string
  affiliateProgram: AffiliateType
  affiliateBaseUrl: string
  trackingParam: string
  status: PlatformStatus
  featured: boolean
  markets: string[]
  cpfSrsEligible: boolean
  tags: PlatformTag[]
  lastUpdated: string
}

export const REFERRAL_PLATFORMS: ReferralPlatform[] = [
  // --- Tier 1: Planned partnerships (pending affiliate approval) ---
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    type: 'brokerage',
    logo: '/logos/ibkr.svg',
    description: 'Global multi-asset brokerage. Low fees, direct market access.',
    refereeBonus: 'Up to USD 1,000 in IBKR stock',
    affiliateProgram: 'affiliate',
    affiliateBaseUrl: 'https://www.interactivebrokers.com/referral',
    trackingParam: 'sub_id',
    status: 'coming_soon',
    featured: true,
    markets: ['US', 'SG', 'HK', 'EU'],
    cpfSrsEligible: false,
    tags: ['low_fees', 'us_stocks', 'sg_stocks'],
    lastUpdated: '2026-03-27',
  },
  {
    id: 'moomoo',
    name: 'moomoo',
    type: 'brokerage',
    logo: '/logos/moomoo.svg',
    description: 'Commission-free US stocks, SG and HK markets.',
    refereeBonus: 'Up to ~S$2,246 in welcome gifts',
    affiliateProgram: 'ambassador',
    affiliateBaseUrl: 'https://j.moomoo.com/referral',
    trackingParam: 'sub_id',
    status: 'coming_soon',
    featured: true,
    markets: ['US', 'SG', 'HK'],
    cpfSrsEligible: false,
    tags: ['beginner_friendly', 'us_stocks', 'sg_stocks'],
    lastUpdated: '2026-03-27',
  },
  {
    id: 'poems',
    name: 'POEMS (Phillip Securities)',
    type: 'brokerage',
    logo: '/logos/poems.svg',
    description: 'Full-service SG brokerage. CPF/SRS eligible.',
    refereeBonus: 'Free trading + stock coupons',
    affiliateProgram: 'affiliate',
    affiliateBaseUrl: 'https://www.poems.com.sg/referral',
    trackingParam: 'ref',
    status: 'coming_soon',
    featured: false,
    markets: ['SG', 'US', 'HK'],
    cpfSrsEligible: true,
    tags: ['cpf_srs', 'sg_stocks'],
    lastUpdated: '2026-03-27',
  },
  {
    id: 'ig',
    name: 'IG Markets',
    type: 'brokerage',
    logo: '/logos/ig.svg',
    description: 'CFD and stock brokerage with SG presence.',
    refereeBonus: 'Varies by campaign',
    affiliateProgram: 'affiliate',
    affiliateBaseUrl: 'https://www.ig.com/sg/referral',
    trackingParam: 'sub_id',
    status: 'coming_soon',
    featured: false,
    markets: ['SG', 'US', 'HK', 'EU'],
    cpfSrsEligible: false,
    tags: ['us_stocks', 'sg_stocks'],
    lastUpdated: '2026-03-27',
  },
  {
    id: 'saxo',
    name: 'Saxo Markets',
    type: 'brokerage',
    logo: '/logos/saxo.svg',
    description: 'Multi-asset brokerage. Stocks, ETFs, bonds, forex.',
    refereeBonus: 'Up to S$250 cash reward',
    affiliateProgram: 'affiliate',
    affiliateBaseUrl: 'https://www.home.saxo/referral',
    trackingParam: 'sub_id',
    status: 'coming_soon',
    featured: false,
    markets: ['SG', 'US', 'HK', 'EU'],
    cpfSrsEligible: false,
    tags: ['us_stocks', 'sg_stocks'],
    lastUpdated: '2026-03-27',
  },
  // --- Tier 2: Outreach pending ---
  {
    id: 'endowus',
    name: 'Endowus',
    type: 'robo_advisor',
    logo: '/logos/endowus.svg',
    description: 'Robo-advisor for Cash, CPF, and SRS investments.',
    refereeBonus: 'S$20 in fee credits',
    affiliateProgram: 'outreach_pending',
    affiliateBaseUrl: '',
    trackingParam: '',
    status: 'coming_soon',
    featured: false,
    markets: ['SG'],
    cpfSrsEligible: true,
    tags: ['cpf_srs', 'robo_managed', 'beginner_friendly'],
    lastUpdated: '2026-03-27',
  },
  {
    id: 'stashaway',
    name: 'StashAway',
    type: 'robo_advisor',
    logo: '/logos/stashaway.svg',
    description: 'Robo-advisor with SRS support and managed portfolios.',
    refereeBonus: '6-month fee waiver on S$10K',
    affiliateProgram: 'outreach_pending',
    affiliateBaseUrl: '',
    trackingParam: '',
    status: 'coming_soon',
    featured: false,
    markets: ['SG'],
    cpfSrsEligible: false,
    tags: ['robo_managed', 'beginner_friendly'],
    lastUpdated: '2026-03-27',
  },
  {
    id: 'syfe',
    name: 'Syfe',
    type: 'robo_advisor',
    logo: '/logos/syfe.svg',
    description: 'Managed portfolios + brokerage. Fee waivers for new users.',
    refereeBonus: 'Up to 12 months fee waiver',
    affiliateProgram: 'outreach_pending',
    affiliateBaseUrl: '',
    trackingParam: '',
    status: 'coming_soon',
    featured: false,
    markets: ['SG'],
    cpfSrsEligible: false,
    tags: ['robo_managed', 'beginner_friendly'],
    lastUpdated: '2026-03-27',
  },
  {
    id: 'tiger',
    name: 'Tiger Brokers',
    type: 'brokerage',
    logo: '/logos/tiger.svg',
    description: 'US, SG, HK, AU markets. Large SG user base.',
    refereeBonus: 'Up to S$1,000 in welcome gifts',
    affiliateProgram: 'outreach_pending',
    affiliateBaseUrl: '',
    trackingParam: '',
    status: 'coming_soon',
    featured: false,
    markets: ['US', 'SG', 'HK', 'AU'],
    cpfSrsEligible: false,
    tags: ['beginner_friendly', 'us_stocks', 'sg_stocks'],
    lastUpdated: '2026-03-27',
  },
  {
    id: 'webull',
    name: 'Webull',
    type: 'brokerage',
    logo: '/logos/webull.svg',
    description: 'Commission-free trading. Growing SG presence.',
    refereeBonus: 'Up to S$280 in Apple shares',
    affiliateProgram: 'outreach_pending',
    affiliateBaseUrl: '',
    trackingParam: '',
    status: 'coming_soon',
    featured: false,
    markets: ['US', 'SG'],
    cpfSrsEligible: false,
    tags: ['beginner_friendly', 'us_stocks'],
    lastUpdated: '2026-03-27',
  },
]

/** Get platforms sorted: featured first, then active, then coming_soon, then alphabetical */
export function getSortedPlatforms(): ReferralPlatform[] {
  return [...REFERRAL_PLATFORMS].sort((a, b) => {
    // Featured first
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    // Active before coming_soon
    const statusOrder: Record<PlatformStatus, number> = { active: 0, coming_soon: 1, paused: 2 }
    if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status]
    // Alphabetical
    return a.name.localeCompare(b.name)
  })
}

/** Build the affiliate URL with click tracking parameter */
export function buildAffiliateUrl(platform: ReferralPlatform, clickId: string): string {
  if (!platform.affiliateBaseUrl) return ''
  const separator = platform.affiliateBaseUrl.includes('?') ? '&' : '?'
  return `${platform.affiliateBaseUrl}${separator}${platform.trackingParam}=${clickId}`
}

// Note: VALID_PLATFORM_IDS for server-side validation lives in
// functions/lib/referralConfig.ts (lean duplicate, avoids importing full catalog in workers).
```

- [ ] **Step 2: Write platform catalog tests**

```typescript
// frontend/src/lib/data/referralPlatforms.test.ts
import { describe, it, expect } from 'vitest'
import { REFERRAL_PLATFORMS, getSortedPlatforms, buildAffiliateUrl } from './referralPlatforms'
import type { PlatformTag } from './referralPlatforms'

describe('REFERRAL_PLATFORMS', () => {
  it('has unique platform IDs', () => {
    const ids = REFERRAL_PLATFORMS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all platforms have required fields', () => {
    for (const p of REFERRAL_PLATFORMS) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.type).toBeTruthy()
      expect(p.logo).toBeTruthy()
      expect(p.description).toBeTruthy()
      expect(p.refereeBonus).toBeTruthy()
      expect(p.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('active platforms have affiliate URLs and tracking params', () => {
    const active = REFERRAL_PLATFORMS.filter((p) => p.status === 'active')
    for (const p of active) {
      expect(p.affiliateBaseUrl).toBeTruthy()
      expect(p.trackingParam).toBeTruthy()
    }
  })

  it('tags use valid PlatformTag values', () => {
    const validTags: PlatformTag[] = ['beginner_friendly', 'low_fees', 'cpf_srs', 'us_stocks', 'sg_stocks', 'crypto', 'robo_managed']
    for (const p of REFERRAL_PLATFORMS) {
      for (const tag of p.tags) {
        expect(validTags).toContain(tag)
      }
    }
  })
})

describe('getSortedPlatforms', () => {
  it('returns featured platforms first', () => {
    const sorted = getSortedPlatforms()
    const firstFeaturedIdx = sorted.findIndex((p) => p.featured)
    const firstNonFeaturedIdx = sorted.findIndex((p) => !p.featured)
    if (firstFeaturedIdx >= 0 && firstNonFeaturedIdx >= 0) {
      expect(firstFeaturedIdx).toBeLessThan(firstNonFeaturedIdx)
    }
  })
})

describe('buildAffiliateUrl', () => {
  it('appends tracking param with ? for clean base URL', () => {
    const platform = REFERRAL_PLATFORMS.find((p) => p.id === 'ibkr')!
    const url = buildAffiliateUrl(platform, 'click-123')
    expect(url).toContain('sub_id=click-123')
    expect(url).toContain('?')
  })

  it('returns empty string for platforms without affiliate URL', () => {
    const platform = REFERRAL_PLATFORMS.find((p) => p.status === 'coming_soon' && !p.affiliateBaseUrl)!
    expect(buildAffiliateUrl(platform, 'click-123')).toBe('')
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm run test -- src/lib/data/referralPlatforms.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/data/referralPlatforms.ts frontend/src/lib/data/referralPlatforms.test.ts
git commit -m "feat(referral): add platform catalog with types, sort, and URL builder"
```

---

### Task 4: AES-256-GCM Encryption Utility

**Files:**
- Create: `frontend/functions/lib/crypto.ts`

- [ ] **Step 1: Create encryption/decryption helpers**

```typescript
// frontend/functions/lib/crypto.ts
// AES-256-GCM encryption for PayNow numbers.
// Uses Web Crypto API (available in Cloudflare Workers/Pages).
// Stored format: base64(iv + ciphertext + authTag)

const IV_LENGTH = 12 // 96-bit IV for AES-GCM
const KEY_LENGTH = 32 // 256-bit key

async function importKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(KEY_LENGTH)
  for (let i = 0; i < KEY_LENGTH; i++) {
    keyBytes[i] = parseInt(keyHex.substring(i * 2, i * 2 + 2), 16)
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptPaynow(plaintext: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  // Prepend IV to ciphertext (IV is not secret, must be stored with ciphertext)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)

  return btoa(String.fromCharCode(...combined))
}

export async function decryptPaynow(encrypted: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex)
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))

  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/functions/lib/crypto.ts
git commit -m "feat(referral): add AES-256-GCM encrypt/decrypt for PayNow numbers"
```

---

### Task 4b: Worker-Side Referral Config

**Files:**
- Create: `frontend/functions/lib/referralConfig.ts`

- [ ] **Step 1: Create lean constants for worker-side use**

```typescript
// frontend/functions/lib/referralConfig.ts
// Lean constants for Pages Functions (workers). Do NOT import from src/lib/data/
// here — that pulls the full platform catalog into the worker bundle.
// Source of truth for platform IDs: src/lib/data/referralPlatforms.ts
// Source of truth for match cap: src/lib/validation/referralConstants.ts

export const ANNUAL_MATCH_CAP_SGD = 10_000

// Keep in sync with REFERRAL_PLATFORMS in src/lib/data/referralPlatforms.ts.
// This is a deliberately lean duplicate to avoid importing the full catalog.
export const VALID_PLATFORM_IDS = [
  'ibkr', 'moomoo', 'poems', 'ig', 'saxo',
  'endowus', 'stashaway', 'syfe', 'tiger', 'webull',
] as const
```

- [ ] **Step 2: Commit**

```bash
git add frontend/functions/lib/referralConfig.ts
git commit -m "feat(referral): add lean worker-side referral config constants"
```

---

### Task 5: Pages Function — `/api/referral/register`

**Files:**
- Create: `frontend/functions/api/referral/register.ts`

- [ ] **Step 1: Create the register endpoint**

```typescript
// frontend/functions/api/referral/register.ts
import { jsonResponse, hashIP } from '../../lib/serverUtils'
import {
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
} from '../../../src/lib/validation/emailConstants'
import { isDisposableEmail } from '../../../src/lib/data/disposableEmails'
import { VALID_ALLOCATION_PRESETS } from '../../../src/lib/validation/referralConstants'

interface Env {
  DB: D1Database
  IP_HASH_SALT: string
}

const RATE_LIMIT_MAX = 5

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>
  try {
    body = (await context.request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  try {
    // Validate email
    if (typeof body.email !== 'string') {
      return jsonResponse({ error: 'Email is required' }, 400)
    }
    const email = body.email.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email) || email.length > EMAIL_MAX_LENGTH) {
      return jsonResponse({ error: 'Invalid email address' }, 400)
    }
    if (isDisposableEmail(email)) {
      return jsonResponse({ error: 'Please use a permanent email address so we can contact you about your referral.' }, 400)
    }

    // Validate allocation
    const preset = body.allocation_preset
    if (typeof preset !== 'string' || !VALID_ALLOCATION_PRESETS.includes(preset as typeof VALID_ALLOCATION_PRESETS[number])) {
      return jsonResponse({ error: 'Invalid allocation preset' }, 400)
    }

    const pctKeep = Number(body.pct_keep)
    const pctCharity = Number(body.pct_charity)
    const pctFireplanner = Number(body.pct_fireplanner)

    if ([pctKeep, pctCharity, pctFireplanner].some((v) => !Number.isInteger(v) || v < 0 || v > 100)) {
      return jsonResponse({ error: 'Allocation percentages must be integers 0-100' }, 400)
    }
    if (pctKeep + pctCharity + pctFireplanner !== 100) {
      return jsonResponse({ error: 'Allocation percentages must sum to 100' }, 400)
    }

    // Rate limit
    const clientIP = context.request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const salt = context.env.IP_HASH_SALT
    if (!salt) {
      console.error('IP_HASH_SALT not configured')
      return jsonResponse({ error: 'Internal server error' }, 500)
    }
    const ipHash = await hashIP(clientIP, salt)

    const { results: rateCheck } = await context.env.DB.prepare(
      "SELECT COUNT(*) as count FROM referral_registrations WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(ipHash).all()

    if ((rateCheck[0]?.count as number) >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'Too many attempts. Please try again in an hour.' }, 429)
    }

    // Check if email already exists
    const { results: existing } = await context.env.DB.prepare(
      'SELECT id, pct_keep, pct_charity, pct_fireplanner, allocation_preset FROM referral_registrations WHERE email = ?'
    ).bind(email).all()

    if (existing.length > 0) {
      const regId = existing[0].id as string

      // Check if this is an edit request (body.edit_mode === true)
      if (body.edit_mode === true) {
        // Check if any paid conversions exist (locks allocation permanently)
        const { results: paidCheck } = await context.env.DB.prepare(
          "SELECT COUNT(*) as count FROM referral_conversions WHERE registration_id = ? AND payout_status = 'paid'"
        ).bind(regId).all()

        if ((paidCheck[0]?.count as number) > 0) {
          return jsonResponse({ error: 'Allocation is locked after payout.' }, 409)
        }

        // Update allocation
        await context.env.DB.prepare(
          `UPDATE referral_registrations
           SET allocation_preset = ?, pct_keep = ?, pct_charity = ?, pct_fireplanner = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(preset, pctKeep, pctCharity, pctFireplanner, regId).run()

        return jsonResponse({
          alreadyRegistered: true,
          updated: true,
          id: regId,
          allocation_preset: preset,
          pct_keep: pctKeep,
          pct_charity: pctCharity,
          pct_fireplanner: pctFireplanner,
        })
      }

      // Not edit mode — return existing registration without modifying
      return jsonResponse({
        alreadyRegistered: true,
        updated: false,
        id: regId,
        allocation_preset: existing[0].allocation_preset,
        pct_keep: existing[0].pct_keep,
        pct_charity: existing[0].pct_charity,
        pct_fireplanner: existing[0].pct_fireplanner,
      })
    }

    // Create new registration
    const id = crypto.randomUUID()
    await context.env.DB.prepare(
      `INSERT INTO referral_registrations (id, email, allocation_preset, pct_keep, pct_charity, pct_fireplanner, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, email, preset, pctKeep, pctCharity, pctFireplanner, ipHash).run()

    return jsonResponse({
      alreadyRegistered: false,
      id,
      allocation_preset: preset,
      pct_keep: pctKeep,
      pct_charity: pctCharity,
      pct_fireplanner: pctFireplanner,
    }, 201)
  } catch (err) {
    console.error('Registration error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/functions/api/referral/register.ts
git commit -m "feat(referral): add /api/referral/register Pages Function"
```

---

### Task 6: Pages Function — `/api/referral/click`

**Files:**
- Create: `frontend/functions/api/referral/click.ts`

- [ ] **Step 1: Create the click logging endpoint**

```typescript
// frontend/functions/api/referral/click.ts
import { jsonResponse } from '../../lib/serverUtils'
import { EMAIL_RE } from '../../../src/lib/validation/emailConstants'
import { VALID_PLATFORM_IDS } from '../../lib/referralConfig'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>
  try {
    body = (await context.request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  try {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const platform = typeof body.platform === 'string' ? body.platform : ''
    const clickId = typeof body.click_id === 'string' ? body.click_id : ''
    const affiliateUrl = typeof body.affiliate_url === 'string' ? body.affiliate_url : ''

    if (!email || !EMAIL_RE.test(email)) {
      return jsonResponse({ error: 'Invalid email' }, 400)
    }
    if (!VALID_PLATFORM_IDS.includes(platform)) {
      return jsonResponse({ error: 'Invalid platform' }, 400)
    }
    if (!clickId) {
      return jsonResponse({ error: 'click_id is required' }, 400)
    }

    // Look up registration by email
    const { results: reg } = await context.env.DB.prepare(
      'SELECT id, pct_keep, pct_charity, pct_fireplanner FROM referral_registrations WHERE email = ?'
    ).bind(email).all()

    if (reg.length === 0) {
      return jsonResponse({ error: 'Not registered' }, 404)
    }

    const registration = reg[0]

    // Always snapshot allocation from DB (server is source of truth, not client)
    const pctKeep = registration.pct_keep as number
    const pctCharity = registration.pct_charity as number
    const pctFireplanner = registration.pct_fireplanner as number

    await context.env.DB.prepare(
      `INSERT INTO referral_clicks (id, registration_id, platform, affiliate_url, pct_keep, pct_charity, pct_fireplanner)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(clickId, registration.id, platform, affiliateUrl, pctKeep, pctCharity, pctFireplanner).run()

    return jsonResponse({ logged: true })
  } catch (err) {
    console.error('Click logging error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/functions/api/referral/click.ts
git commit -m "feat(referral): add /api/referral/click Pages Function"
```

---

### Task 7: Pages Function — `/api/referral/tracker`

**Files:**
- Create: `frontend/functions/api/referral/tracker.ts`

- [ ] **Step 1: Create the public tracker endpoint**

```typescript
// frontend/functions/api/referral/tracker.ts
import { jsonResponse } from '../../lib/serverUtils'
import { ANNUAL_MATCH_CAP_SGD } from '../../lib/referralConfig'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`

    const { results } = await context.env.DB.prepare(`
      SELECT
        COALESCE(SUM(amount_charity), 0) as total_charity,
        COALESCE(SUM(amount_matched), 0) as total_matched,
        COALESCE(SUM(amount_fireplanner), 0) as total_fireplanner,
        COUNT(*) as conversion_count
      FROM referral_conversions
      WHERE conversion_date >= ?
    `).bind(yearStart).all()

    const { results: participants } = await context.env.DB.prepare(`
      SELECT COUNT(DISTINCT registration_id) as count FROM referral_clicks
    `).all()

    const data = results[0] ?? { total_charity: 0, total_matched: 0, total_fireplanner: 0, conversion_count: 0 }
    const participantCount = (participants[0]?.count as number) ?? 0

    // Cannot use jsonResponse() here because we need Cache-Control header.
    // Response.headers is immutable after construction in Workers, so pass all headers at once.
    return new Response(JSON.stringify({
      total_charity: data.total_charity,
      total_matched: data.total_matched,
      total_fireplanner: data.total_fireplanner,
      participant_count: participantCount,
      match_cap: ANNUAL_MATCH_CAP_SGD,
      year,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (err) {
    console.error('Tracker error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/functions/api/referral/tracker.ts
git commit -m "feat(referral): add /api/referral/tracker Pages Function with 5min cache"
```

---

### Task 8: Pages Function — `/api/admin/referral/conversions`

**Files:**
- Create: `frontend/functions/api/admin/referral/conversions.ts`

- [ ] **Step 1: Create the admin conversion CRUD endpoint**

```typescript
// frontend/functions/api/admin/referral/conversions.ts
import { jsonResponse } from '../../../lib/serverUtils'
import { ANNUAL_MATCH_CAP_SGD } from '../../../lib/referralConfig'

interface Env {
  DB: D1Database
  ADMIN_KEY: string
}

function checkAuth(context: { request: Request; env: Env }): Response | null {
  const adminKey = context.request.headers.get('x-admin-key')
  if (!adminKey || adminKey !== context.env.ADMIN_KEY) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  return null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authError = checkAuth(context)
  if (authError) return authError

  try {
    const { results } = await context.env.DB.prepare(`
      SELECT c.*, r.email, r.allocation_preset
      FROM referral_conversions c
      JOIN referral_registrations r ON c.registration_id = r.id
      ORDER BY c.created_at DESC
      LIMIT 100
    `).all()

    return jsonResponse({ conversions: results })
  } catch (err) {
    console.error('Admin GET error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authError = checkAuth(context)
  if (authError) return authError

  let body: Record<string, unknown>
  try {
    body = (await context.request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  try {
    const registrationId = String(body.registration_id ?? '')
    const platform = String(body.platform ?? '')
    const conversionDate = String(body.conversion_date ?? '')
    const affiliateFeeSgd = Number(body.affiliate_fee_sgd)
    const clickId = body.click_id ? String(body.click_id) : null
    const notes = body.notes ? String(body.notes) : null

    if (!registrationId || !platform || !conversionDate || !affiliateFeeSgd || affiliateFeeSgd <= 0) {
      return jsonResponse({ error: 'Missing required fields: registration_id, platform, conversion_date, affiliate_fee_sgd' }, 400)
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(conversionDate)) {
      return jsonResponse({ error: 'conversion_date must be YYYY-MM-DD format' }, 400)
    }

    // Get current allocation from registration
    const { results: reg } = await context.env.DB.prepare(
      'SELECT pct_keep, pct_charity, pct_fireplanner FROM referral_registrations WHERE id = ?'
    ).bind(registrationId).all()

    if (reg.length === 0) {
      return jsonResponse({ error: 'Registration not found' }, 404)
    }

    const { pct_keep, pct_charity, pct_fireplanner } = reg[0] as { pct_keep: number; pct_charity: number; pct_fireplanner: number }

    // Compute three-way split
    const amountKeep = affiliateFeeSgd * pct_keep / 100
    const amountCharity = affiliateFeeSgd * pct_charity / 100
    const amountFireplanner = affiliateFeeSgd * pct_fireplanner / 100

    // Compute match (capped at annual $10K)
    const year = conversionDate.substring(0, 4)
    const yearStart = `${year}-01-01`

    const { results: capCheck } = await context.env.DB.prepare(
      'SELECT COALESCE(SUM(amount_matched), 0) as matched_ytd FROM referral_conversions WHERE conversion_date >= ?'
    ).bind(yearStart).all()

    const matchedYtd = (capCheck[0]?.matched_ytd as number) ?? 0
    const remaining = Math.max(0, ANNUAL_MATCH_CAP_SGD - matchedYtd)
    const amountMatched = Math.min(amountCharity, remaining)

    // Determine payout status
    const payoutStatus = pct_keep === 0 ? 'no_payout' : 'pending'

    const id = crypto.randomUUID()

    await context.env.DB.prepare(`
      INSERT INTO referral_conversions
        (id, click_id, registration_id, platform, conversion_date, affiliate_fee_sgd,
         amount_keep, amount_charity, amount_fireplanner, amount_matched, payout_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, clickId, registrationId, platform, conversionDate, affiliateFeeSgd,
      amountKeep, amountCharity, amountFireplanner, amountMatched, payoutStatus, notes
    ).run()

    // If user has keep portion, generate payout token
    let payoutToken = null
    if (pct_keep > 0) {
      const tokenId = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      await context.env.DB.prepare(`
        INSERT INTO referral_payout_tokens (id, conversion_id, registration_id, expires_at)
        VALUES (?, ?, ?, ?)
      `).bind(tokenId, id, registrationId, expiresAt).run()

      payoutToken = tokenId
    }

    return jsonResponse({
      id,
      affiliate_fee_sgd: affiliateFeeSgd,
      amount_keep: amountKeep,
      amount_charity: amountCharity,
      amount_fireplanner: amountFireplanner,
      amount_matched: amountMatched,
      matched_ytd: matchedYtd + amountMatched,
      match_remaining: remaining - amountMatched,
      payout_status: payoutStatus,
      payout_token: payoutToken,
    }, 201)
  } catch (err) {
    console.error('Admin POST error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/functions/api/admin/referral/conversions.ts
git commit -m "feat(referral): add /api/admin/referral/conversions Pages Function with match cap logic"
```

---

### Task 9: Pages Function — `/api/referral/payout-info`

**Files:**
- Create: `frontend/functions/api/referral/payout-info.ts`

- [ ] **Step 1: Create the payout info collection endpoint**

```typescript
// frontend/functions/api/referral/payout-info.ts
import { jsonResponse, hashIP } from '../../lib/serverUtils'
import { EMAIL_RE } from '../../../src/lib/validation/emailConstants'
import { encryptPaynow } from '../../lib/crypto'

interface Env {
  DB: D1Database
  IP_HASH_SALT: string
  PAYNOW_ENCRYPTION_KEY: string
}

const RATE_LIMIT_MAX = 5

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>
  try {
    body = (await context.request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  try {
    const token = typeof body.token === 'string' ? body.token : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const payoutMethod = typeof body.payout_method === 'string' ? body.payout_method : ''
    const paynowNumber = typeof body.paynow_number === 'string' ? body.paynow_number.trim() : ''

    if (!token) return jsonResponse({ error: 'Token is required' }, 400)
    if (!email || !EMAIL_RE.test(email)) return jsonResponse({ error: 'Email is required for verification' }, 400)
    if (!payoutMethod || !['paynow', 'voucher'].includes(payoutMethod)) {
      return jsonResponse({ error: 'Invalid payout method' }, 400)
    }
    if (payoutMethod === 'paynow' && !paynowNumber) {
      return jsonResponse({ error: 'PayNow number is required' }, 400)
    }

    // Rate limit by IP (prevents brute-forcing token UUIDs)
    const clientIP = context.request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const salt = context.env.IP_HASH_SALT
    if (!salt) {
      console.error('IP_HASH_SALT not configured')
      return jsonResponse({ error: 'Internal server error' }, 500)
    }
    const ipHash = await hashIP(clientIP, salt)
    // Count failed token lookups from this IP in the last hour
    // (uses referral_registrations table as a proxy for IP tracking since
    // payout_tokens has no ip_hash column — check registration attempts)
    const { results: rateCheck } = await context.env.DB.prepare(
      "SELECT COUNT(*) as count FROM referral_registrations WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(ipHash).all()
    if ((rateCheck[0]?.count as number) >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'Too many attempts. Please try again later.' }, 429)
    }

    // Look up token
    const { results: tokens } = await context.env.DB.prepare(
      'SELECT t.*, r.email as reg_email FROM referral_payout_tokens t JOIN referral_registrations r ON t.registration_id = r.id WHERE t.id = ?'
    ).bind(token).all()

    if (tokens.length === 0) {
      return jsonResponse({ error: 'Invalid token' }, 404)
    }

    const tokenRow = tokens[0] as Record<string, unknown>

    // Verify email matches registration (bearer token hardening)
    if ((tokenRow.reg_email as string).toLowerCase() !== email) {
      return jsonResponse({ error: 'Email does not match registration' }, 403)
    }

    // Check expiry
    if (tokenRow.used_at) {
      return jsonResponse({ error: 'This link has already been used' }, 410)
    }
    if (new Date(tokenRow.expires_at as string) < new Date()) {
      return jsonResponse({ error: 'This link has expired. Please contact fireplanner for a new link.' }, 410)
    }

    // Encrypt PayNow number if provided
    let encryptedPaynow: string | null = null
    if (payoutMethod === 'paynow' && paynowNumber) {
      if (!context.env.PAYNOW_ENCRYPTION_KEY) {
        console.error('PAYNOW_ENCRYPTION_KEY not configured')
        return jsonResponse({ error: 'Internal server error' }, 500)
      }
      encryptedPaynow = await encryptPaynow(paynowNumber, context.env.PAYNOW_ENCRYPTION_KEY)
    }

    // Update registration with payout details
    await context.env.DB.prepare(
      'UPDATE referral_registrations SET payout_method = ?, paynow_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(payoutMethod, encryptedPaynow, tokenRow.registration_id).run()

    // Mark token as used
    await context.env.DB.prepare(
      'UPDATE referral_payout_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(token).run()

    return jsonResponse({ success: true, payout_method: payoutMethod })
  } catch (err) {
    console.error('Payout info error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/functions/api/referral/payout-info.ts
git commit -m "feat(referral): add /api/referral/payout-info with token validation and AES encryption"
```

---

### Task 10: Frontend Components — Referral Building Blocks

**Files:**
- Create: `frontend/src/components/referral/HeroSection.tsx`
- Create: `frontend/src/components/referral/PlatformCard.tsx`
- Create: `frontend/src/components/referral/PlatformGrid.tsx`
- Create: `frontend/src/components/referral/AllocationPicker.tsx`
- Create: `frontend/src/components/referral/MirrorMoment.tsx`
- Create: `frontend/src/components/referral/RegistrationForm.tsx`
- Create: `frontend/src/components/referral/StatusCard.tsx`
- Create: `frontend/src/components/referral/TrackerCard.tsx`
- Create: `frontend/src/components/referral/PastDonations.tsx`
- Create: `frontend/src/components/referral/CompareBanner.tsx`

This task creates all 10 components. Each is a self-contained React component using shadcn/ui primitives. The components are composed together in Task 11 (ReferralPage).

**Due to plan size constraints, component implementations should follow the spec's component mapping section (Section 1) exactly. Key implementation notes:**

- [ ] **Step 0: Install shadcn ToggleGroup component (not yet in the project)**

Run: `cd frontend && npx shadcn@latest add toggle-group`
Expected: Creates `src/components/ui/toggle-group.tsx`

Verify the existing ToggleGroup usage in `GoalConfig.tsx` still works:
Run: `cd frontend && npm run type-check`

- [ ] **Step 1: Create HeroSection.tsx**

Hero with headline, match promise callout, primary CTA, and affiliate disclosure footnote. Uses the copy from the spec: "Sign up for a brokerage through us. Choose where the money goes." CTA scrolls to PlatformGrid section.

- [ ] **Step 2: Create PlatformCard.tsx**

Card component accepting a `ReferralPlatform` prop + `isRegistered` + `onClickPlatform` + `clickedPlatforms` (from localStorage). Card hierarchy: logo > referee bonus (largest) > name + type > badges > CTA. Three states: locked (CTA disabled, lock icon), active (CTA enabled), coming_soon (dimmed, "Partnership pending" badge, no CTA). Post-click: checkmark + "Clicked [date]".

- [ ] **Step 3: Create PlatformGrid.tsx**

Grid layout: featured platforms at top (larger), then active, then coming_soon (dimmed). Responsive: 3 col desktop, 2 tablet, 1 mobile. Uses `getSortedPlatforms()` from the catalog.

- [ ] **Step 4: Create AllocationPicker.tsx**

Uses shadcn `ToggleGroup` for presets. "Custom..." expands two `Slider` components (Keep % and Charity %) with a computed readonly "FirePlanner %" that auto-fills the remainder. On mobile (<768px), sliders replaced with `NumberInput` components. Each slider has `aria-label`.

- [ ] **Step 5: Create MirrorMoment.tsx**

Dynamic callout that appears when charity allocation > 0. Shows "Your $88 becomes $176 for charity." using `AVG_AFFILIATE_FEE_SGD` from constants. Calculates based on current pct_charity.

- [ ] **Step 6: Create RegistrationForm.tsx**

Orchestrates: email input + AllocationPicker + MirrorMoment + submit button. Handles form state, validation (email format, disposable check client-side), loading state ("Registering..." with spinner), success state, and all error states per spec.

- [ ] **Step 7: Create StatusCard.tsx**

Returning user card: shows current allocation as read-only values. "Change allocation" button (disabled with tooltip if paid conversions exist). "Change" enters edit mode (shows RegistrationForm in edit mode).

- [ ] **Step 8: Create TrackerCard.tsx**

Community tracker: fetches from `/api/referral/tracker`. Shows totals, match progress bar (shadcn `Progress`), participant count. **Hidden when all values are zero** (the spec says hidden at launch). Skeleton loading state. Silent error fallback (no crash, shows nothing).

- [ ] **Step 9: Create PastDonations.tsx**

Timeline component. Static placeholder at launch: "No donations yet..." Later populated from a static array (admin updates manually in code for V1).

- [ ] **Step 10: Create CompareBanner.tsx**

Banner component for the /compare page. Uses the BetaBanner layout pattern (rounded border + icon + text + link). Links to /referral.

- [ ] **Step 11: Write component tests**

Create tests for AllocationPicker (slider sum constraint, preset values), PlatformCard (3 states), and RegistrationForm (validation, submit flow).

- [ ] **Step 12: Run tests**

Run: `cd frontend && npm run test -- src/components/referral`
Expected: All tests pass

- [ ] **Step 13: Commit**

```bash
git add frontend/src/components/referral/
git commit -m "feat(referral): add 10 referral UI components with tests"
```

---

### Task 11: Pages — ReferralPage, PayoutPage, AdminReferralPage

**Files:**
- Create: `frontend/src/pages/ReferralPage.tsx`
- Create: `frontend/src/pages/PayoutPage.tsx`
- Create: `frontend/src/pages/AdminReferralPage.tsx`

- [ ] **Step 1: Create ReferralPage.tsx**

Composes the four sections in order: HeroSection > PlatformGrid > RegistrationForm (or StatusCard for returning users) > TrackerCard + PastDonations. Manages registration state via localStorage (`REFERRAL_EMAIL_KEY`, `REFERRAL_REGISTERED_KEY`). Detects returning user by checking localStorage on mount.

Client-side click flow: generate UUID click_id, build affiliate URL via `buildAffiliateUrl()`, `window.open()` immediately, fire-and-forget `fetch('/api/referral/click', ...)`, update localStorage clicked platforms.

- [ ] **Step 2: Create PayoutPage.tsx**

Route: `/referral/payout`. Reads `token` from URL query params. Shows email verification form (user must enter their registered email). On verification: shows PayNow number input OR voucher selection. On submit: POSTs to `/api/referral/payout-info`. Handles expired/invalid token states per spec.

- [ ] **Step 3: Create AdminReferralPage.tsx**

Route: `/admin/referral`. Same admin key prompt pattern as `AdminEmailsPage.tsx` (key stored in sessionStorage). Dashboard shows: pending conversions list, YTD totals, match cap remaining. Conversion entry form: search by email, enter platform/fee/date, preview computed splits, confirm. Uses `GET /api/admin/referral/conversions` and `POST /api/admin/referral/conversions`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReferralPage.tsx frontend/src/pages/PayoutPage.tsx frontend/src/pages/AdminReferralPage.tsx
git commit -m "feat(referral): add ReferralPage, PayoutPage, and AdminReferralPage"
```

---

### Task 12: Router Integration + Compare Banner

**Files:**
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/pages/ComparePage.tsx`

- [ ] **Step 1: Add routes to router.tsx**

Add lazy imports and routes for the three new pages:

```typescript
const ReferralPage = lazy(() => import('@/pages/ReferralPage').then(m => ({ default: m.ReferralPage })))
const PayoutPage = lazy(() => import('@/pages/PayoutPage').then(m => ({ default: m.PayoutPage })))
const AdminReferralPage = lazy(() => import('@/pages/AdminReferralPage').then(m => ({ default: m.AdminReferralPage })))
```

Add as standalone routes (alongside `/admin/emails`, `/goal-calculator`). These pages
have NO store dependencies and must NOT be inside PlannerRouteShell:
```typescript
// Referral (standalone, no planner store dependencies)
{ path: '/referral', element: page(ReferralPage) },
{ path: '/referral/payout', element: page(PayoutPage) },
// Admin
{ path: '/admin/referral', element: page(AdminReferralPage) },
```

- [ ] **Step 2: Add CompareBanner to ComparePage**

Import `CompareBanner` and add it at the bottom of the compare page, before the final CTA section. Position it in the existing related-tools block area.

- [ ] **Step 3: Verify routing works**

Run: `cd frontend && npm run dev -- --port 5173`
Navigate to: `http://localhost:5173/referral`, `http://localhost:5173/admin/referral`, `http://localhost:5173/compare`
Expected: All three routes render without errors.

- [ ] **Step 4: Run type check and lint**

Run: `cd frontend && npm run type-check && npm run lint`
Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router.tsx frontend/src/pages/ComparePage.tsx
git commit -m "feat(referral): add routes and compare page referral banner"
```

---

### Task 13: E2E Tests

**Files:**
- Create: `frontend/e2e/referral.spec.ts`

- [ ] **Step 1: Write E2E tests for the referral registration flow**

Test the happy path: navigate to /referral, see hero and platform cards, scroll to registration, enter email, select allocation preset, submit, verify success state, verify platform CTA unlocks, click a platform card, verify clicked state appears.

Also test: locked CTA click scrolls to registration form, returning user sees status card.

- [ ] **Step 2: Run E2E**

Run: `cd frontend && npx playwright test e2e/referral.spec.ts`
Expected: All tests pass against the dev server

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/referral.spec.ts
git commit -m "test(referral): add E2E tests for registration and click flow"
```

---

### Task 14: Platform Logo SVGs

**Files:**
- Create: `frontend/public/logos/ibkr.svg`
- Create: `frontend/public/logos/moomoo.svg`
- Create: `frontend/public/logos/poems.svg`
- Create: `frontend/public/logos/ig.svg`
- Create: `frontend/public/logos/saxo.svg`
- Create: `frontend/public/logos/endowus.svg`
- Create: `frontend/public/logos/stashaway.svg`
- Create: `frontend/public/logos/syfe.svg`
- Create: `frontend/public/logos/tiger.svg`
- Create: `frontend/public/logos/webull.svg`

- [ ] **Step 1: Source or create SVG logos for each platform**

Each logo should be a simple, clean SVG. Use the platform's official brand colors. Size: 120x40px viewBox, or square for icon-style logos. These are used under editorial fair use on the comparison/referral page.

If official SVGs are not available, create simple text-based placeholder logos using the platform name in a neutral font. Replace with official assets when available.

- [ ] **Step 2: Commit**

```bash
git add frontend/public/logos/
git commit -m "feat(referral): add platform logo SVGs"
```

---

### Task 15: Final Integration + Verification

- [ ] **Step 1: Run full test suite**

Run: `cd frontend && npm run test`
Expected: All tests pass, no regressions

- [ ] **Step 2: Run type check**

Run: `cd frontend && npm run type-check`
Expected: Zero errors

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: Zero errors

- [ ] **Step 4: Build check**

Run: `cd frontend && npm run build`
Expected: Clean build, no errors

- [ ] **Step 5: Manual smoke test**

Start dev server: `cd frontend && npm run dev -- --port 5173`
- Visit `/referral` — verify all 4 sections render
- Register with email — verify success state
- Click a platform card — verify new tab opens and clicked state shows
- Visit `/referral` again — verify returning user status card
- Visit `/admin/referral` — verify admin key prompt
- Visit `/compare` — verify referral banner appears
- Visit `/referral/payout?token=invalid` — verify error state

- [ ] **Step 6: Final commit**

```bash
git commit -m "feat(referral): referral program with donation matching - complete"
```
