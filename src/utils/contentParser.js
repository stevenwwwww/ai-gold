/**
 * AI 回复内容解析器
 * 增强容错：支持多种 JSON 格式变体、超长内容、嵌套反引号等边界情况
 */

/**
 * 查找所有 ```chart ... ``` 和 ```table ... ``` 代码块
 * 使用手动扫描而非正则，避免惰性匹配在复杂 JSON 内容中提前断开
 */
function findCodeBlocks(text) {
  const blocks = []
  const openPattern = /```(chart|table)\s*\n?/g
  let m

  while ((m = openPattern.exec(text)) !== null) {
    const type = m[1]
    const contentStart = m.index + m[0].length

    // 从 contentStart 开始，找到独立的 ``` 结束标记
    // 需要跳过 JSON 内容中可能出现的反引号
    let closeIdx = -1
    let searchFrom = contentStart
    while (searchFrom < text.length) {
      const idx = text.indexOf('```', searchFrom)
      if (idx === -1) break

      // 确认这个 ``` 不在 JSON 字符串值内部（简单启发式：前面不是反斜杠）
      if (idx > 0 && text[idx - 1] === '\\') {
        searchFrom = idx + 3
        continue
      }
      closeIdx = idx
      break
    }

    if (closeIdx > contentStart) {
      blocks.push({
        type,
        raw: text.slice(contentStart, closeIdx),
        start: m.index,
        end: closeIdx + 3,
      })
      openPattern.lastIndex = closeIdx + 3
    }
  }

  return blocks
}

/**
 * 尝试修复并解析 JSON
 * 支持：尾逗号、单引号、换行、不完整JSON的自动补全
 */
function tryParseJSON(raw) {
  let cleaned = raw
    .trim()
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/'/g, '"')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\t/g, ' ')

  // 直接尝试解析
  try {
    return JSON.parse(cleaned)
  } catch { /* continue */ }

  // 提取最外层 { ... } 对象
  const firstBrace = cleaned.indexOf('{')
  if (firstBrace === -1) return null
  cleaned = cleaned.slice(firstBrace)

  try {
    return JSON.parse(cleaned)
  } catch { /* continue */ }

  // 尝试自动补全截断的 JSON（AI 可能因 token 限制未输出完整）
  const repaired = autoRepairJSON(cleaned)
  if (repaired) {
    try {
      return JSON.parse(repaired)
    } catch { /* continue */ }
  }

  return null
}

/**
 * 自动补全截断的 JSON：补齐缺失的 ] 和 }
 */
function autoRepairJSON(str) {
  let inString = false
  let escape = false
  const stack = []

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}') { if (stack.length && stack[stack.length - 1] === '{') stack.pop() }
    else if (ch === ']') { if (stack.length && stack[stack.length - 1] === '[') stack.pop() }
  }

  if (stack.length === 0) return null

  // 如果截断在字符串中间，先闭合字符串
  let suffix = inString ? '"' : ''
  // 补齐缺失的括号
  while (stack.length) {
    const open = stack.pop()
    suffix += open === '{' ? '}' : ']'
  }

  // 处理尾部逗号
  let trimmed = str.replace(/,\s*$/, '')
  return trimmed + suffix
}

function validateChart(data) {
  if (!data || !Array.isArray(data.data) || data.data.length === 0) return false
  if (data.data.some((d) => typeof d !== 'number')) return false
  return true
}

function validateTable(data) {
  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.data)) return false
  if (data.columns.length === 0 || data.data.length === 0) return false
  if (!data.columns.every((c) => c.key && c.title)) return false
  return true
}

/**
 * 限制 table 列数，过多列在小屏幕上会挤压
 * 保留前 4 列，避免溢出
 */
function trimTableColumns(data, maxCols = 4) {
  if (!data || !data.columns || data.columns.length <= maxCols) return data
  const kept = data.columns.slice(0, maxCols)
  const keptKeys = new Set(kept.map((c) => c.key))
  return {
    ...data,
    columns: kept,
    data: data.data.map((row) => {
      const r = {}
      for (const k of keptKeys) r[k] = row[k]
      return r
    }),
  }
}

export function parseContent(text) {
  if (!text) return [{ type: 'text', content: '' }]

  const blocks = findCodeBlocks(text)
  if (blocks.length === 0) {
    return [{ type: 'text', content: text }]
  }

  const segments = []
  let lastIndex = 0

  for (const block of blocks) {
    if (block.start > lastIndex) {
      const before = text.slice(lastIndex, block.start).trim()
      if (before) segments.push({ type: 'text', content: before })
    }

    const parsed = tryParseJSON(block.raw)

    if (block.type === 'chart' && parsed && validateChart(parsed)) {
      if (parsed.labels && parsed.labels.length !== parsed.data.length) {
        parsed.labels = parsed.data.map((_, i) => parsed.labels?.[i] || `${i + 1}`)
      }
      segments.push({ type: 'chart', data: parsed })
    } else if (block.type === 'table' && parsed && validateTable(parsed)) {
      segments.push({ type: 'table', data: trimTableColumns(parsed) })
    } else {
      // 解析失败时不显示原始 JSON，而是给出提示
      console.warn('[contentParser] Failed to parse block:', block.type, block.raw.slice(0, 200))
      segments.push({ type: 'text', content: `[${block.type === 'table' ? '表格' : '图表'}数据加载失败]` })
    }

    lastIndex = block.end
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
