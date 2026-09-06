-- 監視対象
CREATE TABLE targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  port INTEGER,
  initial_page_title TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  interval_sec INTEGER NOT NULL DEFAULT 60,
  timeout_sec INTEGER NOT NULL DEFAULT 5,
  expected_status_pattern TEXT NOT NULL DEFAULT '2xx',
  warning_threshold_ms INTEGER NOT NULL DEFAULT 2000,
  warning_notify_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 監視対象ごとの現在状態(1:1)
CREATE TABLE target_state (
  target_id INTEGER PRIMARY KEY REFERENCES targets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (status IN ('UNKNOWN', 'NORMAL', 'WARNING', 'DOWN', 'RECOVERED')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  incident_start_at TEXT,
  recovered_at TEXT,
  last_checked_at TEXT,
  last_http_status INTEGER,
  last_response_time_ms INTEGER,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 障害履歴(開始・復旧・継続時間)
CREATE TABLE incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  recovered_at TEXT,
  duration_sec INTEGER,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_incidents_target ON incidents(target_id);
CREATE INDEX idx_incidents_open ON incidents(target_id, recovered_at);

-- 監視履歴(監視周期ごとのチェック結果ログ、保持期間90日)
CREATE TABLE check_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  http_status INTEGER,
  response_time_ms INTEGER,
  result TEXT NOT NULL
    CHECK (result IN ('NORMAL', 'WARNING', 'DOWN')),
  error TEXT
);

CREATE INDEX idx_check_history_target_checked_at ON check_history(target_id, checked_at);
CREATE INDEX idx_check_history_checked_at ON check_history(checked_at);
