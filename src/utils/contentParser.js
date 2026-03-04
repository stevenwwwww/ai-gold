/**
 * AI 回复内容解析器
 * 解析回复中的 JSON 数据块，渲染为图表或表格
 * 
 * AI 回复中嵌入结构化数据格式：
 * ```chart
 * { "title": "...", "data": [1,2,3], "labels": ["a","b","c"], "color": "auto" }
 * ```
 * 
 * ```table
 * { "title": "...", "columns": [...], "data": [...] }
 * ```
 */

const CHART_REGEX = /```chart\s*\n([\s\S]*?)```/g
const TABLE_REGEX = /```table\s*\n([\s\S]*?)```/g

export function parseContent(text) {
  if (!text) return [{ type: 'text', content: text || '' }]

  const segments = []
  let lastIndex = 0
  const allMatches = []

  let m
  const chartRe = new RegExp(CHART_REGEX.source, 'g')
  while ((m = chartRe.exec(text)) !== null) {
    allMatches.push({ index: m.index, end: m.index + m[0].length, type: 'chart', raw: m[1] })
  }

  const tableRe = new RegExp(TABLE_REGEX.source, 'g')
  while ((m = tableRe.exec(text)) !== null) {
    allMatches.push({ index: m.index, end: m.index + m[0].length, type: 'table', raw: m[1] })
  }

  allMatches.sort((a, b) => a.index - b.index)

  if (allMatches.length === 0) {
    return [{ type: 'text', content: text }]
  }

  for (const match of allMatches) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }

    try {
      const parsed = JSON.parse(match.raw.trim())
      segments.push({ type: match.type, data: parsed })
    } catch {
      segments.push({ type: 'text', content: match.raw })
    }

    lastIndex = match.end
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return segments
}
