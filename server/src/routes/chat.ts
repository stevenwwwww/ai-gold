/**
 * 对话路由 - POST /api/chat
 *
 * v3 架构：对话走 RAGFlow API，自带原文引用（reference）
 *
 * 支持模式：
 *   1. RAGFlow 模式（优先）：通过 RAGFlow Chat Completion API
 *      - 自动从知识库检索相关片段
 *      - 返回 reference（原文引用 + 页码定位）
 *   2. 降级模式：RAGFlow 不可用时，使用本地 LLM 直接对话
 *
 * 核心流程：
 *   1. 前端传入 messages + reportId
 *   2. 查找对应研报的 ragflow_dataset_id
 *   3. 通过 RAGFlow retrieval API 检索相关片段
 *   4. 使用 RAGFlow chat completion 或本地 LLM 生成回答
 *   5. 返回 content + references（原文出处）
 */
import { Router, Request, Response } from 'express'
import { config } from '../config'
import { chat as llmChat, type ChatMessage } from '../services/llmService'
import { getReport, addChatRecord, getChatHistory } from '../services/reportStore'
import * as ragflow from '../services/ragflowService'

export const chatRouter = Router()

const FALLBACK_SYSTEM_PREFIX = '【以下为研报原文摘录，请仅基于此内容回答，不要编造。】\n\n'

const RAG_SYSTEM_PROMPT = `你是一位专业证券分析师助手。以下是从研报中检索到的与用户问题最相关的片段。

【重要规则】
1. 只能基于以下片段内容回答，严禁编造任何不在片段中的信息
2. 如果片段中没有相关信息，明确告知用户"该研报中未涉及此内容"
3. 回答时引用来源片段编号，如 [片段1]、[片段2]
4. 表格和图表数据要完整引用，不要遗漏
5. 回答要专业、简洁、有条理

【检索到的研报片段】
`

chatRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { reportId, reportIds, messages, reportContext, model } = req.body || {}

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

    // 收集需要检索的 datasetIds
    const targetDatasetIds: string[] = []
    const targetReportId = reportId || (Array.isArray(reportIds) && reportIds[0])

    if (Array.isArray(reportIds) && reportIds.length > 0) {
      for (const rid of reportIds.slice(0, config.multiReportMax)) {
        const rpt = getReport(rid)
        if (rpt?.ragflowDatasetId) targetDatasetIds.push(rpt.ragflowDatasetId)
      }
    } else if (reportId) {
      const report = getReport(reportId)
      if (!report) { res.status(404).json({ error: '研报不存在' }); return }
      if (report.ragflowDatasetId) targetDatasetIds.push(report.ragflowDatasetId)
    }

    // ===== 模式1: RAGFlow Chat（首选） =====
    if (config.ragflowChatId && config.ragflowApiKey && targetDatasetIds.length > 0) {
      try {
        const result = await ragflowChatMode(userQuery, messages, targetDatasetIds)

        if (targetReportId) {
          addChatRecord(targetReportId, 'user', userQuery)
          addChatRecord(targetReportId, 'assistant', result.content)
        }

        res.json({
          content: result.content,
          references: result.references,
        })
        return
      } catch (e) {
        console.warn('[Chat] RAGFlow chat 失败，降级为 retrieval + LLM:', e)
      }
    }

    // ===== 模式2: RAGFlow Retrieval + 本地 LLM =====
    if (config.ragflowApiKey && targetDatasetIds.length > 0) {
      try {
        const result = await ragflowRetrievalMode(userQuery, messages, targetDatasetIds, model)

        if (targetReportId) {
          addChatRecord(targetReportId, 'user', userQuery)
          addChatRecord(targetReportId, 'assistant', result.content)
        }

        res.json({
          content: result.content,
          references: result.references,
        })
        return
      } catch (e) {
        console.warn('[Chat] RAGFlow retrieval 失败，降级为纯文本:', e)
      }
    }

    // ===== 模式3: 降级为纯文本截断 + 本地 LLM =====
    let systemContent = ''

    if (targetReportId) {
      const report = getReport(targetReportId)
      if (report) {
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

    const content = await llmChat(llmMessages, { model })

    if (targetReportId) {
      addChatRecord(targetReportId, 'user', userQuery)
      addChatRecord(targetReportId, 'assistant', content)
    }

    res.json({ content })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '对话失败'
    res.status(500).json({ error: msg })
  }
})

/**
 * RAGFlow Chat 模式
 * 直接调用 RAGFlow 的 chat completion API
 * 由 RAGFlow 内部完成 retrieval + LLM 调用
 */
async function ragflowChatMode(
  userQuery: string,
  messages: Array<{ role: string; content: string }>,
  _datasetIds: string[]
): Promise<{ content: string; references: ReferenceItem[] }> {
  const chatMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const result = await ragflow.chatCompletion(config.ragflowChatId, chatMessages)

  const references = extractReferences(result.reference)
  console.log(`[Chat/RAGFlow] 回答长度: ${result.content.length}, 引用: ${references.length} 个片段`)

  return { content: result.content, references }
}

/**
 * RAGFlow Retrieval + 本地 LLM 模式
 * 用 RAGFlow 检索，用本地 LLM 生成回答
 * 适用于 RAGFlow Chat 不可用但 Retrieval 可用的场景
 */
async function ragflowRetrievalMode(
  userQuery: string,
  messages: Array<{ role: string; content: string }>,
  datasetIds: string[],
  model?: string
): Promise<{ content: string; references: ReferenceItem[] }> {
  const uniqueIds = [...new Set(datasetIds)]
  const { chunks } = await ragflow.retrieve(userQuery, uniqueIds, { top_k: 8 })

  if (!chunks.length) {
    console.log('[Chat/RAGFlow] 检索无结果，降级')
    throw new Error('RAGFlow 检索无结果')
  }

  const contextParts = chunks.map((c, i) =>
    `[片段${i + 1}] (来源: ${c.document_name}, 相关度: ${(c.similarity * 100).toFixed(0)}%)\n${c.content}`
  )

  const systemContent = RAG_SYSTEM_PROMPT + contextParts.join('\n\n---\n\n')

  const llmMessages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  const content = await llmChat(llmMessages, { model })

  const references: ReferenceItem[] = chunks.map((c) => ({
    content: c.content.slice(0, 300),
    documentName: c.document_name,
    similarity: c.similarity,
    positions: c.positions,
  }))

  console.log(`[Chat/Retrieval+LLM] 检索 ${chunks.length} 片段, 回答 ${content.length} 字`)

  return { content, references }
}

/** 标准化的引用结构，前端展示用 */
interface ReferenceItem {
  content: string
  documentName: string
  similarity: number
  positions: number[][]
}

/** 从 RAGFlow response 中提取引用 */
function extractReferences(ref?: ragflow.RagflowReference | null): ReferenceItem[] {
  if (!ref?.chunks) return []
  return Object.values(ref.chunks).map((c) => ({
    content: c.content.slice(0, 300),
    documentName: c.document_name,
    similarity: c.similarity,
    positions: c.positions,
  }))
}

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
