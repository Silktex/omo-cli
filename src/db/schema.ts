import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DB_PATH } from "../constants.js";

let _db: Database | null = null;

export function getDb(path = DB_PATH): Database {
  if (_db) return _db;
  mkdirSync(dirname(path), { recursive: true });
  _db = new Database(path);
  _db.exec("PRAGMA journal_mode=WAL");
  _db.exec("PRAGMA foreign_keys=ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_snapshots (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      provider        TEXT NOT NULL,
      plan_name       TEXT,
      rpm_used        INTEGER,
      rpm_limit       INTEGER,
      rpd_used        INTEGER,
      rpd_limit       INTEGER,
      tpm_used        INTEGER,
      tpm_limit       INTEGER,
      tpd_used        INTEGER,
      tpd_limit       INTEGER,
      spend_today     REAL,
      spend_month     REAL,
      quota_resets_at TEXT,
      sampled_at      TEXT NOT NULL,
      is_estimated    INTEGER DEFAULT 0,
      error_msg       TEXT
    );

    CREATE TABLE IF NOT EXISTS role_assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      role        TEXT NOT NULL,
      model       TEXT NOT NULL,
      provider    TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      assigned_by TEXT DEFAULT 'cli'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      agent_role    TEXT,
      agent_name    TEXT,
      model         TEXT NOT NULL,
      provider      TEXT NOT NULL,
      input_tokens  INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_tokens  INTEGER DEFAULT 0,
      cost_usd      REAL DEFAULT 0.0,
      duration_ms   INTEGER,
      status        TEXT DEFAULT 'active',
      project_path  TEXT,
      started_at    TEXT NOT NULL,
      ended_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS proxy_stats (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      provider        TEXT NOT NULL,
      minute          TEXT NOT NULL,
      requests        INTEGER DEFAULT 0,
      errors          INTEGER DEFAULT 0,
      timeouts        INTEGER DEFAULT 0,
      avg_latency_ms  INTEGER,
      UNIQUE(provider, minute)
    );

    CREATE TABLE IF NOT EXISTS profiles (
      name        TEXT PRIMARY KEY,
      assignments TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_provider_time ON provider_snapshots(provider, sampled_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_role ON sessions(agent_role);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_role_assignments_role ON role_assignments(role);
  `);
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
