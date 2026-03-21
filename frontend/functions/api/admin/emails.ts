import { jsonResponse } from '../../lib/serverUtils'

interface Env {
  DB: D1Database
  ADMIN_KEY: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const adminKey = context.request.headers.get('x-admin-key')
  if (!adminKey || adminKey !== context.env.ADMIN_KEY) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  try {
    const [emailSignups, expenseSignups, feedback] = await Promise.all([
      context.env.DB.prepare(
        'SELECT id, email, source, feature_interest, created_at, updated_at FROM email_signups ORDER BY created_at DESC',
      ).all(),
      context.env.DB.prepare(
        'SELECT id, email, expense_tracking_status, primary_device, source_surface, copy_variant, page_path, submitted_at, created_at FROM expense_tracker_signups ORDER BY created_at DESC',
      ).all(),
      context.env.DB.prepare(
        'SELECT id, message, email, interested_in_expense_tracker, page_path, created_at FROM feedback ORDER BY created_at DESC',
      ).all(),
    ])

    return jsonResponse({
      emailSignups: emailSignups.results,
      expenseSignups: expenseSignups.results,
      feedback: feedback.results,
    })
  } catch (err) {
    console.error('Admin emails query failed:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
