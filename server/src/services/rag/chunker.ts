/**
 * 智能分块器 — 支持 text / table / chart 三种内容类型
 *
 * 改造背景：
 *   旧版分块器只做纯文本段落拆分，表格变成乱序文字，图表完全丢失。
 *   新版支持类型感知分块：
 *     - text:  按自然段落拆分 + 滑动窗口
 *     - table: 整个表格保持为一个 chunk（转 Markdown 格式），不切割
 *     - chart: 图表描述 + 数据点作为一个 chunk
 *
 * 输入来源：
 *   - 如果有结构化内容（Qwen-VL 视觉识别结果）→ 按类型分块
 *   - 如果只有纯文本（pdf-parse 兜底结果）→ 退回旧的段落分块逻辑
 *
 * 为什么不用 LangChain：减少依赖，研报文本结构相对规整，手写分块效果更可控
 */

import type { VisionParseResult, TableSection, ChartSection } from '../visionService'

/** 带类型标记的分块 */
export interface TypedChunk {
  id: number
  text: string
  type: 'text' | 'table' | 'chart'
  startOffset: number
  endOffset: number
  metadata?: Record<string, unknown>
}

export interface ChunkerOptions {
  maxChunkSize?: number
  overlapSize?: number
  minChunkSize?: number
}

/**
 * 智能分块入口：根据是否有结构化内容选择分块策略
 *
 * @param rawText            - pdf-parse 提取的纯文本
 * @param structuredContent  - Qwen-VL 提取的结构化内容（可选）
 * @param opts               - 分块参数
 */
export function chunkText(
  rawText: string,
  opts: ChunkerOptions = {},
  structuredContent?: Record<string, unknown> | null
): TypedChunk[] {
  // 有结构化内容时使用类型感知分块
  if (structuredContent && isVisionResult(structuredContent)) {
    return chunkStructured(structuredContent as unknown as VisionParseResult, opts)
  }
  // 退回纯文本段落分块
  return chunkPlainText(rawText, opts)
}

/**
 * 结构化内容分块：遍历每页的 sections，按类型生成分块
 */
function chunkStructured(vision: VisionParseResult, opts: ChunkerOptions): TypedChunk[] {
  const maxSize = opts.maxChunkSize ?? 800
  const overlap = opts.overlapSize ?? 200
  const minSize = opts.minChunkSize ?? 50

  const chunks: TypedChunk[] = []
  let chunkId = 0
  let globalOffset = 0

  for (const page of vision.pages) {
    let textBuffer = ''

    for (const section of page.sections) {
      switch (section.type) {
        case 'text': {
          textBuffer += (textBuffer ? '\n' : '') + section.content
          // 当累积文本达到阈值，flush 为一个 text chunk
          if (textBuffer.length >= maxSize) {
            const textChunks = splitTextChunks(textBuffer, maxSize, overlap, minSize, chunkId, globalOffset)
            chunks.push(...textChunks)
            chunkId += textChunks.length
            globalOffset += textBuffer.length
            textBuffer = ''
          }
          break
        }

        case 'table': {
          // flush 前面积累的文本
          if (textBuffer.length >= minSize) {
            const textChunks = splitTextChunks(textBuffer, maxSize, overlap, minSize, chunkId, globalOffset)
            chunks.push(...textChunks)
            chunkId += textChunks.length
            globalOffset += textBuffer.length
            textBuffer = ''
          }

          // 表格作为独立 chunk，转 Markdown 格式
          const tableText = tableToMarkdown(section as TableSection)
          chunks.push({
            id: chunkId++,
            text: tableText,
            type: 'table',
            startOffset: globalOffset,
            endOffset: globalOffset + tableText.length,
            metadata: {
              title: (section as TableSection).title,
              headers: (section as TableSection).headers,
              rowCount: (section as TableSection).rows.length,
            },
          })
          globalOffset += tableText.length
          break
        }

        case 'chart': {
          // flush 前面积累的文本
          if (textBuffer.length >= minSize) {
            const textChunks = splitTextChunks(textBuffer, maxSize, overlap, minSize, chunkId, globalOffset)
            chunks.push(...textChunks)
            chunkId += textChunks.length
            globalOffset += textBuffer.length
            textBuffer = ''
          }

          // 图表作为独立 chunk
          const chartText = chartToText(section as ChartSection)
          chunks.push({
            id: chunkId++,
            text: chartText,
            type: 'chart',
            startOffset: globalOffset,
            endOffset: globalOffset + chartText.length,
            metadata: {
              chartType: (section as ChartSection).chartType,
              title: (section as ChartSection).title,
              dataPoints: (section as ChartSection).dataPoints,
            },
          })
          globalOffset += chartText.length
          break
        }
      }
    }

    // flush 页面剩余文本
    if (textBuffer.length >= minSize) {
      const textChunks = splitTextChunks(textBuffer, maxSize, overlap, minSize, chunkId, globalOffset)
      chunks.push(...textChunks)
      chunkId += textChunks.length
      globalOffset += textBuffer.length
    }
  }

  return chunks
}

