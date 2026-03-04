/**
 * 对话服务 - 管理消息列表、调用模型、缓存历史
 * 与 HistoryService 集成，支持后期无缝切换到服务端存储
 */
import { getModelService } from '@/services/model/ModelService'
import { getHistoryService } from '@/services/history/HistoryService'
import { getStorage, setStorage } from '@/utils/platform'
import { config } from '@/constants/config'
import type { ChatMessage } from './types'

export type OnMessageUpdate = (messages: ChatMessage[]) => void

export class ChatService {
  private messages: ChatMessage[] = []
  private onUpdate: OnMessageUpdate | null = null
  private sessionId: string

  constructor() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  setOnUpdate(cb: OnMessageUpdate) {
    this.onUpdate = cb
  }

  private notify() {
    this.onUpdate?.(this.messages)
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

    try {
      const res = await modelService.chat({
        messages: [...history]
      })

      this.messages = this.messages.map((m, i) => {
        if (m.loading && i === this.messages.length - 1) {
          return { ...m, content: res.content, loading: false }
        }
        return m
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败'
      this.messages = this.messages.map((m, i) => {
        if (m.loading && i === this.messages.length - 1) {
          return { ...m, content: '', loading: false, error: errMsg }
        }
        return m
      })
    }

    this.notify()
    this.saveHistory()
    this.saveToHistoryService()
  }

  async *sendStream(content: string): AsyncGenerator<string, void, unknown> {
    if (!content?.trim()) return

    const userMsg: ChatMessage = { role: 'user', content: content.trim() }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', loading: true }

    this.messages = [...this.messages, userMsg, assistantMsg]
    this.notify()

    const modelService = getModelService()
    const history = this.messages
      .filter((m) => !m.loading && !m.error)
      .map((m) => ({ role: m.role, content: m.content }))

    let fullContent = ''
    try {
      for await (const chunk of modelService.chatStream({ messages: history })) {
        fullContent += chunk
        this.messages = this.messages.map((m, i) => {
          if (m.loading && i === this.messages.length - 1) {
            return { ...m, content: fullContent, loading: false }
          }
          return m
        })
        this.notify()
        yield chunk
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败'
      this.messages = this.messages.map((m, i) => {
        if (m.loading && i === this.messages.length - 1) {
          return { ...m, content: fullContent || '', loading: false, error: errMsg }
        }
        return m
      })
      this.notify()
    }

    this.saveHistory()
    this.saveToHistoryService()
  }

  clear(): void {
    this.messages = []
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.notify()
    setStorage(config.storageKeys.chatHistory, [])
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

    try {
      const res = await modelService.chat({ messages: fullHistory })
      this.messages[idx] = { ...failedMsg, content: res.content, loading: false, error: undefined }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败'
      this.messages[idx] = { ...failedMsg, content: '', loading: false, error: errMsg }
    }
    this.notify()
    this.saveHistory()
    this.saveToHistoryService()
  }

  loadHistory(): void {
    const saved = getStorage<ChatMessage[]>(config.storageKeys.chatHistory)
    if (Array.isArray(saved) && saved.length > 0) {
      this.messages = saved
      this.notify()
    }
  }

  private saveHistory(): void {
    const toSave = this.messages
      .filter((m) => !m.loading)
      .map(({ role, content, error }) => ({ role, content, error }))
    setStorage(config.storageKeys.chatHistory, toSave)
  }

  private async saveToHistoryService(): Promise<void> {
    try {
      const validMsgs = this.messages
        .filter((m) => !m.loading && m.content)
        .map(({ role, content }) => ({ role, content }))

      if (validMsgs.length === 0) return

      const firstUserMsg = validMsgs.find((m) => m.role === 'user')
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
        : '新对话'

      await getHistoryService().saveSession({
        id: this.sessionId,
        title,
        messages: validMsgs,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    } catch (e) {
      console.warn('[ChatService] saveToHistoryService error:', e)
    }
  }
}

let chatServiceInstance: ChatService | null = null

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService()
  }
  return chatServiceInstance
}
