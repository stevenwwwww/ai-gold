/**
 * 研报存储服务 - CRUD，持久化到 SQLite
 * 对外暴露干净的接口，隔离 DB 实现
 */
import { v4 as uuid } from 'uuid'
import { getDb } from '../db'

/* ---------- Types ---------- */
export interface Report {
  id: string
  title: string
  source: 'pdf' | 'text'
  rawText: string
  pages: number
  summary: Record<string, unknown> | null
  createdAt: number
  updatedAt: number
}

export interface CreateReportInput {
  title: string
  source: 'pdf' | 'text'
  rawText: string
  pages?: number
  summary?: Record<string, unknown>
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
  db.prepare(`
    INSERT INTO reports (id, title, source, raw_text, pages, summary_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.title, input.source, input.rawText,
    input.pages ?? 0,
    input.summary ? JSON.stringify(input.summary) : null,
    now, now
  )
  return {
    id, title: input.title, source: input.source,
    rawText: input.rawText, pages: input.pages ?? 0,
    summary: input.summary ?? null,
    createdAt: now, updatedAt: now
  }
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
  return {
    id: String(row.id),
    title: String(row.title),
    source: String(row.source) as 'pdf' | 'text',
    rawText: String(row.raw_text),
    pages: Number(row.pages),
    summary,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}