/**
 * 纯文本分块：段落拆分 + 滑动窗口（兼容旧逻辑）
 */
function chunkPlainText(text: string, opts: ChunkerOptions): TypedChunk[] {
  const maxSize = opts.maxChunkSize ?? 800
  const overlap = opts.overlapSize ?? 200
  const minSize = opts.minChunkSize ?? 50

  const rawParagraphs = text.split(/\n{2,}/)
  const merged: string[] = []
  let buf = ''

  for (const p of rawParagraphs) {
    const trimmed = p.trim()
    if (!trimmed) continue
    if (buf.length + trimmed.length < minSize) {
      buf += (buf ? '\n' : '') + trimmed
    } else {
      if (buf) merged.push(buf)
      buf = trimmed
    }
  }
  if (buf) merged.push(buf)

  const chunks: TypedChunk[] = []
  let globalOffset = 0
  let chunkId = 0

  for (const para of merged) {
    if (para.length <= maxSize) {
      const start = text.indexOf(para, globalOffset)
      chunks.push({
        id: chunkId++,
        text: para,
        type: 'text',
        startOffset: start >= 0 ? start : globalOffset,
        endOffset: (start >= 0 ? start : globalOffset) + para.length,
      })
      if (start >= 0) globalOffset = start + para.length
    } else {
      let pos = 0
      while (pos < para.length) {
        const end = Math.min(pos + maxSize, para.length)
        const slice = para.slice(pos, end)
        const absStart = text.indexOf(slice, globalOffset)
        chunks.push({
          id: chunkId++,
          text: slice,
          type: 'text',
          startOffset: absStart >= 0 ? absStart : globalOffset,
          endOffset: (absStart >= 0 ? absStart : globalOffset) + slice.length,
        })
        pos += maxSize - overlap
        if (pos >= para.length) break
      }
      globalOffset += para.length
    }
  }

  return chunks
}

/* ========== 工具函数 ========== */

/** 将文本拆分为多个 chunk（滑动窗口） */
function splitTextChunks(
  text: string, maxSize: number, overlap: number, _minSize: number,
  startId: number, globalOffset: number
): TypedChunk[] {
  const chunks: TypedChunk[] = []
  if (text.length <= maxSize) {
    chunks.push({
      id: startId,
      text,
      type: 'text',
      startOffset: globalOffset,
      endOffset: globalOffset + text.length,
    })
    return chunks
  }

  let pos = 0
  let id = startId
  while (pos < text.length) {
    const end = Math.min(pos + maxSize, text.length)
    chunks.push({
      id: id++,
      text: text.slice(pos, end),
      type: 'text',
      startOffset: globalOffset + pos,
      endOffset: globalOffset + end,
    })
    pos += maxSize - overlap
    if (pos >= text.length) break
  }
  return chunks
}

/** 表格 section → Markdown 表格文本 */
function tableToMarkdown(table: TableSection): string {
  const parts: string[] = []
  if (table.title) parts.push(`**${table.title}**\n`)
  if (table.headers.length > 0) {
    parts.push('| ' + table.headers.join(' | ') + ' |')
    parts.push('| ' + table.headers.map(() => '---').join(' | ') + ' |')
    for (const row of table.rows) {
      parts.push('| ' + row.join(' | ') + ' |')
    }
  }
  return parts.join('\n')
}

/** 图表 section → 结构化描述文本 */
function chartToText(chart: ChartSection): string {
  const parts: string[] = [
    `[图表: ${chart.title}] (类型: ${chart.chartType})`,
    chart.description,
  ]
  if (chart.dataPoints.length > 0) {
    parts.push('数据: ' + chart.dataPoints.map((dp) => `${dp.label}=${dp.value}`).join(', '))
  }
  return parts.join('\n')
}

/** 判断对象是否为 VisionParseResult 结构 */
function isVisionResult(obj: Record<string, unknown>): boolean {
  return Array.isArray(obj.pages) && typeof obj.totalPages === 'number'
}
