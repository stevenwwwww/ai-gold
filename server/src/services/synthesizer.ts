/**
 * 结构化合成器 — AI 加工整理检索片段，输出结构化分析
 *
 * 与旧版对话的区别：
 *   旧版：检索片段 → 直接作为 context 丢给 LLM → LLM 引用原文回答（"复读机"模式）
 *   新版：检索片段 → synthesizer prompt → LLM 加工整理 → 结构化 JSON 输出
 *
 * 输出结构：
 *   - conclusion:  核心结论（AI 综合多源信息后的判断）
 *   - keyData:     关键数据（指标名 + 数值 + 来源）
 *   - viewpoints:  各机构观点（机构名 + 观点 + 评级）
 *   - comparison:  不同研报观点对比分析（多研报时有效）
 *   - risks:       风险提示列表
 *   - sources:     引用来源
 */

import { chat } from './llmService'

export interface SynthesizedResult {
  conclusion: string
  keyData: Array<{ metric: string; value: string; source: string }>
  viewpoints: Array<{ institution: string; view: string; rating: string }>
  comparison: string
  risks: string[]
  sources: Array<{ reportId: string; title: string; chunkIndex: number }>
  rawText?: string
}

const SYNTHESIS_PROMPT = `你是一位资深证券分析师。你将收到从一份或多份研报中检索到的相关片段。

请对这些片段进行深度加工和整理，输出结构化的分析结论。

【关键要求】
1. 不要简单引用原文，要进行归纳、提炼和综合分析
2. 如果多份研报观点不同，需明确对比差异
3. 数据要标注来源
4. 风险点要全面覆盖

严格按以下 JSON 格式输出，不要输出其他文字：

{
  "conclusion": "核心结论（AI综合多源信息后的判断，2-3句话）",
  "keyData": [
    { "metric": "指标名称", "value": "具体数值", "source": "来源研报/机构" }
  ],
  "viewpoints": [
    { "institution": "机构名称", "view": "核心观点", "rating": "评级(如有)" }
  ],
  "comparison": "不同研报观点对比分析（如只有一份研报则写'单一来源'）",
  "risks": ["风险点1", "风险点2", "风险点3"]
}

注意：
- keyData 至少提取 3-5 个关键指标
- risks 至少列出 2 个风险点
- 如果片段中没有某项信息，该字段可为空数组或空字符串`

/**
 * 对检索到的片段进行结构化合成
 *
 * @param context   - RAG 检索到的上下文文本
 * @param query     - 用户原始问题
 * @param sources   - 来源信息（reportId + chunkIndex）
 * @returns 结构化分析结果
 */
export async function synthesize(
  context: string,
  query: string,
  sources: Array<{ reportId: string; chunkIndex: number }>
): Promise<SynthesizedResult> {
  const content = await chat(
    [
      { role: 'system', content: SYNTHESIS_PROMPT },
      { role: 'user', content: `用户问题：${query}\n\n检索到的研报片段：\n\n${context}` },
    ],
    { maxTokens: 4096, temperature: 0.3 }
  )

  return parseSynthesisResponse(content, sources)
}

/**
 * 解析 LLM 返回的结构化合成结果
 * 容错处理：JSON 解析失败时构建降级结果
 */
function parseSynthesisResponse(
  raw: string,
  sources: Array<{ reportId: string; chunkIndex: number }>
): SynthesizedResult {
  const fallback: SynthesizedResult = {
    conclusion: raw.slice(0, 500),
    keyData: [],
    viewpoints: [],
    comparison: '',
    risks: [],
    sources: sources.map((s) => ({ ...s, title: '' })),
    rawText: raw,
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return fallback

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      conclusion: String(parsed.conclusion || ''),
      keyData: Array.isArray(parsed.keyData)
        ? parsed.keyData.map((d: Record<string, unknown>) => ({
            metric: String(d.metric || ''),
            value: String(d.value || ''),
            source: String(d.source || ''),
          }))
        : [],
      viewpoints: Array.isArray(parsed.viewpoints)
        ? parsed.viewpoints.map((v: Record<string, unknown>) => ({
            institution: String(v.institution || ''),
            view: String(v.view || ''),
            rating: String(v.rating || ''),
          }))
        : [],
      comparison: String(parsed.comparison || ''),
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      sources: sources.map((s) => ({ ...s, title: '' })),
    }
  } catch {
    return fallback
  }
}
