/**
 * 多模态 LLM 服务 — 封装 Qwen-VL 视觉模型调用
 *
 * 功能：将 PDF 页面图片发送给 Qwen-VL，提取结构化内容
 * 输出：每页的文本段落、表格（headers + rows）、图表（类型 + 数据 + 描述）
 *
 * 调用链路：
 *   PDF Buffer → pdfImageService.pdfToImages() → 本服务.extractPageContent()
 *                                               → Qwen-VL API
 *                                               → 结构化 JSON
 *
 * 技术细节：
 *   - 使用 DashScope OpenAI 兼容接口（和 Qwen 文本模型同一个端点）
 *   - content 字段支持多模态：[{ type: "image_url", ... }, { type: "text", ... }]
 *   - 模型：qwen-vl-max（精度最高）或 qwen-vl-plus（成本更低）
 *   - 同一个 QWEN_API_KEY，无需额外密钥
 *
 * 成本：
 *   - qwen-vl-max 约 0.003 元/千 token
 *   - 单页约 2000 token = 0.006 元
 *   - 20 页研报约 0.12 元（完全可接受）
 */

import { config } from '../config'
import type { PageImage } from './pdfImageService'

/* ========== 类型定义 ========== */

/** 文本段落 */
export interface TextSection {
  type: 'text'
  content: string
}

/** 表格：带标题、表头和数据行 */
export interface TableSection {
  type: 'table'
  title: string
  headers: string[]
  rows: string[][]
}

/** 图表：类型 + 标题 + 语义描述 + 数据点 */
export interface ChartSection {
  type: 'chart'
  chartType: 'bar' | 'line' | 'pie' | 'other'
  title: string
  description: string
  dataPoints: Array<{ label: string; value: number | string }>
}

export type PageSection = TextSection | TableSection | ChartSection

/** 单页结构化内容 */
export interface PageContent {
  pageNumber: number
  sections: PageSection[]
}

/** 整份 PDF 的视觉解析结果 */
export interface VisionParseResult {
  pages: PageContent[]
  totalPages: number
  processedPages: number
  errors: Array<{ pageIndex: number; error: string }>
}

/* ========== 常量 ========== */

const VL_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

/**
 * 逐页提取的核心 prompt
 * 要求 VL 模型输出严格的 JSON 格式，包含 text / table / chart 三种内容类型
 */
const PAGE_EXTRACT_PROMPT = `你是一个专业的金融研报内容提取助手。请仔细分析这一页研报图片，提取所有内容。

【输出要求】严格按以下 JSON 格式输出，不要输出任何其他文字：

{
  "pageNumber": 1,
  "sections": [
    { "type": "text", "content": "段落文本内容..." },
    {
      "type": "table",
      "title": "表格标题（如有）",
      "headers": ["列名1", "列名2", "列名3"],
      "rows": [["数据1", "数据2", "数据3"], ["数据4", "数据5", "数据6"]]
    },
    {
      "type": "chart",
      "chartType": "bar",
      "title": "图表标题",
      "description": "图表展示了XXX的趋势，从X到Y呈上升/下降趋势",
      "dataPoints": [{"label": "2022", "value": 100}, {"label": "2023", "value": 150}]
    }
  ]
}

【关键规则】
1. 表格必须完整提取所有行列，不要遗漏任何数据
2. 图表必须尽量读取具体数值，如果看不清就给出近似值
3. chartType 只能是 bar / line / pie / other 之一
4. 纯文本段落按自然段拆分
5. 保持原文内容的准确性，不要添加或修改信息
6. 如果页面为空或无法识别，返回空的 sections 数组`

/* ========== 核心功能 ========== */

/**
 * 对单页 PDF 图片调用 Qwen-VL，提取结构化内容
 *
 * @param image      - 单页 PNG 图片（base64 编码）
 * @param pageNumber - 页码（用于输出标识）
 * @returns 该页的结构化内容，包含文本/表格/图表
 */
export async function extractPageContent(
  image: PageImage,
  pageNumber: number
): Promise<PageContent> {
  const apiKey = config.qwenApiKey
  if (!apiKey) throw new Error('未配置 QWEN_API_KEY，无法调用 Qwen-VL')

  const vlModel = config.vlModel || 'qwen-vl-max'

  const body = {
    model: vlModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${image.base64}` },
          },
          { type: 'text', text: PAGE_EXTRACT_PROMPT.replace('"pageNumber": 1', `"pageNumber": ${pageNumber}`) },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.llmTimeout || 120_000)

  try {
    const res = await fetch(VL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Qwen-VL HTTP ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data?.choices?.[0]?.message?.content ?? ''

    return parseVLResponse(content, pageNumber)
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Qwen-VL 请求超时 (page ${pageNumber})`)
    }
    throw err
  }
}

