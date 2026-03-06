-- Email capture schema for D1
-- created_at uses SQLite CURRENT_TIMESTAMP which stores UTC in format 'YYYY-MM-DD HH:MM:SS'

CREATE TABLE IF NOT EXISTS email_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  feature_interest TEXT,
  ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL
);

-- Note: email already has a UNIQUE constraint which creates an implicit index.
-- Only add indexes for query patterns not covered by UNIQUE.
CREATE INDEX IF NOT EXISTS idx_email_signups_source ON email_signups(source);
CREATE INDEX IF NOT EXISTS idx_email_signups_ip_hash_created ON email_signups(ip_hash, created_at);

-- Expense tracker early access signups
CREATE TABLE IF NOT EXISTS expense_tracker_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  expense_tracking_status TEXT NOT NULL,
  primary_device TEXT NOT NULL,
  source_surface TEXT NOT NULL,
  copy_variant TEXT NOT NULL DEFAULT 'default',
  page_path TEXT NOT NULL,
  ip_hash TEXT,
  submitted_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_tracker_email ON expense_tracker_signups(email);
CREATE INDEX IF NOT EXISTS idx_expense_tracker_ip_rate ON expense_tracker_signups(ip_hash, created_at);
