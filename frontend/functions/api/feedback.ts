import { EMAIL_RE, EMAIL_MAX_LENGTH, FEEDBACK_MAX_LENGTH } from '../../src/lib/validation/emailConstants'
import { jsonResponse, hashIP } from '../lib/serverUtils'

interface Env {
  DB: D1Database
  IP_HASH_SALT: string
}

const RATE_LIMIT_MAX = 3

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>
  try {
    body = (await context.request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  try {
    const { message, email: rawEmail, interestedInExpenseTracker, pagePath } = body

    if (typeof message !== 'string' || !message.trim()) {
      return jsonResponse({ error: 'Message is required' }, 400)
    }
    if (message.length > FEEDBACK_MAX_LENGTH) {
      return jsonResponse({ error: `Message must be ${FEEDBACK_MAX_LENGTH} characters or less` }, 400)
    }
    if (typeof pagePath !== 'string' || pagePath.length > 500) {
      return jsonResponse({ error: 'Invalid pagePath' }, 400)
    }

    // Email: optional, but required if interested in expense tracker
    let email: string | null = null
    if (rawEmail !== undefined && rawEmail !== null && rawEmail !== '') {
      if (typeof rawEmail !== 'string') {
        return jsonResponse({ error: 'Invalid email' }, 400)
      }
      email = rawEmail.trim().toLowerCase()
      if (!EMAIL_RE.test(email) || email.length > EMAIL_MAX_LENGTH) {
        return jsonResponse({ error: 'Invalid email address' }, 400)
      }
    }

    const expenseInterest = interestedInExpenseTracker === true
    if (expenseInterest && !email) {
      return jsonResponse({ error: 'Email is required to join the expense tracker waitlist' }, 400)
    }

    // Hash IP
    const clientIP = context.request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const salt = context.env.IP_HASH_SALT
    if (!salt) {
      console.error('IP_HASH_SALT secret is not configured')
      return jsonResponse({ error: 'Internal server error' }, 500)
    }
    const ipHash = await hashIP(clientIP, salt)

    // Rate limit: 3 feedback submissions per IP per hour
    const { results: rateLimitRows } = await context.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM feedback WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    )
      .bind(ipHash)
      .all()

    const count = Number(rateLimitRows?.[0]?.cnt ?? 0)
    if (count >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'Too many requests' }, 429)
    }

    // Insert feedback
    await context.env.DB.prepare(
      `INSERT INTO feedback (message, email, interested_in_expense_tracker, page_path, ip_hash)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(message.trim(), email, expenseInterest ? 1 : 0, pagePath, ipHash)
      .run()

    // Cross-write to email_signups if email provided (fire-and-forget)
    if (email) {
      const source = expenseInterest ? 'feedback' : 'feedback'
      const featureInterest = expenseInterest ? 'expense_tracker' : null
      context.waitUntil(
        context.env.DB.prepare(
          `INSERT INTO email_signups (email, source, feature_interest, ip_hash) VALUES (?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             feature_interest = COALESCE(feature_interest, excluded.feature_interest),
             updated_at = CURRENT_TIMESTAMP`
        )
          .bind(email, source, featureInterest, ipHash)
          .run()
          .catch((err) => console.error('Cross-write to email_signups failed:', err))
      )
    }

    return jsonResponse({ ok: true }, 201)
  } catch (err) {
    console.error('feedback error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
