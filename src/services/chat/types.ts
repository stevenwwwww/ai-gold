/**
 * 对话服务类型定义
 */

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  error?: string
}

export interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}
