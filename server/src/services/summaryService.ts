/**
 * 一页纸摘要生成 - 调用 LLM 生成结构化摘要
 * 预留：多模板、多语言
 */
import { chat } from './llmService'

export interface ReportSummary {
  stockName?: string
  stockCode?: string
  reportTitle?: string
  institution?: string
  analyst?: string
  publishDate?: string
  rating?: string // 买入/增持/持有/减持
  targetPrice?: string
  currentPrice?: string
  potentialGain?: string
  coreLogic?: string
  catalysts?: string[]
  risks?: string[]
  financialForecast?: { year: string; revenue?: string; profit?: string; eps?: string }[]
}

const SUMMARY_PROMPT = `你是一位专业的证券分析师助手。请根据以下研报原文，提取并生成结构化的"一页纸"摘要。

要求：
1. 基本信息：证券名称、代码、研报标题、发布机构、分析师、发布日期
2. 投资评级：买入/增持/持有/减持
3. 目标价、当前价（如有）、潜在涨幅
4. 一句话核心逻辑：为什么看好/看空
5. 催化剂：短期内可能推动股价的事件（列表）
6. 风险提示：研报中提到的风险点（列表）
7. 财务预测：未来2-3年营收、净利润、EPS预测（如有）

请以 JSON 格式输出，不要输出其他文字。格式示例：
{
  "stockName": "某某科技",
  "stockCode": "600xxx",
  "reportTitle": "深度报告标题",
  "institution": "某某证券",
  "analyst": "分析师名",
  "publishDate": "2024-01-15",
  "rating": "买入",
  "targetPrice": "25.00",
  "currentPrice": "20.00",
  "potentialGain": "+25%",
  "coreLogic": "一句话核心逻辑",
  "catalysts": ["催化剂1", "催化剂2"],
  "risks": ["风险1", "风险2"],
  "financialForecast": [{"year":"2024","revenue":"100亿","profit":"10亿","eps":"1.0"}]
}

如果某字段无法从研报中提取，可省略或填空字符串。`

export async function generateSummary(rawText: string): Promise<ReportSummary> {
  const { summaryMaxInputChars } = await import('../config').then(m => m.config)
  const truncated = rawText.slice(0, summaryMaxInputChars)

  const content = await chat(
    [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: `研报原文：\n\n${truncated}` },
    ],
    { maxTokens: 2048 }
  )

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as ReportSummary
      console.log('[Summary] 结构化摘要解析成功')
      return parsed
    } catch (e) {
      console.warn('[Summary] JSON 解析失败，回退为纯文本摘要', e)
    }
  }

  return {
    coreLogic: content.slice(0, 500),
    catalysts: [],
    risks: [],
  }
}
