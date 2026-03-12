/**
 * 医生助手 API — 知识库对话（不绑定研报）
 */
import request from './request'
import { useAuthStore } from '@/store/auth'

export interface ChatReference {
  content: string
  documentName: string
  similarity: number
  positions: number[][]
}

export async function getDoctorDatasets(): Promise<{ datasetIds: string[] }> {
  const res = await request.get<{ datasetIds: string[] }>('/doctor/datasets')
  return res.data
}

export async function chatWithKnowledge(
  datasetIds: string[],
  messages: { role: string; content: string }[]
) {
  const res = await request.post<{
    content: string
    references?: ChatReference[]
  }>('/chat', { datasetIds, messages })
  return res.data
}

/** 流式对话 — 返回 async iterable，yield { type, content?, references?, error? } */
export async function* chatWithKnowledgeStream(
  datasetIds: string[],
  messages: { role: string; content: string }[]
): AsyncGenerator<{ type: string; content?: string; references?: ChatReference[]; error?: string }> {
  const token = useAuthStore.getState().token
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ datasetIds, messages }),
  })
  if (!res.ok) throw new Error(await res.text())
  if (!res.body) throw new Error('No body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            yield data
          } catch {
            /* skip */
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
