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
