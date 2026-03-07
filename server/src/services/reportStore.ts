/**
 * 研报存储服务 - CRUD，持久化到 SQLite
 * 对外暴露干净的接口，隔离 DB 实现
 */
import { v4 as uuid } from 'uuid'
import { getDb } from '../db'

/* ---------- Types ---------- */
export type ReportStatus = 'pending' | 'parsing' | 'analyzed' | 'error'

export interface Report {
  id: string
  title: string
  source: 'pdf' | 'text'
  rawText: string
  pages: number
  summary: Record<string, unknown> | null
  structuredContent: Record<string, unknown> | null
  status: ReportStatus
  ragflowDocumentId: string | null
  ragflowDatasetId: string | null
  createdAt: number
  updatedAt: number
}

export interface CreateReportInput {
  title: string
  source: 'pdf' | 'text'
  rawText: string
  pages?: number
  summary?: Record<string, unknown>
  structuredContent?: Record<string, unknown>
  status?: ReportStatus
  ragflowDocumentId?: string
  ragflowDatasetId?: string
}

export interface ChatRecord {
  id: string
  reportId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

/* ---------- Report CRUD ---------- */
export function createReport(input: CreateReportInput): Report {
  const db = getDb()
  const id = uuid()
  const now = Date.now()
  const status = input.status ?? 'pending'
  db.prepare(`
    INSERT INTO reports (id, title, source, raw_text, pages, summary_json, structured_content, status, ragflow_document_id, ragflow_dataset_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.title, input.source, input.rawText,
    input.pages ?? 0,
    input.summary ? JSON.stringify(input.summary) : null,
    input.structuredContent ? JSON.stringify(input.structuredContent) : null,
    status,
    input.ragflowDocumentId ?? null,
    input.ragflowDatasetId ?? null,
    now, now
  )
  return {
    id, title: input.title, source: input.source,
    rawText: input.rawText, pages: input.pages ?? 0,
    summary: input.summary ?? null,
    structuredContent: input.structuredContent ?? null,
    status,
    ragflowDocumentId: input.ragflowDocumentId ?? null,
    ragflowDatasetId: input.ragflowDatasetId ?? null,
    createdAt: now, updatedAt: now
  }
}

/** 更新 RAGFlow 关联 ID */
export function updateRagflowIds(
  id: string,
  ragflowDocumentId: string,
  ragflowDatasetId: string
): void {
  const db = getDb()
  db.prepare('UPDATE reports SET ragflow_document_id = ?, ragflow_dataset_id = ?, updated_at = ? WHERE id = ?')
    .run(ragflowDocumentId, ragflowDatasetId, Date.now(), id)
}

export function getReport(id: string): Report | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return rowToReport(row)
}

export function listReports(limit = 50, offset = 0): Report[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM reports ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset) as Record<string, unknown>[]
  return rows.map(rowToReport)
}

export function updateReportSummary(id: string, summary: Record<string, unknown>): void {
  const db = getDb()
  db.prepare('UPDATE reports SET summary_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(summary), Date.now(), id)
}

/** 更新结构化内容（视觉解析结果） */
export function updateStructuredContent(id: string, content: Record<string, unknown>): void {
  const db = getDb()
  db.prepare('UPDATE reports SET structured_content = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(content), Date.now(), id)
}

/** 更新研报状态 */
export function updateReportStatus(id: string, status: ReportStatus): void {
  const db = getDb()
  db.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, Date.now(), id)
}

/** 更新研报标题 */
export function updateReportTitle(id: string, title: string): void {
  const db = getDb()
  db.prepare('UPDATE reports SET title = ?, updated_at = ? WHERE id = ?')
    .run(title.slice(0, 200), Date.now(), id)
}

/** 统计研报数据 */
export function getReportStats(): {
  total: number; analyzed: number; pending: number; avgScore: number; thisMonth: number
} {
  const db = getDb()
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM reports').get() as { cnt: number }).cnt
  const analyzed = (db.prepare("SELECT COUNT(*) as cnt FROM reports WHERE status = 'analyzed'").get() as { cnt: number }).cnt
  const pending = (db.prepare("SELECT COUNT(*) as cnt FROM reports WHERE status = 'pending' OR status = 'parsing'").get() as { cnt: number }).cnt
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const thisMonth = (db.prepare('SELECT COUNT(*) as cnt FROM reports WHERE created_at >= ?').get(monthStart.getTime()) as { cnt: number }).cnt

  const scoreRow = db.prepare(`
    SELECT AVG(json_extract(json_extract(summary_json, '$.deepAnalysis'), '$.summary.score')) as avg
    FROM reports WHERE summary_json IS NOT NULL
  `).get() as { avg: number | null }
  const avgScore = Math.round((scoreRow.avg ?? 0) * 10) / 10

  return { total, analyzed, pending, avgScore, thisMonth }
}

/** 获取研报总数 */
export function countReports(keyword?: string): number {
  const db = getDb()
  if (keyword) {
    const kw = `%${keyword}%`
    return (db.prepare('SELECT COUNT(*) as cnt FROM reports WHERE title LIKE ?').get(kw) as { cnt: number }).cnt
  }
  return (db.prepare('SELECT COUNT(*) as cnt FROM reports').get() as { cnt: number }).cnt
}

/** 带搜索参数的列表查询 */
export function searchReports(opts: {
  keyword?: string; status?: string; limit?: number; offset?: number; sortBy?: string
}): Report[] {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.keyword) {
    conditions.push('title LIKE ?')
    params.push(`%${opts.keyword}%`)
  }
  if (opts.status) {
    conditions.push('status = ?')
    params.push(opts.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = opts.sortBy === 'score'
    ? 'ORDER BY json_extract(json_extract(summary_json, \'$.deepAnalysis\'), \'$.summary.score\') DESC NULLS LAST, updated_at DESC'
    : 'ORDER BY updated_at DESC'
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = Math.max(opts.offset ?? 0, 0)

  const rows = db.prepare(`SELECT * FROM reports ${where} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[]
  return rows.map(rowToReport)
}

export function deleteReport(id: string): boolean {
  const db = getDb()
  const info = db.prepare('DELETE FROM reports WHERE id = ?').run(id)
  return info.changes > 0
}

/* ---------- Chat Records ---------- */
export function addChatRecord(reportId: string, role: 'user' | 'assistant', content: string): ChatRecord {
  const db = getDb()
  const id = uuid()
  const now = Date.now()
  db.prepare(`
    INSERT INTO report_chats (id, report_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, reportId, role, content, now)
  return { id, reportId, role, content, createdAt: now }
}

export function getChatHistory(reportId: string): ChatRecord[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM report_chats WHERE report_id = ? ORDER BY created_at ASC')
    .all(reportId) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: String(r.id),
    reportId: String(r.report_id),
    role: String(r.role) as 'user' | 'assistant',
    content: String(r.content),
    createdAt: Number(r.created_at),
  }))
}

/* ---------- Internal ---------- */
function rowToReport(row: Record<string, unknown>): Report {
  let summary: Record<string, unknown> | null = null
  if (typeof row.summary_json === 'string') {
    try { summary = JSON.parse(row.summary_json) } catch { /* keep null */ }
  }
  let structuredContent: Record<string, unknown> | null = null
  if (typeof row.structured_content === 'string') {
    try { structuredContent = JSON.parse(row.structured_content) } catch { /* keep null */ }
  }
  return {
    id: String(row.id),
    title: String(row.title),
    source: String(row.source) as 'pdf' | 'text',
    rawText: String(row.raw_text),
    pages: Number(row.pages),
    summary,
    structuredContent,
    status: (String(row.status || 'pending')) as ReportStatus,
    ragflowDocumentId: row.ragflow_document_id ? String(row.ragflow_document_id) : null,
    ragflowDatasetId: row.ragflow_dataset_id ? String(row.ragflow_dataset_id) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}
