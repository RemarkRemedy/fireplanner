import {
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
  VALID_EXPENSE_TRACKING_STATUSES,
  VALID_PRIMARY_DEVICES,
  VALID_SOURCE_SURFACES,
} from '../../src/lib/validation/emailConstants'
import { jsonResponse, hashIP } from '../lib/serverUtils'

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
    const { email: rawEmail, expenseTrackingStatus, primaryDevice, sourceSurface, copyVariant, pagePath, submittedAt } = body
    if (
      typeof rawEmail !== 'string' ||
      typeof expenseTrackingStatus !== 'string' ||
      typeof primaryDevice !== 'string' ||
      typeof sourceSurface !== 'string' ||
      typeof copyVariant !== 'string' ||
      typeof pagePath !== 'string' ||
      typeof submittedAt !== 'string'
    ) {
      return jsonResponse({ error: 'Missing or invalid fields' }, 400)
    }

    const email = rawEmail.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email) || email.length > EMAIL_MAX_LENGTH) {
      return jsonResponse({ error: 'Invalid email address' }, 400)
    }

    if (!VALID_EXPENSE_TRACKING_STATUSES.includes(expenseTrackingStatus as typeof VALID_EXPENSE_TRACKING_STATUSES[number])) {
      return jsonResponse({ error: 'Invalid expenseTrackingStatus' }, 400)
    }
    if (!VALID_PRIMARY_DEVICES.includes(primaryDevice as typeof VALID_PRIMARY_DEVICES[number])) {
      return jsonResponse({ error: 'Invalid primaryDevice' }, 400)
    }
    if (!VALID_SOURCE_SURFACES.includes(sourceSurface as typeof VALID_SOURCE_SURFACES[number])) {
      return jsonResponse({ error: 'Invalid sourceSurface' }, 400)
    }
    if (isNaN(Date.parse(submittedAt))) {
      return jsonResponse({ error: 'Invalid submittedAt timestamp' }, 400)
    }
    if (pagePath.length > 500) {
      return jsonResponse({ error: 'Invalid pagePath' }, 400)
    }
    if (copyVariant.length > 50) {
      return jsonResponse({ error: 'Invalid copyVariant' }, 400)
    }

    const clientIP = context.request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const salt = context.env.IP_HASH_SALT
    if (!salt) {
      console.error('IP_HASH_SALT secret is not configured')
      return jsonResponse({ error: 'Internal server error' }, 500)
    }
    const ipHash = await hashIP(clientIP, salt)

    const { results: rateLimitRows } = await context.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM expense_tracker_signups WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    )
      .bind(ipHash)
      .all()

    const count = Number(rateLimitRows?.[0]?.cnt ?? 0)
    if (count >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'Too many requests' }, 429)
    }

    await context.env.DB.prepare(
      `INSERT INTO expense_tracker_signups
         (email, expense_tracking_status, primary_device, source_surface, copy_variant, page_path, ip_hash, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         expense_tracking_status = excluded.expense_tracking_status,
         primary_device = excluded.primary_device,
         source_surface = excluded.source_surface,
         copy_variant = excluded.copy_variant,
         page_path = excluded.page_path,
         ip_hash = excluded.ip_hash,
         submitted_at = excluded.submitted_at`
    )
      .bind(email, expenseTrackingStatus, primaryDevice, sourceSurface, copyVariant, pagePath, ipHash, submittedAt)
      .run()

    // Cross-write to general email_signups (fire-and-forget).
    // 'expense_tracker' is now a valid source and feature_interest value.
    context.waitUntil(
      context.env.DB.prepare(
        `INSERT INTO email_signups (email, source, feature_interest, ip_hash) VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           source = excluded.source,
           feature_interest = COALESCE(feature_interest, excluded.feature_interest),
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(email, 'expense_tracker', 'expense_tracker', ipHash)
        .run()
        .catch((err) => console.error('Cross-write to email_signups failed:', err))
    )

    return jsonResponse({ ok: true }, 201)
  } catch (err) {
    console.error('expense-tracker-signup error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
