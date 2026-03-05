/**
 * 向量存储 — SQLite + 内存混合方案
 *
 * 为什么不用 Pinecone / Milvus / Chroma：
 *   - 本项目定位私有化部署、零外部依赖
 *   - 单份研报分块数量 < 500，余弦检索毫秒级
 *   - Embedding 向量持久化到 SQLite（BLOB），启动时按需加载到内存
 *
 * 检索流程：
 *   1. 用户提问 → 生成 query embedding
 *   2. 从内存中取该 report 的所有 chunk embedding
 *   3. 余弦相似度排序 → 返回 Top-K chunks
 *
 * v2 新增：
 *   - chunk_type 字段（text/table/chart），支持类型感知分块
 *   - metadata JSON 字段，存储表格表头、图表数据等扩展信息
 *   - searchMultipleReports()：多研报联合检索
 *   - getChunksByType()：按类型筛选检索
 */
import { getDb } from '../../db'
import { v4 as uuid } from 'uuid'

export interface VectorChunk {
  id: string
  reportId: string
  chunkIndex: number
  text: string
  embedding: number[]
  chunkType: 'text' | 'table' | 'chart'
  metadata?: Record<string, unknown>
}

/** 内存缓存：reportId → chunks */
const memoryCache = new Map<string, VectorChunk[]>()

/**
 * 确保 report_chunks 表存在（含新字段）
 * 幂等操作，每次调用安全
 */
export function ensureVectorTable(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_chunks (
      id           TEXT PRIMARY KEY,
      report_id    TEXT NOT NULL,
      chunk_index  INTEGER NOT NULL,
      text         TEXT NOT NULL,
      embedding    BLOB NOT NULL,
      chunk_type   TEXT NOT NULL DEFAULT 'text',
      metadata     TEXT,
      created_at   INTEGER NOT NULL,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_report ON report_chunks(report_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_type ON report_chunks(report_id, chunk_type);
  `)
}

/**
 * 保存分块及其向量到数据库和内存缓存
 * 先清除旧数据再写入（支持重建索引）
 */
export function saveChunks(
  reportId: string,
  chunks: Array<{
    text: string
    embedding: number[]
    chunkType?: 'text' | 'table' | 'chart'
    metadata?: Record<string, unknown>
  }>
): void {
  const db = getDb()
  ensureVectorTable()

  db.prepare('DELETE FROM report_chunks WHERE report_id = ?').run(reportId)

  const insert = db.prepare(`
    INSERT INTO report_chunks (id, report_id, chunk_index, text, embedding, chunk_type, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const now = Date.now()
  const saved: VectorChunk[] = []

  const tx = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const id = uuid()
      const embBuf = Buffer.from(new Float32Array(chunks[i].embedding).buffer)
      const chunkType = chunks[i].chunkType || 'text'
      const metaStr = chunks[i].metadata ? JSON.stringify(chunks[i].metadata) : null
      insert.run(id, reportId, i, chunks[i].text, embBuf, chunkType, metaStr, now)
      saved.push({
        id, reportId, chunkIndex: i,
        text: chunks[i].text,
        embedding: chunks[i].embedding,
        chunkType,
        metadata: chunks[i].metadata,
      })
    }
  })
  tx()

  memoryCache.set(reportId, saved)
  console.log(`[VectorStore] 存储 ${chunks.length} 个分块 for report ${reportId.slice(0, 8)}`)
}

/**
 * 获取某研报的所有分块（优先内存缓存）
 */
export function getChunks(reportId: string): VectorChunk[] {
  if (memoryCache.has(reportId)) return memoryCache.get(reportId)!

  const db = getDb()
  ensureVectorTable()

  const rows = db.prepare('SELECT * FROM report_chunks WHERE report_id = ? ORDER BY chunk_index ASC')
    .all(reportId) as Array<{
      id: string; report_id: string; chunk_index: number; text: string
      embedding: Buffer; chunk_type: string; metadata: string | null
    }>

  const chunks: VectorChunk[] = rows.map((r) => ({
    id: r.id,
    reportId: r.report_id,
    chunkIndex: r.chunk_index,
    text: r.text,
    embedding: Array.from(new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4)),
    chunkType: (r.chunk_type || 'text') as 'text' | 'table' | 'chart',
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  }))

  if (chunks.length > 0) memoryCache.set(reportId, chunks)
  return chunks
}

/**
 * 按类型获取分块（用于前端展示表格/图表）
 */
export function getChunksByType(
  reportId: string,
  type: 'text' | 'table' | 'chart'
): VectorChunk[] {
  return getChunks(reportId).filter((c) => c.chunkType === type)
}

/** 检查某研报是否已有分块 */
export function hasChunks(reportId: string): boolean {
  if (memoryCache.has(reportId)) return true
  const db = getDb()
  ensureVectorTable()
  const row = db.prepare('SELECT COUNT(*) as cnt FROM report_chunks WHERE report_id = ?')
    .get(reportId) as { cnt: number }
  return row.cnt > 0
}

/** 删除某研报的所有分块 */
export function deleteChunks(reportId: string): void {
  const db = getDb()
  ensureVectorTable()
  db.prepare('DELETE FROM report_chunks WHERE report_id = ?').run(reportId)
  memoryCache.delete(reportId)
}

/**
 * 余弦相似度计算
 * 用于 query embedding 和 chunk embedding 之间的相似度排序
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * 单研报检索 — 在一份研报中查找最相关的 Top-K 分块
 */
export function searchChunks(
  reportId: string,
  queryEmbedding: number[],
  topK = 5
): { chunk: VectorChunk; score: number }[] {
  const chunks = getChunks(reportId)
  if (chunks.length === 0) return []

  const scored = chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }))

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}

/**
 * 多研报联合检索 — 跨多份研报查找最相关的 Top-K 分块
 *
 * 用途：用户选择多份研报进行对比分析时，统一检索最相关的片段
 * 返回结果包含 reportId 标识来源，便于前端展示来源引用
 *
 * @param reportIds      - 要检索的研报 ID 列表
 * @param queryEmbedding - 用户问题的 embedding 向量
 * @param topK           - 返回的最相关分块数量
 */
export function searchMultipleReports(
  reportIds: string[],
  queryEmbedding: number[],
  topK = 10
): { chunk: VectorChunk; score: number }[] {
  const allScored: { chunk: VectorChunk; score: number }[] = []

  for (const rid of reportIds) {
    const chunks = getChunks(rid)
    for (const chunk of chunks) {
      allScored.push({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      })
    }
  }

  allScored.sort((a, b) => b.score - a.score)
  return allScored.slice(0, topK)
}
