/**
 * AI 回复内容解析器
 * 增强容错：支持多种 JSON 格式变体
 */

const BLOCK_REGEX = /```(chart|table)\s*\n?([\s\S]*?)```/g

function tryParseJSON(raw) {
  const cleaned = raw
    .trim()
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/'/g, '"')
    .replace(/\n/g, ' ')

  try {
    return JSON.parse(cleaned)
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]) } catch { /* skip */ }
    }
    return null
  }
}

function validateChart(data) {
  if (!data || !Array.isArray(data.data) || data.data.length === 0) return false
  if (data.data.some((d) => typeof d !== 'number')) return false
  return true
}

function validateTable(data) {
  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.data)) return false
  if (data.columns.length === 0 || data.data.length === 0) return false
  if (!data.columns[0].key || !data.columns[0].title) return false
  return true
}

export function parseContent(text) {
  if (!text) return [{ type: 'text', content: '' }]

  const segments = []
  let lastIndex = 0
  const re = new RegExp(BLOCK_REGEX.source, 'g')
  let match

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim()
      if (before) segments.push({ type: 'text', content: before })
    }

    const type = match[1]
    const raw = match[2]
    const parsed = tryParseJSON(raw)

    if (type === 'chart' && parsed && validateChart(parsed)) {
      if (parsed.labels && parsed.labels.length !== parsed.data.length) {
        parsed.labels = parsed.data.map((_, i) => parsed.labels?.[i] || `${i + 1}`)
      }
      segments.push({ type: 'chart', data: parsed })
    } else if (type === 'table' && parsed && validateTable(parsed)) {
      segments.push({ type: 'table', data: parsed })
    } else {
      segments.push({ type: 'text', content: raw })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim()
    if (remaining) segments.push({ type: 'text', content: remaining })
  }

  if (segments.length === 0) {
    return [{ type: 'text', content: text }]
  }

  return segments
}
