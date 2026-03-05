/**
 * 对话服务 - 管理消息列表、调用模型、缓存历史
 * 支持流式返回，逐字更新 UI 提升体验
 */
import { getModelService } from '@/services/model/ModelService'
import { getHistoryService } from '@/services/history/HistoryService'
import type { ChatMessage } from './types'

export type OnMessageUpdate = (messages: ChatMessage[]) => void

export class ChatService {
  private messages: ChatMessage[] = []
  private onUpdate: OnMessageUpdate | null = null
  private sessionId: string

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  getSessionId(): string {
    return this.sessionId
  }

  setOnUpdate(cb: OnMessageUpdate | null) {
    this.onUpdate = cb
  }

  private notify() {
    this.onUpdate?.([...this.messages])
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  async send(content: string): Promise<void> {
    if (!content?.trim()) return

    const userMsg: ChatMessage = { role: 'user', content: content.trim() }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', loading: true }

    this.messages = [...this.messages, userMsg, assistantMsg]
    this.notify()

    const modelService = getModelService()
    const history = this.messages
      .filter((m) => !m.loading && !m.error)
      .map((m) => ({ role: m.role, content: m.content }))

    const lastIdx = this.messages.length - 1

    try {
      const provider = modelService.getProvider()
      if (provider.chatStream) {
        // 流式返回：逐 chunk 更新 UI
        let fullContent = ''
        for await (const chunk of modelService.chatStream({ messages: [...history] })) {
          fullContent += chunk
          this.messages = this.messages.map((m, i) =>
            m.loading && i === lastIdx
              ? { ...m, content: fullContent, loading: true }
              : m
          )
          this.notify()
        }
        this.messages = this.messages.map((m, i) =>
          m.loading && i === lastIdx
            ? { ...m, content: fullContent, loading: false }
            : m
        )
      } else {
        const res = await modelService.chat({ messages: [...history] })
        this.messages = this.messages.map((m, i) =>
          m.loading && i === lastIdx
            ? { ...m, content: res.content, loading: false }
            : m
        )
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败'
      this.messages = this.messages.map((m, i) =>
        m.loading && i === lastIdx
          ? { ...m, content: '', loading: false, error: errMsg }
          : m
      )
    }

    this.notify()
    this.persistSession()
  }

  clear(): void {
    this.messages = []
    this.notify()
  }

  async retryFailed(idx: number): Promise<void> {
    const msg = this.messages[idx]
    if (!msg || msg.role !== 'assistant' || !msg.error) return

    let userIdx = -1
    for (let i = idx - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        userIdx = i
        break
      }
    }
    if (userIdx < 0) return

    const failedMsg = this.messages[idx]
    const userContent = this.messages[userIdx].content

    this.messages[idx] = { ...failedMsg, content: '', loading: true, error: undefined }
    this.notify()

    const modelService = getModelService()
    const history = this.messages
      .slice(0, userIdx)
      .filter((m) => !m.loading && !m.error)
      .map((m) => ({ role: m.role, content: m.content }))
    const fullHistory = [...history, { role: 'user' as const, content: userContent }]

    const lastIdx = idx

    try {
      const provider = modelService.getProvider()
      if (provider.chatStream) {
        let fullContent = ''
        for await (const chunk of modelService.chatStream({ messages: fullHistory })) {
          fullContent += chunk
          this.messages[idx] = { ...failedMsg, content: fullContent, loading: true, error: undefined }
          this.notify()
        }
        this.messages[lastIdx] = { ...failedMsg, content: fullContent, loading: false, error: undefined }
      } else {
        const res = await modelService.chat({ messages: fullHistory })
        this.messages[lastIdx] = { ...failedMsg, content: res.content, loading: false, error: undefined }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败'
      this.messages[lastIdx] = { ...failedMsg, content: '', loading: false, error: errMsg }
    }
    this.notify()
    this.persistSession()
  }

  /** 加载指定会话 */
  async loadSession(sessionId: string): Promise<void> {
    const session = await getHistoryService().getSession(sessionId)
    if (session) {
      this.sessionId = session.id
      this.messages = session.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      this.notify()
    }
  }

  private async persistSession(): Promise<void> {
    try {
      const validMsgs = this.messages
        .filter((m) => !m.loading && m.content)
        .map(({ role, content }) => ({ role, content }))
      if (validMsgs.length === 0) return

      const firstUser = validMsgs.find((m) => m.role === 'user')
      const title = firstUser
        ? firstUser.content.slice(0, 30) + (firstUser.content.length > 30 ? '...' : '')
        : '新对话'

      await getHistoryService().saveSession({
        id: this.sessionId,
        title,
        messages: validMsgs,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    } catch (e) {
      console.warn('[ChatService] persistSession error:', e)
    }
  }
}

/**
 * 每次调用都创建全新会话实例
 */
export function createChatService(): ChatService {
  return new ChatService()
}
