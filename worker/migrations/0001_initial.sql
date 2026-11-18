CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  batch_id TEXT NOT NULL,
  tail TEXT NOT NULL,
  phone TEXT NOT NULL,
  display_name TEXT NOT NULL,
  remark TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0,
  last_visited_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_links_batch_id ON links(batch_id);
CREATE INDEX IF NOT EXISTS idx_links_expires_at ON links(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);
