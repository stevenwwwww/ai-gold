/**
 * LLM 调用封装 - 支持千问、DeepSeek
 * 特性：超时控制、自动重试、配置化参数
 * 预留：流式、多 provider 插件化
 */
import { config } from '../config'
import { modelConfigs } from '../config/models'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const modelKey = options.model || config.defaultModel
  const cfg = modelConfigs[modelKey]
  if (!cfg) {
    throw new Error(`未知模型: ${modelKey}，可选: ${Object.keys(modelConfigs).join(', ')}`)
  }

  const apiKey = cfg.id === 'qwen' ? config.qwenApiKey : config.deepseekApiKey
  if (!apiKey) {
    throw new Error(`未配置 ${cfg.name} API Key，请在 .env 中设置`)
  }

  const url = `${cfg.baseUrl}/chat/completions`
  const body = {
    model: cfg.modelName,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? config.llmDefaultTemp,
    max_tokens: options.maxTokens ?? config.llmDefaultMaxTokens,
    stream: false,
  }

  const maxRetries = config.llmMaxRetries
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.llmTimeout)

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const text = await res.text()
        const err = new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`)
        if (res.status >= 500 && attempt < maxRetries) {
          lastError = err
          console.warn(`[LLM] 第 ${attempt + 1} 次重试...`, err.message)
          await sleep(1000 * (attempt + 1))
          continue
        }
        throw err
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      return data?.choices?.[0]?.message?.content ?? ''
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (lastError.name === 'AbortError') {
        throw new Error(`LLM 请求超时 (${config.llmTimeout}ms)`)
      }
      if (attempt < maxRetries) {
        console.warn(`[LLM] 第 ${attempt + 1} 次重试...`, lastError.message)
        await sleep(1000 * (attempt + 1))
        continue
      }
    }
  }

  throw lastError || new Error('LLM 调用失败')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
