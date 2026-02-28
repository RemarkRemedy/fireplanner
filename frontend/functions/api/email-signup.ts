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
      console.error('IP_HASH_SALT secret is not configured — IP hashing is insecure without it')
    }
    const ipHash = await hashIP(clientIP, salt ?? '')

    // Rate limit: max 5 signups per IP per hour
    // Use SQLite's datetime() to avoid timestamp format mismatch
    // (JS toISOString = 'YYYY-MM-DDTHH:mm:ss.sssZ', SQLite CURRENT_TIMESTAMP = 'YYYY-MM-DD HH:MM:SS')
    const { results: rateLimitRows } = await context.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM email_signups WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    )
      .bind(ipHash)
      .all()

    const count = (rateLimitRows?.[0]?.cnt as number) ?? 0
    if (count >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'Too many requests' }, 429)
    }

    // Insert — on duplicate email, return success silently (don't leak existence)
    try {
      await context.env.DB.prepare(
        'INSERT INTO email_signups (email, source, feature_interest, ip_hash) VALUES (?, ?, ?, ?)'
      )
        .bind(
          email,
          body.source,
          typeof featureInterest === 'string' ? featureInterest : null,
          ipHash
        )
        .run()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('UNIQUE constraint failed')) {
        return jsonResponse({ success: true })
      }
      throw err
    }

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('email-signup error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
