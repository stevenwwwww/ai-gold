/**
 * DeepSeek 模型提供者
 * 在 models.config.ts 中填入 apiKey 和 modelName 即可使用
 */
import type { IModelProvider } from './IModelProvider'
import type { ChatParams, ChatResponse } from '@/services/model/types'
import { request } from '@/utils/request'
import { deepseekConfig } from '@/config/models.config'
import { SYSTEM_PROMPT } from '@/constants/prompts'

export class DeepSeekProvider implements IModelProvider {
  id = 'deepseek'
  name = deepseekConfig.name
  stream = true

  private getApiUrl(): string {
    return `${deepseekConfig.baseUrl}/chat/completions`
  }

  private buildMessages(params: ChatParams) {
    const systemMsg = { role: 'system' as const, content: SYSTEM_PROMPT }
    const userMessages = params.messages.map((m) => ({ role: m.role, content: m.content }))
    return [systemMsg, ...userMessages]
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (!deepseekConfig.apiKey) {
      return { content: '请在 src/config/models.config.ts 中配置 DeepSeek 的 apiKey 和 modelName。' }
    }

    const res = await request<{
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }>({
      url: this.getApiUrl(),
      method: 'POST',
      header: {
        Authorization: `Bearer ${deepseekConfig.apiKey}`
      },
      data: {
        model: deepseekConfig.modelName,
        messages: this.buildMessages(params),
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 2048
      },
      timeout: 60000
    })

    const choice = res.data?.choices?.[0]
    const content = choice?.message?.content ?? ''
    const usage = res.data?.usage

    return {
      content,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens
          }
        : undefined
    }
  }

  async *chatStream(params: ChatParams): AsyncGenerator<string, void, unknown> {
    const res = await this.chat(params)
    yield res.content
  }
}
