/**
 * 对话路由 - POST /api/chat
 *
 * 支持两种模式：
 *   1. 单研报模式 (reportId)   → RAG 检索 → LLM 回答 + 来源引用
 *   2. 多研报模式 (reportIds[]) → 多研报联合检索 → 结构化合成器 → 结构化 JSON
 *
 * 核心流程（RAG 增强）：
 *   1. 拿到用户最新问题
 *   2. 通过 RAG 检索最相关的 Top-K 片段（可跨多研报）
 *   3. 把检索到的片段注入 system prompt
 *   4. 调用 LLM（或 synthesizer）生成回答
 *   5. 返回回答 + 引用来源
 *
 * 降级策略：
 *   - 研报未建立索引 → 自动建立
 *   - RAG 检索失败 → 降级为全文截断模式
 */
import { Router, Request, Response } from 'express'
import { config } from '../config'
import { chat, type ChatMessage } from '../services/llmService'
import { getReport, addChatRecord, getChatHistory } from '../services/reportStore'
import { retrieveContext, retrieveMultiContext, ensureIndexed, hasChunks } from '../services/rag'
import { synthesize } from '../services/synthesizer'

export const chatRouter = Router()

const RAG_SYSTEM_PROMPT = `你是一位专业证券分析师助手。以下是从研报中检索到的与用户问题最相关的片段。

【重要规则】
1. 只能基于以下片段内容回答，严禁编造任何不在片段中的信息
2. 如果片段中没有相关信息，明确告知用户"该研报中未涉及此内容"
3. 回答时引用来源片段编号，如 [片段1]、[片段2]
4. 表格和图表数据要完整引用，不要遗漏
5. 回答要专业、简洁、有条理

【检索到的研报片段】
`

const FALLBACK_SYSTEM_PREFIX = '【以下为研报原文摘录，请仅基于此内容回答，不要编造。】\n\n'

chatRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { reportId, reportIds, messages, reportContext, model, structured } = req.body || {}

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 必填且为非空数组' }); return
    }

    const validRoles = new Set(['user', 'assistant'])
    for (const m of messages) {
      if (!m.role || !validRoles.has(m.role) || typeof m.content !== 'string') {
        res.status(400).json({ error: 'messages 格式错误' }); return
      }
    }

    const lastUserMsg = messages.filter((m: { role: string }) => m.role === 'user').pop()
    const userQuery = lastUserMsg?.content || ''

    // ===== 多研报模式 =====
    if (Array.isArray(reportIds) && reportIds.length > 0) {
      const validIds = reportIds.slice(0, config.multiReportMax).map(String)

      // 确保所有研报已索引
      for (const rid of validIds) {
        const rpt = getReport(rid)
        if (rpt && !hasChunks(rid)) {
          await ensureIndexed(rid, rpt.rawText, rpt.structuredContent)
        }
      }

      const { context, sources } = await retrieveMultiContext(validIds, userQuery, 10)

      if (structured) {
        // 结构化合成模式
        const result = await synthesize(
          context, userQuery,
          sources.map((s) => ({ reportId: s.reportId, chunkIndex: s.chunkIndex }))
        )
        res.json({ success: true, type: 'structured', data: result, sources })
        return
      }

      // 普通多研报对话模式
      const llmMessages: ChatMessage[] = [
        { role: 'system', content: RAG_SYSTEM_PROMPT + context },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ]
      const content = await chat(llmMessages, { model })
      res.json({ content, sources })
      return
    }

    // ===== 单研报模式 =====
    let systemContent = ''
    let ragSources: Array<{ chunkIndex: number; score: number; text: string; chunkType: string }> = []

    if (reportId) {
      const report = getReport(reportId)
      if (!report) { res.status(404).json({ error: '研报不存在' }); return }

      try {
        await ensureIndexed(reportId, report.rawText, report.structuredContent)
        const { context, sources } = await retrieveContext(reportId, userQuery, 5)
        if (context) {
          systemContent = RAG_SYSTEM_PROMPT + context
          ragSources = sources
          console.log(`[Chat/RAG] 检索到 ${sources.length} 个相关片段, 最高相关度: ${sources[0]?.score}`)
        }
      } catch (ragErr) {
        console.warn('[Chat/RAG] RAG 检索失败，降级为全文截断:', ragErr)
      }

      if (!systemContent) {
        systemContent = FALLBACK_SYSTEM_PREFIX + report.rawText.slice(0, config.summaryMaxInputChars)
      }
    } else if (typeof reportContext === 'string' && reportContext.trim()) {
      systemContent = FALLBACK_SYSTEM_PREFIX + reportContext.slice(0, config.summaryMaxInputChars)
    }

    const llmMessages: ChatMessage[] = []
    if (systemContent) {
      llmMessages.push({ role: 'system', content: systemContent })
    }
    for (const m of messages) {
      llmMessages.push({ role: m.role, content: String(m.content) })
    }

    const content = await chat(llmMessages, { model })

    if (reportId) {
      if (lastUserMsg?.role === 'user') addChatRecord(reportId, 'user', lastUserMsg.content)
      addChatRecord(reportId, 'assistant', content)
    }

    res.json({
      content,
      sources: ragSources.length > 0 ? ragSources : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '对话失败'
    res.status(500).json({ error: msg })
  }
})

/** 获取某研报的聊天历史 */
chatRouter.get('/chat/:reportId/history', (req: Request, res: Response) => {
  try {
    const { reportId } = req.params
    const report = getReport(reportId)
    if (!report) {
      return res.status(404).json({ error: '研报不存在' })
    }
    const history = getChatHistory(reportId)
    res.json({ history })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '查询失败'
    res.status(500).json({ error: msg })
  }
})
