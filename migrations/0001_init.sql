-- Antra — initial schema.
-- Money is stored as integer minor units. Timestamps are UTC ISO-8601 strings.
-- Soft deletes use `deleted_at` tombstones so delta-sync can propagate deletes.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  iterations    INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS api_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('bank','credit_card')),
  last4              TEXT,
  color              TEXT NOT NULL DEFAULT '#0A84FF',
  icon               TEXT NOT NULL DEFAULT '🏦',
  credit_limit_minor INTEGER,
  statement_day      INTEGER,
  due_day            INTEGER,
  archived           INTEGER NOT NULL DEFAULT 0,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  deleted_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_accounts_user_updated ON accounts(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id, deleted_at);

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '📦',
  color      TEXT NOT NULL DEFAULT '#8A8F98',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_categories_user_updated ON categories(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id, deleted_at);

CREATE TABLE IF NOT EXISTS expenses (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor     INTEGER NOT NULL,
  category_id      TEXT NOT NULL,
  account_id       TEXT NOT NULL,
  merchant         TEXT,
  note             TEXT,
  spent_at         TEXT NOT NULL,
  paid             INTEGER NOT NULL DEFAULT 0,
  paid_at          TEXT,
  source           TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app','api')),
  idempotency_key  TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_updated ON expenses(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, spent_at);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_account ON expenses(user_id, account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_idempotency
  ON expenses(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS budgets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  period       TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_budgets_user_updated ON budgets(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON budgets(user_id, category_id);

CREATE TABLE IF NOT EXISTS settings (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  currency   TEXT NOT NULL DEFAULT 'INR',
  theme      TEXT NOT NULL DEFAULT 'system',
  timezone   TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  week_start INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_settings_user_updated ON settings(user_id, updated_at);
