/**
 * RAG 服务入口 — 串联 chunker → embedder → vectorStore → retrieval
 *
 * 对外暴露核心方法：
 *   1. indexReport()         — 解析后调用，建立索引（支持结构化内容）
 *   2. retrieveContext()     — 单研报检索
 *   3. retrieveMultiContext() — 多研报联合检索
 *   4. ensureIndexed()       — 确保已索引
 *
 * v2 改动：
 *   - indexReport 支持传入 structuredContent（Qwen-VL 视觉结果）
 *   - 分块时保留 chunk_type（text/table/chart）
 *   - 新增 retrieveMultiContext 用于多研报对比
 */
import { chunkText, type TypedChunk } from './chunker'
import { getEmbeddings, getEmbedding } from './embedder'
import {
  saveChunks, searchChunks, searchMultipleReports,
  hasChunks, deleteChunks, getChunksByType,
} from './vectorStore'

export { hasChunks, deleteChunks, getChunksByType } from './vectorStore'

/**
 * 为研报建立向量索引
 *
 * 流程:
 *   1. 智能分块（如果有结构化内容则按类型分块，否则纯文本段落分块）
 *   2. 批量生成 Embedding 向量
 *   3. 存入 SQLite + 内存缓存
 *
 * @param reportId          - 研报 ID
 * @param rawText           - pdf-parse 提取的纯文本
 * @param structuredContent - Qwen-VL 视觉解析的结构化内容（可选）
 * @returns 分块数量
 */
export async function indexReport(
  reportId: string,
  rawText: string,
  structuredContent?: Record<string, unknown> | null
): Promise<number> {
  console.log(`[RAG] 开始为 report ${reportId.slice(0, 8)} 建立索引...`)

  const chunks: TypedChunk[] = chunkText(rawText, { maxChunkSize: 800, overlapSize: 200 }, structuredContent)
  if (chunks.length === 0) {
    console.warn('[RAG] 研报文本为空，跳过索引')
    return 0
  }

  const typeStats = {
    text: chunks.filter((c) => c.type === 'text').length,
    table: chunks.filter((c) => c.type === 'table').length,
    chart: chunks.filter((c) => c.type === 'chart').length,
  }
  console.log(`[RAG] 分块完成: ${chunks.length} 个块 (text=${typeStats.text}, table=${typeStats.table}, chart=${typeStats.chart})`)

  const texts = chunks.map((c) => c.text)
  const embeddings = await getEmbeddings(texts)

  const data = chunks.map((c, i) => ({
    text: c.text,
    embedding: embeddings[i],
    chunkType: c.type,
    metadata: c.metadata,
  }))

  saveChunks(reportId, data)
  console.log(`[RAG] 索引完成: ${chunks.length} 个块已存储`)
  return chunks.length
}

/**
 * 单研报检索 — 检索与用户问题最相关的片段
 * 返回合并后的上下文文本（带来源标注和类型标记）
 */
export async function retrieveContext(
  reportId: string,
  query: string,
  topK = 5
): Promise<{
  context: string
  sources: Array<{ chunkIndex: number; score: number; text: string; chunkType: string }>
}> {
  if (!hasChunks(reportId)) {
    return { context: '', sources: [] }
  }

  const queryEmb = await getEmbedding(query)
  const results = searchChunks(reportId, queryEmb, topK)

  const sources = results.map((r) => ({
    chunkIndex: r.chunk.chunkIndex,
    score: Math.round(r.score * 1000) / 1000,
    text: r.chunk.text,
    chunkType: r.chunk.chunkType,
  }))

  const context = results
    .map((r, i) => {
      const typeLabel = r.chunk.chunkType === 'table' ? '[表格]'
        : r.chunk.chunkType === 'chart' ? '[图表]' : '[文本]'
      return `[片段${i + 1}] ${typeLabel} (相关度: ${(r.score * 100).toFixed(1)}%)\n${r.chunk.text}`
    })
    .join('\n\n---\n\n')

  return { context, sources }
}

/**
 * 多研报联合检索 — 跨多份研报查找最相关的 Top-K 片段
 *
 * 用途：多研报对比分析、同一只股票不同机构观点汇总
 * 返回结果包含 reportId 标识来源
 */
export async function retrieveMultiContext(
  reportIds: string[],
  query: string,
  topK = 10
): Promise<{
  context: string
  sources: Array<{
    reportId: string; chunkIndex: number; score: number; text: string; chunkType: string
  }>
}> {
  const validIds = reportIds.filter((id) => hasChunks(id))
  if (validIds.length === 0) {
    return { context: '', sources: [] }
  }

  const queryEmb = await getEmbedding(query)
  const results = searchMultipleReports(validIds, queryEmb, topK)

  const sources = results.map((r) => ({
    reportId: r.chunk.reportId,
    chunkIndex: r.chunk.chunkIndex,
    score: Math.round(r.score * 1000) / 1000,
    text: r.chunk.text,
    chunkType: r.chunk.chunkType,
  }))

  const context = results
    .map((r, i) => {
      const typeLabel = r.chunk.chunkType === 'table' ? '[表格]'
        : r.chunk.chunkType === 'chart' ? '[图表]' : '[文本]'
      return `[片段${i + 1}] ${typeLabel} (来源: report-${r.chunk.reportId.slice(0, 6)}, 相关度: ${(r.score * 100).toFixed(1)}%)\n${r.chunk.text}`
    })
    .join('\n\n---\n\n')

  return { context, sources }
}

/** 确保研报已建立索引 */
export async function ensureIndexed(
  reportId: string,
  rawText: string,
  structuredContent?: Record<string, unknown> | null
): Promise<void> {
  if (!hasChunks(reportId)) {
    await indexReport(reportId, rawText, structuredContent)
  }
}
