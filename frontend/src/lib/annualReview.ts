/**
 * Annual review logic (Advisory Gap Feature 8).
 *
 * Determines whether the user should be prompted to do their annual
 * financial review based on when they last completed one and whether
 * they snoozed the reminder.
 */

/** Number of milliseconds in one year (365 days). */
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** Number of milliseconds in 30 days (snooze duration). */
export const SNOOZE_DURATION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Returns true when an annual review is due.
 *
 * A review is due when:
 * 1. The user has never completed a review (`lastReviewDate` is null), OR
 * 2. More than 365 days have passed since the last review date
 *
 * However, if the user has snoozed the reminder and the snooze period
 * has not yet expired, the review is NOT considered due.
 *
 * @param lastReviewDate  ISO date string of last completed review, or null
 * @param snoozeUntil     ISO date string when snooze expires, or null
 * @param now             Current date (injectable for testing)
 */
export function isReviewDue(
  lastReviewDate: string | null,
  snoozeUntil: string | null,
  now: Date = new Date()
): boolean {
  // Check snooze first: if snoozed and not expired, suppress the banner
  if (snoozeUntil) {
    const snoozeExpiry = new Date(snoozeUntil).getTime()
    if (now.getTime() < snoozeExpiry) {
      return false
    }
  }

  // Never reviewed: always due
  if (!lastReviewDate) {
    return true
  }

  const lastReview = new Date(lastReviewDate).getTime()
  const elapsed = now.getTime() - lastReview
  return elapsed >= ONE_YEAR_MS
}
