/**
 * 深度分析服务 - 生成6维度研报分析
 *
 * 6 个维度：
 *   1. 公司概况  2. 行业分析  3. 财务分析
 *   4. 估值分析  5. 总结（评分1-5）  6. 风险提示
 *
 * v2 改动：
 *   - 财务分析输出可绘图的图表数据格式（Chart.js 兼容）
 *   - 当有结构化内容（表格/图表）时注入 prompt，提升分析精度
 *   - 支持 RAG 分块长文档分析
 */
import { chat } from './llmService'
import { config } from '../config'

/* ========== 类型定义 ========== */

/** 图表数据格式（兼容 ECharts / Chart.js） */
export interface ChartData {
  type: 'bar' | 'line' | 'pie'
  title: string
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
  }>
}

export interface DeepAnalysis {
  companyOverview: {
    name: string
    code: string
    industry: string
    mainBusiness: string
    marketCap?: string
    highlights: string[]
  }
  industryAnalysis: {
    industryName: string
    marketSize?: string
    growthRate?: string
    trends: string[]
    competitiveLandscape: string
    companyPosition: string
  }
  financialAnalysis: {
    revenue?: { year: string; value: string }[]
    netProfit?: { year: string; value: string }[]
    grossMargin?: string
    netMargin?: string
    roe?: string
    debtRatio?: string
    highlights: string[]
    concerns: string[]
    revenueChart?: ChartData
    profitChart?: ChartData
  }
  valuationAnalysis: {
    currentPrice?: string
    targetPrice?: string
    pe?: string
    pb?: string
    peg?: string
    valuationMethod?: string
    conclusion: string
  }
  summary: {
    rating: string
    score: number
    coreLogic: string
    catalysts: string[]
    keyPoints: string[]
  }
  riskWarnings: {
    level: 'high' | 'medium' | 'low'
    risks: { category: string; description: string }[]
  }
}

/* ========== Prompt ========== */

const DEEP_ANALYSIS_PROMPT = `你是一位资深证券分析师。请根据以下研报原文，进行深度结构化分析，严格按 JSON 输出，不要输出其他任何文字。

**必须包含以下 6 个维度，缺一不可：**

{
  "companyOverview": {
    "name": "公司名称",
    "code": "股票代码",
    "industry": "所属行业",
    "mainBusiness": "主营业务描述（1-2句话）",
    "marketCap": "市值（如有）",
    "highlights": ["亮点1", "亮点2", "亮点3"]
  },
  "industryAnalysis": {
    "industryName": "行业名称",
    "marketSize": "市场规模（如有）",
    "growthRate": "行业增速（如有）",
    "trends": ["趋势1", "趋势2"],
    "competitiveLandscape": "竞争格局描述",
    "companyPosition": "公司在行业中的地位"
  },
  "financialAnalysis": {
    "revenue": [{"year": "2024E", "value": "100亿"}],
    "netProfit": [{"year": "2024E", "value": "10亿"}],
    "grossMargin": "毛利率",
    "netMargin": "净利率",
    "roe": "ROE",
    "debtRatio": "资产负债率",
    "highlights": ["财务亮点1"],
    "concerns": ["财务隐忧1"],
    "revenueChart": {
      "type": "bar",
      "title": "营收趋势",
      "labels": ["2022", "2023", "2024E", "2025E"],
      "datasets": [{"label": "营收(亿元)", "data": [80, 95, 110, 130]}]
    },
    "profitChart": {
      "type": "line",
      "title": "净利润趋势",
      "labels": ["2022", "2023", "2024E", "2025E"],
      "datasets": [{"label": "净利润(亿元)", "data": [8, 10, 13, 17]}]
    }
  },
  "valuationAnalysis": {
    "currentPrice": "当前股价",
    "targetPrice": "目标价",
    "pe": "市盈率",
    "pb": "市净率",
    "peg": "PEG",
    "valuationMethod": "估值方法（DCF/可比公司等）",
    "conclusion": "估值结论（高估/合理/低估，以及理由）"
  },
  "summary": {
    "rating": "买入/增持/持有/减持",
    "score": 4,
    "coreLogic": "一句话核心投资逻辑",
    "catalysts": ["催化剂1", "催化剂2"],
    "keyPoints": ["要点1", "要点2", "要点3"]
  },
  "riskWarnings": {
    "level": "medium",
    "risks": [
      {"category": "行业风险", "description": "具体描述"},
      {"category": "经营风险", "description": "具体描述"},
      {"category": "市场风险", "description": "具体描述"}
    ]
  }
}

**图表数据要求：**
- revenueChart 和 profitChart 必须包含，用于前端渲染图表
- labels 为年份数组，data 为对应数值数组（纯数字，单位统一为亿元）
- 如果研报中有具体财务预测数据，使用实际数据
- 如果没有，根据上下文合理推测，标注"（推测）"

注意：
- score 为 1-5 整数评分（1=强烈不推荐 2=不推荐 3=中性 4=推荐 5=强烈推荐）
- 如果研报中没有明确数据，用合理推断填充，标注"（推测）"
- risks 至少列出 3 条
- 所有字段必须有值，不能为空`

/* ========== 核心功能 ========== */

