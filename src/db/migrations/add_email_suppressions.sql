-- Create email_suppressions table for bounce/complaint tracking
CREATE TABLE IF NOT EXISTS email_suppressions (
  id           VARCHAR(64) NOT NULL PRIMARY KEY,
  email        VARCHAR(191) NOT NULL,
  reason       VARCHAR(32) NOT NULL COMMENT 'hard_bounce, complaint, manual',
  bounce_type  VARCHAR(64) NOT NULL DEFAULT '',
  diagnostics  TEXT,
  source       VARCHAR(32) NOT NULL DEFAULT 'webhook' COMMENT 'webhook, manual, api',
  created_at   DATETIME(3) NOT NULL,
  updated_at   DATETIME(3) NOT NULL,
  UNIQUE KEY uq_email_suppressions_email (email),
  KEY idx_email_suppressions_reason (reason, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
