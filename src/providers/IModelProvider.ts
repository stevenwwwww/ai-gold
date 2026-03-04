/**
 * 模型提供者接口 - 解耦核心
 * 统一 DeepSeek、千问、未来本地模型的调用方式
 */
import type { ChatParams, ChatResponse } from '@/services/model/types'

export interface IModelProvider {
  /** 唯一标识 */
  id: string
  /** 展示名称 */
  name: string
  /** 是否支持流式输出 */
  stream: boolean

  /** 非流式对话 */
  chat(params: ChatParams): Promise<ChatResponse>

  /** 流式对话（可选） */
  chatStream?(params: ChatParams): AsyncGenerator<string, void, unknown>
}
