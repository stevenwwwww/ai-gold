/**
 * 流式请求 - 用于大模型 SSE 流式响应
 * H5 使用 fetch + ReadableStream 实现真正流式
 * 小程序使用 Taro.request 回退为非流式（一次性返回）
 */
import Taro from '@tarojs/taro'

export interface StreamRequestOptions {
  url: string
  method?: 'GET' | 'POST'
  data?: Record<string, unknown>
  header?: Record<string, string>
  timeout?: number
}

/** 检测是否支持 fetch 流式（H5 环境） */
function canUseFetchStream(): boolean {
  return typeof fetch !== 'undefined' && typeof ReadableStream !== 'undefined'
}

/**
 * 解析 SSE 行中的 JSON，提取 content delta
 */
function parseSSELine(line: string): string {
  if (line.startsWith('data: ')) {
    const jsonStr = line.slice(6).trim()
    if (jsonStr === '[DONE]') return ''
    try {
      const obj = JSON.parse(jsonStr)
      const delta = obj?.choices?.[0]?.delta?.content
      return typeof delta === 'string' ? delta : ''
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * 流式请求 - 逐 chunk 产出内容
 * 小程序环境会退化为一次性返回
 */
export async function* requestStream(
  options: StreamRequestOptions
): AsyncGenerator<string, void, unknown> {
  const { url, method = 'POST', data = {}, header = {}, timeout = 60000 } = options

  if (canUseFetchStream()) {
    // H5: 使用 fetch 实现真正流式
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...header,
        },
        body: method === 'POST' ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('Stream not supported')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const content = parseSSELine(line)
          if (content) yield content
        }
      }

      if (buffer) {
        const content = parseSSELine(buffer)
        if (content) yield content
      }
    } catch (err) {
      clearTimeout(timer)
      throw err instanceof Error ? err : new Error(String(err))
    }
  } else {
    // 小程序: wx.request 不支持流式，一次性返回
    const body = { ...data, stream: false }
    const res = await new Promise<{ choices?: Array<{ message?: { content?: string } }> }>(
      (resolve, reject) => {
        Taro.request({
          url,
          method,
          data: body,
          header: {
            'Content-Type': 'application/json',
            ...header,
          },
          timeout,
          success: (r) => {
            if (r.statusCode >= 200 && r.statusCode < 300) {
              resolve((r.data as { choices?: Array<{ message?: { content?: string } }> }) ?? {})
            } else {
              reject(new Error(`HTTP ${r.statusCode}`))
            }
          },
          fail: (e) => reject(new Error(e.errMsg || 'Network error')),
        })
      }
    )

    const content = res?.choices?.[0]?.message?.content ?? ''
    if (content) yield content
  }
}
