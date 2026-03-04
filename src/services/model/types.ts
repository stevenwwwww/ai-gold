/**
 * 模型服务类型定义
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatParams {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface ChatResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}
