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
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'trader',   -- 'admin' | 'trader'
      display_name  TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'disabled'
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      last_login_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reports (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL DEFAULT '',
      source        TEXT NOT NULL DEFAULT 'text',   -- 'pdf' | 'text'
      raw_text      TEXT NOT NULL DEFAULT '',
      pages         INTEGER NOT NULL DEFAULT 0,
      summary_json  TEXT,                           -- JSON string
      uploaded_by   TEXT,                           -- user id, nullable for legacy
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
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `)

  migrateAddColumns(d)
}

/**
 * 渐进式迁移 — 为已有表添加新字段
 * 每次部署自动检测并执行，幂等安全
 */
function migrateAddColumns(d: Database.Database) {
  // reports 表迁移
  const reportCols = d.prepare("PRAGMA table_info(reports)").all() as { name: string }[]
  const reportColNames = reportCols.map(c => c.name)

  if (!reportColNames.includes('uploaded_by')) {
    d.exec('ALTER TABLE reports ADD COLUMN uploaded_by TEXT')
  }
  if (!reportColNames.includes('structured_content')) {
    d.exec('ALTER TABLE reports ADD COLUMN structured_content TEXT')
  }
  if (!reportColNames.includes('status')) {
    d.exec("ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'")
  }

  // RAGFlow 关联字段
  if (!reportColNames.includes('ragflow_document_id')) {
    d.exec('ALTER TABLE reports ADD COLUMN ragflow_document_id TEXT')
  }
  if (!reportColNames.includes('ragflow_dataset_id')) {
    d.exec('ALTER TABLE reports ADD COLUMN ragflow_dataset_id TEXT')
  }

  // report_chunks 表迁移（本地 RAG 遗留，保留兼容）
  try {
    const chunkCols = d.prepare("PRAGMA table_info(report_chunks)").all() as { name: string }[]
    const chunkColNames = chunkCols.map(c => c.name)
    if (!chunkColNames.includes('chunk_type')) {
      d.exec("ALTER TABLE report_chunks ADD COLUMN chunk_type TEXT NOT NULL DEFAULT 'text'")
    }
    if (!chunkColNames.includes('metadata')) {
      d.exec('ALTER TABLE report_chunks ADD COLUMN metadata TEXT')
    }
  } catch { /* report_chunks 表可能不存在，忽略 */ }

  // report_groups 表（按股票/行业分组，支撑多研报对比）
  d.exec(`
    CREATE TABLE IF NOT EXISTS report_groups (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      stock_code TEXT,
      industry   TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_group_items (
      group_id   TEXT NOT NULL,
      report_id  TEXT NOT NULL,
      added_at   INTEGER NOT NULL,
      PRIMARY KEY (group_id, report_id),
      FOREIGN KEY (group_id) REFERENCES report_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );
  `)
}

export function closeDb(): void {
  if (db) { db.close(); db = undefined!; }
}
