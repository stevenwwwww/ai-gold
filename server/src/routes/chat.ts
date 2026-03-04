/**
 * 对话路由 - POST /api/chat
 * 支持两种模式：
 *   1. reportId 模式：自动从数据库取研报上下文 + 聊天记录持久化
 *   2. reportContext 模式：前端直传上下文（兼容旧接口）
 * 预留：RAG 注入点
 */
import { Router, Request, Response } from 'express'
import { config } from '../config'
import { chat, type ChatMessage } from '../services/llmService'
import { getReport, addChatRecord, getChatHistory } from '../services/reportStore'

export const chatRouter = Router()

const SYSTEM_PREFIX = '【以下为研报原文，请仅基于此内容回答用户问题，不要编造。如果研报中没有相关信息，请如实说明。】\n\n'

chatRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { reportId, messages, reportContext, model } = req.body || {}

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages 必填且为非空数组' })
    }

    // 参数校验
    const validRoles = new Set(['user', 'assistant'])
    for (const m of messages) {
      if (!m.role || !validRoles.has(m.role) || typeof m.content !== 'string') {
        return res.status(400).json({ error: 'messages 格式错误：每条需含 role(user/assistant) 和 content(string)' })
      }
    }

    // 获取研报上下文
    let contextText = ''
    if (reportId) {
      const report = getReport(reportId)
      if (!report) {
        return res.status(404).json({ error: '研报不存在' })
      }
      contextText = report.rawText
    } else if (typeof reportContext === 'string' && reportContext.trim()) {
      contextText = reportContext
    }

    // 构造 LLM 消息
    const llmMessages: ChatMessage[] = []
    if (contextText) {
      llmMessages.push({
        role: 'system',
        content: SYSTEM_PREFIX + contextText.slice(0, config.summaryMaxInputChars),
      })
    }
    for (const m of messages) {
      llmMessages.push({ role: m.role, content: String(m.content) })
    }

    const content = await chat(llmMessages, { model })

    // 持久化聊天记录（仅 reportId 模式）
    if (reportId) {
      const lastUserMsg = messages[messages.length - 1]
      if (lastUserMsg?.role === 'user') {
        addChatRecord(reportId, 'user', lastUserMsg.content)
      }
      addChatRecord(reportId, 'assistant', content)
    }

    res.json({ content })
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
