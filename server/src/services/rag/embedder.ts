/**
 * Embedding 服务 — 调用 DashScope text-embedding-v3
 *
 * 为什么用 DashScope：
 *   - 和 Qwen 同一个 API Key，零额外配置
 *   - text-embedding-v3 支持中文，1024 维，性能好
 *   - 也可配置为 OpenAI 兼容接口，方便切换
 *
 * 批处理：API 单次最多 25 条文本，超过自动分批
 */
import { config } from '../../config'

const EMBEDDING_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-v3'
const BATCH_SIZE = 25

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const apiKey = config.qwenApiKey
  if (!apiKey) throw new Error('未配置 QWEN_API_KEY，无法生成 Embedding')

  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const res = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Embedding API 错误 ${res.status}: ${errText.slice(0, 200)}`)
    }

    const data = await res.json() as {
      data: Array<{ embedding: number[]; index: number }>
    }

    const sorted = data.data.sort((a, b) => a.index - b.index)
    for (const item of sorted) {
      allEmbeddings.push(item.embedding)
    }
  }

  return allEmbeddings
}

export async function getEmbedding(text: string): Promise<number[]> {
  const [emb] = await getEmbeddings([text])
  return emb
}
