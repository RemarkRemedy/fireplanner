import {
  VALID_SOURCES,
  VALID_FEATURES,
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
} from '../../src/lib/validation/emailConstants'

interface Env {
  DB: D1Database
  IP_HASH_SALT: string
}

const RATE_LIMIT_MAX = 5

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function hashIP(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + ip)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // Parse JSON body safely — malformed payloads return 400, not 500
  let body: Record<string, unknown>
  try {
    body = (await context.request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  try {
    // Type-check before calling string methods
    if (typeof body.email !== 'string' || typeof body.source !== 'string') {
      return jsonResponse({ error: 'Invalid request body' }, 400)
    }

    // Validate email
    const email = body.email.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email) || email.length > EMAIL_MAX_LENGTH) {
      return jsonResponse({ error: 'Invalid email address' }, 400)
    }

    // Validate source
    if (!VALID_SOURCES.includes(body.source as typeof VALID_SOURCES[number])) {
      return jsonResponse({ error: 'Invalid source' }, 400)
    }

    // Validate feature_interest (optional, but reject empty string and invalid values)
    const featureInterest = body.feature_interest
    if (featureInterest !== undefined && featureInterest !== null) {
      if (
        typeof featureInterest !== 'string' ||
        featureInterest === '' ||
        !VALID_FEATURES.includes(featureInterest as typeof VALID_FEATURES[number])
      ) {
        return jsonResponse({ error: 'Invalid feature_interest' }, 400)
      }
    }

    // Hash IP with salt for rate limiting and storage
    const clientIP = context.request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const salt = context.env.IP_HASH_SALT
    if (!salt) {
      console.error('IP_HASH_SALT secret is not configured — aborting request')
      return jsonResponse({ error: 'Internal server error' }, 500)
    }
    const ipHash = await hashIP(clientIP, salt)

    // Rate limit: max 5 new signups per IP per hour.
    // Feature-interest upserts (step 2) are exempt since the email is already saved.
    const isFeatureUpsert = typeof featureInterest === 'string'
    if (!isFeatureUpsert) {
      const { results: rateLimitRows } = await context.env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM email_signups WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
      )
        .bind(ipHash)
        .all()

      const count = Number(rateLimitRows?.[0]?.cnt ?? 0)
      if (count >= RATE_LIMIT_MAX) {
        return jsonResponse({ error: 'Too many requests' }, 429)
      }
    }

    // Two-step flow: step 1 inserts email, step 2 updates feature_interest on the existing row.
    // Separating INSERT from UPDATE avoids burning autoincrement IDs on conflict.
    if (isFeatureUpsert) {
      // Step 2: update feature_interest for an already-saved email.
      // Only set feature_interest if it was previously NULL (prevents third-party overwrites).
      const result = await context.env.DB.prepare(
        `UPDATE email_signups
         SET feature_interest = COALESCE(feature_interest, ?),
             source = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`
      )
        .bind(featureInterest, body.source, email)
        .run()

      if (!result.meta.changes) {
        // Email not found — user cleared localStorage or hit the endpoint directly.
        // Fall through to insert so the data isn't lost.
        await context.env.DB.prepare(
          `INSERT INTO email_signups (email, source, feature_interest, ip_hash) VALUES (?, ?, ?, ?)`
        )
          .bind(email, body.source, featureInterest, ipHash)
          .run()
      }
    } else {
      // Step 1: insert new signup. Duplicate emails get a source update only.
      await context.env.DB.prepare(
        `INSERT INTO email_signups (email, source, ip_hash) VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           source = excluded.source,
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(email, body.source, ipHash)
        .run()
    }

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('email-signup error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
