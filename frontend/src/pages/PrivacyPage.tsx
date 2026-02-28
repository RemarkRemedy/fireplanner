import { Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'

export function PrivacyPage() {
  usePageMeta({ title: 'Privacy Policy - SG FIRE Planner', description: 'How SG FIRE Planner handles your data. Your financial data stays in your browser. PDPA-compliant privacy policy.', path: '/privacy' })

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        {/* Update this date whenever the privacy policy content changes */}
        <p className="text-sm text-muted-foreground mt-1">
          Last updated: 28 February 2026
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          SG FIRE Planner is a privacy-first financial planning tool. Your financial data never leaves your browser.
          This policy explains the limited data we do collect and how we handle it, in compliance with
          Singapore's Personal Data Protection Act (PDPA).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Financial data stays in your browser</h2>
        <p className="text-sm text-muted-foreground">
          All your financial planning data (income, expenses, CPF balances, investment allocations, simulation results,
          and every other input you provide) is stored exclusively in your browser's local storage. It is never
          transmitted to any server, and we have no ability to access, view, or recover it.
        </p>
        <p className="text-sm text-muted-foreground">
          If you clear your browser data, your financial planning data is permanently deleted. You can export
          a JSON backup at any time using the Export button in the sidebar.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Email notification signup</h2>
        <p className="text-sm text-muted-foreground">
          If you choose to sign up for feature launch notifications, we collect:
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1">
          <li><strong>Email address</strong>: to send you notifications about major new features</li>
          <li><strong>Feature interest</strong> (optional): which upcoming feature you're most interested in, to help us prioritise development</li>
          <li><strong>Hashed IP address</strong>: a one-way cryptographic hash used solely for rate limiting (max 5 signups per hour per IP). We cannot reverse the hash to obtain your IP address.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          This data is stored in a Cloudflare D1 database. It is completely separate from your financial planning
          data, which remains in your browser.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">How we use your email</h2>
        <p className="text-sm text-muted-foreground">
          We will only email you about major feature launches. We do not send marketing emails, newsletters,
          or promotional content. We do not sell, share, or disclose your email address to any third party.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          We use Umami, a privacy-focused analytics tool, to understand how the app is used (e.g., which pages
          are visited, which features are popular). Umami does not use cookies, does not collect personal data,
          and does not track individual users across sessions. All analytics data is aggregated and anonymous.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cookies</h2>
        <p className="text-sm text-muted-foreground">
          This site does not use cookies. Your preferences and session state are stored in browser local storage
          and session storage only.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your rights under PDPA</h2>
        <p className="text-sm text-muted-foreground">
          Under Singapore's Personal Data Protection Act, you have the right to:
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1">
          <li><strong>Access</strong>: request a copy of the personal data we hold about you</li>
          <li><strong>Correction</strong>: request corrections to your personal data</li>
          <li><strong>Withdrawal</strong>: withdraw your consent for us to use your email at any time</li>
          <li><strong>Deletion</strong>: request that we delete your email and associated data</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          To exercise any of these rights, contact us at the email address below. We will respond within
          30 days as required by the PDPA.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Data retention</h2>
        <p className="text-sm text-muted-foreground">
          Email notification signups are retained until you request deletion or unsubscribe. Hashed IP addresses
          used for rate limiting are retained alongside the signup record but cannot be used to identify you.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm text-muted-foreground">
          For privacy-related requests or questions, email{' '}
          <a href="mailto:privacy@sgfireplanner.com" className="text-primary hover:underline">
            privacy@sgfireplanner.com
          </a>
        </p>
      </section>

      <div className="pt-4 border-t">
        <Link to="/" className="text-sm text-primary hover:underline">
          &larr; Back to planner
        </Link>
      </div>
    </div>
  )
}