/**
 * 生成 6 维度深度分析
 *
 * 策略：
 *   1. 如果研报有结构化内容（VL 视觉识别），将表格/图表信息注入 prompt
 *   2. 如果文本超长，使用 RAG 分块提取关键信息
 *   3. 短文档直接全文分析
 *
 * @param rawText            - pdf-parse 提取的原文
 * @param reportId           - 研报 ID（用于获取 RAG 分块和结构化内容）
 * @param structuredContent  - Qwen-VL 视觉解析的结构化内容（可选）
 */
export async function generateDeepAnalysis(
  rawText: string,
  reportId?: string,
  structuredContent?: Record<string, unknown> | null
): Promise<DeepAnalysis> {
  let analysisInput = rawText.slice(0, config.summaryMaxInputChars)

  // 注入结构化内容（表格和图表信息）
  if (structuredContent) {
    const structuredText = extractStructuredSummary(structuredContent)
    if (structuredText) {
      analysisInput = `【研报中识别到的表格和图表数据】\n${structuredText}\n\n【研报原文】\n${analysisInput}`
    }
  }

  // 长文档使用 RAG 分块
  if (rawText.length > config.summaryMaxInputChars && reportId) {
    try {
      const { getChunks } = await import('./rag/vectorStore')
      const chunks = getChunks(reportId)
      if (chunks.length > 0) {
        const chunkText = chunks.map((c, i) => {
          const typeLabel = c.chunkType === 'table' ? '[表格]' : c.chunkType === 'chart' ? '[图表]' : ''
          return `[第${i + 1}段]${typeLabel}\n${c.text}`
        }).join('\n\n')
        analysisInput = chunkText.slice(0, config.summaryMaxInputChars * 2)
        console.log(`[DeepAnalysis] 使用 RAG 分块（${chunks.length} 块）进行分析`)
      }
    } catch { /* 降级为截断 */ }
  }

  const content = await chat(
    [
      { role: 'system', content: DEEP_ANALYSIS_PROMPT },
      { role: 'user', content: `研报原文：\n\n${analysisInput}` },
    ],
    { maxTokens: 4096 }
  )

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as DeepAnalysis
      if (typeof parsed.summary?.score === 'number') {
        parsed.summary.score = Math.max(1, Math.min(5, Math.round(parsed.summary.score)))
      }
      // 确保图表数据结构完整
      if (parsed.financialAnalysis) {
        parsed.financialAnalysis.revenueChart = normalizeChart(parsed.financialAnalysis.revenueChart, '营收趋势', 'bar')
        parsed.financialAnalysis.profitChart = normalizeChart(parsed.financialAnalysis.profitChart, '净利润趋势', 'line')
      }
      console.log('[DeepAnalysis] 结构化深度分析解析成功')
      return parsed
    } catch (e) {
      console.warn('[DeepAnalysis] JSON 解析失败:', e)
    }
  }

  return fallbackAnalysis(content)
}

/* ========== 工具函数 ========== */

/** 从结构化内容中提取表格和图表的摘要文本 */
function extractStructuredSummary(content: Record<string, unknown>): string {
  const pages = content.pages as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(pages)) return ''

  const parts: string[] = []
  for (const page of pages) {
    const sections = page.sections as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(sections)) continue
    for (const s of sections) {
      if (s.type === 'table') {
        const headers = s.headers as string[] | undefined
        const rows = s.rows as string[][] | undefined
        if (headers && rows) {
          parts.push(`表格「${s.title || ''}」: ${headers.join(', ')}`)
          for (const row of rows.slice(0, 5)) {
            parts.push('  ' + row.join(', '))
          }
          if (rows.length > 5) parts.push(`  ...共 ${rows.length} 行`)
        }
      } else if (s.type === 'chart') {
        parts.push(`图表「${s.title || ''}」(${s.chartType}): ${s.description || ''}`)
      }
    }
  }
  return parts.join('\n')
}

/** 确保图表数据结构合法 */
function normalizeChart(
  chart: ChartData | undefined,
  defaultTitle: string,
  defaultType: 'bar' | 'line'
): ChartData | undefined {
  if (!chart) return undefined
  return {
    type: chart.type || defaultType,
    title: chart.title || defaultTitle,
    labels: Array.isArray(chart.labels) ? chart.labels.map(String) : [],
    datasets: Array.isArray(chart.datasets)
      ? chart.datasets.map((ds) => ({
          label: String(ds.label || ''),
          data: Array.isArray(ds.data) ? ds.data.map(Number) : [],
        }))
      : [],
  }
}

/** 降级分析结果（LLM 无法输出结构化 JSON 时） */
function fallbackAnalysis(text: string): DeepAnalysis {
  return {
    companyOverview: {
      name: '', code: '', industry: '', mainBusiness: text.slice(0, 200),
      highlights: [],
    },
    industryAnalysis: {
      industryName: '', trends: [], competitiveLandscape: '', companyPosition: '',
    },
    financialAnalysis: {
      highlights: [], concerns: [],
      revenueChart: { type: 'bar', title: '营收趋势', labels: [], datasets: [] },
      profitChart: { type: 'line', title: '净利润趋势', labels: [], datasets: [] },
    },
    valuationAnalysis: { conclusion: '无法解析估值信息' },
    summary: {
      rating: '持有', score: 3, coreLogic: text.slice(0, 100),
      catalysts: [], keyPoints: [],
    },
    riskWarnings: {
      level: 'medium',
      risks: [{ category: '解析风险', description: 'AI 无法完整解析该研报，建议查看原文' }],
    },
  }
}
