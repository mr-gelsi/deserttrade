CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash   TEXT NOT NULL,
  money       REAL NOT NULL DEFAULT 0,
  inventory   TEXT NOT NULL DEFAULT '{}',
  level       INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'locked',
  city        TEXT,
  day         INTEGER NOT NULL DEFAULT 0,
  snapshot    TEXT,
  travel      TEXT,
  haggles     TEXT NOT NULL DEFAULT '{}',
  caravan_id  INTEGER,
  skills      TEXT NOT NULL DEFAULT '{}',
  flags       TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_players_caravan ON players(caravan_id);
CREATE INDEX IF NOT EXISTS idx_players_money ON players(money);

CREATE TABLE IF NOT EXISTS caravans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash   TEXT NOT NULL,
  created_by  INTEGER,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  player_id   INTEGER,
  role        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);

CREATE TABLE IF NOT EXISTS logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL,
  level       INTEGER,
  day         INTEGER,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_player ON logs(player_id, id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
