/**
 * 爬虫状态持久化 - 已导入的 PMID/PMC ID 去重
 */
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

function getDb(statePath: string): Database.Database {
  const dir = path.dirname(statePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!db) {
    db = new Database(statePath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS imported_papers (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        imported_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_imported_source ON imported_papers(source);
    `)
  }
  return db
}

/**
 * 检查是否已导入
 */
export function isImported(statePath: string, id: string, source: 'pmid' | 'pmc'): boolean {
  const key = source === 'pmid' ? `pmid:${id}` : `pmc:${id}`
  const row = getDb(statePath).prepare('SELECT 1 FROM imported_papers WHERE id = ?').get(key)
  return !!row
}

/**
 * 标记为已导入
 */
export function markImported(statePath: string, id: string, source: 'pmid' | 'pmc'): void {
  const key = source === 'pmid' ? `pmid:${id}` : `pmc:${id}`
  getDb(statePath).prepare('INSERT OR IGNORE INTO imported_papers (id, source, imported_at) VALUES (?, ?, ?)').run(key, source, Date.now())
}

/**
 * 批量检查，返回未导入的 ID 列表
 */
export function filterNotImported(statePath: string, ids: string[], source: 'pmid' | 'pmc'): string[] {
  const db = getDb(statePath)
  const prefix = source === 'pmid' ? 'pmid:' : 'pmc:'
  const notImported: string[] = []
  for (const id of ids) {
    const key = `${prefix}${id}`
    const row = db.prepare('SELECT 1 FROM imported_papers WHERE id = ?').get(key)
    if (!row) notImported.push(id)
  }
  return notImported
}

/**
 * 关闭数据库连接（用于脚本退出）
 */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
