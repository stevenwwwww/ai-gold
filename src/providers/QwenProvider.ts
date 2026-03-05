/**
 * 千问（通义千问）模型提供者
 * H5 支持流式返回逐字显示，小程序一次性返回
 */
import type { IModelProvider } from './IModelProvider'
import type { ChatParams, ChatResponse } from '@/services/model/types'
import { request } from '@/utils/request'
import { requestStream } from '@/utils/requestStream'
import { qwenConfig } from '@/config/models.config'
import { SYSTEM_PROMPT } from '@/constants/prompts'

export class QwenProvider implements IModelProvider {
  id = 'qwen'
  name = qwenConfig.name
  stream = true

  private getApiUrl(): string {
    return `${qwenConfig.baseUrl}/chat/completions`
  }

  private buildMessages(params: ChatParams) {
    const sysMsg = { role: 'system' as const, content: SYSTEM_PROMPT }
    const userMsgs = params.messages.map((m) => ({ role: m.role, content: m.content }))
    return [sysMsg, ...userMsgs]
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const body = {
      model: qwenConfig.modelName,
      messages: this.buildMessages(params),
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
      stream: false,
    }
    const res = await request<{
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }>({
      url: this.getApiUrl(),
      method: 'POST',
      header: {
        Authorization: `Bearer ${qwenConfig.apiKey}`,
      },
      data: body,
      timeout: 60000,
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
            totalTokens: usage.total_tokens,
          }
        : undefined,
    }
  }

  async *chatStream(params: ChatParams): AsyncGenerator<string, void, unknown> {
    const body = {
      model: qwenConfig.modelName,
      messages: this.buildMessages(params),
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
      stream: true, // H5 会真正流式，小程序 requestStream 内部会改为 stream:false
    }
    yield* requestStream({
      url: this.getApiUrl(),
      method: 'POST',
      data: body,
      header: {
        Authorization: `Bearer ${qwenConfig.apiKey}`,
      },
      timeout: 60000,
    })
  }
}