/**
 * 批量处理整份 PDF 的所有页面
 *
 * 策略：
 *   - 串行处理每一页（避免并发过高被限流）
 *   - 单页失败不影响其他页面
 *   - 记录每页的错误信息，调用方可查看
 *
 * @param images - pdfToImages() 返回的页面图片数组
 * @returns 完整的视觉解析结果
 */
export async function extractAllPages(images: PageImage[]): Promise<VisionParseResult> {
  const result: VisionParseResult = {
    pages: [],
    totalPages: images.length,
    processedPages: 0,
    errors: [],
  }

  for (const img of images) {
    const pageNum = img.pageIndex + 1
    try {
      console.log(`[Vision] 正在识别第 ${pageNum}/${images.length} 页...`)
      const content = await extractPageContent(img, pageNum)
      result.pages.push(content)
      result.processedPages++
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn(`[Vision] 第 ${pageNum} 页识别失败: ${errMsg}`)
      result.errors.push({ pageIndex: img.pageIndex, error: errMsg })
      // 失败的页面用空内容占位
      result.pages.push({ pageNumber: pageNum, sections: [] })
    }
  }

  console.log(
    `[Vision] 识别完成: ${result.processedPages}/${result.totalPages} 页成功` +
    (result.errors.length > 0 ? `, ${result.errors.length} 页失败` : '')
  )

  return result
}

/* ========== 内部工具函数 ========== */

/**
 * 解析 Qwen-VL 返回的文本，提取 JSON 结构
 * VL 模型有时会在 JSON 前后加上 ```json 标记或解释文字，需要容错处理
 */
function parseVLResponse(raw: string, pageNumber: number): PageContent {
  const fallback: PageContent = { pageNumber, sections: [] }

  if (!raw || !raw.trim()) return fallback

  // 尝试提取 JSON 块：先找 ```json ... ``` 包裹的，再找最外层 { ... }
  let jsonStr = raw
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1]
  } else {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) jsonStr = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr)

    // 校验并规范化 sections 数组
    const sections: PageSection[] = []
    if (Array.isArray(parsed.sections)) {
      for (const s of parsed.sections) {
        if (s.type === 'text' && typeof s.content === 'string') {
          sections.push({ type: 'text', content: s.content })
        } else if (s.type === 'table') {
          sections.push({
            type: 'table',
            title: String(s.title || ''),
            headers: Array.isArray(s.headers) ? s.headers.map(String) : [],
            rows: Array.isArray(s.rows) ? s.rows.map((r: unknown[]) => (Array.isArray(r) ? r.map(String) : [])) : [],
          })
        } else if (s.type === 'chart') {
          sections.push({
            type: 'chart',
            chartType: ['bar', 'line', 'pie', 'other'].includes(s.chartType) ? s.chartType : 'other',
            title: String(s.title || ''),
            description: String(s.description || ''),
            dataPoints: Array.isArray(s.dataPoints)
              ? s.dataPoints.map((dp: Record<string, unknown>) => ({
                  label: String(dp.label || ''),
                  value: dp.value ?? 0,
                }))
              : [],
          })
        }
      }
    }

    return { pageNumber: parsed.pageNumber || pageNumber, sections }
  } catch {
    // JSON 解析失败，将整段文本作为一个 text section 保底
    console.warn(`[Vision] 第 ${pageNumber} 页 JSON 解析失败，降级为纯文本`)
    return {
      pageNumber,
      sections: [{ type: 'text', content: raw.trim() }],
    }
  }
}

/**
 * 将视觉解析结果合并为增强文本
 *
 * 用途：
 *   1. 与 pdf-parse 的纯文本合并，作为 RAG 分块的输入
 *   2. 表格转为 Markdown 表格格式，便于 LLM 理解
 *   3. 图表转为结构化描述文本
 *
 * @param visionResult - extractAllPages() 的返回值
 * @returns 增强后的纯文本（包含 Markdown 表格和图表描述）
 */
export function mergeVisionToText(visionResult: VisionParseResult): string {
  const parts: string[] = []

  for (const page of visionResult.pages) {
    parts.push(`\n--- 第 ${page.pageNumber} 页 ---\n`)

    for (const section of page.sections) {
      switch (section.type) {
        case 'text':
          parts.push(section.content)
          break

        case 'table': {
          if (section.title) parts.push(`\n**${section.title}**\n`)
          if (section.headers.length > 0) {
            parts.push('| ' + section.headers.join(' | ') + ' |')
            parts.push('| ' + section.headers.map(() => '---').join(' | ') + ' |')
            for (const row of section.rows) {
              parts.push('| ' + row.join(' | ') + ' |')
            }
          }
          parts.push('')
          break
        }

        case 'chart': {
          parts.push(`\n**[图表: ${section.title}]** (${section.chartType})`)
          parts.push(section.description)
          if (section.dataPoints.length > 0) {
            parts.push('数据点: ' + section.dataPoints.map((dp) => `${dp.label}=${dp.value}`).join(', '))
          }
          parts.push('')
          break
        }
      }
    }
  }

  return parts.join('\n')
}
