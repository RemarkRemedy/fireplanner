// Email worker base URL for double opt-in subscribe endpoint.
// Set VITE_EMAIL_WORKER_URL in .env for local dev (e.g. http://localhost:8787).
// Production: https://mail.sgfireplanner.com once DNS is configured (SGF-11).
//
// Kept separate from emailConstants.ts because that module is shared with
// Cloudflare Functions, where import.meta.env does not exist.
export const EMAIL_WORKER_URL = import.meta.env.VITE_EMAIL_WORKER_URL as string | undefined ?? ''
