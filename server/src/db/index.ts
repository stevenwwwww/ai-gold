/**
 * SQLite 数据库层 - 使用 better-sqlite3
 * 零配置、文件型、同步 API，适合 Phase 1
 * 预留：可平替为 PostgreSQL / MySQL 等
 */
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { config } from '../config'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(config.dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    db = new Database(config.dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL DEFAULT '',
      source        TEXT NOT NULL DEFAULT 'text',   -- 'pdf' | 'text'
      raw_text      TEXT NOT NULL DEFAULT '',
      pages         INTEGER NOT NULL DEFAULT 0,
      summary_json  TEXT,                           -- JSON string
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_chats (
      id            TEXT PRIMARY KEY,
      report_id     TEXT NOT NULL,
      role          TEXT NOT NULL,                  -- 'user' | 'assistant'
      content       TEXT NOT NULL DEFAULT '',
      created_at    INTEGER NOT NULL,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_report_chats_report ON report_chats(report_id);
    CREATE INDEX IF NOT EXISTS idx_reports_updated ON reports(updated_at DESC);
  `)
}

export function closeDb(): void {
  if (db) { db.close(); db = undefined!; }
}
